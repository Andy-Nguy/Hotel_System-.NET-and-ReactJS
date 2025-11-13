using Hotel_System.API.DTOs;
using Hotel_System.API.Models;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Hotel_System.API.Services;

/// <summary>
/// Service xử lý các nghiệp vụ thanh toán cho hệ thống khách sạn
/// </summary>
public class PaymentService : IPaymentService
{
    private readonly HotelSystemContext _context;
    private readonly ILogger<PaymentService> _logger;

    public PaymentService(HotelSystemContext context, ILogger<PaymentService> logger)
    {
        _context = context;
        _logger = logger;
    }

    #region Main Payment Processing

    /// <summary>
    /// LUỒNG NGHIỆP VỤ THANH TOÁN CHÍNH:
    /// 1. Validate thông tin yêu cầu thanh toán
    /// 2. Kiểm tra hóa đơn tồn tại và trạng thái
    /// 3. Kiểm tra số tiền thanh toán
    /// 4. Phân luồng theo phương thức thanh toán
    /// 5. Xử lý thanh toán và cập nhật database
    /// 6. Trả về kết quả
    /// </summary>
    public async Task<PaymentResponse> ProcessPaymentAsync(PaymentRequest request)
    {
        try
        {
            _logger.LogInformation($"Bắt đầu xử lý thanh toán cho hóa đơn {request.IdHoaDon}");

            // 1. Validate request
            if (string.IsNullOrEmpty(request.IdHoaDon) || string.IsNullOrEmpty(request.PaymentMethod))
            {
                return new PaymentResponse
                {
                    Success = false,
                    Message = "Thông tin thanh toán không hợp lệ"
                };
            }

            // 2. Kiểm tra hóa đơn
            var hoaDon = await _context.HoaDons
                .Include(h => h.IddatPhongNavigation)
                .ThenInclude(d => d.IdkhachHangNavigation)
                .FirstOrDefaultAsync(h => h.IdhoaDon == request.IdHoaDon);

            if (hoaDon == null)
            {
                return new PaymentResponse
                {
                    Success = false,
                    Message = "Không tìm thấy hóa đơn"
                };
            }

            // 3. Kiểm tra trạng thái thanh toán
            if (hoaDon.TrangThaiThanhToan == 2)
            {
                return new PaymentResponse
                {
                    Success = false,
                    Message = "Hóa đơn đã được thanh toán"
                };
            }

            // 4. Tính số tiền cần thanh toán (Tổng tiền - Tiền cọc)
            var tienCanThanhToan = hoaDon.TongTien - (hoaDon.TienCoc ?? 0);
            
            if (request.Amount < tienCanThanhToan)
            {
                return new PaymentResponse
                {
                    Success = false,
                    Message = $"Số tiền thanh toán không đủ. Cần thanh toán: {tienCanThanhToan:N0} VNĐ"
                };
            }

            // 5. Phân luồng theo phương thức thanh toán
            PaymentResponse response;
            
            switch (request.PaymentMethod.ToUpper())
            {
                case "CASH":
                    response = await ProcessCashPaymentAsync(request);
                    break;
                    
                case "BANK_TRANSFER":
                    response = await ProcessBankTransferAsync(request);
                    break;
                    
                case "CREDIT_CARD":
                case "VISA":
                case "MASTERCARD":
                    response = await ProcessCreditCardPaymentAsync(request);
                    break;
                    
                case "MOMO":
                    response = await ProcessEWalletPaymentAsync(request, "MOMO");
                    break;
                    
                case "ZALOPAY":
                    response = await ProcessEWalletPaymentAsync(request, "ZALOPAY");
                    break;
                    
                case "VNPAY":
                    response = await ProcessEWalletPaymentAsync(request, "VNPAY");
                    break;
                    
                case "SHOPEEPAY":
                    response = await ProcessEWalletPaymentAsync(request, "SHOPEEPAY");
                    break;
                    
                default:
                    response = new PaymentResponse
                    {
                        Success = false,
                        Message = "Phương thức thanh toán không được hỗ trợ"
                    };
                    break;
            }

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Lỗi xử lý thanh toán: {ex.Message}");
            return new PaymentResponse
            {
                Success = false,
                Message = $"Có lỗi xảy ra: {ex.Message}"
            };
        }
    }

    #endregion

    #region Cash Payment

