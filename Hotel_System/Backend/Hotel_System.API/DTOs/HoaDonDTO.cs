using System.ComponentModel.DataAnnotations;

namespace Hotel_System.API.DTOs;

/// <summary>
/// DTO cho request tạo hóa đơn
/// </summary>
public class HoaDonRequest
{
    [Required(ErrorMessage = "ID đặt phòng là bắt buộc")]
    public string IDDatPhong { get; set; } = null!;

    [Required(ErrorMessage = "Tiền phòng là bắt buộc")]
    [Range(1, int.MaxValue, ErrorMessage = "Tiền phòng phải lớn hơn 0")]
    public int? TienPhong { get; set; }

    [Required(ErrorMessage = "Số lượng ngày là bắt buộc")]
    [Range(1, int.MaxValue, ErrorMessage = "Số lượng ngày phải lớn hơn 0")]
    public int? SoLuongNgay { get; set; }

    [Required(ErrorMessage = "Tổng tiền là bắt buộc")]
    [Range(0.01, double.MaxValue, ErrorMessage = "Tổng tiền phải lớn hơn 0")]
    public decimal TongTien { get; set; }

    /// <summary>
    /// Tiền cọc (nếu có) - sẽ được lấy từ CSDL, không cần gửi lên
    /// </summary>
    public decimal TienCoc { get; set; } = 0;

    /// <summary>
    /// Số điểm khách muốn dùng để quy ra tiền giảm (mỗi điểm -> 1000đ theo quy ước)
    /// </summary>
    public int? RedeemPoints { get; set; }

    /// <summary>
    /// Tiền thanh toán - sẽ được tính tự động = TongTien - TienCoc
    /// </summary>
    public decimal? TienThanhToan { get; set; }

    /// <summary>
    /// Trạng thái thanh toán: 
    /// 0: Chưa thanh toán
    /// 1: Đã cọc (chưa thanh toán đủ)
    /// 2: Đã thanh toán đủ
    /// </summary>
    [Required(ErrorMessage = "Trạng thái thanh toán là bắt buộc")]
    public int TrangThaiThanhToan { get; set; } = 0;

    public string? GhiChu { get; set; }
}

/// <summary>
/// Optional service line items when creating an invoice + payment
/// </summary>
public class ServiceLineDto
{
    public string IddichVu { get; set; } = string.Empty;
    public int SoLuong { get; set; } = 1;
    public decimal DonGia { get; set; } = 0m;
    public decimal TienDichVu { get; set; } = 0m;
    public string? Idphong { get; set; }
    public int? SoPhong { get; set; }
    public DateTime? ThoiGianThucHien { get; set; }
    // Optional: map booking detail id
    public int? IdChiTiet { get; set; }
}


/// <summary>
/// DTO cho request tạo hóa đơn kèm thanh toán
/// </summary>
public class HoaDonPaymentRequest
{
    [Required(ErrorMessage = "ID đặt phòng là bắt buộc")]
    public string IDDatPhong { get; set; } = null!;

    public int? TienPhong { get; set; }

    public int? SoLuongNgay { get; set; }

    [Required(ErrorMessage = "Tổng tiền là bắt buộc")]
    [Range(0.01, double.MaxValue, ErrorMessage = "Tổng tiền phải lớn hơn 0")]
    public decimal TongTien { get; set; }

    /// <summary>
    /// Phương thức thanh toán:
    /// 1 = Tiền mặt khi đến
    /// 2 = Thanh toán online (VNPay, Momo, thẻ ngân hàng, ví điện tử)
    /// 3 = Thanh toán tại quầy
    /// </summary>
    [Required(ErrorMessage = "Phương thức thanh toán là bắt buộc")]
    [Range(1, 3, ErrorMessage = "Phương thức thanh toán không hợp lệ (1-3)")]
    public int PhuongThucThanhToan { get; set; }

    /// <summary>
    /// Nếu client muốn gửi tiền cọc trực tiếp trong request (ví dụ: đặt cọc 500.000đ),
    /// có thể gửi vào đây. Nếu không gửi, server sẽ dùng giá trị DatPhong.TienCoc từ CSDL.
    /// </summary>
    public decimal? TienCoc { get; set; }

    /// <summary>
    /// Tiền thanh toán trước check-in (nếu khách đã thanh toán từng phần trước).
    /// Server sẽ cộng TienCoc + PreviousPayment để tính "Đã thanh toán"
    /// </summary>
    public decimal? PreviousPayment { get; set; }

