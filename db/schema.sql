CREATE DATABASE HotelSystem;
USE HotelSystem;


/* =========================================
   1) KHÁCH HÀNG & TÀI KHOẢN
========================================= */

CREATE TABLE KhachHang (
    IDKhachHang INT IDENTITY(1,1) PRIMARY KEY,
    HoTen NVARCHAR(100) NOT NULL,
    NgaySinh DATE,
    SoDienThoai NVARCHAR(20),
    Email NVARCHAR(100) UNIQUE,
    NgayDangKy DATE DEFAULT (CONVERT(date, GETDATE())),
    TichDiem INT DEFAULT 0
);

CREATE TABLE TaiKhoanNguoiDung (
    IDNguoiDung INT IDENTITY(1,1) PRIMARY KEY,
    IDKhachHang INT NOT NULL,
    MatKhau NVARCHAR(255) NOT NULL,
    VaiTro TINYINT NOT NULL, -- 0: Khách hàng, 1: Nhân viên
    CONSTRAINT FK_TaiKhoanNguoiDung_KhachHang
        FOREIGN KEY (IDKhachHang) REFERENCES KhachHang(IDKhachHang)
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE pending_users (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    hoten NVARCHAR(100),
    email NVARCHAR(255) UNIQUE,
    [password] NVARCHAR(255),
    sodienthoai NVARCHAR(15),
    ngaysinh DATE,
    otp CHAR(6),
    otp_expired_at DATETIME2,
    created_at DATETIME2 DEFAULT (GETDATE())
);

-------------------------------------------
-- 2) LOẠI PHÒNG & PHÒNG
-------------------------------------------

CREATE TABLE LoaiPhong (
    IDLoaiPhong NVARCHAR(50) PRIMARY KEY,
    TenLoaiPhong NVARCHAR(100) NOT NULL,
    MoTa NVARCHAR(MAX),
    UrlAnhLoaiPhong NVARCHAR(255)
);

CREATE TABLE Phong (
    IDPhong NVARCHAR(50) PRIMARY KEY,
    IDLoaiPhong NVARCHAR(50),
    TenPhong NVARCHAR(20),
    SoPhong NVARCHAR(20) NOT NULL,
    MoTa NVARCHAR(MAX),
    SoNguoiToiDa INT,
    GiaCoBanMotDem DECIMAL(18,2),
    XepHangSao INT,
    TrangThai NVARCHAR(50),
    UrlAnhPhong NVARCHAR(255),
    CONSTRAINT FK_Phong_LoaiPhong FOREIGN KEY (IDLoaiPhong)
        REFERENCES LoaiPhong(IDLoaiPhong)
        ON DELETE SET NULL ON UPDATE CASCADE
);
ALTER TABLE Phong
ALTER COLUMN TenPhong NVARCHAR(50);

INSERT INTO LoaiPhong (IDLoaiPhong, TenLoaiPhong, MoTa, UrlAnhLoaiPhong)
VALUES
('LP01', N'Deluxe Room', 
 N'Phòng hiện đại, thiết kế tinh tế với tầm nhìn hướng thành phố hoặc hồ, nội thất sang trọng và tiện nghi cao cấp.', 
 N'deluxe-room.webp'),

('LP02', N'Executive Room', 
 N'Phòng Executive với quyền sử dụng Executive Lounge, tầm nhìn hướng hồ, nội thất cao cấp.', 
 N'executive-room.webp'),

('LP03', N'Executive Suite', 
 N'Suite rộng rãi có phòng khách riêng, được sử dụng Executive Lounge và tầm nhìn tuyệt đẹp.', 
 N'executive-suite.webp'),

('LP04', N'Grand Suite', 
 N'Suite sang trọng với không gian lớn, tầm nhìn hướng hồ, nội thất cao cấp.', 
 N'grand-suite.webp'),

('LP05', N'Presidential Suite', 
 N'Suite Tổng thống đẳng cấp nhất khách sạn, có phòng khách, phòng ăn, bếp riêng và tầm nhìn toàn cảnh hồ.', 
 N'presidential-suite.webp'),

