// src/api/checkoutApi.ts
// Use Vite env var when provided, otherwise fall back to the backend dev URL.
// In dev this should match the backend launch URL (see Backend/Hotel_System.API/Properties/launchSettings.json).
import { API_CONFIG } from "./config";

const API_BASE = `${API_CONFIG.CURRENT}/api`;

const fetchJson = async (endpoint: string, init?: RequestInit) => {
  const token = localStorage.getItem("hs_token");
  const headers: any = { ...init?.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  const url = `${API_BASE}${endpoint}`;
  // helpful debug when requests are routed to the wrong origin (405 from Vite server)
  // open browser console Network tab to inspect the actual outgoing request
  // and adjust Vite proxy or API_BASE accordingly.
  // eslint-disable-next-line no-console
  console.debug("[api] request", init?.method ?? "GET", url);
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    // prefer explicit server message, otherwise include full response body for easier debugging
    const payload =
      data && typeof data === "object"
        ? data.message ?? JSON.stringify(data)
        : String(data ?? text ?? `HTTP ${res.status}`);
    throw new Error(payload || `HTTP ${res.status}`);
  }
  return data;
};

export const checkoutApi = {
  // 1. Lấy tóm tắt thanh toán (luôn dùng cái này)
  getSummary: (id: string | number) => fetchJson(`/Checkout/summary/${id}`),

  // 2. Tạo hóa đơn + thêm dịch vụ mới (Checkout endpoint)
  createInvoice: (payload: {
    IDDatPhong: string;
    PhuongThucThanhToan: 1 | 2 | 3;
    TrangThaiThanhToan?: number;
    GhiChu?: string;
    TongTien?: number;
    TienPhong?: number;
    SoLuongNgay?: number;
    TienCoc?: number;
    PreviousPayment?: number;
    Services?: Array<{
      IddichVu: string | number;
      SoLuong?: number;
      DonGia?: number;
      TienDichVu?: number;
    }>;
    ServicesTotal?: number;
  }) =>
    fetchJson(`/Checkout/hoa-don`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  // 3. Xác nhận đã thanh toán (tiền mặt / QR)
  confirmPaid: (
    id: string | number,
    payload?: { Amount?: number; HoaDonId?: string; Note?: string; IsOnline?: boolean; IsOverdue?: boolean }
  ) =>
    fetchJson(`/Checkout/confirm-paid/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload ?? {}),
    }),

  // 3b. Initiate an online QR payment (create or use invoice, return paymentUrl)
  payQr: (payload: {
    IDDatPhong: string | number;
    HoaDonId?: string;
    Amount?: number;
    Services?: Array<{ IddichVu: string | number; TienDichVu?: number }>;
    Note?: string;
  }) =>
    fetchJson(`/Checkout/pay-qr`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  // 4. Hoàn tất trả phòng
  completeCheckout: (id: string | number) =>
    fetchJson(`/Checkout/complete/${id}`, { method: "POST" }),

  // 5. Thêm dịch vụ vào hóa đơn của booking
  // Business rule: always finds THE ONE invoice for the booking by IDDatPhong
  addServiceToInvoice: (payload: {
    IDDatPhong: string | number;
    DichVu: Array<{
      IddichVu: string | number;
      TienDichVu?: number;
      DonGia?: number;
      TenDichVu?: string;
      TongTien?: number;
      GhiChu?: string;
    }>;
  }) =>
    fetchJson(`/Checkout/add-service-to-invoice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  // ================== GIA HẠN PHÒNG (EXTEND STAY) ==================

  // 6. Kiểm tra khả năng gia hạn
  checkExtendAvailability: (idDatPhong: string) =>
    fetchJson(`/Checkout/extend/check/${idDatPhong}`),

  // 7. Thực hiện gia hạn
  extendStay: (payload: {
    IddatPhong: string;
    ExtendType: 1 | 2; // 1 = SameDay, 2 = ExtraNight
    NewCheckoutHour?: number; // 15, 18, 24
    ExtraNights?: number;
    NewRoomId?: string;
    PaymentMethod: 1 | 2; // 1 = Tiền mặt, 2 = QR
    Note?: string;
  }) =>
    fetchJson(`/Checkout/extend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
};

export default checkoutApi;
