using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Hotel_System.API.Models;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Authorization;
using System.IO;

namespace Hotel_System.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "nhanvien")]
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
        [AllowAnonymous]
        public async Task<IActionResult> GetAll()
        {
            var roomTypes = await _context.LoaiPhongs.ToListAsync();

            // Normalize UrlAnhLoaiPhong to relative paths (prefer /img/room/) so frontend can request them
            var transformed = roomTypes.Select(rt => new
            {
                rt.IdloaiPhong,
                rt.TenLoaiPhong,
                rt.MoTa,
                UrlAnhLoaiPhong = ResolveImageUrl(rt.UrlAnhLoaiPhong),
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
    }
}