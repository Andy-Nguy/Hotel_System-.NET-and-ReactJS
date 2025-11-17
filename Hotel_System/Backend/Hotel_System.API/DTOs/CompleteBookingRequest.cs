using System.ComponentModel.DataAnnotations;

namespace Hotel_System.API.DTOs;

/// <summary>
/// DTO cho request đặt phòng hoàn chỉnh - LƯU HẾT 3 BẢNG
/// Bao gồm: DatPhong + ChiTietDatPhong + HoaDon
/// </summary>
public class CompleteBookingRequest
{
    // ===== THÔNG TIN KHÁCH HÀNG =====
    [Required(ErrorMessage = "ID khách hàng là bắt buộc")]
    public int IDKhachHang { get; set; }

    // ===== THÔNG TIN ĐẶT PHÒNG =====
    [Required(ErrorMessage = "Ngày nhận phòng là bắt buộc")]
    public DateOnly NgayNhanPhong { get; set; }

    [Required(ErrorMessage = "Ngày trả phòng là bắt buộc")]
    public DateOnly NgayTraPhong { get; set; }

    [Required(ErrorMessage = "Số đêm là bắt buộc")]
    [Range(1, 365, ErrorMessage = "Số đêm phải từ 1 đến 365")]
    public int SoDem { get; set; }

    [Required(ErrorMessage = "Tổng tiền là bắt buộc")]
    [Range(0.01, double.MaxValue, ErrorMessage = "Tổng tiền phải lớn hơn 0")]
    public decimal TongTien { get; set; }

    public decimal TienCoc { get; set; } = 0;

    // ===== DANH SÁCH PHÒNG (CHI TIẾT ĐẶT PHÒNG) =====
    [Required(ErrorMessage = "Danh sách phòng là bắt buộc")]
    [MinLength(1, ErrorMessage = "Phải có ít nhất 1 phòng")]
    public List<RoomBookingDetail> DanhSachPhong { get; set; } = new List<RoomBookingDetail>();

    // ===== PHƯƠNG THỨC THANH TOÁN (CHO HÓA ĐƠN) =====
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
    /// Cổng thanh toán (VNPay, Momo, etc.) - chỉ dùng khi PhuongThucThanhToan = 2
    /// </summary>
    public string? PaymentGateway { get; set; }

    public string? GhiChu { get; set; }
}

/// <summary>
/// Response cho API đặt phòng hoàn chỉnh
/// </summary>
public class CompleteBookingResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = null!;
    
    // ===== THÔNG TIN ĐẶT PHÒNG (DatPhong) =====
    public string? IDDatPhong { get; set; }
    public DateOnly? NgayDatPhong { get; set; }
    public int? TrangThai { get; set; }
    public string? TrangThaiText { get; set; }
    
    // ===== CHI TIẾT PHÒNG (ChiTietDatPhong) =====
    public int? SoLuongPhong { get; set; }
    public List<int>? DanhSachIDChiTiet { get; set; }
    
    // ===== HÓA ĐƠN (HoaDon) =====
    public string? IDHoaDon { get; set; }
    public DateTime? NgayLapHoaDon { get; set; }
    public decimal? TongTien { get; set; }
    public decimal? TienCoc { get; set; }
    public decimal? TienThanhToan { get; set; }
    public int? TrangThaiThanhToan { get; set; }
    public string? TrangThaiThanhToanText { get; set; }
    
    // ===== THANH TOÁN ONLINE (nếu có) =====
    public string? PaymentUrl { get; set; }
    public string? PaymentMethod { get; set; }
}
