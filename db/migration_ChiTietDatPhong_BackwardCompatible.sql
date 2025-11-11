/* =========================================
   MIGRATION: THÊM BẢNG CHI TIẾT ĐẶT PHÒNG (BACKWARD COMPATIBLE)
   Mục đích: Cho phép đặt nhiều phòng trong 1 đơn đặt phòng
   Chiến lược: GIỮ NGUYÊN cột IDPhong và SoDem trong DatPhong
   Ngày: 2025-11-11
========================================= */

USE HotelSystem;
GO

PRINT N'🚀 Bắt đầu migration Chi Tiết Đặt Phòng...';
GO

/* =========================================
   BƯỚC 1: TẠO BẢNG CHI TIẾT ĐẶT PHÒNG
========================================= */

PRINT N'📝 Bước 1: Tạo bảng ChiTietDatPhong...';
GO

CREATE TABLE ChiTietDatPhong (
    IDChiTiet INT IDENTITY(1,1) PRIMARY KEY,
    IDDatPhong NVARCHAR(50) NOT NULL,
    IDPhong NVARCHAR(50) NOT NULL,
    SoDem INT NOT NULL,
    GiaPhong DECIMAL(18,2) NOT NULL,
    ThanhTien DECIMAL(18,2) NOT NULL,
    GhiChu NVARCHAR(MAX),
    
    CONSTRAINT FK_ChiTietDatPhong_DatPhong 
        FOREIGN KEY (IDDatPhong) REFERENCES DatPhong(IDDatPhong)
        ON DELETE CASCADE ON UPDATE NO ACTION,
    
    CONSTRAINT FK_ChiTietDatPhong_Phong 
        FOREIGN KEY (IDPhong) REFERENCES Phong(IDPhong)
        ON DELETE NO ACTION ON UPDATE NO ACTION,
    
    -- Đảm bảo không đặt trùng phòng trong cùng 1 đơn
    CONSTRAINT UQ_DatPhong_Phong UNIQUE (IDDatPhong, IDPhong)
);
GO

PRINT N'✅ Bảng ChiTietDatPhong đã được tạo thành công!';
GO

/* =========================================
   BƯỚC 2: MIGRATION DỮ LIỆU CŨ
   Chuyển dữ liệu từ DatPhong vào ChiTietDatPhong
   (GIỮ NGUYÊN DatPhong.IDPhong và DatPhong.SoDem)
========================================= */

PRINT N'📦 Bước 2: Migration dữ liệu từ DatPhong sang ChiTietDatPhong...';
GO

-- Chèn dữ liệu từ bảng DatPhong hiện tại vào ChiTietDatPhong
INSERT INTO ChiTietDatPhong (IDDatPhong, IDPhong, SoDem, GiaPhong, ThanhTien, GhiChu)
SELECT 
    dp.IDDatPhong,
    dp.IDPhong,
    dp.SoDem,
    p.GiaCoBanMotDem,
    dp.SoDem * p.GiaCoBanMotDem AS ThanhTien,
    N'Migrated từ dữ liệu cũ - ' + CONVERT(NVARCHAR(20), GETDATE(), 120) AS GhiChu
FROM DatPhong dp
INNER JOIN Phong p ON dp.IDPhong = p.IDPhong
WHERE dp.IDPhong IS NOT NULL;

DECLARE @MigratedCount INT = @@ROWCOUNT;
PRINT N'✅ Đã migration ' + CAST(@MigratedCount AS NVARCHAR(10)) + N' bản ghi vào ChiTietDatPhong';
GO

