// Frontend API helper cho Khuyến mãi & Tích điểm
// Bao gồm: danh sách khuyến mãi, áp dụng mã, điểm khách hàng, đổi điểm, auto-apply, notification polling

const API_BASE = ""; // dùng proxy Vite

// === Types ánh xạ từ backend DTOs ===
export type PromotionResponse = {
  idKhuyenMai: string;
  tenKhuyenMai: string;
  moTa?: string | null;
  loaiGiamGia: "percent" | "fixed" | string;
  giaTriGiam: number; // percent hoặc số tiền
  ngayBatDau: string; // ISO date
  ngayKetThuc: string; // ISO date
  trangThai: "active" | "expired" | "upcoming" | string;
  danhSachPhongApDung: string[];
  isApplicable: boolean;
};

export type ApplyPromotionRequest = {
  maKhuyenMai: string;
  idHoaDon: number; // backend dùng int
  danhSachPhong: string[]; // danh sách id phòng trong booking
};

export type ApplyPromotionResponse = {
  success: boolean;
  message: string;
  tongTienGoc: number;
  soTienGiam: number;
  tongTienSauGiam: number;
  maKhuyenMaiApDung?: string | null;
};

export type LoyaltyPointsResponse = {
  idKhachHang: number;
  hoTen: string;
  diemHienTai: number;
  diemCoTheDoi: number;
  voucherKhaDung: VoucherExchangeOption[];
};

export type VoucherExchangeOption = {
  tenVoucher: string;
  moTa: string;
  diemCanThiet: number;
  giaTriVoucher: number;
  loaiGiamGia: string; // percent/fixed
};

export type ExchangePointsRequest = {
  idKhachHang: number;
  soDiemDoi: number; // backend yêu cầu nhưng thực tế lấy từ bảng; vẫn gửi
  loaiVoucher: string; // 10k,20k,50k,100k,5percent,10percent
};

export type ExchangePointsResponse = {
  success: boolean;
  message: string;
  diemConLai: number;
  maVoucher: string;
  giaTriVoucher: number;
  ngayHetHan: string; // ISO date
};

// === Helper chung ===
async function handleJson<T>(res: Response): Promise<T> {
  const text = await res.text().catch(() => "");
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = data?.message || data?.error || `HTTP ${res.status}`;
    throw new Error(err);
  }
  return data as T;
}

function normalizePromotion(raw: any): PromotionResponse {
  return {
    idKhuyenMai: raw.idKhuyenMai ?? raw.IdKhuyenMai ?? raw.idkhuyenMai ?? raw.idkhuyenmai ?? "",
    tenKhuyenMai: raw.tenKhuyenMai ?? raw.TenKhuyenMai ?? "",
    moTa: raw.moTa ?? raw.MoTa ?? null,
    loaiGiamGia: raw.loaiGiamGia ?? raw.LoaiGiamGia ?? "fixed",
    giaTriGiam: Number(raw.giaTriGiam ?? raw.GiaTriGiam ?? 0),
    ngayBatDau: raw.ngayBatDau ?? raw.NgayBatDau ?? "",
    ngayKetThuc: raw.ngayKetThuc ?? raw.NgayKetThuc ?? "",
    trangThai: raw.trangThai ?? raw.TrangThai ?? "active",
    danhSachPhongApDung: raw.danhSachPhongApDung ?? raw.DanhSachPhongApDung ?? [],
    isApplicable: raw.isApplicable ?? raw.IsApplicable ?? false,
  };
}

// === 1. Danh sách khuyến mãi ===
export async function getAllPromotions(roomIds?: string[]): Promise<PromotionResponse[]> {
  const query = roomIds && roomIds.length ? `?${roomIds.map(r => `roomIds=${encodeURIComponent(r)}`).join("&")}` : "";
  const res = await fetch(`${API_BASE}/api/Promotion/all${query}`);
  const data = await handleJson<any[]>(res);
  return data.map(normalizePromotion);
}

export async function getPromotionsByRoom(roomId: string): Promise<PromotionResponse[]> {
  const res = await fetch(`${API_BASE}/api/Promotion/room/${encodeURIComponent(roomId)}`);
  const data = await handleJson<any[]>(res);
  return data.map(normalizePromotion);
}

