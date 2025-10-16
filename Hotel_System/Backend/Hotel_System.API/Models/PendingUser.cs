using System;
using System.Collections.Generic;

namespace Hotel_System.API.Models;

public partial class PendingUser
{
    public long Id { get; set; }

    public string? Hoten { get; set; }

    public string? Email { get; set; }

    public string? Password { get; set; }

    public string? Sodienthoai { get; set; }

    public DateOnly? Ngaysinh { get; set; }

    public string? Otp { get; set; }

    public DateTime? OtpExpiredAt { get; set; }

    public DateTime? CreatedAt { get; set; }
}
