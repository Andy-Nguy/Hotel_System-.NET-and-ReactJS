using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.IO;

namespace Hotel_System.API.Services
{
    /// <summary>
    /// Service for managing room images with business logic validation.
    /// 
    /// Rules:
    /// - Array must contain 1-6 images
    /// - Index 0 (primary/banner image) is mandatory and cannot be deleted/replaced alone
    /// - Images are validated for non-null, non-empty strings
    /// </summary>
    public class RoomImageService
    {
        private const int MIN_IMAGES = 1;
        private const int MAX_IMAGES = 6;
        private const int PRIMARY_IMAGE_INDEX = 0;

        private static readonly string[] AllowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".webp" };

        /// <summary>
        /// Validate room images array according to business rules.
        /// Throws ArgumentException if validation fails.
        /// </summary>
        public void ValidateImageArray(List<string>? images, string fieldName = "UrlAnhPhong")
        {
            if (images == null || images.Count == 0)
                throw new ArgumentException($"{fieldName} must contain at least 1 image");

            if (images.Count > MAX_IMAGES)
                throw new ArgumentException($"{fieldName} cannot contain more than {MAX_IMAGES} images");

            // Check first image (primary) is valid
            if (string.IsNullOrWhiteSpace(images[PRIMARY_IMAGE_INDEX]))
                throw new ArgumentException($"{fieldName}: Primary image (index 0) cannot be null or empty");

            // Check all images are non-null and non-empty
            for (int i = 0; i < images.Count; i++)
            {
                if (string.IsNullOrWhiteSpace(images[i]))
                    throw new ArgumentException($"{fieldName}: Image at index {i} cannot be null or empty");
            }
        }

        /// <summary>
        /// Add a new image to the room.
        /// Image is appended to the end of the array.
        /// </summary>
        public List<string> AddImage(List<string> currentImages, string newImageUrl)
        {
            if (string.IsNullOrWhiteSpace(newImageUrl))
                throw new ArgumentException("New image URL cannot be null or empty");

            if (currentImages.Count >= MAX_IMAGES)
                throw new InvalidOperationException($"Cannot add more than {MAX_IMAGES} images. Current count: {currentImages.Count}");

            var updated = new List<string>(currentImages) { newImageUrl.Trim() };
            ValidateImageArray(updated);

            return updated;
        }

        /// <summary>
        /// Remove an image at the specified index.
        /// Cannot remove the primary image (index 0).
        /// </summary>
        public List<string> RemoveImage(List<string> currentImages, int imageIndex)
        {
            if (imageIndex == PRIMARY_IMAGE_INDEX)
                throw new InvalidOperationException("Cannot delete the primary image (index 0)");

            if (imageIndex < 0 || imageIndex >= currentImages.Count)
                throw new ArgumentOutOfRangeException(nameof(imageIndex), $"Index {imageIndex} is out of range");

            var updated = new List<string>(currentImages);
            updated.RemoveAt(imageIndex);

            // Ensure at least the primary image remains
            if (updated.Count == 0)
                throw new InvalidOperationException("Cannot delete the last image. At least the primary image must remain.");

            ValidateImageArray(updated);
            return updated;
        }

        /// <summary>
        /// Replace the primary image (index 0) with a new one.
        /// Total image count remains the same.
        /// </summary>
        public List<string> ReplacePrimaryImage(List<string> currentImages, string newImageUrl)
        {
            if (string.IsNullOrWhiteSpace(newImageUrl))
                throw new ArgumentException("New image URL cannot be null or empty");

            var updated = new List<string>(currentImages);
            updated[PRIMARY_IMAGE_INDEX] = newImageUrl.Trim();

            ValidateImageArray(updated);
            return updated;
        }

        /// <summary>
        /// Replace an image at a specific index (not the primary image).
        /// </summary>
        public List<string> ReplaceImage(List<string> currentImages, int imageIndex, string newImageUrl)
        {
            if (string.IsNullOrWhiteSpace(newImageUrl))
                throw new ArgumentException("New image URL cannot be null or empty");

            if (imageIndex < 0 || imageIndex >= currentImages.Count)
                throw new ArgumentOutOfRangeException(nameof(imageIndex), $"Index {imageIndex} is out of range");

            var updated = new List<string>(currentImages);
            updated[imageIndex] = newImageUrl.Trim();

            ValidateImageArray(updated);
            return updated;
        }