('LP06', N'Chairman Suite', 
 N'Suite Chủ tịch xa hoa, thiết kế tinh xảo, có phòng họp và khu vực tiếp khách riêng.', 
 N'chairman-suite.webp');


INSERT INTO Phong (IDPhong, IDLoaiPhong, TenPhong, SoPhong, MoTa, SoNguoiToiDa, GiaCoBanMotDem, XepHangSao, TrangThai, UrlAnhPhong)
VALUES
-- Deluxe Room
('P101', 'LP01', N'Deluxe Room 101', N'101', 
 N'Phòng Deluxe hiện đại, hướng thành phố, nội thất sang trọng.', 
 3, 5500000, 5, N'Trống', 
 N'deluxe-room-101.webp'),
('P102', 'LP01', N'Deluxe Room 102', N'102', 
 N'Phòng Deluxe hướng hồ, giường King size.', 
 3, 5500000, 5, N'Đang sử dụng', 
 N'deluxe-room-102.webp'),

-- Executive Room
('P201', 'LP02', N'Executive Room 201', N'201', 
 N'Phòng Executive sang trọng, bao gồm quyền Executive Lounge.', 
 3, 7000000, 5, N'Trống', 
 N'executive-room-201.webp'),

-- Executive Suite
('P301', 'LP03', N'Executive Suite 301', N'301', 
 N'Suite rộng rãi với phòng khách riêng biệt, hướng hồ.', 
 3, 9500000, 5, N'Trống', 
 N'executive-suite-301.webp'),

-- Grand Suite
('P401', 'LP04', N'Grand Suite 401', N'401', 
 N'Suite cao cấp với phòng khách lớn và view hồ tuyệt đẹp.', 
 3, 12000000, 5, N'Trống', 
 N'grand-suite-401.webp'),

-- Presidential Suite
('P501', 'LP05', N'Presidential Suite 501', N'501', 
 N'Suite Tổng thống với phòng ăn riêng, phòng làm việc và bồn tắm jacuzzi.', 
 4, 25000000, 5, N'Trống', 
 N'presidential-suite-501.webp'),

-- Chairman Suite
('P601', 'LP06', N'Chairman Suite 601', N'601', 
 N'Suite Chủ tịch đẳng cấp, có phòng họp và khu vực tiếp khách riêng.', 
 4, 20000000, 5, N'Trống', 
 N'chairman-suite-601.webp');


-------------------------------------------
-- 3) TIỆN NGHI
-------------------------------------------

CREATE TABLE TienNghi (
    IDTienNghi NVARCHAR(50) PRIMARY KEY,
    TenTienNghi NVARCHAR(100) NOT NULL
);

