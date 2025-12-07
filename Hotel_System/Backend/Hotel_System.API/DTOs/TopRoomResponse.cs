namespace Hotel_System.API.DTOs
{
    public class TopRoomResponse
    {
        public string IdPhong { get; set; } = null!;
        public string TenPhong { get; set; } = null!;
        public int SoLanSuDung { get; set; }
        public int TongDem { get; set; }
        public List<string>? UrlAnhPhong { get; set; }
        public decimal? GiaCoBanMotDem { get; set; }
        public int? XepHangSao { get; set; }
        public string? TenLoaiPhong { get; set; }
    }
}
