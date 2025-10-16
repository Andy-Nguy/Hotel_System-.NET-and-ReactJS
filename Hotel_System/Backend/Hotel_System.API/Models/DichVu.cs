using System;
using System.Collections.Generic;

namespace Hotel_System.API.Models;

public partial class DichVu
{
    public string IddichVu { get; set; } = null!;

    public string TenDichVu { get; set; } = null!;

    public decimal? TienDichVu { get; set; }

    public string? HinhDichVu { get; set; }

    public virtual ICollection<Cthddv> Cthddvs { get; set; } = new List<Cthddv>();

    public virtual ICollection<TtdichVu> TtdichVus { get; set; } = new List<TtdichVu>();
}
