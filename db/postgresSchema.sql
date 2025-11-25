-- =========================================
-- SCHEMA KHÁCH SẠN - PostgreSQL 15+
-- =========================================

-- 1) KHÁCH HÀNG & TÀI KHOẢN
-------------------------------------------
CREATE TABLE KhachHang (
    IDKhachHang SERIAL PRIMARY KEY,
    HoTen VARCHAR(100) NOT NULL,
    NgaySinh DATE,
    SoDienThoai VARCHAR(20),
    Email VARCHAR(100) UNIQUE,
    NgayDangKy DATE DEFAULT CURRENT_DATE,
    TichDiem INT DEFAULT 0
);

CREATE TABLE TaiKhoanNguoiDung (
    IDNguoiDung SERIAL PRIMARY KEY,
    IDKhachHang INTEGER NOT NULL,
    MatKhau VARCHAR(255) NOT NULL,
    VaiTro SMALLINT NOT NULL,
    CONSTRAINT FK_TaiKhoanNguoiDung_KhachHang
        FOREIGN KEY (IDKhachHang) REFERENCES KhachHang(IDKhachHang)
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE pending_users (
    id BIGSERIAL PRIMARY KEY,
    hoten VARCHAR(100),
    email VARCHAR(255) UNIQUE,
    password VARCHAR(255),
    sodienthoai VARCHAR(15),
    ngaysinh DATE,
    otp CHAR(6),
    otp_expired_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT now()
);

-- 2) LOẠI PHÒNG & PHÒNG
-------------------------------------------
CREATE TABLE LoaiPhong (
    IDLoaiPhong VARCHAR(50) PRIMARY KEY,
    TenLoaiPhong VARCHAR(100) NOT NULL,
    MoTa TEXT,
    UrlAnhLoaiPhong VARCHAR(255)
);

CREATE TABLE Phong (
    IDPhong VARCHAR(50) PRIMARY KEY,
    IDLoaiPhong VARCHAR(50),
    TenPhong VARCHAR(50),
    SoPhong VARCHAR(20) NOT NULL,
    MoTa TEXT,
    SoNguoiToiDa INT,
    GiaCoBanMotDem NUMERIC(18,2),
    XepHangSao INT,
    TrangThai VARCHAR(50),
    UrlAnhPhong VARCHAR(255),
    CONSTRAINT FK_Phong_LoaiPhong 
        FOREIGN KEY (IDLoaiPhong) REFERENCES LoaiPhong(IDLoaiPhong)
        ON DELETE SET NULL ON UPDATE CASCADE
);

-- 3) TIỆN NGHI
-------------------------------------------
CREATE TABLE TienNghi (
    IDTienNghi VARCHAR(50) PRIMARY KEY,
    TenTienNghi VARCHAR(100) NOT NULL
);

