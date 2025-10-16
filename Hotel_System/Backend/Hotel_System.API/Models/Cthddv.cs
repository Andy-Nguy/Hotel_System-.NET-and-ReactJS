using System;
using System.Collections.Generic;

namespace Hotel_System.API.Models;

public partial class Cthddv
{
    public int Idcthddv { get; set; }

    public string IdhoaDon { get; set; } = null!;

    public string IddichVu { get; set; } = null!;

    public decimal? TienDichVu { get; set; }

    public DateTime? ThoiGianThucHien { get; set; }

    public virtual DichVu IddichVuNavigation { get; set; } = null!;

    public virtual HoaDon IdhoaDonNavigation { get; set; } = null!;
}
