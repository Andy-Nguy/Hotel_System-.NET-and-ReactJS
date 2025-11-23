using System;
using System.Collections.Generic;

namespace Hotel_System.API.Models;

public partial class DichVu
{
    public string IddichVu { get; set; } = null!;

    public string TenDichVu { get; set; } = null!;

    public decimal? TienDichVu { get; set; }

    public string? HinhDichVu { get; set; }

    // New columns from updated schema
    // SQL TIME maps to TimeSpan in .NET
    public TimeSpan? ThoiGianBatDau { get; set; }
    public TimeSpan? ThoiGianKetThuc { get; set; }

    // Status: "Đang hoạt động" or "Ngưng hoạt động"
    public string? TrangThai { get; set; }

    public virtual ICollection<Cthddv> Cthddvs { get; set; } = new List<Cthddv>();

    public virtual ICollection<TtdichVu> TtdichVus { get; set; } = new List<TtdichVu>();
    public virtual ICollection<KhuyenMaiDichVu> KhuyenMaiDichVus { get; set; } = new List<KhuyenMaiDichVu>();
}
