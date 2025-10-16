using System;
using System.Collections.Generic;

namespace Hotel_System.API.Models;

public partial class HoaDon
{
    public string IdhoaDon { get; set; } = null!;

    public string IddatPhong { get; set; } = null!;

    public DateTime? NgayLap { get; set; }

    public int? TienPhong { get; set; }

    public int? Slngay { get; set; }

    public decimal TongTien { get; set; }

    public decimal? TienCoc { get; set; }

    public decimal? TienThanhToan { get; set; }

    public int? TrangThaiThanhToan { get; set; }

    public string? GhiChu { get; set; }

    public virtual ICollection<Cthddv> Cthddvs { get; set; } = new List<Cthddv>();

    public virtual DatPhong IddatPhongNavigation { get; set; } = null!;

    public virtual ICollection<ThongKeDoanhThuKhachSan> ThongKeDoanhThuKhachSans { get; set; } = new List<ThongKeDoanhThuKhachSan>();
}
