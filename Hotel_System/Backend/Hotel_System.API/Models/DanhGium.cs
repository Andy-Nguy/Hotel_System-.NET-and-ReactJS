using System;
using System.Collections.Generic;

namespace Hotel_System.API.Models;

public partial class DanhGium
{
    public int IddanhGia { get; set; }

    public int IdkhachHang { get; set; }

    public string Idphong { get; set; } = null!;

    public string? IddatPhong { get; set; } // Booking ID reference

    public byte SoSao { get; set; }

    public string? TieuDe { get; set; }

    public string? NoiDung { get; set; }

    public bool? IsAnonym { get; set; }

    public bool IsApproved { get; set; } = false; // Approval status for admin review

    public bool IsResponded { get; set; } = false; // Response status: true = đã phản hồi qua email

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public virtual KhachHang IdkhachHangNavigation { get; set; } = null!;

    public virtual Phong IdphongNavigation { get; set; } = null!;
}
