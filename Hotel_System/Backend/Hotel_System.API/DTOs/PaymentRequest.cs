namespace Hotel_System.API.DTOs;

/// <summary>
/// DTO cho yêu cầu thanh toán
/// </summary>
public class PaymentRequest
{
    /// <summary>
    /// ID hóa đơn cần thanh toán
    /// </summary>
    public string IdHoaDon { get; set; } = null!;

    /// <summary>
    /// Phương thức thanh toán:
    /// - CASH: Tiền mặt
    /// - BANK_TRANSFER: Chuyển khoản ngân hàng
    /// - CREDIT_CARD: Thẻ tín dụng (Visa/MasterCard)
    /// - MOMO: Ví MoMo
    /// - ZALOPAY: Ví ZaloPay
    /// - VNPAY: Ví VNPay
    /// - SHOPEEPAY: Ví ShopeePay
    /// </summary>
    public string PaymentMethod { get; set; } = null!;

    /// <summary>
    /// Số tiền thanh toán (không bao gồm tiền cọc đã trả)
    /// </summary>
    public decimal Amount { get; set; }

    /// <summary>
    /// Thông tin thẻ tín dụng (nếu dùng Credit Card)
    /// </summary>
    public CreditCardInfo? CreditCardInfo { get; set; }

    /// <summary>
    /// Số điện thoại ví điện tử (nếu dùng ví điện tử)
    /// </summary>
    public string? EWalletPhone { get; set; }

    /// <summary>
    /// Ghi chú thêm
    /// </summary>
    public string? Note { get; set; }
}

/// <summary>
/// Thông tin thẻ tín dụng
/// </summary>
public class CreditCardInfo
{
    public string CardNumber { get; set; } = null!;
    public string CardHolderName { get; set; } = null!;
    public string ExpiryMonth { get; set; } = null!; // MM
    public string ExpiryYear { get; set; } = null!;  // YYYY
    public string CVV { get; set; } = null!;
    public string CardType { get; set; } = "VISA"; // VISA, MASTERCARD
}
