using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Hotel_System.API.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using System.Data.Common;

namespace Hotel_System.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    // [Microsoft.AspNetCore.Authorization.Authorize(Roles = "nhanvien")]
    public class DashboardController : ControllerBase
    {
        private readonly HotelSystemContext _context;

        public DashboardController(HotelSystemContext context)
        {
            _context = context;
        }

        [HttpGet("chi-so-kpi")]
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

        [HttpGet("bieu-do-doanh-thu")]
        public async Task<ActionResult<object>> GetRevenueChart([FromQuery] int days = 30)
        {
            try
            {
                var endDate = DateTime.Now.Date;
                var startDate = endDate.AddDays(-days + 1);

                // Fetch raw data grouped by date (server-side)
                var rawData = await _context.HoaDons
                    .Where(h => h.NgayLap.HasValue && h.NgayLap.Value.Date >= startDate && h.NgayLap.Value.Date <= endDate)
                    .GroupBy(h => h.NgayLap.Value.Date)
                    .Select(g => new
                    {
                        Date = g.Key,
                        Revenue = g.Sum(h => h.TongTien),
                        RoomRevenue = g.Sum(h => h.TienPhong ?? 0),
                        ServiceRevenue = g.Sum(h => h.TongTien - (h.TienPhong ?? 0))
                    })
                    .ToListAsync();

                // Format date in memory (client-side evaluation)
                var revenueData = rawData.Select(x => new
                {
                    date = x.Date.ToString("yyyy-MM-dd"),
                    revenue = x.Revenue,
                    roomRevenue = x.RoomRevenue,
                    serviceRevenue = x.ServiceRevenue
                }).ToList();

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

        [HttpGet("ty-le-lap-phong")]
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

        [HttpGet("phong-top")]
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

        [HttpGet("dich-vu-top")]
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

        [HttpGet("nguon-khach-hang")]
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

        [HttpGet("bao-cao/chi-tiet")]
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
        
            // --- Batch report endpoints using materialized view `mv_thongke` ---
            [HttpGet("bao-cao/thong-ke/ngay")]
            public async Task<ActionResult<object>> GetMvDailyReport([FromQuery] int days = 30)
            {
                try
                {
                    var endDate = DateTime.Now.Date;
                    var startDate = endDate.AddDays(-days + 1);

                    var conn = _context.Database.GetDbConnection();
                    await conn.OpenAsync();
                    using var cmd = conn.CreateCommand();
                    cmd.CommandText = @"SELECT ngay::date AS date, SUM(COALESCE(doanhthuthucnhan,0)) AS revenue
                                         FROM mv_thongke
                                         WHERE ngay >= @start AND ngay <= @end
                                         GROUP BY date
                                         ORDER BY date";
                    var p1 = cmd.CreateParameter(); p1.ParameterName = "@start"; p1.Value = startDate; cmd.Parameters.Add(p1);
                    var p2 = cmd.CreateParameter(); p2.ParameterName = "@end"; p2.Value = endDate; cmd.Parameters.Add(p2);

                    var map = new Dictionary<string, decimal>();
                    using (var reader = await cmd.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            var d = reader.GetDateTime(0).ToString("yyyy-MM-dd");
                            var rev = reader.IsDBNull(1) ? 0m : reader.GetDecimal(1);
                            map[d] = rev;
                        }
                    }

                    var allDates = Enumerable.Range(0, days).Select(i => startDate.AddDays(i).ToString("yyyy-MM-dd")).ToList();
                    var completed = allDates.Select(d => new { date = d, revenue = map.ContainsKey(d) ? map[d] : 0m }).ToList();

                    return Ok(new { data = completed });
                }
                catch (Exception ex)
                {
                    return BadRequest(new { error = ex.Message });
                }
            }

            [HttpGet("bao-cao/thong-ke/thang")]
            public async Task<ActionResult<object>> GetMvMonthlyReport([FromQuery] int months = 12)
            {
                try
                {
                    var end = DateTime.Now.Date;
                    var start = new DateTime(end.Year, end.Month, 1).AddMonths(-months + 1);

                    var conn = _context.Database.GetDbConnection();
                    await conn.OpenAsync();
                    using var cmd = conn.CreateCommand();
                    cmd.CommandText = @"SELECT date_trunc('month', ngay)::date AS month, SUM(COALESCE(doanhthuthucnhan,0)) AS revenue
                                         FROM mv_thongke
                                         WHERE ngay >= @start AND ngay <= @end
                                         GROUP BY month
                                         ORDER BY month";
                    var p1 = cmd.CreateParameter(); p1.ParameterName = "@start"; p1.Value = start; cmd.Parameters.Add(p1);
                    var p2 = cmd.CreateParameter(); p2.ParameterName = "@end"; p2.Value = end; cmd.Parameters.Add(p2);

                    var result = new List<object>();
                    using (var reader = await cmd.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            var month = reader.GetDateTime(0).ToString("yyyy-MM");
                            var rev = reader.IsDBNull(1) ? 0m : reader.GetDecimal(1);
                            result.Add(new { month, revenue = rev });
                        }
                    }

                    return Ok(new { data = result });
                }
                catch (Exception ex)
                {
                    return BadRequest(new { error = ex.Message });
                }
            }

            [HttpGet("bao-cao/thong-ke/gia-trung-binh")]
            public async Task<ActionResult<object>> GetMvAdr([FromQuery] int days = 30)
            {
                try
                {
                    var endDate = DateTime.Now.Date;
                    var startDate = endDate.AddDays(-days + 1);

                    var conn = _context.Database.GetDbConnection();
                    await conn.OpenAsync();
                    using var cmd = conn.CreateCommand();
                    cmd.CommandText = @"SELECT ngay::date AS date,
                                               SUM(COALESCE(tienphong,0)) AS tienphong_sum,
                                               SUM(COALESCE(soDemDaDat,0)) AS so_dem_sum
                                         FROM mv_thongke
                                         WHERE ngay >= @start AND ngay <= @end
                                         GROUP BY date
                                         ORDER BY date";
                    var p1 = cmd.CreateParameter(); p1.ParameterName = "@start"; p1.Value = startDate; cmd.Parameters.Add(p1);
                    var p2 = cmd.CreateParameter(); p2.ParameterName = "@end"; p2.Value = endDate; cmd.Parameters.Add(p2);

                    var list = new List<object>();
                    using (var reader = await cmd.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            var d = reader.GetDateTime(0).ToString("yyyy-MM-dd");
                            var tienphong = reader.IsDBNull(1) ? 0m : reader.GetDecimal(1);
                            var soDem = reader.IsDBNull(2) ? 0m : reader.GetDecimal(2);
                            var adr = soDem > 0 ? Math.Round(tienphong / soDem, 0) : 0m;
                            list.Add(new { date = d, giaTrungBinh = adr });
                        }
                    }

                    return Ok(new { data = list });
                }
                catch (Exception ex)
                {
                    return BadRequest(new { error = ex.Message });
                }
            }

            // --- Snapshot (persistent table) endpoints reading from ThongKeDoanhThuKhachSan ---
            [HttpGet("bao-cao/ngay")]
            public async Task<ActionResult<object>> GetSnapshotDailyReport([FromQuery] int days = 30)
            {
                try
                {
                    var endDate = DateTime.Now.Date;
                    var startDate = endDate.AddDays(-days + 1);

                    var conn = _context.Database.GetDbConnection();
                    await conn.OpenAsync();
                    using var cmd = conn.CreateCommand();
                    cmd.CommandText = @"SELECT ngay::date AS date, SUM(COALESCE(doanhthuthucnhan,0)) AS revenue
                                         FROM ThongKeDoanhThuKhachSan
                                         WHERE ngay >= @start AND ngay <= @end
                                         GROUP BY date
                                         ORDER BY date";
                    var p1 = cmd.CreateParameter(); p1.ParameterName = "@start"; p1.Value = startDate; cmd.Parameters.Add(p1);
                    var p2 = cmd.CreateParameter(); p2.ParameterName = "@end"; p2.Value = endDate; cmd.Parameters.Add(p2);

                    var map = new Dictionary<string, decimal>();
                    using (var reader = await cmd.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            var d = reader.GetDateTime(0).ToString("yyyy-MM-dd");
                            var rev = reader.IsDBNull(1) ? 0m : reader.GetDecimal(1);
                            map[d] = rev;
                        }
                    }

                    var allDates = Enumerable.Range(0, days).Select(i => startDate.AddDays(i).ToString("yyyy-MM-dd")).ToList();
                    var completed = allDates.Select(d => new { date = d, revenue = map.ContainsKey(d) ? map[d] : 0m }).ToList();

                    return Ok(new { data = completed });
                }
                catch (Exception ex)
                {
                    return BadRequest(new { error = ex.Message });
                }
            }

            [HttpGet("bao-cao/thang")]
            public async Task<ActionResult<object>> GetSnapshotMonthlyReport([FromQuery] int months = 12)
            {
                try
                {
                    var end = DateTime.Now.Date;
                    var start = new DateTime(end.Year, end.Month, 1).AddMonths(-months + 1);

                    var conn = _context.Database.GetDbConnection();
                    await conn.OpenAsync();
                    using var cmd = conn.CreateCommand();
                    cmd.CommandText = @"SELECT date_trunc('month', ngay)::date AS month, SUM(COALESCE(doanhthuthucnhan,0)) AS revenue
                                         FROM ThongKeDoanhThuKhachSan
                                         WHERE ngay >= @start AND ngay <= @end
                                         GROUP BY month
                                         ORDER BY month";
                    var p1 = cmd.CreateParameter(); p1.ParameterName = "@start"; p1.Value = start; cmd.Parameters.Add(p1);
                    var p2 = cmd.CreateParameter(); p2.ParameterName = "@end"; p2.Value = end; cmd.Parameters.Add(p2);

                    var result = new List<object>();
                    using (var reader = await cmd.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            var month = reader.GetDateTime(0).ToString("yyyy-MM");
                            var rev = reader.IsDBNull(1) ? 0m : reader.GetDecimal(1);
                            result.Add(new { month, revenue = rev });
                        }
                    }

                    return Ok(new { data = result });
                }
                catch (Exception ex)
                {
                    return BadRequest(new { error = ex.Message });
                }
            }

            [HttpGet("bao-cao/gia-trung-binh")]
            public async Task<ActionResult<object>> GetSnapshotAdr([FromQuery] int days = 30)
            {
                try
                {
                    var endDate = DateTime.Now.Date;
                    var startDate = endDate.AddDays(-days + 1);

                    var conn = _context.Database.GetDbConnection();
                    await conn.OpenAsync();
                    using var cmd = conn.CreateCommand();
                    cmd.CommandText = @"SELECT ngay::date AS date,
                                               SUM(COALESCE(tienphong,0)) AS tienphong_sum,
                                               SUM(COALESCE(soDemDaDat,0)) AS so_dem_sum
                                         FROM ThongKeDoanhThuKhachSan
                                         WHERE ngay >= @start AND ngay <= @end
                                         GROUP BY date
                                         ORDER BY date";
                    var p1 = cmd.CreateParameter(); p1.ParameterName = "@start"; p1.Value = startDate; cmd.Parameters.Add(p1);
                    var p2 = cmd.CreateParameter(); p2.ParameterName = "@end"; p2.Value = endDate; cmd.Parameters.Add(p2);

                    var list = new List<object>();
                    using (var reader = await cmd.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            var d = reader.GetDateTime(0).ToString("yyyy-MM-dd");
                            var tienphong = reader.IsDBNull(1) ? 0m : reader.GetDecimal(1);
                            var soDem = reader.IsDBNull(2) ? 0m : reader.GetDecimal(2);
                            var adr = soDem > 0 ? Math.Round(tienphong / soDem, 0) : 0m;
                            list.Add(new { date = d, giaTrungBinh = adr });
                        }
                    }

                    return Ok(new { data = list });
                }
                catch (Exception ex)
                {
                    return BadRequest(new { error = ex.Message });
                }
            }

            [HttpPost("bao-cao/dong-bo")]
            public async Task<ActionResult<object>> SyncThongKeFromMv()
            {
                try
                {
                    var conn = _context.Database.GetDbConnection();
                    await conn.OpenAsync();
                    using var cmd = conn.CreateCommand();
                    cmd.CommandText = "SELECT sync_thongke_from_mv();";
                    var res = await cmd.ExecuteScalarAsync();
                    return Ok(new { ok = true, message = "sync_thongke_from_mv executed" });
                }
                catch (Exception ex)
                {
                    return BadRequest(new { error = ex.Message });
                }
            }

            [HttpGet("bao-cao/details")]
            public async Task<ActionResult<object>> GetSnapshotDetails([FromQuery] string? from = null, [FromQuery] string? to = null)
            {
                try
                {
                    DateTime startDate = DateTime.MinValue;
                    DateTime endDate = DateTime.MaxValue;
                    if (!string.IsNullOrEmpty(from)) startDate = DateTime.Parse(from);
                    if (!string.IsNullOrEmpty(to)) endDate = DateTime.Parse(to);

                    var conn = _context.Database.GetDbConnection();
                    await conn.OpenAsync();
                    using var cmd = conn.CreateCommand();
                    cmd.CommandText = @"SELECT ID, IDHoaDon, IDDatPhong, Ngay, TongPhong, SoDemDaDat, TienPhong, TienDichVu, TienGiamGia, DoanhThuThucNhan
                                         FROM ThongKeDoanhThuKhachSan
                                         WHERE Ngay >= @start AND Ngay <= @end
                                         ORDER BY Ngay DESC";
                    var p1 = cmd.CreateParameter(); p1.ParameterName = "@start"; p1.Value = startDate; cmd.Parameters.Add(p1);
                    var p2 = cmd.CreateParameter(); p2.ParameterName = "@end"; p2.Value = endDate; cmd.Parameters.Add(p2);

                    var list = new List<object>();
                    using (var reader = await cmd.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            list.Add(new {
                                id = reader.IsDBNull(0) ? 0 : reader.GetInt32(0),
                                idHoaDon = reader.IsDBNull(1) ? null : reader.GetString(1),
                                idDatPhong = reader.IsDBNull(2) ? null : reader.GetString(2),
                                ngay = reader.IsDBNull(3) ? (DateTime?)null : reader.GetDateTime(3),
                                tongPhong = reader.IsDBNull(4) ? 0 : reader.GetInt32(4),
                                soDem = reader.IsDBNull(5) ? 0 : reader.GetInt32(5),
                                tienPhong = reader.IsDBNull(6) ? 0m : reader.GetDecimal(6),
                                tienDichVu = reader.IsDBNull(7) ? 0m : reader.GetDecimal(7),
                                tienGiamGia = reader.IsDBNull(8) ? 0m : reader.GetDecimal(8),
                                doanhThu = reader.IsDBNull(9) ? 0m : reader.GetDecimal(9)
                            });
                        }
                    }

                    return Ok(new { data = list });
                }
                catch (Exception ex)
                {
                    return BadRequest(new { error = ex.Message });
                }
            }
    }
}
