import { API_CONFIG, buildApiUrl } from "../config/apiConfig";

const API_BASE = `${API_CONFIG.CURRENT}/api`;

// ============================================
// Type Definitions
// ============================================

export interface PromotionRoom {
  id: number;
  idphong: string;
  tenPhong: string;
  isActive: boolean;
  ngayApDung?: string;
  ngayKetThuc?: string;
}

export interface Promotion {
  idkhuyenMai: string;
  tenKhuyenMai: string;
  loaiKhuyenMai?: string; // 'room' | 'service' | 'customer'
  moTa?: string;
  loaiGiamGia: string; // "percent" | "amount"
  giaTriGiam?: number;
  ngayBatDau: string; // YYYY-MM-DD
  ngayKetThuc: string; // YYYY-MM-DD
  trangThai?: string; // "active" | "inactive" | "expired"
  hinhAnhBanner?: string;
  createdAt?: string;
  updatedAt?: string;
  khuyenMaiPhongs?: PromotionRoom[];
  khuyenMaiDichVus?: any[];
}

// ============================================
// Helper
// ============================================

function normalizeImagePath(imagePath?: string): string | null {
  if (!imagePath) return null;
  if (imagePath.startsWith("http")) return imagePath;
  const t = String(imagePath).trim();
  // if path starts with '/', it's already a relative path from server root
  if (t.startsWith("/")) {
    try {
      return buildApiUrl(t, API_CONFIG.CURRENT);
    } catch (e) {
      return `${API_CONFIG.CURRENT}${t}`;
    }
  }

  // If it's a plain filename (e.g. 'spa_full_body_60.webp'), the backend
  // stores service images under '/img/services/<filename>' (see servicesApi)
  try {
    return buildApiUrl(`/img/services/${t}`, API_CONFIG.CURRENT);
  } catch (e) {
    return `${API_CONFIG.CURRENT}/img/services/${t}`;
  }
}

/**
 * Tính giá sau khuyến mãi
 * @param basePrice - Giá gốc
 * @param discountType - Loại giảm giá: "percent" | "amount"
 * @param discountValue - Giá trị giảm (% hoặc số tiền)
 * @returns Giá sau khuyến mãi
 */
export function calculateDiscountedPrice(
  basePrice: number,
  discountType: string,
  discountValue: number
): number {
  if (!discountValue || discountValue < 0) return basePrice;
  
  if (discountType === "percent") {
    const discountAmount = (basePrice * discountValue) / 100;
    return Math.max(0, basePrice - discountAmount);
  } else if (discountType === "amount") {
    return Math.max(0, basePrice - discountValue);
  }
  
  return basePrice;
}

// ============================================
// API Functions (aligned with frontend)
// ============================================

export const getAllPromotions = async (
  status?: string,
  discountType?: string,
  fromDate?: Date,
  toDate?: Date
): Promise<Promotion[]> => {
  const params = new URLSearchParams();
  if (status) params.append("status", status);
  if (discountType) params.append("discountType", discountType);
  if (fromDate) params.append("fromDate", fromDate.toISOString());
  if (toDate) params.append("toDate", toDate.toISOString());

  const query = params.toString() ? `?${params.toString()}` : "";
  const url = `${API_BASE}/khuyenmai${query}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch promotions (status ${resp.status})`);
  const data = await resp.json();

  if (!Array.isArray(data)) return [];

  return data.map((p: any) => ({
    ...p,
    loaiKhuyenMai: p.loaiKhuyenMai || p.LoaiKhuyenMai,
    hinhAnhBanner: normalizeImagePath(p.hinhAnhBanner || p.HinhAnhBanner),
  }));
};

export const getPromotionById = async (id: string): Promise<Promotion> => {
  const url = `${API_BASE}/khuyenmai/${id}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch promotion ${id}`);
  const p = await resp.json();
  return {
    ...p,
    loaiKhuyenMai: p.loaiKhuyenMai || p.LoaiKhuyenMai,
    hinhAnhBanner: normalizeImagePath(p.hinhAnhBanner || p.HinhAnhBanner),
  };
};

// Legacy helper used in some mobile components; keep alias for compatibility
export const getPromotions = async (): Promise<Promotion[]> => {
  return getAllPromotions();
};

// Update expired status (admin-friendly endpoint, returns {message, count})
export const updateExpiredStatus = async (): Promise<{ message: string; count: number }> => {
  const token = (global as any)?.hs_token || (typeof localStorage !== 'undefined' && localStorage.getItem('hs_token'));
  const headers: any = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const resp = await fetch(`${API_BASE}/khuyenmai/cap-nhat-trang-thai-het-han`, {
    method: 'POST',
    headers,
  });
  if (!resp.ok) {
    let msg = `HTTP ${resp.status}`;
    try { const body = await resp.json(); msg = body.message || msg; } catch {}
    throw new Error(msg);
  }
  const text = await resp.text();
  return text ? JSON.parse(text) : { message: 'Success', count: 0 };
};

// Get promotions applicable to a specific service id (helper used by frontend)
export const getPromotionsForService = async (serviceId: string) => {
  try {
    const promotions = await getAllPromotions('active');
    if (!promotions || promotions.length === 0) return [];

    const candidates = promotions.filter((p) => p.loaiKhuyenMai === 'service');
    const results: any[] = [];

    await Promise.all(
      candidates.map(async (p) => {
        try {
          const url2 = `${API_BASE}/khuyenmai/${p.idkhuyenMai}/dich-vu`;
          const r = await fetch(url2);
          if (!r.ok) return;
          const mappingList = await r.json();
          if (!Array.isArray(mappingList)) return;
          const match = mappingList.find((m: any) => String(m.iddichVu) === String(serviceId) && (m.isActive === undefined || m.isActive === true));
          if (match) {
            results.push({
              promotionId: p.idkhuyenMai,
              promotionName: p.tenKhuyenMai,
              loaiGiamGia: p.loaiGiamGia,
              giaTriGiam: p.giaTriGiam,
              moTa: p.moTa,
              ngayBatDau: p.ngayBatDau,
              ngayKetThuc: p.ngayKetThuc,
              hinhAnhBanner: p.hinhAnhBanner,
              mapping: match,
            });
          }
        } catch (err) {
          // ignore per-promotion errors
        }
      })
    );

    return results;
  } catch (err) {
    return [];
  }
};

/**
 * Get service details by service ID (including image, price, etc.)
 */
export const getServiceDetails = async (serviceId: string): Promise<any> => {
  try {
    const url = `${API_BASE}/dich-vu/lay-chi-tiet/${serviceId}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Failed to fetch service ${serviceId}`);
    const service = await resp.json();
    return {
      ...service,
      hinhDichVu: normalizeImagePath(service.hinhDichVu || service.HinhDichVu),
    };
  } catch (err) {
    console.error("getServiceDetails error:", err);
    return null;
  }
};
