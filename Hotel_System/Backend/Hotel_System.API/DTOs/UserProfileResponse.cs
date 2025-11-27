namespace Hotel_System.API.DTOs
{
    public class UserProfileResponse
    {
        public int IdkhachHang { get; set; }
        public string HoTen { get; set; } = null!;
        public DateOnly? NgaySinh { get; set; }
        public string? SoDienThoai { get; set; }
        public string? Email { get; set; }
        public DateOnly? NgayDangKy { get; set; }
        public int? TichDiem { get; set; }
        public byte? VaiTro { get; set; }  // 0 = khachhang, 1 = nhanvien
    }
}