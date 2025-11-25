-- ===================================================================
-- INSERT DỮ LIỆU MẪU CHO POSTGRESQL (ĐÃ SỬA LỖI KÝ TỰ ĐẶC BIỆT)
-- ===================================================================

/* -------------------------------------------
   2) LOẠI PHÒNG & PHÒNG
------------------------------------------- */

INSERT INTO "loaiphong" ("idloaiphong", "tenloaiphong", "mota", "urlanhloaiphong")
VALUES
('LP01', 'Deluxe Room',
 'Phòng hiện đại, thiết kế tinh tế với tầm nhìn hướng thành phố hoặc hồ, nội thất sang trọng và tiện nghi cao cấp.',
 'deluxe-room.webp'),
('LP02', 'Executive Room',
 'Phòng Executive với quyền sử dụng Executive Lounge, tầm nhìn hướng hồ, nội thất cao cấp.',
 'executive-room.webp'),
('LP03', 'Executive Suite',
 'Suite rộng rãi có phòng khách riêng, được sử dụng Executive Lounge và tầm nhìn tuyệt đẹp.',
 'executive-suite.webp'),
('LP04', 'Grand Suite',
 'Suite cao cấp với phòng khách lớn và view hồ tuyệt đẹp.',
 'grand-suite.webp'),
('LP05', 'Presidential Suite',
 'Suite Tổng thống đẳng cấp nhất khách sạn, có phòng khách, phòng ăn, bếp riêng và tầm nhìn toàn cảnh hồ.',
 'presidential-suite.webp'),
('LP06', 'Chairman Suite',
 'Suite Chủ tịch xa hoa, thiết kế tinh xảo, có phòng họp và khu vực tiếp khách riêng.',
 'chairman-suite.webp')
ON CONFLICT ("idloaiphong") DO NOTHING;


INSERT INTO "phong" ("idphong", "idloaiphong", "tenphong", "sophong", "mota", "songuoitoida", "giacobanmotdem", "xephangsao", "trangthai", "urlanhphong")
VALUES
-- Deluxe Room
('P101', 'LP01', 'Deluxe Room 101', '101',
 'Phòng Deluxe hiện đại, hướng thành phố, nội thất sang trọng.',
 3, 5500000, 5, 'Trống',
 'deluxe-room-101.webp'),
('P102', 'LP01', 'Deluxe Room 102', '102',
 'Phòng Deluxe hướng hồ, giường King size.',
 3, 5500000, 5, 'Đang sử dụng',
 'deluxe-room-102.webp'),

-- Executive Room
('P201', 'LP02', 'Executive Room 201', '201',
 'Phòng Executive sang trọng, bao gồm quyền Executive Lounge.',
 3, 7000000, 5, 'Trống',
 'executive-room-201.webp'),

-- Executive Suite
('P301', 'LP03', 'Executive Suite 301', '301',
 'Suite rộng rãi với phòng khách riêng biệt, hướng hồ.',
 3, 9500000, 5, 'Trống',
 'executive-suite-301.webp'),

-- Grand Suite
('P401', 'LP04', 'Grand Suite 401', '401',
 'Suite cao cấp với phòng khách lớn và view hồ tuyệt đẹp.',
 3, 12000000, 5, 'Trống',
 'grand-suite-401.webp'),

-- Presidential Suite
('P501', 'LP05', 'Presidential Suite 501', '501',
 'Suite Tổng thống với phòng ăn riêng, phòng làm việc và bồn tắm jacuzzi.',
 4, 25000000, 5, 'Trống',
 'presidential-suite-501.webp'),

-- Chairman Suite
('P601', 'LP06', 'Chairman Suite 601', '601',
 'Suite Chủ tịch xa hoa, thiết kế tinh xảo, có phòng họp và khu vực tiếp khách riêng.',
 4, 20000000, 5, 'Trống',
 'chairman-suite-601.webp')
ON CONFLICT ("idphong") DO NOTHING;

/* -------------------------------------------
   3) TIỆN NGHI
------------------------------------------- */

