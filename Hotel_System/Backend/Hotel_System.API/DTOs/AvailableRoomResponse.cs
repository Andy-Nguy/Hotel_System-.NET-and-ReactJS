namespace Hotel_System.API.DTOs
{
    public class AvailableRoomResponse
    {
        public string RoomId { get; set; } = string.Empty;
        public string RoomName { get; set; } = string.Empty;
        public string RoomNumber { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public decimal BasePricePerNight { get; set; }
        public string RoomImageUrl { get; set; } = string.Empty;
        public string RoomTypeName { get; set; } = string.Empty;
        public int MaxOccupancy { get; set; }
    }
}
