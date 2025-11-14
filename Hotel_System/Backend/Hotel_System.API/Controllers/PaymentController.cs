using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
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

        public PaymentController(
            HotelSystemContext context,
            ILogger<PaymentController> logger,
            IEmailService emailService
        )
        {
            _context = context;
            _logger = logger;
            _emailService = emailService;
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
            using var tx = await _context.Database.BeginTransactionAsync();
            try
            {
                var datPhong = await _context.DatPhongs
                    .Include(dp => dp.ChiTietDatPhongs)
                    .Include(dp => dp.IdkhachHangNavigation)
                    .FirstOrDefaultAsync(dp => dp.IddatPhong == request.IDDatPhong);

                if (datPhong == null)
                    return NotFound(new { message = "Không tìm thấy đơn đặt phòng" });

                // Fallback số ngày
                var soNgay = request.SoLuongNgay ?? datPhong.SoDem ?? 1;

                // Fallback tiền phòng từ chi tiết nếu client không gửi
                var tienPhongTinh = datPhong.ChiTietDatPhongs.Sum(ct => (ct.GiaPhong * soNgay));
                int tienPhong = request.TienPhong ?? (int)Math.Round(tienPhongTinh);

                // Tổng cuối cùng do FE tính (đã gồm phòng sau KM + dịch vụ + VAT)
                decimal tongTien = request.TongTien;
                if (tongTien <= 0m)
                {
                    // fallback: DatPhong.TongTien -> sum ChiTiet (ThanhTien)
                    tongTien = datPhong.TongTien;
                    if (tongTien <= 0m)
                    {
                        try { tongTien = datPhong.ChiTietDatPhongs.Sum(ct => ct.ThanhTien); }
                        catch { tongTien = 0m; }
                    }
                    _logger.LogInformation("PaymentController: request.TongTien missing/zero, fallback tongTien={TongTien}", tongTien);
                }

                decimal tienCoc = datPhong.TienCoc ?? 0m;

                // 1 = tiền mặt/quầy (chưa TT), 2 = online (đã TT)
                int trangThaiThanhToan = (request.PhuongThucThanhToan == 2) ? 2 : 1;

                // Luôn set tiền đã thanh toán rõ ràng
                decimal tienThanhToan = trangThaiThanhToan == 2
                    ? Math.Max(0m, tongTien - tienCoc)
                    : 0m;

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

                // Đồng bộ Đặt Phòng
                datPhong.TongTien = tongTien;
                datPhong.TrangThaiThanhToan = trangThaiThanhToan;

                await _context.SaveChangesAsync();
                await tx.CommitAsync();

                // Gửi email hóa đơn nếu đã thanh toán (online)
                if (hoaDon.TrangThaiThanhToan == 2)
                {
                    var email = datPhong.IdkhachHangNavigation?.Email;
                    var hoTen = datPhong.IdkhachHangNavigation?.HoTen ?? "Quý khách";
                    if (!string.IsNullOrWhiteSpace(email))
                    {
                        await SendInvoiceEmail(email, hoTen, hoaDon);
                    }
                }

                return Ok(new
                {
                    idHoaDon = hoaDon.IdhoaDon,
                    idDatPhong = datPhong.IddatPhong,
                    tongTien = hoaDon.TongTien,
                    tienCoc = hoaDon.TienCoc,
                    tienThanhToan = hoaDon.TienThanhToan
                });
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                _logger.LogError(ex, "Lỗi khi tạo hóa đơn");
                return StatusCode(500, new { message = "Lỗi khi tạo hóa đơn", error = ex.Message });
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

        // Gửi email hóa đơn VỚI BODY
        private async Task SendInvoiceEmail(string email, string hoTen, HoaDon hoaDon)
        {
            try
            {
                var emailSubject = $"✅ XÁC NHẬN THANH TOÁN THÀNH CÔNG - Mã hóa đơn #{hoaDon.IdhoaDon}";
                var emailBody = $@"
Kính gửi Quý khách {hoTen},

🎉 THANH TOÁN THÀNH CÔNG!
Cảm ơn Quý khách đã hoàn tất thanh toán đặt phòng tại Khách Sạn Robins Villa.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 THÔNG TIN HÓA ĐƠN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🧾 Mã hóa đơn:        {hoaDon.IdhoaDon}
📋 Mã đặt phòng:      {hoaDon.IddatPhong}
📅 Ngày lập:          {hoaDon.NgayLap:dd/MM/yyyy HH:mm:ss}
✅ Trạng thái:        ĐÃ THANH TOÁN THÀNH CÔNG

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 CHI TIẾT THANH TOÁN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

� Tiền phòng:        {hoaDon.TienPhong:N0} VNĐ
📆 Số ngày:           {hoaDon.Slngay} {(hoaDon.Slngay > 1 ? "ngày" : "ngày")}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💵 Tổng tiền:         {hoaDon.TongTien:N0} VNĐ
💸 Tiền cọc đã trả:   {hoaDon.TienCoc:N0} VNĐ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💳 Số tiền đã thanh toán: {hoaDon.TienThanhToan:N0} VNĐ

✅ TRẠNG THÁI: ĐÃ THANH TOÁN HOÀN TẤT

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{(string.IsNullOrEmpty(hoaDon.GhiChu) ? "" : $"📝 GHI CHÚ\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n{hoaDon.GhiChu}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")}
📧 Hóa đơn điện tử này có giá trị như hóa đơn gốc.
📱 Vui lòng xuất trình email này khi làm thủ tục nhận phòng.

🏨 Chúng tôi rất mong được phục vụ Quý khách!
Chúc Quý khách có một kỳ nghỉ tuyệt vời tại Robins Villa!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Trân trọng,
Khách Sạn Robins Villa
📧 Email: nguyenduonglechi.1922@gmail.com
📞 Hotline: 1900-xxxx (24/7)
";
                await SafeSendEmailAsync(email, hoTen, emailSubject, emailBody);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Lỗi khi gửi email hóa đơn tới {Email}", email);
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