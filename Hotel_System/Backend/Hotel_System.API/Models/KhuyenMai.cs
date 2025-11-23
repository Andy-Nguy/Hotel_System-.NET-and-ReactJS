using System;
using System.Collections.Generic;

namespace Hotel_System.API.Models;

public partial class KhuyenMai
{
    public string IdkhuyenMai { get; set; } = null!;

    public string TenKhuyenMai { get; set; } = null!;

    public string? MoTa { get; set; }

    public string LoaiGiamGia { get; set; } = null!;

    // Loại khuyến mãi: 'room', 'service', 'customer'
    public string LoaiKhuyenMai { get; set; } = "room";

    public decimal? GiaTriGiam { get; set; }

    public DateOnly NgayBatDau { get; set; }

    public DateOnly NgayKetThuc { get; set; }

    public string? TrangThai { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public string? HinhAnhBanner { get; set; }

    public virtual ICollection<KhuyenMaiPhong> KhuyenMaiPhongs { get; set; } = new List<KhuyenMaiPhong>();
    public virtual ICollection<KhuyenMaiDichVu> KhuyenMaiDichVus { get; set; } = new List<KhuyenMaiDichVu>();
    public virtual ICollection<KhuyenMaiCombo> KhuyenMaiCombos { get; set; } = new List<KhuyenMaiCombo>();
    public virtual ICollection<KhuyenMaiPhongDichVu> KhuyenMaiPhongDichVus { get; set; } = new List<KhuyenMaiPhongDichVu>();
}
