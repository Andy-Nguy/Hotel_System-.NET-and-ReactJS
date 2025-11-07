using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Hotel_System.API.Models;
using Hotel_System.API.Services;
using Hotel_System.API.DTOs;
using Microsoft.AspNetCore.Hosting;
using System.IO;

namespace Hotel_System.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class PhongController : ControllerBase
    {
        private readonly HotelSystemContext _context;
        private readonly RoomService _roomService;
          private readonly IWebHostEnvironment _env;

        public PhongController(HotelSystemContext context, RoomService roomService, IWebHostEnvironment env)
        {
            _context = context;
            _roomService = roomService;
            _env = env;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var rooms = await _context.Phongs
                .Include(p => p.IdloaiPhongNavigation)
                .ToListAsync();

            // Normalize UrlAnhPhong to absolute URLs so frontend can fetch assets reliably.
            var baseUrl = $"{Request.Scheme}://{Request.Host.Value}";
            var transformed = rooms.Select(r => new
            {
                r.Idphong,
                r.IdloaiPhong,
                r.TenPhong,
                TenLoaiPhong = r.IdloaiPhongNavigation != null ? r.IdloaiPhongNavigation.TenLoaiPhong : null,
                r.SoPhong,
                r.MoTa,
                r.SoNguoiToiDa,
                r.GiaCoBanMotDem,
                r.XepHangSao,
                r.TrangThai,
                UrlAnhPhong = ResolveImageUrl(r.UrlAnhPhong, baseUrl),
            }).ToList();

            return Ok(transformed);
        }

        private string? ResolveImageUrl(string? raw, string baseUrl)
        {
            if (string.IsNullOrWhiteSpace(raw)) return null;
            var s = raw.Trim();
            // If already an absolute URL or protocol-relative, return as-is
            if (s.StartsWith("http://") || s.StartsWith("https://") || s.StartsWith("//")) return s;

            // If s contains a path (starts with /), resolve to backend base
            if (s.StartsWith("/"))
            {
                // If it's already under /assets, we can use it directly
                return baseUrl + s;
            }

            // s is likely a filename stored in DB. Try to find it under wwwroot/assets/room or assets/room
            // Prefer wwwroot/assets/room when present
            var fileName = s;
            var wwwrootRoom = Path.Combine(_env.ContentRootPath, "wwwroot", "assets", "room", fileName);
            if (System.IO.File.Exists(wwwrootRoom))
            {
                return baseUrl + "/assets/room/" + fileName;
            }

            var assetsRoom = Path.Combine(_env.ContentRootPath, "assets", "room", fileName);
            if (System.IO.File.Exists(assetsRoom))
            {
                return baseUrl + "/assets/room/" + fileName;
            }

            // If not found on disk, still return a constructed URL (frontend will fallback if 404)
            return baseUrl + "/assets/room/" + fileName;
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