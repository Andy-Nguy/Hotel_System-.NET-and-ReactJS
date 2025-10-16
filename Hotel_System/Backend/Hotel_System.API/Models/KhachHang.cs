using System;
using System.Collections.Generic;

namespace Hotel_System.API.Models;

public partial class KhachHang
{
    public int IdkhachHang { get; set; }

    public string HoTen { get; set; } = null!;

    public DateOnly? NgaySinh { get; set; }

    public string? SoDienThoai { get; set; }

    public string? Email { get; set; }

    public DateOnly? NgayDangKy { get; set; }

    public int? TichDiem { get; set; }

    public virtual ICollection<DanhGium> DanhGia { get; set; } = new List<DanhGium>();

    public virtual ICollection<DatPhong> DatPhongs { get; set; } = new List<DatPhong>();

    public virtual ICollection<TaiKhoanNguoiDung> TaiKhoanNguoiDungs { get; set; } = new List<TaiKhoanNguoiDung>();
}
