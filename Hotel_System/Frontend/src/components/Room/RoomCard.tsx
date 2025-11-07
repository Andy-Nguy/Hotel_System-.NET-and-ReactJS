import React, { useEffect, useState } from 'react';
import { Button } from 'antd';
import type { Room } from '../../../../Backend/Hotel_System.API/Services/roomService';

// Backend base URL for assets. You can set VITE_API_BASE in .env to override.
const BACKEND_BASE = ((import.meta as any).env?.VITE_API_BASE as string) || 'https://localhost:5001';

type Props = {
  room: Room;
  onOpenDetail: (room: Room) => void;
  onBook: (room: Room) => void;
};

function formatPrice(v?: number | null) {
  if (v == null) return 'Liên hệ';
  return v.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
}

const RoomCard: React.FC<Props> = ({ room, onOpenDetail, onBook }) => {
  // Default fallback (served from Frontend `public/` -> available at /img/...)
  // Use an existing image from Frontend/public/img/room to avoid 404.
  const defaultJpg = '/img/room/room-1.jpg';
  const defaultWebp = defaultJpg; // we don't have webp default in public, use jpg path

  let imageBase = '';
  if (room.urlAnhPhong) {
    const u = String(room.urlAnhPhong).trim();
    if (u.startsWith('http') || u.startsWith('//')) {
      imageBase = u;
    } else if (u.startsWith('/')) {
      // absolute path already pointing to public or backend path
      imageBase = u;
    } else {
      // stored as filename in backend assets folder
      imageBase = `${BACKEND_BASE}/assets/room/${u}`;
    }
  }

  // Construct paths for <picture>: prefer webp source, fallback to jpg or default
  const makeWebp = (base: string) => {
    try {
      // if base already has an extension, replace it with .webp
      const idx = base.lastIndexOf('.');
      if (idx > base.lastIndexOf('/')) return base.substring(0, idx) + '.webp';
    } catch {}
    return base + '.webp';
  };

  const makeJpg = (base: string) => {
    try {
      const idx = base.lastIndexOf('.');
      if (idx > base.lastIndexOf('/')) return base.substring(0, idx) + '.jpg';
    } catch {}
    return base + '.jpg';
  };

  const imageWebp = imageBase ? makeWebp(imageBase) : defaultWebp;
  const imageFallback = imageBase ? makeJpg(imageBase) : defaultJpg;

  const [selectedSrc, setSelectedSrc] = useState<string>(imageFallback);
  const [loaded, setLoaded] = useState(false);

  // Try to preload webp first, then jpg, then default. Log useful info to console
  useEffect(() => {
    let canceled = false;
    const tryLoad = (srcs: string[]) => {
      if (srcs.length === 0) {
        if (!canceled) {
          setSelectedSrc(defaultJpg);
          setLoaded(true);
        }
        return;
      }
      const s = srcs[0];
      const img = new Image();
      // allow CORS image loading if backend serves with CORS headers
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (canceled) return;
        console.debug('RoomCard: image loaded', s);
        setSelectedSrc(s);
        setLoaded(true);
      };
      img.onerror = (e) => {
        console.warn('RoomCard: failed to load image, trying next', s, e);
        tryLoad(srcs.slice(1));
      };
      img.src = s;
    };

    // Start with webp -> jpg -> original backend path -> possible http fallback for localhost -> defaults
    const candidates = [] as string[];
    if (imageWebp) candidates.push(imageWebp);
    if (imageFallback) candidates.push(imageFallback);
    if (imageBase) {
      // try the backend path as-is too (in case urlAnhPhong already includes extension)
      candidates.push(imageBase);

      // If backend is localhost (dev), also try common alternate port/protocol (http://localhost:5000)
      try {
        const url = new URL(imageBase);
        if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
          // try same path on http://localhost:5000
          const alt = `${url.protocol === 'https:' ? 'http:' : 'https:'}//${url.hostname}:5000${url.pathname}${url.search}`;
          // also add webp/jpg variants for alt
          const altBase = alt.replace(/\.[a-zA-Z0-9]+$/, '');
          candidates.push(alt);
          try {
            const altWebp = makeWebp(alt);
            const altJpg = makeJpg(alt);
            candidates.push(altWebp, altJpg);
          } catch {}
        }
      } catch {}
    }

    // finally try frontend defaults
    candidates.push(defaultWebp, defaultJpg);

    console.debug('RoomCard: image candidates', candidates);

    tryLoad(candidates);

    return () => {
      canceled = true;
    };
  }, [imageWebp, imageFallback, imageBase]);

  return (
    <div style={{
      border: '1px solid #eee',
      borderRadius: 8,
      overflow: 'hidden',
      background: '#fff',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
    }}>
      {/* Render image as a background to ensure consistent cover/crop like image2 */}
      <div
        role="img"
        aria-label={room.tenPhong ?? 'Phòng'}
        style={{
          width: '100%',
          height: 220,
          overflow: 'hidden',
          backgroundImage: `url(${selectedSrc})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      />

      <div style={{ padding: 18 }}>
        <h2 style={{ margin: 0, fontSize: 30, fontWeight: 'bold' }}>{room.tenPhong ?? 'Phòng nghỉ'}</h2>

        <a onClick={() => onOpenDetail(room)} style={{display: 'inline-block', marginBottom: 12, color: '#dfa974', textDecoration: 'underline', cursor: 'pointer', fontWeight: 'bold'}}>
          Xem thông tin phòng chi tiết
        </a>

        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <ul style={{ margin: 0, paddingLeft: 18, flex: 1 }}>
            <li>Ngủ {room.soNguoiToiDa ?? 2} người</li>
            <li>Phù phiếm kép</li>
          </ul>
          <ul style={{ margin: 0, paddingLeft: 18, flex: 1 }}>
            <li>Không gian làm việc</li>
            <li>Tủ lạnh mini</li>
          </ul>
        </div>

        <div style={{ marginBottom: 10 }}>
          <Button type="primary" block onClick={() => onBook(room)} style={{ background: '#dfa974', borderColor: '#dfa974', height: 64, fontSize: 18 }}>
            Đặt phòng ngay
          </Button>
        </div>

        <div style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
          Giá bao gồm phí dịch vụ 5% mỗi lần lưu trú, nhưng không bao gồm thuế
        </div>

        {/* main CTA already provided above */}
      </div>
    </div>
  );
};

export default RoomCard;
