namespace Hotel_System.API.DTOs.Promotions;

public class KhuyenMaiDto
{
    public string IdkhuyenMai { get; set; } = null!;
    public string TenKhuyenMai { get; set; } = null!;
    public string? MoTa { get; set; }
    public string LoaiGiamGia { get; set; } = null!; // "percent" hoặc "amount"
    public decimal? GiaTriGiam { get; set; }
    public DateOnly NgayBatDau { get; set; }
    public DateOnly NgayKetThuc { get; set; }
    public string? TrangThai { get; set; } // "active", "inactive", "expired"
    public string? HinhAnhBanner { get; set; } // Đường dẫn tương đối đến hình ảnh banner
    public DateTime? CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public List<KhuyenMaiPhongDto> KhuyenMaiPhongs { get; set; } = new();
}

public class KhuyenMaiPhongDto
{
    public int Id { get; set; }
    public string Idphong { get; set; } = null!;
    public string TenPhong { get; set; } = null!;
    public bool IsActive { get; set; }
    public DateOnly? NgayApDung { get; set; }
    public DateOnly? NgayKetThuc { get; set; }
}
