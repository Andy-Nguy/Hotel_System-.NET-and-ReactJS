using Hotel_System.API.Models;
using Hotel_System.API.Services;
using QuestPDF;
using QuestPDF.Infrastructure;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Microsoft.Extensions.FileProviders;
using System.IO;
using Microsoft.OpenApi.Models;

AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);
var builder = WebApplication.CreateBuilder(args);
QuestPDF.Settings.License = LicenseType.Community;
// ==========================================
// 1️⃣ Add services to the container
// ==========================================
builder.Services.AddControllers()
    .AddJsonOptions(opts =>
    {
        // Use camelCase for JSON output
        opts.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        // Allow deserialization from snake_case or other casing conventions
        opts.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Enter 'Bearer' [space] and then your token in the text input below.",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            new string[] {}
        }
    });
});

// Auth service (register/login/otp)
builder.Services.AddScoped<IAuthService, AuthService>();
// đăng ký email service
builder.Services.AddScoped<IEmailService, EmailService>();
// Room service
builder.Services.AddScoped<RoomService>();
// Room image service (manages multiple images per room)
builder.Services.AddScoped<RoomImageService>();
// Email service
builder.Services.AddScoped<IEmailService, EmailService>();
// Nhân viên service (quản lý nhân viên cho admin)
builder.Services.AddScoped<INhanVienService, NhanVienService>();

// Template renderer for email HTML/text templates
builder.Services.AddSingleton<Hotel_System.API.Services.EmailTemplateRenderer>();

// Background service: expire holds (ThoiHan)
builder.Services.AddHostedService<HoldExpiryBackgroundService>();
// Background service: monitor overdue bookings and add late fees
builder.Services.AddHostedService<OverdueMonitorService>();

// Background service: send review reminder emails - DISABLED: only send on manual checkout button click
// builder.Services.AddHostedService<ReviewReminderService>();

// Configure JWT authentication
var jwtSection = builder.Configuration.GetSection("Jwt");
var jwtKey = jwtSection.GetValue<string>("Key");
if (!string.IsNullOrEmpty(jwtKey))
{
    var keyBytes = Encoding.UTF8.GetBytes(jwtKey);
    builder.Services.AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    }).AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = true;
        options.SaveToken = true;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
                // Map the role claim from the token (we issue claim with type "role")
                RoleClaimType = "role",
                ValidIssuer = jwtSection.GetValue<string>("Issuer"),
                ValidAudience = jwtSection.GetValue<string>("Audience"),
                IssuerSigningKey = new SymmetricSecurityKey(keyBytes)
        };
    });
}

//  Add CORS *BEFORE* Build() ok
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.SetIsOriginAllowed(origin =>
        {
            // Các origin cụ thể cần được cho phép
            var allowedOrigins = new[]
            {
                "http://localhost:5173",     // Vite dev server
                "http://localhost:3000",    // React dev server
                "http://10.0.2.2:8080",    // Android emulator accessing host
                "http://192.168.1.9:8080", // Physical device on same network
                "http://localhost:19006",  // Expo dev server
                "http://localhost:19000"   // Expo dev tools
            };

            // Kiểm tra xem origin có nằm trong danh sách các origin cụ thể không
            if (allowedOrigins.Contains(origin))
            {
                return true;
            }

            // Cho phép tất cả các domain Vercel (bao gồm preview deployments)
            if (origin.StartsWith("https://") && origin.EndsWith(".vercel.app"))
            {
                return true;
            }
            // Cho phép domain mới robinsvilla.site
            if (origin == "https://robinsvilla.site" || origin == "https://www.robinsvilla.site")
            {
                return true;
            }

            return false;
        })
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials();
    });
});
// Add response compression
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
});
//Chọn nhánh deploy
//  Connect to PostgreSQL
builder.Services.AddDbContext<HotelSystemContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// ==========================================
// 2️ Build app
// ==========================================
var app = builder.Build();

// ==========================================
// 3Configure middleware pipeline
// ==========================================
// Enable Swagger in all environments
app.UseSwagger();
app.UseSwaggerUI();

// Comment out HTTPS redirect for mobile development
// app.UseHttpsRedirection();

//  Enable CORS here (AFTER Build)
app.UseCors("AllowFrontend");

// Enable response compression
app.UseResponseCompression();

// Authentication & Authorization
app.UseAuthentication();
app.UseAuthorization();

// Serve static files (the built frontend) and enable SPA fallback
app.UseDefaultFiles();
app.UseStaticFiles();

// Additionally serve the assets folder (e.g. assets/room/*) from the project root
// so frontend can request images like: https://localhost:5001/assets/room/xxx.jpg
var assetsPath = Path.Combine(builder.Environment.ContentRootPath, "assets");
if (Directory.Exists(assetsPath))
{
    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new PhysicalFileProvider(assetsPath),
        RequestPath = "/assets"
    });
}

app.MapControllers();

// Add a simple root endpoint to prevent 404 on the home page
app.MapGet("/", () => "Welcome to Hotel System API! Visit /swagger for API documentation.");

// If no controller route matches, fallback to serve index.html for the SPA
app.MapFallbackToFile("index.html");

Console.WriteLine("📚 Swagger docs: https://localhost:5001/swagger");

app.Run();