        /// <summary>
        /// Reorder images in the array.
        /// Primary image (index 0) is locked and cannot be moved.
        /// Only images from index 1 onwards can be reordered.
        /// </summary>
        public List<string> ReorderImages(List<string> currentImages, int fromIndex, int toIndex)
        {
            if (fromIndex == PRIMARY_IMAGE_INDEX || toIndex == PRIMARY_IMAGE_INDEX)
                throw new InvalidOperationException("Cannot reorder primary image (index 0). It must remain at position 0");

            if (fromIndex < 0 || fromIndex >= currentImages.Count)
                throw new ArgumentOutOfRangeException(nameof(fromIndex));

            if (toIndex < 0 || toIndex >= currentImages.Count)
                throw new ArgumentOutOfRangeException(nameof(toIndex));

            var updated = new List<string>(currentImages);
            var item = updated[fromIndex];
            updated.RemoveAt(fromIndex);
            updated.Insert(toIndex, item);

            ValidateImageArray(updated);
            return updated;
        }

        /// <summary>
        /// Normalize single image string to array format.
        /// Used during migration from single string to array.
        /// </summary>
        public List<string> NormalizeFromSingleImage(string? imageUrl)
        {
            if (string.IsNullOrWhiteSpace(imageUrl))
                return new List<string>();

            return new List<string> { imageUrl.Trim() };
        }

        /// <summary>
        /// Check if image array is valid without throwing exception.
        /// Returns tuple: (isValid, errorMessage)
        /// </summary>
        public (bool IsValid, string? ErrorMessage) TryValidateImageArray(List<string>? images)
        {
            try
            {
                ValidateImageArray(images);
                return (true, null);
            }
            catch (Exception ex)
            {
                return (false, ex.Message);
            }
        }

        /// <summary>
        /// Generate a canonical filename for a room image according to convention: room-{roomId}-a{index}{ext}
        /// Extension should include leading dot, e.g. ".jpg"
        /// </summary>
        public string GenerateFilename(string roomId, int index, string extension)
        {
            if (string.IsNullOrWhiteSpace(roomId)) throw new ArgumentException("roomId required");
            if (index < 0) throw new ArgumentOutOfRangeException(nameof(index));
            if (string.IsNullOrWhiteSpace(extension)) throw new ArgumentException("extension required");

            var ext = extension.StartsWith('.') ? extension.ToLowerInvariant() : "." + extension.ToLowerInvariant();
            if (!AllowedExtensions.Contains(ext)) throw new ArgumentException($"Extension '{ext}' not allowed");

            // Sanitize roomId for filename (keep alphanumerics, dash and underscore)
            var safeRoomId = Regex.Replace(roomId, "[^A-Za-z0-9_-]", "");

            return $"room-{safeRoomId}-a{index}{ext}";
        }

        /// <summary>
        /// Validate a filename matches naming convention for a given room and index.
        /// Throws ArgumentException on failure.
        /// </summary>
        public void ValidateFilenameForRoom(string filename, string roomId, int expectedIndex)
        {
            if (string.IsNullOrWhiteSpace(filename)) throw new ArgumentException("filename required");
            if (string.IsNullOrWhiteSpace(roomId)) throw new ArgumentException("roomId required");

            if (filename.Contains("/") || filename.Contains("\\"))
                throw new ArgumentException("Filename must not contain path separators");

            var ext = Path.GetExtension(filename)?.ToLowerInvariant() ?? string.Empty;
            if (!AllowedExtensions.Contains(ext))
                throw new ArgumentException($"File extension '{ext}' is not allowed. Allowed: {string.Join(',', AllowedExtensions)}");

            // Validate that filename starts with correct room prefix (allow any image index)
            var safeRoomId = Regex.Replace(roomId, "[^A-Za-z0-9_-]", "");
            var expectedPrefix = $"room-{safeRoomId}-a";
            var nameNoExt = Path.GetFileNameWithoutExtension(filename);
            if (!nameNoExt.StartsWith(expectedPrefix, StringComparison.OrdinalIgnoreCase))
                throw new ArgumentException($"Filename '{filename}' does not start with expected prefix '{expectedPrefix}'");
        }
    }
}
