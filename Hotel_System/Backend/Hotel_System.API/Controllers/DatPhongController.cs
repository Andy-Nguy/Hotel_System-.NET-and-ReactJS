using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Hotel_System.API.Models;
using Hotel_System.API.Services;
using Hotel_System.API.DTOs;
using System.Security.Claims;

namespace Hotel_System.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class DatPhongController : ControllerBase
    {
        private readonly HotelSystemContext _context;
        private readonly IEmailService _emailService;
        private readonly ILogger<DatPhongController> _logger;
        private readonly Hotel_System.API.Services.EmailTemplateRenderer _templateRenderer;

        public DatPhongController(HotelSystemContext context, IEmailService emailService, ILogger<DatPhongController> logger, Hotel_System.API.Services.EmailTemplateRenderer templateRenderer)
        {
            _context = context;
            _emailService = emailService;
            _logger = logger;
            _templateRenderer = templateRenderer;
        }

        /// <summary>
        /// GET: api/DatPhong/LichSuDatPhong
        /// Trả về lịch sử đặt phòng của user hiện tại (theo JWT NameIdentifier => IdkhachHang)
        /// </summary>
        [HttpGet("LichSuDatPhong")]
        // [Microsoft.AspNetCore.Authorization.Authorize]
        public async Task<IActionResult> GetBookingHistory()
        {
            try
            {
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
                if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out var userId))
                {
                    return Unauthorized(new { message = "Token không hợp lệ hoặc không có thông tin người dùng." });
                }

                var bookings = await _context.DatPhongs
                    .Where(dp => dp.IdkhachHang == userId)
                    .Include(dp => dp.IdkhachHangNavigation)
                    .Include(dp => dp.IdphongNavigation)
                    .Include(dp => dp.ChiTietDatPhongs)
                        .ThenInclude(ct => ct.Phong)
                            .ThenInclude(p => p!.IdloaiPhongNavigation)
                    .Include(dp => dp.HoaDons)
                        .ThenInclude(h => h.Cthddvs)
                            .ThenInclude(c => c.IddichVuNavigation)
                    .OrderByDescending(dp => dp.NgayDatPhong)
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
                    NgayDatPhong = dp.NgayDatPhong.HasValue ? dp.NgayDatPhong.Value.ToString("yyyy-MM-dd") : null,
                    NgayNhanPhong = dp.NgayNhanPhong.ToString("yyyy-MM-dd"),
                    NgayTraPhong = dp.NgayTraPhong.ToString("yyyy-MM-dd"),
                    dp.SoDem,
                    dp.SoNguoi,
                    dp.SoLuongPhong,
                    dp.TongTien,
                    dp.TienCoc,
                    dp.TrangThai,
                    dp.TrangThaiThanhToan,
                    ChiTietDatPhongs = dp.ChiTietDatPhongs.Select(ct => new
                    {
                        ct.IDChiTiet,
                        ct.IDPhong,
                        TenPhongChiTiet = ct.Phong?.TenPhong,
                        MoTaPhongChiTiet = ct.Phong?.MoTa,
                        GiaCoBanMotDem = ct.Phong?.GiaCoBanMotDem,
                        IdLoaiPhong = ct.Phong?.IdloaiPhong,
                        TenLoaiPhong = ct.Phong?.IdloaiPhongNavigation?.TenLoaiPhong,
                        UrlAnhPhong = ct.Phong?.UrlAnhPhong,
                        SoNguoiToiDa = ct.Phong?.SoNguoiToiDa,
                        XepHangSao = ct.Phong?.XepHangSao,
                        SoPhongChiTiet = ct.Phong?.SoPhong,
                        ct.SoDem,
                        ct.GiaPhong,
                        ct.ThanhTien,
                        ct.GhiChu
                    }).ToList(),
                    Services = dp.HoaDons?.SelectMany(h => h.Cthddvs ?? new List<Cthddv>())
                        .Select(c => new
                        {
                            c.Idcthddv,
                            c.IdhoaDon,
                            c.IddichVu,
                            TenDichVu = c.IddichVuNavigation?.TenDichVu,
                            c.TienDichVu,
                            c.ThoiGianThucHien,
                            c.TrangThai
                        }).ToList()
                }).ToList();

                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi lấy lịch sử đặt phòng");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// POST: api/datphong/create
        /// Tạo DatPhong + ChiTietDatPhong (tạm giữ), không tạo Hóa đơn.
        /// Trả về idDatPhong, tongTien, holdExpiresAt.
        /// </summary>
        [HttpPost("create")]
        public async Task<IActionResult> CreateBooking([FromBody] CreateBookingRequest request)
        {
            if (request == null || request.Rooms == null || !request.Rooms.Any())
            {
                return BadRequest(new { success = false, message = "Dữ liệu không hợp lệ." });
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // 1. Tạo hoặc lấy khách hàng theo email (nếu có)
                var khachHang = await _context.KhachHangs.FirstOrDefaultAsync(k => k.Email == request.Email);
                if (khachHang == null)
                {
                    khachHang = new KhachHang
                    {
                        HoTen = request.HoTen,
                        Email = request.Email,
                        SoDienThoai = request.SoDienThoai,
                        NgayDangKy = DateOnly.FromDateTime(DateTime.Now)
                    };
                    _context.KhachHangs.Add(khachHang);
                    await _context.SaveChangesAsync();
                }

                // 2. Tính số đêm và tổng tiền (tính lại server-side)
                var ngayNhan = DateOnly.Parse(request.NgayNhanPhong);
                var ngayTra = DateOnly.Parse(request.NgayTraPhong);
                var soDem = ngayTra.DayNumber - ngayNhan.DayNumber;

                decimal tongTien = 0;
                foreach (var room in request.Rooms)
                {
                    tongTien += room.GiaCoBanMotDem * soDem;
                }

                var thue = tongTien * 0.1m;
                var tongCong = tongTien + thue;

                // 3. Tạo DatPhong (đồng thời lưu thời hạn giữ phòng - `ThoiHan`)
                var datPhongId = $"DP{DateTime.Now:yyyyMMddHHmmssfff}";
                // // Thiết lập thời hạn giữ phòng (test): 1 phút
                // var holdExpiresAt = DateTime.UtcNow.AddMinutes(1);
                var holdExpiresAt = DateTime.UtcNow.AddMinutes(15);

                var datPhong = new DatPhong
                {
                    IddatPhong = datPhongId,
                    IdkhachHang = khachHang.IdkhachHang,
                    // Lưu tạm Idphong bằng phòng đầu tiên để tránh null (sẽ chuyển sang dùng ChiTietDatPhong làm chuẩn)
                    Idphong = request.Rooms.First().IdPhong,
                    NgayDatPhong = DateOnly.FromDateTime(DateTime.Now),
                    NgayNhanPhong = ngayNhan,
                    NgayTraPhong = ngayTra,
                    SoDem = soDem,
                    SoNguoi = request.SoLuongKhach,
                    SoLuongPhong = request.Rooms?.Count ?? 0,
                    TongTien = tongCong,
                    TienCoc = 0,
                    TrangThai = 1, // 1 = Chờ xác nhận
                    TrangThaiThanhToan = 0, // 0 = Chưa thanh toán
                    ThoiHan = holdExpiresAt
                };
                _context.DatPhongs.Add(datPhong);
                await _context.SaveChangesAsync();

                // 4. Tạo ChiTietDatPhong cho từng phòng
                foreach (var room in request.Rooms ?? new List<RoomBookingDto>())
                {
                    var thanhTien = room.GiaCoBanMotDem * soDem;
                    var ct = new ChiTietDatPhong
                    {
                        IDDatPhong = datPhongId,
                        IDPhong = room.IdPhong,
                        SoDem = soDem,
                        GiaPhong = room.GiaCoBanMotDem,
                        ThanhTien = thanhTien,
                        GhiChu = request.GhiChu
                    };
                    _context.ChiTietDatPhongs.Add(ct);
                }
                await _context.SaveChangesAsync();

                await transaction.CommitAsync();

                // Gửi email thông báo giữ phòng (nếu có email khách)
                try
                {
                    var to = khachHang?.Email;
                    if (!string.IsNullOrWhiteSpace(to))
                    {
                        var placeholders = new Dictionary<string, string>
                        {
                            ["CustomerName"] = khachHang.HoTen ?? string.Empty,
                            ["BookingId"] = datPhong.IddatPhong,
                            ["Checkin"] = datPhong.NgayNhanPhong.ToString("yyyy-MM-dd"),
                            ["Checkout"] = datPhong.NgayTraPhong.ToString("yyyy-MM-dd"),
                            ["Nights"] = (datPhong.SoDem ?? 0).ToString(),
                            ["HoldExpires"] = datPhong.ThoiHan?.ToString("yyyy-MM-dd HH:mm 'UTC'") ?? string.Empty
                        };

                        var html = _templateRenderer.Render("booking_hold.html", placeholders);
                        if (!string.IsNullOrWhiteSpace(html))
                        {
                            await _emailService.SendEmailAsync(to, "Xác nhận giữ phòng - " + datPhong.IddatPhong, html, true);
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to send reservation hold email for booking {id}", datPhong.IddatPhong);
                }

                return Ok(new
                {
                    success = true,
                    message = "Đặt phòng tạm thành công",
                    data = new
                    {
                        idDatPhong = datPhong.IddatPhong,
                        tongTien = tongCong,
                        holdExpiresAt = datPhong.ThoiHan?.ToString("o")
                    }
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Lỗi khi tạo đặt phòng tạm");
                return StatusCode(500, new { success = false, message = "Đặt phòng thất bại: " + ex.Message });
            }
        }

        [HttpGet]
        // [Authorize(Roles = "nhanvien")]
        public async Task<IActionResult> GetAll()
        {
            try
            {
                var bookings = await _context.DatPhongs
                    .Include(dp => dp.IdkhachHangNavigation)
                    .Include(dp => dp.IdphongNavigation)
                    .Include(dp => dp.ChiTietDatPhongs)
                        .ThenInclude(ct => ct.Phong)
                            .ThenInclude(p => p!.IdloaiPhongNavigation)
                    .Include(dp => dp.HoaDons)
                        .ThenInclude(h => h.Cthddvs)
                            .ThenInclude(c => c.IddichVuNavigation)
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
                    NgayDatPhong = dp.NgayDatPhong.HasValue ? dp.NgayDatPhong.Value.ToString("yyyy-MM-dd") : null,
                    NgayNhanPhong = dp.NgayNhanPhong.ToString("yyyy-MM-dd"),
                    NgayTraPhong = dp.NgayTraPhong.ToString("yyyy-MM-dd"),
                    dp.SoDem,
                    dp.SoNguoi,
                    dp.SoLuongPhong,
                    dp.TongTien,
                    dp.TienCoc,
                    dp.TrangThai,
                    dp.TrangThaiThanhToan,
                    ChiTietDatPhongs = dp.ChiTietDatPhongs.Select(ct => new
                    {
                        ct.IDChiTiet,
                        ct.IDPhong,
                        TenPhongChiTiet = ct.Phong?.TenPhong,
                        MoTaPhongChiTiet = ct.Phong?.MoTa,
                        GiaCoBanMotDem = ct.Phong?.GiaCoBanMotDem,
                        IdLoaiPhong = ct.Phong?.IdloaiPhong,
                        TenLoaiPhong = ct.Phong?.IdloaiPhongNavigation?.TenLoaiPhong,
                        UrlAnhPhong = ct.Phong?.UrlAnhPhong,
                        SoNguoiToiDa = ct.Phong?.SoNguoiToiDa,
                        XepHangSao = ct.Phong?.XepHangSao,
                        SoPhongChiTiet = ct.Phong?.SoPhong,
                        ct.SoDem,
                        ct.GiaPhong,
                        ct.ThanhTien,
                        ct.GhiChu
                    }).ToList(),
                    DichVuDaChon = dp.HoaDons.SelectMany(h => h.Cthddvs).Select(c => new
                    {
                        c.Idcthddv,
                        c.IdhoaDon,
                        c.IddichVu,
                        TenDichVu = c.IddichVuNavigation?.TenDichVu,
                        GiaDichVu = c.IddichVuNavigation?.TienDichVu,
                        HinhDichVu = c.IddichVuNavigation?.HinhDichVu,
                        ThoiGianBatDauDichVu = c.IddichVuNavigation?.ThoiGianBatDau,
                        ThoiGianKetThucDichVu = c.IddichVuNavigation?.ThoiGianKetThuc,
                        TrangThaiDichVu = c.IddichVuNavigation?.TrangThai,
                        c.TienDichVu,
                        c.IdkhuyenMai,
                        c.ThoiGianThucHien,
                        c.ThoiGianBatDau,
                        c.ThoiGianKetThuc,
                        c.TrangThai
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
                    .Include(dp => dp.HoaDons)
                        .ThenInclude(h => h.Cthddvs)
                            .ThenInclude(c => c.IddichVuNavigation)
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
                    booking.SoNguoi,
                    booking.SoLuongPhong,
                    booking.TongTien,
                    booking.TienCoc,
                    booking.TrangThai,
                    booking.TrangThaiThanhToan,
                    ChiTietDatPhongs = booking.ChiTietDatPhongs.Select(ct => new
                    {
                        ct.IDChiTiet,
                        ct.IDPhong,
                        TenPhongChiTiet = ct.Phong?.TenPhong,
                        MoTaPhongChiTiet = ct.Phong?.MoTa,
                        GiaCoBanMotDem = ct.Phong?.GiaCoBanMotDem,
                        IdLoaiPhong = ct.Phong?.IdloaiPhong,
                        TenLoaiPhong = ct.Phong?.IdloaiPhongNavigation?.TenLoaiPhong,
                        UrlAnhPhong = ct.Phong?.UrlAnhPhong,
                        SoNguoiToiDa = ct.Phong?.SoNguoiToiDa,
                        XepHangSao = ct.Phong?.XepHangSao,
                        SoPhongChiTiet = ct.Phong?.SoPhong,
                        ct.SoDem,
                        ct.GiaPhong,
                        ct.ThanhTien,
                        ct.GhiChu
                    }).ToList()
                    ,
                    Services = booking.HoaDons?.SelectMany(h => h.Cthddvs ?? new List<Cthddv>())
                        .Select(c => new
                        {
                            c.Idcthddv,
                            c.IdhoaDon,
                            c.IddichVu,
                            TenDichVu = c.IddichVuNavigation?.TenDichVu,
                            c.TienDichVu,
                            c.ThoiGianThucHien,
                            c.TrangThai
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
                    .Include(dp => dp.ChiTietDatPhongs)
                        .ThenInclude(ct => ct.Phong)
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

                // Sync room status when admin confirms booking (TrangThai = 2)
                if (booking.TrangThai == 2 && oldStatus != 2)
                {
                    // Admin confirmed booking -> mark room as "Đã đặt"
                    if (booking.IdphongNavigation != null)
                    {
                        booking.IdphongNavigation.TrangThai = "Đã đặt";
                    }
                    // Also sync all rooms in ChiTietDatPhongs (for multi-room bookings)
                    if (booking.ChiTietDatPhongs != null)
                    {
                        foreach (var chiTiet in booking.ChiTietDatPhongs)
                        {
                            if (chiTiet.Phong != null)
                            {
                                chiTiet.Phong.TrangThai = "Đã đặt";
                            }
                        }
                    }
                }

                // Sync room status when admin cancels booking (TrangThai = 0)
                if (booking.TrangThai == 0 && oldStatus != 0)
                {
                    // Admin cancelled booking -> mark room as "Trống"
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
                            // NOTE: confirmation email on booking status change is intentionally disabled.
                            // We still send a cancellation email when the booking is cancelled.
                            if (booking.TrangThai == 0)
                            {
                                var subject = "Hủy đặt phòng - " + booking.IddatPhong;
                                var placeholders = new Dictionary<string, string>
                                {
                                    ["CustomerName"] = booking.IdkhachHangNavigation?.HoTen ?? string.Empty,
                                    ["BookingId"] = booking.IddatPhong
                                };
                                var html = _templateRenderer.Render("cancellation.html", placeholders);
                                if (!string.IsNullOrWhiteSpace(html))
                                {
                                    await _emailService.SendEmailAsync(to, subject, html, true);
                                    _logger.LogInformation("Sent cancellation email to {email} for booking {id}", to, booking.IddatPhong);
                                }
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
        // [Authorize(Roles = "nhanvien")]
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

        /// <summary>
        /// PUT: api/datphong/{id}/reschedule
        /// Thay đổi thời gian đặt phòng
        /// </summary>
        [HttpPut("{id}/reschedule")]
        public async Task<IActionResult> Reschedule(string id, [FromBody] RescheduleRequest request)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var datPhong = await _context.DatPhongs
                    .Include(dp => dp.ChiTietDatPhongs)
                    .FirstOrDefaultAsync(dp => dp.IddatPhong == id);

                if (datPhong == null)
                {
                    return NotFound(new { message = "Không tìm thấy đơn đặt phòng" });
                }

                // Ownership / staff check: only staff or the booking owner may reschedule
                /*
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
                if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out var userId))
                {
                    return Unauthorized(new { message = "Token không hợp lệ hoặc không có thông tin người dùng." });
                }
                if (!User.IsInRole("nhanvien") && datPhong.IdkhachHang != userId)
                {
                    return Forbid();
                }
                */

                // Kiểm tra trạng thái: chỉ cho phép thay đổi nếu chưa hủy
                if (datPhong.TrangThai == 2)
                {
                    return BadRequest(new { message = "Không thể thay đổi đơn đặt phòng đã hủy" });
                }

                // Kiểm tra thời gian: phải trước 24h so với ngày nhận phòng
                var now = DateOnly.FromDateTime(DateTime.Now);
                if (datPhong.NgayNhanPhong.AddDays(-1) <= now)
                {
                    return BadRequest(new { message = "Chỉ có thể thay đổi trước 24 giờ nhận phòng" });
                }

                var ngayNhanMoi = DateOnly.Parse(request.NgayNhanPhong);
                var ngayTraMoi = DateOnly.Parse(request.NgayTraPhong);
                var soDemMoi = ngayTraMoi.DayNumber - ngayNhanMoi.DayNumber;

                // Tính lại tổng tiền
                decimal tongTienMoi = 0;
                foreach (var chiTiet in datPhong.ChiTietDatPhongs)
                {
                    var thanhTienMoi = chiTiet.GiaPhong * soDemMoi;
                    chiTiet.SoDem = soDemMoi;
                    chiTiet.ThanhTien = thanhTienMoi;
                    tongTienMoi += thanhTienMoi;
                }

                var thueMoi = tongTienMoi * 0.1m;
                var tongCongMoi = tongTienMoi + thueMoi;

                datPhong.NgayNhanPhong = ngayNhanMoi;
                datPhong.NgayTraPhong = ngayTraMoi;
                datPhong.SoDem = soDemMoi;
                datPhong.TongTien = tongCongMoi;

                // Cập nhật hóa đơn nếu có
                var hoaDon = await _context.HoaDons.FirstOrDefaultAsync(h => h.IddatPhong == id);
                if (hoaDon != null)
                {
                    hoaDon.TongTien = tongCongMoi;
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                _logger.LogInformation("Booking {BookingId} rescheduled successfully", id);

                return Ok(new
                {
                    success = true,
                    message = "Thay đổi thời gian đặt phòng thành công",
                    data = new
                    {
                        idDatPhong = datPhong.IddatPhong,
                        ngayNhanPhong = datPhong.NgayNhanPhong.ToString("yyyy-MM-dd"),
                        ngayTraPhong = datPhong.NgayTraPhong.ToString("yyyy-MM-dd"),
                        soDem = datPhong.SoDem,
                        tongTien = tongTienMoi,
                        thue = thueMoi,
                        tongCong = tongCongMoi
                    }
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Error rescheduling booking");
                return StatusCode(500, new { message = "Có lỗi xảy ra: " + ex.Message });
            }
        }

        /// <summary>
        /// DELETE: api/datphong/{id}/cancel
        /// Hủy đặt phòng
        /// </summary>
        [HttpDelete("{id}/cancel")]
        public async Task<IActionResult> Cancel(string id)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var datPhong = await _context.DatPhongs.FindAsync(id);
                if (datPhong == null)
                {
                    return NotFound(new { message = "Không tìm thấy đơn đặt phòng" });
                }

                // Ownership / staff check: only staff or the booking owner may cancel
                /*
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
                if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out var userId))
                {
                    return Unauthorized(new { message = "Token không hợp lệ hoặc không có thông tin người dùng." });
                }
                if (!User.IsInRole("nhanvien") && datPhong.IdkhachHang != userId)
                {
                    return Forbid();
                }
                */

                // Kiểm tra đã thanh toán chưa (1 = đã thanh toán trong code cũ, adapt if different)
                if (datPhong.TrangThaiThanhToan == 1)
                {
                    return BadRequest(new { message = "Không thể hủy đơn đặt phòng đã thanh toán. Vui lòng liên hệ quầy để hoàn tiền." });
                }

                // Kiểm tra thời gian: phải trước 24h so với ngày nhận phòng
                var now = DateOnly.FromDateTime(DateTime.Now);
                if (datPhong.NgayNhanPhong.AddDays(-1) <= now)
                {
                    return BadRequest(new { message = "Chỉ có thể hủy trước 24 giờ nhận phòng" });
                }

                datPhong.TrangThai = 2; // Đã hủy

                // Cập nhật hóa đơn nếu có
                var hoaDon = await _context.HoaDons.FirstOrDefaultAsync(h => h.IddatPhong == id);
                if (hoaDon != null)
                {
                    hoaDon.TrangThaiThanhToan = 2; // Đã hủy
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                _logger.LogInformation("Booking {BookingId} cancelled successfully", id);

                return Ok(new
                {
                    success = true,
                    message = "Hủy đặt phòng thành công"
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Error cancelling booking");
                return StatusCode(500, new { message = "Có lỗi xảy ra: " + ex.Message });
            }
        }
    }

    public class UpdateBookingRequest
    {
        public int? TrangThai { get; set; }
        public int? TrangThaiThanhToan { get; set; }
    }

    /// <summary>
    /// Request để thay đổi thời gian đặt phòng
    /// </summary>
    public class RescheduleRequest
    {
        public string NgayNhanPhong { get; set; } = string.Empty;
        public string NgayTraPhong { get; set; } = string.Empty;
    }
}