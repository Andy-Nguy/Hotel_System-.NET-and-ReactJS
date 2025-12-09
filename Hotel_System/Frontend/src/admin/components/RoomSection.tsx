import React, { useEffect, useState, useRef } from "react";
import {
  Room,
  getRooms,
  getRoomTypes,
  updateRoom,
  deleteRoom,
  RoomType,
} from "../../api/roomsApi";

// --- START: HELPER FUNCTIONS ---

const statusColor = (s?: string | null) => {
  if (!s) return "#6b7280";
  if (s.toLowerCase().includes("trống")) return "#10b981";
  if (s.toLowerCase().includes("bảo trì")) return "#9ca3af";
  if (s.toLowerCase().includes("đang")) return "#f59e0b";
  return "#6b7280";
};

const formatPrice = (v?: number | null) =>
  v ? new Intl.NumberFormat("vi-VN").format(v) : "—";

const statusEmoji = (s?: string | null) => {
  if (!s) return "⚪";
  const low = s.toLowerCase();
  if (low.includes("trống")) return "🟢";
  if (low.includes("đang")) return "🔴";
  if (low.includes("bảo")) return "🟡";
  return "⚪";
};

// Module-level helper so all nested components can use it.
const extractPrimary = (val: any): string => {
  if (!val) return "/img/room/default.webp";
  try {
    if (typeof val === "string") return val;
    if (Array.isArray(val)) {
      if (val.length === 0) return "/img/room/default.webp";
      return extractPrimary(val[0]);
    }
    if (typeof val === "object") {
      const u = (val as any).u;
      if (!u) return "/img/room/default.webp";
      return extractPrimary(u);
    }
  } catch (e) {
    return "/img/room/default.webp";
  }
  return "/img/room/default.webp";
};

// Helper để chuẩn hóa mảng ảnh từ dữ liệu phòng
const normalizeImages = (urlAnhPhong: any): string[] => {
  const images = Array.isArray(urlAnhPhong)
    ? urlAnhPhong
    : typeof urlAnhPhong === 'string' ? [urlAnhPhong] : [];
  return images.filter(url => typeof url === 'string' && url.trim() !== '');
};

// --- END: HELPER FUNCTIONS ---

// ----------------------------------------------------------------------
// --- START: IMAGE PREVIEW MODAL ---

const ImagePreviewModal: React.FC<{
  images: string[];
  initialIndex?: number;
  alt: string;
  visible: boolean;
  onClose: () => void;
}> = ({ images, initialIndex = 0, alt, visible, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  
  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex, visible]);

  if (!visible) return null;

  const normalizedImages = images.length > 0 ? images : ["/img/room/default.webp"];
  const currentImage = normalizedImages[currentIndex];

  const goToPrevious = () => {
    setCurrentIndex((prev) => 
      prev === 0 ? normalizedImages.length - 1 : prev - 1
    );
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % normalizedImages.length);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.9)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: "relative",
          maxWidth: "90vw",
          maxHeight: "90vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Main Image */}
        <img
          src={currentImage}
          alt={alt}
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
          }}
        />

        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 20,
            right: 20,
            background: "rgba(255,255,255,0.2)",
            border: "none",
            width: 40,
            height: 40,
            borderRadius: "50%",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 24,
            color: "white",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.3)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.2)";
          }}
        >
          ✕
        </button>

        {/* Navigation Arrows */}
        {normalizedImages.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); goToPrevious(); }}
              style={{
                position: "absolute",
                left: 20,
                top: "50%",
                transform: "translateY(-50%)",
                background: "rgba(255,255,255,0.2)",
                border: "none",
                width: 50,
                height: 50,
                borderRadius: "50%",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                color: "white",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.2)";
              }}
            >
              ◀
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); goToNext(); }}
              style={{
                position: "absolute",
                right: 20,
                top: "50%",
                transform: "translateY(-50%)",
                background: "rgba(255,255,255,0.2)",
                border: "none",
                width: 50,
                height: 50,
                borderRadius: "50%",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                color: "white",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.2)";
              }}
            >
              ▶
            </button>
          </>
        )}

        {/* Counter Badge */}
        {normalizedImages.length > 1 && (
          <div
            style={{
              position: "absolute",
              bottom: 20,
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(0,0,0,0.6)",
              color: "white",
              padding: "8px 16px",
              borderRadius: 20,
              fontSize: 14,
              fontWeight: 600,
              backdropFilter: "blur(8px)",
            }}
          >
            {currentIndex + 1} / {normalizedImages.length}
          </div>
        )}
      </div>
    </div>
  );
};

