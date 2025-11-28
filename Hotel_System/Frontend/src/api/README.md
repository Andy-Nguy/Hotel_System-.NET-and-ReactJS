# API Configuration Guide

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

- **Local Development**: `http://localhost:5000/api`
- **Production (Railway)**: `https://hotelsystem-net-and-reactjs-production.up.railway.app/api`

## Lưu ý

- Đảm bảo API .NET Core đang chạy trên `localhost:5000` khi phát triển
- Chỉ cần thay đổi `IS_PRODUCTION` trong `config.ts` - không cần sửa nhiều nơi khác
