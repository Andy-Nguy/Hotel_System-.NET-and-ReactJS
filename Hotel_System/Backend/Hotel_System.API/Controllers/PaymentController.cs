using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Hotel_System.API.Models;
using Hotel_System.API.DTOs;
using Hotel_System.API.Services;
using QuestPDF.Fluent;
using QuestPDF.Infrastructure;
using QuestPDF.Helpers;
using QuestPDF.Drawing;
namespace Hotel_System.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PaymentController : ControllerBase
    {
        private readonly HotelSystemContext _context;
        private readonly ILogger<PaymentController> _logger;
        private readonly IEmailService _emailService;
        private readonly Hotel_System.API.Services.EmailTemplateRenderer _templateRenderer;

        public PaymentController(
            HotelSystemContext context,
            ILogger<PaymentController> logger,
            IEmailService emailService,
            Hotel_System.API.Services.EmailTemplateRenderer templateRenderer
        )
        {
            _context = context;
            _logger = logger;
            _emailService = emailService;
            _templateRenderer = templateRenderer;
        }

        // ===========================
        // CREATE INVOICE (HÓA ĐƠN)
        // - Luôn set HoaDon.TienThanhToan rõ ràng
        // - Đồng bộ DatPhong.TongTien & DatPhong.TrangThaiThanhToan (cash/quầy = 1; online = 2)
        // - Gửi email hóa đơn khi đã thanh toán (online) VỚI BODY
        // ===========================
        [HttpPost("hoa-don")]
        public async Task<IActionResult> CreateInvoice([FromBody] HoaDonPaymentRequest request)
        {
            // If model binding/validation failed, return detailed errors to help the client debug.
            if (!ModelState.IsValid)
            {
                // Log all model state errors for server-side debugging
                var errors = string.Join("; ", ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage));
                _logger.LogWarning("CreateInvoice: model validation failed: {Errors}", errors);
                return BadRequest(new { message = "Validation failed", errors = ModelState });
            }

            using var tx = await _context.Database.BeginTransactionAsync();
            try
            {
                var datPhong = await _context.DatPhongs
                    .Include(dp => dp.ChiTietDatPhongs)
                        .ThenInclude(ct => ct.Phong)
                    .Include(dp => dp.IdkhachHangNavigation)
                    .FirstOrDefaultAsync(dp => dp.IddatPhong == request.IDDatPhong);

                if (datPhong == null)
                    return NotFound(new { message = "Không tìm thấy đơn đặt phòng" });

                // Fallback số ngày
                var soNgay = request.SoLuongNgay ?? datPhong.SoDem ?? 1;

                // Apply promotions to booking room lines so that ChiTietDatPhong.ThanhTien
                // stores the post-discount line total (Giá phòng sau KM × số đêm).
                // This ensures the saved ThanhTien reflects discounts and the invoice/booking totals
                // use the discounted values.
                try
                {
                    var roomIds = datPhong.ChiTietDatPhongs?.Select(ct => ct.IDPhong).Where(id => !string.IsNullOrEmpty(id)).Distinct().ToList() ?? new System.Collections.Generic.List<string>();
                    if (roomIds.Any())
                    {
                        var now = DateTime.UtcNow;
                        var promos = _context.KhuyenMaiPhongs
                            .Include(kmp => kmp.IdkhuyenMaiNavigation)
                            .Where(kmp => roomIds.Contains(kmp.Idphong) && kmp.IdkhuyenMaiNavigation != null
                                && kmp.IdkhuyenMaiNavigation.TrangThai == "active"
                                && kmp.IdkhuyenMaiNavigation.NgayBatDau <= DateOnly.FromDateTime(now)
                                && kmp.IdkhuyenMaiNavigation.NgayKetThuc >= DateOnly.FromDateTime(now))
                            .ToList();

                        foreach (var ct in datPhong.ChiTietDatPhongs ?? new System.Collections.Generic.List<ChiTietDatPhong>())
                        {
                            // Số đêm theo dòng (ct.SoDem kiểu int), fallback sang tổng số ngày
                            var nights = (ct.SoDem > 0) ? ct.SoDem : (datPhong.SoDem ?? 1);
                            if (nights <= 0) nights = 1;

                            // initial per-night price
                            var initialPerNight = ct.GiaPhong;

                            decimal sumPercent = 0m;
                            decimal sumFixed = 0m; // fixed amount discounts (treated as total fixed off the whole line)

                            var roomPromos = promos.Where(p => p.Idphong == ct.IDPhong).Select(p => p.IdkhuyenMaiNavigation).Where(km => km != null).ToList();
                            foreach (var km in roomPromos)
                            {
                                if (km != null && km.GiaTriGiam.HasValue)
                                {
                                    var kind = km.LoaiGiamGia ?? string.Empty;
                                    if (kind.IndexOf("percent", StringComparison.OrdinalIgnoreCase) >= 0 || kind.Contains("%"))
                                    {
                                        // percentage discount
                                        sumPercent += km.GiaTriGiam.Value;
                                    }
                                    else
                                    {
                                        // fixed discount applied to the entire line
                                        sumFixed += km.GiaTriGiam.Value;
                                    }
                                }
                            }

                            // cap percent to 100
                            if (sumPercent > 100m) sumPercent = 100m;

                            // distribute fixed total across nights if any
                            decimal fixedPerNight = nights > 0 ? (sumFixed / (decimal)nights) : sumFixed;

                            var perNightAfterPercent = initialPerNight * (1 - (sumPercent / 100m));
                            var perNightAfter = Math.Max(0m, perNightAfterPercent - fixedPerNight);

                            var lineTotal = perNightAfter * nights;
                            // Lưu ThànhTiền sau KM (làm tròn về đơn vị đồng, away from zero)
                            ct.ThanhTien = Math.Round(lineTotal, 0, MidpointRounding.AwayFromZero);
                        }

                        // NOTE: do NOT persist pre-VAT sum here. We'll compute and persist
                        // the VAT-inclusive booking total after services are considered
                        // (see below where `tongTien` is computed).
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "PaymentController: failed to apply promotions to ChiTietDatPhongs — continuing with original prices");
                }

                // Fallback tiền phòng từ chi tiết nếu client không gửi — after applying promos we use ThanhTien
                var tienPhongTinh = datPhong.ChiTietDatPhongs?.Sum(ct => ct.ThanhTien) ?? 0m;
                int tienPhong = request.TienPhong ?? (int)Math.Round(tienPhongTinh);

                // Compute totals on server-side to avoid client-side mismatch.
                // Room total (after promotions) — we've already updated datPhong.TongTien above to sum of ThanhTien
                decimal roomTotal = datPhong.ChiTietDatPhongs?.Sum(ct => ct.ThanhTien) ?? 0m;

                // Services total from request (if any). Prefer TienDichVu or DonGia*SoLuong
                decimal servicesTotal = 0m;
                if (request.Services != null && request.Services.Any())
                {
                    foreach (var svc in request.Services)
                    {
                        var line = svc.TienDichVu != 0m ? svc.TienDichVu : svc.DonGia * Math.Max(1, svc.SoLuong);
                        servicesTotal += Math.Round(line);
                    }
                }

                // Total before VAT
                decimal totalBeforeVat = roomTotal + servicesTotal;
                // Apply VAT 10% and round to nearest integer
                decimal tongTien = Math.Round(totalBeforeVat * 1.1m, 0, MidpointRounding.AwayFromZero);
                _logger.LogInformation("PaymentController: computed tongTien server-side room={Room} services={Services} tongTien={TongTien}", roomTotal, servicesTotal, tongTien);

                // ============ LOYALTY POINTS: Validate and apply discount ============
                const int POINT_VALUE_VND = 100; // 1 point = 100 VND
                const decimal MAX_REDEEM_PERCENT = 0.5m; // Max 50% invoice discount
                int pointsToUse = request.RedeemPoints ?? 0;
                int customerCurrentPoints = datPhong.IdkhachHangNavigation?.TichDiem ?? 0;
                decimal pointsDiscount = 0m;

                if (pointsToUse > 0)
                {
                    if (pointsToUse > customerCurrentPoints)
                    {
                        await tx.RollbackAsync();
                        return BadRequest(new { message = "Không đủ điểm tích lũy." });
                    }

                    int maxPointsByAmount = (int)Math.Floor((double)(tongTien * MAX_REDEEM_PERCENT / POINT_VALUE_VND));
                    if (pointsToUse > maxPointsByAmount)
                    {
                        await tx.RollbackAsync();
                        return BadRequest(new { message = $"Chỉ được dùng tối đa {maxPointsByAmount} điểm (50% hóa đơn)." });
                    }

                    pointsDiscount = pointsToUse * POINT_VALUE_VND;
                    tongTien = Math.Max(0m, tongTien - pointsDiscount);
                    _logger.LogInformation("PaymentController: applied {Points} points = {Discount}đ discount, new tongTien={TongTien}", pointsToUse, pointsDiscount, tongTien);
                }
                // ======================================================================

                // Persist VAT-inclusive total (after point discount) to booking
                datPhong.TongTien = tongTien;

                // Lấy tiền cọc hiện có trên DatPhong làm nguồn dữ liệu mặc định
                decimal tienCoc = datPhong.TienCoc ?? 0m;

                // Nếu client gửi TienCoc trong request (ví dụ chọn đặt cọc 500k),
                // dùng giá trị đó và cập nhật DatPhong.TienCoc
                if (request.TienCoc.HasValue && request.TienCoc.Value > 0m)
                {
                    tienCoc = request.TienCoc.Value;
                    datPhong.TienCoc = tienCoc;
                }

                // Quy tắc xác định trạng thái thanh toán:
                // - Nếu PhuongThucThanhToan == 2 (online) -> cho phép client override TrangThaiThanhToan (ví dụ: đặt cọc = 0, đã thanh toán = 2)
                // - Nếu PhuongThucThanhToan != 2 (ví dụ: thanh toán tại khách sạn / quầy) -> luôn ghi nhận là CHƯA THANH TOÁN (1)
                int trangThaiThanhToan;
                if (request.PhuongThucThanhToan == 2)
                {
                    // Online: dùng giá trị client gửi nếu hợp lệ, ngược lại mặc định = 2 (đã thanh toán online)
                    trangThaiThanhToan = request.TrangThaiThanhToan.HasValue ? request.TrangThaiThanhToan.Value : 2;
                    if (trangThaiThanhToan != 0 && trangThaiThanhToan != 1 && trangThaiThanhToan != 2)
                        trangThaiThanhToan = 2;
                }
                else
                {
                    // Không phải online (tiền mặt/ tại quầy / tại khách sạn) => lưu là CHƯA THANH TOÁN
                    trangThaiThanhToan = 1;
                }

                // Tính số tiền đã thanh toán trên hóa đơn hiện tại:
                // - Nếu đã thanh toán (2): số tiền thanh toán = TongTien (toàn bộ)
                // - Nếu chỉ đặt cọc (0): số tiền thanh toán chính là số tiền cọc (đã chuyển)
                // - Nếu chưa thanh toán (1): 0
                decimal tienThanhToan;
                if (trangThaiThanhToan == 2)
                {
                    // Đã thanh toán đầy đủ online
                    tienThanhToan = tongTien;
                }
                else if (trangThaiThanhToan == 0)
                {
                    tienThanhToan = tienCoc;
                }
                else
                {
                    tienThanhToan = 0m;
                }

                // Override trạng thái thanh toán dựa trên số tiền thực tế đã thanh toán
                if (tienThanhToan >= tongTien)
                {
                    trangThaiThanhToan = 2; // Đã thanh toán đầy đủ
                }
                else if (tienThanhToan >= tienCoc && tienThanhToan > 0)
                {
                    trangThaiThanhToan = 0; // Đã đặt cọc
                }
                else
                {
                    trangThaiThanhToan = 1; // Chưa thanh toán
                }

                // ========== LƯU GIÁ ĐÃ CHỐT VÀO GHICHU ==========
                // Format: [PRICE_LOCKED]{"goc":X,"giamKM":Y,"giamDiem":Z,"cuoi":W,"diemDaDung":N}[/PRICE_LOCKED]
                var priceLocked = new
                {
                    goc = (int)totalBeforeVat,           // Tổng gốc trước VAT (phòng + dịch vụ)
                    giamKM = 0,                          // Giảm từ khuyến mãi (đã tính vào roomTotal)
                    giamDiem = (int)pointsDiscount,      // Giảm từ điểm
                    cuoi = (int)tongTien,                // Tổng cuối cùng sau VAT và giảm điểm
                    diemDaDung = pointsToUse             // Số điểm đã dùng
                };
                var priceLockedJson = System.Text.Json.JsonSerializer.Serialize(priceLocked);
                var ghiChuBase = BuildInvoiceNote(request);
                var ghiChuFull = $"{ghiChuBase} [PRICE_LOCKED]{priceLockedJson}[/PRICE_LOCKED]";
                if (pointsToUse > 0)
                {
                    ghiChuFull += $" [USE_POINT] Dùng {pointsToUse} điểm giảm {pointsDiscount:N0}đ";
                }

                var idHoaDon = $"HD{DateTime.UtcNow:yyyyMMddHHmmssfff}";
                var hoaDon = new HoaDon
                {
                    IdhoaDon = idHoaDon,
                    IddatPhong = datPhong.IddatPhong,
                    NgayLap = DateTime.UtcNow,
                    TienPhong = (int)Math.Round(tongTien), // Final room price after all discounts
                    Slngay = soNgay,
                    TongTien = tongTien,
                    TienCoc = tienCoc,
                    TrangThaiThanhToan = trangThaiThanhToan,
                    TienThanhToan = tienThanhToan,
                    DiemSuDung = pointsToUse > 0 ? pointsToUse : null,
                    GhiChu = ghiChuFull
                };

                _context.HoaDons.Add(hoaDon);

                // Nếu client gửi danh sách dịch vụ kèm theo, lưu chi tiết dịch vụ (Cthddv)
                if (request.Services != null && request.Services.Any())
                {
                    foreach (var svc in request.Services)
                    {
                        // Skip services with null/empty IddichVu
                        if (string.IsNullOrWhiteSpace(svc.IddichVu))
                        {
                            _logger.LogWarning("PaymentController: bỏ qua dịch vụ có IddichVu rỗng");
                            continue;
                        }

                        string? comboId = null;
                        string? serviceId = svc.IddichVu?.Trim();

                        // Check for combo
                        if (!string.IsNullOrEmpty(serviceId) && serviceId.StartsWith("combo:"))
                        {
                            if (serviceId.Length > 6)
                            {
                                comboId = serviceId.Substring(6).Trim();
                                // For combos, get the first service ID from the combo
                                var comboServices = await _context.KhuyenMaiComboDichVus
                                    .Where(kmc => kmc.IdkhuyenMaiCombo == comboId)
                                    .OrderBy(kmc => kmc.Id)
                                    .FirstOrDefaultAsync();
                                
                                if (comboServices != null)
                                {
                                    serviceId = comboServices.IddichVu;
                                    _logger.LogInformation("PaymentController: combo {ComboId} mapped to service {ServiceId}", comboId, serviceId);
                                }
                                else
                                {
                                    _logger.LogWarning("PaymentController: combo {ComboId} không có dịch vụ nào, bỏ qua", comboId);
                                    continue;
                                }
                            }
                            else
                            {
                                _logger.LogWarning("PaymentController: combo ID không hợp lệ: {ComboId}", serviceId);
                                continue;
                            }
                        }
                        else if (!string.IsNullOrEmpty(serviceId))
                        {
                            // Kiểm tra dịch vụ tồn tại nếu không phải combo
                            var dv = await _context.DichVus.FindAsync(serviceId);
                            if (dv == null)
                            {
                                _logger.LogWarning("PaymentController: dịch vụ {Id} không tồn tại, bỏ qua", serviceId);
                                continue;
                            }
                        }

                        // At this point, serviceId MUST be non-null for IddichVu (required field)
                        if (string.IsNullOrEmpty(serviceId))
                        {
                            _logger.LogWarning("PaymentController: không thể xác định serviceId cho dịch vụ, bỏ qua");
                            continue;
                        }

                        var tienDichVu = svc.TienDichVu != 0m ? svc.TienDichVu : svc.DonGia * Math.Max(1, svc.SoLuong);

                        // Nếu client không gửi thời gian thực hiện, mặc định dùng khoảng đặt phòng (check-in -> check-out)
                        DateTime? svcTime = svc.ThoiGianThucHien;
                        DateTime thoiGianThucHien = svcTime ?? DateTime.UtcNow;

                        DateTime thoiGianBatDau;
                        DateTime thoiGianKetThuc;
                        try
                        {
                            // DatPhong.NgayNhanPhong / NgayTraPhong là DateOnly
                            var start = datPhong.NgayNhanPhong.ToDateTime(TimeOnly.MinValue);
                            var end = datPhong.NgayTraPhong.ToDateTime(new TimeOnly(23, 59, 59));
                            thoiGianBatDau = svcTime ?? start;
                            thoiGianKetThuc = svcTime != null ? svcTime.Value.AddMinutes(30) : end;
                        }
                        catch
                        {
                            // Fallback nếu DateOnly->DateTime không khả dụng
                            thoiGianBatDau = svcTime ?? DateTime.UtcNow;
                            thoiGianKetThuc = svcTime != null ? svcTime.Value.AddMinutes(30) : DateTime.UtcNow.AddHours(1);
                        }

                        var cthd = new Cthddv
                        {
                            IdhoaDon = idHoaDon,
                            IddichVu = serviceId,  // Always set with valid service ID
                            IdChiTiet = svc.IdChiTiet,
                            IdkhuyenMaiCombo = comboId,
                            TienDichVu = tienDichVu,
                            ThoiGianThucHien = thoiGianThucHien,
                            ThoiGianBatDau = thoiGianBatDau,
                            ThoiGianKetThuc = thoiGianKetThuc,
                            TrangThai = "new"
                        };
                        _context.Cthddvs.Add(cthd);
                    }
                }

                datPhong.TrangThaiThanhToan = trangThaiThanhToan;

                // Nếu TrangThai chưa được set (vẫn là 0 = chờ xác nhận), thì chỉ set lên 1 (payment created)
                // Nếu TrangThai đã là 2 (admin xác nhận), thì giữ nguyên
                if (datPhong.TrangThai == 0)
                {
                    datPhong.TrangThai = 1; // 1 = Hóa đơn được tạo (chưa admin xác nhận)
                }
                datPhong.ThoiHan = null; // Xóa hạn chờ

                // Sync room status ONLY if payment is confirmed AND admin already confirmed (TrangThai=2)
                // TrangThaiThanhToan: 0=đặt cọc, 1=chưa thanh toán, 2=đã thanh toán
                if (datPhong.TrangThai == 2 && (trangThaiThanhToan == 0 || trangThaiThanhToan == 2) && datPhong.ChiTietDatPhongs != null)
                {
                    foreach (var chiTiet in datPhong.ChiTietDatPhongs)
                    {
                        if (chiTiet.Phong != null)
                        {
                            chiTiet.Phong.TrangThai = "Đã đặt";
                        }
                    }
                }

                // ============ LOYALTY POINTS: Deduct used points and add earned points on successful payment ============
                if (trangThaiThanhToan == 2 && datPhong.IdkhachHangNavigation != null)
                {
                    // Deduct used points
                    if (pointsToUse > 0)
                    {
                        datPhong.IdkhachHangNavigation.TichDiem = Math.Max(0, (datPhong.IdkhachHangNavigation.TichDiem ?? 0) - pointsToUse);
                        _logger.LogInformation("PaymentController: deducted {Points} points from customer {Id}, new balance={Balance}", 
                            pointsToUse, datPhong.IdkhachHangNavigation.IdkhachHang, datPhong.IdkhachHangNavigation.TichDiem);
                    }

                    // Add earned points based on final amount paid (tongTien after discount)
                    int pointsToAdd = (int)Math.Floor((double)(tongTien / POINT_VALUE_VND));
                    if (pointsToAdd > 0)
                    {
                        datPhong.IdkhachHangNavigation.TichDiem = (datPhong.IdkhachHangNavigation.TichDiem ?? 0) + pointsToAdd;
                        _logger.LogInformation("PaymentController: awarded {Points} points to customer {Id}, new balance={Balance}", 
                            pointsToAdd, datPhong.IdkhachHangNavigation.IdkhachHang, datPhong.IdkhachHangNavigation.TichDiem);
                    }

                    // Mark points as used in invoice notes
                    if (pointsToUse > 0 && !string.IsNullOrWhiteSpace(hoaDon.GhiChu) && hoaDon.GhiChu.Contains("[POINT_PENDING]"))
                    {
                        hoaDon.GhiChu = hoaDon.GhiChu.Replace("[POINT_PENDING]", "[POINT_USED]");
                    }
                }
                // ==========================================================================================================

                await _context.SaveChangesAsync();
                await tx.CommitAsync();

                // Gửi email hóa đơn cho tất cả các trường hợp (đã thanh toán, đã cọc, chưa thanh toán)
                var customerEmail = datPhong.IdkhachHangNavigation?.Email;
                var customerName = datPhong.IdkhachHangNavigation?.HoTen ?? "Quý khách";
                if (!string.IsNullOrWhiteSpace(customerEmail))
                {
                    // fire-and-forget email (don't fail the request if email fails)
                    _ = SendInvoiceEmail(customerEmail, customerName, hoaDon);
                }

                // If payment method is online (2) provide a payment URL so frontend can show QR
                string? paymentUrl = null;
                try
                {
                    if (request.PhuongThucThanhToan == 2)
                    {
                        // amount for QR: prefer hoaDon.TienThanhToan (amount to collect), fallback to hoaDon.TongTien
                        var amt = (decimal?)(hoaDon.TienThanhToan ?? hoaDon.TongTien) ?? 0m;
                        var amtInt = (long)Math.Round(amt);
                        var addInfo = System.Net.WebUtility.UrlEncode($"Thanh toan {datPhong.IddatPhong}");
                        paymentUrl = $"https://img.vietqr.io/image/bidv-8639699999-print.png?amount={amtInt}&addInfo={addInfo}";
                    }
                }
                catch
                {
                    paymentUrl = null;
                }

                return Ok(new
                {
                    idHoaDon = hoaDon.IdhoaDon,
                    idDatPhong = datPhong.IddatPhong,
                    tongTien = hoaDon.TongTien,
                    tienCoc = hoaDon.TienCoc,
                    tienThanhToan = hoaDon.TienThanhToan,
                    paymentUrl
                });
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                _logger.LogError(ex, "Lỗi khi tạo hóa đơn");
                // Include inner exception message (if any) to aid debugging when SaveChanges fails
                var inner = ex.InnerException?.Message;
                return StatusCode(500, new { message = "Lỗi khi tạo hóa đơn", error = ex.Message, innerError = inner });
            }
        }

        // ===========================
        // UPDATE PAYMENT STATUS
        // - Đồng bộ trạng thái giữa DatPhong & HoaDon
        // - Nếu chuyển sang ĐÃ THANH TOÁN, set HoaDon.TienThanhToan nếu đang 0
        // - Gửi email hóa đơn nếu chuyển sang đã thanh toán — VỚI BODY
        // ===========================
        [HttpPost("update-status")]
        public async Task<IActionResult> UpdatePaymentStatus([FromBody] PaymentStatusUpdateRequest request)
        {
            try
            {
                var dp = await _context.DatPhongs
                    .Include(d => d.HoaDons)
                    .Include(d => d.IdkhachHangNavigation)
                    .FirstOrDefaultAsync(d => d.IddatPhong == request.IDDatPhong);

                if (dp == null)
                    return NotFound(new { message = "Không tìm thấy đơn đặt phòng" });

                // Áp dụng domain: chỉ 1 (chưa TT) hoặc 2 (đã TT)
                dp.TrangThaiThanhToan = request.TrangThaiThanhToan == 2 ? 2 : 1;
await _context.SaveChangesAsync();

                // Hóa đơn mới nhất
                var hd = dp.HoaDons.OrderByDescending(h => h.NgayLap).FirstOrDefault();

                if (hd != null)
                {
                    hd.TrangThaiThanhToan = dp.TrangThaiThanhToan;

                    // Nếu chuyển sang đã thanh toán mà tiền đang 0 → set = Tổng - Cọc
                    if (dp.TrangThaiThanhToan == 2 && (hd.TienThanhToan ?? 0m) <= 0m)
                    {
                        var tong = hd.TongTien;
                        var coc = dp.TienCoc ?? 0m;
                        hd.TienThanhToan = Math.Max(0m, tong - coc);
                        await _context.SaveChangesAsync();

                        // Gửi email hóa đơn khi vừa chuyển sang "đã thanh toán"
                        var email = dp.IdkhachHangNavigation?.Email;
                        var hoTen = dp.IdkhachHangNavigation?.HoTen ?? "Quý khách";
                        if (!string.IsNullOrWhiteSpace(email))
                        {
                            await SendInvoiceEmail(email, hoTen, hd);
                        }
                    }
                }

                // Khi cập nhật trạng thái thanh toán sang đã thanh toán, đồng thời mark booking là xác nhận và clear ThoiHan
                if (dp.TrangThaiThanhToan == 2)
                {
                    dp.TrangThai = 1; // xác nhận
                    dp.ThoiHan = null;
                    await _context.SaveChangesAsync();
                }

                return Ok(new PaymentStatusUpdateResponse
                {
                    Success = true,
                    Message = "Cập nhật trạng thái thanh toán thành công",
                    IDDatPhong = dp.IddatPhong,
                    IDHoaDon = hd?.IdhoaDon,
                    TrangThaiThanhToan = dp.TrangThaiThanhToan,
                    TongTien = dp.TongTien,
                    TienCoc = dp.TienCoc ?? 0m,
                    TienThanhToan = hd?.TienThanhToan ?? 0m
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi update status");
                return StatusCode(500, new { message = "Lỗi khi cập nhật trạng thái thanh toán", error = ex.Message });
            }
        }

        // ===========================
        // HELPERS
        // ===========================
        private string BuildInvoiceNote(HoaDonPaymentRequest req)
        {
            string method = req.PhuongThucThanhToan switch
            {
                1 => "Tiền mặt khi đến",
                2 => "Thanh toán online",
                3 => "Thanh toán tại quầy",
                _ => "Không xác định"
            };
var gw = string.IsNullOrWhiteSpace(req.PaymentGateway) ? "" : $" | Gateway: {req.PaymentGateway}";
            var custom = string.IsNullOrWhiteSpace(req.GhiChu) ? "" : $" | {req.GhiChu}";
            return $"PTTT: {method}{gw}{custom}".Trim(' ', '|');
        }

        private DateTime? TryParseIso(string? s)
        {
            if (string.IsNullOrWhiteSpace(s)) return null;

            // Try DateTimeOffset first (handles ISO/Z and offsets), then fall back to invariant DateTime parse
            if (DateTimeOffset.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var dto))
            {
                return dto.DateTime;
            }

            if (DateTime.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal | DateTimeStyles.AllowWhiteSpaces, out var dt))
            {
                return dt;
            }

            // last attempt: try common ISO formats
            var formats = new[] { "yyyy-MM-ddTHH:mm:ss", "yyyy-MM-ddTHH:mm:ssZ", "yyyy-MM-dd HH:mm:ss", "yyyy-MM-dd" };
            if (DateTime.TryParseExact(s, formats, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out dt))
            {
                return dt;
            }

            return null;
        }

        // Gửi email hóa đơn VỚI BODY
        private async Task SendInvoiceEmail(string email, string hoTen, HoaDon hoaDon)
        {
            try
            {
                // Use the exact subject/header requested by the user
                var emailSubject = $"xacnhandatphong HÓA ĐƠN - XÁC NHẬN GIAO DỊCH - Mã hóa đơn #{hoaDon.IdhoaDon}";

                string paymentStatusText = hoaDon.TrangThaiThanhToan switch
                {
                    2 => "Đã thanh toán đầy đủ",
                    0 => "Đã đặt cọc",
                    1 => "Chưa thanh toán",
                    _ => "Không xác định"
                };

                // Render HTML template for invoice; fallback to plain text if template missing
                var placeholders = new Dictionary<string, string>
                {
                    ["CustomerName"] = hoTen,
                    ["InvoiceId"] = hoaDon.IdhoaDon,
                    ["BookingId"] = hoaDon.IddatPhong ?? string.Empty,
                    ["InvoiceDate"] = hoaDon.NgayLap.HasValue ? hoaDon.NgayLap.Value.ToString("dd/MM/yyyy HH:mm:ss") : string.Empty,
                    ["TotalAmount"] = (hoaDon.TongTien).ToString("N0"),
                    ["PaidAmount"] = (hoaDon.TienThanhToan ?? 0m).ToString("N0"),
                    ["ReviewUrl"] = $"{Request.Scheme}://{Request.Host}/review/{hoaDon.IddatPhong}"
                };

                var html = _templateRenderer.Render("invoice.html", placeholders);
                if (!string.IsNullOrWhiteSpace(html))
                {
                    await _emailService.SendEmailAsync(email, emailSubject, html, true);
                }
                else
                {
                    // fallback to plain text
                    var text = _templateRenderer.Render("invoice.txt", placeholders);
                    await _emailService.SendEmailAsync(email, emailSubject, text, false);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Lỗi khi gửi email xác nhận đặt phòng tới {Email}", email);
            }
        }

        // Ưu tiên gọi overload 5 tham số -> 4 tham số -> 3 tham số
        private async Task SafeSendEmailAsync(string to, string name, string subject, string body)
        {
            try
            {
var type = _emailService.GetType();

                // 1) (to,name,subject,body,bool)
                var m5 = type.GetMethod("SendEmailAsync", new[] { typeof(string), typeof(string), typeof(string), typeof(string), typeof(bool) });
                if (m5 != null)
                {
                    var task = (Task)m5.Invoke(_emailService, new object[] { to, name, subject, body, true })!;
                    await task.ConfigureAwait(false);
                    return;
                }

                // 2) (to,name,subject,body)
                var m4 = type.GetMethod("SendEmailAsync", new[] { typeof(string), typeof(string), typeof(string), typeof(string) });
                if (m4 != null)
                {
                    var task = (Task)m4.Invoke(_emailService, new object[] { to, name, subject, body })!;
                    await task.ConfigureAwait(false);
                    return;
                }

                // 3) (to,name,subject) fallback
                await _emailService.SendEmailAsync(to, name, subject);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ SafeSendEmailAsync reflection failed, fallback 3-arg");
                try
                {
                    await _emailService.SendEmailAsync(to, name, subject);
                }
                catch (Exception ex2)
                {
                    _logger.LogError(ex2, "❌ SendEmailAsync 3-arg also failed");
                }
            }
        }
         // GET: api/Payment/invoice/{id}/pdf
        // Generates a simple PDF invoice and returns it as attachment.
        // PaymentController.cs hoặc CheckoutController.cs
[HttpGet("invoice/{id}/pdf")]
public async Task<IActionResult> GetInvoicePdf(string id)
{
    var hoaDon = await _context.HoaDons
        .Include(h => h.Cthddvs).ThenInclude(c => c.IddichVuNavigation)
        .Include(h => h.IddatPhongNavigation)
        .FirstOrDefaultAsync(h => h.IdhoaDon == id);

    if (hoaDon == null)
        return NotFound(new { message = "Không tìm thấy hóa đơn" });

    try
    {
        // Generate a simple PDF using QuestPDF
        byte[] pdfBytes;
        var hd = hoaDon; // local alias
        var booking = await _context.DatPhongs
            .Include(d => d.ChiTietDatPhongs).ThenInclude(ct => ct.Phong)
            .Include(d => d.IdkhachHangNavigation)
            .FirstOrDefaultAsync(d => d.IddatPhong == hd.IddatPhong);

                var doc = Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(24);
                    page.DefaultTextStyle(x => x.FontSize(11));

                    // Header: hotel info + invoice metadata
                    page.Header().Row(headerRow =>
                    {
                        headerRow.RelativeItem().Column(col =>
                        {
                            col.Item().Text("Khách sạn Robins Villa").FontSize(20).SemiBold();
                            col.Item().Text("Địa chỉ: 123 Đường Ví Dụ, Quận 1, TP. HCM").FontSize(10);
                            col.Item().Text("Hotline: 1900-xxxx").FontSize(10);
                        });

                        headerRow.ConstantItem(220).Column(col =>
                        {
                            col.Item().AlignRight().Text("HÓA ĐƠN THANH TOÁN").FontSize(14).SemiBold();
                            col.Item().AlignRight().Text($"Mã hóa đơn: {hd.IdhoaDon}");
                            col.Item().AlignRight().Text($"Mã đặt phòng: {hd.IddatPhong}");
                            col.Item().AlignRight().Text($"Ngày: {(hd.NgayLap.HasValue ? hd.NgayLap.Value.ToString("dd/MM/yyyy HH:mm") : string.Empty)}");
                        });
                    });

                    page.Content().PaddingVertical(8).Column(col =>
                    {
                        // Customer / booking info
                        col.Item().Row(row =>
                        {
                            row.RelativeItem().Column(c =>
                            {
                                c.Item().Text("Thông tin khách hàng").SemiBold();
                                c.Item().Text($"Họ tên: {booking?.IdkhachHangNavigation?.HoTen ?? "-"}");
                                c.Item().Text($"Email: {booking?.IdkhachHangNavigation?.Email ?? "-"}");
                                c.Item().Text($"SĐT: {booking?.IdkhachHangNavigation?.SoDienThoai ?? "-"}");
                            });

                            row.ConstantItem(220).Column(c =>
                            {
                                c.Item().AlignRight().Text("Chi tiết thanh toán").SemiBold();
                                c.Item().AlignRight().Text($"Tiền phòng: {(hd.TienPhong ?? 0):N0} đ");
                                c.Item().AlignRight().Text($"Tiền cọc: {(hd.TienCoc ?? 0m):N0} đ");
                                c.Item().AlignRight().Text($"Tổng phải trả: {hd.TongTien:N0} đ");
                            });
                        });

                        // Rooms table
                        col.Item().PaddingTop(6).Text("Chi tiết phòng").SemiBold();
                        col.Item().Table(table =>
                        {
                            table.ColumnsDefinition(columns =>
                            {
                                columns.RelativeColumn(3);
                                columns.RelativeColumn(1);
                                columns.RelativeColumn(1);
                                columns.RelativeColumn(1);
                            });

                            table.Header(header =>
                            {
                                header.Cell().Element(CellStyle).Text("Phòng");
                                header.Cell().Element(CellStyle).Text("Số đêm");
                                header.Cell().Element(CellStyle).AlignRight().Text("Đơn giá");
                                header.Cell().Element(CellStyle).AlignRight().Text("Thành tiền");
                            });

                            foreach (var r in booking?.ChiTietDatPhongs ?? new System.Collections.Generic.List<Models.ChiTietDatPhong>())
                            {
                                var roomName = r.Phong?.TenPhong ?? r.IDPhong ?? "-";
                                table.Cell().Element(CellStyle).Text(roomName);
                                table.Cell().Element(CellStyle).Text(r.SoDem.ToString());
                                table.Cell().Element(CellStyle).AlignRight().Text((r.GiaPhong).ToString("N0"));
                                table.Cell().Element(CellStyle).AlignRight().Text((r.ThanhTien).ToString("N0"));
                            }
                        });

                        // Services table
                        col.Item().PaddingTop(8).Text("Dịch vụ").SemiBold();
                        col.Item().Table(table =>
                        {
                            table.ColumnsDefinition(columns =>
                            {
                                columns.RelativeColumn(3);
                                columns.RelativeColumn(1);
                            });

                            table.Header(header =>
                            {
                                header.Cell().Element(CellStyle).Text("Dịch vụ sử dụng");
                                header.Cell().Element(CellStyle).AlignRight().Text("Tiền");
                            });

                            foreach (var s in hd.Cthddvs ?? new System.Collections.Generic.List<Models.Cthddv>())
                            {
                                var svcName = s.IddichVuNavigation?.TenDichVu ?? s.IddichVu ?? "-";
                                table.Cell().Element(CellStyle).Text(svcName);
                                table.Cell().Element(CellStyle).AlignRight().Text(((decimal?)s.TienDichVu ?? 0m).ToString("N0"));
                            }
                        });

                        // Totals and notes
                        col.Item().PaddingTop(10).AlignRight().Column(totalCol =>
                        {
                            var total = hd.TongTien;
                            totalCol.Item().Text($"Tổng: {total:N0} đ").SemiBold();
                            var paid = hd.TienThanhToan ?? 0m;
                            totalCol.Item().Text($"Đã thanh toán: {paid:N0} đ");
                            var due = Math.Max(0m, total - paid);
                            totalCol.Item().Text($"Còn nợ: {due:N0} đ");
                            if (!string.IsNullOrWhiteSpace(hd.GhiChu)) totalCol.Item().PaddingTop(6).Text($"Ghi chú: {hd.GhiChu}");
                        });
                    });

                    page.Footer().AlignCenter().Text(x => x.Span("Khách sạn Robins Villa - Hóa đơn tự động | Hotline: 1900-xxxx"));
                });
            });

        static IContainer CellStyle(IContainer container)
        {
            return container.Padding(4).BorderBottom(1).BorderColor(Colors.Grey.Lighten2);
        }

        pdfBytes = doc.GeneratePdf();

        return File(pdfBytes, "application/pdf", $"HoaDon_{id}.pdf");
    }
    catch (Exception ex)
    {
        // Log original error
        _logger.LogError(ex, "Lỗi sinh PDF cho hóa đơn {Id}", id);

        try
        {
            // Create a minimal fallback PDF programmatically so the client can still download a file.
            byte[] fallbackBytes;
            var fallbackDoc = Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(40);
                    page.DefaultTextStyle(x => x.FontSize(12));
                    page.Content().Column(col =>
                    {
                        col.Item().AlignCenter().Text("HÓA ĐƠN (TẠM THỜI)").FontSize(16).SemiBold();
                        col.Item().AlignCenter().Text($"Mã hóa đơn: {id}");
                        col.Item().AlignCenter().Text($"Mã đặt phòng: {hoaDon?.IddatPhong ?? string.Empty}");
                        col.Item().PaddingTop(8).Text("Hệ thống không thể sinh hóa đơn chi tiết do lỗi nội bộ. Vui lòng liên hệ quản trị viên.");
                    });
                });
            });

            fallbackBytes = fallbackDoc.GeneratePdf();
            return File(fallbackBytes, "application/pdf", $"HoaDon_{id}_tamthoi.pdf");
        }
        catch (Exception fbEx)
        {
            _logger.LogError(fbEx, "Lỗi khi sinh PDF thay thế cho hóa đơn {Id}", id);
            return StatusCode(500, new { message = "Không thể sinh PDF", error = ex.Message, fallbackError = fbEx.Message });
        }
    }
}

        // POST: api/Payment/refund
        // Records a confirmed refund and appends a booking history entry (LichSuDatPhong)
        [HttpPost("refund")]
        public async Task<IActionResult> Refund([FromBody] RefundRequest req)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(new { message = "Yêu cầu hoàn tiền không hợp lệ", errors = ModelState });
            }

            try
            {
                var hoaDon = await _context.HoaDons
                    .Include(h => h.IddatPhongNavigation)
                    .FirstOrDefaultAsync(h => h.IdhoaDon == req.IdHoaDon);

                if (hoaDon == null)
                    return NotFound(new { message = "Không tìm thấy hóa đơn" });

                // Create booking history entry recording the refund confirmation
                var ghiChu = $"Hoàn tiền {req.RefundAmount:N0} đ | Phương thức: {req.RefundMethod ?? "N/A"} | Lý do: {req.Reason} | Hóa đơn: {hoaDon.IdhoaDon}";

                var ls = new Models.LichSuDatPhong
                {
                    IddatPhong = hoaDon.IddatPhong ?? string.Empty,
                    NgayCapNhat = DateTime.UtcNow,
                    GhiChu = ghiChu
                };

                _context.LichSuDatPhongs.Add(ls);

                // Append refund note to the invoice for traceability
                hoaDon.GhiChu = string.IsNullOrWhiteSpace(hoaDon.GhiChu) ? ghiChu : hoaDon.GhiChu + " | " + ghiChu;

                // IMPORTANT: deduct the refunded amount from the invoice's recorded paid amount
                try
                {
                    decimal currentPaid = hoaDon.TienThanhToan ?? 0m;
                    // Treat the refund amount from the client as VAT-inclusive (already includes VAT).
                    // Do NOT auto-convert it to VAT-inclusive to avoid double-applying VAT.
                    decimal refund = Math.Round(req.RefundAmount, 0);
                    var newPaid = currentPaid - refund;
                    if (newPaid < 0m) newPaid = 0m;

                    // Ensure stored paid amount is VAT-inclusive and does not exceed invoice total
                    if (hoaDon.TongTien > 0m && newPaid > hoaDon.TongTien)
                    {
                        _logger.LogWarning("Refund resulted in newPaid ({NewPaid}) > TongTien ({TongTien}) for invoice {Invoice}. Capping to TongTien.", newPaid, hoaDon.TongTien, hoaDon.IdhoaDon);
                        newPaid = hoaDon.TongTien;
                    }

                    hoaDon.TienThanhToan = newPaid;

                    // Recalculate invoice payment status using VAT-inclusive TongTien
                    if (hoaDon.TongTien > 0m)
                    {
                        var remaining = hoaDon.TongTien - (hoaDon.TienThanhToan ?? 0m);
                        if (remaining <= 0m)
                        {
                            hoaDon.TrangThaiThanhToan = 2; // paid
                        }
                        else
                        {
                            hoaDon.TrangThaiThanhToan = 1; // pending
                        }
                    }

                    // Recalculate booking-level payment status (sum over invoices)
                    try
                    {
                        var booking = await _context.DatPhongs
                            .Include(d => d.HoaDons)
                            .FirstOrDefaultAsync(d => d.IddatPhong == hoaDon.IddatPhong);

                        if (booking != null)
                        {
                            decimal totalInvoices = booking.HoaDons?.Sum(h => h.TongTien) ?? 0m;
                            decimal totalPaid = booking.HoaDons?.Sum(h => h.TienThanhToan ?? 0m) ?? 0m;
                            var remainingAll = Math.Max(0m, totalInvoices - totalPaid);
                            booking.TrangThaiThanhToan = remainingAll > 0m ? 1 : 2;
                        }
                    }
                    catch (Exception ex2)
                    {
                        _logger.LogWarning(ex2, "Failed to recalc booking payment status after refund for invoice {InvoiceId}", hoaDon.IdhoaDon);
                    }
                }
                catch (Exception exCalc)
                {
                    _logger.LogWarning(exCalc, "Failed to apply refund arithmetic for invoice {InvoiceId}", hoaDon.IdhoaDon);
                }

                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = "Hoàn tiền đã được ghi nhận và cập nhật vào hóa đơn", idLichSu = ls.IdlichSu });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi xử lý hoàn tiền cho hóa đơn {InvoiceId}", req.IdHoaDon);
                return StatusCode(500, new { message = "Lỗi khi xử lý hoàn tiền", error = ex.Message });
            }
        }
    }
}
