using Microsoft.EntityFrameworkCore;
using Hotel_System.API.Models;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Configuration;
using System.Net.Mail;
using System.Net;

namespace Hotel_System.API.Services
{
    public class ReviewReminderService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<ReviewReminderService> _logger;
        private readonly IConfiguration _configuration;
        private readonly TimeSpan _checkInterval = TimeSpan.FromHours(1); // Check every hour

        // Simple in-memory guard to avoid sending duplicate review reminder emails
        private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, DateTime> _sentReviewEmailCache = new System.Collections.Concurrent.ConcurrentDictionary<string, DateTime>();
        private static readonly TimeSpan EmailDedupWindow = TimeSpan.FromMinutes(5);

        public ReviewReminderService(IServiceProvider serviceProvider, ILogger<ReviewReminderService> logger, IConfiguration configuration)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
            _configuration = configuration;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Review Reminder Service started");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await SendReviewRemindersAsync();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error in Review Reminder Service");
                }

                await Task.Delay(_checkInterval, stoppingToken);
            }
        }

        private async Task SendReviewRemindersAsync()
        {
            using var scope = _serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<HotelSystemContext>();

            // Find bookings that:
            // 1. Have check-out date in the past (completed)
            // 2. Check-out was within last 24 hours
            // 3. Customer has email
            // 4. No review exists for this booking's room (since IDDatPhong column doesn't exist yet)
            // 5. No reminder sent in last 5 minutes
            var cutoffDate = DateOnly.FromDateTime(DateTime.Now.AddHours(-24));
            var eligibleBookings = await context.DatPhongs
                .Include(b => b.IdkhachHangNavigation)
                .Where(b => b.NgayTraPhong <= DateOnly.FromDateTime(DateTime.Now) && // Check-out completed
                           b.NgayTraPhong >= cutoffDate &&   // Within last 24 hours
                           b.IdkhachHangNavigation != null &&
                           !string.IsNullOrEmpty(b.IdkhachHangNavigation.Email)) // Has email
                .ToListAsync();

            // Filter out bookings that already have reviews for their rooms
            // Note: This is a temporary workaround until IDDatPhong column is added to danhgia table
            var bookingsWithoutReviews = new List<DatPhong>();
            foreach (var booking in eligibleBookings)
            {
                // Check if customer already reviewed this room
                var existingReview = await context.DanhGia
                    .AnyAsync(r => r.IdkhachHang == booking.IdkhachHang &&
                                  r.Idphong == booking.Idphong);

                if (!existingReview)
                {
                    bookingsWithoutReviews.Add(booking);
                }
            }

            _logger.LogInformation("Found {Count} eligible bookings for review reminders", bookingsWithoutReviews.Count);

            foreach (var booking in bookingsWithoutReviews)
            {
                try
                {
                    // Check if we already sent a reminder recently
                    if (_sentReviewEmailCache.TryGetValue(booking.IddatPhong, out var sentAt))
                    {
                        if (DateTime.UtcNow - sentAt < EmailDedupWindow)
                        {
                            _logger.LogInformation("Skipping duplicate review email for booking {BookingId} (sent {Minutes} minutes ago)",
                                booking.IddatPhong, (DateTime.UtcNow - sentAt).TotalMinutes);
                            continue;
                        }
                        else
                        {
                            // Remove old entry
                            _sentReviewEmailCache.TryRemove(booking.IddatPhong, out _);
                        }
                    }

                    await SendReviewEmailAsync(booking);
                    
                    // Record as sent
                    _sentReviewEmailCache[booking.IddatPhong] = DateTime.UtcNow;
                    
                    _logger.LogInformation("Review reminder sent for booking {BookingId}", booking.IddatPhong);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to send review reminder for booking {BookingId}", booking.IddatPhong);
                }
            }
        }

        private async Task SendReviewEmailAsync(DatPhong booking)
        {
            // Load email template
            string templatePath = Path.Combine(Directory.GetCurrentDirectory(), "EmailTemplates", "thankyou-review.html");
            if (!System.IO.File.Exists(templatePath))
            {
                _logger.LogWarning("Email template not found at {TemplatePath}", templatePath);
                return;
            }

            string emailBody = System.IO.File.ReadAllText(templatePath);

            // Replace placeholders
            var reviewLink = $"{_configuration["Frontend:BaseUrl"] ?? "http://localhost:5173"}/review/{booking.IddatPhong}";
            var roomName = booking.IdphongNavigation?.IdloaiPhongNavigation?.TenLoaiPhong 
                           ?? booking.IdphongNavigation?.TenPhong 
                           ?? "Phòng";
            
            emailBody = emailBody
                .Replace("{{CustomerName}}", booking.IdkhachHangNavigation?.HoTen ?? "Khách hàng")
                .Replace("{{BookingId}}", booking.IddatPhong)
                .Replace("{{RoomName}}", roomName)
                .Replace("{{CheckInDate}}", booking.NgayNhanPhong.ToString("dd/MM/yyyy"))
                .Replace("{{CheckOutDate}}", booking.NgayTraPhong.ToString("dd/MM/yyyy"))
                .Replace("{{TotalAmount}}", booking.TongTien.ToString("N0"))
                .Replace("{{ReviewLink}}", reviewLink)
                .Replace("{{HotelAddress}}", _configuration["Hotel:Address"] ?? _configuration["Smtp:From"] ?? "Khách sạn")
                .Replace("{{HotelPhone}}", _configuration["Hotel:Phone"] ?? "(+84) 263 3888 999")
                .Replace("{{HotelEmail}}", _configuration["Hotel:Email"] ?? _configuration["Smtp:From"] ?? "")
                .Replace("{{HotelName}}", _configuration["Hotel:Name"] ?? "Khách sạn");

            // Send email
            var smtpHost = _configuration["Smtp:Host"];
            var smtpPort = int.Parse(_configuration["Smtp:Port"] ?? "587");
            var smtpUser = _configuration["Smtp:User"];
            var smtpPassword = _configuration["Smtp:Password"];
            var smtpFrom = _configuration["Smtp:From"];
            var displayName = _configuration["Smtp:DisplayName"] ?? "Hotel System";

            // Validate SMTP configuration
            if (string.IsNullOrWhiteSpace(smtpHost) || string.IsNullOrWhiteSpace(smtpFrom))
            {
                _logger.LogWarning("SMTP configuration incomplete for booking {BookingId}", booking.IddatPhong);
                return;
            }

            if (string.IsNullOrWhiteSpace(booking.IdkhachHangNavigation?.Email))
            {
                _logger.LogWarning("Customer email missing for booking {BookingId}", booking.IddatPhong);
                return;
            }

            using (var client = new SmtpClient(smtpHost, smtpPort))
            {
                client.EnableSsl = true;
                client.Credentials = new NetworkCredential(smtpUser, smtpPassword);
                client.Timeout = 10000;

                var mailMessage = new MailMessage
                {
                    From = new MailAddress(smtpFrom, displayName),
                    Subject = "Cảm ơn bạn - Vui lòng đánh giá phòng của chúng tôi",
                    Body = emailBody,
                    IsBodyHtml = true
                };

                mailMessage.To.Add(booking.IdkhachHangNavigation.Email);

                await client.SendMailAsync(mailMessage);
            }

            _logger.LogInformation("Review reminder email sent to {Email} for booking {BookingId}", 
                booking.IdkhachHangNavigation.Email, booking.IddatPhong);
        }
    }
}