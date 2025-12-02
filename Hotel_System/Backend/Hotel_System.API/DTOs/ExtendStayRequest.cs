namespace Hotel_System.API.DTOs
{
    /// <summary>
    /// Loại gia hạn: trong ngày hoặc qua đêm
    /// </summary>
    public enum ExtendType
    {
        /// <summary>
        /// Gia hạn trong ngày (late checkout): 12h → 15h/18h/23:59
        /// </summary>
        SameDay = 1,
        
        /// <summary>
        /// Gia hạn qua đêm: thêm 1+ đêm
        /// </summary>
        ExtraNight = 2
    }

    /// <summary>
    /// Request gia hạn phòng
    /// </summary>
    public class ExtendStayRequest
    {
        /// <summary>
        /// Mã đặt phòng cần gia hạn
        /// </summary>
        public string IddatPhong { get; set; } = string.Empty;

        /// <summary>
        /// Loại gia hạn: SameDay (1) hoặc ExtraNight (2)
        /// </summary>
        public ExtendType ExtendType { get; set; } = ExtendType.SameDay;

        /// <summary>
        /// Nếu SameDay: giờ checkout mới (15, 18, 24 = 23:59)
        /// Nếu ExtraNight: không sử dụng
        /// </summary>
        public int? NewCheckoutHour { get; set; }

        /// <summary>
        /// Số đêm gia hạn thêm (chỉ dùng khi ExtendType = ExtraNight)
        /// </summary>
        public int ExtraNights { get; set; } = 1;

        /// <summary>
        /// Mã phòng mới nếu cần chuyển phòng (khi phòng cũ có booking mới)
        /// </summary>
        public string? NewRoomId { get; set; }

        /// <summary>
        /// Phương thức thanh toán: 1 = Tiền mặt, 2 = QR/Online
        /// </summary>
        public int PaymentMethod { get; set; } = 1;

        /// <summary>
        /// Ghi chú của lễ tân
        /// </summary>
        public string? Note { get; set; }
    }
}
