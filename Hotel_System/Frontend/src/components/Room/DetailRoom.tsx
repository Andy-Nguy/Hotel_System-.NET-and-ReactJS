import React, { useEffect, useState, useRef } from "react";
import { getAmenitiesForRoom } from "../../api/amenticsApi";
import ReviewPreview from "./ReviewPreview";
import { API_CONFIG } from "../../api/config";
import { Modal, Button } from "antd";
import type { Room } from "../../../../Frontend/src/api/roomsApi";
import type { Promotion } from "../../../../Frontend/src/api/promotionApi";
import { getAllPromotions } from "../../../../Frontend/src/api/promotionApi";
import dayjs from "dayjs";

const BACKEND_BASE = `${API_CONFIG.CURRENT}/api`;

// ==================================================================
// HELPER FUNCTION: RESOLVE IMAGE URL (GIỮ NGUYÊN)
// ==================================================================

function resolveImageUrl(u?: string | null) {
  if (!u) return undefined;
  const s = String(u).trim();
  if (!s) return undefined;
  if (s.startsWith("http") || s.startsWith("//")) return s;
  if (s.startsWith("/img")) return s;
  if (s.startsWith("/")) return s;
  return `/img/room/${s}`;
}

type Props = {
  visible: boolean;
  room?: Room | null;
  onClose: () => void;
  onBook: (room: Room) => void;
};

// ==================================================================
// IMAGE PREVIEW MODAL (GIỐNG KIỂU PROMOTIONSECTION)
// ==================================================================

