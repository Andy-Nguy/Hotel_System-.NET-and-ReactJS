using System;
using System.Collections.Generic;

namespace Hotel_System.API.Models;

public partial class LichSuDatPhong
{
    public int IdlichSu { get; set; }

    public string IddatPhong { get; set; } = null!;

    public string? TrangThaiCu { get; set; }

    public string? TrangThaiMoi { get; set; }

    public DateTime? NgayCapNhat { get; set; }

    public string? GhiChu { get; set; }

    public virtual DatPhong IddatPhongNavigation { get; set; } = null!;
}
