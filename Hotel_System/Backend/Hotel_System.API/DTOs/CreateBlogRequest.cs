namespace Hotel_System.API.DTOs;

/// <summary>
/// DTO for creating a new blog post
/// Supports both internal (content + images) and external (link only) blog types
/// </summary>
public class CreateBlogRequest
{
    /// <summary>
    /// Blog post title (required)
    /// </summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>
    /// Blog category (required)
    /// Examples: "Ẩm thực", "Check-in", "Tin tức", "Địa điểm Xanh", etc.
    /// </summary>
    public string Category { get; set; } = string.Empty;

    /// <summary>
    /// Blog type: "internal" or "external" (required)
    /// - "internal": content + gallery images required
    /// - "external": external link required
    /// </summary>
    public string Type { get; set; } = "internal";

    /// <summary>
    /// Cover image URL (required)
    /// Should be uploaded via /admin/blogs/upload-image endpoint
    /// </summary>
    public string Image { get; set; } = string.Empty;

    /// <summary>
    /// Display date string (optional)
    /// Examples: "20th November, 2025" or "2025-11-20"
    /// If not provided, defaults to current date
    /// </summary>
    public string Date { get; set; } = string.Empty;

    /// <summary>
    /// Short excerpt/description (optional)
    /// </summary>
    public string Excerpt { get; set; } = string.Empty;

    /// <summary>
    /// Author name (optional, defaults to "Admin")
    /// </summary>
    public string Author { get; set; } = string.Empty;

    /// <summary>
    /// Comma-separated tags or array of tags (optional)
    /// Used for blog categorization and filtering
    /// </summary>
    public List<string> Tags { get; set; } = new();

    /// <summary>
    /// Full blog content in HTML or plain text (required for internal type)
    /// Ignored for external type blogs
    /// </summary>
    public string Content { get; set; } = string.Empty;

    /// <summary>
    /// Gallery image URLs (required for internal type)
    /// Array of image URLs uploaded via /admin/blogs/upload-image endpoint
    /// Ignored for external type blogs
    /// </summary>
    public List<string> Images { get; set; } = new();

    /// <summary>
    /// External blog link URL (required for external type)
    /// Must be a valid HTTP/HTTPS URL
    /// Ignored for internal type blogs
    /// </summary>
    public string ExternalLink { get; set; } = string.Empty;

    /// <summary>
    /// URL-friendly slug (optional, auto-generated from title if not provided)
    /// Must be unique across all blog posts
    /// </summary>
    public string Slug { get; set; } = string.Empty;

    /// <summary>
    /// Publication status (optional, defaults to "DRAFT")
    /// Valid values: "DRAFT", "PUBLISHED"
    /// </summary>
    public string Status { get; set; } = "DRAFT";
}
