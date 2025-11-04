using System.Threading.Tasks;
using Hotel_System.API.Models;
using Hotel_System.API.DTOs;

namespace Hotel_System.API.Services
{
    public interface IAuthService
    {
        Task<(bool success, string? error, long? pendingId)> RegisterAsync(RegisterRequest req);
        Task<(bool success, string? error, int? userId)> VerifyRegisterOtpAsync(long pendingId, string otp);
        Task<(bool success, string? error, string? token)> LoginAsync(LoginRequest req);
        
    }
}
