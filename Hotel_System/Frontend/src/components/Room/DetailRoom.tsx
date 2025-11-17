import React, { useEffect, useState } from "react";
import { getAmenitiesForRoom } from "../../api/amenticsApi";
const BACKEND_BASE =
  ((import.meta as any).env?.VITE_API_BASE as string) ||
  "https://localhost:5001";

function resolveImageUrl(u?: string | null) {
  if (!u) return undefined;
  const s = String(u).trim();
  if (!s) return undefined;
  if (s.startsWith("http") || s.startsWith("//")) return s;
  // If already an absolute URL or protocol-relative, return as-is
  if (s.startsWith("/img")) return s; // already a relative img path
  if (s.startsWith("/")) return s; // other relative path
  // otherwise treat as filename stored in backend img/room
  return `/img/room/${s}`;
}
import { Modal, Button } from "antd";
import type { Room } from "../../../../Frontend/src/api/roomsApi";
import type { Promotion } from "../../../../Frontend/src/api/promotionApi";
import { getAllPromotions } from "../../../../Frontend/src/api/promotionApi";
import dayjs from "dayjs";

type Props = {
  visible: boolean;
  room?: Room | null;
  onClose: () => void;
  onBook: (room: Room) => void;
};

const DetailRoom: React.FC<Props> = ({ visible, room, onClose, onBook }) => {
  if (!room) return null;

  const [promotion, setPromotion] = React.useState<Promotion | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!room?.idphong) return;
      try {
        const promos = await getAllPromotions("active");
        if (cancelled) return;
        const found = promos.find((p) =>
          Array.isArray(p.khuyenMaiPhongs) &&
          p.khuyenMaiPhongs.some((r) => String(r.idphong) === String(room.idphong))
        );
        // also verify date range if present
        if (found && found.ngayBatDau && found.ngayKetThuc) {
          const now = dayjs();
          const start = dayjs(found.ngayBatDau);
          const end = dayjs(found.ngayKetThuc).endOf("day");
          if (now.isBefore(start) || now.isAfter(end)) {
            // out of date range
            setPromotion(null);
            return;
          }
        }
        setPromotion(found || null);
      } catch (err) {
        console.debug("DetailRoom: failed to load promotions", err);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [room?.idphong]);

  return (
    <Modal
      visible={visible}
      onCancel={onClose}
      footer={null}
      width={980}
      title={null}
      closable={false}
      bodyStyle={{ background: "#fff" }}
      centered
      style={{ top: 20 }}
      zIndex={10010}
      maskStyle={{ backgroundColor: "rgba(0, 0, 0, 0.65)", zIndex: 10005 }}
    >
      {/* === FIX: Dùng margin âm để "ăn" hết padding của body === */}
      <div
        style={{
          margin: "-20px -24px", // Thay vì -20px hoặc 0
          background: "#fff",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        {/* === ROW 1: HEADER (Không đổi) === */}
        <div
          style={{
            background: "#0b0b0b",
            color: "#fff",
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "relative",
            zIndex: 10,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 18 }}>
            {room.tenPhong ?? "Phòng"}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "#fff",
              border: "none",
              color: "#000",
              fontSize: 20,
              cursor: "pointer",
              width: 32,
              height: 32,
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "bold",
            }}
          >
            ×
          </button>
        </div>

        {/* === ROW 2: FULL-BLEED IMAGE (Giữ nguyên 16:9) === */}
        <div
          style={{
            width: "100%",
            position: "relative",
            background: "#f5f5f5",
            paddingTop: "56.25%", // Tỷ lệ 16:9
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
            }}
          >
            <DetailImage
              srcHint={room.urlAnhPhong}
              alt={room.tenPhong || "phong"}
            />
          </div>
        </div>

        {/* === ROW 3: ROOM INFORMATION (Thêm lại padding) === */}
        {/* Vì margin âm đã "ăn" mất padding, chúng ta phải 
					thêm padding 24px trở lại cho khu vực nội dung
				*/}
        <div style={{ padding: 24 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              marginBottom: 16,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>
              {room.tenPhong}
            </h3>
            <Button
              type="default"
              onClick={() => {
                try {
                  if (promotion) {
                    sessionStorage.setItem(
                      "pendingPromotion",
                      JSON.stringify(promotion)
                    );
                  }
                } catch (e) {
                  /* ignore */
                }
                onBook(room);
              }}
              style={{
                borderRadius: 6,
                background: "#4a5a4a",
                color: "#fff",
                borderColor: "#4a5a4a",
                padding: "8px 20px",
                height: "auto",
              }}
            >
              Đặt ngay
            </Button>
          </div>

          {room.moTa && (
            <p style={{ color: "#666", marginBottom: 20, lineHeight: 1.6 }}>
              {room.moTa}
            </p>
          )}

          {/* Two-column layout */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 32,
              marginBottom: 24,
            }}
          >
            <div>
              <h4
                style={{
                  marginTop: 0,
                  marginBottom: 12,
                  fontSize: 16,
                  fontWeight: 600,
                }}
              >
                Room Overview
              </h4>
              <div style={{ color: "#666", marginBottom: 8 }}>
                Loại phòng:{" "}
                {(room as any).tenLoaiPhong ??
                  (room.xepHangSao ? `${room.xepHangSao} sao` : "—")}
              </div>

              {room.soPhong && (
                <div style={{ color: "#666", marginBottom: 8 }}>
                  Số phòng: {room.soPhong}
                </div>
              )}

              <div style={{ color: "#666" }}>
                Giá: {room.giaCoBanMotDem != null ? (
                  <>
                    {room.giaCoBanMotDem.toLocaleString("vi-VN")}₫/đêm
                    {promotion && room.giaCoBanMotDem != null && (
                      <div style={{ marginTop: 6, color: "#d83737", fontWeight: 700 }}>
                        Giá sau khuyến mãi: {(
                          promotion.loaiGiamGia === "percent"
                            ? Math.max(0, Math.round((room.giaCoBanMotDem || 0) * (1 - (promotion.giaTriGiam || 0) / 100)))
                            : Math.max(0, Math.round((room.giaCoBanMotDem || 0) - (promotion.giaTriGiam || 0)))
                        ).toLocaleString("vi-VN")}₫/đêm
                      </div>
                    )}
                  </>
                ) : (
                  "Liên hệ"
                )}
              </div>
            </div>

            <div>
              <h4
                style={{
                  marginTop: 0,
                  marginBottom: 12,
                  fontSize: 16,
                  fontWeight: 600,
                }}
              >
                Special Benefits
              </h4>
              {/* Render amenities for this room */}
              <AmenitiesForRoom roomId={room.idphong} />
            </div>
          </div>

          {/* Beds and features */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 32,
              marginBottom: 24,
            }}
          >
            <div>
              <h5
                style={{
                  marginTop: 0,
                  marginBottom: 8,
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                Beds and Bedding
              </h5>
              <ul style={{ color: "#666", paddingLeft: 16, margin: 0 }}>
                <li style={{ marginBottom: 4 }}>
                  Maximum occupancy: {room.soNguoiToiDa ?? 2}
                </li>
                <li>
                  {room.soNguoiToiDa && room.soNguoiToiDa >= 1
                    ? "1 King bed"
                    : "Standard bedding"}
                </li>
              </ul>
            </div>

            <div>
                <h5
                  style={{
                    marginTop: 0,
                    marginBottom: 8,
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  {promotion ? "Khuyến mãi" : "Room Features"}
                </h5>
                {promotion ? (
                  <div style={{ color: "#666" }}>
                    <div style={{ marginBottom: 6, fontWeight: 600 }}>
                      {promotion.tenKhuyenMai}
                    </div>
                    {/* <div style={{ marginBottom: 6 }}>
                      {promotion.loaiGiamGia === "percent"
                        ? `Giảm ${promotion.giaTriGiam}% cho mỗi đêm` 
                        : promotion.giaTriGiam != null
                        ? `Giảm ${promotion.giaTriGiam.toLocaleString("vi-VN")} đ mỗi đêm`
                        : "Ưu đãi đặc biệt"}
                    </div> */}
                    {promotion.moTa && (
                      <div style={{ color: "#555" }}>{promotion.moTa}</div>
                    )}
                  </div>
                ) : (
                  <ul style={{ color: "#666", paddingLeft: 16, margin: 0 }}>
                    <li style={{ marginBottom: 4 }}>
                      {room.moTa?.split(",")[0]?.trim() ?? "Premium amenities"}
                    </li>
                    <li>Air-conditioned</li>
                  </ul>
                )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

// Small subcomponent that fetches and displays amenities for a given room
type AmenitySmall = { idtienNghi: string; tenTienNghi: string };

function AmenitiesForRoom({ roomId }: { roomId?: string | null }) {
  const [items, setItems] = useState<AmenitySmall[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!roomId) {
      setItems([]);
      return;
    }

    setLoading(true);
    getAmenitiesForRoom(roomId)
      .then((data) => {
        if (cancelled) return;
        // normalize a bit: ensure objects have tenTienNghi
        const norm = (data || []).map((d: any) => ({
          idtienNghi: d.idtienNghi || d.IdtienNghi || d.idTienNghi || "",
          tenTienNghi: d.tenTienNghi || d.TenTienNghi || "",
        }));
        setItems(norm);
      })
      .catch((err) => {
        console.error("Failed to load amenities for room", roomId, err);
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [roomId]);

  if (loading) return <div style={{ color: "#666" }}>Loading amenities…</div>;
  if (!items || items.length === 0)
    return <div style={{ color: "#666" }}>—</div>;

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {items.map((it) => (
        <span
          key={it.idtienNghi || it.tenTienNghi}
          style={{
            background: "#f1f5f9",
            color: "#111827",
            padding: "6px 10px",
            borderRadius: 999,
            fontSize: 13,
            border: "1px solid #e2e8f0",
          }}
        >
          {it.tenTienNghi || it.idtienNghi}
        </span>
      ))}
    </div>
  );
}

export default DetailRoom;

// ==================================================================
// COMPONENT HIỂN THỊ HÌNH ẢNH (BÊN TRONG ROW 2)
// (Không thay đổi)
// ==================================================================

type DetailImageProps = { srcHint?: string | null; alt?: string };

const DetailImage: React.FC<DetailImageProps> = ({ srcHint, alt }) => {
  const BACKEND_BASE =
    ((import.meta as any).env?.VITE_API_BASE as string) ||
    "https://localhost:5001";
  const defaultJpg = "/img/room/room-1.jpg";

  const makeVariant = (base: string, ext: string) => {
    try {
      const idx = base.lastIndexOf(".");
      if (idx > base.lastIndexOf("/")) return base.substring(0, idx) + ext;
    } catch {}
    return base + ext;
  };

  const makeCandidates = (u?: string | null) => {
    const out: string[] = [];
    if (!u) return out;
    // allow comma/pipe-separated list of images
    const parts = String(u)
      .split(/[,|;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length > 1) {
      for (const p of parts) {
        out.push(...makeCandidates(p));
      }
      return out;
    }

    const s = parts[0] ?? "";
    if (!s) return out;

    // Preserve original format: do not add forced .webp/.jpg variants first
    if (s.startsWith("http") || s.startsWith("//")) {
      out.push(s);
      return out;
    }
    if (s.startsWith("/img")) {
      out.push(s);
      return out;
    }
    if (s.startsWith("/")) {
      out.push(s);
      return out;
    }
    // filename only -> prefer /img/room/<file>
    out.push(`/img/room/${s}`);
    return out;
  };

  // Build a list of image candidates for gallery
  const gallerySources = (() => {
    if (!srcHint) return [defaultJpg];
    const parts = String(srcHint)
      .split(/[,|;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length <= 1) {
      const candidates = makeCandidates(srcHint);
      return candidates.length ? candidates : [defaultJpg];
    }
    // if multiple parts, resolve each to at least one candidate
    const out: string[] = [];
    for (const p of parts) {
      const c = makeCandidates(p);
      if (c.length) out.push(c[0]);
    }
    return out.length ? out : [defaultJpg];
  })();

  const [index, setIndex] = useState(0);
  const [loadedSrcs, setLoadedSrcs] = useState<Record<string, boolean>>({});
  const [displaySrc, setDisplaySrc] = useState<string>(
    gallerySources[0] ?? defaultJpg
  );

  useEffect(() => {
    // preload all gallery sources (first available wins for each slot)
    let canceled = false;
    const preload = async () => {
      const results: Record<string, boolean> = {};
      for (const s of gallerySources) {
        try {
          await new Promise<void>((res, rej) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => res();
            img.onerror = () => rej(new Error("failed"));
            img.src = s;
          });
          results[s] = true;
          if (!canceled && !displaySrc) setDisplaySrc(s);
        } catch {
          results[s] = false;
        }
      }
      if (!canceled) {
        setLoadedSrcs(results);
        // ensure current index points to a valid loaded src or fallback
        const cur =
          gallerySources[index] && results[gallerySources[index]]
            ? gallerySources[index]
            : gallerySources.find((ss) => results[ss]) ?? defaultJpg;
        setDisplaySrc(cur);
      }
    };
    preload();
    return () => {
      canceled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcHint]);

  useEffect(() => {
    // update display when index changes
    const s = gallerySources[index] ?? defaultJpg;
    setDisplaySrc(
      loadedSrcs[s]
        ? s
        : gallerySources.find((ss) => loadedSrcs[ss]) ?? defaultJpg
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, loadedSrcs]);

  const prev = () =>
    setIndex((i) => (i - 1 + gallerySources.length) % gallerySources.length);
  const next = () => setIndex((i) => (i + 1) % gallerySources.length);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        backgroundColor: "#f8f9fa",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <img
        src={displaySrc}
        alt={alt}
        crossOrigin="anonymous"
        style={{
          maxWidth: "100%",
          maxHeight: "100%",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
        }}
      />

      {/* Prev/Next controls */}
      {gallerySources.length > 1 && (
        <>
          <button
            onClick={prev}
            aria-label="Prev"
            style={{
              position: "absolute",
              left: 16,
              top: "50%",
              transform: "translateY(-50%)",
              background: "rgba(0,0,0,0.6)",
              color: "#fff",
              border: "none",
              padding: "12px 16px",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 16,
              fontWeight: "bold",
            }}
          >
            ‹
          </button>
          <button
            onClick={next}
            aria-label="Next"
            style={{
              position: "absolute",
              right: 16,
              top: "50%",
              transform: "translateY(-50%)",
              background: "rgba(0,0,0,0.6)",
              color: "#fff",
              border: "none",
              padding: "12px 16px",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 16,
              fontWeight: "bold",
            }}
          >
            ›
          </button>
        </>
      )}

      {/* Progress indicator */}
      {gallerySources.length > 1 && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: 16,
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.6)",
            color: "#fff",
            padding: "6px 12px",
            borderRadius: 20,
            fontSize: 14,
          }}
        >
          {index + 1} / {gallerySources.length}
        </div>
      )}
    </div>
  );
};
