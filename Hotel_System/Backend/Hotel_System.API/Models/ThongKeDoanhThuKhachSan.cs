using System;
using System.Collections.Generic;

namespace Hotel_System.API.Models;

public partial class ThongKeDoanhThuKhachSan
{
    public int Id { get; set; }

    public string? IdhoaDon { get; set; }

    public string? IddatPhong { get; set; }

    public DateOnly Ngay { get; set; }

    public int? TongPhong { get; set; }

    public int? SoDemDaDat { get; set; }

    public decimal? TienPhong { get; set; }

    public decimal? TienDichVu { get; set; }

    public decimal? TienGiamGia { get; set; }

    public decimal? DoanhThuThucNhan { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public virtual DatPhong? IddatPhongNavigation { get; set; }

    public virtual HoaDon? IdhoaDonNavigation { get; set; }
}
