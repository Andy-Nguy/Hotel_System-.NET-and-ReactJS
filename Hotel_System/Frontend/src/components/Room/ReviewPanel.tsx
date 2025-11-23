import React from "react";

interface ReviewPanelProps {
  visible: boolean;
  room: any;
  stats: any | null;
  totalReviews: number;
  reviewPanelReviews: any[];
  reviewPanelPage: number;
  reviewPanelPageSize: number;
  loadingReviewPanel: boolean;
  onClose: () => void;
  onSelectReview: (review: any) => void;
  onPageChange: (page: number) => void;
}

const ReviewPanel: React.FC<ReviewPanelProps> = ({
  visible,
  room,
  stats,
  totalReviews,
  reviewPanelReviews,
  reviewPanelPage,
  reviewPanelPageSize,
  loadingReviewPanel,
  onClose,
  onSelectReview,
  onPageChange,
}) => {
  if (!visible) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#fff", zIndex: 12000, overflow: "auto", padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <button
          onClick={onClose}
          style={{ border: "none", background: "none", fontSize: 18, cursor: "pointer" }}
        >
          ← Quay lại chi tiết phòng
        </button>
        <h2 style={{ margin: 0 }}>Đánh giá — {room?.tenPhong}</h2>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 24, marginBottom: 18 }}>
        <div style={{ minWidth: 160 }}>
          <div style={{ fontSize: 34, fontWeight: 800 }}>{stats?.averageRating ?? "—"}</div>
          <div style={{ color: "#666" }}>{totalReviews} đánh giá</div>
        </div>
        <div style={{ flex: 1 }}>
          {stats && stats.ratingDistribution && stats.ratingDistribution.length > 0 ? (
            Array.from({ length: 5 }).map((_, i) => {
              const star = 5 - i;
              const item = stats.ratingDistribution.find((d: any) => d.stars == star);
              const count = item?.count ?? 0;
              const pct = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;
              return (
                <div key={star} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 40 }}>{star}★</div>
                  <div style={{ flex: 1, height: 10, background: "#eee", borderRadius: 6, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: "#C9A043" }} />
                  </div>
                  <div style={{ width: 60, textAlign: "right" }}>{count}</div>
                </div>
              );
            })
          ) : (
            <div style={{ color: "#666" }}>Chưa có đánh giá</div>
          )}
        </div>
      </div>

      {/* Review list (paginated) */}
      <div>
        {loadingReviewPanel ? (
          <div style={{ color: "#666" }}>Đang tải đánh giá…</div>
        ) : reviewPanelReviews && reviewPanelReviews.length > 0 ? (
          <div style={{ display: "grid", gap: 12 }}>
            {reviewPanelReviews.map((r) => (
              <div key={r.id} style={{ border: "1px solid #eee", padding: 12, borderRadius: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ fontWeight: 700 }}>{r.customerName}</div>
                  <div style={{ color: "#C9A043", fontWeight: 700 }}>
                    {"★".repeat(Math.max(0, Math.min(5, r.rating)))}
                  </div>
                </div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{r.title}</div>
                <div style={{ color: "#444", fontSize: 14, marginBottom: 8 }}>
                  {r.content ? (r.content.length > 300 ? r.content.slice(0, 300) + "…" : r.content) : "—"}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ color: "#999", fontSize: 12 }}>{new Date(r.createdAt).toLocaleDateString()}</div>
                  <div>
                    <button
                      onClick={() => onSelectReview(r)}
                      style={{
                        border: "none",
                        background: "none",
                        color: "#4a5a4a",
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                    >
                      Xem chi tiết
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: "#666" }}>Chưa có đánh giá.</div>
        )}
      </div>

      {/* Pagination controls */}
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 18 }}>
        <button
          disabled={reviewPanelPage <= 1}
          onClick={() => onPageChange(Math.max(1, reviewPanelPage - 1))}
          style={{ padding: "8px 12px" }}
        >
          « Trước
        </button>
        <div style={{ alignSelf: "center" }}>Trang {reviewPanelPage}</div>
        <button
          disabled={reviewPanelPage * reviewPanelPageSize >= totalReviews}
          onClick={() => onPageChange(reviewPanelPage + 1)}
          style={{ padding: "8px 12px" }}
        >
          Sau »
        </button>
      </div>
    </div>
  );
};

export default ReviewPanel;
