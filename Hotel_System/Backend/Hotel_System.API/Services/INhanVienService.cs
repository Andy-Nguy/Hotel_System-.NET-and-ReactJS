using System.Collections.Generic;
using System.Threading.Tasks;
using Hotel_System.API.DTOs;

namespace Hotel_System.API.Services
{
    public interface INhanVienService
    {
        /// <summary>
        /// Lấy danh sách tất cả nhân viên (VaiTro = 1) và admin (VaiTro = 2)
        /// </summary>
        Task<List<NhanVienDTO>> LayDanhSachNhanVien();

        /// <summary>
        /// Lấy thông tin nhân viên theo ID người dùng
        /// </summary>
        Task<NhanVienDTO?> LayNhanVienTheoId(int idNguoiDung);

        /// <summary>
        /// Tạo nhân viên mới
        /// </summary>
        Task<(bool success, string? error, NhanVienDTO? nhanVien)> TaoNhanVien(TaoNhanVienRequest request);

        /// <summary>
        /// Cập nhật thông tin nhân viên
        /// </summary>
        Task<(bool success, string? error)> CapNhatNhanVien(int idNguoiDung, CapNhatNhanVienRequest request);

        /// <summary>
        /// Đổi mật khẩu nhân viên
        /// </summary>
        Task<(bool success, string? error)> DoiMatKhauNhanVien(int idNguoiDung, string matKhauMoi);

        /// <summary>
        /// Xóa nhân viên
        /// </summary>
        Task<(bool success, string? error)> XoaNhanVien(int idNguoiDung);
    }
}
