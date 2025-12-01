using Hotel_System.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace Hotel_System.API.Services
{
    /// <summary>
    /// Background service that marks bookings as overdue (TrangThai = 5)
    /// when the expected checkout datetime (NgayTraPhong + 12:00) has passed
    /// and the guest still hasn't checked out (TrangThai == 3).
    ///
    /// Business rule:
    /// - Phòng đang sử dụng: TrangThai == 3
    /// - Ngày trả phòng dự kiến: NgayTraPhong <= hôm nay
    /// - Thời điểm hiện tại: Now > NgayTraPhong + 12:00
    /// => Đánh dấu Quá hạn.
    ///
    /// Service chạy định kỳ (mặc định mỗi 5 phút).
    /// </summary>
    public class OverdueMonitorService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<OverdueMonitorService> _logger;

        // Run every 5 minutes
        private readonly TimeSpan _interval = TimeSpan.FromMinutes(5);

        public OverdueMonitorService(
            IServiceScopeFactory scopeFactory,
            ILogger<OverdueMonitorService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("OverdueMonitorService started");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    var now = DateTime.Now;
                    var today = DateOnly.FromDateTime(now);

                    using var scope = _scopeFactory.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<HotelSystemContext>();

                    // Tìm các booking:
                    // - Đang sử dụng (TrangThai == 3)
                    // - Ngày trả phòng dự kiến <= hôm nay
                    var candidates = await db.DatPhongs
                        .Include(d => d.IdphongNavigation)
                        .Where(d =>
                            d.TrangThai == 3 &&        // Đang sử dụng
                            d.NgayTraPhong <= today    // Ngày trả phòng dự kiến ≤ hôm nay
                        )
                        .ToListAsync(stoppingToken);

                    if (candidates.Any())
                    {
                        _logger.LogInformation(
                            "OverdueMonitorService: found {count} candidate(s) for overdue check",
                            candidates.Count);

                        var changedCount = 0;

                        foreach (var dp in candidates)
                        {
                            try
                            {
                                // Chuẩn checkout = NgayTraPhong + 12:00
                                DateTime standardCheckout;
                                try
                                {
                                    standardCheckout = dp.NgayTraPhong.ToDateTime(new TimeOnly(12, 0));
                                }
                                catch
                                {
                                    // fallback nếu ToDateTime lỗi
                                    standardCheckout = dp.NgayTraPhong.ToDateTime(TimeOnly.MinValue);
                                }

                                // Nếu đã quá 12:00 ngày trả phòng mà vẫn Đang sử dụng → Quá hạn
                                if (now > standardCheckout && dp.TrangThai == 3)
                                {
                                    dp.TrangThai = 5; // Quá hạn

                                    if (dp.IdphongNavigation != null)
                                    {
                                        dp.IdphongNavigation.TrangThai = "Quá hạn";
                                    }

                                    changedCount++;

                                    // (Tùy chọn) Lưu log chi tiết vào bảng lịch sử
                                    // var log = new LichSuDatPhong
                                    // {
                                    //     IddatPhong = dp.IddatPhong,
                                    //     NgayCapNhat = DateTime.Now,
                                    //     GhiChu = $"Tự động đánh dấu Quá hạn: phòng {dp.Idphong}, NgayTraPhong={dp.NgayTraPhong:yyyy-MM-dd}, standardCheckout=12:00."
                                    // };
                                    // db.LichSuDatPhongs.Add(log);
                                }
                            }
                            catch (Exception ex)
                            {
                                _logger.LogError(
                                    ex,
                                    "OverdueMonitorService: failed to process booking {id}",
                                    dp.IddatPhong);
                            }
                        }

                        if (changedCount > 0)
                        {
                            await db.SaveChangesAsync(stoppingToken);
                            _logger.LogInformation(
                                "OverdueMonitorService: marked {count} booking(s) as overdue",
                                changedCount);
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "OverdueMonitorService: error while running overdue monitor loop");
                }

                try
                {
                    await Task.Delay(_interval, stoppingToken);
                }
                catch (TaskCanceledException)
                {
                    // ignore when stopping
                }
            }

            _logger.LogInformation("OverdueMonitorService stopping");
        }
    }
}