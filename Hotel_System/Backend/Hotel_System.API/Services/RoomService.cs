using Hotel_System.API.Models;
using Hotel_System.API.DTOs;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Hosting;
using System.IO;

namespace Hotel_System.API.Services
{
    public class RoomService
    {
        private readonly HotelSystemContext _context;
        private readonly ILogger<RoomService> _logger;
        private readonly IWebHostEnvironment _env;

        public RoomService(HotelSystemContext context, ILogger<RoomService> logger, IWebHostEnvironment env)
        {
            _context = context;
            _logger = logger;
            _env = env;
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

        public async Task<List<AvailableRoomResponse>> CheckAvailableRoomsAsync(DateTime checkIn, DateTime checkOut, int numberOfGuests)
        {
            _logger.LogInformation($"Checking rooms: CheckIn={checkIn}, CheckOut={checkOut}, Guests={numberOfGuests}");

            // Convert DateTime to DateOnly for comparison
            var checkInDate = DateOnly.FromDateTime(checkIn);
            var checkOutDate = DateOnly.FromDateTime(checkOut);

            var now = DateTime.UtcNow;

            // Get booked room IDs using a single optimized query
            // Also fetch the matching DatPhong rows so we can log and inspect them when debugging
            // Status: 1=chưa thanh toán, 2=đã thanh toán, 3=đang sử dụng, 5=quá hạn (đều là booking hoạt động)
            var overlappingDatPhongs = await _context.DatPhongs
                .Where(dp => dp.Idphong != null &&
                    ((dp.ThoiHan != null && dp.ThoiHan > now) || new[] { 1, 2, 3, 5 }.Contains(dp.TrangThai)) &&
                    dp.NgayNhanPhong < checkOutDate &&
                    dp.NgayTraPhong > checkInDate)
                .ToListAsync();

            if (overlappingDatPhongs.Any())
            {
                _logger.LogInformation("Overlapping DatPhong records found:");
                foreach (var od in overlappingDatPhongs)
                {
                    _logger.LogInformation($"DatPhong {od.IddatPhong} -> Room={od.Idphong}, From={od.NgayNhanPhong}, To={od.NgayTraPhong}, TrangThai={od.TrangThai}");
                }
            }

            var bookedRoomIds = await (
                from dp in _context.DatPhongs
                where dp.Idphong != null &&
                      ((dp.ThoiHan != null && dp.ThoiHan > now) || new[] { 1, 2, 3, 5 }.Contains(dp.TrangThai)) &&
                      dp.NgayNhanPhong < checkOutDate &&
                      dp.NgayTraPhong > checkInDate
                select dp.Idphong
            ).Union(
                from ct in _context.ChiTietDatPhongs
                join dp in _context.DatPhongs on ct.IDDatPhong equals dp.IddatPhong
                where ((dp.ThoiHan != null && dp.ThoiHan > now) || new[] { 1, 2, 3, 5 }.Contains(dp.TrangThai)) &&
                      dp.NgayNhanPhong < checkOutDate &&
                      dp.NgayTraPhong > checkInDate
                select ct.IDPhong
            ).Distinct().ToListAsync();

            _logger.LogInformation($"Booked room IDs count: {bookedRoomIds.Count}");

            var availableRoomsQuery = await _context.Phongs
                .Include(p => p.IdloaiPhongNavigation)
                .Where(p =>
                    // Do not strictly require the textual status to be exactly "Trống" here because
                    // the `TrangThai` field is used for administrative values and may contain
                    // different localized strings. Instead, only exclude rooms that are under
                    // maintenance. Occupancy is determined from bookings above (bookedRoomIds).
                    (p.TrangThai == null || p.TrangThai != "Bảo trì") &&
                    p.SoNguoiToiDa >= numberOfGuests &&
                    !bookedRoomIds.Contains(p.Idphong)
                )
                .Select(p => new
                {
                    RoomId = p.Idphong,
                    RoomName = p.TenPhong ?? "",
                    RoomNumber = p.SoPhong,
                    Description = p.MoTa ?? "",
                    BasePricePerNight = p.GiaCoBanMotDem ?? 0,
                    RawImageUrls = p.UrlAnhPhong,
                    RoomTypeName = p.IdloaiPhongNavigation != null ? p.IdloaiPhongNavigation.TenLoaiPhong ?? "" : "",
                    MaxOccupancy = p.SoNguoiToiDa ?? 0,
                    Rating = p.XepHangSao ?? 0
                })
                .OrderBy(p => p.RoomNumber)
                .ToListAsync();

            // Get active promotions for the rooms
            var today = DateOnly.FromDateTime(DateTime.Now);
            var roomIds = availableRoomsQuery.Select(r => r.RoomId).ToList();
            
            var promotionsDict = await _context.KhuyenMaiPhongs
                .Include(kmp => kmp.IdkhuyenMaiNavigation)
                .Where(kmp => roomIds.Contains(kmp.Idphong) &&
                             kmp.IsActive &&
                             kmp.IdkhuyenMaiNavigation.TrangThai == "active" &&
                             kmp.IdkhuyenMaiNavigation.NgayBatDau <= today &&
                             kmp.IdkhuyenMaiNavigation.NgayKetThuc >= today)
                .GroupBy(kmp => kmp.Idphong)
                .ToDictionaryAsync(
                    g => g.Key,
                    g => g.OrderByDescending(kmp => kmp.IdkhuyenMaiNavigation.GiaTriGiam).First()
                );

            var availableRooms = availableRoomsQuery.Select(r => 
            {
                var response = new AvailableRoomResponse
                {
                    RoomId = r.RoomId,
                    RoomName = r.RoomName,
                    RoomNumber = r.RoomNumber,
                    Description = r.Description,
                    BasePricePerNight = r.BasePricePerNight,
                    RoomImageUrl = ResolveImageUrl((r.RawImageUrls != null && r.RawImageUrls.Count > 0) ? r.RawImageUrls[0] : null) ?? "",
                    // Add multiple images for carousel/thumbnails in frontend
                    RoomImageUrls = (r.RawImageUrls != null && r.RawImageUrls.Count > 0) 
                        ? r.RawImageUrls.Select(img => ResolveImageUrl(img) ?? "").Where(u => !string.IsNullOrEmpty(u)).ToList()
                        : new List<string>(),
                    RoomTypeName = r.RoomTypeName,
                    MaxOccupancy = r.MaxOccupancy,
                    Rating = (decimal)r.Rating
                };

                // Apply promotion if available
                if (promotionsDict.TryGetValue(r.RoomId, out var promotion))
                {
                    var promo = promotion.IdkhuyenMaiNavigation;
                    response.PromotionName = promo.TenKhuyenMai;
                    response.DiscountPercent = promo.GiaTriGiam;
                    
                    if (promo.LoaiGiamGia == "percent" && promo.GiaTriGiam.HasValue)
                    {
                        response.DiscountedPrice = r.BasePricePerNight * (1 - promo.GiaTriGiam.Value / 100);
                    }
                    else if ((promo.LoaiGiamGia == "amount" || promo.LoaiGiamGia == "fixed") && promo.GiaTriGiam.HasValue)
                    {
                        response.DiscountedPrice = Math.Max(0, r.BasePricePerNight - promo.GiaTriGiam.Value);
                    }
                }

                return response;
            }).ToList();

            _logger.LogInformation($"Available rooms count: {availableRooms.Count}");

            return availableRooms;
        }

        // Similar to CheckAvailableRoomsAsync but restricts results to a specific room type id
        public async Task<List<AvailableRoomResponse>> CheckAvailableRoomsByTypeAsync(DateTime checkIn, DateTime checkOut, string loaiPhongId, int numberOfGuests)
        {
            _logger.LogInformation($"Checking rooms by type: CheckIn={checkIn}, CheckOut={checkOut}, Guests={numberOfGuests}, LoaiPhongId={loaiPhongId}");

            var checkInDate = DateOnly.FromDateTime(checkIn);
            var checkOutDate = DateOnly.FromDateTime(checkOut);
            var now = DateTime.UtcNow;

            // Get booked room IDs using same optimized query as other method
            var overlappingDatPhongs2 = await _context.DatPhongs
                .Where(dp => dp.Idphong != null &&
                    ((dp.ThoiHan != null && dp.ThoiHan > now) || new[] { 1, 2, 3, 5 }.Contains(dp.TrangThai)) &&
                    dp.NgayNhanPhong < checkOutDate &&
                    dp.NgayTraPhong > checkInDate)
                .ToListAsync();

            if (overlappingDatPhongs2.Any())
            {
                _logger.LogInformation("Overlapping DatPhong records found (by type check):");
                foreach (var od in overlappingDatPhongs2)
                {
                    _logger.LogInformation($"DatPhong {od.IddatPhong} -> Room={od.Idphong}, From={od.NgayNhanPhong}, To={od.NgayTraPhong}, TrangThai={od.TrangThai}");
                }
            }

            var bookedRoomIds = await (
                from dp in _context.DatPhongs
                    where dp.Idphong != null &&
                        ((dp.ThoiHan != null && dp.ThoiHan > now) || new[] { 1, 2, 3, 5 }.Contains(dp.TrangThai)) &&
                        dp.NgayNhanPhong < checkOutDate &&
                        dp.NgayTraPhong > checkInDate
                select dp.Idphong
            ).Union(
                from ct in _context.ChiTietDatPhongs
                join dp in _context.DatPhongs on ct.IDDatPhong equals dp.IddatPhong
                    where ((dp.ThoiHan != null && dp.ThoiHan > now) || new[] { 1, 2, 3, 5 }.Contains(dp.TrangThai)) &&
                      dp.NgayNhanPhong < checkOutDate &&
                      dp.NgayTraPhong > checkInDate
                select ct.IDPhong
            ).Distinct().ToListAsync();

            _logger.LogInformation($"Booked room IDs count: {bookedRoomIds.Count}");

            var availableRoomsQuery = await _context.Phongs
                .Include(p => p.IdloaiPhongNavigation)
                .Where(p =>
                    p.IdloaiPhong == loaiPhongId &&
                    // same reasoning as above: allow any non-maintenance room and rely on
                    // booking overlap detection to determine occupancy
                    (p.TrangThai == null || p.TrangThai != "Bảo trì") &&
                    p.SoNguoiToiDa >= numberOfGuests &&
                    !bookedRoomIds.Contains(p.Idphong)
                )
                .Select(p => new
                {
                    RoomId = p.Idphong,
                    RoomName = p.TenPhong ?? "",
                    RoomNumber = p.SoPhong,
                    Description = p.MoTa ?? "",
                    BasePricePerNight = p.GiaCoBanMotDem ?? 0,
                    RawImageUrls = p.UrlAnhPhong,
                    RoomTypeName = p.IdloaiPhongNavigation != null ? p.IdloaiPhongNavigation.TenLoaiPhong ?? "" : "",
                    MaxOccupancy = p.SoNguoiToiDa ?? 0,
                    Rating = p.XepHangSao ?? 0
                })
                .OrderBy(p => p.RoomNumber)
                .ToListAsync();

            // Get active promotions for the rooms
            var today = DateOnly.FromDateTime(DateTime.Now);
            var roomIds = availableRoomsQuery.Select(r => r.RoomId).ToList();
            
            var promotionsDict = await _context.KhuyenMaiPhongs
                .Include(kmp => kmp.IdkhuyenMaiNavigation)
                .Where(kmp => roomIds.Contains(kmp.Idphong) &&
                             kmp.IsActive &&
                             kmp.IdkhuyenMaiNavigation.TrangThai == "active" &&
                             kmp.IdkhuyenMaiNavigation.NgayBatDau <= today &&
                             kmp.IdkhuyenMaiNavigation.NgayKetThuc >= today)
                .GroupBy(kmp => kmp.Idphong)
                .ToDictionaryAsync(
                    g => g.Key,
                    g => g.OrderByDescending(kmp => kmp.IdkhuyenMaiNavigation.GiaTriGiam).First()
                );

            var availableRooms = availableRoomsQuery.Select(r => 
            {
                var response = new AvailableRoomResponse
                {
                    RoomId = r.RoomId,
                    RoomName = r.RoomName,
                    RoomNumber = r.RoomNumber,
                    Description = r.Description,
                    BasePricePerNight = r.BasePricePerNight,
                    RoomImageUrl = ResolveImageUrl((r.RawImageUrls != null && r.RawImageUrls.Count > 0) ? r.RawImageUrls[0] : null) ?? "",
                    // Add multiple images for carousel/thumbnails in frontend
                    RoomImageUrls = (r.RawImageUrls != null && r.RawImageUrls.Count > 0) 
                        ? r.RawImageUrls.Select(img => ResolveImageUrl(img) ?? "").Where(u => !string.IsNullOrEmpty(u)).ToList()
                        : new List<string>(),
                    RoomTypeName = r.RoomTypeName,
                    MaxOccupancy = r.MaxOccupancy,
                    Rating = (decimal)r.Rating
                };

                // Apply promotion if available
                if (promotionsDict.TryGetValue(r.RoomId, out var promotion))
                {
                    var promo = promotion.IdkhuyenMaiNavigation;
                    response.PromotionName = promo.TenKhuyenMai;
                    response.DiscountPercent = promo.GiaTriGiam;
                    
                    if (promo.LoaiGiamGia == "percent" && promo.GiaTriGiam.HasValue)
                    {
                        response.DiscountedPrice = r.BasePricePerNight * (1 - promo.GiaTriGiam.Value / 100);
                    }
                    else if ((promo.LoaiGiamGia == "amount" || promo.LoaiGiamGia == "fixed") && promo.GiaTriGiam.HasValue)
                    {
                        response.DiscountedPrice = Math.Max(0, r.BasePricePerNight - promo.GiaTriGiam.Value);
                    }
                }

                return response;
            }).ToList();

            _logger.LogInformation($"Available rooms by type count: {availableRooms.Count}");
            return availableRooms;
        }
    }
}
