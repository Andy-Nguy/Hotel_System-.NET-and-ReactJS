using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Hotel_System.API.Models;
using Hotel_System.API.DTOs.Promotions;

namespace Hotel_System.API.Controllers;

[ApiController]
[Route("api/combo")]
public class ComboController : ControllerBase
{
    private readonly HotelSystemContext _context;
    private readonly ILogger<ComboController> _logger;

    public ComboController(HotelSystemContext context, ILogger<ComboController> logger)
    {
        _context = context;
        _logger = logger;
    }

    // GET: api/combo/suggest?dichvuIds=1,2,3
    [HttpGet("suggest")]
    public async Task<IActionResult> Suggest([FromQuery] string dichvuIds)
    {
        if (string.IsNullOrWhiteSpace(dichvuIds)) return BadRequest(new { message = "dichvuIds required" });

        var ids = dichvuIds.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (ids.Length < 2) return BadRequest(new { message = "Cần ít nhất 2 dịch vụ để gợi ý combo" });

        var combos = await _context.KhuyenMaiCombos
            .Include(c => c.KhuyenMaiComboDichVus)
            .ToListAsync();

        var results = new List<SuggestComboResponseDto>();
        foreach (var combo in combos)
        {
            var comboDvs = combo.KhuyenMaiComboDichVus.Select(x => x.IddichVu).ToList();
            var matchCount = comboDvs.Intersect(ids).Count();
            if (matchCount >= 2)
            {
                results.Add(new SuggestComboResponseDto
                {
                    IdkhuyenMaiCombo = combo.IdkhuyenMaiCombo,
                    TenCombo = combo.TenCombo,
                    DichVuIds = comboDvs,
                    MatchingCount = matchCount
                });
            }
        }

        return Ok(results);
    }
}
