﻿using System;
using System.Collections.Generic;

namespace Hotel_System.API.Models;

public partial class DatPhong
{
    public string IddatPhong { get; set; } = null!;

    public int? IdkhachHang { get; set; }

    public string Idphong { get; set; } = null!;

    public DateOnly? NgayDatPhong { get; set; }

    public DateOnly NgayNhanPhong { get; set; }

    public DateOnly NgayTraPhong { get; set; }

    public int? SoDem { get; set; }

    public decimal TongTien { get; set; }

    public decimal? TienCoc { get; set; }

    public int TrangThai { get; set; }

    public int TrangThaiThanhToan { get; set; }

    public virtual ICollection<HoaDon> HoaDons { get; set; } = new List<HoaDon>();

    public virtual KhachHang? IdkhachHangNavigation { get; set; }

    public virtual Phong IdphongNavigation { get; set; } = null!;

    public virtual ICollection<LichSuDatPhong> LichSuDatPhongs { get; set; } = new List<LichSuDatPhong>();

    public virtual ICollection<ThongKeDoanhThuKhachSan> ThongKeDoanhThuKhachSans { get; set; } = new List<ThongKeDoanhThuKhachSan>();
}
