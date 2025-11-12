using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Hotel_System.API.Models;
using Hotel_System.API.DTOs.Promotions;

namespace Hotel_System.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class KhuyenMaiController : ControllerBase
{
    private readonly HotelSystemContext _context;
    private readonly ILogger<KhuyenMaiController> _logger;

    public KhuyenMaiController(HotelSystemContext context, ILogger<KhuyenMaiController> logger)
    {
        _context = context;
        _logger = logger;
    }

    // GET: api/KhuyenMai
    // Lấy danh sách tất cả khuyến mãi với filter
    [HttpGet]
    public async Task<ActionResult<List<KhuyenMaiDto>>> GetAll(
        [FromQuery] string? status = null,
        [FromQuery] string? discountType = null,
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null)
    {
        try
        {
            var query = _context.KhuyenMais.Include(k => k.KhuyenMaiPhongs).AsQueryable();

            // Filter by status
            if (!string.IsNullOrEmpty(status))
                query = query.Where(k => k.TrangThai == status);

            // Filter by discount type
            if (!string.IsNullOrEmpty(discountType))
                query = query.Where(k => k.LoaiGiamGia == discountType);

            // Filter by date range
            if (fromDate.HasValue)
                query = query.Where(k => k.NgayBatDau >= DateOnly.FromDateTime(fromDate.Value));

            if (toDate.HasValue)
                query = query.Where(k => k.NgayKetThuc <= DateOnly.FromDateTime(toDate.Value));

            var promotions = await query
                .OrderByDescending(k => k.CreatedAt)
                .ToListAsync();

            var result = promotions.Select(p => MapToDto(p)).ToList();
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi lấy danh sách khuyến mãi");
            return StatusCode(500, new { message = "Lỗi khi lấy danh sách khuyến mãi", error = ex.Message });
        }
    }

    // GET: api/KhuyenMai/{id}
    // Lấy chi tiết một khuyến mãi
    [HttpGet("{id}")]
    public async Task<ActionResult<KhuyenMaiDto>> GetById(string id)
    {
        try
        {
            var promotion = await _context.KhuyenMais
                .Include(k => k.KhuyenMaiPhongs)
                .ThenInclude(kp => kp.IdphongNavigation)
                .FirstOrDefaultAsync(k => k.IdkhuyenMai == id);

            if (promotion == null)
                return NotFound(new { message = "Không tìm thấy khuyến mãi" });

            return Ok(MapToDto(promotion));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Lỗi khi lấy chi tiết khuyến mãi {id}");
            return StatusCode(500, new { message = "Lỗi khi lấy chi tiết khuyến mãi", error = ex.Message });
        }
    }

    // POST: api/KhuyenMai
    // Tạo khuyến mãi mới
    [HttpPost]
    public async Task<ActionResult<KhuyenMaiDto>> Create([FromBody] CreateKhuyenMaiDto dto)
    {
        try
        {
            // Validate
            if (string.IsNullOrWhiteSpace(dto.TenKhuyenMai))
                return BadRequest(new { message = "Tên khuyến mãi không được để trống" });

            if (dto.NgayBatDau > dto.NgayKetThuc)
                return BadRequest(new { message = "Ngày bắt đầu phải trước ngày kết thúc" });

            if (dto.GiaTriGiam <= 0)
                return BadRequest(new { message = "Giá trị giảm phải lớn hơn 0" });

            // Tạo ID tự động
            var id = GeneratePromotionId();

            var promotion = new KhuyenMai
            {
                IdkhuyenMai = id,
                TenKhuyenMai = dto.TenKhuyenMai,
                MoTa = dto.MoTa,
                LoaiGiamGia = dto.LoaiGiamGia,
                GiaTriGiam = dto.GiaTriGiam,
                NgayBatDau = dto.NgayBatDau,
                NgayKetThuc = dto.NgayKetThuc,
                TrangThai = DetermineStatus(dto.NgayBatDau, dto.NgayKetThuc),
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now
            };

            _context.KhuyenMais.Add(promotion);
            await _context.SaveChangesAsync();

            // Thêm khuyến mãi vào các phòng
            if (dto.PhongIds.Count > 0)
            {
                foreach (var phongId in dto.PhongIds)
                {
                    var room = await _context.Phongs.FirstOrDefaultAsync(p => p.Idphong == phongId);
                    if (room != null)
                    {
                        var khuyenMaiPhong = new KhuyenMaiPhong
                        {
                            IdkhuyenMai = id,
                            Idphong = phongId,
                            IsActive = true,
                            NgayApDung = dto.NgayBatDau,
                            NgayKetThuc = dto.NgayKetThuc,
                            CreatedAt = DateTime.Now,
                            UpdatedAt = DateTime.Now
                        };
                        _context.KhuyenMaiPhongs.Add(khuyenMaiPhong);
                    }
                }
                await _context.SaveChangesAsync();
            }

            promotion = await _context.KhuyenMais
                .Include(k => k.KhuyenMaiPhongs)
                .ThenInclude(kp => kp.IdphongNavigation)
                .FirstAsync(k => k.IdkhuyenMai == id);

            return CreatedAtAction(nameof(GetById), new { id = id }, MapToDto(promotion));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi tạo khuyến mãi");
            return StatusCode(500, new { message = "Lỗi khi tạo khuyến mãi", error = ex.Message });
        }
    }

