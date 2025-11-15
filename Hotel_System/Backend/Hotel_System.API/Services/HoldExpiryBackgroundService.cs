using Microsoft.Extensions.Hosting;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Hotel_System.API.Models;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore;

namespace Hotel_System.API.Services
{
    public class HoldExpiryBackgroundService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<HoldExpiryBackgroundService> _logger;
        // Shorten check interval during testing so expiries are processed quickly
        private readonly TimeSpan _checkInterval = TimeSpan.FromSeconds(10);

        public HoldExpiryBackgroundService(IServiceScopeFactory scopeFactory, ILogger<HoldExpiryBackgroundService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("HoldExpiryBackgroundService started");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    using var scope = _scopeFactory.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<HotelSystemContext>();

                    var now = DateTime.UtcNow;
                    var expiredHolds = await db.DatPhongs
                        .Where(dp => dp.ThoiHan != null && dp.ThoiHan <= now)
                        .ToListAsync(stoppingToken);

                    if (expiredHolds.Any())
                    {
                        foreach (var dp in expiredHolds)
                        {
                            // Clear ThoiHan and mark booking as available (TrangThai = 1)
                            dp.ThoiHan = null;
                            dp.TrangThai = 1; // 1 = available/confirmed (per project mapping)
                        }

                        await db.SaveChangesAsync(stoppingToken);
                        _logger.LogInformation("Cleared {count} expired holds", expiredHolds.Count);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error while expiring holds");
                }

                await Task.Delay(_checkInterval, stoppingToken);
            }

            _logger.LogInformation("HoldExpiryBackgroundService stopping");
        }
    }
}
