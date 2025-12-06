import axiosClient from './axiosClient';

const BASE_PATH = '/Dashboard/reports/mv';
const SNAPSHOT_BASE = '/Dashboard/reports/snapshot';
const SYNC_PATH = '/Dashboard/reports/sync';

export interface DailyRevenueData {
  date: string;
  revenue: number;
}

export interface MonthlyRevenueData {
  month: string;
  revenue: number;
}

export interface AdrData {
  date: string;
  adr: number;
}

/**
 * Fetch daily revenue from materialized view
 */
export const getDailyRevenue = async (days: number = 30): Promise<DailyRevenueData[]> => {
  const res = await axiosClient.get(`${BASE_PATH}/daily?days=${days}`);
  // backend returns { data: [...] }
  return (res?.data?.data as DailyRevenueData[]) || [];
};

/**
 * Fetch monthly revenue from materialized view
 */
export const getMonthlyRevenue = async (months: number = 12): Promise<MonthlyRevenueData[]> => {
  const res = await axiosClient.get(`${BASE_PATH}/monthly?months=${months}`);
  return (res?.data?.data as MonthlyRevenueData[]) || [];
};

/**
 * Fetch ADR (Average Daily Rate) from materialized view
 */
export const getAdr = async (days: number = 30): Promise<AdrData[]> => {
  const res = await axiosClient.get(`${BASE_PATH}/adr?days=${days}`);
  return (res?.data?.data as AdrData[]) || [];
};

// Snapshot-based endpoints (persistent table `ThongKeDoanhThuKhachSan`)
export const getDailyRevenueSnapshot = async (days: number = 30): Promise<DailyRevenueData[]> => {
  const res = await axiosClient.get(`${SNAPSHOT_BASE}/daily?days=${days}`);
  return (res?.data?.data as DailyRevenueData[]) || [];
};

export const getMonthlyRevenueSnapshot = async (months: number = 12): Promise<MonthlyRevenueData[]> => {
  const res = await axiosClient.get(`${SNAPSHOT_BASE}/monthly?months=${months}`);
  return (res?.data?.data as MonthlyRevenueData[]) || [];
};

export const getAdrSnapshot = async (days: number = 30): Promise<AdrData[]> => {
  const res = await axiosClient.get(`${SNAPSHOT_BASE}/adr?days=${days}`);
  return (res?.data?.data as AdrData[]) || [];
};

/**
 * Trigger server-side sync: refresh materialized view and upsert into persistent snapshot table
 */
export const syncSnapshot = async (): Promise<{ ok?: boolean; message?: string }> => {
  const res = await axiosClient.post(SYNC_PATH);
  return res?.data || { ok: true };
};

export interface SnapshotDetailRow {
  id: number;
  idHoaDon?: string | null;
  idDatPhong?: string | null;
  ngay?: string | null;
  tongPhong?: number;
  soDem?: number;
  tienPhong?: number;
  tienDichVu?: number;
  tienGiamGia?: number;
  doanhThu?: number;
}

export const getSnapshotDetails = async (from?: string, to?: string): Promise<SnapshotDetailRow[]> => {
  let url = '/Dashboard/reports/snapshot/details';
  const q: string[] = [];
  if (from) q.push(`from=${encodeURIComponent(from)}`);
  if (to) q.push(`to=${encodeURIComponent(to)}`);
  if (q.length) url += `?${q.join('&')}`;
  const res = await axiosClient.get(url);
  return (res?.data?.data as SnapshotDetailRow[]) || [];
};

export interface CustomerOriginData {
  origin: string;
  count: number;
}

export const getCustomerOrigin = async (): Promise<CustomerOriginData[]> => {
  const res = await axiosClient.get('/Dashboard/customer-origin');
  return (res?.data?.data as CustomerOriginData[]) || [];
};
