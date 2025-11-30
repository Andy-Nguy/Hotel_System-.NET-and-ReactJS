using System;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Hotel_System.API.Models;
using Hotel_System.API.DTOs;

namespace Hotel_System.API.Services
{
    public class AuthService : IAuthService
    {
        private readonly HotelSystemContext _db;
        private readonly IConfiguration _config;
        private readonly ILogger<AuthService> _logger;

        public AuthService(HotelSystemContext db, IConfiguration config, ILogger<AuthService> logger)
        {
            _db = db;
            _config = config;
            _logger = logger;
        }

        public async Task<(bool success, string? error, long? pendingId)> RegisterAsync(RegisterRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
                return (false, "Email and Password are required", null);

            // check existing
            var existing = _db.KhachHangs.FirstOrDefault(k => k.Email == req.Email);
            if (existing != null)
                return (false, "Email already registered", null);

            var otp = GenerateOtp();
            var pending = new PendingUser
            {
                Hoten = req.Hoten,
                Email = req.Email,
                Password = HashPassword(req.Password),
                Sodienthoai = req.Sodienthoai,
                Ngaysinh = req.Ngaysinh,
                Otp = otp,
                OtpExpiredAt = DateTime.UtcNow.AddMinutes(10),
                CreatedAt = DateTime.UtcNow
            };

            _db.PendingUsers.Add(pending);
            await _db.SaveChangesAsync();

            await SendOtpAsync(pending.Email!, otp, "Your registration OTP");

            return (true, null, pending.Id);
        }

        public async Task<(bool success, string? error, int? userId)> VerifyRegisterOtpAsync(long pendingId, string otp)
        {
            var pending = _db.PendingUsers.FirstOrDefault(p => p.Id == pendingId);
            if (pending == null) return (false, "Pending record not found", null);
            if (pending.OtpExpiredAt == null || pending.OtpExpiredAt < DateTime.UtcNow) return (false, "OTP expired", null);
            if (pending.Otp != otp) return (false, "Invalid OTP", null);

            // create KhachHang
            var kh = new KhachHang
            {
                HoTen = pending.Hoten ?? "",
                NgaySinh = pending.Ngaysinh,
                SoDienThoai = pending.Sodienthoai,
                Email = pending.Email,
                NgayDangKy = DateOnly.FromDateTime(DateTime.Now)
            };
            _db.KhachHangs.Add(kh);
            await _db.SaveChangesAsync();

            var account = new TaiKhoanNguoiDung
            {
                IdkhachHang = kh.IdkhachHang,
                MatKhau = pending.Password ?? string.Empty,
                VaiTro = 0
            };
            _db.TaiKhoanNguoiDungs.Add(account);

            // remove pending
            _db.PendingUsers.Remove(pending);

            await _db.SaveChangesAsync();

            return (true, null, kh.IdkhachHang);
        }

        public Task<(bool success, string? error, string? token)> LoginAsync(LoginRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
                return Task.FromResult<(bool, string?, string?)>((false, "Email and password required", null));

            var kh = _db.KhachHangs.FirstOrDefault(k => k.Email == req.Email);
            if (kh == null) return Task.FromResult<(bool, string?, string?)>((false, "Invalid credentials", null));

            var acc = _db.TaiKhoanNguoiDungs.FirstOrDefault(a => a.IdkhachHang == kh.IdkhachHang);
            if (acc == null) return Task.FromResult<(bool, string?, string?)>((false, "Invalid credentials", null));

            if (!VerifyPassword(req.Password, acc.MatKhau)) return Task.FromResult<(bool, string?, string?)>((false, "Invalid credentials", null));

            // generate JWT token (if configured) otherwise fallback to GUID
            var token = GenerateJwtToken(kh, acc);
            return Task.FromResult<(bool, string?, string?)>((true, null, token));
        }

        public Task<(bool success, string? error, UserProfileResponse? profile)> GetUserProfileAsync(int userId)
        {
            var kh = _db.KhachHangs.FirstOrDefault(k => k.IdkhachHang == userId);
            if (kh == null) return Task.FromResult<(bool, string?, UserProfileResponse?)>((false, "User not found", null));

            // Get account to retrieve VaiTro
            var acc = _db.TaiKhoanNguoiDungs.FirstOrDefault(a => a.IdkhachHang == userId);

            var profile = new UserProfileResponse
            {
                IdkhachHang = kh.IdkhachHang,
                HoTen = kh.HoTen,
                NgaySinh = kh.NgaySinh,
                SoDienThoai = kh.SoDienThoai,
                Email = kh.Email,
                NgayDangKy = kh.NgayDangKy,
                TichDiem = kh.TichDiem,
                VaiTro = acc?.VaiTro  // Include role: 0 = khachhang, 1 = nhanvien
            };

            return Task.FromResult<(bool, string?, UserProfileResponse?)>((true, null, profile));
        }

