// Frontend API helper for service (DichVu) management
// ĐÃ ĐƯỢC CẬP NHẬT VÀ TỐI GIẢN

// 1. Gộp Service và ServiceDetail lại làm một
export interface Service {
  iddichVu: string;
  tenDichVu: string;
  tienDichVu?: number | null;
  hinhDichVu?: string | null;
  thoiGianBatDau?: string | null; // serialized TimeSpan (e.g. "08:00:00")
  thoiGianKetThuc?: string | null;
  trangThai?: string | null; // "Đang hoạt động" or "Ngưng hoạt động"

  // Các trường gộp từ TtdichVu
  idttdichVu?: string | null;
  thongTinDv?: string | null;
  thoiLuongUocTinh?: number | null;
  ghiChu?: string | null;
}

export interface ServiceUsage {
  idhoaDon: string;
  iddichVu: string;
  tienDichVu?: number;
  thoiGianThucHien?: string; // ISO string
  thoiGianBatDau?: string | null; // ISO datetime string
  thoiGianKetThuc?: string | null;
  trangThai?: string | null;
}

const API_BASE = ""; // use relative paths so Vite proxy forwards /api to backend in dev

async function fetchApi(endpoint: string, options?: RequestInit) {
  try {
    const token = localStorage.getItem("hs_token");
    const headers: any = { ...options?.headers };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });

    // treat not-found and no-content as null (caller will handle)
    if (res.status === 404 || res.status === 204) return null;

    if (!res.ok) {
      const text = await res.text().catch(() => null);
      if (text) console.warn(`API ${endpoint} returned ${res.status}: ${text}`);
      const method = (options && (options.method as string)) ?? "GET";
      if (method.toUpperCase() !== "GET") {
        let parsed: any = text;
        try {
          parsed = JSON.parse(text ?? "");
        } catch {
          /* ignore */
        }
        throw new Error(parsed?.message ?? text ?? `API error ${res.status}`);
      }
      return null;
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) return null;
    return await res.json();
  } catch (err: any) {
    console.warn(`fetchApi: ${endpoint} failed - ${err?.message ?? err}`);
    return null;
  }
}

// 2. Cập nhật normalizeService để gộp cả trường chi tiết
function normalizeService(raw: any): Service {
  if (!raw) {
    // return a safe empty service
    return {
      iddichVu: "",
      tenDichVu: "",
      tienDichVu: null,
      hinhDichVu: null,
      thoiGianBatDau: null,
      thoiGianKetThuc: null,
      trangThai: null,
      idttdichVu: null,
      thongTinDv: null,
      thoiLuongUocTinh: null,
      ghiChu: null,
    };
  }
  let hinhDichVu = raw.hinhDichVu ?? raw.HinhDichVu ?? null;
  // If fileName is stored (without path), prepend the path
  if (
    hinhDichVu &&
    !hinhDichVu.startsWith("/") &&
    !hinhDichVu.startsWith("http")
  ) {
    hinhDichVu = `/img/services/${hinhDichVu}`;
  }
  return {
    iddichVu: raw.iddichVu ?? raw.IddichVu ?? raw.id ?? "",
    tenDichVu: raw.tenDichVu ?? raw.TenDichVu ?? "",
    tienDichVu: raw.tienDichVu ?? raw.TienDichVu ?? null,
    hinhDichVu,
    thoiGianBatDau: raw.thoiGianBatDau ?? raw.ThoiGianBatDau ?? null,
    thoiGianKetThuc: raw.thoiGianKetThuc ?? raw.ThoiGianKetThuc ?? null,
    trangThai: raw.trangThai ?? raw.TrangThai ?? null,

    // Thêm các trường đã gộp
    idttdichVu: raw.idttdichVu ?? raw.IdttdichVu ?? null,
    thongTinDv: raw.thongTinDv ?? raw.ThongTinDv ?? null,
    thoiLuongUocTinh: raw.thoiLuongUocTinh ?? raw.ThoiLuongUocTinh ?? null,
    ghiChu: raw.ghiChu ?? raw.GhiChu ?? null,
  };
}

// 3. Cập nhật các hàm với route tiếng Việt
export async function getServices(): Promise<Service[]> {
  const data = await fetchApi("/api/dich-vu/lay-danh-sach"); // <= Đã đổi
  if (!data) return [];
  const arr = Array.isArray(data) ? data : data.items ?? data.data ?? [data];
  return arr.map(normalizeService);
}

