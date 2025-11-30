using Microsoft.AspNetCore.Mvc;
using Hotel_System.API.DTOs;
using Hotel_System.API.Services;

namespace Hotel_System.API.Controllers
{
    /// <summary>
    /// Controller quản lý nhân viên
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class QuanLyNhanVienController : ControllerBase
    {
        private readonly INhanVienService _nhanVienService;
        private readonly ILogger<QuanLyNhanVienController> _logger;

        public QuanLyNhanVienController(INhanVienService nhanVienService, ILogger<QuanLyNhanVienController> logger)
        {
            _nhanVienService = nhanVienService;
            _logger = logger;
        }

        /// <summary>
        /// GET /api/QuanLyNhanVien - Lấy danh sách tất cả nhân viên
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> LayDanhSachNhanVien()
        {
            try
            {
                var danhSach = await _nhanVienService.LayDanhSachNhanVien();
                return Ok(new { success = true, data = danhSach, total = danhSach.Count });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi lấy danh sách nhân viên");
                return StatusCode(500, new { success = false, error = "Có lỗi xảy ra khi lấy danh sách nhân viên" });
            }
        }

        /// <summary>
        /// GET /api/QuanLyNhanVien/{id} - Lấy thông tin chi tiết nhân viên
        /// </summary>
        [HttpGet("{id}")]
        public async Task<IActionResult> LayNhanVienTheoId(int id)
        {
            try
            {
                var nhanVien = await _nhanVienService.LayNhanVienTheoId(id);
                if (nhanVien == null)
                {
                    return NotFound(new { success = false, error = "Không tìm thấy nhân viên" });
                }
                return Ok(new { success = true, data = nhanVien });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi lấy thông tin nhân viên ID: {Id}", id);
                return StatusCode(500, new { success = false, error = "Có lỗi xảy ra khi lấy thông tin nhân viên" });
            }
        }

        /// <summary>
        /// POST /api/QuanLyNhanVien - Tạo nhân viên mới
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> TaoNhanVien([FromBody] TaoNhanVienRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.HoTen))
            {
                return BadRequest(new { success = false, error = "Họ tên không được để trống" });
            }

            if (string.IsNullOrWhiteSpace(request.Email))
            {
                return BadRequest(new { success = false, error = "Email không được để trống" });
            }

            if (string.IsNullOrWhiteSpace(request.MatKhau) || request.MatKhau.Length < 6)
            {
                return BadRequest(new { success = false, error = "Mật khẩu phải có ít nhất 6 ký tự" });
            }

            // Chỉ cho phép tạo nhân viên (1) hoặc admin (2)
            if (request.VaiTro != 1 && request.VaiTro != 2)
            {
                request.VaiTro = 1; // Mặc định là nhân viên
            }

            try
            {
                var (success, error, nhanVien) = await _nhanVienService.TaoNhanVien(request);
                
                if (!success)
                {
                    return BadRequest(new { success = false, error });
                }

                return CreatedAtAction(nameof(LayNhanVienTheoId), new { id = nhanVien!.IdNguoiDung }, 
                    new { success = true, message = "Tạo nhân viên thành công", data = nhanVien });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi tạo nhân viên");
                return StatusCode(500, new { success = false, error = "Có lỗi xảy ra khi tạo nhân viên" });
            }
        }

        /// <summary>
        /// PUT /api/QuanLyNhanVien/{id} - Cập nhật thông tin nhân viên
        /// </summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> CapNhatNhanVien(int id, [FromBody] CapNhatNhanVienRequest request)
        {
            try
            {
                var (success, error) = await _nhanVienService.CapNhatNhanVien(id, request);
                
                if (!success)
                {
                    return BadRequest(new { success = false, error });
                }

                return Ok(new { success = true, message = "Cập nhật thông tin nhân viên thành công" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi cập nhật nhân viên ID: {Id}", id);
                return StatusCode(500, new { success = false, error = "Có lỗi xảy ra khi cập nhật thông tin nhân viên" });
            }
        }

        /// <summary>
        /// PUT /api/QuanLyNhanVien/{id}/doi-mat-khau - Đổi mật khẩu nhân viên
        /// </summary>
        [HttpPut("{id}/doi-mat-khau")]
        public async Task<IActionResult> DoiMatKhauNhanVien(int id, [FromBody] DoiMatKhauNhanVienRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.MatKhauMoi) || request.MatKhauMoi.Length < 6)
            {
                return BadRequest(new { success = false, error = "Mật khẩu mới phải có ít nhất 6 ký tự" });
            }

            try
            {
                var (success, error) = await _nhanVienService.DoiMatKhauNhanVien(id, request.MatKhauMoi);
                
                if (!success)
                {
                    return BadRequest(new { success = false, error });
                }

                return Ok(new { success = true, message = "Đổi mật khẩu nhân viên thành công" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi đổi mật khẩu nhân viên ID: {Id}", id);
                return StatusCode(500, new { success = false, error = "Có lỗi xảy ra khi đổi mật khẩu nhân viên" });
            }
        }

        /// <summary>
        /// DELETE /api/QuanLyNhanVien/{id} - Xóa nhân viên
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> XoaNhanVien(int id)
        {
            try
            {
                var (success, error) = await _nhanVienService.XoaNhanVien(id);
                
                if (!success)
                {
                    return BadRequest(new { success = false, error });
                }

                return Ok(new { success = true, message = "Xóa nhân viên thành công" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi xóa nhân viên ID: {Id}", id);
                return StatusCode(500, new { success = false, error = "Có lỗi xảy ra khi xóa nhân viên" });
            }
        }

        /// <summary>
        /// GET /api/QuanLyNhanVien/thong-ke - Thống kê số lượng nhân viên
        /// </summary>
        [HttpGet("thong-ke")]
        public async Task<IActionResult> ThongKeNhanVien()
        {
            try
            {
                var danhSach = await _nhanVienService.LayDanhSachNhanVien();
                var thongKe = new
                {
                    TongSo = danhSach.Count,
                    SoNhanVien = danhSach.Count(nv => nv.VaiTro == 1),
                    SoAdmin = danhSach.Count(nv => nv.VaiTro == 2)
                };

                return Ok(new { success = true, data = thongKe });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi thống kê nhân viên");
                return StatusCode(500, new { success = false, error = "Có lỗi xảy ra khi thống kê nhân viên" });
            }
        }
    }
}
