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
                        bookingId = (string?)null,
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
        /// GET /api/Review/stats - Get global rating statistics (all rooms)
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
                _logger.LogError(ex, "Error fetching global rating stats");
                return StatusCode(500, new { error = "Lỗi khi lấy thống kê đánh giá" });
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
                // Since the DB schema may not have an IDDatPhong column, detect
                // an existing review by the same customer for the same room
                var existingReview = await _context.DanhGia
                    .FirstOrDefaultAsync(r => r.IdkhachHang == booking.IdkhachHang && r.Idphong == booking.Idphong);

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
                    IsApproved = false, // Default to pending approval
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

                // Send urgent notification for low ratings (<= 3 stars)
                if (request.Rating <= 3)
                {
                    await SendUrgentReviewNotificationAsync(review, booking);
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
                // Find booking, then check for a review by the same customer for that room
                var booking = await _context.DatPhongs.FirstOrDefaultAsync(b => b.IddatPhong == IddatPhong);
                if (booking == null)
                {
                    return NotFound(new { error = "Không tìm thấy phòng đặt" });
                }

                var review = await _context.DanhGia
                    .FirstOrDefaultAsync(r => r.IdkhachHang == booking.IdkhachHang && r.Idphong == booking.Idphong);

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
                // Find booking then return reviews by that booking's customer for the same room
                var booking = await _context.DatPhongs.FirstOrDefaultAsync(b => b.IddatPhong == IddatPhong);
                if (booking == null)
                {
                    return NotFound(new { error = "Không tìm thấy phòng đặt" });
                }

                var reviews = await _context.DanhGia
                    .Where(r => r.IdkhachHang == booking.IdkhachHang && r.Idphong == booking.Idphong)
                    .Select(r => new
                    {
                        id = r.IddanhGia,
                        IddatPhong = IddatPhong,
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
        /// GET /api/Review - Get all reviews for admin management (paginated)
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetAllReviews(int page = 1, int pageSize = 20, string? status = null, string? keyword = null)
        {
            try
            {
                var query = _context.DanhGia
                    .Include(r => r.IdkhachHangNavigation)
                    .Include(r => r.IdphongNavigation)
                        .ThenInclude(p => p.IdloaiPhongNavigation)
                    .AsQueryable();

                // Filter by approval status if specified
                if (!string.IsNullOrEmpty(status))
                {
                    if (status.ToLower() == "pending")
                    {
                        query = query.Where(r => !r.IsApproved);
                    }
                    else if (status.ToLower() == "approved")
                    {
                        query = query.Where(r => r.IsApproved);
                    }
                }

                // Search by customer name or title
                if (!string.IsNullOrEmpty(keyword))
                {
                    query = query.Where(r =>
                        (r.IdkhachHangNavigation != null && r.IdkhachHangNavigation.HoTen.Contains(keyword)) ||
                        r.TieuDe.Contains(keyword));
                }

                var total = await query.CountAsync();

                var reviews = await query
                    .OrderByDescending(r => r.CreatedAt)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(r => new
                    {
                        id = r.IddanhGia,
                        bookingId = r.IddatPhong,
                        roomId = r.Idphong,
                        roomName = r.IdphongNavigation != null ? r.IdphongNavigation.TenPhong : null,
                        roomType = r.IdphongNavigation != null && r.IdphongNavigation.IdloaiPhongNavigation != null 
                            ? r.IdphongNavigation.IdloaiPhongNavigation.TenLoaiPhong : null,
                        customerId = r.IdkhachHang,
                        customerName = r.IsAnonym == true ? "Ẩn danh" : (r.IdkhachHangNavigation != null ? r.IdkhachHangNavigation.HoTen : "Ẩn danh"),
                        rating = r.SoSao,
                        title = r.TieuDe,
                        content = r.NoiDung,
                        isAnonym = r.IsAnonym,
                        isApproved = r.IsApproved,
                        isResponded = r.IsResponded,
                        createdAt = r.CreatedAt,
                        updatedAt = r.UpdatedAt
                    })
                    .ToListAsync();
                
                _logger.LogInformation("GetAllReviews returning {Count} reviews. First review IsApproved: {IsApproved}", 
                    reviews.Count, reviews.Count > 0 ? reviews[0].isApproved : null);

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
                _logger.LogError(ex, "Error fetching all reviews: {Message}", ex.Message);
                return StatusCode(500, new { 
                    error = "Lỗi khi lấy danh sách đánh giá", 
                    detail = ex.Message,
                    innerError = ex.InnerException?.Message 
                });
            }
        }

        /// <summary>
        /// PUT /api/Review/{id}/approve - Approve a review
        /// </summary>
        [HttpPut("{id}/approve")]
        public async Task<IActionResult> ApproveReview(int id)
        {
            try
            {
                var review = await _context.DanhGia.FindAsync(id);
                if (review == null)
                {
                    return NotFound(new { error = "Không tìm thấy đánh giá" });
                }

                if (review.IsApproved)
                {
                    return BadRequest(new { error = "Đánh giá đã được duyệt rồi" });
                }

                review.IsApproved = true;
                review.UpdatedAt = DateTime.Now;

                _logger.LogInformation("Review {ReviewId} before save - IsApproved: {IsApproved}", id, review.IsApproved);
                
                await _context.SaveChangesAsync();

                _logger.LogInformation("Review {ReviewId} approved by admin - IsApproved: {IsApproved}", id, review.IsApproved);

                // TODO: Send notification to customer about approval
                // TODO: If rating <= 3, send urgent notification to CSM

                return Ok(new
                {
                    message = "Đánh giá đã được duyệt thành công",
                    reviewId = id,
                    isApproved = true
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error approving review {ReviewId}", id);
                return StatusCode(500, new { error = "Lỗi khi duyệt đánh giá" });
            }
        }

        /// <summary>
        /// DELETE /api/Review/{id} - Delete a review
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteReview(int id)
        {
            try
            {
                var review = await _context.DanhGia.FindAsync(id);
                if (review == null)
                {
                    return NotFound(new { error = "Không tìm thấy đánh giá" });
                }

                _context.DanhGia.Remove(review);
                await _context.SaveChangesAsync();

                _logger.LogInformation("Review {ReviewId} deleted by admin", id);

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting review {ReviewId}", id);
                return StatusCode(500, new { error = "Lỗi khi xóa đánh giá" });
            }
        }

        /// <summary>
        /// POST /api/Review/{id}/respond - Send apology/response email to customer
        /// </summary>
        [HttpPost("{id}/respond")]
        public async Task<IActionResult> RespondToReview(int id, [FromBody] ReviewResponseRequest request)
        {
            try
            {
                // Get review with customer and booking info
                var review = await _context.DanhGia
                    .Include(r => r.IdkhachHangNavigation)
                    .Include(r => r.IdphongNavigation)
                        .ThenInclude(p => p.IdloaiPhongNavigation)
                    .FirstOrDefaultAsync(r => r.IddanhGia == id);

                if (review == null)
                {
                    return NotFound(new { error = "Không tìm thấy đánh giá" });
                }

                // Check if already responded
                if (review.IsResponded)
                {
                    return BadRequest(new { error = "Đánh giá này đã được phản hồi rồi" });
                }

                // Only allow response for reviews with rating < 4 stars
                if (review.SoSao >= 4)
                {
                    return BadRequest(new { error = "Chỉ cho phép phản hồi đánh giá dưới 4 sao" });
                }

                var customer = review.IdkhachHangNavigation;
                if (customer == null || string.IsNullOrEmpty(customer.Email))
                {
                    return BadRequest(new { error = "Không tìm thấy email khách hàng" });
                }

                // Get booking info if available
                DatPhong? booking = null;
                if (!string.IsNullOrEmpty(review.IddatPhong))
                {
                    booking = await _context.DatPhongs.FirstOrDefaultAsync(b => b.IddatPhong == review.IddatPhong);
                }

                // Load email template
                string templatePath = Path.Combine(Directory.GetCurrentDirectory(), "EmailTemplates", "apology-review.html");
                if (!System.IO.File.Exists(templatePath))
                {
                    _logger.LogWarning($"Apology email template not found at {templatePath}");
                    return StatusCode(500, new { error = "Email template không tìm thấy" });
                }

                string emailBody = System.IO.File.ReadAllText(templatePath);

                // Generate star display
                string stars = "";
                for (int i = 0; i < review.SoSao; i++) stars += "⭐";

                // Convert compensation text to HTML list items
                var compensationItems = request.Compensation?
                    .Split(new[] { '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries)
                    .Where(s => !string.IsNullOrWhiteSpace(s))
                    .Select(s => $"<li>{s.Trim()}</li>")
                    .ToList() ?? new List<string>();
                string compensationHtml = string.Join("\n", compensationItems);

                var roomName = review.IdphongNavigation?.TenPhong ?? "Phòng";
                var roomType = review.IdphongNavigation?.IdloaiPhongNavigation?.TenLoaiPhong ?? "";

                // Replace placeholders
                emailBody = emailBody
                    .Replace("{{CustomerName}}", customer.HoTen ?? "Quý khách")
                    .Replace("{{ReviewStars}}", stars)
                    .Replace("{{ReviewTitle}}", review.TieuDe ?? "")
                    .Replace("{{ReviewContent}}", review.NoiDung ?? "")
                    .Replace("{{IssueDescription}}", request.IssueDescription ?? "")
                    .Replace("{{ActionTaken}}", request.ActionTaken ?? "")
                    .Replace("{{CompensationList}}", compensationHtml)
                    .Replace("{{BookingId}}", review.IddatPhong ?? "N/A")
                    .Replace("{{RoomName}}", $"{roomName} {roomType}".Trim())
                    .Replace("{{CheckInDate}}", booking?.NgayNhanPhong.ToString("dd/MM/yyyy") ?? "N/A")
                    .Replace("{{CheckOutDate}}", booking?.NgayTraPhong.ToString("dd/MM/yyyy") ?? "N/A")
                    .Replace("{{SenderName}}", request.SenderName ?? "Quản lý Chăm sóc Khách hàng")
                    .Replace("{{BookingLink}}", _configuration["Frontend:BaseUrl"] ?? "http://localhost:5173")
                    .Replace("{{HotelPhone}}", _configuration["Hotel:Phone"] ?? "1900 xxxx")
                    .Replace("{{HotelEmail}}", _configuration["Hotel:Email"] ?? "support@robinsvilla.com")
                    .Replace("{{HotelAddress}}", _configuration["Hotel:Address"] ?? "Robins Villa")
                    .Replace("{{CurrentYear}}", DateTime.Now.Year.ToString());

                // Send email
                var smtpHost = _configuration["SMTP:Host"] ?? "smtp.gmail.com";
                var smtpPort = int.Parse(_configuration["SMTP:Port"] ?? "587");
                var smtpUser = _configuration["SMTP:User"];
                var smtpPass = _configuration["SMTP:Password"];
                var fromEmail = _configuration["SMTP:FromEmail"] ?? smtpUser;
                var fromName = _configuration["SMTP:FromName"] ?? "Robins Villa";

                if (string.IsNullOrEmpty(smtpUser) || string.IsNullOrEmpty(smtpPass))
                {
                    _logger.LogWarning("SMTP credentials not configured");
                    return StatusCode(500, new { error = "Cấu hình email chưa được thiết lập" });
                }

                using var client = new SmtpClient(smtpHost, smtpPort)
                {
                    EnableSsl = true,
                    Credentials = new NetworkCredential(smtpUser, smtpPass)
                };

                var mailMessage = new MailMessage
                {
                    From = new MailAddress(fromEmail!, fromName),
                    Subject = $"[Robins Villa] – Phản hồi về đánh giá của Quý khách",
                    Body = emailBody,
                    IsBodyHtml = true
                };
                mailMessage.To.Add(customer.Email);

                await client.SendMailAsync(mailMessage);

                // Update IsResponded = true after successful email send
                review.IsResponded = true;
                review.UpdatedAt = DateTime.Now;
                await _context.SaveChangesAsync();

                _logger.LogInformation("Apology email sent to {Email} for review {ReviewId}. IsResponded set to true.", customer.Email, id);

                return Ok(new { message = "Email phản hồi đã được gửi thành công", isResponded = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending response email for review {ReviewId}", id);
                return StatusCode(500, new { error = "Lỗi khi gửi email phản hồi", detail = ex.Message });
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

                // Check if review already exists for the same customer & room
                var existingReview = await _context.DanhGia
                    .FirstOrDefaultAsync(r => r.IdkhachHang == booking.IdkhachHang && r.Idphong == booking.Idphong);

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
        /// Send urgent notification for low rating reviews (<= 3 stars)
        /// </summary>
        private async Task SendUrgentReviewNotificationAsync(DanhGium review, DatPhong booking)
        {
            try
            {
                // TODO: Implement actual notification system (email, SMS, internal notification)
                // For now, just log the urgent review
                _logger.LogWarning("URGENT REVIEW ALERT: Low rating ({Rating} stars) received for booking {BookingId}, room {RoomId}. Customer: {CustomerName}. Review: {Title}",
                    review.SoSao, review.IddatPhong, review.Idphong, 
                    booking.IdkhachHangNavigation?.HoTen ?? "Unknown", 
                    review.TieuDe ?? "No title");

                // TODO: Send email to CSM Leader and Hotel Management
                // TODO: Create internal notification in admin dashboard
                // TODO: Flag review for immediate attention

            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send urgent review notification for review {ReviewId}", review.IddanhGia);
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

                _logger.LogInformation($"Email sent successfully to {toEmail}", toEmail);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Failed to send email to {toEmail}", toEmail);
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

    /// <summary>
    /// Request model for responding to a review (apology email)
    /// </summary>
    public class ReviewResponseRequest
    {
        /// <summary>
        /// Mô tả vấn đề đã ghi nhận từ đánh giá của khách
        /// </summary>
        public string? IssueDescription { get; set; }
        
        /// <summary>
        /// Hành động khắc phục đã thực hiện
        /// </summary>
        public string? ActionTaken { get; set; }
        
        /// <summary>
        /// Danh sách ưu đãi bồi thường (mỗi dòng là một ưu đãi)
        /// </summary>
        public string? Compensation { get; set; }
        
        /// <summary>
        /// Tên người gửi (Quản lý CSKH)
        /// </summary>
        public string? SenderName { get; set; }
    }
    
}