CREATE TABLE TienNghiPhong (
    IDTienNghiPhong NVARCHAR(50) PRIMARY KEY,
    IDPhong NVARCHAR(50) NOT NULL,
    IDTienNghi NVARCHAR(50) NOT NULL,
    CONSTRAINT FK_TienNghiPhong_Phong FOREIGN KEY (IDPhong)
        REFERENCES Phong(IDPhong)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT FK_TienNghiPhong_TienNghi FOREIGN KEY (IDTienNghi)
        REFERENCES TienNghi(IDTienNghi)
        ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO TienNghi (IDTienNghi, TenTienNghi)
VALUES
('TN01', N'Wi-Fi tốc độ cao miễn phí'),
('TN02', N'Tivi màn hình phẳng 55 inch'),
('TN03', N'Máy lạnh trung tâm'),
('TN04', N'Bồn tắm sang trọng'),
('TN05', N'Minibar cao cấp'),
('TN06', N'Máy pha cà phê Nespresso'),
('TN07', N'Máy sấy tóc Dyson'),
('TN08', N'Két sắt điện tử'),
('TN09', N'Bàn làm việc và ghế da'),
('TN10', N'Ban công hướng hồ hoặc thành phố'),
('TN11', N'Phòng tắm đá cẩm thạch'),
('TN12', N'Tủ quần áo lớn có gương'),
('TN13', N'Dịch vụ phòng 24/7'),
('TN14', N'Loa Bluetooth Bose'),
('TN15', N'Truy cập Executive Lounge'),
('TN16', N'Phòng khách riêng biệt'),
('TN17', N'Bồn tắm jacuzzi'),
('TN18', N'Phòng ăn riêng'),
('TN19', N'Phòng làm việc riêng'),
('TN20', N'Phòng họp cao cấp');

INSERT INTO TienNghiPhong (IDTienNghiPhong, IDPhong, IDTienNghi)
VALUES
-- P101 Deluxe Room 101
('TNP001', 'P101', 'TN01'),
('TNP002', 'P101', 'TN02'),
('TNP003', 'P101', 'TN03'),
('TNP004', 'P101', 'TN05'),
('TNP005', 'P101', 'TN07'),
('TNP006', 'P101', 'TN09'),
('TNP007', 'P101', 'TN11'),
('TNP008', 'P101', 'TN13'),

-- P102 Deluxe Room 102
('TNP009', 'P102', 'TN01'),
('TNP010', 'P102', 'TN02'),
('TNP011', 'P102', 'TN03'),
('TNP012', 'P102', 'TN04'),
('TNP013', 'P102', 'TN05'),
('TNP014', 'P102', 'TN06'),
('TNP015', 'P102', 'TN07'),
('TNP016', 'P102', 'TN09'),
('TNP017', 'P102', 'TN10'),
('TNP018', 'P102', 'TN13');

INSERT INTO TienNghiPhong (IDTienNghiPhong, IDPhong, IDTienNghi)
VALUES
('TNP019', 'P201', 'TN01'),
('TNP020', 'P201', 'TN02'),
('TNP021', 'P201', 'TN03'),
('TNP022', 'P201', 'TN04'),
('TNP023', 'P201', 'TN05'),
('TNP024', 'P201', 'TN06'),
('TNP025', 'P201', 'TN07'),
('TNP026', 'P201', 'TN08'),
('TNP027', 'P201', 'TN09'),
('TNP028', 'P201', 'TN10'),
('TNP029', 'P201', 'TN11'),
('TNP030', 'P201', 'TN12'),
('TNP031', 'P201', 'TN13'),
('TNP032', 'P201', 'TN15');

INSERT INTO TienNghiPhong (IDTienNghiPhong, IDPhong, IDTienNghi)
VALUES
('TNP033', 'P301', 'TN01'),
('TNP034', 'P301', 'TN02'),
('TNP035', 'P301', 'TN03'),
('TNP036', 'P301', 'TN04'),
('TNP037', 'P301', 'TN05'),
('TNP038', 'P301', 'TN06'),
('TNP039', 'P301', 'TN07'),
('TNP040', 'P301', 'TN08'),
('TNP041', 'P301', 'TN09'),
('TNP042', 'P301', 'TN10'),
('TNP043', 'P301', 'TN11'),
('TNP044', 'P301', 'TN12'),
('TNP045', 'P301', 'TN13'),
('TNP046', 'P301', 'TN14'),
('TNP047', 'P301', 'TN15'),
('TNP048', 'P301', 'TN16');

INSERT INTO TienNghiPhong (IDTienNghiPhong, IDPhong, IDTienNghi)
VALUES
('TNP049', 'P401', 'TN01'),
('TNP050', 'P401', 'TN02'),
('TNP051', 'P401', 'TN03'),
('TNP052', 'P401', 'TN04'),
('TNP053', 'P401', 'TN05'),
('TNP054', 'P401', 'TN06'),
('TNP055', 'P401', 'TN07'),
('TNP056', 'P401', 'TN08'),
('TNP057', 'P401', 'TN09'),
('TNP058', 'P401', 'TN10'),
('TNP059', 'P401', 'TN11'),
('TNP060', 'P401', 'TN12'),
('TNP061', 'P401', 'TN13'),
('TNP062', 'P401', 'TN14'),
('TNP063', 'P401', 'TN15'),
('TNP064', 'P401', 'TN16');

INSERT INTO TienNghiPhong (IDTienNghiPhong, IDPhong, IDTienNghi)
VALUES
('TNP065', 'P501', 'TN01'),
('TNP066', 'P501', 'TN02'),
('TNP067', 'P501', 'TN03'),
('TNP068', 'P501', 'TN04'),
('TNP069', 'P501', 'TN05'),
('TNP070', 'P501', 'TN06'),
('TNP071', 'P501', 'TN07'),
('TNP072', 'P501', 'TN08'),
('TNP073', 'P501', 'TN09'),
('TNP074', 'P501', 'TN10'),
('TNP075', 'P501', 'TN11'),
('TNP076', 'P501', 'TN12'),
('TNP077', 'P501', 'TN13'),
('TNP078', 'P501', 'TN14'),
('TNP079', 'P501', 'TN15'),
('TNP080', 'P501', 'TN16'),
('TNP081', 'P501', 'TN17'),
('TNP082', 'P501', 'TN18'),
('TNP083', 'P501', 'TN19');

INSERT INTO TienNghiPhong (IDTienNghiPhong, IDPhong, IDTienNghi)
VALUES
('TNP084', 'P601', 'TN01'),
('TNP085', 'P601', 'TN02'),
('TNP086', 'P601', 'TN03'),
('TNP087', 'P601', 'TN04'),
('TNP088', 'P601', 'TN05'),
('TNP089', 'P601', 'TN06'),
('TNP090', 'P601', 'TN07'),
('TNP091', 'P601', 'TN08'),
('TNP092', 'P601', 'TN09'),
('TNP093', 'P601', 'TN10'),
('TNP094', 'P601', 'TN11'),
('TNP095', 'P601', 'TN12'),
('TNP096', 'P601', 'TN13'),
('TNP097', 'P601', 'TN14'),
('TNP098', 'P601', 'TN15'),
('TNP099', 'P601', 'TN16'),
('TNP100', 'P601', 'TN17'),
('TNP101', 'P601', 'TN18'),
('TNP102', 'P601', 'TN19'),
('TNP103', 'P601', 'TN20');

-------------------------------------------
-- 4) ĐẶT PHÒNG
-------------------------------------------

