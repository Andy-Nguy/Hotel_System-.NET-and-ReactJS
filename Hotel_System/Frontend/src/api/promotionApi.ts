// Use VITE_API_URL when provided in production; otherwise keep relative path for dev proxy
const _VITE_API = (import.meta as any).env?.VITE_API_URL || "";
const API_BASE = _VITE_API.replace(/\/$/, "") || "";

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
  ngayBatDau: string; // DateOnly format YYYY-MM-DD
  ngayKetThuc: string; // DateOnly format YYYY-MM-DD
  trangThai?: string; // "active", "inactive", "expired"
  hinhAnhBanner?: string;
  createdAt?: string;
  updatedAt?: string;
  khuyenMaiPhongs: PromotionRoom[];
  khuyenMaiDichVus?: Array<{
    id: number;
    idkhuyenMai: string;
    iddichVu: string;
    isActive: boolean;
    ngayApDung?: string;
    ngayKetThuc?: string;
    tenDichVu?: string;
  }>;
}

export interface CreatePromotionRequest {
  tenKhuyenMai: string;
  loaiKhuyenMai?: string;
  moTa?: string;
  loaiGiamGia: string;
  giaTriGiam: number;
  ngayBatDau: string;
  ngayKetThuc: string;
  phongIds?: string[];
  dichVuIds?: string[];
  hinhAnhBanner?: string;
}

export interface UpdatePromotionRequest {
  tenKhuyenMai: string;
  loaiKhuyenMai?: string;
  moTa?: string;
  loaiGiamGia: string;
  giaTriGiam: number;
  ngayBatDau: string;
  ngayKetThuc: string;
  trangThai: string;
  phongIds?: string[];
  dichVuIds?: string[];
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
  const url = API_BASE
    ? `${API_BASE}/api/KhuyenMai${query}`
    : `/api/KhuyenMai${query}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to fetch promotions");
  return response.json();
};

// Get promotion by ID
export const getPromotionById = async (id: string): Promise<Promotion> => {
  const url = API_BASE
    ? `${API_BASE}/api/KhuyenMai/${id}`
    : `/api/KhuyenMai/${id}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to fetch promotion");
  return response.json();
};

