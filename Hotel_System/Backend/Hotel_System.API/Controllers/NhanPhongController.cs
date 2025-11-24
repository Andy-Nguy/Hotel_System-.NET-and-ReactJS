using Hotel_System.API.Models;
using Microsoft.AspNetCore.Authorization;
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
    public class NhanPhongController : ControllerBase
    {
        private readonly HotelSystemContext _context;
        private readonly ILogger<NhanPhongController> _logger;
        private readonly Hotel_System.API.Services.IEmailService _emailService;
        private readonly Hotel_System.API.Services.EmailTemplateRenderer _templateRenderer;

        public NhanPhongController(HotelSystemContext context, ILogger<NhanPhongController> logger, Hotel_System.API.Services.IEmailService emailService, Hotel_System.API.Services.EmailTemplateRenderer templateRenderer)
        {
            _context = context;
            _logger = logger;
            _emailService = emailService;
            _templateRenderer = templateRenderer;
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

        // GET: api/NhanPhong
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

        // GET: api/NhanPhong/hom-nay
        // Return bookings that have NgayNhanPhong == today and TrangThai == 2 (ready/confirmed)
        [HttpGet("hom-nay")]
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

        // GET: api/NhanPhong/{id}
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


    // PUT/POST: api/NhanPhong/nhan-phong/{id}
    // Confirm a booking as 'Đang sử dụng' (TrangThai = 3). Accepts either PUT or POST for compatibility.
    [HttpPost("nhan-phong/{id}")]
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

                // Cập nhật trạng thái phòng thành "Đang sử dụng"
                if (booking.IdphongNavigation != null)
                {
                    booking.IdphongNavigation.TrangThai = "Đang sử dụng";
                }

                await _context.SaveChangesAsync();

                // Do not send emails here; simply acknowledge success to the operator
                return Ok(new { message = "Xác nhận nhận phòng thành công.", bookingId = booking.IddatPhong, trangThai = booking.TrangThai });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi xác nhận nhận phòng cho {Id}", id);
                return StatusCode(500, new { message = "Lỗi server.", error = ex.Message });
            }
        }

    // PUT/POST: api/NhanPhong/huy/{id}
    // Cancel a booking (no-show) and set the room status to empty/available
    [HttpPut("huy-xac-nhan/{id}")]
        public async Task<IActionResult> CancelBooking(string id)
        {
            if (string.IsNullOrWhiteSpace(id)) return BadRequest(new { message = "Mã đặt phòng không hợp lệ." });

            var booking = await _context.DatPhongs
                .Include(dp => dp.IdphongNavigation)
                .Include(dp => dp.ChiTietDatPhongs)
                    .ThenInclude(ct => ct.Phong)
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

                // Also sync all rooms in ChiTietDatPhongs (for multi-room bookings)
                if (booking.ChiTietDatPhongs != null)
                {
                    foreach (var chiTiet in booking.ChiTietDatPhongs)
                    {
                        if (chiTiet.Phong != null)
                        {
                            chiTiet.Phong.TrangThai = "Trống";
                        }
                    }
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

        // POST: api/NhanPhong/cap-nhat-thanh-toan/{id}
        // Mark the booking as paid (TrangThaiThanhToan = 2) but keep TrangThai unchanged (e.g., still 3 = Đang sử dụng)
        [HttpPost("cap-nhat-thanh-toan/{id}")]
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
