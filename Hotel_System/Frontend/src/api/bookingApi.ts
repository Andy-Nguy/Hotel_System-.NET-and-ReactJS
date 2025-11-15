import axios from "axios";

export interface Booking {
  iddatPhong: string;
  idkhachHang?: number;
  tenKhachHang?: string;
  emailKhachHang?: string;
  idphong: string;
  tenPhong?: string;
  soPhong?: string;
  ngayDatPhong?: string;
  ngayNhanPhong: string;
  ngayTraPhong: string;
  soDem?: number;
  tongTien: number;
  tienCoc?: number;
  trangThai: number;
  trangThaiThanhToan: number;
  chiTietDatPhongs: BookingDetail[];
}

export interface UpdateBookingRequest {
  trangThai?: number;
  trangThaiThanhToan?: number;
}

// Backend runs (launch profile `http`) on: http://0.0.0.0:8080 (accessible as http://localhost:8080)
// Use http://localhost:8080 to avoid TLS dev-certificate issues during local development.
const API_BASE_URL = "http://localhost:8080/api";

export const getBookings = async (): Promise<Booking[]> => {
  const response = await axios.get(`${API_BASE_URL}/DatPhong`);
  return response.data;
};

export const getBookingById = async (id: string): Promise<Booking> => {
  const response = await axios.get(`${API_BASE_URL}/DatPhong/${id}`);
  return response.data;
};

export const updateBooking = async (
  id: string,
  data: UpdateBookingRequest
): Promise<void> => {
  await axios.put(`${API_BASE_URL}/DatPhong/${id}`, data);
};

export const deleteBooking = async (id: string): Promise<void> => {
  await axios.delete(`${API_BASE_URL}/DatPhong/${id}`);
};
/**
 * Booking Management API
 * Handles booking operations: get details, history, reschedule, cancel, QR code
 */

const API_BASE = "/api/datphong";

// ============================================
// Type Definitions
// ============================================

export interface BookingDetail {
  idChiTiet: number;
  idPhong: string;
  tenPhongChiTiet?: string;
  soPhongChiTiet?: string;
  giaPhong: number;
  thanhTien: number;
  ghiChu?: string;
  idDatPhong: string;
  idHoaDon?: string;
  bookingCode: string;
  customer: {
    id?: number;
    hoTen?: string;
    email?: string;
    soDienThoai?: string;
  };
  ngayDatPhong?: string;
  ngayNhanPhong: string;
  ngayTraPhong: string;
  soDem: number;
  tongTien: number;
  tienCoc?: number;
  trangThai: number;
  trangThaiText: string;
  trangThaiThanhToan: number;
  trangThaiThanhToanText: string;
  rooms: Array<{
    idPhong: string;
    soPhong: string;
    tenPhong?: string;
    giaPhong: number;
    soDem: number;
    thanhTien: number;
  }>;
}

export interface BookingSummary {
  idDatPhong: string;
  idHoaDon?: string;
  bookingCode: string;
  ngayDatPhong?: string;
  ngayNhanPhong: string;
  ngayTraPhong: string;
  soDem?: number;
  soPhong: number;
  tongTien: number;
  trangThai: number;
  trangThaiText: string;
  trangThaiThanhToan: number;
  trangThaiThanhToanText: string;
}

export interface RescheduleRequest {
  ngayNhanPhong: string; // YYYY-MM-DD
  ngayTraPhong: string; // YYYY-MM-DD
}

export interface RescheduleResult {
  idDatPhong: string;
  ngayNhanPhong: string;
  ngayTraPhong: string;
  soDem: number;
  tongTien: number;
  thue: number;
  tongCong: number;
}

// (Removed QRCodeResponse & getBookingQRCode since backend endpoint deleted)

// ============================================
// Helper Functions
// ============================================

/**
 * Parse JSON response and normalize PascalCase to camelCase
 */
function handleJson(response: Response): Promise<any> {
  return response.json().then((data) => {
    if (!response.ok) {
      throw new Error(data.message || `HTTP ${response.status}`);
    }
    return data;
  });
}

/**
 * Normalize booking detail response
 */
