using System;
using System.Collections.Generic;

namespace Hotel_System.API.Models;

public partial class TtdichVu
{
    public string IdttdichVu { get; set; } = null!;

    public string IddichVu { get; set; } = null!;

    public string? ThongTinDv { get; set; }

    public virtual DichVu IddichVuNavigation { get; set; } = null!;
}
