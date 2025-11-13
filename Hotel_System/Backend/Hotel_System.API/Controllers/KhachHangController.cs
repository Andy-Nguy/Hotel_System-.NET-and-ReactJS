using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Hotel_System.API.Models;

namespace Hotel_System.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class KhachHangController : ControllerBase
    {
        private readonly HotelSystemContext _context;
        private readonly ILogger<KhachHangController> _logger;

        public KhachHangController(HotelSystemContext context, ILogger<KhachHangController> logger)
        {
            _context = context;
            _logger = logger;
        }

        /// <summary>
        /// GET /api/KhachHang - Lấy danh sách tất cả khách hàng với điểm tích lũy
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetAllCustomers()
        {
            try
            {
                var customers = await _context.KhachHangs
                    .Select(kh => new
                    {
                        IdKhachHang = kh.IdkhachHang,
                        TenKhachHang = kh.HoTen,
                        Email = kh.Email,
                        SoDienThoai = kh.SoDienThoai,
                        NgaySinh = kh.NgaySinh,
                        NgayDangKy = kh.NgayDangKy,
                        TichDiem = kh.TichDiem ?? 0
                    })
                    .OrderByDescending(kh => kh.TichDiem)
                    .ToListAsync();

                return Ok(customers);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching customer list");
                return StatusCode(500, new { error = "Không thể lấy danh sách khách hàng" });
            }
        }

        /// <summary>
        /// GET /api/KhachHang/{id} - Lấy thông tin chi tiết khách hàng
        /// </summary>
        [HttpGet("{id}")]
        public async Task<IActionResult> GetCustomerById(int id)
        {
            try
            {
                var customer = await _context.KhachHangs
                    .Where(kh => kh.IdkhachHang == id)
                    .Select(kh => new
                    {
                        IdKhachHang = kh.IdkhachHang,
                        TenKhachHang = kh.HoTen,
                        Email = kh.Email,
                        SoDienThoai = kh.SoDienThoai,
                        NgaySinh = kh.NgaySinh,
                        NgayDangKy = kh.NgayDangKy,
                        TichDiem = kh.TichDiem ?? 0
                    })
                    .FirstOrDefaultAsync();

                if (customer == null)
                    return NotFound(new { error = "Không tìm thấy khách hàng" });

                return Ok(customer);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching customer {CustomerId}", id);
                return StatusCode(500, new { error = "Không thể lấy thông tin khách hàng" });
            }
        }

        /// <summary>
        /// PUT /api/KhachHang/{id}/points - Cập nhật điểm tích lũy (admin only)
        /// </summary>
        [HttpPut("{id}/points")]
        public async Task<IActionResult> UpdatePoints(int id, [FromBody] UpdatePointsRequest request)
        {
            try
            {
                var customer = await _context.KhachHangs.FindAsync(id);
                if (customer == null)
                    return NotFound(new { error = "Không tìm thấy khách hàng" });

                customer.TichDiem = (customer.TichDiem ?? 0) + request.Points;
                
                // Đảm bảo điểm không âm
                if (customer.TichDiem < 0)
                    customer.TichDiem = 0;

                await _context.SaveChangesAsync();

                _logger.LogInformation("Updated points for customer {CustomerId}: {Points} (reason: {Reason})", 
                    id, request.Points, request.Reason);

                return Ok(new
                {
                    IdKhachHang = customer.IdkhachHang,
                    TenKhachHang = customer.HoTen,
                    TichDiem = customer.TichDiem
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating points for customer {CustomerId}", id);
                return StatusCode(500, new { error = "Không thể cập nhật điểm" });
            }
        }
    }

    public class UpdatePointsRequest
    {
        public int Points { get; set; }
        public string? Reason { get; set; }
    }
}
