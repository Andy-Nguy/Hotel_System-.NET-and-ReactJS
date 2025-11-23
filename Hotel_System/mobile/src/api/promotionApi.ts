import { DEFAULT_BASE_URL, buildApiUrl } from "../config/apiConfig";

const API_BASE = buildApiUrl("/api/khuyenmai");

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
  loaiGiamGia: string;
  giaTriGiam?: number;
  ngayBatDau: string;
  ngayKetThuc: string;
  trangThai?: string;
  hinhAnhBanner?: string;
  createdAt?: string;
  updatedAt?: string;
  khuyenMaiPhongs: PromotionRoom[];
}

// ============================================
// Helper Functions
// ============================================

/**
 * Normalize banner image paths to absolute URLs
 * Backend returns relative paths like '/img/promotion/xxx.jpg'
 */
function normalizeImagePath(imagePath?: string): string | null {
  if (!imagePath) return null;
  if (imagePath.startsWith("http")) return imagePath;
  return `${DEFAULT_BASE_URL}${imagePath}`;
}

// ============================================
// API Functions
// ============================================

/**
 * Get all promotions from /api/KhuyenMai endpoint
 */
export const getPromotions = async (): Promise<Promotion[]> => {
  console.log("promotionApi.getPromotions ->", API_BASE);

  try {
    const response = await fetch(API_BASE);
    console.log("promotionApi response status:", response.status);
    console.log("promotionApi response ok:", response.ok);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Failed to fetch promotions`);
    }

    const data = await response.json();
    console.log("promotionApi raw response:", JSON.stringify(data, null, 2));

    // Normalize image paths to absolute URLs
    const normalizedData = Array.isArray(data)
      ? data.map((promo: any) => ({
          ...promo,
          loaiKhuyenMai: promo.loaiKhuyenMai || promo.LoaiKhuyenMai || "room",
          hinhAnhBanner: normalizeImagePath(
            promo.hinhAnhBanner || promo.HinhAnhBanner
          ),
        }))
      : [];

    console.log(
      "promotionApi normalized data:",
      JSON.stringify(normalizedData, null, 2)
    );
    return normalizedData;
  } catch (error) {
    console.error("promotionApi.getPromotions error:", error);
    throw error;
  }
};