    /// <summary>
    /// LUỒNG THANH TOÁN TIỀN MẶT:
    /// 1. Nhận tiền từ khách hàng
    /// 2. Cập nhật trạng thái thanh toán = Hoàn tất (2)
    /// 3. Cập nhật số tiền đã thanh toán
    /// 4. Cập nhật trạng thái đặt phòng = Hoàn thành (4)
    /// 5. Tạo PaymentId
    /// 6. Lưu vào database
    /// 7. Cập nhật thống kê doanh thu
    /// </summary>
    public async Task<PaymentResponse> ProcessCashPaymentAsync(PaymentRequest request)
    {
        try
        {
            var hoaDon = await _context.HoaDons
                .Include(h => h.IddatPhongNavigation)
                .FirstOrDefaultAsync(h => h.IdhoaDon == request.IdHoaDon);

            if (hoaDon == null)
            {
                return new PaymentResponse { Success = false, Message = "Không tìm thấy hóa đơn" };
            }

            // Tạo PaymentId
            var paymentId = $"PAY_CASH_{DateTime.Now:yyyyMMddHHmmss}_{GenerateRandomString(6)}";

            // Cập nhật hóa đơn
            hoaDon.TienThanhToan = request.Amount;
            hoaDon.TrangThaiThanhToan = 2; // Hoàn tất
            hoaDon.PaymentId = paymentId;
            hoaDon.GhiChu = $"Thanh toán tiền mặt. {request.Note ?? ""}";

            // Cập nhật đặt phòng
            if (hoaDon.IddatPhongNavigation != null)
            {
                hoaDon.IddatPhongNavigation.TrangThai = 4; // Hoàn thành
                hoaDon.IddatPhongNavigation.TrangThaiThanhToan = 2; // Đã thanh toán
            }

            // Cập nhật thống kê doanh thu
            await UpdateRevenueStatisticsAsync(hoaDon);

            await _context.SaveChangesAsync();

            _logger.LogInformation($"Thanh toán tiền mặt thành công cho hóa đơn {request.IdHoaDon}");

            return new PaymentResponse
            {
                Success = true,
                Message = "Thanh toán tiền mặt thành công",
                PaymentId = paymentId,
                IdHoaDon = request.IdHoaDon,
                PaymentMethod = "CASH",
                AmountPaid = request.Amount,
                PaymentDate = DateTime.Now,
                Status = 2 // Hoàn tất
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi thanh toán tiền mặt");
            return new PaymentResponse
            {
                Success = false,
                Message = $"Lỗi thanh toán tiền mặt: {ex.Message}"
            };
        }
    }

    #endregion

    #region Bank Transfer

    /// <summary>
    /// LUỒNG THANH TOÁN CHUYỂN KHOẢN:
    /// 1. Tạo thông tin chuyển khoản (STK, nội dung)
    /// 2. Trạng thái = Chờ xử lý (1)
    /// 3. Khách hàng thực hiện chuyển khoản
    /// 4. Nhân viên xác nhận đã nhận tiền
    /// 5. Cập nhật trạng thái = Hoàn tất (2)
    /// 6. Hoàn tất đặt phòng
    /// </summary>
    public async Task<PaymentResponse> ProcessBankTransferAsync(PaymentRequest request)
    {
        try
        {
            var hoaDon = await _context.HoaDons
                .Include(h => h.IddatPhongNavigation)
                .FirstOrDefaultAsync(h => h.IdhoaDon == request.IdHoaDon);

            if (hoaDon == null)
            {
                return new PaymentResponse { Success = false, Message = "Không tìm thấy hóa đơn" };
            }

            var paymentId = $"PAY_BANK_{DateTime.Now:yyyyMMddHHmmss}_{GenerateRandomString(6)}";

            // Cập nhật hóa đơn - Chờ xác nhận
            hoaDon.TienThanhToan = request.Amount;
            hoaDon.TrangThaiThanhToan = 1; // Chờ xử lý
            hoaDon.PaymentId = paymentId;
            hoaDon.GhiChu = $"Chuyển khoản ngân hàng - Chờ xác nhận. {request.Note ?? ""}";

            await _context.SaveChangesAsync();

            // Tạo thông tin chuyển khoản
            var bankInfo = new
            {
                BankName = "Ngân hàng TMCP Á Châu (ACB)",
                AccountNumber = "1234567890",
                AccountName = "CONG TY KHACH SAN ABC",
                Amount = request.Amount,
                Content = $"Thanh toan hoa don {request.IdHoaDon}",
                PaymentId = paymentId
            };

            _logger.LogInformation($"Tạo yêu cầu chuyển khoản cho hóa đơn {request.IdHoaDon}");

            return new PaymentResponse
            {
                Success = true,
                Message = $"Vui lòng chuyển khoản {request.Amount:N0} VNĐ vào TK: {bankInfo.AccountNumber} - {bankInfo.BankName}. Nội dung: {bankInfo.Content}",
                PaymentId = paymentId,
                IdHoaDon = request.IdHoaDon,
                PaymentMethod = "BANK_TRANSFER",
                AmountPaid = request.Amount,
                PaymentDate = DateTime.Now,
                Status = 1 // Chờ xử lý
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi tạo yêu cầu chuyển khoản");
            return new PaymentResponse
            {
                Success = false,
                Message = $"Lỗi tạo yêu cầu chuyển khoản: {ex.Message}"
            };
        }
    }

    #endregion

    #region Credit Card Payment

    /// <summary>
    /// LUỒNG THANH TOÁN THẺ TÍN DỤNG:
    /// 1. Validate thông tin thẻ (số thẻ, ngày hết hạn, CVV)
    /// 2. Gọi Payment Gateway (giả lập)
    /// 3. Xác thực 3D Secure (nếu có)
    /// 4. Xử lý phản hồi từ gateway
    /// 5. Cập nhật trạng thái thanh toán
    /// 6. Hoàn tất giao dịch
    /// </summary>
    public async Task<PaymentResponse> ProcessCreditCardPaymentAsync(PaymentRequest request)
    {
        try
        {
            // Validate thông tin thẻ
            if (request.CreditCardInfo == null)
            {
                return new PaymentResponse
                {
                    Success = false,
                    Message = "Thiếu thông tin thẻ tín dụng"
                };
            }

            if (!ValidateCreditCard(request.CreditCardInfo))
            {
                return new PaymentResponse
                {
                    Success = false,
                    Message = "Thông tin thẻ không hợp lệ"
                };
            }

            var hoaDon = await _context.HoaDons
                .Include(h => h.IddatPhongNavigation)
                .FirstOrDefaultAsync(h => h.IdhoaDon == request.IdHoaDon);

            if (hoaDon == null)
            {
                return new PaymentResponse { Success = false, Message = "Không tìm thấy hóa đơn" };
            }

            // Giả lập xử lý qua Payment Gateway
            var gatewayResponse = await SimulatePaymentGatewayAsync(request.CreditCardInfo, request.Amount);

            if (!gatewayResponse.Success)
            {
                return new PaymentResponse
                {
                    Success = false,
                    Message = gatewayResponse.Message
                };
            }

            var paymentId = $"PAY_CARD_{DateTime.Now:yyyyMMddHHmmss}_{GenerateRandomString(6)}";

            // Cập nhật hóa đơn
            hoaDon.TienThanhToan = request.Amount;
            hoaDon.TrangThaiThanhToan = 2; // Hoàn tất
            hoaDon.PaymentId = paymentId;
            hoaDon.GhiChu = $"Thanh toán thẻ {request.CreditCardInfo.CardType} - {MaskCardNumber(request.CreditCardInfo.CardNumber)}. {request.Note ?? ""}";

            // Cập nhật đặt phòng
            if (hoaDon.IddatPhongNavigation != null)
            {
                hoaDon.IddatPhongNavigation.TrangThai = 4; // Hoàn thành
                hoaDon.IddatPhongNavigation.TrangThaiThanhToan = 2; // Đã thanh toán
            }

            // Cập nhật thống kê doanh thu
            await UpdateRevenueStatisticsAsync(hoaDon);

            await _context.SaveChangesAsync();

            _logger.LogInformation($"Thanh toán thẻ tín dụng thành công cho hóa đơn {request.IdHoaDon}");

            return new PaymentResponse
            {
                Success = true,
                Message = "Thanh toán thẻ tín dụng thành công",
                PaymentId = paymentId,
                IdHoaDon = request.IdHoaDon,
                PaymentMethod = "CREDIT_CARD",
                AmountPaid = request.Amount,
                PaymentDate = DateTime.Now,
                Status = 2
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi thanh toán thẻ tín dụng");
            return new PaymentResponse
            {
                Success = false,
                Message = $"Lỗi thanh toán thẻ tín dụng: {ex.Message}"
            };
        }
    }

    #endregion

    #region E-Wallet Payment

    /// <summary>
    /// LUỒNG THANH TOÁN VÍ ĐIỆN TỬ:
    /// 1. Tạo yêu cầu thanh toán đến ví (MoMo/ZaloPay/VNPay/ShopeePay)
    /// 2. Tạo URL thanh toán hoặc QR code
    /// 3. Khách hàng quét QR hoặc mở app ví
    /// 4. Khách hàng xác nhận thanh toán
    /// 5. Ví điện tử gửi callback về server
    /// 6. Xác thực callback và cập nhật trạng thái
    /// 7. Hoàn tất giao dịch
    /// </summary>
    public async Task<PaymentResponse> ProcessEWalletPaymentAsync(PaymentRequest request, string walletType)
    {
        try
        {
            var hoaDon = await _context.HoaDons
                .Include(h => h.IddatPhongNavigation)
                .FirstOrDefaultAsync(h => h.IdhoaDon == request.IdHoaDon);

            if (hoaDon == null)
            {
                return new PaymentResponse { Success = false, Message = "Không tìm thấy hóa đơn" };
            }

            var paymentId = $"PAY_{walletType}_{DateTime.Now:yyyyMMddHHmmss}_{GenerateRandomString(6)}";

            // Tạo URL thanh toán (giả lập)
            var paymentUrl = GenerateEWalletPaymentUrl(walletType, paymentId, request.Amount, request.IdHoaDon);
            
            // Tạo QR code (giả lập)
            var qrCode = GenerateQRCode(paymentUrl);

            // Cập nhật hóa đơn - Chờ thanh toán
            hoaDon.TienThanhToan = request.Amount;
            hoaDon.TrangThaiThanhToan = 1; // Chờ xử lý
            hoaDon.PaymentId = paymentId;
            hoaDon.GhiChu = $"Thanh toán {walletType} - Chờ xác nhận. {request.Note ?? ""}";

            await _context.SaveChangesAsync();

            _logger.LogInformation($"Tạo yêu cầu thanh toán {walletType} cho hóa đơn {request.IdHoaDon}");

            return new PaymentResponse
            {
                Success = true,
                Message = $"Vui lòng quét mã QR hoặc mở app {walletType} để thanh toán",
                PaymentId = paymentId,
                IdHoaDon = request.IdHoaDon,
                PaymentMethod = walletType,
                AmountPaid = request.Amount,
                PaymentDate = DateTime.Now,
                Status = 1, // Chờ xử lý
                PaymentUrl = paymentUrl,
                QrCode = qrCode
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Lỗi thanh toán {walletType}");
            return new PaymentResponse
            {
                Success = false,
                Message = $"Lỗi thanh toán {walletType}: {ex.Message}"
            };
        }
    }

    #endregion

    #region Payment Status Check

    /// <summary>
    /// KIỂM TRA TRẠNG THÁI THANH TOÁN:
    /// 1. Tìm hóa đơn theo ID
    /// 2. Lấy thông tin trạng thái thanh toán
    /// 3. Trả về thông tin chi tiết
    /// Trạng thái: 1-Chờ xử lý, 2-Hoàn tất, 3-Hoàn tiền, 0-Hủy
    /// </summary>
    public async Task<PaymentResponse> CheckPaymentStatusAsync(string idHoaDon)
    {
        try
        {
            var hoaDon = await _context.HoaDons
                .Include(h => h.IddatPhongNavigation)
                .FirstOrDefaultAsync(h => h.IdhoaDon == idHoaDon);

            if (hoaDon == null)
            {
                return new PaymentResponse
                {
                    Success = false,
                    Message = "Không tìm thấy hóa đơn"
                };
            }

            string statusMessage = hoaDon.TrangThaiThanhToan switch
            {
                1 => "Chờ xử lý",
                2 => "Hoàn tất",
                3 => "Hoàn tiền",
                0 => "Đã hủy",
                _ => "Không xác định"
            };

            return new PaymentResponse
            {
                Success = true,
                Message = $"Trạng thái thanh toán: {statusMessage}",
                PaymentId = hoaDon.PaymentId,
                IdHoaDon = idHoaDon,
                AmountPaid = hoaDon.TienThanhToan,
                PaymentDate = hoaDon.NgayLap,
                Status = hoaDon.TrangThaiThanhToan
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi kiểm tra trạng thái thanh toán");
            return new PaymentResponse
            {
                Success = false,
                Message = $"Lỗi kiểm tra trạng thái: {ex.Message}"
            };
        }
    }

    #endregion

    #region Refund Processing

    /// <summary>
    /// LUỒNG HOÀN TIỀN:
    /// 1. Kiểm tra hóa đơn đã thanh toán
    /// 2. Validate số tiền hoàn
    /// 3. Kiểm tra điều kiện hoàn tiền
    /// 4. Xử lý hoàn tiền theo phương thức thanh toán ban đầu
    /// 5. Cập nhật trạng thái = Hoàn tiền (3)
    /// 6. Cập nhật số tiền
    /// 7. Lưu lịch sử giao dịch
    /// </summary>
    public async Task<PaymentResponse> ProcessRefundAsync(RefundRequest request)
    {
        try
        {
            var hoaDon = await _context.HoaDons
                .Include(h => h.IddatPhongNavigation)
                .FirstOrDefaultAsync(h => h.IdhoaDon == request.IdHoaDon);

            if (hoaDon == null)
            {
                return new PaymentResponse
                {
                    Success = false,
                    Message = "Không tìm thấy hóa đơn"
                };
            }

            // Kiểm tra đã thanh toán chưa
            if (hoaDon.TrangThaiThanhToan != 2)
            {
                return new PaymentResponse
                {
                    Success = false,
                    Message = "Hóa đơn chưa được thanh toán hoặc đã hoàn tiền"
                };
            }

            // Kiểm tra số tiền hoàn
            if (request.RefundAmount > hoaDon.TienThanhToan)
            {
                return new PaymentResponse
                {
                    Success = false,
                    Message = "Số tiền hoàn vượt quá số tiền đã thanh toán"
                };
            }

            var refundId = $"REFUND_{DateTime.Now:yyyyMMddHHmmss}_{GenerateRandomString(6)}";

            // Cập nhật hóa đơn
            hoaDon.TrangThaiThanhToan = 3; // Hoàn tiền
            hoaDon.TienThanhToan = (hoaDon.TienThanhToan ?? 0) - request.RefundAmount;
            hoaDon.GhiChu = $"{hoaDon.GhiChu}\nHoàn tiền: {request.RefundAmount:N0} VNĐ. Lý do: {request.Reason}";

            // Cập nhật trạng thái đặt phòng
            if (hoaDon.IddatPhongNavigation != null)
            {
                hoaDon.IddatPhongNavigation.TrangThai = 0; // Hủy
            }

            // Cập nhật thống kê (trừ doanh thu)
            await UpdateRevenueStatisticsForRefundAsync(hoaDon, request.RefundAmount);

            await _context.SaveChangesAsync();

            _logger.LogInformation($"Hoàn tiền thành công cho hóa đơn {request.IdHoaDon}");

            return new PaymentResponse
            {
                Success = true,
                Message = $"Hoàn tiền thành công {request.RefundAmount:N0} VNĐ",
                PaymentId = refundId,
                IdHoaDon = request.IdHoaDon,
                AmountPaid = request.RefundAmount,
                PaymentDate = DateTime.Now,
                Status = 3 // Hoàn tiền
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi xử lý hoàn tiền");
            return new PaymentResponse
            {
                Success = false,
                Message = $"Lỗi xử lý hoàn tiền: {ex.Message}"
            };
        }
    }

    #endregion

    #region Invoice PDF Generation

    /// <summary>
    /// TẠO HÓA ĐƠN ĐIỆN TỬ PDF:
    /// 1. Lấy thông tin hóa đơn đầy đủ
    /// 2. Tạo PDF document với QuestPDF
    /// 3. Thêm thông tin khách sạn, khách hàng
    /// 4. Thêm chi tiết phòng, dịch vụ
    /// 5. Thêm tổng tiền, đã thanh toán
    /// 6. Return byte array
    /// </summary>
    public async Task<byte[]> GenerateInvoicePdfAsync(string idHoaDon)
    {
        try
        {
            // Thiết lập license cho QuestPDF (Community license - miễn phí)
            QuestPDF.Settings.License = LicenseType.Community;

            var hoaDon = await _context.HoaDons
                .Include(h => h.IddatPhongNavigation)
                    .ThenInclude(d => d!.IdkhachHangNavigation)
                .Include(h => h.IddatPhongNavigation)
                    .ThenInclude(d => d!.IdphongNavigation)
                .Include(h => h.Cthddvs)
                    .ThenInclude(c => c.IddichVuNavigation)
                .FirstOrDefaultAsync(h => h.IdhoaDon == idHoaDon);

            if (hoaDon == null)
            {
                throw new Exception("Không tìm thấy hóa đơn");
            }

            var datPhong = hoaDon.IddatPhongNavigation;
            var khachHang = datPhong?.IdkhachHangNavigation;
            var phong = datPhong?.IdphongNavigation;

            // Tạo PDF với QuestPDF
            var pdfBytes = Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(50);
                    page.PageColor(Colors.White);
                    page.DefaultTextStyle(x => x.FontSize(11).FontFamily("Arial"));

                    // Header
                    page.Header().Column(column =>
                    {
                        column.Item().AlignCenter().Text("🏨 HOTEL MANAGEMENT SYSTEM")
                            .FontSize(20).Bold().FontColor(Colors.Blue.Darken2);
                        
                        column.Item().AlignCenter().Text("HÓA ĐƠN THANH TOÁN / INVOICE")
                            .FontSize(16).SemiBold().FontColor(Colors.Grey.Darken2);
                        
                        column.Item().PaddingVertical(5).LineHorizontal(1).LineColor(Colors.Grey.Lighten1);
                    });

                    // Content
                    page.Content().Column(column =>
                    {
                        column.Spacing(10);

                        // Thông tin hóa đơn
                        column.Item().Row(row =>
                        {
                            row.RelativeItem().Column(col =>
                            {
                                col.Item().Text(text =>
                                {
                                    text.Span("Mã hóa đơn / Invoice ID: ").SemiBold();
                                    text.Span(hoaDon.IdhoaDon);
                                });
                                col.Item().Text(text =>
                                {
                                    text.Span("Mã thanh toán / Payment ID: ").SemiBold();
                                    text.Span(hoaDon.PaymentId ?? "N/A");
                                });
                            });
                            
                            row.RelativeItem().AlignRight().Column(col =>
                            {
                                col.Item().Text(text =>
                                {
                                    text.Span("Ngày lập / Date: ").SemiBold();
                                    text.Span(hoaDon.NgayLap?.ToString("dd/MM/yyyy HH:mm") ?? DateTime.Now.ToString("dd/MM/yyyy HH:mm"));
                                });
                            });
                        });

                        column.Item().PaddingVertical(5).LineHorizontal(1).LineColor(Colors.Grey.Lighten2);

                        // Thông tin khách hàng
                        if (khachHang != null)
                        {
                            column.Item().Text("THÔNG TIN KHÁCH HÀNG / CUSTOMER INFORMATION")
                                .FontSize(12).SemiBold().FontColor(Colors.Blue.Darken1);
                            
                            column.Item().Background(Colors.Grey.Lighten3).Padding(10).Column(col =>
                            {
                                col.Item().Text(text =>
                                {
                                    text.Span("Họ tên / Name: ").SemiBold();
                                    text.Span(khachHang.HoTen ?? "N/A");
                                });
                                col.Item().Text(text =>
                                {
                                    text.Span("Điện thoại / Phone: ").SemiBold();
                                    text.Span(khachHang.SoDienThoai ?? "N/A");
                                });
                                col.Item().Text(text =>
                                {
                                    text.Span("Email: ").SemiBold();
                                    text.Span(khachHang.Email ?? "N/A");
                                });
                            });
                        }

                        // Thông tin đặt phòng
                        if (datPhong != null)
                        {
                            column.Item().Text("THÔNG TIN ĐẶT PHÒNG / BOOKING INFORMATION")
                                .FontSize(12).SemiBold().FontColor(Colors.Blue.Darken1);
                            
                            column.Item().Background(Colors.Grey.Lighten3).Padding(10).Column(col =>
                            {
                                col.Item().Text(text =>
                                {
                                    text.Span("Phòng / Room: ").SemiBold();
                                    text.Span(phong?.TenPhong ?? "N/A");
                                });
                                col.Item().Text(text =>
                                {
                                    text.Span("Nhận phòng / Check-in: ").SemiBold();
                                    text.Span(datPhong.NgayNhanPhong.ToString());
                                });
                                col.Item().Text(text =>
                                {
                                    text.Span("Trả phòng / Check-out: ").SemiBold();
                                    text.Span(datPhong.NgayTraPhong.ToString());
                                });
                                col.Item().Text(text =>
                                {
                                    text.Span("Số đêm / Nights: ").SemiBold();
                                    text.Span((datPhong.SoDem ?? 0).ToString());
                                });
                            });
                        }

                        // Bảng chi tiết
                        column.Item().Text("CHI TIẾT / DETAILS")
                            .FontSize(12).SemiBold().FontColor(Colors.Blue.Darken1);

                        column.Item().Table(table =>
                        {
                            table.ColumnsDefinition(columns =>
                            {
                                columns.ConstantColumn(40);  // STT
                                columns.RelativeColumn(3);   // Mô tả
                                columns.ConstantColumn(60);  // SL
                                columns.ConstantColumn(100); // Đơn giá
                                columns.ConstantColumn(100); // Thành tiền
                            });

                            // Header
                            table.Header(header =>
                            {
                                header.Cell().Background(Colors.Blue.Darken2).Padding(5)
                                    .Text("STT").FontColor(Colors.White).SemiBold();
                                header.Cell().Background(Colors.Blue.Darken2).Padding(5)
                                    .Text("Mô tả / Description").FontColor(Colors.White).SemiBold();
                                header.Cell().Background(Colors.Blue.Darken2).Padding(5)
                                    .Text("SL").FontColor(Colors.White).SemiBold();
                                header.Cell().Background(Colors.Blue.Darken2).Padding(5)
                                    .Text("Đơn giá").FontColor(Colors.White).SemiBold();
                                header.Cell().Background(Colors.Blue.Darken2).Padding(5)
                                    .Text("Thành tiền").FontColor(Colors.White).SemiBold();
                            });

                            // Tiền phòng
                            table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(5)
                                .Text("1");
                            table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(5)
                                .Text("Tiền phòng / Room Charge");
                            table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(5)
                                .AlignCenter().Text((hoaDon.Slngay ?? 1).ToString());
                            table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(5)
                                .AlignRight().Text($"{(hoaDon.TienPhong ?? 0):N0} VNĐ");
                            table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(5)
                                .AlignRight().Text($"{(hoaDon.TienPhong ?? 0):N0} VNĐ");

                            // Dịch vụ
                            int index = 2;
                            foreach (var dv in hoaDon.Cthddvs)
                            {
                                table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(5)
                                    .Text(index.ToString());
                                table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(5)
                                    .Text(dv.IddichVuNavigation?.TenDichVu ?? "Dịch vụ / Service");
                                table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(5)
                                    .AlignCenter().Text("1");
                                table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(5)
                                    .AlignRight().Text($"{(dv.TienDichVu ?? 0):N0} VNĐ");
                                table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(5)
                                    .AlignRight().Text($"{(dv.TienDichVu ?? 0):N0} VNĐ");
                                index++;
                            }
                        });

                        // Tổng tiền
                        column.Item().AlignRight().Column(col =>
                        {
                            col.Spacing(5);
                            
                            col.Item().Row(row =>
                            {
                                row.RelativeItem().Text("Tổng tiền / Subtotal: ").SemiBold();
                                row.ConstantItem(150).AlignRight().Text($"{hoaDon.TongTien:N0} VNĐ");
                            });
                            
                            col.Item().Row(row =>
                            {
                                row.RelativeItem().Text("Tiền cọc / Deposit: ").SemiBold();
                                row.ConstantItem(150).AlignRight().Text($"-{(hoaDon.TienCoc ?? 0):N0} VNĐ");
                            });
                            
                            col.Item().LineHorizontal(1).LineColor(Colors.Grey.Darken1);
                            
                            col.Item().Row(row =>
                            {
                                row.RelativeItem().Text("Đã thanh toán / Total Paid: ")
                                    .FontSize(14).SemiBold().FontColor(Colors.Red.Darken1);
                                row.ConstantItem(150).AlignRight()
                                    .Text($"{(hoaDon.TienThanhToan ?? 0):N0} VNĐ")
                                    .FontSize(14).SemiBold().FontColor(Colors.Red.Darken1);
                            });
                        });

                        // Trạng thái
                        var statusText = hoaDon.TrangThaiThanhToan switch
                        {
                            2 => "ĐÃ THANH TOÁN / PAID",
                            1 => "CHỜ XỬ LÝ / PENDING",
                            3 => "HOÀN TIỀN / REFUNDED",
                            _ => "ĐÃ HỦY / CANCELLED"
                        };

                        var statusColor = hoaDon.TrangThaiThanhToan switch
                        {
                            2 => Colors.Green.Darken2,
                            1 => Colors.Orange.Darken2,
                            3 => Colors.Purple.Darken2,
                            _ => Colors.Red.Darken2
                        };

                        column.Item().AlignCenter().Padding(10)
                            .Background(statusColor)
                            .Text(statusText)
                            .FontSize(14).Bold().FontColor(Colors.White);
                    });

                    // Footer
                    page.Footer().AlignCenter().Column(column =>
                    {
                        column.Item().PaddingVertical(5).LineHorizontal(1).LineColor(Colors.Grey.Lighten1);
                        
                        column.Item().Text("Cảm ơn quý khách đã sử dụng dịch vụ!")
                            .FontSize(12).SemiBold();
                        
                        column.Item().Text("Thank you for choosing our hotel!")
                            .FontSize(12).SemiBold();
                        
                        column.Item().PaddingTop(10).Text($"In lúc / Printed at: {DateTime.Now:dd/MM/yyyy HH:mm:ss}")
                            .FontSize(9).FontColor(Colors.Grey.Darken1);
                    });
                });
            }).GeneratePdf();

            return pdfBytes;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi tạo PDF hóa đơn");
            throw;
        }
    }

    #endregion

    #region Get Invoice Detail

    /// <summary>
    /// LẤY THÔNG TIN CHI TIẾT HÓA ĐƠN
    /// </summary>
    public async Task<InvoiceDetailResponse> GetInvoiceDetailAsync(string idHoaDon)
    {
        try
        {
            var hoaDon = await _context.HoaDons
                .Include(h => h.IddatPhongNavigation)
                    .ThenInclude(d => d!.IdkhachHangNavigation)
                .Include(h => h.IddatPhongNavigation)
                    .ThenInclude(d => d!.IdphongNavigation)
                        .ThenInclude(p => p!.IdloaiPhongNavigation)
                .Include(h => h.IddatPhongNavigation)
                    .ThenInclude(d => d!.ChiTietDatPhongs)
                        .ThenInclude(ct => ct.Phong)
                            .ThenInclude(p => p!.IdloaiPhongNavigation)
                .Include(h => h.Cthddvs)
                    .ThenInclude(c => c.IddichVuNavigation)
                .FirstOrDefaultAsync(h => h.IdhoaDon == idHoaDon);

            if (hoaDon == null)
            {
                return null!;
            }

            var datPhong = hoaDon.IddatPhongNavigation;
            var khachHang = datPhong?.IdkhachHangNavigation;

            var tienDichVu = hoaDon.Cthddvs.Sum(c => c.TienDichVu ?? 0);
            var tienPhong = hoaDon.TienPhong ?? 0;
            var tienCoc = hoaDon.TienCoc ?? 0;
            var tongTien = hoaDon.TongTien;

            var response = new InvoiceDetailResponse
            {
                IdHoaDon = hoaDon.IdhoaDon,
                IdDatPhong = hoaDon.IddatPhong,
                NgayLap = hoaDon.NgayLap ?? DateTime.Now,
                SoNgay = hoaDon.Slngay ?? 1,
                
                // Thông tin khách hàng
                TenKhachHang = khachHang?.HoTen,
                SoDienThoaiKhachHang = khachHang?.SoDienThoai,
                EmailKhachHang = khachHang?.Email,
                
                // Thông tin phòng
                DanhSachPhong = datPhong?.ChiTietDatPhongs?.Select(ct => new RoomDetailDto
                {
                    IdPhong = ct.IDPhong,
                    TenPhong = ct.Phong?.TenPhong ?? "N/A",
                    LoaiPhong = ct.Phong?.IdloaiPhongNavigation?.TenLoaiPhong ?? "N/A",
                    GiaPhong = ct.GiaPhong,
                    SoDem = ct.SoDem,
                    ThanhTien = ct.ThanhTien
                }).ToList() ?? new List<RoomDetailDto>(),
                
                // Thông tin tiền
                TienPhong = tienPhong,
                TienDichVu = tienDichVu,
                TongTienTruocGiam = tongTien,
                TienGiamGia = 0,
                TienCoc = tienCoc,
                TongTien = tongTien,
                ConLai = tongTien - tienCoc - (hoaDon.TienThanhToan ?? 0),
                
                TrangThaiThanhToan = hoaDon.TrangThaiThanhToan ?? 0,
                TenTrangThaiThanhToan = (hoaDon.TrangThaiThanhToan ?? 0) switch
                {
                    1 => "Chờ xử lý",
                    2 => "Hoàn tất",
                    3 => "Hoàn tiền",
                    0 => "Đã hủy",
                    _ => "Không xác định"
                },
                
                PaymentId = hoaDon.PaymentId,
                GhiChu = hoaDon.GhiChu,
                
                // Danh sách dịch vụ
                DanhSachDichVu = hoaDon.Cthddvs.Select(c => new ServiceDetailDto
                {
                    IdDichVu = c.IddichVu,
                    TenDichVu = c.IddichVuNavigation?.TenDichVu ?? "N/A",
                    GiaDichVu = c.TienDichVu ?? 0,
                    ThoiGianThucHien = c.ThoiGianThucHien
                }).ToList()
            };

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi lấy chi tiết hóa đơn");
            return null!;
        }
    }

    #endregion

    #region Payment Callback Handler

    /// <summary>
    /// XỬ LÝ CALLBACK TỪ VÍ ĐIỆN TỬ:
    /// 1. Nhận callback từ ví (MoMo/ZaloPay/VNPay/ShopeePay)
    /// 2. Xác thực chữ ký/signature
    /// 3. Kiểm tra trạng thái giao dịch
    /// 4. Cập nhật database nếu thành công
    /// 5. Gửi thông báo cho khách hàng
    /// </summary>
    public async Task<bool> HandlePaymentCallbackAsync(string paymentId, Dictionary<string, string> callbackData)
    {
        try
        {
            // Tìm hóa đơn theo PaymentId
            var hoaDon = await _context.HoaDons
                .Include(h => h.IddatPhongNavigation)
                .FirstOrDefaultAsync(h => h.PaymentId == paymentId);

            if (hoaDon == null)
            {
                _logger.LogWarning($"Không tìm thấy hóa đơn với PaymentId: {paymentId}");
                return false;
            }

            // Validate callback (giả lập)
            if (!ValidateCallback(callbackData))
            {
                _logger.LogWarning($"Callback không hợp lệ cho PaymentId: {paymentId}");
                return false;
            }

            // Kiểm tra trạng thái thanh toán từ callback
            var isSuccess = callbackData.GetValueOrDefault("status") == "SUCCESS";

            if (isSuccess)
            {
                // Cập nhật trạng thái thanh toán thành công
                hoaDon.TrangThaiThanhToan = 2; // Hoàn tất
                
                if (hoaDon.IddatPhongNavigation != null)
                {
                    hoaDon.IddatPhongNavigation.TrangThai = 4; // Hoàn thành
                    hoaDon.IddatPhongNavigation.TrangThaiThanhToan = 2;
                }

                // Cập nhật thống kê doanh thu
                await UpdateRevenueStatisticsAsync(hoaDon);

                await _context.SaveChangesAsync();

                _logger.LogInformation($"Callback thanh toán thành công cho PaymentId: {paymentId}");
                return true;
            }
            else
            {
                // Thanh toán thất bại
                hoaDon.TrangThaiThanhToan = 0; // Hủy
                hoaDon.GhiChu = $"{hoaDon.GhiChu}\nThanh toán thất bại.";
                
                await _context.SaveChangesAsync();
                
                _logger.LogWarning($"Callback thanh toán thất bại cho PaymentId: {paymentId}");
                return false;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi xử lý callback thanh toán");
            return false;
        }
    }

    #endregion

    #region Cancel Payment

    /// <summary>
    /// HỦY THANH TOÁN (CHỈ CHO GIAO DỊCH CHỜ XỬ LÝ)
    /// </summary>
    public async Task<PaymentResponse> CancelPaymentAsync(string idHoaDon, string reason)
    {
        try
        {
            var hoaDon = await _context.HoaDons
                .FirstOrDefaultAsync(h => h.IdhoaDon == idHoaDon);

            if (hoaDon == null)
            {
                return new PaymentResponse
                {
                    Success = false,
                    Message = "Không tìm thấy hóa đơn"
                };
            }

            if (hoaDon.TrangThaiThanhToan != 1)
            {
                return new PaymentResponse
                {
                    Success = false,
                    Message = "Chỉ có thể hủy giao dịch đang chờ xử lý"
                };
            }

            hoaDon.TrangThaiThanhToan = 0; // Hủy
            hoaDon.GhiChu = $"{hoaDon.GhiChu}\nHủy thanh toán: {reason}";

            await _context.SaveChangesAsync();

            return new PaymentResponse
            {
                Success = true,
                Message = "Hủy thanh toán thành công",
                IdHoaDon = idHoaDon,
                Status = 0
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi hủy thanh toán");
            return new PaymentResponse
            {
                Success = false,
                Message = $"Lỗi hủy thanh toán: {ex.Message}"
            };
        }
    }

    #endregion

    #region Helper Methods

    /// <summary>
    /// Cập nhật thống kê doanh thu khi thanh toán thành công
    /// </summary>
    private async Task UpdateRevenueStatisticsAsync(HoaDon hoaDon)
    {
        try
        {
            var thongKe = new ThongKeDoanhThuKhachSan
            {
                IdhoaDon = hoaDon.IdhoaDon,
                IddatPhong = hoaDon.IddatPhong,
                Ngay = DateOnly.FromDateTime(DateTime.Now),
                TongPhong = 1,
                SoDemDaDat = hoaDon.Slngay ?? 0,
                TienPhong = hoaDon.TienPhong ?? 0,
                TienDichVu = hoaDon.Cthddvs?.Sum(c => c.TienDichVu) ?? 0,
                TienGiamGia = 0,
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now
            };

            _context.ThongKeDoanhThuKhachSans.Add(thongKe);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi cập nhật thống kê doanh thu");
        }
    }

    /// <summary>
    /// Cập nhật thống kê khi hoàn tiền
    /// </summary>
    private async Task UpdateRevenueStatisticsForRefundAsync(HoaDon hoaDon, decimal refundAmount)
    {
        try
        {
            // Tìm bản ghi thống kê tương ứng và điều chỉnh
            var thongKe = await _context.ThongKeDoanhThuKhachSans
                .FirstOrDefaultAsync(t => t.IdhoaDon == hoaDon.IdhoaDon);

            if (thongKe != null)
            {
                // Ghi chú hoàn tiền trong thống kê (có thể thêm field mới nếu cần)
                thongKe.UpdatedAt = DateTime.Now;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi cập nhật thống kê hoàn tiền");
        }
    }

    /// <summary>
    /// Validate thông tin thẻ tín dụng
    /// </summary>
    private bool ValidateCreditCard(CreditCardInfo cardInfo)
    {
        // Kiểm tra số thẻ (Luhn algorithm - giản lược)
        if (string.IsNullOrEmpty(cardInfo.CardNumber) || cardInfo.CardNumber.Length < 13)
            return false;

        // Kiểm tra ngày hết hạn
        if (!int.TryParse(cardInfo.ExpiryMonth, out int month) || month < 1 || month > 12)
            return false;

        if (!int.TryParse(cardInfo.ExpiryYear, out int year) || year < DateTime.Now.Year)
            return false;

        // Kiểm tra CVV
        if (string.IsNullOrEmpty(cardInfo.CVV) || cardInfo.CVV.Length < 3)
            return false;

        return true;
    }

    /// <summary>
    /// Giả lập xử lý qua Payment Gateway
    /// </summary>
    private async Task<(bool Success, string Message)> SimulatePaymentGatewayAsync(CreditCardInfo cardInfo, decimal amount)
    {
        // Giả lập thời gian xử lý
        await Task.Delay(1000);

        // Giả lập tỷ lệ thành công 95%
        var random = new Random();
        if (random.Next(100) < 95)
        {
            return (true, "Giao dịch thành công");
        }
        else
        {
            return (false, "Giao dịch bị từ chối bởi ngân hàng");
        }
    }

    /// <summary>
    /// Mask số thẻ tín dụng
    /// </summary>
    private string MaskCardNumber(string cardNumber)
    {
        if (string.IsNullOrEmpty(cardNumber) || cardNumber.Length < 4)
            return cardNumber;

        return $"****-****-****-{cardNumber.Substring(cardNumber.Length - 4)}";
    }

    /// <summary>
    /// Tạo URL thanh toán ví điện tử
    /// </summary>
    private string GenerateEWalletPaymentUrl(string walletType, string paymentId, decimal amount, string orderId)
    {
        var baseUrl = walletType.ToUpper() switch
        {
            "MOMO" => "https://test-payment.momo.vn/v2/gateway/api/create",
            "ZALOPAY" => "https://sb-openapi.zalopay.vn/v2/create",
            "VNPAY" => "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
            "SHOPEEPAY" => "https://api-wallet.shopee.vn/payment",
            _ => ""
        };

        return $"{baseUrl}?paymentId={paymentId}&amount={amount}&orderId={orderId}";
    }

    /// <summary>
    /// Tạo QR code (giả lập)
    /// </summary>
    private string GenerateQRCode(string data)
    {
        // Trong thực tế sẽ dùng thư viện QR Code
        // Ở đây chỉ return base64 string giả lập
        return Convert.ToBase64String(Encoding.UTF8.GetBytes(data));
    }

    /// <summary>
    /// Validate callback từ ví điện tử
    /// </summary>
    private bool ValidateCallback(Dictionary<string, string> callbackData)
    {
        // Trong thực tế cần verify signature/checksum
        // Ở đây giả lập đơn giản
        return callbackData != null && callbackData.ContainsKey("status");
    }

    /// <summary>
    /// Tạo chuỗi ngẫu nhiên
    /// </summary>
    private string GenerateRandomString(int length)
    {
        const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        var random = new Random();
        return new string(Enumerable.Repeat(chars, length)
            .Select(s => s[random.Next(s.Length)]).ToArray());
    }

    #endregion
}
