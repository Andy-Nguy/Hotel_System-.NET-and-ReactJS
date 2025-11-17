namespace Hotel_System.API.DTOs;

/// <summary>
/// DTO chi tiết hóa đơn
/// </summary>
public class InvoiceDetailResponse
{
    public string IdHoaDon { get; set; } = null!;
    public string IdDatPhong { get; set; } = null!;
    public DateTime NgayLap { get; set; }
    public int SoNgay { get; set; }
    
    // Thông tin khách hàng
    public string? TenKhachHang { get; set; }
    public string? EmailKhachHang { get; set; }
    public string? SoDienThoaiKhachHang { get; set; }

    // Thông tin phòng
    public List<RoomDetailDto> DanhSachPhong { get; set; } = new();
    
    // Chi tiết dịch vụ
    public List<ServiceDetailDto> DanhSachDichVu { get; set; } = new();

    // Tính toán tiền
    public decimal TienPhong { get; set; }
    public decimal TienDichVu { get; set; }
    public decimal TongTienTruocGiam { get; set; }
    public decimal TienGiamGia { get; set; }
    public decimal TienCoc { get; set; }
    public decimal TongTien { get; set; }
    public decimal ConLai { get; set; }

    // Trạng thái
    public int TrangThaiThanhToan { get; set; }
    public string TenTrangThaiThanhToan { get; set; } = null!;

    // Thông tin thanh toán
    public string? PaymentId { get; set; }
    public string? PaymentMethod { get; set; }
    public DateTime? PaymentDate { get; set; }
    
    public string? GhiChu { get; set; }
}

public class RoomDetailDto
{
    public string IdPhong { get; set; } = null!;
    public string TenPhong { get; set; } = null!;
    public string LoaiPhong { get; set; } = null!;
    public decimal GiaPhong { get; set; }
    public int SoDem { get; set; }
    public decimal ThanhTien { get; set; }
}

public class ServiceDetailDto
{
    public string IdDichVu { get; set; } = null!;
    public string TenDichVu { get; set; } = null!;
    public decimal GiaDichVu { get; set; }
    public DateTime? ThoiGianThucHien { get; set; }
}
