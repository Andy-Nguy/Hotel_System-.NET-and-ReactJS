using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Hotel_System.API.Models;
using Hotel_System.API.Services;
using Hotel_System.API.DTOs;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Authorization;
using System.IO;

namespace Hotel_System.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "nhanvien")]
    public class PhongController : ControllerBase
    {
        private readonly HotelSystemContext _context;
        private readonly RoomService _roomService;
          private readonly IWebHostEnvironment _env;
                // Status values that users are allowed to set via API (case-insensitive)
                private static readonly HashSet<string> UserEditableStatuses = new(StringComparer.OrdinalIgnoreCase) { "Trống", "Bảo trì" };

        public PhongController(HotelSystemContext context, RoomService roomService, IWebHostEnvironment env)
        {
            _context = context;
            _roomService = roomService;
            _env = env;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll(string? loaiPhongId = null)
        {
            try
            {
                Console.WriteLine("🔍 PhongController: Getting all rooms...");
                IQueryable<Phong> query = _context.Phongs
                    .Include(p => p.IdloaiPhongNavigation)
                    .Include(p => p.TienNghiPhongs)
                        .ThenInclude(tnp => tnp.IdtienNghiNavigation)
                    .Include(p => p.KhuyenMaiPhongs)
                        .ThenInclude(kmp => kmp.IdkhuyenMaiNavigation);

                if (!string.IsNullOrEmpty(loaiPhongId))
                {
                    query = query.Where(p => p.IdloaiPhong == loaiPhongId);
                }

                var rooms = await query.ToListAsync();
                
                Console.WriteLine($"📊 Found {rooms.Count} rooms in database");

                // Get current date for status check
                var currentDate = DateOnly.FromDateTime(DateTime.Now);

                // Get list of occupied room IDs based on active bookings (only checked-in guests)
                // Only TrangThai == 3 (checked in) means the guest is actually occupying the room
                var occupiedRoomIds = await _context.DatPhongs
                    .Where(dp => dp.TrangThai == 3 && // 3 = Checked in (Đang sử dụng)
                                 dp.NgayNhanPhong <= currentDate && 
                                 dp.NgayTraPhong > currentDate)
                    .Select(dp => dp.Idphong)
                    .Distinct()
                    .ToListAsync();

                // Get list of booked room IDs (admin confirmed booking)
                // Only show as "Đã đặt" if TrangThai=2 (admin confirmed)
                // Admin confirm means booking is locked in, room is reserved
                var bookedRoomIds = await _context.DatPhongs
                    .Where(dp => dp.TrangThai == 2 && // 2 = Admin confirmed (Xác nhận từ admin)
                                 dp.NgayNhanPhong <= currentDate && 
                                 dp.NgayTraPhong > currentDate)
                    .Select(dp => dp.Idphong)
                    .Distinct()
                    .ToListAsync();

                Console.WriteLine($"🏨 Found {occupiedRoomIds.Count} occupied rooms, {bookedRoomIds.Count} booked rooms");

                // Normalize UrlAnhPhong to relative paths (prefer /img/room/) so frontend can request them
                // Define allowed / normalized display statuses:
                // - "Trống" (available)
                // - "Đang sử dụng" (occupied)
                // - "Bảo trì" (maintenance)
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
                    // Normalize status for frontend (Vietnamese labels). Users may only change "Trống" or "Bảo trì".
                    // Priority: Maintenance > Occupied > Booked > Empty
                    TrangThai = (r.TrangThai != null && r.TrangThai.Equals("Bảo trì", System.StringComparison.OrdinalIgnoreCase))
                                ? "Bảo trì"
                                : (occupiedRoomIds.Contains(r.Idphong) ? "Đang sử dụng" 
                                   : (bookedRoomIds.Contains(r.Idphong) ? "Đã đặt" : "Trống")),
                    UrlAnhPhong = ResolveImageUrl(r.UrlAnhPhong),
                    // Add amenities
                    amenities = r.TienNghiPhongs
                        .Select(tnp => new {
                            id = tnp.IdtienNghi,
                            name = tnp.IdtienNghiNavigation != null ? tnp.IdtienNghiNavigation.TenTienNghi : ""
                        })
                        .ToList(),
                    // Add active promotions only
                    promotions = r.KhuyenMaiPhongs
                        .Where(kmp => kmp.IdkhuyenMaiNavigation != null &&
                                      kmp.IdkhuyenMaiNavigation.TrangThai == "active" &&
                                      kmp.IdkhuyenMaiNavigation.NgayBatDau <= currentDate &&
                                      kmp.IdkhuyenMaiNavigation.NgayKetThuc >= currentDate)
                        .Select(kmp => new {
                            id = kmp.IdkhuyenMai,
                            name = kmp.IdkhuyenMaiNavigation.TenKhuyenMai,
                            description = kmp.IdkhuyenMaiNavigation.MoTa,
                            type = kmp.IdkhuyenMaiNavigation.LoaiGiamGia,
                            value = kmp.IdkhuyenMaiNavigation.GiaTriGiam,
                            startDate = kmp.IdkhuyenMaiNavigation.NgayBatDau,
                            endDate = kmp.IdkhuyenMaiNavigation.NgayKetThuc
                        })
                        .ToList()
                }).ToList();

                Console.WriteLine($"✅ Returning {transformed.Count} transformed rooms");
                return Ok(transformed);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Error in GetAll: {ex.Message}");
                return StatusCode(500, new { error = ex.Message });
            }
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

        // GET: api/Phong/kiem-tra-trong?loaiPhongId={id}&checkin={date}&checkout={date}
        [HttpGet("kiem-tra-trong-theo-loai-phong")]
        public async Task<IActionResult> CheckAvailability(string loaiPhongId, string checkin, string checkout, int numberOfGuests = 1)
        {
            try
            {
                // Parse incoming dates. The frontend commonly sends either ISO (YYYY-MM-DD)
                // or local Vietnamese format (dd/MM/yyyy). Try both so API is tolerant.
                DateOnly checkInDate, checkOutDate;
                if (!DateOnly.TryParse(checkin, out checkInDate) || !DateOnly.TryParse(checkout, out checkOutDate))
                {
                    // Try parsing with Vietnamese culture as a fallback (dd/MM/yyyy)
                    var vi = System.Globalization.CultureInfo.GetCultureInfo("vi-VN");
                    if (!DateTime.TryParse(checkin, vi, System.Globalization.DateTimeStyles.None, out var dtIn) ||
                        !DateTime.TryParse(checkout, vi, System.Globalization.DateTimeStyles.None, out var dtOut))
                    {
                        return BadRequest("Invalid date format. Use YYYY-MM-DD or dd/MM/yyyy.");
                    }

                    checkInDate = DateOnly.FromDateTime(dtIn);
                    checkOutDate = DateOnly.FromDateTime(dtOut);
                }

                // Validate: Check-in must not be in the past
                var today = DateOnly.FromDateTime(DateTime.Now);
                if (checkInDate < today)
                {
                    return BadRequest("Check-in date cannot be in the past. Please select today or a future date.");
                }

                // Validate: Check-out must be at least 1 day after check-in
                if (checkOutDate <= checkInDate)
                {
                    return BadRequest("Check-out date must be at least 1 day after check-in date.");
                }

                // Convert to DateTime for service method (keep times at midnight; service converts to DateOnly)
                var checkInDt = checkInDate.ToDateTime(new TimeOnly(0, 0));
                var checkOutDt = checkOutDate.ToDateTime(new TimeOnly(0, 0));

                // Delegate to RoomService which contains optimized availability logic
                var rooms = await _roomService.CheckAvailableRoomsByTypeAsync(checkInDt, checkOutDt, loaiPhongId, numberOfGuests);

                if (rooms == null || rooms.Count == 0)
                {
                    return Ok(new { message = "No available rooms for this type ❌" });
                }

                return Ok(rooms);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Error in CheckAvailability: {ex.Message}");
                return StatusCode(500, new { error = ex.Message });
            }
        }
       
        // POST: api/Phong
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] Phong payload)
        {
            if (payload == null) return BadRequest("Invalid payload");
            if (string.IsNullOrWhiteSpace(payload.Idphong)) payload.Idphong = Guid.NewGuid().ToString();

            // Ensure stored status is one of allowed values for user-editable state.
            if (string.IsNullOrWhiteSpace(payload.TrangThai))
            {
                payload.TrangThai = "Trống"; // default
            }
            else
            {
                var trimmed = payload.TrangThai.Trim();
                if (!UserEditableStatuses.Contains(trimmed))
                {
                    // Normalize unknown values to default rather than failing create.
                    payload.TrangThai = "Trống";
                }
                else
                {
                    payload.TrangThai = trimmed;
                }
            }

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

            // Map updatable fields only when provided (support partial updates).
            if (!string.IsNullOrWhiteSpace(payload.IdloaiPhong)) existing.IdloaiPhong = payload.IdloaiPhong;
            if (!string.IsNullOrWhiteSpace(payload.TenPhong)) existing.TenPhong = payload.TenPhong;
            if (!string.IsNullOrWhiteSpace(payload.SoPhong)) existing.SoPhong = payload.SoPhong;
            if (payload.MoTa != null) existing.MoTa = payload.MoTa;
            if (payload.SoNguoiToiDa.HasValue) existing.SoNguoiToiDa = payload.SoNguoiToiDa;
            if (payload.GiaCoBanMotDem.HasValue) existing.GiaCoBanMotDem = payload.GiaCoBanMotDem;
            if (payload.XepHangSao.HasValue) existing.XepHangSao = payload.XepHangSao;

            // Only allow user-updatable statuses (Trống, Bảo trì). System-managed statuses cannot be manually changed.
            if (!string.IsNullOrWhiteSpace(payload.TrangThai))
            {
                var trimmed = payload.TrangThai.Trim();
                
                // Quy tắc 1: Staff chỉ được đổi sang Trống hoặc Bảo trì
                if (!UserEditableStatuses.Contains(trimmed))
                {
                    return BadRequest(new { error = "Invalid status. Staff only allowed: 'Trống' or 'Bảo trì'." });
                }

                // Quy tắc 2: Nếu phòng hiện tại ở trạng thái "Đã đặt" hoặc "Đang sử dụng", staff KHÔNG được đổi
                var currentStatus = existing.TrangThai ?? "Trống";
                if (currentStatus.Equals("Đã đặt", StringComparison.OrdinalIgnoreCase) || 
                    currentStatus.Equals("Đang sử dụng", StringComparison.OrdinalIgnoreCase))
                {
                    return BadRequest(new { error = $"Cannot change status. Room is currently '{currentStatus}'. This status is managed by booking/check-in/check-out processes." });
                }

                // Quy tắc 3: Cho phép Trống ↔ Bảo trì
                existing.TrangThai = trimmed;
            }

            if (payload.UrlAnhPhong != null) existing.UrlAnhPhong = payload.UrlAnhPhong;

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

        // GET: api/Phong/top-rooms-2025?top=5
        [HttpGet("top-rooms-2025")]
        public async Task<IActionResult> GetTopRooms2025([FromQuery] int top = 5)
        {
            try
            {
                Console.WriteLine($"🔍 PhongController: Getting top {top} rooms for 2025...");

                // Execute stored procedure with ADO.NET to tolerate missing columns
                var conn = _context.Database.GetDbConnection();
                await using (conn)
                {
                    if (conn.State != System.Data.ConnectionState.Open)
                        await conn.OpenAsync();

                    using var cmd = conn.CreateCommand();
                    cmd.CommandText = "sp_TopPhong2025";
                    cmd.CommandType = System.Data.CommandType.StoredProcedure;

                    var param = cmd.CreateParameter();
                    param.ParameterName = "@Top";
                    param.Value = top;
                    param.DbType = System.Data.DbType.Int32;
                    cmd.Parameters.Add(param);

                    var list = new List<object>();
                    using var reader = await cmd.ExecuteReaderAsync();
                    // Build a map of column name (lower) to ordinal for defensive reads
                    var colMap = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
                    for (int i = 0; i < reader.FieldCount; i++)
                    {
                        colMap[reader.GetName(i)] = i;
                    }

                    while (await reader.ReadAsync())
                    {
                        string? GetStringOrNull(string[] possibleNames)
                        {
                            foreach (var n in possibleNames)
                            {
                                if (colMap.TryGetValue(n, out var idx) && !reader.IsDBNull(idx))
                                    return reader.GetValue(idx)?.ToString();
                            }
                            return null;
                        }

                        int? GetIntOrNull(string[] possibleNames)
                        {
                            foreach (var n in possibleNames)
                            {
                                if (colMap.TryGetValue(n, out var idx) && !reader.IsDBNull(idx))
                                {
                                    if (int.TryParse(reader.GetValue(idx)?.ToString(), out var v)) return v;
                                    try { return Convert.ToInt32(reader.GetValue(idx)); } catch { }
                                }
                            }
                            return null;
                        }

                        decimal? GetDecimalOrNull(string[] possibleNames)
                        {
                            foreach (var n in possibleNames)
                            {
                                if (colMap.TryGetValue(n, out var idx) && !reader.IsDBNull(idx))
                                {
                                    try { return Convert.ToDecimal(reader.GetValue(idx)); } catch { }
                                }
                            }
                            return null;
                        }

                        var obj = new
                        {
                            idPhong = GetStringOrNull(new[] { "IDPhong", "IdPhong", "IDPHONG", "Idphong" }),
                            tenPhong = GetStringOrNull(new[] { "TenPhong", "tenPhong", "TENPHONG" }),
                            soLanSuDung = GetIntOrNull(new[] { "SoLanSuDung", "SoLanSuDung" }) ?? 0,
                            tongDem = GetIntOrNull(new[] { "TongDem", "TongDem" }) ?? 0,
                            urlAnhPhong = GetStringOrNull(new[] { "UrlAnhPhong", "UrlAnhPhong" }),
                            giaCoBanMotDem = GetDecimalOrNull(new[] { "GiaCoBanMotDem", "GiaCoBanMotDem" }),
                            xepHangSao = GetIntOrNull(new[] { "XepHangSao", "XepHangSao" }),
                            tenLoaiPhong = GetStringOrNull(new[] { "TenLoaiPhong", "TenLoaiPhong" })
                        };

                        list.Add(obj);
                    }

                    var result = ((List<object>)list).Select(r =>
                    {
                        // r is anonymous type; return as dynamic object already shaped correctly
                        return r;
                    }).ToList();

                    Console.WriteLine($"✅ Returning {result.Count} top rooms (ADO.NET)");
                    // Normalize UrlAnhPhong values inside returned objects before returning
                    var normalized = result.Select(r =>
                    {
                        var dict = r.GetType().GetProperties().ToDictionary(p => p.Name, p => p.GetValue(r));
                        var url = dict.ContainsKey("urlAnhPhong") ? dict["urlAnhPhong"]?.ToString() : null;
                        dict["urlAnhPhong"] = ResolveImageUrl(url as string);
                        return dict;
                    }).ToList();

                    return Ok(normalized);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Error in GetTopRooms2025: {ex.Message}");
                return StatusCode(500, new { error = ex.Message, details = ex.ToString() });
            }
        }
       
    }
}