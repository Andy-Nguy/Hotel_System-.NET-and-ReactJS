using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Hotel_System.API.Models;
using System.Net.Mail;
using System.Net;

namespace Hotel_System.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ReviewController : ControllerBase
    {
        private readonly HotelSystemContext _context;
        private readonly ILogger<ReviewController> _logger;
        private readonly IConfiguration _configuration;
        // Simple in-memory guard to avoid sending duplicate review reminder emails
        // keyed by booking id. Entry persists for 5 minutes to catch rapid duplicate requests
        private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, DateTime> _sentReviewEmailCache = new System.Collections.Concurrent.ConcurrentDictionary<string, DateTime>();
        private static readonly TimeSpan EmailDedupWindow = TimeSpan.FromMinutes(5);

        public ReviewController(HotelSystemContext context, ILogger<ReviewController> logger, IConfiguration configuration)
        {
            _context = context;
            _logger = logger;
            _configuration = configuration;
        }

        /// <summary>
        /// GET /api/Review/room/{idphong}/reviews - Get reviews for a room (paginated)
        /// </summary>
        [HttpGet("room/{idphong}/reviews")]
        public async Task<IActionResult> GetRoomReviews(string idphong, int page = 1, int pageSize = 5)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(idphong)) return BadRequest(new { error = "Idphong is required" });

                var query = _context.DanhGia
                    .Where(r => r.Idphong == idphong)
                    .Include(r => r.IdkhachHangNavigation)
                    .OrderByDescending(r => r.CreatedAt);

                var total = await query.CountAsync();

                var reviews = await query
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(r => new
                    {
                        id = r.IddanhGia,
                        roomId = r.Idphong,
                        bookingId = r.IddatPhong,
                        rating = r.SoSao,
                        title = r.TieuDe,
                        content = r.NoiDung,
                        isAnonym = r.IsAnonym,
                        customerName = r.IsAnonym == true ? "Ẩn danh" : (r.IdkhachHangNavigation != null ? r.IdkhachHangNavigation.HoTen : "Ẩn danh"),
                        createdAt = r.CreatedAt
                    })
                    .ToListAsync();

                return Ok(new
                {
                    total,
                    page,
                    pageSize,
                    reviews
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching room reviews");
                return StatusCode(500, new { error = "Lỗi khi lấy đánh giá cho phòng" });
            }
        }

        /// <summary>
        /// GET /api/Review/room/{idphong}/stats - Get rating statistics for a room
        /// </summary>
        [HttpGet("room/{idphong}/stats")]
        public async Task<IActionResult> GetRoomRatingStats(string idphong)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(idphong)) return BadRequest(new { error = "Idphong is required" });

                var totalReviews = await _context.DanhGia.Where(r => r.Idphong == idphong).CountAsync();
                var avgRating = totalReviews > 0
                    ? await _context.DanhGia.Where(r => r.Idphong == idphong).AverageAsync(r => r.SoSao)
                    : 0;

                var ratingDistribution = await _context.DanhGia
                    .Where(r => r.Idphong == idphong)
                    .GroupBy(r => r.SoSao)
                    .Select(g => new
                    {
                        stars = g.Key,
                        count = g.Count()
                    })
                    .ToListAsync();

                return Ok(new
                {
                    totalReviews = totalReviews,
                    averageRating = Math.Round(avgRating, 2),
                    ratingDistribution = ratingDistribution
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching room rating stats");
                return StatusCode(500, new { error = "Lỗi khi lấy thống kê đánh giá cho phòng" });
            }
        }

        /// <summary>
        /// POST /api/Review - Submit a review for a booking
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> SubmitReview([FromBody] ReviewSubmitRequest request)
        {
            try
            {
                if (request == null || string.IsNullOrEmpty(request.IddatPhong))
                {
                    return BadRequest(new { error = "IddatPhong là bắt buộc" });
                }

                if (request.Rating < 1 || request.Rating > 5)
                {
                    return BadRequest(new { error = "Rating phải nằm trong khoảng 1-5" });
                }

                // Check if booking exists
                var booking = await _context.DatPhongs.FirstOrDefaultAsync(b => b.IddatPhong == request.IddatPhong);
                if (booking == null)
                {
                    return NotFound(new { error = "Không tìm thấy phòng đặt" });
                }

                // Check if review already exists for this booking
                var existingReview = await _context.DanhGia
                    .FirstOrDefaultAsync(r => r.IddatPhong == request.IddatPhong);

                if (existingReview != null)
                {
                    return BadRequest(new { error = "Bạn đã đánh giá phòng này rồi" });
                }

                // Ensure we associate review with the correct room and customer
                if (booking.Idphong == null)
                {
                    return StatusCode(500, new { error = "Booking does not contain room information" });
                }

                if (booking.IdkhachHang == null)
                {
                    // Must have a customer associated with the booking to submit a review
                    return BadRequest(new { error = "Booking does not have an associated customer" });
                }

                // Create new review
                var review = new DanhGium
                {
                    IddatPhong = request.IddatPhong,
                    IdkhachHang = booking.IdkhachHang.Value,
                    Idphong = booking.Idphong, // use the booked room id
                    SoSao = (byte)request.Rating,
                    TieuDe = request.Title,
                    NoiDung = request.Content,
                    IsAnonym = request.IsAnonym == 1,
                    CreatedAt = DateTime.Now,
                    UpdatedAt = DateTime.Now
                };

                _context.DanhGia.Add(review);
                try
                {
                    await _context.SaveChangesAsync();
                }
                catch (DbUpdateException dbex)
                {
                    _logger.LogError(dbex, "DB error saving review for booking {BookingId}", request.IddatPhong);
                    return StatusCode(500, new { error = "Lỗi khi lưu đánh giá vào cơ sở dữ liệu", detail = dbex.Message });
                }

                return Ok(new
                {
                    message = "Đánh giá được tạo thành công",
                    id = review.IddanhGia,
                    IddatPhong = review.IddatPhong
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error submitting review");
                // Return detailed error for debugging (remove detail in production)
                return StatusCode(500, new { error = "Lỗi khi gửi đánh giá", detail = ex.Message });
            }
        }

        /// <summary>
        /// GET /api/Review/status/{IddatPhong} - Check review status for a booking
        /// </summary>
        [HttpGet("status/{IddatPhong}")]
        public async Task<IActionResult> GetReviewStatus(string IddatPhong)
        {
            try
            {
                var review = await _context.DanhGia
                    .FirstOrDefaultAsync(r => r.IddatPhong == IddatPhong);

                return Ok(new
                {
                    IddatPhong = IddatPhong,
                    hasReview = review != null,
                    reviewId = review?.IddanhGia,
                    createdAt = review?.CreatedAt
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching review status");
                return StatusCode(500, new { error = "Lỗi khi kiểm tra trạng thái đánh giá" });
            }
        }

        /// <summary>
        /// GET /api/Review/booking/{IddatPhong} - Get reviews for a booking
        /// </summary>
        [HttpGet("booking/{IddatPhong}")]
        public async Task<IActionResult> GetBookingReviews(string IddatPhong)
        {
            try
            {
                var reviews = await _context.DanhGia
                    .Where(r => r.IddatPhong == IddatPhong)
                    .Select(r => new
                    {
                        id = r.IddanhGia,
                        IddatPhong = r.IddatPhong,
                        Rating = r.SoSao,
                        Title = r.TieuDe,
                        Content = r.NoiDung,
                        IsAnonym = r.IsAnonym,
                        CreatedAt = r.CreatedAt
                    })
                    .ToListAsync();

                return Ok(reviews);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching booking reviews");
                return StatusCode(500, new { error = "Lỗi khi lấy đánh giá" });
            }
        }

        /// <summary>
        /// GET /api/Review/stats - Get rating statistics
        /// </summary>
        [HttpGet("stats")]
        public async Task<IActionResult> GetRatingStats()
        {
            try
            {
                var totalReviews = await _context.DanhGia.CountAsync();
                var avgRating = totalReviews > 0
                    ? await _context.DanhGia.AverageAsync(r => r.SoSao)
                    : 0;

                var ratingDistribution = await _context.DanhGia
                    .GroupBy(r => r.SoSao)
                    .Select(g => new
                    {
                        stars = g.Key,
                        count = g.Count()
                    })
                    .ToListAsync();

                return Ok(new
                {
                    totalReviews = totalReviews,
                    averageRating = Math.Round(avgRating, 2),
                    ratingDistribution = ratingDistribution
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching rating stats");
                return StatusCode(500, new { error = "Lỗi khi lấy thống kê đánh giá" });
            }
        }
        /// <summary>
        /// GET /api/Review/open/{IddatPhong}
        /// Trả về HTML:
        ///   - Mobile → cố mở Expo Go (exp://192.168.2.62:8081/--/review/{IddatPhong}), nếu fail thì về web.
        ///   - PC     → về thẳng web http://localhost:5173/review/{IddatPhong}.
        /// </summary>
        [HttpGet("open/{IddatPhong}")]
        public IActionResult OpenReview(string IddatPhong)
        {
            if (string.IsNullOrWhiteSpace(IddatPhong))
                return BadRequest("IddatPhong là bắt buộc");

            // URL web cho PC
            var frontendBaseUrl = _configuration["Frontend:BaseUrl"] ?? "http://localhost:5173";
            var desktopUrl = $"{frontendBaseUrl}/review/{IddatPhong}";

            // Expo Go DEV URL – PHẢI ĐÚNG VỚI Metro: "exp://192.168.2.62:8081"
            var expoBase = _configuration["Mobile:ExpoDeepLink"] ?? "exp://192.168.2.62:8081";

            // Deep link chuẩn của Expo dev: exp://ip:port/--/review/{bookingId}
            var mobileAppUrl = $"{expoBase}/--/review/{Uri.EscapeDataString(IddatPhong)}";

                            var html = $@"<!DOCTYPE html>
                <html lang=""vi"">
                <head>
                <meta charset=""utf-8"" />
                <title>Đang mở trang đánh giá...</title>
                <meta name=""viewport"" content=""width=device-width, initial-scale=1"" />
                <script>
                    window.onload = function () {{
                    var ua = navigator.userAgent.toLowerCase();
                    var isMobile = /android|iphone|ipad|ipod/.test(ua);

                    var appUrl = '{mobileAppUrl}';
                    var webUrl = '{desktopUrl}';

                    if (isMobile) {{
                        // Thử mở app Expo Go
                        window.location = appUrl;

                        // Sau 2 giây nếu không mở được → fallback sang web
                        setTimeout(function () {{
                        window.location = webUrl;
                        }}, 2000);
                    }} else {{
                        // PC → đi thẳng web
                        window.location = webUrl;
                    }}
                    }};
                </script>
                </head>
                <body>
                <p>Đang chuyển đến trang đánh giá...</p>
                </body>
                </html>";

            return new ContentResult
            {
                Content = html,
                ContentType = "text/html; charset=utf-8"
            };
        }
        /// <summary>
        /// POST /api/Review/send-email - Send review reminder email
        /// </summary>
        [HttpPost("send-email")]
        public async Task<IActionResult> SendReviewEmail([FromBody] SendReviewEmailRequest request)
        {
            try
            {
                if (string.IsNullOrEmpty(request.IddatPhong) || string.IsNullOrEmpty(request.Email))
                {
                    return BadRequest(new { error = "IddatPhong và Email là bắt buộc" });
                }

                // Get booking details
                var booking = await _context.DatPhongs
                    .Include(b => b.IdkhachHangNavigation)
                    .Include(b => b.IdphongNavigation)
                        .ThenInclude(p => p.IdloaiPhongNavigation)
                    .FirstOrDefaultAsync(b => b.IddatPhong == request.IddatPhong);

                if (booking == null)
                {
                    return NotFound(new { error = "Không tìm thấy phòng đặt" });
                }

                // Check if review already exists
                var existingReview = await _context.DanhGia
                    .FirstOrDefaultAsync(r => r.IddatPhong == request.IddatPhong);

                if (existingReview != null)
                {
                    return Ok(new { message = "Khách hàng đã đánh giá rồi" });
                }

                // Prevent duplicate reminder emails for the same booking within a short window
                if (!string.IsNullOrEmpty(request.IddatPhong))
                {
                    if (_sentReviewEmailCache.TryGetValue(request.IddatPhong, out var sentAt))
                    {
                        // if sent within last 5 minutes, skip
                        if (DateTime.UtcNow - sentAt < EmailDedupWindow)
                        {
                            _logger.LogInformation("Skipping duplicate review email for booking {BookingId} (sent {Minutes} minutes ago)", request.IddatPhong, (DateTime.UtcNow - sentAt).TotalMinutes);
                            return Ok(new { message = "Email đã được gửi trước đó" });
                        }
                        else
                        {
                            // remove old entry so new send can be recorded
                            _sentReviewEmailCache.TryRemove(request.IddatPhong, out _);
                        }
                    }
                }

                // Load email template
                string templatePath = Path.Combine(Directory.GetCurrentDirectory(), "EmailTemplates", "thankyou-review.html");
                if (!System.IO.File.Exists(templatePath))
                {
                    _logger.LogWarning($"Email template not found at {templatePath}");
                    return StatusCode(500, new { error = "Email template không tìm thấy" });
                }

                string emailBody = System.IO.File.ReadAllText(templatePath);

                // Replace placeholders
                var apiBaseUrl = _configuration["Api:PublicBaseUrl"]
                 ?? $"{Request.Scheme}://{Request.Host}";

                var reviewLink = $"{apiBaseUrl}/api/Review/open/{request.IddatPhong}";

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
                    .Replace("{{HotelPhone}}", _configuration["Hotel:Phone"] ?? "1900 xxxx")
                    .Replace("{{HotelEmail}}", _configuration["Hotel:Email"] ?? _configuration["Smtp:From"] ?? "")
                    .Replace("{{HotelName}}", _configuration["Hotel:Name"] ?? "Khách sạn");
                // Send email via SMTP
                try
                {
                    await SendEmailAsync(request.Email, "Cảm ơn bạn - Vui lòng đánh giá phòng của chúng tôi", emailBody);

                    // Only record as sent if email was successfully sent (after await completes without exception)
                    if (!string.IsNullOrEmpty(request.IddatPhong))
                    {
                        _sentReviewEmailCache[request.IddatPhong] = DateTime.UtcNow;
                        _logger.LogInformation("Review reminder email sent and recorded for booking {BookingId}", request.IddatPhong);
                    }
                }
                catch (Exception emailEx)
                {
                    _logger.LogError(emailEx, "Failed to send review reminder email for booking {BookingId}", request.IddatPhong);
                    throw; // re-throw so outer catch handles it
                }

                return Ok(new { message = "Email đã được gửi thành công" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending review email");
                return StatusCode(500, new { error = $"Lỗi khi gửi email: {ex.Message}" });
            }
        }

        /// <summary>
        /// Helper method to send email
        /// </summary>
        private async Task SendEmailAsync(string toEmail, string subject, string htmlBody)
        {
            try
            {
                var smtpHost = _configuration["Smtp:Host"];
                var smtpPort = int.Parse(_configuration["Smtp:Port"] ?? "587");
                var smtpUser = _configuration["Smtp:User"];
                var smtpPassword = _configuration["Smtp:Password"];
                var smtpFrom = _configuration["Smtp:From"];
                var displayName = _configuration["Smtp:DisplayName"] ?? "Hotel System";

                // Validate SMTP configuration
                if (string.IsNullOrWhiteSpace(smtpHost))
                {
                    throw new InvalidOperationException("SMTP host is not configured (Smtp:Host).");
                }

                // If From is not explicitly provided, fall back to the SMTP user if available
                if (string.IsNullOrWhiteSpace(smtpFrom))
                {
                    if (!string.IsNullOrWhiteSpace(smtpUser))
                    {
                        smtpFrom = smtpUser;
                    }
                    else
                    {
                        throw new InvalidOperationException("SMTP From address is not configured (Smtp:From) and no Smtp:User to fall back to.");
                    }
                }

                using (var client = new SmtpClient(smtpHost, smtpPort))
                {
                    client.EnableSsl = true;
                    client.Credentials = new NetworkCredential(smtpUser, smtpPassword);
                    client.Timeout = 10000;

                    var mailMessage = new MailMessage
                    {
                        From = new MailAddress(smtpFrom, displayName),
                        Subject = subject,
                        Body = htmlBody,
                        IsBodyHtml = true
                    };

                    mailMessage.To.Add(toEmail);

                    await client.SendMailAsync(mailMessage);
                }

                _logger.LogInformation($"Email sent successfully to {toEmail}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Failed to send email to {toEmail}");
                throw;
            }
        }
    }

    /// <summary>
    /// Request model for submitting a review
    /// </summary>
    public class ReviewSubmitRequest
    {
        public string? IddatPhong { get; set; }
        public int Rating { get; set; } // 1-5 stars
        public string? Title { get; set; }
        public string? Content { get; set; }
        public int? IsAnonym { get; set; } // 1 = anonymous, 0 or null = not anonymous
    }

    /// <summary>
    /// Request model for sending review email
    /// </summary>
    public class SendReviewEmailRequest
    {
        public string? IddatPhong { get; set; }
        public string? Email { get; set; }
    }
}
