using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Hotel_System.API.Models;

namespace Hotel_System.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class InvoicesController : ControllerBase
    {
        private readonly HotelSystemContext _db;

        public InvoicesController(HotelSystemContext db)
        {
            _db = db;
        }

        // GET api/Invoices/invoices?from=yyyy-MM-dd&to=yyyy-MM-dd&status=2&customer=...&roomType=...&staff=...
        [HttpGet("invoices")]
        public async Task<IActionResult> GetInvoices([FromQuery] string? from, [FromQuery] string? to, [FromQuery] int? status, [FromQuery] string? customer, [FromQuery] string? roomType, [FromQuery] string? staff)
        {
            DateTime? dFrom = TryParseDate(from);
            DateTime? dTo = TryParseDate(to);

            var q = _db.HoaDons.AsQueryable();

            if (dFrom.HasValue)
                q = q.Where(h => h.NgayLap >= dFrom.Value.Date);
            if (dTo.HasValue)
                q = q.Where(h => h.NgayLap <= dTo.Value.Date.AddDays(1).AddTicks(-1));
            if (status.HasValue)
                q = q.Where(h => h.TrangThaiThanhToan == status.Value);
            if (!string.IsNullOrWhiteSpace(customer))
            {
                var cust = customer.Trim();
                q = q.Where(h => h.IddatPhongNavigation != null && h.IddatPhongNavigation.IdkhachHangNavigation != null && (
                    (h.IddatPhongNavigation.IdkhachHangNavigation.HoTen != null && h.IddatPhongNavigation.IdkhachHangNavigation.HoTen.Contains(cust)) ||
                    (h.IddatPhongNavigation.IdkhachHangNavigation.Email != null && h.IddatPhongNavigation.IdkhachHangNavigation.Email.Contains(cust))
                ));
            }
            if (!string.IsNullOrWhiteSpace(roomType))
            {
                var rt = roomType.Trim();
                q = q.Where(h => h.IddatPhongNavigation != null && h.IddatPhongNavigation.ChiTietDatPhongs.Any(ct => ct.Phong != null && ct.Phong.IdloaiPhong == rt));
            }
            if (!string.IsNullOrWhiteSpace(staff))
            {
                var s = staff.Trim();
                q = q.Where(h => h.GhiChu != null && h.GhiChu.Contains(s));
            }

            var list = await q
                .OrderByDescending(h => h.NgayLap)
                .Select(h => new
                {
                    idHoaDon = h.IdhoaDon,
                    idDatPhong = h.IddatPhong,
                    ngayLap = h.NgayLap,
                    tongTien = h.TongTien,
                    tienCoc = h.TienCoc,
                    tienThanhToan = h.TienThanhToan,
                    // Compute payment status from amounts to avoid stale/inconsistent DB values
                    trangThaiThanhToan = ((h.TongTien - (h.TienThanhToan ?? 0m)) > 1000m) ? 1 : 2,
                    ghiChu = h.GhiChu,
                    customer = new
                    {
                        id = h.IddatPhongNavigation != null ? h.IddatPhongNavigation.IdkhachHang : (int?)null,
                        hoTen = (h.IddatPhongNavigation != null && h.IddatPhongNavigation.IdkhachHangNavigation != null) ? h.IddatPhongNavigation.IdkhachHangNavigation.HoTen : null,
                        email = (h.IddatPhongNavigation != null && h.IddatPhongNavigation.IdkhachHangNavigation != null) ? h.IddatPhongNavigation.IdkhachHangNavigation.Email : null,
                        soDienThoai = (h.IddatPhongNavigation != null && h.IddatPhongNavigation.IdkhachHangNavigation != null) ? h.IddatPhongNavigation.IdkhachHangNavigation.SoDienThoai : null,
                        tichDiem = (h.IddatPhongNavigation != null && h.IddatPhongNavigation.IdkhachHangNavigation != null) ? h.IddatPhongNavigation.IdkhachHangNavigation.TichDiem : null
                    }
                })
                .ToListAsync();

            return Ok(new { data = list });
        }

        // GET api/Invoices/summary?from=...&to=...&status=...&customer=...&roomType=...&staff=...
        [HttpGet("summary")]
        public async Task<IActionResult> GetSummary([FromQuery] string? from, [FromQuery] string? to, [FromQuery] int? status, [FromQuery] string? customer, [FromQuery] string? roomType, [FromQuery] string? staff)
        {
            DateTime? dFrom = TryParseDate(from);
            DateTime? dTo = TryParseDate(to);

            var q = _db.HoaDons.AsQueryable();
            if (dFrom.HasValue) q = q.Where(h => h.NgayLap >= dFrom.Value.Date);
            if (dTo.HasValue) q = q.Where(h => h.NgayLap <= dTo.Value.Date.AddDays(1).AddTicks(-1));
            if (status.HasValue) q = q.Where(h => h.TrangThaiThanhToan == status.Value);
            if (!string.IsNullOrWhiteSpace(customer))
            {
                var cust = customer.Trim();
                q = q.Where(h => h.IddatPhongNavigation != null && h.IddatPhongNavigation.IdkhachHangNavigation != null && (
                    (h.IddatPhongNavigation.IdkhachHangNavigation.HoTen != null && h.IddatPhongNavigation.IdkhachHangNavigation.HoTen.Contains(cust)) ||
                    (h.IddatPhongNavigation.IdkhachHangNavigation.Email != null && h.IddatPhongNavigation.IdkhachHangNavigation.Email.Contains(cust))
                ));
            }
            if (!string.IsNullOrWhiteSpace(roomType))
            {
                var rt = roomType.Trim();
                q = q.Where(h => h.IddatPhongNavigation != null && h.IddatPhongNavigation.ChiTietDatPhongs.Any(ct => ct.Phong != null && ct.Phong.IdloaiPhong == rt));
            }
            if (!string.IsNullOrWhiteSpace(staff))
            {
                var s = staff.Trim();
                q = q.Where(h => h.GhiChu != null && h.GhiChu.Contains(s));
            }

            var totalInvoices = await q.CountAsync();
            var totalAmount = await q.SumAsync(h => (decimal?)h.TongTien) ?? 0m;
            var totalDeposit = await q.SumAsync(h => (decimal?)h.TienCoc) ?? 0m;
            var totalPaid = await q.SumAsync(h => (decimal?)h.TienThanhToan) ?? 0m;
            var totalPending = totalAmount - totalPaid;

            return Ok(new { data = new { totalInvoices, totalAmount, totalDeposit, totalPaid, totalPending } });
        }

        private DateTime? TryParseDate(string? s)
        {
            if (string.IsNullOrWhiteSpace(s)) return null;
            if (DateTime.TryParse(s, out var dt)) return dt;
            return null;
        }

        // GET api/Invoices/{id} - detailed invoice including room lines and services
        [HttpGet("{id}")]
        public async Task<IActionResult> GetInvoiceDetail(string id)
        {
            if (string.IsNullOrWhiteSpace(id)) return BadRequest();

            var hd = await _db.HoaDons
                .Include(h => h.IddatPhongNavigation).ThenInclude(dp => dp.ChiTietDatPhongs)
                .Include(h => h.IddatPhongNavigation).ThenInclude(dp => dp.IdkhachHangNavigation)
                .FirstOrDefaultAsync(h => h.IdhoaDon == id);

            if (hd == null) return NotFound();

            var services = await _db.Cthddvs.Where(c => c.IdhoaDon == id).ToListAsync();

            // Compute a derived payment status to ensure consistency with amounts
            int computedStatus = ((hd.TongTien - (hd.TienThanhToan ?? 0m)) > 1000m) ? 1 : 2;

            var result = new
            {
                idHoaDon = hd.IdhoaDon,
                idDatPhong = hd.IddatPhong,
                ngayLap = hd.NgayLap,
                tongTien = hd.TongTien,
                tienCoc = hd.TienCoc,
                tienThanhToan = hd.TienThanhToan,
                trangThaiThanhToan = computedStatus,
                ghiChu = hd.GhiChu,
                tienPhong = hd.TienPhong,
                slNgay = hd.Slngay,
                customer = hd.IddatPhongNavigation != null && hd.IddatPhongNavigation.IdkhachHangNavigation != null ? new
                {
                    id = hd.IddatPhongNavigation.IdkhachHang,
                    hoTen = hd.IddatPhongNavigation.IdkhachHangNavigation.HoTen,
                    email = hd.IddatPhongNavigation.IdkhachHangNavigation.Email,
                    soDienThoai = hd.IddatPhongNavigation.IdkhachHangNavigation.SoDienThoai,
                    tichDiem = hd.IddatPhongNavigation.IdkhachHangNavigation.TichDiem
                } : null,
                roomLines = hd.IddatPhongNavigation?.ChiTietDatPhongs?.Select(ct => new { ct.IDPhong, ct.SoDem, ct.GiaPhong, ct.ThanhTien }).ToList(),
                services = services.Select(s => new { s.IddichVu, s.TienDichVu, s.ThoiGianThucHien, s.TrangThai }).ToList()
            };

            return Ok(result);
        }
    }
}
