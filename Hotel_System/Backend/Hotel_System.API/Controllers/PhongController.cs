using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Hotel_System.API.Models;
using Hotel_System.API.Services;
using Hotel_System.API.DTOs;

namespace Hotel_System.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class PhongController : ControllerBase
    {
        private readonly HotelSystemContext _context;
        private readonly RoomService _roomService;

        public PhongController(HotelSystemContext context, RoomService roomService)
        {
            _context = context;
            _roomService = roomService;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var rooms = await _context.Phongs.ToListAsync();
            return Ok(rooms);
        }
        // POST: api/Phong/check-available-rooms-duyanh
        [HttpPost("check-available-rooms")]
        public async Task<IActionResult> CheckAvailableRooms([FromBody] CheckAvailableRoomsRequest req)
        {
            if (req.CheckIn >= req.CheckOut)
            {
                return BadRequest("Check-in date must be earlier than check-out date.");
            }

            if (req.NumberOfGuests <= 0)
            {
                return BadRequest("Number of guests must be greater than 0.");
            }

            var rooms = await _roomService.CheckAvailableRoomsAsync(req.CheckIn, req.CheckOut, req.NumberOfGuests);

            if (rooms.Count == 0)
            {
                return Ok(new { message = "No rooms available for the selected dates and number of guests." });
            }

            return Ok(rooms);
        }
       
    }
}
