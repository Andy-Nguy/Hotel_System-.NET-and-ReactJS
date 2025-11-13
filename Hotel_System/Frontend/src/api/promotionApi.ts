const API_BASE = "/api/KhuyenMai";

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
  moTa?: string;
  loaiGiamGia: string; // "percent" | "amount"
  giaTriGiam?: number;
  ngayBatDau: string; // DateOnly format YYYY-MM-DD
  ngayKetThuc: string; // DateOnly format YYYY-MM-DD
  trangThai?: string; // "active", "inactive", "expired"
  hinhAnhBanner?: string;
  createdAt?: string;
  updatedAt?: string;
  khuyenMaiPhongs: PromotionRoom[];
}

export interface CreatePromotionRequest {
  tenKhuyenMai: string;
  moTa?: string;
  loaiGiamGia: string;
  giaTriGiam: number;
  ngayBatDau: string;
  ngayKetThuc: string;
  phongIds: string[];
  hinhAnhBanner?: string;
}

export interface UpdatePromotionRequest {
  tenKhuyenMai: string;
  moTa?: string;
  loaiGiamGia: string;
  giaTriGiam: number;
  ngayBatDau: string;
  ngayKetThuc: string;
  trangThai: string;
  phongIds: string[];
  hinhAnhBanner?: string;
}

// Get all promotions with filters
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
  const response = await fetch(`${API_BASE}${query}`);
  if (!response.ok) throw new Error("Failed to fetch promotions");
  return response.json();
};

// Get promotion by ID
export const getPromotionById = async (id: string): Promise<Promotion> => {
  const response = await fetch(`${API_BASE}/${id}`);
  if (!response.ok) throw new Error("Failed to fetch promotion");
  return response.json();
};

// Create new promotion
export const createPromotion = async (
  data: CreatePromotionRequest
): Promise<Promotion> => {
  const response = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to create promotion");
  }
  return response.json();
};

// Update promotion
export const updatePromotion = async (
  id: string,
  data: UpdatePromotionRequest
): Promise<Promotion> => {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to update promotion");
  }
  return response.json();
};

// Toggle promotion status (active/inactive)
export const togglePromotion = async (id: string): Promise<Promotion> => {
  const response = await fetch(`${API_BASE}/${id}/toggle`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to toggle promotion");
  }
  return response.json();
};

// Delete promotion
export const deletePromotion = async (id: string): Promise<void> => {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to delete promotion");
  }
};

// Update expired status for all promotions
export const updateExpiredStatus = async (): Promise<{ message: string; count: number }> => {
  const response = await fetch(`${API_BASE}/update-expired-status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to update expired status");
  }
  return response.json();
};

export interface UploadResult {
  fileName: string;
  relativePath: string;
  fullPath: string;
  size: number;
  contentType: string;
}

// Response shape when applying promotions to an invoice amount
export interface ApplyPromotionResponse {
  tongTienSauGiam: number; // total after discount, before tax
  discountAmount: number; // amount discounted from base
  // legacy alias used by some UI components
  soTienGiam?: number;
  appliedPromotionId?: string | null;
  appliedPromotionName?: string | null;
  pointsEstimated?: number; // estimated loyalty points earned for this order
}

// Upload banner image
export const uploadBanner = async (file: File): Promise<UploadResult> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/upload-banner`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to upload banner");
  }

  // Backend returns { FileName, RelativePath, FullPath, Size, ContentType }
  const data = await response.json();
  return {
    fileName: data.fileName || data.FileName,
    relativePath: data.relativePath || data.RelativePath,
    fullPath: data.fullPath || data.FullPath,
    size: data.size || data.Size,
    contentType: data.contentType || data.ContentType,
  } as UploadResult;
};
