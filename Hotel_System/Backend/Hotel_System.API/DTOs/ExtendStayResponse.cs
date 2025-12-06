namespace Hotel_System.API.DTOs
{
    /// <summary>
    /// Response sau khi gia hạn thành công
    /// </summary>
    public class ExtendStayResponse
    {
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
        
        /// <summary>
        /// Mã đặt phòng (cũ hoặc mới nếu đổi phòng)
        /// </summary>
        public string IddatPhong { get; set; } = string.Empty;

        /// <summary>
        /// Phí gia hạn (chưa VAT)
        /// </summary>
        public decimal ExtendFee { get; set; }

        /// <summary>
        /// VAT (10%)
        /// </summary>
        public decimal VatAmount { get; set; }

        /// <summary>
        /// Tổng phí gia hạn (đã VAT)
        /// </summary>
        public decimal TotalExtendFee { get; set; }

        /// <summary>
        /// Ngày checkout cũ
        /// </summary>
        public DateOnly OldCheckout { get; set; }

        /// <summary>
        /// Ngày checkout mới
        /// </summary>
        public DateOnly NewCheckout { get; set; }

        /// <summary>
        /// Mã hóa đơn (cũ nếu không đổi phòng, mới nếu đổi phòng)
        /// </summary>
        public string? HoaDonId { get; set; }

        /// <summary>
        /// Mã phòng mới (nếu có chuyển phòng)
        /// </summary>
        public string? NewRoomId { get; set; }

        /// <summary>
        /// Tên phòng mới
        /// </summary>
        public string? NewRoomName { get; set; }

        /// <summary>
        /// QR URL nếu thanh toán online
        /// </summary>
        public string? QrUrl { get; set; }

        /// <summary>
        /// Mô tả loại gia hạn
        /// </summary>
        public string ExtendDescription { get; set; } = string.Empty;
        
        /// <summary>
        /// Có đổi phòng hay không
        /// </summary>
        public bool IsRoomChange { get; set; }
        
        /// <summary>
        /// Mã booking mới (nếu đổi phòng)
        /// </summary>
        public string? NewBookingId { get; set; }
        
        /// <summary>
        /// Mã hóa đơn mới (nếu đổi phòng)
        /// </summary>
        public string? NewInvoiceId { get; set; }
        
        /// <summary>
        /// Mã hóa đơn cũ đã thanh toán (nếu đổi phòng)
        /// </summary>
        public string? OldInvoiceId { get; set; }
    }

    /// <summary>
    /// Response kiểm tra khả năng gia hạn
    /// </summary>
    public class CheckExtendAvailabilityResponse
    {
        public bool CanExtend { get; set; }
        public bool CanExtendSameRoom { get; set; }
        public bool HasNextBooking { get; set; }
        
        /// <summary>
        /// True nếu booking đã được gia hạn trong ngày (SameDay) 1 lần rồi.
        /// Frontend sẽ ẩn/disable option "Trong ngày" và chỉ cho phép "Thêm đêm".
        /// </summary>
        public bool HasSameDayExtended { get; set; }
        
        public string Message { get; set; } = string.Empty;


        /// <summary>
        /// Thông tin booking tiếp theo (nếu có)
        /// </summary>
        public NextBookingInfo? NextBooking { get; set; }

        /// <summary>
        /// Danh sách phòng trống có thể chuyển sang
        /// </summary>
        public List<AvailableRoomForExtend> AvailableRooms { get; set; } = new();

        /// <summary>
        /// Các option gia hạn trong ngày với phí tương ứng
        /// </summary>
        public List<ExtendOption> SameDayOptions { get; set; } = new();

        /// <summary>
        /// Giá 1 đêm thêm
        /// </summary>
        public decimal ExtraNightRate { get; set; }

        /// <summary>
        /// Giá 1 đêm thêm (đã VAT)
        /// </summary>
        public decimal ExtraNightRateWithVat { get; set; }
    }

    public class NextBookingInfo
    {
        public string IddatPhong { get; set; } = string.Empty;
        public string CustomerName { get; set; } = string.Empty;
        public DateOnly CheckinDate { get; set; }
    }

    public class AvailableRoomForExtend
    {
        public string Idphong { get; set; } = string.Empty;
        public string TenPhong { get; set; } = string.Empty;
        public string? SoPhong { get; set; }
        public string? TenLoaiPhong { get; set; }
        public decimal GiaMotDem { get; set; }
        public List<string>? UrlAnhPhong { get; set; }
        public int? SoNguoiToiDa { get; set; }
        
        /// <summary>
        /// Trạng thái phòng (chỉ trả về phòng "Trống")
        /// </summary>
        public string? TrangThai { get; set; }
        
        /// <summary>
        /// Tên chương trình khuyến mãi (nếu có)
        /// </summary>
        public string? PromotionName { get; set; }

        /// <summary>
        /// Phần trăm giảm giá (nếu áp dụng theo %)
        /// </summary>
        public decimal? DiscountPercent { get; set; }

        /// <summary>
        /// Giá đã áp dụng khuyến mãi (nếu có)
        /// </summary>
        public decimal? DiscountedPrice { get; set; }

        /// <summary>
        /// Mô tả / thông tin ngắn về phòng
        /// </summary>
        public string? Description { get; set; }
    }

    public class ExtendOption
    {
        /// <summary>
        /// Giờ checkout: 15, 18, 24 (23:59)
        /// </summary>
        public int Hour { get; set; }

        /// <summary>
        /// Mô tả: "Đến 15:00", "Đến 18:00", "Đến 23:59"
        /// </summary>
        public string Description { get; set; } = string.Empty;

        /// <summary>
        /// Phần trăm phí: 30%, 50%, 100%
        /// </summary>
        public int Percentage { get; set; }

        /// <summary>
        /// Phí gia hạn (chưa VAT)
        /// </summary>
        public decimal Fee { get; set; }

        /// <summary>
        /// Phí gia hạn (đã VAT 10%)
        /// </summary>
        public decimal FeeWithVat { get; set; }
    }
}
