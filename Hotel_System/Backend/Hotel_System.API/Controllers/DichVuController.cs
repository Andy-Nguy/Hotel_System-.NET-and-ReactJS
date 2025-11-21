using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Hotel_System.API.Models;
using System.Linq;
using System;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using System.IO;

namespace Hotel_System.API.Controllers
{
    // 1. Đổi route sang tiếng Việt (kebab-case)
    [Route("api/dich-vu")]
    [ApiController]
    [Authorize(Roles = "nhanvien")]
    public class DichVuController : ControllerBase
    {
        private readonly HotelSystemContext _context;
        private readonly IWebHostEnvironment _env;
        private readonly ILogger<DichVuController> _logger;

        public DichVuController(HotelSystemContext context, IWebHostEnvironment env, ILogger<DichVuController> logger)
        {
            _context = context;
            _env = env;
            _logger = logger;
        }

        // 2. Helper để tạo DTO (gộp DichVu và TtdichVu)
        private static DichVuDto MapToDto(DichVu dv)
        {
            var detail = dv.TtdichVus?.FirstOrDefault(); // Lấy chi tiết đầu tiên (nếu có) - null-safe
            return new DichVuDto
            {
                IddichVu = dv.IddichVu,
                TenDichVu = dv.TenDichVu,
                TienDichVu = dv.TienDichVu,
                HinhDichVu = dv.HinhDichVu,
                ThoiGianBatDau = dv.ThoiGianBatDau,
                ThoiGianKetThuc = dv.ThoiGianKetThuc,
                TrangThai = dv.TrangThai,

                // Gộp thông tin từ TtdichVu
                IdttdichVu = detail?.IdttdichVu,
                ThongTinDv = detail?.ThongTinDv,
                ThoiLuongUocTinh = detail?.ThoiLuongUocTinh,
                GhiChu = detail?.GhiChu
            };
        }

        // [GET] api/dich-vu/lay-danh-sach
        [HttpGet("lay-danh-sach")]
        [AllowAnonymous]
        public async Task<IActionResult> GetAll()
        {
            var services = await _context.DichVus
                .Include(dv => dv.TtdichVus) // Lấy kèm chi tiết
                .Select(dv => MapToDto(dv)) // Chuyển sang DTO
                .ToListAsync();
            return Ok(services);
        }

