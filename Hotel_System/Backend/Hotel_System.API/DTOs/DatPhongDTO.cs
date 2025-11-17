using System.ComponentModel.DataAnnotations;

namespace Hotel_System.API.DTOs;

/// <summary>
/// DTO cho request tạo đặt phòng
/// </summary>
public class DatPhongRequest
{
    [Required(ErrorMessage = "ID khách hàng là bắt buộc")]
    public int IDKhachHang { get; set; }

    [Required(ErrorMessage = "ID phòng là bắt buộc")]
    public string IDPhong { get; set; } = null!;

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

    /// <summary>
    /// Trạng thái: 1:Chờ XN, 2:Đã XN, 0:Hủy, 3:Đang dùng, 4:Hoàn thành
    /// </summary>
    public int TrangThai { get; set; } = 1;

    /// <summary>
    /// Trạng thái thanh toán: 1:Chưa TT, 2:Đã TT, 0:Đã cọc, -1:Chưa cọc
    /// </summary>
    public int TrangThaiThanhToan { get; set; } = -1;
}

/// <summary>
/// DTO cho response tạo đặt phòng
/// </summary>
public class DatPhongResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = null!;
    public string? IDDatPhong { get; set; }
    public DateOnly? NgayDatPhong { get; set; }
    public decimal? TongTien { get; set; }
    public decimal? TienCoc { get; set; }
}
