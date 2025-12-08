using System;
using System.Collections.Generic;

namespace Hotel_System.API.Models;

public partial class Cthddv
{
    public int Idcthddv { get; set; }

    public string IdhoaDon { get; set; } = null!;

    public string? IddichVu { get; set; }

    public decimal? TienDichVu { get; set; }

    // Applied promotion id (optional) for audit/tracking
    public string? IdkhuyenMai { get; set; }
    
    // New column for Combo
    public string? IdkhuyenMaiCombo { get; set; }

    public DateTime? ThoiGianThucHien { get; set; }

    // New columns from updated schema
    public DateTime? ThoiGianBatDau { get; set; }
    public DateTime? ThoiGianKetThuc { get; set; }
    public string? TrangThai { get; set; }

    public virtual DichVu? IddichVuNavigation { get; set; }

    public virtual HoaDon IdhoaDonNavigation { get; set; } = null!;
    
    public virtual KhuyenMaiCombo? IdkhuyenMaiComboNavigation { get; set; }
}
