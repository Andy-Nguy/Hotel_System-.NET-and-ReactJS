namespace Hotel_System.API.DTOs;

/// <summary>
/// Response cho danh sách khuyến mãi
/// </summary>
public class PromotionResponse
{
    public string IdKhuyenMai { get; set; } = string.Empty;
    public string TenKhuyenMai { get; set; } = string.Empty;
    public string? MoTa { get; set; }
    public string LoaiGiamGia { get; set; } = string.Empty; // "percent" hoặc "fixed"
    public decimal GiaTriGiam { get; set; }
    public DateOnly NgayBatDau { get; set; }
    public DateOnly NgayKetThuc { get; set; }
    public string TrangThai { get; set; } = string.Empty; // "active", "expired", "upcoming"
    public List<string> DanhSachPhongApDung { get; set; } = new();
    public bool IsApplicable { get; set; } // Có thể áp dụng cho booking hiện tại không
}

/// <summary>
/// Request để áp dụng mã giảm giá
/// </summary>
public class ApplyPromotionRequest
{
    public string MaKhuyenMai { get; set; } = string.Empty;
    public int IdHoaDon { get; set; }
    public List<string> DanhSachPhong { get; set; } = new(); // Danh sách ID phòng đã đặt
}

/// <summary>
/// Response khi áp dụng khuyến mãi
/// </summary>
public class ApplyPromotionResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public decimal TongTienGoc { get; set; }
    public decimal SoTienGiam { get; set; }
    public decimal TongTienSauGiam { get; set; }
    public string? MaKhuyenMaiApDung { get; set; }
}

/// <summary>
/// Response cho thông tin điểm tích lũy
/// </summary>
public class LoyaltyPointsResponse
{
    public int IdKhachHang { get; set; }
    public string HoTen { get; set; } = string.Empty;
    public int DiemHienTai { get; set; }
    public int DiemCoTheDoi { get; set; } // Điểm có thể đổi thành voucher
    public List<VoucherExchangeOption> VoucherKhaDung { get; set; } = new();
}

/// <summary>
/// Tùy chọn đổi điểm lấy voucher
/// </summary>
public class VoucherExchangeOption
{
    public string TenVoucher { get; set; } = string.Empty;
    public string MoTa { get; set; } = string.Empty;
    public int DiemCanThiet { get; set; }
    public decimal GiaTriVoucher { get; set; }
    public string LoaiGiamGia { get; set; } = string.Empty; // "percent" hoặc "fixed"
}

/// <summary>
/// Request đổi điểm lấy voucher
/// </summary>
public class ExchangePointsRequest
{
    public int IdKhachHang { get; set; }
    public int SoDiemDoi { get; set; }
    public string LoaiVoucher { get; set; } = string.Empty; // "10k", "20k", "50k", "100k"
}

/// <summary>
/// Response khi đổi điểm
/// </summary>
public class ExchangePointsResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public int DiemConLai { get; set; }
    public string MaVoucher { get; set; } = string.Empty; // Mã voucher mới tạo
    public decimal GiaTriVoucher { get; set; }
    public DateOnly NgayHetHan { get; set; }
}