CREATE TABLE DatPhong (
    IDDatPhong NVARCHAR(50) PRIMARY KEY,
    IDKhachHang INT,
    IDPhong NVARCHAR(50) NOT NULL,
    NgayDatPhong DATE DEFAULT (CONVERT(date, GETDATE())),
    NgayNhanPhong DATE NOT NULL,
    NgayTraPhong DATE NOT NULL,
    SoDem INT,
    TongTien DECIMAL(18,2) NOT NULL,
    TienCoc DECIMAL(18,2) DEFAULT 0,
    TrangThai INT NOT NULL,          -- 1:Chờ XN, 2:Đã XN, 0:Hủy, 3:Đang dùng, 4:Hoàn thành
    TrangThaiThanhToan INT NOT NULL, -- 1:Chưa TT, 2:Đã TT, 0:Đã cọc, -1:Chưa cọc
    CONSTRAINT FK_DatPhong_KhachHang FOREIGN KEY (IDKhachHang)
        REFERENCES KhachHang(IDKhachHang)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT FK_DatPhong_Phong FOREIGN KEY (IDPhong)
        REFERENCES Phong(IDPhong)
        ON DELETE CASCADE ON UPDATE CASCADE
);

-------------------------------------------
-- 5) HÓA ĐƠN + DỊCH VỤ
-------------------------------------------

