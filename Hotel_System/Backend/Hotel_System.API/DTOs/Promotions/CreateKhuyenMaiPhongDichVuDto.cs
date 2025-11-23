using System;
namespace Hotel_System.API.DTOs.Promotions;

public class CreateKhuyenMaiPhongDichVuDto
{
    public string IdkhuyenMai { get; set; } = null!;

    public string Idphong { get; set; } = null!;

    public string IddichVu { get; set; } = null!;

    public DateOnly? NgayApDung { get; set; }

    public DateOnly? NgayKetThuc { get; set; }

    public bool IsActive { get; set; } = true;

    public bool ForceCreateIfConflict { get; set; } = false;
}