// --- END: IMAGE PREVIEW MODAL ---

// --- START: CAROUSEL COMPONENT ---

const RoomImageCarousel: React.FC<{
  images: string[];
  height?: number;
  alt: string;
}> = ({ images, height = 320, alt }) => {
  const normalizedImages = images.length > 0 ? images : ["/img/room/default.webp"];
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showPreview, setShowPreview] = useState(false);

  // Auto-advance carousel every 3 seconds (paused when preview is open)
  useEffect(() => {
    if (normalizedImages.length <= 1 || showPreview) return;
    const intervalId = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % normalizedImages.length);
    }, 3000);
    return () => clearInterval(intervalId);
  }, [normalizedImages.length, showPreview]);

  const currentImage = normalizedImages[currentImageIndex];

  const goToImage = (idx: number) => {
    setCurrentImageIndex(idx);
  };

  return (
    <div
      style={{
        width: "100%",
        marginBottom: 24,
      }}
    >
      {/* Main Carousel Container */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: height,
          borderRadius: 12,
          overflow: "hidden",
          backgroundColor: "#f3f4f6",
          border: "1px solid #e5e7eb",
          boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundImage:
            "linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)",
          backgroundSize: "20px 20px",
          backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
          cursor: "pointer",
        }}
        onClick={() => setShowPreview(true)}
      >
        {/* Main Image */}
        <img
          src={currentImage}
          alt={alt}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
            display: "block",
            margin: 0,
            padding: 0,
            border: "none",
            outline: "none",
          }}
          onError={(e) => {
            e.currentTarget.style.display = "none";
            const container = e.currentTarget.parentElement;
            if (container && !container.querySelector(".placeholder")) {
              const placeholder = document.createElement("div");
              placeholder.className = "placeholder";
              placeholder.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                text-align: center;
                color: #d1d5db;
                font-size: 72px;
              `;
              placeholder.innerHTML = "🏨";
              container.appendChild(placeholder);
            }
          }}
        />

        {/* Counter Badge */}
        {normalizedImages.length > 1 && (
          <div
            style={{
              position: "absolute",
              bottom: 12,
              right: 12,
              background: "rgba(0,0,0,0.6)",
              color: "white",
              padding: "6px 12px",
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              backdropFilter: "blur(8px)",
              zIndex: 15,
            }}
          >
            {currentImageIndex + 1} / {normalizedImages.length}
          </div>
        )}
      </div>

      {/* Thumbnail Navigation (chỉ hiển thị khi > 1 ảnh) */}
      {normalizedImages.length > 1 && (
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 12,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          {normalizedImages.map((imgUrl, idx) => (
            <button
              key={idx}
              onClick={() => goToImage(idx)}
              style={{
                width: 70,
                height: 50,
                borderRadius: 8,
                overflow: "hidden",
                border: idx === currentImageIndex 
                  ? "3px solid #3b82f6" 
                  : "1px solid #d1d5db",
                padding: 0,
                cursor: "pointer",
                background: "transparent",
                transition: "all 0.2s ease",
                boxShadow: idx === currentImageIndex 
                  ? "0 0 0 2px #f0f9ff" 
                  : "0 1px 3px rgba(0,0,0,0.08)",
              }}
              onMouseEnter={(e) => {
                if (idx !== currentImageIndex) {
                  e.currentTarget.style.borderColor = "#9ca3af";
                  e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.12)";
                }
              }}
              onMouseLeave={(e) => {
                if (idx !== currentImageIndex) {
                  e.currentTarget.style.borderColor = "#d1d5db";
                  e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.08)";
                }
              }}
            >
              <img
                src={extractPrimary(imgUrl)}
                alt={`thumb-${idx}`}
                style={{ 
                  width: "100%", 
                  height: "100%", 
                  objectFit: "cover",
                  opacity: idx === currentImageIndex ? 1 : 0.7,
                }}
              />
            </button>
          ))}
        </div>
      )}

      {/* Image Preview Modal */}
      <ImagePreviewModal
        images={normalizedImages}
        initialIndex={currentImageIndex}
        alt={alt}
        visible={showPreview}
        onClose={() => setShowPreview(false)}
      />
    </div>
  );
};

// --- END: CAROUSEL COMPONENT ---
// ----------------------------------------------------------------------

const RoomSection: React.FC = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [types, setTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);

  // filters
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  // detail modal
  const [showDetail, setShowDetail] = useState(false);
  const [detailRoom, setDetailRoom] = useState<Room | null>(null);
  const [detailStartEditing, setDetailStartEditing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [r, t] = await Promise.all([getRooms(), getRoomTypes()]);
      setRooms(r);
      setTypes(t);
    } catch (e) {
      console.error(e);
      alert("Không thể tải danh sách phòng");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = rooms.filter((r) => {
    if (typeFilter && String(r.idloaiPhong) !== String(typeFilter))
      return false;
    if (
      statusFilter &&
      (r.trangThai || "").toLowerCase() !== statusFilter.toLowerCase()
    )
      return false;
    if (query) {
      const q = query.toLowerCase();
      return (
        (r.tenPhong || "").toLowerCase().includes(q) ||
        (r.soPhong || "").toLowerCase().includes(q) ||
        (r.tenLoaiPhong || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const openDetail = (r: Room, edit = false) => {
    setDetailRoom(r);
    setDetailStartEditing(edit);
    setShowDetail(true);
  };
  

  const saveDetail = async (updated: Room) => {
    try {
      // Sanitize status: backend only accepts "Trống" or "Bảo trì" from user updates.
      const payload: Partial<Room> = { ...updated };
      if ((payload.trangThai ?? "").toLowerCase() === "đang sử dụng") {
        // Do not send 'Đang sử dụng' as it's system-calculated; omit the field so backend won't change it.
        delete (payload as any).trangThai;
      }
      await updateRoom(updated.idphong, payload);
      await load();
      setShowDetail(false);
    } catch (e) {
      console.error(e);
      alert("Lỗi lưu phòng");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Xác nhận xóa phòng?")) return;
    try {
      await deleteRoom(id);
      await load();
    } catch (e) {
      console.error(e);
      alert("Lỗi khi xóa phòng");
    }
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <h3 style={{ margin: 0 }}>Danh sách phòng</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            placeholder="Tìm kiếm theo tên, số phòng hoặc loại"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              width: 260,
            }}
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
            }}
          >
            <option value="">-- Tất cả loại --</option>
            {types.map((t) => (
              <option key={t.idLoaiPhong} value={t.idLoaiPhong}>
                {t.tenLoaiPhong}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
            }}
          >
            <option value="">-- Trạng thái --</option>
            <option value="Trống">Trống</option>
            <option value="Đang sử dụng">Đang sử dụng</option>
            <option value="Bảo trì">Bảo trì</option>
          </select>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
          gap: 20,
        }}
      >
        {filtered.map((r) => (
          <div
            key={r.idphong}
            style={{
              background: "#fff",
              borderRadius: 16,
              overflow: "hidden",
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
              border: "1px solid #e5e7eb",
              position: "relative",
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
              margin: 0,
              padding: 0,
              lineHeight: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-4px)";
              e.currentTarget.style.boxShadow = "0 12px 32px rgba(0,0,0,0.16)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.12)";
            }}
          >
            {/* Room Image */}
            <div
              style={{
                position: "relative",
                height: 200,
                width: "100%",
                overflow: "hidden",
                backgroundColor: "#f3f4f6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundImage:
                  "linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)",
                backgroundSize: "20px 20px",
                backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
              }}
            >
              <img
                src={extractPrimary(r.urlAnhPhong)}
                alt={r.tenPhong ?? ""}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "center",
                  transition: "transform 0.3s ease",
                  display: "block",
                  margin: 0,
                  padding: 0,
                  border: "none",
                  outline: "none",
                  backgroundColor: "#f3f4f6",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.transform = "scale(1.05)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.transform = "scale(1)")
                }
                onError={(e) => {
                  // If image fails to load, show placeholder
                  e.currentTarget.style.display = "none";
                  const container = e.currentTarget.parentElement;
                  if (container && !container.querySelector(".placeholder")) {
                    const placeholder = document.createElement("div");
                    placeholder.className = "placeholder";
                    placeholder.style.cssText = `
                      position: absolute;
                      top: 50%;
                      left: 50%;
                      transform: translate(-50%, -50%);
                      text-align: center;
                      color: #d1d5db;
                      font-size: 44px;
                    `;
                    placeholder.innerHTML = "🏨";
                    container.appendChild(placeholder);
                  }
                }}
              />
              {/* Price Tag */}
              <div
                style={{
                  position: "absolute",
                  top: 12,
                  left: 12,
                  background: "linear-gradient(135deg, #1e40af, #3b82f6)",
                  color: "white",
                  padding: "6px 14px",
                  borderRadius: 20,
                  fontSize: 14,
                  fontWeight: 700,
                  boxShadow: "0 4px 12px rgba(30, 64, 175, 0.3)",
                }}
              >
                {formatPrice(r.giaCoBanMotDem)} ₫
              </div>
              {/* Status Badge */}
              <div
                style={{
                  position: "absolute",
                  top: 12,
                  right: 12,
                  background: "rgba(255,255,255,0.95)",
                  padding: "6px 12px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  color: statusColor(r.trangThai),
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                  backdropFilter: "blur(8px)",
                }}
              >
                {statusEmoji(r.trangThai)} {r.trangThai ?? "Chưa rõ"}
              </div>
            </div>

            {/* Room Info */}
            <div
              style={{
                padding: 20,
                margin: 0,
                lineHeight: "normal",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 12,
                }}
              >
                <div>
                  <h4
                    style={{
                      margin: 0,
                      fontSize: 20,
                      fontWeight: 700,
                      color: "#1f2937",
                      lineHeight: 1.3,
                    }}
                  >
                    {r.tenPhong}
                  </h4>
                  <p
                    style={{
                      margin: "6px 0 0",
                      color: "#6b7280",
                      fontSize: 15,
                      fontWeight: 500,
                    }}
                  >
                    {r.tenLoaiPhong}
                  </p>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 20,
                  marginBottom: 16,
                  fontSize: 14,
                  color: "#6b7280",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  👥 {r.soNguoiToiDa ?? "—"} người
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  🏷️ {r.idphong ?? r.soPhong ?? "—"}
                </span>
                {r.xepHangSao && (
                  <span
                    style={{ display: "flex", alignItems: "center", gap: 4 }}
                  >
                    ⭐ {r.xepHangSao} sao
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => openDetail(r)}
                  style={{
                    flex: 1,
                    padding: "12px 16px",
                    borderRadius: 10,
                    border: "1px solid #d1d5db",
                    background: "#f9fafb",
                    color: "#374151",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#f3f4f6";
                    e.currentTarget.style.borderColor = "#9ca3af";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#f9fafb";
                    e.currentTarget.style.borderColor = "#d1d5db";
                  }}
                >
                  👁️ Xem chi tiết
                </button>
                <button
                  onClick={() => openDetail(r, true)}
                  style={{
                    flex: 1,
                    padding: "12px 16px",
                    borderRadius: 10,
                    border: "none",
                    background: "linear-gradient(135deg, #1e40af, #3b82f6)",
                    color: "white",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    boxShadow: "0 4px 12px rgba(30, 64, 175, 0.3)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-1px)";
                    e.currentTarget.style.boxShadow =
                      "0 6px 16px rgba(30, 64, 175, 0.4)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow =
                      "0 4px 12px rgba(30, 64, 175, 0.3)";
                  }}
                >
                  ✏️ Sửa
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showDetail && detailRoom && (
        <RoomDetailModal
          room={detailRoom}
          types={types}
          initialEdit={detailStartEditing}
          onClose={() => {
            setShowDetail(false);
            setDetailStartEditing(false);
          }}
          onSave={saveDetail}
        />
      )}
    </div>
  );
};

// ----------------------------------------------------------------------
// --- START: DETAIL MODAL COMPONENT ---

const RoomDetailModal: React.FC<{
  room: Room;
  types: RoomType[];
  initialEdit?: boolean;
  onClose: () => void;
  onSave: (r: Room) => void;
}> = ({ room, types, initialEdit, onClose, onSave }) => {
  const [form, setForm] = useState<Room>({ ...room });
  const [isEditing, setIsEditing] = useState(initialEdit ?? false);

  useEffect(() => {
    setForm({ ...room });
    if (initialEdit) setIsEditing(true);
  }, [room, initialEdit]);

  // image editor state & helpers
  const [imageUrlInput, setImageUrlInput] = useState<string>("");

  const ImageEditor: React.FC = () => {
    const images = normalizeImages(form.urlAnhPhong);
    
    const handleRemoveImage = (index: number) => {
      if (index === 0) {
        alert("Không thể xóa ảnh chính. Vui lòng thay thế trước.");
        return;
      }
      setForm((prev) => ({
        ...prev,
        urlAnhPhong: prev.urlAnhPhong?.filter((_, i) => i !== index) ?? [],
      }));
    };

    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const fileActionRef = useRef<{ type: 'add' | 'replace' | 'replaceAt'; index?: number } | null>(null);

    const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const action = fileActionRef.current;
        if (action && action.type === 'replace') {
          // replace primary
          setForm((prev) => {
            const updated = Array.isArray(prev.urlAnhPhong) ? [...prev.urlAnhPhong] : [];
            if (updated.length === 0) updated.push(result);
            else updated[0] = result;
            return { ...prev, urlAnhPhong: updated };
          });
        } else if (action && action.type === 'replaceAt' && typeof action.index === 'number') {
          const idx = action.index;
          setForm((prev) => {
            const updated = Array.isArray(prev.urlAnhPhong) ? [...prev.urlAnhPhong] : [];
            while (updated.length <= idx) updated.push("");
            updated[idx] = result;
            return { ...prev, urlAnhPhong: updated };
          });
        } else {
          // add
          setForm((prev) => ({
            ...prev,
            urlAnhPhong: [...(Array.isArray(prev.urlAnhPhong) ? prev.urlAnhPhong : []), result],
          }));
        }
        fileActionRef.current = null;
        setImageUrlInput("");
      };
      reader.readAsDataURL(f);

      // reset so same file can be chosen again if needed
      if (fileInputRef.current) fileInputRef.current.value = "";
    };

    return (
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <label style={{ display: "block", fontWeight: 700, fontSize: 15, color: "#1f2937" }}>
            🖼️ Hình ảnh phòng
          </label>
          <span
            style={{
              fontSize: 13,
              color: "#6b7280",
              background: "#f3f4f6",
              padding: "4px 12px",
              borderRadius: 20,
              fontWeight: 600,
            }}
          >
            {images.length} / 6
          </span>
        </div>

        {/* Main Image Preview */}
        <div
          style={{
            width: "100%",
            height: 180,
            borderRadius: 10,
            overflow: "hidden",
            background: "#f3f4f6",
            marginBottom: 16,
            border: "2px solid #e5e7eb",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            src={extractPrimary(form.urlAnhPhong)}
            alt="primary"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={(e) => {
              e.currentTarget.style.display = "none";
              const container = e.currentTarget.parentElement;
              if (container && !container.querySelector(".placeholder")) {
                const placeholder = document.createElement("div");
                placeholder.className = "placeholder";
                placeholder.style.cssText = `
                  position: absolute;
                  color: #d1d5db;
                  font-size: 48px;
                `;
                placeholder.innerHTML = "🏨";
                container.appendChild(placeholder);
              }
            }}
          />
        </div>

        {/* Action Buttons */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={onFileInputChange}
        />

        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <button
            onClick={() => {
              fileActionRef.current = { type: 'replace' };
              fileInputRef.current?.click();
            }}
            style={{
              flex: 1,
              padding: "10px 16px",
              borderRadius: 8,
              background: "#f59e0b",
              color: "#fff",
              border: "none",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: 14,
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#d97706";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#f59e0b";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            🔄 Thay ảnh chính
          </button>

          <button
            onClick={() => {
              fileActionRef.current = { type: 'add' };
              fileInputRef.current?.click();
            }}
            disabled={images.length >= 6}
            style={{
              flex: 1,
              padding: "10px 16px",
              borderRadius: 8,
              background: images.length >= 6 ? "#d1d5db" : "#10b981",
              color: "#fff",
              border: "none",
              fontWeight: 600,
              cursor: images.length >= 6 ? "not-allowed" : "pointer",
              fontSize: 14,
              transition: "all 0.2s ease",
              opacity: images.length >= 6 ? 0.6 : 1,
            }}
            onMouseEnter={(e) => {
              if (images.length < 6) {
                e.currentTarget.style.background = "#059669";
                e.currentTarget.style.transform = "translateY(-1px)";
              }
            }}
            onMouseLeave={(e) => {
              if (images.length < 6) {
                e.currentTarget.style.background = "#10b981";
                e.currentTarget.style.transform = "translateY(0)";
              }
            }}
          >
            ➕ Thêm ảnh ({images.length < 6 ? 6 - images.length : 0})
          </button>
        </div>

        {/* Image Gallery Grid */}
        {images.length > 0 && (
          <div>
            <p
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#6b7280",
                marginBottom: 10,
                marginTop: 0,
              }}
            >
              Danh sách ảnh
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))",
                gap: 10,
              }}
            >
              {images.map((img, idx) => (
                <div
                  key={idx}
                  style={{
                    position: "relative",
                    width: "100%",
                    height: 90,
                    borderRadius: 8,
                    overflow: "hidden",
                    background: "#f3f4f6",
                    border: idx === 0 ? "2px solid #3b82f6" : "1px solid #e5e7eb",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <img
                    src={extractPrimary(img)}
                    alt={`image-${idx}`}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                  
                  {/* Primary Badge */}
                  {idx === 0 && (
                    <div
                      style={{
                        position: "absolute",
                        top: 2,
                        left: 2,
                        background: "#3b82f6",
                        color: "white",
                        fontSize: 10,
                        padding: "2px 6px",
                        borderRadius: 3,
                        fontWeight: 700,
                      }}
                    >
                      Chính
                    </div>
                  )}

                  {/* Action Buttons (hiện khi hover) */}
                  {idx > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: "rgba(0,0,0,0.6)",
                        display: "flex",
                        gap: 4,
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: 0,
                        transition: "opacity 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = "1";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = "0";
                      }}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          fileActionRef.current = { type: 'replaceAt', index: idx };
                          fileInputRef.current?.click();
                        }}
                        title="Thay thế ảnh này"
                        style={{
                          background: "#1e40af",
                          color: "white",
                          border: "none",
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          cursor: "pointer",
                          fontSize: 13,
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "all 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#1e3a8a";
                          e.currentTarget.style.transform = "scale(1.1)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "#1e40af";
                          e.currentTarget.style.transform = "scale(1)";
                        }}
                      >
                        ✎
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveImage(idx);
                        }}
                        title="Xóa ảnh này"
                        style={{
                          background: "#ef4444",
                          color: "white",
                          border: "none",
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          cursor: "pointer",
                          fontSize: 13,
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "all 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#dc2626";
                          e.currentTarget.style.transform = "scale(1.1)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "#ef4444";
                          e.currentTarget.style.transform = "scale(1)";
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.5)",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 800,
          maxHeight: "90vh",
          overflow: "auto",
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          border: "2px solid #e5e7eb",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
            color: "white",
            padding: "20px 24px",
            borderTopLeftRadius: 14,
            borderTopRightRadius: 14,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>
            Chi tiết phòng
          </h2>
        </div>

        {/* Content */}
        <div style={{ padding: 24 }}>
          {/* Room Image Carousel (UPDATED) */}
          <RoomImageCarousel 
            images={normalizeImages(form.urlAnhPhong)} 
            alt={form.tenPhong ?? "Ảnh phòng"}
          />
          
          {/* Room Info Display */}
          <div
            style={{
              background: "#f8fafc",
              padding: 20,
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              marginBottom: 20,
            }}
          >
            <div
              style={{
                borderBottom: "2px solid #e5e7eb",
                paddingBottom: 16,
                marginBottom: 16,
                textAlign: "center",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: 22,
                  fontWeight: 700,
                  color: "#1f2937",
                }}
              >
                🏞️ {form.tenPhong}
              </h3>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px 24px",
                fontSize: 16,
                lineHeight: 1.6,
              }}
            >
              <div>
                <strong>Mã phòng:</strong> {form.idphong ?? form.soPhong ?? "—"}
              </div>
              <div>
                <strong>Tên phòng:</strong> {form.tenPhong ?? "—"}
              </div>
              <div>
                <strong>Loại phòng:</strong> {form.tenLoaiPhong ?? "—"}
              </div>
              <div>
                <strong>Số phòng:</strong> {form.soPhong ?? "—"}
              </div>
              <div>
                <strong>Số người tối đa:</strong> {form.soNguoiToiDa ?? "—"}
              </div>
              <div>
                <strong>Giá cơ bản:</strong> {formatPrice(form.giaCoBanMotDem)}{" "}
                VND / đêm
              </div>
              <div>
                <strong>Xếp hạng sao:</strong>{" "}
                {form.xepHangSao
                  ? "⭐".repeat(Math.max(0, Math.min(5, form.xepHangSao)))
                  : "—"}
              </div>
              <div>
                <strong>Trạng thái:</strong> {statusEmoji(form.trangThai)}{" "}
                {form.trangThai ?? "—"}
              </div>
            </div>

            {form.moTa && (
              <div
                style={{
                  marginTop: 16,
                  paddingTop: 16,
                  borderTop: "1px solid #e5e7eb",
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Mô tả:</div>
                <div style={{ color: "#6b7280", lineHeight: 1.6 }}>
                  {form.moTa}
                </div>
              </div>
            )}
          </div>

          {/* Edit Form (conditionally rendered) */}
          {isEditing && (
            <div
              style={{
                background: "#fff",
                padding: 20,
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                marginBottom: 20,
              }}
            >
              <h4
                style={{
                  margin: "0 0 16px",
                  fontSize: 18,
                  fontWeight: 600,
                  color: "#1f2937",
                }}
              >
                Chỉnh sửa thông tin
              </h4>
              {/* Image editor: preview, file input and URL input */}
              <ImageEditor />

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontWeight: 600,
                      marginBottom: 4,
                    }}
                  >
                    Tên phòng
                  </label>
                  <input
                    value={form.tenPhong ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, tenPhong: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #d1d5db",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontWeight: 600,
                      marginBottom: 4,
                    }}
                  >
                    Số phòng
                  </label>
                  <input
                    value={form.soPhong ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, soPhong: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #d1d5db",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontWeight: 600,
                      marginBottom: 4,
                    }}
                  >
                    Loại phòng
                  </label>
                  <select
                    value={String(form.idloaiPhong ?? "")}
                    onChange={(e) =>
                      setForm({ ...form, idloaiPhong: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #d1d5db",
                    }}
                  >
                    <option value="">-- Chọn --</option>
                    {types.map((t) => (
                      <option key={t.idLoaiPhong} value={t.idLoaiPhong}>
                        {t.tenLoaiPhong}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontWeight: 600,
                      marginBottom: 4,
                    }}
                  >
                    Giá (VNĐ)
                  </label>
                  <input
                    type="number"
                    value={String(form.giaCoBanMotDem ?? "")}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        giaCoBanMotDem: Number(e.target.value) || 0,
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #d1d5db",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontWeight: 600,
                      marginBottom: 4,
                    }}
                  >
                    Trạng thái
                  </label>
                  <select
                    value={form.trangThai ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, trangThai: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #d1d5db",
                    }}
                  >
                    <option value="Trống">Trống</option>
                    <option value="Bảo trì">Bảo trì</option>
                  </select>
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontWeight: 600,
                      marginBottom: 4,
                    }}
                  >
                    Số người tối đa
                  </label>
                  <input
                    type="number"
                    value={String(form.soNguoiToiDa ?? "")}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        soNguoiToiDa: Number(e.target.value) || 0,
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #d1d5db",
                    }}
                  />
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <label
                  style={{ display: "block", fontWeight: 600, marginBottom: 4 }}
                >
                  Mô tả
                </label>
                <textarea
                  value={form.moTa ?? ""}
                  onChange={(e) => setForm({ ...form, moTa: e.target.value })}
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    resize: "vertical",
                  }}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              paddingTop: 20,
              borderTop: "1px solid #e5e7eb",
            }}
          >
            <button
              onClick={onClose}
              style={{
                padding: "12px 24px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                background: "#f9fafb",
                color: "#374151",
                fontSize: 16,
                fontWeight: 500,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              ⬅️ Quay lại
            </button>

            <div style={{ display: "flex", gap: 12 }}>
              {!isEditing ? (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    style={{
                      padding: "12px 24px",
                      borderRadius: 8,
                      border: "none",
                      background: "#1e40af",
                      color: "white",
                      fontSize: 16,
                      fontWeight: 500,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    ✏️ Sửa thông tin
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setIsEditing(false)}
                    style={{
                      padding: "12px 24px",
                      borderRadius: 8,
                      border: "1px solid #d1d5db",
                      background: "#f9fafb",
                      color: "#374151",
                      fontSize: 16,
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    Hủy
                  </button>
                  <button
                    onClick={() => {
                      onSave(form);
                      setIsEditing(false);
                    }}
                    style={{
                      padding: "12px 24px",
                      borderRadius: 8,
                      border: "none",
                      background: "#059669",
                      color: "white",
                      fontSize: 16,
                      fontWeight: 500,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    💾 Lưu thay đổi
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoomSection;