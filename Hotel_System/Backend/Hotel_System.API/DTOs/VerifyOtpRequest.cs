namespace Hotel_System.API.DTOs
{
    public class VerifyOtpRequest
    {
        public long PendingId { get; set; }
        public string? Otp { get; set; }
    }
}
