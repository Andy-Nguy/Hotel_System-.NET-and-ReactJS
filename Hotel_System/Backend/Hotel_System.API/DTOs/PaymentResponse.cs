namespace Hotel_System.API.DTOs;

/// <summary>
/// DTO cho phản hồi thanh toán
/// </summary>
public class PaymentResponse
{
    /// <summary>
    /// Trạng thái thành công
    /// </summary>
    public bool Success { get; set; }

    /// <summary>
    /// Thông báo kết quả
    /// </summary>
    public string Message { get; set; } = null!;

    /// <summary>
    /// ID giao dịch thanh toán
    /// </summary>
    public string? PaymentId { get; set; }

    /// <summary>
    /// ID hóa đơn
    /// </summary>
    public string? IdHoaDon { get; set; }

    /// <summary>
    /// Phương thức thanh toán đã sử dụng
    /// </summary>
    public string? PaymentMethod { get; set; }

    /// <summary>
    /// Số tiền đã thanh toán
    /// </summary>
    public decimal? AmountPaid { get; set; }

    /// <summary>
    /// Thời gian thanh toán
    /// </summary>
    public DateTime? PaymentDate { get; set; }

    /// <summary>
    /// Trạng thái thanh toán:
    /// 1: Chờ xử lý
    /// 2: Hoàn tất
    /// 3: Hoàn tiền
    /// 0: Hủy
    /// </summary>
    public int? Status { get; set; }

    /// <summary>
    /// URL thanh toán (dành cho ví điện tử)
    /// </summary>
    public string? PaymentUrl { get; set; }

    /// <summary>
    /// Mã QR thanh toán (dành cho ví điện tử)
    /// </summary>
    public string? QrCode { get; set; }
}
