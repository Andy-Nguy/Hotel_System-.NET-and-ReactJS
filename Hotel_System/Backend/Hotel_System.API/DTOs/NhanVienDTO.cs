using System;

namespace Hotel_System.API.DTOs
{
    /// <summary>
    /// DTO hiển thị thông tin nhân viên
    /// </summary>
    public class NhanVienDTO
    {
        public int IdNguoiDung { get; set; }
        public int IdKhachHang { get; set; }
        public string HoTen { get; set; } = string.Empty;
        public string? Email { get; set; }
        public string? SoDienThoai { get; set; }
        public DateOnly? NgaySinh { get; set; }
        public DateOnly? NgayDangKy { get; set; }
        public byte VaiTro { get; set; } // 0: khách hàng, 1: nhân viên, 2: admin
        public string TenVaiTro => VaiTro switch
        {
            0 => "Khách hàng",
            1 => "Nhân viên",
            2 => "Admin",
            _ => "Không xác định"
        };
    }

    /// <summary>
    /// DTO tạo nhân viên mới
    /// </summary>
    public class TaoNhanVienRequest
    {
        public string HoTen { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string MatKhau { get; set; } = string.Empty;
        public string? SoDienThoai { get; set; }
        public DateOnly? NgaySinh { get; set; }
        public byte VaiTro { get; set; } = 1; // Mặc định là nhân viên
    }

    /// <summary>
    /// DTO cập nhật thông tin nhân viên
    /// </summary>
    public class CapNhatNhanVienRequest
    {
        public string? HoTen { get; set; }
        public string? Email { get; set; }
        public string? SoDienThoai { get; set; }
        public DateOnly? NgaySinh { get; set; }
        public byte? VaiTro { get; set; }
    }

    /// <summary>
    /// DTO đổi mật khẩu nhân viên
    /// </summary>
    public class DoiMatKhauNhanVienRequest
    {
        public string MatKhauMoi { get; set; } = string.Empty;
    }
}
