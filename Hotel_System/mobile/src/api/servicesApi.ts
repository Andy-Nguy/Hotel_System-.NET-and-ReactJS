// servicesApi.ts - fetch services from backend with simple caching and URL normalization
const BASE_URLS = ["http://192.168.1.3:8080"];
const TIMEOUT_MS = 2000;

type RawService = any;

export type Service = {
  iddichVu: string;
  tenDichVu?: string;
  tienDichVu?: number;
  hinhDichVu?: string;
  thongTinDv?: string;
  thoiLuongUocTinh?: number;
  thoiGianBatDau?: string;
  thoiGianKetThuc?: string;
  ghiChu?: string;
  trangThai?: string;
};

const apiCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 30000;

function getCached(key: string) {
  const v = apiCache.get(key);
  if (v && Date.now() - v.timestamp < CACHE_DURATION) return v.data;
  return null;
}

function setCached(key: string, data: any) {
  apiCache.set(key, { data, timestamp: Date.now() });
}

function normalizeImageUrl(url: string | undefined | null, base = BASE_URLS[0]) {
  if (!url) return undefined;
  const t = String(url).trim();
  if (t.startsWith('http://') || t.startsWith('https://')) {
    console.debug('[servicesApi] normalizeImageUrl - absolute:', t);
    return t;
  }
  if (t.startsWith('/')) {
    const resolved = `${base}${t}`;
    console.debug('[servicesApi] normalizeImageUrl - leadingSlash:', t, '->', resolved);
    return resolved;
  }
  // Backend saves images to wwwroot/img/services and returns the filename
  const resolved = `${base}/img/services/${t}`;
  console.debug('[servicesApi] normalizeImageUrl - filename:', t, '->', resolved);
  return resolved;
}

async function handleRes(res: Response) {
  const txt = await res.text().catch(() => '');
  const json = txt ? JSON.parse(txt) : null;
  if (!res.ok) {
    const msg = (json && (json.error || json.message)) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

async function tryFetchServices(): Promise<Service[] | null> {
  for (const baseUrl of BASE_URLS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const res = await fetch(`${baseUrl}/api/dich-vu/lay-danh-sach`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await handleRes(res);
        if (!data || data.length === 0) continue;
        const processed = (data || []).map((d: RawService) => ({
          iddichVu: d.iddichVu ?? d.id ?? d.Id ?? String(d.iddichVu || ''),
          tenDichVu: d.tenDichVu ?? d.TenDichVu ?? d.name,
          tienDichVu: d.tienDichVu ?? d.price,
          hinhDichVu: normalizeImageUrl(d.hinhDichVu ?? d.url ?? d.image, baseUrl),
          thongTinDv: (d.thongTinDv ?? d.moTa) || d.description,
          thoiLuongUocTinh: d.thoiLuongUocTinh ?? d.duration,
          thoiGianBatDau: d.thoiGianBatDau,
          thoiGianKetThuc: d.thoiGianKetThuc,
          ghiChu: d.ghiChu,
          trangThai: d.trangThai,
        })) as Service[];
        return processed;
      }
    } catch (err) {
      continue;
    }
  }
  return null;
}

export default {
  async getServices(): Promise<Service[]> {
    const key = 'services:list';
    const cached = getCached(key);
    if (cached) return cached;
    const data = await tryFetchServices();
    if (data && data.length > 0) {
      setCached(key, data);
      return data;
    }
    throw new Error('Failed to fetch services from backend');
  },

  async getServiceById(id: string): Promise<Service> {
    for (const baseUrl of BASE_URLS) {
      try {
        const res = await fetch(`${baseUrl}/api/dich-vu/lay-chi-tiet/${id}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        const json = await handleRes(res);
        return {
          iddichVu: json.iddichVu ?? json.id ?? id,
          tenDichVu: json.tenDichVu ?? json.TenDichVu,
          tienDichVu: json.tienDichVu ?? json.price,
          hinhDichVu: normalizeImageUrl(json.hinhDichVu ?? json.url, baseUrl),
          thongTinDv: json.thongTinDv ?? json.description,
          thoiLuongUocTinh: json.thoiLuongUocTinh ?? json.duration,
          thoiGianBatDau: json.thoiGianBatDau,
          thoiGianKetThuc: json.thoiGianKetThuc,
          ghiChu: json.ghiChu,
          trangThai: json.trangThai,
        } as Service;
      } catch (err) {
        continue;
      }
    }
    throw new Error('Failed to fetch service by id');
  },
};