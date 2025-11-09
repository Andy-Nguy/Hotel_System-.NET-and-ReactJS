import React, { useEffect, useState } from "react";

function resolveImageUrl(u?: string | null) {
  if (!u) return undefined;
  const s = String(u).trim();
  if (!s) return undefined;
  if (s.startsWith('http') || s.startsWith('//')) return s;
  if (s.startsWith('/img')) return s; // already relative img path
  if (s.startsWith('/assets')) return s; // keep relative
  if (s.startsWith('/')) return s; // other relative path
  // filename only -> use relative path to /img/room so dev proxy forwards to backend
  return `/img/room/${s}`;
}
import { getRoomTypes } from "../api/roomsApi";

type RoomType = {
  idLoaiPhong: string;
  tenLoaiPhong?: string | null;
  moTa?: string | null;
  urlAnhLoaiPhong?: string | null;
  [key: string]: any;
};

const HomeRoom: React.FC = () => {
  const [types, setTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchTypes = async () => {
      try {
        const data = await getRoomTypes();
        if (!mounted) return;
        const normalized = (data || []).map((t: any) => ({
          idLoaiPhong: t.idLoaiPhong ?? t.IdloaiPhong ?? t.IdLoaiPhong ?? t.idLoaiPhong,
          tenLoaiPhong: t.tenLoaiPhong ?? t.TenLoaiPhong ?? t.tenLoaiPhong,
          moTa: t.moTa ?? t.MoTa,
          urlAnhLoaiPhong: t.urlAnhLoaiPhong ?? t.UrlAnhLoaiPhong,
          ...t,
        }));
        setTypes(normalized);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message ?? "Failed to load room types");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    };

    fetchTypes();
    return () => {
      mounted = false;
    };
  }, []);

  const goToRoomPage = (id?: string) => {
    if (!id) return;
    window.location.hash = `#rooms?loaiId=${encodeURIComponent(id)}`;
  };

  if (loading) {
    return (
      <section className="hp-room-section">
        <div className="container-fluid">
          <div>Loading room types...</div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="hp-room-section">
        <div className="container-fluid">
          <div className="text-danger">Error loading room types: {error}</div>
        </div>
      </section>
    );
  }

  return (
    <section className="hp-room-section">
      <div className="container-fluid">
        <div className="hp-room-items">
          <div className="row">
            {types.length === 0 && (
              <div className="col-12">No room types found.</div>
            )}

            {types.map((type) => (
              <div className="col-lg-3 col-md-6" key={type.idLoaiPhong}>
                <div
                  className="hp-room-item"
                  style={{
                    backgroundImage: `url(${resolveImageUrl(type.urlAnhLoaiPhong) ?? `/img/room/room-b1.jpg`})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                >
                  <div className="hr-text">
                    <h3>{type.tenLoaiPhong ?? `Loại phòng`}</h3>
                    <p style={{ minHeight: 40 }}>{type.moTa ?? ''}</p>
                    <div style={{ marginTop: 8 }}>
                      <button className="primary-btn" onClick={() => goToRoomPage(type.idLoaiPhong)}>Xem chi tiết</button>
                    </div>
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
