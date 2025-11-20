using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Hotel_System.API.Models;
using Hotel_System.API.DTOs;
using Hotel_System.API.Services;

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
                        var now = DateTime.Now;
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

                        // Cập nhật lại tổng tiền đặt phòng = tổng ThànhTiền sau KM
                        datPhong.TongTien = datPhong.ChiTietDatPhongs?.Sum(ct => ct.ThanhTien) ?? 0m;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "PaymentController: failed to apply promotions to ChiTietDatPhongs — continuing with original prices");
                }

                // Fallback tiền phòng từ chi tiết nếu client không gửi — after applying promos we use ThanhTien
                var tienPhongTinh = datPhong.ChiTietDatPhongs?.Sum(ct => ct.ThanhTien) ?? 0m;
                int tienPhong = request.TienPhong ?? (int)Math.Round(tienPhongTinh);

                // Tổng cuối cùng do FE tính (đã gồm phòng sau KM + dịch vụ + VAT)
                decimal tongTien = request.TongTien;
                if (tongTien <= 0m)
                {
                    // fallback: DatPhong.TongTien -> sum ChiTiet (ThanhTien)
                    tongTien = datPhong.TongTien;
                    if (tongTien <= 0m)
                    {
                        try { tongTien = datPhong.ChiTietDatPhongs?.Sum(ct => ct.ThanhTien) ?? 0m; }
                        catch { tongTien = 0m; }
                    }
_logger.LogInformation("PaymentController: request.TongTien missing/zero, fallback tongTien={TongTien}", tongTien);
                }

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
                // - Nếu đã thanh toán (2): số tiền thanh toán là phần còn lại = TongTien - TienCoc
                // - Nếu chỉ đặt cọc (0): số tiền thanh toán chính là số tiền cọc (đã chuyển)
                // - Nếu chưa thanh toán (1): 0
                decimal tienThanhToan;
                if (trangThaiThanhToan == 2)
                {
                    tienThanhToan = Math.Max(0m, tongTien - tienCoc);
                }
                else if (trangThaiThanhToan == 0)
                {
                    tienThanhToan = tienCoc;
                }
                else
                {
                    tienThanhToan = 0m;
                }

                var idHoaDon = $"HD{DateTime.Now:yyyyMMddHHmmssfff}";
                var hoaDon = new HoaDon
                {
                    IdhoaDon = idHoaDon,
                    IddatPhong = datPhong.IddatPhong,
                    NgayLap = DateTime.Now,
                    TienPhong = tienPhong,
                    Slngay = soNgay,
TongTien = tongTien,
                    TienCoc = tienCoc,
                    TrangThaiThanhToan = trangThaiThanhToan,
                    TienThanhToan = tienThanhToan,
                    GhiChu = BuildInvoiceNote(request)
                };

                _context.HoaDons.Add(hoaDon);

                // Nếu client gửi danh sách dịch vụ kèm theo, lưu chi tiết dịch vụ (Cthddv)
                if (request.Services != null && request.Services.Any())
                {
                    foreach (var svc in request.Services)
                    {
                        // Kiểm tra dịch vụ tồn tại
                        var dv = await _context.DichVus.FindAsync(svc.IddichVu);
                        if (dv == null)
                        {
                            _logger.LogWarning("PaymentController: dịch vụ {Id} không tồn tại, bỏ qua", svc.IddichVu);
                            continue;
                        }

                        var tienDichVu = svc.TienDichVu != 0m ? svc.TienDichVu : svc.DonGia * Math.Max(1, svc.SoLuong);

                        // Nếu client không gửi thời gian thực hiện, mặc định dùng khoảng đặt phòng (check-in -> check-out)
                        DateTime? svcTime = svc.ThoiGianThucHien;
                        DateTime thoiGianThucHien = svcTime ?? DateTime.Now;

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
                            thoiGianBatDau = svcTime ?? DateTime.Now;
                            thoiGianKetThuc = svcTime != null ? svcTime.Value.AddMinutes(30) : DateTime.Now.AddHours(1);
                        }

                        var cthd = new Cthddv
                        {
                            IdhoaDon = idHoaDon,
                            IddichVu = svc.IddichVu,
                            TienDichVu = tienDichVu,
                            ThoiGianThucHien = thoiGianThucHien,
                            ThoiGianBatDau = thoiGianBatDau,
                            ThoiGianKetThuc = thoiGianKetThuc,
                            TrangThai = "new"
                        };
_context.Cthddvs.Add(cthd);
                    }
                }

                // Đồng bộ Đặt Phòng
                datPhong.TongTien = tongTien;
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
    }
}