export async function getActivePromotions(): Promise<PromotionResponse[]> {
  const res = await fetch(`${API_BASE}/api/Promotion/active`);
  const data = await handleJson<any[]>(res);
  return data.map(normalizePromotion);
}

// === 2. Áp dụng khuyến mãi ===
export async function applyPromotion(req: ApplyPromotionRequest): Promise<ApplyPromotionResponse> {
  const res = await fetch(`${API_BASE}/api/Promotion/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      MaKhuyenMai: req.maKhuyenMai,
      IdHoaDon: req.idHoaDon,
      DanhSachPhong: req.danhSachPhong,
    }),
  });
  return handleJson<ApplyPromotionResponse>(res);
}

// Helper tự động chọn mã tốt nhất từ danh sách active + applicable với các phòng booking
export async function autoApplyBestPromotion(idHoaDon: number, roomIds: string[], tongTienGoc: number): Promise<ApplyPromotionResponse | null> {
  // lấy tất cả khuyến mãi active có áp dụng được
  const promos = await getAllPromotions(roomIds);
  const applicable = promos.filter(p => p.isApplicable && p.trangThai === "active");
  if (!applicable.length) return null;
  // tính số tiền giảm giả định (không gọi server nhiều lần)
  const scored = applicable.map(p => {
    let giam = 0;
    if (p.loaiGiamGia === "percent") giam = tongTienGoc * p.giaTriGiam / 100;
    else giam = p.giaTriGiam;
    if (giam > tongTienGoc) giam = tongTienGoc;
    return { promo: p, giam };
  });
  scored.sort((a, b) => b.giam - a.giam);
  const best = scored[0];
  // gọi API apply thật để cập nhật hóa đơn
  try {
    const applied = await applyPromotion({ maKhuyenMai: best.promo.idKhuyenMai, idHoaDon, danhSachPhong: roomIds });
    return applied;
  } catch (e) {
    console.warn("autoApplyBestPromotion failed", e);
    return null;
  }
}

// === 3. Điểm tích lũy ===
export async function getLoyaltyPoints(customerId: number): Promise<LoyaltyPointsResponse | null> {
  const res = await fetch(`${API_BASE}/api/Promotion/points/${customerId}`);
  if (res.status === 404) return null;
  return handleJson<LoyaltyPointsResponse>(res);
}

export async function addPoints(idKhachHang: number, tongTien: number): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/api/Promotion/add-points`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ IdKhachHang: idKhachHang, TongTien: tongTien }),
  });
  return handleJson(res);
}

// === 4. Đổi điểm lấy voucher ===
export async function exchangePoints(req: ExchangePointsRequest): Promise<ExchangePointsResponse> {
  const res = await fetch(`${API_BASE}/api/Promotion/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      IdKhachHang: req.idKhachHang,
      SoDiemDoi: req.soDiemDoi,
      LoaiVoucher: req.loaiVoucher,
    }),
  });
  return handleJson<ExchangePointsResponse>(res);
}

// === 5. Poll thông báo ưu đãi đặc biệt ===
// Chưa có endpoint riêng trong backend: ở đây giả lập bằng cách lọc promo upcoming gần nhất.
// Có thể nâng cấp khi backend bổ sung API /api/Promotion/notifications.
export async function pollSpecialOffers(intervalMs: number, onOffer: (p: PromotionResponse) => void, abortSignal?: AbortSignal) {
  const loop = async () => {
    while (!abortSignal?.aborted) {
      try {
        const promos = await getActivePromotions();
        // gợi ý: lấy các khuyến mãi phần trăm > 20% hoặc fixed >= 50000
        const hot = promos.filter(p => (p.loaiGiamGia === "percent" && p.giaTriGiam >= 20) || (p.loaiGiamGia === "fixed" && p.giaTriGiam >= 50000));
        hot.forEach(onOffer);
      } catch (e) {
        // ignore lỗi mạng để tiếp tục poll
      }
      await new Promise(r => setTimeout(r, intervalMs));
    }
  };
  loop();
}

export default {
  getAllPromotions,
  getPromotionsByRoom,
  getActivePromotions,
  applyPromotion,
  autoApplyBestPromotion,
  getLoyaltyPoints,
  addPoints,
  exchangePoints,
  pollSpecialOffers,
};
