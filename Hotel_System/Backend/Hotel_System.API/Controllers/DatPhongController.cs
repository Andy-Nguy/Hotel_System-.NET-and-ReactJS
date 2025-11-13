using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Hotel_System.API.Models;
using Hotel_System.API.Services;

namespace Hotel_System.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class DatPhongController : ControllerBase
    {
        private readonly HotelSystemContext _context;
        private readonly IEmailService _emailService;
        private readonly ILogger<DatPhongController> _logger;

        public DatPhongController(HotelSystemContext context, IEmailService emailService, ILogger<DatPhongController> logger)
        {
            _context = context;
            _emailService = emailService;
            _logger = logger;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            try
            {
                var bookings = await _context.DatPhongs
                    .Include(dp => dp.IdkhachHangNavigation)
                    .Include(dp => dp.IdphongNavigation)
                    .Include(dp => dp.ChiTietDatPhongs)
                        .ThenInclude(ct => ct.Phong)
                    .ToListAsync();

                var result = bookings.Select(dp => new
                {
                    dp.IddatPhong,
                    dp.IdkhachHang,
                    TenKhachHang = dp.IdkhachHangNavigation?.HoTen,
                    EmailKhachHang = dp.IdkhachHangNavigation?.Email,
                    dp.Idphong,
                    TenPhong = dp.IdphongNavigation?.TenPhong,
                    SoPhong = dp.IdphongNavigation?.SoPhong,
                    dp.NgayDatPhong,
                    dp.NgayNhanPhong,
                    dp.NgayTraPhong,
                    dp.SoDem,
                    dp.TongTien,
                    dp.TienCoc,
                    dp.TrangThai,
                    dp.TrangThaiThanhToan,
                    ChiTietDatPhongs = dp.ChiTietDatPhongs.Select(ct => new
                    {
                        ct.IDChiTiet,
                        ct.IDPhong,
                        TenPhongChiTiet = ct.Phong?.TenPhong,
                        SoPhongChiTiet = ct.Phong?.SoPhong,
                        ct.SoDem,
                        ct.GiaPhong,
                        ct.ThanhTien,
                        ct.GhiChu
                    }).ToList()
                }).ToList();

                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(string id)
        {
            try
            {
                var booking = await _context.DatPhongs
                    .Include(dp => dp.IdkhachHangNavigation)
                    .Include(dp => dp.IdphongNavigation)
                    .Include(dp => dp.ChiTietDatPhongs)
                        .ThenInclude(ct => ct.Phong)
                    .FirstOrDefaultAsync(dp => dp.IddatPhong == id);

                if (booking == null)
                {
                    return NotFound(new { message = "Đặt phòng không tồn tại." });
                }

                var result = new
                {
                    booking.IddatPhong,
                    booking.IdkhachHang,
                    TenKhachHang = booking.IdkhachHangNavigation?.HoTen,
                    EmailKhachHang = booking.IdkhachHangNavigation?.Email,
                    booking.Idphong,
                    TenPhong = booking.IdphongNavigation?.TenPhong,
                    SoPhong = booking.IdphongNavigation?.SoPhong,
                    booking.NgayDatPhong,
                    booking.NgayNhanPhong,
                    booking.NgayTraPhong,
                    booking.SoDem,
                    booking.TongTien,
                    booking.TienCoc,
                    booking.TrangThai,
                    booking.TrangThaiThanhToan,
                    ChiTietDatPhongs = booking.ChiTietDatPhongs.Select(ct => new
                    {
                        ct.IDChiTiet,
                        ct.IDPhong,
                        TenPhongChiTiet = ct.Phong?.TenPhong,
                        SoPhongChiTiet = ct.Phong?.SoPhong,
                        ct.SoDem,
                        ct.GiaPhong,
                        ct.ThanhTien,
                        ct.GhiChu
                    }).ToList()
                };

                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(string id, [FromBody] UpdateBookingRequest request)
        {
            if (request == null)
            {
                return BadRequest(new { message = "Dữ liệu không hợp lệ." });
            }

            try
            {
                var booking = await _context.DatPhongs
                    .Include(dp => dp.IdkhachHangNavigation)
                    .Include(dp => dp.IdphongNavigation)
                    .FirstOrDefaultAsync(dp => dp.IddatPhong == id);
                if (booking == null)
                {
                    return NotFound(new { message = "Đặt phòng không tồn tại." });
                }

                // remember old status to detect changes
                var oldStatus = booking.TrangThai;

                // Cập nhật các trường cho phép
                if (request.TrangThai.HasValue)
                {
                    booking.TrangThai = request.TrangThai.Value;
                }
                if (request.TrangThaiThanhToan.HasValue)
                {
                    booking.TrangThaiThanhToan = request.TrangThaiThanhToan.Value;
                }

                await _context.SaveChangesAsync();

                // If status changed to confirmed (2) or cancelled (0) -> send email
                if (oldStatus != booking.TrangThai)
                {
                    var to = booking.IdkhachHangNavigation?.Email;
                    if (!string.IsNullOrWhiteSpace(to))
                    {
                        try
                        {
                            if (booking.TrangThai == 2)
                            {
                                var subject = "Xác nhận đặt phòng - " + booking.IddatPhong;
                                var body = $"Xin chào {booking.IdkhachHangNavigation?.HoTen},<br/><br/>Đặt phòng <strong>{booking.IddatPhong}</strong> của bạn đã được xác nhận.<br/>Ngày nhận: {booking.NgayNhanPhong:d}<br/>Ngày trả: {booking.NgayTraPhong:d}<br/>Tổng tiền: {booking.TongTien:C}<br/><br/>Cảm ơn bạn đã sử dụng dịch vụ.";
                                await _emailService.SendEmailAsync(to, subject, body, true);
                                _logger.LogInformation("Sent confirmation email to {email} for booking {id}", to, booking.IddatPhong);
                            }
                            else if (booking.TrangThai == 0)
                            {
                                var subject = "Hủy đặt phòng - " + booking.IddatPhong;
                                var body = $"Xin chào {booking.IdkhachHangNavigation?.HoTen},<br/><br/>Đặt phòng <strong>{booking.IddatPhong}</strong> đã được hủy. Nếu bạn đã thanh toán, bộ phận kế toán sẽ liên hệ để hoàn tiền (nếu có).<br/><br/>Nếu có thắc mắc, vui lòng liên hệ lại khách sạn.";
                                await _emailService.SendEmailAsync(to, subject, body, true);
                                _logger.LogInformation("Sent cancellation email to {email} for booking {id}", to, booking.IddatPhong);
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "Failed to send email to {email} for booking {id}", to, booking.IddatPhong);
                        }
                    }
                    else
                    {
                        _logger.LogWarning("Booking {id} status changed but customer has no email configured", booking.IddatPhong);
                    }
                }

                return Ok(new { message = "Cập nhật đặt phòng thành công." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            try
            {
                var booking = await _context.DatPhongs.FindAsync(id);
                if (booking == null)
                {
                    return NotFound(new { message = "Đặt phòng không tồn tại." });
                }

                _context.DatPhongs.Remove(booking);
                await _context.SaveChangesAsync();

                return Ok(new { message = "Xóa đặt phòng thành công." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }
    }

    public class UpdateBookingRequest
    {
        public int? TrangThai { get; set; }
        public int? TrangThaiThanhToan { get; set; }
    }
}