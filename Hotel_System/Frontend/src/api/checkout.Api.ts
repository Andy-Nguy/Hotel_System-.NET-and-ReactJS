// src/api/checkoutApi.ts
// Uses axiosClient for centralized API configuration (local/prod switching via config.ts)
import axiosClient from "./axiosClient";

// axiosClient đã có baseURL = API_CONFIG.CURRENT/api
// và tự động thêm Authorization header từ localStorage

export const checkoutApi = {
  // 1. Lấy tóm tắt thanh toán (luôn dùng cái này)
  getSummary: async (id: string | number) => {
    const res = await axiosClient.get(`/Checkout/summary/${id}`);
    return res.data;
  },

  // 2. Tạo hóa đơn + thêm dịch vụ mới (Checkout endpoint)
  createInvoice: async (payload: {
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
  }) => {
    const res = await axiosClient.post(`/Checkout/hoa-don`, payload);
    return res.data;
  },

  // 3. Xác nhận đã thanh toán (tiền mặt / QR)
  confirmPaid: async (
    id: string | number,
    payload?: {
      Amount?: number;
      HoaDonId?: string;
      Note?: string;
      IsOnline?: boolean;
      IsOverdue?: boolean;
    }
  ) => {
    const res = await axiosClient.post(
      `/Checkout/confirm-paid/${id}`,
      payload ?? {}
    );
    return res.data;
  },

  // 3b. Initiate an online QR payment (create or use invoice, return paymentUrl)
  payQr: async (payload: {
    IDDatPhong: string | number;
    HoaDonId?: string;
    Amount?: number;
    Services?: Array<{ IddichVu: string | number; TienDichVu?: number }>;
    Note?: string;
  }) => {
    const res = await axiosClient.post(`/Checkout/pay-qr`, payload);
    return res.data;
  },

  // 4. Hoàn tất trả phòng
  completeCheckout: async (id: string | number) => {
    const res = await axiosClient.post(`/Checkout/complete/${id}`);
    return res.data;
  },

  // 5. Thêm dịch vụ vào hóa đơn của booking
  // Business rule: always finds THE ONE invoice for the booking by IDDatPhong
  addServiceToInvoice: async (payload: {
    IDDatPhong: string | number;
    DichVu: Array<{
      IddichVu?: string | number | null;
      TienDichVu?: number;
      DonGia?: number;
      TenDichVu?: string;
      TongTien?: number;
      GhiChu?: string;
    }>;
  }) => {
    const res = await axiosClient.post(
      `/Checkout/add-service-to-invoice`,
      payload
    );
    return res.data;
  },

  // ================== GIA HẠN PHÒNG (EXTEND STAY) ==================

  // 6. Kiểm tra khả năng gia hạn
  checkExtendAvailability: async (idDatPhong: string) => {
    const res = await axiosClient.get(`/Checkout/extend/check/${idDatPhong}`);
    return res.data;
  },

  // 7. Thực hiện gia hạn
    extendStay: async (payload: {
    IddatPhong: string;
    ExtendType: 1 | 2; 
    NewCheckoutHour?: number; 
    ExtraNights?: number;
    NewRoomId?: string;
    PaymentMethod: 1 | 2 | 3;
    Note?: string;
  }) => {
    const res = await axiosClient.post(`/Checkout/extend`, payload);
    return res.data;
  },
};

export default checkoutApi;
