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

            // Normalize UrlAnhLoaiPhong to relative paths (prefer /img/loaiphong/)
            var transformed = roomTypes.Select(rt => new
            {
                rt.IdloaiPhong,
                rt.TenLoaiPhong,
                rt.MoTa,
                UrlAnhLoaiPhong = ResolveImageUrl(rt.UrlAnhLoaiPhong),
            }).ToList();

            return Ok(transformed);
        }

        [HttpPut("{id}")]
        // [Authorize(Roles = "nhanvien")]
        public async Task<IActionResult> Update(string id, [FromBody] UpdateLoaiPhongRequest request)
        {
            if (request == null) return BadRequest("Invalid payload");
            
            var existing = await _context.LoaiPhongs.FindAsync(id);
            if (existing == null) return NotFound();

            // Update fields
            if (!string.IsNullOrWhiteSpace(request.TenLoaiPhong)) 
                existing.TenLoaiPhong = request.TenLoaiPhong;
            
            if (request.MoTa != null) 
                existing.MoTa = request.MoTa;

            // Handle image upload
            if (!string.IsNullOrWhiteSpace(request.UrlAnhLoaiPhong))
            {
                var imageInput = request.UrlAnhLoaiPhong.Trim();
                
                // Check if it's a data URL (base64 upload)
                if (imageInput.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
                {
                    try
                    {
                        var savedFileName = await SaveBase64Image(imageInput, existing.IdloaiPhong);
                        existing.UrlAnhLoaiPhong = savedFileName;
                    }
                    catch (Exception ex)
                    {
                        return BadRequest(new { error = $"Failed to save image: {ex.Message}" });
                    }
                }
                else
                {
                    // If it's just a filename or path, keep it as-is
                    existing.UrlAnhLoaiPhong = imageInput;
                }
            }

            _context.LoaiPhongs.Update(existing);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                existing.IdloaiPhong,
                existing.TenLoaiPhong,
                existing.MoTa,
                UrlAnhLoaiPhong = ResolveImageUrl(existing.UrlAnhLoaiPhong)
            });
        }

        private async Task<string> SaveBase64Image(string dataUrl, string idLoaiPhong)
        {
            // Parse data URL: data:[<mediatype>][;base64],<data>
            var comma = dataUrl.IndexOf(',');
            if (comma <= 0) throw new ArgumentException("Invalid data URL format");

            var meta = dataUrl.Substring(5, comma - 5); // after 'data:' up to comma
            var semi = meta.IndexOf(';');
            var mime = semi > 0 ? meta.Substring(0, semi) : meta;

            // Determine extension
            string ext = mime.ToLowerInvariant() switch
            {
                "image/jpeg" or "image/jpg" => ".jpg",
                "image/png" => ".png",
                "image/webp" => ".webp",
                _ => ".jpg"
            };

            var base64 = dataUrl.Substring(comma + 1);
            byte[] bytes;
            try 
            { 
                bytes = Convert.FromBase64String(base64); 
            }
            catch 
            { 
                throw new ArgumentException("Invalid base64 data"); 
            }

            // Create directory if not exists
            var folder = Path.Combine(_env.ContentRootPath, "wwwroot", "img", "loaiphong");
            if (!Directory.Exists(folder)) 
                Directory.CreateDirectory(folder);

            // Generate filename: LP_{idloaiphong}.{ext}
            var fileName = $"LP_{idLoaiPhong}{ext}";
            var filePath = Path.Combine(folder, fileName);

            // Delete old files with same prefix to replace
            DeleteExistingImages(folder, idLoaiPhong);

            // Save new file
            await System.IO.File.WriteAllBytesAsync(filePath, bytes);

            return fileName;
        }

        private void DeleteExistingImages(string folder, string idLoaiPhong)
        {
            if (!Directory.Exists(folder)) return;

            var prefix = $"LP_{idLoaiPhong}";
            var existingFiles = Directory.GetFiles(folder, $"{prefix}.*");
            
            foreach (var file in existingFiles)
            {
                try
                {
                    System.IO.File.Delete(file);
                }
                catch
                {
                    // Ignore deletion errors
                }
            }
        }

        private string? ResolveImageUrl(string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return null;
            var s = raw.Trim();
            
            // If already an absolute URL or protocol-relative, return as-is
            if (s.StartsWith("http://") || s.StartsWith("https://") || s.StartsWith("//")) return s;
            
            // If it's already a relative path, return it as-is
            if (s.StartsWith("/")) return s;

            // s is likely a filename stored in DB. Check in wwwroot/img/loaiphong
            var fileName = s;

            // Exact match in wwwroot/img/loaiphong
            var wwwrootImgLoaiPhong = Path.Combine(_env.ContentRootPath, "wwwroot", "img", "loaiphong", fileName);
            if (System.IO.File.Exists(wwwrootImgLoaiPhong))
            {
                return "/img/loaiphong/" + fileName;
            }

            // Try wildcard match by base name
            var baseName = Path.GetFileNameWithoutExtension(fileName);
            var dirImg = Path.Combine(_env.ContentRootPath, "wwwroot", "img", "loaiphong");
            if (Directory.Exists(dirImg))
            {
                var match = Directory.GetFiles(dirImg).FirstOrDefault(f => 
                    Path.GetFileName(f).StartsWith(baseName, StringComparison.OrdinalIgnoreCase));
                if (match != null)
                {
                    return "/img/loaiphong/" + Path.GetFileName(match);
                }
            }

            // Fallback: return relative path (client will get 404 if not exists)
            return "/img/loaiphong/" + fileName;
        }
    }

    public class UpdateLoaiPhongRequest
    {
        public string? TenLoaiPhong { get; set; }
        public string? MoTa { get; set; }
        public string? UrlAnhLoaiPhong { get; set; }
    }
}