CREATE TABLE TienNghiPhong (
    IDTienNghiPhong VARCHAR(50) PRIMARY KEY,
    IDPhong VARCHAR(50) NOT NULL,
    IDTienNghi VARCHAR(50) NOT NULL,
    CONSTRAINT FK_TienNghiPhong_Phong 
        FOREIGN KEY (IDPhong) REFERENCES Phong(IDPhong)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT FK_TienNghiPhong_TienNghi 
        FOREIGN KEY (IDTienNghi) REFERENCES TienNghi(IDTienNghi)
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- 4) ĐẶT PHÒNG
-------------------------------------------
CREATE TABLE DatPhong (
    IDDatPhong VARCHAR(50) PRIMARY KEY,
    IDKhachHang INTEGER,
    IDPhong VARCHAR(50) NOT NULL,
    NgayDatPhong DATE DEFAULT CURRENT_DATE,
    NgayNhanPhong DATE NOT NULL,
    NgayTraPhong DATE NOT NULL,
    SoDem INT,
    TongTien NUMERIC(18,2) NOT NULL,
    TienCoc NUMERIC(18,2) DEFAULT 0,
    TrangThai INT NOT NULL,
    TrangThaiThanhToan INT NOT NULL,
    CONSTRAINT FK_DatPhong_KhachHang 
        FOREIGN KEY (IDKhachHang) REFERENCES KhachHang(IDKhachHang)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT FK_DatPhong_Phong 
        FOREIGN KEY (IDPhong) REFERENCES Phong(IDPhong)
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- =========================================
-- BẢNG CHI TIẾT ĐẶT PHÒNG (Hỗ trợ 1 đơn đặt nhiều phòng)
-- =========================================

CREATE TABLE ChiTietDatPhong (
    IDChiTiet SERIAL PRIMARY KEY,                                    -- SERIAL thay cho IDENTITY
    IDDatPhong VARCHAR(50) NOT NULL,
    IDPhong VARCHAR(50) NOT NULL,
    SoDem INT NOT NULL CHECK (SoDem > 0),
    GiaPhong NUMERIC(18,2) NOT NULL CHECK (GiaPhong >= 0),
    ThanhTien NUMERIC(18,2) NOT NULL CHECK (ThanhTien >= 0),
    GhiChu TEXT,                                                     -- TEXT thay cho NVARCHAR(MAX)

    -- Khóa ngoại
    CONSTRAINT FK_ChiTietDatPhong_DatPhong
        FOREIGN KEY (IDDatPhong) REFERENCES DatPhong(IDDatPhong)
        ON DELETE CASCADE ON UPDATE CASCADE,                     -- CASCADE để khi xóa đơn đặt thì xóa luôn chi tiết

    CONSTRAINT FK_ChiTietDatPhong_Phong
        FOREIGN KEY (IDPhong) REFERENCES Phong(IDPhong)
        ON DELETE RESTRICT ON UPDATE CASCADE,                    -- RESTRICT để tránh xóa phòng đang có trong đơn

    -- Không cho phép trùng phòng trong cùng một đơn đặt
    CONSTRAINT UQ_ChiTietDatPhong_DatPhong_Phong 
        UNIQUE (IDDatPhong, IDPhong)
);

-- Index hỗ trợ tìm kiếm nhanh các phòng đã đặt trong khoảng thời gian
CREATE INDEX IX_ChiTietDatPhong_IDPhong_Ngay 
ON ChiTietDatPhong (IDPhong);

-- Nếu bạn muốn kiểm tra trùng lịch đặt phòng (tránh double booking), 
-- hãy tạo thêm trigger hoặc dùng hàm kiểm tra trước khi insert

-- 5) HÓA ĐƠN + DỊCH VỤ
-------------------------------------------
CREATE TABLE HoaDon (
    IDHoaDon VARCHAR(50) PRIMARY KEY,
    IDDatPhong VARCHAR(50) NOT NULL,
    NgayLap TIMESTAMP DEFAULT now(),
    TienPhong NUMERIC(18,2),
    SLNgay INT,
    TongTien NUMERIC(18,2) NOT NULL,
    TienCoc NUMERIC(18,2) DEFAULT 0,
    TienThanhToan NUMERIC(18,2),
    TrangThaiThanhToan INT,
    GhiChu TEXT,
    CONSTRAINT FK_HoaDon_DatPhong 
        FOREIGN KEY (IDDatPhong) REFERENCES DatPhong(IDDatPhong)
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE DichVu (
    IDDichVu VARCHAR(50) PRIMARY KEY,
    TenDichVu VARCHAR(100) NOT NULL,
    TienDichVu NUMERIC(18,2) DEFAULT 0,
    HinhDichVu VARCHAR(255),
    ThoiGianBatDau TIME,
    ThoiGianKetThuc TIME,
    TrangThai VARCHAR(50) DEFAULT 'Đang hoạt động'
);

CREATE TABLE TTDichVu (
    IDTTDichVu VARCHAR(50) PRIMARY KEY,
    IDDichVu VARCHAR(50) NOT NULL,
    ThongTinDV VARCHAR(255),
    ThoiLuongUocTinh INT,
    GhiChu VARCHAR(255),
    CONSTRAINT FK_TTDichVu_DichVu 
        FOREIGN KEY (IDDichVu) REFERENCES DichVu(IDDichVu) 
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE CTHDDV (
    IDCTHDDV SERIAL PRIMARY KEY,
    IDHoaDon VARCHAR(50) NOT NULL,
    IDDichVu VARCHAR(50) NOT NULL,
    TienDichVu NUMERIC(18,2) DEFAULT 0,
    ThoiGianThucHien TIMESTAMP,
    ThoiGianBatDau TIMESTAMP,
    ThoiGianKetThuc TIMESTAMP,
    TrangThai VARCHAR(50) DEFAULT 'Chờ thực hiện',
    CONSTRAINT FK_CTHDDV_HoaDon 
        FOREIGN KEY (IDHoaDon) REFERENCES HoaDon(IDHoaDon) 
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT FK_CTHDDV_DichVu 
        FOREIGN KEY (IDDichVu) REFERENCES DichVu(IDDichVu) 
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- 6) LỊCH SỬ ĐẶT PHÒNG
-------------------------------------------
CREATE TABLE LichSuDatPhong (
    IDLichSu SERIAL PRIMARY KEY,
    IDDatPhong VARCHAR(50) NOT NULL,
    TrangThaiCu VARCHAR(50),
    TrangThaiMoi VARCHAR(50),
    NgayCapNhat TIMESTAMP DEFAULT now(),
    GhiChu TEXT,
    CONSTRAINT FK_LichSuDatPhong 
        FOREIGN KEY (IDDatPhong) REFERENCES DatPhong(IDDatPhong) 
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- 7) ĐÁNH GIÁ
-------------------------------------------
CREATE TABLE DanhGia (
    IDDanhGia SERIAL PRIMARY KEY,
    IDKhachHang INTEGER NOT NULL,
    IDPhong VARCHAR(50) NOT NULL,
    SoSao SMALLINT NOT NULL CHECK (SoSao BETWEEN 1 AND 5),
    TieuDe VARCHAR(200),
    NoiDung TEXT,
    IsAnonym BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    CONSTRAINT FK_DanhGia_KhachHang 
        FOREIGN KEY (IDKhachHang) REFERENCES KhachHang(IDKhachHang) 
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT FK_DanhGia_Phong 
        FOREIGN KEY (IDPhong) REFERENCES Phong(IDPhong) 
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- 8) KHUYẾN MÃI
-------------------------------------------
CREATE TABLE KhuyenMai (
    IDKhuyenMai VARCHAR(50) PRIMARY KEY,
    TenKhuyenMai VARCHAR(200) NOT NULL,
    MoTa TEXT,
    LoaiKhuyenMai VARCHAR(20) NOT NULL DEFAULT 'room' 
        CHECK (LoaiKhuyenMai IN ('room','service','combo','room_service','customer')),
    LoaiGiamGia VARCHAR(10) NOT NULL CHECK (LoaiGiamGia IN ('percent','amount')),
    GiaTriGiam NUMERIC(18,2) DEFAULT 0,
    NgayBatDau DATE NOT NULL,
    NgayKetThuc DATE NOT NULL,
    TrangThai VARCHAR(10) DEFAULT 'active' 
        CHECK (TrangThai IN ('active','inactive','expired')),
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    CONSTRAINT CK_KhuyenMai_Ngay CHECK (NgayBatDau <= NgayKetThuc)
);

-- Khuyến mãi áp dụng cho phòng
CREATE TABLE KhuyenMaiPhong (
    ID SERIAL PRIMARY KEY,
    IDKhuyenMai VARCHAR(50) NOT NULL,
    IDPhong VARCHAR(50) NOT NULL,
    IsActive BOOLEAN NOT NULL DEFAULT FALSE,
    NgayApDung DATE DEFAULT CURRENT_DATE,
    NgayKetThuc DATE,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    CONSTRAINT FK_KhuyenMaiPhong_KhuyenMai 
        FOREIGN KEY (IDKhuyenMai) REFERENCES KhuyenMai(IDKhuyenMai) 
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT FK_KhuyenMaiPhong_Phong 
        FOREIGN KEY (IDPhong) REFERENCES Phong(IDPhong) 
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- Khuyến mãi áp dụng cho dịch vụ
CREATE TABLE KhuyenMaiDichVu (
    ID SERIAL PRIMARY KEY,
    IDKhuyenMai VARCHAR(50) NOT NULL,
    IDDichVu VARCHAR(50) NOT NULL,
    IsActive BOOLEAN NOT NULL DEFAULT FALSE,
    NgayApDung DATE DEFAULT CURRENT_DATE,
    NgayKetThuc DATE,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    CONSTRAINT FK_KhuyenMaiDichVu_KhuyenMai 
        FOREIGN KEY (IDKhuyenMai) REFERENCES KhuyenMai(IDKhuyenMai) 
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT FK_KhuyenMaiDichVu_DichVu 
        FOREIGN KEY (IDDichVu) REFERENCES DichVu(IDDichVu) 
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- Combo khuyến mãi
CREATE TABLE KhuyenMaiCombo (
    IDKhuyenMaiCombo VARCHAR(50) PRIMARY KEY,
    IDKhuyenMai VARCHAR(50) NOT NULL,
    TenCombo VARCHAR(200) NOT NULL,
    MoTa TEXT,
    NgayBatDau DATE DEFAULT CURRENT_DATE,
    NgayKetThuc DATE,
    TrangThai VARCHAR(10) DEFAULT 'active' 
        CHECK (TrangThai IN ('active','inactive','expired')),
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    CONSTRAINT FK_KhuyenMaiCombo_KhuyenMai 
        FOREIGN KEY (IDKhuyenMai) REFERENCES KhuyenMai(IDKhuyenMai) 
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE KhuyenMaiComboDichVu (
    ID SERIAL PRIMARY KEY,
    IDKhuyenMaiCombo VARCHAR(50) NOT NULL,
    IDDichVu VARCHAR(50) NOT NULL,
    IsActive BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    CONSTRAINT FK_KhuyenMaiComboDichVu_Combo 
        FOREIGN KEY (IDKhuyenMaiCombo) REFERENCES KhuyenMaiCombo(IDKhuyenMaiCombo) 
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT FK_KhuyenMaiComboDichVu_DichVu 
        FOREIGN KEY (IDDichVu) REFERENCES DichVu(IDDichVu) 
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- Khuyến mãi phòng + dịch vụ kết hợp
CREATE TABLE KhuyenMaiPhongDichVu (
    ID SERIAL PRIMARY KEY,
    IDKhuyenMai VARCHAR(50) NOT NULL,
    IDPhong VARCHAR(50) NOT NULL,
    IDDichVu VARCHAR(50) NOT NULL,
    IsActive BOOLEAN NOT NULL DEFAULT FALSE,
    NgayApDung DATE DEFAULT CURRENT_DATE,
    NgayKetThuc DATE,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    CONSTRAINT FK_KhuyenMaiPhongDichVu_KhuyenMai 
        FOREIGN KEY (IDKhuyenMai) REFERENCES KhuyenMai(IDKhuyenMai) 
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT FK_KhuyenMaiPhongDichVu_Phong 
        FOREIGN KEY (IDPhong) REFERENCES Phong(IDPhong) 
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT FK_KhuyenMaiPhongDichVu_DichVu 
        FOREIGN KEY (IDDichVu) REFERENCES DichVu(IDDichVu) 
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- 9) THỐNG KÊ DOANH THU (PostgreSQL Generated Column)
-------------------------------------------
CREATE TABLE ThongKeDoanhThuKhachSan (
    ID SERIAL PRIMARY KEY,
    IDHoaDon VARCHAR(50),
    IDDatPhong VARCHAR(50),
    Ngay DATE NOT NULL DEFAULT CURRENT_DATE,
    TongPhong INT,
    SoDemDaDat INT,
    TienPhong NUMERIC(18,2),
    TienDichVu NUMERIC(18,2),
    TienGiamGia NUMERIC(18,2),
    DoanhThuThucNhan NUMERIC(18,2) GENERATED ALWAYS AS (
        COALESCE(TienPhong, 0) + COALESCE(TienDichVu, 0) - COALESCE(TienGiamGia, 0)
    ) STORED,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    CONSTRAINT FK_ThongKe_HoaDon 
        FOREIGN KEY (IDHoaDon) REFERENCES HoaDon(IDHoaDon) 
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT FK_ThongKe_DatPhong 
        FOREIGN KEY (IDDatPhong) REFERENCES DatPhong(IDDatPhong) 
        ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- =========================================
-- FUNCTIONS & PROCEDURES
-- =========================================

-- Cập nhật trạng thái khuyến mãi hết hạn
CREATE OR REPLACE FUNCTION sp_capnhat_trangthai_khuyenmai()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    UPDATE KhuyenMai
    SET TrangThai = 'expired', updated_at = now()
    WHERE TrangThai = 'active' AND NgayKetThuc < CURRENT_DATE;

    UPDATE KhuyenMaiPhong kp
    SET IsActive = FALSE, updated_at = now()
    FROM KhuyenMai k
    WHERE kp.IDKhuyenMai = k.IDKhuyenMai 
      AND k.TrangThai = 'expired' 
      AND kp.IsActive = TRUE;
END;
$$;

-- Top phòng theo năm (mặc định 2025, top 5)
CREATE OR REPLACE FUNCTION sp_top_phong(
    year_input INTEGER DEFAULT 2025, 
    top_n INTEGER DEFAULT 5
)
RETURNS TABLE (
    IDPhong VARCHAR(50),
    TenPhong VARCHAR(50),
    SoLanSuDung BIGINT,
    TongDem BIGINT,
    UrlAnhPhong VARCHAR(255)
)
LANGUAGE sql
AS $$
    SELECT 
        p.IDPhong, 
        p.TenPhong, 
        COUNT(dp.IDDatPhong) AS SoLanSuDung, 
        COALESCE(SUM(dp.SoDem), 0) AS TongDem, 
        MAX(p.UrlAnhPhong) AS UrlAnhPhong
    FROM DatPhong dp
    JOIN Phong p ON dp.IDPhong = p.IDPhong
    JOIN HoaDon hd ON dp.IDDatPhong = hd.IDDatPhong
    WHERE dp.TrangThai = 4                     -- Hoàn thành
      AND hd.TrangThaiThanhToan = 2            -- Đã thanh toán
      AND EXTRACT(YEAR FROM dp.NgayNhanPhong) = year_input
    GROUP BY p.IDPhong, p.TenPhong
    ORDER BY SoLanSuDung DESC, TongDem DESC
    LIMIT top_n;
$$;


-- SCRIPT POSTGRESQL: THÊM CÁC CỘT THIẾU VÀO BẢNG DATPHONG

-- 1. Thêm cột SoLuongPhong (Số lượng phòng, kiểu số nguyên)
-- Lưu ý: Tên cột được tạo sẽ là chữ thường (soluongphong)
-- để khớp với cấu hình ToLowerInvariant() trong EF Core của bạn.
ALTER TABLE DatPhong
ADD COLUMN SoLuongPhong INTEGER;

-- 2. Thêm cột SoNguoi (Số lượng người, kiểu số nguyên)
ALTER TABLE DatPhong
ADD COLUMN SoNguoi INTEGER;

-- 3. Thêm cột ThoiHan (Thời hạn hết hạn, kiểu Timestamp)
-- Đây là cột mà ứng dụng của bạn đang dùng trong mệnh đề WHERE (d.thoihan IS NOT NULL...)
ALTER TABLE DatPhong
ADD COLUMN ThoiHan TIMESTAMP NULL;

-- SCRIPT POSTGRESQL: THÊM CỘT THIẾU VÀO BẢNG KHUYENMAI

-- Thêm cột hinhanhbanner (VARCHAR để lưu URL hình ảnh)
-- Tên cột được tạo sẽ là chữ thường (hinhanhbanner) để khớp với cấu hình EF Core của bạn.
ALTER TABLE KhuyenMai
ADD COLUMN HinhAnhBanner VARCHAR(255) NULL;


-- SCRIPT POSTGRESQL: CHUYỂN ĐỔI TIMESTAMP SANG TIMESTAMPTZ

-- Bảng pending_users
ALTER TABLE "pending_users"
ALTER COLUMN otp_expired_at TYPE TIMESTAMP WITH TIME ZONE,
ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE;

-- Bảng HoaDon
-- NgayLap (Ngày Lập Hóa Đơn)
ALTER TABLE "hoadon"
ALTER COLUMN ngaylap TYPE TIMESTAMP WITH TIME ZONE;

-- Bảng CTHDDV (Chi tiết Hóa đơn Dịch vụ)
-- ThoiGianThucHien, ThoiGianBatDau, ThoiGianKetThuc
ALTER TABLE "cthddv"
ALTER COLUMN thoigianthuchien TYPE TIMESTAMP WITH TIME ZONE,
ALTER COLUMN thoigianbatdau TYPE TIMESTAMP WITH TIME ZONE,
ALTER COLUMN thoigianketthuc TYPE TIMESTAMP WITH TIME ZONE;

-- Bảng LichSuDatPhong (Lịch sử Đặt phòng)
-- NgayCapNhat (Ngày Cập Nhật)
ALTER TABLE "lichsudatphong"
ALTER COLUMN ngaycapnhat TYPE TIMESTAMP WITH TIME ZONE;

-- Bảng DanhGia
-- created_at, updated_at
ALTER TABLE "danhgia"
ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE,
ALTER COLUMN updated_at TYPE TIMESTAMP WITH TIME ZONE;

-- Bảng ThongKeDoanhThuKhachSan
-- created_at, updated_at
ALTER TABLE "thongkedoanhthukhachsan"
ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE,
ALTER COLUMN updated_at TYPE TIMESTAMP WITH TIME ZONE;

-- Bảng KhuyenMai, KhuyenMaiPhong, KhuyenMaiDichVu (Nếu có các cột TIMESTAMP/DATETIME2)
-- Nếu bạn có các bảng Khuyến mãi khác như KhuyenMaiCombo, KhuyenMaiPhongDichVu, 
-- hãy lặp lại ALTER COLUMN cho các cột created_at và updated_at
-- Ví dụ:
ALTER TABLE "khuyenmai"
ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE,
ALTER COLUMN updated_at TYPE TIMESTAMP WITH TIME ZONE;

-- Bảng DatPhong (Nếu bạn có cột ThoiHan là TIMESTAMP)
-- Đây là cột đang gây lỗi chính trong dịch vụ nền của bạn
ALTER TABLE "datphong"
ALTER COLUMN thoihan TYPE TIMESTAMP WITH TIME ZONE;



