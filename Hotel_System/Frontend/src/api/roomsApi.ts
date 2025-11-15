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
  basePricePerNight?: number | null;
  discountedPrice?: number | null;
  promotionName?: string | null;
  discountPercent?: number | null;
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

  // If the API returned an informational message (e.g. { message: 'No rooms...' })
  // treat that as an empty result set so callers get a consistent array shape.
  if (data && (data.message || data.Message)) return [];

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
    // backend may serialize the id using different camel/pascal variants
    idLoaiPhong: rt.idLoaiPhong ?? rt.IdloaiPhong ?? rt.IdLoaiPhong ?? rt.idLoaiPhong ?? rt.IdLoaiPhong ?? rt.idloaiPhong,
    tenLoaiPhong: rt.tenLoaiPhong ?? rt.TenLoaiPhong ?? rt.tenLoaiPhong ?? rt.TenLoaiPhong,
    moTa: rt.moTa ?? rt.MoTa ?? rt.moTa,
    urlAnhLoaiPhong: rt.urlAnhLoaiPhong ?? rt.UrlAnhLoaiPhong ?? rt.urlAnhLoaiPhong,
  }));
  
  return normalizedTypes;
}
// THÊM CÁC HÀM CRUD CHO RoomType VÀ Room Ở ĐÂY
// === CRUD for RoomType ===
export async function createRoomType(payload: Partial<RoomType>): Promise<RoomType> {
  const res = await fetch(`/api/LoaiPhong`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to create room type: ${res.status}`);
  const data = await res.json();
  return {
    idLoaiPhong: data.idLoaiPhong ?? data.IdloaiPhong ?? String(data.id),
    tenLoaiPhong: data.tenLoaiPhong ?? data.TenLoaiPhong,
    moTa: data.moTa ?? data.MoTa,
    urlAnhLoaiPhong: data.urlAnhLoaiPhong ?? data.UrlAnhLoaiPhong,
  };
}

export async function updateRoomType(id: string, payload: Partial<RoomType>): Promise<void> {
  const res = await fetch(`/api/LoaiPhong/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to update room type: ${res.status}`);
}

export async function deleteRoomType(id: string): Promise<void> {
  const res = await fetch(`/api/LoaiPhong/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Failed to delete room type: ${res.status}`);
}

// === CRUD for Room ===
export async function createRoom(payload: Partial<Room>): Promise<Room> {
  const res = await fetch(`/api/Phong`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to create room: ${res.status}`);
  const data = await res.json();
  return {
    idphong: data.idphong ?? data.Idphong ?? String(data.id),
    idloaiPhong: data.idloaiPhong ?? data.IdloaiPhong,
    tenPhong: data.tenPhong ?? data.TenPhong,
    tenLoaiPhong: data.tenLoaiPhong ?? data.TenLoaiPhong,
    soPhong: data.soPhong ?? data.SoPhong,
    moTa: data.moTa ?? data.MoTa,
    soNguoiToiDa: data.soNguoiToiDa ?? data.SoNguoiToiDa,
    giaCoBanMotDem: data.giaCoBanMotDem ?? data.GiaCoBanMotDem,
    xepHangSao: data.xepHangSao ?? data.XepHangSao,
    trangThai: data.trangThai ?? data.TrangThai,
    urlAnhPhong: data.urlAnhPhong ?? data.UrlAnhPhong,
  };
}

