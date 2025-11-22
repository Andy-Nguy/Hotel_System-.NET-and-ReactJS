using System;
using System.Collections.Generic;

namespace Hotel_System.API.Models;

public partial class KhuyenMaiDichVu
{
    public int Id { get; set; }

    public string IdkhuyenMai { get; set; } = null!;

    public string IddichVu { get; set; } = null!;

    public bool IsActive { get; set; } = true;

    public DateOnly? NgayApDung { get; set; }

    public DateOnly? NgayKetThuc { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public virtual KhuyenMai IdkhuyenMaiNavigation { get; set; } = null!;

    public virtual DichVu IddichVuNavigation { get; set; } = null!;
}
