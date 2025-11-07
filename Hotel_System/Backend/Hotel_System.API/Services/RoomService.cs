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

            var availableRooms = allRooms.Where(p =>
                 p.TrangThai == "Sẵn sàng" &&  
                p.SoNguoiToiDa >= numberOfGuests &&
                !_context.DatPhongs.Any(dp =>
                    dp.Idphong == p.Idphong &&
                    new[] { 1, 2, 3 }.Contains(dp.TrangThai) &&
                    dp.NgayNhanPhong < DateOnly.FromDateTime(checkOut) &&
                    dp.NgayTraPhong > DateOnly.FromDateTime(checkIn))
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
