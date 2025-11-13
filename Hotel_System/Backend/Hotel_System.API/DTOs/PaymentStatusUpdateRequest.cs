using System.ComponentModel.DataAnnotations;

namespace Hotel_System.API.DTOs;

public class PaymentStatusUpdateRequest
{
    [Required(ErrorMessage = "IDDatPhong là bắt buộc")]
    public required string IDDatPhong { get; set; }

    [Required(ErrorMessage = "TrangThaiThanhToan là bắt buộc")]
    [Range(0, 2, ErrorMessage = "TrangThaiThanhToan phải từ 0-2 (0=Chưa TT, 1=Đã cọc, 2=Đã TT đủ)")]
    public required int TrangThaiThanhToan { get; set; }

    public string? GhiChu { get; set; }
}
