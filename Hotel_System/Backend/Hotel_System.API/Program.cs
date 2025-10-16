using Hotel_System.API.Models;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// ==========================================
// 1️⃣ Add services to the container
// ==========================================
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// ✅ Add CORS *BEFORE* Build()
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod());
});

// ✅ Connect to SQL Server
builder.Services.AddDbContext<HotelSystemContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// ==========================================
// 2️⃣ Build app
// ==========================================
var app = builder.Build();

// ==========================================
// 3️⃣ Configure middleware pipeline
// ==========================================
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

// ✅ Enable CORS here (AFTER Build)
app.UseCors("AllowFrontend");

app.UseAuthorization();

app.MapControllers();

// ✅ Optional log
Console.WriteLine("Swagger UI: https://localhost:5001/swagger");

app.Run();
