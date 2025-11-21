using System;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Hotel_System.API.Utils
{
    public class DateOnlyJsonConverter : JsonConverter<DateOnly>
    {
        private const string Format = "yyyy-MM-dd";
        public override DateOnly Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            var s = reader.GetString();
            if (string.IsNullOrEmpty(s)) return default;
            if (DateOnly.TryParse(s, out var d)) return d;
            // Try exact format
            if (DateOnly.TryParseExact(s, Format, null, System.Globalization.DateTimeStyles.None, out d)) return d;
            throw new JsonException($"Invalid DateOnly value: {s}");
        }

        public override void Write(Utf8JsonWriter writer, DateOnly value, JsonSerializerOptions options)
        {
            writer.WriteStringValue(value.ToString(Format));
        }
    }
}