function normalizeBookingDetail(data: any): BookingDetail {
  // Fallback to first room if exists, otherwise default
  const firstRoom = (data.rooms || data.Rooms || [])[0] || {};

  return {
    // Required fields - now included!
    idChiTiet: data.idChiTiet ?? data.IdChiTiet ?? 0,
    idPhong:
      data.idPhong ||
      data.IdPhong ||
      firstRoom.idPhong ||
      firstRoom.IdPhong ||
      "",
    giaPhong:
      data.giaPhong ||
      data.GiaPhong ||
      firstRoom.giaPhong ||
      firstRoom.GiaPhong ||
      0,
    thanhTien:
      data.thanhTien ||
      data.ThanhTien ||
      firstRoom.thanhTien ||
      firstRoom.ThanhTien ||
      0,

    // Existing fields
    idDatPhong: data.idDatPhong || data.IddatPhong || "",
    idHoaDon: data.idHoaDon || data.IdhoaDon,
    bookingCode: data.bookingCode || data.BookingCode || "",
    customer: {
      id: data.customer?.id || data.Customer?.Id,
      hoTen: data.customer?.hoTen || data.Customer?.HoTen,
      email: data.customer?.email || data.Customer?.Email,
      soDienThoai: data.customer?.soDienThoai || data.Customer?.SoDienThoai,
    },
    ngayDatPhong: data.ngayDatPhong || data.NgayDatPhong,
    ngayNhanPhong: data.ngayNhanPhong || data.NgayNhanPhong || "",
    ngayTraPhong: data.ngayTraPhong || data.NgayTraPhong || "",
    soDem: data.soDem || data.SoDem || 0,
    tongTien: data.tongTien || data.TongTien || 0,
    tienCoc: data.tienCoc || data.TienCoc,
    trangThai: data.trangThai ?? data.TrangThai ?? 0,
    trangThaiText: data.trangThaiText || data.TrangThaiText || "Không xác định",
    trangThaiThanhToan: data.trangThaiThanhToan ?? data.TrangThaiThanhToan ?? 0,
    trangThaiThanhToanText:
      data.trangThaiThanhToanText ||
      data.TrangThaiThanhToanText ||
      "Không xác định",
    ghiChu: data.ghiChu || data.GhiChu,
    rooms: (data.rooms || data.Rooms || []).map((r: any) => ({
      idPhong: r.idPhong || r.IdPhong || "",
      soPhong: r.soPhong || r.SoPhong || "",
      tenPhong: r.tenPhong || r.TenPhong,
      giaPhong: r.giaPhong || r.GiaPhong || 0,
      soDem: r.soDem || r.SoDem || 0,
      thanhTien: r.thanhTien || r.ThanhTien || 0,
    })),
  };
}

/**
 * Normalize booking summary response
 */
function normalizeBookingSummary(data: any): BookingSummary {
  return {
    idDatPhong: data.idDatPhong || data.IddatPhong || "",
    idHoaDon: data.idHoaDon || data.IdhoaDon,
    bookingCode: data.bookingCode || data.BookingCode || data.idDatPhong || "",
    ngayDatPhong: data.ngayDatPhong || data.NgayDatPhong,
    ngayNhanPhong: data.ngayNhanPhong || data.NgayNhanPhong || "",
    ngayTraPhong: data.ngayTraPhong || data.NgayTraPhong || "",
    soDem: data.soDem || data.SoDem,
    soPhong: data.soPhong || data.SoPhong || 0,
    tongTien: data.tongTien || data.TongTien || 0,
    trangThai: data.trangThai ?? data.TrangThai ?? 0,
    trangThaiText: data.trangThaiText || data.TrangThaiText || "Không xác định",
    trangThaiThanhToan: data.trangThaiThanhToan ?? data.TrangThaiThanhToan ?? 0,
    trangThaiThanhToanText:
      data.trangThaiThanhToanText ||
      data.TrangThaiThanhToanText ||
      "Không xác định",
  };
}

// ============================================
// API Functions
// ============================================

/**
 * GET /api/Booking/{bookingId}
 * Lấy chi tiết đơn đặt phòng
 */
export async function getBookingDetail(
  bookingId: string
): Promise<BookingDetail> {
  const response = await fetch(`${API_BASE}/${bookingId}`);
  const result = await handleJson(response);

  if (!result.success || !result.data) {
    throw new Error(result.message || "Failed to get booking detail");
  }

  return normalizeBookingDetail(result.data);
}