export async function getServiceById(serviceId: string): Promise<Service> {
  const data = await fetchApi(`/api/dich-vu/lay-chi-tiet/${serviceId}`); // <= Đã đổi
  if (!data) throw new Error("Service not found");
  return normalizeService(data);
}

export async function createService(
  payload: Partial<Service>
): Promise<Service> {
  const data = await fetchApi("/api/dich-vu/them-moi", {
    // <= Đã đổi
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!data)
    throw new Error("Empty response from server when creating service");
  return normalizeService(data);
}

export async function updateService(
  id: string,
  payload: Partial<Service>
): Promise<void> {
  // Ensure the payload includes the service id
  const bodyPayload = { ...payload, iddichVu: payload.iddichVu ?? id };
  await fetchApi(`/api/dich-vu/cap-nhat/${id}`, {
    // <= Đã đổi
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bodyPayload),
  });
}

export async function deleteService(id: string): Promise<void> {
  await fetchApi(`/api/dich-vu/xoa/${id}`, { method: "DELETE" }); // <= Đã đổi
}

// 4. LOẠI BỎ HOÀN TOÀN CÁC HÀM CHI TIẾT
// (createServiceDetail, updateServiceDetail, deleteServiceDetail, getServiceDetails)

// 5. Cập nhật các hàm còn lại
export async function recordServiceUsage(payload: ServiceUsage): Promise<void> {
  await fetchApi("/api/dich-vu/ghi-nhan-su-dung", {
    // <= Đã đổi
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function getServiceUsage(
  serviceId: string
): Promise<ServiceUsage[]> {
  const endpoint = `/api/dich-vu/lich-su/${serviceId}`; // <= Đã đổi
  const data = await fetchApi(endpoint);
  if (!data) return [];
  const arr = Array.isArray(data) ? data : data.items ?? data.data ?? [data];
  return arr.map((u: any) => ({
    idhoaDon: u.idhoaDon ?? u.IdhoaDon ?? u.IdHoaDon ?? u.idhoadon ?? "",
    iddichVu: u.iddichVu ?? u.IddichVu ?? serviceId,
    tienDichVu: u.tienDichVu ?? u.TienDichVu ?? null,
    thoiGianThucHien: u.thoiGianThucHien ?? u.ThoiGianThucHien ?? null,
    thoiGianBatDau: u.thoiGianBatDau ?? u.ThoiGianBatDau ?? null,
    thoiGianKetThuc: u.thoiGianKetThuc ?? u.ThoiGianKetThuc ?? null,
    trangThai: u.trangThai ?? u.TrangThai ?? null,
  }));
}

export async function getAllUsage(): Promise<ServiceUsage[]> {
  const endpoint = "/api/dich-vu/lich-su/tat-ca"; // <= Đã đổi
  const data = await fetchApi(endpoint);
  if (!data) return [];
  const arr = Array.isArray(data) ? data : data.items ?? data.data ?? [data];
  return arr.map((u: any) => ({
    idhoaDon: u.idhoaDon ?? u.IdhoaDon ?? u.IdHoaDon ?? u.idhoadon ?? "",
    iddichVu: u.iddichVu ?? u.IddichVu ?? "",
    tienDichVu: u.tienDichVu ?? u.TienDichVu ?? null,
    thoiGianThucHien: u.thoiGianThucHien ?? u.ThoiGianThucHien ?? null,
    thoiGianBatDau: u.thoiGianBatDau ?? u.ThoiGianBatDau ?? null,
    thoiGianKetThuc: u.thoiGianKetThuc ?? u.ThoiGianKetThuc ?? null,
    trangThai: u.trangThai ?? u.TrangThai ?? null,
  }));
}

export async function uploadServiceImage(
  file: File,
  serviceId?: string,
  serviceName?: string
): Promise<{ fileName: string }> {
  const fd = new FormData();
  fd.append("file", file);
  if (serviceId) fd.append("serviceId", serviceId);
  if (serviceName) fd.append("serviceName", serviceName);
  const res = await fetch(`/api/dich-vu/tai-anh-len`, {
    method: "POST",
    body: fd,
  }); // <= Đã đổi
  if (!res.ok) {
    const t = await res.text().catch(() => null);
    throw new Error(`Upload failed ${res.status}${t ? `: ${t}` : ""}`);
  }
  const data = await res.json();
  return { fileName: data.fileName ?? "" };
}

export default {
  getServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
  // Các hàm 'detail' đã bị xóa
  recordServiceUsage,
  getServiceUsage,
  getAllUsage,
  uploadServiceImage,
};
