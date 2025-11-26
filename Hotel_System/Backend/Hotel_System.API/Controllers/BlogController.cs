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

        // Admin image upload endpoint: saves file to wwwroot/images/blog and returns public URL
        [HttpPost("/admin/blogs/upload-image")]
        public async Task<IActionResult> UploadImage(IFormFile file, [FromQuery] string title = "")
        {
            if (file == null || file.Length == 0) return BadRequest("No file uploaded.");

            var webRoot = _env.WebRootPath;
            if (string.IsNullOrEmpty(webRoot)) webRoot = Path.Combine(_env.ContentRootPath, "wwwroot");
            var imagesDir = Path.Combine(webRoot, "images", "blog");
            if (!Directory.Exists(imagesDir)) Directory.CreateDirectory(imagesDir);

            var ext = Path.GetExtension(file.FileName);
            // Generate filename: Blog_[title].[extension]
            // If title is not provided or empty, fallback to Guid-based naming
            var fileName = string.IsNullOrWhiteSpace(title) 
                ? Guid.NewGuid().ToString("N") + ext
                : $"Blog_{Slugify(title)}{ext}";
            
            var filePath = Path.Combine(imagesDir, fileName);
            using (var stream = System.IO.File.Create(filePath))
            {
                await file.CopyToAsync(stream);
            }

            var publicUrl = $"/images/blog/{fileName}";
            return Ok(new { url = publicUrl });
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

            // ===== RENAME IMAGE FILE TO Blog_[title] FORMAT IF NEEDED =====
            var imagePath = RenameImageToBlogPattern(dto.Image, dto.Title);

            // ===== CREATE BLOG POST OBJECT =====
            var post = new BlogPost
            {
                Id = nextId,
                Title = dto.Title.Trim(),
                Slug = slug,
                Excerpt = dto.Excerpt?.Trim() ?? string.Empty,
                Content = dto.Content?.Trim() ?? string.Empty,
                Image = imagePath.Trim(),
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
            if (!admin)
            {
                var published = posts.Where(b => string.Equals(b.Status, "PUBLISHED", StringComparison.OrdinalIgnoreCase))
                                     .OrderByDescending(b => b.PublishedAt ?? b.CreatedAt)
                                     .ToList();
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
            if (post != null) return Ok(post);
            
            // If not found by slug, try by ID (for edit endpoint which uses numeric ID)
            if (int.TryParse(slug, out int id))
            {
                post = posts.FirstOrDefault(b => b.Id == id);
                if (post != null) return Ok(post);
            }
            
            return NotFound();
        }

        // POST api/blog
        [HttpPost]
        public IActionResult Create([FromBody] BlogPost model)
        {
            if (string.IsNullOrWhiteSpace(model.Title) || string.IsNullOrWhiteSpace(model.Category) || string.IsNullOrWhiteSpace(model.Content))
                return BadRequest("Title, Category and Content are required.");

            // slug uniqueness
            if (string.IsNullOrWhiteSpace(model.Slug)) model.Slug = Slugify(model.Title);
            var posts = LoadFromFile();
            if (posts.Any(b => string.Equals(b.Slug, model.Slug, StringComparison.OrdinalIgnoreCase))) return BadRequest("Slug already exists.");

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
                var posts = LoadFromFile();
                var existing = posts.FirstOrDefault(p => p.Id == id);
                if (existing == null) return NotFound();

                if (!string.IsNullOrWhiteSpace(model.Slug) && !string.Equals(model.Slug, existing.Slug, StringComparison.OrdinalIgnoreCase))
                {
                    if (posts.Any(b => string.Equals(b.Slug, model.Slug, StringComparison.OrdinalIgnoreCase) && b.Id != id)) return BadRequest("Slug already exists.");
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
                    
                    // Rename new image to Blog_[title] format
                    var newImagePath = RenameImageToBlogPattern(model.Image, model.Title ?? existing.Title);
                    existing.Image = newImagePath;
                }
                else if (!string.IsNullOrWhiteSpace(model.Image))
                {
                    existing.Image = model.Image;
                }
                
                existing.UpdatedAt = DateTime.UtcNow;
                if (string.Equals(existing.Status, "PUBLISHED", StringComparison.OrdinalIgnoreCase) && existing.PublishedAt == null) existing.PublishedAt = DateTime.UtcNow;

                SaveToFile(posts);
                return Ok(existing);
            }

        // DELETE api/blog/{id}
        [HttpDelete("{id}")]
        public IActionResult Delete(int id, [FromQuery] bool hard = false)
        {
            var posts = LoadFromFile();
            var existing = posts.FirstOrDefault(p => p.Id == id);
            if (existing == null) return NotFound();
            if (hard)
            {
                posts = posts.Where(p => p.Id != id).ToList();
            }
            else
            {
                existing.Status = "DELETED";
                existing.UpdatedAt = DateTime.UtcNow;
            }
            SaveToFile(posts);
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

            if (existing.Status != "APPROVED")
            {
                return BadRequest(new { error = $"Can only publish APPROVED blogs. Current status: {existing.Status}" });
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

            existing.Status = "HIDDEN";
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
        /// Delete image file from wwwroot/images/blog directory
        /// </summary>
        private void DeleteImageFile(string imagePath)
        {
            if (string.IsNullOrWhiteSpace(imagePath)) return;

            try
            {
                var webRoot = _env.WebRootPath;
                if (string.IsNullOrEmpty(webRoot)) webRoot = Path.Combine(_env.ContentRootPath, "wwwroot");
                
                // Extract filename from URL path (e.g., "/images/blog/Blog_title.jpg" -> "Blog_title.jpg")
                var fileName = Path.GetFileName(imagePath);
                if (string.IsNullOrWhiteSpace(fileName)) return;

                var filePath = Path.Combine(webRoot, "images", "blog", fileName);
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

        /// <summary>
        /// Rename uploaded image file to Blog_[title] format
        /// Returns the new public URL path
        /// </summary>
        private string RenameImageToBlogPattern(string imagePath, string blogTitle)
        {
            if (string.IsNullOrWhiteSpace(imagePath)) return imagePath;

            try
            {
                // If it's already a Blog_* file in the blog directory, return as is
                if (imagePath.Contains("/images/blog/") && Path.GetFileName(imagePath).StartsWith("Blog_"))
                    return imagePath;

                var webRoot = _env.WebRootPath;
                if (string.IsNullOrEmpty(webRoot)) webRoot = Path.Combine(_env.ContentRootPath, "wwwroot");

                var fileName = Path.GetFileName(imagePath);
                if (string.IsNullOrWhiteSpace(fileName)) return imagePath;

                var ext = Path.GetExtension(fileName);
                var newFileName = $"Blog_{Slugify(blogTitle)}{ext}";
                
                // Handle source file - check if it exists in blog directory
                var imagesDir = Path.Combine(webRoot, "images", "blog");
                var oldFilePath = Path.Combine(imagesDir, fileName);
                var newFilePath = Path.Combine(imagesDir, newFileName);

                // If old file exists and new name is different, rename it
                if (System.IO.File.Exists(oldFilePath) && !string.Equals(fileName, newFileName, StringComparison.OrdinalIgnoreCase))
                {
                    // Delete destination if it exists
                    if (System.IO.File.Exists(newFilePath))
                        System.IO.File.Delete(newFilePath);

                    System.IO.File.Move(oldFilePath, newFilePath);
                }

                return $"/images/blog/{newFileName}";
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[BlogController] Error renaming image '{imagePath}': {ex.Message}");
                return imagePath;
            }
        }
    }
}
