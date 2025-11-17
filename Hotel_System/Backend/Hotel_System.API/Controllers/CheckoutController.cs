using Hotel_System.API.Models;
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
        public string HoaDonId { get; set; } = string.Empty;
        public List<ServiceItem> DichVu { get; set; } = new();
    }

    public class ServiceItem
    {
        public string IddichVu { get; set; } = string.Empty;
        public decimal? TienDichVu { get; set; } // Đây là thành tiền của 1 cái (đơn giá × số lượng sẽ tính ở backend)
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
    public class CheckoutController : ControllerBase
    {
        private readonly HotelSystemContext _context;
        private readonly ILogger<CheckoutController> _logger;
        private readonly Hotel_System.API.Services.IEmailService _emailService;

        public CheckoutController(HotelSystemContext context, ILogger<CheckoutController> logger, Hotel_System.API.Services.IEmailService emailService)
        {
            _context = context;
            _logger = logger;
            _emailService = emailService;
        }

        // GET: api/Checkout/summary/{idDatPhong} – DÙNG CHÍNH TRONG FRONTEND
        [HttpGet("summary/{idDatPhong}")]
        public async Task<IActionResult> GetSummary(string idDatPhong)
        {
            if (string.IsNullOrWhiteSpace(idDatPhong))
                return BadRequest(new { message = "Mã đặt phòng không hợp lệ." });

            var booking = await _context.DatPhongs
                .Include(b => b.ChiTietDatPhongs)
                .Include(b => b.IdkhachHangNavigation)
                .Include(b => b.HoaDons)
                    .ThenInclude(h => h.Cthddvs)
                        .ThenInclude(c => c.IddichVuNavigation)
                .FirstOrDefaultAsync(b => b.IddatPhong == idDatPhong);

            if (booking == null)
                return NotFound(new { message = "Không tìm thấy đặt phòng." });

            // Tiền phòng: từ ChiTietDatPhongs.ThanhTien (đã sau khuyến mãi)
            decimal roomTotal = booking.ChiTietDatPhongs?.Sum(ct => ct.ThanhTien) ?? booking.TongTien;

            // Tiền dịch vụ: từ tất cả hóa đơn
            decimal serviceTotal = 0m;
            var services = new List<object>();
            if (booking.HoaDons != null)
            {
                foreach (var hd in booking.HoaDons)
                {
                    if (hd.Cthddvs != null)
                    {
                        serviceTotal += hd.Cthddvs.Sum(c => c.TienDichVu ?? 0m);
                        services.AddRange(hd.Cthddvs.Select(c => new
                        {
                            tenDichVu = c.IddichVuNavigation?.TenDichVu,
                            // quantity removed: treat each service line as a single unit with TienDichVu as line total
                            donGia = c.TienDichVu,
                            thanhTien = c.TienDichVu
                        }));
                    }
                }
            }

            decimal deposit = booking.TienCoc ?? 0m;
            decimal paidAmount = booking.HoaDons?.Sum(h => h.TienThanhToan ?? 0m) ?? 0m;
            decimal tongTien = roomTotal + serviceTotal;
            decimal remaining = Math.Max(0m, tongTien - deposit - paidAmount);

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
                customer = new { name = booking.IdkhachHangNavigation?.HoTen, email = booking.IdkhachHangNavigation?.Email },
                dates = new { checkin = booking.NgayNhanPhong, checkout = booking.NgayTraPhong, soDem = booking.SoDem },
                money = new { roomTotal, serviceTotal, deposit, paidAmount, tongTien, remaining },
                items = booking.ChiTietDatPhongs != null
                    ? booking.ChiTietDatPhongs.Select(ct => new
                    {
                        tenPhong = ct.Phong?.TenPhong,
                        soPhong = ct.Phong?.SoPhong,
                        soDem = ct.SoDem,
                        giaPhong = ct.GiaPhong,
                        thanhTien = ct.ThanhTien
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
            if (req == null || string.IsNullOrWhiteSpace(req.HoaDonId) || req.DichVu == null || !req.DichVu.Any())
                return BadRequest(new { message = "Dữ liệu không hợp lệ." });

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var hoaDon = await _context.HoaDons
                    .Include(h => h.Cthddvs)
                    .Include(h => h.IddatPhongNavigation)
                        .ThenInclude(dp => dp.ChiTietDatPhongs)
                    .FirstOrDefaultAsync(h => h.IdhoaDon == req.HoaDonId);

                if (hoaDon == null)
                    return NotFound(new { message = "Không tìm thấy hóa đơn." });

                    foreach (var item in req.DichVu)
                    {
                        // Treat incoming TienDichVu as the line total; do not store quantity
                        var lineTotal = item.TienDichVu ?? 0m;
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

                // TÍNH LẠI TỔNG TIỀN HÓA ĐƠN + ĐỒNG BỘ VỚI ĐẶT PHÒNG
                await RecomputeInvoiceAndBookingTotal(hoaDon);

                // If booking was already marked as fully paid (TrangThaiThanhToan == 2)
                // but adding services introduces an outstanding amount on the invoice,
                // set booking.TrangThaiThanhToan = 3 (đã thanh toán nhưng chưa hoàn tất)
                try
                {
                    var booking = hoaDon.IddatPhongNavigation;
                    if (booking != null)
                    {
                        // was fully paid before adding services?
                        // Note: booking.TrangThaiThanhToan may have been 2 (fully paid)
                        // After recompute, hoaDon.TienThanhToan holds the remaining amount to collect for this invoice
                        var wasFullyPaid = booking.TrangThaiThanhToan == 2;
                        var remainingForInvoice = hoaDon.TienThanhToan ?? 0m;
                        if (wasFullyPaid && remainingForInvoice > 0m)
                        {
                            booking.TrangThaiThanhToan = 3; // paid but not completed
                            await _context.SaveChangesAsync();
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to update booking payment status after adding services");
                    // don't fail the whole operation for a logging/update issue
                }

                await transaction.CommitAsync();

                return Ok(new
                {
                    message = "Đã thêm dịch vụ và cập nhật hóa đơn thành công!",
                    hoaDonId = hoaDon.IdhoaDon,
                    tongTien = hoaDon.TongTien,
                    tienThanhToan = hoaDon.TienThanhToan
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
            if (string.IsNullOrWhiteSpace(idDatPhong))
                return BadRequest(new { message = "Mã đặt phòng không hợp lệ." });

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

                if (targetInvoice == null)
                    return NotFound(new { message = "Không tìm thấy hóa đơn." });

                // Tính lại tổng tiền trước khi chốt và lưu các thông tin tiền phòng, tổng tiền cần thu
                await RecomputeInvoiceAndBookingTotal(targetInvoice);

                // Recompute totals for the target invoice (this will set targetInvoice.TongTien appropriately)
                await RecomputeInvoiceAndBookingTotal(targetInvoice);

                var deposit = booking.TienCoc ?? 0m;
                // If client provides an amount, use it; otherwise determine sensible default:
                // - If there are already paid invoices for this booking, do NOT subtract deposit again; default to remaining on this invoice
                // - Otherwise (no prior paid invoices), subtract deposit from this invoice remaining
                var hasPaidBefore = booking.HoaDons?.Where(h => h.IdhoaDon != targetInvoice.IdhoaDon && h.TrangThaiThanhToan == 2).Any() ?? false;

                decimal defaultAmount;
                if (hasPaidBefore)
                {
                    defaultAmount = Math.Max(0m, (targetInvoice.TongTien - (targetInvoice.TienThanhToan ?? 0m)));
                }
                else
                {
                    defaultAmount = Math.Max(0m, (targetInvoice.TongTien - deposit - (targetInvoice.TienThanhToan ?? 0m)));
                }

                var amount = req?.Amount ?? defaultAmount;

                // Add the confirmed amount to any previously recorded paid amount (do not overwrite)
                var previouslyPaid = targetInvoice.TienThanhToan ?? 0m;
                var newPaidTotal = previouslyPaid + amount;

                // Persist the paid amount. Ensure we don't exceed the invoice total.
                var cappedPaidTotal = Math.Min(newPaidTotal, targetInvoice.TongTien);
                targetInvoice.TienThanhToan = cappedPaidTotal;

                // Update invoice payment status based on paid total
                if (cappedPaidTotal >= targetInvoice.TongTien && targetInvoice.TongTien > 0m)
                {
                    targetInvoice.TrangThaiThanhToan = 2; // fully paid
                }
                else if (cappedPaidTotal > 0m)
                {
                    targetInvoice.TrangThaiThanhToan = 1; // partial / pending
                }
                else
                {
                    targetInvoice.TrangThaiThanhToan = 0; // unpaid
                }

                // Đồng bộ booking: if invoice is now fully paid, set booking.TrangThaiThanhToan = 2
                if (targetInvoice.TrangThaiThanhToan == 2)
                {
                    booking.TrangThaiThanhToan = 2;
                }

                // Ensure TienPhong is stored on the invoice (RecomputeInvoiceAndBookingTotal already set hoaDon.TienPhong)
                // IMPORTANT: Do not change booking.TrangThai here; if booking.TrangThai == 3 (Đang sử dụng), keep it as 3.

                if (!string.IsNullOrWhiteSpace(req?.Note))
                    targetInvoice.GhiChu = (targetInvoice.GhiChu + " | " + req.Note).Trim();

                await _context.SaveChangesAsync();

                // Optionally send invoice email here if needed (payment confirmed).
                // We prefer to send email when the checkout is completed (CompleteCheckout),
                // but if you want immediate email on ConfirmPaid, uncomment below.
                // if (targetInvoice.TrangThaiThanhToan == 2 && !string.IsNullOrWhiteSpace(booking.IdkhachHangNavigation?.Email))
                // {
                //     await SendInvoiceEmail(booking.IdkhachHangNavigation.Email, booking.IdkhachHangNavigation.HoTen ?? "Quý khách", targetInvoice);
                // }

                // Return the updated invoice details so the frontend can refresh UI from authoritative DB values
                var resp = new
                {
                    idHoaDon = targetInvoice.IdhoaDon,
                    idDatPhong = booking.IddatPhong,
                    tienThanhToan = targetInvoice.TienThanhToan,
                    trangThaiThanhToan = targetInvoice.TrangThaiThanhToan,
                    tongTien = targetInvoice.TongTien
                };

                return Ok(resp);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ConfirmPaid error");
                return StatusCode(500, new { message = ex.Message });
            }
        }

        // POST: api/Checkout/hoa-don
        // Create invoice + optional services (replacement for PaymentController.CreateInvoice in checkout flow)
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
                    .FirstOrDefaultAsync(dp => dp.IddatPhong == request.IDDatPhong);

                if (booking == null)
                    return NotFound(new { message = "Không tìm thấy đặt phòng" });

                // Fallback tiền phòng
                var tienPhongTinh = booking.ChiTietDatPhongs?.Sum(ct => ct.ThanhTien) ?? 0m;
                int tienPhong = request.TienPhong ?? (int)Math.Round(tienPhongTinh);

                // Compute totals on server-side and store VAT-inclusive total (10% VAT)
                // Do not rely solely on request.TongTien (which may be a pre-VAT subtotal).
                decimal servicesTotal = 0m;
                if (request.Services != null && request.Services.Any())
                {
                    foreach (var svc in request.Services)
                    {
                        // Use provided TienDichVu if set, otherwise compute from DonGia*SoLuong
                        var tienDichVu = svc.TienDichVu != 0m ? svc.TienDichVu : svc.DonGia * Math.Max(1, svc.SoLuong);
                        servicesTotal += Math.Round(tienDichVu);
                    }
                }

                // Room amount: prefer explicit TienPhong from request, else fallback to booking calculation
                decimal roomAmount = request.TienPhong.HasValue && request.TienPhong.Value > 0 ? request.TienPhong.Value : (decimal) tienPhong;

                // Total before VAT
                decimal totalBeforeVat = roomAmount + servicesTotal;
                // Apply VAT 10% and round to nearest integer (server convention)
                decimal tongTien = Math.Round(totalBeforeVat * 1.1m, 0, MidpointRounding.AwayFromZero);

                decimal tienCoc = booking.TienCoc ?? 0m;
                if (request.TienCoc.HasValue && request.TienCoc.Value > 0m)
                {
                    tienCoc = request.TienCoc.Value;
                    booking.TienCoc = tienCoc;
                }

                // Determine initial payment status for the new invoice.
                // Prefer explicit client-provided TrangThaiThanhToan. If absent:
                // - Online payments (PhuongThucThanhToan == 2) -> pending (1)
                // - Other methods -> unpaid (0)
                int trangThaiThanhToan = request.TrangThaiThanhToan ?? (request.PhuongThucThanhToan == 2 ? 1 : 0);

                decimal tienThanhToan = 0m;
                if (trangThaiThanhToan == 2)
                {
                    // Fully paid: collect remaining after deposit
                    tienThanhToan = Math.Max(0m, tongTien - tienCoc);
                }
                else
                {
                    // For unpaid or pending, record 0 as paid for this invoice initially.
                    tienThanhToan = 0m;
                }

                var idHoaDon = $"HD{DateTime.Now:yyyyMMddHHmmssfff}";
                var hoaDon = new HoaDon
                {
                    IdhoaDon = idHoaDon,
                    IddatPhong = booking.IddatPhong,
                    NgayLap = DateTime.Now,
                    TienPhong = tienPhong,
                    Slngay = request.SoLuongNgay ?? booking.SoDem ?? 1,
                    TongTien = tongTien,
                    TienCoc = tienCoc,
                    TrangThaiThanhToan = trangThaiThanhToan,
                    TienThanhToan = tienThanhToan,
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
                            IdhoaDon = idHoaDon,
                            IddichVu = svc.IddichVu,
                            TienDichVu = Math.Round(tienDichVu),
                            ThoiGianThucHien = svc.ThoiGianThucHien ?? DateTime.Now,
                            ThoiGianBatDau = svc.ThoiGianThucHien ?? DateTime.Now,
                            ThoiGianKetThuc = (svc.ThoiGianThucHien ?? DateTime.Now).AddMinutes(30),
                            TrangThai = "Hoạt động"
                        };
                        _context.Cthddvs.Add(cthd);
                    }
                }

                // Đồng bộ đặt phòng
                booking.TongTien = tongTien;
                // Only update booking.TrangThaiThanhToan if invoice is fully paid here.
                if (trangThaiThanhToan == 2)
                {
                    booking.TrangThaiThanhToan = 2;
                }
                // Do not override TrangThai if currently Đang sử dụng (3)
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
                        var amt = (decimal?)(hoaDon.TienThanhToan ?? hoaDon.TongTien) ?? 0m;
                        var amtInt = (long)Math.Round(amt);
                        var addInfo = System.Net.WebUtility.UrlEncode($"Thanh toan {booking.IddatPhong}");
                        paymentUrl = $"https://img.vietqr.io/image/bidv-8639699999-print.png?amount={amtInt}&addInfo={addInfo}";
                    }
                    catch { paymentUrl = null; }
                }

                return Ok(new { idHoaDon = hoaDon.IdhoaDon, idDatPhong = booking.IddatPhong, tongTien = hoaDon.TongTien, tienCoc = hoaDon.TienCoc, tienThanhToan = hoaDon.TienThanhToan, paymentUrl });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi tạo hóa đơn trong CheckoutController");
                return StatusCode(500, new { message = "Lỗi khi tạo hóa đơn", error = ex.Message });
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

                // Build payment URL for QR (amount to collect)
                // If hoaDon already has a TienThanhToan > 0 use that (previously paid on this invoice), else compute remaining.
                // If there are prior fully-paid invoices for this booking, do NOT subtract deposit again for this invoice.
                decimal amount;
                var hasPaidBeforeForOtherInvoices = booking.HoaDons?.Where(h => h.IdhoaDon != hoaDon.IdhoaDon && h.TrangThaiThanhToan == 2).Any() ?? false;
                if ((hoaDon.TienThanhToan ?? 0m) > 0m)
                {
                    amount = hoaDon.TienThanhToan ?? 0m;
                }
                else
                {
                    if (hasPaidBeforeForOtherInvoices)
                    {
                        amount = Math.Max(0m, (hoaDon.TongTien - (hoaDon.TienThanhToan ?? 0m)));
                    }
                    else
                    {
                        amount = Math.Max(0m, (hoaDon.TongTien - (booking.TienCoc ?? 0m)));
                    }
                }
                if (req.Amount.HasValue && req.Amount.Value > 0m) amount = req.Amount.Value;

                string? paymentUrl = null;
                try
                {
                    var amtInt = (long)Math.Round(amount);
                    var addInfo = System.Net.WebUtility.UrlEncode($"Thanh toan {booking.IddatPhong}");
                    paymentUrl = $"https://img.vietqr.io/image/bidv-8639699999-print.png?amount={amtInt}&addInfo={addInfo}";
                }
                catch { paymentUrl = null; }

                await tx.CommitAsync();

                return Ok(new { idHoaDon = hoaDon.IdhoaDon, idDatPhong = booking.IddatPhong, amount = amount, paymentUrl });
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
                .Include(dp => dp.HoaDons)
                    .ThenInclude(h => h.Cthddvs)
                .FirstOrDefaultAsync(dp => dp.IddatPhong == idDatPhong);

            if (booking == null) return NotFound();

            booking.TrangThai = 4;
            await _context.SaveChangesAsync();

            // After marking checkout complete, send invoice email if the latest invoice is paid
            try
            {
                var latest = booking.HoaDons?.OrderByDescending(h => h.NgayLap).FirstOrDefault();
                if (latest != null && latest.TrangThaiThanhToan == 2)
                {
                    var email = booking.IdkhachHangNavigation?.Email;
                    var hoTen = booking.IdkhachHangNavigation?.HoTen ?? "Quý khách";
                    if (!string.IsNullOrWhiteSpace(email))
                    {
                        await SendInvoiceEmail(email, hoTen, latest);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi gửi email hóa đơn sau khi hoàn tất trả phòng");
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
                var reviewUrl = $"{Request.Scheme}://{Request.Host}/review/{hoaDon.IddatPhong}";

                                var emailBodyHtml = $@"<html><body>
<p>Kính gửi Quý khách <strong>{System.Net.WebUtility.HtmlEncode(hoTen)}</strong>,</p>
<p><strong>🎉 THANH TOÁN THÀNH CÔNG</strong>! Cảm ơn Quý khách đã sử dụng dịch vụ của Khách Sạn Robins Villa.</p>
<h3>Thông tin hóa đơn</h3>
<ul>
    <li><strong>Mã hóa đơn:</strong> {System.Net.WebUtility.HtmlEncode(hoaDon.IdhoaDon)}</li>
    <li><strong>Mã đặt phòng:</strong> {System.Net.WebUtility.HtmlEncode(hoaDon.IddatPhong)}</li>
    <li><strong>Ngày lập:</strong> {hoaDon.NgayLap:dd/MM/yyyy HH:mm:ss}</li>
    <li><strong>Tổng tiền:</strong> {hoaDon.TongTien:N0} VNĐ</li>
    <li><strong>Tiền đã thanh toán:</strong> {hoaDon.TienThanhToan:N0} VNĐ</li>
</ul>
<p>Xin vui lòng lưu lại email này như biên lai thanh toán điện tử.</p>
<p><strong>Chúng tôi rất mong nhận được phản hồi từ Quý khách.</strong></p>
<p>Mọi góp ý của Quý khách sẽ giúp chúng tôi nâng cao chất lượng dịch vụ.</p>
<p>Nếu Quý khách cần hỗ trợ thêm, xin vui lòng liên hệ với bộ phận chăm sóc khách hàng của chúng tôi.</p>
<p>Xin chân thành cảm ơn và mong được phục vụ Quý khách trong những lần tiếp theo.</p>
<p>Vui lòng dành chút thời gian để đánh giá trải nghiệm của bạn:</p>
<p><a href=""{reviewUrl}"" target=""_blank"">Gửi đánh giá cho chúng tôi</a></p>
<p>Trân trọng,<br/>Khách Sạn Robins Villa</p>
</body></html>";

                await _emailService.SendEmailAsync(email, emailSubject, emailBodyHtml, true);
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

            var booking = await _context.DatPhongs
                .Include(dp => dp.ChiTietDatPhongs)
                .Include(dp => dp.HoaDons).ThenInclude(h => h.Cthddvs)
                .FirstOrDefaultAsync(dp => dp.IddatPhong == hoaDon.IddatPhong);

            if (booking == null) return;

            // 1. TIỀN PHÒNG CHƯA VAT (đúng như bạn xác nhận)
            decimal roomTotalChuaVat = booking.ChiTietDatPhongs?.Sum(ct => ct.ThanhTien) ?? 0m;

            // 2. TIỀN DỊCH VỤ CHƯA VAT (từ tất cả hóa đơn, kể cả cũ + mới)
            decimal serviceTotalChuaVat = booking.HoaDons?
                .SelectMany(h => h.Cthddvs ?? new List<Cthddv>())
                .Where(c => c.TrangThai == "Hoạt động")
                .Sum(c => c.TienDichVu ?? 0m) ?? 0m;

            // 3. TỔNG TIỀN CHƯA VAT CHO TOÀN BOOKING
            decimal bookingTongChuaVat = roomTotalChuaVat + serviceTotalChuaVat;

            // 4. TỔNG CUỐI CÙNG CHO TOÀN BOOKING ĐÃ CÓ VAT 10%
            decimal bookingTongPhaiThu = Math.Round(bookingTongChuaVat * 1.1m, 0, MidpointRounding.AwayFromZero);

            // 5. TIỀN ĐÃ THU TRƯỚC ĐÓ (cọc + tất cả hóa đơn đã thanh toán)
            decimal daThuTruoc = (booking.TienCoc ?? 0m) +
                                 (booking.HoaDons?
                                     .Where(h => h.TrangThaiThanhToan == 2)
                                     .Sum(h => h.TienThanhToan ?? 0m) ?? 0m);

            // 6. Quy tắc VAT theo yêu cầu:
            // - Nếu chưa có khoản thanh toán nào trước đó (daThuTruoc chỉ là tiền cọc hoặc 0),
            //   thì tính VAT 10% duy nhất trên tổng (tiền phòng + tất cả dịch vụ) — gán toàn bộ tổng cho hoadon.
            // - Nếu đã có thanh toán trước đó (ví dụ đã thanh toán tiền phòng),
            //   thì cho hoadon hiện tại chỉ chịu VAT trên phần thành tiền của hoadon (thường là dịch vụ mới),
            //   không tính lại VAT cho phần đã thu trước.

            // Tính tổng tiền chưa VAT của phần nằm trong hoadon hiện tại (room part + services belonging to this hoaDon)
            decimal thisInvoiceServiceChuaVat = hoaDon.Cthddvs?.Where(c => c.TrangThai == "Hoạt động").Sum(c => c.TienDichVu ?? 0m) ?? 0m;
            // If HoaDon.TienPhong is present, treat it as the room portion already assigned to this invoice (chưa VAT)
            decimal thisInvoiceRoomChuaVat = 0m;
            if (hoaDon.GetType().GetProperty("TienPhong") != null && hoaDon.TienPhong > 0)
            {
                // HoaDon.TienPhong stores room amount (integer), treat as chua VAT
                thisInvoiceRoomChuaVat = (decimal)hoaDon.TienPhong;
            }

            decimal thisInvoiceChuaVat = thisInvoiceRoomChuaVat + thisInvoiceServiceChuaVat;

            // Số tiền đã thanh toán cho các hóa đơn khác trước khi tính hoadon này
            decimal paidBeforeThisInvoice = booking.HoaDons?.Where(h => h.IdhoaDon != hoaDon.IdhoaDon && h.TrangThaiThanhToan == 2).Sum(h => h.TienThanhToan ?? 0m) ?? 0m;

            if (paidBeforeThisInvoice <= 0m)
            {
                // Chưa có thanh toán trước đó: hoadon checkout đầu tiên chịu toàn bộ thuế trên booking
                hoaDon.TongTien = bookingTongPhaiThu;
                // Lưu tiền phòng chưa VAT tổng (dành cho invoice hiển thị)
                if (hoaDon.GetType().GetProperty("TienPhong") != null)
                    hoaDon.TienPhong = (int)Math.Round(roomTotalChuaVat);
            }
            else
            {
                // Đã có thanh toán trước đó: chỉ tính tổng cho hoadon này trên phần của nó (chỉ áp VAT trên phần này)
                decimal tongThisInvoiceWithVat = Math.Round(thisInvoiceChuaVat * 1.1m, 0, MidpointRounding.AwayFromZero);
                // Nếu invoice có phần đã thu trước (hoaDon.TienThanhToan), giữ nguyên (KHÔNG GHI ĐÈ)
                hoaDon.TongTien = tongThisInvoiceWithVat;
            }

            // Đồng bộ booking tổng tiền (luôn là toàn booking)
            booking.TongTien = bookingTongPhaiThu;

            await _context.SaveChangesAsync();
        }
    }
}