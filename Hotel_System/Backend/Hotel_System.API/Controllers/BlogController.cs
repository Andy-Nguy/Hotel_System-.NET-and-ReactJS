using System;
using System.Linq;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.IO;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using System.Text.RegularExpressions;
using System.Globalization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Hotel_System.API.Models;

namespace Hotel_System.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class BlogController : ControllerBase
    {
        private readonly HotelSystemContext _db;
        private readonly IWebHostEnvironment _env;
        private readonly string _storagePath;
        private static readonly object _fileLock = new object();

        public BlogController(HotelSystemContext db, IWebHostEnvironment env)
        {
            _db = db;
            _env = env;
            var dataDir = Path.Combine(_env.ContentRootPath, "Data");
            if (!Directory.Exists(dataDir)) Directory.CreateDirectory(dataDir);
            _storagePath = Path.Combine(dataDir, "blogposts.json");
            // ensure file exists
            if (!System.IO.File.Exists(_storagePath)) System.IO.File.WriteAllText(_storagePath, "[]");
        }

        // Admin image upload endpoint: saves file to wwwroot/img/blog and returns public URL
        [HttpPost("/admin/blogs/upload-image")]
        public async Task<IActionResult> UploadImage(IFormFile file, [FromQuery] string? title = "", [FromQuery] string type = "gallery", [FromQuery] string? replacePath = null)
        {
            try
            {
                if (file == null || file.Length == 0)
                    return BadRequest(new { message = "Không có file được upload" });

                // Validate file type
                var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".webp", ".gif" };
                var fileExtension = Path.GetExtension(file.FileName).ToLower();
                if (!allowedExtensions.Contains(fileExtension))
                    return BadRequest(new { message = "Chỉ chấp nhận file ảnh JPG, PNG, WebP, GIF" });

                // Validate file size (max 5MB)
                if (file.Length > 5 * 1024 * 1024)
                    return BadRequest(new { message = "Kích thước file không được vượt quá 5MB" });

                var blogPath = Path.Combine(_env.ContentRootPath, "wwwroot", "img", "blog");
                if (!Directory.Exists(blogPath)) Directory.CreateDirectory(blogPath);

                string fileName;
                // If replacePath provided, overwrite the existing filename
                if (!string.IsNullOrWhiteSpace(replacePath))
                {
                    fileName = Path.GetFileName(replacePath);
                }
                else if (type?.Trim().ToLowerInvariant() == "banner")
                {
                    // Banner: BlogBanner_{slug}{ext}
                    var slug = Slugify(title ?? "");
                    if (string.IsNullOrWhiteSpace(slug)) slug = Guid.NewGuid().ToString("N");
                    fileName = $"BlogBanner_{slug}{fileExtension}";
                }
                else
                {
                    // Gallery: Blog_{slug}_1, _2, ... (choose next index)
                    var slug = Slugify(title ?? "");
                    if (string.IsNullOrWhiteSpace(slug)) slug = Guid.NewGuid().ToString("N");
                    // find existing files with prefix Blog_{slug}_
                    var existing = Directory.GetFiles(blogPath)
                        .Select(p => Path.GetFileNameWithoutExtension(p))
                        .Where(n => n != null && n.StartsWith($"Blog_{slug}_"))
                        .ToList();
                    var maxIndex = 0;
                    foreach (var name in existing)
                    {
                        var parts = name.Split('_');
                        if (parts.Length >= 3 && int.TryParse(parts.Last(), out var idx))
                        {
                            if (idx > maxIndex) maxIndex = idx;
                        }
                    }
                    var next = maxIndex + 1;
                    fileName = $"Blog_{slug}_{next}{fileExtension}";
                }

                var filePath = Path.Combine(blogPath, fileName);

                // Save (overwrite if exists)
                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                var relativePath = $"/img/blog/{fileName}";
                Console.WriteLine($"[UploadImage] Upload thành công: {relativePath} ({file.Length} bytes)");

                return Ok(new
                {
                    fileName = fileName,
                    relativePath = relativePath,
                    fullPath = filePath,
                    size = file.Length,
                    contentType = file.ContentType
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[UploadImage] Lỗi: {ex.Message}");
                return StatusCode(500, new { message = "Lỗi khi upload hình ảnh", error = ex.Message });
            }
        }

        // Delete image file endpoint
        [HttpDelete("delete-image")]
        public IActionResult DeleteImage([FromQuery] string path)
        {
            if (string.IsNullOrWhiteSpace(path))
                return BadRequest("Image path is required.");

            DeleteImageFile(path);
            return Ok(new { message = "Image deleted successfully" });
        }

        // Admin create endpoint: POST /admin/blogs
        public class AdminCreateBlogRequest
        {
            public string Title { get; set; } = string.Empty;
            public string Category { get; set; } = string.Empty;
            public string Type { get; set; } = "internal"; // internal | external
            public string Image { get; set; } = string.Empty; // cover image URL
            public string Date { get; set; } = string.Empty;
            public string Excerpt { get; set; } = string.Empty;
            public string Author { get; set; } = string.Empty;
            public List<string> Tags { get; set; } = new();
            public string Content { get; set; } = string.Empty;
            public List<string> Images { get; set; } = new();
            public string ExternalLink { get; set; } = string.Empty;
            public string Slug { get; set; } = string.Empty;
            public string Status { get; set; } = "DRAFT";
            // Optional display order when creating as PUBLISHED
            public int? DisplayOrder { get; set; } = null;
        }

        /// <summary>
        /// Validates blog creation request and returns error message if invalid, null if valid
        /// </summary>
        private string ValidateBlogCreationRequest(AdminCreateBlogRequest dto, List<BlogPost> existingPosts)
        {
            // Null check
            if (dto == null) return "Invalid payload";

            // ===== BASIC FIELD VALIDATION =====
            if (string.IsNullOrWhiteSpace(dto.Title))
                return "Title is required.";
            
            if (string.IsNullOrWhiteSpace(dto.Category))
                return "Category is required.";
            
            if (string.IsNullOrWhiteSpace(dto.Type))
                return "Type is required (must be 'internal' or 'external').";

            var type = dto.Type?.Trim().ToLowerInvariant();
            if (type != "internal" && type != "external")
                return $"Invalid blog type '{dto.Type}'. Allowed values: 'internal', 'external'.";

            // ===== COVER IMAGE VALIDATION =====
            if (string.IsNullOrWhiteSpace(dto.Image))
                return "Cover image is required for all blog types.";

            // ===== TITLE UNIQUENESS CHECK =====
            var titleExists = existingPosts.Any(p => 
                string.Equals(p.Title?.Trim(), dto.Title?.Trim(), StringComparison.OrdinalIgnoreCase));
            if (titleExists)
                return $"A blog post with the title '{dto.Title}' already exists. Please use a different title.";

            // ===== SLUG VALIDATION =====
            var slug = string.IsNullOrWhiteSpace(dto.Slug) ? Slugify(dto.Title) : Slugify(dto.Slug);
            if (string.IsNullOrWhiteSpace(slug))
                return "Could not generate a valid slug from title. Please check your title.";
            
            var slugExists = existingPosts.Any(p => 
                string.Equals(p.Slug, slug, StringComparison.OrdinalIgnoreCase));
            if (slugExists)
                return $"A blog post with the slug '{slug}' already exists. Please use a different title or slug.";

            // ===== TYPE-SPECIFIC VALIDATION =====
            if (type == "internal")
            {
                // Internal blog MUST have content
                if (string.IsNullOrWhiteSpace(dto.Content))
                    return "Content is required for internal blog type.";

                // Internal blog MUST have gallery images
                if (dto.Images == null || dto.Images.Count == 0)
                    return "At least one gallery image is required for internal blog type.";

                // Internal blog MUST NOT have external link
                if (!string.IsNullOrWhiteSpace(dto.ExternalLink))
                    return "External link must be empty for internal blog type.";
            }
            else if (type == "external")
            {
                // External blog MUST have external link
                if (string.IsNullOrWhiteSpace(dto.ExternalLink))
                    return "External link is required for external blog type.";

                // Validate URL format
                if (!Uri.TryCreate(dto.ExternalLink, UriKind.Absolute, out var uri))
                    return $"External link '{dto.ExternalLink}' is not a valid URL.";

                if (!(uri.Scheme == "http" || uri.Scheme == "https"))
                    return $"External link must use HTTP or HTTPS protocol. Got: '{uri.Scheme}'.";

                // External blogs should NOT have content or images
                if (!string.IsNullOrWhiteSpace(dto.Content))
                    return "Content should be empty for external blog type (use excerpt instead).";

                if (dto.Images != null && dto.Images.Count > 0)
                    return "Gallery images should be empty for external blog type (use cover image only).";
            }

            // ===== TAGS VALIDATION =====
            if (dto.Tags != null && dto.Tags.Any(t => string.IsNullOrWhiteSpace(t)))
                return "Tags must be an array of non-empty strings.";

            // All validations passed
            return null;
        }

        /// <summary>
        /// Creates a new blog post via admin endpoint
        /// POST /admin/blogs
        /// </summary>
        [HttpPost("/admin/blogs")]
        public IActionResult AdminCreate([FromBody] AdminCreateBlogRequest dto)
        {
            // NOTE: Authentication/authorization should be enforced here in a real app.

            // Load existing posts for duplicate checks
            var posts = LoadFromFile();

            // Validate request comprehensively
            var validationError = ValidateBlogCreationRequest(dto, posts);
            if (validationError != null)
                return BadRequest(new { error = validationError, timestamp = DateTime.UtcNow });

            // ===== PARSE AND PROCESS DATA =====
            // Parse date
            DateTime createdAt = DateTime.UtcNow;
            if (!string.IsNullOrWhiteSpace(dto.Date))
            {
                // Remove ordinal suffixes (st, nd, rd, th)
                var cleaned = Regex.Replace(dto.Date, @"(\d+)(st|nd|rd|th)", "$1", RegexOptions.IgnoreCase);
                
                // Try multiple parsing strategies
                if (!DateTime.TryParse(cleaned, CultureInfo.InvariantCulture, 
                    DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out var parsed))
                {
                    if (!DateTime.TryParse(cleaned, CultureInfo.CurrentCulture, 
                        DateTimeStyles.AssumeUniversal, out parsed))
                    {
                        DateTime.TryParse(cleaned, out parsed);
                    }
                }
                
                if (parsed != default(DateTime))
                    createdAt = parsed.ToUniversalTime();
            }

            // Generate slug
            var slug = string.IsNullOrWhiteSpace(dto.Slug) ? Slugify(dto.Title) : Slugify(dto.Slug);

            // Generate next ID
            var nextId = posts.Any() ? posts.Max(p => p.Id) + 1 : 1;

            // Normalize status
            var status = string.IsNullOrWhiteSpace(dto.Status) ? "DRAFT" : dto.Status.Trim().ToUpperInvariant();
            if (status != "DRAFT" && status != "PUBLISHED" && status != "DELETED")
                status = "DRAFT";

            // Convert tags list to comma-separated string
            var tagsString = dto.Tags != null && dto.Tags.Count > 0 
                ? string.Join(',', dto.Tags.Where(t => !string.IsNullOrWhiteSpace(t)))
                : string.Empty;

            // ===== CREATE BLOG POST OBJECT =====
            var post = new BlogPost
            {
                Id = nextId,
                Title = dto.Title.Trim(),
                Slug = slug,
                Excerpt = dto.Excerpt?.Trim() ?? string.Empty,
                Content = dto.Content?.Trim() ?? string.Empty,
                Image = dto.Image?.Trim() ?? string.Empty,
                Category = dto.Category.Trim(),
                Author = string.IsNullOrWhiteSpace(dto.Author) ? "Admin" : dto.Author.Trim(),
                AuthorId = string.Empty, // For future DB integration
                Status = status,
                Type = dto.Type.Trim().ToLowerInvariant(),
                Images = dto.Images ?? new List<string>(),
                ExternalLink = dto.ExternalLink?.Trim() ?? string.Empty,
                Tags = tagsString,
                Date = dto.Date?.Trim() ?? string.Empty,
                CreatedAt = createdAt,
                UpdatedAt = DateTime.UtcNow,
                PublishedAt = (status == "PUBLISHED") ? (DateTime?)DateTime.UtcNow : null,
            };

            // Handle DisplayOrder if provided in admin creation
            if (dto.DisplayOrder.HasValue)
            {
                if (status != "PUBLISHED")
                    return BadRequest(new { error = "DisplayOrder can only be set when creating a PUBLISHED post" });
                if (dto.DisplayOrder < 1 || dto.DisplayOrder > 5)
                    return BadRequest(new { error = "DisplayOrder must be between 1 and 5" });
                var conflict = posts.FirstOrDefault(p => string.Equals(p.Status, "PUBLISHED", StringComparison.OrdinalIgnoreCase) && p.DisplayOrder == dto.DisplayOrder);
                if (conflict != null)
                    conflict.DisplayOrder = null;
                post.DisplayOrder = dto.DisplayOrder;
            }

            // ===== SAVE TO FILE =====
            posts.Add(post);
            SaveToFile(posts);

            // ===== RETURN CREATED RESPONSE =====
            return CreatedAtAction(nameof(GetBySlug), new { slug = post.Slug }, post);
        }

        // GET: api/blog
        [HttpGet]
        public IActionResult Get([FromQuery] bool admin = false)
        {
            var posts = LoadFromFile();
            
            // Normalize image paths (fix legacy /images/blog/ to /img/blog/)
            foreach (var post in posts)
            {
                if (!string.IsNullOrEmpty(post.Image) && post.Image.Contains("/images/blog/"))
                    post.Image = post.Image.Replace("/images/blog/", "/img/blog/");
                
                if (post.Images != null && post.Images.Count > 0)
                {
                    for (int i = 0; i < post.Images.Count; i++)
                    {
                        if (post.Images[i].Contains("/images/blog/"))
                            post.Images[i] = post.Images[i].Replace("/images/blog/", "/img/blog/");
                    }
                }
            }
            
            if (!admin)
            {
                var published = posts.Where(b => string.Equals(b.Status, "PUBLISHED", StringComparison.OrdinalIgnoreCase) && b.DisplayOrder.HasValue)
                                     .OrderBy(b => b.DisplayOrder)
                                     .Take(5)
                                     .ToList();
                // Debug log: show which IDs and orders are being returned for public API
                try { Console.WriteLine($"[BlogController] Serving public blogs: {string.Join(',', published.Select(p => p.Id + ":" + p.DisplayOrder))}"); } catch {}
                return Ok(published);
            }
            return Ok(posts.OrderByDescending(b => b.CreatedAt));
        }

        // GET api/blog/{slug}
        [HttpGet("{slug}")]
        public IActionResult GetBySlug(string slug)
        {
            var posts = LoadFromFile();
            // First try to get by slug
            var post = posts.FirstOrDefault(b => string.Equals(b.Slug, slug, StringComparison.OrdinalIgnoreCase));
            if (post != null)
            {
                // Normalize image paths
                if (!string.IsNullOrEmpty(post.Image) && post.Image.Contains("/images/blog/"))
                    post.Image = post.Image.Replace("/images/blog/", "/img/blog/");
                if (post.Images != null)
                    post.Images = post.Images.Select(i => i.Replace("/images/blog/", "/img/blog/")).ToList();
                return Ok(post);
            }
            
            // If not found by slug, try by ID (for edit endpoint which uses numeric ID)
            if (int.TryParse(slug, out int id))
            {
                post = posts.FirstOrDefault(b => b.Id == id);
                if (post != null)
                {
                    // Normalize image paths
                    if (!string.IsNullOrEmpty(post.Image) && post.Image.Contains("/images/blog/"))
                        post.Image = post.Image.Replace("/images/blog/", "/img/blog/");
                    if (post.Images != null)
                        post.Images = post.Images.Select(i => i.Replace("/images/blog/", "/img/blog/")).ToList();
                    return Ok(post);
                }
            }
            
            return NotFound();
        }

        // POST api/blog
        [HttpPost]
        public IActionResult Create([FromBody] BlogPost model)
        {
            if (string.IsNullOrWhiteSpace(model.Title) || string.IsNullOrWhiteSpace(model.Category))
                return BadRequest("Title and Category are required.");
            
            // For internal blogs, content is required
            if (model.Type == "internal" && string.IsNullOrWhiteSpace(model.Content))
                return BadRequest("Content is required for internal blogs.");
            
            // For external blogs, external link is required
            if (model.Type == "external" && string.IsNullOrWhiteSpace(model.ExternalLink))
                return BadRequest("External link is required for external blogs.");

            // slug uniqueness
            if (string.IsNullOrWhiteSpace(model.Slug)) model.Slug = Slugify(model.Title);
            var posts = LoadFromFile();
            if (posts.Any(b => string.Equals(b.Slug, model.Slug, StringComparison.OrdinalIgnoreCase))) return BadRequest("Slug already exists.");

            // Validate DisplayOrder
            if (model.DisplayOrder.HasValue)
            {
                if (!string.Equals(model.Status, "PUBLISHED", StringComparison.OrdinalIgnoreCase))
                    return BadRequest("DisplayOrder can only be set for PUBLISHED blogs");
                if (model.DisplayOrder < 1 || model.DisplayOrder > 5)
                    return BadRequest("DisplayOrder must be between 1 and 5");
                // Check for conflicts
                var conflict = posts.FirstOrDefault(p => string.Equals(p.Status, "PUBLISHED", StringComparison.OrdinalIgnoreCase) && p.DisplayOrder == model.DisplayOrder);
                if (conflict != null)
                    conflict.DisplayOrder = null;
            }

            model.CreatedAt = DateTime.UtcNow;
            model.UpdatedAt = DateTime.UtcNow;

            if (string.Equals(model.Status, "PUBLISHED", StringComparison.OrdinalIgnoreCase)) model.PublishedAt = DateTime.UtcNow;

            posts.Add(model);
            SaveToFile(posts);
            return CreatedAtAction(nameof(GetBySlug), new { slug = model.Slug }, model);
        }

        // PUT api/blog/{id}
        [HttpPut("{id}")]
            public IActionResult Update(int id, [FromBody] BlogPost model)
            {
                try
                {
                    Console.WriteLine($"[PUT /api/blog/{id}] Starting update with model: Title={model.Title}, Status={model.Status}, DisplayOrder={model.DisplayOrder}");
                    var posts = LoadFromFile();
                    var existing = posts.FirstOrDefault(p => p.Id == id);
                    if (existing == null) {
                        Console.WriteLine($"[PUT /api/blog/{id}] Blog not found");
                        return NotFound();
                    }

                    if (!string.IsNullOrWhiteSpace(model.Slug) && !string.Equals(model.Slug, existing.Slug, StringComparison.OrdinalIgnoreCase))
                    {
                        if (posts.Any(b => string.Equals(b.Slug, model.Slug, StringComparison.OrdinalIgnoreCase) && b.Id != id)) {
                            Console.WriteLine($"[PUT /api/blog/{id}] Slug already exists: {model.Slug}");
                            return BadRequest("Slug already exists.");
                        }
                        existing.Slug = model.Slug;
                    }

                    // Update all fields that are provided
                    if (!string.IsNullOrWhiteSpace(model.Title)) existing.Title = model.Title;
                    if (!string.IsNullOrWhiteSpace(model.Excerpt)) existing.Excerpt = model.Excerpt;
                    if (!string.IsNullOrWhiteSpace(model.Content)) existing.Content = model.Content;
                    if (!string.IsNullOrWhiteSpace(model.Category)) existing.Category = model.Category;
                    if (!string.IsNullOrWhiteSpace(model.Author)) existing.Author = model.Author;
                    if (!string.IsNullOrWhiteSpace(model.Status)) existing.Status = model.Status;
                    if (!string.IsNullOrWhiteSpace(model.Type)) existing.Type = model.Type;
                    if (!string.IsNullOrWhiteSpace(model.Date)) existing.Date = model.Date;
                    if (!string.IsNullOrWhiteSpace(model.ExternalLink)) existing.ExternalLink = model.ExternalLink;
                    if (!string.IsNullOrWhiteSpace(model.Tags)) existing.Tags = model.Tags;
                    
                    // Update images array
                    if (model.Images != null && model.Images.Count > 0)
                    {
                        existing.Images = model.Images;
                    }
                    
                    // ===== IF IMAGE CHANGED, DELETE OLD IMAGE AND RENAME NEW IMAGE =====
                    if (model.Image != null && !string.Equals(model.Image, existing.Image, StringComparison.OrdinalIgnoreCase))
                    {
                        // Delete old image file
                        DeleteImageFile(existing.Image);
                        existing.Image = model.Image;
                    }
                    else if (!string.IsNullOrWhiteSpace(model.Image))
                    {
                        existing.Image = model.Image;
                    }

                    // Determine the target status after this update
                    var newStatus = string.IsNullOrWhiteSpace(model.Status) ? existing.Status : model.Status;
                    Console.WriteLine($"[PUT /api/blog/{id}] New status: {newStatus}");

                    // Handle DisplayOrder: only process if it's being explicitly set
                    if (model.DisplayOrder.HasValue && model.DisplayOrder.Value != 0)
                    {
                        Console.WriteLine($"[PUT /api/blog/{id}] Processing DisplayOrder: {model.DisplayOrder.Value}");
                        // Can only set displayOrder when target status is PUBLISHED
                        if (!string.Equals(newStatus, "PUBLISHED", StringComparison.OrdinalIgnoreCase))
                            return BadRequest("DisplayOrder can only be set for PUBLISHED blogs");
                        if (model.DisplayOrder < 1 || model.DisplayOrder > 5)
                            return BadRequest("DisplayOrder must be between 1 and 5");
                        // Check for conflicts and clear them
                        var conflict = posts.FirstOrDefault(p => p.Id != id && string.Equals(p.Status, "PUBLISHED", StringComparison.OrdinalIgnoreCase) && p.DisplayOrder == model.DisplayOrder);
                        if (conflict != null)
                            conflict.DisplayOrder = null;
                        existing.DisplayOrder = model.DisplayOrder;
                    }
                    else if (!string.Equals(newStatus, "PUBLISHED", StringComparison.OrdinalIgnoreCase))
                    {
                        Console.WriteLine($"[PUT /api/blog/{id}] Clearing DisplayOrder for non-PUBLISHED status");
                        // If changing to non-PUBLISHED status, always clear displayOrder
                        existing.DisplayOrder = null;
                    }

                    existing.UpdatedAt = DateTime.UtcNow;
                    if (string.Equals(newStatus, "PUBLISHED", StringComparison.OrdinalIgnoreCase) && existing.PublishedAt == null) 
                        existing.PublishedAt = DateTime.UtcNow;

                    Console.WriteLine($"[PUT /api/blog/{id}] Saving to file...");
                    SaveToFile(posts);
                    Console.WriteLine($"[PUT /api/blog/{id}] Update successful");
                    return Ok(existing);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[PUT /api/blog/{id}] Exception: {ex.Message}\n{ex.StackTrace}");
                    return BadRequest(new { error = $"Internal error: {ex.Message}", stack = ex.StackTrace });
                }
            }

        // DELETE api/blog/{id}
        [HttpDelete("{id}")]
        public IActionResult Delete(int id)
        {
            var posts = LoadFromFile();
            var existing = posts.FirstOrDefault(p => p.Id == id);
            if (existing == null) return NotFound();
            
            Console.WriteLine($"[DELETE /api/blog/{id}] Deleting blog: {existing.Title}");
            
            // Delete cover image
            if (!string.IsNullOrWhiteSpace(existing.Image))
            {
                Console.WriteLine($"[DELETE /api/blog/{id}] Deleting cover image: {existing.Image}");
                DeleteImageFile(existing.Image);
            }
            
            // Delete gallery images
            if (existing.Images != null && existing.Images.Any())
            {
                Console.WriteLine($"[DELETE /api/blog/{id}] Deleting {existing.Images.Count} gallery images");
                foreach (var imagePath in existing.Images)
                {
                    DeleteImageFile(imagePath);
                }
            }
            
            // Always hard delete - remove completely from data
            posts = posts.Where(p => p.Id != id).ToList();
            
            // Re-index DisplayOrder to prevent gaps (e.g., 1, 3, 4 → 1, 2, 3)
            var publishedBlogs = posts.Where(p => string.Equals(p.Status, "PUBLISHED", StringComparison.OrdinalIgnoreCase))
                                      .OrderBy(p => p.DisplayOrder ?? int.MaxValue)
                                      .ToList();
            
            for (int i = 0; i < publishedBlogs.Count; i++)
            {
                if (publishedBlogs[i].DisplayOrder.HasValue)
                {
                    publishedBlogs[i].DisplayOrder = i + 1; // Renumber: 1, 2, 3, ...
                }
            }
            
            SaveToFile(posts);
            Console.WriteLine($"[DELETE /api/blog/{id}] Blog deleted successfully. Remaining posts: {posts.Count}");
            return NoContent();
        }

        /// <summary>
        /// Approve a pending blog post
        /// POST /api/blog/{id}/approve
        /// </summary>
        [HttpPost("{id}/duyet")]
        public IActionResult Approve(int id)
        {
            var posts = LoadFromFile();
            var existing = posts.FirstOrDefault(p => p.Id == id);
            if (existing == null) return NotFound();

            if (existing.Status != "PENDING" && existing.Status != "REJECTED")
            {
                return BadRequest(new { error = $"Can only approve PENDING or REJECTED blogs. Current status: {existing.Status}" });
            }

            existing.Status = "APPROVED";
            existing.ApprovedAt = DateTime.UtcNow;
            existing.RejectionReason = string.Empty; // Clear rejection reason
            existing.RejectedAt = null;
            existing.UpdatedAt = DateTime.UtcNow;

            SaveToFile(posts);
            return Ok(existing);
        }

        // POST api/blog/{id}/thu-tu-hien-thi
        [HttpPost("{id}/thu-tu-hien-thi")]
        public IActionResult SetDisplayOrder(int id, [FromBody] int? displayOrder)
        {
            var posts = LoadFromFile();
            var existing = posts.FirstOrDefault(p => p.Id == id);
            if (existing == null) return NotFound();

            // If trying to set a displayOrder on a non-PUBLISHED blog, reject
            if (displayOrder.HasValue && !string.Equals(existing.Status, "PUBLISHED", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { error = "DisplayOrder can only be set for PUBLISHED blogs" });

            if (displayOrder.HasValue)
            {
                if (displayOrder < 1 || displayOrder > 5)
                    return BadRequest(new { error = "DisplayOrder must be between 1 and 5" });

                // Check for conflicts and clear them
                var conflict = posts.FirstOrDefault(p => p.Id != id && string.Equals(p.Status, "PUBLISHED", StringComparison.OrdinalIgnoreCase) && p.DisplayOrder == displayOrder);
                if (conflict != null)
                    conflict.DisplayOrder = null;

                existing.DisplayOrder = displayOrder;
            }
            else
            {
                // Clear display order
                existing.DisplayOrder = null;
            }

            SaveToFile(posts);
            return Ok(existing);
        }

        /// <summary>
        /// Reject a pending blog post
        /// POST /api/blog/{id}/reject
        /// </summary>
        [HttpPost("{id}/tu-choi")]
        public IActionResult Reject(int id, [FromBody] RejectRequest request)
        {
            var posts = LoadFromFile();
            var existing = posts.FirstOrDefault(p => p.Id == id);
            if (existing == null) return NotFound();

            if (existing.Status != "PENDING" && existing.Status != "APPROVED")
            {
                return BadRequest(new { error = $"Can only reject PENDING or APPROVED blogs. Current status: {existing.Status}" });
            }

            existing.Status = "REJECTED";
            existing.RejectionReason = request?.Reason?.Trim() ?? "No reason provided";
            existing.RejectedAt = DateTime.UtcNow;
            existing.ApprovedAt = null;
            existing.UpdatedAt = DateTime.UtcNow;

            SaveToFile(posts);
            return Ok(existing);
        }

        /// <summary>
        /// Publish an approved blog post
        /// POST /api/blog/{id}/publish
        /// </summary>
        [HttpPost("{id}/xuat-ban")]
        public IActionResult Publish(int id)
        {
            var posts = LoadFromFile();
            var existing = posts.FirstOrDefault(p => p.Id == id);
            if (existing == null) return NotFound();

            // Allow admin to publish drafts or archived posts directly.
            if (existing.Status == "DELETED")
            {
                return BadRequest(new { error = $"Cannot publish a deleted blog. Current status: {existing.Status}" });
            }

            // Check if already 5 published blogs - if so, ask admin to unlist one
            var publishedCount = posts.Count(p => p.Status == "PUBLISHED" && p.Id != id);
            if (publishedCount >= 5)
            {
                return BadRequest(new { error = "Maximum 5 published blogs allowed. Please unpublish or hide one blog first." });
            }

            existing.Status = "PUBLISHED";
            existing.PublishedAt = DateTime.UtcNow;
            existing.UpdatedAt = DateTime.UtcNow;

            SaveToFile(posts);
            return Ok(existing);
        }

        /// <summary>
        /// Hide a published blog post
        /// POST /api/blog/{id}/hide
        /// </summary>
        [HttpPost("{id}/an")]
        public IActionResult Hide(int id)
        {
            var posts = LoadFromFile();
            var existing = posts.FirstOrDefault(p => p.Id == id);
            if (existing == null) return NotFound();

            if (existing.Status != "PUBLISHED")
            {
                return BadRequest(new { error = $"Can only hide PUBLISHED blogs. Current status: {existing.Status}" });
            }

            // Use ARCHIVED as the canonical 'hidden' state per admin UX rules
            existing.Status = "ARCHIVED";
            existing.UpdatedAt = DateTime.UtcNow;

            SaveToFile(posts);
            return Ok(existing);
        }

        /// <summary>
        /// Increment view count for a blog post (not for admin views)
        /// POST /api/blog/{id}/increment-views
        /// </summary>
        [HttpPost("{id}/tang-luot-xem")]
        public IActionResult IncrementViewCount(int id)
        {
            var posts = LoadFromFile();
            var existing = posts.FirstOrDefault(p => p.Id == id);
            if (existing == null) return NotFound();

            // Only increment for published blogs
            if (existing.Status == "PUBLISHED")
            {
                existing.ViewCount++;
                SaveToFile(posts);
            }

            return Ok(new { viewCount = existing.ViewCount });
        }

        public class RejectRequest
        {
            public string Reason { get; set; } = string.Empty;
        }

            private List<BlogPost> LoadFromFile()
            {
                lock (_fileLock)
                {
                    try
                    {
                        var txt = System.IO.File.ReadAllText(_storagePath);
                        var arr = System.Text.Json.JsonSerializer.Deserialize<List<BlogPost>>(txt, new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                        return arr ?? new List<BlogPost>();
                    }
                    catch
                    {
                        return new List<BlogPost>();
                    }
                }
            }

            private void SaveToFile(List<BlogPost> posts)
            {
                lock (_fileLock)
                {
                    var txt = System.Text.Json.JsonSerializer.Serialize(posts, new System.Text.Json.JsonSerializerOptions { WriteIndented = true });
                    System.IO.File.WriteAllText(_storagePath, txt);
                }
            }

        private static string Slugify(string s)
        {
            if (string.IsNullOrWhiteSpace(s)) return string.Empty;
            var slug = s.ToLowerInvariant().Trim();
            slug = System.Text.RegularExpressions.Regex.Replace(slug, "[^a-z0-9\\s-]", "");
            slug = System.Text.RegularExpressions.Regex.Replace(slug, "\\s+", "-");
            slug = System.Text.RegularExpressions.Regex.Replace(slug, "-+", "-");
            return slug;
        }

        /// <summary>
        /// Delete image file from wwwroot/img/blog directory
        /// </summary>
        private void DeleteImageFile(string imagePath)
        {
            if (string.IsNullOrWhiteSpace(imagePath)) return;

            try
            {
                var webRoot = _env.WebRootPath;
                if (string.IsNullOrEmpty(webRoot)) webRoot = Path.Combine(_env.ContentRootPath, "wwwroot");
                
                // Extract filename from URL path (e.g., "/img/blog/Blog_title.jpg" -> "Blog_title.jpg")
                var fileName = Path.GetFileName(imagePath);
                if (string.IsNullOrWhiteSpace(fileName)) return;

                var filePath = Path.Combine(webRoot, "img", "blog", fileName);
                if (System.IO.File.Exists(filePath))
                {
                    System.IO.File.Delete(filePath);
                }
            }
            catch (Exception ex)
            {
                // Log error but don't throw - old image deletion shouldn't break the operation
                Console.Error.WriteLine($"[BlogController] Error deleting old image '{imagePath}': {ex.Message}");
            }
        }

    }
}
