# ⚠️ PHÂN TÍCH TÁC ĐỘNG MIGRATION CHI TIẾT ĐẶT PHÒNG

## 📊 Tổng quan tác động

Migration này **CÓ TÁC ĐỘNG** đến một số API hiện có, nhưng **KHÔNG GÂY LỖI** nếu thực hiện đúng các bước.

---

## ✅ API KHÔNG BỊ ẢNH HƯỞNG

### 1. **PhongController** - ✅ An toàn 100%

- `GET /api/Phong` - Lấy danh sách phòng
- `POST /api/Phong` - Tạo phòng mới
- `PUT /api/Phong/{id}` - Cập nhật phòng
- `DELETE /api/Phong/{id}` - Xóa phòng

**Lý do:** Các API này chỉ làm việc với bảng `Phong`, không liên quan đến `DatPhong`.

---

### 2. **TienNghiPhongController** - ✅ An toàn 100%

- `GET /api/TienNghiPhong` - Lấy danh sách tiện nghi phòng
- `GET /api/TienNghiPhong/room/{id}` - Lấy tiện nghi theo phòng
- `POST /api/TienNghiPhong` - Thêm tiện nghi
- `DELETE /api/TienNghiPhong/{idPhong}/{idtienNghi}` - Xóa tiện nghi

**Lý do:** Không liên quan đến đặt phòng.

---

### 3. **LoaiPhongController** - ✅ An toàn 100%

- Tất cả các API về loại phòng không bị ảnh hưởng

---

### 4. **TienNghiController** - ✅ An toàn 100%

- Tất cả các API về tiện nghi không bị ảnh hưởng

---

### 5. **DichVuController** - ✅ An toàn 100%

- Tất cả các API về dịch vụ không bị ảnh hưởng

---

## ⚠️ API CẦN XEM XÉT/CẬP NHẬT

### 1. **RoomService.CheckAvailableRoomsAsync()** - ⚠️ CẦN CẬP NHẬT

**File:** `Services/RoomService.cs`

**Code hiện tại:**

```csharp
!_context.DatPhongs.Any(dp =>
    dp.Idphong == p.Idphong &&  // ⚠️ Dùng cột IDPhong cũ
    new[] { 1, 2, 3 }.Contains(dp.TrangThai) &&
    dp.NgayNhanPhong < DateOnly.FromDateTime(checkOut) &&
    dp.NgayTraPhong > DateOnly.FromDateTime(checkIn))
```

**Vấn đề:**

- Hiện tại đang check `dp.Idphong == p.Idphong`
- Sau migration, cần check qua bảng `ChiTietDatPhong`

**Giải pháp:** 2 options

#### **Option 1: GIỮ NGUYÊN cột IDPhong trong DatPhong (Khuyến nghị)**

✅ Không cần sửa code
✅ Backward compatible
✅ Đơn giản nhất

Trong migration SQL, **KHÔNG XÓA** cột `IDPhong` và `SoDem`:

```sql
-- COMMENT LẠI PHẦN NÀY TRONG migration_ChiTietDatPhong.sql
/*
ALTER TABLE DatPhong
DROP CONSTRAINT FK_DatPhong_Phong;
GO

ALTER TABLE DatPhong
DROP COLUMN IDPhong;
GO

ALTER TABLE DatPhong
DROP COLUMN SoDem;
GO
*/
```

**Cách hoạt động:**

- API check phòng trống vẫn dùng `DatPhong.IDPhong` (phòng đầu tiên/chính)
- Các phòng phụ thêm nằm trong `ChiTietDatPhong`

#### **Option 2: Xóa cột IDPhong, update logic (Phức tạp hơn)**

```csharp
// Cần sửa thành:
var bookedRoomIds = await _context.ChiTietDatPhongs
    .Where(ct =>
        new[] { 1, 2, 3 }.Contains(ct.DatPhong.TrangThai) &&
        ct.DatPhong.NgayNhanPhong < DateOnly.FromDateTime(checkOut) &&
        ct.DatPhong.NgayTraPhong > DateOnly.FromDateTime(checkIn))
    .Select(ct => ct.IDPhong)
    .Distinct()
    .ToListAsync();

var availableRooms = allRooms.Where(p =>
    p.TrangThai == "Trống" &&
    p.SoNguoiToiDa >= numberOfGuests &&
    !bookedRoomIds.Contains(p.Idphong)
).ToList();
```

---

### 2. **Nếu có API Đặt phòng** - ⚠️ CẦN TẠO MỚI

**Hiện tại:** Chưa có `BookingController` hoặc API đặt phòng.

**Cần tạo:**

- API POST đặt phòng mới sử dụng `ChiTietDatPhong`
- API GET lấy chi tiết đơn đặt (bao gồm nhiều phòng)
- API PUT cập nhật đơn đặt
- API DELETE hủy đơn đặt

Tôi có thể tạo controller này cho bạn!

---

### 3. **Frontend** - ⚠️ CẦN CẬP NHẬT

Nếu frontend đang có chức năng đặt phòng, cần update:

**Request cũ (1 phòng):**

```json
{
  "IDKhachHang": 1,
  "IDPhong": "P101",
  "NgayNhanPhong": "2025-12-01",
  "NgayTraPhong": "2025-12-03",
  "TienCoc": 200000
}
```

