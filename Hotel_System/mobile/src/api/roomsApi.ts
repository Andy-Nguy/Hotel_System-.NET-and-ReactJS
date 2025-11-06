import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE_URL = "http://10.0.2.2:5000";

export type Room = {
  idphong: string;
  tenPhong?: string;
  soPhong?: string;
  moTa?: string;
  soNguoiToiDa?: number;
  giaCoBanMotDem?: number;
  xepHangSao?: number;
  urlAnhPhong?: string;
  [key: string]: any;
};

async function handleRes(res: Response) {
  const text = await res.text().catch(() => "");
  const content = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err =
      (content && (content.error || content.message)) || `HTTP ${res.status}`;
    throw new Error(err);
  }
  return content;
}

export async function getRooms(): Promise<Room[]> {
  const res = await fetch(`${BASE_URL}/api/Phong`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  const data = await handleRes(res);

  // Normalize properties (API may return different casing)
  return (data || []).map((r: any) => ({
    idphong: r.idphong ?? r.idPhong ?? r.Idphong ?? r.IdPhong,
    tenPhong: r.tenPhong ?? r.TenPhong,
    soPhong: r.soPhong ?? r.SoPhong,
    moTa: r.moTa ?? r.MoTa,
    soNguoiToiDa: r.soNguoiToiDa ?? r.SoNguoiToiDa,
    giaCoBanMotDem: r.giaCoBanMotDem ?? r.GiaCoBanMotDem,
    xepHangSao: r.xepHangSao ?? r.XepHangSao ?? 0,
    urlAnhPhong: r.urlAnhPhong ?? r.UrlAnhPhong,
    ...r,
  }));
}

export async function getRoomById(id: string): Promise<Room> {
  const res = await fetch(`${BASE_URL}/api/Phong/${id}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  return handleRes(res);
}

export default { getRooms, getRoomById };
