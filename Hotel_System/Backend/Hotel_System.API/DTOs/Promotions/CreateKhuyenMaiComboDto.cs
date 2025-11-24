using System;
using System.Collections.Generic;

namespace Hotel_System.API.DTOs.Promotions;

public class CreateKhuyenMaiComboDto
{
    public string IdkhuyenMai { get; set; } = null!; // existing promotion id to attach combo to

    public string TenCombo { get; set; } = null!;

    public string? MoTa { get; set; }

    public DateOnly? NgayBatDau { get; set; }

    public DateOnly? NgayKetThuc { get; set; }

    public List<string> DichVuIds { get; set; } = new List<string>();

    public bool ForceCreateIfConflict { get; set; } = false;
}