export async function updateRoom(id: string, payload: Partial<Room>): Promise<void> {
  const res = await fetch(`/api/Phong/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => null);
    throw new Error(`Failed to update room: ${res.status}${text ? ` - ${text}` : ''}`);
  }
}

export async function deleteRoom(id: string): Promise<void> {
  const res = await fetch(`/api/Phong/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Failed to delete room: ${res.status}`);
}

/**
 * Lấy phòng theo loại phòng
 */
export async function getRoomsByType(loaiPhongId: string): Promise<Room[]> {
  const data = await fetchApi(`/api/Phong?loaiPhongId=${encodeURIComponent(loaiPhongId)}`);
  
  // Chuẩn hóa tương tự getRooms
  const normalizedRooms: Room[] = (data as any[]).map(r => ({
    idphong: r.idphong ?? r.Idphong,
    idloaiPhong: r.idloaiPhong ?? r.IdloaiPhong,
    tenPhong: r.tenPhong ?? r.TenPhong,
    tenLoaiPhong: r.tenLoaiPhong ?? r.TenLoaiPhong,
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
 * Kiểm tra phòng trống theo loại phòng và khoảng thời gian
 */
export async function checkRoomAvailability(loaiPhongId: string, checkin: string, checkout: string, numberOfGuests: number = 1): Promise<Room[]> {
  const data = await fetchApi(`/api/Phong/kiem-tra-trong-theo-loai-phong?loaiPhongId=${encodeURIComponent(loaiPhongId)}&checkin=${encodeURIComponent(checkin)}&checkout=${encodeURIComponent(checkout)}&numberOfGuests=${encodeURIComponent(String(numberOfGuests))}`);
  
  // Chuẩn hóa tương tự, nhưng thêm support cho AvailableRoomResponse shape
  // (API có thể trả về RoomId, RoomName, RoomNumber, BasePricePerNight, RoomImageUrl, RoomTypeName, MaxOccupancy)
  const normalizedRooms: Room[] = (data as any[]).map(r => ({
    idphong: r.idphong ?? r.Idphong ?? r.roomId ?? r.RoomId,
    idloaiPhong: r.idloaiPhong ?? r.IdloaiPhong,
    tenPhong: r.tenPhong ?? r.TenPhong ?? r.roomName ?? r.RoomName ?? r.roomNumber ?? r.RoomNumber,
    tenLoaiPhong: r.tenLoaiPhong ?? r.TenLoaiPhong ?? r.roomTypeName ?? r.RoomTypeName,
    soPhong: r.soPhong ?? r.SoPhong ?? r.roomNumber ?? r.RoomNumber,
    moTa: r.moTa ?? r.MoTa ?? r.description ?? r.Description,
    soNguoiToiDa: r.soNguoiToiDa ?? r.SoNguoiToiDa ?? r.maxOccupancy ?? r.MaxOccupancy,
    giaCoBanMotDem: r.giaCoBanMotDem ?? r.GiaCoBanMotDem ?? r.basePricePerNight ?? r.BasePricePerNight,
    xepHangSao: r.xepHangSao ?? r.XepHangSao,
    trangThai: r.trangThai ?? r.TrangThai,
    urlAnhPhong: r.urlAnhPhong ?? r.UrlAnhPhong ?? r.roomImageUrl ?? r.RoomImageUrl
  }));
  
  return normalizedRooms;
}

/**
 * Kiểm tra phòng trống với request tổng quát (từ CheckAvailableRoomsRequest)
 * Dùng API: POST /api/Phong/check-available-rooms
 */
export async function postCheckAvailableRooms(
  checkIn: string,
  checkOut: string,
  numberOfGuests: number = 1
): Promise<Room[]> {
  const url = `${API_BASE}/api/Phong/check-available-rooms`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      CheckIn: checkIn,
      CheckOut: checkOut,
      NumberOfGuests: numberOfGuests,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => null);
    throw new Error(`API error ${res.status}${text ? `: ${text}` : ""}`);
  }

  const data = await res.json();

  // If backend returns { message: "No rooms available..." }, treat as empty array
  if (data && (data.message || data.Message)) return [];

  // Chuẩn hóa dữ liệu
  const normalizedRooms: Room[] = (Array.isArray(data) ? data : [data]).map((r: any) => ({
    idphong: r.idphong ?? r.Idphong ?? r.roomId ?? r.RoomId,
    idloaiPhong: r.idloaiPhong ?? r.IdloaiPhong,
    tenPhong: r.tenPhong ?? r.TenPhong ?? r.roomName ?? r.RoomName ?? r.roomNumber ?? r.RoomNumber,
    tenLoaiPhong: r.tenLoaiPhong ?? r.TenLoaiPhong ?? r.roomTypeName ?? r.RoomTypeName,
    soPhong: r.soPhong ?? r.SoPhong ?? r.roomNumber ?? r.RoomNumber,
    moTa: r.moTa ?? r.MoTa ?? r.description ?? r.Description,
    soNguoiToiDa: r.soNguoiToiDa ?? r.SoNguoiToiDa ?? r.maxOccupancy ?? r.MaxOccupancy,
    giaCoBanMotDem: r.giaCoBanMotDem ?? r.GiaCoBanMotDem ?? r.basePricePerNight ?? r.BasePricePerNight,
    basePricePerNight: r.basePricePerNight ?? r.BasePricePerNight,
    discountedPrice: r.discountedPrice ?? r.DiscountedPrice,
    promotionName: r.promotionName ?? r.PromotionName,
    discountPercent: r.discountPercent ?? r.DiscountPercent,
    xepHangSao: r.xepHangSao ?? r.XepHangSao,
    trangThai: r.trangThai ?? r.TrangThai,
    urlAnhPhong: r.urlAnhPhong ?? r.UrlAnhPhong ?? r.roomImageUrl ?? r.RoomImageUrl,
  }));

  return normalizedRooms;
}