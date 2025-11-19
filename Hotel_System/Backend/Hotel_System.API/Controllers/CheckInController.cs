using Hotel_System.API.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace Hotel_System.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class CheckInController : ControllerBase
    {
        private readonly HotelSystemContext _context;
        private readonly ILogger<CheckInController> _logger;
        private readonly Hotel_System.API.Services.IEmailService _emailService;

        public CheckInController(HotelSystemContext context, ILogger<CheckInController> logger, Hotel_System.API.Services.IEmailService emailService)
        {
            _context = context;
            _logger = logger;
            _emailService = emailService;
        }

        // POST: api/CheckIn/extend/{id}
        // Extend a booking's checkout date. Body: { "newCheckout": "yyyy-MM-dd" }
        [HttpPost("extend/{id}")]
        public async Task<IActionResult> Extend(string id, [FromBody] ExtendRequest req)
        {
            if (string.IsNullOrWhiteSpace(id)) return BadRequest(new { message = "Mã đặt phòng không hợp lệ." });
            if (req == null || string.IsNullOrWhiteSpace(req.NewCheckout)) return BadRequest(new { message = "Ngày trả mới (newCheckout) là bắt buộc." });

            if (!DateOnly.TryParse(req.NewCheckout, out var newCheckout))
            {
                return BadRequest(new { message = "Định dạng ngày không hợp lệ. Vui lòng dùng yyyy-MM-dd." });
            }

            var booking = await _context.DatPhongs
                .Include(dp => dp.ChiTietDatPhongs)
                .Include(dp => dp.HoaDons).ThenInclude(h => h.Cthddvs)
                .FirstOrDefaultAsync(dp => dp.IddatPhong == id);

            if (booking == null) return NotFound(new { message = "Không tìm thấy đặt phòng." });

            try
            {
                var oldCheckout = booking.NgayTraPhong;
                if (oldCheckout == default) return BadRequest(new { message = "Đặt phòng chưa có Ngày trả (NgayTraPhong) để gia hạn." });

                var oldDt = oldCheckout.ToDateTime(TimeOnly.MinValue);
                var newDt = newCheckout.ToDateTime(TimeOnly.MinValue);
                var extraDays = (int)(newDt - oldDt).TotalDays;
                if (extraDays <= 0) return BadRequest(new { message = "Ngày trả mới phải lớn hơn ngày trả hiện tại." });

                var oldTotal = booking.TongTien;

                foreach (var ct in booking.ChiTietDatPhongs ?? new System.Collections.Generic.List<ChiTietDatPhong>())
                {
                    ct.SoDem = (ct.SoDem > 0) ? ct.SoDem + extraDays : extraDays;
                    var lineTotal = ct.GiaPhong * ct.SoDem;
                    ct.ThanhTien = Math.Round(lineTotal, 0, MidpointRounding.AwayFromZero);
                }

                booking.SoDem = (booking.SoDem.HasValue && booking.SoDem.Value > 0) ? booking.SoDem.Value + extraDays : (booking.ChiTietDatPhongs?.Max(ct => ct.SoDem) ?? extraDays);

                var roomsTotal = booking.ChiTietDatPhongs?.Sum(ct => ct.ThanhTien) ?? 0m;
                var servicesTotal = booking.HoaDons?.SelectMany(h => h.Cthddvs ?? new System.Collections.Generic.List<Cthddv>()).Sum(s => (decimal?)s.TienDichVu) ?? 0m;
                var newTotal = roomsTotal + servicesTotal;

                booking.TongTien = newTotal;
                booking.NgayTraPhong = newCheckout;

                var latestHd = booking.HoaDons?.OrderByDescending(h => h.NgayLap).FirstOrDefault();
                if (latestHd != null)
                {
                    latestHd.TongTien = booking.TongTien;
                    if (latestHd.TrangThaiThanhToan == 2 && (latestHd.TienThanhToan ?? 0m) <= 0m)
                    {
                        var coc = booking.TienCoc ?? 0m;
                        latestHd.TienThanhToan = Math.Max(0m, latestHd.TongTien - coc);
                    }
                }

                await _context.SaveChangesAsync();

                var extraCost = newTotal - oldTotal;
                return Ok(new { message = "Gia hạn thành công.", bookingId = booking.IddatPhong, extraDays, newCheckout = booking.NgayTraPhong.ToString("yyyy-MM-dd"), extraCost, total = booking.TongTien });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi gia hạn đặt phòng {Id}", id);
                return StatusCode(500, new { message = "Lỗi server.", error = ex.Message });
            }
        }

        // POST: api/CheckIn/late-checkout/{id}
        // Request body: { "actualCheckout": "2025-11-19T16:30:00" } (ISO) - optional, default = now
        [HttpPost("late-checkout/{id}")]
        public async Task<IActionResult> LateCheckout(string id, [FromBody] LateCheckoutRequest req)
        {
            if (string.IsNullOrWhiteSpace(id)) return BadRequest(new { message = "Mã đặt phòng không hợp lệ." });

            DateTime actualCheckout = DateTime.Now;
            if (req != null && !string.IsNullOrWhiteSpace(req.ActualCheckout))
            {
                if (!DateTime.TryParse(req.ActualCheckout, out var parsed))
                {
                    return BadRequest(new { message = "Định dạng actualCheckout không hợp lệ. Dùng ISO datetime." });
                }
                actualCheckout = parsed;
            }

            var booking = await _context.DatPhongs
                .Include(dp => dp.ChiTietDatPhongs)
                .Include(dp => dp.HoaDons)
                    .ThenInclude(h => h.Cthddvs)
                .FirstOrDefaultAsync(dp => dp.IddatPhong == id);

            if (booking == null) return NotFound(new { message = "Không tìm thấy đặt phòng." });

            try
            {
                // Define standard checkout time: 12:00
                var checkoutStandard = new TimeSpan(12, 0, 0);
                var t = actualCheckout.TimeOfDay;

                decimal percentage = 0m;
                bool convertToExtraNight = false;

                if (t <= TimeSpan.FromHours(12))
                {
                    percentage = 0m; // no fee
                }
                else if (t <= TimeSpan.FromHours(15))
                {
                    percentage = 0.30m; // 30%
                }
                else if (t <= TimeSpan.FromHours(18))
                {
                    percentage = 0.50m; // 50%
                }
                else
                {
                    percentage = 1.00m; // full night
                    convertToExtraNight = true;
                }

                // If percentage == 0, nothing to charge
                if (percentage == 0m)
                {
                    return Ok(new { message = "Trả phòng đúng giờ. Không thu phí trả phòng muộn.", charged = false });
                }

                // Ensure we have room lines
                var roomLines = booking.ChiTietDatPhongs ?? new System.Collections.Generic.List<ChiTietDatPhong>();

                decimal totalFee = 0m;
                var feeDetails = new System.Collections.Generic.List<object>();

                // For >18:00 case, will add one extra night per room (also update SoDem and ThanhTien)
                if (convertToExtraNight)
                {
                    foreach (var ct in roomLines)
                    {
                        var oneNight = ct.GiaPhong;
                        ct.SoDem = (ct.SoDem > 0) ? ct.SoDem + 1 : 1;
                        ct.ThanhTien = Math.Round(ct.GiaPhong * ct.SoDem, 0, MidpointRounding.AwayFromZero);
                        totalFee += oneNight;
                        feeDetails.Add(new { id = ct.IDChiTiet, roomId = ct.IDPhong, fee = oneNight, type = "extra_night" });
                    }

                    // bump booking.NgayTraPhong by 1 day
                    booking.NgayTraPhong = booking.NgayTraPhong.AddDays(1);
                }
                else
                {
                    // percentage-based fee (30% or 50%) - apply per room but do not change SoDem
                    foreach (var ct in roomLines)
                    {
                        var fee = Math.Round(ct.GiaPhong * percentage, 0, MidpointRounding.AwayFromZero);
                        totalFee += fee;
                        feeDetails.Add(new { id = ct.IDChiTiet, roomId = ct.IDPhong, fee, type = "percentage" });
                    }
                }

                // Recompute booking totals (rooms + existing services)
                var roomsTotal = roomLines.Sum(ct => ct.ThanhTien);
                var servicesTotal = booking.HoaDons?.SelectMany(h => h.Cthddvs ?? new System.Collections.Generic.List<Cthddv>()).Sum(s => (decimal?)s.TienDichVu) ?? 0m;
                var newTotal = roomsTotal + servicesTotal + totalFee;

                booking.TongTien = newTotal;

                // Add fee as service line(s) into latest invoice
                var latestHd = booking.HoaDons?.OrderByDescending(h => h.NgayLap).FirstOrDefault();
                if (latestHd == null)
                {
                    // create a new invoice
                    latestHd = new HoaDon
                    {
                        IdhoaDon = Guid.NewGuid().ToString(),
                        IddatPhong = booking.IddatPhong,
                        NgayLap = DateTime.Now,
                        TongTien = newTotal,
                        TienCoc = booking.TienCoc,
                        TrangThaiThanhToan = 1 // default unpaid
                    };
                    _context.HoaDons.Add(latestHd);
                    if (booking.HoaDons == null) booking.HoaDons = new System.Collections.Generic.List<HoaDon>();
                    booking.HoaDons.Add(latestHd);
                }

                // Ensure a DichVu entry exists for Late Checkout
                var lateService = await _context.DichVus.FirstOrDefaultAsync(d => d.TenDichVu == "Phí trả phòng muộn");
                if (lateService == null)
                {
                    lateService = new DichVu
                    {
                        IddichVu = "LATE_CHECKOUT",
                        TenDichVu = "Phí trả phòng muộn",
                        TienDichVu = 0m,
                        TrangThai = "Đang hoạt động"
                    };
                    _context.DichVus.Add(lateService);
                    await _context.SaveChangesAsync();
                }

                // create service lines
                foreach (var fd in feeDetails)
                {
                    decimal feeAmt = 0m;
                    try
                    {
                        // dynamic access to fee value
                        var feeProp = fd.GetType().GetProperty("fee");
                        if (feeProp != null) feeAmt = (decimal)feeProp.GetValue(fd)!;
                    }
                    catch { }

                    var cth = new Cthddv
                    {
                        IdhoaDon = latestHd.IdhoaDon,
                        IddichVu = lateService.IddichVu,
                        TienDichVu = feeAmt,
                        ThoiGianThucHien = DateTime.Now,
                        TrangThai = "Tạo bởi hệ thống - Trả phòng muộn"
                    };
                    latestHd.Cthddvs.Add(cth);
                    _context.Cthddvs.Add(cth);
                }

                // update invoice totals
                latestHd.TongTien = (latestHd.TongTien) + totalFee;
                if (latestHd.TrangThaiThanhToan == 2)
                {
                    var coc = booking.TienCoc ?? 0m;
                    latestHd.TienThanhToan = Math.Max(0m, latestHd.TongTien - coc);
                }

                await _context.SaveChangesAsync();

                return Ok(new
                {
                    message = "Áp dụng phí trả phòng muộn thành công.",
                    bookingId = booking.IddatPhong,
                    charged = true,
                    totalFee,
                    feeDetails,
                    newCheckout = booking.NgayTraPhong.ToString("yyyy-MM-dd"),
                    total = booking.TongTien
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi áp dụng phí trả phòng muộn cho {Id}", id);
                return StatusCode(500, new { message = "Lỗi server.", error = ex.Message });
            }
        }

        public class LateCheckoutRequest { public string? ActualCheckout { get; set; } }

        public class ExtendRequest { public string NewCheckout { get; set; } = string.Empty; }

        private async Task<bool> TrySendEmailAsync(string to, string subject, string body)
        {
            try
            {
                var type = _emailService.GetType();

                var m5 = type.GetMethod("SendEmailAsync", new[] { typeof(string), typeof(string), typeof(string), typeof(string), typeof(bool) });
                if (m5 != null)
                {
                    var task = (Task)m5.Invoke(_emailService, new object[] { to, subject, body, true, true })!; 
                    await task.ConfigureAwait(false);
                    return true;
                }

                var m4 = type.GetMethod("SendEmailAsync", new[] { typeof(string), typeof(string), typeof(string), typeof(string) });
                if (m4 != null)
                {
                    var task = (Task)m4.Invoke(_emailService, new object[] { to, subject, body })!;
                    await task.ConfigureAwait(false);
                    return true;
                }

                // fallback to common 3-arg signature
                await _emailService.SendEmailAsync(to, subject, body);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "TrySendEmailAsync failed to send to {To}", to);
                return false;
            }
        }

        
        // GET: api/CheckIn/today
        // Return bookings that have NgayNhanPhong == today and TrangThai == 2 (ready/confirmed)
        [HttpGet("today")]
        public async Task<IActionResult> GetTodayBookings()
        {
            var today = DateOnly.FromDateTime(DateTime.Now);

            // Return bookings for today that are either "Đã nhận phòng" (2) or "Đang sử dụng" (3)
            var list = await _context.DatPhongs
                .Where(dp => dp.NgayNhanPhong == today && (dp.TrangThai == 2 || dp.TrangThai == 3))
                .Include(dp => dp.ChiTietDatPhongs)
                .Include(dp => dp.IdkhachHangNavigation)
                .Include(dp => dp.IdphongNavigation)
                .Select(dp => new
                {
                    IddatPhong = dp.IddatPhong,
                    TenKhachHang = dp.IdkhachHangNavigation != null ? dp.IdkhachHangNavigation.HoTen : null,
                    EmailKhachHang = dp.IdkhachHangNavigation != null ? dp.IdkhachHangNavigation.Email : null,
                    Idphong = dp.Idphong,
                    TenPhong = dp.IdphongNavigation != null ? dp.IdphongNavigation.TenPhong : null,
                    SoPhong = dp.IdphongNavigation != null ? dp.IdphongNavigation.SoPhong : null,
                    NgayNhanPhong = dp.NgayNhanPhong,
                    NgayTraPhong = dp.NgayTraPhong,
                    SoDem = dp.SoDem,
                    TongTien = dp.TongTien,
                    TienCoc = dp.TienCoc,
                    TrangThai = dp.TrangThai,
                    TrangThaiThanhToan = dp.TrangThaiThanhToan
                })
                .ToListAsync();

            return Ok(list);
        }

        // GET: api/CheckIn/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> Get(string id)
        {
            if (string.IsNullOrWhiteSpace(id)) return BadRequest(new { message = "Mã đặt phòng không hợp lệ." });
            var booking = await _context.DatPhongs
                .Include(dp => dp.ChiTietDatPhongs)
                .Include(dp => dp.IdkhachHangNavigation)
                .Include(dp => dp.IdphongNavigation)
                .Include(dp => dp.HoaDons)
                    .ThenInclude(h => h.Cthddvs)
                        .ThenInclude(c => c.IddichVuNavigation)
                .FirstOrDefaultAsync(dp => dp.IddatPhong == id);

            if (booking == null) return NotFound(new { message = "Không tìm thấy đặt phòng." });

            // Project to a safe DTO to avoid EF circular references during JSON serialization
            var result = new
            {
                booking.IddatPhong,
                booking.IdkhachHang,
                TenKhachHang = booking.IdkhachHangNavigation?.HoTen,
                EmailKhachHang = booking.IdkhachHangNavigation?.Email,
                booking.Idphong,
                TenPhong = booking.IdphongNavigation?.TenPhong,
                SoPhong = booking.IdphongNavigation?.SoPhong,
                NgayDatPhong = booking.NgayDatPhong.HasValue ? booking.NgayDatPhong.Value.ToString("yyyy-MM-dd") : null,
                NgayNhanPhong = booking.NgayNhanPhong.ToString("yyyy-MM-dd"),
                NgayTraPhong = booking.NgayTraPhong.ToString("yyyy-MM-dd"),
                booking.SoDem,
                SoNguoi = booking.SoNguoi,
                booking.TongTien,
                booking.TienCoc,
                booking.TrangThai,
                booking.TrangThaiThanhToan,
                ChiTietDatPhongs = booking.ChiTietDatPhongs.Select(ct => new
                {
                    ct.IDChiTiet,
                    ct.IDPhong,
                    TenPhongChiTiet = (ct as dynamic)?.Phong?.TenPhong ?? ct.IDPhong,
                    SoPhongChiTiet = (ct as dynamic)?.Phong?.SoPhong,
                    ct.SoDem,
                    ct.GiaPhong,
                    ct.ThanhTien,
                    ct.GhiChu
                }).ToList(),
                HoaDons = booking.HoaDons.Select(hd => new
                {
                    hd.IdhoaDon,
                    hd.IddatPhong,
                    hd.NgayLap,
                    hd.TongTien,
                    hd.TrangThaiThanhToan,
                    Cthddvs = hd.Cthddvs.Select(ct => new
                    {
                        ct.Idcthddv,
                        ct.IddichVu,
                        TenDichVu = ct.IddichVuNavigation?.TenDichVu,
                        TienDichVu = ct.TienDichVu,
                        ct.ThoiGianThucHien
                    }).ToList()
                }).ToList()
            };

            return Ok(result);
        }

        // POST: api/CheckIn/start/{id}
        // Mark the booking as 'Đang sử dụng' (TrangThai = 3) and set NgayNhanPhong to now if not set
        [HttpPost("start/{id}")]
        public async Task<IActionResult> StartCheckIn(string id)
        {
            if (string.IsNullOrWhiteSpace(id)) return BadRequest(new { message = "Mã đặt phòng không hợp lệ." });

            var booking = await _context.DatPhongs.FirstOrDefaultAsync(dp => dp.IddatPhong == id);
            if (booking == null) return NotFound(new { message = "Không tìm thấy đặt phòng." });

            try
            {
                booking.TrangThai = 3; // Đang sử dụng
                // If NgayNhanPhong is default, set to today
                if (booking.NgayNhanPhong == default)
                    booking.NgayNhanPhong = DateOnly.FromDateTime(DateTime.Now);

                await _context.SaveChangesAsync();
                return Ok(new { message = "Bắt đầu nhận phòng thành công.", bookingId = booking.IddatPhong, trangThai = booking.TrangThai });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi bắt đầu nhận phòng cho {Id}", id);
                return StatusCode(500, new { message = "Lỗi server.", error = ex.Message });
            }
        }

    // PUT/POST: api/CheckIn/confirm/{id}
    // Confirm a booking as 'Đang sử dụng' (TrangThai = 3). Accepts either PUT or POST for compatibility.
    [HttpPost("confirm/{id}")]
        public async Task<IActionResult> ConfirmCheckIn(string id)
        {
            if (string.IsNullOrWhiteSpace(id)) return BadRequest(new { message = "Mã đặt phòng không hợp lệ." });

            var booking = await _context.DatPhongs
                .Include(dp => dp.IdkhachHangNavigation)
                .Include(dp => dp.IdphongNavigation)
                .FirstOrDefaultAsync(dp => dp.IddatPhong == id);
            if (booking == null) return NotFound(new { message = "Không tìm thấy đặt phòng." });

            try
            {
                booking.TrangThai = 3; // Đang sử dụng
                if (booking.NgayNhanPhong == default)
                    booking.NgayNhanPhong = DateOnly.FromDateTime(DateTime.Now);

                await _context.SaveChangesAsync();
                // send notification email if we have customer's email
                bool emailSent = false;
                try
                {
                    var email = booking.IdkhachHangNavigation?.Email;
                    var customerName = booking.IdkhachHangNavigation?.HoTen ?? "Khách hàng";
                    if (!string.IsNullOrWhiteSpace(email))
                    {
                        var subject = $"Xác nhận nhận phòng - {booking.IddatPhong}";
                        var roomName = booking.IdphongNavigation?.TenPhong ?? booking.Idphong;
                        // Prepare date/time and guest info safely
                        var checkinDt = booking.NgayNhanPhong.ToDateTime(new TimeOnly(14, 0));
                        var checkoutDt = booking.NgayTraPhong.ToDateTime(new TimeOnly(12, 0));
                        var checkinStr = checkinDt.ToString("dddd, dd/MM/yyyy 'lúc' HH:mm");
                        var checkoutStr = checkoutDt.ToString("dddd, dd/MM/yyyy 'lúc' HH:mm");
                        var nights = (booking.NgayTraPhong.ToDateTime(new TimeOnly(0, 0)) - booking.NgayNhanPhong.ToDateTime(new TimeOnly(0, 0))).Days;
                        var soKhach = booking.SoNguoi ?? 1;
                        var soTreEm = 0; // field for children not present in model; default to 0

                        var body = $"<p>Xin chào <strong>{customerName}</strong>,</p>" +
           $"<p>Chúng tôi rất vui mừng thông báo: Đơn đặt phòng <strong>{booking.IddatPhong}</strong> của Quý khách đã được xác nhận và <strong>NHẬN PHÒNG THÀNH CÔNG</strong>!</p>" +
           $"<p><strong>≡ THÔNG TIN LƯU TRÚ ≡</strong><br/>" +
           $"• Họ & tên: {customerName}<br/>" +
           $"• Loại phòng: <strong>{roomName}</strong><br/>" +
           $"• Số phòng: <strong>{booking.Idphong}</strong><br/>" +
           $"• Ngày nhận phòng: {checkinStr}<br/>" +
           $"• Ngày trả phòng: {checkoutStr}<br/>" +
           $"• Số đêm nghỉ: <strong>{nights} đêm</strong><br/>" +
           $"• Số lượng khách: {soKhach} người lớn{(soTreEm > 0 ? $", {soTreEm} trẻ em" : "")} </p>" +
           $"• Dịch vụ phòng 24/7: Bấm số 034444444 từ điện thoại trong phòng<br/>" +
           $"• Yêu cầu trả phòng muộn: Liên hệ lễ tân trước 10:00</p>" +
           $"<p>Nếu cần hỗ trợ bất kỳ lúc nào, Quý khách vui lòng liên hệ lễ tân qua số máy lẻ <strong>0</strong> hoặc hotline <strong>0909 888 999</strong>.</p>" +
           $"<p>Chúc Quý khách có kỳ nghỉ thật tuyệt vời và đáng nhớ tại Robins Villa!</p>" +
           $"<p>Trân trọng,</p>" +
           $"<p>Khách sạn Robins Villa</p>";

                        emailSent = await TrySendEmailAsync(email, subject, body);
                    }
                }
                catch (Exception ex2)
                {
                    _logger.LogError(ex2, "Lỗi gửi email xác nhận cho đặt phòng {Id}", id);
                }

                return Ok(new { message = "Xác nhận nhận phòng thành công.", bookingId = booking.IddatPhong, trangThai = booking.TrangThai, emailSent });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi xác nhận nhận phòng cho {Id}", id);
                return StatusCode(500, new { message = "Lỗi server.", error = ex.Message });
            }
        }

    // PUT/POST: api/CheckIn/cancel/{id}
    // Cancel a booking (no-show) and set the room status to empty/available
    [HttpPut("cancel/{id}")]
        public async Task<IActionResult> CancelBooking(string id)
        {
            if (string.IsNullOrWhiteSpace(id)) return BadRequest(new { message = "Mã đặt phòng không hợp lệ." });

            var booking = await _context.DatPhongs
                .Include(dp => dp.IdphongNavigation)
                .FirstOrDefaultAsync(dp => dp.IddatPhong == id);

            if (booking == null) return NotFound(new { message = "Không tìm thấy đặt phòng." });

            try
            {
                // 0 = Hủy (as defined in schema)
                booking.TrangThai = 0;

                // If the room navigation is present, mark the room as empty/available
                if (booking.IdphongNavigation != null)
                {
                    booking.IdphongNavigation.TrangThai = "Trống";
                }

                await _context.SaveChangesAsync();

                return Ok(new { message = "Hủy đặt phòng thành công.", bookingId = booking.IddatPhong, trangThai = booking.TrangThai });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi hủy đặt phòng {Id}", id);
                return StatusCode(500, new { message = "Lỗi server.", error = ex.Message });
            }
        }

        // POST: api/CheckIn/change-room/{id}
        // Body: { "newRoomId": "<room id>" }
        [HttpPost("change-room/{id}")]
        public async Task<IActionResult> ChangeRoom(string id, [FromBody] ChangeRoomRequest req)
        {
            if (string.IsNullOrWhiteSpace(id)) return BadRequest(new { message = "Mã đặt phòng không hợp lệ." });
            if (req == null || string.IsNullOrWhiteSpace(req.NewRoomId)) return BadRequest(new { message = "newRoomId is required." });

            try
            {
                var booking = await _context.DatPhongs
                    .Include(dp => dp.IdphongNavigation)
                    .Include(dp => dp.ChiTietDatPhongs)
                    .FirstOrDefaultAsync(dp => dp.IddatPhong == id);

                if (booking == null) return NotFound(new { message = "Không tìm thấy đặt phòng." });

                // ensure target room exists
                var target = await _context.Phongs.FirstOrDefaultAsync(p => p.Idphong == req.NewRoomId);
                if (target == null) return NotFound(new { message = "Phòng đích không tồn tại." });

                // Check availability: we use simple status check 'Trống' to determine free room
                // (alternatively you can check overlapping DatPhong rows). If room is not empty, reject.
                var targetStatus = (target.TrangThai ?? string.Empty).Trim();
                if (!string.IsNullOrEmpty(targetStatus) && !string.Equals(targetStatus, "Trống", StringComparison.OrdinalIgnoreCase))
                {
                    return BadRequest(new { message = "Phòng đích hiện không trống." });
                }

                var oldRoom = booking.IdphongNavigation;

                // update booking's room reference
                booking.Idphong = target.Idphong;
                booking.IdphongNavigation = target;

                // Update ChiTietDatPhong entries if they reference the old room id
                if (booking.ChiTietDatPhongs != null)
                {
                    foreach (var ct in booking.ChiTietDatPhongs)
                    {
                        // if the line references the previous room, update it
                        if (!string.IsNullOrWhiteSpace(ct.IDPhong) && ct.IDPhong == (oldRoom?.Idphong ?? booking.Idphong))
                        {
                            ct.IDPhong = target.Idphong;
                            // Optionally update TenPhong if stored in DTOs later
                        }
                    }
                }

                // mark old room as empty and new room as occupied
                try
                {
                    if (oldRoom != null)
                    {
                        oldRoom.TrangThai = "Trống";
                    }
                    target.TrangThai = "Đang sử dụng";
                }
                catch { /* non-fatal */ }

                await _context.SaveChangesAsync();

                return Ok(new { message = "Đổi phòng thành công.", bookingId = booking.IddatPhong, newRoom = target.Idphong });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi đổi phòng cho {Id}", id);
                return StatusCode(500, new { message = "Lỗi server.", error = ex.Message });
            }
        }

        public class ChangeRoomRequest { public string NewRoomId { get; set; } = string.Empty; }

        // POST: api/CheckIn/complete-payment/{id}
        // Mark the booking as paid (TrangThaiThanhToan = 2) but keep TrangThai unchanged (e.g., still 3 = Đang sử dụng)
        [HttpPost("complete-payment/{id}")]
        public async Task<IActionResult> CompletePayment(string id)
        {
            if (string.IsNullOrWhiteSpace(id)) return BadRequest(new { message = "Mã đặt phòng không hợp lệ." });

            var booking = await _context.DatPhongs.FirstOrDefaultAsync(dp => dp.IddatPhong == id);
            if (booking == null) return NotFound(new { message = "Không tìm thấy đặt phòng." });

            try
            {
                // Only change payment status to 'Đã thanh toán' (2). Do NOT change booking.TrangThai here.
                booking.TrangThaiThanhToan = 2;

                await _context.SaveChangesAsync();

                return Ok(new { message = "Cập nhật trạng thái thanh toán thành công.", bookingId = booking.IddatPhong, trangThai = booking.TrangThai, trangThaiThanhToan = booking.TrangThaiThanhToan });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi cập nhật trạng thái thanh toán cho {Id}", id);
                return StatusCode(500, new { message = "Lỗi server.", error = ex.Message });
            }
        }
    }
}
