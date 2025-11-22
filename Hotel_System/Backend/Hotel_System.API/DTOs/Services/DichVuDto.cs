namespace Hotel_System.API.Models
{
    // Lớp DTO (Data Transfer Object) gộp thông tin Dịch Vụ và Chi Tiết Dịch Vụ
    public class DichVuDto
    {
        // Thông tin từ 'DichVu'
        // IddichVu is optional — backend auto-generates if not provided
        public string? IddichVu { get; set; }
        public string TenDichVu { get; set; } = null!;
        public decimal? TienDichVu { get; set; }
        public string? HinhDichVu { get; set; }
        public TimeSpan? ThoiGianBatDau { get; set; }
        public TimeSpan? ThoiGianKetThuc { get; set; }
        public string? TrangThai { get; set; }

        // Thông tin từ 'TtdichVu' (lấy
        // TtdichVu đầu tiên liên quan)
        public string? IdttdichVu { get; set; } // Dùng để update
        public string? ThongTinDv { get; set; }
        public int? ThoiLuongUocTinh { get; set; }
        public string? GhiChu { get; set; }

        // Thông tin khuyến mãi (nếu có)
        public decimal? GiaKhuyenMai { get; set; }
        public string? TenKhuyenMai { get; set; }
        public double? PhanTramGiam { get; set; }
    }
}