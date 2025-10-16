using System;
using System.Collections.Generic;

namespace Hotel_System.API.Models;

public partial class KhuyenMai
{
    public string IdkhuyenMai { get; set; } = null!;

    public string TenKhuyenMai { get; set; } = null!;

    public string? MoTa { get; set; }

    public string LoaiGiamGia { get; set; } = null!;

    public decimal? GiaTriGiam { get; set; }

    public DateOnly NgayBatDau { get; set; }

    public DateOnly NgayKetThuc { get; set; }

    public string? TrangThai { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public virtual ICollection<KhuyenMaiPhong> KhuyenMaiPhongs { get; set; } = new List<KhuyenMaiPhong>();
}
