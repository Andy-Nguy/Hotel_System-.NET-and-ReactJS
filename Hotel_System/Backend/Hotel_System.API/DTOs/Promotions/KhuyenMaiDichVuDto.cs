namespace Hotel_System.API.DTOs.Promotions;

public class KhuyenMaiDichVuDto
{
    public int Id { get; set; }
    public string IdkhuyenMai { get; set; } = null!;
    public string IddichVu { get; set; } = null!;
    public bool IsActive { get; set; }
    public DateOnly? NgayApDung { get; set; }
    public DateOnly? NgayKetThuc { get; set; }
    public DateTime? CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string? TenDichVu { get; set; }
}
