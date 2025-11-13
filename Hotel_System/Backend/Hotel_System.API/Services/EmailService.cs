using System;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Hotel_System.API.Services
{
    public class EmailService : IEmailService
    {
        private readonly IConfiguration _config;
        private readonly ILogger<EmailService> _logger;

        public EmailService(IConfiguration config, ILogger<EmailService> logger)
        {
            _config = config;
            _logger = logger;
        }

        public async Task SendEmailAsync(string toEmail, string subject, string body, bool isHtml = true)
        {
            var smtpSection = _config.GetSection("Smtp");
            var host = smtpSection.GetValue<string>("Host");
            if (string.IsNullOrWhiteSpace(host))
            {
                _logger.LogInformation("SMTP not configured - email to {to} would be: {subject}\n{body}", toEmail, subject, body);
                return;
            }

            try
            {
                var port = smtpSection.GetValue<int>("Port", 587);
                var user = smtpSection.GetValue<string>("User");
                var from = smtpSection.GetValue<string>("From") ?? user ?? "noreply@example.com";
                var display = smtpSection.GetValue<string>("DisplayName");

                _logger.LogInformation("Sending email via SMTP {host}:{port} from {from} to {to}", host, port, from, toEmail);

                using var client = new System.Net.Mail.SmtpClient(host, port);
                client.EnableSsl = smtpSection.GetValue<bool>("EnableSsl", true);
                client.UseDefaultCredentials = false;
                client.Credentials = new System.Net.NetworkCredential(user, smtpSection.GetValue<string>("Password"));
                client.DeliveryMethod = System.Net.Mail.SmtpDeliveryMethod.Network;
                client.Timeout = smtpSection.GetValue<int>("Timeout", 100000);

                var mail = new System.Net.Mail.MailMessage();
                mail.From = new System.Net.Mail.MailAddress(from, display);
                mail.To.Add(new System.Net.Mail.MailAddress(toEmail));
                mail.Subject = subject;
                mail.Body = body;
                mail.IsBodyHtml = isHtml;

                await client.SendMailAsync(mail);

                _logger.LogInformation("Email sent to {to} (subject={subject})", toEmail, subject);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send email to {to}", toEmail);
                throw;
            }
        }
    }
}
