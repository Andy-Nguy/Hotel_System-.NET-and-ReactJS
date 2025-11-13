using System.ComponentModel.DataAnnotations;

namespace Hotel_System.API.DTOs;

/// <summary>
/// DTO cho request tạo chi tiết đặt phòng
/// </summary>
public class ChiTietDatPhongRequest
{
    [Required(ErrorMessage = "ID đặt phòng là bắt buộc")]
    public string IDDatPhong { get; set; } = null!;

    [Required(ErrorMessage = "Danh sách phòng là bắt buộc")]
    [MinLength(1, ErrorMessage = "Phải có ít nhất 1 phòng")]
    public List<RoomBookingDetail> DanhSachPhong { get; set; } = new List<RoomBookingDetail>();
}

/// <summary>
/// DTO cho response tạo chi tiết đặt phòng
/// </summary>
public class ChiTietDatPhongResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = null!;
    public string? IDDatPhong { get; set; }
    public int SoLuongPhong { get; set; }
    public List<int>? DanhSachIDChiTiet { get; set; }
}
