import axiosClient from "./axiosClient";

// axiosClient đã có baseURL = /api hoặc VITE_API_URL/api
// nên chỉ cần dùng đường dẫn tương đối

// Minimal type for the check-in / using booking list returned by CheckInController
export interface UsingBooking {
  iddatPhong: string;
  tenKhachHang?: string;
  emailKhachHang?: string;
  idphong?: string;
  tenPhong?: string;
  soPhong?: string;
  ngayNhanPhong?: string;
  ngayTraPhong?: string;
  soDem?: number;
  tongTien?: number;
  tienCoc?: number;
  tienThanhToan?: number; // Amount prepaid (kept separate from tongTien)
  trangThai?: number;
  trangThaiThanhToan?: number;
}

/**
 * Helper: Calculate remaining balance for a booking
 * SoTienConLai = TongTien - TienThanhToan
 */
export const calculateRemainingBalance = (booking: UsingBooking): number => {
  const tongTien = booking.tongTien ?? 0;
  const tienThanhToan = booking.tienThanhToan ?? 0;
  return Math.max(0, tongTien - tienThanhToan);
};

/**
 * GET /api/CheckIn
 * Return bookings that are currently 'Đang sử dụng' (TrangThai == 3)
 */
export const getUsingBookings = async (): Promise<UsingBooking[]> => {
  const res = await axiosClient.get(`/CheckIn`);
  return res.data;
};

/**
 * GET /api/CheckIn/today
 * Return bookings that have NgayNhanPhong == today and are not cancelled/completed
 */
export const getTodayBookings = async (): Promise<UsingBooking[]> => {
  const res = await axiosClient.get(`/CheckIn/today`);
  return res.data;
};

/**
 * GET /api/CheckIn/{id}
 * Return detailed booking (including services/invoices)
 */
export const getCheckinById = async (id: string): Promise<any> => {
  const res = await axiosClient.get(`/CheckIn/${id}`);
  return res.data;
};

/**
 * PUT or POST /api/CheckIn/confirm/{id}
 * Confirm a booking as 'Đang sử dụng' (TrangThai = 3).
 */
export const confirmCheckIn = async (id: string): Promise<any> => {
  // Backend exposes POST for confirm; return server response (may include emailSent flag)
  const res = await axiosClient.post(`/CheckIn/confirm/${id}`, {});
  return res.data;
};

/**
 * POST /api/CheckIn/cancel/{id}
 * Cancel a booking (no-show) and free the room
 */
export const cancelCheckIn = async (id: string): Promise<void> => {
  // Use PUT by default; server accepts PUT or POST
  await axiosClient.put(`/CheckIn/cancel/${id}`, {});
};

/** POST /api/CheckIn/complete-payment/{id} - mark booking as paid but keep status as 'Đang sử dụng' */
export const completePayment = async (id: string): Promise<any> => {
  const res = await axiosClient.post(`/CheckIn/complete-payment/${id}`, {});
  return res.data;
};


/**
 * POST /api/NhanPhong/reassign-room/{id}
 * Body: { newRoomId }
 */
export const reassignRoom = async (id: string, newRoomId: string): Promise<any> => {
  // Use axiosClient (baseURL + auth handled centrally)
  const res = await axiosClient.post(`/CheckIn/reassign-room/${encodeURIComponent(id)}`, { NewRoomId: newRoomId });
  return res.data;
};

// (default export will be declared at EOF to include booking helpers as well)

// --- Booking management helpers (mirror some BookingApi endpoints)
// These are provided so UI code can use `checkinApi` for booking operations
// without importing the separate bookingApi module.

/** GET /api/DatPhong - list all bookings */
export const getBookings = async (): Promise<any[]> => {
  const res = await axiosClient.get(`/DatPhong`);
  return res.data;
};

/** GET /api/DatPhong/{id} - get booking detail (alias) */
export const getBookingById = async (id: string): Promise<any> => {
  const res = await axiosClient.get(`/DatPhong/${id}`);
  return res.data;
};

/** PUT /api/DatPhong/{id} - update booking fields (trangThai, trangThaiThanhToan, etc.) */
export const updateBooking = async (id: string, data: any): Promise<void> => {
  await axiosClient.put(`/DatPhong/${id}`, data);
};

/** DELETE /api/DatPhong/{id} - remove a booking */
export const deleteBooking = async (id: string): Promise<void> => {
  await axiosClient.delete(`/DatPhong/${id}`);
};

/** Helper: update payment status */
export const updatePaymentStatus = async (
  id: string,
  status: number
): Promise<void> => {
  await updateBooking(id, { trangThaiThanhToan: status });
};

/** PUT /api/DatPhong/{id}/reschedule - change dates */
export const rescheduleBooking = async (
  id: string,
  body: { ngayNhanPhong: string; ngayTraPhong: string }
): Promise<any> => {
  const res = await axiosClient.put(`/DatPhong/${id}/reschedule`, body);
  return res.data;
};

// Single default export containing all helpers
const _default = {
  getUsingBookings,
  getTodayBookings,
  getCheckinById,
  confirmCheckIn,
  cancelCheckIn,

  // booking helpers
  getBookings,
  getBookingById,
  updateBooking,
  deleteBooking,
  updatePaymentStatus,
  rescheduleBooking,
  completePayment,
  reassignRoom
};

export default _default;
