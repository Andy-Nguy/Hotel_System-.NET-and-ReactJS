import React, { useEffect, useState } from 'react';
import { Button } from 'antd';
import type { Room } from '../../../../Frontend/src/api/roomsApi';

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
  const defaultWebp = '/img/room/room-1.jpg'; // fallback to existing jpg in public

  let imageBase = '';
  if (room.urlAnhPhong) {
    const u = String(room.urlAnhPhong).trim();
    if (u.startsWith('http') || u.startsWith('//')) {
      imageBase = u;
    } else if (u.startsWith('/')) {
      // absolute/relative path already pointing to public or backend path
      imageBase = u;
    } else {
      // stored as filename in backend wwwroot/img/room
      // use relative path so dev proxy can forward requests and browser won't trigger CORS
      imageBase = `/img/room/${u}`;
    }
  }

  // Only work with webp files - no jpg conversion
  const imageWebp = imageBase; // use the original path (already .webp from database)

  const [selectedSrc, setSelectedSrc] = useState<string>(imageWebp || defaultWebp);
  const [loaded, setLoaded] = useState(false);

  // Only try webp files - no jpg conversion needed
  useEffect(() => {
    let canceled = false;
    const tryLoad = (srcs: string[]) => {
      if (srcs.length === 0) {
        if (!canceled) {
          setSelectedSrc(defaultWebp);
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

    // Only try webp files - database stores .webp filenames
    const candidates = [] as string[];
    if (imageWebp) {
      candidates.push(imageWebp);
    }
    
    // fallback to default if webp fails
    candidates.push(defaultWebp);

    console.debug('RoomCard: image candidates', candidates);

    tryLoad(candidates);

    return () => {
      canceled = true;
    };
  }, [imageWebp]);

return (
    <div style={{
      border: '1px solid #eee',
      borderRadius: 8,
      overflow: 'hidden',
      background: '#fff',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      // THAY ĐỔI 1: Biến thẻ (card) thành flex-column
      display: 'flex',
      flexDirection: 'column',
      height: '100%' // Đảm bảo thẻ lấp đầy ô grid/flex cha
    }}>
      {/* Render image as a background */}
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
          backgroundRepeat: 'no-repeat',
          flexShrink: 0 // Ngăn ảnh bị co lại
        }}
      />

      <div style={{ 
          padding: 18,
          // THAY ĐỔI 2: Biến khu vực nội dung thành flex-column
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 1 // Yêu cầu nó lấp đầy không gian còn lại
        }}>

        {/* THAY ĐỔI 3: Tạo một wrapper cho nội dung trên */}
        {/* Wrapper này sẽ giãn ra để đẩy "footer" xuống */}
        <div style={{ flexGrow: 1 }}>
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
        </div>

        {/* THAY ĐỔI 4: Tạo một wrapper cho "footer" */}
        {/* Wrapper này sẽ KHÔNG giãn ra (flexShrink: 0) */}
        <div>
          <div style={{ marginBottom: 10 }}>
            <Button type="primary" block onClick={() => onBook(room)} style={{ background: '#dfa974', borderColor: '#dfa974', height: 64, fontSize: 18 }}>
              Đặt phòng ngay
            </Button>
          </div>

          <div style={{ fontSize: 12, color: '#666' /* Bỏ margin bottom ở đây */ }}>
            Giá bao gồm phí dịch vụ 5% mỗi lần lưu trú, nhưng không bao gồm thuế
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoomCard;
