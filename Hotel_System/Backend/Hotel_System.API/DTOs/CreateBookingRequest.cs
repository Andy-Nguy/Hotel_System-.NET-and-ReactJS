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
    
    /// <summary>
    /// Đặt phòng trực tiếp - mã bắt đầu bằng "TT", mặc định = false (mã "DP")
    /// </summary>
    public bool IsDirectBooking { get; set; } = false;
    
    /// <summary>
    /// Trạng thái thanh toán khi tạo booking (0: cọc, 1: chưa TT, 2: đã TT)
    /// Mặc định = 0 (Đã cọc)
    /// </summary>
    public int TrangThaiThanhToan { get; set; } = 0;
}

public class RoomBookingDto
{
    public string IdPhong { get; set; } = string.Empty;
    public int SoPhong { get; set; }
    public decimal GiaCoBanMotDem { get; set; }
}
