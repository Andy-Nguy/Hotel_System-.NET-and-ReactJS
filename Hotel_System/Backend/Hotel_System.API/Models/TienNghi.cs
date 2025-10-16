using System;
using System.Collections.Generic;

namespace Hotel_System.API.Models;

public partial class TienNghi
{
    public string IdtienNghi { get; set; } = null!;

    public string TenTienNghi { get; set; } = null!;

    public virtual ICollection<TienNghiPhong> TienNghiPhongs { get; set; } = new List<TienNghiPhong>();
}
