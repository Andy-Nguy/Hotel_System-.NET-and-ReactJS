using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace Hotel_System.API.Controllers
{
    [ApiController]
    [Route("api/booking")]
    public class BookingController : ControllerBase
    {
        private readonly ILogger<BookingController> _logger;

        public BookingController(ILogger<BookingController> logger)
        {
            _logger = logger;
        }

        // Các endpoint cũ đã được thay thế bằng `api/datphong` (tiếng Việt).
        // Trả về 410 Gone để client biết endpoint này không còn sử dụng.
        [HttpGet("{*any}")]
        [HttpPost("{*any}")]
        [HttpPut("{*any}")]
        [HttpDelete("{*any}")]
        public IActionResult Obsolete()
        {
            _logger.LogWarning("Deprecated Booking API accessed");
            return StatusCode(410, new { success = false, message = "API này đã bị thay thế, vui lòng dùng /api/datphong/..." });
        }
    }
}
