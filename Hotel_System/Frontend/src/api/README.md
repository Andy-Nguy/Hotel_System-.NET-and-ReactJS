# API Configuration Guide

## ⚠️ Quan trọng: Kiểm tra API Server trước khi chuyển local

**Trước khi chuyển sang local development:**

1. **Chạy API .NET Core:**

   ```bash
   cd Hotel_System/Backend/Hotel_System.API
   dotnet run --launch-profile https
   ```

2. **Kiểm tra API hoạt động:**

   - Mở browser: `https://localhost:5001/swagger`
   - Nếu không hoạt động, thử: `http://localhost:5171/swagger`
   - Hoặc kiểm tra port: `netstat -ano | findstr :5001`

3. **Cập nhật port nếu cần:**
   - Nếu API chạy trên port khác, sửa `LOCAL` trong `config.ts`

## Cách chuyển đổi giữa môi trường Development và Production

### 1. Chỉnh sửa file `config.ts`

Trong file `src/api/config.ts`, thay đổi giá trị của `IS_PRODUCTION`:

```typescript
// Cho development (dùng localhost)
IS_PRODUCTION: false,

// Cho production (dùng Railway)
IS_PRODUCTION: true,
```

### 2. Khởi động lại ứng dụng

Sau khi thay đổi, khởi động lại frontend để áp dụng cấu hình mới:

```bash
npm run dev
```

### 3. Kiểm tra API đang sử dụng

Mở Developer Tools (F12) và kiểm tra Network tab để xem các request API đang gọi đến URL nào.

## Cấu hình hiện tại

- **Local Development**: `https://localhost:5001/api` (HTTPS - thường dùng)
- **Production (Railway)**: `https://hotelsystem-net-and-reactjs-production.up.railway.app/api`

## Lưu ý quan trọng

- **Đảm bảo API .NET Core đang chạy** trên đúng port trước khi test frontend
- **Kiểm tra port**: Mở `https://localhost:5001/swagger` để xác nhận API hoạt động
- **SSL Certificate**: Chấp nhận certificate warning khi truy cập HTTPS localhost
- **Nếu port khác**: Cập nhật `LOCAL` trong `config.ts` cho đúng port API đang chạy
- Chỉ cần thay đổi `IS_PRODUCTION` trong `config.ts` - không cần sửa nhiều nơi khác
