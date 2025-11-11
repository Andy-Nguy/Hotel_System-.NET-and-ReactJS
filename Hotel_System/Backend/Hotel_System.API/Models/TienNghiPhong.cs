using System;
using System.Collections.Generic;

namespace Hotel_System.API.Models;

public partial class TienNghiPhong
{
    // Allow model binding when client posts minimal payload (Idphong, IdtienNghi)
    public string? IdtienNghiPhong { get; set; }

    public string Idphong { get; set; } = null!;

    public string IdtienNghi { get; set; } = null!;

    // Navigation properties should be nullable for incoming payloads
    public virtual Phong? IdphongNavigation { get; set; }

    public virtual TienNghi? IdtienNghiNavigation { get; set; }
}
