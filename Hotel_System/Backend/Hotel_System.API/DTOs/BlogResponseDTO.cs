namespace Hotel_System.API.DTOs;

/// <summary>
/// DTO for blog post API responses
/// </summary>
public class BlogResponseDTO
{
    /// <summary>
    /// Unique identifier for the blog post
    /// </summary>
    public int Id { get; set; }

    /// <summary>
    /// Blog post title
    /// </summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>
    /// URL-friendly slug for the blog post
    /// </summary>
    public string Slug { get; set; } = string.Empty;

    /// <summary>
    /// Short excerpt of the blog post
    /// </summary>
    public string Excerpt { get; set; } = string.Empty;

    /// <summary>
    /// Full content (only for internal blogs)
    /// </summary>
    public string Content { get; set; } = string.Empty;

    /// <summary>
    /// Cover image URL
    /// </summary>
    public string Image { get; set; } = string.Empty;

    /// <summary>
    /// Blog category
    /// </summary>
    public string Category { get; set; } = string.Empty;

    /// <summary>
    /// Author name
    /// </summary>
    public string Author { get; set; } = string.Empty;

    /// <summary>
    /// Publication status: DRAFT, PUBLISHED, or DELETED
    /// </summary>
    public string Status { get; set; } = "DRAFT";

    /// <summary>
    /// Blog type: internal or external
    /// </summary>
    public string Type { get; set; } = "internal";

    /// <summary>
    /// Gallery image URLs (only for internal blogs)
    /// </summary>
    public List<string> Images { get; set; } = new();

    /// <summary>
    /// External link (only for external blogs)
    /// </summary>
    public string ExternalLink { get; set; } = string.Empty;

    /// <summary>
    /// Comma-separated tags
    /// </summary>
    public string Tags { get; set; } = string.Empty;

    /// <summary>
    /// Display date string
    /// </summary>
    public string Date { get; set; } = string.Empty;

    /// <summary>
    /// Creation timestamp
    /// </summary>
    public DateTime CreatedAt { get; set; }

    /// <summary>
    /// Last update timestamp
    /// </summary>
    public DateTime UpdatedAt { get; set; }

    /// <summary>
    /// Publication timestamp (nullable)
    /// </summary>
    public DateTime? PublishedAt { get; set; }
}
