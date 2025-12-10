using Hotel_System.API.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Hotel_System.API.Services;
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
        // Số điểm khách muốn dùng để giảm giá (tính theo điểm, không phải tiền)
        public int? PointsToUse { get; set; }
    }

    public class ForceCancelRequest
    {
        public string BookingId { get; set; } = string.Empty;
        public string Reason { get; set; } = string.Empty; // no_checkout, no_response, force_process, other
        public string DepositHandling { get; set; } = "refund"; // refund, partial, keep
        public decimal? DepositPartialAmount { get; set; }
        public string? Notes { get; set; }
    }
    // DTO for previewing checkout totals when using points
    public class CheckoutPreviewRequest
    {
        // Points customer intends to use for preview (optional)
        public int? PointsToUse { get; set; }
    }


    [Route("api/[controller]")]
    [ApiController]
    public class CheckoutController : ControllerBase
    {
        private readonly HotelSystemContext _context;
        private readonly ILogger<CheckoutController> _logger;
        private readonly Hotel_System.API.Services.IEmailService _emailService;
        private readonly Hotel_System.API.Services.EmailTemplateRenderer _templateRenderer;
        private readonly RoomService _roomService;

        public CheckoutController(
            HotelSystemContext context,
            ILogger<CheckoutController> logger,
            Hotel_System.API.Services.IEmailService emailService,
            Hotel_System.API.Services.EmailTemplateRenderer templateRenderer,
            RoomService roomService)
        {
            _context = context;
            _logger = logger;
            _emailService = emailService;
            _templateRenderer = templateRenderer;
            _roomService = roomService;
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

            // ===== 1. Fallback giá gốc nếu booking.TongTien đang = 0 =====
            decimal tongTienDaChot = booking.TongTien;

            if (tongTienDaChot <= 0m)
            {
                // Tổng tiền phòng từ ChiTietDatPhongs
                decimal roomLinesTotal = 0m;
                try
                {
                    if (booking.ChiTietDatPhongs != null && booking.ChiTietDatPhongs.Any())
                    {
                        roomLinesTotal = booking.ChiTietDatPhongs.Sum(ct =>
                            ct.ThanhTien != 0m
                                ? ct.ThanhTien
                                : (ct.GiaPhong != 0m ? ct.GiaPhong : 0m));
                    }
                }
                catch { roomLinesTotal = 0m; }

                // Tổng dịch vụ (không VAT) từ tất cả hóa đơn
                decimal serviceBaseTotal = 0m;
                try
                {
                    serviceBaseTotal = booking.HoaDons?
                        .SelectMany(h => h.Cthddvs ?? new List<Cthddv>())
                        .Where(c =>
                            string.IsNullOrEmpty(c.TrangThai) ||
                            c.TrangThai == "Hoạt động" ||
                            c.TrangThai == "new")
                        .Sum(c => c.TienDichVu ?? 0m) ?? 0m;
                }
                catch { serviceBaseTotal = 0m; }

                // Hóa đơn mới nhất
                var latestInvoiceForBase = booking.HoaDons?
                    .OrderByDescending(h => h.NgayLap)
                    .FirstOrDefault();

                if (latestInvoiceForBase != null && latestInvoiceForBase.TongTien > 0m)
                {
                    tongTienDaChot = latestInvoiceForBase.TongTien;
                }
                else if (roomLinesTotal > 0m)
                {
                    var sub = roomLinesTotal + serviceBaseTotal;
                    var vat = Math.Round(sub * 0.1m, 0, MidpointRounding.AwayFromZero);
                    tongTienDaChot = sub + vat;
                }

                // PATCH: KHÔNG sửa tổng nền trong DB khi booking đang quá hạn (TrangThai == 5)
                if (tongTienDaChot > 0m && booking.TongTien <= 0m && booking.TrangThai != 5)
                {
                    try
                    {
                        booking.TongTien = tongTienDaChot;
                        if (latestInvoiceForBase != null && latestInvoiceForBase.TongTien <= 0m)
                            latestInvoiceForBase.TongTien = tongTienDaChot;
                        await _context.SaveChangesAsync();
                        _logger.LogInformation("[GetSummary] Fixed booking.TongTien from base calc for {Id} = {TongTien}",
                            booking.IddatPhong, tongTienDaChot);
                    }
                    catch (Exception exFix)
                    {
                        _logger.LogWarning(exFix, "[GetSummary] Failed to fix booking.TongTien for {Id}", booking.IddatPhong);
                    }
                }

                // If booking already has a persisted positive total (e.g., late-fee applied), prefer it
                // so that reloading/refreshing does not reset the displayed total back to 0.
                if (booking.TongTien > 0m)
                {
                    tongTienDaChot = booking.TongTien;
                }
            }

            // ===== 2. Chuẩn 12h checkout & gia hạn =====
            DateTime standardCheckout;
            try
            {
                standardCheckout = booking.NgayTraPhong.ToDateTime(new TimeOnly(12, 0));
            }
            catch
            {
                standardCheckout = booking.NgayTraPhong.ToDateTime(TimeOnly.MinValue);
            }

            bool hasExtendMarker = booking.HoaDons?.Any(h =>
                !string.IsNullOrEmpty(h.GhiChu) &&
                h.GhiChu.IndexOf("Gia hạn", StringComparison.OrdinalIgnoreCase) >= 0) ?? false;

            DateTime effectiveCheckout = standardCheckout;
            if (hasExtendMarker)
            {
                var extendInvoice = booking.HoaDons?
                    .Where(h => !string.IsNullOrEmpty(h.GhiChu) &&
                               h.GhiChu.IndexOf("Gia hạn", StringComparison.OrdinalIgnoreCase) >= 0)
                    .OrderByDescending(h => h.NgayLap)
                    .FirstOrDefault();

                if (extendInvoice != null && !string.IsNullOrEmpty(extendInvoice.GhiChu))
                {
                    var ghiChu = extendInvoice.GhiChu;
                    var match = System.Text.RegularExpressions.Regex.Match(ghiChu, @"(\d{4}-\d{2}-\d{2}\s+)?(\d{1,2}:\d{2})");
                    if (match.Success)
                    {
                        var timeStr = match.Groups[2].Value;
                        if (TimeOnly.TryParse(timeStr, out var extendTime))
                        {
                            if (!string.IsNullOrEmpty(match.Groups[1].Value) &&
                                DateOnly.TryParse(match.Groups[1].Value.Trim(), out var extendDate))
                            {
                                effectiveCheckout = extendDate.ToDateTime(extendTime);
                            }
                            else
                            {
                                effectiveCheckout = booking.NgayTraPhong.ToDateTime(extendTime);
                            }
                            _logger.LogInformation("[GetSummary] Booking {Id} có gia hạn đến {Time}",
                                booking.IddatPhong, effectiveCheckout);
                        }
                    }
                }
            }

            bool isPastCheckoutTime = DateTime.Now > effectiveCheckout;

            // Auto set TrangThai = 5 khi quá giờ checkout mà chưa hoàn tất
            bool autoMarkedOverdue = false;
            if (isPastCheckoutTime && booking.TrangThai != 5 && booking.TrangThai != 4)
            {
                try
                {
                    booking.TrangThai = 5;
                    await _context.SaveChangesAsync();
                    autoMarkedOverdue = true;
                    _logger.LogInformation("[GetSummary] Auto-set TrangThai=5 for booking {Id} because past effective checkout {Time}",
                        booking.IddatPhong, effectiveCheckout);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[GetSummary] Failed to auto-set TrangThai for booking {Id}", booking.IddatPhong);
                }
            }

            bool isOverdueBooking = (booking.TrangThai == 5);

            // ===== 3. Build services list =====
            var services = new List<object>();
            if (booking.HoaDons != null)
            {
                foreach (var invoice in booking.HoaDons)
                {
                    if (invoice.Cthddvs != null)
                    {
                        var lines = invoice.Cthddvs
                            .Where(c =>
                                string.IsNullOrEmpty(c.TrangThai) ||
                                c.TrangThai == "Hoạt động" ||
                                c.TrangThai == "Hoàn thành" ||
                                c.TrangThai == "new" ||
                                c.TrangThai == "Gia hạn")
                            .ToList();

                        services.AddRange(lines.Select(c => new
                        {
                            tenDichVu = c.IddichVuNavigation?.TenDichVu ?? c.IdkhuyenMaiComboNavigation?.TenCombo,
                            donGia = c.TienDichVu,
                            thanhTien = c.TienDichVu
                        }));
                    }
                }
            }

            decimal lateFee = 0m;
            // Use persisted booking total when available to prevent reloads showing 0
            decimal tongTien = (booking.TongTien > 0m) ? booking.TongTien : tongTienDaChot;

            // Biến hiển thị (tính bên dưới)
            decimal serviceTotal = 0m;
            decimal roomTotal = 0m;
            decimal subTotalBase = 0m;
            decimal vatBase = 0m;
            bool invoicesChanged = false;

            // ===== 4. TÍNH PHÍ QUÁ HẠN & LƯU VÀO DB =====
            if (isOverdueBooking)
            {
                // PATCH: One-shot late fee. Nếu đã có note "Phí trả phòng muộn": không tính lại, dùng tổng DB.
                var latestInvoiceLocal = booking.HoaDons?
                    .OrderByDescending(h => h.NgayLap)
                    .FirstOrDefault();

                bool hasLateNote = latestInvoiceLocal != null &&
                    !string.IsNullOrEmpty(latestInvoiceLocal.GhiChu) &&
                    latestInvoiceLocal.GhiChu.IndexOf("Phí trả phòng muộn", StringComparison.OrdinalIgnoreCase) >= 0;

                // Luôn ưu tiên tổng đã lưu
                if (booking.TongTien > 0m)
                {
                    tongTien = booking.TongTien;
                }
                else if (latestInvoiceLocal != null && latestInvoiceLocal.TongTien > 0m)
                {
                    tongTien = latestInvoiceLocal.TongTien;
                    try
                    {
                        booking.TongTien = tongTien;
                        await _context.SaveChangesAsync();
                    }
                    catch { /* ignore */ }
                }
                else
                {
                    tongTien = tongTienDaChot;
                }

                if (!hasLateNote)
                {
                    var actualCheckout = DateTime.Now;
                    var diff = actualCheckout - standardCheckout;

                    int nights = booking.SoDem ?? 1;

                    // Dùng tổng phòng từ chi tiết đặt phòng để ra giá 1 đêm
                    decimal roomLinesTotal = 0m;
                    try
                    {
                        if (booking.ChiTietDatPhongs != null && booking.ChiTietDatPhongs.Any())
                        {
                            roomLinesTotal = booking.ChiTietDatPhongs.Sum(ct =>
                                ct.ThanhTien != 0m
                                    ? ct.ThanhTien
                                    : (ct.GiaPhong != 0m ? ct.GiaPhong : 0m));
                        }
                    }
                    catch { roomLinesTotal = 0m; }

                    decimal oneNightPrice = nights > 0
                        ? Math.Round(roomLinesTotal / nights, 0, MidpointRounding.AwayFromZero)
                        : Math.Round(roomLinesTotal, 0, MidpointRounding.AwayFromZero);

                    decimal surchargePercent = 0m;
                    if (diff.TotalHours < 0)
                        surchargePercent = 1.00m;
                    else if (diff <= TimeSpan.FromHours(3))
                        surchargePercent = 0.30m;
                    else if (diff <= TimeSpan.FromHours(6))
                        surchargePercent = 0.50m;
                    else
                        surchargePercent = 1.00m;

                    // lateFee không VAT
                    lateFee = surchargePercent >= 1.0m
                        ? oneNightPrice
                        : Math.Round(oneNightPrice * surchargePercent, 0, MidpointRounding.AwayFromZero);

                    var baseTotal = (tongTien > 0m ? tongTien : tongTienDaChot);
                    var newTotal = baseTotal + lateFee;

                    try
                    {
                        booking.TongTien = newTotal;

                        if (latestInvoiceLocal != null)
                        {
                            latestInvoiceLocal.TongTien = newTotal;
                            latestInvoiceLocal.GhiChu =
                                (latestInvoiceLocal.GhiChu ?? string.Empty) +
                                $"\nPhí trả phòng muộn (không VAT): {lateFee:N0}đ";
                        }

                        await _context.SaveChangesAsync();
                        tongTien = newTotal;

                        _logger.LogInformation(
                            "[GetSummary] One-shot late fee persisted for overdue booking {Id}: lateFee={LateFee}, TongTien={TongTien}",
                            booking.IddatPhong, lateFee, tongTien);
                    }
                    catch (Exception exPersist)
                    {
                        _logger.LogWarning(exPersist,
                            "[GetSummary] Failed to persist one-shot late fee for booking {Id}",
                            booking.IddatPhong);
                    }
                }
                else
                {
                    // Suy ra lateFee nếu cần hiển thị
                    if (tongTien > tongTienDaChot) lateFee = tongTien - tongTienDaChot;
                }
            }
            else
            {
                // ===== BOOKING THƯỜNG (KHÔNG QUÁ HẠN) =====
                if (hasExtendMarker && booking.TongTien > tongTienDaChot)
                {
                    tongTien = booking.TongTien;
                }
                else
                {
                    tongTien = tongTienDaChot;
                    try
                    {
                        if (booking.TongTien != tongTienDaChot)
                        {
                            booking.TongTien = tongTienDaChot;
                            await _context.SaveChangesAsync();
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Không thể cập nhật booking.TongTien trong GetSummary cho {Id}", booking.IddatPhong);
                    }
                }
            }

            // ===== 5. TÍNH roomTotal/serviceTotal/subTotal/vat CHO HIỂN THỊ =====
            serviceTotal = booking.HoaDons?
                .SelectMany(h => h.Cthddvs?
                    .Where(c => string.IsNullOrEmpty(c.TrangThai) || c.TrangThai == "Hoạt động" || c.TrangThai == "new")
                    .Select(c => c.TienDichVu ?? 0m) ?? new List<decimal>())
                .Sum() ?? 0m;

            roomTotal = 0m;
            subTotalBase = 0m;
            vatBase = 0m;

            var latestInvoice = booking.HoaDons?.OrderByDescending(h => h.NgayLap).FirstOrDefault();
            if (latestInvoice?.GhiChu?.Contains("[PRICE_LOCKED]") == true)
            {
                try
                {
                    var priceLockedJson = ExtractPriceLockedJson(latestInvoice.GhiChu);
                    if (!string.IsNullOrEmpty(priceLockedJson))
                    {
                        var priceData = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(priceLockedJson);
                        if (priceData != null)
                        {
                            if (priceData.TryGetValue("goc", out var gocValue))
                            {
                                roomTotal = Convert.ToDecimal(gocValue);

                                // CHỈ override TongTien hóa đơn nếu KHÔNG phải booking quá hạn
                                if (!isOverdueBooking)
                                {
                                    decimal invoiceRoom = 0m;
                                    try { invoiceRoom = Convert.ToDecimal(latestInvoice?.TienPhong ?? 0); } catch { invoiceRoom = 0m; }

                                    decimal invoiceService = latestInvoice?.Cthddvs != null
                                        ? latestInvoice.Cthddvs.Where(c =>
                                                string.IsNullOrEmpty(c.TrangThai) ||
                                                c.TrangThai == "Hoạt động" ||
                                                c.TrangThai == "new" ||
                                                c.TrangThai == "Gia hạn")
                                            .Sum(c => c.TienDichVu ?? 0m)
                                        : 0m;

                                    decimal invoiceSub = invoiceRoom + invoiceService;
                                    decimal invoiceTotalComputed = Math.Round(invoiceSub * 1.1m, 0, MidpointRounding.AwayFromZero);

                                    if (invoiceTotalComputed > 0m && latestInvoice.TongTien != invoiceTotalComputed)
                                    {
                                        latestInvoice.TongTien = invoiceTotalComputed;
                                        invoicesChanged = true;
                                    }
                                }
                            }
                            if (priceData.TryGetValue("giamKM", out var giamKmValue))
                            {
                                roomTotal -= Convert.ToDecimal(giamKmValue);
                            }
                            if (priceData.TryGetValue("giamDiem", out var giamDiemValue))
                            {
                                roomTotal -= Convert.ToDecimal(giamDiemValue);
                            }

                            subTotalBase = roomTotal + serviceTotal;
                            vatBase = Math.Round(subTotalBase * 0.1m, 0, MidpointRounding.AwayFromZero);
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Không thể parse PRICE_LOCKED JSON cho booking {Id}", booking.IddatPhong);
                }
            }

            if (roomTotal == 0m)
            {
                decimal roomLinesTotal = 0m;
                try
                {
                    roomLinesTotal = booking.ChiTietDatPhongs != null && booking.ChiTietDatPhongs.Any()
                        ? booking.ChiTietDatPhongs.Sum(ct => (ct.ThanhTien != 0m ? ct.ThanhTien : (ct.GiaPhong != 0m ? ct.GiaPhong : 0m)))
                        : 0m;
                }
                catch { roomLinesTotal = 0m; }

                if (roomLinesTotal > 0m)
                {
                    roomTotal = roomLinesTotal;
                    subTotalBase = roomTotal + serviceTotal;
                    vatBase = Math.Round(subTotalBase * 0.1m, 0, MidpointRounding.AwayFromZero);
                }
                else
                {
                    subTotalBase = Math.Round(tongTienDaChot / 1.1m, 0, MidpointRounding.AwayFromZero);
                    vatBase = tongTienDaChot - subTotalBase;
                    roomTotal = subTotalBase - serviceTotal;
                }
            }

            // 6. Cọc & đã thanh toán
            // Ensure overdue bookings use persisted totals (or recover from PRICE_LOCKED + note)
            if (isOverdueBooking)
            {
                try
                {
                    // Prefer canonical values already stored in booking.TongTien or latest invoice
                    if (booking.TongTien > 0m)
                    {
                        tongTien = booking.TongTien;
                    }
                    else if (latestInvoice != null && latestInvoice.TongTien > 0m)
                    {
                        tongTien = latestInvoice.TongTien;
                        booking.TongTien = tongTien;
                        await _context.SaveChangesAsync();
                    }
                    else
                    {
                        // Try recover from PRICE_LOCKED 'cuoi' and parse late-fee from note
                        decimal lockedCuoi = 0m;
                        try
                        {
                            if (latestInvoice != null)
                            {
                                var parsed = TryGetLockedPriceFromNote(latestInvoice.GhiChu);
                                if (parsed.HasValue) lockedCuoi = parsed.Value;
                            }
                        }
                        catch { lockedCuoi = 0m; }

                        decimal parsedLate = 0m;
                        try
                        {
                            if (latestInvoice != null && !string.IsNullOrEmpty(latestInvoice.GhiChu))
                            {
                                var m = System.Text.RegularExpressions.Regex.Match(latestInvoice.GhiChu, @"([0-9\.,]+)\s*đ", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                                if (m.Success && m.Groups.Count > 1)
                                {
                                    var num = m.Groups[1].Value;
                                    num = num.Replace(".", string.Empty).Replace(",", string.Empty);
                                    if (decimal.TryParse(num, out var parsed)) parsedLate = parsed;
                                }
                            }
                        }
                        catch { parsedLate = 0m; }

                        if (lockedCuoi > 0m)
                        {
                            var desired = lockedCuoi + parsedLate;
                            tongTien = desired;
                            try
                            {
                                if (latestInvoice != null)
                                {
                                    latestInvoice.TongTien = desired;
                                    if (parsedLate > 0 && (string.IsNullOrEmpty(latestInvoice.GhiChu) || latestInvoice.GhiChu.IndexOf("Phí trả phòng muộn", StringComparison.OrdinalIgnoreCase) < 0))
                                        latestInvoice.GhiChu = (latestInvoice.GhiChu ?? string.Empty) + $"\nPhí trả phòng muộn (không VAT): {parsedLate:N0}đ";
                                }
                                booking.TongTien = desired;
                                await _context.SaveChangesAsync();
                                _logger.LogInformation("[GetSummary] Recovered overdue total from PRICE_LOCKED for booking {Id}: {Total}", booking.IddatPhong, desired);
                            }
                            catch (Exception exRec)
                            {
                                _logger.LogWarning(exRec, "[GetSummary] Failed to persist recovered overdue total for booking {Id}", booking.IddatPhong);
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[GetSummary] Error while ensuring persisted overdue totals for booking {Id}", booking.IddatPhong);
                }
            }

            decimal deposit = booking.TienCoc ?? 0m;
            decimal paidAmount = booking.HoaDons?.Sum(h => h.TienThanhToan ?? 0m) ?? 0m;

            // Ensure we don't return 0 when DB has a valid persisted total
            if (tongTien <= 0m)
            {
                if (booking.TongTien > 0m) tongTien = booking.TongTien;
                else if (latestInvoice != null && latestInvoice.TongTien > 0m) tongTien = latestInvoice.TongTien;
            }

            // 7. Còn phải thu
            decimal remaining = Math.Max(0m, tongTien - paidAmount);

            // Phí gia hạn (nếu có)
            decimal extendFeeOut = 0m;
            bool hasExtendMarkerForFee = booking.HoaDons?.Any(h =>
                !string.IsNullOrEmpty(h.GhiChu) &&
                h.GhiChu.IndexOf("Gia hạn", StringComparison.OrdinalIgnoreCase) >= 0) ?? false;

            if (hasExtendMarkerForFee)
            {
                decimal baseTotalForExtend = subTotalBase + vatBase;
                extendFeeOut = Math.Max(0m, tongTien - baseTotalForExtend - lateFee);
            }

            var invoices = booking.HoaDons != null
                ? booking.HoaDons
                    .OrderByDescending(h => h.NgayLap)
                    .Select(h => new
                    {
                        IDHoaDon = h.IdhoaDon,
                        NgayLap = h.NgayLap,
                        TongTien = h.TongTien,
                        TienThanhToan = h.TienThanhToan,
                        TrangThaiThanhToan = h.TrangThaiThanhToan,
                        GhiChu = h.GhiChu
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
                    lateFee,
                    extendFee = extendFeeOut,
                    isPastCheckoutTime
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

        /// <summary>
        /// Unified API to check available rooms for any date range.
        /// Query params: checkin (ISO date), checkout (ISO date), guests (int), excludeRoomId (string, optional)
        /// This centralizes room-availability checks so callers can rely on a single endpoint.
        /// </summary>
        [HttpGet("rooms/available")]
        public async Task<IActionResult> CheckAvailableRooms([FromQuery] DateTime checkin, [FromQuery] DateTime checkout, [FromQuery] int guests = 1, [FromQuery] string? excludeRoomId = null)
        {
            if (checkin == default || checkout == default || checkout <= checkin)
                return BadRequest(new { message = "Invalid checkin/checkout dates." });

            // Delegate to RoomService for canonical availability logic
            var available = await _roomService.CheckAvailableRoomsAsync(checkin, checkout, guests);

            if (!string.IsNullOrWhiteSpace(excludeRoomId))
            {
                available = available.Where(r => !(r.RoomId == excludeRoomId || r.RoomId?.Equals(excludeRoomId, StringComparison.OrdinalIgnoreCase) == true)).ToList();
            }

            return Ok(new { success = true, checkin = checkin.ToString("yyyy-MM-dd"), checkout = checkout.ToString("yyyy-MM-dd"), guests, availableRooms = available });
        }

        // ===================== PREVIEW CHECKOUT (with points) =========================
        [HttpPost("preview/{idDatPhong}")]
        public async Task<IActionResult> PreviewCheckout(string idDatPhong, [FromBody] CheckoutPreviewRequest? req)
        {
            if (string.IsNullOrWhiteSpace(idDatPhong))
                return BadRequest(new { message = "Mã đặt phòng không hợp lệ." });

            var booking = await _context.DatPhongs
                .Include(b => b.ChiTietDatPhongs)
                .Include(b => b.HoaDons)
                    .ThenInclude(h => h.Cthddvs)
                .Include(b => b.IdkhachHangNavigation)
                .FirstOrDefaultAsync(b => b.IddatPhong == idDatPhong);

            if (booking == null)
                return NotFound(new { message = "Không tìm thấy đặt phòng." });

            var targetInvoice = booking.HoaDons?.OrderByDescending(h => h.NgayLap).FirstOrDefault();
            if (targetInvoice == null)
                return NotFound(new { message = "Không tìm thấy hóa đơn cho đặt phòng." });

            // Recompute if not overdue to ensure totals are fresh
            DateTime standardCheckout;
            try { standardCheckout = booking.NgayTraPhong.ToDateTime(new TimeOnly(12, 0)); }
            catch { standardCheckout = booking.NgayTraPhong.ToDateTime(TimeOnly.MinValue); }
            bool isOverdue = DateTime.Now > standardCheckout || booking.TrangThai == 5;
            if (!isOverdue)
            {
                await RecomputeInvoiceAndBookingTotal(targetInvoice);
                // reload targetInvoice totals
                await _context.Entry(targetInvoice).ReloadAsync();
            }

            decimal finalTotal = targetInvoice.TongTien;
            decimal paidAmount = targetInvoice.TienThanhToan ?? 0m;
            decimal deposit = booking.TienCoc ?? 0m;
            decimal remaining = Math.Max(0m, finalTotal - paidAmount);

            // QUY ĐỔI ĐIỂM:
            // - Cộng điểm: 100.000đ = 1 điểm
            // - Dùng điểm: 1 điểm = 100đ giảm giá
            const decimal EARN_RATE = 100_000m;   // 100.000đ = 1 điểm
            const decimal REDEEM_RATE = 100m;     // 1 điểm = 100đ giảm
            const decimal MAX_REDEEM_PERCENT = 0.5m; // Tối đa dùng 50% giá trị hóa đơn

            int currentPoints = booking.IdkhachHangNavigation?.TichDiem ?? 0;
            int pointsToUse = req?.PointsToUse ?? 0;

            // Tính số điểm tối đa có thể dùng (50% giá trị hóa đơn)
            decimal maxDiscountAmount = finalTotal * MAX_REDEEM_PERCENT;
            int maxPointsByAmount = (int)Math.Floor(maxDiscountAmount / REDEEM_RATE);

            if (pointsToUse < 0) pointsToUse = 0;

            if (pointsToUse > currentPoints)
            {
                return BadRequest(new { message = $"Không đủ điểm. Hiện có {currentPoints} điểm." });
            }

            if (pointsToUse > maxPointsByAmount)
            {
                return BadRequest(new { message = $"Chỉ được dùng tối đa {maxPointsByAmount} điểm (50% giá trị hóa đơn)." });
            }

            // Tính tiền giảm từ điểm
            decimal discount = pointsToUse * REDEEM_RATE;
            decimal finalAfterPoints = Math.Max(0m, finalTotal - discount);

            // Tính điểm mới sẽ được cộng (dựa trên số tiền thực trả sau khi đã giảm điểm)
            int pointsToAdd = (int)Math.Floor((double)(finalAfterPoints / EARN_RATE));

            return Ok(new
            {
                idDatPhong = booking.IddatPhong,
                money = new
                {
                    tongTien = finalTotal,
                    paidAmount,
                    deposit,
                    remaining,
                    discountFromPoints = discount,
                    finalAfterPoints
                },
                points = new
                {
                    currentPoints,
                    pointsToUse,
                    pointsToAdd,
                    maxPointsByAmount
                }
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

                var booking = hoaDon.IddatPhongNavigation;

                // ======= THÊM CÁC DÒNG DỊCH VỤ MỚI VÀO CTHDDV =======
                foreach (var item in req.DichVu)
                {
                    // Try to derive unit price and quantity.
                    // Prefer explicit DonGia (unit price). If DonGia provided and TongTien provided,
                    // compute qty = round(TongTien / DonGia). Otherwise try TienDichVu as unit price.
                    decimal providedUnit = item.DonGia ?? item.TienDichVu ?? 0m;
                    decimal totalProvided = item.TongTien ?? item.TienDichVu ?? item.DonGia ?? 0m;

                    int qty = 1;
                    if (item.DonGia.HasValue && item.DonGia.Value > 0m && item.TongTien.HasValue && item.TongTien.Value > 0m)
                    {
                        qty = (int)Math.Max(1, Math.Round(item.TongTien.Value / item.DonGia.Value, 0));
                    }
                    else if (item.TienDichVu.HasValue && item.TienDichVu.Value > 0m && item.TongTien.HasValue && item.TongTien.Value > 0m)
                    {
                        qty = (int)Math.Max(1, Math.Round(item.TongTien.Value / item.TienDichVu.Value, 0));
                    }
                    else if (providedUnit > 0m && totalProvided > 0m)
                    {
                        qty = (int)Math.Max(1, Math.Round(totalProvided / providedUnit, 0));
                    }

                    // If qty is still 0 or negative, default to 1
                    if (qty <= 0) qty = 1;

                    // Handle combo vs regular service identification
                    string? dichVuId = null;
                    string? comboId = null;
                    if (!string.IsNullOrEmpty(item.IddichVu) && item.IddichVu.StartsWith("combo:"))
                    {
                        comboId = item.IddichVu.Substring(6);
                        var comboExists = await _context.KhuyenMaiCombos.AnyAsync(kmc => kmc.IdkhuyenMaiCombo == comboId);
                        if (!comboExists)
                        {
                            _logger.LogError("Combo {ComboId} not found in database", comboId);
                            return BadRequest(new { message = $"Combo {comboId} không tồn tại." });
                        }
                        dichVuId = null;
                    }
                    else
                    {
                        dichVuId = item.IddichVu;
                        comboId = null;
                    }

                    // Determine unit price to store per row
                    decimal unitToStore = item.DonGia ?? item.TienDichVu ?? 0m;
                    if (unitToStore <= 0m && totalProvided > 0m && qty > 0)
                    {
                        unitToStore = Math.Round(totalProvided / qty, 0, MidpointRounding.AwayFromZero);
                    }

                    _logger.LogInformation("Adding service to invoice: IddichVu={DichVuId}, IdkhuyenMaiCombo={ComboId}, Qty={Qty}, Unit={Unit}",
                        dichVuId, comboId, qty, unitToStore);

                    for (int i = 0; i < qty; i++)
                    {
                        var serviceDetail = new Cthddv
                        {
                            IdhoaDon = hoaDon.IdhoaDon,
                            IddichVu = dichVuId,
                            IdkhuyenMaiCombo = comboId,
                            TienDichVu = Math.Round(unitToStore, 0, MidpointRounding.AwayFromZero),
                            IdkhuyenMai = null,
                            ThoiGianThucHien = DateTime.Now,
                            TrangThai = "Hoạt động"
                        };
                        _context.Cthddvs.Add(serviceDetail);
                    }
                }

                await _context.SaveChangesAsync();

                // ======= CHỈ CỘNG THÊM TIỀN DỊCH VỤ (CÓ VAT), KHÔNG ĐỤNG TIỀN PHÒNG =======
                // Tổng tiền gốc của các dịch vụ mới (chưa VAT)
                decimal newServiceBase = req.DichVu.Sum(item =>
                    Math.Round(item.TongTien ?? item.TienDichVu ?? item.DonGia ?? 0m, 0, MidpointRounding.AwayFromZero));

                // Dịch vụ chịu VAT 10% → tổng cộng thêm = newServiceBase * 1.1
                decimal newServiceWithVat = Math.Round(newServiceBase * 1.10m, 0, MidpointRounding.AwayFromZero);

                // Cộng thêm vào TongTien của hóa đơn + booking
                hoaDon.TongTien = hoaDon.TongTien + newServiceWithVat;
                if (booking != null)
                {
                    booking.TongTien = booking.TongTien + newServiceWithVat;
                }

                await _context.SaveChangesAsync();

                // ======= CẬP NHẬT TRẠNG THÁI THANH TOÁN THEO PaidOnline / PaidAmount =======
                decimal daTra = hoaDon.TienThanhToan ?? 0m;
                decimal conLai = hoaDon.TongTien - daTra;

                if (booking != null)
                {
                    bool hasImmediatePayment =
                        (req.PaidOnline == true) ||
                        (req.PaidAmount.HasValue && req.PaidAmount.Value > 0m);

                    if (!hasImmediatePayment)
                    {
                        // Không thanh toán ngay → chắc chắn còn thiếu
                        hoaDon.TrangThaiThanhToan = 1;
                        booking.TrangThaiThanhToan = 1;
                    }
                    else
                    {
                        // Có PaidAmount / PaidOnline: xét lại trạng thái theo số tiền thực tế
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
                }

                try
                {
                    if (req.PaidOnline == true)
                    {
                        // Đã thanh toán online toàn bộ
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

                // Tính lại tổng tiền dịch vụ (chỉ để trả về cho FE)
                var invoiceIds = booking?.HoaDons?.Select(h => h.IdhoaDon).ToList() ?? new List<string>();
                var tongTienDichVu = await _context.Cthddvs
                    .Where(c => invoiceIds.Contains(c.IdhoaDon) && c.TrangThai == "Hoạt động")
                    .SumAsync(c => c.TienDichVu ?? 0m);

                decimal tongTienForResponse = hoaDon.TongTien;
                decimal tienThanhToanForResponse = hoaDon.TienThanhToan ?? 0m;
                decimal depositForResponse = booking?.TienCoc ?? 0m;
                // Remaining due = TongTien - (DaThanhToan + TienCoc)
                decimal soTienConLai = Math.Max(0m, tongTienForResponse - (tienThanhToanForResponse + depositForResponse));

                await _context.SaveChangesAsync();

                // ======= CẬP NHẬT THỐNG KÊ (NHƯ CŨ) =======
                try
                {
                    var connUpsert = _context.Database.GetDbConnection();
                    await connUpsert.OpenAsync();
                    using var cmdUpsert = connUpsert.CreateCommand();
                    cmdUpsert.CommandText = "SELECT upsert_thongke_for_hoadon(@id);";
                    var p = cmdUpsert.CreateParameter(); p.ParameterName = "@id"; p.Value = hoaDon.IdhoaDon; cmdUpsert.Parameters.Add(p);
                    await cmdUpsert.ExecuteNonQueryAsync();
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "upsert_thongke_for_hoadon failed for invoice {Id}. Falling back to full sync.", hoaDon?.IdhoaDon);
                    try
                    {
                        var connSync = _context.Database.GetDbConnection();
                        await connSync.OpenAsync();
                        using var cmdSync = connSync.CreateCommand();
                        cmdSync.CommandText = "SELECT sync_thongke_from_mv();";
                        await cmdSync.ExecuteNonQueryAsync();
                    }
                    catch (Exception ex2)
                    {
                        _logger.LogWarning(ex2, "Failed fallback sync_thongke_from_mv after payment.");
                    }
                }

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
                decimal tongTien = booking.TongTien > 0m ? booking.TongTien : Math.Round(totalBeforeVat * 1.1m, 0, MidpointRounding.AwayFromZero);

                // Map payment method to invoice payment status:
                // PhuongThucThanhToan: 1 = Tiền mặt (paid), 2 = Online/QR (pending), 3 = Thanh toán sau (pay-later -> pending/unpaid)
                int trangThaiThanhToan = request.TrangThaiThanhToan ?? (request.PhuongThucThanhToan == 1 ? 2 : 1);
                if (request.PhuongThucThanhToan == 3)
                {
                    trangThaiThanhToan = 1;
                }
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

                var ghiChuBase = request.GhiChu ?? "";
                var priceLockedJson = System.Text.Json.JsonSerializer.Serialize(new
                {
                    goc = (int)tongTien, // Since price is locked, use final as all components
                    giamKM = 0,
                    giamDiem = 0,
                    cuoi = (int)tongTien,
                    diemDaDung = 0
                });
                var ghiChuFull = $"{ghiChuBase} [PRICE_LOCKED]{priceLockedJson}[/PRICE_LOCKED]";

                var hoaDon = new HoaDon
                {
                    IdhoaDon = newIdHoaDon,
                    IddatPhong = booking.IddatPhong,
                    NgayLap = DateTime.Now,
                    TienPhong = (int)Math.Round(tongTien), // Final price after all discounts and VAT
                    Slngay = request.SoLuongNgay ?? booking.SoDem ?? 1,
                    TongTien = tongTien,
                    TienCoc = request.TienCoc ?? booking.TienCoc,
                    TrangThaiThanhToan = trangThaiThanhToan,
                    TienThanhToan = initialPaid,
                    GhiChu = ghiChuFull
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

                    var ghiChuBase = req.Note ?? "";
                    var priceLockedJson = System.Text.Json.JsonSerializer.Serialize(new
                    {
                        goc = (int)tongTien, // Since price is locked, use final as all components
                        giamKM = 0,
                        giamDiem = 0,
                        cuoi = (int)tongTien,
                        diemDaDung = 0
                    });
                    var ghiChuFull = $"{ghiChuBase} [PRICE_LOCKED]{priceLockedJson}[/PRICE_LOCKED]";

                    var idHoaDon = $"HD{DateTime.Now:yyyyMMddHHmmssfff}";
                    hoaDon = new HoaDon
                    {
                        IdhoaDon = idHoaDon,
                        IddatPhong = booking.IddatPhong,
                        NgayLap = DateTime.Now,
                        TienPhong = (int)Math.Round(tongTien), // Final price after all discounts and VAT
                        Slngay = booking.SoDem ?? 1,
                        TongTien = tongTien,
                        TienCoc = tienCoc,
                        TrangThaiThanhToan = 1,
                        TienThanhToan = 0m,
                        GhiChu = ghiChuFull
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
                        decimal serviceVal = latest.Cthddvs?
                            .Where(c => string.IsNullOrEmpty(c.TrangThai) || c.TrangThai == "Hoạt động" || c.TrangThai == "new")
                            .Where(c => c.IddichVu != "DV_LATE_FEE")
                            .Sum(c => c.TienDichVu ?? 0m) ?? 0m;

                        decimal baseTotal = Math.Round((roomVal + serviceVal) * 1.1m, 0, MidpointRounding.AwayFromZero);

                        bool hasLateNote = !string.IsNullOrEmpty(latest.GhiChu) &&
                            latest.GhiChu.IndexOf("Phí trả phòng muộn", StringComparison.OrdinalIgnoreCase) >= 0;

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

            // ===================== CẬP NHẬT TRẠNG THÁI SANG 4 + CẬP NHẬT PHÒNG =========================
            if (booking != null)
            {
                try
                {
                    // Ensure booking is still tracked in DbContext
                    if (_context.Entry(booking).State == Microsoft.EntityFrameworkCore.EntityState.Detached)
                    {
                        booking = await _context.DatPhongs.FindAsync(booking.IddatPhong);
                    }

                    if (booking != null)
                    {
                        // Nếu trạng thái là 5 (quá hạn) hoặc bất kỳ trạng thái nào khác, luôn chuyển sang 4 (hoàn tất)
                        if (booking.TrangThai != 4)
                        {
                            booking.TrangThai = 4;
                            _logger.LogInformation("[CompleteCheckout] Set TrangThai=4 for booking {Id}", idDatPhong);
                        }

                        if (booking.IdphongNavigation != null)
                        {
                            booking.IdphongNavigation.TrangThai = "Trống";
                        }
                        else if (!string.IsNullOrEmpty(booking.Idphong))
                        {
                            // If navigation not loaded, reload it
                            await _context.Entry(booking).Reference(b => b.IdphongNavigation).LoadAsync();
                            if (booking.IdphongNavigation != null)
                                booking.IdphongNavigation.TrangThai = "Trống";
                        }

                        await _context.SaveChangesAsync();
                        _logger.LogInformation("[CompleteCheckout] Successfully saved TrangThai=4 for booking {Id}", idDatPhong);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "[CompleteCheckout] Failed to update TrangThai for booking {Id}", idDatPhong);
                }
            }
            try
            {
                if (booking != null && booking.HoaDons != null && booking.HoaDons.Any())
                {
                    var latestFix = booking.HoaDons
                        .OrderByDescending(h => h.NgayLap)
                        .FirstOrDefault();

                    if (latestFix != null &&
                        latestFix.TongTien <= 0m &&
                        (latestFix.TienThanhToan ?? 0m) > 0m)
                    {
                        latestFix.TongTien = latestFix.TienThanhToan ?? 0m;

                        if (booking.TongTien <= 0m)
                            booking.TongTien = latestFix.TongTien;

                        await _context.SaveChangesAsync();
                        _logger.LogInformation("[CompleteCheckout] Fixed zero TongTien for invoice {HoaDon} using TienThanhToan={Paid}",
                            latestFix.IdhoaDon, latestFix.TienThanhToan);
                    }
                }
            }
            catch (Exception exFixZero)
            {
                _logger.LogWarning(exFixZero, "[CompleteCheckout] Failed to fix zero TongTien for booking {Id}", idDatPhong);
            }

            // ===================== CỘNG ĐIỂM KHÁCH HÀNG =========================
            if (booking != null)
            {
                try
                {
                    var kh = booking.IdkhachHangNavigation;
                    if (kh != null)
                    {
                        // Cộng điểm: 100.000đ = 1 điểm
                        const decimal EARN_RATE = 100_000m;
                        var pointsToAdd = (int)Math.Floor((double)(booking.TongTien / EARN_RATE));
                        if (pointsToAdd > 0)
                        {
                            kh.TichDiem = (kh.TichDiem ?? 0) + pointsToAdd;
                            _logger.LogInformation("[CompleteCheckout] Cộng {Points} điểm cho khách {CustomerId} (tổng tiền {Amount}đ)",
                                pointsToAdd, kh.IdkhachHang, booking.TongTien);
                            await _context.SaveChangesAsync();
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error awarding loyalty points for booking {Id}", idDatPhong);
                }
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

        /// <summary>
        /// Đọc giá đã chốt từ GhiChu (format: [PRICE_LOCKED]{json}[/PRICE_LOCKED])
        /// Returns: final price nếu tìm thấy, null nếu không
        /// </summary>
        private decimal? TryGetLockedPriceFromNote(string? ghiChu)
        {
            if (string.IsNullOrWhiteSpace(ghiChu)) return null;

            try
            {
                var startTag = "[PRICE_LOCKED]";
                var endTag = "[/PRICE_LOCKED]";
                var startIdx = ghiChu.IndexOf(startTag);
                var endIdx = ghiChu.IndexOf(endTag);

                if (startIdx >= 0 && endIdx > startIdx)
                {
                    var jsonStart = startIdx + startTag.Length;
                    var jsonLength = endIdx - jsonStart;
                    var json = ghiChu.Substring(jsonStart, jsonLength);

                    var data = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(json);
                    if (data != null && data.ContainsKey("cuoi"))
                    {
                        var cuoiValue = data["cuoi"];
                        if (cuoiValue is System.Text.Json.JsonElement element)
                        {
                            if (element.ValueKind == System.Text.Json.JsonValueKind.Number)
                            {
                                return element.GetDecimal();
                            }
                        }
                        else if (decimal.TryParse(cuoiValue?.ToString(), out var price))
                        {
                            return price;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Không thể parse PRICE_LOCKED từ GhiChu");
            }

            return null;
        }

        private async Task RecomputeInvoiceAndBookingTotal(HoaDon hoaDon)
        {
            if (hoaDon == null) return;

            // ===== QUAN TRỌNG: LƯU TongTien HIỆN TẠI TRƯỚC KHI RELOAD =====
            // Khi có gia hạn, TongTien hiện tại đã bao gồm phí gia hạn
            // Ta cần giữ lại giá trị này để không bị mất phí gia hạn
            decimal tongTienTruocKhiReload = hoaDon.TongTien;

            await _context.Entry(hoaDon).Collection(h => h.Cthddvs).LoadAsync();

            var booking = await _context.DatPhongs
                .Include(dp => dp.ChiTietDatPhongs)
                .Include(dp => dp.HoaDons)
                .FirstOrDefaultAsync(dp => dp.IddatPhong == hoaDon.IddatPhong);

            if (booking == null) return;

            // PATCH: Không tính lại/tác động tổng khi booking quá hạn
            if (booking.TrangThai == 5)
            {
                _logger.LogInformation("[RecomputeInvoice] Skip recompute because booking {Id} is overdue (TrangThai=5).", booking.IddatPhong);
                return;
            }

            bool markerGiaHan = !string.IsNullOrEmpty(hoaDon.GhiChu) &&
                               (hoaDon.GhiChu.Contains("Gia hạn", StringComparison.OrdinalIgnoreCase) ||
                                hoaDon.GhiChu.Contains("gia hạn", StringComparison.OrdinalIgnoreCase));
            // ========== ƯU TIÊN DÙNG GIÁ ĐÃ CHỐT TỪ GHICHU ==========
            var lockedPrice = TryGetLockedPriceFromNote(hoaDon.GhiChu);
            if (lockedPrice.HasValue && !markerGiaHan)
            {
                // Nếu có giá đã chốt trong GhiChu, sử dụng phần "cuoi" cho tiền phòng
                // nhưng vẫn phải cộng thêm tiền dịch vụ mới (nếu có). Dịch vụ lưu ở Cthddvs
                _logger.LogInformation("[RecomputeInvoice] Sử dụng giá đã chốt từ GhiChu: {LockedPrice}đ cho hóa đơn {InvoiceId}",
                    lockedPrice.Value, hoaDon.IdhoaDon);

                // Tổng tiền dịch vụ (giá gốc, chưa VAT)
                decimal lockedServiceVal = hoaDon.Cthddvs?
                    .Where(c => string.IsNullOrEmpty(c.TrangThai) || c.TrangThai == "Hoạt động" || c.TrangThai == "new")
                    .Sum(c => c.TienDichVu ?? 0m) ?? 0m;

                // Chuyển dịch vụ sang giá có VAT và cộng vào giá đã chốt (cuối cùng)
                decimal lockedServiceWithVat = Math.Round(lockedServiceVal * 1.1m, 0, MidpointRounding.AwayFromZero);

                // Detect late-fee mentioned in GhiChu and add it WITHOUT VAT
                decimal parsedLateFromNote = 0m;
                try
                {
                    if (!string.IsNullOrEmpty(hoaDon.GhiChu) && hoaDon.GhiChu.IndexOf("Phí trả phòng muộn", StringComparison.OrdinalIgnoreCase) >= 0)
                    {
                        var mLate = System.Text.RegularExpressions.Regex.Match(hoaDon.GhiChu, @"Phí trả phòng muộn[^0-9\n\r]*([0-9\.,]+)\s*đ", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                        if (mLate.Success && mLate.Groups.Count > 1)
                        {
                            var num = mLate.Groups[1].Value;
                            num = num.Replace(".", string.Empty).Replace(",", string.Empty);
                            if (decimal.TryParse(num, out var parsed)) parsedLateFromNote = parsed;
                        }
                    }
                }
                catch { parsedLateFromNote = 0m; }

                decimal finalLockedTotal = lockedPrice.Value + lockedServiceWithVat + (parsedLateFromNote > 0m ? parsedLateFromNote : 0m);
                hoaDon.TongTien = finalLockedTotal;

                // Cập nhật trạng thái thanh toán dựa trên số tiền đã trả (bao gồm tiền cọc)
                decimal depositLocked = booking.TienCoc ?? 0m;
                decimal paidLocked = hoaDon.TienThanhToan ?? 0m;
                decimal totalPaidLocked = depositLocked + paidLocked;

                // Nếu tổng tiền đã trả >= tổng tiền hóa đơn thì coi là đã thanh toán
                if (totalPaidLocked >= finalLockedTotal)
                {
                    hoaDon.TrangThaiThanhToan = 2; // DA_THANH_TOAN
                }
                else
                {
                    hoaDon.TrangThaiThanhToan = 1; // CHUA_THANH_TOAN
                }

                // Cập nhật tổng tiền booking (bao gồm late-fee nếu có)
                decimal totalBookingAmount = booking.HoaDons?.Sum(h => h.TongTien) ?? finalLockedTotal;
                // Guard: only overwrite booking.TongTien if computed total is positive,
                // or if booking currently has no positive total. This avoids accidentally
                // setting a persisted positive total back to 0 on recompute.
                if (totalBookingAmount > 0m || (booking.TongTien <= 0m))
                {
                    booking.TongTien = totalBookingAmount;
                }

                if (hoaDon.TrangThaiThanhToan == 2)
                {
                    bool allPaid = booking.HoaDons?.All(h => h.TrangThaiThanhToan == 2) ?? true;
                    if (allPaid) booking.TrangThaiThanhToan = 2;
                }
                else booking.TrangThaiThanhToan = 1;

                await _context.SaveChangesAsync();
                return; // ✅ KHÔNG TÍNH LẠI GIÁ NỮA (nhưng đã cộng dịch vụ)
            }

            // ========== NẾU KHÔNG CÓ GIÁ CHỐT, MỚI TÍNH LẠI ==========
            _logger.LogInformation("[RecomputeInvoice] Không tìm thấy giá chốt, tính lại từ đầu cho hóa đơn {InvoiceId}", hoaDon.IdhoaDon);

            decimal roomVal = (decimal)(hoaDon.TienPhong ?? 0);
            decimal serviceVal = hoaDon.Cthddvs?
                .Where(c => string.IsNullOrEmpty(c.TrangThai) || c.TrangThai == "Hoạt động" || c.TrangThai == "new")
                .Sum(c => c.TienDichVu ?? 0m) ?? 0m;

            // Tính tổng tiền "cơ bản" theo công thức cũ (tiền phòng + dịch vụ) * 1.1
            decimal tongTienCoBan = Math.Round((roomVal + serviceVal) * 1.1m, 0, MidpointRounding.AwayFromZero);

            // FIX: Chỉ coi là có gia hạn khi GhiChu chứa "Gia hạn" (không dựa vào chênh lệch tiền)
            // Tránh tình trạng auto-cộng tiền gia hạn khi reload
            bool hasExtendFee = markerGiaHan;

            decimal tongTienChuan;
            if (hasExtendFee)
            {
                // ===== LOGIC CHO HÓA ĐƠN CÓ GIA HẠN =====
                tongTienChuan = tongTienTruocKhiReload;

                _logger.LogInformation("[RecomputeInvoiceAndBookingTotal] Hóa đơn có gia hạn - GIỮ NGUYÊN TongTien={TongTien} từ DB (bao gồm phí gia hạn). TongTienCoBan tính lại={CoBan}",
                    tongTienChuan, tongTienCoBan);
            }
            else
            {
                // Không có phí gia hạn, tính bình thường
                tongTienChuan = tongTienCoBan;

                // If ghiChu mentions a late fee, add it here WITHOUT applying VAT.
                try
                {
                    if (!string.IsNullOrEmpty(hoaDon.GhiChu) && hoaDon.GhiChu.IndexOf("Phí trả phòng muộn", StringComparison.OrdinalIgnoreCase) >= 0)
                    {
                        var mLate = System.Text.RegularExpressions.Regex.Match(hoaDon.GhiChu, @"Phí trả phòng muộn[^0-9\n\r]*([0-9\.,]+)\s*đ", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                        if (mLate.Success && mLate.Groups.Count > 1)
                        {
                            var num = mLate.Groups[1].Value;
                            num = num.Replace(".", string.Empty).Replace(",", string.Empty);
                            if (decimal.TryParse(num, out var parsedLate))
                            {
                                // Avoid double-adding: only add if not already present in hoaDon.TongTien
                                if (!hoaDon.TongTien.ToString().Contains(parsedLate.ToString()))
                                {
                                    tongTienChuan += parsedLate;
                                }
                            }
                        }
                    }
                }
                catch { }
            }

            hoaDon.TongTien = tongTienChuan;

            decimal paidCurrent = hoaDon.TienThanhToan ?? 0m;
            decimal depositCurrent = booking.TienCoc ?? 0m;
            decimal totalPaidCurrent = depositCurrent + paidCurrent;

            // Nếu tổng tiền đã trả >= tổng tiền hóa đơn thì coi là đã thanh toán
            if (totalPaidCurrent >= tongTienChuan)
            {
                hoaDon.TrangThaiThanhToan = 2; // DA_THANH_TOAN
            }
            else
            {
                hoaDon.TrangThaiThanhToan = 1; // CHUA_THANH_TOAN
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

            // Khi có gia hạn, KHÔNG ghi đè booking.TongTien vì nó đã bao gồm phí gia hạn
            // AddServiceToInvoice sẽ cộng thêm dịch vụ mới sau
            if (!hasExtendFee)
            {
                // Only update booking.TongTien if bookingTotal is positive or if booking has no existing positive total
                if (bookingTotal > 0m || (booking.TongTien <= 0m))
                {
                    booking.TongTien = bookingTotal;
                }
            }
            else
            {
                _logger.LogInformation("[RecomputeInvoiceAndBookingTotal] Có gia hạn - GIỮ NGUYÊN booking.TongTien={TongTien}", booking.TongTien);
            }

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
                // Use FindAsync + explicit Reference loading to avoid complex SQL generation
                var bookingEntry = await _context.DatPhongs.FindAsync(idDatPhong);
                var booking = bookingEntry;
                if (booking != null)
                {
                    try { await _context.Entry(booking).Reference(b => b.IdkhachHangNavigation).LoadAsync(); } catch { }
                    try { await _context.Entry(booking).Reference(b => b.IdphongNavigation).LoadAsync(); } catch { }
                }

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
        /// <summary>
        /// Unified API for checking available rooms. Handles 3 scenarios:
        /// 1. General availability: GET /api/checkout/available-rooms?checkin=YYYY-MM-DD&checkout=YYYY-MM-DD&guests=1
        /// 2. Extend with extra nights: GET /api/checkout/available-rooms?idDatPhong=XXX&extraNights=2
        /// 3. Full extend info: GET /api/checkout/available-rooms?idDatPhong=XXX&mode=extend
        /// </summary>
        [HttpGet("available-rooms")]
        public async Task<IActionResult> GetAvailableRooms(
            [FromQuery] string? idDatPhong = null,
            [FromQuery] DateTime? checkin = null,
            [FromQuery] DateTime? checkout = null,
            [FromQuery] int guests = 1,
            [FromQuery] string? excludeRoomId = null,
            [FromQuery] int extraNights = 1,
            [FromQuery] string? mode = null)
        {
            // Scenario 1: General availability check (checkin/checkout + guests)
            if (checkin.HasValue && checkout.HasValue && string.IsNullOrWhiteSpace(idDatPhong))
            {
                if (checkin.Value == default || checkout.Value == default || checkout.Value <= checkin.Value)
                    return BadRequest(new { message = "Invalid checkin/checkout dates." });

                var available = await _roomService.CheckAvailableRoomsAsync(checkin.Value, checkout.Value, guests);

                if (!string.IsNullOrWhiteSpace(excludeRoomId))
                {
                    available = available.Where(r => !(r.RoomId == excludeRoomId || r.RoomId?.Equals(excludeRoomId, StringComparison.OrdinalIgnoreCase) == true)).ToList();
                }

                return Ok(new { success = true, checkin = checkin.Value.ToString("yyyy-MM-dd"), checkout = checkout.Value.ToString("yyyy-MM-dd"), guests, availableRooms = available });
            }

            // Scenario 2 & 3: Extend stay (idDatPhong + optional extraNights/mode)
            if (!string.IsNullOrWhiteSpace(idDatPhong))
            {
                var booking = await _context.DatPhongs
                    .Include(b => b.ChiTietDatPhongs)
                        .ThenInclude(ct => ct.Phong)
                            .ThenInclude(p => p.IdloaiPhongNavigation)
                    .Include(b => b.IdkhachHangNavigation)
                    .Include(b => b.HoaDons)
                    .FirstOrDefaultAsync(b => b.IddatPhong == idDatPhong);

                if (booking == null)
                    return NotFound(new { message = "Không tìm thấy đặt phòng." });

                if (booking.TrangThai != 3 && booking.TrangThai != 5)
                    return BadRequest(new { message = "Chỉ có thể gia hạn khi phòng đang sử dụng hoặc quá hạn." });

                // Check if mode=extend: return full extend info + available rooms
                if (mode == "extend" || mode == "full")
                {
                    return await GetExtendWithAvailableRooms(booking, extraNights);
                }

                // Otherwise: mode=minimal or just return available rooms for given extra nights
                var roomId = booking.Idphong;
                var currentCheckout = booking.NgayTraPhong;
                var extendCheckIn = currentCheckout.ToDateTime(TimeOnly.MinValue);
                var extendCheckOut = currentCheckout.AddDays(extraNights).ToDateTime(TimeOnly.MinValue);

                var guestCount = booking.SoNguoi ?? 1;
                var availableRooms = await _roomService.CheckAvailableRoomsAsync(extendCheckIn, extendCheckOut, guestCount);

                // Exclude current room if not room change
                availableRooms = availableRooms.Where(r => r.RoomId != roomId).ToList();

                _logger.LogInformation("[GetAvailableRooms] Found {Count} rooms for extend {ExtraNights} nights from {CheckIn} to {CheckOut}",
                    availableRooms.Count, extraNights, extendCheckIn.ToString("dd/MM/yyyy"), extendCheckOut.ToString("dd/MM/yyyy"));

                return Ok(new
                {
                    success = true,
                    idDatPhong = idDatPhong,
                    extendCheckIn = extendCheckIn.ToString("yyyy-MM-dd"),
                    extendCheckOut = extendCheckOut.ToString("yyyy-MM-dd"),
                    extraNights = extraNights,
                    currentRoomId = roomId,
                    availableRooms = availableRooms.Select(r => new
                    {
                        idphong = r.RoomId,
                        tenPhong = r.RoomName,
                        soPhong = r.RoomNumber,
                        tenLoaiPhong = r.RoomTypeName,
                        giaMotDem = r.BasePricePerNight,
                        urlAnhPhong = r.RoomImageUrl,
                        soNguoiToiDa = r.MaxOccupancy,
                        promotionName = r.PromotionName,
                        discountPercent = r.DiscountPercent,
                        discountedPrice = r.DiscountedPrice
                    })
                });
            }

            return BadRequest(new { message = "Invalid request. Provide either (checkin+checkout) or idDatPhong." });
        }

        /// <summary>
        /// Helper: Get full extend info (same-day options, next booking, etc.) + available rooms for room change
        /// </summary>
        private async Task<IActionResult> GetExtendWithAvailableRooms(DatPhong booking, int extraNights = 1)
        {
            var roomId = booking.Idphong;
            var idDatPhong = booking.IddatPhong;
            var response = new DTOs.CheckExtendAvailabilityResponse();

            // Determine the extend window based on the current booking checkout and requested extra nights
            var extendCheckIn = booking.NgayTraPhong;
            var extendCheckOut = booking.NgayTraPhong.AddDays(Math.Max(1, extraNights));

            // Find the next booking that overlaps with the extend window
            var nextBooking = await _context.DatPhongs
                .Include(b => b.IdkhachHangNavigation)
                .Where(b => b.Idphong == roomId
                    && b.IddatPhong != idDatPhong
                    && b.TrangThai != 0
                    && b.TrangThai != 4
                    // Overlap: booking.NgayNhanPhong < extendCheckOut && booking.NgayTraPhong > extendCheckIn
                    && b.NgayNhanPhong < extendCheckOut
                    && b.NgayTraPhong > extendCheckIn)
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

            // ===== APPLY PROMOTION TO GET DISCOUNTED PRICE =====
            decimal appliedRoomRate = roomRate;
            try
            {
                var today = DateOnly.FromDateTime(DateTime.Now);
                var promotion = await _context.KhuyenMais
                    .Include(km => km.KhuyenMaiPhongs)
                    .Where(km => km.TrangThai == "active" &&
                                 km.NgayBatDau <= today &&
                                 km.NgayKetThuc >= today)
                    .FirstOrDefaultAsync(km => km.KhuyenMaiPhongs.Any(kmp => kmp.Idphong == roomId));

                if (promotion != null)
                {
                    if (promotion.LoaiGiamGia == "percent" && promotion.GiaTriGiam.HasValue)
                    {
                        appliedRoomRate = Math.Round(roomRate * (1 - promotion.GiaTriGiam.Value / 100m));
                    }
                    else if (promotion.LoaiGiamGia == "amount" && promotion.GiaTriGiam.HasValue)
                    {
                        appliedRoomRate = Math.Max(0, roomRate - promotion.GiaTriGiam.Value);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[CheckExtendAvailability] Failed to get promotion for room {RoomId}", roomId);
            }

            response.SameDayOptions = new List<DTOs.ExtendOption>
            {
                new DTOs.ExtendOption
                {
                    Hour = 15,
                    Description = "Đến 15:00",
                    Percentage = 30,
                    Fee = Math.Round(appliedRoomRate * 0.30m),
                    FeeWithVat = Math.Round(appliedRoomRate * 0.30m * 1.10m)
                },
                new DTOs.ExtendOption
                {
                    Hour = 18,
                    Description = "Đến 18:00",
                    Percentage = 50,
                    Fee = Math.Round(appliedRoomRate * 0.50m),
                    FeeWithVat = Math.Round(appliedRoomRate * 0.50m * 1.10m)
                },
                new DTOs.ExtendOption
                {
                    Hour = 24,
                    Description = "Đến 23:59 (cả ngày)",
                    Percentage = 100,
                    Fee = appliedRoomRate,
                    FeeWithVat = Math.Round(appliedRoomRate * 1.10m)
                }
            };

            response.ExtraNightRate = appliedRoomRate;
            response.ExtraNightRateWithVat = Math.Round(appliedRoomRate * 1.10m);

            // Kiểm tra xem đã có gia hạn trong ngày (SameDay) chưa
            // Dựa vào GhiChu của HoaDon chứa "Gia hạn đến" (pattern từ SameDay extend)
            var bookingWithInvoices = await _context.DatPhongs
                .Include(b => b.HoaDons)
                .FirstOrDefaultAsync(b => b.IddatPhong == idDatPhong);

            bool hasSameDayExtended = bookingWithInvoices?.HoaDons?
                .Any(h => !string.IsNullOrEmpty(h.GhiChu) && h.GhiChu.Contains("Gia hạn đến")) ?? false;

            response.HasSameDayExtended = hasSameDayExtended;
            // Trạng thái 3 (đang sử dụng) LUÔN có thể gia hạn
            response.CanExtend = true;

            // ===== LẤY DANH SÁCH PHÒNG TRỐNG CHỈ TỪ BẢNG DatPhong =====
            // Phòng trống = KHÔNG có booking với status 1, 2, 3, 5 (hoạt động/chưa thanh toán/đang sử dụng/quá hạn)
            // Use the extend window (from current checkout to checkout + extraNights)
            var checkinDate = extendCheckIn;
            var checkoutDate = extendCheckOut;

            // Lấy danh sách tất cả phòng từ bảng Phongs
            var allRooms = await _context.Phongs
                .Include(p => p.IdloaiPhongNavigation)
                .ToListAsync();

            // Lấy danh sách phòng đang có booking HOẠT ĐỘNG (status 1, 2, 3, 5) trong khoảng thời gian check
            // Overlap condition: booking.NgayNhanPhong < checkoutDate AND booking.NgayTraPhong > checkinDate
            var bookedRoomIds = await _context.DatPhongs
                .Where(b => (b.TrangThai == 1 || b.TrangThai == 2 || b.TrangThai == 3 || b.TrangThai == 5))
                .Where(b => b.NgayNhanPhong < checkoutDate && b.NgayTraPhong > checkinDate)
                .Select(b => b.Idphong)
                .Distinct()
                .ToListAsync();

            // Phòng trống = phòng KHÔNG nằm trong danh sách phòng có booking hoạt động, và không phải phòng hiện tại
            var availableRooms = allRooms
                .Where(r => !bookedRoomIds.Contains(r.Idphong) && r.Idphong != roomId)
                .Select(async r =>
                {
                    // Lấy thông tin khuyến mãi cho phòng này
                    var today = DateOnly.FromDateTime(DateTime.Now);
                    var promotion = await _context.KhuyenMais
                        .Include(km => km.KhuyenMaiPhongs)
                        .Where(km => km.TrangThai == "active" &&
                                     km.NgayBatDau <= today &&
                                     km.NgayKetThuc >= today)
                        .FirstOrDefaultAsync(km => km.KhuyenMaiPhongs.Any(kmp => kmp.Idphong == r.Idphong));

                    decimal basePrice = r.GiaCoBanMotDem ?? 0;
                    decimal discountedPrice = basePrice;
                    decimal? discountPercent = null;

                    if (promotion != null && promotion.GiaTriGiam.HasValue)
                    {
                        if (promotion.LoaiGiamGia == "percent")
                        {
                            discountPercent = promotion.GiaTriGiam.Value;
                            discountedPrice = Math.Round(basePrice * (1 - promotion.GiaTriGiam.Value / 100m));
                        }
                        else if (promotion.LoaiGiamGia == "amount")
                        {
                            discountedPrice = Math.Max(0, basePrice - promotion.GiaTriGiam.Value);
                            discountPercent = Math.Round((basePrice - discountedPrice) / basePrice * 100m);
                        }
                    }

                    return new DTOs.AvailableRoomForExtend
                    {
                        Idphong = r.Idphong,
                        TenPhong = r.TenPhong,
                        SoPhong = r.SoPhong,
                        TenLoaiPhong = r.IdloaiPhongNavigation?.TenLoaiPhong,
                        GiaMotDem = basePrice,
                        UrlAnhPhong = r.UrlAnhPhong,
                        SoNguoiToiDa = r.SoNguoiToiDa,
                        // Do not infer room availability from Phong.TrangThai here.
                        // Availability is determined solely from DatPhong bookings (server-side),
                        // so we omit returning a hard-coded "Trống" label.
                        PromotionName = promotion?.TenKhuyenMai,
                        DiscountPercent = discountPercent,
                        DiscountedPrice = discountedPrice,
                        Description = r.MoTa
                    };
                })
                .Select(t => t.Result)
                .ToList();

            response.AvailableRooms = availableRooms;

            if (!response.CanExtendSameRoom)
            {
                // Có booking tiếp theo trên phòng này, cần chuyển phòng nếu gia hạn qua đêm
                response.Message = availableRooms.Count > 0
                    ? $"Phòng hiện tại có khách mới check-in ngày {nextBooking?.NgayNhanPhong:dd/MM/yyyy}. Có thể chuyển sang phòng khác để gia hạn."
                    : "Có thể gia hạn trong ngày (late checkout). Nếu gia hạn qua đêm cần liên hệ lễ tân.";
            }
            else
            {
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

            // TRƯỜNG HỢP 1: Đổi phòng - checkout cũ + tạo booking mới + hóa đơn mới
            if (request.IsRoomChange && !string.IsNullOrWhiteSpace(request.NewRoomId))
            {
                return await ExtendWithRoomChange(booking, request);
            }

            // TRƯỜNG HỢP 2: Không đổi phòng - cộng phí vào hóa đơn cũ
            return await ExtendSameRoom(booking, request);
        }

        /// <summary>
        /// Gia hạn KHÔNG đổi phòng - cộng phí gia hạn vào hóa đơn cũ
        /// </summary>
        private async Task<IActionResult> ExtendSameRoom(DatPhong booking, DTOs.ExtendStayRequest request)
        {
            try
            {
                // ===== CHẶN GIA HẠN TRONG NGÀY LẦN 2 =====
                if (request.ExtendType == DTOs.ExtendType.SameDay)
                {
                    bool hasSameDayExtend = booking.HoaDons?
                        .Any(h => !string.IsNullOrEmpty(h.GhiChu) &&
                                  h.GhiChu.Contains("Gia hạn đến")) ?? false;

                    if (hasSameDayExtend)
                    {
                        return BadRequest(new
                        {
                            message = "Đặt phòng này đã được gia hạn trong ngày. " +
                                      "Vui lòng chọn 'Thêm đêm' hoặc liên hệ lễ tân nếu cần thay đổi thêm."
                        });
                    }
                }
                var room = await _context.Phongs
                    .Include(p => p.IdloaiPhongNavigation)
                    .FirstOrDefaultAsync(p => p.Idphong == booking.Idphong);

                decimal roomRate = room?.GiaCoBanMotDem ?? 0;
                var oldCheckout = booking.NgayTraPhong;

                // ===== CHECK PROMOTIONS FIRST (để tính giá sau khuyến mãi trước) =====
                decimal appliedRoomRate = roomRate;
                var promotion = await _context.KhuyenMais
                    .Include(km => km.KhuyenMaiPhongs)
                    .Where(km => km.TrangThai == "active" &&
                                 km.NgayBatDau <= DateOnly.FromDateTime(DateTime.Now) &&
                                 km.NgayKetThuc >= DateOnly.FromDateTime(DateTime.Now))
                    .FirstOrDefaultAsync(km => km.KhuyenMaiPhongs.Any(kmp => kmp.Idphong == booking.Idphong));

                string? promotionName = null;
                if (promotion != null)
                {
                    promotionName = promotion.TenKhuyenMai;
                    if (promotion.LoaiGiamGia == "percent" && promotion.GiaTriGiam.HasValue)
                    {
                        // Tính giá SAU khuyến mãi
                        appliedRoomRate = Math.Round(roomRate * (1 - promotion.GiaTriGiam.Value / 100m));
                    }
                    else if (promotion.LoaiGiamGia == "amount" && promotion.GiaTriGiam.HasValue)
                    {
                        // Tính giá SAU khuyến mãi (trừ số tiền cố định)
                        appliedRoomRate = Math.Max(0, roomRate - promotion.GiaTriGiam.Value);
                    }
                }

                // If frontend provided an explicit current room rate (after discount), prefer it.
                // This ensures frontend-calculated discounted prices are honored for invoice/QR.
                if (request.CurrentRoomRate.HasValue && request.CurrentRoomRate.Value > 0m)
                {
                    _logger.LogInformation("[ExtendSameRoom] Frontend provided CurrentRoomRate={Rate}, overriding server computed appliedRoomRate.", request.CurrentRoomRate.Value);
                    appliedRoomRate = request.CurrentRoomRate.Value;
                }

                // Tính phí gia hạn (dựa trên giá AFTER discount)
                DateOnly newCheckoutDate;
                decimal extendFee = 0;
                string extendDescription = "";
                decimal discountAmount = 0m;

                if (request.ExtendType == DTOs.ExtendType.SameDay)
                {
                    newCheckoutDate = booking.NgayTraPhong;

                    int hour = request.NewCheckoutHour ?? 15;
                    decimal percentage = 0m;
                    switch (hour)
                    {
                        case 15:
                            percentage = 0.30m;
                            extendFee = Math.Round(appliedRoomRate * 0.30m);
                            extendDescription = "Gia hạn đến 15:00 (30%)";
                            break;
                        case 18:
                            percentage = 0.50m;
                            extendFee = Math.Round(appliedRoomRate * 0.50m);
                            extendDescription = "Gia hạn đến 18:00 (50%)";
                            break;
                        default:
                            percentage = 1m;
                            extendFee = appliedRoomRate;
                            extendDescription = "Gia hạn đến 23:59 (100%)";
                            break;
                    }
                    // Tính discount amount: (giá gốc × %) - (giá sau khuyến mãi × %)
                    decimal baseExtendFee = Math.Round(roomRate * percentage);
                    discountAmount = baseExtendFee - extendFee;
                }
                else
                {
                    int nights = Math.Max(1, request.ExtraNights);
                    newCheckoutDate = booking.NgayTraPhong.AddDays(nights);
                    extendFee = appliedRoomRate * nights;
                    extendDescription = $"Gia hạn thêm {nights} đêm";
                    // Tính discount amount: (giá gốc × nights) - (giá sau khuyến mãi × nights)
                    decimal baseExtendFee = roomRate * nights;
                    discountAmount = baseExtendFee - extendFee;
                }

                decimal vatAmount = Math.Round(extendFee * 0.10m);
                decimal totalExtendFee = extendFee + vatAmount;

                // Cập nhật ngày checkout
                booking.NgayTraPhong = newCheckoutDate;
                booking.TrangThai = 3;

                // Ensure the physical room remains in 'Đang sử dụng' when we extend
                // without changing room. This prevents the room record from being
                // accidentally marked as 'Trống' by other flows.
                // Nếu là gia hạn thêm đêm, cập nhật số đêm của booking và chi tiết đặt phòng tương ứng
                if (request.ExtendType == DTOs.ExtendType.ExtraNight)
                {
                    int nightsToAdd = Math.Max(1, request.ExtraNights);
                    try
                    {
                        booking.SoDem = (booking.SoDem ?? 0) + nightsToAdd;

                        // Cập nhật lại các ChiTietDatPhongs: tăng SoDem và tính lại ThanhTien = GiaPhong * SoDem
                        if (booking.ChiTietDatPhongs != null)
                        {
                            foreach (var ct in booking.ChiTietDatPhongs)
                            {
                                if (ct == null) continue;
                                // ChiTietDatPhong.SoDem is non-nullable int
                                ct.SoDem = ct.SoDem + nightsToAdd;
                                decimal gia = ct.GiaPhong;
                                ct.ThanhTien = gia * ct.SoDem;
                                _context.ChiTietDatPhongs.Update(ct);
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to update SoDem/ChiTietDatPhongs when extending extra nights for booking {BookingId}", booking.IddatPhong);
                    }
                }

                // Tìm hóa đơn hiện tại của booking (không phải hóa đơn phí trả phòng muộn)
                var hoaDon = booking.HoaDons?
                    .Where(h => h.GhiChu == null || !h.GhiChu.Contains("phí trả phòng muộn"))
                    .OrderByDescending(h => h.NgayLap)
                    .FirstOrDefault();

                bool isNewInvoice = false;
                if (hoaDon == null)
                {
                    // Tạo hóa đơn mới nếu chưa có
                    isNewInvoice = true;

                    // PaymentMethod: 1 = Tiền mặt (đã TT), 2 = Online/QR (chờ QR), 3 = Thanh toán sau (chưa TT)
                    decimal tienThanhToan = 0m;
                    int trangThaiTT = 1; // Mặc định: Chưa thanh toán

                    if (request.PaymentMethod == 1)
                    {
                        // Tiền mặt: Đã thanh toán ngay
                        tienThanhToan = totalExtendFee;
                        trangThaiTT = 2; // Đã thanh toán
                    }
                    else if (request.PaymentMethod == 2)
                    {
                        // Online/QR: Chờ quét QR
                        tienThanhToan = 0m;
                        trangThaiTT = 1; // Chưa thanh toán (chờ QR)
                    }
                    else if (request.PaymentMethod == 3)
                    {
                        // Thanh toán sau: Chưa thanh toán, đợi checkout
                        tienThanhToan = 0m;
                        trangThaiTT = 1; // Chưa thanh toán
                    }

                    hoaDon = new HoaDon
                    {
                        IdhoaDon = $"HD{DateTime.Now:yyyyMMddHHmmssfff}",
                        IddatPhong = booking.IddatPhong,
                        NgayLap = DateTime.Now,
                        TongTien = totalExtendFee,
                        TienThanhToan = tienThanhToan,
                        TrangThaiThanhToan = trangThaiTT,
                        GhiChu = $"{extendDescription}. {(request.PaymentMethod == 3 ? "[Thanh toán sau]" : "")} {request.Note ?? ""}".Trim()
                    };
                    _context.HoaDons.Add(hoaDon);

                    // Cập nhật tổng tiền của booking (cộng phí gia hạn vào booking.TongTien) - LUÔN LUÔN cộng dù thanh toán hay chưa
                    booking.TongTien = booking.TongTien + totalExtendFee;
                    // Cập nhật TrangThaiThanhToan của booking theo phương thức thanh toán
                    booking.TrangThaiThanhToan = trangThaiTT;

                    // Save hóa đơn và booking trước để có IdhoaDon
                    await _context.SaveChangesAsync();
                }
                else
                {
                    // Cộng phí gia hạn vào hóa đơn cũ - LUÔN cộng vào TongTien dù thanh toán ngay hay sau
                    hoaDon.TongTien = hoaDon.TongTien + totalExtendFee;

                    // PaymentMethod: 1 = Tiền mặt (đã TT), 2 = Online/QR (đã TT), 3 = Thanh toán sau (chưa TT)
                    // Also treat existing invoices that already contain the pay-later marker in GhiChu as pay-later.
                    bool isPayLaterInvoice = request.PaymentMethod == 3 || (!string.IsNullOrEmpty(hoaDon.GhiChu) && hoaDon.GhiChu.Contains("[Thanh toán sau]"));
                    if (isPayLaterInvoice)
                    {
                        // Thanh toán sau: KHÔNG cộng vào TienThanhToan và đặt TrangThaiThanhToan = 1
                        hoaDon.TrangThaiThanhToan = 1;
                        booking.TrangThaiThanhToan = 1;
                    }
                    else
                    {
                        // Tiền mặt (1) hoặc QR (2): Cộng vào TienThanhToan và đặt TrangThaiThanhToan = 2
                        hoaDon.TienThanhToan = (hoaDon.TienThanhToan ?? 0m) + totalExtendFee;
                        hoaDon.TrangThaiThanhToan = 2;
                        booking.TrangThaiThanhToan = 2;
                    }

                    // Thêm ghi chú về gia hạn
                    var existingNote = hoaDon.GhiChu ?? "";
                    var payLaterNote = request.PaymentMethod == 3 ? " [Thanh toán sau]" : "";
                    hoaDon.GhiChu = string.IsNullOrEmpty(existingNote)
                        ? $"{extendDescription}{payLaterNote}"
                        : $"{existingNote}; {extendDescription}{payLaterNote}";

                    // Cập nhật tổng tiền của booking tương ứng để giữ nhất quán - LUÔN cộng dù thanh toán hay chưa
                    try
                    {
                        booking.TongTien = booking.TongTien + totalExtendFee;
                    }
                    catch { }

                    await _context.SaveChangesAsync();
                    try
                    {
                        hoaDon = await _context.HoaDons
                            .Include(h => h.Cthddvs)
                            .FirstOrDefaultAsync(h => h.IdhoaDon == hoaDon.IdhoaDon) ?? hoaDon;
                    }
                    catch { /* ignore reload errors */ }
                }

                // PHÍ GIA HẠN KHÔNG PHẢI DỊCH VỤ - KHÔNG LƯU VÀO CTHDDV
                _logger.LogInformation("[ExtendSameRoom] Phí gia hạn {Fee} đã cộng vào TongTien (không lưu CTHDDV). HoaDon={HoaDonId}, Booking={BookingId}",
                    totalExtendFee, hoaDon.IdhoaDon, booking.IddatPhong);

                // ========== QUAN TRỌNG: Force set TrangThaiThanhToan theo PaymentMethod HOẶC marker SAU khi reload ==========
                if (request.PaymentMethod == 3 || (!string.IsNullOrEmpty(hoaDon.GhiChu) && hoaDon.GhiChu.Contains("[Thanh toán sau]")))
                {
                    hoaDon.TrangThaiThanhToan = 1;
                    booking.TrangThaiThanhToan = 1;
                    await _context.SaveChangesAsync();
                    _logger.LogInformation("[ExtendSameRoom] Detected pay-later (request or marker) -> Forced TrangThaiThanhToan=1 for HoaDon {HoaDonId} and Booking {BookingId}", hoaDon.IdhoaDon, booking.IddatPhong);
                }

                // Nếu sau khi gia hạn còn tồn tiền dịch vụ chưa thanh toán trên toàn bộ booking
                // thì bắt buộc đặt trạng thái thanh toán về 1 (Chưa TT) cho cả hóa đơn và booking,
                // dù phương thức thanh toán cho lần gia hạn có là tiền mặt/QR hay không.
                try
                {
                    await _context.Entry(booking).Collection(b => b.HoaDons).LoadAsync();
                    decimal totalInvoices = booking.HoaDons?.Sum(h => h.TongTien) ?? 0m;
                    decimal totalPaidAll = booking.HoaDons?.Sum(h => h.TienThanhToan ?? 0m) ?? 0m;
                    decimal remainingAll = Math.Max(0m, totalInvoices - totalPaidAll);

                    if (remainingAll > 0m)
                    {
                        hoaDon.TrangThaiThanhToan = 1;
                        booking.TrangThaiThanhToan = 1;
                        await _context.SaveChangesAsync();
                        _logger.LogInformation("[ExtendSameRoom] Booking {BookingId} has unpaid amount {Remaining} after extend -> forced TrangThaiThanhToan=1 for HoaDon {HoaDonId}", booking.IddatPhong, remainingAll, hoaDon.IdhoaDon);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[ExtendSameRoom] Failed to evaluate unpaid remaining after extend for booking {BookingId}", booking.IddatPhong);
                }

                string? qrUrl = null;
                if (request.PaymentMethod == 2)
                {
                    qrUrl = GenerateQrUrl(totalExtendFee, hoaDon.IdhoaDon, $"Gia hạn {booking.IddatPhong}");
                }

                // Nếu là QR online, lưu url QR vào GhiChu để frontend có thể hiển thị trực tiếp
                if (!string.IsNullOrEmpty(qrUrl))
                {
                    try
                    {
                        var existingNote = hoaDon.GhiChu ?? string.Empty;
                        // Append QR url marker to ghi chú (frontend will parse/display it)
                        hoaDon.GhiChu = string.IsNullOrEmpty(existingNote)
                            ? $"[QR_URL]{qrUrl}"
                            : existingNote + $"; [QR_URL]{qrUrl}";
                        await _context.SaveChangesAsync();
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "[ExtendSameRoom] Failed to append QR url into GhiChu for HoaDon {HoaDonId}", hoaDon.IdhoaDon);
                    }
                }
                bool isPaidNow = request.PaymentMethod == 1; // Chỉ tiền mặt là đã thanh toán ngay
                string paymentStatus = request.PaymentMethod == 1 ? "Đã thanh toán"
                                     : request.PaymentMethod == 2 ? "Chờ thanh toán QR"
                                     : "Thanh toán sau (khi checkout)";

                // Calculate discount percent for display (if promotion exists)
                decimal? discountPercent = null;
                if (promotion != null && promotion.LoaiGiamGia == "percent" && promotion.GiaTriGiam.HasValue)
                {
                    discountPercent = promotion.GiaTriGiam.Value;
                }

                var responseObj = new
                {
                    Success = true,
                    Message = $"Gia hạn thành công. {paymentStatus}",
                    IddatPhong = booking.IddatPhong,
                    ExtendFee = extendFee,
                    ExtendFeeBeforeDiscount = extendFee + discountAmount,
                    DiscountAmount = discountAmount,
                    PromotionName = promotionName,
                    PromotionType = promotion?.LoaiGiamGia,
                    PromotionValue = promotion?.GiaTriGiam,
                    DiscountPercent = discountPercent,
                    BasePricePerNight = roomRate,  // Giá gốc để frontend tính phí gốc
                    VatAmount = vatAmount,
                    TotalExtendFee = totalExtendFee,
                    OldCheckout = oldCheckout,
                    NewCheckout = newCheckoutDate,
                    HoaDonId = hoaDon.IdhoaDon,
                    QrUrl = qrUrl,
                    ExtendDescription = extendDescription,
                    IsRoomChange = false,
                    PaymentMethod = request.PaymentMethod,
                    IsPaidNow = isPaidNow,
                    PaymentStatus = paymentStatus,
                    TongTienHoaDonMoi = hoaDon.TongTien,
                    TongTienBooking = booking.TongTien,
                    BookingTrangThaiThanhToan = booking.TrangThaiThanhToan,
                    HoaDon = new
                    {
                        IdhoaDon = hoaDon.IdhoaDon,
                        TongTien = hoaDon.TongTien,
                        TienThanhToan = hoaDon.TienThanhToan,
                        TrangThaiThanhToan = hoaDon.TrangThaiThanhToan,
                        GhiChu = hoaDon.GhiChu,
                        Cthddvs = hoaDon.Cthddvs?.Select(c => new { c.IdhoaDon, c.IddichVu, c.TienDichVu, c.ThoiGianThucHien, c.TrangThai })
                    }
                };

                _logger.LogInformation($"Extended stay (same room) for booking {booking.IddatPhong}: {extendDescription}, Fee: {totalExtendFee}");

                return Ok(responseObj);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ExtendSameRoom failed for {BookingId}", booking.IddatPhong);
                return StatusCode(500, new
                {
                    message = "Lỗi khi gia hạn phòng",
                    error = ex.Message,
                    inner = ex.InnerException?.Message,
                    stack = ex.StackTrace?.Substring(0, Math.Min(500, ex.StackTrace?.Length ?? 0))
                });
            }
        }

        /// <summary>
        /// Gia hạn CÓ đổi phòng - checkout booking cũ + tạo booking mới + hóa đơn mới
        /// </summary>
        private async Task<IActionResult> ExtendWithRoomChange(DatPhong oldBooking, DTOs.ExtendStayRequest request)
        {
            // 1. Lấy thông tin phòng mới
            var newRoom = await _context.Phongs
                .Include(p => p.IdloaiPhongNavigation)
                .FirstOrDefaultAsync(p => p.Idphong == request.NewRoomId);

            if (newRoom == null)
                return BadRequest(new { message = "Phòng mới không tồn tại." });

           

            var oldRoom = await _context.Phongs.FindAsync(oldBooking.Idphong);
            var oldCheckout = oldBooking.NgayTraPhong;
            decimal newRoomRate = newRoom.GiaCoBanMotDem ?? 0;
            
            // Check active promotions for the new room and compute applied rate
            decimal appliedRoomRate = newRoomRate;
            KhuyenMaiPhong? promoKmp = null;
            try
            {
                var today = DateOnly.FromDateTime(DateTime.Now);
                promoKmp = await _context.KhuyenMaiPhongs
                    .Include(kmp => kmp.IdkhuyenMaiNavigation)
                    .Where(kmp => kmp.Idphong == newRoom.Idphong && kmp.IsActive &&
                                  kmp.IdkhuyenMaiNavigation.TrangThai == "active" &&
                                  kmp.IdkhuyenMaiNavigation.NgayBatDau <= today &&
                                  kmp.IdkhuyenMaiNavigation.NgayKetThuc >= today)
                    .OrderByDescending(kmp => kmp.IdkhuyenMaiNavigation.GiaTriGiam)
                    .FirstOrDefaultAsync();

                if (promoKmp != null)
                {
                    var promo = promoKmp.IdkhuyenMaiNavigation;
                    if (!string.IsNullOrEmpty(promo.LoaiGiamGia) && promo.GiaTriGiam.HasValue)
                    {
                        if (promo.LoaiGiamGia.Equals("percent", StringComparison.OrdinalIgnoreCase))
                        {
                            appliedRoomRate = Math.Round(newRoomRate * (1 - promo.GiaTriGiam.Value / 100m));
                        }
                        else if (promo.LoaiGiamGia.Equals("fixed", StringComparison.OrdinalIgnoreCase))
                        {
                            appliedRoomRate = Math.Max(0, newRoomRate - promo.GiaTriGiam.Value);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[ExtendWithRoomChange] Failed to evaluate promotion for room {RoomId}", newRoom.Idphong);
            }

            // If frontend provided an explicit room price (e.g. discounted price), prefer it.
            // This ensures the QR/invoice will use the same discounted amount the frontend calculated.
            if (request.NewRoomInfo != null && request.NewRoomInfo.GiaMotDem > 0m)
            {
                _logger.LogInformation("[ExtendWithRoomChange] Overriding appliedRoomRate with NewRoomInfo.GiaMotDem from request: {Price}", request.NewRoomInfo.GiaMotDem);
                appliedRoomRate = request.NewRoomInfo.GiaMotDem;
            }

            // 2. Tính phí gia hạn theo giá phòng MỚI
            DateOnly newCheckoutDate;
            decimal extendFee = 0;
            string extendDescription = "";

            if (request.ExtendType == DTOs.ExtendType.SameDay)
            {
                newCheckoutDate = DateOnly.FromDateTime(DateTime.Today);

                int hour = request.NewCheckoutHour ?? 15;
                switch (hour)
                {
                    case 15:
                        extendFee = Math.Round(appliedRoomRate * 0.30m);
                        extendDescription = $"Gia hạn đến 15:00 (30%) - {newRoom.TenPhong}";
                        break;
                    case 18:
                        extendFee = Math.Round(appliedRoomRate * 0.50m);
                        extendDescription = $"Gia hạn đến 18:00 (50%) - {newRoom.TenPhong}";
                        break;
                    default:
                        extendFee = appliedRoomRate;
                        extendDescription = $"Gia hạn đến 23:59 (100%) - {newRoom.TenPhong}";
                        break;
                }
            }
            else
            {
                int nights = Math.Max(1, request.ExtraNights);
                newCheckoutDate = DateOnly.FromDateTime(DateTime.Today.AddDays(nights));
                extendFee = appliedRoomRate * nights;
                extendDescription = $"Gia hạn thêm {nights} đêm - {newRoom.TenPhong}";
            }

            // Tính discount amount: (giá gốc × %) - extendFee (đã tính từ giá after discount)
            decimal discountAmountExtendFee = 0m;
            string? promotionNameExtendFee = null;
            KhuyenMai? promoForExtendFee = null;
            if (promoKmp != null)
            {
                promoForExtendFee = promoKmp.IdkhuyenMaiNavigation;
                promotionNameExtendFee = promoForExtendFee.TenKhuyenMai;
                
                if (request.ExtendType == DTOs.ExtendType.SameDay)
                {
                    int hour = request.NewCheckoutHour ?? 15;
                    decimal percentage = hour == 15 ? 0.30m : (hour == 18 ? 0.50m : 1m);
                    decimal baseFeeBeforeDiscount = Math.Round(newRoomRate * percentage);
                    discountAmountExtendFee = Math.Round(baseFeeBeforeDiscount - extendFee);
                }
                else
                {
                    int nights = Math.Max(1, request.ExtraNights);
                    decimal baseFeeBeforeDiscount = newRoomRate * nights;
                    discountAmountExtendFee = Math.Round(baseFeeBeforeDiscount - extendFee);
                }
            }

            decimal vatAmount = Math.Round(extendFee * 0.10m);
            decimal totalExtendFee = extendFee + vatAmount;

            // 3. Hoàn tất booking cũ (checkout)
            // Trước khi hoàn tất booking cũ, kiểm tra xem booking cũ đã thanh toán đầy đủ hay chưa.
            // Nếu còn tiền chưa thanh toán trên booking cũ, trả về thông tin để FE hiển thị form thanh toán
            try
            {
                decimal totalOldInvoices = oldBooking.HoaDons?.Sum(h => h.TongTien) ?? 0m;
                decimal totalOldPaid = oldBooking.HoaDons?.Sum(h => h.TienThanhToan ?? 0m) ?? 0m;
                decimal remainingOld = Math.Max(0m, totalOldInvoices - totalOldPaid);

                if (remainingOld > 0m)
                {
                    // Lấy hóa đơn gần nhất để FE có thể mở form thanh toán tương ứng
                    var latestOldInvoice = oldBooking.HoaDons?.OrderByDescending(h => h.NgayLap).FirstOrDefault();
                    return BadRequest(new
                    {
                        message = "Booking cũ còn tiền chưa thanh toán. Vui lòng thanh toán trước khi đổi phòng/gia hạn.",
                        requirePaymentBeforeExtend = true,
                        remaining = remainingOld,
                        oldInvoiceId = latestOldInvoice?.IdhoaDon
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[ExtendWithRoomChange] Failed to evaluate old booking payment status for {OldBookingId}", oldBooking.IddatPhong);
            }

            // 3. HOÀN TẤT BOOKING CŨ (checkout phòng cũ trước)
            oldBooking.TrangThai = 4; // Đã hoàn tất
            oldBooking.NgayTraPhong = DateOnly.FromDateTime(DateTime.Today);

            // Cập nhật trạng thái phòng cũ -> Trống
            if (oldRoom != null)
            {
                oldRoom.TrangThai = "Trống";
            }

            _logger.LogInformation("[ExtendWithRoomChange] Hoàn tất booking cũ {OldBookingId}, phòng {OldRoom} -> Trống",
                oldBooking.IddatPhong, oldRoom?.TenPhong);

            // 4. Tạo booking MỚI cho phòng mới
            var newBookingId = $"DP{DateTime.Now:yyyyMMddHHmmssfff}";
            int newBookingNights = request.ExtendType == DTOs.ExtendType.ExtraNight ? Math.Max(1, request.ExtraNights) : 1;

            var newBooking = new DatPhong
            {
                IddatPhong = newBookingId,
                IdkhachHang = oldBooking.IdkhachHang,
                Idphong = request.NewRoomId,
                NgayDatPhong = DateOnly.FromDateTime(DateTime.Now),
                NgayNhanPhong = DateOnly.FromDateTime(DateTime.Today),
                NgayTraPhong = newCheckoutDate,
                SoNguoi = oldBooking.SoNguoi,
                SoDem = newBookingNights,
                TrangThai = 3, // Đang sử dụng
                TrangThaiThanhToan = request.PaymentMethod == 1 ? 2 : 1,
                TienCoc = 0, // Booking gia hạn không cần cọc
            };
            _context.DatPhongs.Add(newBooking);

            // 5. Tạo chi tiết đặt phòng mới
            // GiaPhong = extendFee (phí gia hạn theo khung giờ, CHƯA VAT)
            // ThanhTien = extendFee (không cộng dồn từ booking cũ)
            var newChiTiet = new ChiTietDatPhong
            {
                IDDatPhong = newBookingId,
                IDPhong = request.NewRoomId,
                SoDem = newBookingNights,
                GiaPhong = extendFee,      // Phí gia hạn (chưa VAT), không phải giá 1 đêm cơ bản
                ThanhTien = extendFee,     // Thành tiền = phí gia hạn (chưa VAT)
                GhiChu = $"Gia hạn đổi phòng từ booking {oldBooking.IddatPhong}"
            };
            _context.ChiTietDatPhongs.Add(newChiTiet);

            // 6. Cập nhật trạng thái phòng mới -> Đang sử dụng
            newRoom.TrangThai = "Đang sử dụng";

            _logger.LogInformation("[ExtendWithRoomChange] Tạo booking mới {NewBookingId}, phòng {NewRoom} -> Đang sử dụng",
                newBookingId, newRoom.TenPhong);

            // 7. Tạo hóa đơn MỚI cho gia hạn (riêng biệt với hóa đơn cũ)
            var newInvoiceId = $"HD{DateTime.Now:yyyyMMddHHmmssfff}";
            var newInvoice = new HoaDon
            {
                IdhoaDon = newInvoiceId,
                IddatPhong = newBookingId,
                NgayLap = DateTime.Now,
                TongTien = totalExtendFee,
                TienThanhToan = request.PaymentMethod == 1 ? totalExtendFee : 0,
                TrangThaiThanhToan = request.PaymentMethod == 1 ? 2 : 1,
                GhiChu = $"[Đổi phòng] {extendDescription} (từ {oldRoom?.TenPhong})"
            };
            _context.HoaDons.Add(newInvoice);

            // 8. Cập nhật tổng tiền booking mới
            newBooking.TongTien = totalExtendFee;

            // 9. KHÔNG lưu gia hạn như dịch vụ nữa (không thêm CTHDDV)
            _logger.LogInformation("[ExtendWithRoomChange] Phí gia hạn {Fee} đã cộng vào TongTien (không lưu CTHDDV). HoaDon={HoaDonId}, NewBooking={BookingId}",
                totalExtendFee, newInvoiceId, newBookingId);

            await _context.SaveChangesAsync();

            string? qrUrl = null;
            if (request.PaymentMethod == 2)
            {
                qrUrl = GenerateQrUrl(totalExtendFee, newInvoiceId, $"Gia hạn {newBookingId}");
            }

            // Lấy mã hóa đơn cũ để reference
            var oldInvoice = oldBooking.HoaDons?.OrderByDescending(h => h.NgayLap).FirstOrDefault();

            // Nếu là QR online, lưu url QR vào GhiChu của hóa đơn mới để frontend có thể hiển thị trực tiếp
            if (!string.IsNullOrEmpty(qrUrl))
            {
                try
                {
                    var existingNoteNew = newInvoice.GhiChu ?? string.Empty;
                    newInvoice.GhiChu = string.IsNullOrEmpty(existingNoteNew)
                        ? $"[QR_URL]{qrUrl}"
                        : existingNoteNew + $"; [QR_URL]{qrUrl}";
                    await _context.SaveChangesAsync();
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[ExtendWithRoomChange] Failed to append QR url into GhiChu for NewInvoice {InvoiceId}", newInvoiceId);
                }
            }

            var response = new DTOs.ExtendStayResponse
            {
                Success = true,
                Message = "Đổi phòng và gia hạn thành công",
                IddatPhong = newBookingId,
                ExtendFee = extendFee,
                ExtendFeeBeforeDiscount = extendFee + discountAmountExtendFee,
                DiscountAmount = discountAmountExtendFee,
                PromotionName = promotionNameExtendFee,
                PromotionType = promoForExtendFee?.LoaiGiamGia,
                PromotionValue = promoForExtendFee?.GiaTriGiam,
                VatAmount = vatAmount,
                TotalExtendFee = totalExtendFee,
                OldCheckout = oldCheckout,
                NewCheckout = newCheckoutDate,
                HoaDonId = newInvoiceId,
                NewRoomId = request.NewRoomId,
                NewRoomName = newRoom.TenPhong,
                QrUrl = qrUrl,
                ExtendDescription = extendDescription,
                IsRoomChange = true,
                NewBookingId = newBookingId,
                NewInvoiceId = newInvoiceId,
                OldInvoiceId = oldInvoice?.IdhoaDon
            };

            _logger.LogInformation($"Extended stay with room change: Old booking {oldBooking.IddatPhong} -> New booking {newBookingId}, Room: {newRoom.TenPhong}, Fee: {totalExtendFee}");

            return Ok(response);
        }

        // ===================== CONFIRM PAID (QR / MANUAL PAYMENT) =========================
        [HttpPost("confirm-paid/{idDatPhong}")]
        public async Task<IActionResult> ConfirmPaid(string idDatPhong, [FromBody] ConfirmPaidRequest request)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(idDatPhong))
                    return BadRequest(new { message = "Mã đặt phòng không hợp lệ." });

                // Find the booking
                var booking = await _context.DatPhongs
                    .Include(dp => dp.HoaDons)
                    .FirstOrDefaultAsync(dp => dp.IddatPhong == idDatPhong);

                if (booking == null)
                    return NotFound(new { message = "Không tìm thấy đặt phòng." });

                // Find the invoice if HoaDonId provided, otherwise use the latest one
                HoaDon hoaDon = null;
                if (!string.IsNullOrWhiteSpace(request.HoaDonId))
                {
                    hoaDon = await _context.HoaDons
                        .FirstOrDefaultAsync(h => h.IdhoaDon == request.HoaDonId && h.IddatPhong == idDatPhong);
                }
                else
                {
                    // Get the latest invoice for this booking
                    hoaDon = booking.HoaDons?
                        .OrderByDescending(h => h.NgayLap)
                        .FirstOrDefault();
                }

                if (hoaDon == null)
                    return NotFound(new { message = "Không tìm thấy hóa đơn." });

                // Update payment amount if provided
                if (request.Amount.HasValue && request.Amount.Value > 0)
                {
                    hoaDon.TienThanhToan = (hoaDon.TienThanhToan ?? 0m) + Math.Round(request.Amount.Value, 0, MidpointRounding.AwayFromZero);
                }

                // If it's an online payment (IsOnline = true) with an Amount, mark invoice as paid
                // ALWAYS set TrangThaiThanhToan = 2 when IsOnline = true (QR payment)
                if (request.IsOnline == true && request.Amount.HasValue && request.Amount.Value > 0)
                {
                    hoaDon.TrangThaiThanhToan = 2; // 2 = Đã thanh toán / Paid (QR)
                }

                // Append note if provided
                if (!string.IsNullOrWhiteSpace(request.Note))
                {
                    hoaDon.GhiChu = (hoaDon.GhiChu ?? string.Empty) + 
                        (string.IsNullOrEmpty(hoaDon.GhiChu) ? "" : "; ") + 
                        $"[Xác nhận thanh toán] {request.Note}";
                }

                // Save changes
                _context.HoaDons.Update(hoaDon);
                await _context.SaveChangesAsync();

                // Recompute invoice and booking totals/status so booking.TrangThaiThanhToan
                // is synced when invoice is marked paid (especially for online payments).
                try
                {
                    await RecomputeInvoiceAndBookingTotal(hoaDon);

                    // Also ensure booking-level status reflects paid if any invoice is fully paid
                    var refreshedBooking = await _context.DatPhongs
                        .Include(dp => dp.HoaDons)
                        .FirstOrDefaultAsync(dp => dp.IddatPhong == idDatPhong);
                    if (refreshedBooking != null)
                    {
                        bool anyPaid = refreshedBooking.HoaDons?.Any(h => h.TrangThaiThanhToan == 2) ?? false;
                        if (anyPaid)
                        {
                            refreshedBooking.TrangThaiThanhToan = 2;
                            _context.DatPhongs.Update(refreshedBooking);
                            await _context.SaveChangesAsync();
                        }
                    }
                }
                catch (Exception exRecompute)
                {
                    _logger.LogWarning(exRecompute, "[ConfirmPaid] RecomputeInvoiceAndBookingTotal failed for {BookingId}: {Message}", idDatPhong, exRecompute.Message);
                }

                _logger.LogInformation(
                    "[ConfirmPaid] Confirmed payment for booking {BookingId}, Invoice {InvoiceId}, Amount: {Amount}, IsOnline: {IsOnline}, TrangThaiThanhToan: {Status}",
                    idDatPhong, hoaDon.IdhoaDon, request.Amount ?? 0, request.IsOnline ?? false, hoaDon.TrangThaiThanhToan);

                return Ok(new
                {
                    Success = true,
                    Message = "Xác nhận thanh toán thành công",
                    HoaDonId = hoaDon.IdhoaDon,
                    TienThanhToan = hoaDon.TienThanhToan,
                    TongTien = hoaDon.TongTien,
                    TrangThaiThanhToan = hoaDon.TrangThaiThanhToan
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[ConfirmPaid] Error for booking {BookingId}: {Message}", idDatPhong, ex.Message);
                return StatusCode(500, new
                {
                    message = "Lỗi khi xác nhận thanh toán",
                    error = ex.Message
                });
            }
        }

        private async Task<List<DTOs.AvailableRoomForExtend>> FindAvailableRoomsForExtend(DateTime checkin, DateTime checkout, int guests, string? excludeRoomId)
        {
            // Use RoomService as the single source of truth for availability logic.
            var available = await _roomService.CheckAvailableRoomsAsync(checkin, checkout, guests);

            if (!string.IsNullOrWhiteSpace(excludeRoomId))
            {
                available = available.Where(r => !(r.RoomId == excludeRoomId || r.RoomId?.Equals(excludeRoomId, StringComparison.OrdinalIgnoreCase) == true)).ToList();
            }

            // Map to controller DTO type expected by callers
            var mapped = available.Select(r => new DTOs.AvailableRoomForExtend
            {
                Idphong = r.RoomId,
                TenPhong = r.RoomName,
                SoPhong = r.RoomNumber,
                TenLoaiPhong = r.RoomTypeName,
                GiaMotDem = r.BasePricePerNight,
                UrlAnhPhong = r.RoomImageUrl ?? r.RoomImageUrl,
                SoNguoiToiDa = r.MaxOccupancy,
                PromotionName = r.PromotionName,
                DiscountPercent = r.DiscountPercent,
                DiscountedPrice = r.DiscountedPrice,
                Description = r.Description
            }).ToList();

            _logger.LogInformation("[FindAvailableRoomsForExtend] Tìm thấy {Count} phòng trống từ {Checkin} đến {Checkout}", mapped.Count, DateOnly.FromDateTime(checkin), DateOnly.FromDateTime(checkout));

            return mapped;
        }

        private string GenerateQrUrl(decimal amount, string invoiceId, string description)
        {
            var bankCode = "MB";
            var accountNo = "0988909999";
            var accountName = "ROBINS VILLA";
            var amountStr = ((long)amount).ToString();
            var message = $"{description.Replace(" ", "")}_{invoiceId}";
            
            _logger.LogInformation("[GenerateQrUrl] Generated QR with amount: {Amount} VND (decimal={DecimalAmount}, invoiceId={InvoiceId}, description={Description})", 
                amountStr, amount, invoiceId, description);

            return $"https://img.vietqr.io/image/{bankCode}-{accountNo}-compact2.png?amount={amountStr}&addInfo={Uri.EscapeDataString(message)}&accountName={Uri.EscapeDataString(accountName)}";
        }

        // Helper method to extract PRICE_LOCKED JSON from GhiChu
        private string ExtractPriceLockedJson(string ghiChu)
        {
            if (string.IsNullOrEmpty(ghiChu))
                return null;

            const string startTag = "[PRICE_LOCKED]";
            const string endTag = "[/PRICE_LOCKED]";

            var startIndex = ghiChu.IndexOf(startTag);
            if (startIndex == -1)
                return null;

            startIndex += startTag.Length;
            var endIndex = ghiChu.IndexOf(endTag, startIndex);
            if (endIndex == -1)
                return null;

            return ghiChu.Substring(startIndex, endIndex - startIndex).Trim();
        }

        // ===================== FORCE CANCEL (HỦY LƯU TRÚ DO QUÁ HẠN) =========================
        [HttpPost("huy-qua-han")]
        public async Task<IActionResult> ForceCancel([FromBody] ForceCancelRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.BookingId))
                return BadRequest(new { message = "BookingId là bắt buộc" });

            try
            {
                var booking = await _context.DatPhongs
                    .Include(b => b.IdkhachHangNavigation)
                    .Include(b => b.HoaDons)
                    .Include(b => b.IdphongNavigation)
                    .FirstOrDefaultAsync(b => b.IddatPhong == request.BookingId);

                if (booking == null)
                    return NotFound(new { message = "Không tìm thấy đặt phòng" });

                // Update booking status to 0 (cancelled)
                booking.TrangThai = 0;

                // Update room status back to available
                if (booking.IdphongNavigation != null)
                {
                    booking.IdphongNavigation.TrangThai = "Trống";
                }
                else if (!string.IsNullOrEmpty(booking.Idphong))
                {
                    var room = await _context.Phongs.FirstOrDefaultAsync(p => p.Idphong == booking.Idphong);
                    if (room != null)
                        room.TrangThai = "Trống";
                }

                // Add note to latest invoice if exists
                var latestInvoice = booking.HoaDons?.OrderByDescending(h => h.NgayLap).FirstOrDefault();
                if (latestInvoice != null)
                {
                    var cancelNote = $"[FORCE_CANCEL] Lý do: {request.Reason} | Ngày hủy: {DateTime.Now:yyyy-MM-dd HH:mm:ss}";
                    if (!string.IsNullOrEmpty(request.Notes))
                        cancelNote += $" | Ghi chú: {request.Notes}";

                    if (string.IsNullOrEmpty(latestInvoice.GhiChu))
                        latestInvoice.GhiChu = cancelNote;
                    else
                        latestInvoice.GhiChu += "\n" + cancelNote;
                }

                await _context.SaveChangesAsync();

                // Send email notification to customer
                var email = booking.IdkhachHangNavigation?.Email;
                var hoTen = booking.IdkhachHangNavigation?.HoTen;

                if (!string.IsNullOrEmpty(email))
                {
                    try
                    {
                        await SendForceCancelEmail(email, hoTen, request);
                    }
                    catch (Exception exEmail)
                    {
                        _logger.LogWarning(exEmail, "[ForceCancel] Failed to send email for booking {BookingId}", request.BookingId);
                    }
                }

                _logger.LogInformation("[ForceCancel] Booking {BookingId} đã bị hủy lưu trú. Lý do: {Reason}. Xử lý tiền cọc: {DepositHandling}",
                    request.BookingId, request.Reason, request.DepositHandling);

                return Ok(new { message = "Hủy lưu trú thành công. Email thông báo đã gửi cho khách." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[ForceCancel] Error for booking {BookingId}: {Message}", request.BookingId, ex.Message);
                return StatusCode(500, new { message = "Lỗi khi hủy lưu trú: " + ex.Message });
            }
        }

        // Helper to send force cancel email
        private async Task SendForceCancelEmail(string email, string? hoTen, ForceCancelRequest request)
        {
            try
            {
                var subject = "Robins Villa – Hủy lưu trú do quá hạn trả phòng";

                var reasonText = request.Reason switch
                {
                    "no_checkout" => "Khách không trả phòng đúng giờ",
                    "no_response" => "Không phản hồi sau khi liên hệ",
                    "force_process" => "Xử lý cưỡng chế theo quy trình",
                    _ => "Lý do khác"
                };

                var body = $@"
Kính gửi anh/chị {hoTen ?? "khách hàng"},

Đến 12:00 ngày {DateTime.Now:dd/MM/yyyy}, khách sạn đã nhiều lần liên hệ nhưng không nhận được phản hồi từ anh/chị để thực hiện thủ tục trả phòng.

Theo quy định vận hành, chúng tôi đã ghi nhận lý do: <b>{reasonText}</b>

Chúng tôi đã tiến hành hủy lưu trú cho đặt phòng của anh/chị.

Các chi phí phát sinh (nếu có) sẽ được khấu trừ vào tiền cọc hoặc cập nhật vào công nợ của anh/chị theo chính sách của khách sạn.

Nếu có bất kỳ thắc mắc nào, vui lòng liên hệ hotline 1900-xxxx.

Trân trọng,
Robins Villa
";

                await SafeSendEmailAsync(email, hoTen, subject, body);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[SendForceCancelEmail] Failed to send email to {Email}", email);
                throw;
            }
        }
    }
}