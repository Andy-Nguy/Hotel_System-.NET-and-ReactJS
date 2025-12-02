using Hotel_System.API.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.EntityFrameworkCore.Storage; // dùng cho IDbContextTransaction
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

namespace Hotel_System.API.Controllers
{
    // ==================== DTO CHO THÊM DỊCH VỤ VÀO HÓA ĐƠN CŨ ====================
    public class AddServiceToInvoiceRequest
    {
        public string IDDatPhong { get; set; } = string.Empty;
        public List<ServiceItem> DichVu { get; set; } = new();
        public decimal? PaidAmount { get; set; }
        public bool? PaidOnline { get; set; }
    }

    public class ServiceItem
    {
        public string IddichVu { get; set; } = string.Empty;
        public decimal? TienDichVu { get; set; }

        public string? TenDichVu { get; set; }
        public decimal? DonGia { get; set; }
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
        public bool? IsOnline { get; set; }
        public bool? IsOverdue { get; set; } // Flag từ frontend để xác định booking quá hạn
    }

    [Route("api/[controller]")]
    [ApiController]
    public class CheckoutController : ControllerBase
    {
        private readonly HotelSystemContext _context;
        private readonly ILogger<CheckoutController> _logger;
        private readonly Hotel_System.API.Services.IEmailService _emailService;
        private readonly Hotel_System.API.Services.EmailTemplateRenderer _templateRenderer;

        public CheckoutController(
            HotelSystemContext context,
            ILogger<CheckoutController> logger,
            Hotel_System.API.Services.IEmailService emailService,
            Hotel_System.API.Services.EmailTemplateRenderer templateRenderer)
        {
            _context = context;
            _logger = logger;
            _emailService = emailService;
            _templateRenderer = templateRenderer;
        }

        // ===================== GET SUMMARY =========================
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
                .Include(b => b.HoaDons)
                    .ThenInclude(h => h.Cthddvs)
                        .ThenInclude(c => c.IdkhuyenMaiComboNavigation)
                .FirstOrDefaultAsync(b => b.IddatPhong == idDatPhong);

            if (booking == null)
                return NotFound(new { message = "Không tìm thấy đặt phòng." });

            // 1. TIỀN PHÒNG (CHƯA VAT)
            decimal roomTotal = booking.ChiTietDatPhongs?.Sum(ct => ct.ThanhTien) ?? 0m;

            // chuẩn 12h trưa – dùng để xác định quá hạn
            DateTime standardCheckout;
            try
            {
                standardCheckout = booking.NgayTraPhong.ToDateTime(new TimeOnly(12, 0));
            }
            catch
            {
                standardCheckout = booking.NgayTraPhong.ToDateTime(TimeOnly.MinValue);
            }

            // ✅ Coi là QUÁ HẠN nếu:
            //  - Booking đã được đánh dấu TrangThai = 5, HOẶC
            //  - Thời điểm hiện tại đã sau 12:00 ngày checkout
            bool isOverdueBooking = (booking.TrangThai == 5) || (DateTime.Now > standardCheckout);

            // 2. TIỀN DỊCH VỤ (CHƯA VAT) – từ CTHDDV
            decimal serviceTotal = 0m;
            var services = new List<object>();

            if (booking.HoaDons != null)
            {
                foreach (var hd in booking.HoaDons)
                {
                    if (hd.Cthddvs != null)
                    {
                        var lines = hd.Cthddvs
                            .Where(c =>
                                string.IsNullOrEmpty(c.TrangThai) ||
                                c.TrangThai == "Hoạt động" ||
                                c.TrangThai == "new")
                            .ToList();

                        serviceTotal += lines.Sum(c => c.TienDichVu ?? 0m);

                        services.AddRange(lines.Select(c => new
                        {
                            tenDichVu = c.IddichVuNavigation?.TenDichVu ?? c.IdkhuyenMaiComboNavigation?.TenCombo,
                            donGia = c.TienDichVu,
                            thanhTien = c.TienDichVu
                        }));
                    }
                }
            }

            // 3. TỔNG CƠ BẢN (KHÔNG PHÍ MUỘN)
            decimal subTotalBase = roomTotal + serviceTotal;
            decimal vatBase = Math.Round(subTotalBase * 0.1m, 0, MidpointRounding.AwayFromZero);
            decimal tongTienBase = subTotalBase + vatBase;

            decimal persistedBookingTotal = booking.TongTien;
            if (persistedBookingTotal <= 0m)
                persistedBookingTotal = tongTienBase;

            decimal lateFee = 0m;
            decimal tongTien;

