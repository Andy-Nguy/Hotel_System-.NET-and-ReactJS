namespace Hotel_System.API.DTOs;

public class PaymentStatusUpdateResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public string? IDDatPhong { get; set; }
    public string? IDHoaDon { get; set; }
    public int TrangThaiThanhToan { get; set; }
    public decimal TongTien { get; set; }
    public decimal TienCoc { get; set; }
    public decimal TienThanhToan { get; set; }
}