/**
 * GET /api/Booking/customer/{customerId}
 * Lấy lịch sử đặt phòng của khách hàng
 */
export async function getCustomerBookingHistory(
  customerId: number
): Promise<BookingSummary[]> {
  const response = await fetch(`${API_BASE}/customer/${customerId}`);
  const result = await handleJson(response);

  if (!result.success || !result.data) {
    throw new Error(result.message || "Failed to get booking history");
  }

  return (result.data || []).map(normalizeBookingSummary);
}

/**
 * PUT /api/Booking/{bookingId}/reschedule
 * Thay đổi thời gian đặt phòng
 * (Chỉ cho phép thay đổi trước 24h nhận phòng)
 */
export async function rescheduleBooking(
  bookingId: string,
  request: RescheduleRequest
): Promise<RescheduleResult> {
  const response = await fetch(`${API_BASE}/${bookingId}/reschedule`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  const result = await handleJson(response);

  if (!result.success || !result.data) {
    throw new Error(result.message || "Failed to reschedule booking");
  }

  return {
    idDatPhong: result.data.idDatPhong || result.data.IddatPhong,
    ngayNhanPhong: result.data.ngayNhanPhong || result.data.NgayNhanPhong,
    ngayTraPhong: result.data.ngayTraPhong || result.data.NgayTraPhong,
    soDem: result.data.soDem || result.data.SoDem,
    tongTien: result.data.tongTien || result.data.TongTien,
    thue: result.data.thue || result.data.Thue,
    tongCong: result.data.tongCong || result.data.TongCong,
  };
}

/**
 * DELETE /api/Booking/{bookingId}/cancel
 * Hủy đặt phòng
 * (Chỉ cho phép hủy trước 24h nhận phòng và chưa thanh toán)
 */
export async function cancelBooking(bookingId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/${bookingId}/cancel`, {
    method: "DELETE",
  });

  const result = await handleJson(response);

  if (!result.success) {
    throw new Error(result.message || "Failed to cancel booking");
  }
}

/**
 * GET /api/Booking/{bookingId}/qrcode
 * Tạo mã QR cho đặt phòng (dùng để check-in tại quầy)
 */
// getBookingQRCode removed (no longer supported)

/**
 * Helper: Check if booking can be rescheduled or cancelled
 * (Must be at least 24 hours before check-in and not cancelled)
 */
export function canModifyBooking(booking: BookingDetail | BookingSummary): {
  canModify: boolean;
  reason?: string;
} {
  // Check if cancelled
  if (booking.trangThai === 2) {
    return { canModify: false, reason: "Đơn đặt phòng đã bị hủy" };
  }

  // Check if already checked in (past check-in date)
  const checkInDate = new Date(booking.ngayNhanPhong);
  const now = new Date();
  const hoursDiff = (checkInDate.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursDiff < 24) {
    return {
      canModify: false,
      reason: "Chỉ có thể thay đổi/hủy trước 24 giờ nhận phòng",
    };
  }

  return { canModify: true };
}

/**
 * Helper: Check if booking can be cancelled
 * (Must be unpaid, at least 24h before check-in, and not already cancelled)
 */
export function canCancelBooking(booking: BookingDetail | BookingSummary): {
  canCancel: boolean;
  reason?: string;
} {
  // Booking status 2 means already cancelled
  if (booking.trangThai === 2) {
    return { canCancel: false, reason: "Đơn đặt phòng đã bị hủy" };
  }
  // Payment status: 1 = chưa thanh toán, 2 = đã thanh toán (the domain definition)
  if (booking.trangThaiThanhToan === 2) {
    return {
      canCancel: false,
      reason:
        "Không thể hủy đơn đã thanh toán. Vui lòng liên hệ quầy để hỗ trợ.",
    };
  }
  // Time constraint: must be >= 24h before check-in
  const checkInDate = new Date(booking.ngayNhanPhong);
  const now = new Date();
  const hoursDiff = (checkInDate.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursDiff < 24) {
    return {
      canCancel: false,
      reason: "Chỉ có thể hủy trước 24 giờ nhận phòng",
    };
  }
  return { canCancel: true };
}
