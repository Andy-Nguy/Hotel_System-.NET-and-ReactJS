using Hotel_System.API.Models;
using Hotel_System.API.Services;
using Microsoft.AspNetCore.Authorization;
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
        private readonly Hotel_System.API.Services.EmailTemplateRenderer _templateRenderer;
        private readonly RoomService _roomService;

        public CheckInController(HotelSystemContext context, ILogger<CheckInController> logger, Hotel_System.API.Services.IEmailService emailService, Hotel_System.API.Services.EmailTemplateRenderer templateRenderer, RoomService roomService)
        {
            _context = context;
            _logger = logger;
            _emailService = emailService;
            _templateRenderer = templateRenderer;
            _roomService = roomService;
        }

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

                await _emailService.SendEmailAsync(to, subject, body);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "TrySendEmailAsync failed to send to {To}", to);
                return false;
            }
        }

        // GET: api/NhanPhong
        // Return bookings that are currently 'Đang sử dụng' (TrangThai == 3)
        [HttpGet]
        public async Task<IActionResult> GetUsingBookings()
        {
            var list = await _context.DatPhongs
                .Where(dp => dp.TrangThai == 3)
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

        // GET: api/CheckIn/hom-nay
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
                // Enforce fixed check-in time: 14:00 on the booking date
                var now = DateTime.Now;
                var allowedCheckIn = booking.NgayNhanPhong.ToDateTime(new TimeOnly(14, 0));

                if (now < allowedCheckIn)
                {
                    return BadRequest(new { message = $"Chưa đến giờ nhận phòng. Vui lòng chờ đến {allowedCheckIn:HH:mm} ngày {allowedCheckIn:dd/MM/yyyy}." });
                }

                // Check if any booking is currently using this room (TrangThai == 3), excluding this booking
                var currentOccupant = await _context.DatPhongs
                    .Where(dp => dp.Idphong == booking.Idphong && dp.TrangThai == 3 && dp.IddatPhong != booking.IddatPhong)
                    .OrderByDescending(dp => dp.NgayNhanPhong)
                    .FirstOrDefaultAsync();

                if (currentOccupant != null)
                {
                    // Determine whether the two bookings overlap. If the new booking starts after the current occupant's end, allow check-in.
                    var currentEnd = currentOccupant.NgayTraPhong;
                    var bookingStart = booking.NgayNhanPhong;

                    if (bookingStart > currentEnd)
                    {
                        // no overlap in dates — allow check-in
                    }
                    else
                    {
                        var today = DateOnly.FromDateTime(DateTime.Now);

                        // If the current occupant was expected to checkout today, mark overdue and prompt reassign
                        if (currentOccupant.NgayTraPhong == today)
                        {
                            // mark occupant overdue and mark room status accordingly
                            currentOccupant.TrangThai = 5; // Quá hạn
                            if (currentOccupant.IdphongNavigation != null)
                            {
                                currentOccupant.IdphongNavigation.TrangThai = "Quá hạn";
                            }
                            await _context.SaveChangesAsync();

                            // Inform operator that room is overdue and cannot be checked-in
                            return BadRequest(new { message = "Phòng hiện đang bị quá hạn (khách chưa trả phòng). Vui lòng đợi hoặc sắp xếp phòng khác." });
                        }

                        // Otherwise block check-in — room is still occupied by another booking
                        return BadRequest(new { message = "Phòng đang có khách sử dụng. Vui lòng kiểm tra tình trạng phòng hoặc chuyển phòng khác." });
                    }
                }

                booking.TrangThai = 3; // Đang sử dụng
                if (booking.NgayNhanPhong == default)
                    booking.NgayNhanPhong = DateOnly.FromDateTime(DateTime.Now);

                // Cập nhật trạng thái phòng thành "Đang sử dụng"
                if (booking.IdphongNavigation != null)
                {
                    booking.IdphongNavigation.TrangThai = "Đang sử dụng";
                }

                await _context.SaveChangesAsync();

                // Do not send emails here; simply acknowledge success to the operator
                return Ok(new { message = "Xác nhận nhận phòng thành công.", bookingId = booking.IddatPhong, trangThai = booking.TrangThai });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi xác nhận nhận phòng cho {Id}", id);
                return StatusCode(500, new { message = "Lỗi server.", error = ex.Message });
            }
        }

        // DTO for reassign request
        public class ReassignRoomRequest
        {
            public string NewRoomId { get; set; } = null!;
        }

        // POST: api/CheckIn/reassign-room/{id}
        // Reassign the booking to a different room (performed by receptionist when original room is unavailable)
        [HttpPost("reassign-room/{id}")]
        public async Task<IActionResult> ReassignRoom(string id, [FromBody] ReassignRoomRequest req)
        {
            if (string.IsNullOrWhiteSpace(id)) return BadRequest(new { message = "Mã đặt phòng không hợp lệ." });
            if (req == null || string.IsNullOrWhiteSpace(req.NewRoomId)) return BadRequest(new { message = "Mã phòng mới không hợp lệ." });

            var booking = await _context.DatPhongs
                .Include(dp => dp.ChiTietDatPhongs)
                .Include(dp => dp.IdphongNavigation)
                .Include(dp => dp.HoaDons)
                .FirstOrDefaultAsync(dp => dp.IddatPhong == id);
            if (booking == null) return NotFound(new { message = "Không tìm thấy đặt phòng." });

            var newRoom = await _context.Phongs.FindAsync(req.NewRoomId);
            if (newRoom == null) return NotFound(new { message = "Phòng mới không tồn tại." });

            try
            {
                // Check availability for the requested dates
                var checkInDt = booking.NgayNhanPhong.ToDateTime(new TimeOnly(0, 0));
                var checkOutDt = booking.NgayTraPhong.ToDateTime(new TimeOnly(0, 0));
                var available = await _roomService.CheckAvailableRoomsAsync(checkInDt, checkOutDt, booking.SoNguoi ?? 1);
                var found = available.FirstOrDefault(r => string.Equals(r.RoomId, req.NewRoomId, StringComparison.OrdinalIgnoreCase));
                if (found == null)
                {
                    return BadRequest(new { message = "Phòng được chọn không còn trống cho khoảng thời gian này." });
                }

                // Compute price difference based on base nightly price (fallback to 0)
                decimal oldPrice = booking.IdphongNavigation?.GiaCoBanMotDem ?? 0m;
                decimal newPrice = newRoom.GiaCoBanMotDem ?? 0m;
                int nights = booking.SoDem ?? 1;
                var deltaPerNight = newPrice - oldPrice;

                // Số đêm dùng để tính chênh lệch giá phòng
                // Mặc định: toàn bộ số đêm đã đặt
                int nightsToCharge = nights;

                // Ngày hiện tại (ngày thực hiện đổi phòng)
                var today = DateOnly.FromDateTime(DateTime.Now);

                // Nếu khách đã check-in và hôm nay nằm trong khoảng lưu trú,
                // thì chỉ tính chênh lệch từ hôm nay đến ngày trả phòng (tính luôn đêm hôm nay)
                if (today > booking.NgayNhanPhong && today < booking.NgayTraPhong)
                {
                    nightsToCharge = Math.Max(0, booking.NgayTraPhong.DayNumber - today.DayNumber);
                }
                // Nếu đổi sau hoặc đúng ngày trả phòng thì không còn đêm nào để tính
                else if (today >= booking.NgayTraPhong)
                {
                    nightsToCharge = 0;
                }

                // Tính chênh lệch cơ bản (chưa VAT) theo số đêm áp dụng
                var totalDelta = deltaPerNight * nightsToCharge; // base delta (no VAT)

                // Apply VAT to the delta so booking.TongTien (which stores total AFTER VAT) is adjusted correctly
                var totalDeltaWithVat = Math.Round(totalDelta * 1.1m, 0, MidpointRounding.AwayFromZero);

                // Update booking main fields
                var oldRoomId = booking.Idphong;
                booking.Idphong = req.NewRoomId;
                // Add delta WITH VAT to match how totals are computed elsewhere (room+services then VAT)
                booking.TongTien = booking.TongTien + totalDeltaWithVat;

                // If the new room is more expensive, mark booking and related invoices as unpaid (1 = Chưa thanh toán)
                if (totalDelta > 0)
                {
                    try
                    {
                        booking.TrangThaiThanhToan = 1;
                        if (booking.HoaDons != null)
                        {
                            foreach (var hd in booking.HoaDons)
                            {
                                hd.TrangThaiThanhToan = 1;
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Không thể cập nhật trạng thái thanh toán cho hoá đơn khi đổi phòng cho {Id}", id);
                    }
                }

                // Update any ChiTietDatPhongs entries that reference the old room
                if (booking.ChiTietDatPhongs != null)
                {
                    foreach (var ct in booking.ChiTietDatPhongs)
                    {
                        if (!string.IsNullOrWhiteSpace(ct.IDPhong) && ct.IDPhong == oldRoomId)
                        {
                            ct.IDPhong = req.NewRoomId;
                            // update price if new room has a base price
                            if (newRoom.GiaCoBanMotDem.HasValue)
                            {
                                ct.GiaPhong = newRoom.GiaCoBanMotDem.Value;
                            }
                            // recalc line total
                            ct.ThanhTien = ct.SoDem * ct.GiaPhong;
                        }
                    }
                }

                // Add an audit log entry
                var log = new LichSuDatPhong
                {
                    IddatPhong = booking.IddatPhong,
                    NgayCapNhat = DateTime.Now,
                    GhiChu = $"Chuyển phòng: {oldRoomId} -> {req.NewRoomId}. Chênh lệch tổng: {totalDelta:C} (theo {nightsToCharge} đêm)."
                };
                _context.LichSuDatPhongs.Add(log);

                // If the new room is more expensive, update the existing invoice for this booking
                // rather than creating a new one. This keeps the customer's invoice consolidated.
                string? createdInvoiceId = null;
                if (totalDelta > 0)
                {
                    try
                    {
                        var deltaWithVat = Math.Round(totalDelta * 1.1m, 0, MidpointRounding.AwayFromZero);

                        // Prefer updating the latest invoice for this booking if present
                        var existingInvoice = booking.HoaDons?.OrderByDescending(h => h.NgayLap).FirstOrDefault();
                        if (existingInvoice != null)
                        {
                            // Add delta to base room amount and VAT-inclusive total
                            existingInvoice.TienPhong = (existingInvoice.TienPhong ?? 0) + (int?)Math.Round((double)totalDelta);
                            // TongTien is a non-nullable decimal in the model — add delta directly
                            existingInvoice.TongTien = existingInvoice.TongTien + deltaWithVat;
                            // Mark as unpaid/needs payment confirmation
                            existingInvoice.TrangThaiThanhToan = 1;
                            // Keep TienThanhToan as-is (frontend/admin will compute remaining due)
                            createdInvoiceId = existingInvoice.IdhoaDon;
                        }
                        else
                        {
                            // THEO YÊU CẦU MỚI:
                            // Không tạo hóa đơn mới khi đổi phòng.
                            // Chỉ cập nhật Booking.TongTien & trạng thái thanh toán ở trên.
                            _logger.LogWarning(
                                "ReassignRoom: booking {Id} không có hóa đơn cũ để cập nhật khi đổi phòng. " +
                                "Theo nghiệp vụ mới: KHÔNG tạo hóa đ��n mới. Chênh lệch {Delta} sẽ phản ánh trong TongTien của đặt phòng.",
                                booking.IddatPhong,
                                totalDelta
                            );

                            // createdInvoiceId để nguyên null, frontend không phụ thuộc giá trị này.
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Không thể cập nhật hoá đơn chênh lệch khi đổi phòng cho {Id}", id);
                    }
                }

                await _context.SaveChangesAsync();

                return Ok(new { message = "Đổi phòng thành công.", bookingId = booking.IddatPhong, newRoom = req.NewRoomId, priceDelta = totalDelta, tongTien = booking.TongTien, invoiceId = createdInvoiceId });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi đổi phòng cho {Id}", id);
                return StatusCode(500, new { message = "Lỗi server khi đổi phòng.", error = ex.Message });
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
                .Include(dp => dp.ChiTietDatPhongs)
                    .ThenInclude(ct => ct.Phong)
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

                // Also sync all rooms in ChiTietDatPhongs (for multi-room bookings)
                if (booking.ChiTietDatPhongs != null)
                {
                    foreach (var chiTiet in booking.ChiTietDatPhongs)
                    {
                        if (chiTiet.Phong != null)
                        {
                            chiTiet.Phong.TrangThai = "Trống";
                        }
                    }
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