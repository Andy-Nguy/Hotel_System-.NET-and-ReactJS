using System;
using System.Collections.Generic;

namespace Hotel_System.API.Models;

public partial class KhuyenMaiComboDichVu
{
    public int Id { get; set; }

    public string IdkhuyenMaiCombo { get; set; } = null!;

    public string IddichVu { get; set; } = null!;

    public bool IsActive { get; set; } = true;

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public virtual KhuyenMaiCombo IdkhuyenMaiComboNavigation { get; set; } = null!;

    public virtual DichVu IddichVuNavigation { get; set; } = null!;
}
