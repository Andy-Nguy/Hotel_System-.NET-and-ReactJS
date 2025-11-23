namespace Hotel_System.API.DTOs.Promotions;

public class CreateKhuyenMaiDichVuDto
{
    public string IddichVu { get; set; } = null!;
    public bool IsActive { get; set; } = true;
    public DateOnly? NgayApDung { get; set; }
    public DateOnly? NgayKetThuc { get; set; }
}
