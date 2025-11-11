using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace Hotel_System.API.DTOs
{
    /// <summary>
    /// Request để đặt nhiều phòng trong 1 đơn đặt phòng
    /// </summary>
    public class BookMultipleRoomsRequest
    {
        [Required(ErrorMessage = "ID khách hàng là bắt buộc")]
        public int IDKhachHang { get; set; }

        [Required(ErrorMessage = "Ngày nhận phòng là bắt buộc")]
        public DateOnly NgayNhanPhong { get; set; }

        [Required(ErrorMessage = "Ngày trả phòng là bắt buộc")]
        public DateOnly NgayTraPhong { get; set; }

        [Required(ErrorMessage = "Danh sách phòng là bắt buộc")]
        [MinLength(1, ErrorMessage = "Phải đặt ít nhất 1 phòng")]
        public List<RoomBookingDetail> DanhSachPhong { get; set; } = new List<RoomBookingDetail>();

        public decimal TienCoc { get; set; } = 0;

        public int TrangThai { get; set; } = 1; // 1: Chờ xác nhận

        public int TrangThaiThanhToan { get; set; } = -1; // -1: Chưa cọc
    }

    /// <summary>
    /// Chi tiết từng phòng trong đơn đặt
    /// </summary>
    public class RoomBookingDetail
    {
        [Required(ErrorMessage = "ID phòng là bắt buộc")]
        public string IDPhong { get; set; } = null!;

        [Required(ErrorMessage = "Số đêm là bắt buộc")]
        [Range(1, 365, ErrorMessage = "Số đêm phải từ 1 đến 365")]
        public int SoDem { get; set; }

        [Required(ErrorMessage = "Giá phòng là bắt buộc")]
        [Range(0.01, double.MaxValue, ErrorMessage = "Giá phòng phải lớn hơn 0")]
        public decimal GiaPhong { get; set; }

        public string? GhiChu { get; set; }
    }
}
