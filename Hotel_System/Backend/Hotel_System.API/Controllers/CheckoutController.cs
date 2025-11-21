using Hotel_System.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Hotel_System.API.Controllers
{
    // ==================== DTO CHO THÊM DỊCH VỤ VÀO HÓA ĐƠN CŨ ====================
    public class AddServiceToInvoiceRequest
    {
        // Changed from HoaDonId to IDDatPhong - business rule: always find THE ONE invoice for a booking by IDDatPhong
        public string IDDatPhong { get; set; } = string.Empty;
        public List<ServiceItem> DichVu { get; set; } = new();
    }

    public class ServiceItem
    {
        public string IddichVu { get; set; } = string.Empty;
        public decimal? TienDichVu { get; set; }
        
        public string? TenDichVu { get; set; }
        public decimal? DonGia { get; set; }
        // FE may precompute a line total (donGia * quantity), use this when provided
        public decimal? TongTien { get; set; }
        public string? GhiChu { get; set; }
    }

    public class PayQrRequest
    {
        public string IDDatPhong { get; set; } = string.Empty;
        public string? HoaDonId { get; set; }
        public decimal? Amount { get; set; }
        public List<ServiceItem>? Services { get; set; }
        public string? Note { get; set; }
    }

    public class ConfirmPaidRequest
    {
        public decimal? Amount { get; set; }
        public string? HoaDonId { get; set; }
        public string? Note { get; set; }
    }

    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "nhanvien")]
    public class CheckoutController : ControllerBase
    {
        private readonly HotelSystemContext _context;
        private readonly ILogger<CheckoutController> _logger;
        private readonly Hotel_System.API.Services.IEmailService _emailService;
        private readonly Hotel_System.API.Services.EmailTemplateRenderer _templateRenderer;

        public CheckoutController(HotelSystemContext context, ILogger<CheckoutController> logger, Hotel_System.API.Services.IEmailService emailService, Hotel_System.API.Services.EmailTemplateRenderer templateRenderer)
        {
            _context = context;
            _logger = logger;
            _emailService = emailService;
            _templateRenderer = templateRenderer;
        }

        // GET: api/Checkout/summary/{idDatPhong} – DÙNG CHÍNH TRONG FRONTEND
        [HttpGet("summary/{idDatPhong}")]
        public async Task<IActionResult> GetSummary(string idDatPhong)
        {
            if (string.IsNullOrWhiteSpace(idDatPhong))
                return BadRequest(new { message = "Mã đặt phòng không hợp lệ." });

            var booking = await _context.DatPhongs
                .Include(b => b.ChiTietDatPhongs)
                    .ThenInclude(ct => ct.Phong)
                .Include(b => b.IdkhachHangNavigation)
                .Include(b => b.HoaDons)
                    .ThenInclude(h => h.Cthddvs)
                        .ThenInclude(c => c.IddichVuNavigation)
                .FirstOrDefaultAsync(b => b.IddatPhong == idDatPhong);

            if (booking == null)
                return NotFound(new { message = "Không tìm thấy đặt phòng." });

            // 1. TIỀN PHÒNG (CHƯA VAT)
            decimal roomTotal = booking.ChiTietDatPhongs?.Sum(ct => ct.ThanhTien) ?? 0m;

            // 2. TIỀN DỊCH VỤ (CHƯA VAT) – lấy từ toàn bộ CTHDDV của các hóa đơn thuộc booking
            decimal serviceTotal = 0m;
            var services = new List<object>();

            if (booking.HoaDons != null)
            {
                foreach (var hd in booking.HoaDons)
                {
                    if (hd.Cthddvs != null)
                    {
                        // Dòng DV hợp lệ: null, "", "Hoạt động", "new"
                        var lines = hd.Cthddvs
                            .Where(c =>
                                string.IsNullOrEmpty(c.TrangThai) ||
                                c.TrangThai == "Hoạt động" ||
                                c.TrangThai == "new")
                            .ToList();

                        serviceTotal += lines.Sum(c => c.TienDichVu ?? 0m);

                        services.AddRange(lines.Select(c => new
                        {
                            tenDichVu = c.IddichVuNavigation?.TenDichVu,
                            donGia = c.TienDichVu,   // line total (chưa VAT)
                            thanhTien = c.TienDichVu // line total (chưa VAT)
                        }));
                    }
                }
            }

            // 3. TẠM TÍNH & TỔNG CỘNG GIỐNG FORM THANH TOÁN
            decimal subTotal = roomTotal + serviceTotal; // CHƯA VAT
            decimal vat = Math.Round(subTotal * 0.1m, 0, MidpointRounding.AwayFromZero);
            decimal tongTien = subTotal + vat;          // TỔNG CỘNG SAU VAT

            // Persist computed total to DB when it differs from stored value
            try
            {
                if (booking.TongTien != tongTien)
                {
                    booking.TongTien = tongTien;
                    await _context.SaveChangesAsync();
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Không thể cập nhật booking.TongTien trong GetSummary cho {Id}", booking.IddatPhong);
                // continue – summary can still be returned even if persistence fails
            }

            try
            {
                var invoicesChanged = false;
                if (booking.HoaDons != null)
                {
                    foreach (var hd in booking.HoaDons)
                    {
                        try
                        {
                            // Compute room amount for this invoice (TienPhong may be int or decimal)
                            decimal invoiceRoom = 0m;
                            try { invoiceRoom = Convert.ToDecimal(hd.TienPhong ?? 0); } catch { invoiceRoom = 0m; }

                            // Sum service lines for this invoice (CTHDDV)
                            decimal invoiceService = hd.Cthddvs != null
                                ? hd.Cthddvs.Where(c => string.IsNullOrEmpty(c.TrangThai) || c.TrangThai == "Hoạt động" || c.TrangThai == "new").Sum(c => c.TienDichVu ?? 0m)
                                : 0m;

                            decimal invoiceSub = invoiceRoom + invoiceService; // chưa VAT
                            decimal invoiceTotalComputed = Math.Round(invoiceSub * 1.1m, 0, MidpointRounding.AwayFromZero);

                            if (hd.TongTien != invoiceTotalComputed)
                            {
                                hd.TongTien = invoiceTotalComputed;
                                invoicesChanged = true;
                            }
                        }
                        catch (Exception inner)
                        {
                            _logger.LogDebug(inner, "Không thể tính lại tongTien cho hóa đơn {IdHoaDon}", hd?.IdhoaDon);
                        }
                    }
                }
                if (invoicesChanged)
                {
                    await _context.SaveChangesAsync();
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Không thể cập nhật các hóa đơn liên quan trong GetSummary cho {Id}", booking.IddatPhong);
            }

            // 4. CỌC & ĐÃ THANH TOÁN
            decimal deposit = booking.TienCoc ?? 0m;
            decimal paidAmount = booking.HoaDons?.Sum(h => h.TienThanhToan ?? 0m) ?? 0m;

            // 5. SỐ TIỀN CÒN PHẢI THU = TỔNG - ĐÃ THANH TOÁN
            decimal remaining = Math.Max(0m, tongTien - paidAmount);

            var invoices = booking.HoaDons != null
                ? booking.HoaDons.Select(h => new
                {
                    IDHoaDon = h.IdhoaDon,
                    NgayLap = h.NgayLap,
                    TongTien = h.TongTien,
                    TienThanhToan = h.TienThanhToan,
                    TrangThaiThanhToan = h.TrangThaiThanhToan
                }).Cast<object>().ToList()
                : new List<object>();

            return Ok(new
            {
                idDatPhong = booking.IddatPhong,
                customer = new
                {
                    name = booking.IdkhachHangNavigation?.HoTen,
                    email = booking.IdkhachHangNavigation?.Email
                },
                dates = new
                {
                    checkin = booking.NgayNhanPhong,
                    checkout = booking.NgayTraPhong,
                    soDem = booking.SoDem
                },
                money = new
                {
                    roomTotal,      // tiền phòng chưa VAT
                    serviceTotal,   // tiền dịch vụ chưa VAT
                    subTotal,       // tạm tính (chưa VAT)
                    vat,            // VAT 10%
                    deposit,
                    paidAmount,
                    tongTien,       // TỔNG CỘNG sau VAT – giống form thanh toán
                    remaining
                },
                items = booking.ChiTietDatPhongs != null
                    ? booking.ChiTietDatPhongs.Select(ct => new
                    {
                        tenPhong = ct.Phong?.TenPhong,
                        soPhong = ct.Phong?.SoPhong,
                        soDem = ct.SoDem,
                        giaPhong = ct.GiaPhong,
                        thanhTien = ct.ThanhTien,
                        idChiTiet = ct.IDChiTiet,
                        idPhong = ct.IDPhong,
                        ghiChu = ct.GhiChu
                    }).Cast<object>().ToList()
                    : new List<object>(),
                services,
                invoices
            });
        }
        // POST: api/Checkout/add-service-to-invoice – FRONTEND GỌI CHÍNH XÁC CÁI NÀY
        [HttpPost("add-service-to-invoice")]
        public async Task<IActionResult> AddServiceToInvoice([FromBody] AddServiceToInvoiceRequest req)
        {
            if (req == null || string.IsNullOrWhiteSpace(req.IDDatPhong) || req.DichVu == null || !req.DichVu.Any())
                return BadRequest(new { message = "Dữ liệu không hợp lệ." });

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // ========== BỨC 1: LẤY HÓADA ĐN HIỆN CÓ THEO IDDatPhong ==========
                var hoaDon = await _context.HoaDons
                    .Include(h => h.Cthddvs)
                    .Include(h => h.IddatPhongNavigation)
                        .ThenInclude(dp => dp.ChiTietDatPhongs)
                    .Where(h => h.IddatPhong == req.IDDatPhong)
                    .OrderByDescending(h => h.IdhoaDon)  
                    .FirstOrDefaultAsync();

                if (hoaDon == null)
                    return NotFound(new { message = "Không tìm thấy hóa đơn cho đặt phòng này." });

                // ========== BƯỚC 2: INSERT DỊCH VỤ VÀO CTHDDV ==========
                foreach (var item in req.DichVu)
                {
                    var lineTotal = item.TongTien ?? item.TienDichVu ?? item.DonGia ?? 0m;
                    _context.Cthddvs.Add(new Cthddv
                    {
                        IdhoaDon = hoaDon.IdhoaDon,
                        IddichVu = item.IddichVu,
                        TienDichVu = Math.Round(lineTotal),
                        ThoiGianThucHien = DateTime.Now,
                        TrangThai = "Hoạt động"
                    });
                }

                await _context.SaveChangesAsync();

                // ========== BƯỚC 3: CẬP NHẬT TỔNG TIỀN HÓA ĐƠN (KHÔNG TẠO MỚI) ==========
                // TongTien = TienPhong + TongDichVu
                await RecomputeInvoiceAndBookingTotal(hoaDon);

                // ========== BƯỚC 4: NẾU HÓA ĐƠN ĐANG LÀ 2 (ĐÃ THANH TOÁN) → CHUYỂN VỀ 1 ==========
                var booking = hoaDon.IddatPhongNavigation;
                if (booking != null)
                {
                    // If adding services introduces a remaining amount to collect → downgrade from "fully paid" to "pending"
                    if (hoaDon.TrangThaiThanhToan == 2)
                    {
                        decimal tongTienValue = hoaDon.TongTien;
                        decimal tienThanhToanValue = hoaDon.TienThanhToan ?? 0m;
                        decimal remainingForInvoice = tongTienValue - tienThanhToanValue;
                        if (remainingForInvoice > 0m)
                        {
                            hoaDon.TrangThaiThanhToan = 1; 
                        }
                    }
                    try
                    {
                        decimal remainingForBookingInvoice = (hoaDon.TongTien - (hoaDon.TienThanhToan ?? 0m));
                        if (remainingForBookingInvoice > 0m)
                        {
                            booking.TrangThaiThanhToan = 1;
                        }
                    }
                    catch
                    {
                        // ignore any unexpected issues calculating remaining — do not break the flow
                    }
                }

                // ========== BƯỚC 5 & 6: GIỮ NGUYÊN TienThanhToan VÀ TÍNH SoTienConLai ==========
                // TienThanhToan: không giảm, không reset, không sửa (already preserved by RecomputeInvoiceAndBookingTotal)
                // SoTienConLai = TongTien - TienThanhToan (calculated on-the-fly for response)
                // Compute service subtotal for the whole booking (old + newly added) from CTHDDV
                // so frontend sees "dịch vụ" = cũ + mới
                var invoiceIds = booking?.HoaDons?.Select(h => h.IdhoaDon).ToList() ?? new List<string>();
                var tongTienDichVu = await _context.Cthddvs
                    .Where(c => invoiceIds.Contains(c.IdhoaDon) && c.TrangThai == "Hoạt động")
                    .SumAsync(c => c.TienDichVu ?? 0m);

                decimal tongTienForResponse = hoaDon.TongTien;
                decimal tienThanhToanForResponse = hoaDon.TienThanhToan ?? 0m;
                decimal soTienConLai = Math.Max(0m, tongTienForResponse - tienThanhToanForResponse);

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                // Prepare a compact invoice object for FE (authoritative DB values)
                var hoaDonObj = new
                {
                    idHoaDon = hoaDon.IdhoaDon,
                    idDatPhong = hoaDon.IddatPhong,
                    ngayLap = hoaDon.NgayLap,
                    tienPhong = hoaDon.TienPhong,
                    tongTien = hoaDon.TongTien,
                    tienThanhToan = hoaDon.TienThanhToan,
                    trangThaiThanhToan = hoaDon.TrangThaiThanhToan
                };

                return Ok(new
                {
                    message = "Đã thêm dịch vụ và cập nhật hóa đơn thành công!",
                    hoaDon = hoaDonObj,
                    tongTienDichVu = tongTienDichVu,
                    tongTienHoaDon = hoaDon.TongTien,
                    tienThanhToan = hoaDon.TienThanhToan ?? 0m,
                    soTienConLai = soTienConLai
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Lỗi add-service-to-invoice");
                return StatusCode(500, new { message = "Lỗi server.", error = ex.Message });
            }
        }

        // POST: api/Checkout/confirm-paid/{idDatPhong}
        [HttpPost("confirm-paid/{idDatPhong}")]
        public async Task<IActionResult> ConfirmPaid(string idDatPhong, [FromBody] ConfirmPaidRequest? req)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var booking = await _context.DatPhongs
                    .Include(dp => dp.HoaDons)
                    .FirstOrDefaultAsync(dp => dp.IddatPhong == idDatPhong);

                if (booking == null) return NotFound();

                var targetInvoice = !string.IsNullOrWhiteSpace(req?.HoaDonId)
                    ? booking.HoaDons?.FirstOrDefault(h => h.IdhoaDon == req.HoaDonId)
                    : booking.HoaDons?.OrderByDescending(h => h.NgayLap).FirstOrDefault();

                if (targetInvoice == null) return NotFound();

                // 1. TÍNH LẠI TỔNG TIỀN CHUẨN (Phòng + DV Cũ + DV Mới + VAT)
                // Hàm này sẽ tính ra TongTien = 9,262,000
                await RecomputeInvoiceAndBookingTotal(targetInvoice);

                // 2. XỬ LÝ THANH TOÁN
                // Nếu người dùng không gửi số tiền cụ thể, HOẶC gửi số tiền + đã trả >= Tổng
                // Ta coi như là "Thanh toán hết"
                decimal currentPaid = targetInvoice.TienThanhToan ?? 0m;
                decimal amountReq = req?.Amount ?? 0m;
                decimal finalTotal = targetInvoice.TongTien;

                // Logic kiểm tra: Nếu (Tiền cũ + Tiền mới đóng)òm xèm bằng Tổng tiền -> CHỐT LUÔN
                if (amountReq <= 0 || (currentPaid + amountReq) >= (finalTotal - 5000m))
                {
                    // Khi chốt là "đã thanh toán hết", lưu số thực tế đã thu.
                    // Nếu khách đã đặt cọc, coi cọc là đã thu trước đó => số tiền cần thu thực tế = Tổng - TienCoc
                    decimal deposit = targetInvoice.TienCoc ?? booking.TienCoc ?? 0m;
                    var paidWhenClosing = Math.Max(0m, finalTotal - deposit);

                    targetInvoice.TrangThaiThanhToan = 2;
                    targetInvoice.TienThanhToan = paidWhenClosing;

                    booking.TrangThaiThanhToan = 2;
                }
                else
                {
                    // Trường hợp trả góp/trả ít hơn
                    targetInvoice.TrangThaiThanhToan = 1;
                    targetInvoice.TienThanhToan = currentPaid + amountReq;
                    if (booking.TrangThaiThanhToan == 2) booking.TrangThaiThanhToan = 1;
                }

                if (!string.IsNullOrWhiteSpace(req?.Note))
                    targetInvoice.GhiChu = req.Note;

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new
                {
                    idHoaDon = targetInvoice.IdhoaDon,
                    tienThanhToan = targetInvoice.TienThanhToan,
                    trangThaiThanhToan = targetInvoice.TrangThaiThanhToan,
                    tongTien = targetInvoice.TongTien
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new { message = ex.Message });
            }
        }
        // POST: api/Checkout/hoa-don
        [HttpPost("hoa-don")]
        public async Task<IActionResult> CreateInvoice([FromBody] Hotel_System.API.DTOs.HoaDonPaymentRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(new { message = "Dữ liệu không hợp lệ", errors = ModelState });
            }

            using var tx = await _context.Database.BeginTransactionAsync();
            try
            {
                var booking = await _context.DatPhongs
                    .Include(dp => dp.ChiTietDatPhongs)
                    .Include(dp => dp.IdkhachHangNavigation)
                    .Include(dp => dp.HoaDons)
                        .ThenInclude(h => h.Cthddvs)
                    .FirstOrDefaultAsync(dp => dp.IddatPhong == request.IDDatPhong);

                if (booking == null)
                    return NotFound(new { message = "Không tìm thấy đặt phòng" });

                // --- TÍNH TOÁN SƠ BỘ TỪ REQUEST (để tạo mới nếu cần) ---
                var tienPhongTinh = booking.ChiTietDatPhongs?.Sum(ct => ct.ThanhTien) ?? 0m;
                int tienPhong = request.TienPhong ?? (int)Math.Round(tienPhongTinh);

                decimal servicesTotal = 0m;
                if (request.Services != null && request.Services.Any())
                {
                    foreach (var svc in request.Services)
                    {
                        var tienDichVu = svc.TienDichVu != 0m
                            ? svc.TienDichVu
                            : svc.DonGia * Math.Max(1, svc.SoLuong);
                        servicesTotal += Math.Round(tienDichVu);
                    }
                }

                decimal roomAmount = request.TienPhong.HasValue && request.TienPhong.Value > 0
                    ? request.TienPhong.Value
                    : (decimal)tienPhong;

                decimal totalBeforeVat = roomAmount + servicesTotal;
                decimal tongTien = Math.Round(totalBeforeVat * 1.1m, 0, MidpointRounding.AwayFromZero);

                // Xử lý trạng thái thanh toán từ request
                // Nếu request gửi lên 2 (Đã thanh toán) thì ưu tiên lấy 2.
                // Nếu request gửi null, check phương thức thanh toán (2=QR -> 1=Pending, Tiền mặt -> 2=Done hoặc 0)
                int trangThaiThanhToan = request.TrangThaiThanhToan ?? (request.PhuongThucThanhToan == 2 ? 1 : 2);

                // --- TÌM HÓA ĐƠN CŨ CHO ĐẶT PHÒNG NÀY ---
                var existingInvoice = booking.HoaDons?
                    .OrderByDescending(h => h.NgayLap)
                    .FirstOrDefault();

                if (existingInvoice != null)
                {
                    // === TRƯỜNG HỢP 1: CẬP NHẬT HÓA ĐƠN CŨ ===

                    // 1. Cập nhật thông tin cơ bản
                    existingInvoice.TienPhong = tienPhong;
                    existingInvoice.Slngay = request.SoLuongNgay ?? booking.SoDem ?? existingInvoice.Slngay ?? 1;
                    existingInvoice.GhiChu = request.GhiChu;
                    if (request.TienCoc.HasValue) existingInvoice.TienCoc = request.TienCoc;

                    // 2. Thêm dịch vụ mới (nếu có) vào CTHDDV
                    if (request.Services != null && request.Services.Any())
                    {
                        foreach (var svc in request.Services)
                        {
                            var dv = await _context.DichVus.FindAsync(svc.IddichVu);
                            if (dv == null) continue;

                            var tienDichVu = svc.TienDichVu != 0m
                                ? svc.TienDichVu
                                : svc.DonGia * Math.Max(1, svc.SoLuong);

                            var cthd = new Cthddv
                            {
                                IdhoaDon = existingInvoice.IdhoaDon,
                                IddichVu = svc.IddichVu,
                                TienDichVu = Math.Round(tienDichVu),
                                ThoiGianThucHien = svc.ThoiGianThucHien ?? DateTime.Now,
                                TrangThai = "Hoạt động"
                            };
                            _context.Cthddvs.Add(cthd);
                        }
                    }

                    // Lưu tạm để services vào DB trước khi tính lại tổng
                    await _context.SaveChangesAsync();

                    // 3. QUAN TRỌNG: Tính lại tổng tiền hóa đơn từ DB (bao gồm tiền phòng + dịch vụ cũ + mới)
                    await RecomputeInvoiceAndBookingTotal(existingInvoice);

                    // 4. Cập nhật trạng thái thanh toán và tiền đã thanh toán
                    existingInvoice.TrangThaiThanhToan = trangThaiThanhToan;

                    if (trangThaiThanhToan == 2)
                    {
                        // Nếu đã thanh toán xong -> Gán TienThanhToan = TongTien (vừa tính lại ở bước 3)
                        existingInvoice.TienThanhToan = existingInvoice.TongTien;
                        booking.TrangThaiThanhToan = 2;
                    }
                    else
                    {
                        // Nếu chưa xong -> Cập nhật số tiền đã trả (PreviousPayment)
                        // Lưu ý: PreviousPayment ở đây thường là số tiền gửi lên từ client
                        decimal paymentAmount = request.PreviousPayment ?? existingInvoice.TienThanhToan ?? 0m;
                        existingInvoice.TienThanhToan = paymentAmount;
                    }

                    // 5. Cập nhật Booking
                    // Không đổi booking.TrangThai nếu đang sử dụng (3)
                    if (booking.TrangThai != 3)
                    {
                        booking.TrangThai = 1;
                    }
                    booking.ThoiHan = null;

                    await _context.SaveChangesAsync();
                    await tx.CommitAsync();

                    // Compute paid amount: prefer TienThanhToan; if zero but TienCoc exists,
                    // treat TienCoc as deposit that reduces remaining amount.
                    decimal paidExisting = existingInvoice.TienThanhToan ?? 0m;
                    if (paidExisting == 0m)
                    {
                        paidExisting += existingInvoice.TienCoc ?? booking.TienCoc ?? 0m;
                    }

                    decimal soTienConLaiExisting = Math.Max(0m, existingInvoice.TongTien - paidExisting);

                    // Build payment URL only for online payments (PhuongThucThanhToan == 2)
                    string? paymentUrlExisting = null;
                    if (request.PhuongThucThanhToan == 2)
                    {
                        try
                        {
                            var amtInt = (long)Math.Round(soTienConLaiExisting);
                            var addInfo = System.Net.WebUtility.UrlEncode($"Thanh toan {booking.IddatPhong}");
                            paymentUrlExisting = $"https://img.vietqr.io/image/bidv-8639699999-print.png?amount={amtInt}&addInfo={addInfo}";
                        }
                        catch { paymentUrlExisting = null; }
                    }

                    return Ok(new
                    {
                        idHoaDon = existingInvoice.IdhoaDon,
                        idDatPhong = booking.IddatPhong,
                        tongTien = existingInvoice.TongTien,
                        tienCoc = existingInvoice.TienCoc,
                        tienThanhToan = existingInvoice.TienThanhToan,
                        trangThaiThanhToan = existingInvoice.TrangThaiThanhToan,
                        paymentUrl = paymentUrlExisting,
                        soTienConLai = soTienConLaiExisting
                    });
                }

                // === TRƯỜNG HỢP 2: TẠO HÓA ĐƠN MỚI (NẾU CHƯA CÓ) ===
                var newIdHoaDon = $"HD{DateTime.Now:yyyyMMddHHmmssfff}";

                // Tính toán tiền thanh toán cho hóa đơn mới
                // Nếu Status=2 thì TienThanhToan = TongTien. Nếu không thì = TienCoc + Previous
                decimal initialPaid = (trangThaiThanhToan == 2)
                    ? tongTien
                    : ((request.TienCoc ?? booking.TienCoc ?? 0m) + (request.PreviousPayment ?? 0m));

                var hoaDon = new HoaDon
                {
                    IdhoaDon = newIdHoaDon,
                    IddatPhong = booking.IddatPhong,
                    NgayLap = DateTime.Now,
                    TienPhong = tienPhong,
                    Slngay = request.SoLuongNgay ?? booking.SoDem ?? 1,
                    TongTien = tongTien,
                    TienCoc = request.TienCoc ?? booking.TienCoc,
                    TrangThaiThanhToan = trangThaiThanhToan,
                    TienThanhToan = initialPaid,
                    GhiChu = request.GhiChu
                };

                _context.HoaDons.Add(hoaDon);

                if (request.Services != null && request.Services.Any())
                {
                    foreach (var svc in request.Services)
                    {
                        var dv = await _context.DichVus.FindAsync(svc.IddichVu);
                        if (dv == null) continue;
                        var tienDichVu = svc.TienDichVu != 0m ? svc.TienDichVu : svc.DonGia * Math.Max(1, svc.SoLuong);
                        var cthd = new Cthddv
                        {
                            IdhoaDon = newIdHoaDon,
                            IddichVu = svc.IddichVu,
                            TienDichVu = Math.Round(tienDichVu),
                            ThoiGianThucHien = svc.ThoiGianThucHien ?? DateTime.Now,
                            TrangThai = "Hoạt động"
                        };
                        _context.Cthddvs.Add(cthd);
                    }
                }

                // Đồng bộ đặt phòng
                booking.TongTien = tongTien;
                if (trangThaiThanhToan == 2)
                {
                    booking.TrangThaiThanhToan = 2;
                }
                if (booking.TrangThai != 3)
                {
                    booking.TrangThai = 1;
                }
                booking.ThoiHan = null;

                await _context.SaveChangesAsync();
                await tx.CommitAsync();

                string? paymentUrl = null;
                if (request.PhuongThucThanhToan == 2)
                {
                    try
                    {
                        // Tạo link VietQR với số tiền còn thiếu (TongTien - TienThanhToan)
                        // Nếu đã thanh toán (Status 2) thì có thể không cần QR hoặc QR = 0, tùy logic
                        var amt = (decimal?)(hoaDon.TongTien - (hoaDon.TienThanhToan ?? 0m));
                        if (amt <= 0) amt = hoaDon.TongTien; // Fallback

                        var amtInt = (long)Math.Round(amt ?? 0);
                        var addInfo = System.Net.WebUtility.UrlEncode($"Thanh toan {booking.IddatPhong}");
                        paymentUrl = $"https://img.vietqr.io/image/bidv-8639699999-print.png?amount={amtInt}&addInfo={addInfo}";
                    }
                    catch { paymentUrl = null; }
                }

                return Ok(new
                {
                    idHoaDon = hoaDon.IdhoaDon,
                    idDatPhong = booking.IddatPhong,
                    tongTien = hoaDon.TongTien,
                    tienCoc = hoaDon.TienCoc,
                    tienThanhToan = hoaDon.TienThanhToan,
                    paymentUrl
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi tạo/cập nhật hóa đơn trong CheckoutController");
                await tx.RollbackAsync();
                return StatusCode(500, new { message = "Lỗi khi tạo/cập nhật hóa đơn", error = ex.Message });
            }
        }
        // POST: api/Checkout/pay-qr
        // Initiate an online QR payment for a booking (creates invoice if needed) and returns a paymentUrl
        [HttpPost("pay-qr")]
        public async Task<IActionResult> PayQr([FromBody] PayQrRequest req)
        {
            if (req == null || string.IsNullOrWhiteSpace(req.IDDatPhong))
                return BadRequest(new { message = "IDDatPhong là bắt buộc" });

            using var tx = await _context.Database.BeginTransactionAsync();
            try
            {
                var booking = await _context.DatPhongs
                    .Include(dp => dp.ChiTietDatPhongs)
                    .Include(dp => dp.HoaDons)
                    .Include(dp => dp.IdkhachHangNavigation)
                    .FirstOrDefaultAsync(dp => dp.IddatPhong == req.IDDatPhong);

                if (booking == null) return NotFound(new { message = "Không tìm thấy đặt phòng" });

                // Find existing invoice if provided or latest
                HoaDon? hoaDon = null;
                if (!string.IsNullOrWhiteSpace(req.HoaDonId))
                {
                    hoaDon = await _context.HoaDons.Include(h => h.Cthddvs).FirstOrDefaultAsync(h => h.IdhoaDon == req.HoaDonId);
                }
                hoaDon ??= booking.HoaDons?.OrderByDescending(h => h.NgayLap).FirstOrDefault();

                // If no invoice, create one in pending state (waiting for online payment)
                if (hoaDon == null)
                {
                    var tienPhongTinh = booking.ChiTietDatPhongs?.Sum(ct => ct.ThanhTien) ?? 0m;
                    int tienPhong = (int)Math.Round(tienPhongTinh);
                    decimal tongTien = booking.TongTien > 0m ? booking.TongTien : tienPhongTinh;
                    decimal tienCoc = booking.TienCoc ?? 0m;

                    var idHoaDon = $"HD{DateTime.Now:yyyyMMddHHmmssfff}";
                    hoaDon = new HoaDon
                    {
                        IdhoaDon = idHoaDon,
                        IddatPhong = booking.IddatPhong,
                        NgayLap = DateTime.Now,
                        TienPhong = tienPhong,
                        Slngay = booking.SoDem ?? 1,
                        TongTien = tongTien,
                        TienCoc = tienCoc,
                        // Pending online payment
                        TrangThaiThanhToan = 1,
                        TienThanhToan = 0m,
                        GhiChu = req.Note
                    };
                    _context.HoaDons.Add(hoaDon);

                    // Attach services if provided
                    if (req.Services != null && req.Services.Any())
                    {
                        foreach (var svc in req.Services)
                        {
                            var dv = await _context.DichVus.FindAsync(svc.IddichVu);
                            if (dv == null) continue;
                            var tienDichVu = svc.TienDichVu ?? 0m;
                            _context.Cthddvs.Add(new Cthddv
                            {
                                IdhoaDon = hoaDon.IdhoaDon,
                                IddichVu = svc.IddichVu,
                                TienDichVu = Math.Round(tienDichVu),
                                ThoiGianThucHien = DateTime.Now,
                                ThoiGianBatDau = DateTime.Now,
                                ThoiGianKetThuc = DateTime.Now.AddMinutes(30),
                                TrangThai = "Hoạt động"
                            });
                        }
                    }

                    booking.TongTien = hoaDon.TongTien;
                    // keep booking.TrangThai if it's 3
                    booking.TrangThaiThanhToan = hoaDon.TrangThaiThanhToan ?? booking.TrangThaiThanhToan;
                    if (booking.TrangThai != 3) booking.TrangThai = 1;
                    booking.ThoiHan = null;
                    await _context.SaveChangesAsync();
                }

                // Compute how much remains to pay for this invoice, taking deposit into account
                decimal paid = hoaDon.TienThanhToan ?? 0m;
                // If nothing recorded as paid, treat any deposit (hoaDon.TienCoc or booking.TienCoc) as already paid
                if (paid == 0m)
                {
                    paid += hoaDon.TienCoc ?? booking.TienCoc ?? 0m;
                }

                // Remaining amount = total - paid
                decimal soTienConLai = Math.Max(0m, (hoaDon.TongTien - paid));

                // Allow explicit override from request
                decimal amount = req.Amount.HasValue && req.Amount.Value > 0m ? req.Amount.Value : soTienConLai;

                string? paymentUrl = null;
                try
                {
                    var amtInt = (long)Math.Round(amount);
                    var addInfo = System.Net.WebUtility.UrlEncode($"Thanh toan {booking.IddatPhong}");
                    paymentUrl = $"https://img.vietqr.io/image/bidv-8639699999-print.png?amount={amtInt}&addInfo={addInfo}";
                }
                catch { paymentUrl = null; }

                await tx.CommitAsync();

                return Ok(new { idHoaDon = hoaDon.IdhoaDon, idDatPhong = booking.IddatPhong, amount = amount, soTienConLai = soTienConLai, paymentUrl });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi pay-qr");
                return StatusCode(500, new { message = "Lỗi khi tạo liên kết QR", error = ex.Message });
            }
        }

        // POST: api/Checkout/complete/{idDatPhong}
        [HttpPost("complete/{idDatPhong}")]
        public async Task<IActionResult> CompleteCheckout(string idDatPhong)
        {
            var booking = await _context.DatPhongs
                .Include(dp => dp.IdkhachHangNavigation)
                .Include(dp => dp.IdphongNavigation)
                .Include(dp => dp.HoaDons)
                    .ThenInclude(h => h.Cthddvs)
                .FirstOrDefaultAsync(dp => dp.IddatPhong == idDatPhong);

            if (booking == null) return NotFound();

            booking.TrangThai = 4;

            // Cập nhật trạng thái phòng thành "Trống" khi check-out hoàn thành
            if (booking.IdphongNavigation != null)
            {
                booking.IdphongNavigation.TrangThai = "Trống";
            }
            // Award loyalty points immediately when booking is marked as completed (TrangThai == 4)
            try
            {
                var kh = booking.IdkhachHangNavigation;
                if (kh != null)
                {
                    var vndPerPoint = 100000m;
                    var pointsToAdd = (int)Math.Floor((double)(booking.TongTien / vndPerPoint));
                    if (pointsToAdd > 0)
                    {
                        kh.TichDiem = (kh.TichDiem ?? 0) + pointsToAdd;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error awarding loyalty points for booking {Id}", idDatPhong);

            }
            await _context.SaveChangesAsync();

            // After marking checkout complete, send emails
            try
            {
                var latest = booking.HoaDons?.OrderByDescending(h => h.NgayLap).FirstOrDefault();
                var email = booking.IdkhachHangNavigation?.Email;
                var hoTen = booking.IdkhachHangNavigation?.HoTen ?? "Quý khách";

                // 1. Send invoice email if the latest invoice is paid
                if (latest != null && latest.TrangThaiThanhToan == 2 && !string.IsNullOrWhiteSpace(email))
                {
                    try
                    {
                        await SendInvoiceEmail(email, hoTen, latest);
                    }
                    catch (Exception invoiceEx)
                    {
                        _logger.LogError(invoiceEx, "Lỗi khi gửi email hóa đơn");
                    }
                }

                // 2. Send review reminder email
                if (!string.IsNullOrWhiteSpace(email))
                {
                    try
                    {
                        await SendReviewReminderEmail(idDatPhong, email, hoTen);
                    }
                    catch (Exception reviewEx)
                    {
                        _logger.LogError(reviewEx, "Lỗi khi gửi email đánh giá");
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi gửi email sau khi hoàn tất trả phòng");
            }

            return Ok(new { message = "Hoàn tất trả phòng thành công" });
        }

        // Gửi email hóa đơn (HTML) với thông tin, lời cảm ơn và link đánh giá
        private async Task SendInvoiceEmail(string email, string hoTen, HoaDon hoaDon)
        {
            try
            {
                // Build a single-line subject (SMTP/MailMessage can reject multiline subjects).
                var rawSubject = $"✅ Robins Villa |Kính gửi Quý khách {System.Net.WebUtility.HtmlEncode(hoTen)} ";
                // Remove any newlines and trim to a reasonable length
                var emailSubject = System.Text.RegularExpressions.Regex.Replace(rawSubject, "\r\n?|\n", " ").Trim();
                if (emailSubject.Length > 200) emailSubject = emailSubject.Substring(0, 200) + "...";
                var placeholders = new Dictionary<string, string>
                {
                    ["CustomerName"] = hoTen,
                    ["InvoiceId"] = hoaDon.IdhoaDon,
                    ["BookingId"] = hoaDon.IddatPhong ?? string.Empty,
                    ["InvoiceDate"] = hoaDon.NgayLap.HasValue ? hoaDon.NgayLap.Value.ToString("dd/MM/yyyy HH:mm:ss") : string.Empty,
                    ["TotalAmount"] = hoaDon.TongTien.ToString("N0"),
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
                    var text = _templateRenderer.Render("invoice.txt", placeholders);
                    await _emailService.SendEmailAsync(email, emailSubject, text, false);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Lỗi khi gửi email hóa đơn tới {Email}", email);
            }
        }

        private async Task SafeSendEmailAsync(string to, string name, string subject, string body)
        {
            try
            {
                var type = _emailService.GetType();

                var m5 = type.GetMethod("SendEmailAsync", new[] { typeof(string), typeof(string), typeof(string), typeof(string), typeof(bool) });
                if (m5 != null)
                {
                    var task = (Task)m5.Invoke(_emailService, new object[] { to, name, subject, body, true })!;
                    await task.ConfigureAwait(false);
                    return;
                }

                var m4 = type.GetMethod("SendEmailAsync", new[] { typeof(string), typeof(string), typeof(string), typeof(string) });
                if (m4 != null)
                {
                    var task = (Task)m4.Invoke(_emailService, new object[] { to, name, subject, body })!;
                    await task.ConfigureAwait(false);
                    return;
                }

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

               // HÀM TÍNH LẠI TỔNG TIỀN HÓA ĐƠN + ĐỒNG BỘ VỚI DatPhong.TongTien
        private async Task RecomputeInvoiceAndBookingTotal(HoaDon hoaDon)
        {
            if (hoaDon == null) return;

            // Load dữ liệu
            await _context.Entry(hoaDon).Collection(h => h.Cthddvs).LoadAsync();

            var booking = await _context.DatPhongs
                .Include(dp => dp.ChiTietDatPhongs)
                .Include(dp => dp.HoaDons)
                .FirstOrDefaultAsync(dp => dp.IddatPhong == hoaDon.IddatPhong);

            if (booking == null) return;

            // 1. TÍNH TỔNG TIỀN
            decimal roomVal = (decimal)(hoaDon.TienPhong ?? 0);
            decimal serviceVal = hoaDon.Cthddvs?
                .Where(c => string.IsNullOrEmpty(c.TrangThai) || c.TrangThai == "Hoạt động" || c.TrangThai == "new")
                .Sum(c => c.TienDichVu ?? 0m) ?? 0m;

            decimal tongTienChuan = Math.Round((roomVal + serviceVal) * 1.1m, 0, MidpointRounding.AwayFromZero);
            hoaDon.TongTien = tongTienChuan;

            // 2. XỬ LÝ CỌC (Chỉ gán khi chưa đủ cọc)
            decimal daTraHienTai = hoaDon.TienThanhToan ?? 0m;
            decimal tienCoc = booking.TienCoc ?? 0m;

            if (tienCoc > 0 && daTraHienTai < tienCoc)
            {
                daTraHienTai = tienCoc;
                hoaDon.TienThanhToan = daTraHienTai;
            }

            // 3. QUYẾT ĐỊNH TRẠNG THÁI
            decimal conThieu = tongTienChuan - daTraHienTai;

            if (conThieu > 1000m)
            {
                // Thiếu tiền -> Trạng thái 1
                hoaDon.TrangThaiThanhToan = 1;
            }
            else
            {
                // Đủ tiền -> Trạng thái 2
                if (tongTienChuan > 0)
                {
                    hoaDon.TrangThaiThanhToan = 2;
                    
                    // ===> ĐÃ BỎ DÒNG GÁN LẠI TIỀN THANH TOÁN <===
                    // Giữ nguyên daTraHienTai (khách trả bao nhiêu lưu bấy nhiêu)
                }
            }

            // 4. Đồng bộ Booking
            decimal bookingTotal = 0;
            if (booking.HoaDons != null)
            {
                foreach (var h in booking.HoaDons)
                {
                    if (h.IdhoaDon == hoaDon.IdhoaDon) bookingTotal += tongTienChuan;
                    else bookingTotal += h.TongTien;
                }
            }
            else bookingTotal = tongTienChuan;

            booking.TongTien = bookingTotal;

            if (hoaDon.TrangThaiThanhToan == 2)
            {
                bool allPaid = booking.HoaDons?.All(h => h.TrangThaiThanhToan == 2) ?? true;
                if (allPaid) booking.TrangThaiThanhToan = 2;
            }
            else booking.TrangThaiThanhToan = 1;

            await _context.SaveChangesAsync();
        }

        // Gửi email nhắc nhở đánh giá sau khi check-out
        private async Task SendReviewReminderEmail(string idDatPhong, string email, string hoTen)
        {
            try
            {
                var booking = await _context.DatPhongs
                    .Include(dp => dp.IdkhachHangNavigation)
                    .Include(dp => dp.IdphongNavigation)
                    .FirstOrDefaultAsync(dp => dp.IddatPhong == idDatPhong);

                if (booking == null)
                {
                    _logger.LogWarning($"Booking {idDatPhong} not found for review email");
                    return;
                }

                // Load template
                string templatePath = Path.Combine(Directory.GetCurrentDirectory(), "EmailTemplates", "thankyou-review.html");
                if (!System.IO.File.Exists(templatePath))
                {
                    _logger.LogWarning($"Email template not found at {templatePath}");
                    return;
                }

                string emailBody = System.IO.File.ReadAllText(templatePath);
                var frontendUrl = "http://localhost:5173"; // Default for dev; update as needed in prod

                // CRITICAL: Get room name from DatPhong table's Idphong column, then lookup in Phong table
                // DatPhong.Idphong (FK) -> Phong.Idphong (PK) -> get Phong.TenPhong
                string roomName = "Phòng";
                if (booking.IdphongNavigation != null && !string.IsNullOrWhiteSpace(booking.IdphongNavigation.TenPhong))
                {
                    roomName = booking.IdphongNavigation.TenPhong;
                }
                else if (!string.IsNullOrWhiteSpace(booking.Idphong))
                {
                    // Fallback: try to load room directly by ID if navigation didn't work
                    var phong = await _context.Phongs.FirstOrDefaultAsync(p => p.Idphong == booking.Idphong);
                    if (phong != null && !string.IsNullOrWhiteSpace(phong.TenPhong))
                    {
                        roomName = phong.TenPhong;
                    }
                }
                
                _logger.LogInformation($"Room name resolved for booking {idDatPhong}: {roomName}");

                // Replace placeholders
                var reviewLink = $"{frontendUrl}/review/{idDatPhong}";
                emailBody = emailBody
                    .Replace("{{CustomerName}}", hoTen)
                    .Replace("{{BookingId}}", idDatPhong)
                    .Replace("{{RoomName}}", roomName)
                    .Replace("{{CheckInDate}}", booking.NgayNhanPhong.ToString("dd/MM/yyyy"))
                    .Replace("{{CheckOutDate}}", booking.NgayTraPhong.ToString("dd/MM/yyyy"))
                    .Replace("{{TotalAmount}}", booking.TongTien.ToString("N0"))
                    .Replace("{{ReviewLink}}", reviewLink)
                    .Replace("{{HotelAddress}}", "Robins Villa")
                    .Replace("{{HotelPhone}}", "+84 xxx xxx xxx")
                    .Replace("{{HotelEmail}}", email)
                    .Replace("{{HotelName}}", "Robins Villa")
                    .Replace("{{CurrentYear}}", DateTime.Now.Year.ToString());

                // Send via email service
                var subject = $"✅ Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi - Vui lòng đánh giá";
                await _emailService.SendEmailAsync(email, subject, emailBody, true);

                _logger.LogInformation($"Review reminder email sent to {email} for booking {idDatPhong}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Failed to send review email to {email}");
                throw;
            }
        }
    }
}