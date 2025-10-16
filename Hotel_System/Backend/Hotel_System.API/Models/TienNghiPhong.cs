using System;
using System.Collections.Generic;

namespace Hotel_System.API.Models;

public partial class TienNghiPhong
{
    public string IdtienNghiPhong { get; set; } = null!;

    public string Idphong { get; set; } = null!;

    public string IdtienNghi { get; set; } = null!;

    public virtual Phong IdphongNavigation { get; set; } = null!;

    public virtual TienNghi IdtienNghiNavigation { get; set; } = null!;
}
