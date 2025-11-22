namespace Hotel_System.API.DTOs.Promotions;

public class CreateKhuyenMaiDto
{
    public string TenKhuyenMai { get; set; } = null!;
    public string LoaiKhuyenMai { get; set; } = "room"; // 'room' | 'service' | 'customer'
    public string? MoTa { get; set; }
    public string LoaiGiamGia { get; set; } = null!; // "percent" hoặc "amount"
    public decimal GiaTriGiam { get; set; }
    public DateOnly NgayBatDau { get; set; }
    public DateOnly NgayKetThuc { get; set; }
    public string? HinhAnhBanner { get; set; } // Đường dẫn tương đối đến hình ảnh banner
    public List<string> PhongIds { get; set; } = new(); // Danh sách ID phòng áp dụng
    public List<string> DichVuIds { get; set; } = new(); // Danh sách ID dịch vụ áp dụng
}

public class UpdateKhuyenMaiDto
{
    public string TenKhuyenMai { get; set; } = null!;
    public string LoaiKhuyenMai { get; set; } = "room"; // 'room' | 'service' | 'customer'
    public string? MoTa { get; set; }
    public string LoaiGiamGia { get; set; } = null!;
    public decimal GiaTriGiam { get; set; }
    public DateOnly NgayBatDau { get; set; }
    public DateOnly NgayKetThuc { get; set; }
    public string TrangThai { get; set; } = "active"; // active, inactive, expired
    public string? HinhAnhBanner { get; set; } // Đường dẫn tương đối đến hình ảnh banner
    public List<string> PhongIds { get; set; } = new();
    public List<string> DichVuIds { get; set; } = new();
}