        public async Task SendOtpEmailAsync(string email, string otp)
        {
            // Implement email sending logic here
            // For now, just log it
            _logger.LogInformation($"Sending OTP {otp} to {email}");
            // You can integrate with an email service like SendGrid, MailKit, etc.
        }

        public async Task<(bool success, string? error)> ForgotPasswordAsync(ForgotPasswordRequest req)
        {
            var user = await _db.KhachHangs.FirstOrDefaultAsync(k => k.Email == req.Email);
            if (user == null) return (false, "Email không tồn tại trong hệ thống");

            var otp = GenerateOtp();
            var expiredAt = DateTime.UtcNow.AddMinutes(10);

            // Remove any existing pending record for this email (case-insensitive)
            var existingPending = await _db.PendingUsers.FirstOrDefaultAsync(p => p.Email.ToLower() == req.Email.ToLowerInvariant());
            if (existingPending != null)
            {
                _db.PendingUsers.Remove(existingPending);
            }

            var pending = new PendingUser
            {
                Hoten = user.HoTen,
                Email = req.Email.ToLowerInvariant(), // Store email in lowercase for consistency
                Password = "", // not used
                Sodienthoai = user.SoDienThoai,
                Ngaysinh = user.NgaySinh,
                Otp = otp,
                OtpExpiredAt = expiredAt,
                CreatedAt = DateTime.UtcNow
            };

            _logger.LogInformation("Inserting pending record: Email='{Email}' (length: {EmailLength}), OTP='{Otp}' (length: {OtpLength})", 
                pending.Email, pending.Email?.Length ?? 0, pending.Otp, pending.Otp?.Length ?? 0);

            _db.PendingUsers.Add(pending);
            await _db.SaveChangesAsync();

            await SendOtpAsync(req.Email, otp, "Password Reset OTP");

            return (true, null);
        }

        public async Task<(bool success, string? error)> ResetPasswordAsync(ResetPasswordRequest req)
        {
            // Normalize email to lowercase for case-insensitive comparison
            var normalizedEmail = req.Email.ToLowerInvariant();
            var normalizedOtp = req.Otp.Trim(); // Remove any whitespace

            _logger.LogInformation("Reset password attempt for email: {Email} (normalized: {NormalizedEmail}), OTP: {Otp}", req.Email, normalizedEmail, req.Otp);

            // First find the pending record without time check
            var pendingCandidates = await _db.PendingUsers
                .Where(p => p.Email.ToLower() == normalizedEmail && p.Otp == normalizedOtp)
                .ToListAsync();
            
            _logger.LogInformation("Found {Count} OTP matching records for email {Email}", pendingCandidates.Count, normalizedEmail);
            foreach (var p in pendingCandidates)
            {
                _logger.LogInformation("Candidate: OTP='{Otp}' (length: {OtpLength}), Expired={Expired}, Now={Now}, IsExpired={IsExpired}", 
                    p.Otp, p.Otp?.Length ?? 0, p.OtpExpiredAt, DateTimeOffset.UtcNow, p.OtpExpiredAt <= DateTimeOffset.UtcNow);
            }
            _logger.LogInformation("Searching for OTP: '{NormalizedOtp}' (length: {OtpLength})", normalizedOtp, normalizedOtp.Length);
            
            var pending = pendingCandidates.FirstOrDefault(p => p.OtpExpiredAt > DateTimeOffset.UtcNow);
            
            if (pending == null)
            {
                // Debug: check what records exist for this email
                var allPendingForEmail = await _db.PendingUsers.Where(p => p.Email.ToLower() == normalizedEmail).ToListAsync();
                _logger.LogInformation("Found {Count} pending records for email {Email} (normalized)", allPendingForEmail.Count, normalizedEmail);
                foreach (var p in allPendingForEmail)
                {
                    _logger.LogInformation("Pending record: OTP={Otp}, Expired={Expired}, Now={Now}", p.Otp, p.OtpExpiredAt, DateTimeOffset.UtcNow);
                }
                return (false, "Mã OTP không hợp lệ hoặc đã hết hạn");
            }

            var user = await _db.KhachHangs.FirstOrDefaultAsync(k => k.Email.ToLower() == normalizedEmail);
            if (user == null) return (false, "Không tìm thấy người dùng");

            var account = await _db.TaiKhoanNguoiDungs.FirstOrDefaultAsync(t => t.IdkhachHang == user.IdkhachHang);
            if (account == null) return (false, "Không tìm thấy tài khoản");

            account.MatKhau = HashPassword(req.NewPassword);
            await _db.SaveChangesAsync();

            _db.PendingUsers.Remove(pending);
            await _db.SaveChangesAsync();

            return (true, null);
        }

