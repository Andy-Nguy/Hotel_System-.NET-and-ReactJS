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

            // Get booked room IDs using a single optimized query
            var bookedRoomIds = await (
                from dp in _context.DatPhongs
                where dp.Idphong != null &&
                      new[] { 1, 2, 3 }.Contains(dp.TrangThai) &&
                      dp.NgayNhanPhong < checkOutDate &&
                      dp.NgayTraPhong > checkInDate
                select dp.Idphong
            ).Union(
                from ct in _context.ChiTietDatPhongs
                join dp in _context.DatPhongs on ct.IDDatPhong equals dp.IddatPhong
                where new[] { 1, 2, 3 }.Contains(dp.TrangThai) &&
                      dp.NgayNhanPhong < checkOutDate &&
                      dp.NgayTraPhong > checkInDate
                select ct.IDPhong
            ).Distinct().ToListAsync();

            _logger.LogInformation($"Booked room IDs count: {bookedRoomIds.Count}");

            // Get available rooms directly from database with filtering
            var availableRooms = await _context.Phongs
                .Include(p => p.IdloaiPhongNavigation)
                .Where(p =>
                    p.TrangThai == "Trống" &&
                    p.SoNguoiToiDa >= numberOfGuests &&
                    !bookedRoomIds.Contains(p.Idphong)
                )
                .Select(p => new AvailableRoomResponse
                {
                    RoomId = p.Idphong,
                    RoomNumber = p.SoPhong,
                    Description = p.MoTa ?? "",
                    BasePricePerNight = p.GiaCoBanMotDem ?? 0,
                    RoomImageUrl = ResolveImageUrl(p.UrlAnhPhong) ?? "",
                    RoomTypeName = p.IdloaiPhongNavigation != null ? p.IdloaiPhongNavigation.TenLoaiPhong ?? "" : "",
                    MaxOccupancy = p.SoNguoiToiDa ?? 0
                })
                .OrderBy(p => p.RoomNumber)
                .ToListAsync();

            _logger.LogInformation($"Available rooms count: {availableRooms.Count}");

            return availableRooms;
        }
    }
}
