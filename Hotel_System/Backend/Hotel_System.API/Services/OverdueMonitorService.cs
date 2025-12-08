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
    /// when the expected checkout datetime (NgayTraPhong + 12:00 or extended hour) has passed
    /// and the guest still hasn't checked out (TrangThai == 3).
    ///
    /// Business rule:
    /// - Phòng đang sử dụng: TrangThai == 3
    /// - Ngày trả phòng dự kiến: NgayTraPhong <= hôm nay
    /// - Thời điểm hiện tại: Now > NgayTraPhong + Giờ checkout hiệu lực
    ///   (12:00 nếu không gia hạn, hoặc "Gia hạn đến HH:mm" nếu có)
    /// => Đánh dấu Quá hạn + Cộng phí trả phòng muộn vào TongTien (KHÔNG lưu CTHDDV, phí phạt không VAT).
    ///
    /// Service chạy định kỳ (mặc định mỗi 5 phút).
    /// </summary>
    public class OverdueMonitorService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<OverdueMonitorService> _logger;

        // Run every 10 seconds (short interval for prompt overdue detection)
        private readonly TimeSpan _interval = TimeSpan.FromSeconds(10);

        public OverdueMonitorService(
            IServiceScopeFactory scopeFactory,
            ILogger<OverdueMonitorService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        private async Task NormalizeExistingOverdues(HotelSystemContext db, CancellationToken stoppingToken)
        {
            try
            {
                var overdueBookings = await db.DatPhongs
                    .Include(d => d.HoaDons)
                    .Where(d => d.TrangThai == 5)
                    .ToListAsync(stoppingToken);

                if (!overdueBookings.Any()) return;

                _logger.LogInformation("OverdueMonitorService: normalizing {count} existing overdue booking(s)", overdueBookings.Count);

                foreach (var dp in overdueBookings)
                {
                    try
                    {
                        if (dp.HoaDons != null)
                        {
                            // For overdue bookings, force all invoices and booking-level status to 1 (Chưa thanh toán)
                            foreach (var h in dp.HoaDons)
                            {
                                try
                                {
                                    h.TrangThaiThanhToan = 1;
                                }
                                catch { }
                            }

                            dp.TrangThaiThanhToan = 1;
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "OverdueMonitorService: failed to normalize booking {id}", dp.IddatPhong);
                    }
                }

                await db.SaveChangesAsync(stoppingToken);
                _logger.LogInformation("OverdueMonitorService: normalization complete");
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "OverdueMonitorService: normalization error");
            }
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("OverdueMonitorService started");
            // On startup, ensure any existing bookings already marked as overdue
            // have their invoice and booking payment statuses normalized.
            try
            {
                using var startScope = _scopeFactory.CreateScope();
                var startDb = startScope.ServiceProvider.GetRequiredService<HotelSystemContext>();
                await NormalizeExistingOverdues(startDb, stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "OverdueMonitorService: failed to normalize existing overdues on startup");
            }

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
                        .Include(d => d.ChiTietDatPhongs)
                        .Include(d => d.HoaDons)
                            .ThenInclude(h => h.Cthddvs)
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
                                // Checkout chuẩn = NgayTraPhong + giờ hiệu lực (12:00 hoặc "Gia hạn đến HH:mm")
                                DateTime standardCheckout;
                                try
                                {
                                    var effTime = GetEffectiveCheckoutTime(dp);
                                    standardCheckout = dp.NgayTraPhong.ToDateTime(effTime);
                                }
                                catch
                                {
                                    // fallback nếu ToDateTime lỗi
                                    standardCheckout = dp.NgayTraPhong.ToDateTime(TimeOnly.MinValue);
                                }

                                // Nếu đã quá giờ checkout hiệu lực mà vẫn Đang sử dụng → Quá hạn
                                if (now > standardCheckout && dp.TrangThai == 3)
                                {
                                    dp.TrangThai = 5; // Quá hạn

                                    if (dp.IdphongNavigation != null)
                                    {
                                        dp.IdphongNavigation.TrangThai = "Quá hạn";
                                    }

                                    // ========== CỘNG PHÍ TRẢ PHÒNG MUỘN VÀO TONGTIEN (KHÔNG LƯU CTHDDV) ==========
                                    await AddLateFeeToTotal(db, dp, now, standardCheckout, stoppingToken);

                                    changedCount++;
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
                                "OverdueMonitorService: marked {count} booking(s) as overdue and added late fees",
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

        /// <summary>
        /// Lấy giờ checkout hiệu lực cho booking:
        /// - Nếu hóa đơn mới nhất có "Gia hạn đến HH:mm" thì dùng HH:mm
        /// - Ngược lại dùng 12:00
        /// </summary>
        private TimeOnly GetEffectiveCheckoutTime(DatPhong booking)
        {
            var defaultTime = new TimeOnly(12, 0);

            try
            {
                if (booking.HoaDons == null || !booking.HoaDons.Any())
                    return defaultTime;

                var latest = booking.HoaDons
                    .OrderByDescending(h => h.NgayLap)
                    .FirstOrDefault();

                if (latest == null || string.IsNullOrWhiteSpace(latest.GhiChu))
                    return defaultTime;

                var match = System.Text.RegularExpressions.Regex.Match(
                    latest.GhiChu,
                    @"Gia hạn đến\s+(\d{1,2}):(\d{2})",
                    System.Text.RegularExpressions.RegexOptions.IgnoreCase);

                if (!match.Success)
                    return defaultTime;

                if (int.TryParse(match.Groups[1].Value, out var hour) &&
                    int.TryParse(match.Groups[2].Value, out var minute))
                {
                    return new TimeOnly(hour, minute);
                }
            }
            catch
            {
                // ignore
            }

            return defaultTime;
        }

        /// <summary>
        /// Cộng phí trả phòng muộn vào TongTien khi booking chuyển sang trạng thái Quá hạn
        /// Phí phạt KHÔNG tính VAT và KHÔNG lưu vào CTHDDV
        /// </summary>
        private async Task AddLateFeeToTotal(HotelSystemContext db, DatPhong dp, DateTime now, DateTime standardCheckout, CancellationToken stoppingToken)
        {
            try
            {
                // Tìm hóa đơn mới nhất của booking
                var latestInvoice = dp.HoaDons?
                    .OrderByDescending(h => h.NgayLap)
                    .FirstOrDefault();

                if (latestInvoice == null)
                {
                    _logger.LogWarning("OverdueMonitorService: No invoice found for booking {id}, skipping late fee", dp.IddatPhong);
                    return;
                }

                // Kiểm tra xem đã có ghi chú phí trả muộn chưa (tránh tính trùng)
                bool hasLateNote = !string.IsNullOrEmpty(latestInvoice.GhiChu) &&
                    latestInvoice.GhiChu.IndexOf("Phí trả phòng muộn", StringComparison.OrdinalIgnoreCase) >= 0;

                if (hasLateNote)
                {
                    _logger.LogInformation("OverdueMonitorService: Late fee already added for booking {id}", dp.IddatPhong);
                    return;
                }

                // Tính phí trả muộn
                var roomLines = dp.ChiTietDatPhongs;
                decimal baseRoomTotal = roomLines?.Sum(ct => ct.ThanhTien) ?? 0m;
                int nights = dp.SoDem ?? 1;
                
                decimal oneNightPrice = nights > 0
                    ? Math.Round(baseRoomTotal / nights, 0, MidpointRounding.AwayFromZero)
                    : Math.Round(baseRoomTotal, 0, MidpointRounding.AwayFromZero);

                var diff = now - standardCheckout;
                decimal surchargePercent = 0m;
                
                if (diff <= TimeSpan.FromHours(3)) 
                    surchargePercent = 0.30m;
                else if (diff <= TimeSpan.FromHours(6)) 
                    surchargePercent = 0.50m;
                else 
                    surchargePercent = 1.00m;

                decimal lateFeeAmount = surchargePercent >= 1.0m
                    ? oneNightPrice
                    : Math.Round(oneNightPrice * surchargePercent, 0, MidpointRounding.AwayFromZero);

                if (lateFeeAmount <= 0)
                {
                    _logger.LogInformation("OverdueMonitorService: Late fee is 0 for booking {id}", dp.IddatPhong);
                    return;
                }

                // Cập nhật TongTien của hóa đơn và booking
                // TongTien = (TienPhong + TongDichVu) * 1.1 + PhiMuon (phí phạt KHÔNG tính VAT)
                decimal roomVal = Convert.ToDecimal(latestInvoice.TienPhong ?? 0);
                
                // Loại trừ DV_LATE_FEE cũ nếu có (từ dữ liệu cũ)
                decimal serviceVal = latestInvoice.Cthddvs?
                    .Where(c => c.TrangThai == "Hoạt động" && c.IddichVu != "DV_LATE_FEE")
                    .Sum(c => c.TienDichVu ?? 0m) ?? 0m;

                decimal subTotal = roomVal + serviceVal;
                decimal vat = Math.Round(subTotal * 0.1m, 0, MidpointRounding.AwayFromZero);
                decimal grandTotal = subTotal + vat + lateFeeAmount;

                latestInvoice.TongTien = grandTotal;
                dp.TongTien = grandTotal;

                // For overdue booking, force all invoices and booking-level payment status to 1 (Chưa thanh toán)
                if (dp.HoaDons != null)
                {
                    foreach (var h in dp.HoaDons)
                    {
                        try
                        {
                            h.TrangThaiThanhToan = 1;
                        }
                        catch { /* ignore per-invoice errors */ }
                    }

                    dp.TrangThaiThanhToan = 1;
                }
                else
                {
                    // Fallback: mark latest and booking as unpaid
                    latestInvoice.TrangThaiThanhToan = 1;
                    dp.TrangThaiThanhToan = 1;
                }

                // Thêm ghi chú
                latestInvoice.GhiChu = (latestInvoice.GhiChu ?? string.Empty)
                    + $"\nPhí trả phòng muộn (không VAT, {surchargePercent * 100}%): {lateFeeAmount:N0}đ - Thêm lúc {now:yyyy-MM-dd HH:mm:ss}";

                _logger.LogInformation(
                    "OverdueMonitorService: Added late fee {Amount}đ ({Percent}%) to booking {Id}, new total: {Total}đ (room+svc)*1.1 + lateFee",
                    lateFeeAmount, surchargePercent * 100, dp.IddatPhong, grandTotal);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "OverdueMonitorService: Failed to add late fee for booking {id}", dp.IddatPhong);
            }
        }
    }
}