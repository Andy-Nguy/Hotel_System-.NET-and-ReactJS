import React, { useEffect, useState } from "react";
// backend base for assets
const BACKEND_BASE = ((import.meta as any).env?.VITE_API_BASE as string) || 'https://localhost:5001';

function resolveImageUrl(u?: string | null) {
  if (!u) return undefined;
  const s = String(u).trim();
  if (!s) return undefined;
  if (s.startsWith('http') || s.startsWith('//')) return s;
  if (s.startsWith('/assets')) return `${BACKEND_BASE}${s}`;
  if (s.startsWith('/img')) return s; // served by frontend public
  if (s.startsWith('/')) return `${BACKEND_BASE}${s}`;
  // filename only
  return `${BACKEND_BASE}/assets/room/${s}`;
}
import { getRooms } from "../api/roomsApi";

type Room = {
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

const HomeRoom: React.FC = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        // use centralized API helper
        const data = await getRooms();

        // Normalize properties (API may return camelCase)
        const normalized = (data || [])
          .map((r: any) => ({
            idphong: r.idphong ?? r.idPhong ?? r.Idphong ?? r.IdPhong,
            tenPhong: r.tenPhong ?? r.TenPhong ?? r.TenPhong,
            soPhong: r.soPhong ?? r.SoPhong,
            moTa: r.moTa ?? r.MoTa,
            soNguoiToiDa:
              r.soNguoiToiDa ??
              r.SoNguoiToiDa ??
              r.soNguoiToiDa ??
              r.SoNguoiToiDa,
            giaCoBanMotDem:
              r.giaCoBanMotDem ??
              r.GiaCoBanMotDem ??
              r.giaCoBanMotDem ??
              r.GiaCoBanMotDem,
            xepHangSao:
              r.xepHangSao ?? r.XepHangSao ?? r.xepHangSao ?? r.XepHangSao ?? 0,
            urlAnhPhong:
              r.urlAnhPhong ?? r.UrlAnhPhong ?? r.urlAnhPhong ?? r.UrlAnhPhong,
            ...r,
          }))
          // filter only rooms with rating >= 4
          .filter((r: any) => Number(r.xepHangSao ?? 0) >= 4);

        setRooms(normalized);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load rooms");
      } finally {
        setLoading(false);
      }
    };

    fetchRooms();
  }, []);

  if (loading) {
    return (
      <section className="hp-room-section">
        <div className="container-fluid">
          <div>Loading rooms...</div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="hp-room-section">
        <div className="container-fluid">
          <div className="text-danger">Error loading rooms: {error}</div>
        </div>
      </section>
    );
  }

  return (
    <section className="hp-room-section">
      <div className="container-fluid">
        <div className="hp-room-items">
          <div className="row">
            {rooms.length === 0 && (
              <div className="col-12">No rooms with 4+ stars found.</div>
            )}

            {rooms.map((room) => (
              <div
                className="col-lg-3 col-md-6"
                key={room.idphong ?? room.soPhong}
              >
                <div
                  className="hp-room-item"
                    style={{
                    backgroundImage: `url(${resolveImageUrl(room.urlAnhPhong) ?? `/img/room/room-b1.jpg`})`,
                  }}
                >
                  <div className="hr-text">
                    <h3>{room.tenPhong ?? `Room ${room.soPhong ?? ""}`}</h3>
                    <h2>
                      {room.giaCoBanMotDem !== undefined &&
                      room.giaCoBanMotDem !== null
                        ? `$${Number(room.giaCoBanMotDem).toLocaleString()}`
                        : "Contact"}
                      <span>/Pernight</span>
                    </h2>
                    <table>
                      <tbody>
                        <tr>
                          <td className="r-o">Size:</td>
                          <td>{room.moTa ?? "-"}</td>
                        </tr>
                        <tr>
                          <td className="r-o">Capacity:</td>
                          <td>Max person {room.soNguoiToiDa ?? "-"}</td>
                        </tr>
                        <tr>
                          <td className="r-o">Rating:</td>
                          <td>{room.xepHangSao ?? "-"} ⭐</td>
                        </tr>
                        <tr>
                          <td className="r-o">Services:</td>
                          <td>Wifi, Television, Bathroom,...</td>
                        </tr>
                      </tbody>
                    </table>
                    <a href="#" className="primary-btn">
                      More Details
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HomeRoom;
