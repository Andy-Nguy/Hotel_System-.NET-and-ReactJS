using System;

namespace Hotel_System.API.DTOs
{
    public class RegisterRequest
    {
        public string? Hoten { get; set; }
        public string? Email { get; set; }
        public string? Password { get; set; }
        public string? Sodienthoai { get; set; }
        public DateOnly? Ngaysinh { get; set; }
    }
}