    /// <summary>
    /// Số điểm khách muốn dùng để giảm giá (1 điểm = 100 VND giảm).
    /// Server sẽ validate và áp dụng giới hạn 50% hóa đơn.
    /// </summary>
    public int? RedeemPoints { get; set; }

    /// <summary>
    /// Tùy chọn: cho phép client gửi rõ trạng thái thanh toán mong muốn.
    /// - 0 = Đã cọc
    /// - 1 = Chưa thanh toán
    /// - 2 = Đã thanh toán đầy đủ
    /// Nếu không gửi, server sẽ suy luận mặc định từ PhuongThucThanhToan (online -> 2, khác -> 1).
    /// </summary>
    public int? TrangThaiThanhToan { get; set; }

    /// <summary>
    /// Cổng thanh toán (VNPay, Momo, etc.) - chỉ dùng khi PhuongThucThanhToan = 2
    /// </summary>
    public string? PaymentGateway { get; set; }

    public string? GhiChu { get; set; }
    
    // Optional list of service lines attached to the invoice
    public List<ServiceLineDto>? Services { get; set; }

}

/// <summary>
/// DTO cho request callback từ cổng thanh toán
/// </summary>
public class PaymentCallbackRequest
{
    [Required(ErrorMessage = "ID hóa đơn là bắt buộc")]
    public string IDHoaDon { get; set; } = null!;

    [Required(ErrorMessage = "Mã giao dịch là bắt buộc")]
    public string TransactionId { get; set; } = null!;

    public string? PaymentGateway { get; set; }

    public DateTime? PaymentTime { get; set; }
}

/// <summary>
/// Dòng dịch vụ được gửi kèm khi tạo hóa đơn
/// </summary>
public class ServiceLineRequest
{
    /// <summary>
    /// ID dịch vụ (IDDichVu)
    /// </summary>
    public string? IddichVu { get; set; }

    /// <summary>
    /// Số lượng dịch vụ
    /// </summary>
    // removed: quantity is no longer used in CTHDDV

    /// <summary>
    /// Đơn giá của dịch vụ (nếu client có)
    /// </summary>
    public decimal? DonGia { get; set; }

    /// <summary>
    /// Tổng tiền dòng (donGia * soLuong) nếu client có gửi
    /// </summary>
    // TienDichVu represents the line total (no quantity multiplication)
    public decimal? TienDichVu { get; set; }

    /// <summary>
    /// ID phòng nếu dịch vụ gắn cho phòng cụ thể
    /// </summary>
    public string? Idphong { get; set; }

    /// <summary>
    /// Số phòng/roomNumber nếu client dùng cách đánh số phòng
    /// </summary>
    public int? SoPhong { get; set; }

    /// <summary>
    /// Thời gian bắt đầu/ket thuc (ISO string) - optional
    /// </summary>
    public string? ThoiGianBatDau { get; set; }
    public string? ThoiGianKetThuc { get; set; }
    // Optional: related booking detail id
    public int? IdChiTiet { get; set; }
}

/// <summary>
/// DTO cho response tạo hóa đơn
/// </summary>
public class HoaDonResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = null!;
    public string? IDHoaDon { get; set; }
    public string? IDDatPhong { get; set; }
    public DateTime? NgayLap { get; set; }
    public decimal? TongTien { get; set; }
    public decimal? TienCoc { get; set; }
    public decimal? TienThanhToan { get; set; }
    public int? TrangThaiThanhToan { get; set; }
    
    // Thông tin thanh toán online (nếu có)
    public string? PaymentUrl { get; set; }
    public string? PaymentMethod { get; set; }

    // Thông tin loyalty / redeem được áp dụng (server-authoritative)
    /// <summary>
    /// Số điểm thực tế đã sử dụng để quy ra tiền giảm
    /// </summary>
    public int? RedeemedPoints { get; set; }

    /// <summary>
    /// Giá trị tiền (VND) được giảm bởi điểm redeemed
    /// </summary>
    public decimal? RedeemedValue { get; set; }

    /// <summary>
    /// Số điểm khách được cộng sau giao dịch
    /// </summary>
    public int? PointsEarned { get; set; }

    /// <summary>
    /// Số điểm khách còn lại sau giao dịch
    /// </summary>
    public int? PointsAfter { get; set; }

    /// <summary>
    /// Tổng tiền giảm do khuyến mãi được áp dụng (nếu có)
    /// </summary>
    public decimal? AppliedPromotionValue { get; set; }
}
