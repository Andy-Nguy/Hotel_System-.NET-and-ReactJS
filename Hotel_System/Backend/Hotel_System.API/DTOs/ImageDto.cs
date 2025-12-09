using System;
using System.Text.Json;

namespace Hotel_System.API.DTOs
{
    public class ImageDto
    {
        // Property name 'u' matches front-end shape { "u": "filename.jpg" }
        // or the variant { "u": ["filename.jpg"] } — use JsonElement to accept both.
        public JsonElement u { get; set; }
    }
}
