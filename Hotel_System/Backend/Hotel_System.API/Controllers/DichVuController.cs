using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Hotel_System.API.Models;
using System.Linq;
using System;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using System.IO;

namespace Hotel_System.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class DichVuController : ControllerBase
    {
        private readonly HotelSystemContext _context;
        private readonly IWebHostEnvironment _env;

        public DichVuController(HotelSystemContext context, IWebHostEnvironment env)
        {
            _context = context;
            _env = env;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var services = await _context.DichVus.ToListAsync();
            return Ok(services);
        }

        // Specific routes MUST come before generic {id} route to avoid route matching conflicts
        [HttpGet("usage/all")]
        public async Task<IActionResult> GetAllUsage()
        {
            var usages = await _context.Cthddvs
                .Select(c => new {
                    c.Idcthddv,
                    c.IdhoaDon,
                    c.IddichVu,
                    c.TienDichVu,
                    c.ThoiGianThucHien,
                    c.ThoiGianBatDau,
                    c.ThoiGianKetThuc,
                    c.TrangThai
                }).OrderByDescending(x => x.ThoiGianThucHien).Take(200)
                .ToListAsync();
            return Ok(usages);
        }

        [HttpGet("{id}/details")]
        public async Task<IActionResult> GetDetails(string id)
        {
            var svc = await _context.DichVus.FindAsync(id);
            if (svc == null) return NotFound(new { message = "Dịch vụ không tồn tại" });
            // Project into a lightweight DTO to avoid serializing navigation properties
            // (prevents object cycle / JSON serialization errors)
            var list = await _context.TtdichVus
                .Where(t => t.IddichVu == id)
                .Select(t => new {
                    t.IdttdichVu,
                    t.IddichVu,
                    t.ThongTinDv,
                    t.ThoiLuongUocTinh,
                    t.GhiChu
                })
                .ToListAsync();

            Console.WriteLine($"[DEBUG] GetDetails called for service ID: {id}");
            Console.WriteLine($"[DEBUG] Found {list.Count} TTDichVu records");
            if (list.Count > 0) {
                Console.WriteLine($"[DEBUG] First record: {System.Text.Json.JsonSerializer.Serialize(list[0])}");
            }

            return Ok(list);
        }

        [HttpGet("{id}/usage")]
        public async Task<IActionResult> GetUsage(string id)
        {
            var svc = await _context.DichVus.FindAsync(id);
            if (svc == null) return NotFound(new { message = "Dịch vụ không tồn tại" });

            var usages = await _context.Cthddvs
                .Where(c => c.IddichVu == id)
                .Select(c => new {
                    c.Idcthddv,
                    c.IdhoaDon,
                    c.IddichVu,
                    c.TienDichVu,
                    c.ThoiGianThucHien,
                    c.ThoiGianBatDau,
                    c.ThoiGianKetThuc,
                    c.TrangThai
                }).OrderByDescending(x => x.ThoiGianThucHien)
                .ToListAsync();

            return Ok(usages);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(string id)
        {
            var dv = await _context.DichVus.FindAsync(id);
            if (dv == null) return NotFound();
            return Ok(dv);
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] JsonElement request)
        {
            if (request.ValueKind != JsonValueKind.Object) return BadRequest();

            string? getString(JsonElement obj, string a, string? b = null)
            {
                if (obj.TryGetProperty(a, out var p) && p.ValueKind != JsonValueKind.Null)
                {
                    if (p.ValueKind == JsonValueKind.String) return p.GetString();
                    if (p.ValueKind == JsonValueKind.Number || p.ValueKind == JsonValueKind.True || p.ValueKind == JsonValueKind.False)
                        return p.GetRawText();
                }
                if (b != null && obj.TryGetProperty(b, out var q) && q.ValueKind != JsonValueKind.Null)
                {
                    if (q.ValueKind == JsonValueKind.String) return q.GetString();
                    if (q.ValueKind == JsonValueKind.Number || q.ValueKind == JsonValueKind.True || q.ValueKind == JsonValueKind.False)
                        return q.GetRawText();
                }
                return null;
            }

            decimal? getDecimal(JsonElement obj, string a, string? b = null)
            {
                var s = getString(obj, a, b);
                if (string.IsNullOrEmpty(s)) return null;
                if (decimal.TryParse(s, out var d)) return d;
                return null;
            }

            TimeSpan? getTimeSpan(JsonElement obj, string a, string? b = null)
            {
                var s = getString(obj, a, b);
                if (string.IsNullOrEmpty(s)) return null;
                if (TimeSpan.TryParse(s, out var t)) return t;
                return null;
            }

            // (no local getInt needed here)
            var model = new DichVu();
            model.IddichVu = getString(request, "iddichVu", "IddichVu") ?? string.Empty;
            model.TenDichVu = getString(request, "tenDichVu", "TenDichVu") ?? string.Empty;
            model.TienDichVu = getDecimal(request, "tienDichVu", "TienDichVu");
            model.HinhDichVu = getString(request, "hinhDichVu", "HinhDichVu");
            model.ThoiGianBatDau = getTimeSpan(request, "thoiGianBatDau", "ThoiGianBatDau");
            model.ThoiGianKetThuc = getTimeSpan(request, "thoiGianKetThuc", "ThoiGianKetThuc");
            model.TrangThai = getString(request, "trangThai", "TrangThai") ?? "Đang hoạt động";

            // If client didn't provide an id, generate a sequential code like DV001, DV002, ...
            if (string.IsNullOrWhiteSpace(model.IddichVu))
            {
                const string prefix = "DV";
                // find latest existing with the prefix
                var lastId = await _context.DichVus
                    .Where(d => d.IddichVu.StartsWith(prefix))
                    .OrderByDescending(d => d.IddichVu)
                    .Select(d => d.IddichVu)
                    .FirstOrDefaultAsync();

                int next = 1;
                if (!string.IsNullOrEmpty(lastId) && lastId.Length > prefix.Length)
                {
                    var numPart = lastId.Substring(prefix.Length);
                    if (int.TryParse(numPart, out var parsed)) next = parsed + 1;
                }
                model.IddichVu = prefix + next.ToString("D3");
            }

            _context.DichVus.Add(model);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetById), new { id = model.IddichVu }, model);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(string id, [FromBody] DichVu model)
        {
            var dv = await _context.DichVus.FindAsync(id);
            if (dv == null) return NotFound();

            if (model == null)
            {
                // Return a clearer 400 when the body could not be bound (helps debugging client payloads)
                return BadRequest(new { message = "Payload is empty or could not be parsed. Ensure JSON payload is valid." });
            }

            dv.TenDichVu = model.TenDichVu ?? dv.TenDichVu;
            dv.TienDichVu = model.TienDichVu ?? dv.TienDichVu;
            dv.HinhDichVu = model.HinhDichVu ?? dv.HinhDichVu;
            // new time fields
            dv.ThoiGianBatDau = model.ThoiGianBatDau ?? dv.ThoiGianBatDau;
            dv.ThoiGianKetThuc = model.ThoiGianKetThuc ?? dv.ThoiGianKetThuc;
            // status field
            dv.TrangThai = model.TrangThai ?? dv.TrangThai;
            _context.DichVus.Update(dv);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            var dv = await _context.DichVus.Include(x => x.Cthddvs).FirstOrDefaultAsync(x => x.IddichVu == id);
            if (dv == null) return NotFound();
            if (dv.Cthddvs != null && dv.Cthddvs.Any())
            {
                // If service was used in invoices, prevent hard delete
                return Conflict(new { message = "Dịch vụ đã được sử dụng, không thể xóa cứng." });
            }
            _context.DichVus.Remove(dv);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // --- TTDichVu (details) endpoints ---
        [HttpPost("{id}/details")]
        public async Task<IActionResult> CreateDetail(string id, [FromBody] JsonElement request)
        {
            var svc = await _context.DichVus.FindAsync(id);
            if (svc == null) return NotFound(new { message = "Dịch vụ không tồn tại" });

            if (request.ValueKind != JsonValueKind.Object) return BadRequest();

            string? getString(JsonElement obj, string a, string? b = null)
            {
                if (obj.TryGetProperty(a, out var p) && p.ValueKind != JsonValueKind.Null) 
                {
                    if (p.ValueKind == JsonValueKind.String) return p.GetString();
                    // If it's a number, convert to string first
                    if (p.ValueKind == JsonValueKind.Number) return p.GetRawText();
                }
                if (b != null && obj.TryGetProperty(b, out var q) && q.ValueKind != JsonValueKind.Null)
                {
                    if (q.ValueKind == JsonValueKind.String) return q.GetString();
                    if (q.ValueKind == JsonValueKind.Number) return q.GetRawText();
                }
                return null;
            }

            int? getInt(JsonElement obj, string a, string? b = null)
            {
                // Try to get from primary property first
                if (obj.TryGetProperty(a, out var p) && p.ValueKind != JsonValueKind.Null)
                {
                    if (p.ValueKind == JsonValueKind.Number && p.TryGetInt32(out var v)) return v;
                    var s = p.ValueKind == JsonValueKind.String ? p.GetString() : p.GetRawText();
                    if (!string.IsNullOrEmpty(s) && int.TryParse(s, out var parsed)) return parsed;
                }
                // Try backup property
                if (b != null && obj.TryGetProperty(b, out var q) && q.ValueKind != JsonValueKind.Null)
                {
                    if (q.ValueKind == JsonValueKind.Number && q.TryGetInt32(out var v)) return v;
                    var s = q.ValueKind == JsonValueKind.String ? q.GetString() : q.GetRawText();
                    if (!string.IsNullOrEmpty(s) && int.TryParse(s, out var parsed)) return parsed;
                }
                return null;
            }

            var detail = new TtdichVu
            {
                IdttdichVu = getString(request, "idttdichVu", "IdttdichVu") ?? string.Empty,
                IddichVu = id,
                ThongTinDv = getString(request, "thongTinDv", "ThongTinDv"),
                ThoiLuongUocTinh = getInt(request, "thoiLuongUocTinh", "ThoiLuongUocTinh"),
                GhiChu = getString(request, "ghiChu", "GhiChu")
            };

            if (string.IsNullOrWhiteSpace(detail.IdttdichVu))
            {
                const string prefix = "TTDV";
                var lastDetailId = await _context.TtdichVus
                    .Where(t => t.IdttdichVu.StartsWith(prefix))
                    .OrderByDescending(t => t.IdttdichVu)
                    .Select(t => t.IdttdichVu)
                    .FirstOrDefaultAsync();

                int nextDetail = 1;
                if (!string.IsNullOrEmpty(lastDetailId) && lastDetailId.Length > prefix.Length)
                {
                    var numPart = lastDetailId.Substring(prefix.Length);
                    if (int.TryParse(numPart, out var parsed)) nextDetail = parsed + 1;
                }
                detail.IdttdichVu = prefix + nextDetail.ToString("D3");
            }

            _context.TtdichVus.Add(detail);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetById), new { id = id }, detail);
        }

        [HttpPut("details/{id}")]
        public async Task<IActionResult> UpdateDetail(string id, [FromBody] TtdichVu payload)
        {
            var detail = await _context.TtdichVus.FindAsync(id);
            if (detail == null) return NotFound();
            detail.ThongTinDv = payload.ThongTinDv ?? detail.ThongTinDv;
            // new fields
            detail.ThoiLuongUocTinh = payload.ThoiLuongUocTinh ?? detail.ThoiLuongUocTinh;
            detail.GhiChu = payload.GhiChu ?? detail.GhiChu;
            _context.TtdichVus.Update(detail);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("details/{id}")]
        public async Task<IActionResult> DeleteDetail(string id)
        {
            var detail = await _context.TtdichVus.FindAsync(id);
            if (detail == null) return NotFound();
            _context.TtdichVus.Remove(detail);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // --- Record service usage (CTHDDV) ---
        [HttpPost("use")]
        public async Task<IActionResult> RecordUsage([FromBody] Cthddv payload)
        {
            if (payload == null) return BadRequest();
            // set id if not provided
            // Idcthddv is identity (int) in model; EF will assign. Ensure required fields
            var hoaDon = await _context.HoaDons.FindAsync(payload.IdhoaDon);
            if (hoaDon == null) return NotFound(new { message = "Hóa đơn không tồn tại" });
            var dv = await _context.DichVus.FindAsync(payload.IddichVu);
            if (dv == null) return NotFound(new { message = "Dịch vụ không tồn tại" });

            var newRecord = new Cthddv
            {
                IdhoaDon = payload.IdhoaDon,
                IddichVu = payload.IddichVu,
                TienDichVu = payload.TienDichVu ?? dv.TienDichVu ?? 0m,
                ThoiGianThucHien = payload.ThoiGianThucHien ?? DateTime.UtcNow,
                ThoiGianBatDau = payload.ThoiGianBatDau,
                ThoiGianKetThuc = payload.ThoiGianKetThuc,
                TrangThai = payload.TrangThai ?? payload.TrangThai ?? "Chờ thực hiện"
            };

            _context.Cthddvs.Add(newRecord);

            // update HoaDon total fields (simple approach)
            decimal added = newRecord.TienDichVu ?? 0m;
            hoaDon.TongTien = hoaDon.TongTien + added;
            // optionally update TienThanhToan or others if needed
            _context.HoaDons.Update(hoaDon);

            await _context.SaveChangesAsync();
            return Ok(new { message = "Ghi nhận thành công" });
        }

        // --- Upload service image ---
        [HttpPost("upload")]
        [DisableRequestSizeLimit]
        public async Task<IActionResult> UploadImage(IFormFile file)
        {
            if (file == null || file.Length == 0) return BadRequest(new { message = "No file provided" });

            var webRoot = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
            var folder = Path.Combine(webRoot, "img", "services");
            if (!Directory.Exists(folder)) Directory.CreateDirectory(folder);

            // Use the file name as provided (already renamed on frontend to DV_tenDichVu.ext format)
            var fileName = file.FileName;
            var filePath = Path.Combine(folder, fileName);

            using (var stream = System.IO.File.Create(filePath))
            {
                await file.CopyToAsync(stream);
            }

            // Return only fileName (not full path) to be stored in database
            return Ok(new { fileName });
        }
    }
}