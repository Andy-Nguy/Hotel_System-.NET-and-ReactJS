using System.ComponentModel.DataAnnotations;

namespace Hotel_System.API.DTOs;

/// <summary>
/// DTO cho việc tạo đặt phòng và thanh toán
/// </summary>
public class CreateBookingPaymentRequest
{
    /// <summary>
    /// Thông tin khách hàng
    /// </summary>
    [Required(ErrorMessage = "ID khách hàng là bắt buộc")]
    public int IDKhachHang { get; set; }

    /// <summary>
    /// Ngày nhận phòng
    /// </summary>
    [Required(ErrorMessage = "Ngày nhận phòng là bắt buộc")]
    public DateOnly NgayNhanPhong { get; set; }

    /// <summary>
    /// Ngày trả phòng
    /// </summary>
    [Required(ErrorMessage = "Ngày trả phòng là bắt buộc")]
    public DateOnly NgayTraPhong { get; set; }

    /// <summary>
    /// Tiền cọc
    /// </summary>
    public decimal TienCoc { get; set; }

    /// <summary>
    /// Trạng thái: 1:Chờ XN, 2:Đã XN, 0:Hủy, 3:Đang dùng, 4:Hoàn thành
    /// </summary>
    [Required]
    public int TrangThai { get; set; } = 1;

    /// <summary>
    /// Trạng thái thanh toán: 1:Chưa TT, 2:Đã TT, 0:Đã cọc, -1:Chưa cọc
    /// </summary>
    [Required]
    public int TrangThaiThanhToan { get; set; } = -1;

    /// <summary>
    /// Danh sách phòng đặt
    /// </summary>
    [Required(ErrorMessage = "Phải có ít nhất 1 phòng")]
    [MinLength(1, ErrorMessage = "Phải có ít nhất 1 phòng")]
    public List<RoomBookingDetail> DanhSachPhong { get; set; } = new List<RoomBookingDetail>();

    /// <summary>
    /// Ghi chú cho hóa đơn
    /// </summary>
    public string? GhiChu { get; set; }
}

/// <summary>
/// DTO cho phản hồi tạo booking
/// </summary>
public class CreateBookingPaymentResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = null!;
    public string? IDDatPhong { get; set; }
    public string? IDHoaDon { get; set; }
    public decimal? TongTien { get; set; }
    public decimal? TienCoc { get; set; }
    public decimal? TienThanhToan { get; set; }
    public List<string>? DanhSachPhongDaDat { get; set; }
}


