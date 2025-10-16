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
    HinhDichVu NVARCHAR(255)
);

CREATE TABLE TTDichVu (
    IDTTDichVu NVARCHAR(50) PRIMARY KEY,
    IDDichVu NVARCHAR(50) NOT NULL,
    ThongTinDV NVARCHAR(255),
    CONSTRAINT FK_TTDichVu_DichVu FOREIGN KEY (IDDichVu)
        REFERENCES DichVu(IDDichVu)
        ON DELETE CASCADE ON UPDATE CASCADE
);

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
