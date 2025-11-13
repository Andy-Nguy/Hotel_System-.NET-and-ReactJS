using System.Net;
using System.Net.Mail;

namespace Hotel_System.API.Services;

/// <summary>
/// Service gửi email THẬT - KHÔNG CẦN cài package
/// Sử dụng SmtpClient có sẵn trong .NET
/// </summary>
public interface IEmailService
{
    Task SendEmailAsync(string toEmail, string toName, string subject, string body);
}

public class EmailService : IEmailService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<EmailService> _logger;

    public EmailService(IConfiguration configuration, ILogger<EmailService> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public async Task SendEmailAsync(string toEmail, string toName, string subject, string body)
    {
        try
        {
            
            // Lấy cấu hình từ appsettings.json
            var smtpServer = _configuration["EmailSettings:SmtpServer"] ?? "smtp.gmail.com";
            var smtpPort = int.Parse(_configuration["EmailSettings:SmtpPort"] ?? "587");
            var senderEmail = _configuration["EmailSettings:SenderEmail"];
            var senderPassword = _configuration["EmailSettings:SenderPassword"];
            var senderName = _configuration["EmailSettings:SenderName"] ?? "Khách sạn";

            // Validate
            if (string.IsNullOrEmpty(senderEmail) || string.IsNullOrEmpty(senderPassword))
            {
                _logger.LogWarning("⚠️ Email chưa được cấu hình. Vui lòng cấu hình EmailSettings trong appsettings.json");
                return;
            }

            // Tạo email message
            using var mailMessage = new MailMessage();
            mailMessage.From = new MailAddress(senderEmail, senderName);
            mailMessage.To.Add(new MailAddress(toEmail, toName));
            mailMessage.Subject = subject;
            mailMessage.Body = body;
            mailMessage.IsBodyHtml = false; // Text thuần, không phải HTML

            // Cấu hình SMTP client
            using var smtpClient = new SmtpClient(smtpServer, smtpPort);
            smtpClient.EnableSsl = true; // Bắt buộc với Gmail
            smtpClient.Credentials = new NetworkCredential(senderEmail, senderPassword);
            smtpClient.DeliveryMethod = SmtpDeliveryMethod.Network;

            // Gửi email
            await smtpClient.SendMailAsync(mailMessage);
            
            _logger.LogInformation($"✅ Email đã gửi thành công đến {toEmail}");
        }
        catch (SmtpException ex)
        {
            _logger.LogError(ex, $"❌ Lỗi SMTP khi gửi email đến {toEmail}: {ex.Message}");
            // Không throw để không ảnh hưởng đến quá trình đặt phòng
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"❌ Lỗi khi gửi email đến {toEmail}");
        }
    }
}