const ImagePreviewModal: React.FC<{
  images: string[];
  initialIndex?: number;
  visible: boolean;
  onClose: () => void;
}> = ({ images, initialIndex = 0, visible, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isAutoPlay, setIsAutoPlay] = useState(true);
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const translateStartRef = useRef<{ x: number; y: number } | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [rotation, setRotation] = useState(0);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex, visible]);

  // Auto-play carousel
  useEffect(() => {
    if (!isAutoPlay || images.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [isAutoPlay, images.length]);

  if (!visible) return null;

  const normImages = images.length > 0 ? images : ["/img/room/room-1.jpg"];
  const currentImage = normImages[currentIndex];

  const goToImage = (idx: number) => {
    setIsAutoPlay(false);
    setCurrentIndex(idx);
    // reset zoom/pan when switching image
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
    setRotation(0);
    setFlipped(false);
  };

  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    const delta = e.deltaY;
    const factor = delta > 0 ? 0.9 : 1.1; // scroll down = zoom out, up = zoom in
    const newScale = clamp(scale * factor, 1, 4);
    if (newScale === scale) return;

    // adjust translate so zoom focuses around pointer
    const relX = offsetX - rect.width / 2;
    const relY = offsetY - rect.height / 2;
    const scaleRatio = newScale / scale;

    setTranslateX((tx) => tx - relX * (scaleRatio - 1));
    setTranslateY((ty) => ty - relY * (scaleRatio - 1));
    setScale(newScale);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    e.preventDefault();
    setIsPanning(true);
    panStartRef.current = { x: e.clientX, y: e.clientY };
    translateStartRef.current = { x: translateX, y: translateY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning || !panStartRef.current || !translateStartRef.current) return;
    e.preventDefault();
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setTranslateX(translateStartRef.current.x + dx);
    setTranslateY(translateStartRef.current.y + dy);
  };

  const endPan = () => {
    setIsPanning(false);
    panStartRef.current = null;
    translateStartRef.current = null;
  };

  const handleDoubleClick = () => {
    // reset zoom
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
  };

  const rotateClockwise = () => {
    setRotation((r) => (r + 90) % 360);
  };

  const toggleFlip = () => {
    setFlipped((f) => !f);
  };

  const zoomIn = () => {
    setIsAutoPlay(false);
    setScale((s) => clamp(s * 1.2, 1, 4));
  };

  const zoomOut = () => {
    setIsAutoPlay(false);
    setScale((s) => clamp(s / 1.2, 1, 4));
    if (scale <= 1.05) {
      // reset pan when returning to 1
      setTranslateX(0);
      setTranslateY(0);
    }
  };



  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.98)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 20000,
        padding: "20px 0",
      }}
      onClick={onClose}
    >
      {/* Main Container */}
      <div
        style={{
          position: "relative",
          maxWidth: "90vw",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#1a1a1a",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Main Image */}
        <div
          ref={containerRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={(e) => {
            e.preventDefault();
            endPan();
          }}
          onMouseLeave={(e) => {
            e.preventDefault();
            endPan();
          }}
          onDoubleClick={handleDoubleClick}
          style={{
            position: "relative",
            width: "100%",
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#000",
            overflow: "hidden",
            cursor: isPanning ? "grabbing" : scale > 1 ? "grab" : "zoom-in",
          }}
        >
          {/* Toolbar (rotate / flip / download / zoom) */}
          <div
            style={{
              position: "absolute",
              top: 12,
              right: 64,
              display: "flex",
              gap: 8,
              zIndex: 20,
              background: "rgba(0,0,0,0.35)",
              padding: "6px",
              borderRadius: 8,
              alignItems: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              title="Zoom out"
              onClick={zoomOut}
              style={{
                width: 36,
                height: 36,
                borderRadius: 6,
                border: "none",
                background: "rgba(255,255,255,0.08)",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              −
            </button>
            <button
              title="Zoom in"
              onClick={zoomIn}
              style={{
                width: 36,
                height: 36,
                borderRadius: 6,
                border: "none",
                background: "rgba(255,255,255,0.08)",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              +
            </button>
            <button
              title="Rotate"
              onClick={rotateClockwise}
              style={{
                width: 36,
                height: 36,
                borderRadius: 6,
                border: "none",
                background: "rgba(255,255,255,0.08)",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              ↻
            </button>
            <button
              title="Flip horizontal"
              onClick={toggleFlip}
              style={{
                width: 36,
                height: 36,
                borderRadius: 6,
                border: "none",
                background: flipped ? "#f59e0b" : "rgba(255,255,255,0.08)",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              ⇋
            </button>
            {/* download removed per request */}
          </div>

          <img
            ref={imgRef}
            src={currentImage}
            alt="preview"
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              display: "block",
              animation: "fadeIn 0.3s ease-in-out",
              transform: `translate(${translateX}px, ${translateY}px) rotate(${rotation}deg) scale(${scale}) scaleX(${flipped ? -1 : 1})`,
              transition: isPanning ? "none" : "transform 0.15s ease",
            }}
          />

          {/* Close Button - Top Right */}
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              background: "rgba(255,255,255,0.95)",
              border: "none",
              width: 40,
              height: 40,
              borderRadius: "50%",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              color: "#000",
              fontWeight: "bold",
              transition: "all 0.2s ease",
              zIndex: 10,
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#fff";
              e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.4)";
              e.currentTarget.style.transform = "scale(1.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.95)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            ✕
          </button>

          {/* Navigation arrows removed per request */}

          {/* Counter Badge - Bottom Left */}
          {normImages.length > 1 && (
            <div
              style={{
                position: "absolute",
                bottom: 16,
                left: 16,
                background: "rgba(0,0,0,0.75)",
                color: "white",
                padding: "8px 14px",
                borderRadius: 24,
                fontSize: 13,
                fontWeight: 600,
                backdropFilter: "blur(10px)",
                zIndex: 10,
              }}
            >
              {currentIndex + 1} / {normImages.length}
            </div>
          )}
        </div>

        {/* Bottom Thumbnails */}
        {normImages.length > 1 && (
          <div
            style={{
              width: "100%",
              background: "#1a1a1a",
              padding: "12px 16px",
              display: "flex",
              gap: 10,
              justifyContent: "center",
              alignItems: "center",
              overflowX: "auto",
              borderTop: "1px solid #333",
            }}
          >
            {normImages.map((imgUrl, idx) => (
              <button
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  goToImage(idx);
                }}
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 6,
                  overflow: "hidden",
                  cursor: "pointer",
                  border: idx === currentIndex ? "3px solid #f59e0b" : "2px solid #444",
                  background: "none",
                  padding: 0,
                  transition: "all 0.3s ease",
                  flexShrink: 0,
                  boxShadow: idx === currentIndex ? "0 0 12px rgba(245,158,11,0.5)" : "none",
                }}
                onMouseEnter={(e) => {
                  if (idx !== currentIndex) {
                    e.currentTarget.style.borderColor = "#f59e0b";
                    e.currentTarget.style.transform = "scale(1.08)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (idx !== currentIndex) {
                    e.currentTarget.style.borderColor = "#444";
                    e.currentTarget.style.transform = "scale(1)";
                  }
                }}
              >
                <img
                  src={imgUrl}
                  alt={`thumbnail-${idx}`}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    opacity: idx === currentIndex ? 1 : 0.7,
                  }}
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* CSS Animation */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0.8;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

// ==================================================================
// COMPONENT HIỂN THỊ HÌNH ẢNH (ĐÃ CẬP NHẬT CAROUSEL VÀ THUMBNAILS)
// ==================================================================

// ==================================================================
// COMPONENT HIỂN THỊ HÌNH ẢNH (ĐÃ CẬP NHẬT CAROUSEL VÀ THUMBNAILS)
// ==================================================================

type DetailImageProps = { srcHint?: string | null | string[]; alt?: string };

const DetailImage: React.FC<DetailImageProps> = ({ srcHint, alt }) => {
  const defaultJpg = "/img/room/room-1.jpg";
  const [index, setIndex] = useState(0);
  const [showPreview, setShowPreview] = useState(false);

  // Hàm trích xuất và chuẩn hóa nguồn ảnh từ chuỗi/mảng
  const makeCandidates = (u?: string | null) => {
    const out: string[] = [];
    if (!u) return out;
    const parts = String(u)
      .split(/[,|;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    
    for (const p of parts) {
      if (p.startsWith("http") || p.startsWith("//") || p.startsWith("/img") || p.startsWith("/")) {
        out.push(p);
      } else {
        out.push(`/img/room/${p}`);
      }
    }
    return out;
  };
  
  // Xử lý srcHint (bao gồm cả trường hợp mảng mới)
  const gallerySources = (() => {
    if (!srcHint) return [defaultJpg];
    
    let resolved: string[] = [];
    if (Array.isArray(srcHint)) {
      for (const img of srcHint) {
        resolved.push(...makeCandidates(img));
      }
    } else {
      resolved.push(...makeCandidates(srcHint));
    }
    const uniqueSources = Array.from(new Set(resolved));
    return uniqueSources.length ? uniqueSources : [defaultJpg];
  })();

  // Logic Timer (5 giây - auto-advance tắt khi modal mở)
  useEffect(() => {
    if (gallerySources.length <= 1) return;
    
    // Tắt auto-advance khi modal preview mở
    if (showPreview) return;

    const intervalId = setInterval(() => {
      setIndex((prevIndex) => (prevIndex + 1) % gallerySources.length);
    }, 5000); // 5000ms = 5 giây

    return () => clearInterval(intervalId);
  }, [gallerySources.length, showPreview]);

  const displaySrc = gallerySources[index] ?? defaultJpg;

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
        cursor: "pointer",
      }}
      onClick={() => setShowPreview(true)}
    >
      {/* Ảnh chính */}
      <img
        src={displaySrc}
        alt={alt}
        crossOrigin="anonymous"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
        }}
      />

      {/* Ảnh con (Thumbnails) ở góc phải */}
      {gallerySources.length > 1 && (
        <div
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            maxHeight: "calc(100% - 32px)",
            overflowY: "auto",
            zIndex: 10,
            padding: 5,
            borderRadius: 8,
            background: "rgba(0,0,0,0.4)",
          }}
        >
          {gallerySources.map((imgUrl, idx) => (
            <div
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                setIndex(idx);
              }}
              style={{
                width: 70,
                height: 50,
                borderRadius: 6,
                overflow: "hidden",
                cursor: "pointer",
                border: idx === index 
                  ? "3px solid #f59e0b"
                  : "1px solid #fff",
                boxShadow: idx === index ? "0 0 0 1px #f59e0b" : "none",
                flexShrink: 0,
              }}
            >
              <img
                src={imgUrl}
                alt={`thumbnail-${idx}`}
                style={{ 
                  width: "100%", 
                  height: "100%", 
                  objectFit: "cover",
                  opacity: idx === index ? 1 : 0.8,
                }}
              />
            </div>
          ))}
        </div>
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

      {/* Preview Modal */}
      <ImagePreviewModal
        images={gallerySources}
        initialIndex={index}
        visible={showPreview}
        onClose={() => setShowPreview(false)}
      />
    </div>
  );
};

// ==================================================================
// COMPONENT DETAIL ROOM (ĐÃ CẬP NHẬT LOGIC HIỂN THỊ GIÁ)
// ==================================================================

const DetailRoom: React.FC<Props> = ({ visible, room, onClose, onBook }) => {
  if (!room) return null;

  const [promotion, setPromotion] = React.useState<Promotion | null>(null);

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

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!room?.idphong) return;
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

  // Reviews & stats state
  const [stats, setStats] = useState<any | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [selectedReview, setSelectedReview] = useState<any | null>(null);
  // Panel states
  const [showReviewPanel, setShowReviewPanel] = useState(false);
  const [showReviewDetailPanel, setShowReviewDetailPanel] = useState(false);
  const [totalReviews, setTotalReviews] = useState(0);
  const [reviewPanelReviews, setReviewPanelReviews] = useState<any[]>([]);
  const [loadingReviewPanel, setLoadingReviewPanel] = useState(false);
  const [reviewPanelPage, setReviewPanelPage] = useState(1);
  const [reviewPanelPageSize] = useState(10);

  useEffect(() => {
    let cancelled = false;
    const fetchStats = async () => {
      if (!room?.idphong) return;
      setLoadingStats(true);
      try {
        setStatsError(null);
        const res = await fetch(
          `${BACKEND_BASE}/Review/room/${room.idphong}/stats`
        );
        if (!res.ok) {
          const txt = await res.text().catch(() => null);
          console.error("Failed to fetch stats", res.status, txt);
          if (!cancelled) setStatsError(txt || `HTTP ${res.status}`);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setStats(data);
        setTotalReviews(data.totalReviews ?? 0);
      } catch (err) {
        console.debug("Failed to load room stats", err);
        if (!cancelled) setStatsError(String(err));
      } finally {
        if (!cancelled) setLoadingStats(false);
      }
    };

    const fetchReviews = async (page = 1, pageSize = 3) => {
      if (!room?.idphong) return;
      setLoadingReviews(true);
      try {
        setReviewError(null);
        const res = await fetch(
          `${BACKEND_BASE}/Review/room/${room.idphong}/reviews?page=${page}&pageSize=${pageSize}`
        );
        if (!res.ok) {
          const txt = await res.text().catch(() => null);
          console.error("Failed to fetch reviews", res.status, txt);
          if (!cancelled) setReviewError(txt || `HTTP ${res.status}`);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setReviews(data.reviews ?? []);
        setTotalReviews(data.total ?? 0);
      } catch (err) {
        console.debug("Failed to load room reviews", err);
        if (!cancelled) setReviewError(String(err));
      } finally {
        if (!cancelled) setLoadingReviews(false);
      }
    };

    fetchStats();
    fetchReviews();

    return () => {
      cancelled = true;
    };
  }, [room?.idphong]);

  // load all reviews when user opens the 'all reviews' modal
  // load reviews for the ReviewPanel when opened or page changes
  useEffect(() => {
    if (!showReviewPanel) return;
    let cancelled = false;
    const loadPage = async (page = reviewPanelPage) => {
      if (!room?.idphong) return;
      setLoadingReviewPanel(true);
      try {
        const res = await fetch(
          `${BACKEND_BASE}/Review/room/${room.idphong}/reviews?page=${page}&pageSize=${reviewPanelPageSize}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setReviewPanelReviews(data.reviews ?? []);
        setTotalReviews(data.total ?? 0);
      } catch (err) {
        console.debug("Failed to load review panel page", err);
      } finally {
        if (!cancelled) setLoadingReviewPanel(false);
      }
    };
    loadPage(reviewPanelPage);
    return () => {
      cancelled = true;
    };
  }, [showReviewPanel, reviewPanelPage, room?.idphong]);

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

        {/* === ROW 2: FULL-BLEED IMAGE (ĐÃ CẬP NHẬT) === */}
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
              srcHint={Array.isArray(room.urlAnhPhong) ? room.urlAnhPhong : room.urlAnhPhong ?? undefined}
              alt={room.tenPhong || "phong"}
            />
          </div>
        </div>

        {/* === ROW 3: ROOM INFORMATION (Thêm lại padding) === */}
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

              {/* === PHẦN HIỂN THỊ GIÁ ĐÃ ĐIỀU CHỈNH === */}
              <div>
                <div style={{ color: "#666", marginBottom: 6 }}>Giá: </div>
                {room.giaCoBanMotDem != null ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    {promotion && room.giaCoBanMotDem != null ? (
                      <>
                        {/* Giá gốc (Gạch ngang, màu xám) */}
                        <div
                          style={{
                            fontSize: 18,
                            fontWeight: 500,
                            color: "#9ca3af",
                            textDecoration: "line-through",
                            lineHeight: 1,
                          }}
                        >
                          {room.giaCoBanMotDem.toLocaleString("vi-VN")}
                          <span style={{ fontSize: 13, marginLeft: 5 }}>₫/đêm</span>
                        </div>

                        {/* Giá Khuyến mãi (Màu xanh lá đậm, font lớn) */}
                        <div
                          style={{
                            fontSize: 28,
                            fontWeight: 700,
                            color: "#059669", 
                            lineHeight: 1,
                          }}
                        >
                          {(promotion.loaiGiamGia === "percent"
                            ? Math.max(
                                0,
                                Math.round(
                                  (room.giaCoBanMotDem || 0) *
                                    (1 - (promotion.giaTriGiam || 0) / 100)
                                )
                              )
                            : Math.max(
                                0,
                                Math.round(
                                  (room.giaCoBanMotDem || 0) -
                                    (promotion.giaTriGiam || 0)
                                )
                              )
                          ).toLocaleString("vi-VN")}
                          <span
                            style={{
                              fontSize: 16,
                              fontWeight: 600,
                              color: "#111827",
                              marginLeft: 8,
                            }}
                          >
                            ₫/đêm
                          </span>
                        </div>
                      </>
                    ) : (
                      // 2. GIÁ GỐC (KHÔNG CÓ KHUYẾN MÃI)
                      <div
                        style={{
                          fontSize: 28,
                          fontWeight: 700,
                          color: "#111827",
                          lineHeight: 1,
                        }}
                      >
                        {room.giaCoBanMotDem.toLocaleString("vi-VN")}
                        <span
                          style={{
                            fontSize: 16,
                            fontWeight: 600,
                            color: "#4b5563",
                            marginLeft: 8,
                          }}
                        >
                          ₫/đêm
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ color: "#111827", fontWeight: 700 }}>
                    Liên hệ
                  </div>
                )}
              </div>
              {/* === KẾT THÚC PHẦN GIÁ ĐÃ ĐIỀU CHỈNH === */}
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

          {/* === Reviews Overview & List === */}
          <ReviewPreview
            stats={stats}
            reviews={reviews}
            totalReviews={totalReviews}
            loadingReviews={loadingReviews}
            reviewError={reviewError}
            statsError={statsError}
            onViewAll={() => setShowReviewPanel(true)}
            onSelectReview={(review) => {
              setSelectedReview(review);
              setShowReviewDetailPanel(true);
            }}
          />
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