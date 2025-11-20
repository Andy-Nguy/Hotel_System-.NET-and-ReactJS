using System;
using System.Collections.Generic;
using System.IO;
using Microsoft.Extensions.Logging;
using Microsoft.AspNetCore.Hosting;

namespace Hotel_System.API.Services
{
    public class EmailTemplateRenderer
    {
        private readonly IWebHostEnvironment _env;
        private readonly ILogger<EmailTemplateRenderer> _logger;

        public EmailTemplateRenderer(IWebHostEnvironment env, ILogger<EmailTemplateRenderer> logger)
        {
            _env = env;
            _logger = logger;
        }

        public string Render(string templateFileName, IDictionary<string, string>? placeholders = null)
        {
            try
            {
                var templatesDir = Path.Combine(_env.ContentRootPath, "EmailTemplates");
                var filePath = Path.Combine(templatesDir, templateFileName);
                if (!File.Exists(filePath))
                {
                    _logger.LogWarning("Email template not found: {path}", filePath);
                    return string.Empty;
                }

                var content = File.ReadAllText(filePath);
                if (placeholders != null)
                {
                    foreach (var kv in placeholders)
                    {
                        content = content.Replace("{{" + kv.Key + "}}", kv.Value ?? string.Empty, StringComparison.OrdinalIgnoreCase);
                    }
                }

                return content;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error rendering email template {template}", templateFileName);
                return string.Empty;
            }
        }
    }
}
