

/* ======================================================
   DỮ LIỆU MẪU ĐỂ TEST API CHECK PHÒNG TRỐNG
   ====================================================== */

-- Clear data trước khi insert (dùng DELETE và reset IDENTITY cho bảng có IDENTITY)
DELETE FROM DatPhong;
DELETE FROM Phong;
DELETE FROM LoaiPhong;
DELETE FROM KhachHang; DBCC CHECKIDENT ('KhachHang', RESEED, 0);
/* ======================================================
   🏨 DỮ LIỆU MẪU KIỂM TRA API: CHECK PHÒNG TRỐNG
   ====================================================== */

-- ✅ Lưu ý:
-- Khi nhập dữ liệu có tiếng Việt, cần dùng tiền tố N trước chuỗi (ví dụ: N'Phòng cao cấp')

/* =========================================
   1️⃣ KHÁCH HÀNG
========================================= */
INSERT INTO KhachHang (HoTen, NgaySinh, SoDienThoai, Email, TichDiem)
VALUES
(N'Nguyễn Văn A', '1990-01-01', '0123456789', 'a@example.com', 100),
(N'Trần Thị B', '1992-02-02', '0987654321', 'b@example.com', 50);

/* =========================================
   2️⃣ LOẠI PHÒNG
========================================= */
INSERT INTO LoaiPhong (IDLoaiPhong, TenLoaiPhong, MoTa, UrlAnhLoaiPhong)
VALUES
('LP001', N'Deluxe', N'Phòng cao cấp với tầm nhìn ra biển', 'https://example.com/deluxe.jpg'),
('LP002', N'Standard', N'Phòng tiêu chuẩn, đầy đủ tiện nghi cơ bản', 'https://example.com/standard.jpg');

/* =========================================
   3️⃣ PHÒNG
========================================= */
INSERT INTO Phong (
    IDPhong, IDLoaiPhong, TenPhong, SoPhong, MoTa,
    SoNguoiToiDa, GiaCoBanMotDem, XepHangSao, TrangThai, UrlAnhPhong
)
VALUES
('P001', 'LP001', N'Deluxe 101', '101', N'Phòng hướng biển, nội thất sang trọng', 4, 500000, 4, N'Sẵn sàng', 'https://example.com/p001.jpg'),
('P002', 'LP001', N'Deluxe 102', '102', N'Phòng hướng núi, ban công riêng', 4, 500000, 4, N'Sẵn sàng', 'https://example.com/p002.jpg'),
('P003', 'LP002', N'Standard 201', '201', N'Phòng cơ bản, phù hợp cho 2 người', 2, 300000, 3, N'Sẵn sàng', 'https://example.com/p003.jpg'),
('P004', 'LP002', N'Standard 202', '202', N'Phòng cơ bản, đang bảo trì', 2, 300000, 3, N'Hư', 'https://example.com/p004.jpg');  -- Phòng hư, không khả dụng

/* =========================================
   4️⃣ ĐẶT PHÒNG
========================================= */
INSERT INTO DatPhong (
    IDDatPhong, IDKhachHang, IDPhong, NgayDatPhong,
    NgayNhanPhong, NgayTraPhong, SoDem,
    TongTien, TienCoc, TrangThai, TrangThaiThanhToan
)
VALUES
('DP001', 1, 'P001', '2025-11-01', '2025-11-10', '2025-11-12', 2, 1000000, 200000, 2, 1),  -- Đã xác nhận, đang đặt P001
('DP002', 2, 'P003', '2025-11-05', '2025-11-15', '2025-11-16', 1, 300000, 50000, 1, 1);   -- Chờ xác nhận, đang đặt P003

GO
