// Lightweight invoice API helper
import { Room, RoomType } from "./roomsApi";
import { API_CONFIG } from "./config";

// Resolve API base from Vite env when available, otherwise keep empty for dev proxy
const API_BASE = `${API_CONFIG.CURRENT}/api`;

async function fetchJson(url: string, init?: RequestInit) {
  const reqUrl = `${API_BASE}${url}`;
  const res = await fetch(reqUrl, init);
  const txt = await res.text().catch(() => "");
  const data = txt ? JSON.parse(txt) : null;
  if (!res.ok)
    throw new Error(
      (data && (data.message || data.error)) || `HTTP ${res.status}`
    );
  return data;
}

export interface InvoiceRow {
  idHoaDon: string;
  idDatPhong: string;
  ngayLap?: string;
  tongTien: number;
  tienCoc?: number;
  tienThanhToan?: number;
  trangThaiThanhToan?: number;
  ghiChu?: string;
  customer?: {
    id?: number;
    hoTen?: string;
    email?: string;
    soDienThoai?: string;
    tichDiem?: number;
  };
}

export interface InvoiceDetail {
  idHoaDon: string;
  idDatPhong: string;
  ngayLap?: string;
  tongTien: number;
  tienCoc?: number;
  tienThanhToan?: number;
  trangThaiThanhToan?: number;
  ghiChu?: string;
  tienPhong?: number;
  slNgay?: number;
  customer?: {
    id?: number;
    hoTen?: string;
    email?: string;
    soDienThoai?: string;
    tichDiem?: number;
  } | null;
  roomLines?: Array<{
    IDPhong?: string;
    SoDem?: number;
    GiaPhong?: number;
    ThanhTien?: number;
  }> | null;
  services?: Array<{
    IddichVu?: string;
    TienDichVu?: number;
    ThoiGianThucHien?: string;
    TrangThai?: string;
  }> | null;
}

export async function getInvoices(params?: {
  from?: string;
  to?: string;
  status?: number;
  customer?: string;
  roomType?: string;
  staff?: string;
}) {
  const token = localStorage.getItem("hs_token");
  const headers: any = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const qs = new URLSearchParams();
  if (params?.from) qs.set("from", params.from);
  if (params?.to) qs.set("to", params.to);
  if (params?.status != null) qs.set("status", String(params.status));
  if (params?.customer) qs.set("customer", params.customer);
  if (params?.roomType) qs.set("roomType", params.roomType);
  if (params?.staff) qs.set("staff", params.staff);
  const res = await fetchJson(`/api/HoaDon/danh-sach-hoa-don?${qs.toString()}`, {
    headers,
  });
  // backend returns { data: [...] }
  return (res && res.data) || [];
}

export async function getSummary(params?: {
  from?: string;
  to?: string;
  status?: number;
  customer?: string;
  roomType?: string;
  staff?: string;
}) {
  const token = localStorage.getItem("hs_token");
  const headers: any = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const qs = new URLSearchParams();
  if (params?.from) qs.set("from", params.from);
  if (params?.to) qs.set("to", params.to);
  if (params?.status != null) qs.set("status", String(params.status));
  if (params?.customer) qs.set("customer", params.customer);
  if (params?.roomType) qs.set("roomType", params.roomType);
  if (params?.staff) qs.set("staff", params.staff);
  const res = await fetchJson(`/api/HoaDon/thong-ke?${qs.toString()}`, {
    headers,
  });
  return (res && res.data) || null;
}

export async function getInvoiceDetail(
  id: string
): Promise<{ data: InvoiceDetail } | null> {
  if (!id) return null;
  const token = localStorage.getItem("hs_token");
  const headers: any = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetchJson(`/api/HoaDon/chi-tiet/${encodeURIComponent(id)}`, {
    headers,
  });
  // The backend returns an object shaped like the InvoiceDetail directly; wrap into { data }
  return { data: res } as { data: InvoiceDetail };
}

export default { getInvoices, getSummary, getInvoiceDetail };