INSERT INTO "tiennghi" ("idtiennghi", "tentiennghi")
VALUES
('TN01', 'Wi-Fi tốc độ cao miễn phí'),
('TN02', 'Tivi màn hình phẳng 55 inch'),
('TN03', 'Máy lạnh trung tâm'),
('TN04', 'Bồn tắm sang trọng'),
('TN05', 'Minibar cao cấp'),
('TN06', 'Máy pha cà phê Nespresso'),
('TN07', 'Máy sấy tóc Dyson'),
('TN08', 'Két sắt điện tử'),
('TN09', 'Bàn làm việc và ghế da'),
('TN10', 'Ban công hướng hồ hoặc thành phố'),
('TN11', 'Phòng tắm đá cẩm thạch'),
('TN12', 'Tủ quần áo lớn có gương'),
('TN13', 'Dịch vụ phòng 24/7'),
('TN14', 'Loa Bluetooth Bose'),
('TN15', 'Truy cập Executive Lounge'),
('TN16', 'Phòng khách riêng biệt'),
('TN17', 'Bồn tắm jacuzzi'),
('TN18', 'Phòng ăn riêng'),
('TN19', 'Phòng làm việc riêng'),
('TN20', 'Phòng họp cao cấp')
ON CONFLICT ("idtiennghi") DO NOTHING;

-- Tiện nghi phòng
INSERT INTO "tiennghiphong" ("idtiennghiphong", "idphong", "idtiennghi")
VALUES
-- P101 Deluxe Room 101
('TNP001', 'P101', 'TN01'), ('TNP002', 'P101', 'TN02'), ('TNP003', 'P101', 'TN03'), ('TNP004', 'P101', 'TN05'),
('TNP005', 'P101', 'TN07'), ('TNP006', 'P101', 'TN09'), ('TNP007', 'P101', 'TN11'), ('TNP008', 'P101', 'TN13'),

-- P102 Deluxe Room 102
('TNP009', 'P102', 'TN01'), ('TNP010', 'P102', 'TN02'), ('TNP011', 'P102', 'TN03'), ('TNP012', 'P102', 'TN04'),
('TNP013', 'P102', 'TN05'), ('TNP014', 'P102', 'TN06'), ('TNP015', 'P102', 'TN07'), ('TNP016', 'P102', 'TN09'),
('TNP017', 'P102', 'TN10'), ('TNP018', 'P102', 'TN13'),

-- P201 Executive Room 201
('TNP019', 'P201', 'TN01'), ('TNP020', 'P201', 'TN02'), ('TNP021', 'P201', 'TN03'), ('TNP022', 'P201', 'TN04'),
('TNP023', 'P201', 'TN05'), ('TNP024', 'P201', 'TN06'), ('TNP025', 'P201', 'TN07'), ('TNP026', 'P201', 'TN08'),
('TNP027', 'P201', 'TN09'), ('TNP028', 'P201', 'TN10'), ('TNP029', 'P201', 'TN11'), ('TNP030', 'P201', 'TN12'),
('TNP031', 'P201', 'TN13'), ('TNP032', 'P201', 'TN15'),

-- P301 Executive Suite 301
('TNP033', 'P301', 'TN01'), ('TNP034', 'P301', 'TN02'), ('TNP035', 'P301', 'TN03'), ('TNP036', 'P301', 'TN04'),
('TNP037', 'P301', 'TN05'), ('TNP038', 'P301', 'TN06'), ('TNP039', 'P301', 'TN07'), ('TNP040', 'P301', 'TN08'),
('TNP041', 'P301', 'TN09'), ('TNP042', 'P301', 'TN10'), ('TNP043', 'P301', 'TN11'), ('TNP044', 'P301', 'TN12'),
('TNP045', 'P301', 'TN13'), ('TNP046', 'P301', 'TN14'), ('TNP047', 'P301', 'TN15'), ('TNP048', 'P301', 'TN16'),

-- P401 Grand Suite 401
('TNP049', 'P401', 'TN01'), ('TNP050', 'P401', 'TN02'), ('TNP051', 'P401', 'TN03'), ('TNP052', 'P401', 'TN04'),
('TNP053', 'P401', 'TN05'), ('TNP054', 'P401', 'TN06'), ('TNP055', 'P401', 'TN07'), ('TNP056', 'P401', 'TN08'),
('TNP057', 'P401', 'TN09'), ('TNP058', 'P401', 'TN10'), ('TNP059', 'P401', 'TN11'), ('TNP060', 'P401', 'TN12'),
('TNP061', 'P401', 'TN13'), ('TNP062', 'P401', 'TN14'), ('TNP063', 'P401', 'TN15'), ('TNP064', 'P401', 'TN16'),

