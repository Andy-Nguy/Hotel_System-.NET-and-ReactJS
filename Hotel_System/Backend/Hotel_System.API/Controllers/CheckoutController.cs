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

            // ========== LẤY GIÁ ĐÃ CHỐT TỪ DatPhong.TongTien (single source of truth) ==========
            // Sử dụng DatPhong.TongTien thay vì HoaDon.TongTien để đảm bảo consistency
            decimal tongTienDaChot = booking.TongTien;

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

            // FIX: Kiểm tra xem booking đã có gia hạn chưa (GhiChu chứa "Gia hạn")
            // Và parse thời gian gia hạn để xác định đúng thời điểm checkout
            bool hasExtendMarker = booking.HoaDons?.Any(h => 
                !string.IsNullOrEmpty(h.GhiChu) && 
                h.GhiChu.IndexOf("Gia hạn", StringComparison.OrdinalIgnoreCase) >= 0) ?? false;

            DateTime effectiveCheckout = standardCheckout;
            if (hasExtendMarker)
            {
                // Tìm hóa đơn có gia hạn và parse thời gian gia hạn
                var extendInvoice = booking.HoaDons?
                    .Where(h => !string.IsNullOrEmpty(h.GhiChu) && 
                               h.GhiChu.IndexOf("Gia hạn", StringComparison.OrdinalIgnoreCase) >= 0)
                    .OrderByDescending(h => h.NgayLap)
                    .FirstOrDefault();

                if (extendInvoice != null && !string.IsNullOrEmpty(extendInvoice.GhiChu))
                {
                    // Parse thời gian gia hạn từ GhiChu, ví dụ: "Gia hạn đến 15:00" hoặc "Gia hạn đến 2025-12-05 15:00"
                    var ghiChu = extendInvoice.GhiChu;
                    var match = System.Text.RegularExpressions.Regex.Match(ghiChu, @"(\d{4}-\d{2}-\d{2}\s+)?(\d{1,2}:\d{2})");
                    if (match.Success)
                    {
                        var timeStr = match.Groups[2].Value;
                        if (TimeOnly.TryParse(timeStr, out var extendTime))
                        {
                            // Nếu có ngày cụ thể thì dùng ngày đó, không thì dùng NgayTraPhong
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

            // Kiểm tra xem có qua giờ checkout không (có tính gia hạn)
            bool isPastCheckoutTime = DateTime.Now > effectiveCheckout;

            // Tự động cập nhật trạng thái sang 5 (Quá hạn) nếu đã qua thời điểm checkout
            // nhưng KHÔNG tự động áp phí muộn trong lần gọi GetSummary này.
            bool autoMarkedOverdue = false;
            if (isPastCheckoutTime && booking.TrangThai != 5)
            {
                try
                {
                    booking.TrangThai = 5;
                    await _context.SaveChangesAsync();
                    autoMarkedOverdue = true;
                    _logger.LogInformation("[GetSummary] Auto-set TrangThai=5 for booking {Id} because past effective checkout {Time}", booking.IddatPhong, effectiveCheckout);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[GetSummary] Failed to auto-set TrangThai for booking {Id}", booking.IddatPhong);
                }
            }

            // ✅ Coi là QUÁ HẠN nếu booking.TrangThai == 5
            bool isOverdueBooking = (booking.TrangThai == 5);

            // 2. DỊCH VỤ PHÁT SINH (từ tất cả hóa đơn)
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
            decimal tongTien = tongTienDaChot; // Mặc định = giá đã chốt

            // Pre-declare totals so overdue branch can reference them
            decimal serviceTotal = 0m;
            decimal roomTotal = 0m;
            decimal subTotalBase = 0m;
            decimal vatBase = 0m;
            bool invoicesChanged = false;

            if (isOverdueBooking)
            {
                // Tính phí trả phòng muộn dựa trên giá đã chốt
                var actualCheckout = DateTime.Now;
                var diff = actualCheckout - standardCheckout;

                // Nếu booking vừa được auto-mark overdue trong lần gọi này thì KHÔNG áp phí muộn ngay.
                if (autoMarkedOverdue)
                {
                    // Tính giá 1 đêm từ TongTien đã chốt (đã bao gồm giảm giá)
                    int nights = booking.SoDem ?? 1;
                    decimal oneNightPrice = nights > 0
                        ? Math.Round(tongTienDaChot / nights, 0, MidpointRounding.AwayFromZero)
                        : Math.Round(tongTienDaChot, 0, MidpointRounding.AwayFromZero);

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

                // Tổng = Giá đã chốt + Phí trả muộn
                tongTien = tongTienDaChot + lateFee;

                _logger.LogInformation("[GetSummary] Booking {Id} - TongTien = {LockedPrice} (giá đã chốt) + {LateFee} (phạt) = {Total}",
                    booking.IddatPhong, tongTienDaChot, lateFee, tongTien);

                // Cập nhật booking + hóa đơn chính
                try
                {
                    if (autoMarkedOverdue)
                    {
                        // If we just auto-marked overdue in this call, don't apply surcharge yet.
                        if (booking.TongTien <= 0)
                        {
                            booking.TongTien = tongTienDaChot;
                        }
                        lateFee = 0m;
                        _logger.LogInformation("[GetSummary] Booking {Id} was auto-marked overdue; skipping fee calculation on this pass.", booking.IddatPhong);
                    }
                    else
                    {
                        // FIX: Nếu booking đã có gia hạn → giữ nguyên tổng tiền đã lưu, KHÔNG tính phí muộn
                        if (hasExtendMarker && booking.TongTien > tongTienDaChot)
                        {
                            tongTien = booking.TongTien;
                            _logger.LogInformation("[GetSummary] Booking {Id} đã gia hạn - GIỮ NGUYÊN TongTien={TongTien} (không tính phí muộn)", booking.IddatPhong, tongTien);
                        }
                        else
                        {
                            // Không có gia hạn → tính phí trả phòng muộn như bình thường
                            var actualCheckout2 = DateTime.Now;
                            var diff2 = actualCheckout2 - standardCheckout;

                            if (diff2 > TimeSpan.Zero || booking.TrangThai == 5)
                            {
                                int nights = booking.SoDem ?? 1;
                                decimal oneNightPrice = nights > 0
                                    ? Math.Round(roomTotal / nights, 0, MidpointRounding.AwayFromZero)
                                    : Math.Round(roomTotal, 0, MidpointRounding.AwayFromZero);

                                decimal surchargePercent = 0m;
                                if (diff2.TotalHours < 0)
                                    surchargePercent = 1.00m;
                                else if (diff2 <= TimeSpan.FromHours(3))
                                    surchargePercent = 0.30m;
                                else if (diff2 <= TimeSpan.FromHours(6))
                                    surchargePercent = 0.50m;
                                else
                                    surchargePercent = 1.00m;

                                lateFee = surchargePercent >= 1.0m
                                    ? oneNightPrice
                                    : Math.Round(oneNightPrice * surchargePercent, 0, MidpointRounding.AwayFromZero);

                                _logger.LogInformation("[GetSummary] Booking {Id} - Calculated late fee (no VAT): {LateFee}đ ({Percent}%)", booking.IddatPhong, lateFee, surchargePercent * 100);
                            }

                            decimal subTotal = roomTotal + serviceTotal;
                            decimal vat = Math.Round(subTotal * 0.1m, 0, MidpointRounding.AwayFromZero);
                            tongTien = subTotal + vat + lateFee;

                            _logger.LogInformation("[GetSummary] Booking {Id} - TongTien = ({Room} + {Service}) * 1.1 + {LateFee} = {Total}", booking.IddatPhong, roomTotal, serviceTotal, lateFee, tongTien);

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
                                if (lateFee > 0 && (string.IsNullOrEmpty(latestInvoiceForOverdue.GhiChu) || !latestInvoiceForOverdue.GhiChu.Contains("Phí trả phòng muộn")))
                                {
                                    latestInvoiceForOverdue.GhiChu = (latestInvoiceForOverdue.GhiChu ?? string.Empty) + $"\nPhí trả phòng muộn (không VAT): {lateFee:N0}đ";
                                }
                            }
                            await _context.SaveChangesAsync();
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Không thể cập nhật TongTien trong GetSummary cho booking quá hạn {Id}", booking.IddatPhong);
                }
            }
            else
            {
                // ===== BOOKING THƯỜNG (KHÔNG QUÁ HẠN) =====
                // FIX: Chỉ giữ booking.TongTien nếu có hóa đơn chứa "Gia hạn" trong GhiChu
                // Không dựa vào chênh lệch tiền để tránh auto-cộng tiền gia hạn khi reload

                if (hasExtendMarker && booking.TongTien > tongTienDaChot)
                {
                    // Có marker gia hạn → giữ nguyên tổng tiền đã lưu
                    tongTien = booking.TongTien;
                }
                else
                {
                    // Không có gia hạn → dùng tổng cơ bản và sync lại DB nếu lệch
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

            // 5. TÍNH TOÁN CHO HIỂN THỊ (không dùng để cập nhật TongTien)
            // Tính serviceTotal từ tất cả hóa đơn
            serviceTotal = booking.HoaDons?
                .SelectMany(h => h.Cthddvs?
                    .Where(c => string.IsNullOrEmpty(c.TrangThai) || c.TrangThai == "Hoạt động" || c.TrangThai == "new")
                    .Select(c => c.TienDichVu ?? 0m) ?? new List<decimal>())
                .Sum() ?? 0m;

            // Thử lấy breakdown từ PRICE_LOCKED JSON trong GhiChu
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
                            // Lấy giá gốc phòng từ PRICE_LOCKED
                            if (priceData.TryGetValue("goc", out var gocValue))
                            {
                                roomTotal = Convert.ToDecimal(gocValue);
                                // KHÔNG đụng vào các hóa đơn đã cộng phí GIA HẠN (GhiChu chứa "Gia hạn")
                                if (!string.IsNullOrEmpty(latestInvoice?.GhiChu) && latestInvoice.GhiChu.IndexOf("Gia hạn", StringComparison.OrdinalIgnoreCase) >= 0)
                                {
                                    // If latest invoice itself has extend marker, skip price-locked adjustments
                                }

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

                                // FIX: Nếu hóa đơn có GhiChu chứa "Gia hạn", đã skip ở trên rồi
                                // Không dựa vào chênh lệch tiền để tránh auto-cộng tiền gia hạn
                                if (latestInvoice != null && latestInvoice.TongTien != invoiceTotalComputed)
                                {
                                    latestInvoice.TongTien = invoiceTotalComputed;
                                    
                                    invoicesChanged = true;
                                }
                            }
                            // Áp dụng giảm giá KM
                            if (priceData.TryGetValue("giamKM", out var giamKmValue))
                            {
                                roomTotal -= Convert.ToDecimal(giamKmValue);
                            }
                            // Áp dụng giảm điểm
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

            // Nếu không có PRICE_LOCKED, tính ngược từ TongTien
            if (roomTotal == 0m)
            {
                subTotalBase = Math.Round(tongTienDaChot / 1.1m, 0, MidpointRounding.AwayFromZero);
                vatBase = tongTienDaChot - subTotalBase;
                roomTotal = subTotalBase - serviceTotal;
            }

            // 6. CỌC & ĐÃ THANH TOÁN
            decimal deposit = booking.TienCoc ?? 0m;
            decimal paidAmount = booking.HoaDons?.Sum(h => h.TienThanhToan ?? 0m) ?? 0m;

            // 7. CÒN PHẢI THU
            decimal remaining = Math.Max(0m, tongTien - paidAmount);

            // FIX: Chỉ tính phí gia hạn nếu có marker "Gia hạn" trong hóa đơn
            decimal extendFeeOut = 0m;
            bool hasExtendMarkerForFee = booking.HoaDons?.Any(h => 
                !string.IsNullOrEmpty(h.GhiChu) && 
                h.GhiChu.IndexOf("Gia hạn", StringComparison.OrdinalIgnoreCase) >= 0) ?? false;
            
            if (hasExtendMarkerForFee)
            {
                decimal baseTotalForExtend = subTotalBase + vatBase;
                extendFeeOut = Math.Max(0m, tongTien - baseTotalForExtend - lateFee);
            }

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
                        TrangThaiThanhToan = h.TrangThaiThanhToan,
                        GhiChu = h.GhiChu // MOD: trả thêm ghi chú
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
                    extendFee = extendFeeOut, // MOD: trả thêm phí gia hạn
                    isPastCheckoutTime // FIX: cho FE biết đã qua giờ checkout chưa
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

                foreach (var item in req.DichVu)
                {
                    var lineTotal = item.TongTien ?? item.TienDichVu ?? item.DonGia ?? 0m;
                    
                    // Handle combo services
                    string? dichVuId = null;
                    string? comboId = null;
                    
                    if (item.IddichVu.StartsWith("combo:"))
                    {
                        comboId = item.IddichVu.Substring(6); // Remove "combo:" prefix
                        
                        // Validate combo exists
                        var comboExists = await _context.KhuyenMaiCombos
                            .AnyAsync(kmc => kmc.IdkhuyenMaiCombo == comboId);
                        if (!comboExists)
                        {
                            _logger.LogError("Combo {ComboId} not found in database", comboId);
                            return BadRequest(new { message = $"Combo {comboId} không tồn tại." });
                        }
                        
                        // For combo: only set IdkhuyenMaiCombo, leave IddichVu as null
                        dichVuId = null;
                    }
                    else
                    {
                        // For regular service: only set IddichVu, leave IdkhuyenMaiCombo as null
                        dichVuId = item.IddichVu;
                        comboId = null;
                    }
                    
                    var serviceDetail = new Cthddv
                    {
                        IdhoaDon = hoaDon.IdhoaDon,
                        IddichVu = dichVuId,
                        IdkhuyenMaiCombo = comboId,
                        TienDichVu = Math.Round(lineTotal),
                        IdkhuyenMai = null,
                        ThoiGianThucHien = DateTime.Now,
                        TrangThai = "Hoạt động"
                    };
                    
                    _logger.LogInformation("Adding service to invoice: IddichVu={DichVuId}, IdkhuyenMaiCombo={ComboId}, Amount={Amount}", 
                        dichVuId, comboId, lineTotal);
                    
                    _context.Cthddvs.Add(serviceDetail);
                }

                try
                {
                    await _context.SaveChangesAsync();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error saving service additions to invoice {InvoiceId}", hoaDon.IdhoaDon);
                    throw;
                }

                // ========== KHÔNG TÍNH LẠI GIÁ PHÒNG - CHỈ CỘNG THÊM TIỀN DỊCH VỤ ==========
                // Lấy tổng tiền dịch vụ mới thêm
                decimal newServiceTotal = req.DichVu.Sum(item => item.TongTien ?? item.TienDichVu ?? item.DonGia ?? 0m);
                newServiceTotal = Math.Round(newServiceTotal, 0, MidpointRounding.AwayFromZero);

                // Cộng thêm vào TongTien của hóa đơn
                hoaDon.TongTien = hoaDon.TongTien + newServiceTotal;

                // Cộng thêm vào TongTien của đặt phòng
                if (booking != null)
                {
                    booking.TongTien += newServiceTotal;
                }

                await _context.SaveChangesAsync();

                // Cập nhật trạng thái thanh toán nếu cần
                decimal daTra = hoaDon.TienThanhToan ?? 0m;
                decimal conLai = hoaDon.TongTien - daTra;
                if (conLai <= 1000m && hoaDon.TongTien > 0)
                {
                    hoaDon.TrangThaiThanhToan = 2; // Đã thanh toán đủ
                }
                else if (daTra > 0)
                {
                    hoaDon.TrangThaiThanhToan = 1; // Còn thiếu
                }

                await _context.SaveChangesAsync();
                await RecomputeInvoiceAndBookingTotal(hoaDon);
                // 🔧 BỔ SUNG: Nếu hóa đơn có phí gia hạn ("Gia hạn" trong GhiChu) thì
                bool hasExtendFee = !string.IsNullOrEmpty(hoaDon.GhiChu) &&
                                    hoaDon.GhiChu.IndexOf("Gia hạn", StringComparison.OrdinalIgnoreCase) >= 0;

                if (hasExtendFee && req.DichVu != null && req.DichVu.Any())
                {
                    decimal newServiceBase = req.DichVu.Sum(d =>
                        Math.Round(d.TongTien ?? d.TienDichVu ?? d.DonGia ?? 0m, 0, MidpointRounding.AwayFromZero));

                    decimal newServiceWithVat = Math.Round(newServiceBase * 1.1m, 0, MidpointRounding.AwayFromZero);

                    // Cộng thêm vào hoá đơn
                    hoaDon.TongTien += newServiceWithVat;

                    // Đồng thời cộng luôn vào tổng tiền booking
                    if (hoaDon.IddatPhongNavigation != null)
                    {
                        hoaDon.IddatPhongNavigation.TongTien += newServiceWithVat;
                    }
                }

                if (booking != null)
                {
                    // Nếu KHÔNG truyền PaidOnline / PaidAmount thì chắc chắn vừa phát sinh thêm tiền chưa thu
                    // => bắt buộc đưa về trạng thái "Chưa thanh toán" (1)
                    bool hasImmediatePayment =
                        (req.PaidOnline == true) ||
                        (req.PaidAmount.HasValue && req.PaidAmount.Value > 0m);

                    if (!hasImmediatePayment)
                    {
                        hoaDon.TrangThaiThanhToan = 1;
                        booking.TrangThaiThanhToan = 1;
                    }
                    else
                    {
                        // Giữ logic cũ cho trường hợp vừa thêm dịch vụ vừa thu thêm tiền
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

                // Reconcile totals: ensure newly added CTHDDV lines are included in the invoice total
                // Especially important if downstream recompute logic or locked-price rules overwrote the manual addition.
                if (!hasExtendFee)
                {
                    // Recalculate from persisted CTHDDV rows to guarantee consistency
                    var invoiceServiceSum = await _context.Cthddvs
                        .Where(c => c.IdhoaDon == hoaDon.IdhoaDon && (string.IsNullOrEmpty(c.TrangThai) || c.TrangThai == "Hoạt động" || c.TrangThai == "new"))
                        .SumAsync(c => c.TienDichVu ?? 0m);

                    decimal invoiceRoomVal = hoaDon.TienPhong ?? 0m;
                    decimal recomputedTotal = Math.Round((invoiceRoomVal + invoiceServiceSum) * 1.1m, 0, MidpointRounding.AwayFromZero);

                    hoaDon.TongTien = recomputedTotal;

                    // Sync booking total to sum of invoices
                    if (hoaDon.IddatPhongNavigation != null && hoaDon.IddatPhongNavigation.HoaDons != null)
                    {
                        hoaDon.IddatPhongNavigation.TongTien = hoaDon.IddatPhongNavigation.HoaDons.Sum(h => h.TongTien);
                    }
                }

                if (!hasExternalTransaction && transaction != null)
                {
                    await transaction.CommitAsync();
                }

                // --- Ensure snapshot is updated for this invoice immediately
                // Prefer a per-invoice upsert helper for efficiency.
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
                    .Include(dp => dp.IdkhachHangNavigation)
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
                    // Lấy giá phòng đã chốt (bao gồm giảm giá từ khuyến mãi và điểm)
                    // KHÔNG tính lại từ ChiTietDatPhongs
                    decimal lockedRoomPrice = TryGetLockedPriceFromNote(targetInvoice.GhiChu) ?? targetInvoice.TongTien;
                    
                    // Nếu có dịch vụ, trừ đi tiền dịch vụ để lấy tiền phòng thuần
                    decimal serviceTotal = targetInvoice.Cthddvs?
                        .Where(c => string.IsNullOrEmpty(c.TrangThai) || c.TrangThai == "Hoạt động" || c.TrangThai == "new")
                        .Sum(c => c.TienDichVu ?? 0m) ?? 0m;
                    
                    decimal roomPriceAfterDiscount = lockedRoomPrice - serviceTotal;
                    if (roomPriceAfterDiscount < 0) roomPriceAfterDiscount = 0;

                    await _context.Entry(booking).Collection(b => b.ChiTietDatPhongs).LoadAsync();
                    var roomLines = booking.ChiTietDatPhongs;
                    decimal baseRoomTotal = roomLines?.Sum(ct => ct.ThanhTien) ?? 0m;
                    int nights = booking.SoDem ?? 1;
                    decimal oneNightPrice = nights > 0 
                        ? Math.Round(roomPriceAfterDiscount / nights, 0, MidpointRounding.AwayFromZero)
                        : roomPriceAfterDiscount;

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

                    decimal serviceVal = targetInvoice.Cthddvs?
                        .Where(c => string.IsNullOrEmpty(c.TrangThai) || c.TrangThai == "Hoạt động" || c.TrangThai == "new")
                        .Where(c => c.IddichVu != "DV_LATE_FEE")
                        .Sum(c => c.TienDichVu ?? 0m) ?? 0m;

                    // Tổng = tiền phòng đã giảm + dịch vụ + VAT + lateFee
                    decimal subTotal = roomPriceAfterDiscount + serviceVal;
                    decimal vat = Math.Round(subTotal * 0.1m, 0, MidpointRounding.AwayFromZero);
                    decimal grandTotal = subTotal + vat + lateFeeAmount;

                    _logger.LogInformation("[ConfirmPaid] Booking {Id} - TongTien = {RoomAfterDiscount} (phòng đã giảm) + {Service} (dịch vụ) * 1.1 + {LateFee} (phạt) = {Total}",
                        booking.IddatPhong, roomPriceAfterDiscount, serviceVal, lateFeeAmount, grandTotal);

                    targetInvoice.TongTien = grandTotal;
                    targetInvoice.TienThanhToan = grandTotal;
                    booking.TongTien = grandTotal;

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

                // ----------------- QUY ĐỔI ĐIỂM -----------------
                // Cộng điểm: 100.000đ = 1 điểm
                // Dùng điểm: 1 điểm = 100đ giảm giá
                const decimal EARN_RATE = 100_000m;      // 100.000đ thanh toán = 1 điểm
                const decimal REDEEM_RATE = 100m;        // 1 điểm = 100đ giảm
                const decimal MAX_REDEEM_PERCENT = 0.5m; // Tối đa dùng 50% giá trị hóa đơn
                
                int pointsToUse = req?.PointsToUse ?? 0;
                int customerCurrentPoints = booking.IdkhachHangNavigation?.TichDiem ?? 0;

                decimal pointsDiscount = 0m;
                if (pointsToUse > 0)
                {
                    if (pointsToUse > customerCurrentPoints)
                        return BadRequest(new { message = $"Không đủ điểm. Hiện có {customerCurrentPoints} điểm." });

                    // Tính số điểm tối đa có thể dùng (50% giá trị hóa đơn)
                    decimal maxDiscountAmount = finalTotal * MAX_REDEEM_PERCENT;
                    int maxPointsByAmount = (int)Math.Floor(maxDiscountAmount / REDEEM_RATE);
                    
                    if (pointsToUse > maxPointsByAmount)
                        return BadRequest(new { message = $"Chỉ được dùng tối đa {maxPointsByAmount} điểm (50% giá trị hóa đơn)." });

                    pointsDiscount = pointsToUse * REDEEM_RATE;
                    finalTotal = Math.Max(0m, finalTotal - pointsDiscount);

                    targetInvoice.DiemSuDung = pointsToUse;
                    if (string.IsNullOrWhiteSpace(targetInvoice.GhiChu) || !targetInvoice.GhiChu.Contains("[USE_POINT]"))
                    {
                        targetInvoice.GhiChu = (targetInvoice.GhiChu ?? string.Empty) + $" [USE_POINT] Dùng {pointsToUse} điểm giảm {pointsDiscount:N0}đ";
                    }
                }
                // -----------------------------------------------------------------------------

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

                    // MOD: Chỉ nối thêm Note, không ghi đè GhiChu (giữ “Gia hạn ...”)
                    if (!string.IsNullOrWhiteSpace(req?.Note))
                    {
                        targetInvoice.GhiChu = string.IsNullOrEmpty(targetInvoice.GhiChu)
                            ? req.Note
                            : $"{targetInvoice.GhiChu}\n{req.Note}";
                    }

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

                    // Nếu đã thanh toán hoàn tất (online), xử lý điểm tích lũy
                    if (targetInvoice.TrangThaiThanhToan == 2)
                    {
                        // 1. Trừ điểm đã dùng
                        if (pointsToUse > 0 && (booking.IdkhachHangNavigation?.TichDiem ?? 0) >= pointsToUse)
                        {
                            booking.IdkhachHangNavigation.TichDiem = (booking.IdkhachHangNavigation.TichDiem ?? 0) - pointsToUse;
                            _logger.LogInformation("[ConfirmPaid-Online] Trừ {Points} điểm từ khách {CustomerId}", pointsToUse, booking.IdkhachHang);
                        }

                        // 2. Cộng điểm mới theo số tiền thực trả (100.000đ = 1 điểm)
                        int pointsToAddOnline = (int)Math.Floor((double)(finalTotal / EARN_RATE));
                        if (pointsToAddOnline > 0 && booking.IdkhachHangNavigation != null)
                        {
                            booking.IdkhachHangNavigation.TichDiem = (booking.IdkhachHangNavigation.TichDiem ?? 0) + pointsToAddOnline;
                            _logger.LogInformation("[ConfirmPaid-Online] Cộng {Points} điểm mới cho khách {CustomerId} (thanh toán {Amount}đ)", 
                                pointsToAddOnline, booking.IdkhachHang, finalTotal);
                        }

                        // 3. Cập nhật ghi chú hóa đơn
                        if (!string.IsNullOrWhiteSpace(targetInvoice.GhiChu) && targetInvoice.GhiChu.Contains("[USE_POINT]"))
                        {
                            targetInvoice.GhiChu = targetInvoice.GhiChu.Replace("[USE_POINT]", "[POINT_USED]");
                        }
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
                bool isPayLaterInvoice = !string.IsNullOrEmpty(targetInvoice.GhiChu) && targetInvoice.GhiChu.Contains("[Thanh toán sau]");

                if (isPayLaterInvoice && (amountReq <= 0m))
                {
                    targetInvoice.TrangThaiThanhToan = 1;
                    targetInvoice.TienThanhToan = currentPaid;
                    targetInvoice.TongTien = finalTotal;
                    booking.TongTien = finalTotal;
                    if (booking.TrangThaiThanhToan == 2) booking.TrangThaiThanhToan = 1;
                }
                else if (amountReq <= 0 || (currentPaid + amountReq) >= (finalTotal - 5000m))
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

                // MOD: Chỉ nối thêm Note, không ghi đè GhiChu (giữ “Gia hạn ...”)
                if (!string.IsNullOrWhiteSpace(req?.Note))
                {
                    targetInvoice.GhiChu = string.IsNullOrEmpty(targetInvoice.GhiChu)
                        ? req.Note
                        : $"{targetInvoice.GhiChu}\n{req.Note}";
                }

                if (targetInvoice.TrangThaiThanhToan == 2)
                {
                    booking.TrangThaiThanhToan = 2;
                }

                _logger.LogInformation("[ConfirmPaid-Cash] BEFORE SaveChanges - Booking {Id}: HoaDon.TongTien={HoaDonTotal}, HoaDon.TienThanhToan={Paid}, DatPhong.TongTien={DatPhongTotal}, finalTotal={Final}",
                    booking.IddatPhong, targetInvoice.TongTien, targetInvoice.TienThanhToan, booking.TongTien, finalTotal);

                // Nếu đã thanh toán hoàn tất, xử lý điểm tích lũy
                if (targetInvoice.TrangThaiThanhToan == 2 && booking.IdkhachHangNavigation != null)
                {
                    // 1. Trừ điểm đã dùng
                    if (pointsToUse > 0 && (booking.IdkhachHangNavigation.TichDiem ?? 0) >= pointsToUse)
                    {
                        booking.IdkhachHangNavigation.TichDiem = (booking.IdkhachHangNavigation.TichDiem ?? 0) - pointsToUse;
                        _logger.LogInformation("[ConfirmPaid-Cash] Trừ {Points} điểm từ khách {CustomerId}", pointsToUse, booking.IdkhachHang);
                    }

                    // 2. Cộng điểm mới theo số tiền thực trả (100.000đ = 1 điểm)
                    int pointsToAdd = (int)Math.Floor((double)(finalTotal / EARN_RATE));
                    if (pointsToAdd > 0)
                    {
                        booking.IdkhachHangNavigation.TichDiem = (booking.IdkhachHangNavigation.TichDiem ?? 0) + pointsToAdd;
                        _logger.LogInformation("[ConfirmPaid-Cash] Cộng {Points} điểm mới cho khách {CustomerId} (thanh toán {Amount}đ)", 
                            pointsToAdd, booking.IdkhachHang, finalTotal);
                    }

                    // 3. Cập nhật ghi chú hóa đơn
                    if (!string.IsNullOrWhiteSpace(targetInvoice.GhiChu) && targetInvoice.GhiChu.Contains("[USE_POINT]"))
                    {
                        targetInvoice.GhiChu = targetInvoice.GhiChu.Replace("[USE_POINT]", "[POINT_USED]");
                    }
                }

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
                        // Cộng điểm: 100.000đ = 1 điểm
                        const decimal EARN_RATE = 100_000m;
                        var pointsToAdd = (int)Math.Floor((double)(booking.TongTien / EARN_RATE));
                        if (pointsToAdd > 0)
                        {
                            kh.TichDiem = (kh.TichDiem ?? 0) + pointsToAdd;
                            _logger.LogInformation("[CompleteCheckout] Cộng {Points} điểm cho khách {CustomerId} (tổng tiền {Amount}đ)", 
                                pointsToAdd, kh.IdkhachHang, booking.TongTien);
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

            // ========== ƯU TIÊN DÙNG GIÁ ĐÃ CHỐT TỪ GHICHU ==========
            var lockedPrice = TryGetLockedPriceFromNote(hoaDon.GhiChu);
            if (lockedPrice.HasValue)
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

                decimal finalLockedTotal = lockedPrice.Value + lockedServiceWithVat;
                hoaDon.TongTien = finalLockedTotal;

                // Cập nhật trạng thái thanh toán dựa trên số tiền đã trả
                decimal paidSoFar = hoaDon.TienThanhToan ?? 0m;
                decimal depositAmount = booking.TienCoc ?? 0m;

                if (depositAmount > 0 && paidSoFar < depositAmount)
                {
                    paidSoFar = depositAmount;
                    hoaDon.TienThanhToan = paidSoFar;
                }

                decimal remaining = finalLockedTotal - paidSoFar;
                hoaDon.TrangThaiThanhToan = (remaining > 1000m) ? 1 : 2;

                // Cập nhật tổng tiền booking
                decimal totalBookingAmount = booking.HoaDons?.Sum(h => h.TongTien) ?? finalLockedTotal;
                booking.TongTien = totalBookingAmount;

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
            
            // Kiểm tra nếu hóa đơn có phí gia hạn (dựa vào GhiChu chứa "Gia hạn")
            bool markerGiaHan = !string.IsNullOrEmpty(hoaDon.GhiChu) &&
                               (hoaDon.GhiChu.Contains("Gia hạn") || hoaDon.GhiChu.Contains("gia hạn"));

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
            }

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

            // Khi có gia hạn, KHÔNG ghi đè booking.TongTien vì nó đã bao gồm phí gia hạn
            // AddServiceToInvoice sẽ cộng thêm dịch vụ mới sau
            if (!hasExtendFee)
            {
                booking.TongTien = bookingTotal;
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

            // Lấy danh sách phòng trống từ service chung `check-available-rooms`
            // Use DateTime directly for check-in/check-out times (midnight boundaries)
            DateTime checkInDt = DateTime.Today.AddDays(1); // 00:00 of tomorrow
            DateTime checkOutDt = DateTime.Today.AddDays(2); // 00:00 of the day after tomorrow
            var rooms = await _roomService.CheckAvailableRoomsAsync(checkInDt, checkOutDt, booking.SoNguoi ?? 1);
            
            // CHỈ LẤY PHÒNG TRỐNG (không đang sử dụng) và loại bỏ phòng hiện tại
            var emptyRooms = await _context.Phongs
                .Where(p => p.TrangThai == "Trống" && p.Idphong != roomId)
                .Select(p => p.Idphong)
                .ToListAsync();
            
            // Lọc: chỉ giữ phòng có trong danh sách service VÀ thực sự đang trống
            var availableRooms = rooms
                .Where(r => emptyRooms.Contains(r.RoomId))
                .Select(r => new DTOs.AvailableRoomForExtend
                {
                    Idphong = r.RoomId,
                    TenPhong = r.RoomName,
                    SoPhong = r.RoomNumber,
                    TenLoaiPhong = r.RoomTypeName,
                    GiaMotDem = r.BasePricePerNight,
                    UrlAnhPhong = r.RoomImageUrl,
                    SoNguoiToiDa = r.MaxOccupancy,
                    TrangThai = "Trống", // Đảm bảo trả về trạng thái để frontend biết
                    // Promotion fields (RoomService already computed these when calling CheckAvailableRoomsAsync)
                    PromotionName = r.PromotionName,
                    DiscountPercent = r.DiscountPercent,
                    DiscountedPrice = r.DiscountedPrice,
                    Description = r.Description
                }).ToList();
            
            response.AvailableRooms = availableRooms;

            if (!response.CanExtendSameRoom)
            {
                // Có booking tiếp theo trên phòng này, cần chuyển phòng nếu gia hạn qua đêm
                response.Message = availableRooms.Count > 0
                    ? $"Phòng hiện tại có khách mới check-in ngày {nextBooking?.NgayNhanPhong:dd/MM/yyyy}. Có thể gia hạn trong ngày hoặc chuyển sang phòng khác."
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

                // Tính phí gia hạn
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

                // Cập nhật ngày checkout
                booking.NgayTraPhong = newCheckoutDate;
                booking.TrangThai = 3;

                // Ensure the physical room remains in 'Đang sử dụng' when we extend
                // without changing room. This prevents the room record from being
                // accidentally marked as 'Trống' by other flows.
                try
                {
                    if (room != null)
                    {
                        room.TrangThai = "Đang sử dụng";
                        _context.Phongs.Update(room);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to enforce room status 'Đang sử dụng' for room {RoomId} when extending booking {BookingId}", room?.Idphong, booking.IddatPhong);
                }

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

                bool isPaidNow = request.PaymentMethod == 1; // Chỉ tiền mặt là đã thanh toán ngay
                string paymentStatus = request.PaymentMethod == 1 ? "Đã thanh toán"
                                     : request.PaymentMethod == 2 ? "Chờ thanh toán QR"
                                     : "Thanh toán sau (khi checkout)";

                var responseObj = new
                {
                    Success = true,
                    Message = $"Gia hạn thành công. {paymentStatus}",
                    IddatPhong = booking.IddatPhong,
                    ExtendFee = extendFee,
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

            // KIỂM TRA: Phòng mới phải TRỐNG mới được đổi
            if (newRoom.TrangThai != "Trống")
            {
                return BadRequest(new { message = $"Phòng {newRoom.TenPhong} đang được sử dụng. Vui lòng chọn phòng trống khác." });
            }

            var oldRoom = await _context.Phongs.FindAsync(oldBooking.Idphong);
            var oldCheckout = oldBooking.NgayTraPhong;
            decimal newRoomRate = newRoom.GiaCoBanMotDem ?? 0;
            // Check active promotions for the new room and compute applied rate
            decimal appliedRoomRate = newRoomRate;
            try
            {
                var today = DateOnly.FromDateTime(DateTime.Now);
                var promoKmp = await _context.KhuyenMaiPhongs
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

            var response = new DTOs.ExtendStayResponse
            {
                Success = true,
                Message = "Đổi phòng và gia hạn thành công",
                IddatPhong = newBookingId,
                ExtendFee = extendFee,
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

        private async Task<List<DTOs.AvailableRoomForExtend>> FindAvailableRoomsForExtend(DateTime checkin, DateTime checkout, int guests, string? excludeRoomId)
        {
            var checkinDate = DateOnly.FromDateTime(checkin);
            var checkoutDate = DateOnly.FromDateTime(checkout);

            // Lấy danh sách phòng đang có booking (không bị hủy, chưa hoàn tất)
            var bookedRoomIds = await _context.DatPhongs
                .Where(b => b.TrangThai != 0 && b.TrangThai != 4) // Không bị hủy, chưa hoàn tất
                .Where(b => !(b.NgayTraPhong <= checkinDate || b.NgayNhanPhong >= checkoutDate))
                .Select(b => b.Idphong)
                .Distinct()
                .ToListAsync();

            // Chỉ lấy phòng TRỐNG (TrangThai = "Trống"), không đang sử dụng
            var roomsQuery = await _context.Phongs
                .Include(p => p.IdloaiPhongNavigation)
                .Where(p => !bookedRoomIds.Contains(p.Idphong))
                .Where(p => p.Idphong != excludeRoomId)
                .Where(p => p.TrangThai == "Trống") // CHỈ phòng trống
                .Where(p => (p.SoNguoiToiDa ?? 2) >= guests)
                .Select(p => new
                {
                    RoomId = p.Idphong,
                    RoomName = p.TenPhong ?? "",
                    RoomNumber = p.SoPhong,
                    RoomTypeName = p.IdloaiPhongNavigation != null ? p.IdloaiPhongNavigation.TenLoaiPhong : null,
                    BasePricePerNight = p.GiaCoBanMotDem ?? 0,
                    RawImageUrl = p.UrlAnhPhong,
                    MaxOccupancy = p.SoNguoiToiDa,
                    Description = p.MoTa
                })
                .OrderBy(p => p.RoomNumber)
                .ToListAsync();

            // Get active promotions for these rooms (if any)
            var today = DateOnly.FromDateTime(DateTime.Now);
            var roomIds = roomsQuery.Select(r => r.RoomId).ToList();
            var promotionsDict = await _context.KhuyenMaiPhongs
                .Include(kmp => kmp.IdkhuyenMaiNavigation)
                .Where(kmp => roomIds.Contains(kmp.Idphong) && kmp.IsActive &&
                              kmp.IdkhuyenMaiNavigation.TrangThai == "active" &&
                              kmp.IdkhuyenMaiNavigation.NgayBatDau <= today &&
                              kmp.IdkhuyenMaiNavigation.NgayKetThuc >= today)
                .GroupBy(kmp => kmp.Idphong)
                .ToDictionaryAsync(g => g.Key, g => g.OrderByDescending(kmp => kmp.IdkhuyenMaiNavigation.GiaTriGiam).First());

            var availableRooms = roomsQuery.Select(r =>
            {
                var resp = new DTOs.AvailableRoomForExtend
                {
                    Idphong = r.RoomId,
                    TenPhong = r.RoomName,
                    SoPhong = r.RoomNumber,
                    TenLoaiPhong = r.RoomTypeName,
                    GiaMotDem = r.BasePricePerNight,
                    UrlAnhPhong = r.RawImageUrl,
                    SoNguoiToiDa = r.MaxOccupancy,
                    Description = r.Description,
                    TrangThai = "Trống"
                };

                if (promotionsDict != null && promotionsDict.TryGetValue(r.RoomId, out var kmp))
                {
                    var promo = kmp.IdkhuyenMaiNavigation;
                    resp.PromotionName = promo.TenKhuyenMai;
                    resp.DiscountPercent = promo.GiaTriGiam;
                    if (promo.LoaiGiamGia == "percent" && promo.GiaTriGiam.HasValue)
                    {
                        resp.DiscountedPrice = r.BasePricePerNight * (1 - promo.GiaTriGiam.Value / 100);
                    }
                    else if (promo.LoaiGiamGia == "fixed" && promo.GiaTriGiam.HasValue)
                    {
                        resp.DiscountedPrice = r.BasePricePerNight - promo.GiaTriGiam.Value;
                    }
                }

                return resp;
            }).ToList();

            _logger.LogInformation("[FindAvailableRoomsForExtend] Tìm thấy {Count} phòng trống từ {Checkin} đến {Checkout}", 
                availableRooms.Count, checkinDate, checkoutDate);

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
    }
}