            if (isOverdueBooking)
            {
                // Tính phí trả phòng muộn trực tiếp (KHÔNG lưu vào CTHDDV)
                var actualCheckout = DateTime.Now;
                var diff = actualCheckout - standardCheckout;

                if (diff > TimeSpan.Zero || booking.TrangThai == 5)
                {
                    // Tính giá 1 đêm
                    int nights = booking.SoDem ?? 1;
                    decimal oneNightPrice = nights > 0
                        ? Math.Round(roomTotal / nights, 0, MidpointRounding.AwayFromZero)
                        : Math.Round(roomTotal, 0, MidpointRounding.AwayFromZero);

                    // Tính % phụ phí theo quy định
                    decimal surchargePercent = 0m;
                    if (diff.TotalHours < 0)
                        surchargePercent = 1.00m; // Quá hạn từ ngày hôm trước
                    else if (diff <= TimeSpan.FromHours(3))
                        surchargePercent = 0.30m;
                    else if (diff <= TimeSpan.FromHours(6))
                        surchargePercent = 0.50m;
                    else
                        surchargePercent = 1.00m;

                    // Tính phí muộn (KHÔNG tính VAT vì là phí phạt)
                    lateFee = surchargePercent >= 1.0m
                        ? oneNightPrice
                        : Math.Round(oneNightPrice * surchargePercent, 0, MidpointRounding.AwayFromZero);

                    _logger.LogInformation("[GetSummary] Booking {Id} - Calculated late fee (no VAT): {LateFee}đ ({Percent}%)",
                        booking.IddatPhong, lateFee, surchargePercent * 100);
                }

                // Tính tổng tiền = (roomTotal + serviceTotal) * 1.1 + lateFee (phí phạt không VAT)
                decimal subTotal = roomTotal + serviceTotal;
                decimal vat = Math.Round(subTotal * 0.1m, 0, MidpointRounding.AwayFromZero);
                tongTien = subTotal + vat + lateFee;

                _logger.LogInformation("[GetSummary] Booking {Id} - TongTien = ({Room} + {Service}) * 1.1 + {LateFee} = {Total}",
                    booking.IddatPhong, roomTotal, serviceTotal, lateFee, tongTien);

                // Cập nhật booking + hóa đơn chính
                try
                {
                    if (booking.TongTien != tongTien)
                    {
                        booking.TongTien = tongTien;
                    }

                    var latestInvoiceForOverdue = booking.HoaDons?
                        .OrderByDescending(h => h.NgayLap)
                        .FirstOrDefault();

                    if (latestInvoiceForOverdue != null)
                    {
                        if (latestInvoiceForOverdue.TongTien != tongTien)
                        {
                            latestInvoiceForOverdue.TongTien = tongTien;
                        }
                        // Ghi chú phí trả muộn nếu có
                        if (lateFee > 0 && (string.IsNullOrEmpty(latestInvoiceForOverdue.GhiChu) || 
                            !latestInvoiceForOverdue.GhiChu.Contains("Phí trả phòng muộn")))
                        {
                            latestInvoiceForOverdue.GhiChu = (latestInvoiceForOverdue.GhiChu ?? string.Empty)
                                + $"\nPhí trả phòng muộn (không VAT): {lateFee:N0}đ";
                        }
                    }

                    await _context.SaveChangesAsync();
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Không thể cập nhật TongTien trong GetSummary cho booking quá hạn {Id}", booking.IddatPhong);
                }
            }
            else
            {
                // booking thường: giữ logic cũ, ghi đè TongTien nếu lệch
                tongTien = tongTienBase;
                try
                {
                    if (booking.TongTien != tongTienBase)
                    {
                        booking.TongTien = tongTienBase;
                        await _context.SaveChangesAsync();
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Không thể cập nhật booking.TongTien trong GetSummary cho {Id}", booking.IddatPhong);
                }
            }

            // 4. KHÔNG RECOMPUTE HÓA ĐƠN CHO BOOKING QUÁ HẠN (TRÁNH GHI ĐÈ PHÍ MUỘN)
            if (!isOverdueBooking)
            {
                try
                {
                    var invoicesChanged = false;
                    if (booking.HoaDons != null)
                    {
                        foreach (var hd in booking.HoaDons)
                        {
                            try
                            {
                                decimal invoiceRoom = 0m;
                                try { invoiceRoom = Convert.ToDecimal(hd.TienPhong ?? 0); } catch { invoiceRoom = 0m; }

                                decimal invoiceService = hd.Cthddvs != null
                                    ? hd.Cthddvs.Where(c => string.IsNullOrEmpty(c.TrangThai) || c.TrangThai == "Hoạt động" || c.TrangThai == "new").Sum(c => c.TienDichVu ?? 0m)
                                    : 0m;

                                decimal invoiceSub = invoiceRoom + invoiceService;
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
            }

            // 5. CỌC & ĐÃ THANH TOÁN
            decimal deposit = booking.TienCoc ?? 0m;
            decimal paidAmount = booking.HoaDons?.Sum(h => h.TienThanhToan ?? 0m) ?? 0m;

            // 6. CÒN PHẢI THU
            decimal remaining = Math.Max(0m, tongTien - paidAmount);

            // Sắp xếp hóa đơn mới nhất lên đầu
            var invoices = booking.HoaDons != null
                ? booking.HoaDons
                    .OrderByDescending(h => h.NgayLap)
                    .Select(h => new
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
                    roomTotal,
                    serviceTotal,
                    subTotal = subTotalBase,
                    vat = vatBase,
                    deposit,
                    paidAmount,
                    tongTien,
                    remaining,
                    lateFee
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

        // ===================== ADD SERVICE TO INVOICE =========================
        [HttpPost("add-service-to-invoice")]
        public async Task<IActionResult> AddServiceToInvoice([FromBody] AddServiceToInvoiceRequest req)
        {
            if (req == null || string.IsNullOrWhiteSpace(req.IDDatPhong) || req.DichVu == null || !req.DichVu.Any())
                return BadRequest(new { message = "Dữ liệu không hợp lệ." });

            // Nếu đã có transaction bên ngoài thì không mở transaction mới
            var hasExternalTransaction = _context.Database.CurrentTransaction != null;
            IDbContextTransaction? transaction = null;
            if (!hasExternalTransaction)
            {
                transaction = await _context.Database.BeginTransactionAsync();
            }

            try
            {
                var hoaDon = await _context.HoaDons
                    .Include(h => h.Cthddvs)
                    .Include(h => h.IddatPhongNavigation)
                        .ThenInclude(dp => dp.ChiTietDatPhongs)
                    .Where(h => h.IddatPhong == req.IDDatPhong)
                    .OrderByDescending(h => h.IdhoaDon)
                    .FirstOrDefaultAsync();

                if (hoaDon == null)
                    return NotFound(new { message = "Không tìm thấy hóa đơn cho đặt phòng này." });

                foreach (var item in req.DichVu)
                {
                    var lineTotal = item.TongTien ?? item.TienDichVu ?? item.DonGia ?? 0m;
                    _context.Cthddvs.Add(new Cthddv
                    {
                        IdhoaDon = hoaDon.IdhoaDon,
                        IddichVu = item.IddichVu,
                        TienDichVu = Math.Round(lineTotal),
                        IdkhuyenMai = null,
                        ThoiGianThucHien = DateTime.Now,
                        TrangThai = "Hoạt động"
                    });
                }

                await _context.SaveChangesAsync();

                await RecomputeInvoiceAndBookingTotal(hoaDon);

                var booking = hoaDon.IddatPhongNavigation;
                if (booking != null)
                {
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
                    catch { }
                }

                try
                {
                    if (req.PaidOnline == true)
                    {
                        hoaDon.TienThanhToan = hoaDon.TongTien;
                        hoaDon.TrangThaiThanhToan = 2;
                        if (booking != null) booking.TrangThaiThanhToan = 2;
                    }
                    else if (req.PaidAmount.HasValue && req.PaidAmount.Value > 0m)
                    {
                        var add = Math.Round(req.PaidAmount.Value, 0);
                        var current = hoaDon.TienThanhToan ?? 0m;
                        var newPaid = current + add;
                        if (newPaid >= (hoaDon.TongTien - 5000m))
                        {
                            hoaDon.TienThanhToan = hoaDon.TongTien;
                            hoaDon.TrangThaiThanhToan = 2;
                            if (booking != null) booking.TrangThaiThanhToan = 2;
                        }
                        else
                        {
                            hoaDon.TienThanhToan = newPaid;
                            if (booking != null && booking.TrangThaiThanhToan == 2) booking.TrangThaiThanhToan = 1;
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Unable to apply PaidOnline/PaidAmount adjustments for invoice {Id}", hoaDon?.IdhoaDon);
                }

                var invoiceIds = booking?.HoaDons?.Select(h => h.IdhoaDon).ToList() ?? new List<string>();
                var tongTienDichVu = await _context.Cthddvs
                    .Where(c => invoiceIds.Contains(c.IdhoaDon) && c.TrangThai == "Hoạt động")
                    .SumAsync(c => c.TienDichVu ?? 0m);

                decimal tongTienForResponse = hoaDon?.TongTien ?? 0m;
                decimal tienThanhToanForResponse = hoaDon?.TienThanhToan ?? 0m;
                decimal soTienConLai = Math.Max(0m, tongTienForResponse - tienThanhToanForResponse);

                await _context.SaveChangesAsync();

                if (!hasExternalTransaction && transaction != null)
                {
                    await transaction.CommitAsync();
                }

                var hoaDonObj = new
                {
                    idHoaDon = hoaDon!.IdhoaDon,
                    idDatPhong = hoaDon!.IddatPhong,
                    ngayLap = hoaDon!.NgayLap,
                    tienPhong = hoaDon!.TienPhong,
                    tongTien = hoaDon!.TongTien,
                    tienThanhToan = hoaDon!.TienThanhToan,
                    trangThaiThanhToan = hoaDon!.TrangThaiThanhToan
                };

                return Ok(new
                {
                    message = "Đã thêm dịch vụ và cập nhật hóa đơn thành công!",
                    hoaDon = hoaDonObj,
                    tongTienDichVu = tongTienDichVu,
                    tongTienHoaDon = hoaDon!.TongTien,
                    tienThanhToan = hoaDon!.TienThanhToan ?? 0m,
                    soTienConLai = soTienConLai
                });
            }
            catch (Exception ex)
            {
                if (!hasExternalTransaction && transaction != null)
                {
                    await transaction.RollbackAsync();
                }

                _logger.LogError(ex, "Lỗi add-service-to-invoice");
                return StatusCode(500, new { message = "Lỗi server.", error = ex.Message });
            }
        }

        // ===================== CONFIRM PAID =========================
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

                _logger.LogInformation("[ConfirmPaid] RAW REQUEST - Booking {Id}: Amount={Amount}, HoaDonId={HoaDonId}, IsOnline={IsOnline}, IsOverdue={IsOverdue}",
                    idDatPhong, req?.Amount, req?.HoaDonId, req?.IsOnline, req?.IsOverdue);

                // Xác định booking quá hạn
                DateTime standardCheckoutForCheck;
                try { standardCheckoutForCheck = booking.NgayTraPhong.ToDateTime(new TimeOnly(12, 0)); }
                catch { standardCheckoutForCheck = booking.NgayTraPhong.ToDateTime(TimeOnly.MinValue); }

                bool isActuallyOverdue = DateTime.Now > standardCheckoutForCheck;
                bool isOverdueBooking = (req?.IsOverdue == true) || (booking.TrangThai == 5) || isActuallyOverdue;

                _logger.LogInformation("[ConfirmPaid] Booking {Id} - TrangThai={TrangThai}, req.IsOverdue={ReqOverdue}, isActuallyOverdue={IsActuallyOverdue}, FINAL isOverdueBooking={IsOverdue}",
                    booking.IddatPhong, booking.TrangThai, req?.IsOverdue, isActuallyOverdue, isOverdueBooking);

                if (!isOverdueBooking)
                {
                    // Booking thường: tính lại tổng chuẩn
                    await RecomputeInvoiceAndBookingTotal(targetInvoice);
                }
                else
                {
                    // Booking QUÁ HẠN: không gọi Recompute để tránh mất phụ phí
                    await _context.Entry(targetInvoice).Collection(h => h.Cthddvs).LoadAsync();
                }

                decimal currentPaid = targetInvoice.TienThanhToan ?? 0m;
                decimal amountReq = req?.Amount ?? 0m;
                bool isOnline = req?.IsOnline == true;
                decimal finalTotal;

                // ====== ÁP DỤNG PHÍ TRẢ PHÒNG MUỘN CHO BOOKING QUÁ HẠN (KHÔNG LƯU CTHDDV) ======
                if (isOverdueBooking)
                {
                    decimal roomVal = Convert.ToDecimal(targetInvoice.TienPhong ?? 0);

                    // Tính phí trả phòng muộn trực tiếp (KHÔNG lưu vào CTHDDV)
                    await _context.Entry(booking).Collection(b => b.ChiTietDatPhongs).LoadAsync();
                    var roomLines = booking.ChiTietDatPhongs;
                    decimal baseRoomTotal = roomLines?.Sum(ct => ct.ThanhTien) ?? roomVal;
                    int nights = booking.SoDem ?? 1;

                    decimal oneNightPrice = nights > 0
                        ? Math.Round(baseRoomTotal / nights, 0, MidpointRounding.AwayFromZero)
                        : Math.Round(baseRoomTotal, 0, MidpointRounding.AwayFromZero);

                    var actualCheckout = DateTime.Now;
                    DateTime standardCheckout;
                    try
                    {
                        standardCheckout = booking.NgayTraPhong.ToDateTime(new TimeOnly(12, 0));
                    }
                    catch
                    {
                        standardCheckout = booking.NgayTraPhong.ToDateTime(TimeOnly.MinValue);
                    }

                    var diff = actualCheckout - standardCheckout;

                    decimal surchargePercent = 0m;
                    if (diff.TotalHours < 0)
                    {
                        surchargePercent = 1.00m;
                    }
                    else if (diff <= TimeSpan.FromHours(3))
                        surchargePercent = 0.30m;
                    else if (diff <= TimeSpan.FromHours(6))
                        surchargePercent = 0.50m;
                    else
                        surchargePercent = 1.00m;

                    decimal lateFeeAmount = surchargePercent >= 1.0m
                        ? oneNightPrice
                        : Math.Round(oneNightPrice * surchargePercent, 0, MidpointRounding.AwayFromZero);

                    _logger.LogInformation("[ConfirmPaid] Booking {Id} - Late fee (no VAT): oneNightPrice={OneNight}, surcharge={Percent}%, lateFee={LateFee}",
                        booking.IddatPhong, oneNightPrice, surchargePercent * 100, lateFeeAmount);

                    // Tính tổng dịch vụ (không bao gồm DV_LATE_FEE cũ nếu có)
                    decimal serviceVal = targetInvoice.Cthddvs?
                        .Where(c => string.IsNullOrEmpty(c.TrangThai) || c.TrangThai == "Hoạt động" || c.TrangThai == "new")
                        .Where(c => c.IddichVu != "DV_LATE_FEE")
                        .Sum(c => c.TienDichVu ?? 0m) ?? 0m;

                    // Tổng = (room + service) * 1.1 + lateFee (phí phạt không tính VAT)
                    decimal subTotal = roomVal + serviceVal;
                    decimal vat = Math.Round(subTotal * 0.1m, 0, MidpointRounding.AwayFromZero);
                    decimal grandTotal = subTotal + vat + lateFeeAmount;

                    _logger.LogInformation("[ConfirmPaid] Booking {Id} - TongTien = ({Room} + {Service}) * 1.1 + {LateFee} = {Total}",
                        booking.IddatPhong, roomVal, serviceVal, lateFeeAmount, grandTotal);

                    // Cập nhật tổng
                    targetInvoice.TongTien = grandTotal;
                    targetInvoice.TienThanhToan = grandTotal;
                    booking.TongTien = grandTotal;

                    // Ghi chú phí trả muộn
                    if (lateFeeAmount > 0 && (string.IsNullOrEmpty(targetInvoice.GhiChu) || 
                        !targetInvoice.GhiChu.Contains("Phí trả phòng muộn")))
                    {
                        targetInvoice.GhiChu = (targetInvoice.GhiChu ?? string.Empty)
                            + $"\nPhí trả phòng muộn (không VAT): {lateFeeAmount:N0}đ";
                    }

                    finalTotal = grandTotal;

                    _logger.LogInformation("[ConfirmPaid] Booking {Id} - SAVED: HoaDon.TongTien={HoaDonTotal}, DatPhong.TongTien={DatPhongTotal}, finalTotal={FinalTotal}",
                        booking.IddatPhong, targetInvoice.TongTien, booking.TongTien, finalTotal);
                }
                else
                {
                    finalTotal = targetInvoice.TongTien;
                }

                // ================== NHÁNH ONLINE (QR) ==================
                if (isOnline)
                {
                    if (amountReq <= 0m)
                    {
                        targetInvoice.TienThanhToan = finalTotal;
                        targetInvoice.TongTien = finalTotal;
                        targetInvoice.TrangThaiThanhToan = 2;
                        booking.TrangThaiThanhToan = 2;
                        booking.TongTien = finalTotal;
                    }
                    else
                    {
                        var newTotalPaid = currentPaid + amountReq;

                        if (newTotalPaid >= finalTotal - 1000m)
                        {
                            newTotalPaid = finalTotal;
                            targetInvoice.TrangThaiThanhToan = 2;
                            targetInvoice.TongTien = finalTotal;
                            booking.TrangThaiThanhToan = 2;
                            booking.TongTien = finalTotal;
                        }
                        else
                        {
                            targetInvoice.TrangThaiThanhToan = 1;
                            targetInvoice.TongTien = finalTotal;
                            booking.TongTien = finalTotal;
                            if (booking.TrangThaiThanhToan == 2)
                                booking.TrangThaiThanhToan = 1;
                        }

                        targetInvoice.TienThanhToan = newTotalPaid;
                    }

                    if (!string.IsNullOrWhiteSpace(req?.Note))
                        targetInvoice.GhiChu = req.Note;

                    try
                    {
                        if (!isOverdueBooking)
                        {
                            await RecomputeInvoiceAndBookingTotal(targetInvoice);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Recompute after ConfirmPaid (online) failed for {Id}", targetInvoice.IdhoaDon);
                    }

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
                // ================== HẾT NHÁNH ONLINE ==================

                // ============ LOGIC TIỀN MẶT ============
                if (amountReq <= 0 || (currentPaid + amountReq) >= (finalTotal - 5000m))
                {
                    if (isOverdueBooking)
                    {
                        targetInvoice.TrangThaiThanhToan = 2;
                        targetInvoice.TienThanhToan = finalTotal;
                        targetInvoice.TongTien = finalTotal;
                        booking.TrangThaiThanhToan = 2;
                        booking.TongTien = finalTotal;
                    }
                    else
                    {
                        decimal deposit = targetInvoice.TienCoc ?? booking.TienCoc ?? 0m;
                        var paidWhenClosing = Math.Max(0m, finalTotal - deposit);

                        targetInvoice.TrangThaiThanhToan = 2;
                        targetInvoice.TienThanhToan = paidWhenClosing;
                        targetInvoice.TongTien = finalTotal;
                        booking.TrangThaiThanhToan = 2;
                        booking.TongTien = finalTotal;
                    }
                }
                else
                {
                    targetInvoice.TrangThaiThanhToan = 1;
                    targetInvoice.TienThanhToan = currentPaid + amountReq;
                    targetInvoice.TongTien = finalTotal;
                    booking.TongTien = finalTotal;
                    if (booking.TrangThaiThanhToan == 2) booking.TrangThaiThanhToan = 1;
                }

                if (!string.IsNullOrWhiteSpace(req?.Note))
                    targetInvoice.GhiChu = req.Note;

                if (targetInvoice.TrangThaiThanhToan == 2)
                {
                    booking.TrangThaiThanhToan = 2;
                }

                _logger.LogInformation("[ConfirmPaid-Cash] BEFORE SaveChanges - Booking {Id}: HoaDon.TongTien={HoaDonTotal}, HoaDon.TienThanhToan={Paid}, DatPhong.TongTien={DatPhongTotal}, finalTotal={Final}",
                    booking.IddatPhong, targetInvoice.TongTien, targetInvoice.TienThanhToan, booking.TongTien, finalTotal);

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                _logger.LogInformation("[ConfirmPaid-Cash] AFTER SaveChanges - Booking {Id}: HoaDon.TongTien={HoaDonTotal}, DatPhong.TongTien={DatPhongTotal}",
                    booking.IddatPhong, targetInvoice.TongTien, booking.TongTien);

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

        // ===================== CREATE INVOICE =========================
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

                int trangThaiThanhToan = request.TrangThaiThanhToan ?? (request.PhuongThucThanhToan == 2 ? 1 : 2);

                var existingInvoice = booking.HoaDons?
                    .OrderByDescending(h => h.NgayLap)
                    .FirstOrDefault();

                if (existingInvoice != null)
                {
                    existingInvoice.TienPhong = tienPhong;
                    existingInvoice.Slngay = request.SoLuongNgay ?? booking.SoDem ?? existingInvoice.Slngay ?? 1;
                    existingInvoice.GhiChu = request.GhiChu;
                    if (request.TienCoc.HasValue) existingInvoice.TienCoc = request.TienCoc;

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

                    await _context.SaveChangesAsync();

                    await RecomputeInvoiceAndBookingTotal(existingInvoice);

                    existingInvoice.TrangThaiThanhToan = trangThaiThanhToan;

                    if (trangThaiThanhToan == 2)
                    {
                        existingInvoice.TienThanhToan = existingInvoice.TongTien;
                        booking.TrangThaiThanhToan = 2;
                    }
                    else
                    {
                        decimal paymentAmount = request.PreviousPayment ?? existingInvoice.TienThanhToan ?? 0m;
                        existingInvoice.TienThanhToan = paymentAmount;
                    }

                    if (booking.TrangThai != 3)
                    {
                        booking.TrangThai = 1;
                    }
                    booking.ThoiHan = null;

                    await _context.SaveChangesAsync();
                    await tx.CommitAsync();

                    decimal paidExisting = existingInvoice.TienThanhToan ?? 0m;
                    if (paidExisting == 0m)
                    {
                        paidExisting += existingInvoice.TienCoc ?? booking.TienCoc ?? 0m;
                    }

                    decimal soTienConLaiExisting = Math.Max(0m, existingInvoice.TongTien - paidExisting);

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

                var newIdHoaDon = $"HD{DateTime.Now:yyyyMMddHHmmssfff}";

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
                        var amt = (decimal?)(hoaDon.TongTien - (hoaDon.TienThanhToan ?? 0m));
                        if (amt <= 0) amt = hoaDon.TongTien;

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

        // ===================== PAY QR =========================
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

                HoaDon? hoaDon = null;
                if (!string.IsNullOrWhiteSpace(req.HoaDonId))
                {
                    hoaDon = await _context.HoaDons.Include(h => h.Cthddvs).FirstOrDefaultAsync(h => h.IdhoaDon == req.HoaDonId);
                }
                hoaDon ??= booking.HoaDons?.OrderByDescending(h => h.NgayLap).FirstOrDefault();

                if (hoaDon != null && hoaDon.TrangThaiThanhToan == 2)
                {
                    await tx.CommitAsync();
                    return Ok(new { idHoaDon = hoaDon.IdhoaDon, message = "Hóa đơn đã được thanh toán đủ.", paymentUrl = (string?)null });
                }

                if (hoaDon == null)
                {
                    var tienPhongTinh = booking.ChiTietDatPhongs?.Sum(ct => ct.ThanhTien) ?? 0m;
                    int tienPhong = (int)Math.Round(tienPhongTinh);
                    decimal tongTienDichVu = 0m;

                    if (req.Services != null && req.Services.Any())
                    {
                        tongTienDichVu = req.Services.Sum(s => s.TienDichVu ?? 0m);
                    }

                    decimal tongTien = booking.TongTien > 0m ? booking.TongTien : (tienPhongTinh + tongTienDichVu);

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
                        TrangThaiThanhToan = 1,
                        TienThanhToan = 0m,
                        GhiChu = req.Note
                    };
                    _context.HoaDons.Add(hoaDon);

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
                    booking.TrangThaiThanhToan = hoaDon.TrangThaiThanhToan ?? booking.TrangThaiThanhToan;
                    if (booking.TrangThai != 3) booking.TrangThai = 1;
                    booking.ThoiHan = null;
                    await _context.SaveChangesAsync();
                }

                decimal paid = hoaDon.TienThanhToan ?? 0m;
                decimal deposit = hoaDon.TienCoc ?? booking.TienCoc ?? 0m;
                if (paid == 0m) paid += deposit;
                else if (paid < deposit) paid = deposit;

                decimal soTienConLai = Math.Max(0m, (hoaDon.TongTien - paid));
                decimal amount = req.Amount.HasValue && req.Amount.Value > 0m ? req.Amount.Value : soTienConLai;

                if (amount <= 0m)
                {
                    await tx.CommitAsync();
                    return Ok(new { idHoaDon = hoaDon.IdhoaDon, idDatPhong = booking.IddatPhong, message = "Số tiền đã đủ thanh toán. Không cần tạo QR.", paymentUrl = (string?)null });
                }

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
                await tx.RollbackAsync();
                return StatusCode(500, new { message = "Lỗi khi tạo liên kết QR", error = ex.Message });
            }
        }

        // ===================== COMPLETE CHECKOUT =========================
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

            bool isOverdue = booking.TrangThai == 5;

            var actualCheckout = DateTime.Now;

            DateTime standardCheckout;
            try
            {
                standardCheckout = booking.NgayTraPhong.ToDateTime(new TimeOnly(12, 0));
            }
            catch
            {
                standardCheckout = booking.NgayTraPhong.ToDateTime(TimeOnly.MinValue);
            }

            // Chỉ tính phụ phí cho booking KHÔNG QUÁ HẠN khi checkout trễ giờ chuẩn.
            try
            {
                if (!isOverdue && actualCheckout > standardCheckout)
                {
                    var latest = booking.HoaDons?
                        .OrderByDescending(h => h.NgayLap)
                        .FirstOrDefault();

                    if (latest == null)
                    {
                        var newId = $"HD{DateTime.Now:yyyyMMddHHmmssfff}";
                        latest = new HoaDon
                        {
                            IdhoaDon = newId,
                            IddatPhong = booking.IddatPhong,
                            NgayLap = DateTime.Now,
                            TienPhong = 0,
                            Slngay = booking.SoDem ?? 1,
                            TongTien = 0,
                            TienCoc = booking.TienCoc ?? 0m,
                            TrangThaiThanhToan = 1,
                            TienThanhToan = 0m
                        };
                        _context.HoaDons.Add(latest);
                        await _context.SaveChangesAsync();

                        booking = await _context.DatPhongs
                            .Include(dp => dp.IdkhachHangNavigation)
                            .Include(dp => dp.IdphongNavigation)
                            .Include(dp => dp.HoaDons)
                                .ThenInclude(h => h.Cthddvs)
                            .FirstOrDefaultAsync(dp => dp.IddatPhong == idDatPhong);

                        latest = booking!.HoaDons
                            .OrderByDescending(h => h.NgayLap)
                            .FirstOrDefault();

                        if (booking == null)
                        {
                            return NotFound(new { message = "Không tìm thấy đặt phòng sau khi tạo hóa đơn tạm." });
                        }
                    }

                    var roomLines = booking.ChiTietDatPhongs;
                    decimal baseRoomTotal = 0m;
                    int nights = booking.SoDem ?? 1;
                    if (roomLines != null && roomLines.Any())
                    {
                        baseRoomTotal = roomLines.Sum(ct => ct.ThanhTien);
                    }
                    decimal oneNightPrice = nights > 0
                        ? Math.Round(baseRoomTotal / nights, 0, MidpointRounding.AwayFromZero)
                        : Math.Round(baseRoomTotal, 0, MidpointRounding.AwayFromZero);

                    var diff = actualCheckout - standardCheckout;
                    decimal surchargePercent = 0m;
                    if (diff <= TimeSpan.FromHours(3)) surchargePercent = 0.30m;
                    else if (diff <= TimeSpan.FromHours(6)) surchargePercent = 0.50m;
                    else surchargePercent = 1.00m;

                    decimal surchargeAmount = 0m;
                    if (surchargePercent >= 1.0m)
                    {
                        surchargeAmount = oneNightPrice;
                    }
                    else
                    {
                        surchargeAmount = Math.Round(oneNightPrice * surchargePercent, 0, MidpointRounding.AwayFromZero);
                    }

                    // Phí phạt cộng thẳng vào TongTien (KHÔNG tính VAT)
                    if (surchargeAmount > 0)
                    {
                        latest.TongTien = latest.TongTien + surchargeAmount;
                        booking.TongTien = booking.TongTien + surchargeAmount;

                        latest.GhiChu = (latest.GhiChu ?? string.Empty)
                            + $"\nPhí trả phòng muộn (không VAT): {surchargeAmount:N0} đ";

                        await _context.SaveChangesAsync();
                    }

                    try
                    {
                        latest!.GhiChu = (latest.GhiChu ?? string.Empty)
                            + $"\nCheckout thực tế: {actualCheckout:yyyy-MM-dd HH:mm:ss}";
                        await _context.SaveChangesAsync();
                    }
                    catch { }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to apply late checkout surcharge for {Id}", idDatPhong);
            }

            // Nếu booking đã quá hạn (TrangThai == 5), tính phí và cộng thẳng vào TongTien (KHÔNG LƯU CTHDDV)
            try
            {
                if (isOverdue)
                {
                    var latest = booking.HoaDons?.OrderByDescending(h => h.NgayLap).FirstOrDefault();
                    if (latest != null)
                    {
                        await _context.Entry(latest).Collection(h => h.Cthddvs).LoadAsync();

                        decimal roomVal = Convert.ToDecimal(latest.TienPhong ?? 0);
                        // Tính tổng dịch vụ (loại trừ DV_LATE_FEE cũ nếu có)
                        decimal serviceVal = latest.Cthddvs?
                            .Where(c => string.IsNullOrEmpty(c.TrangThai) || c.TrangThai == "Hoạt động" || c.TrangThai == "new")
                            .Where(c => c.IddichVu != "DV_LATE_FEE")
                            .Sum(c => c.TienDichVu ?? 0m) ?? 0m;

                        decimal baseTotal = Math.Round((roomVal + serviceVal) * 1.1m, 0, MidpointRounding.AwayFromZero);

                        bool hasLateNote = !string.IsNullOrEmpty(latest.GhiChu) &&
                            latest.GhiChu.IndexOf("Phí trả phòng muộn", StringComparison.OrdinalIgnoreCase) >= 0;

                        // Chỉ tính phí nếu chưa có ghi chú
                        if (!hasLateNote)
                        {
                            await _context.Entry(booking).Collection(b => b.ChiTietDatPhongs).LoadAsync();
                            var roomLines = booking.ChiTietDatPhongs;
                            decimal baseRoomTotal = 0m;
                            int nights = booking.SoDem ?? 1;
                            if (roomLines != null && roomLines.Any()) baseRoomTotal = roomLines.Sum(ct => ct.ThanhTien);
                            decimal oneNightPrice = nights > 0
                                ? Math.Round(baseRoomTotal / nights, 0, MidpointRounding.AwayFromZero)
                                : Math.Round(baseRoomTotal, 0, MidpointRounding.AwayFromZero);

                            var diff = DateTime.Now - standardCheckout;
                            decimal surchargePercent = 0m;
                            if (diff <= TimeSpan.FromHours(3)) surchargePercent = 0.30m;
                            else if (diff <= TimeSpan.FromHours(6)) surchargePercent = 0.50m;
                            else surchargePercent = 1.00m;

                            decimal surchargeAmount = 0m;
                            if (surchargePercent >= 1.0m) surchargeAmount = oneNightPrice;
                            else surchargeAmount = Math.Round(oneNightPrice * surchargePercent, 0, MidpointRounding.AwayFromZero);

                            // Cộng phí phạt thẳng vào TongTien (KHÔNG tính VAT)
                            if (surchargeAmount > 0)
                            {
                                decimal newTotal = baseTotal + surchargeAmount;

                                latest.TongTien = newTotal;
                                booking.TongTien = newTotal;

                                latest.GhiChu = (latest.GhiChu ?? string.Empty)
                                    + $"\nPhí trả phòng muộn (không VAT): {surchargeAmount:N0} đ";

                                await _context.SaveChangesAsync();
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to persist late fee for overdue booking {Id}", idDatPhong);
            }

            if (booking != null)
            {
                booking.TrangThai = 4;

                if (booking.IdphongNavigation != null)
                {
                    booking.IdphongNavigation.TrangThai = "Trống";
                }

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
            }

            if (booking != null)
            {
                try
                {
                    var latest = booking.HoaDons?.OrderByDescending(h => h.NgayLap).FirstOrDefault();
                    var email = booking.IdkhachHangNavigation?.Email;
                    var hoTen = booking.IdkhachHangNavigation?.HoTen ?? "Quý khách";

                    if (latest != null && latest.TrangThaiThanhToan == 2 && !string.IsNullOrWhiteSpace(email))
                    {
                        try { await SendInvoiceEmail(email, hoTen, latest); }
                        catch (Exception invoiceEx) { _logger.LogError(invoiceEx, "Lỗi khi gửi email hóa đơn"); }
                    }

                    if (!string.IsNullOrWhiteSpace(email))
                    {
                        try { await SendReviewReminderEmail(idDatPhong, email, hoTen); }
                        catch (Exception reviewEx) { _logger.LogError(reviewEx, "Lỗi khi gửi email đánh giá"); }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Lỗi khi gửi email sau khi hoàn tất trả phòng");
                }
            }

            return Ok(new { message = "Hoàn tất trả phòng thành công" });
        }

        // ===================== TÍNH PHÍ PHÒNG MUỘN READ-ONLY =========================
        [HttpGet("tinh-phu-phi/{idDatPhong}")]
        public async Task<IActionResult> CalculateLateFee(string idDatPhong)
        {
            if (string.IsNullOrWhiteSpace(idDatPhong)) return BadRequest(new { message = "ID đặt phòng không hợp lệ." });

            var booking = await _context.DatPhongs
                .Include(dp => dp.ChiTietDatPhongs)
                .FirstOrDefaultAsync(dp => dp.IddatPhong == idDatPhong);

            if (booking == null) return NotFound(new { message = "Không tìm thấy đặt phòng." });

            var actualCheckout = DateTime.Now;

            DateTime standardCheckout;
            try
            {
                standardCheckout = booking.NgayTraPhong.ToDateTime(new TimeOnly(12, 0));
            }
            catch
            {
                standardCheckout = booking.NgayTraPhong.ToDateTime(TimeOnly.MinValue);
            }

            if (actualCheckout <= standardCheckout)
            {
                return Ok(new
                {
                    idDatPhong = booking.IddatPhong,
                    standardCheckout = standardCheckout,
                    actualCheckout = actualCheckout,
                    surchargePercent = 0m,
                    surchargeAmount = 0m,
                    oneNightPrice = 0m,
                    message = "Không trễ giờ trả phòng"
                });
            }

            var roomLines = booking.ChiTietDatPhongs;
            decimal baseRoomTotal = 0m;
            int nights = booking.SoDem ?? 1;
            if (roomLines != null && roomLines.Any())
            {
                baseRoomTotal = roomLines.Sum(ct => ct.ThanhTien);
            }
            decimal oneNightPrice = nights > 0 ? Math.Round(baseRoomTotal / nights, 0, MidpointRounding.AwayFromZero) : Math.Round(baseRoomTotal, 0, MidpointRounding.AwayFromZero);

            var diff = actualCheckout - standardCheckout;
            decimal surchargePercent = 0m;
            if (diff <= TimeSpan.FromHours(3)) surchargePercent = 0.30m;
            else if (diff <= TimeSpan.FromHours(6)) surchargePercent = 0.50m;
            else surchargePercent = 1.00m;

            decimal surchargeAmount = 0m;
            if (surchargePercent >= 1.0m)
            {
                surchargeAmount = oneNightPrice;
            }
            else
            {
                surchargeAmount = Math.Round(oneNightPrice * surchargePercent, 0, MidpointRounding.AwayFromZero);
            }

            return Ok(new
            {
                idDatPhong = booking.IddatPhong,
                standardCheckout = standardCheckout,
                actualCheckout = actualCheckout,
                surchargePercent = surchargePercent,
                surchargeAmount = surchargeAmount,
                oneNightPrice = oneNightPrice,
                message = surchargeAmount > 0 ? "Tính phí trả phòng muộn" : "Không có phụ phí"
            });
        }

        // ===================== EMAIL & HELPER =========================
        private async Task SendInvoiceEmail(string email, string hoTen, HoaDon hoaDon)
        {
            try
            {
                var rawSubject = $"✅ Robins Villa |Kính gửi Quý khách {System.Net.WebUtility.HtmlEncode(hoTen)} ";
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

        private async Task RecomputeInvoiceAndBookingTotal(HoaDon hoaDon)
        {
            if (hoaDon == null) return;

            await _context.Entry(hoaDon).Collection(h => h.Cthddvs).LoadAsync();

            var booking = await _context.DatPhongs
                .Include(dp => dp.ChiTietDatPhongs)
                .Include(dp => dp.HoaDons)
                .FirstOrDefaultAsync(dp => dp.IddatPhong == hoaDon.IddatPhong);

            if (booking == null) return;

            decimal roomVal = (decimal)(hoaDon.TienPhong ?? 0);
            decimal serviceVal = hoaDon.Cthddvs?
                .Where(c => string.IsNullOrEmpty(c.TrangThai) || c.TrangThai == "Hoạt động" || c.TrangThai == "new")
                .Sum(c => c.TienDichVu ?? 0m) ?? 0m;

            decimal tongTienChuan = Math.Round((roomVal + serviceVal) * 1.1m, 0, MidpointRounding.AwayFromZero);
            hoaDon.TongTien = tongTienChuan;

            decimal daTraHienTai = hoaDon.TienThanhToan ?? 0m;
            decimal tienCoc = booking.TienCoc ?? 0m;

            if (tienCoc > 0 && daTraHienTai < tienCoc)
            {
                daTraHienTai = tienCoc;
                hoaDon.TienThanhToan = daTraHienTai;
            }

            decimal conThieu = tongTienChuan - daTraHienTai;

            if (conThieu > 1000m)
            {
                hoaDon.TrangThaiThanhToan = 1;
            }
            else
            {
                if (tongTienChuan > 0)
                {
                    hoaDon.TrangThaiThanhToan = 2;
                }
            }

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

                string templatePath = Path.Combine(Directory.GetCurrentDirectory(), "EmailTemplates", "thankyou-review.html");
                if (!System.IO.File.Exists(templatePath))
                {
                    _logger.LogWarning($"Email template not found at {templatePath}");
                    return;
                }

                string emailBody = System.IO.File.ReadAllText(templatePath);
                var frontendUrl = "http://localhost:5173";

                string roomName = "Phòng";
                if (booking.IdphongNavigation != null && !string.IsNullOrWhiteSpace(booking.IdphongNavigation.TenPhong))
                {
                    roomName = booking.IdphongNavigation.TenPhong;
                }
                else if (!string.IsNullOrWhiteSpace(booking.Idphong))
                {
                    var phong = await _context.Phongs.FirstOrDefaultAsync(p => p.Idphong == booking.Idphong);
                    if (phong != null && !string.IsNullOrWhiteSpace(phong.TenPhong))
                    {
                        roomName = phong.TenPhong;
                    }
                }

                _logger.LogInformation($"Room name resolved for booking {idDatPhong}: {roomName}");

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

        // ===================== GIA HẠN PHÒNG (EXTEND STAY) =========================
        [HttpGet("extend/check/{idDatPhong}")]
        public async Task<IActionResult> CheckExtendAvailability(string idDatPhong)
        {
            if (string.IsNullOrWhiteSpace(idDatPhong))
                return BadRequest(new { message = "Mã đặt phòng không hợp lệ." });

            var booking = await _context.DatPhongs
                .Include(b => b.ChiTietDatPhongs)
                    .ThenInclude(ct => ct.Phong)
                        .ThenInclude(p => p.IdloaiPhongNavigation)
                .Include(b => b.IdkhachHangNavigation)
                .FirstOrDefaultAsync(b => b.IddatPhong == idDatPhong);

            if (booking == null)
                return NotFound(new { message = "Không tìm thấy đặt phòng." });

            if (booking.TrangThai != 3 && booking.TrangThai != 5)
                return BadRequest(new { message = "Chỉ có thể gia hạn khi phòng đang sử dụng hoặc quá hạn." });

            var response = new DTOs.CheckExtendAvailabilityResponse();
            var roomId = booking.Idphong;

            var tomorrowDate = DateOnly.FromDateTime(DateTime.Today.AddDays(1));
            var nextBooking = await _context.DatPhongs
                .Include(b => b.IdkhachHangNavigation)
                .Where(b => b.Idphong == roomId
                    && b.IddatPhong != idDatPhong
                    && b.TrangThai != 0
                    && b.TrangThai != 4
                    && b.NgayNhanPhong <= tomorrowDate
                    && b.NgayTraPhong >= tomorrowDate)
                .OrderBy(b => b.NgayNhanPhong)
                .FirstOrDefaultAsync();

            response.HasNextBooking = nextBooking != null;
            response.CanExtendSameRoom = nextBooking == null;

            if (nextBooking != null)
            {
                response.NextBooking = new DTOs.NextBookingInfo
                {
                    IddatPhong = nextBooking.IddatPhong,
                    CustomerName = nextBooking.IdkhachHangNavigation?.HoTen ?? "Khách",
                    CheckinDate = nextBooking.NgayNhanPhong
                };
            }

            var room = await _context.Phongs
                .Include(p => p.IdloaiPhongNavigation)
                .FirstOrDefaultAsync(p => p.Idphong == roomId);

            decimal roomRate = room?.GiaCoBanMotDem ?? 0;

            response.SameDayOptions = new List<DTOs.ExtendOption>
            {
                new DTOs.ExtendOption
                {
                    Hour = 15,
                    Description = "Đến 15:00",
                    Percentage = 30,
                    Fee = Math.Round(roomRate * 0.30m),
                    FeeWithVat = Math.Round(roomRate * 0.30m * 1.10m)
                },
                new DTOs.ExtendOption
                {
                    Hour = 18,
                    Description = "Đến 18:00",
                    Percentage = 50,
                    Fee = Math.Round(roomRate * 0.50m),
                    FeeWithVat = Math.Round(roomRate * 0.50m * 1.10m)
                },
                new DTOs.ExtendOption
                {
                    Hour = 24,
                    Description = "Đến 23:59 (cả ngày)",
                    Percentage = 100,
                    Fee = roomRate,
                    FeeWithVat = Math.Round(roomRate * 1.10m)
                }
            };

            response.ExtraNightRate = roomRate;
            response.ExtraNightRateWithVat = Math.Round(roomRate * 1.10m);

            if (!response.CanExtendSameRoom)
            {
                var tomorrowDateTime = DateTime.Today.AddDays(1);
                var availableRooms = await FindAvailableRoomsForExtend(tomorrowDateTime, tomorrowDateTime.AddDays(1), booking.SoNguoi ?? 1, roomId);
                response.AvailableRooms = availableRooms;
                response.CanExtend = availableRooms.Count > 0;
                response.Message = availableRooms.Count > 0
                    ? $"Phòng hiện tại có khách mới check-in ngày {nextBooking?.NgayNhanPhong:dd/MM/yyyy}. Có thể chuyển sang phòng khác."
                    : "Không thể gia hạn vì phòng có khách mới và không còn phòng trống.";
            }
            else
            {
                response.CanExtend = true;
                response.Message = "Có thể gia hạn tại phòng hiện tại.";
            }

            return Ok(response);
        }

        [HttpPost("extend")]
        public async Task<IActionResult> ExtendStay([FromBody] DTOs.ExtendStayRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.IddatPhong))
                return BadRequest(new { message = "Mã đặt phòng không hợp lệ." });

            var booking = await _context.DatPhongs
                .Include(b => b.ChiTietDatPhongs)
                    .ThenInclude(ct => ct.Phong)
                .Include(b => b.IdkhachHangNavigation)
                .Include(b => b.HoaDons)
                    .ThenInclude(h => h.Cthddvs)
                .FirstOrDefaultAsync(b => b.IddatPhong == request.IddatPhong);

            if (booking == null)
                return NotFound(new { message = "Không tìm thấy đặt phòng." });

            if (booking.TrangThai != 3 && booking.TrangThai != 5)
                return BadRequest(new { message = "Chỉ có thể gia hạn khi phòng đang sử dụng hoặc quá hạn." });

            var room = await _context.Phongs
                .Include(p => p.IdloaiPhongNavigation)
                .FirstOrDefaultAsync(p => p.Idphong == booking.Idphong);

            decimal roomRate = room?.GiaCoBanMotDem ?? 0;
            var oldCheckout = booking.NgayTraPhong;
            DateOnly newCheckoutDate;
            decimal extendFee = 0;
            string extendDescription = "";

            if (request.ExtendType == DTOs.ExtendType.SameDay)
            {
                newCheckoutDate = booking.NgayTraPhong;

                int hour = request.NewCheckoutHour ?? 15;
                switch (hour)
                {
                    case 15:
                        extendFee = Math.Round(roomRate * 0.30m);
                        extendDescription = "Gia hạn đến 15:00 (30%)";
                        break;
                    case 18:
                        extendFee = Math.Round(roomRate * 0.50m);
                        extendDescription = "Gia hạn đến 18:00 (50%)";
                        break;
                    default:
                        extendFee = roomRate;
                        extendDescription = "Gia hạn đến 23:59 (100%)";
                        break;
                }
            }
            else
            {
                int nights = Math.Max(1, request.ExtraNights);
                newCheckoutDate = booking.NgayTraPhong.AddDays(nights);
                extendFee = roomRate * nights;
                extendDescription = $"Gia hạn thêm {nights} đêm";
            }

            decimal vatAmount = Math.Round(extendFee * 0.10m);
            decimal totalExtendFee = extendFee + vatAmount;

            string? newRoomId = null;
            string? newRoomName = null;

            if (!string.IsNullOrWhiteSpace(request.NewRoomId) && request.NewRoomId != booking.Idphong)
            {
                var newRoom = await _context.Phongs
                    .Include(p => p.IdloaiPhongNavigation)
                    .FirstOrDefaultAsync(p => p.Idphong == request.NewRoomId);

                if (newRoom == null)
                    return BadRequest(new { message = "Phòng mới không tồn tại." });

                var oldRoom = booking.Idphong;
                booking.Idphong = request.NewRoomId;

                foreach (var ct in booking.ChiTietDatPhongs)
                {
                    ct.IDPhong = request.NewRoomId;
                    ct.GiaPhong = newRoom.GiaCoBanMotDem ?? roomRate;
                }

                var oldRoomEntity = await _context.Phongs.FindAsync(oldRoom);
                if (oldRoomEntity != null)
                {
                    oldRoomEntity.TrangThai = "Trống";
                }

                newRoom.TrangThai = "Đang sử dụng";
                newRoomId = newRoom.Idphong;
                newRoomName = newRoom.TenPhong;

                roomRate = newRoom.GiaCoBanMotDem ?? roomRate;
            }

            booking.NgayTraPhong = newCheckoutDate;
            booking.TrangThai = 3;

            var hoaDon = booking.HoaDons?.OrderByDescending(h => h.NgayLap).FirstOrDefault();

            if (hoaDon == null)
            {
                hoaDon = new HoaDon
                {
                    IdhoaDon = $"HD{DateTime.Now:yyyyMMddHHmmssfff}",
                    IddatPhong = booking.IddatPhong,
                    NgayLap = DateTime.Now,
                    TongTien = totalExtendFee,
                    TienThanhToan = request.PaymentMethod == 1 ? totalExtendFee : 0,
                    TrangThaiThanhToan = request.PaymentMethod == 1 ? 2 : 1,
                    GhiChu = $"{extendDescription}. {request.Note ?? ""}"
                };
                _context.HoaDons.Add(hoaDon);
            }
            else
            {
                hoaDon.TongTien += totalExtendFee;
                if (request.PaymentMethod == 1)
                {
                    hoaDon.TienThanhToan = (hoaDon.TienThanhToan ?? 0) + totalExtendFee;
                }
                hoaDon.GhiChu = $"{hoaDon.GhiChu}; {extendDescription}";
            }

            var dichVuGiaHan = await _context.DichVus.FirstOrDefaultAsync(d => d.TenDichVu != null && (d.TenDichVu.Contains("Gia hạn") || d.TenDichVu.Contains("Late checkout")));

            var cthdDv = new Cthddv
            {
                IdhoaDon = hoaDon.IdhoaDon,
                IddichVu = dichVuGiaHan?.IddichVu,
                TienDichVu = totalExtendFee,
                ThoiGianThucHien = DateTime.Now,
                TrangThai = "Hoàn thành"
            };
            _context.Cthddvs.Add(cthdDv);

            if (request.PaymentMethod == 1)
            {
                booking.TrangThaiThanhToan = 2;
            }

            await _context.SaveChangesAsync();

            string? qrUrl = null;
            if (request.PaymentMethod == 2)
            {
                qrUrl = GenerateQrUrl(totalExtendFee, hoaDon.IdhoaDon, $"Gia hạn {booking.IddatPhong}");
            }

            var response = new DTOs.ExtendStayResponse
            {
                Success = true,
                Message = "Gia hạn thành công",
                IddatPhong = booking.IddatPhong,
                ExtendFee = extendFee,
                VatAmount = vatAmount,
                TotalExtendFee = totalExtendFee,
                OldCheckout = oldCheckout,
                NewCheckout = newCheckoutDate,
                HoaDonId = hoaDon.IdhoaDon,
                NewRoomId = newRoomId,
                NewRoomName = newRoomName,
                QrUrl = qrUrl,
                ExtendDescription = extendDescription
            };

            _logger.LogInformation($"Extended stay for booking {booking.IddatPhong}: {extendDescription}, Fee: {totalExtendFee}");

            return Ok(response);
        }

        private async Task<List<DTOs.AvailableRoomForExtend>> FindAvailableRoomsForExtend(DateTime checkin, DateTime checkout, int guests, string? excludeRoomId)
        {
            var checkinDate = DateOnly.FromDateTime(checkin);
            var checkoutDate = DateOnly.FromDateTime(checkout);

            var bookedRoomIds = await _context.DatPhongs
                .Where(b => b.TrangThai != 0 && b.TrangThai != 4)
                .Where(b => !(b.NgayTraPhong <= checkinDate || b.NgayNhanPhong >= checkoutDate))
                .Select(b => b.Idphong)
                .Distinct()
                .ToListAsync();

            var availableRooms = await _context.Phongs
                .Include(p => p.IdloaiPhongNavigation)
                .Where(p => !bookedRoomIds.Contains(p.Idphong))
                .Where(p => p.Idphong != excludeRoomId)
                .Where(p => (p.SoNguoiToiDa ?? 2) >= guests)
                .Where(p => p.TrangThai == "Trống" || p.TrangThai == null)
                .Select(p => new DTOs.AvailableRoomForExtend
                {
                    Idphong = p.Idphong,
                    TenPhong = p.TenPhong ?? "",
                    SoPhong = p.SoPhong,
                    TenLoaiPhong = p.IdloaiPhongNavigation != null ? p.IdloaiPhongNavigation.TenLoaiPhong : null,
                    GiaMotDem = p.GiaCoBanMotDem ?? 0,
                    UrlAnhPhong = p.UrlAnhPhong,
                    SoNguoiToiDa = p.SoNguoiToiDa
                })
                .ToListAsync();

            return availableRooms;
        }

        private string GenerateQrUrl(decimal amount, string invoiceId, string description)
        {
            var bankCode = "MB";
            var accountNo = "0988909999";
            var accountName = "ROBINS VILLA";
            var amountStr = ((long)amount).ToString();
            var message = $"{description.Replace(" ", "")}_{invoiceId}";

            return $"https://img.vietqr.io/image/{bankCode}-{accountNo}-compact2.png?amount={amountStr}&addInfo={Uri.EscapeDataString(message)}&accountName={Uri.EscapeDataString(accountName)}";
        }
    }
}