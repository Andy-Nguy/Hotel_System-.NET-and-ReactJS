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

                // Với mọi kết quả thanh toán (đã thanh toán, đã đặt cọc, chưa thanh toán, thanh toán tại khách sạn):
                // - Đánh dấu đặt phòng là 'xác nhận' (1)
                // - Xoá hạn chờ (ThoiHan) để tránh auto-cancel
                datPhong.TrangThai = 1; // 1 = Xác nhận/đã giữ chấp nhận
                datPhong.ThoiHan = null;

                await _context.SaveChangesAsync();
                await tx.CommitAsync();

                // Gửi email hóa đơn cho tất cả các trường hợp (đã thanh toán, đã cọc, chưa thanh toán)
                var customerEmail = datPhong.IdkhachHangNavigation?.Email;
                var customerName = datPhong.IdkhachHangNavigation?.HoTen ?? "Quý khách";
                if (!string.IsNullOrWhiteSpace(customerEmail))
                {
                    await SendInvoiceEmail(customerEmail, customerName, hoaDon);
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

                var emailBody = $@"
xacnhandatphong HÓA ĐƠN - XÁC NHẬN GIAO DỊCH - Mã hóa đơn #{hoaDon.IdhoaDon}

Kính gửi Quý khách {hoTen},

Cảm ơn Quý khách đã đặt phòng tại Khách Sạn Robins Villa. Thông tin đặt phòng và hóa đơn đã được lưu lại trong hệ thống.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 THÔNG TIN HÓA ĐƠN & ĐẶT PHÒNG
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🧾 Mã hóa đơn:        {hoaDon.IdhoaDon}
📋 Mã đặt phòng:      {hoaDon.IddatPhong}
📅 Ngày lập:          {hoaDon.NgayLap:dd/MM/yyyy HH:mm:ss}
📌 Trạng thái thanh toán: {paymentStatusText}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 CHI TIẾT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• Tiền phòng:        {hoaDon.TienPhong:N0} VNĐ
• Số ngày:           {hoaDon.Slngay}
• Tổng tiền:         {hoaDon.TongTien:N0} VNĐ
• Tiền cọc đã trả:   {hoaDon.TienCoc:N0} VNĐ
• Số tiền đã thanh toán: {hoaDon.TienThanhToan:N0} VNĐ

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{(string.IsNullOrEmpty(hoaDon.GhiChu) ? "" : $"📝 GHI CHÚ: {hoaDon.GhiChu}\n\n")}

Vui lòng mang theo email này khi làm thủ tục nhận phòng. Nếu Quý khách cần hỗ trợ thêm, vui lòng liên hệ hotline hoặc trả lời email này.

Trân trọng,
Khách Sạn Robins Villa
📧 Email: nguyenduonglechi.1922@gmail.com
📞 Hotline: 1900-xxxx (24/7)
";

                await SafeSendEmailAsync(email, hoTen, emailSubject, emailBody);
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
