-- ============================================
-- TẠO LẠI TOÀN BỘ - TRIGGERS, HÀM, VIEWS
-- ============================================

\echo '========== XÓA CÁI CŨ =========='
DROP TRIGGER IF EXISTS trg_insert_hoadon_to_thongke ON HoaDon;
DROP TRIGGER IF EXISTS trg_luu_thong_ke ON HoaDon;
DROP FUNCTION IF EXISTS fn_luu_thong_ke();
DROP FUNCTION IF EXISTS upsert_thongke_for_hoadon(VARCHAR);
DROP FUNCTION IF EXISTS sync_thongke_from_mv();
DROP FUNCTION IF EXISTS refresh_mv_thongke();
DROP MATERIALIZED VIEW IF EXISTS mv_thongke;
DROP TABLE IF EXISTS ThongKeDoanhThuKhachSan;

\echo '========== TẠO BẢNG THỐNG KÊ =========='
CREATE TABLE ThongKeDoanhThuKhachSan (
    ID BIGSERIAL PRIMARY KEY,
    IDHoaDon VARCHAR(50) UNIQUE NOT NULL,
    IDDatPhong VARCHAR(50),
    Ngay DATE,
    TongPhong INTEGER DEFAULT 0,
    SoDemDaDat INTEGER DEFAULT 0,
    TienPhong NUMERIC(18,2) DEFAULT 0,
    TienDichVu NUMERIC(18,2) DEFAULT 0,
    TienGiamGia NUMERIC(18,2) DEFAULT 0,
    DoanhThuThucNhan NUMERIC(18,2) GENERATED ALWAYS AS (
        -- VAT 10% applies only to room + service; discounts subtracted after VAT
        ROUND((COALESCE(TienPhong,0) + COALESCE(TienDichVu,0)) * 1.10 - COALESCE(TienGiamGia,0), 2)
    ) STORED,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_thongke_hoadon ON ThongKeDoanhThuKhachSan(IDHoaDon);
CREATE INDEX idx_thongke_ngay ON ThongKeDoanhThuKhachSan(Ngay);

\echo '========== TẠO MATERIALIZED VIEW =========='
CREATE MATERIALIZED VIEW mv_thongke AS
SELECT
    hd.IDHoaDon,
    hd.IDDatPhong,
    COALESCE(date(hd.NgayLap), CURRENT_DATE) AS Ngay,
    COUNT(DISTINCT ctdp.IDPhong) AS TongPhong,
    COALESCE(SUM(ctdp.SoDem), 0) AS SoDemDaDat,
    COALESCE(SUM(ctdp.ThanhTien), 0) AS TienPhong,
    COALESCE(SUM(cth.TienDichVu), 0) AS TienDichVu,
    0 AS TienGiamGia
FROM HoaDon hd
LEFT JOIN ChiTietDatPhong ctdp ON hd.IDDatPhong = ctdp.IDDatPhong
LEFT JOIN CTHDDV cth ON hd.IDHoaDon = cth.IDHoaDon
GROUP BY hd.IDHoaDon, hd.IDDatPhong, hd.NgayLap;

CREATE UNIQUE INDEX idx_mv_thongke_hoadon ON mv_thongke(IDHoaDon);

\echo '========== TẠO HÀM REFRESH MV =========='
CREATE OR REPLACE FUNCTION refresh_mv_thongke()
RETURNS void LANGUAGE sql AS 'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_thongke;';

\echo '========== TẠO HÀM SYNC TỬ MV =========='
CREATE OR REPLACE FUNCTION sync_thongke_from_mv()
RETURNS void LANGUAGE plpgsql AS $sync$
BEGIN
    -- Đảm bảo MV được refresh trước
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_thongke;
    
    -- Upsert từ MV vào snapshot table
    INSERT INTO ThongKeDoanhThuKhachSan
        (IDHoaDon, IDDatPhong, Ngay, TongPhong, SoDemDaDat, TienPhong, TienDichVu, TienGiamGia, created_at, updated_at)
    SELECT 
        IDHoaDon, IDDatPhong, Ngay, TongPhong, SoDemDaDat, TienPhong, TienDichVu, TienGiamGia, now(), now()
    FROM mv_thongke
    ON CONFLICT (IDHoaDon) DO UPDATE SET
        IDDatPhong = EXCLUDED.IDDatPhong,
        Ngay = EXCLUDED.Ngay,
        TongPhong = EXCLUDED.TongPhong,
        SoDemDaDat = EXCLUDED.SoDemDaDat,
        TienPhong = EXCLUDED.TienPhong,
        TienDichVu = EXCLUDED.TienDichVu,
        TienGiamGia = EXCLUDED.TienGiamGia,
        updated_at = now();
END;
$sync$;

\echo '========== TẠO HÀM UPSERT CHO 1 HÓA ĐƠN =========='
CREATE OR REPLACE FUNCTION upsert_thongke_for_hoadon(p_idhoadon VARCHAR)
RETURNS void LANGUAGE plpgsql AS $upsert$
DECLARE
    v_idhoadon VARCHAR;
    v_iddatphong VARCHAR;
    v_ngay DATE;
    v_tongphong INTEGER := 0;
    v_sodem INTEGER := 0;
    v_tienphong NUMERIC(18,2) := 0;
    v_tiendv NUMERIC(18,2) := 0;
    v_tiengiamgia NUMERIC(18,2) := 0;
BEGIN
    -- Lấy info từ HoaDon
    SELECT hd.IDHoaDon, hd.IDDatPhong, date(hd.NgayLap)
    INTO v_idhoadon, v_iddatphong, v_ngay
    FROM HoaDon hd
    WHERE hd.IDHoaDon = p_idhoadon
    LIMIT 1;

    -- Lấy số phòng, số đêm, tiền phòng từ ChiTietDatPhong
    SELECT COUNT(DISTINCT ctdp.IDPhong), COALESCE(SUM(ctdp.SoDem), 0), COALESCE(SUM(ctdp.ThanhTien), 0)
    INTO v_tongphong, v_sodem, v_tienphong
    FROM ChiTietDatPhong ctdp
    WHERE ctdp.IDDatPhong = v_iddatphong;

    -- Lấy tiền dịch vụ
    SELECT COALESCE(SUM(cth.TienDichVu), 0)
    INTO v_tiendv
    FROM CTHDDV cth
    WHERE cth.IDHoaDon = p_idhoadon;

    -- Tiền giảm giá = 0 (cột không tồn tại)
    v_tiengiamgia := 0;

    -- Upsert vào bảng thống kê
    INSERT INTO ThongKeDoanhThuKhachSan
        (IDHoaDon, IDDatPhong, Ngay, TongPhong, SoDemDaDat, TienPhong, TienDichVu, TienGiamGia, created_at, updated_at)
    VALUES
        (v_idhoadon, v_iddatphong, v_ngay, v_tongphong, v_sodem, v_tienphong, v_tiendv, v_tiengiamgia, now(), now())
    ON CONFLICT (IDHoaDon) DO UPDATE SET
        IDDatPhong = EXCLUDED.IDDatPhong,
        Ngay = EXCLUDED.Ngay,
        TongPhong = EXCLUDED.TongPhong,
        SoDemDaDat = EXCLUDED.SoDemDaDat,
        TienPhong = EXCLUDED.TienPhong,
        TienDichVu = EXCLUDED.TienDichVu,
        TienGiamGia = EXCLUDED.TienGiamGia,
        updated_at = now();
END;
$upsert$;

\echo '========== TẠO TRIGGER - INSERT =========='
CREATE TRIGGER trg_insert_hoadon_to_thongke
AFTER INSERT ON HoaDon
FOR EACH ROW
EXECUTE FUNCTION fn_luu_thong_ke();

\echo '========== TẠO TRIGGER - UPDATE =========='
CREATE TRIGGER trg_luu_thong_ke
AFTER UPDATE OF TrangThaiThanhToan ON HoaDon
FOR EACH ROW
EXECUTE FUNCTION fn_luu_thong_ke();

\echo '========== TẠO HÀM TRIGGER =========='
CREATE OR REPLACE FUNCTION fn_luu_thong_ke()
RETURNS trigger LANGUAGE plpgsql AS $trig$
DECLARE
    v_tongphong INTEGER := 0;
    v_sodem INTEGER := 0;
    v_tienphong NUMERIC(18,2) := 0;
    v_tiendv NUMERIC(18,2) := 0;
    v_tiengiamgia NUMERIC(18,2) := 0;
BEGIN
    -- Khi INSERT: ghi dữ liệu ngay
    -- Khi UPDATE: cập nhật khi trạng thái thanh toán thay đổi
    IF (TG_OP = 'INSERT') THEN
        -- Lấy số phòng / số đêm / tiền phòng từ ChiTietDatPhong
        SELECT COUNT(DISTINCT ctdp.IDPhong), COALESCE(SUM(ctdp.SoDem), 0), COALESCE(SUM(ctdp.ThanhTien), 0)
        INTO v_tongphong, v_sodem, v_tienphong
        FROM ChiTietDatPhong ctdp
        WHERE ctdp.IDDatPhong = NEW.IDDatPhong;

        -- Lấy tiền dịch vụ
        SELECT COALESCE(SUM(cth.TienDichVu), 0) INTO v_tiendv
        FROM CTHDDV cth
        WHERE cth.IDHoaDon = NEW.IDHoaDon;

        -- Tiền giảm giá = 0
        v_tiengiamgia := 0;

        -- Upsert vào bảng thống kê
        INSERT INTO ThongKeDoanhThuKhachSan
            (IDHoaDon, IDDatPhong, Ngay, TongPhong, SoDemDaDat, TienPhong, TienDichVu, TienGiamGia, created_at, updated_at)
        VALUES
            (NEW.IDHoaDon, NEW.IDDatPhong, COALESCE(date(NEW.NgayLap), CURRENT_DATE), v_tongphong, v_sodem, v_tienphong, v_tiendv, v_tiengiamgia, now(), now())
        ON CONFLICT (IDHoaDon) DO UPDATE SET
            IDDatPhong = EXCLUDED.IDDatPhong,
            Ngay = EXCLUDED.Ngay,
            TongPhong = EXCLUDED.TongPhong,
            SoDemDaDat = EXCLUDED.SoDemDaDat,
            TienPhong = EXCLUDED.TienPhong,
            TienDichVu = EXCLUDED.TienDichVu,
            TienGiamGia = EXCLUDED.TienGiamGia,
            updated_at = now();

    ELSIF (TG_OP = 'UPDATE' AND NEW.TrangThaiThanhToan = 2) THEN
        -- Khi thanh toán xong, cập nhật lại thống kê
        SELECT COUNT(DISTINCT ctdp.IDPhong), COALESCE(SUM(ctdp.SoDem), 0), COALESCE(SUM(ctdp.ThanhTien), 0)
        INTO v_tongphong, v_sodem, v_tienphong
        FROM ChiTietDatPhong ctdp
        WHERE ctdp.IDDatPhong = NEW.IDDatPhong;

        SELECT COALESCE(SUM(cth.TienDichVu), 0) INTO v_tiendv
        FROM CTHDDV cth
        WHERE cth.IDHoaDon = NEW.IDHoaDon;

        v_tiengiamgia := 0;

        INSERT INTO ThongKeDoanhThuKhachSan
            (IDHoaDon, IDDatPhong, Ngay, TongPhong, SoDemDaDat, TienPhong, TienDichVu, TienGiamGia, created_at, updated_at)
        VALUES
            (NEW.IDHoaDon, NEW.IDDatPhong, COALESCE(date(NEW.NgayLap), CURRENT_DATE), v_tongphong, v_sodem, v_tienphong, v_tiendv, v_tiengiamgia, now(), now())
        ON CONFLICT (IDHoaDon) DO UPDATE SET
            IDDatPhong = EXCLUDED.IDDatPhong,
            Ngay = EXCLUDED.Ngay,
            TongPhong = EXCLUDED.TongPhong,
            SoDemDaDat = EXCLUDED.SoDemDaDat,
            TienPhong = EXCLUDED.TienPhong,
            TienDichVu = EXCLUDED.TienDichVu,
            TienGiamGia = EXCLUDED.TienGiamGia,
            updated_at = now();
    END IF;

    RETURN NEW;
END;
$trig$;

\echo '========== HOÀN TẤT - KIỂM TRA =========='
\echo 'Các trigger tạo được:'
SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid = 'HoaDon'::regclass;

\echo 'Các hàm tạo được:'
SELECT proname FROM pg_proc WHERE proname IN ('fn_luu_thong_ke', 'upsert_thongke_for_hoadon', 'sync_thongke_from_mv', 'refresh_mv_thongke') ORDER BY proname;

\echo 'Materialized view:'
SELECT COUNT(*) as view_rows FROM mv_thongke;

\echo 'Bảng thống kê:'
SELECT COUNT(*) as stats_rows FROM ThongKeDoanhThuKhachSan;

\echo '✅ XONG!'
