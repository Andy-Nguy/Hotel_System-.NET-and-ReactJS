export interface Room {
  idphong: string;
  idloaiPhong?: string | null;
  tenPhong?: string | null;
  soPhong?: string | null;
  moTa?: string | null;
  soNguoiToiDa?: number | null;
  giaCoBanMotDem?: number | null;
  xepHangSao?: number | null;
  trangThai?: string | null;
  urlAnhPhong?: string | null;
}

export async function getRooms(): Promise<Room[]> {
  const res = await fetch('/api/Phong');
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to fetch rooms: ${res.status} ${res.statusText} ${text}`);
  }
  const data = await res.json();
  return data as Room[];
}
