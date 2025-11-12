namespace Hotel_System.API.DTOs.Promotions;

public class UploadResultDto
{
    public string FileName { get; set; } = null!;
    public string RelativePath { get; set; } = null!;
    public string FullPath { get; set; } = null!;
    public long Size { get; set; }
    public string ContentType { get; set; } = null!;
}