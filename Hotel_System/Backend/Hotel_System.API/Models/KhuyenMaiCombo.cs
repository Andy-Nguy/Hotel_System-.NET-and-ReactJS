using System;
using System.Collections.Generic;

namespace Hotel_System.API.Models;

public partial class KhuyenMaiCombo
{
    public string IdkhuyenMaiCombo { get; set; } = null!;

    public string IdkhuyenMai { get; set; } = null!;

    public string TenCombo { get; set; } = null!;

    public string? MoTa { get; set; }

    public DateOnly? NgayBatDau { get; set; }

    public DateOnly? NgayKetThuc { get; set; }

    public string? TrangThai { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public virtual KhuyenMai IdkhuyenMaiNavigation { get; set; } = null!;

    public virtual ICollection<KhuyenMaiComboDichVu> KhuyenMaiComboDichVus { get; set; } = new List<KhuyenMaiComboDichVu>();
}
