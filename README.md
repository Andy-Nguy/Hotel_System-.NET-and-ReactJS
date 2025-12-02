# Hotel System Project

## 📖 Giới thiệu (Introduction)
Dự án **Hotel System** là một hệ thống quản lý khách sạn toàn diện, bao gồm:
- **Backend API:** Xây dựng bằng .NET Core, cung cấp các dịch vụ quản lý phòng, đặt phòng, khách hàng, và nhân viên.
- **Frontend Web:** Ứng dụng React (Vite) dành cho Admin quản lý và Khách hàng đặt phòng.
- **Mobile App:** Ứng dụng React Native (Expo) dành cho khách hàng trên thiết bị di động.
- **Database:** Sử dụng PostgreSQL để lưu trữ dữ liệu.

## 🛠 Technology Stack
- **Backend:** .NET 8, Entity Framework Core
- **Frontend:** ReactJS, Vite, TailwindCSS (dự đoán), Ant Design (dự đoán)
- **Mobile:** React Native, Expo
- **Database:** PostgreSQL,SQL Server

---

## 🗄️ Database Setup

> [!NOTE]
> **Lưu ý về Database:** Ban đầu dự án được phát triển sử dụng **SQL Server**. Tuy nhiên, để tối ưu cho việc deploy (chi phí, hiệu năng trên môi trường Linux/Container), dự án đã chuyển đổi hoàn toàn sang **PostgreSQL**. Vui lòng sử dụng PostgreSQL để đảm bảo tương thích tốt nhất.

### 1. Chuẩn bị
- Cài đặt **PostgreSQL** (pgAdmin hoặc Docker).
- Tạo một database mới (ví dụ: `HotelSystem`).

### 2. Chạy Script
Vui lòng chọn đúng file script tương ứng với hệ quản trị cơ sở dữ liệu bạn đang sử dụng:

#### 🟢 PostgreSQL (Khuyên dùng cho Deploy)
1. **Schema:** Chạy file `db/postgresSchema.sql` để tạo bảng và cấu trúc.
2. **Seed Data:** Chạy file `db/DataForPostgres.sql` để thêm dữ liệu mẫu.

#### 🔵 SQL Server (Legacy / Local Dev)
1. **Schema:** Chạy file `db/schema.sql`.
2. **Seed Data:** Chạy file `db/DataTest.sql`.

### 3. Cấu hình Connection String
Mở file `Hotel_System/Backend/Hotel_System.API/appsettings.json` và cập nhật `ConnectionStrings:DefaultConnection`.

**Mẫu cho PostgreSQL:**
```json
"ConnectionStrings": {
  "DefaultConnection": "Host=localhost;Port=5432;Database=HotelSystem;Username=postgres;Password=your_password"
}
```

**Mẫu cho SQL Server:**
```json
"ConnectionStrings": {
  "DefaultConnection": "Server=localhost;Database=HotelSystem;User Id=sa;Password=your_password;TrustServerCertificate=True"
}
```

---

## 💻 Hướng dẫn chạy Local (.local)

### 1. Backend (.NET API)
Yêu cầu: .NET 8 SDK.

```bash
cd Hotel_System/Backend/Hotel_System.API
dotnet restore
dotnet run --launch-profile http
```
- API sẽ chạy tại: `https://localhost:5001` (và `http://localhost:8080`).
- Swagger UI: `https://localhost:5001/swagger`
- **Lưu ý:** Frontend được cấu hình để proxy API request tới `https://localhost:5001`.

### 2. Frontend (Web)
Yêu cầu: Node.js (v18+ khuyến nghị).

```bash
cd Hotel_System/Frontend
npm install
npm run dev
```
- Web sẽ chạy tại: `http://localhost:5173`

#### ⚙️ Cấu hình API Endpoint
Để chuyển đổi giữa môi trường **Local** và **Production** (Railway), hãy chỉnh sửa file:
`Hotel_System/Frontend/src/api/config.ts`

```typescript
export const API_CONFIG = {
  LOCAL: "https://localhost:5001",
  RAILWAY: "https://hotelsystem-net-and-reactjs-production.up.railway.app",

  // Đổi thành false để chạy Local, true để chạy Production
  IS_PRODUCTION: false, 
  
  // ...
};
```
- **Local:** Set `IS_PRODUCTION: false` -> API trỏ về `https://localhost:5001`.
- **Production:** Set `IS_PRODUCTION: true` -> API trỏ về Railway URL.

### 3. Mobile App
Yêu cầu: Node.js, thiết bị di động cài Expo Go hoặc máy ảo (Android Emulator/iOS Simulator).

```bash
cd Hotel_System/mobile
npm install
npx expo start
```
- Quét mã QR bằng ứng dụng Expo Go trên điện thoại hoặc nhấn `a` để mở Android Emulator.

---

## 🚀 Hướng dẫn Deploy Production (prod)

### 1. Database
- Sử dụng các dịch vụ PostgreSQL managed như **Railway**, **Supabase**, **AWS RDS**, hoặc **Render**.
- Chạy các script SQL tương tự như phần setup local để khởi tạo database.
- Lấy Connection String của database online.

### 2. Backend
- **Docker:** Dự án đã có sẵn `Dockerfile` tại `Hotel_System/Backend/Hotel_System.API/Dockerfile`.
- **Build & Deploy:**
  - Có thể deploy lên **Railway**, **Render**, **Azure App Service**, hoặc **Docker Hub**.
  - **Quan trọng:** Cấu hình biến môi trường (Environment Variables) trên server cho Connection String để bảo mật, không hardcode trong `appsettings.json`.
  - Ví dụ biến môi trường: `ConnectionStrings__DefaultConnection`.

### 3. Frontend
- **Option 1: Self-host (Serve by Backend - Recommended)**
  - Frontend đã được cấu hình (`vite.config.js`) để build output vào thư mục `wwwroot` của Backend.
  - Tại thư mục `Hotel_System/Frontend`, chạy:
    ```bash
    npm run build
    ```
  - Sau đó, khi deploy Backend, nó sẽ tự động phục vụ các file static của Frontend.

- **Option 2: Standalone (Vercel/Netlify)**
  - Nếu muốn deploy riêng Frontend:
    - Sửa `vite.config.js` để bỏ `outDir: "../Backend..."` hoặc copy folder `dist` sau khi build.
    - Deploy folder `dist` lên Vercel/Netlify.
    - Cấu hình biến môi trường hoặc proxy để trỏ về Backend URL.

### 4. Mobile
- Sử dụng **EAS Build** của Expo để build file `.apk` (Android) hoặc `.ipa` (iOS).
```bash
npm install -g eas-cli
eas build -p android --profile preview
```
