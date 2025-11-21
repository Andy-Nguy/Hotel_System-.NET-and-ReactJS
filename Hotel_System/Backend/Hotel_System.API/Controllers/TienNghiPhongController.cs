using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Hotel_System.API.Models;
using System.Collections.Generic;
using Microsoft.AspNetCore.Authorization;
using System.Linq;
using System.Threading.Tasks;

namespace Hotel_System.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class TienNghiPhongController : ControllerBase
    {
        private readonly HotelSystemContext _context;

        public TienNghiPhongController(HotelSystemContext context)
        {
            _context = context;
        }

        // GET: api/TienNghiPhong
        // Get all room-amenity assignments
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            try
            {
                var assignments = await _context.TienNghiPhongs
                    .Select(t => new
                    {
                        t.Idphong,
                        t.IdtienNghi,
                        PhongName = t.IdphongNavigation != null ? t.IdphongNavigation.TenPhong : string.Empty,
                        AmenityName = t.IdtienNghiNavigation != null ? t.IdtienNghiNavigation.TenTienNghi : string.Empty
                    })
                    .ToListAsync();

                return Ok(assignments);
            }
            catch (Exception ex)
            {
                return Problem(detail: ex.Message, title: "Failed to get room-amenity assignments");
            }
        }

        // GET: api/Phong/{id}/TienNghi
        // Get all amenities for a specific room
        [HttpGet("room/{id}")]
        public async Task<IActionResult> GetAmenitiesForRoom(string id)
        {
            try
            {
                var room = await _context.Phongs.FindAsync(id);
                if (room == null) return NotFound("Room not found");

                var amenities = await _context.TienNghiPhongs
                    .Where(t => t.Idphong == id)
                    .Select(t => new
                    {
                        t.IdtienNghi,
                        TenTienNghi = t.IdtienNghiNavigation != null ? t.IdtienNghiNavigation.TenTienNghi : string.Empty
                    })
                    .ToListAsync();

                return Ok(amenities);
            }
            catch (Exception ex)
            {
                return Problem(detail: ex.Message, title: "Failed to get amenities for room");
            }
        }

        // POST: api/TienNghiPhong
        // Assign amenity to room
        public class AssignAmenityRequest
        {
            public string Idphong { get; set; } = string.Empty;
            public string IdtienNghi { get; set; } = string.Empty;
        }

        [HttpPost]
        public async Task<IActionResult> AssignAmenity([FromBody] AssignAmenityRequest req)
        {
            if (req == null) return BadRequest("Invalid payload");
            if (string.IsNullOrWhiteSpace(req.Idphong)) return BadRequest("Idphong is required");
            if (string.IsNullOrWhiteSpace(req.IdtienNghi)) return BadRequest("IdtienNghi is required");

            try
            {
                // Check if room exists
                var room = await _context.Phongs.FindAsync(req.Idphong);
                if (room == null) return BadRequest("Room not found");

                // Check if amenity exists
                var amenity = await _context.TienNghis.FindAsync(req.IdtienNghi);
                if (amenity == null) return BadRequest("Amenity not found");

                // Check if already assigned
                var existing = await _context.TienNghiPhongs
                    .FirstOrDefaultAsync(t => t.Idphong == req.Idphong && t.IdtienNghi == req.IdtienNghi);
                if (existing != null) return BadRequest("Amenity already assigned to this room");

                // create new assignment entity and generate Id
                var assignment = new TienNghiPhong
                {
                    IdtienNghiPhong = Guid.NewGuid().ToString(),
                    Idphong = req.Idphong,
                    IdtienNghi = req.IdtienNghi
                };

                _context.TienNghiPhongs.Add(assignment);
                await _context.SaveChangesAsync();

                // Return a minimal DTO to avoid serializing EF navigation properties (which can create cycles)
                var result = new
                {
                    idtienNghiPhong = assignment.IdtienNghiPhong,
                    idphong = assignment.Idphong,
                    idtienNghi = assignment.IdtienNghi,
                    phongName = room?.TenPhong ?? string.Empty,
                    tenTienNghi = amenity?.TenTienNghi ?? string.Empty
                };

                return Created($"api/TienNghiPhong/room/{req.Idphong}", result);
            }
            catch (Exception ex)
            {
                return Problem(detail: ex.Message, title: "Failed to assign amenity to room");
            }
        }

        // DELETE: api/TienNghiPhong/{idPhong}/{idtienNghi}
        // Remove amenity from room
        [HttpDelete("{idPhong}/{idtienNghi}")]
        public async Task<IActionResult> RemoveAmenity(string idPhong, string idtienNghi)
        {
            try
            {
                var assignment = await _context.TienNghiPhongs
                    .FirstOrDefaultAsync(t => t.Idphong == idPhong && t.IdtienNghi == idtienNghi);

                if (assignment == null) return NotFound();

                _context.TienNghiPhongs.Remove(assignment);
                await _context.SaveChangesAsync();

                return NoContent();
            }
            catch (Exception ex)
            {
                return Problem(detail: ex.Message, title: "Failed to remove amenity from room");
            }
        }
    }
}
