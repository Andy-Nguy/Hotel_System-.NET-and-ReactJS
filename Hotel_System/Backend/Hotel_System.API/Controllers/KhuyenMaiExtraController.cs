using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Hotel_System.API.Models;
using Hotel_System.API.DTOs.Promotions;

namespace Hotel_System.API.Controllers;

[ApiController]
[Route("api/khuyenmai")]
public class KhuyenMaiExtraController : ControllerBase
{
    private readonly HotelSystemContext _context;
    private readonly ILogger<KhuyenMaiExtraController> _logger;

    public KhuyenMaiExtraController(HotelSystemContext context, ILogger<KhuyenMaiExtraController> logger)
    {
        _context = context;
        _logger = logger;
    }

    // POST: api/khuyenmai/combo
    [HttpPost("combo")]
    public async Task<IActionResult> CreateCombo([FromBody] CreateKhuyenMaiComboDto dto)
    {
        if (dto.DichVuIds == null || dto.DichVuIds.Count < 2)
            return BadRequest(new { message = "Combo phải chứa ít nhất 2 dịch vụ" });

        var promotion = await _context.KhuyenMais.FindAsync(dto.IdkhuyenMai);
        if (promotion == null)
            return NotFound(new { message = "Khuyến mãi không tồn tại" });

        var newStart = dto.NgayBatDau ?? promotion.NgayBatDau;
        var newEnd = dto.NgayKetThuc ?? promotion.NgayKetThuc;

        // find conflicting service promotions
        var conflicts = await _context.KhuyenMaiDichVus
            .Include(k => k.IdkhuyenMaiNavigation)
            .Where(k => dto.DichVuIds.Contains(k.IddichVu) && k.IsActive && k.IdkhuyenMaiNavigation.TrangThai == "active")
            .ToListAsync();

        var overlapping = new List<object>();
        foreach (var c in conflicts)
        {
            var existingStart = c.IdkhuyenMaiNavigation.NgayBatDau;
            var existingEnd = c.IdkhuyenMaiNavigation.NgayKetThuc;
            if (!(existingEnd < newStart || existingStart > newEnd))
            {
                overlapping.Add(new { c.IddichVu, existingPromotion = c.IdkhuyenMai });
            }
        }

        if (overlapping.Any() && !dto.ForceCreateIfConflict)
        {
            _logger.LogWarning("Conflict when creating combo for promotion {PromotionId}: {Conflicts}", dto.IdkhuyenMai, overlapping);
            return Conflict(new { message = "Có xung đột với khuyến mãi hiện có", conflicts = overlapping });
        }

        // create combo
        var combo = new KhuyenMaiCombo
        {
            IdkhuyenMaiCombo = Guid.NewGuid().ToString("N"),
            IdkhuyenMai = dto.IdkhuyenMai,
            TenCombo = dto.TenCombo,
            MoTa = dto.MoTa,
            NgayBatDau = dto.NgayBatDau,
            NgayKetThuc = dto.NgayKetThuc,
            TrangThai = "active",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Add(combo);
        foreach (var dv in dto.DichVuIds)
        {
            var map = new KhuyenMaiComboDichVu
            {
                IdkhuyenMaiCombo = combo.IdkhuyenMaiCombo,
                IddichVu = dv,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            _context.Add(map);
        }

        await _context.SaveChangesAsync();

        _logger.LogInformation("Created combo {ComboId} for promotion {PromotionId}", combo.IdkhuyenMaiCombo, dto.IdkhuyenMai);

        return CreatedAtAction(null, new { combo.IdkhuyenMaiCombo });
    }

    // POST: api/khuyenmai/phongdichvu
    [HttpPost("phongdichvu")]
    public async Task<IActionResult> CreatePhongDichVu([FromBody] CreateKhuyenMaiPhongDichVuDto dto)
    {
        var promotion = await _context.KhuyenMais.FindAsync(dto.IdkhuyenMai);
        if (promotion == null)
            return NotFound(new { message = "Khuyến mãi không tồn tại" });

        var newStart = dto.NgayApDung ?? promotion.NgayBatDau;
        var newEnd = dto.NgayKetThuc ?? promotion.NgayKetThuc;

        // check conflicts: existing room+service mappings AND service-level promotions
        var roomServiceConflicts = await _context.KhuyenMaiPhongDichVus
            .Include(k => k.IdkhuyenMaiNavigation)
            .Where(k => k.Idphong == dto.Idphong && k.IddichVu == dto.IddichVu && k.IsActive && k.IdkhuyenMaiNavigation.TrangThai == "active")
            .ToListAsync();

        var serviceLevelConflicts = await _context.KhuyenMaiDichVus
            .Include(k => k.IdkhuyenMaiNavigation)
            .Where(k => k.IddichVu == dto.IddichVu && k.IsActive && k.IdkhuyenMaiNavigation.TrangThai == "active")
            .ToListAsync();

        var overlapping = new List<object>();

        foreach (var c in roomServiceConflicts)
        {
            var existingStart = c.IdkhuyenMaiNavigation.NgayBatDau;
            var existingEnd = c.IdkhuyenMaiNavigation.NgayKetThuc;
            if (!(existingEnd < newStart || existingStart > newEnd))
            {
                overlapping.Add(new { existingPromotion = c.IdkhuyenMai, idphong = dto.Idphong, iddichvu = dto.IddichVu });
            }
        }

        foreach (var c in serviceLevelConflicts)
        {
            var existingStart = c.IdkhuyenMaiNavigation.NgayBatDau;
            var existingEnd = c.IdkhuyenMaiNavigation.NgayKetThuc;
            if (!(existingEnd < newStart || existingStart > newEnd))
            {
                overlapping.Add(new { existingPromotion = c.IdkhuyenMai, idphong = dto.Idphong, iddichvu = dto.IddichVu });
            }
        }

        if (overlapping.Any() && !dto.ForceCreateIfConflict)
        {
            _logger.LogWarning("Conflict when creating room-service mapping for promotion {PromotionId}: {Conflicts}", dto.IdkhuyenMai, overlapping);
            return Conflict(new { message = "Có xung đột với khuyến mãi hiện có", conflicts = overlapping });
        }

        var mapping = new KhuyenMaiPhongDichVu
        {
            IdkhuyenMai = dto.IdkhuyenMai,
            Idphong = dto.Idphong,
            IddichVu = dto.IddichVu,
            IsActive = dto.IsActive,
            NgayApDung = dto.NgayApDung,
            NgayKetThuc = dto.NgayKetThuc,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Add(mapping);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Created KhuyenMaiPhongDichVu mapping {Id} for promotion {PromotionId}", mapping.Id, dto.IdkhuyenMai);

        return CreatedAtAction(null, new { mapping.Id });
    }
}