CREATE TABLE HoaDon (
    IDHoaDon NVARCHAR(50) PRIMARY KEY,
    IDDatPhong NVARCHAR(50) NOT NULL,
    NgayLap DATETIME2 DEFAULT (GETDATE()),
    TienPhong INT,
    SLNgay INT,
    TongTien DECIMAL(18,2) NOT NULL,
    TienCoc DECIMAL(18,2) DEFAULT 0,
    TienThanhToan DECIMAL(18,2),
    TrangThaiThanhToan INT,
    GhiChu NVARCHAR(MAX),
    CONSTRAINT FK_HoaDon_DatPhong FOREIGN KEY (IDDatPhong)
        REFERENCES DatPhong(IDDatPhong)
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE DichVu (
    IDDichVu NVARCHAR(50) PRIMARY KEY,
    TenDichVu NVARCHAR(100) NOT NULL,
    TienDichVu DECIMAL(18,2) DEFAULT 0,
    HinhDichVu NVARCHAR(255),
    ThoiGianBatDau TIME NULL,
    ThoiGianKetThuc TIME NULL,
    TrangThai NVARCHAR(50) DEFAULT N'Đang hoạt động'
);

CREATE TABLE TTDichVu (
    IDTTDichVu NVARCHAR(50) PRIMARY KEY,
    IDDichVu NVARCHAR(50) NOT NULL,
    ThongTinDV NVARCHAR(255),
    CONSTRAINT FK_TTDichVu_DichVu FOREIGN KEY (IDDichVu)
        REFERENCES DichVu(IDDichVu)
        ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE TTDichVu
ADD ThoiLuongUocTinh INT NULL,
    GhiChu NVARCHAR(255) NULL;

CREATE TABLE CTHDDV (
    IDCTHDDV INT IDENTITY(1,1) PRIMARY KEY,
    IDHoaDon NVARCHAR(50) NOT NULL,
    IDDichVu NVARCHAR(50) NOT NULL,
    TienDichVu DECIMAL(18,2) DEFAULT 0,
    ThoiGianThucHien DATETIME2,
    CONSTRAINT FK_CTHDDV_HoaDon FOREIGN KEY (IDHoaDon)
        REFERENCES HoaDon(IDHoaDon)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT FK_CTHDDV_DichVu FOREIGN KEY (IDDichVu)
        REFERENCES DichVu(IDDichVu)
        ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE CTHDDV
ADD ThoiGianBatDau DATETIME2 NULL,
    ThoiGianKetThuc DATETIME2 NULL,
    TrangThai NVARCHAR(50) DEFAULT N'Chờ thực hiện';

INSERT INTO DichVu (IDDichVu, TenDichVu, TienDichVu, HinhDichVu, ThoiGianBatDau, ThoiGianKetThuc, TrangThai)
VALUES
('DV001', N'Spa L’Occitane – Massage toàn thân 60 phút', 1500000.00, N'spa_full_body_60.webp', '09:00', '22:00', N'Hoạt động'),
('DV002', N'Phòng Gym & Hồ bơi – Truy cập 3 giờ', 500000.00, N'gym_pool_3h.webp', '06:00', '21:00', N'Hoạt động'),
('DV003', N'Giặt ủi nhanh (Express – 1 bộ đồ)', 120000.00, N'laundry_express.webp', '08:00', '20:00', N'Hoạt động'),
('DV004', N'Đưa đón sân bay – Mercedes 4 chỗ', 1300000.00, N'airport_transfer.webp', NULL, NULL, N'Hoạt động'),
('DV005', N'Trải nghiệm Buffet sáng tại JW Café', 550000.00, N'buffet_breakfast_jw.webp', '06:00', '10:30', N'Hoạt động'),
('DV006', N'Trà chiều tại Lounge Bar', 750000.00, N'afternoon_tea.webp', '14:00', '17:00', N'Hoạt động'),
('DV007', N'Phục vụ ăn tại phòng (In-room Dining)', 300000.00, N'inroom_dining.webp', '06:00', '23:00', N'Hoạt động'),
('DV008', N'Tour Hà Nội 3 giờ bằng Limousine', 2500000.00, N'hanoi_tour_limousine.webp', '08:00', '20:00', N'Hoạt động');

INSERT INTO TTDichVu (IDTTDichVu, IDDichVu, ThongTinDV, ThoiLuongUocTinh, GhiChu)
VALUES
('TTDV001', 'DV001', N'Massage toàn thân thư giãn 60 phút với tinh dầu L’Occitane nhập khẩu, giúp phục hồi năng lượng và giảm căng thẳng.', 60, N'Phải đặt trước ít nhất 2 tiếng.'),
('TTDV002', 'DV002', N'Hồ bơi nước nóng trong nhà đạt chuẩn 5 sao, có khu vực trẻ em riêng và nhân viên cứu hộ túc trực.', 90, N'Mở cửa từ 6h00 – 22h00.'),
('TTDV003', 'DV003', N'Phòng tập thể hình với trang thiết bị Technogym hiện đại, có huấn luyện viên cá nhân (PT) hỗ trợ.', 60, N'Tự do sử dụng cho khách lưu trú.'),
('TTDV004', 'DV004', N'Dịch vụ đưa đón sân bay Nội Bài bằng xe Mercedes S-Class, tài xế chuyên nghiệp, nước suối và khăn lạnh miễn phí.', 45, N'Cần đặt trước ít nhất 4 tiếng.'),
('TTDV005', 'DV005', N'Dịch vụ giặt, ủi và gấp quần áo trong ngày, giao tận phòng khách.', 180, N'Phụ phí cho dịch vụ lấy nhanh 3 giờ.'),
('TTDV006', 'DV006', N'Buffet sáng tại nhà hàng French Grill – hơn 60 món Á, Âu và tráng miệng cao cấp.', 90, N'Phục vụ từ 6h00 – 10h00 sáng.'),
('TTDV007', 'DV007', N'Dịch vụ trang trí hoa tươi trong phòng, sảnh hoặc khu vực tổ chức sự kiện theo yêu cầu.', 120, N'Liên hệ lễ tân để đặt mẫu hoa trước 24h.'),
('TTDV008', 'DV008', N'Phòng họp sang trọng với màn hình LED, micro không dây, âm thanh Bose và phục vụ trà bánh.', 240, N'Phải đặt trước, giá theo giờ.');
-------------------------------------------
-- 6) LỊCH SỬ ĐẶT PHÒNG
-------------------------------------------

CREATE TABLE LichSuDatPhong (
    IDLichSu INT IDENTITY(1,1) PRIMARY KEY,
    IDDatPhong NVARCHAR(50) NOT NULL,
    TrangThaiCu NVARCHAR(50),
    TrangThaiMoi NVARCHAR(50),
    NgayCapNhat DATETIME2 DEFAULT (GETDATE()),
    GhiChu NVARCHAR(MAX),
    CONSTRAINT FK_LichSuDatPhong FOREIGN KEY (IDDatPhong)
        REFERENCES DatPhong(IDDatPhong)
        ON DELETE CASCADE ON UPDATE CASCADE
);

-------------------------------------------
-- 7) DANH GIÁ (MỚI)
-------------------------------------------

CREATE TABLE DanhGia (
    IDDanhGia INT IDENTITY(1,1) PRIMARY KEY,
    IDKhachHang INT NOT NULL,
    IDPhong NVARCHAR(50) NOT NULL,
    SoSao TINYINT NOT NULL CHECK (SoSao BETWEEN 1 AND 5),
    TieuDe NVARCHAR(200),
    NoiDung NVARCHAR(MAX),
    IsAnonym BIT DEFAULT 0,
    created_at DATETIME2 DEFAULT (GETDATE()),
    updated_at DATETIME2 DEFAULT (GETDATE()),
    CONSTRAINT FK_DanhGia_KhachHang FOREIGN KEY (IDKhachHang)
        REFERENCES KhachHang(IDKhachHang)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT FK_DanhGia_Phong FOREIGN KEY (IDPhong)
        REFERENCES Phong(IDPhong)
        ON DELETE CASCADE ON UPDATE CASCADE
);

-------------------------------------------
-- 8) KHUYẾN MẠI (MỚI)
-------------------------------------------

