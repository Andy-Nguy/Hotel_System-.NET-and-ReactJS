using System;
using System.Collections.Generic;

namespace Hotel_System.API.Models;

public partial class Phong
{
    public string Idphong { get; set; } = null!;

    public string? IdloaiPhong { get; set; }

    public string? TenPhong { get; set; }

    public string SoPhong { get; set; } = null!;

    public string? MoTa { get; set; }

    public int? SoNguoiToiDa { get; set; }

    public decimal? GiaCoBanMotDem { get; set; }

    public int? XepHangSao { get; set; }

    public string? TrangThai { get; set; }

    /// <summary>
    /// JSON array of room images (1-6 images).
    /// Index 0 is the primary/banner image and is mandatory.
    /// Stored as JSONB in PostgreSQL; string array in memory.
    /// </summary>
    public List<string> UrlAnhPhong { get; set; } = new();

    public virtual ICollection<DanhGium> DanhGia { get; set; } = new List<DanhGium>();

    public virtual ICollection<DatPhong> DatPhongs { get; set; } = new List<DatPhong>();

    public virtual LoaiPhong? IdloaiPhongNavigation { get; set; }

    public virtual ICollection<KhuyenMaiPhong> KhuyenMaiPhongs { get; set; } = new List<KhuyenMaiPhong>();

    public virtual ICollection<TienNghiPhong> TienNghiPhongs { get; set; } = new List<TienNghiPhong>();
}
