using System;
using Hotel_System.API.DTOs;
using Hotel_System.API.Models;
using Hotel_System.API.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Hotel_System.API.Controllers;

/// <summary>
/// Controller xử lý đặt phòng và thanh toán
/// Có 3 endpoint riêng biệt để lưu từng bảng
/// LƯU Ý: Khi cùng 1 khách hàng đặt nhiều phòng, IDDatPhong phải giống nhau
/// </summary>
[Route("api/[controller]")]
[ApiController]
public class PaymentController : ControllerBase
{
    private readonly HotelSystemContext _context;
    private readonly ILogger<PaymentController> _logger;
    private readonly IEmailService _emailService;

    public PaymentController(HotelSystemContext context, ILogger<PaymentController> logger, IEmailService emailService)
    {
        _context = context;
        _logger = logger;
        _emailService = emailService;
    }

    // ===================== ADMIN QUERIES =====================
    /// <summary>
    /// Danh sách hóa đơn (lọc theo ngày và trạng thái)
    /// GET /api/Payment/invoices?from=yyyy-MM-dd&to=yyyy-MM-dd&status=0|1|2
    /// </summary>
    [HttpGet("invoices")]
    public async Task<IActionResult> GetInvoices([FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] int? status)
    {
        var query = _context.HoaDons
            .Include(h => h.IddatPhongNavigation)
                .ThenInclude(dp => dp.IdkhachHangNavigation)
            .AsQueryable();

        if (from.HasValue)
            query = query.Where(h => h.NgayLap >= from);
        if (to.HasValue)
            query = query.Where(h => h.NgayLap <= to);
        if (status.HasValue)
            query = query.Where(h => h.TrangThaiThanhToan == status);

        var data = await query
            .OrderByDescending(h => h.NgayLap)
            .Take(1000)
            .Select(h => new
            {
                idHoaDon = h.IdhoaDon,
                idDatPhong = h.IddatPhong,
                ngayLap = h.NgayLap,
                tongTien = h.TongTien,
                tienCoc = h.TienCoc ?? 0,
                tienThanhToan = h.TienThanhToan ?? 0,
                trangThaiThanhToan = h.TrangThaiThanhToan ?? 0,
                ghiChu = h.GhiChu,
                customer = new
                {
                    id = h.IddatPhongNavigation.IdkhachHang,
                    hoTen = h.IddatPhongNavigation.IdkhachHangNavigation != null ? h.IddatPhongNavigation.IdkhachHangNavigation.HoTen : null,
                    email = h.IddatPhongNavigation.IdkhachHangNavigation != null ? h.IddatPhongNavigation.IdkhachHangNavigation.Email : null,
                    soDienThoai = h.IddatPhongNavigation.IdkhachHangNavigation != null ? h.IddatPhongNavigation.IdkhachHangNavigation.SoDienThoai : null,
                    tichDiem = h.IddatPhongNavigation.IdkhachHangNavigation != null ? h.IddatPhongNavigation.IdkhachHangNavigation.TichDiem ?? 0 : 0
                }
            })
            .ToListAsync();

        return Ok(new { success = true, data });
    }

