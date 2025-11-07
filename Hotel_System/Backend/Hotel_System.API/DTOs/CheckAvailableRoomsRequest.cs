namespace Hotel_System.API.DTOs
{
    public class CheckAvailableRoomsRequest
    {
        public DateTime CheckIn { get; set; }
        public DateTime CheckOut { get; set; }
        public int NumberOfGuests { get; set; }
    }
}