        // [GET] api/dich-vu/lay-chi-tiet/{id}
        [HttpGet("lay-chi-tiet/{id}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetById(string id)
        {
            var dv = await _context.DichVus
                .Include(d => d.TtdichVus)
                .FirstOrDefaultAsync(d => d.IddichVu == id);
                
            if (dv == null) return NotFound();
            return Ok(MapToDto(dv)); // Trả về DTO đã gộp
        }
        
        // [POST] api/dich-vu/them-moi
        [HttpPost("them-moi")]
        public async Task<IActionResult> Create([FromBody] DichVuDto dto)
        {
            if (dto == null) return BadRequest();

            try
            {
                // 1. Tạo DichVu
                var model = new DichVu
                {
                    IddichVu = dto.IddichVu,
                    TenDichVu = dto.TenDichVu,
                    TienDichVu = dto.TienDichVu,
                    HinhDichVu = dto.HinhDichVu,
                    ThoiGianBatDau = dto.ThoiGianBatDau,
                    ThoiGianKetThuc = dto.ThoiGianKetThuc,
                    TrangThai = dto.TrangThai ?? "Đang hoạt động"
                };

                // Logic tự tạo ID (giữ nguyên)
                if (string.IsNullOrWhiteSpace(model.IddichVu))
                {
                    const string prefix = "DV";
                    var lastId = await _context.DichVus.Where(d => d.IddichVu.StartsWith(prefix)).OrderByDescending(d => d.IddichVu).Select(d => d.IddichVu).FirstOrDefaultAsync();
                    int next = 1;
                    if (!string.IsNullOrEmpty(lastId) && lastId.Length > prefix.Length)
                    {
                        if (int.TryParse(lastId.Substring(prefix.Length), out var parsed)) next = parsed + 1;
                    }
                    model.IddichVu = prefix + next.ToString("D3");
                }

                _context.DichVus.Add(model);

                // 2. Tạo TtdichVu (chi tiết)
                var detail = new TtdichVu
                {
                    IddichVu = model.IddichVu, // Gán ID của dịch vụ vừa tạo
                    ThongTinDv = dto.ThongTinDv,
                    ThoiLuongUocTinh = dto.ThoiLuongUocTinh,
                    GhiChu = dto.GhiChu
                };
                
                // Logic tự tạo ID cho TTDichVu (cần thiết)
                const string prefixDetail = "TTDV";
                var lastDetailId = await _context.TtdichVus.Where(t => t.IdttdichVu.StartsWith(prefixDetail)).OrderByDescending(t => t.IdttdichVu).Select(t => t.IdttdichVu).FirstOrDefaultAsync();
                int nextDetail = 1;
                if (!string.IsNullOrEmpty(lastDetailId) && lastDetailId.Length > prefixDetail.Length)
                {
                    if (int.TryParse(lastDetailId.Substring(prefixDetail.Length), out var parsed)) nextDetail = parsed + 1;
                }
                detail.IdttdichVu = prefixDetail + nextDetail.ToString("D3");
                
                _context.TtdichVus.Add(detail);
                
                await _context.SaveChangesAsync();
                
                // Fetch the complete service with all related data and return the mapped DTO
                var createdService = await _context.DichVus
                    .Include(d => d.TtdichVus)
                    .FirstOrDefaultAsync(d => d.IddichVu == model.IddichVu);
                
                if (createdService == null)
                {
                    return StatusCode(500, new { message = "Lỗi: không thể tải dịch vụ vừa tạo" });
                }
                
                var result = MapToDto(createdService);
                Console.WriteLine($"[DichVuController.Create] Created service id={createdService.IddichVu}");
                return CreatedAtAction(nameof(GetById), new { id = createdService.IddichVu }, result);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[DichVuController.Create] Error: {ex}");
                return StatusCode(500, new { message = "Lỗi khi tạo dịch vụ", detail = ex.Message });
            }
        }

        // [PUT] api/dich-vu/cap-nhat/{id}
        [HttpPut("cap-nhat/{id}")]
        public async Task<IActionResult> Update(string id, [FromBody] DichVuDto dto)
        {
            Console.WriteLine($"[DichVuController.Update] id={id} payload.hinhDichVu={(dto?.HinhDichVu ?? "<null>")}");
            var dv = await _context.DichVus.FindAsync(id);
            if (dv == null) return NotFound();
            if (dto == null) return BadRequest(new { message = "Empty payload" });

            // 1. Cập nhật DichVu
            dv.TenDichVu = dto.TenDichVu ?? dv.TenDichVu;
            dv.TienDichVu = dto.TienDichVu ?? dv.TienDichVu;
            dv.HinhDichVu = dto.HinhDichVu ?? dv.HinhDichVu;
            dv.ThoiGianBatDau = dto.ThoiGianBatDau ?? dv.ThoiGianBatDau;
            dv.ThoiGianKetThuc = dto.ThoiGianKetThuc ?? dv.ThoiGianKetThuc;
            dv.TrangThai = dto.TrangThai ?? dv.TrangThai;
            _context.DichVus.Update(dv);

            // 2. Cập nhật TtdichVu
            var detail = await _context.TtdichVus.FirstOrDefaultAsync(t => t.IddichVu == id);
            if (detail == null)
            {
                // Nếu chưa có chi tiết, tạo mới
                detail = new TtdichVu { IdttdichVu = "TTDV" + id, IddichVu = id }; // Cần logic tạo ID tốt hơn
                _context.TtdichVus.Add(detail);
            }

            detail.ThongTinDv = dto.ThongTinDv ?? detail.ThongTinDv;
            detail.ThoiLuongUocTinh = dto.ThoiLuongUocTinh ?? detail.ThoiLuongUocTinh;
            detail.GhiChu = dto.GhiChu ?? detail.GhiChu;
            _context.TtdichVus.Update(detail);
            
            await _context.SaveChangesAsync();
            Console.WriteLine($"[DichVuController.Update] Saved HinhDichVu={dv.HinhDichVu} for id={id}");
            return NoContent();
        }

        // [DELETE] api/dich-vu/xoa/{id}
        [HttpDelete("xoa/{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            var dv = await _context.DichVus.Include(x => x.Cthddvs).FirstOrDefaultAsync(x => x.IddichVu == id);
            if (dv == null) return NotFound();
            if (dv.Cthddvs != null && dv.Cthddvs.Any())
            {
                return Conflict(new { message = "Dịch vụ đã được sử dụng, không thể xóa cứng." });
            }

            // Delete associated image files before deleting the service
            if (!string.IsNullOrWhiteSpace(dv.HinhDichVu))
            {
                try
                {
                    var webRoot = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
                    var folder = Path.Combine(webRoot, "img", "services");
                    
                    // Delete file if it exists
                    var filePath = Path.Combine(folder, dv.HinhDichVu);
                    if (System.IO.File.Exists(filePath))
                    {
                        System.IO.File.Delete(filePath);
                        Console.WriteLine($"[DichVuController.Delete] Deleted image file: {filePath}");
                    }
                }
                catch (Exception imgEx)
                {
                    Console.WriteLine($"[DichVuController.Delete] Failed to delete image: {imgEx.Message}");
                    // Continue with service deletion even if image deletion fails
                }
            }

            // Xóa cả TtdichVu liên quan
            var details = await _context.TtdichVus.Where(t => t.IddichVu == id).ToListAsync();
            _context.TtdichVus.RemoveRange(details);

            _context.DichVus.Remove(dv);
            await _context.SaveChangesAsync();
            Console.WriteLine($"[DichVuController.Delete] Deleted service id={id}");
            return NoContent();
        }
        
        // === CÁC API KHÁC (ĐÃ VIỆT HÓA) ===

        // [POST] api/dich-vu/tai-anh-len
        [HttpPost("tai-anh-len")]
        [DisableRequestSizeLimit]
        public async Task<IActionResult> UploadImage(IFormFile file, [FromForm] string? serviceId = null, [FromForm] string? serviceName = null)
        {
            if (file == null || file.Length == 0) return BadRequest(new { message = "No file provided" });
            try
            {
                var webRoot = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
                var folder = Path.Combine(webRoot, "img", "services");
                if (!Directory.Exists(folder)) Directory.CreateDirectory(folder);
                
                // Delete old images for this service (if serviceName provided)
                if (!string.IsNullOrWhiteSpace(serviceName))
                {
                    var oldFiles = Directory.GetFiles(folder, $"DV_{serviceName}*", SearchOption.TopDirectoryOnly);
                    foreach (var oldFile in oldFiles)
                    {
                        try
                        {
                            System.IO.File.Delete(oldFile);
                            Console.WriteLine($"[DichVuController.UploadImage] Deleted old file: {oldFile}");
                        }
                        catch (Exception delEx)
                        {
                            Console.WriteLine($"[DichVuController.UploadImage] Failed to delete old file {oldFile}: {delEx.Message}");
                        }
                    }
                }

                // Generate filename as DV_{serviceName}
                var origName = file.FileName ?? "upload";
                var ext = Path.GetExtension(origName);
                var safeExt = string.IsNullOrWhiteSpace(ext) ? ".jpg" : ext;
                
                // Sanitize serviceName to remove invalid path characters
                var safeName = serviceName;
                if (!string.IsNullOrWhiteSpace(serviceName))
                {
                    // Replace invalid path characters with underscores
                    var invalidChars = System.IO.Path.GetInvalidFileNameChars();
                    safeName = serviceName;
                    foreach (var c in invalidChars)
                    {
                        safeName = safeName.Replace(c, '_');
                    }
                    // Trim and limit length
                    safeName = safeName.Trim().Substring(0, Math.Min(100, safeName.Length));
                }
                
                var finalName = !string.IsNullOrWhiteSpace(safeName) 
                    ? $"DV_{safeName}{safeExt}" 
                    : $"DV_{DateTime.UtcNow:yyyyMMddHHmmss}_{Guid.NewGuid():N}{safeExt}";
                var filePath = Path.Combine(folder, finalName);

                using (var stream = new FileStream(filePath, FileMode.Create, FileAccess.Write, FileShare.None))
                {
                    await file.CopyToAsync(stream);
                }

                Console.WriteLine($"[DichVuController.UploadImage] Uploaded original='{origName}' savedAs='{finalName}' serviceId='{serviceId}' path={filePath}");
                return Ok(new { fileName = finalName });
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[DichVuController.UploadImage] Error saving file: {ex}");
                return StatusCode(500, new { message = "Lỗi khi lưu ảnh", detail = ex.Message });
            }
        }
        
        // [POST] api/dich-vu/ghi-nhan-su-dung
        [HttpPost("ghi-nhan-su-dung")]
        public async Task<IActionResult> RecordUsage([FromBody] Cthddv payload)
        {
            if (payload == null)
            {
                _logger?.LogWarning("RecordUsage called with null payload");
                return BadRequest();
            }

            _logger?.LogInformation("RecordUsage called: idHoaDon={IdHoaDon}, idDichVu={IdDichVu}, tien={Tien}", payload.IdhoaDon, payload.IddichVu, payload.TienDichVu);

            var hoaDon = await _context.HoaDons.FindAsync(payload.IdhoaDon);
            if (hoaDon == null)
            {
                _logger?.LogWarning("RecordUsage: HoaDon not found {Id}", payload.IdhoaDon);
                return NotFound(new { message = "Hóa đơn không tồn tại" });
            }

            var dv = await _context.DichVus.FindAsync(payload.IddichVu);
            if (dv == null)
            {
                _logger?.LogWarning("RecordUsage: DichVu not found {Id}", payload.IddichVu);
                return NotFound(new { message = "Dịch vụ không tồn tại" });
            }

            try
            {
                _context.Cthddvs.Add(payload);
                await _context.SaveChangesAsync();
                _logger?.LogInformation("RecordUsage saved: idcthddv={Id}", payload.Idcthddv);
                return Ok(new { message = "Ghi nhận thành công" });
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "RecordUsage failed to save payload");
                return StatusCode(500, new { message = "Lỗi khi ghi nhận dịch vụ", error = ex.Message });
            }
        }

        // [GET] api/dich-vu/lich-su/tat-ca
        [HttpGet("lich-su/tat-ca")]
        public async Task<IActionResult> GetAllUsage()
        {
            var usages = await _context.Cthddvs.OrderByDescending(x => x.ThoiGianThucHien).Take(200).ToListAsync();
            return Ok(usages);
        }

        // [GET] api/dich-vu/lich-su/{id}
        [HttpGet("lich-su/{id}")]
        public async Task<IActionResult> GetUsage(string id)
        {
            var svc = await _context.DichVus.FindAsync(id);
            if (svc == null) return NotFound(new { message = "Dịch vụ không tồn tại" });
            var usages = await _context.Cthddvs.Where(c => c.IddichVu == id).OrderByDescending(x => x.ThoiGianThucHien).ToListAsync();
            return Ok(usages);
        }

        // === CÁC API CHI TIẾT ĐÃ BỊ LOẠI BỎ ===
        // [HttpGet("{id}/details")] - Đã gộp vào [HttpGet("lay-chi-tiet/{id}")]
        // [HttpPost("{id}/details")] - Đã gộp vào [HttpPost("them-moi")]
        // [HttpPut("details/{id}")] - Đã gộp vào [HttpPut("cap-nhat/{id}")]
        // [HttpDelete("details/{id}")] - Đã gộp vào [HttpDelete("xoa/{id}")]
    }
}