    /// <summary>
    /// Tải PDF hóa đơn
    /// GET /api/Payment/invoice/{idHoaDon}/pdf
    /// </summary>
    [HttpGet("invoice/{idHoaDon}/pdf")]
    public async Task<IActionResult> DownloadInvoicePdf(string idHoaDon)
    {
        var hoaDon = await _context.HoaDons
            .Include(h => h.IddatPhongNavigation)
                .ThenInclude(dp => dp.IdkhachHangNavigation)
            .FirstOrDefaultAsync(h => h.IdhoaDon == idHoaDon);
        if (hoaDon == null)
            return NotFound(new { message = "Không tìm thấy hóa đơn" });

        var kh = hoaDon.IddatPhongNavigation.IdkhachHangNavigation;

        // Build a minimal PDF
        QuestPDF.Settings.License = LicenseType.Community;
        var pdf = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Margin(40);
                page.Header().Text($"Hóa đơn #{hoaDon.IdhoaDon}").FontSize(20).SemiBold();
                page.Content().Column(col =>
                {
                    col.Item().Text($"Mã đặt phòng: {hoaDon.IddatPhong}");
                    col.Item().Text($"Ngày lập: {hoaDon.NgayLap:dd/MM/yyyy HH:mm}");
                    col.Item().Text($"Khách hàng: {kh?.HoTen} - {kh?.Email}");
                    col.Item().LineHorizontal(1);
                    col.Item().Text($"Tiền phòng: {hoaDon.TienPhong ?? 0:N0} đ");
                    col.Item().Text($"Số đêm: {hoaDon.Slngay ?? 0}");
                    col.Item().Text($"Tổng tiền: {hoaDon.TongTien:N0} đ");
                    col.Item().Text($"Tiền cọc: {(hoaDon.TienCoc ?? 0):N0} đ");
                    col.Item().Text($"Đã thanh toán: {(hoaDon.TienThanhToan ?? 0):N0} đ");
                    col.Item().Text($"Trạng thái: {(hoaDon.TrangThaiThanhToan == 2 ? "Đã thanh toán" : "Chờ xử lý")}");
                    if (!string.IsNullOrWhiteSpace(hoaDon.GhiChu))
                        col.Item().PaddingTop(10).Text($"Ghi chú: {hoaDon.GhiChu}");
                });
                page.Footer().AlignCenter().Text("Cảm ơn Quý khách!");
            });
        }).GeneratePdf();

        return File(pdf, "application/pdf", $"HoaDon_{hoaDon.IdhoaDon}.pdf");
    }

    /// <summary>
    /// Gửi lại email hóa đơn
    /// POST /api/Payment/invoice/{idHoaDon}/send-email
    /// </summary>
    [HttpPost("invoice/{idHoaDon}/send-email")]
    public async Task<IActionResult> ResendInvoiceEmail(string idHoaDon)
    {
        var hoaDon = await _context.HoaDons
            .Include(h => h.IddatPhongNavigation)
                .ThenInclude(dp => dp.IdkhachHangNavigation)
            .FirstOrDefaultAsync(h => h.IdhoaDon == idHoaDon);
        if (hoaDon == null)
            return NotFound(new { message = "Không tìm thấy hóa đơn" });

        var kh = hoaDon.IddatPhongNavigation.IdkhachHangNavigation;
        if (kh?.Email == null)
            return BadRequest(new { message = "Không có email khách hàng" });

        var subject = $"Hóa đơn thanh toán #{hoaDon.IdhoaDon} - Khách sạn";
        var body = $@"Kính gửi Quý khách {kh.HoTen},

Vui lòng xem chi tiết hóa đơn:
Mã hóa đơn: {hoaDon.IdhoaDon}
Mã đặt phòng: {hoaDon.IddatPhong}
Ngày lập: {hoaDon.NgayLap:dd/MM/yyyy HH:mm}
Tổng tiền: {hoaDon.TongTien:N0} đ
Đã thanh toán: {(hoaDon.TienThanhToan ?? 0):N0} đ
Trạng thái: {(hoaDon.TrangThaiThanhToan == 2 ? "Đã thanh toán" : "Chờ xử lý")} 
";
        await _emailService.SendEmailAsync(kh.Email, kh.HoTen ?? "Quý khách", subject);
        return Ok(new { success = true });
    }

    /// <summary>
    /// Ghi nhận phụ phí/điều chỉnh vào hóa đơn (tạo một dòng dịch vụ)
    /// POST /api/Payment/invoice/{idHoaDon}/adjustments
    /// body: { amount: decimal, description?: string }
    /// </summary>
    public class AdjustmentRequest { public decimal Amount { get; set; } public string? Description { get; set; } }
    [HttpPost("invoice/{idHoaDon}/adjustments")]
    public async Task<IActionResult> AddAdjustment(string idHoaDon, [FromBody] AdjustmentRequest req)
    {
        if (req == null || req.Amount == 0)
            return BadRequest(new { message = "Số tiền điều chỉnh không hợp lệ" });

        var hoaDon = await _context.HoaDons.FirstOrDefaultAsync(h => h.IdhoaDon == idHoaDon);
        if (hoaDon == null)
            return NotFound(new { message = "Không tìm thấy hóa đơn" });

        // Ensure a generic service exists for adjustments
        var serviceId = "ADJUST";
        var dv = await _context.DichVus.FindAsync(serviceId);
        if (dv == null)
        {
            dv = new DichVu
            {
                IddichVu = serviceId,
                TenDichVu = "Phụ phí điều chỉnh",
                TienDichVu = 0,
                TrangThai = "Đang hoạt động"
            };
            _context.DichVus.Add(dv);
            await _context.SaveChangesAsync();
        }

        var now = DateTime.Now;
        var ctdv = new Cthddv
        {
            IdhoaDon = idHoaDon,
            IddichVu = serviceId,
            TienDichVu = req.Amount,
            ThoiGianThucHien = now,
            TrangThai = req.Description
        };
        _context.Cthddvs.Add(ctdv);

        // Update totals: TongTien = TongTien + amount; TienThanhToan = max(0, TongTien - TienCoc)
        hoaDon.TongTien = hoaDon.TongTien + req.Amount;
        var tienCoc = hoaDon.TienCoc ?? 0;
        var thanhToan = hoaDon.TongTien - tienCoc;
        if (thanhToan < 0) thanhToan = 0;
        hoaDon.TienThanhToan = thanhToan;

        _context.HoaDons.Update(hoaDon);
        await _context.SaveChangesAsync();

        return Ok(new { success = true, data = new { hoaDon.IdhoaDon, hoaDon.TongTien, hoaDon.TienThanhToan } });
    }

    /// <summary>
    /// Tổng hợp giao dịch cho báo cáo kế toán
    /// GET /api/Payment/summary?from=yyyy-MM-dd&to=yyyy-MM-dd
    /// </summary>
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary([FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var query = _context.HoaDons.AsQueryable();
        if (from.HasValue) query = query.Where(h => h.NgayLap >= from);
        if (to.HasValue) query = query.Where(h => h.NgayLap <= to);

        var totalInvoices = await query.CountAsync();
        var totalAmount = await query.SumAsync(h => (decimal?)h.TongTien) ?? 0m;
        var totalDeposit = await query.SumAsync(h => (decimal?)(h.TienCoc ?? 0)) ?? 0m;
        var totalPaid = await query.Where(h => h.TrangThaiThanhToan == 2).SumAsync(h => (decimal?)(h.TienThanhToan ?? 0)) ?? 0m;
        var totalPending = totalAmount - totalPaid;

        return Ok(new
        {
            success = true,
            data = new { totalInvoices, totalAmount, totalDeposit, totalPaid, totalPending }
        });
    }

    /// <summary>
    /// BƯỚC 1: TẠO ĐẶT PHÒNG
    /// POST /api/Payment/dat-phong
    /// Lưu thông tin vào bảng DatPhong
    /// CHÚ Ý: Chỉ lưu phòng đầu tiên vào cột IDPhong (backward compatible)
    /// Nếu đặt nhiều phòng, sử dụng cùng 1 IDDatPhong này cho tất cả các phòng
    /// </summary>
    [HttpPost("dat-phong")]
    [ProducesResponseType(typeof(DatPhongResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<DatPhongResponse>> CreateDatPhong([FromBody] DatPhongRequest request)
    {
        try
        {
            // null-guard for request (helps static analysis and early returns)
            if (request == null)
            {
                return BadRequest(new HoaDonResponse
                {
                    Success = false,
                    Message = "Request body is required"
                });
            }
            if (!ModelState.IsValid)
            {
                return BadRequest(new DatPhongResponse
                {
                    Success = false,
                    Message = "Dữ liệu không hợp lệ"
                });
            }

            // Validate ngày
            if (request.NgayTraPhong <= request.NgayNhanPhong)
            {
                return BadRequest(new DatPhongResponse
                {
                    Success = false,
                    Message = "Ngày trả phòng phải sau ngày nhận phòng"
                });
            }

            // Tạo mã đặt phòng
            var idDatPhong = $"DP{DateTime.Now:yyyyMMddHHmmss}";

            var datPhong = new DatPhong
            {
                IddatPhong = idDatPhong,
                IdkhachHang = request.IDKhachHang,
                Idphong = request.IDPhong,
                NgayDatPhong = DateOnly.FromDateTime(DateTime.Now),
                NgayNhanPhong = request.NgayNhanPhong,
                NgayTraPhong = request.NgayTraPhong,
                SoDem = request.SoDem,
                TongTien = request.TongTien,
                TienCoc = request.TienCoc,
                TrangThai = 1, // 1 = Chờ xác nhận (để nhân viên xác nhận)
                TrangThaiThanhToan = 0 // 0 = Chưa thanh toán
            };

            _context.DatPhongs.Add(datPhong);
            await _context.SaveChangesAsync();

            _logger.LogInformation($"✅ Đã tạo đặt phòng: {idDatPhong}");

            return Ok(new DatPhongResponse
            {
                Success = true,
                Message = "Tạo đặt phòng thành công",
                IDDatPhong = idDatPhong,
                NgayDatPhong = datPhong.NgayDatPhong,
                TongTien = datPhong.TongTien,
                TienCoc = datPhong.TienCoc
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Lỗi khi tạo đặt phòng");
            return StatusCode(500, new DatPhongResponse
            {
                Success = false,
                Message = $"Lỗi server: {ex.Message}"
            });
        }
    }

    /// <summary>
    /// BƯỚC 2: TẠO CHI TIẾT ĐẶT PHÒNG
    /// POST /api/Payment/chi-tiet-dat-phong
    /// Lưu thông tin vào bảng ChiTietDatPhong
    /// CHÚ Ý: Tất cả các phòng trong request phải có cùng IDDatPhong
    /// Đây là cách lưu nhiều phòng cho cùng 1 đơn đặt phòng
    /// </summary>
    [HttpPost("chi-tiet-dat-phong")]
    [ProducesResponseType(typeof(ChiTietDatPhongResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ChiTietDatPhongResponse>> CreateChiTietDatPhong([FromBody] ChiTietDatPhongRequest request)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(new ChiTietDatPhongResponse
                {
                    Success = false,
                    Message = "Dữ liệu không hợp lệ"
                });
            }

            // Kiểm tra đặt phòng có tồn tại không
            var datPhongExists = await _context.DatPhongs
                .AnyAsync(dp => dp.IddatPhong == request.IDDatPhong);

            if (!datPhongExists)
            {
                return BadRequest(new ChiTietDatPhongResponse
                {
                    Success = false,
                    Message = $"Đặt phòng {request.IDDatPhong} không tồn tại"
                });
            }

            var danhSachChiTiet = new List<int>();

            // Lưu tất cả các phòng với cùng IDDatPhong
            foreach (var room in request.DanhSachPhong)
            {
                var thanhTien = room.SoDem * room.GiaPhong;

                var chiTiet = new ChiTietDatPhong
                {
                    IDDatPhong = request.IDDatPhong, // Cùng IDDatPhong
                    IDPhong = room.IDPhong,
                    SoDem = room.SoDem,
                    GiaPhong = room.GiaPhong,
                    ThanhTien = thanhTien,
                    GhiChu = room.GhiChu
                };

                _context.ChiTietDatPhongs.Add(chiTiet);
                await _context.SaveChangesAsync(); // Save để lấy ID

                danhSachChiTiet.Add(chiTiet.IDChiTiet);
            }

            _logger.LogInformation($"✅ Đã lưu {request.DanhSachPhong.Count} chi tiết phòng cho đặt phòng {request.IDDatPhong}");

            return Ok(new ChiTietDatPhongResponse
            {
                Success = true,
                Message = $"Lưu {request.DanhSachPhong.Count} phòng thành công cho đặt phòng {request.IDDatPhong}",
                IDDatPhong = request.IDDatPhong!,
                SoLuongPhong = request.DanhSachPhong.Count,
                DanhSachIDChiTiet = danhSachChiTiet
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Lỗi khi tạo chi tiết đặt phòng");
            return StatusCode(500, new ChiTietDatPhongResponse
            {
                Success = false,
                Message = $"Lỗi server: {ex.Message}"
            });
        }
    }

    /// <summary>
    /// BƯỚC 3: TẠO HÓA ĐƠN
    /// POST /api/Payment/hoa-don
    /// Lưu thông tin vào bảng HoaDon
    /// </summary>
    [HttpPost("hoa-don")]
    [ProducesResponseType(typeof(HoaDonResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<HoaDonResponse>> CreateHoaDon([FromBody] HoaDonRequest request)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(new HoaDonResponse
                {
                    Success = false,
                    Message = "Dữ liệu không hợp lệ"
                });
            }

            // Lấy thông tin đặt phòng từ CSDL (để lấy TienCoc và validate)
            var datPhong = await _context.DatPhongs
                .Include(dp => dp.IdkhachHangNavigation) // Include thông tin khách hàng để gửi email
                .FirstOrDefaultAsync(dp => dp.IddatPhong == request.IDDatPhong);

            if (datPhong == null)
            {
                return BadRequest(new HoaDonResponse
                {
                    Success = false,
                    Message = "Đặt phòng không tồn tại"
                });
            }

            // Lấy tiền cọc từ CSDL (có thể là 0 nếu chưa cọc)
            var tienCocTuDB = datPhong.TienCoc ?? 0;
            
            // Validate: TienPhong và SoLuongNgay phải có giá trị
            if (!request.TienPhong.HasValue || request.TienPhong.Value <= 0)
            {
                return BadRequest(new HoaDonResponse
                {
                    Success = false,
                    Message = "Tiền phòng phải lớn hơn 0"
                });
            }

            if (!request.SoLuongNgay.HasValue || request.SoLuongNgay.Value <= 0)
            {
                return BadRequest(new HoaDonResponse
                {
                    Success = false,
                    Message = "Số lượng ngày phải lớn hơn 0"
                });
            }

            // Tính tổng tiền thanh toán = TongTien - TienCoc (đã cọc thì trừ đi)
            var tongTienThanhToan = request.TongTien - tienCocTuDB;
            
            // Nếu khách đã cọc thì số tiền còn phải trả là TongTien - TienCoc
            // Nếu chưa cọc thì phải trả full TongTien
            if (tongTienThanhToan < 0)
            {
                tongTienThanhToan = 0; // Không được âm
            }

            // Tạo mã hóa đơn và xử lý Redeem Points nếu client yêu cầu
            var idHoaDon = $"HD{DateTime.Now:yyyyMMddHHmmss}";

            // Conversion: mỗi điểm = 1.000đ (quy ước). Nếu bạn muốn thay đổi, chỉnh giá trị này.
            const decimal POINT_VALUE = 1000m;

            // Khởi tạo các giá trị tiền tạm
            var requestedTotal = request.TongTien;
            decimal finalTotal = requestedTotal;
            int redeemedPointsUsed = 0;
            decimal redeemedValue = 0m;
            decimal appliedPromotionValue = 0m; // placeholder - fill when promotions are evaluated
            int pointsEarned = 0;
            int? pointsAfter = null;

            // Nếu khách muốn dùng điểm để giảm giá
            try
            {
                var kh = datPhong.IdkhachHangNavigation;
                var requestedRedeem = request.RedeemPoints ?? 0;
                var availablePoints = kh?.TichDiem ?? 0;

                if (requestedRedeem > 0 && kh != null && availablePoints > 0)
                {
                    // Không cho dùng quá số điểm hiện có
                    var canUse = Math.Min(requestedRedeem, availablePoints);

                    // Không cho vượt quá tổng tiền (lấy floor)
                    var maxByAmount = (int)Math.Floor(finalTotal / POINT_VALUE);
                    redeemedPointsUsed = Math.Min(canUse, maxByAmount);

                    var redeemValue = redeemedPointsUsed * POINT_VALUE;
                    redeemedValue = redeemValue;
                    finalTotal = finalTotal - redeemValue;
                    if (finalTotal < 0) finalTotal = 0;
                }
            }
            catch (Exception exRedeem)
            {
                _logger.LogError(exRedeem, "Error while processing redeem points (non-fatal)");
            }

            // Build ghi chú: include promotion + redeem info if any
            var ghiChuFinal = request.GhiChu;
            if (request is not null)
            {
                if (redeemedPointsUsed > 0)
                {
                    ghiChuFinal = (ghiChuFinal ?? "") + $" | RedeemedPoints: {redeemedPointsUsed} (value: {redeemedPointsUsed * POINT_VALUE:N0} đ)";
                }
            }

            // Tạo entity hóa đơn sử dụng giá trị cuối cùng (sau redeem)
            var hoaDon = new HoaDon
            {
                IdhoaDon = idHoaDon,
                IddatPhong = request.IDDatPhong!,
                NgayLap = DateTime.Now,
                TienPhong = request.TienPhong!.Value,  // Lưu giá trị thực
                Slngay = request.SoLuongNgay!.Value,   // Lưu giá trị thực
                TongTien = finalTotal,
                TienCoc = tienCocTuDB,                // Lấy từ CSDL
                TienThanhToan = Math.Max(0, finalTotal - tienCocTuDB),
                TrangThaiThanhToan = 2,
                GhiChu = ghiChuFinal
            };

            _context.HoaDons.Add(hoaDon);

            // Cập nhật trạng thái thanh toán của Đặt phòng lên Đã thanh toán (2)
            datPhong.TrangThaiThanhToan = 2;
            _context.DatPhongs.Update(datPhong);

            // Cập nhật điểm: trừ redeemed (nếu có) rồi cộng điểm mới dựa trên finalTotal
            try
            {
                var kh = datPhong.IdkhachHangNavigation;
                if (kh != null)
                {
                    var before = kh.TichDiem ?? 0;
                    // trừ
                    if (redeemedPointsUsed > 0)
                    {
                        kh.TichDiem = Math.Max(0, before - redeemedPointsUsed);
                    }

                    // award points based on final amount (1 point per 100.000đ)
                    pointsEarned = (int)Math.Floor((double)(hoaDon.TongTien / 100000m));
                    if (pointsEarned > 0)
                    {
                        kh.TichDiem = (kh.TichDiem ?? 0) + pointsEarned;
                    }

                    pointsAfter = kh.TichDiem;

                    _context.KhachHangs.Update(kh);
                    _logger.LogInformation($"🎯 Customer {kh.IdkhachHang}: points before={before}, redeemed={redeemedPointsUsed}, earned={pointsEarned}, after={kh.TichDiem}");
                }
            }
            catch (Exception exPoints)
            {
                _logger.LogError(exPoints, "Error updating customer points (non-fatal)");
            }

            await _context.SaveChangesAsync();

            _logger.LogInformation($"✅ Đã tạo hóa đơn: {idHoaDon} - TrangThai={datPhong.TrangThai} (Chờ xác nhận), TrangThaiThanhToan=2, TienCoc={tienCocTuDB:N0}, TienThanhToan={hoaDon.TienThanhToan:N0}");

            // ✅ GỬI EMAIL HÓA ĐƠN THANH TOÁN
            if (datPhong.IdkhachHangNavigation?.Email != null)
            {
                try
                {
                    var khachHang = datPhong.IdkhachHangNavigation;
                    var emailSubject = $"Hóa đơn thanh toán #{idHoaDon} - Khách sạn";
                    var emailBody = $@"
Kính gửi Quý khách {khachHang.HoTen},

Cảm ơn Quý khách đã thanh toán!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THÔNG TIN HÓA ĐƠN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Mã hóa đơn: {idHoaDon}
📋 Mã đặt phòng: {request.IDDatPhong}
📅 Ngày lập: {hoaDon.NgayLap:dd/MM/yyyy HH:mm}

💰 Tiền phòng: {hoaDon.TienPhong:N0}đ
📆 Số đêm: {hoaDon.Slngay}
💵 Tổng tiền: {hoaDon.TongTien:N0}đ
💳 Tiền cọc: {hoaDon.TienCoc:N0}đ
💸 Số tiền đã thanh toán: {hoaDon.TienThanhToan:N0}đ

✅ Trạng thái: Đã thanh toán

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Quý khách vui lòng giữ email này để làm bằng chứng thanh toán.

Mọi thắc mắc xin liên hệ:
📞 Hotline: 1900-xxxx
📧 Email: support@hotel.com

Trân trọng,
Khách sạn
";

                    await _emailService.SendEmailAsync(khachHang.Email, khachHang.HoTen ?? "Quý khách", emailSubject);
                    _logger.LogInformation($"📧 Đã gửi email hóa đơn đến: {khachHang.Email}");
                }
                catch (Exception emailEx)
                {
                    _logger.LogError(emailEx, "❌ Lỗi khi gửi email hóa đơn (nhưng vẫn tạo hóa đơn thành công)");
                    // Không throw để không ảnh hưởng đến response
                }
            }

            return Ok(new HoaDonResponse
            {
                Success = true,
                Message = "Tạo hóa đơn thành công",
                IDHoaDon = idHoaDon,
                IDDatPhong = request.IDDatPhong,
                NgayLap = hoaDon.NgayLap,
                TongTien = hoaDon.TongTien,
                TienCoc = hoaDon.TienCoc,
                TienThanhToan = hoaDon.TienThanhToan,
                TrangThaiThanhToan = hoaDon.TrangThaiThanhToan,

                // loyalty / redeem fields (server-authoritative)
                RedeemedPoints = redeemedPointsUsed,
                RedeemedValue = redeemedValue,
                PointsEarned = pointsEarned,
                PointsAfter = pointsAfter,
                AppliedPromotionValue = appliedPromotionValue
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Lỗi khi tạo hóa đơn");
            return StatusCode(500, new HoaDonResponse
            {
                Success = false,
                Message = $"Lỗi server: {ex.Message}"
            });
        }
    }

    /// <summary>
    /// CẬP NHẬT TRẠNG THÁI THANH TOÁN
    /// POST /api/Payment/update-payment-status
    /// Cập nhật trạng thái thanh toán cho booking đã có (từ CheckoutPage)
    /// </summary>
    [HttpPost("update-payment-status")]
    [ProducesResponseType(typeof(PaymentStatusUpdateResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<PaymentStatusUpdateResponse>> UpdatePaymentStatus([FromBody] PaymentStatusUpdateRequest request)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(new PaymentStatusUpdateResponse
                {
                    Success = false,
                    Message = "Dữ liệu không hợp lệ"
                });
            }

            // Lấy thông tin đặt phòng và hóa đơn
            var datPhong = await _context.DatPhongs
                .FirstOrDefaultAsync(dp => dp.IddatPhong == request.IDDatPhong);

            if (datPhong == null)
            {
                return BadRequest(new PaymentStatusUpdateResponse
                {
                    Success = false,
                    Message = "Đặt phòng không tồn tại"
                });
            }

            var hoaDon = await _context.HoaDons
                .FirstOrDefaultAsync(hd => hd.IddatPhong == request.IDDatPhong);

            if (hoaDon == null)
            {
                return BadRequest(new PaymentStatusUpdateResponse
                {
                    Success = false,
                    Message = "Hóa đơn không tồn tại"
                });
            }

            // Cập nhật trạng thái thanh toán
            datPhong.TrangThaiThanhToan = request.TrangThaiThanhToan;
            hoaDon.TrangThaiThanhToan = request.TrangThaiThanhToan;
            hoaDon.GhiChu = request.GhiChu ?? hoaDon.GhiChu;

            _context.DatPhongs.Update(datPhong);
            _context.HoaDons.Update(hoaDon);
            await _context.SaveChangesAsync();

            _logger.LogInformation($"✅ Đã cập nhật trạng thái thanh toán: {request.IDDatPhong} - TrangThaiThanhToan={request.TrangThaiThanhToan}");

            return Ok(new PaymentStatusUpdateResponse
            {
                Success = true,
                Message = "Cập nhật trạng thái thanh toán thành công",
                IDDatPhong = request.IDDatPhong,
                IDHoaDon = hoaDon.IdhoaDon,
                TrangThaiThanhToan = request.TrangThaiThanhToan,
                TongTien = hoaDon.TongTien,
                TienCoc = hoaDon.TienCoc ?? 0,
                TienThanhToan = hoaDon.TienThanhToan ?? 0
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Lỗi khi cập nhật trạng thái thanh toán");
            return StatusCode(500, new PaymentStatusUpdateResponse
            {
                Success = false,
                Message = $"Lỗi server: {ex.Message}"
            });
        }
    }

}
