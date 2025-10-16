using System;
using System.Collections.Generic;

namespace Hotel_System.API.Models;

public partial class LoaiPhong
{
    public string IdloaiPhong { get; set; } = null!;

    public string TenLoaiPhong { get; set; } = null!;

    public string? MoTa { get; set; }

    public string? UrlAnhLoaiPhong { get; set; }

    public virtual ICollection<Phong> Phongs { get; set; } = new List<Phong>();
}
