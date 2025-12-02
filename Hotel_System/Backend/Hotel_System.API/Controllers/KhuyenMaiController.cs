using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Hotel_System.API.Models;
using Hotel_System.API.DTOs;
using Hotel_System.API.DTOs.Promotions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Authorization;
using System.IO;

namespace Hotel_System.API.Controllers;

[ApiController]
[Route("api/khuyenmai")]
public class KhuyenMaiController : ControllerBase
{
    private readonly HotelSystemContext _context;
    private readonly ILogger<KhuyenMaiController> _logger;
    private readonly IWebHostEnvironment _env;

    public KhuyenMaiController(HotelSystemContext context, ILogger<KhuyenMaiController> logger, IWebHostEnvironment env)
    {
        _context = context;
        _logger = logger;
        _env = env;
    }

    // GET: api/KhuyenMai
    // Lấy danh sách tất cả khuyến mãi với filter
    [HttpGet]
    [AllowAnonymous]
    public async Task<ActionResult<List<KhuyenMaiDto>>> GetAll(
        [FromQuery] string? status = null,
        [FromQuery] string? discountType = null,
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null)
    {
        try
        {
            var query = _context.KhuyenMais
                .Include(k => k.KhuyenMaiPhongs)
                    .ThenInclude(kp => kp.IdphongNavigation)
                .Include(k => k.KhuyenMaiDichVus)
                    .ThenInclude(kdv => kdv.IddichVuNavigation)
                .Include(k => k.KhuyenMaiCombos)
                    .ThenInclude(c => c.KhuyenMaiComboDichVus)
                        .ThenInclude(cd => cd.IddichVuNavigation)
                            .ThenInclude(d => d.TtdichVus)
                .AsQueryable();

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
                .Include(k => k.KhuyenMaiDichVus)
                    .ThenInclude(kdv => kdv.IddichVuNavigation)
                .Include(k => k.KhuyenMaiCombos)
                    .ThenInclude(c => c.KhuyenMaiComboDichVus)
                        .ThenInclude(cd => cd.IddichVuNavigation)
                            .ThenInclude(d => d.TtdichVus)
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

    // POST: api/khuyenmai/tai-banner
    // Upload hình ảnh banner cho khuyến mãi
    [HttpPost("tai-banner")]
    public async Task<ActionResult<UploadResultDto>> UploadBanner(IFormFile file)
    {
        try
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { message = "Không có file được upload" });

            // Validate file type
            var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".webp" };
            var fileExtension = Path.GetExtension(file.FileName).ToLower();
            if (!allowedExtensions.Contains(fileExtension))
                return BadRequest(new { message = "Chỉ chấp nhận file ảnh JPG, PNG, WebP" });

            // Validate file size (max 5MB)
            if (file.Length > 5 * 1024 * 1024)
                return BadRequest(new { message = "Kích thước file không được vượt quá 5MB" });

            // Tạo tên file unique
            var fileName = $"{Guid.NewGuid()}{fileExtension}";
            var promotionPath = Path.Combine(_env.ContentRootPath, "wwwroot", "img", "promotion");
            
            // Đảm bảo thư mục tồn tại
            if (!Directory.Exists(promotionPath))
                Directory.CreateDirectory(promotionPath);

            var filePath = Path.Combine(promotionPath, fileName);

            // Lưu file
            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            var relativePath = $"/img/promotion/{fileName}";
            
            _logger.LogInformation($"Upload banner thành công: {relativePath}");
            
            return Ok(new UploadResultDto
            {
                FileName = fileName,
                RelativePath = relativePath,
                FullPath = filePath,
                Size = file.Length,
                ContentType = file.ContentType
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi upload banner");
            return StatusCode(500, new { message = "Lỗi khi upload banner", error = ex.Message });
        }
    }

    // POST: api/KhuyenMai
    // Tạo khuyến mãi mới
    [HttpPost]
    // [Authorize(Roles = "nhanvien")]
    public async Task<ActionResult<KhuyenMaiDto>> Create([FromBody] CreateKhuyenMaiDto dto)
    {
        try
        {
            // Debug logging
            _logger.LogInformation($"Creating promotion: Type={dto.LoaiKhuyenMai}, PhongIds={dto.PhongIds.Count}, DichVuIds={dto.DichVuIds.Count}");
            
            // Validate
            if (string.IsNullOrWhiteSpace(dto.TenKhuyenMai))
                return BadRequest(new { message = "Tên khuyến mãi không được để trống" });

            if (dto.NgayBatDau > dto.NgayKetThuc)
                return BadRequest(new { message = "Ngày bắt đầu phải trước ngày kết thúc" });

            if (dto.GiaTriGiam <= 0)
                return BadRequest(new { message = "Giá trị giảm phải lớn hơn 0" });

            // Tạo ID tự động
            var id = await GeneratePromotionId();

            // Xử lý hình ảnh banner nếu có
            string? finalBannerPath = dto.HinhAnhBanner;
            if (!string.IsNullOrEmpty(dto.HinhAnhBanner))
            {
                finalBannerPath = await RenameBannerImage(dto.HinhAnhBanner, dto.TenKhuyenMai);
            }

            var promotion = new KhuyenMai
            {
                IdkhuyenMai = id,
                TenKhuyenMai = dto.TenKhuyenMai,
                MoTa = dto.MoTa,
                LoaiGiamGia = dto.LoaiGiamGia,
                GiaTriGiam = dto.GiaTriGiam,
                LoaiKhuyenMai = string.IsNullOrWhiteSpace(dto.LoaiKhuyenMai) ? "room" : dto.LoaiKhuyenMai,
                NgayBatDau = dto.NgayBatDau,
                NgayKetThuc = dto.NgayKetThuc,
                TrangThai = DetermineStatus(dto.NgayBatDau, dto.NgayKetThuc),
                HinhAnhBanner = finalBannerPath,
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

            // Xử lý theo loại khuyến mãi
            var promoType = promotion.LoaiKhuyenMai?.ToLower() ?? "room";
            
            if (promoType == "service" && dto.DichVuIds != null && dto.DichVuIds.Count > 0)
            {
                // Loại 'service': Chỉ khuyến mãi cho dịch vụ đơn lẻ
                foreach (var dvId in dto.DichVuIds)
                {
                    var svc = await _context.DichVus.FirstOrDefaultAsync(d => d.IddichVu == dvId);
                    if (svc != null)
                    {
                        var mapping = new KhuyenMaiDichVu
                        {
                            IdkhuyenMai = id,
                            IddichVu = dvId,
                            IsActive = true,
                            NgayApDung = dto.NgayBatDau,
                            NgayKetThuc = dto.NgayKetThuc,
                            CreatedAt = DateTime.Now,
                            UpdatedAt = DateTime.Now
                        };
                        _context.KhuyenMaiDichVus.Add(mapping);
                    }
                }
                await _context.SaveChangesAsync();
            }
            else if (promoType == "combo" && dto.DichVuIds != null && dto.DichVuIds.Count >= 2)
            {
                _logger.LogInformation($"Creating combo with {dto.DichVuIds.Count} services");
                // Loại 'combo': Tạo KhuyenMaiCombo -> KhuyenMaiComboDichVu
                // Bước 1: Tạo bản ghi KhuyenMaiCombo
                var comboId = $"COMBO_{Guid.NewGuid().ToString("N").Substring(0, 8).ToUpper()}";
                var combo = new KhuyenMaiCombo
                {
                    IdkhuyenMaiCombo = comboId,
                    IdkhuyenMai = id,
                    TenCombo = dto.TenKhuyenMai + " - Combo",
                    MoTa = dto.MoTa,
                    NgayBatDau = dto.NgayBatDau,
                    NgayKetThuc = dto.NgayKetThuc,
                    TrangThai = "active",
                    CreatedAt = DateTime.Now,
                    UpdatedAt = DateTime.Now
                };
                _context.KhuyenMaiCombos.Add(combo);
                await _context.SaveChangesAsync();

                // Bước 2: Thêm các dịch vụ vào combo
                foreach (var dvId in dto.DichVuIds)
                {
                    _logger.LogInformation($"Adding service {dvId} to combo {comboId}");
                    var svc = await _context.DichVus.FirstOrDefaultAsync(d => d.IddichVu == dvId);
                    if (svc != null)
                    {
                        var comboDv = new KhuyenMaiComboDichVu
                        {
                            IdkhuyenMaiCombo = comboId,
                            IddichVu = dvId,
                            IsActive = true,
                            CreatedAt = DateTime.Now,
                            UpdatedAt = DateTime.Now
                        };
                        _context.KhuyenMaiComboDichVus.Add(comboDv);
                        _logger.LogInformation($"Successfully added service {dvId} to combo");
                    }
                    else
                    {
                        _logger.LogWarning($"Service {dvId} not found!");
                    }
                }
                await _context.SaveChangesAsync();
                _logger.LogInformation($"Saved combo {comboId} with services to database");
            }

            promotion = await _context.KhuyenMais
                .Include(k => k.KhuyenMaiPhongs)
                    .ThenInclude(kp => kp.IdphongNavigation)
                .Include(k => k.KhuyenMaiDichVus)
                    .ThenInclude(kdv => kdv.IddichVuNavigation)
                .Include(k => k.KhuyenMaiCombos)
                    .ThenInclude(c => c.KhuyenMaiComboDichVus)
                        .ThenInclude(cd => cd.IddichVuNavigation)
                            .ThenInclude(d => d.TtdichVus)
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
    // [Authorize(Roles = "nhanvien")]
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

            // Xử lý hình ảnh banner nếu có thay đổi
            string? finalBannerPath = dto.HinhAnhBanner;
            if (!string.IsNullOrEmpty(dto.HinhAnhBanner) && dto.HinhAnhBanner != promotion.HinhAnhBanner)
            {
                finalBannerPath = await RenameBannerImage(dto.HinhAnhBanner, dto.TenKhuyenMai);
            }

            // Cập nhật thông tin chính
            promotion.TenKhuyenMai = dto.TenKhuyenMai;
            promotion.MoTa = dto.MoTa;
            promotion.LoaiGiamGia = dto.LoaiGiamGia;
            promotion.LoaiKhuyenMai = string.IsNullOrWhiteSpace(dto.LoaiKhuyenMai) ? promotion.LoaiKhuyenMai ?? "room" : dto.LoaiKhuyenMai;
            promotion.GiaTriGiam = dto.GiaTriGiam;
            promotion.NgayBatDau = dto.NgayBatDau;
            promotion.NgayKetThuc = dto.NgayKetThuc;
            promotion.TrangThai = dto.TrangThai;
            promotion.HinhAnhBanner = finalBannerPath;
            promotion.UpdatedAt = DateTime.Now;

            // Determine original and new promotion type
            var originalType = promotion.LoaiKhuyenMai?.ToLower() ?? "room";
            var newType = string.IsNullOrWhiteSpace(dto.LoaiKhuyenMai) ? originalType : dto.LoaiKhuyenMai.ToLower();

            // Load existing mappings so we can preserve them if update omitted lists
            var oldServiceMappings = await _context.KhuyenMaiDichVus.Where(m => m.IdkhuyenMai == id).ToListAsync();
            var oldCombos = await _context.KhuyenMaiCombos.Where(c => c.IdkhuyenMai == id).Include(c => c.KhuyenMaiComboDichVus).ToListAsync();

            // If the type changed, remove all old mappings. If type stayed the same, only remove categories
            // for which the client explicitly provided lists (dto.PhongIds or dto.DichVuIds != null).
            if (newType != originalType)
            {
                // remove all
                _context.KhuyenMaiPhongs.RemoveRange(promotion.KhuyenMaiPhongs);
                if (oldServiceMappings.Any()) _context.KhuyenMaiDichVus.RemoveRange(oldServiceMappings);
                if (oldCombos.Any())
                {
                    foreach (var combo in oldCombos)
                    {
                        _context.KhuyenMaiComboDichVus.RemoveRange(combo.KhuyenMaiComboDichVus);
                    }
                    _context.KhuyenMaiCombos.RemoveRange(oldCombos);
                }
            }
            else
            {
                // same type: remove only if client explicitly provided replacements
                // For room type: only clear rooms if phongIds is explicitly provided (not null)
                if (newType == "room" && dto.PhongIds != null)
                {
                    _context.KhuyenMaiPhongs.RemoveRange(promotion.KhuyenMaiPhongs);
                }

                if (dto.DichVuIds != null && dto.DichVuIds.Count > 0)
                {
                    if (oldServiceMappings.Any()) _context.KhuyenMaiDichVus.RemoveRange(oldServiceMappings);
                    if (oldCombos.Any())
                    {
                        foreach (var combo in oldCombos)
                        {
                            _context.KhuyenMaiComboDichVus.RemoveRange(combo.KhuyenMaiComboDichVus);
                        }
                        _context.KhuyenMaiCombos.RemoveRange(oldCombos);
                    }
                }
            }

            await _context.SaveChangesAsync();

            // Thêm mapping mới theo loại (sử dụng newType)
            // For room type: only add rooms if client explicitly provided phongIds (not null)
            if (newType == "room" && dto.PhongIds != null)
            {
                // Thêm phòng mới cho loại 'room'
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
                await _context.SaveChangesAsync();
            }
            else if (newType == "service" && dto.DichVuIds != null && dto.DichVuIds.Count > 0)
            {
                // Thêm dịch vụ đơn lẻ cho loại 'service'
                foreach (var dvId in dto.DichVuIds)
                {
                    var svc = await _context.DichVus.FirstOrDefaultAsync(d => d.IddichVu == dvId);
                    if (svc != null)
                    {
                        var mapping = new KhuyenMaiDichVu
                        {
                            IdkhuyenMai = id,
                            IddichVu = dvId,
                            IsActive = true,
                            NgayApDung = dto.NgayBatDau,
                            NgayKetThuc = dto.NgayKetThuc,
                            CreatedAt = promotion.CreatedAt,
                            UpdatedAt = DateTime.Now
                        };
                        _context.KhuyenMaiDichVus.Add(mapping);
                    }
                }
                await _context.SaveChangesAsync();
            }
            else if (newType == "combo" && dto.DichVuIds != null && dto.DichVuIds.Count >= 2)
            {
                // Tạo combo mới
                var comboId = $"COMBO_{Guid.NewGuid().ToString("N").Substring(0, 8).ToUpper()}";
                var combo = new KhuyenMaiCombo
                {
                    IdkhuyenMaiCombo = comboId,
                    IdkhuyenMai = id,
                    TenCombo = dto.TenKhuyenMai + " - Combo",
                    MoTa = dto.MoTa,
                    NgayBatDau = dto.NgayBatDau,
                    NgayKetThuc = dto.NgayKetThuc,
                    TrangThai = "active",
                    CreatedAt = DateTime.Now,
                    UpdatedAt = DateTime.Now
                };
                _context.KhuyenMaiCombos.Add(combo);
                await _context.SaveChangesAsync();

                foreach (var dvId in dto.DichVuIds)
                {
                    var svc = await _context.DichVus.FirstOrDefaultAsync(d => d.IddichVu == dvId);
                    if (svc != null)
                    {
                        var comboDv = new KhuyenMaiComboDichVu
                        {
                            IdkhuyenMaiCombo = comboId,
                            IddichVu = dvId,
                            IsActive = true,
                            CreatedAt = DateTime.Now,
                            UpdatedAt = DateTime.Now
                        };
                        _context.KhuyenMaiComboDichVus.Add(comboDv);
                    }
                }
                await _context.SaveChangesAsync();
            }

            _context.KhuyenMais.Update(promotion);
            await _context.SaveChangesAsync();

            promotion = await _context.KhuyenMais
                .Include(k => k.KhuyenMaiPhongs)
                    .ThenInclude(kp => kp.IdphongNavigation)
                .Include(k => k.KhuyenMaiDichVus)
                    .ThenInclude(kdv => kdv.IddichVuNavigation)
                .Include(k => k.KhuyenMaiCombos)
                    .ThenInclude(c => c.KhuyenMaiComboDichVus)
                        .ThenInclude(cd => cd.IddichVuNavigation)
                            .ThenInclude(d => d.TtdichVus)
                .FirstAsync(k => k.IdkhuyenMai == id);

            return Ok(MapToDto(promotion));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Lỗi khi cập nhật khuyến mãi {id}");
            return StatusCode(500, new { message = "Lỗi khi cập nhật khuyến mãi", error = ex.Message });
        }
    }

    // PATCH: api/khuyenmai/{id}/bat-tat
    // Bật/tắt khuyến mãi
    [HttpPatch("{id}/bat-tat")]
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
                // Deactivate tất cả KhuyenMaiDichVus nếu có
                var svcMappings = await _context.KhuyenMaiDichVus.Where(m => m.IdkhuyenMai == id).ToListAsync();
                foreach (var m in svcMappings) m.IsActive = false;
            }
            else if (promotion.TrangThai == "inactive" || promotion.TrangThai == "expired")
            {
                promotion.TrangThai = "active";
                // Activate tất cả KhuyenMaiPhong
                foreach (var kmp in promotion.KhuyenMaiPhongs)
                    kmp.IsActive = true;
                // Activate tất cả KhuyenMaiDichVus nếu có
                var svcMappings2 = await _context.KhuyenMaiDichVus.Where(m => m.IdkhuyenMai == id).ToListAsync();
                foreach (var m in svcMappings2) m.IsActive = true;
            }

            promotion.UpdatedAt = DateTime.Now;
            _context.KhuyenMais.Update(promotion);
            await _context.SaveChangesAsync();

            promotion = await _context.KhuyenMais
                .Include(k => k.KhuyenMaiPhongs)
                    .ThenInclude(kp => kp.IdphongNavigation)
                .Include(k => k.KhuyenMaiDichVus)
                    .ThenInclude(kdv => kdv.IddichVuNavigation)
                .Include(k => k.KhuyenMaiCombos)
                    .ThenInclude(c => c.KhuyenMaiComboDichVus)
                        .ThenInclude(cd => cd.IddichVuNavigation)
                            .ThenInclude(d => d.TtdichVus)
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
    // [Authorize(Roles = "nhanvien")]
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

    // POST: api/khuyenmai/{id}/gan-dich-vu
    // Gán dịch vụ vào chương trình khuyến mãi
    [HttpPost("{id}/gan-dich-vu")]
    public async Task<IActionResult> AssignService(string id, [FromBody] CreateKhuyenMaiDichVuDto dto)
    {
        try
        {
            var promotion = await _context.KhuyenMais.FirstOrDefaultAsync(k => k.IdkhuyenMai == id);
            if (promotion == null) return NotFound(new { message = "Không tìm thấy khuyến mãi" });

            // Ensure promotion is of type 'service'
            if (!string.Equals(promotion.LoaiKhuyenMai, "service", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { message = "Chỉ có thể gán dịch vụ cho khuyến mãi loại 'service'" });

            // Validate service exists
            var service = await _context.DichVus.FirstOrDefaultAsync(d => d.IddichVu == dto.IddichVu);
            if (service == null) return NotFound(new { message = "Không tìm thấy dịch vụ" });

            var mapping = new KhuyenMaiDichVu
            {
                IdkhuyenMai = id,
                IddichVu = dto.IddichVu,
                IsActive = dto.IsActive,
                NgayApDung = dto.NgayApDung,
                NgayKetThuc = dto.NgayKetThuc,
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now
            };

            _context.KhuyenMaiDichVus.Add(mapping);
            await _context.SaveChangesAsync();

            return Ok(new KhuyenMaiDichVuDto
            {
                Id = mapping.Id,
                IdkhuyenMai = mapping.IdkhuyenMai,
                IddichVu = mapping.IddichVu,
                IsActive = mapping.IsActive,
                NgayApDung = mapping.NgayApDung,
                NgayKetThuc = mapping.NgayKetThuc,
                CreatedAt = mapping.CreatedAt,
                UpdatedAt = mapping.UpdatedAt,
                TenDichVu = mapping.IddichVuNavigation?.TenDichVu ?? mapping.IddichVu
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi gán dịch vụ vào khuyến mãi");
            return StatusCode(500, new { message = "Lỗi khi gán dịch vụ vào khuyến mãi", error = ex.Message });
        }
    }

    // GET: api/khuyenmai/{id}/dich-vu
    [HttpGet("{id}/dich-vu")]
    public async Task<IActionResult> GetServicesForPromotion(string id)
    {
        try
        {
            var mappings = await _context.KhuyenMaiDichVus
                .Where(k => k.IdkhuyenMai == id)
                .ToListAsync();

            // Load promotion to derive effective status
            var promotion = await _context.KhuyenMais.FirstOrDefaultAsync(k => k.IdkhuyenMai == id);
            var today = DateOnly.FromDateTime(DateTime.Now);

            var result = mappings.Select(m =>
            {
                // Compute an "effective" active flag: mapping.IsActive OR (promotion active AND within mapping dates)
                var effectiveIsActive = m.IsActive;
                if (promotion != null && promotion.TrangThai == "active")
                {
                    var startsOk = !m.NgayApDung.HasValue || m.NgayApDung.Value <= today;
                    var endsOk = !m.NgayKetThuc.HasValue || m.NgayKetThuc.Value >= today;
                    if (startsOk && endsOk) effectiveIsActive = true;
                }

                return new KhuyenMaiDichVuDto
                {
                    Id = m.Id,
                    IdkhuyenMai = m.IdkhuyenMai,
                    IddichVu = m.IddichVu,
                    IsActive = effectiveIsActive,
                    NgayApDung = m.NgayApDung,
                    NgayKetThuc = m.NgayKetThuc,
                    CreatedAt = m.CreatedAt,
                    UpdatedAt = m.UpdatedAt,
                    TenDichVu = m.IddichVuNavigation?.TenDichVu ?? m.IddichVu
                };
            }).ToList();

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi lấy danh sách dịch vụ của khuyến mãi");
            return StatusCode(500, new { message = "Lỗi khi lấy danh sách dịch vụ của khuyến mãi", error = ex.Message });
        }
    }

    // PATCH: api/khuyenmai/dich-vu/{mappingId}/bat-tat
    [HttpPatch("dich-vu/{mappingId}/bat-tat")]
    public async Task<IActionResult> ToggleServiceMapping(int mappingId)
    {
        try
        {
            var mapping = await _context.KhuyenMaiDichVus.FirstOrDefaultAsync(m => m.Id == mappingId);
            if (mapping == null) return NotFound(new { message = "Không tìm thấy mapping" });

            mapping.IsActive = !mapping.IsActive;
            mapping.UpdatedAt = DateTime.Now;
            _context.KhuyenMaiDichVus.Update(mapping);
            await _context.SaveChangesAsync();

            return Ok(new { id = mapping.Id, isActive = mapping.IsActive });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi toggle mapping dịch vụ");
            return StatusCode(500, new { message = "Lỗi khi toggle mapping dịch vụ", error = ex.Message });
        }
    }

    // DELETE: api/khuyenmai/dich-vu/{mappingId}
    [HttpDelete("dich-vu/{mappingId}")]
    public async Task<IActionResult> DeleteServiceMapping(int mappingId)
    {
        try
        {
            var mapping = await _context.KhuyenMaiDichVus.FirstOrDefaultAsync(m => m.Id == mappingId);
            if (mapping == null) return NotFound(new { message = "Không tìm thấy mapping" });

            _context.KhuyenMaiDichVus.Remove(mapping);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Xóa mapping dịch vụ thành công" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi xóa mapping dịch vụ");
            return StatusCode(500, new { message = "Lỗi khi xóa mapping dịch vụ", error = ex.Message });
        }
    }

    // POST: api/khuyenmai/cap-nhat-trang-thai-het-han
    // Cập nhật trạng thái expired cho các khuyến mãi hết hạn
    [HttpPost("cap-nhat-trang-thai-het-han")]
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
    private async Task<string> GeneratePromotionId()
    {
        // Tìm ID khuyến mãi lớn nhất hiện tại
        var lastPromotion = await _context.KhuyenMais
            .Where(k => k.IdkhuyenMai.StartsWith("KM"))
            .OrderByDescending(k => k.IdkhuyenMai)
            .FirstOrDefaultAsync();

        int nextNumber = 1;
        if (lastPromotion != null)
        {
            // Trích xuất số từ ID cuối cùng (KM001 -> 1)
            var numberPart = lastPromotion.IdkhuyenMai.Substring(2);
            if (int.TryParse(numberPart, out int lastNumber))
            {
                nextNumber = lastNumber + 1;
            }
        }

        return $"KM{nextNumber:D3}"; // KM001, KM002, etc.
    }

    private async Task<string?> RenameBannerImage(string currentPath, string tenKhuyenMai)
    {
        try
        {
            // Đường dẫn vật lý hiện tại
            var currentFullPath = Path.Combine(_env.ContentRootPath, "wwwroot", currentPath.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));

            // Nếu file không tồn tại tại đường dẫn được cung cấp, thử fallback vào thư mục img/promotion
            if (!System.IO.File.Exists(currentFullPath))
            {
                var fallbackPath = Path.Combine(_env.ContentRootPath, "wwwroot", "img", "promotion", Path.GetFileName(currentPath));
                if (System.IO.File.Exists(fallbackPath))
                {
                    currentFullPath = fallbackPath;
                }
                else
                {
                    _logger.LogWarning($"File không tồn tại: {currentFullPath} và không tìm thấy tại {fallbackPath}");
                    return currentPath; // Giữ nguyên nếu file không tồn tại
                }
            }

            // Tạo tên file mới: KM_tên khuyến mãi (thay thế ký tự không hợp lệ bằng _)
            var invalidChars = Path.GetInvalidFileNameChars();
            var sanitizedName = new string(tenKhuyenMai.Select(c => invalidChars.Contains(c) ? '_' : c).ToArray()).Replace(" ", "_").Trim('_');
            var extension = Path.GetExtension(currentFullPath);
            var newFileName = $"KM_{sanitizedName}{extension}";
            var newFullPath = Path.Combine(_env.ContentRootPath, "wwwroot", "img", "promotion", newFileName);

            // Nếu file mới đã tồn tại, thêm số vào cuối
            int counter = 1;
            var baseName = Path.GetFileNameWithoutExtension(newFileName);
            while (System.IO.File.Exists(newFullPath))
            {
                newFileName = $"{baseName}_{counter}{extension}";
                newFullPath = Path.Combine(_env.ContentRootPath, "wwwroot", "img", "promotion", newFileName);
                counter++;
            }

            // Đổi tên file
            System.IO.File.Move(currentFullPath, newFullPath);

            // Trả về đường dẫn tương đối mới
            return $"/img/promotion/{newFileName}";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Lỗi khi đổi tên file banner: {currentPath}");
            return currentPath; // Giữ nguyên nếu có lỗi
        }
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
        var today = DateOnly.FromDateTime(DateTime.Now);
        return new KhuyenMaiDto
        {
            IdkhuyenMai = promotion.IdkhuyenMai,
            TenKhuyenMai = promotion.TenKhuyenMai,
            LoaiKhuyenMai = promotion.LoaiKhuyenMai,
            MoTa = promotion.MoTa,
            LoaiGiamGia = promotion.LoaiGiamGia,
            GiaTriGiam = promotion.GiaTriGiam,
            NgayBatDau = promotion.NgayBatDau,
            NgayKetThuc = promotion.NgayKetThuc,
            TrangThai = promotion.TrangThai,
            HinhAnhBanner = promotion.HinhAnhBanner,
            CreatedAt = promotion.CreatedAt,
            UpdatedAt = promotion.UpdatedAt,
            KhuyenMaiPhongs = promotion.KhuyenMaiPhongs.Select(kmp => new KhuyenMaiPhongDto
            {
                Id = kmp.Id,
                Idphong = kmp.Idphong,
                TenPhong = kmp.IdphongNavigation?.TenPhong ?? kmp.Idphong ?? "N/A",
                IsActive = kmp.IsActive,
                NgayApDung = kmp.NgayApDung,
                NgayKetThuc = kmp.NgayKetThuc
            }).ToList(),
            KhuyenMaiDichVus = promotion.KhuyenMaiDichVus?.Select(m =>
            {
                var effectiveIsActive = m.IsActive;
                if (!string.IsNullOrEmpty(promotion.TrangThai) && promotion.TrangThai == "active")
                {
                    var startsOk = !m.NgayApDung.HasValue || m.NgayApDung.Value <= today;
                    var endsOk = !m.NgayKetThuc.HasValue || m.NgayKetThuc.Value >= today;
                    if (startsOk && endsOk) effectiveIsActive = true;
                }

                return new KhuyenMaiDichVuDto
                {
                    Id = m.Id,
                    IdkhuyenMai = m.IdkhuyenMai,
                    IddichVu = m.IddichVu,
                    IsActive = effectiveIsActive,
                    NgayApDung = m.NgayApDung,
                    NgayKetThuc = m.NgayKetThuc,
                    CreatedAt = m.CreatedAt,
                    UpdatedAt = m.UpdatedAt,
                    TenDichVu = m.IddichVuNavigation?.TenDichVu ?? m.IddichVu
                };
            }).ToList() ?? new List<KhuyenMaiDichVuDto>()
            ,
            KhuyenMaiCombos = promotion.KhuyenMaiCombos?.Select(c => new DTOs.Promotions.KhuyenMaiComboDto
            {
                IdkhuyenMaiCombo = c.IdkhuyenMaiCombo,
                TenCombo = c.TenCombo,
                MoTa = c.MoTa,
                NgayBatDau = c.NgayBatDau,
                NgayKetThuc = c.NgayKetThuc,
                TrangThai = c.TrangThai,
                KhuyenMaiComboDichVus = c.KhuyenMaiComboDichVus?.Select(cd =>
                {
                    var dichVu = cd.IddichVuNavigation;
                    var details = dichVu?.TtdichVus?.FirstOrDefault();
                    return new DTOs.Promotions.KhuyenMaiComboDichVuDto
                    {
                        Id = cd.Id,
                        IdkhuyenMaiCombo = cd.IdkhuyenMaiCombo,
                        IddichVu = cd.IddichVu,
                        TenDichVu = dichVu?.TenDichVu ?? cd.IddichVu,
                        TienDichVu = dichVu?.TienDichVu,
                        HinhDichVu = dichVu?.HinhDichVu,
                        ThongTinDv = details?.ThongTinDv,
                        ThoiLuongUocTinh = details?.ThoiLuongUocTinh,
                        IsActive = cd.IsActive
                    };
                }).ToList() ?? new List<DTOs.Promotions.KhuyenMaiComboDichVuDto>()
            }).ToList() ?? new List<DTOs.Promotions.KhuyenMaiComboDto>()
        };
    }
}
