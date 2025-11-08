using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Hotel_System.API.Models;
using Microsoft.AspNetCore.Hosting;
using System.IO;

namespace Hotel_System.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class LoaiPhongController : ControllerBase
    {
        private readonly HotelSystemContext _context;
        private readonly IWebHostEnvironment _env;

        public LoaiPhongController(HotelSystemContext context, IWebHostEnvironment env)
        {
            _context = context;
            _env = env;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var roomTypes = await _context.LoaiPhongs.ToListAsync();

            // Normalize UrlAnhLoaiPhong to absolute URLs so frontend can fetch assets reliably.
            var baseUrl = $"{Request.Scheme}://{Request.Host.Value}";
            var transformed = roomTypes.Select(rt => new
            {
                rt.IdloaiPhong,
                rt.TenLoaiPhong,
                rt.MoTa,
                UrlAnhLoaiPhong = ResolveImageUrl(rt.UrlAnhLoaiPhong, baseUrl),
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

            // s is likely a filename stored in DB. Try to find it under wwwroot/assets/roomtype or assets/roomtype
            // Prefer wwwroot/assets/roomtype when present
            var fileName = s;
            var wwwrootRoomType = Path.Combine(_env.ContentRootPath, "wwwroot", "assets", "roomtype", fileName);
            if (System.IO.File.Exists(wwwrootRoomType))
            {
                return baseUrl + "/assets/roomtype/" + fileName;
            }

            var assetsRoomType = Path.Combine(_env.ContentRootPath, "assets", "roomtype", fileName);
            if (System.IO.File.Exists(assetsRoomType))
            {
                return baseUrl + "/assets/roomtype/" + fileName;
            }

            // If not found on disk, still return a constructed URL (frontend will fallback if 404)
            return baseUrl + "/assets/roomtype/" + fileName;
        }
    }
}