    // PUT: api/KhuyenMai/{id}
    // Cập nhật khuyến mãi
    [HttpPut("{id}")]
    public async Task<ActionResult<KhuyenMaiDto>> Update(string id, [FromBody] UpdateKhuyenMaiDto dto)
    {
        try
        {
            var promotion = await _context.KhuyenMais
                .Include(k => k.KhuyenMaiPhongs)
                .FirstOrDefaultAsync(k => k.IdkhuyenMai == id);

            if (promotion == null)
                return NotFound(new { message = "Không tìm thấy khuyến mãi" });

            // Validate
            if (dto.NgayBatDau > dto.NgayKetThuc)
                return BadRequest(new { message = "Ngày bắt đầu phải trước ngày kết thúc" });

            // Cập nhật thông tin chính
            promotion.TenKhuyenMai = dto.TenKhuyenMai;
            promotion.MoTa = dto.MoTa;
            promotion.LoaiGiamGia = dto.LoaiGiamGia;
            promotion.GiaTriGiam = dto.GiaTriGiam;
            promotion.NgayBatDau = dto.NgayBatDau;
            promotion.NgayKetThuc = dto.NgayKetThuc;
            promotion.TrangThai = dto.TrangThai;
            promotion.UpdatedAt = DateTime.Now;

            // Cập nhật danh sách phòng
            // Xóa các phòng cũ
            _context.KhuyenMaiPhongs.RemoveRange(promotion.KhuyenMaiPhongs);
            await _context.SaveChangesAsync();

            // Thêm phòng mới
            if (dto.PhongIds.Count > 0)
            {
                foreach (var phongId in dto.PhongIds)
                {
                    var room = await _context.Phongs.FirstOrDefaultAsync(p => p.Idphong == phongId);
                    if (room != null)
                    {
                        var khuyenMaiPhong = new KhuyenMaiPhong
                        {
                            IdkhuyenMai = id,
                            Idphong = phongId,
                            IsActive = true,
                            NgayApDung = dto.NgayBatDau,
                            NgayKetThuc = dto.NgayKetThuc,
                            CreatedAt = promotion.CreatedAt,
                            UpdatedAt = DateTime.Now
                        };
                        _context.KhuyenMaiPhongs.Add(khuyenMaiPhong);
                    }
                }
            }

            _context.KhuyenMais.Update(promotion);
            await _context.SaveChangesAsync();

            promotion = await _context.KhuyenMais
                .Include(k => k.KhuyenMaiPhongs)
                .ThenInclude(kp => kp.IdphongNavigation)
                .FirstAsync(k => k.IdkhuyenMai == id);

            return Ok(MapToDto(promotion));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Lỗi khi cập nhật khuyến mãi {id}");
            return StatusCode(500, new { message = "Lỗi khi cập nhật khuyến mãi", error = ex.Message });
        }
    }

    // PATCH: api/KhuyenMai/{id}/toggle
    // Bật/tắt khuyến mãi
    [HttpPatch("{id}/toggle")]
    public async Task<ActionResult<KhuyenMaiDto>> Toggle(string id)
    {
        try
        {
            var promotion = await _context.KhuyenMais
                .Include(k => k.KhuyenMaiPhongs)
                .FirstOrDefaultAsync(k => k.IdkhuyenMai == id);

            if (promotion == null)
                return NotFound(new { message = "Không tìm thấy khuyến mãi" });

            // Chuyển đổi trạng thái
            if (promotion.TrangThai == "active")
            {
                promotion.TrangThai = "inactive";
                // Deactivate tất cả KhuyenMaiPhong
                foreach (var kmp in promotion.KhuyenMaiPhongs)
                    kmp.IsActive = false;
            }
            else if (promotion.TrangThai == "inactive" || promotion.TrangThai == "expired")
            {
                promotion.TrangThai = "active";
                // Activate tất cả KhuyenMaiPhong
                foreach (var kmp in promotion.KhuyenMaiPhongs)
                    kmp.IsActive = true;
            }

            promotion.UpdatedAt = DateTime.Now;
            _context.KhuyenMais.Update(promotion);
            await _context.SaveChangesAsync();

            promotion = await _context.KhuyenMais
                .Include(k => k.KhuyenMaiPhongs)
                .ThenInclude(kp => kp.IdphongNavigation)
                .FirstAsync(k => k.IdkhuyenMai == id);

            return Ok(MapToDto(promotion));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Lỗi khi toggle khuyến mãi {id}");
            return StatusCode(500, new { message = "Lỗi khi toggle khuyến mãi", error = ex.Message });
        }
    }

