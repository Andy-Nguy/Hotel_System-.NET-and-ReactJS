namespace Hotel_System.API.Models;

public class BlogPost
{
    /// <summary>
    /// Unique identifier for the blog post
    /// </summary>
    public int Id { get; set; }

    /// <summary>
    /// Title of the blog post (required)
    /// </summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>
    /// URL-friendly slug for the blog post (required, must be unique)
    /// </summary>
    public string Slug { get; set; } = string.Empty;

    /// <summary>
    /// Short description/excerpt of the blog post (optional)
    /// </summary>
    public string Excerpt { get; set; } = string.Empty;

    /// <summary>
    /// Full content of the blog post (required for internal type)
    /// </summary>
    public string Content { get; set; } = string.Empty;

    /// <summary>
    /// Cover image URL (required for both internal and external types)
    /// </summary>
    public string Image { get; set; } = string.Empty;

    /// <summary>
    /// Category of the blog post (required)
    /// Examples: "Ẩm thực", "Check-in", "Tin tức", etc.
    /// </summary>
    public string Category { get; set; } = string.Empty;

    /// <summary>
    /// Author name (optional, defaults to "Admin")
    /// </summary>
    public string Author { get; set; } = string.Empty;

    /// <summary>
    /// Publication status: DRAFT, PENDING, APPROVED, REJECTED, PUBLISHED, HIDDEN, DELETED
    /// Default: DRAFT
    /// </summary>
    public string Status { get; set; } = "DRAFT";

    /// <summary>
    /// Blog type: "internal" (with content + images) or "external" (link only)
    /// </summary>
    public string Type { get; set; } = "internal";

    /// <summary>
    /// Total view count (not incremented for admin views)
    /// </summary>
    public long ViewCount { get; set; } = 0;

    /// <summary>
    /// Rejection reason (if status is REJECTED)
    /// </summary>
    public string RejectionReason { get; set; } = string.Empty;

    /// <summary>
    /// Date when the blog was rejected (nullable)
    /// </summary>
    public DateTime? RejectedAt { get; set; }

    /// <summary>
    /// Date when the blog was approved (nullable)
    /// </summary>
    public DateTime? ApprovedAt { get; set; }

    /// <summary>
    /// JSON audit log of edits/actions (optional)
    /// </summary>
    public string AuditLog { get; set; } = string.Empty;

    /// <summary>
    /// Array of gallery image URLs (required for internal type)
    /// </summary>
    public List<string> Images { get; set; } = new();

    /// <summary>
    /// External link URL (required for external type)
    /// </summary>
    public string ExternalLink { get; set; } = string.Empty;

    /// <summary>
    /// Comma-separated tags for categorization
    /// </summary>
    public string Tags { get; set; } = string.Empty;

    /// <summary>
    /// Display date string (e.g., "20th November, 2025")
    /// </summary>
    public string Date { get; set; } = string.Empty;

    /// <summary>
    /// Date when the blog post was created
    /// </summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Date when the blog post was last updated
    /// </summary>
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Date when the blog post was published (nullable)
    /// </summary>
    public DateTime? PublishedAt { get; set; }

    /// <summary>
    /// Display order for published blogs (1-5, unique, null for others)
    /// </summary>
    public int? DisplayOrder { get; set; }

    /// <summary>
    /// Foreign key to the author user (optional, for future DB integration)
    /// </summary>
    public string AuthorId { get; set; } = string.Empty;
}
