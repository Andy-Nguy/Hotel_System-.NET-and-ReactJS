using System;
using System.Collections.Generic;

namespace Hotel_System.API.Models;

public partial class KhuyenMaiPhong
{
    public int Id { get; set; }

    public string IdkhuyenMai { get; set; } = null!;

    public string Idphong { get; set; } = null!;

    public bool IsActive { get; set; }

    public DateOnly? NgayApDung { get; set; }

    public DateOnly? NgayKetThuc { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public virtual KhuyenMai IdkhuyenMaiNavigation { get; set; } = null!;

    public virtual Phong IdphongNavigation { get; set; } = null!;
}