CREATE TABLE KhuyenMai (
    IDKhuyenMai NVARCHAR(50) PRIMARY KEY,
    TenKhuyenMai NVARCHAR(200) NOT NULL,
    MoTa NVARCHAR(MAX),
    LoaiGiamGia VARCHAR(10) NOT NULL CHECK (LoaiGiamGia IN ('percent','amount')),
    GiaTriGiam DECIMAL(18,2) DEFAULT 0,
    NgayBatDau DATE NOT NULL,
    NgayKetThuc DATE NOT NULL,
    TrangThai VARCHAR(10) DEFAULT 'active' CHECK (TrangThai IN ('active','inactive','expired')),
    created_at DATETIME2 DEFAULT (GETDATE()),
    updated_at DATETIME2 DEFAULT (GETDATE()),
    CONSTRAINT CK_KhuyenMai_Ngay CHECK (NgayBatDau <= NgayKetThuc)
);

CREATE TABLE KhuyenMaiPhong (
    ID INT IDENTITY(1,1) PRIMARY KEY,
    IDKhuyenMai NVARCHAR(50) NOT NULL,
    IDPhong NVARCHAR(50) NOT NULL,
    IsActive BIT NOT NULL DEFAULT (0),           -- Nhân viên bật/tắt khuyến mãi
    NgayApDung DATE DEFAULT (CONVERT(date, GETDATE())),
    NgayKetThuc DATE NULL,
    created_at DATETIME2 DEFAULT (GETDATE()),
    updated_at DATETIME2 DEFAULT (GETDATE()),

    CONSTRAINT FK_KhuyenMaiPhong_KhuyenMai
        FOREIGN KEY (IDKhuyenMai) REFERENCES KhuyenMai(IDKhuyenMai)
        ON DELETE CASCADE ON UPDATE CASCADE,

    CONSTRAINT FK_KhuyenMaiPhong_Phong
        FOREIGN KEY (IDPhong) REFERENCES Phong(IDPhong)
        ON DELETE CASCADE ON UPDATE CASCADE
);
/* =========================================
   9) THỐNG KÊ DOANH THU KHÁCH SẠN (LIÊN KẾT TRỰC TIẾP)
========================================= */
CREATE TABLE ThongKeDoanhThuKhachSan (
    ID INT IDENTITY(1,1) PRIMARY KEY,
    IDHoaDon NVARCHAR(50) NULL,
    IDDatPhong NVARCHAR(50) NULL,

    Ngay DATE NOT NULL DEFAULT (CONVERT(date, GETDATE())),
    TongPhong INT NULL,
    SoDemDaDat INT NULL,
    TienPhong DECIMAL(18,2) NULL,
    TienDichVu DECIMAL(18,2) NULL,
    TienGiamGia DECIMAL(18,2) NULL,

    DoanhThuThucNhan AS (
        ISNULL(TienPhong,0) + ISNULL(TienDichVu,0) - ISNULL(TienGiamGia,0)
    ) PERSISTED,

    created_at DATETIME2 DEFAULT (GETDATE()),
    updated_at DATETIME2 DEFAULT (GETDATE()),

    -- Khóa ngoại: Hóa đơn cho phép cascade
    CONSTRAINT FK_ThongKe_HoaDon FOREIGN KEY (IDHoaDon)
        REFERENCES HoaDon(IDHoaDon)
        ON DELETE SET NULL ON UPDATE CASCADE,

    -- Khóa ngoại: Đặt phòng KHÔNG cascade (tránh vòng)
    CONSTRAINT FK_ThongKe_DatPhong FOREIGN KEY (IDDatPhong)
        REFERENCES DatPhong(IDDatPhong)
        ON DELETE NO ACTION ON UPDATE NO ACTION
);
GO
