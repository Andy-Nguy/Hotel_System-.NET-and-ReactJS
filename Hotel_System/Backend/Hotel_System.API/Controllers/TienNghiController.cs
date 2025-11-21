using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Hotel_System.API.Models;
using System.Collections.Generic;
using Microsoft.AspNetCore.Authorization;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace Hotel_System.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class TienNghiController : ControllerBase
    {
        private readonly HotelSystemContext _context;

        public TienNghiController(HotelSystemContext context)
        {
            _context = context;
        }

        // GET: api/TienNghi
        // Returns list of amenities with count of rooms using each amenity
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            try
            {
                var amenities = await _context.TienNghis
                    .Select(t => new
                    {
                        t.IdtienNghi,
                        t.TenTienNghi,
                        RoomCount = t.TienNghiPhongs.Count() // count rooms using this amenity
                    })
                    .OrderBy(a => a.TenTienNghi)
                    .ToListAsync();

                return Ok(amenities);
            }
            catch (Exception ex)
            {
                return Problem(detail: ex.Message, title: "Failed to get amenities");
            }
        }

        // GET: api/TienNghi/{id}
        // Returns a single amenity with usage info
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(string id)
        {
            try
            {
                var amenity = await _context.TienNghis
                    .Where(t => t.IdtienNghi == id)
                    .Select(t => new
                    {
                        t.IdtienNghi,
                        t.TenTienNghi,
                        RoomCount = t.TienNghiPhongs.Count()
                    })
                    .FirstOrDefaultAsync();

                if (amenity == null) return NotFound();
                return Ok(amenity);
            }
            catch (Exception ex)
            {
                return Problem(detail: ex.Message, title: "Failed to get amenity");
            }
        }

        // POST: api/TienNghi
        // Create a new amenity
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] TienNghi payload)
        {
            if (payload == null) return BadRequest("Invalid payload");
            if (string.IsNullOrWhiteSpace(payload.TenTienNghi)) return BadRequest("TenTienNghi is required");
            // If client didn't provide an Id, generate a sequential code like TN01, TN02, ...
            if (string.IsNullOrWhiteSpace(payload.IdtienNghi))
            {
                try
                {
                    var existingCodes = await _context.TienNghis
                        .Where(t => t.IdtienNghi != null && t.IdtienNghi.StartsWith("TN"))
                        .Select(t => t.IdtienNghi!)
                        .ToListAsync();

                    var max = 0;
                    foreach (var code in existingCodes)
                    {
                        var m = Regex.Match(code ?? string.Empty, "(\\d+)$");
                        if (m.Success && int.TryParse(m.Value, out var v))
                        {
                            if (v > max) max = v;
                        }
                    }

                    payload.IdtienNghi = $"TN{(max + 1).ToString("D2")}";
                }
                catch
                {
                    // fallback to GUID if anything goes wrong
                    payload.IdtienNghi = Guid.NewGuid().ToString();
                }
            }

            // Validate length constraints
            if (payload.TenTienNghi.Length > 100) return BadRequest("TenTienNghi is too long (max 100)");

            try
            {
                _context.TienNghis.Add(payload);
                await _context.SaveChangesAsync();
                return CreatedAtAction(nameof(GetById), new { id = payload.IdtienNghi }, payload);
            }
            catch (Exception ex)
            {
                return Problem(detail: ex.Message, title: "Failed to create amenity");
            }
        }

        // PUT: api/TienNghi/{id}
        // Update an amenity
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(string id, [FromBody] TienNghi payload)
        {
            if (payload == null) return BadRequest("Invalid payload");
            
            var existing = await _context.TienNghis.FindAsync(id);
            if (existing == null) return NotFound();

            if (string.IsNullOrWhiteSpace(payload.TenTienNghi)) return BadRequest("TenTienNghi is required");
            if (payload.TenTienNghi.Length > 100) return BadRequest("TenTienNghi is too long (max 100)");

            try
            {
                existing.TenTienNghi = payload.TenTienNghi;

                _context.TienNghis.Update(existing);
                await _context.SaveChangesAsync();

                return NoContent();
            }
            catch (Exception ex)
            {
                return Problem(detail: ex.Message, title: "Failed to update amenity");
            }
        }

        // DELETE: api/TienNghi/{id}
        // Delete an amenity (only if no rooms use it)
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            try
            {
                var existing = await _context.TienNghis
                    .Include(t => t.TienNghiPhongs)
                    .FirstOrDefaultAsync(t => t.IdtienNghi == id);

                if (existing == null) return NotFound();

                // Check if amenity is used by any room
                if (existing.TienNghiPhongs.Count > 0)
                {
                    return BadRequest($"Cannot delete amenity: {existing.TienNghiPhongs.Count} rooms are using this amenity");
                }

                _context.TienNghis.Remove(existing);
                await _context.SaveChangesAsync();

                return NoContent();
            }
            catch (Exception ex)
            {
                return Problem(detail: ex.Message, title: "Failed to delete amenity");
            }
        }
    }
}
