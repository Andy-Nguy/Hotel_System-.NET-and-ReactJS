using Hotel_System.API.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace Hotel_System.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class CheckInController : ControllerBase
    {
        private readonly HotelSystemContext _context;
        private readonly ILogger<CheckInController> _logger;
        private readonly Hotel_System.API.Services.IEmailService _emailService;

        public CheckInController(HotelSystemContext context, ILogger<CheckInController> logger, Hotel_System.API.Services.IEmailService emailService)
        {
            _context = context;
            _logger = logger;
            _emailService = emailService;
        }

        private async Task<bool> TrySendEmailAsync(string to, string subject, string body)
        {
            try
            {
                var type = _emailService.GetType();

                var m5 = type.GetMethod("SendEmailAsync", new[] { typeof(string), typeof(string), typeof(string), typeof(string), typeof(bool) });
                if (m5 != null)
                {
                    var task = (Task)m5.Invoke(_emailService, new object[] { to, subject, body, true, true })!; 
                    await task.ConfigureAwait(false);
                    return true;
                }

                var m4 = type.GetMethod("SendEmailAsync", new[] { typeof(string), typeof(string), typeof(string), typeof(string) });
                if (m4 != null)
                {
                    var task = (Task)m4.Invoke(_emailService, new object[] { to, subject, body })!;
                    await task.ConfigureAwait(false);
                    return true;
                }

                // fallback to common 3-arg signature
                await _emailService.SendEmailAsync(to, subject, body);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "TrySendEmailAsync failed to send to {To}", to);
                return false;
            }
        }

        // GET: api/CheckIn
        // Return bookings that are currently 'Đang sử dụng' (TrangThai == 3)
        [HttpGet]
        public async Task<IActionResult> GetUsingBookings()
        {
            var list = await _context.DatPhongs
                .Where(dp => dp.TrangThai == 3)
                .Include(dp => dp.ChiTietDatPhongs)
                .Include(dp => dp.IdkhachHangNavigation)
                .Include(dp => dp.IdphongNavigation)
                .Select(dp => new
                {
                    IddatPhong = dp.IddatPhong,
                    TenKhachHang = dp.IdkhachHangNavigation != null ? dp.IdkhachHangNavigation.HoTen : null,
                    EmailKhachHang = dp.IdkhachHangNavigation != null ? dp.IdkhachHangNavigation.Email : null,
                    Idphong = dp.Idphong,
                    TenPhong = dp.IdphongNavigation != null ? dp.IdphongNavigation.TenPhong : null,
                    SoPhong = dp.IdphongNavigation != null ? dp.IdphongNavigation.SoPhong : null,
                    NgayNhanPhong = dp.NgayNhanPhong,
                    NgayTraPhong = dp.NgayTraPhong,
                    SoDem = dp.SoDem,
                    TongTien = dp.TongTien,
                    TienCoc = dp.TienCoc,
                    TrangThai = dp.TrangThai,
                    TrangThaiThanhToan = dp.TrangThaiThanhToan
                })
                .ToListAsync();

            return Ok(list);
        }

        // GET: api/CheckIn/today
        // Return bookings that have NgayNhanPhong == today and TrangThai == 2 (ready/confirmed)
        [HttpGet("today")]
        public async Task<IActionResult> GetTodayBookings()
        {
            var today = DateOnly.FromDateTime(DateTime.Now);

            // Return bookings for today that are either "Đã nhận phòng" (2) or "Đang sử dụng" (3)
            var list = await _context.DatPhongs
                .Where(dp => dp.NgayNhanPhong == today && (dp.TrangThai == 2 || dp.TrangThai == 3))
                .Include(dp => dp.ChiTietDatPhongs)
                .Include(dp => dp.IdkhachHangNavigation)
                .Include(dp => dp.IdphongNavigation)
                .Select(dp => new
                {
                    IddatPhong = dp.IddatPhong,
                    TenKhachHang = dp.IdkhachHangNavigation != null ? dp.IdkhachHangNavigation.HoTen : null,
                    EmailKhachHang = dp.IdkhachHangNavigation != null ? dp.IdkhachHangNavigation.Email : null,
                    Idphong = dp.Idphong,
                    TenPhong = dp.IdphongNavigation != null ? dp.IdphongNavigation.TenPhong : null,
                    SoPhong = dp.IdphongNavigation != null ? dp.IdphongNavigation.SoPhong : null,
                    NgayNhanPhong = dp.NgayNhanPhong,
                    NgayTraPhong = dp.NgayTraPhong,
                    SoDem = dp.SoDem,
                    TongTien = dp.TongTien,
                    TienCoc = dp.TienCoc,
                    TrangThai = dp.TrangThai,
                    TrangThaiThanhToan = dp.TrangThaiThanhToan
                })
                .ToListAsync();

            return Ok(list);
        }

        // GET: api/CheckIn/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> Get(string id)
        {
            if (string.IsNullOrWhiteSpace(id)) return BadRequest(new { message = "Mã đặt phòng không hợp lệ." });
            var booking = await _context.DatPhongs
                .Include(dp => dp.ChiTietDatPhongs)
                .Include(dp => dp.IdkhachHangNavigation)
                .Include(dp => dp.IdphongNavigation)
                .Include(dp => dp.HoaDons)
                    .ThenInclude(h => h.Cthddvs)
                        .ThenInclude(c => c.IddichVuNavigation)
                .FirstOrDefaultAsync(dp => dp.IddatPhong == id);

            if (booking == null) return NotFound(new { message = "Không tìm thấy đặt phòng." });

            // Project to a safe DTO to avoid EF circular references during JSON serialization
            var result = new
            {
                booking.IddatPhong,
                booking.IdkhachHang,
                TenKhachHang = booking.IdkhachHangNavigation?.HoTen,
                EmailKhachHang = booking.IdkhachHangNavigation?.Email,
                booking.Idphong,
                TenPhong = booking.IdphongNavigation?.TenPhong,
                SoPhong = booking.IdphongNavigation?.SoPhong,
                NgayDatPhong = booking.NgayDatPhong.HasValue ? booking.NgayDatPhong.Value.ToString("yyyy-MM-dd") : null,
                NgayNhanPhong = booking.NgayNhanPhong.ToString("yyyy-MM-dd"),
                NgayTraPhong = booking.NgayTraPhong.ToString("yyyy-MM-dd"),
                booking.SoDem,
                SoNguoi = booking.SoNguoi,
                booking.TongTien,
                booking.TienCoc,
                booking.TrangThai,
                booking.TrangThaiThanhToan,
                ChiTietDatPhongs = booking.ChiTietDatPhongs.Select(ct => new
                {
                    ct.IDChiTiet,
                    ct.IDPhong,
                    TenPhongChiTiet = (ct as dynamic)?.Phong?.TenPhong ?? ct.IDPhong,
                    SoPhongChiTiet = (ct as dynamic)?.Phong?.SoPhong,
                    ct.SoDem,
                    ct.GiaPhong,
                    ct.ThanhTien,
                    ct.GhiChu
                }).ToList(),
                HoaDons = booking.HoaDons.Select(hd => new
                {
                    hd.IdhoaDon,
                    hd.IddatPhong,
                    hd.NgayLap,
                    hd.TongTien,
                    hd.TrangThaiThanhToan,
                    Cthddvs = hd.Cthddvs.Select(ct => new
                    {
                        ct.Idcthddv,
                        ct.IddichVu,
                        TenDichVu = ct.IddichVuNavigation?.TenDichVu,
                        TienDichVu = ct.TienDichVu,
                        ct.ThoiGianThucHien
                    }).ToList()
                }).ToList()
            };

            return Ok(result);
        }

        // POST: api/CheckIn/start/{id}
        // Mark the booking as 'Đang sử dụng' (TrangThai = 3) and set NgayNhanPhong to now if not set
        [HttpPost("start/{id}")]
        public async Task<IActionResult> StartCheckIn(string id)
        {
            if (string.IsNullOrWhiteSpace(id)) return BadRequest(new { message = "Mã đặt phòng không hợp lệ." });

            var booking = await _context.DatPhongs.FirstOrDefaultAsync(dp => dp.IddatPhong == id);
            if (booking == null) return NotFound(new { message = "Không tìm thấy đặt phòng." });

            try
            {
                booking.TrangThai = 3; // Đang sử dụng
                // If NgayNhanPhong is default, set to today
                if (booking.NgayNhanPhong == default)
                    booking.NgayNhanPhong = DateOnly.FromDateTime(DateTime.Now);

                await _context.SaveChangesAsync();
                return Ok(new { message = "Bắt đầu nhận phòng thành công.", bookingId = booking.IddatPhong, trangThai = booking.TrangThai });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi bắt đầu nhận phòng cho {Id}", id);
                return StatusCode(500, new { message = "Lỗi server.", error = ex.Message });
            }
        }

    // PUT/POST: api/CheckIn/confirm/{id}
    // Confirm a booking as 'Đang sử dụng' (TrangThai = 3). Accepts either PUT or POST for compatibility.
    [HttpPost("confirm/{id}")]
        public async Task<IActionResult> ConfirmCheckIn(string id)
        {
            if (string.IsNullOrWhiteSpace(id)) return BadRequest(new { message = "Mã đặt phòng không hợp lệ." });

            var booking = await _context.DatPhongs
                .Include(dp => dp.IdkhachHangNavigation)
                .Include(dp => dp.IdphongNavigation)
                .FirstOrDefaultAsync(dp => dp.IddatPhong == id);
            if (booking == null) return NotFound(new { message = "Không tìm thấy đặt phòng." });

            try
            {
                booking.TrangThai = 3; // Đang sử dụng
                if (booking.NgayNhanPhong == default)
                    booking.NgayNhanPhong = DateOnly.FromDateTime(DateTime.Now);

                await _context.SaveChangesAsync();
                // send notification email if we have customer's email
                bool emailSent = false;
                try
                {
                    var email = booking.IdkhachHangNavigation?.Email;
                    var customerName = booking.IdkhachHangNavigation?.HoTen ?? "Khách hàng";
                    if (!string.IsNullOrWhiteSpace(email))
                    {
                        var subject = $"Xác nhận nhận phòng - {booking.IddatPhong}";
                        var roomName = booking.IdphongNavigation?.TenPhong ?? booking.Idphong;
                        // Prepare date/time and guest info safely
                        var checkinDt = booking.NgayNhanPhong.ToDateTime(new TimeOnly(14, 0));
                        var checkoutDt = booking.NgayTraPhong.ToDateTime(new TimeOnly(12, 0));
                        var checkinStr = checkinDt.ToString("dddd, dd/MM/yyyy 'lúc' HH:mm");
                        var checkoutStr = checkoutDt.ToString("dddd, dd/MM/yyyy 'lúc' HH:mm");
                        var nights = (booking.NgayTraPhong.ToDateTime(new TimeOnly(0, 0)) - booking.NgayNhanPhong.ToDateTime(new TimeOnly(0, 0))).Days;
                        var soKhach = booking.SoNguoi ?? 1;
                        var soTreEm = 0; // field for children not present in model; default to 0

                        var body = $"<p>Xin chào <strong>{customerName}</strong>,</p>" +
           $"<p>Chúng tôi rất vui mừng thông báo: Đơn đặt phòng <strong>{booking.IddatPhong}</strong> của Quý khách đã được xác nhận và <strong>NHẬN PHÒNG THÀNH CÔNG</strong>!</p>" +
           $"<p><strong>≡ THÔNG TIN LƯU TRÚ ≡</strong><br/>" +
           $"• Họ & tên: {customerName}<br/>" +
           $"• Loại phòng: <strong>{roomName}</strong><br/>" +
           $"• Số phòng: <strong>{booking.Idphong}</strong><br/>" +
           $"• Ngày nhận phòng: {checkinStr}<br/>" +
           $"• Ngày trả phòng: {checkoutStr}<br/>" +
           $"• Số đêm nghỉ: <strong>{nights} đêm</strong><br/>" +
           $"• Số lượng khách: {soKhach} người lớn{(soTreEm > 0 ? $", {soTreEm} trẻ em" : "")} </p>" +
           $"• Dịch vụ phòng 24/7: Bấm số 034444444 từ điện thoại trong phòng<br/>" +
           $"• Yêu cầu trả phòng muộn: Liên hệ lễ tân trước 10:00</p>" +
           $"<p>Nếu cần hỗ trợ bất kỳ lúc nào, Quý khách vui lòng liên hệ lễ tân qua số máy lẻ <strong>0</strong> hoặc hotline <strong>0909 888 999</strong>.</p>" +
           $"<p>Chúc Quý khách có kỳ nghỉ thật tuyệt vời và đáng nhớ tại Robins Villa!</p>" +
           $"<p>Trân trọng,</p>" +
           $"<p>Khách sạn Robins Villa</p>";

                        emailSent = await TrySendEmailAsync(email, subject, body);
                    }
                }
                catch (Exception ex2)
                {
                    _logger.LogError(ex2, "Lỗi gửi email xác nhận cho đặt phòng {Id}", id);
                }

                return Ok(new { message = "Xác nhận nhận phòng thành công.", bookingId = booking.IddatPhong, trangThai = booking.TrangThai, emailSent });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi xác nhận nhận phòng cho {Id}", id);
                return StatusCode(500, new { message = "Lỗi server.", error = ex.Message });
            }
        }

    // PUT/POST: api/CheckIn/cancel/{id}
    // Cancel a booking (no-show) and set the room status to empty/available
    [HttpPut("cancel/{id}")]
        public async Task<IActionResult> CancelBooking(string id)
        {
            if (string.IsNullOrWhiteSpace(id)) return BadRequest(new { message = "Mã đặt phòng không hợp lệ." });

            var booking = await _context.DatPhongs
                .Include(dp => dp.IdphongNavigation)
                .FirstOrDefaultAsync(dp => dp.IddatPhong == id);

            if (booking == null) return NotFound(new { message = "Không tìm thấy đặt phòng." });

            try
            {
                // 0 = Hủy (as defined in schema)
                booking.TrangThai = 0;

                // If the room navigation is present, mark the room as empty/available
                if (booking.IdphongNavigation != null)
                {
                    booking.IdphongNavigation.TrangThai = "Trống";
                }

                await _context.SaveChangesAsync();

                return Ok(new { message = "Hủy đặt phòng thành công.", bookingId = booking.IddatPhong, trangThai = booking.TrangThai });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi hủy đặt phòng {Id}", id);
                return StatusCode(500, new { message = "Lỗi server.", error = ex.Message });
            }
        }

        // POST: api/CheckIn/complete-payment/{id}
        // Mark the booking as paid (TrangThaiThanhToan = 2) but keep TrangThai unchanged (e.g., still 3 = Đang sử dụng)
        [HttpPost("complete-payment/{id}")]
        public async Task<IActionResult> CompletePayment(string id)
        {
            if (string.IsNullOrWhiteSpace(id)) return BadRequest(new { message = "Mã đặt phòng không hợp lệ." });

            var booking = await _context.DatPhongs.FirstOrDefaultAsync(dp => dp.IddatPhong == id);
            if (booking == null) return NotFound(new { message = "Không tìm thấy đặt phòng." });

            try
            {
                // Only change payment status to 'Đã thanh toán' (2). Do NOT change booking.TrangThai here.
                booking.TrangThaiThanhToan = 2;

                await _context.SaveChangesAsync();

                return Ok(new { message = "Cập nhật trạng thái thanh toán thành công.", bookingId = booking.IddatPhong, trangThai = booking.TrangThai, trangThaiThanhToan = booking.TrangThaiThanhToan });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi cập nhật trạng thái thanh toán cho {Id}", id);
                return StatusCode(500, new { message = "Lỗi server.", error = ex.Message });
            }
        }
    }
}
