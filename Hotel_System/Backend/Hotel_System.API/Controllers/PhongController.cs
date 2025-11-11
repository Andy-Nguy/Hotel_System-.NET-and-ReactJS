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

            // Normalize UrlAnhPhong to relative paths (prefer /img/room/) so frontend can request them
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
                UrlAnhPhong = ResolveImageUrl(r.UrlAnhPhong),
            }).ToList();

            return Ok(transformed);
        }

        private string? ResolveImageUrl(string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return null;
            var s = raw.Trim();
            // If already an absolute URL or protocol-relative, return as-is
            if (s.StartsWith("http://") || s.StartsWith("https://") || s.StartsWith("//")) return s;
            // If it's already a relative path under /img or /assets, return it as-is (relative)
            if (s.StartsWith("/img") || s.StartsWith("/assets") || s.StartsWith("/"))
            {
                return s;
            }

            // s is likely a filename stored in DB. Prefer files under wwwroot/img/room (webp files live there).
            var fileName = s;

            // Exact match in wwwroot/img/room
            var wwwrootImgRoom = Path.Combine(_env.ContentRootPath, "wwwroot", "img", "room", fileName);
            if (System.IO.File.Exists(wwwrootImgRoom))
            {
                return "/img/room/" + fileName;
            }

            // Try wildcard match by base name inside wwwroot/img/room (e.g. base -> base-101.webp)
            var baseName = Path.GetFileNameWithoutExtension(fileName);
            var dirImg = Path.Combine(_env.ContentRootPath, "wwwroot", "img", "room");
            if (Directory.Exists(dirImg))
            {
                var match = Directory.GetFiles(dirImg).FirstOrDefault(f => Path.GetFileName(f).StartsWith(baseName, System.StringComparison.OrdinalIgnoreCase));
                if (match != null)
                {
                    return "/img/room/" + Path.GetFileName(match);
                }
            }

            // Fallback: look into wwwroot/assets/room
            var wwwrootAssetsRoom = Path.Combine(_env.ContentRootPath, "wwwroot", "assets", "room", fileName);
            if (System.IO.File.Exists(wwwrootAssetsRoom))
            {
                return "/assets/room/" + fileName;
            }

            var dirAssets = Path.Combine(_env.ContentRootPath, "wwwroot", "assets", "room");
            if (Directory.Exists(dirAssets))
            {
                var match = Directory.GetFiles(dirAssets).FirstOrDefault(f => Path.GetFileName(f).StartsWith(baseName, System.StringComparison.OrdinalIgnoreCase));
                if (match != null)
                {
                    return "/assets/room/" + Path.GetFileName(match);
                }
            }

            // Last resort: return a relative path under /img/room using provided filename
            return "/img/room/" + fileName;
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
       
        // POST: api/Phong
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] Phong payload)
        {
            if (payload == null) return BadRequest("Invalid payload");
            if (string.IsNullOrWhiteSpace(payload.Idphong)) payload.Idphong = Guid.NewGuid().ToString();

            _context.Phongs.Add(payload);
            await _context.SaveChangesAsync();

            // Return created resource (simple shape)
            return CreatedAtAction(nameof(GetAll), new { id = payload.Idphong }, payload);
        }

        // PUT: api/Phong/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(string id, [FromBody] Phong payload)
        {
            if (payload == null) return BadRequest("Invalid payload");
            var existing = await _context.Phongs.FindAsync(id);
            if (existing == null) return NotFound();

            // Map updatable fields
            existing.IdloaiPhong = payload.IdloaiPhong;
            existing.TenPhong = payload.TenPhong;
            existing.SoPhong = payload.SoPhong;
            existing.MoTa = payload.MoTa;
            existing.SoNguoiToiDa = payload.SoNguoiToiDa;
            existing.GiaCoBanMotDem = payload.GiaCoBanMotDem;
            existing.XepHangSao = payload.XepHangSao;
            existing.TrangThai = payload.TrangThai;
            existing.UrlAnhPhong = payload.UrlAnhPhong;

            _context.Phongs.Update(existing);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // DELETE: api/Phong/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            var existing = await _context.Phongs.FindAsync(id);
            if (existing == null) return NotFound();

            _context.Phongs.Remove(existing);
            await _context.SaveChangesAsync();

            return NoContent();
        }
       
    }
}