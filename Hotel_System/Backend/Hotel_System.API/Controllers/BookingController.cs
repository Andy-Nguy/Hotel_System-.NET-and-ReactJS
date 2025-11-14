using System;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
// using Hotel_System.API.Data;
using Hotel_System.API.Models;
using Hotel_System.API.DTOs;
using Hotel_System.API.Services;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Hotel_System.API.Controllers
{

[ApiController]
[Route("api/[controller]")]
public class BookingController : ControllerBase
{
    private readonly HotelSystemContext _context;
    private readonly ILogger<BookingController> _logger;

    public BookingController(HotelSystemContext context, ILogger<BookingController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpPost("create")]
    public async Task<IActionResult> CreateBooking([FromBody] CreateBookingRequest request)
    {
        using var transaction = await _context.Database.BeginTransactionAsync();
        
        try
        {
            _logger.LogInformation("Creating booking for customer: {Email}", request.Email);

            // 1. Tạo hoặc lấy khách hàng
            var khachHang = await _context.KhachHangs
                .FirstOrDefaultAsync(k => k.Email == request.Email);

            if (khachHang == null)
            {
                khachHang = new KhachHang
                {
                    HoTen = request.HoTen,
                    Email = request.Email,
                    SoDienThoai = request.SoDienThoai,
                    NgayDangKy = DateOnly.FromDateTime(DateTime.Now)
                };
                _context.KhachHangs.Add(khachHang);
                await _context.SaveChangesAsync();
            }

            // 2. Tính toán
            var ngayNhan = DateOnly.Parse(request.NgayNhanPhong);
            var ngayTra = DateOnly.Parse(request.NgayTraPhong);
            var soDem = ngayTra.DayNumber - ngayNhan.DayNumber;

            decimal tongTien = 0;
            foreach (var room in request.Rooms)
            {
                tongTien += room.GiaCoBanMotDem * soDem;
            }

            var thue = tongTien * 0.1m;
            var tongCong = tongTien + thue;

            // 3. Tạo đơn đặt phòng - thêm milliseconds để tránh duplicate
            var datPhongId = $"DP{DateTime.Now:yyyyMMddHHmmssfff}";
            var datPhong = new DatPhong
            {
                IddatPhong = datPhongId,
                IdkhachHang = khachHang.IdkhachHang,
                Idphong = request.Rooms.First().IdPhong, // Phòng đầu tiên
                NgayDatPhong = DateOnly.FromDateTime(DateTime.Now),
                NgayNhanPhong = ngayNhan,
                NgayTraPhong = ngayTra,
                SoDem = soDem,
                TongTien = tongCong,
                TienCoc = 0,
                TrangThai = 1, // 1 = Chờ xác nhận (sau khi đặt phòng)
                TrangThaiThanhToan = 1 // 1 = Chưa thanh toán (khởi tạo)
            };
            _context.DatPhongs.Add(datPhong);
            await _context.SaveChangesAsync();

            // 4. Tạo chi tiết đặt phòng cho từng phòng
            foreach (var room in request.Rooms)
            {
                var thanhTien = room.GiaCoBanMotDem * soDem;
                var chiTiet = new ChiTietDatPhong
                {
                    IDDatPhong = datPhongId,
                    IDPhong = room.IdPhong,
                    SoDem = soDem,
                    GiaPhong = room.GiaCoBanMotDem,
                    ThanhTien = thanhTien
                };
                _context.ChiTietDatPhongs.Add(chiTiet);
            }
            await _context.SaveChangesAsync();

            // ✅ KHÔNG TẠO HÓA ĐƠN Ở ĐÂY
            // Hóa đơn chỉ được tạo khi khách thanh toán (PaymentPage gọi API riêng)

            await transaction.CommitAsync();

            _logger.LogInformation("Booking created successfully. Booking ID: {IdDatPhong}", datPhong.IddatPhong);

            return Ok(new
            {
                success = true,
                message = "Đặt phòng thành công",
                data = new
                {
                    // idHoaDon = null, // Chưa có hóa đơn
                    idDatPhong = datPhong.IddatPhong,
                    idKhachHang = khachHang.IdkhachHang,
                    bookingCode = datPhongId,
                    tongTien = tongTien,
                    thue = thue,
                    tongCong = tongCong,
                    trangThai = "Chờ thanh toán"
                }
            });
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "Error creating booking");
            return BadRequest(new
            {
                success = false,
                message = "Đặt phòng thất bại: " + ex.Message
            });
        }
    }

    /// <summary>
    /// GET: api/Booking/{bookingId}
    /// Lấy chi tiết đơn đặt phòng
    /// </summary>
    [HttpGet("{bookingId}")]
    public async Task<IActionResult> GetBookingDetail(string bookingId)
    {
        try
        {
            var datPhong = await _context.DatPhongs
                .Include(dp => dp.IdkhachHangNavigation)
                .Include(dp => dp.ChiTietDatPhongs)
                .Include(dp => dp.HoaDons)
                .FirstOrDefaultAsync(dp => dp.IddatPhong == bookingId);

            if (datPhong == null)
            {
                return NotFound(new { message = "Không tìm thấy đơn đặt phòng" });
            }

            var hoaDon = datPhong.HoaDons.FirstOrDefault();

            // Lấy thông tin phòng cho từng chi tiết
            var roomDetails = new List<object>();
            foreach (var ct in datPhong.ChiTietDatPhongs)
            {
                var phong = await _context.Phongs
                    .Include(p => p.IdloaiPhongNavigation)
                    .FirstOrDefaultAsync(p => p.Idphong == ct.IDPhong);
                
                if (phong != null)
                {
                    roomDetails.Add(new
                    {
                        idPhong = phong.Idphong,
                        soPhong = phong.SoPhong,
                        tenPhong = phong.IdloaiPhongNavigation?.TenLoaiPhong,
                        giaPhong = ct.GiaPhong,
                        soDem = ct.SoDem,
                        thanhTien = ct.ThanhTien
                    });
                }
            }

            return Ok(new
            {
                success = true,
                data = new
                {
                    idDatPhong = datPhong.IddatPhong,
                    idHoaDon = hoaDon?.IdhoaDon,
                    bookingCode = datPhong.IddatPhong,
                    customer = new
                    {
                        id = datPhong.IdkhachHang,
                        hoTen = datPhong.IdkhachHangNavigation?.HoTen,
                        email = datPhong.IdkhachHangNavigation?.Email,
                        soDienThoai = datPhong.IdkhachHangNavigation?.SoDienThoai
                    },
                    ngayDatPhong = datPhong.NgayDatPhong?.ToString("yyyy-MM-dd"),
                    ngayNhanPhong = datPhong.NgayNhanPhong.ToString("yyyy-MM-dd"),
                    ngayTraPhong = datPhong.NgayTraPhong.ToString("yyyy-MM-dd"),
                    soDem = datPhong.SoDem,
                    tongTien = datPhong.TongTien,
                    tienCoc = datPhong.TienCoc,
                    trangThai = datPhong.TrangThai,
                    trangThaiText = datPhong.TrangThai switch
                    {
                        0 => "Chờ xử lý",
                        1 => "Đã xác nhận",
                        2 => "Đã hủy",
                        _ => "Không xác định"
                    },
                    trangThaiThanhToan = datPhong.TrangThaiThanhToan,
                    trangThaiThanhToanText = datPhong.TrangThaiThanhToan switch
                    {
                        0 => "Chờ thanh toán",
                        1 => "Đã thanh toán",
                        _ => "Không xác định"
                    },
                    rooms = roomDetails
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting booking detail");
            return StatusCode(500, new { message = "Có lỗi xảy ra khi lấy thông tin đặt phòng" });
        }
    }

[Route("api/[controller]")]
[ApiController]
public class BookingCompleteController : ControllerBase
{
    private readonly HotelSystemContext _context;
    private readonly ILogger<BookingCompleteController> _logger;
    private readonly IEmailService _emailService;

    public BookingCompleteController(
        HotelSystemContext context, 
        ILogger<BookingCompleteController> logger,
        IEmailService emailService)
    {
        _context = context;
        _logger = logger;
        _emailService = emailService;
    }

    // ===== HELPER METHODS =====

    /// <summary>
    /// Gửi email xác nhận đặt phòng (gửi ngay khi đặt phòng thành công)
    /// </summary>
    private async Task SendBookingConfirmationEmail(string email, string hoTen, string idDatPhong, DatPhong datPhong, List<RoomBookingDetail> danhSachPhong)
    {
        try
        {
            _logger.LogInformation($"📧 [Email 1] Gửi xác nhận đặt phòng {idDatPhong} đến {email}");
            
            // TODO: Tích hợp email service (SendGrid, SMTP, MailKit, etc.)
            // Nội dung email xác nhận đặt phòng:
            
            var emailSubject = $"Xác nhận đặt phòng #{idDatPhong}";
            var emailBody = $@"
Kính gửi Quý khách {hoTen},

Cảm ơn Quý khách đã đặt phòng tại khách sạn của chúng tôi!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THÔNG TIN ĐẶT PHÒNG
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Mã đặt phòng: {idDatPhong}
📅 Ngày đặt: {datPhong.NgayDatPhong:dd/MM/yyyy}
📅 Ngày nhận phòng: {datPhong.NgayNhanPhong:dd/MM/yyyy}
📅 Ngày trả phòng: {datPhong.NgayTraPhong:dd/MM/yyyy}
🌙 Số đêm: {datPhong.SoDem}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHI TIẾT PHÒNG ({danhSachPhong.Count} phòng)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{string.Join("\n", danhSachPhong.Select((p, i) => $"{i + 1}. Phòng {p.IDPhong} - {p.SoDem} đêm × {p.GiaPhong:N0} VNĐ = {p.SoDem * p.GiaPhong:N0} VNĐ"))}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TỔNG CHI PHÍ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💰 Tổng tiền: {datPhong.TongTien:N0} VNĐ
💵 Tiền cọc: {datPhong.TienCoc:N0} VNĐ

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ TRẠNG THÁI: Chờ xác nhận
Đơn đặt phòng của Quý khách đang chờ nhân viên xác nhận.
Chúng tôi sẽ liên hệ lại trong thời gian sớm nhất.

Trân trọng,
Khách sạn
";
            
            // Log email
            _logger.LogInformation($"✉️ Email Subject: {emailSubject}");
            _logger.LogInformation($"✉️ Email Body:\n{emailBody}");
            
            // ✅ GỬI EMAIL THẬT
            await _emailService.SendEmailAsync(email, hoTen, emailSubject);
            
            await Task.CompletedTask;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"❌ Lỗi khi gửi email xác nhận đặt phòng đến {email}");
            // Không throw exception để không ảnh hưởng đến quá trình đặt phòng
        }
    }

    /// <summary>
    /// Gửi hóa đơn điện tử về email khách hàng (gửi khi hoàn tất thanh toán)
    /// </summary>
    private async Task SendInvoiceEmail(string email, string hoTen, HoaDon hoaDon)
    {
        try
        {
            _logger.LogInformation($"📧 [Email 2] Gửi hóa đơn thanh toán {hoaDon.IdhoaDon} đến {email}");
            
            // TODO: Tích hợp email service (SendGrid, SMTP, MailKit, etc.)
            // Nội dung email hóa đơn:
            
            var emailSubject = $"✅ XÁC NHẬN THANH TOÁN THÀNH CÔNG - Mã hóa đơn #{hoaDon.IdhoaDon}";
            var emailBody = $@"
Kính gửi Quý khách {hoTen},

🎉 THANH TOÁN THÀNH CÔNG!
Cảm ơn Quý khách đã hoàn tất thanh toán đặt phòng tại Khách Sạn Robins Villa.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 THÔNG TIN HÓA ĐƠN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🧾 Mã hóa đơn:        {hoaDon.IdhoaDon}
📋 Mã đặt phòng:      {hoaDon.IddatPhong}
📅 Ngày lập:          {hoaDon.NgayLap:dd/MM/yyyy HH:mm:ss}
✅ Trạng thái:        ĐÃ THANH TOÁN THÀNH CÔNG

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 CHI TIẾT THANH TOÁN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

� Tiền phòng:        {hoaDon.TienPhong:N0} VNĐ
📆 Số ngày:           {hoaDon.Slngay} {(hoaDon.Slngay > 1 ? "ngày" : "ngày")}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💵 Tổng tiền:         {hoaDon.TongTien:N0} VNĐ
💸 Tiền cọc đã trả:   {hoaDon.TienCoc:N0} VNĐ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💳 Số tiền đã thanh toán: {hoaDon.TienThanhToan:N0} VNĐ

✅ TRẠNG THÁI: ĐÃ THANH TOÁN HOÀN TẤT

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{(string.IsNullOrEmpty(hoaDon.GhiChu) ? "" : $"📝 GHI CHÚ\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n{hoaDon.GhiChu}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")}
📧 Hóa đơn điện tử này có giá trị như hóa đơn gốc.
📱 Vui lòng xuất trình email này khi làm thủ tục nhận phòng.

🏨 Chúng tôi rất mong được phục vụ Quý khách!
Chúc Quý khách có một kỳ nghỉ tuyệt vời tại Robins Villa!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Trân trọng,
Khách Sạn Robins Villa
📧 Email: nguyenduonglechi.1922@gmail.com
📞 Hotline: 1900-xxxx (24/7)
";
            
            // Log email
            _logger.LogInformation($"✉️ Email Subject: {emailSubject}");
            _logger.LogInformation($"✉️ Email Body:\n{emailBody}");
            
            // ✅ GỬI EMAIL THẬT
            await _emailService.SendEmailAsync(email, hoTen, emailSubject);
            
            await Task.CompletedTask;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"❌ Lỗi khi gửi email hóa đơn đến {email}");
            // Không throw exception để không ảnh hưởng đến quá trình thanh toán
        }
    }

    /// <summary>
    /// Lấy thông báo thành công theo phương thức thanh toán
    /// </summary>
    private string GetSuccessMessage(int phuongThuc)
    {
        return phuongThuc switch
        {
            1 => "Tạo hóa đơn thành công. Khách hàng sẽ thanh toán tiền mặt khi đến.",
            2 => "Tạo hóa đơn thành công. Đang chuyển hướng sang cổng thanh toán online...",
            3 => "Tạo hóa đơn thành công. Khách hàng sẽ thanh toán sau tại quầy.",
            _ => "Tạo hóa đơn thành công."
        };
    }

    /// <summary>
    /// Lấy text trạng thái thanh toán
    /// </summary>
    private string GetPaymentStatusText(int trangThai)
    {
        return trangThai switch
        {
            -1 => "Chưa cọc",
            0 => "Chưa thanh toán",
            1 => "Đã cọc",
            2 => "Đã thanh toán",
            _ => "Không xác định"
        };
    }
}
}
}