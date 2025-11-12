namespace Hotel_System.API.DTOs.Promotions;

public class CreateKhuyenMaiPhongDto
{
    public string IdkhuyenMai { get; set; } = null!;
    public string Idphong { get; set; } = null!;
    public bool IsActive { get; set; } = true;
    public DateOnly? NgayApDung { get; set; }
    public DateOnly? NgayKetThuc { get; set; }
}

public class UpdateKhuyenMaiPhongDto
{
    public bool IsActive { get; set; }
    public DateOnly? NgayApDung { get; set; }
    public DateOnly? NgayKetThuc { get; set; }
}
