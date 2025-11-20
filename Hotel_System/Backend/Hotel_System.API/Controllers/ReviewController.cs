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

        public ReviewController(HotelSystemContext context, ILogger<ReviewController> logger, IConfiguration configuration)
        {
            _context = context;
            _logger = logger;
            _configuration = configuration;
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

                // Create new review
                var review = new DanhGium
                {
                    IddatPhong = request.IddatPhong,
                    IdkhachHang = booking.IdkhachHang ?? 0,
                    Idphong = booking.Idphong, // use the booked room id
                    SoSao = (byte)request.Rating,
                    TieuDe = request.Title,
                    NoiDung = request.Content,
                    IsAnonym = request.IsAnonym == 1,
                    CreatedAt = DateTime.Now,
                    UpdatedAt = DateTime.Now
                };

                _context.DanhGia.Add(review);
                await _context.SaveChangesAsync();

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

                // Load email template
                string templatePath = Path.Combine(Directory.GetCurrentDirectory(), "EmailTemplates", "thankyou-review.html");
                if (!System.IO.File.Exists(templatePath))
                {
                    _logger.LogWarning($"Email template not found at {templatePath}");
                    return StatusCode(500, new { error = "Email template không tìm thấy" });
                }

                string emailBody = System.IO.File.ReadAllText(templatePath);

                // Replace placeholders
                var reviewLink = $"{_configuration["Frontend:BaseUrl"] ?? "http://localhost:5173"}/review/{request.IddatPhong}";
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
                await SendEmailAsync(request.Email, "Cảm ơn bạn - Vui lòng đánh giá phòng của chúng tôi", emailBody);

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
