using Hotel_System.API.DTOs;

namespace Hotel_System.API.Services;

/// <summary>
/// Interface cho dịch vụ thanh toán
/// Định nghĩa các phương thức xử lý thanh toán cho hệ thống khách sạn
/// </summary>
public interface IPaymentService
{
    /// <summary>
    /// Xử lý thanh toán hóa đơn
    /// Luồng: Kiểm tra hóa đơn → Xác thực phương thức thanh toán → Xử lý thanh toán → Cập nhật database
    /// </summary>
    /// <param name="request">Thông tin yêu cầu thanh toán</param>
    /// <returns>Kết quả thanh toán</returns>
    Task<PaymentResponse> ProcessPaymentAsync(PaymentRequest request);

    /// <summary>
    /// Xử lý thanh toán bằng tiền mặt
    /// - Xác nhận số tiền
    /// - Cập nhật trạng thái thanh toán ngay lập tức
    /// - Tạo biên lai
    /// </summary>
    Task<PaymentResponse> ProcessCashPaymentAsync(PaymentRequest request);

    /// <summary>
    /// Xử lý thanh toán bằng chuyển khoản ngân hàng
    /// - Tạo thông tin chuyển khoản
    /// - Chờ xác nhận từ ngân hàng
    /// - Cập nhật trạng thái khi nhận được tiền
    /// </summary>
    Task<PaymentResponse> ProcessBankTransferAsync(PaymentRequest request);

    /// <summary>
    /// Xử lý thanh toán bằng thẻ tín dụng (Visa/MasterCard)
    /// - Xác thực thông tin thẻ
    /// - Gọi gateway thanh toán
    /// - Xử lý phản hồi từ gateway
    /// </summary>
    Task<PaymentResponse> ProcessCreditCardPaymentAsync(PaymentRequest request);

    /// <summary>
    /// Xử lý thanh toán bằng ví điện tử (MoMo, ZaloPay, VNPay, ShopeePay)
    /// - Tạo yêu cầu thanh toán đến ví
    /// - Tạo URL/QR code thanh toán
    /// - Nhận callback từ ví điện tử
    /// - Cập nhật trạng thái
    /// </summary>
    Task<PaymentResponse> ProcessEWalletPaymentAsync(PaymentRequest request, string walletType);

    /// <summary>
    /// Kiểm tra trạng thái thanh toán của hóa đơn
    /// Trạng thái: 1-Chờ xử lý, 2-Hoàn tất, 3-Hoàn tiền, 0-Hủy
    /// </summary>
    Task<PaymentResponse> CheckPaymentStatusAsync(string idHoaDon);

    /// <summary>
    /// Xử lý hoàn tiền
    /// - Kiểm tra điều kiện hoàn tiền
    /// - Tính toán số tiền hoàn
    /// - Thực hiện hoàn tiền theo phương thức thanh toán ban đầu
    /// - Cập nhật trạng thái
    /// </summary>
    Task<PaymentResponse> ProcessRefundAsync(RefundRequest request);

    /// <summary>
    /// Tạo hóa đơn điện tử PDF
    /// - Lấy thông tin hóa đơn
    /// - Generate PDF với thông tin chi tiết
    /// - Trả về file PDF
    /// </summary>
    Task<byte[]> GenerateInvoicePdfAsync(string idHoaDon);

    /// <summary>
    /// Lấy thông tin chi tiết hóa đơn để hiển thị
    /// Bao gồm: Thông tin đặt phòng, dịch vụ, tổng tiền, đã thanh toán, còn lại
    /// </summary>
    Task<InvoiceDetailResponse> GetInvoiceDetailAsync(string idHoaDon);

    /// <summary>
    /// Callback từ ví điện tử sau khi thanh toán
    /// - Xác thực callback
    /// - Cập nhật trạng thái thanh toán
    /// - Gửi thông báo cho khách hàng
    /// </summary>
    Task<bool> HandlePaymentCallbackAsync(string paymentId, Dictionary<string, string> callbackData);

    /// <summary>
    /// Hủy thanh toán (cho các giao dịch đang chờ xử lý)
    /// </summary>
    Task<PaymentResponse> CancelPaymentAsync(string idHoaDon, string reason);

}
