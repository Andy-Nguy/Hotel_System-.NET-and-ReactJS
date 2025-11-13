using System;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
// using Hotel_System.API.Data;
using Hotel_System.API.Models;
using Hotel_System.API.DTOs;
using Hotel_System.API.Services;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Hotel_System.API.Controllers
{

[ApiController]
[Route("api/[controller]")]
public class BookingController : ControllerBase
{
    private readonly HotelSystemContext _context;
    private readonly ILogger<BookingController> _logger;

    public BookingController(HotelSystemContext context, ILogger<BookingController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpPost("create")]
    public async Task<IActionResult> CreateBooking([FromBody] CreateBookingRequest request)
    {
        using var transaction = await _context.Database.BeginTransactionAsync();
        
        try
        {
            _logger.LogInformation("Creating booking for customer: {Email}", request.Email);

            // 1. Tạo hoặc lấy khách hàng
            var khachHang = await _context.KhachHangs
                .FirstOrDefaultAsync(k => k.Email == request.Email);

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

            // 2. Tính toán
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

            // 3. Tạo đơn đặt phòng - thêm milliseconds để tránh duplicate
            var datPhongId = $"DP{DateTime.Now:yyyyMMddHHmmssfff}";
            var datPhong = new DatPhong
            {
                IddatPhong = datPhongId,
                IdkhachHang = khachHang.IdkhachHang,
                Idphong = request.Rooms.First().IdPhong, // Phòng đầu tiên
                NgayDatPhong = DateOnly.FromDateTime(DateTime.Now),
                NgayNhanPhong = ngayNhan,
                NgayTraPhong = ngayTra,
                SoDem = soDem,
                TongTien = tongCong,
                TienCoc = 0,
                TrangThai = 1, // 1 = Chờ xác nhận (sau khi đặt phòng)
                TrangThaiThanhToan = 1 // 1 = Chưa thanh toán (khởi tạo)
            };
            _context.DatPhongs.Add(datPhong);
            await _context.SaveChangesAsync();

            // 4. Tạo chi tiết đặt phòng cho từng phòng
            foreach (var room in request.Rooms)
            {
                var thanhTien = room.GiaCoBanMotDem * soDem;
                var chiTiet = new ChiTietDatPhong
                {
                    IDDatPhong = datPhongId,
                    IDPhong = room.IdPhong,
                    SoDem = soDem,
                    GiaPhong = room.GiaCoBanMotDem,
                    ThanhTien = thanhTien
                };
                _context.ChiTietDatPhongs.Add(chiTiet);
            }
            await _context.SaveChangesAsync();

            // ✅ KHÔNG TẠO HÓA ĐƠN Ở ĐÂY
            // Hóa đơn chỉ được tạo khi khách thanh toán (PaymentPage gọi API riêng)

            await transaction.CommitAsync();

            _logger.LogInformation("Booking created successfully. Booking ID: {IdDatPhong}", datPhong.IddatPhong);

            return Ok(new
            {
                success = true,
                message = "Đặt phòng thành công",
                data = new
                {
                    // idHoaDon = null, // Chưa có hóa đơn
                    idDatPhong = datPhong.IddatPhong,
                    idKhachHang = khachHang.IdkhachHang,
                    bookingCode = datPhongId,
                    tongTien = tongTien,
                    thue = thue,
                    tongCong = tongCong,
                    trangThai = "Chờ thanh toán"
                }
            });
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "Error creating booking");
            return BadRequest(new
            {
                success = false,
                message = "Đặt phòng thất bại: " + ex.Message
            });
        }
    }

    /// <summary>
    /// GET: api/Booking/{bookingId}
    /// Lấy chi tiết đơn đặt phòng
    /// </summary>
    [HttpGet("{bookingId}")]
    public async Task<IActionResult> GetBookingDetail(string bookingId)
    {
        try
        {
            var datPhong = await _context.DatPhongs
                .Include(dp => dp.IdkhachHangNavigation)
                .Include(dp => dp.ChiTietDatPhongs)
                .Include(dp => dp.HoaDons)
                .FirstOrDefaultAsync(dp => dp.IddatPhong == bookingId);

            if (datPhong == null)
            {
                return NotFound(new { message = "Không tìm thấy đơn đặt phòng" });
            }

            var hoaDon = datPhong.HoaDons.FirstOrDefault();

            // Lấy thông tin phòng cho từng chi tiết
            var roomDetails = new List<object>();
            foreach (var ct in datPhong.ChiTietDatPhongs)
            {
                var phong = await _context.Phongs
                    .Include(p => p.IdloaiPhongNavigation)
                    .FirstOrDefaultAsync(p => p.Idphong == ct.IDPhong);
                
                if (phong != null)
                {
                    roomDetails.Add(new
                    {
                        idPhong = phong.Idphong,
                        soPhong = phong.SoPhong,
                        tenPhong = phong.IdloaiPhongNavigation?.TenLoaiPhong,
                        giaPhong = ct.GiaPhong,
                        soDem = ct.SoDem,
                        thanhTien = ct.ThanhTien
                    });
                }
            }

            return Ok(new
            {
                success = true,
                data = new
                {
                    idDatPhong = datPhong.IddatPhong,
                    idHoaDon = hoaDon?.IdhoaDon,
                    bookingCode = datPhong.IddatPhong,
                    customer = new
                    {
                        id = datPhong.IdkhachHang,
                        hoTen = datPhong.IdkhachHangNavigation?.HoTen,
                        email = datPhong.IdkhachHangNavigation?.Email,
                        soDienThoai = datPhong.IdkhachHangNavigation?.SoDienThoai
                    },
                    ngayDatPhong = datPhong.NgayDatPhong?.ToString("yyyy-MM-dd"),
                    ngayNhanPhong = datPhong.NgayNhanPhong.ToString("yyyy-MM-dd"),
                    ngayTraPhong = datPhong.NgayTraPhong.ToString("yyyy-MM-dd"),
                    soDem = datPhong.SoDem,
                    tongTien = datPhong.TongTien,
                    tienCoc = datPhong.TienCoc,
                    trangThai = datPhong.TrangThai,
                    trangThaiText = datPhong.TrangThai switch
                    {
                        0 => "Chờ xử lý",
                        1 => "Đã xác nhận",
                        2 => "Đã hủy",
                        _ => "Không xác định"
                    },
                    trangThaiThanhToan = datPhong.TrangThaiThanhToan,
                    trangThaiThanhToanText = datPhong.TrangThaiThanhToan switch
                    {
                        0 => "Chờ thanh toán",
                        1 => "Đã thanh toán",
                        _ => "Không xác định"
                    },
                    rooms = roomDetails
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting booking detail");
            return StatusCode(500, new { message = "Có lỗi xảy ra khi lấy thông tin đặt phòng" });
        }
    }

    /// <summary>
    /// GET: api/Booking/customer/{customerId}
    /// Lấy danh sách đơn đặt phòng của khách hàng
    /// </summary>
    [HttpGet("customer/{customerId}")]
    public async Task<IActionResult> GetCustomerBookings(int customerId)
    {
        try
        {
            var bookings = await _context.DatPhongs
                .Include(dp => dp.ChiTietDatPhongs)
                .Include(dp => dp.HoaDons)
                .Where(dp => dp.IdkhachHang == customerId)
                .OrderByDescending(dp => dp.NgayDatPhong)
                .ToListAsync();

            var result = bookings.Select(dp => new
            {
                idDatPhong = dp.IddatPhong,
                idHoaDon = dp.HoaDons.FirstOrDefault()?.IdhoaDon,
                bookingCode = dp.IddatPhong,
                ngayDatPhong = dp.NgayDatPhong?.ToString("yyyy-MM-dd"),
                ngayNhanPhong = dp.NgayNhanPhong.ToString("yyyy-MM-dd"),
                ngayTraPhong = dp.NgayTraPhong.ToString("yyyy-MM-dd"),
                soDem = dp.SoDem,
                soPhong = dp.ChiTietDatPhongs.Count,
                tongTien = dp.TongTien,
                trangThai = dp.TrangThai,
                trangThaiText = dp.TrangThai switch
                {
                    0 => "Chờ xử lý",
                    1 => "Đã xác nhận",
                    2 => "Đã hủy",
                    _ => "Không xác định"
                },
                trangThaiThanhToan = dp.TrangThaiThanhToan,
                trangThaiThanhToanText = dp.TrangThaiThanhToan switch
                {
                    0 => "Chờ thanh toán",
                    1 => "Đã thanh toán",
                    _ => "Không xác định"
                }
            }).ToList();

            return Ok(new
            {
                success = true,
                data = result
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting customer bookings");
            return StatusCode(500, new { message = "Có lỗi xảy ra" });
        }
    }

    /// <summary>
    /// DELETE: api/Booking/{bookingId}/cancel
    /// Hủy đặt phòng
    /// </summary>
    [HttpDelete("{bookingId}/cancel")]
    public async Task<IActionResult> CancelBooking(string bookingId)
    {
        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            var datPhong = await _context.DatPhongs.FindAsync(bookingId);
            if (datPhong == null)
            {
                return NotFound(new { message = "Không tìm thấy đơn đặt phòng" });
            }

            // Kiểm tra đã thanh toán chưa
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
            
            // Cập nhật hóa đơn
            var hoaDon = await _context.HoaDons.FirstOrDefaultAsync(h => h.IddatPhong == bookingId);
            if (hoaDon != null)
            {
                hoaDon.TrangThaiThanhToan = 2; // Đã hủy
            }

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            _logger.LogInformation("Booking {BookingId} cancelled successfully", bookingId);

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

/// <summary>
/// Request để thay đổi thời gian đặt phòng
/// </summary>
public class RescheduleRequest
{
    public string NgayNhanPhong { get; set; } = string.Empty;
    public string NgayTraPhong { get; set; } = string.Empty;
}


/// <summary>
/// Controller xử lý quy trình đặt phòng hoàn chỉnh - 3 APIs riêng biệt
/// API 1: Tạo đặt phòng (DatPhong) - Trạng thái luôn "Chờ xác nhận"
/// API 2: Tạo chi tiết đặt phòng (ChiTietDatPhong) - Lưu tất cả phòng với cùng IDDatPhong
/// API 3: Tạo hóa đơn và xử lý thanh toán (HoaDon) - Theo phương thức thanh toán
/// API 4: Cập nhật trạng thái thanh toán (Callback từ cổng thanh toán)
/// </summary>
[Route("api/[controller]")]
[ApiController]
public class BookingCompleteController : ControllerBase
{
    private readonly HotelSystemContext _context;
    private readonly ILogger<BookingCompleteController> _logger;
    private readonly IEmailService _emailService;

    public BookingCompleteController(
        HotelSystemContext context, 
        ILogger<BookingCompleteController> logger,
        IEmailService emailService)
    {
        _context = context;
        _logger = logger;
        _emailService = emailService;
    }

    
    /// <summary>
    /// Lấy thông báo thành công theo phương thức thanh toán
    /// </summary>
    private string GetSuccessMessage(int phuongThuc)
    {
        return phuongThuc switch
        {
            1 => "Tạo hóa đơn thành công. Khách hàng sẽ thanh toán tiền mặt khi đến.",
            2 => "Tạo hóa đơn thành công. Đang chuyển hướng sang cổng thanh toán online...",
            3 => "Tạo hóa đơn thành công. Khách hàng sẽ thanh toán sau tại quầy.",
            _ => "Tạo hóa đơn thành công."
        };
    }

    /// <summary>
    /// Lấy text trạng thái thanh toán
    /// </summary>
    private string GetPaymentStatusText(int trangThai)
    {
        return trangThai switch
        {
            -1 => "Chưa cọc",
            0 => "Chưa thanh toán",
            1 => "Đã cọc",
            2 => "Đã thanh toán",
            _ => "Không xác định"
        };
    }
}

}