        private string GenerateJwtToken(KhachHang kh, TaiKhoanNguoiDung acc)
        {
            try
            {
                var jwtSection = _config.GetSection("Jwt");
                var key = jwtSection.GetValue<string>("Key");
                var issuer = jwtSection.GetValue<string>("Issuer");
                var audience = jwtSection.GetValue<string>("Audience");
                var expiresMinutes = jwtSection.GetValue<int>("ExpiresMinutes", 60);

                if (string.IsNullOrWhiteSpace(key))
                {
                    // fallback
                    return Guid.NewGuid().ToString();
                }

                // Convert numeric VaiTro (tinyint) to meaningful role strings
                // 0 => khachhang, 1 => nhanvien
                var roleStr = acc.VaiTro == 1 ? "nhanvien" : "khachhang";

                var claims = new[]
                {
                    new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.NameIdentifier, kh.IdkhachHang.ToString()),
                    new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.Email, kh.Email ?? string.Empty),
                    new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.Name, kh.HoTen ?? string.Empty),
                    // Include both a "role" claim and the standard role claim type for compatibility
                    new System.Security.Claims.Claim("role", roleStr),
                    new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.Role, roleStr),
                    new System.Security.Claims.Claim("phone", kh.SoDienThoai ?? string.Empty)
                };

                var keyBytes = Encoding.UTF8.GetBytes(key);
                var securityKey = new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(keyBytes);
                var creds = new Microsoft.IdentityModel.Tokens.SigningCredentials(securityKey, Microsoft.IdentityModel.Tokens.SecurityAlgorithms.HmacSha256);

                var token = new System.IdentityModel.Tokens.Jwt.JwtSecurityToken(
                    issuer: issuer,
                    audience: audience,
                    claims: claims,
                    expires: DateTime.UtcNow.AddMinutes(expiresMinutes),
                    signingCredentials: creds
                );

                return new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler().WriteToken(token);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to generate JWT, falling back to GUID token");
                return Guid.NewGuid().ToString();
            }
        }

        // Note: login-OTP flow removed per request. Keep registration-only OTP flow.

        private string GenerateOtp()
        {
            // Use RandomNumberGenerator static API (non-obsolete) to generate a 6-digit OTP
            var num = RandomNumberGenerator.GetInt32(0, 1000000);
            return num.ToString("D6");
        }

        private async Task SendOtpAsync(string toEmail, string otp, string subject)
        {
            var smtpSection = _config.GetSection("Smtp");
            var host = smtpSection.GetValue<string>("Host");
            if (string.IsNullOrWhiteSpace(host))
            {
                _logger.LogInformation("OTP for {email}: {otp}", toEmail, otp);
                await Task.CompletedTask;
                return;
            }

            try
            {
                using var client = new System.Net.Mail.SmtpClient(
                    host,
                    smtpSection.GetValue<int>("Port", 587)
                )
                {
                    EnableSsl = smtpSection.GetValue<bool>("EnableSsl", true),
                    Credentials = new System.Net.NetworkCredential(
                        smtpSection.GetValue<string>("User"),
                        smtpSection.GetValue<string>("Password")
                    )
                };

                var from = smtpSection.GetValue<string>("From") ?? smtpSection.GetValue<string>("User") ?? "noreply@example.com";
                var mail = new System.Net.Mail.MailMessage(from, toEmail, subject, $"Your OTP is: {otp}") { IsBodyHtml = false };
                await client.SendMailAsync(mail);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send OTP to {email}", toEmail);
            }
        }

        // Simple PBKDF2 password hashing
        private string HashPassword(string password)
        {
            var saltSize = 16;
            var iterations = 10000;
            using var rng = RandomNumberGenerator.Create();
            var salt = new byte[saltSize];
            rng.GetBytes(salt);

            using var pbkdf2 = new Rfc2898DeriveBytes(password, salt, iterations, HashAlgorithmName.SHA256);
            var hash = pbkdf2.GetBytes(32);

            var hashBytes = new byte[1 + 4 + saltSize + hash.Length];
            // version(1 byte) | iterations(4 bytes little endian) | salt | hash
            hashBytes[0] = 0x01;
            BitConverter.GetBytes(iterations).CopyTo(hashBytes, 1);
            Array.Copy(salt, 0, hashBytes, 5, saltSize);
            Array.Copy(hash, 0, hashBytes, 5 + saltSize, hash.Length);
            return Convert.ToBase64String(hashBytes);
        }

        private bool VerifyPassword(string password, string hashed)
        {
            try
            {
                var bytes = Convert.FromBase64String(hashed);
                if (bytes[0] != 0x01) return false;
                var iterations = BitConverter.ToInt32(bytes, 1);
                var saltSize = 16;
                var salt = new byte[saltSize];
                Array.Copy(bytes, 5, salt, 0, saltSize);
                var hash = new byte[32];
                Array.Copy(bytes, 5 + saltSize, hash, 0, hash.Length);

                using var pbkdf2 = new Rfc2898DeriveBytes(password, salt, iterations, HashAlgorithmName.SHA256);
                var computed = pbkdf2.GetBytes(32);
                return computed.SequenceEqual(hash);
            }
            catch
            {
                return false;
            }
        }
    }
}