// Create new promotion
export const createPromotion = async (
  data: CreatePromotionRequest
): Promise<Promotion> => {
  const token = localStorage.getItem("hs_token");
  const headers: any = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const url = API_BASE ? `${API_BASE}/api/KhuyenMai` : `/api/KhuyenMai`;
  const response = await fetch(url, {
    method: "POST",
    headers,
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
  const token = localStorage.getItem("hs_token");
  const headers: any = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const url = API_BASE
    ? `${API_BASE}/api/KhuyenMai/${id}`
    : `/api/KhuyenMai/${id}`;
  const response = await fetch(url, {
    method: "PUT",
    headers,
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to update promotion");
  }
  return response.json();
};

// Assign a service to a promotion (backend endpoint)
export const assignServiceToPromotion = async (
  promotionId: string,
  payload: {
    iddichVu: string;
    isActive?: boolean;
    ngayApDung?: string;
    ngayKetThuc?: string;
  }
): Promise<any> => {
  const url = API_BASE
    ? `${API_BASE}/api/KhuyenMai/${promotionId}/assign-service`
    : `/api/KhuyenMai/${promotionId}/assign-service`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to assign service to promotion");
  }
  return response.json();
};

// Toggle promotion status (active/inactive)
export const togglePromotion = async (id: string): Promise<Promotion> => {
  const token = localStorage.getItem("hs_token");
  const headers: any = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const url = API_BASE
    ? `${API_BASE}/api/KhuyenMai/${id}/toggle`
    : `/api/KhuyenMai/${id}/toggle`;
  const response = await fetch(url, {
    method: "PATCH",
    headers,
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to toggle promotion");
  }
  return response.json();
};

// Delete promotion
export const deletePromotion = async (id: string): Promise<void> => {
  const token = localStorage.getItem("hs_token");
  const headers: any = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const url = API_BASE
    ? `${API_BASE}/api/KhuyenMai/${id}`
    : `/api/KhuyenMai/${id}`;
  const response = await fetch(url, {
    method: "DELETE",
    headers,
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to delete promotion");
  }
};

// Update expired status for all promotions
export const updateExpiredStatus = async (): Promise<{
  message: string;
  count: number;
}> => {
  const token = localStorage.getItem("hs_token");
  const headers: any = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const url = API_BASE
    ? `${API_BASE}/api/KhuyenMai/update-expired-status`
    : `/api/KhuyenMai/update-expired-status`;
  const response = await fetch(url, {
    method: "POST",
    headers,
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
  const token = localStorage.getItem("hs_token");
  const headers: any = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const formData = new FormData();
  formData.append("file", file);

  const url = API_BASE
    ? `${API_BASE}/api/KhuyenMai/upload-banner`
    : `/api/KhuyenMai/upload-banner`;
  const response = await fetch(url, {
    method: "POST",
    headers,
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

// Get promotions applicable to a specific service by id.
// Strategy: fetch active promotions (server supports filters), then for each
// promotion of type 'service' request its service mappings and return those
// promotions that include the given service and have an active mapping.
export const getPromotionsForService = async (
  serviceId: string
): Promise<
  {
    promotionId: string;
    promotionName: string;
    loaiGiamGia: string;
    giaTriGiam?: number | null;
    moTa?: string | null;
    ngayBatDau?: string | null;
    ngayKetThuc?: string | null;
    hinhAnhBanner?: string | null;
    mapping?: {
      id: number;
      isActive: boolean;
      ngayApDung?: string | null;
      ngayKetThuc?: string | null;
    };
  }[]
> => {
  try {
    // Fetch only active promotions to reduce calls
    const promotions = await getAllPromotions("active");
    if (!promotions || promotions.length === 0) return [];

    const today = new Date();
    const candidates = promotions.filter(
      (p) => (p.loaiKhuyenMai || p.LoaiKhuyenMai) === "service"
    );

    const results: any[] = [];
    // For each candidate promotion, fetch mapping list
    await Promise.all(
      candidates.map(async (p) => {
        try {
          const url2 = API_BASE
            ? `${API_BASE}/api/KhuyenMai/${
                p.idkhuyenMai || p.IdkhuyenMai
              }/services`
            : `/api/KhuyenMai/${p.idkhuyenMai || p.IdkhuyenMai}/services`;
          const resp = await fetch(url2);
          if (!resp.ok) return;
          const mappingList = await resp.json();
          if (!Array.isArray(mappingList)) return;
          const found = mappingList.find(
            (m: any) =>
              (m.iddichVu ?? m.IddichVu ?? m.iddichVu) === serviceId &&
              m.isActive !== false &&
              m.IsActive !== false
          );
          if (!found) return;

          // Basic date checks (if mapping has dates)
          const startsOk =
            !found.ngayApDung || new Date(found.ngayApDung) <= today;
          const endsOk =
            !found.ngayKetThuc || new Date(found.ngayKetThuc) >= today;
          if (!startsOk || !endsOk) return;

          results.push({
            promotionId: p.idkhuyenMai || p.IdkhuyenMai,
            promotionName: p.tenKhuyenMai || p.TenKhuyenMai || p.tenKhuyenMai,
            loaiGiamGia: p.loaiGiamGia || p.LoaiGiamGia || p.loaiGiamGia,
            giaTriGiam: p.giaTriGiam ?? p.GiaTriGiam ?? null,
            moTa: p.moTa || p.MoTa || null,
            ngayBatDau: p.ngayBatDau || p.NgayBatDau || null,
            ngayKetThuc: p.ngayKetThuc || p.NgayKetThuc || null,
            hinhAnhBanner: p.hinhAnhBanner || p.HinhAnhBanner || null,
            mapping: found,
          });
        } catch (err) {
          // ignore per-promotion fetch errors
          console.warn(
            "promotionApi.getPromotionsForService: failed for",
            p,
            err
          );
        }
      })
    );

    return results;
  } catch (err) {
    console.error("getPromotionsForService error:", err);
    return [];
  }
};
