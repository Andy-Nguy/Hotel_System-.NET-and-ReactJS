namespace Hotel_System.API.DTOs;

public class CreateBookingRequest
{
    public string HoTen { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string SoDienThoai { get; set; } = string.Empty;
    public string? Cmnd { get; set; }
    public string? DiaChi { get; set; }
    public string? GhiChu { get; set; }
    public string NgayNhanPhong { get; set; } = string.Empty;
    public string NgayTraPhong { get; set; } = string.Empty;
    public int SoLuongKhach { get; set; }
    public List<RoomBookingDto> Rooms { get; set; } = new();
}

public class RoomBookingDto
{
    public string IdPhong { get; set; } = string.Empty;
    public int SoPhong { get; set; }
    public decimal GiaCoBanMotDem { get; set; }
}
