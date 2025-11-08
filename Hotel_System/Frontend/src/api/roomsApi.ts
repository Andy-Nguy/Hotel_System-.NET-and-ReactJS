// // Centralized rooms API helper
// // Exports a small wrapper around the /api/Phong endpoint so fetch usage
// // is in one place and easier to control / mock / extend.

// export type RawRoom = any;

// const API_BASE = ""; // keep empty so relative paths (proxy) still work

// export async function getRooms(): Promise<RawRoom[]> {
//   const url = `${API_BASE}/api/Phong`;
//   const res = await fetch(url);
//   if (!res.ok) {
//     // try to include response text for better diagnostics
//     const text = await res.text().catch(() => null);
//     throw new Error(`API error ${res.status}${text ? `: ${text}` : ""}`);
//   }

//   const data = await res.json();
//   // normalize to array when possible
//   if (Array.isArray(data)) return data;
//   // sometimes APIs wrap results: try common shapes
//   if (data && Array.isArray((data as any).items)) return (data as any).items;
//   if (data && Array.isArray((data as any).data)) return (data as any).data;

//   // fallback: if it's an object with keys, return as single-item array
//   return data ? [data] : [];
// }

// export default { getRooms };
// src/api/api.ts
// Đây là file gộp, thay thế cho roomsApi.ts, roomstypeApi.ts, và roomService.ts

// === 1. ĐỊNH NGHĨA TYPES ===

// Từ roomService.ts và PhongController.cs
export interface Room {
  idphong: string;
  idloaiPhong?: string | null;
  tenPhong?: string | null;
  soPhong?: string | null;
  moTa?: string | null;
  soNguoiToiDa?: number | null;
  giaCoBanMotDem?: number | null;
  xepHangSao?: number | null;
  trangThai?: string | null;
  urlAnhPhong?: string | null;
  // Thêm trường tenLoaiPhong từ API (đã join)
  tenLoaiPhong?: string | null;
}

// Từ LoaiPhongController.cs
export interface RoomType {
  idLoaiPhong: string;
  tenLoaiPhong?: string;
  moTa?: string;
  urlAnhLoaiPhong?: string;
}

// === 2. LOGIC GỌI API CHUNG ===

const API_BASE = ""; // Giữ trống để dùng proxy của Vite

/**
 * Hàm helper chung để gọi API và chuẩn hóa kết quả trả về
 */
async function fetchApi(endpoint: string): Promise<any[]> {
  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => null);
    throw new Error(`API error ${res.status}${text ? `: ${text}` : ""}`);
  }

  const data = await res.json();
  
  // Chuẩn hóa dữ liệu trả về (logic từ file roomsApi.ts cũ)
  if (Array.isArray(data)) return data;
  if (data && Array.isArray((data as any).items)) return (data as any).items;
  if (data && Array.isArray((data as any).data)) return (data as any).data;
  return data ? [data] : [];
}

// === 3. CÁC HÀM API CỤ THỂ ===

/**
 * Lấy tất cả phòng và chuẩn hóa dữ liệu
 */
export async function getRooms(): Promise<Room[]> {
  const data = await fetchApi("/api/Phong");
  
  // Tự động chuẩn hóa PascalCase (C#) sang camelCase (JS)
  const normalizedRooms: Room[] = (data as any[]).map(r => ({
    idphong: r.idphong ?? r.Idphong,
    idloaiPhong: r.idloaiPhong ?? r.IdloaiPhong,
    tenPhong: r.tenPhong ?? r.TenPhong,
    tenLoaiPhong: r.tenLoaiPhong ?? r.TenLoaiPhong, // Lấy từ controller
    soPhong: r.soPhong ?? r.SoPhong,
    moTa: r.moTa ?? r.MoTa,
    soNguoiToiDa: r.soNguoiToiDa ?? r.SoNguoiToiDa,
    giaCoBanMotDem: r.giaCoBanMotDem ?? r.GiaCoBanMotDem,
    xepHangSao: r.xepHangSao ?? r.XepHangSao,
    trangThai: r.trangThai ?? r.TrangThai,
    urlAnhPhong: r.urlAnhPhong ?? r.UrlAnhPhong
  }));
  
  return normalizedRooms;
}

/**
 * Lấy tất cả loại phòng và chuẩn hóa dữ liệu
 */
export async function getRoomTypes(): Promise<RoomType[]> {
  const data = await fetchApi("/api/LoaiPhong");
  
  // Tự động chuẩn hóa
  const normalizedTypes: RoomType[] = (data as any[]).map(rt => ({
    idLoaiPhong: rt.idLoaiPhong ?? rt.IdLoaiPhong,
    tenLoaiPhong: rt.tenLoaiPhong ?? rt.TenLoaiPhong,
    moTa: rt.moTa ?? rt.MoTa,
    urlAnhLoaiPhong: rt.urlAnhLoaiPhong ?? rt.UrlAnhLoaiPhong,
  }));
  
  return normalizedTypes;
}

// === 4. EXPORT MẶC ĐỊNH ===

export default {
  getRooms,
  getRoomTypes
};