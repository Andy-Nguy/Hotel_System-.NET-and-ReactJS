using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Hotel_System.API.Models;
using Hotel_System.API.Services;
using Hotel_System.API.DTOs;
using Microsoft.AspNetCore.Hosting;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using System.IO;

namespace Hotel_System.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class PhongController : ControllerBase
    {
        private readonly HotelSystemContext _context;
        private readonly RoomService _roomService;
        private readonly RoomImageService _imageService;
        private readonly IWebHostEnvironment _env;
        // Status values that users are allowed to set via API (case-insensitive)
        private static readonly HashSet<string> UserEditableStatuses = new(StringComparer.OrdinalIgnoreCase) { "Trống", "Bảo trì" };

        public PhongController(HotelSystemContext context, RoomService roomService, RoomImageService imageService, IWebHostEnvironment env)
        {
            _context = context;
            _roomService = roomService;
            _imageService = imageService;
            _env = env;
        }

        // Normalize incoming image strings: accept
        // - plain filename: "room-101-a0.jpg"
        // - relative URL: "/img/room/room-101-a0.jpg" or "img/room/room-101-a0.jpg"
        // - data URL: "data:image/jpeg;base64,..." -> will be decoded, saved to wwwroot/img/room and replaced with generated filename
        private async Task<List<string>> NormalizeAndPersistImageInputsAsync(List<string> inputs, string roomId)
        {
            if (inputs == null) return new List<string>();

            var folder = Path.Combine(_env.ContentRootPath, "wwwroot", "img", "room");
            if (!Directory.Exists(folder)) Directory.CreateDirectory(folder);

            var outList = new List<string>();

            for (int i = 0; i < inputs.Count; i++)
            {
                var raw = inputs[i] ?? string.Empty;
                var v = raw.Trim();
                if (string.IsNullOrEmpty(v)) throw new ArgumentException($"Image at index {i} cannot be empty");

                if (v.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
                {
                    // data:[<mediatype>][;base64],<data>
                    var comma = v.IndexOf(',');
                    if (comma <= 0) throw new ArgumentException($"Invalid data URL at index {i}");
                    var meta = v.Substring(5, comma - 5); // after 'data:' up to comma
                    // meta example: image/jpeg;base64
                    var semi = meta.IndexOf(';');
                    var mime = semi > 0 ? meta.Substring(0, semi) : meta;
                    string ext = ".jpg";
                    switch (mime.ToLowerInvariant())
                    {
                        case "image/jpeg":
                        case "image/jpg": ext = ".jpg"; break;
                        case "image/png": ext = ".png"; break;
                        case "image/webp": ext = ".webp"; break;
                        default: ext = ".jpg"; break;
                    }

                    var base64 = v.Substring(comma + 1);
                    byte[] bytes;
                    try { bytes = Convert.FromBase64String(base64); }
                    catch (Exception) { throw new ArgumentException($"Invalid base64 data at image index {i}"); }

                    var generated = _imageService.GenerateFilename(roomId, i, ext);
                    var destPath = Path.Combine(folder, generated);
                    await System.IO.File.WriteAllBytesAsync(destPath, bytes);
                    outList.Add(generated);
                }
                else if (v.Contains("/") || v.Contains("\\"))
                {
                    // treat as a path/URL, extract filename
                    var name = Path.GetFileName(v);
                    if (string.IsNullOrEmpty(name)) throw new ArgumentException($"Invalid image path at index {i}");
                    outList.Add(name);
                }
                else
                {
                    // Plain filename: keep as-is (allow any image index at any position)
                    outList.Add(v);
                }
            }

            return outList;
        }

        [HttpGet]
        [AllowAnonymous]
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
                    // Map UrlAnhPhong array: resolve each image URL, then take first as primary
                    UrlAnhPhong = ResolveImageUrls(r.UrlAnhPhong),
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

        /// <summary>
        /// Resolve image URLs: convert each filename/path in the stored list to a proper relative URL.
        /// Returns a list of resolved URLs (can be empty). This enables clients to receive all images,
        /// not only the primary image.
        /// </summary>
        private List<string> ResolveImageUrls(List<string>? images)
        {
            var outUrls = new List<string>();
            if (images == null || images.Count == 0) return outUrls;

            foreach (var img in images)
            {
                var resolved = ResolveImageUrl(img);
                if (!string.IsNullOrWhiteSpace(resolved)) outUrls.Add(resolved);
            }

            return outUrls;
        }
        // POST: api/Phong/check-available-rooms-duyanh
        [HttpPost("check-available-rooms")]
        [AllowAnonymous]
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
        [AllowAnonymous]
        public async Task<IActionResult> CheckAvailability(string loaiPhongId, string checkin, string checkout, int numberOfGuests = 1)
        {
            try
            {
                // Validate loaiPhongId
                if (string.IsNullOrWhiteSpace(loaiPhongId))
                {
                    return BadRequest("loaiPhongId is required.");
                }

                // Validate numberOfGuests
                if (numberOfGuests <= 0)
                {
                    return BadRequest("Number of guests must be greater than 0.");
                }

                if (numberOfGuests > 20)
                {
                    return BadRequest("Number of guests cannot exceed 20.");
                }

                // Validate date parameters
                if (string.IsNullOrWhiteSpace(checkin) || string.IsNullOrWhiteSpace(checkout))
                {
                    return BadRequest("Check-in and check-out dates are required.");
                }

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
        // [Authorize(Roles = "nhanvien")]
        public async Task<IActionResult> Create([FromBody] Phong payload)
        {
            if (payload == null) return BadRequest("Invalid payload");
            if (string.IsNullOrWhiteSpace(payload.Idphong)) payload.Idphong = Guid.NewGuid().ToString();

            // Validate images array (must have at least 1 primary image)
            try
            {
                _imageService.ValidateImageArray(payload.UrlAnhPhong, "UrlAnhPhong");
                // Validate filename pattern if Idphong is present
                if (!string.IsNullOrWhiteSpace(payload.Idphong))
                {
                    for (int i = 0; i < payload.UrlAnhPhong.Count; i++)
                    {
                        var fname = payload.UrlAnhPhong[i];
                        _imageService.ValidateFilenameForRoom(fname, payload.Idphong, i);
                    }
                }
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }

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

            // Return created resource with normalized image URLs so clients
            // immediately receive usable paths (e.g. "/img/room/...") instead
            // of raw filenames which would cause relative 404 requests.
            var response = new
            {
                payload.Idphong,
                payload.IdloaiPhong,
                payload.TenPhong,
                TenLoaiPhong = (payload.IdloaiPhong != null) ? (await _context.LoaiPhongs.FindAsync(payload.IdloaiPhong))?.TenLoaiPhong : null,
                payload.SoPhong,
                payload.MoTa,
                payload.SoNguoiToiDa,
                payload.GiaCoBanMotDem,
                payload.XepHangSao,
                TrangThai = payload.TrangThai,
                UrlAnhPhong = ResolveImageUrls(payload.UrlAnhPhong),
            };

            return CreatedAtAction(nameof(GetAll), new { id = payload.Idphong }, response);
        }

        // PUT: api/Phong/{id}
        [HttpPut("{id}")]
        // [Authorize(Roles = "nhanvien")]
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

            // Update images if provided (validate against business rules)
            if (payload.UrlAnhPhong != null && payload.UrlAnhPhong.Count > 0)
            {
                try
                {
                    // Normalize inputs (allow data URLs and paths)
                    payload.UrlAnhPhong = await NormalizeAndPersistImageInputsAsync(payload.UrlAnhPhong, existing.Idphong);
                    _imageService.ValidateImageArray(payload.UrlAnhPhong, "UrlAnhPhong");
                    // Validate filenames if existing Id available
                    if (!string.IsNullOrWhiteSpace(existing.Idphong))
                    {
                        for (int i = 0; i < payload.UrlAnhPhong.Count; i++)
                        {
                            _imageService.ValidateFilenameForRoom(payload.UrlAnhPhong[i], existing.Idphong, i);
                        }
                    }
                    existing.UrlAnhPhong = payload.UrlAnhPhong;
                }
                catch (Exception ex)
                {
                    return BadRequest(new { error = ex.Message });
                }
            }

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

            _context.Phongs.Update(existing);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // DELETE: api/Phong/{id}
        [HttpDelete("{id}")]
        // [Authorize(Roles = "nhanvien")]
        public async Task<IActionResult> Delete(string id)
        {
            var existing = await _context.Phongs.FindAsync(id);
            if (existing == null) return NotFound();

            _context.Phongs.Remove(existing);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        /// <summary>
        /// POST: api/Phong/{id}/images/add
        /// Add a new image to room's image array.
        /// Body: { "imageUrl": "filename.webp" }
        /// </summary>
        [HttpPost("{id}/images/add")]
        public async Task<IActionResult> AddImage(string id, [FromBody] dynamic request)
        {
            var room = await _context.Phongs.FindAsync(id);
            if (room == null) return NotFound();

            string imageUrl = request?.imageUrl;
            if (string.IsNullOrWhiteSpace(imageUrl))
                return BadRequest(new { error = "imageUrl is required" });

            try
            {
                room.UrlAnhPhong = _imageService.AddImage(room.UrlAnhPhong, imageUrl);
                _context.Phongs.Update(room);
                await _context.SaveChangesAsync();
                return Ok(new { message = "Image added", images = room.UrlAnhPhong, count = room.UrlAnhPhong.Count });
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        /// <summary>
        /// PUT: api/Phong/{id}/images
        /// Update the entire images array. Body: [ { "u": "room-101-a0.jpg" }, ... ]
        /// Backend will validate array length 1..6, index 0 present and non-empty, each element has key 'u' and filename contains no path separators.
        /// File name must follow convention room-{id}-a{index}.ext where index matches its position in the array.
        /// </summary>
        [HttpPut("{id}/images")]
        public async Task<IActionResult> UpdateImages(string id, [FromBody] List<ImageDto> images)
        {
            var room = await _context.Phongs.FindAsync(id);
            if (room == null) return NotFound();

            if (images == null || images.Count == 0)
                return BadRequest(new { error = "Images array is required and must contain at least one image (primary)" });

            if (images.Count > 6)
                return BadRequest(new { error = "Images array cannot contain more than 6 images" });

            // Validate each element has 'u' and proper filename
            var newList = new List<string>();
            for (int i = 0; i < images.Count; i++)
            {
                var item = images[i];
                if (item == null)
                    return BadRequest(new { error = $"Image at index {i} must include property 'u' with non-empty filename" });

                string? fname = null;
                try
                {
                    var je = item.u;
                    if (je.ValueKind == JsonValueKind.String)
                    {
                        fname = je.GetString();
                    }
                    else if (je.ValueKind == JsonValueKind.Array)
                    {
                        // take first non-empty string in the array
                        foreach (var el in je.EnumerateArray())
                        {
                            if (el.ValueKind == JsonValueKind.String)
                            {
                                var s = el.GetString();
                                if (!string.IsNullOrWhiteSpace(s))
                                {
                                    fname = s;
                                    break;
                                }
                            }
                        }
                    }
                    else if (je.ValueKind == JsonValueKind.Object)
                    {
                        // In case u is nested, try to find string properties
                        foreach (var prop in je.EnumerateObject())
                        {
                            if (prop.Value.ValueKind == JsonValueKind.String)
                            {
                                var s = prop.Value.GetString();
                                if (!string.IsNullOrWhiteSpace(s))
                                {
                                    fname = s;
                                    break;
                                }
                            }
                        }
                    }
                }
                catch
                {
                    fname = null;
                }

                if (string.IsNullOrWhiteSpace(fname))
                    return BadRequest(new { error = $"Image at index {i} must include property 'u' with non-empty filename" });

                fname = fname.Trim();
                try
                {
                    _imageService.ValidateFilenameForRoom(fname, id, i);
                }
                catch (Exception ex)
                {
                    return BadRequest(new { error = ex.Message });
                }

                newList.Add(fname);
            }

            // Guarantee primary image exists
            if (string.IsNullOrWhiteSpace(newList[0]))
                return BadRequest(new { error = "Primary image (index 0) cannot be empty" });

            // Persist the new list (server stores list of filenames)
            room.UrlAnhPhong = newList;
            _context.Phongs.Update(room);
            await _context.SaveChangesAsync();

            // Return stored images as array of objects { u: filename }
            var result = room.UrlAnhPhong.Select(f => new { u = f }).ToList();
            return Ok(new { message = "Images updated", images = result });
        }

        /// <summary>
        /// POST: api/Phong/{id}/images/upload?action=add|replacePrimary|replaceAt&index=2
        /// Accepts multipart/form-data with file field named 'file'. Returns generated filename.
        /// </summary>
        [HttpPost("{id}/images/upload")]
        public async Task<IActionResult> UploadImage(string id, [FromQuery] string action = "add", [FromQuery] int? index = null)
        {
            var room = await _context.Phongs.FindAsync(id);
            if (room == null) return NotFound();

            var file = Request.Form?.Files?.FirstOrDefault();
            if (file == null || file.Length == 0)
                return BadRequest(new { error = "No file provided" });

            // Determine target index
            int targetIndex;
            if (action == "replacePrimary")
            {
                targetIndex = 0;
            }
            else if (action == "replaceAt")
            {
                if (!index.HasValue) return BadRequest(new { error = "index query parameter required for replaceAt" });
                targetIndex = index.Value;
                if (targetIndex <= 0) return BadRequest(new { error = "replaceAt index must be > 0" });
                if (targetIndex >= room.UrlAnhPhong.Count) return BadRequest(new { error = "replaceAt index out of range" });
            }
            else // default 'add'
            {
                targetIndex = room.UrlAnhPhong.Count; // append
                if (room.UrlAnhPhong.Count >= 6)
                    return BadRequest(new { error = "Cannot add more than 6 images" });
            }

            // Validate extension
            var origExt = Path.GetExtension(file.FileName)?.ToLowerInvariant() ?? ".jpg";
            try
            {
                var generated = _imageService.GenerateFilename(id, targetIndex, origExt);

                // Save file to wwwroot/img/room
                var folder = Path.Combine(_env.ContentRootPath, "wwwroot", "img", "room");
                if (!Directory.Exists(folder)) Directory.CreateDirectory(folder);
                var destPath = Path.Combine(folder, generated);

                // Save/overwrite
                await using (var stream = System.IO.File.Create(destPath))
                {
                    await file.CopyToAsync(stream);
                }

                return Ok(new { filename = generated });
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        /// <summary>
        /// DELETE: api/Phong/{id}/images/{imageIndex}
        /// Remove an image at specified index (cannot delete index 0).
        /// </summary>
        [HttpDelete("{id}/images/{imageIndex}")]
        public async Task<IActionResult> RemoveImage(string id, int imageIndex)
        {
            var room = await _context.Phongs.FindAsync(id);
            if (room == null) return NotFound();

            try
            {
                // Determine the filename to delete
                string? toDelete = null;
                if (imageIndex >= 0 && imageIndex < room.UrlAnhPhong.Count)
                {
                    toDelete = room.UrlAnhPhong[imageIndex];
                }

                room.UrlAnhPhong = _imageService.RemoveImage(room.UrlAnhPhong, imageIndex);

                // Delete file from disk if it exists and is not referenced anymore
                if (!string.IsNullOrWhiteSpace(toDelete))
                {
                    // If no other reference to this filename in array, remove file
                    if (!room.UrlAnhPhong.Contains(toDelete))
                    {
                        var folder = Path.Combine(_env.ContentRootPath, "wwwroot", "img", "room");
                        var path = Path.Combine(folder, toDelete);
                        if (System.IO.File.Exists(path))
                        {
                            System.IO.File.Delete(path);
                        }
                    }
                }
                _context.Phongs.Update(room);
                await _context.SaveChangesAsync();
                return Ok(new { message = "Image removed", images = room.UrlAnhPhong, count = room.UrlAnhPhong.Count });
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        /// <summary>
        /// PUT: api/Phong/{id}/images/primary
        /// Replace the primary image (index 0).
        /// Body: { "imageUrl": "newimage.webp" }
        /// </summary>
        [HttpPut("{id}/images/primary")]
        public async Task<IActionResult> ReplacePrimaryImage(string id, [FromBody] dynamic request)
        {
            var room = await _context.Phongs.FindAsync(id);
            if (room == null) return NotFound();

            string imageUrl = request?.imageUrl;
            if (string.IsNullOrWhiteSpace(imageUrl))
                return BadRequest(new { error = "imageUrl is required" });

            try
            {
                // Remember old primary for possible deletion
                var oldPrimary = room.UrlAnhPhong.Count > 0 ? room.UrlAnhPhong[0] : null;

                room.UrlAnhPhong = _imageService.ReplacePrimaryImage(room.UrlAnhPhong, imageUrl);

                // If oldPrimary is different and no longer referenced, delete file
                if (!string.IsNullOrWhiteSpace(oldPrimary) && !room.UrlAnhPhong.Contains(oldPrimary))
                {
                    var folder = Path.Combine(_env.ContentRootPath, "wwwroot", "img", "room");
                    var path = Path.Combine(folder, oldPrimary);
                    if (System.IO.File.Exists(path)) System.IO.File.Delete(path);
                }
                _context.Phongs.Update(room);
                await _context.SaveChangesAsync();
                return Ok(new { message = "Primary image replaced", images = room.UrlAnhPhong, count = room.UrlAnhPhong.Count });
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        /// <summary>
        /// PUT: api/Phong/{id}/images/{imageIndex}
        /// Replace an image at specified index.
        /// Body: { "imageUrl": "newimage.webp" }
        /// </summary>
        [HttpPut("{id}/images/{imageIndex}")]
        public async Task<IActionResult> ReplaceImage(string id, int imageIndex, [FromBody] dynamic request)
        {
            var room = await _context.Phongs.FindAsync(id);
            if (room == null) return NotFound();

            string imageUrl = request?.imageUrl;
            if (string.IsNullOrWhiteSpace(imageUrl))
                return BadRequest(new { error = "imageUrl is required" });

            try
            {
                string? oldImage = null;
                if (imageIndex >= 0 && imageIndex < room.UrlAnhPhong.Count)
                {
                    oldImage = room.UrlAnhPhong[imageIndex];
                }

                room.UrlAnhPhong = _imageService.ReplaceImage(room.UrlAnhPhong, imageIndex, imageUrl);

                if (!string.IsNullOrWhiteSpace(oldImage) && !room.UrlAnhPhong.Contains(oldImage))
                {
                    var folder = Path.Combine(_env.ContentRootPath, "wwwroot", "img", "room");
                    var path = Path.Combine(folder, oldImage);
                    if (System.IO.File.Exists(path)) System.IO.File.Delete(path);
                }
                _context.Phongs.Update(room);
                await _context.SaveChangesAsync();
                return Ok(new { message = "Image replaced", images = room.UrlAnhPhong, count = room.UrlAnhPhong.Count });
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        /// <summary>
        /// PUT: api/Phong/{id}/images/reorder
        /// Reorder images in array. Primary image (index 0) cannot be moved.
        /// Body: { "fromIndex": 2, "toIndex": 1 }
        /// </summary>
        [HttpPut("{id}/images/reorder")]
        public async Task<IActionResult> ReorderImages(string id, [FromBody] dynamic request)
        {
            var room = await _context.Phongs.FindAsync(id);
            if (room == null) return NotFound();

            int fromIndex = request?.fromIndex;
            int toIndex = request?.toIndex;

            try
            {
                room.UrlAnhPhong = _imageService.ReorderImages(room.UrlAnhPhong, fromIndex, toIndex);
                _context.Phongs.Update(room);
                await _context.SaveChangesAsync();
                return Ok(new { message = "Images reordered", images = room.UrlAnhPhong, count = room.UrlAnhPhong.Count });
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        // GET: api/Phong/top-rooms-2025?top=5
        [HttpGet("top-rooms-2025")]
        [AllowAnonymous]
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
                    cmd.CommandText = "SELECT * FROM sp_top_phong(@year_input, @top_n)";
                    cmd.CommandType = System.Data.CommandType.Text; // Call function via SELECT

                    var paramYear = cmd.CreateParameter();
                    paramYear.ParameterName = "@year_input";
                    paramYear.Value = 2025; // Default or pass as arg if needed
                    paramYear.DbType = System.Data.DbType.Int32;
                    cmd.Parameters.Add(paramYear);

                    var paramTop = cmd.CreateParameter();
                    paramTop.ParameterName = "@top_n";
                    paramTop.Value = top;
                    paramTop.DbType = System.Data.DbType.Int32;
                    cmd.Parameters.Add(paramTop);

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