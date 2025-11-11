using System;
using System.Collections.Generic;

namespace Hotel_System.API.DTOs
{
    /// <summary>
    /// Response sau khi đặt phòng thành công
    /// </summary>
    public class BookingResponse
    {
        public string IDDatPhong { get; set; } = null!;
        public int? IDKhachHang { get; set; }
        public string? TenKhachHang { get; set; }
        public DateOnly NgayDatPhong { get; set; }
        public DateOnly NgayNhanPhong { get; set; }
        public DateOnly NgayTraPhong { get; set; }
        public decimal TongTien { get; set; }
        public decimal TienCoc { get; set; }
        public int TrangThai { get; set; }
        public string TrangThaiText { get; set; } = null!;
        public int TrangThaiThanhToan { get; set; }
        public string TrangThaiThanhToanText { get; set; } = null!;
        public List<RoomDetailInBooking> DanhSachPhong { get; set; } = new List<RoomDetailInBooking>();
    }

    /// <summary>
    /// Chi tiết phòng trong đơn đặt (Response)
    /// </summary>
    public class RoomDetailInBooking
    {
        public int IDChiTiet { get; set; }
        public string IDPhong { get; set; } = null!;
        public string TenPhong { get; set; } = null!;
        public string? SoPhong { get; set; }
        public string? TenLoaiPhong { get; set; }
        public int SoDem { get; set; }
        public decimal GiaPhong { get; set; }
        public decimal ThanhTien { get; set; }
        public string? GhiChu { get; set; }
    }
}
