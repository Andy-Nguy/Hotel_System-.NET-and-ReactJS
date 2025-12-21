namespace Hotel_System.API.DTOs
{
    public class AvailableRoomResponse
    {
        public string RoomId { get; set; } = string.Empty;
        public string RoomName { get; set; } = string.Empty;
        public string RoomNumber { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public decimal BasePricePerNight { get; set; }
        public decimal? DiscountedPrice { get; set; }
        public string? PromotionName { get; set; }
        public decimal? DiscountPercent { get; set; }
        public string RoomImageUrl { get; set; } = string.Empty;
        public List<string>? RoomImageUrls { get; set; } // Multiple images for carousel
        public string RoomTypeName { get; set; } = string.Empty;
        public int MaxOccupancy { get; set; }
        public decimal? Rating { get; set; } // Average rating from reviews (xepHangSao)
    }
}

