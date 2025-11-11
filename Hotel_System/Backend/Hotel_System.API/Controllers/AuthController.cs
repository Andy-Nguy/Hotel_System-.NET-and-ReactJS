using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Hotel_System.API.Services;
using Hotel_System.API.DTOs;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;

namespace Hotel_System.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _auth;
        private readonly ILogger<AuthController> _logger;

        public AuthController(IAuthService auth, ILogger<AuthController> logger)
        {
            _auth = auth;
            _logger = logger;
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

        [Authorize]
        [HttpGet("profile")]
        public async Task<IActionResult> GetProfile()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out var userId))
                return Unauthorized(new { error = "Invalid token" });

            var (success, error, profile) = await _auth.GetUserProfileAsync(userId);
            if (!success) return BadRequest(new { error });
            return Ok(profile);
        }

    // login-OTP endpoints removed to keep a simpler register + password login flow
    }
}
