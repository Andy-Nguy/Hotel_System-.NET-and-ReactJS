namespace Hotel_System.API.DTOs;

/// <summary>
/// DTO cho yêu cầu hoàn tiền
/// </summary>
public class RefundRequest
{
    /// <summary>
    /// ID hóa đơn cần hoàn tiền
    /// </summary>
    public string IdHoaDon { get; set; } = null!;

    /// <summary>
    /// Số tiền hoàn lại
    /// </summary>
    public decimal RefundAmount { get; set; }

    /// <summary>
    /// Lý do hoàn tiền
    /// </summary>
    public string Reason { get; set; } = null!;

    /// <summary>
    /// Phương thức hoàn tiền (giống phương thức thanh toán ban đầu)
    /// </summary>
    public string? RefundMethod { get; set; }
}