**Request mới (nhiều phòng):**

```json
{
  "IDKhachHang": 1,
  "NgayNhanPhong": "2025-12-01",
  "NgayTraPhong": "2025-12-03",
  "TienCoc": 500000,
  "DanhSachPhong": [
    {
      "IDPhong": "P101",
      "SoDem": 2,
      "GiaPhong": 5500000
    },
    {
      "IDPhong": "P201",
      "SoDem": 2,
      "GiaPhong": 7000000
    }
  ]
}
```

---

## 🎯 KHUYẾN NGHỊ TRIỂN KHAI

### ✅ **Phương án an toàn nhất (Khuyến nghị):**

1. **GIỮ NGUYÊN** cột `IDPhong` và `SoDem` trong bảng `DatPhong`

   - Lý do: Backward compatible, không break API hiện tại
   - Dữ liệu cũ vẫn hoạt động bình thường

2. **THÊM MỚI** bảng `ChiTietDatPhong` song song

   - Các đặt phòng mới sẽ dùng `ChiTietDatPhong`
   - Các đặt phòng cũ vẫn dùng `DatPhong.IDPhong`

3. **TẠO API MỚI** cho đặt nhiều phòng

   - Endpoint mới: `POST /api/Booking/book-multiple-rooms`
   - Endpoint cũ vẫn hoạt động (nếu có)

4. **CẬP NHẬT CHECK PHÒNG TRỐNG** (RoomService)

   ```csharp
   // Check cả 2: IDPhong trong DatPhong VÀ ChiTietDatPhong
   var bookedInDatPhong = _context.DatPhongs
       .Where(dp => dp.Idphong == p.Idphong && ...)
       .Any();

   var bookedInChiTiet = _context.ChiTietDatPhongs
       .Where(ct => ct.IDPhong == p.Idphong && ...)
       .Any();

   bool isBooked = bookedInDatPhong || bookedInChiTiet;
   ```

---

## 📋 CHECKLIST TRIỂN KHAI

### Phase 1: Migration Database ✅

- [x] Tạo bảng `ChiTietDatPhong`
- [x] Migration dữ liệu cũ
- [x] Tạo indexes, triggers, views
- [ ] **QUAN TRỌNG:** Comment lại phần DROP COLUMN trong script

### Phase 2: Backend Update

- [x] Tạo Model `ChiTietDatPhong.cs`
- [x] Cập nhật `HotelSystemContext.cs`
- [x] Tạo DTOs mới
- [ ] **CẬN CẬP NHẬT:** `RoomService.CheckAvailableRoomsAsync()`
- [ ] **CẦN TẠO:** `BookingController` cho API đặt phòng mới

### Phase 3: Testing

- [ ] Test migration database thành công
- [ ] Test API check phòng trống vẫn hoạt động
- [ ] Test API đặt phòng mới (nhiều phòng)
- [ ] Test trigger tự động tính tổng tiền

### Phase 4: Frontend (nếu có)

- [ ] Update booking form hỗ trợ nhiều phòng
- [ ] Update display chi tiết đơn đặt

---

## 🔥 ĐIỂM QUAN TRỌNG

### ⚠️ TRƯỚC KHI CHẠY MIGRATION:

```sql
-- TRONG FILE migration_ChiTietDatPhong.sql
-- TÌM VÀ COMMENT LẠI PHẦN NÀY:

/*
-- ⚠️ CHÚ Ý: Chỉ chạy sau khi đã kiểm tra dữ liệu migration thành công!
-- ⚠️ Bỏ comment các dòng dưới đây khi sẵn sàng:

-- Xóa foreign key constraint trước
ALTER TABLE DatPhong
DROP CONSTRAINT FK_DatPhong_Phong;
GO

-- Xóa cột IDPhong
ALTER TABLE DatPhong
DROP COLUMN IDPhong;
GO

-- Xóa cột SoDem
ALTER TABLE DatPhong
DROP COLUMN SoDem;
GO
*/
```

**KHÔNG XÓA CÁC CỘT NÀY** cho đến khi:

1. ✅ Tất cả API mới đã hoạt động ổn định
2. ✅ Frontend đã update xong
3. ✅ Đã test kỹ lưỡng
4. ✅ Tất cả đơn đặt cũ đã hoàn thành hoặc được migrate

---

## 💡 KẾT LUẬN

| Tác động        | Mức độ              | Cần hành động                       |
| --------------- | ------------------- | ----------------------------------- |
| **API hiện có** | ✅ Không ảnh hưởng  | Không cần sửa (nếu giữ cột IDPhong) |
| **RoomService** | ⚠️ Cần cập nhật nhẹ | Cập nhật logic check phòng          |
| **Booking API** | ⚠️ Cần tạo mới      | Tạo controller mới                  |
| **Database**    | ✅ An toàn          | Migration có sẵn                    |
| **Frontend**    | ⚠️ Cần update       | Update form đặt phòng               |

**Tổng kết:** Migration này **AN TOÀN** nếu thực hiện đúng khuyến nghị, không gây break API hiện tại.

---

**Ngày tạo:** 2025-11-11  
**Status:** Ready for implementation