    // DELETE: api/KhuyenMai/{id}
    // Xóa khuyến mãi
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        try
        {
            var promotion = await _context.KhuyenMais
                .Include(k => k.KhuyenMaiPhongs)
                .FirstOrDefaultAsync(k => k.IdkhuyenMai == id);

            if (promotion == null)
                return NotFound(new { message = "Không tìm thấy khuyến mãi" });

            // Xóa các liên kết phòng
            _context.KhuyenMaiPhongs.RemoveRange(promotion.KhuyenMaiPhongs);

            // Xóa khuyến mãi
            _context.KhuyenMais.Remove(promotion);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Xóa khuyến mãi thành công" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Lỗi khi xóa khuyến mãi {id}");
            return StatusCode(500, new { message = "Lỗi khi xóa khuyến mãi", error = ex.Message });
        }
    }

    // POST: api/KhuyenMai/update-expired-status
    // Cập nhật trạng thái expired cho các khuyến mãi hết hạn
    [HttpPost("update-expired-status")]
    public async Task<IActionResult> UpdateExpiredStatus()
    {
        try
        {
            var today = DateOnly.FromDateTime(DateTime.Now);

            // Lấy tất cả khuyến mãi active có ngày kết thúc < hôm nay
            var expiredPromotions = await _context.KhuyenMais
                .Where(k => k.TrangThai == "active" && k.NgayKetThuc < today)
                .Include(k => k.KhuyenMaiPhongs)
                .ToListAsync();

            foreach (var promotion in expiredPromotions)
            {
                promotion.TrangThai = "expired";
                promotion.UpdatedAt = DateTime.Now;

                // Cập nhật KhuyenMaiPhong
                foreach (var kmp in promotion.KhuyenMaiPhongs)
                {
                    kmp.IsActive = false;
                    kmp.UpdatedAt = DateTime.Now;
                }
            }

            if (expiredPromotions.Count > 0)
            {
                _context.KhuyenMais.UpdateRange(expiredPromotions);
                await _context.SaveChangesAsync();
                _logger.LogInformation($"Cập nhật {expiredPromotions.Count} khuyến mãi thành trạng thái expired");
            }

            return Ok(new { message = $"Cập nhật trạng thái expired cho {expiredPromotions.Count} khuyến mãi", count = expiredPromotions.Count });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi cập nhật trạng thái expired");
            return StatusCode(500, new { message = "Lỗi khi cập nhật trạng thái expired", error = ex.Message });
        }
    }

    // Helper methods
    private string GeneratePromotionId()
    {
        return $"KM_{DateTime.Now:yyyyMMddHHmmss}_{new Random().Next(1000, 9999)}";
    }

    private string DetermineStatus(DateOnly startDate, DateOnly endDate)
    {
        var today = DateOnly.FromDateTime(DateTime.Now);
        if (today < startDate) return "inactive";
        if (today > endDate) return "expired";
        return "active";
    }

    private KhuyenMaiDto MapToDto(KhuyenMai promotion)
    {
        return new KhuyenMaiDto
        {
            IdkhuyenMai = promotion.IdkhuyenMai,
            TenKhuyenMai = promotion.TenKhuyenMai,
            MoTa = promotion.MoTa,
            LoaiGiamGia = promotion.LoaiGiamGia,
            GiaTriGiam = promotion.GiaTriGiam,
            NgayBatDau = promotion.NgayBatDau,
            NgayKetThuc = promotion.NgayKetThuc,
            TrangThai = promotion.TrangThai,
            CreatedAt = promotion.CreatedAt,
            UpdatedAt = promotion.UpdatedAt,
            KhuyenMaiPhongs = promotion.KhuyenMaiPhongs.Select(kmp => new KhuyenMaiPhongDto
            {
                Id = kmp.Id,
                Idphong = kmp.Idphong,
                TenPhong = kmp.IdphongNavigation?.TenPhong ?? "N/A",
                IsActive = kmp.IsActive,
                NgayApDung = kmp.NgayApDung,
                NgayKetThuc = kmp.NgayKetThuc
            }).ToList()
        };
    }
}
