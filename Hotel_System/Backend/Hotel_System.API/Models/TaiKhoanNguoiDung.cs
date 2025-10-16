using System;
using System.Collections.Generic;

namespace Hotel_System.API.Models;

public partial class TaiKhoanNguoiDung
{
    public int IdnguoiDung { get; set; }

    public int IdkhachHang { get; set; }

    public string MatKhau { get; set; } = null!;

    public byte VaiTro { get; set; }

    public virtual KhachHang IdkhachHangNavigation { get; set; } = null!;
}
