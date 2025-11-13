import React, { useEffect, useState } from "react";
import { Button, Tag } from "antd";

import type { Room } from "../../../../Frontend/src/api/roomsApi";
import type { Promotion } from "../../../../Frontend/src/api/promotionApi";
import { getAllPromotions } from "../../../../Frontend/src/api/promotionApi";

// Backend base URL for assets. You can set VITE_API_BASE in .env to override.
const BACKEND_BASE =
  ((import.meta as any).env?.VITE_API_BASE as string) ||
  "https://localhost:5001";

type Props = {
  room: Room;
  onOpenDetail: (room: Room) => void;
  onBook: (room: Room) => void;
  bookButtonText?: string;
};

function formatPrice(v?: number | null) {
  if (v == null) return "Liên hệ";
  return v.toLocaleString("vi-VN", { style: "currency", currency: "VND" });
}

const RoomCard: React.FC<Props> = ({
  room,
  onOpenDetail,
  onBook,
  bookButtonText = "Đặt phòng ngay",
}) => {
  const defaultWebp = "/img/room/room-6.jpg";

  const rawImageField =
    (room as any).roomImageUrl ??
    (room as any).RoomImageUrl ??
    (room as any).urlAnhPhong ??
    (room as any).UrlAnhPhong;

  let imageBase = "";
  if (rawImageField) {
    const u = String(rawImageField).trim();
    if (u.startsWith("http") || u.startsWith("//")) {
      imageBase = u;
    } else if (u.startsWith("/")) {
      imageBase = u;
    } else {
      imageBase = `/img/room/${u}`;
    }
  }

  const imageWebp = imageBase;

  const [selectedSrc, setSelectedSrc] = useState<string>(
    imageWebp || defaultWebp
  );
  const [loaded, setLoaded] = useState(false);
  const [promotion, setPromotion] = useState<Promotion | null>(null);

  // LOAD IMAGE
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
      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (canceled) return;
        setSelectedSrc(s);
        setLoaded(true);
      };
      img.onerror = () => {
        tryLoad(srcs.slice(1));
      };
      img.src = s;
    };

    const candidates: string[] = [];
    const apiBase = ((import.meta as any).env?.VITE_API_BASE as string) || "";

    if (imageWebp) candidates.push(imageWebp);

    if (apiBase && imageWebp && !imageWebp.startsWith("http")) {
      const trimmed = imageWebp.startsWith("/")
        ? imageWebp.slice(1)
        : imageWebp;
      candidates.push(`${apiBase.replace(/\/$/, "")}/${trimmed}`);
    }

    if (!candidates.includes(defaultWebp)) candidates.push(defaultWebp);

    const svgFallback = `data:image/svg+xml;utf8,${encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><rect width="100%" height="100%" fill="#eee"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#999" font-family="Arial" font-size="24">No image</text></svg>'
    )}`;
    candidates.push(svgFallback);

    tryLoad(candidates);

    return () => {
      canceled = true;
    };
  }, [imageWebp]);

  // LOAD PROMOTION
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const promos = await getAllPromotions("active");
        if (cancelled) return;

        const found = promos.find(
          (p) =>
            Array.isArray(p.khuyenMaiPhongs) &&
            p.khuyenMaiPhongs.some(
              (r) => String(r.idphong) === String(room.idphong)
            )
        );

        if (!cancelled) setPromotion(found || null);
      } catch (err) {
        console.debug("RoomCard: failed to load promotions", err);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [room.idphong]);

  return (
    <div
      style={{
        border: "1px solid #eee",
        borderRadius: 8,
        overflow: "hidden",
        background: "#fff",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
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
          flexShrink: 0,
          position: "relative",
        }}
      >
        {promotion && (
          <div
            style={{
              position: "absolute",
              top: 10,
              left: 10,
              // zIndex: 20,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Tag color="volcano" style={{ fontWeight: 700 }}>
              KM
            </Tag>
            <div
              style={{
                background: "rgba(0,0,0,0.6)",
                color: "#fff",
                padding: "6px 10px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {promotion.tenKhuyenMai || "Khuyến mãi"}
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          padding: 18,
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
        }}
      >
        <div style={{ flexGrow: 1 }}>
          <h2 style={{ margin: 0, fontSize: 30, fontWeight: "bold" }}>
            {room.tenPhong ?? "Phòng nghỉ"}
          </h2>

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
        </div>

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
              {bookButtonText}
            </Button>
          </div>

          <div style={{ fontSize: 12, color: "#666" }}>
            Giá bao gồm phí dịch vụ 5% nhưng không bao gồm thuế
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoomCard;
