import React, { useEffect, useState } from "react";
import { Button } from "antd";
import type { Room } from "../../../../Frontend/src/api/roomsApi";

// Backend base URL for assets. You can set VITE_API_BASE in .env to override.
const BACKEND_BASE =
  ((import.meta as any).env?.VITE_API_BASE as string) ||
  "https://localhost:5001";

type Props = {
  room: Room;
  onOpenDetail: (room: Room) => void;
  onBook: (room: Room) => void;
};

function formatPrice(v?: number | null) {
  if (v == null) return "Liên hệ";
  return v.toLocaleString("vi-VN", { style: "currency", currency: "VND" });
}

const RoomCard: React.FC<Props> = ({ room, onOpenDetail, onBook }) => {
  // Default fallback (served from Frontend `public/` -> available at /img/...)
  // Use an existing image from Frontend/public/img/room to avoid 404.
  // Use a fallback image that exists in public/img/room to avoid 404 spam
  const defaultWebp = "/img/room/room-6.jpg"; // room-6.jpg exists in public

  // Support several possible field names returned by backend (roomImageUrl, urlAnhPhong, UrlAnhPhong)
  const rawImageField =
    (room as any).roomImageUrl ??
    (room as any).RoomImageUrl ??
    (room as any).urlAnhPhong ??
    (room as any).UrlAnhPhong ??
    (room as any).UrlAnhPhong ??
    (room as any).urlAnhPhong;
  let imageBase = "";
  if (rawImageField) {
    const u = String(rawImageField).trim();
    if (u.startsWith("http") || u.startsWith("//")) {
      imageBase = u;
    } else if (u.startsWith("/")) {
      imageBase = u;
    } else {
      // try relative path under /img/room and also backend base if configured
      imageBase = `/img/room/${u}`;
    }
  }

  // Only work with webp files - no jpg conversion
  const imageWebp = imageBase; // use the original path (already .webp from database)

  const [selectedSrc, setSelectedSrc] = useState<string>(
    imageWebp || defaultWebp
  );
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
      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (canceled) return;
        console.debug("RoomCard: image loaded", s);
        setSelectedSrc(s);
        setLoaded(true);
      };
      img.onerror = (e) => {
        // only log first failure to reduce console noise
        try {
          console.debug &&
            console.debug("RoomCard: failed to load image, trying next", s);
        } catch {}
        tryLoad(srcs.slice(1));
      };
      img.src = s;
    };

    // Build unique candidate list (try explicit imageBase, backend-prefixed, then fallback)
    const candidates = [] as string[];
    const apiBase = ((import.meta as any).env?.VITE_API_BASE as string) || "";
    if (imageWebp) candidates.push(imageWebp);
    // if image is a filename-relative (no leading slash) we already prefixed to /img/room/<file>
    // additionally try backend absolute URL if VITE_API_BASE is set
    if (apiBase && imageWebp && !imageWebp.startsWith("http")) {
      const trimmed = imageWebp.startsWith("/")
        ? imageWebp.slice(1)
        : imageWebp;
      candidates.push(`${apiBase.replace(/\/$/, "")}/${trimmed}`);
    }
    if (!candidates.includes(defaultWebp)) candidates.push(defaultWebp);
    // final fallback: small inline SVG data URL to avoid any network request
    const svgFallback = `data:image/svg+xml;utf8,${encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><rect width="100%" height="100%" fill="#eee"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#999" font-family="Arial" font-size="24">No image</text></svg>'
    )}`;
    candidates.push(svgFallback);

    console.debug("RoomCard: image candidates", candidates);

    tryLoad(candidates);

    return () => {
      canceled = true;
    };
  }, [imageWebp]);

  return (
    <div
      style={{
        border: "1px solid #eee",
        borderRadius: 8,
        overflow: "hidden",
        background: "#fff",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        // THAY ĐỔI 1: Biến thẻ (card) thành flex-column
        display: "flex",
        flexDirection: "column",
        height: "100%", // Đảm bảo thẻ lấp đầy ô grid/flex cha
      }}
    >
            {/* Render image as a background */}     {" "}
      <div
        role="img"
        aria-label={room.tenPhong ?? "Phòng"}
        style={{
          width: "100%",
          height: 220,
          overflow: "hidden",
          backgroundImage: `url(${selectedSrc})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          flexShrink: 0, // Ngăn ảnh bị co lại
        }}
      />
           {" "}
      <div
        style={{
          padding: 18,
          // THAY ĐỔI 2: Biến khu vực nội dung thành flex-column
          display: "flex",
          flexDirection: "column",
          flexGrow: 1, // Yêu cầu nó lấp đầy không gian còn lại
        }}
      >
        {/* THAY ĐỔI 3: Tạo một wrapper cho nội dung trên */}
        {/* Wrapper này sẽ giãn ra để đẩy "footer" xuống */}
        <div style={{ flexGrow: 1 }}>
                 {" "}
          <h2 style={{ margin: 0, fontSize: 30, fontWeight: "bold" }}>
            {room.tenPhong ?? "Phòng nghỉ"}
          </h2>
                 {" "}
          <a
            onClick={() => onOpenDetail(room)}
            style={{
              display: "inline-block",
              marginBottom: 12,
              color: "#dfa974",
              textDecoration: "none",
              borderBottom: "2px solid #dfa974",
              paddingBottom: 2,
              cursor: "pointer",
              fontWeight: "bold",
              lineHeight: 1.2,
            }}
          >
            Xem thông tin phòng chi tiết
          </a>
                 {" "}
          <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                     {" "}
            <ul style={{ margin: 0, paddingLeft: 18, flex: 1 }}>
                          <li>Ngủ {room.soNguoiToiDa ?? 2} người</li>           {" "}
              <li>Phù phiếm kép</li>         {" "}
            </ul>
                     {" "}
            <ul style={{ margin: 0, paddingLeft: 18, flex: 1 }}>
                          <li>Không gian làm việc</li>           {" "}
              <li>Tủ lạnh mini</li>         {" "}
            </ul>
                   {" "}
          </div>
        </div>
        {/* THAY ĐỔI 4: Tạo một wrapper cho "footer" */}
        {/* Wrapper này sẽ KHÔNG giãn ra (flexShrink: 0) */}
        <div>
          <div
            style={{
              marginBottom: 10,
              display: "flex",
              justifyContent: "center",
            }}
          >
            <Button
              type="primary"
              onClick={() => onBook(room)}
              style={{
                background: "#dfa974",
                borderColor: "#dfa974",
                height: 64,
                fontSize: 18,
                width: "min(420px, 85%)",
              }}
            >
              Đặt phòng ngay
            </Button>
          </div>
                 {" "}
          <div
            style={{ fontSize: 12, color: "#666" /* Bỏ margin bottom ở đây */ }}
          >
                      Giá bao gồm phí dịch vụ 5% mỗi lần lưu trú, nhưng không
            bao gồm thuế        {" "}
          </div>
        </div>
             {" "}
      </div>
         {" "}
    </div>
  );
};

export default RoomCard;
