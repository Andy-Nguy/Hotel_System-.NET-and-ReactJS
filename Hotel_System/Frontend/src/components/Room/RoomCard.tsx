import React, { useEffect, useState, useRef } from "react";
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
  bookButtonText = "Khám phá phòng",
}) => {
  const defaultWebp = "/img/room/room-6.jpg";

  // Handle image array or single image string
  const imageArray = Array.isArray(room.urlAnhPhong)
    ? room.urlAnhPhong
    : room.urlAnhPhong
    ? [room.urlAnhPhong]
    : [];
  
  const primaryImage = imageArray[0] || null;

  let imageBase = "";
  if (primaryImage) {
    const u = String(primaryImage).trim();
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
  const [titleFontSize, setTitleFontSize] = useState<number>(30);
  const titleRef = useRef<HTMLHeadingElement | null>(null);

  // Determine sold/out status from room payload (may come from backend or merged by frontend)
  const rawStatus =
    (room as any).TrangThai ||
    (room as any).trangThai ||
    (room as any).status ||
    "";
  const statusStr = String(rawStatus || "").toLowerCase();
  const isSoldOut =
    statusStr === "occupied" ||
    statusStr === "soldout" ||
    statusStr === "sold out" ||
    statusStr === "unavailable";

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

  // Auto-adjust title font size to keep it on one line and avoid affecting card heights
  useEffect(() => {
    let mounted = true;

    const adjust = () => {
      const el = titleRef.current;
      if (!el) return;

      // start from default large size
      const computedStyle = window.getComputedStyle(el);
      const fontFamily = computedStyle.fontFamily || "Arial, sans-serif";

      let size = 30;
      const minSize = 14;

      // Apply sizes until the text fits within its container width (single line)
      const fitsAt = (s: number) => {
        el.style.fontSize = s + "px";
        // ensure single-line measurement
        el.style.whiteSpace = "nowrap";
        const fits = el.scrollWidth <= el.clientWidth + 1; // small tolerance
        return fits;
      };

      // fast path: if already fits at current state, use that
      if (fitsAt(size)) {
        if (mounted) setTitleFontSize(size);
        return;
      }

      while (size > minSize) {
        size -= 1;
        if (fitsAt(size)) break;
      }

      if (mounted) setTitleFontSize(size);
    };

    // wait for next tick so layout computed
    const id = window.setTimeout(adjust, 0);

    window.addEventListener("resize", adjust);

    return () => {
      mounted = false;
      window.clearTimeout(id);
      window.removeEventListener("resize", adjust);
    };
  }, [room.tenPhong]);

  // Price calculations for display
  const basePrice: number | null =
    (room as any).giaCoBanMotDem ?? (room as any).basePricePerNight ?? null;

  // Determine discount according to promotion type
  const promoValue = promotion?.giaTriGiam ?? 0; // could be percent or amount
  const isPercent = promotion?.loaiGiamGia === "percent";
  const isAmount = promotion?.loaiGiamGia === "amount";
  const hasDiscount =
    !!promotion && !!basePrice && promoValue > 0 && (isPercent || isAmount);

  let discountedPrice: number | null = null;
  let savings = 0;
  if (hasDiscount && basePrice) {
    if (isPercent) {
      discountedPrice = Math.round(basePrice * (1 - promoValue / 100));
      savings = basePrice - (discountedPrice ?? 0);
    } else if (isAmount) {
      // promoValue is fixed amount in VND
      discountedPrice = Math.max(0, Math.round(basePrice - promoValue));
      savings = basePrice - discountedPrice;
    }
  }

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
        {isSoldOut && (
          <div
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              background: "rgba(0,0,0,0.6)",
              color: "#fff",
              padding: "6px 10px",
              borderRadius: 6,
              fontWeight: 700,
              zIndex: 30,
              fontSize: 12,
            }}
          >
            Đã đặt / Hết phòng
          </div>
        )}
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
          <h2
            ref={(el: any) => (titleRef.current = el)}
            style={{
              margin: 0,
              fontSize: titleFontSize,
              fontWeight: "bold",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {room.tenPhong ?? "Phòng nghỉ"}
          </h2>

          {/* Removed inline detail link — primary CTA now opens detail (luxury "Khám phá phòng") */}

          {/* Price Display */}
          <div style={{ marginTop: 12, marginBottom: 16, minHeight: 60 }}>
            {hasDiscount && discountedPrice ? (
              // --- DISCOUNT VIEW ---
              <div>
                <div
                  style={{
                    fontSize: 15,
                    color: "#999",
                    textDecoration: "line-through",
                  }}
                >
                  {formatPrice(basePrice)}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 8,
                    marginTop: 4,
                    flexWrap: "nowrap",
                  }}
                >
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "baseline",
                      gap: 6,
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 25,
                        fontWeight: 700,
                        color: "#dfa974",
                        lineHeight: 1,
                      }}
                    >
                      {formatPrice(discountedPrice)}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "#666",
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                      }}
                    >
                      /đêm
                    </div>
                  </div>
                  <Tag
                    color="gold"
                    style={{
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      fontSize: 11,
                      padding: "3px 6px",
                      lineHeight: 1,
                      display: "inline-flex",
                      alignItems: "center",
                      marginRight: 2,
                      boxSizing: "border-box",
                    }}
                  >
                    TIẾT KIỆM{" "}
                    {promotion?.loaiGiamGia === "percent"
                      ? `${promoValue}%`
                      : `${promoValue?.toLocaleString?.() ?? promoValue}đ`}
                  </Tag>
                </div>
              </div>
            ) : (
              // --- REGULAR PRICE VIEW ---
              <div>
                <div style={{ fontSize: 10, color: "#888" }}>
                  Giá mỗi đêm từ
                </div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "baseline",
                    gap: 8,
                    marginTop: 4,
                    whiteSpace: "nowrap",
                    flexWrap: "nowrap",
                  }}
                >
                  <div
                    style={{
                      fontSize: 25,
                      fontWeight: 700,
                      color: "#333",
                      lineHeight: 1,
                      flexShrink: 0,
                    }}
                  >
                    {formatPrice(basePrice)}
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      color: "#666",
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                    }}
                  >
                    /đêm
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {/* If on select-room page, show both Select and View Detail buttons.
                Otherwise keep the original big CTA that opens details. */}
            {typeof window !== "undefined" &&
            window.location.pathname.startsWith("/select-room") ? (
              <div
                style={{ display: "flex", gap: 10, justifyContent: "center" }}
              >
                <Button
                  type="primary"
                  onClick={() => onBook(room)}
                  aria-label="Chọn phòng"
                  style={{
                    background:
                      "linear-gradient(135deg, #dfa974 0%, #d89860 100%)",
                    borderColor: "transparent",
                    height: 48,
                    fontSize: 16,
                    padding: "0 24px",
                    borderRadius: 10,
                    boxShadow: "0 8px 20px rgba(217,152,96,0.14)",
                    color: "#fff",
                    fontWeight: 700,
                  }}
                >
                  Chọn phòng
                </Button>

                <Button
                  onClick={() => onOpenDetail(room)}
                  aria-label="Xem chi tiết"
                  style={{
                    height: 48,
                    fontSize: 15,
                    padding: "0 18px",
                    borderRadius: 10,
                  }}
                >
                  Xem chi tiết
                </Button>
              </div>
            ) : (
              <div
                style={{
                  marginBottom: 10,
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <Button
                  type="primary"
                  onClick={() => onOpenDetail(room)}
                  aria-label="Khám phá phòng"
                  style={{
                    background:
                      "linear-gradient(135deg, #dfa974 0%, #d89860 100%)",
                    borderColor: "transparent",
                    height: 64,
                    fontSize: 18,
                    width: "min(420px, 85%)",
                    borderRadius: 12,
                    boxShadow: "0 10px 30px rgba(217,152,96,0.18)",
                    color: "#fff",
                    fontWeight: 700,
                    letterSpacing: "0.2px",
                  }}
                >
                  {bookButtonText}
                </Button>
              </div>
            )}

            <div style={{ fontSize: 12, color: "#666" }}>
              Giá bao gồm phí dịch vụ 5% nhưng không bao gồm thuế
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoomCard;
