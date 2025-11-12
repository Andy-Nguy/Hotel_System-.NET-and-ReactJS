using Hotel_System.API.Models;
using Hotel_System.API.DTOs;
using Microsoft.EntityFrameworkCore;

namespace Hotel_System.API.Services
{
    public class RoomService
    {
        private readonly HotelSystemContext _context;
        private readonly ILogger<RoomService> _logger;

        public RoomService(HotelSystemContext context, ILogger<RoomService> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<List<AvailableRoomResponse>> CheckAvailableRoomsAsync(DateTime checkIn, DateTime checkOut, int numberOfGuests)
        {
            _logger.LogInformation($"Checking rooms: CheckIn={checkIn}, CheckOut={checkOut}, Guests={numberOfGuests}");

            var allRooms = await _context.Phongs.Include(p => p.IdloaiPhongNavigation).ToListAsync();
            _logger.LogInformation($"Total rooms in DB: {allRooms.Count}");

            // Convert DateTime to DateOnly for comparison
            var checkInDate = DateOnly.FromDateTime(checkIn);
            var checkOutDate = DateOnly.FromDateTime(checkOut);

            // Get booked room IDs from both old (DatPhong.IDPhong) and new (ChiTietDatPhong) structure
            var bookedRoomIds = new HashSet<string>();

            // Check từ DatPhong.IDPhong (cấu trúc cũ - 1 đơn = 1 phòng)
            var bookedFromDatPhong = await _context.DatPhongs
                .Where(dp =>
                    dp.Idphong != null &&
                    new[] { 1, 2, 3 }.Contains(dp.TrangThai) && // 1:Chờ XN, 2:Đã XN, 3:Đang dùng
                    dp.NgayNhanPhong < checkOutDate &&
                    dp.NgayTraPhong > checkInDate)
                .Select(dp => dp.Idphong)
                .ToListAsync();

            foreach (var roomId in bookedFromDatPhong)
            {
                if (roomId != null) bookedRoomIds.Add(roomId);
            }

            // Check từ ChiTietDatPhong (cấu trúc mới - 1 đơn = nhiều phòng)
            var bookedFromChiTiet = await _context.ChiTietDatPhongs
                .Include(ct => ct.DatPhong)
                .Where(ct =>
                    ct.DatPhong != null &&
                    new[] { 1, 2, 3 }.Contains(ct.DatPhong.TrangThai) &&
                    ct.DatPhong.NgayNhanPhong < checkOutDate &&
                    ct.DatPhong.NgayTraPhong > checkInDate)
                .Select(ct => ct.IDPhong)
                .ToListAsync();

            foreach (var roomId in bookedFromChiTiet)
            {
                bookedRoomIds.Add(roomId);
            }

            _logger.LogInformation($"Booked room IDs: {string.Join(", ", bookedRoomIds)}");

            // Filter available rooms
            var availableRooms = allRooms.Where(p =>
                p.TrangThai == "Trống" &&  
                p.SoNguoiToiDa >= numberOfGuests &&
                !bookedRoomIds.Contains(p.Idphong)
            ).ToList();

            _logger.LogInformation($"Available rooms after filter: {availableRooms.Count}");

            var result = availableRooms.Select(p => new AvailableRoomResponse
            {
                RoomId = p.Idphong,
                RoomNumber = p.SoPhong,
                Description = p.MoTa ?? "",
                BasePricePerNight = p.GiaCoBanMotDem ?? 0,
                RoomImageUrl = p.UrlAnhPhong ?? "",
                RoomTypeName = p.IdloaiPhongNavigation != null ? p.IdloaiPhongNavigation.TenLoaiPhong ?? "" : "",
                MaxOccupancy = p.SoNguoiToiDa ?? 0
            }).OrderBy(p => p.RoomNumber).ToList();

            _logger.LogInformation($"Final result count: {result.Count}");

            return result;
        }
    }
}