-- P501 Presidential Suite 501
('TNP065', 'P501', 'TN01'), ('TNP066', 'P501', 'TN02'), ('TNP067', 'P501', 'TN03'), ('TNP068', 'P501', 'TN04'),
('TNP069', 'P501', 'TN05'), ('TNP070', 'P501', 'TN06'), ('TNP071', 'P501', 'TN07'), ('TNP072', 'P501', 'TN08'),
('TNP073', 'P501', 'TN09'), ('TNP074', 'P501', 'TN10'), ('TNP075', 'P501', 'TN11'), ('TNP076', 'P501', 'TN12'),
('TNP077', 'P501', 'TN13'), ('TNP078', 'P501', 'TN14'), ('TNP079', 'P501', 'TN15'), ('TNP080', 'P501', 'TN16'),
('TNP081', 'P501', 'TN17'), ('TNP082', 'P501', 'TN18'), ('TNP083', 'P501', 'TN19'),

-- P601 Chairman Suite 601
('TNP084', 'P601', 'TN01'), ('TNP085', 'P601', 'TN02'), ('TNP086', 'P601', 'TN03'), ('TNP087', 'P601', 'TN04'),
('TNP088', 'P601', 'TN05'), ('TNP089', 'P601', 'TN06'), ('TNP090', 'P601', 'TN07'), ('TNP091', 'P601', 'TN08'),
('TNP092', 'P601', 'TN09'), ('TNP093', 'P601', 'TN10'), ('TNP094', 'P601', 'TN11'), ('TNP095', 'P601', 'TN12'),
('TNP096', 'P601', 'TN13'), ('TNP097', 'P601', 'TN14'), ('TNP098', 'P601', 'TN15'), ('TNP099', 'P601', 'TN16'),
('TNP100', 'P601', 'TN17'), ('TNP101', 'P601', 'TN18'), ('TNP102', 'P601', 'TN19'), ('TNP103', 'P601', 'TN20')
ON CONFLICT ("idtiennghiphong") DO NOTHING;


/* -------------------------------------------
   5) DỊCH VỤ & THÔNG TIN
------------------------------------------- */

INSERT INTO "dichvu" ("iddichvu", "tendichvu", "tiendichvu", "hinhdichvu", "thoigianbatdau", "thoigianketthuc", "trangthai")
VALUES
('DV001', 'Spa L’Occitane – Massage toàn thân 60 phút', 1500000.00, 'spa_full_body_60.webp', '09:00', '22:00', 'Hoạt động'),
('DV002', 'Phòng Gym & Hồ bơi – Truy cập 3 giờ', 500000.00, 'gym_pool_3h.webp', '06:00', '21:00', 'Hoạt động'),
('DV003', 'Giặt ủi nhanh (Express – 1 bộ đồ)', 120000.00, 'laundry_express.webp', '08:00', '20:00', 'Hoạt động'),
('DV004', 'Đưa đón sân bay – Mercedes 4 chỗ', 1300000.00, 'airport_transfer.webp', NULL, NULL, 'Hoạt động'),
('DV005', 'Trải nghiệm Buffet sáng tại JW Café', 550000.00, 'buffet_breakfast_jw.webp', '06:00', '10:30', 'Hoạt động'),
('DV006', 'Trà chiều tại Lounge Bar', 750000.00, 'afternoon_tea.webp', '14:00', '17:00', 'Hoạt động'),
('DV007', 'Phục vụ ăn tại phòng (In-room Dining)', 300000.00, 'inroom_dining.webp', '06:00', '23:00', 'Hoạt động'),
('DV008', 'Tour Hà Nội 3 giờ bằng Limousine', 2500000.00, 'hanoi_tour_limousine.webp', '08:00', '20:00', 'Hoạt động')
ON CONFLICT ("iddichvu") DO NOTHING;

