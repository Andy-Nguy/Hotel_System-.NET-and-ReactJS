using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Hotel_System.API.Services;
using Hotel_System.API.DTOs;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Hotel_System.API.Models;
using Microsoft.AspNetCore.Hosting;
using System.IO;

namespace Hotel_System.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _auth;
        private readonly ILogger<AuthController> _logger;
            private readonly HotelSystemContext _context;
        private readonly IWebHostEnvironment _env;

        public AuthController(IAuthService auth, ILogger<AuthController> logger, HotelSystemContext context, IWebHostEnvironment env)
        {
            _auth = auth;
            _logger = logger;
                _context = context;
            _env = env;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequest req)
        {
            var (success, error, pendingId) = await _auth.RegisterAsync(req);
            if (!success) return BadRequest(new { error });
            return CreatedAtAction(nameof(Verify), new { pendingId }, new { pendingId });
        }

        [HttpPost("verify")]
        public async Task<IActionResult> Verify([FromBody] VerifyOtpRequest req)
        {
            var (success, error, userId) = await _auth.VerifyRegisterOtpAsync(req.PendingId, req.Otp ?? string.Empty);
            if (!success) return BadRequest(new { error });
            return Ok(new { userId });
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest req)
        {
            var (success, error, token) = await _auth.LoginAsync(req);
            if (!success) return BadRequest(new { error });
            return Ok(new { token });
        }

        // [Authorize]
        [HttpGet("profile")]
        public async Task<IActionResult> GetProfile()
        {
            try
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out var userId))
                return Unauthorized(new { error = "Invalid token" });

            var (success, error, profile) = await _auth.GetUserProfileAsync(userId);
            if (!success) return BadRequest(new { error });
            return Ok(profile);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting profile");
                return StatusCode(500, new { error = "Internal server error", message = ex.Message });
            }
        }

        // [Authorize]
        [HttpGet("loyalty")]
        public async Task<IActionResult> GetLoyalty()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out var userId))
                return Unauthorized(new { error = "Invalid token" });

            var customer = await _context.KhachHangs.FindAsync(userId);
            if (customer == null) return NotFound(new { error = "Customer not found" });

            var paidInvoices = await _context.HoaDons
                .Include(h => h.IddatPhongNavigation)
                .Where(h => h.IddatPhongNavigation != null && h.IddatPhongNavigation.IdkhachHang == userId && h.TrangThaiThanhToan == 2)
                .ToListAsync();

            decimal totalSpent = paidInvoices.Sum(h => h.TienThanhToan.GetValueOrDefault(h.TongTien));

            // total nights: sum of SoDem for bookings that have at least one fully paid invoice
            var totalNights = await _context.DatPhongs
                .Include(dp => dp.HoaDons)
                .Where(dp => dp.IdkhachHang == userId && dp.HoaDons.Any(h => h.TrangThaiThanhToan == 2))
                .Select(dp => dp.SoDem ?? 0)
                .SumAsync();

            // Determine tier and rate
            string tier = "Silver";
            decimal rate = 100000m;

            if (totalSpent >= 200_000_000m || totalNights >= 60)
            {
                tier = "Diamond";
                rate = 60000m;
            }
            else if (totalSpent >= 80_000_000m || totalNights >= 25)
            {
                tier = "Platinum";
                rate = 70000m;
            }
            else if (totalSpent >= 30_000_000m || totalNights >= 10)
            {
                tier = "Gold";
                rate = 85000m;
            }

            var pointsBalance = customer.TichDiem ?? 0;

            // Sample rewards (cost in points). You can expand or load from DB later.
            var rewards = new[] {
                new { id = "V100", name = "Voucher 100.000đ", costPoints = 1, description = "Giảm 100.000đ" },
                new { id = "V200", name = "Voucher 200.000đ", costPoints = 2, description = "Giảm 200.000đ" },
                new { id = "F1N", name = "Miễn phí 1 đêm (hạng tiêu chuẩn)", costPoints = 10, description = "Miễn phí 1 đêm áp dụng theo điều kiện" }
            };

            var available = rewards.Select(r => new {
                r.id,
                r.name,
                r.description,
                costPoints = r.costPoints,
                canRedeem = pointsBalance >= r.costPoints
            });

            return Ok(new {
                tichDiem = pointsBalance,
                tier,
                vndPerPoint = rate,
                totalSpent,
                totalNights,
                rewards = available
            });
        }

        [HttpPost("forgot-password")]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest req)
        {
            var (success, error) = await _auth.ForgotPasswordAsync(req);
            if (!success) return BadRequest(new { error });
            return Ok(new { message = "OTP sent to email" });
        }

        [HttpPost("reset-password")]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest req)
        {
            var (success, error) = await _auth.ResetPasswordAsync(req);
            if (!success) return BadRequest(new { error });
            return Ok(new { message = "Password reset successfully" });
        }

        [HttpPut("profile")]
        [Authorize]
        public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest request)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out var userId))
                return Unauthorized(new { error = "Invalid token" });

            var (success, error, profile) = await _auth.UpdateProfileAsync(userId, request);
            if (!success) return BadRequest(new { error });
            return Ok(profile);
        }

        [HttpPost("upload-avatar")]
        [Authorize]
        [DisableRequestSizeLimit]
        public async Task<IActionResult> UploadAvatar(IFormFile file)
        {
            try
            {
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
                if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out var userId))
                    return Unauthorized(new { error = "Invalid token" });

                if (file == null || file.Length == 0)
                    return BadRequest(new { error = "Không có file được upload" });

                // Validate file type
                var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".webp" };
                var fileExtension = Path.GetExtension(file.FileName).ToLower();
                if (!allowedExtensions.Contains(fileExtension))
                    return BadRequest(new { error = "Chỉ chấp nhận file ảnh JPG, PNG, WebP" });

                // Validate file size (max 5MB)
                if (file.Length > 5 * 1024 * 1024)
                    return BadRequest(new { error = "Kích thước file không được vượt quá 5MB" });

                // Tạo thư mục nếu chưa có
                var avatarPath = Path.Combine(_env.ContentRootPath, "wwwroot", "img", "avatars");
                if (!Directory.Exists(avatarPath))
                    Directory.CreateDirectory(avatarPath);

                // Xóa avatar cũ nếu có
                var user = await _context.KhachHangs.FindAsync(userId);
                if (user != null && !string.IsNullOrEmpty(user.Avatar))
                {
                    var oldFilePath = Path.Combine(_env.ContentRootPath, "wwwroot", user.Avatar.TrimStart('/'));
                    if (System.IO.File.Exists(oldFilePath))
                    {
                        try
                        {
                            System.IO.File.Delete(oldFilePath);
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "Không thể xóa avatar cũ: {Path}", oldFilePath);
                        }
                    }
                }

                // Tạo tên file unique
                var fileName = $"avatar_{userId}_{Guid.NewGuid()}{fileExtension}";
                var filePath = Path.Combine(avatarPath, fileName);

                // Lưu file
                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                var relativePath = $"/img/avatars/{fileName}";

                // Cập nhật avatar trong database
                if (user != null)
                {
                    user.Avatar = relativePath;
                    await _context.SaveChangesAsync();
                }

                _logger.LogInformation("Upload avatar thành công cho user {UserId}: {Path}", userId, relativePath);

                return Ok(new { avatar = relativePath });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi upload avatar");
                return StatusCode(500, new { error = "Có lỗi xảy ra khi upload avatar" });
            }
        }

    // login-OTP endpoints removed to keep a simpler register + password login flow
    }
}
