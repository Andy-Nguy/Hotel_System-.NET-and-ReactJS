using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Hotel_System.API.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Hotel_System.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class DashboardController : ControllerBase
    {
        private readonly HotelSystemContext _context;

        public DashboardController(HotelSystemContext context)
        {
            _context = context;
        }

        [HttpGet("kpi")]
        public async Task<ActionResult<object>> GetKPI()
        {
            try
            {
                var today = DateOnly.FromDateTime(DateTime.Now);
                var startOfMonth = new DateOnly(today.Year, today.Month, 1);
                var endOfMonth = startOfMonth.AddMonths(1).AddDays(-1);

                var currentMonthRevenue = await _context.HoaDons
                    .Where(h => h.NgayLap.HasValue && ((DateTime)h.NgayLap!).Date >= startOfMonth.ToDateTime(TimeOnly.MinValue) && ((DateTime)h.NgayLap!).Date <= endOfMonth.ToDateTime(TimeOnly.MinValue))
                    .SumAsync(h => (decimal?)h.TongTien) ?? 0m;

                var todayRevenue = await _context.HoaDons
                    .Where(h => h.NgayLap.HasValue && ((DateTime)h.NgayLap!).Date == DateTime.Now.Date)
                    .SumAsync(h => (decimal?)h.TongTien) ?? 0m;

                var totalRooms = await _context.Phongs.CountAsync();
                var roomsInUse = await _context.DatPhongs
                    .Where(d => d.NgayNhanPhong <= today && d.NgayTraPhong >= today && (d.TrangThai == 3 || d.TrangThai == 2))
                    .CountAsync();
                var roomsAvailable = totalRooms - roomsInUse;
                var occupancyRateToday = totalRooms > 0 ? (roomsInUse * 100.0 / totalRooms) : 0.0;

                var checkInToday = await _context.DatPhongs
                    .Where(d => d.NgayNhanPhong == today && d.TrangThai >= 2)
                    .CountAsync();

                var checkOutToday = await _context.DatPhongs
                    .Where(d => d.NgayTraPhong == today && d.TrangThai >= 2)
                    .CountAsync();

                var totalBookingsThisMonth = await _context.DatPhongs
                    .Where(d => d.NgayDatPhong.HasValue && d.NgayDatPhong!.Value >= startOfMonth && d.NgayDatPhong!.Value <= endOfMonth)
                    .CountAsync();

                var cancelledBookingsThisMonth = await _context.DatPhongs
                    .Where(d => d.TrangThai == 0 && d.NgayDatPhong.HasValue && d.NgayDatPhong!.Value >= startOfMonth && d.NgayDatPhong!.Value <= endOfMonth)
                    .CountAsync();

                return Ok(new
                {
                    data = new
                    {
                        currentMonthRevenue = Math.Round(currentMonthRevenue, 0),
                        todayRevenue = Math.Round(todayRevenue, 0),
                        occupancyRateToday = Math.Round(occupancyRateToday, 2),
                        roomsInUse,
                        roomsAvailable,
                        roomsMaintenance = 0,
                        checkInToday,
                        checkOutToday,
                        totalBookingsThisMonth,
                        cancelledBookingsThisMonth
                    }
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        [HttpGet("revenue-chart")]
        public async Task<ActionResult<object>> GetRevenueChart([FromQuery] int days = 30)
        {
            try
            {
                var endDate = DateTime.Now.Date;
                var startDate = endDate.AddDays(-days + 1);

                var revenueData = await _context.HoaDons
                    .Where(h => h.NgayLap.HasValue && ((DateTime)h.NgayLap!).Date >= startDate && ((DateTime)h.NgayLap!).Date <= endDate)
                    .GroupBy(h => ((DateTime)h.NgayLap!).Date)
                    .Select(g => new
                    {
                        date = g.Key.ToString("yyyy-MM-dd"),
                        revenue = g.Sum(h => h.TongTien),
                        roomRevenue = g.Sum(h => h.TienPhong ?? 0),
                        serviceRevenue = g.Sum(h => h.TongTien - (h.TienPhong ?? 0))
                    })
                    .OrderBy(x => x.date)
                    .ToListAsync();

                var allDates = Enumerable.Range(0, days)
                    .Select(i => startDate.AddDays(i))
                    .Select(d => d.ToString("yyyy-MM-dd"))
                    .ToList();

                var completedData = allDates.Select(date =>
                {
                    var existing = revenueData.FirstOrDefault(r => r.date == date);
                    return new
                    {
                        date,
                        revenue = existing?.revenue ?? 0,
                        roomRevenue = existing?.roomRevenue ?? 0,
                        serviceRevenue = existing?.serviceRevenue ?? 0
                    };
                }).ToList();

                return Ok(new { data = completedData });
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        [HttpGet("occupancy-rate")]
        public async Task<ActionResult<object>> GetOccupancyRate([FromQuery] int days = 30)
        {
            try
            {
                var today = DateOnly.FromDateTime(DateTime.Now);
                var startDate = today.AddDays(-days + 1);
                var totalRooms = await _context.Phongs.CountAsync();
                var occupancyData = new List<object>();

                for (int i = 0; i < days; i++)
                {
                    var date = startDate.AddDays(i);
                    var roomsInUseOnDate = await _context.DatPhongs
                        .Where(d => d.NgayNhanPhong <= date && d.NgayTraPhong >= date && (d.TrangThai == 2 || d.TrangThai == 3))
                        .CountAsync();
                    var occupancyRate = totalRooms > 0 ? (roomsInUseOnDate * 100.0 / totalRooms) : 0.0;
                    occupancyData.Add(new { date = date.ToString("yyyy-MM-dd"), occupancyRate = Math.Round(occupancyRate, 2) });
                }

                return Ok(new { data = occupancyData });
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        [HttpGet("top-rooms")]
        public async Task<ActionResult<object>> GetTopRooms([FromQuery] int limit = 5, [FromQuery] string? month = null)
        {
            try
            {
                DateOnly targetMonth;
                if (month != null)
                {
                    targetMonth = DateOnly.ParseExact(month, "yyyy-MM");
                }
                else
                {
                    targetMonth = DateOnly.FromDateTime(DateTime.Now);
                }

                var startDate = new DateOnly(targetMonth.Year, targetMonth.Month, 1);
                var endDate = startDate.AddMonths(1).AddDays(-1);

                var topRooms = await _context.DatPhongs
                    .Where(d => d.NgayDatPhong.HasValue && d.NgayDatPhong!.Value >= startDate && d.NgayDatPhong!.Value <= endDate)
                    .Include(d => d.IdphongNavigation)
                    .GroupBy(d => d.Idphong)
                    .Select(g => new
                    {
                        roomId = g.Key,
                        roomName = g.First().IdphongNavigation!.TenPhong,
                        roomNumber = g.First().IdphongNavigation!.SoPhong,
                        bookingCount = g.Count(),
                        totalRevenue = g.Sum(d => d.TongTien)
                    })
                    .OrderByDescending(x => x.bookingCount)
                    .Take(limit)
                    .ToListAsync();

                return Ok(new { data = topRooms });
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        [HttpGet("top-services")]
        public async Task<ActionResult<object>> GetTopServices([FromQuery] int limit = 5, [FromQuery] string? month = null)
        {
            try
            {
                DateOnly targetMonth;
                if (month != null)
                {
                    targetMonth = DateOnly.ParseExact(month, "yyyy-MM");
                }
                else
                {
                    targetMonth = DateOnly.FromDateTime(DateTime.Now);
                }

                var startDate = new DateOnly(targetMonth.Year, targetMonth.Month, 1);
                var endDate = startDate.AddMonths(1).AddDays(-1);

                var topServices = await _context.Cthddvs
                    .Include(c => c.IdhoaDonNavigation).ThenInclude(h => h.IddatPhongNavigation)
                    .Where(c => c.IdhoaDonNavigation!.NgayLap.HasValue && ((DateTime)c.IdhoaDonNavigation!.NgayLap!).Date >= startDate.ToDateTime(TimeOnly.MinValue) && ((DateTime)c.IdhoaDonNavigation!.NgayLap!).Date <= endDate.ToDateTime(TimeOnly.MinValue))
                    .GroupBy(c => c.IddichVu)
                    .Select(g => new
                    {
                        serviceId = g.Key,
                        serviceName = g.First().IddichVuNavigation!.TenDichVu,
                        usageCount = g.Count(),
                        totalRevenue = g.Sum(c => c.TienDichVu ?? 0)
                    })
                    .OrderByDescending(x => x.usageCount)
                    .Take(limit)
                    .ToListAsync();

                return Ok(new { data = topServices });
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        [HttpGet("customer-origin")]
        public async Task<ActionResult<object>> GetCustomerOrigin()
        {
            try
            {
                var totalCustomers = await _context.KhachHangs.CountAsync();
                var repeatCustomers = await _context.KhachHangs
                    .Where(k => _context.DatPhongs.Count(d => d.IdkhachHang == k.IdkhachHang) > 1)
                    .CountAsync();
                var newCustomers = totalCustomers - repeatCustomers;

                var customerOriginData = new[]
                {
                    new { origin = "Khách mới", count = newCustomers },
                    new { origin = "Khách quay lại", count = repeatCustomers }
                };

                return Ok(new { data = customerOriginData });
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        [HttpGet("detailed-report")]
        public async Task<ActionResult<object>> GetDetailedReport(
            [FromQuery] string? fromDate = null,
            [FromQuery] string? toDate = null,
            [FromQuery] string reportType = "room")
        {
            try
            {
                DateOnly startDate, endDate;

                if (fromDate != null)
                {
                    startDate = DateOnly.ParseExact(fromDate, "yyyy-MM-dd");
                }
                else
                {
                    startDate = DateOnly.FromDateTime(DateTime.Now).AddDays(-30);
                }

                if (toDate != null)
                {
                    endDate = DateOnly.ParseExact(toDate, "yyyy-MM-dd");
                }
                else
                {
                    endDate = DateOnly.FromDateTime(DateTime.Now);
                }

                if (reportType == "room")
                {
                    var roomReport = await _context.Phongs
                        .Select(p => new
                        {
                            roomId = p.Idphong,
                            roomName = p.TenPhong,
                            roomNumber = p.SoPhong,
                            status = _context.DatPhongs
                                .Where(d => d.Idphong == p.Idphong && d.NgayNhanPhong <= endDate && d.NgayTraPhong >= startDate)
                                .Any() ? "booked" : "available",
                            occupancyDays = _context.DatPhongs
                                .Where(d => d.Idphong == p.Idphong && d.NgayDatPhong.HasValue && d.NgayDatPhong!.Value >= startDate && d.NgayDatPhong!.Value <= endDate)
                                .Sum(d => d.SoDem ?? 0),
                            revenue = _context.DatPhongs
                                .Where(d => d.Idphong == p.Idphong && d.NgayDatPhong.HasValue && d.NgayDatPhong!.Value >= startDate && d.NgayDatPhong!.Value <= endDate)
                                .Sum(d => d.TongTien),
                            occupancyRate = (double)_context.DatPhongs
                                .Where(d => d.Idphong == p.Idphong && d.NgayDatPhong.HasValue && d.NgayDatPhong!.Value >= startDate && d.NgayDatPhong!.Value <= endDate)
                                .Sum(d => d.SoDem ?? 0) * 100.0 / (double)((endDate.ToDateTime(TimeOnly.MinValue) - startDate.ToDateTime(TimeOnly.MinValue)).Days + 1)
                        })
                        .OrderByDescending(x => x.revenue)
                        .ToListAsync();

                    return Ok(new { data = roomReport });
                }
                else if (reportType == "revenue")
                {
                    var revenueReport = await _context.HoaDons
                        .Where(h => h.NgayLap.HasValue && h.NgayLap.Value.Date >= startDate.ToDateTime(TimeOnly.MinValue) && h.NgayLap.Value.Date <= endDate.ToDateTime(TimeOnly.MinValue))
                        .Include(h => h.IddatPhongNavigation).ThenInclude(d => d.IdphongNavigation)
                        .GroupBy(h => h.IddatPhong)
                        .Select(g => new
                        {
                            roomId = g.Key,
                            roomName = g.First().IddatPhongNavigation!.IdphongNavigation!.TenPhong,
                            roomNumber = g.First().IddatPhongNavigation.IdphongNavigation.SoPhong,
                            status = "revenue",
                            occupancyDays = g.First().IddatPhongNavigation.SoDem ?? 0,
                            revenue = g.Sum(h => h.TongTien),
                            occupancyRate = ((double)g.Sum(h => h.TongTien) * 1.0) / (double)g.First().IddatPhongNavigation.TongTien * 100
                        })
                        .OrderByDescending(x => x.revenue)
                        .ToListAsync();

                    return Ok(new { data = revenueReport });
                }
                else
                {
                    var customerReport = await _context.DatPhongs
                        .Where(d => d.NgayDatPhong.HasValue && d.NgayDatPhong.Value >= startDate && d.NgayDatPhong.Value <= endDate)
                        .Include(d => d.IdkhachHangNavigation)
                        .GroupBy(d => d.IdkhachHang)
                        .Select(g => new
                        {
                            roomId = g.Key.ToString(),
                            roomName = g.First().IdkhachHangNavigation!.HoTen,
                            roomNumber = g.First().IdkhachHangNavigation!.SoDienThoai ?? "",
                            status = "customer",
                            occupancyDays = g.Sum(d => d.SoDem ?? 0),
                            revenue = g.Sum(d => d.TongTien),
                            occupancyRate = 0.0
                        })
                        .OrderByDescending(x => x.revenue)
                        .ToListAsync();

                    return Ok(new { data = customerReport });
                }
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }
    }
}