INSERT INTO "ttdichvu" ("idttdichvu", "iddichvu", "thongtindv", "thoiluonguoctinh", "ghichu")
VALUES
('TTDV001', 'DV001', 'Massage toàn thân thư giãn 60 phút với tinh dầu L’Occitane nhập khẩu, giúp phục hồi năng lượng và giảm căng thẳng.', 60, 'Phải đặt trước ít nhất 2 tiếng.'),
('TTDV002', 'DV002', 'Hồ bơi nước nóng trong nhà đạt chuẩn 5 sao, có khu vực trẻ em riêng và nhân viên cứu hộ túc trực.', 90, 'Mở cửa từ 6h00 – 22h00.'),
('TTDV003', 'DV003', 'Phòng tập thể hình với trang thiết bị Technogym hiện đại, có huấn luyện viên cá nhân (PT) hỗ trợ.', 60, 'Tự do sử dụng cho khách lưu trú.'),
('TTDV004', 'DV004', 'Dịch vụ đưa đón sân bay Nội Bài bằng xe Mercedes S-Class, tài xế chuyên nghiệp, nước suối và khăn lạnh miễn phí.', 45, 'Cần đặt trước ít nhất 4 tiếng.'),
('TTDV005', 'DV005', 'Dịch vụ giặt, ủi và gấp quần áo trong ngày, giao tận phòng khách.', 180, 'Phụ phí cho dịch vụ lấy nhanh 3 giờ.'),
('TTDV006', 'DV005', 'Buffet sáng tại nhà hàng French Grill – hơn 60 món Á, Âu và tráng miệng cao cấp.', 90, 'Phục vụ từ 6h00 – 10h00 sáng.'),
('TTDV007', 'DV007', 'Dịch vụ trang trí hoa tươi trong phòng, sảnh hoặc khu vực tổ chức sự kiện theo yêu cầu.', 120, 'Liên hệ lễ tân để đặt mẫu hoa trước 24h.'),
('TTDV008', 'DV008', 'Phòng họp sang trọng với màn hình LED, micro không dây, âm thanh Bose và phục vụ trà bánh.', 240, 'Phải đặt trước, giá theo giờ.')
ON CONFLICT ("idttdichvu") DO NOTHING;

/* -------------------------------------------
   8) KHUYẾN MẠI
------------------------------------------- */

INSERT INTO "khuyenmai" (
  "idkhuyenmai", "tenkhuyenmai", "mota", "loaigiamgia",
  "giatrigiam", "ngaybatdau", "ngayketthuc", "trangthai"
)
VALUES
('KM001', 'Giảm 20% dịch vụ Spa mùa hè 2025',
 'Áp dụng cho khách đặt phòng Deluxe hoặc Executive từ 01/06 đến 31/08/2025.',
 'percent', 20.00, '2025-06-01', '2025-08-31', 'active'),

('KM002', 'Giảm 300.000đ khi thuê xe Limousine Hà Nội',
 'Khách đặt Tour Hà Nội 3 giờ bằng Limousine nhận giảm 300.000đ mỗi lượt.',
 'amount', 300000.00, '2025-07-01', '2025-09-30', 'active'),

('KM003', 'Combo Buffet sáng & In-room Dining',
 'Giảm 15% khi kết hợp Buffet sáng tại JW Café và ăn tại phòng vào cuối tuần.',
 'percent', 15.00, '2025-01-01', '2025-12-31', 'active')
ON CONFLICT ("idkhuyenmai") DO NOTHING;

ALTER TABLE "khuyenmaiphong"
ADD CONSTRAINT UQ_KhuyenMaiPhong_ID UNIQUE ("idkhuyenmai", "idphong");
INSERT INTO "khuyenmaiphong" (
  "idkhuyenmai", "idphong", "isactive", "ngayapdung", "ngayketthuc"
)
VALUES
-- Spa mùa hè áp dụng cho Deluxe & Executive
('KM001', 'P101', TRUE, '2025-06-01', '2025-08-31'),
('KM001', 'P102', TRUE, '2025-06-01', '2025-08-31'),
('KM001', 'P201', TRUE, '2025-06-01', '2025-08-31'),

-- Thuê xe Limousine áp dụng cho Executive Suite
('KM002', 'P301', TRUE, '2025-07-01', '2025-09-30'),

-- Combo Buffet sáng + In-room Dining áp dụng cho các phòng cao cấp
('KM003', 'P401', TRUE, '2025-01-01', '2025-12-31'),
('KM003', 'P501', TRUE, '2025-01-01', '2025-12-31'),
('KM003', 'P601', TRUE, '2025-01-01', '2025-12-31')
ON CONFLICT ("idkhuyenmai", "idphong") DO NOTHING;