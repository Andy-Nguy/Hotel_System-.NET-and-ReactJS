using Hotel_System.API.DTOs;
using Hotel_System.API.Services;
using Hotel_System.API.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hotel_System.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PromotionController : ControllerBase
{
    private readonly PromotionService _promotionService;
    private readonly ILogger<PromotionController> _logger;
    private readonly HotelSystemContext _context;

    public PromotionController(PromotionService promotionService, ILogger<PromotionController> logger, HotelSystemContext context)
    {
        _promotionService = promotionService;
        _logger = logger;
        _context = context;
    }

    #region 1. Danh sách khuyến mãi

    /// <summary>
    /// GET: api/Promotion/all
    /// Lấy tất cả khuyến mãi (có thể lọc theo phòng)
    /// </summary>
    [HttpGet("all")]
    public async Task<ActionResult<List<PromotionResponse>>> GetAllPromotions([FromQuery] List<string>? roomIds = null)
    {
        try
        {
            var promotions = await _promotionService.GetAllPromotionsAsync(roomIds);
            return Ok(promotions);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi lấy danh sách khuyến mãi");
            return StatusCode(500, new { message = "Có lỗi xảy ra khi lấy danh sách khuyến mãi" });
        }
    }

    /// <summary>
    /// GET: api/Promotion/room/{roomId}
    /// Lấy khuyến mãi theo phòng
    /// </summary>
    [HttpGet("room/{roomId}")]
    public async Task<ActionResult<List<PromotionResponse>>> GetPromotionsByRoom(string roomId)
    {
        try
        {
            var promotions = await _promotionService.GetPromotionsByRoomAsync(roomId);
            return Ok(promotions);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Lỗi khi lấy khuyến mãi cho phòng {roomId}");
            return StatusCode(500, new { message = "Có lỗi xảy ra khi lấy khuyến mãi" });
        }
    }

    /// <summary>
    /// GET: api/Promotion/active
    /// Lấy danh sách khuyến mãi đang hoạt động
    /// </summary>
    [HttpGet("active")]
    public async Task<ActionResult<List<PromotionResponse>>> GetActivePromotions()
    {
        try
        {
            var allPromotions = await _promotionService.GetAllPromotionsAsync();
            var activePromotions = allPromotions.Where(p => p.TrangThai == "active").ToList();
            return Ok(activePromotions);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi lấy khuyến mãi đang hoạt động");
            return StatusCode(500, new { message = "Có lỗi xảy ra" });
        }
    }

    #endregion

    #region 2. Áp dụng khuyến mãi

    /// <summary>
    /// POST: api/Promotion/apply
    /// Áp dụng mã khuyến mãi cho hóa đơn
    /// </summary>
    [HttpPost("apply")]
    public async Task<ActionResult<ApplyPromotionResponse>> ApplyPromotion([FromBody] ApplyPromotionRequest request)
    {
        try
        {
            var result = await _promotionService.ApplyPromotionAsync(request);
            if (result.Success)
            {
                return Ok(result);
            }
            return BadRequest(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi áp dụng mã khuyến mãi");
            return StatusCode(500, new { message = "Có lỗi xảy ra khi áp dụng mã khuyến mãi" });
        }
    }

    #endregion

    #region 3. Tích điểm & Thông tin điểm

    /// <summary>
    /// GET: api/Promotion/points/{customerId}
    /// Lấy thông tin điểm tích lũy của khách hàng
    /// </summary>
    [HttpGet("points/{customerId}")]
    public async Task<ActionResult<LoyaltyPointsResponse>> GetLoyaltyPoints(int customerId)
    {
        try
        {
            var points = await _promotionService.GetLoyaltyPointsAsync(customerId);
            if (points == null)
            {
                return NotFound(new { message = "Không tìm thấy khách hàng" });
            }
            return Ok(points);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Lỗi khi lấy điểm tích lũy của khách hàng {customerId}");
            return StatusCode(500, new { message = "Có lỗi xảy ra" });
        }
    }

    /// <summary>
    /// POST: api/Promotion/add-points
    /// Tích điểm cho khách hàng (thường gọi sau khi thanh toán thành công)
    /// </summary>
    [HttpPost("add-points")]
    public async Task<ActionResult> AddPoints([FromBody] AddPointsRequest request)
    {
        try
        {
            var success = await _promotionService.AddLoyaltyPointsAsync(request.IdKhachHang, request.TongTien);
            if (success)
            {
                return Ok(new { message = "Đã tích điểm thành công", success = true });
            }
            return BadRequest(new { message = "Không thể tích điểm", success = false });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi tích điểm");
            return StatusCode(500, new { message = "Có lỗi xảy ra khi tích điểm" });
        }
    }

    #endregion

    #region 4. Đổi điểm lấy voucher

    /// <summary>
    /// POST: api/Promotion/exchange
    /// Đổi điểm lấy voucher
    /// </summary>
    [HttpPost("exchange")]
    public async Task<ActionResult<ExchangePointsResponse>> ExchangePoints([FromBody] ExchangePointsRequest request)
    {
        try
        {
            var result = await _promotionService.ExchangePointsForVoucherAsync(request);
            if (result.Success)
            {
                return Ok(result);
            }
            return BadRequest(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi đổi điểm");
            return StatusCode(500, new { message = "Có lỗi xảy ra khi đổi điểm" });
        }
    }

    #endregion

    #region 5. CRUD Khuyến mãi (Admin)

    /// <summary>
    /// POST: api/Promotion/create
    /// Tạo khuyến mãi mới
    /// </summary>
    [HttpPost("create")]
    public async Task<IActionResult> CreatePromotion([FromBody] CreatePromotionRequest request)
    {
        if (!ModelState.IsValid) return BadRequest(new { message = "Dữ liệu không hợp lệ" });

        var id = request.IdKhuyenMai?.Trim();
        if (string.IsNullOrEmpty(id)) id = $"KM{DateTime.Now:yyyyMMddHHmmss}";
        if (await _context.KhuyenMais.AnyAsync(k => k.IdkhuyenMai == id))
            return BadRequest(new { message = "ID khuyến mãi đã tồn tại" });

        var promo = new KhuyenMai
        {
            IdkhuyenMai = id,
            TenKhuyenMai = request.TenKhuyenMai,
            MoTa = request.MoTa,
            LoaiGiamGia = request.LoaiGiamGia,
            GiaTriGiam = request.GiaTriGiam,
            NgayBatDau = request.NgayBatDau,
            NgayKetThuc = request.NgayKetThuc,
            TrangThai = request.TrangThai,
            CreatedAt = DateTime.Now,
            UpdatedAt = DateTime.Now
        };
        _context.KhuyenMais.Add(promo);
        await _context.SaveChangesAsync();
        return Ok(new { success = true, idKhuyenMai = promo.IdkhuyenMai });
    }

    /// <summary>
    /// PUT: api/Promotion/{id}
    /// Cập nhật khuyến mãi
    /// </summary>
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdatePromotion(string id, [FromBody] UpdatePromotionRequest request)
    {
        var promo = await _context.KhuyenMais.FindAsync(id);
        if (promo == null) return NotFound(new { message = "Không tìm thấy khuyến mãi" });
        promo.TenKhuyenMai = request.TenKhuyenMai ?? promo.TenKhuyenMai;
        promo.MoTa = request.MoTa ?? promo.MoTa;
        promo.LoaiGiamGia = request.LoaiGiamGia ?? promo.LoaiGiamGia;
        promo.GiaTriGiam = request.GiaTriGiam ?? promo.GiaTriGiam;
        promo.NgayBatDau = request.NgayBatDau ?? promo.NgayBatDau;
        promo.NgayKetThuc = request.NgayKetThuc ?? promo.NgayKetThuc;
        promo.TrangThai = request.TrangThai ?? promo.TrangThai;
        promo.UpdatedAt = DateTime.Now;
        await _context.SaveChangesAsync();
        return Ok(new { success = true });
    }

    /// <summary>
    /// DELETE: api/Promotion/{id}
    /// Xóa khuyến mãi
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeletePromotion(string id)
    {
        var promo = await _context.KhuyenMais.FindAsync(id);
        if (promo == null) return NotFound(new { message = "Không tìm thấy khuyến mãi" });
        _context.KhuyenMais.Remove(promo);
        await _context.SaveChangesAsync();
        return Ok(new { success = true });
    }

    /// <summary>
    /// POST: api/Promotion/{id}/assign-rooms
    /// Gán khuyến mãi cho danh sách phòng (thêm hoặc cập nhật)
    /// </summary>
    [HttpPost("{id}/assign-rooms")]
    public async Task<IActionResult> AssignRooms(string id, [FromBody] AssignRoomsRequest request)
    {
        var promo = await _context.KhuyenMais.Include(k => k.KhuyenMaiPhongs).FirstOrDefaultAsync(k => k.IdkhuyenMai == id);
        if (promo == null) return NotFound(new { message = "Không tìm thấy khuyến mãi" });

        var now = DateTime.Now;
        foreach (var room in request.RoomIds)
        {
            var existing = promo.KhuyenMaiPhongs.FirstOrDefault(p => p.Idphong == room);
            if (existing == null)
            {
                _context.KhuyenMaiPhongs.Add(new KhuyenMaiPhong
                {
                    IdkhuyenMai = id,
                    Idphong = room,
                    IsActive = true,
                    NgayApDung = request.NgayApDung ?? promo.NgayBatDau,
                    NgayKetThuc = request.NgayKetThuc ?? promo.NgayKetThuc,
                    CreatedAt = now,
                    UpdatedAt = now
                });
            }
            else
            {
                existing.IsActive = true;
                existing.NgayApDung = request.NgayApDung ?? existing.NgayApDung;
                existing.NgayKetThuc = request.NgayKetThuc ?? existing.NgayKetThuc;
                existing.UpdatedAt = now;
            }
        }
        await _context.SaveChangesAsync();
        return Ok(new { success = true });
    }

    /// <summary>
    /// POST: api/Promotion/{id}/unassign-room/{roomId}
    /// Ngưng áp dụng khuyến mãi cho phòng
    /// </summary>
    [HttpPost("{id}/unassign-room/{roomId}")]
    public async Task<IActionResult> UnassignRoom(string id, string roomId)
    {
        var kmp = await _context.KhuyenMaiPhongs.FirstOrDefaultAsync(x => x.IdkhuyenMai == id && x.Idphong == roomId);
        if (kmp == null) return NotFound(new { message = "Không tìm thấy mapping" });
        kmp.IsActive = false;
        kmp.UpdatedAt = DateTime.Now;
        await _context.SaveChangesAsync();
        return Ok(new { success = true });
    }

    #endregion
}

/// <summary>
/// Request để tích điểm
/// </summary>
public class AddPointsRequest
{
    public int IdKhachHang { get; set; }
    public decimal TongTien { get; set; }
}

public class CreatePromotionRequest
{
    public string? IdKhuyenMai { get; set; }
    public string TenKhuyenMai { get; set; } = string.Empty;
    public string? MoTa { get; set; }
    public string LoaiGiamGia { get; set; } = "percent"; // percent | fixed
    public decimal? GiaTriGiam { get; set; }
    public DateOnly NgayBatDau { get; set; }
    public DateOnly NgayKetThuc { get; set; }
    public string TrangThai { get; set; } = "active";
}

public class UpdatePromotionRequest
{
    public string? TenKhuyenMai { get; set; }
    public string? MoTa { get; set; }
    public string? LoaiGiamGia { get; set; }
    public decimal? GiaTriGiam { get; set; }
    public DateOnly? NgayBatDau { get; set; }
    public DateOnly? NgayKetThuc { get; set; }
    public string? TrangThai { get; set; }
}

public class AssignRoomsRequest
{
    public List<string> RoomIds { get; set; } = new();
    public DateOnly? NgayApDung { get; set; }
    public DateOnly? NgayKetThuc { get; set; }
}
