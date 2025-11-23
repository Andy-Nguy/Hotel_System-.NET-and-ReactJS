import React from "react";

interface ReviewPreviewProps {
  stats: any | null;
  reviews: any[];
  totalReviews: number;
  loadingReviews: boolean;
  reviewError: string | null;
  statsError: string | null;
  onViewAll: () => void;
  onSelectReview: (review: any) => void;
}

const ReviewPreview: React.FC<ReviewPreviewProps> = ({
  stats,
  reviews,
  totalReviews,
  loadingReviews,
  reviewError,
  statsError,
  onViewAll,
  onSelectReview,
}) => {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
      {/* Left: Stats Summary */}
      <div>
        <h5 style={{ marginTop: 0, marginBottom: 8, fontSize: 16, fontWeight: 600 }}>
          Đánh giá phòng
        </h5>
        {/* summary */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>
            {stats?.averageRating ? stats.averageRating : "—"}
          </div>
          <div style={{ color: "#666" }}>
            <div style={{ fontWeight: 600 }}>{totalReviews ?? 0} đánh giá</div>
            <div style={{ color: "#999", fontSize: 13 }}>
              {stats && stats.averageRating
                ? `${stats.averageRating.toFixed(1)} trung bình`
                : "Chưa có đánh giá"}
            </div>
          </div>
        </div>

        {/* distribution */}
        <div style={{ marginBottom: 12 }}>
          {stats && stats.ratingDistribution && stats.ratingDistribution.length > 0 ? (
            <div>
              {Array.from({ length: 5 }).map((_, i) => {
                const star = 5 - i;
                const item = stats.ratingDistribution.find((d: any) => d.stars == star);
                const count = item?.count ?? 0;
                const pct = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;
                return (
                  <div key={star} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 36, fontSize: 13 }}>{star}★</div>
                    <div style={{ flex: 1, height: 8, background: "#eee", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: "#C9A043" }} />
                    </div>
                    <div style={{ width: 40, textAlign: "right", fontSize: 13, color: "#666" }}>{count}</div>
                  </div>
                );
              })}
            </div>
          ) : statsError ? (
            <div style={{ color: "#a00" }}>Lỗi: {statsError}</div>
          ) : (
            <div style={{ color: "#666" }}>Chưa có phân bố đánh giá</div>
          )}
        </div>
      </div>

      {/* Right: Recent Reviews List */}
      <div>
        <h5 style={{ marginTop: 0, marginBottom: 8, fontSize: 16, fontWeight: 600 }}>
          Những đánh giá gần đây
        </h5>
        {loadingReviews ? (
          <div style={{ color: "#666" }}>Đang tải đánh giá…</div>
        ) : reviewError ? (
          <div style={{ color: "#a00" }}>Lỗi tải đánh giá: {reviewError}</div>
        ) : (
          <div>
            {reviews && reviews.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {reviews.map((r) => (
                  <div key={r.id} style={{ border: "1px solid #eee", padding: 12, borderRadius: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div style={{ fontWeight: 700 }}>{r.customerName}</div>
                      <div style={{ color: "#C9A043", fontWeight: 700 }}>
                        {"★".repeat(Math.max(0, Math.min(5, r.rating)))}
                      </div>
                    </div>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>{r.title}</div>
                    <div style={{ color: "#444", fontSize: 14, marginBottom: 8 }}>
                      {r.content
                        ? r.content.length > 140
                          ? r.content.slice(0, 140) + "…"
                          : r.content
                        : "—"}
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
              <div style={{ color: "#666" }}>Chưa có đánh giá cho phòng này.</div>
            )}

            <div style={{ marginTop: 12, textAlign: "center" }}>
              {totalReviews > (reviews?.length ?? 0) ? (
                <button
                  onClick={onViewAll}
                  style={{
                    background: "#C9A043",
                    color: "#fff",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Xem tất cả đánh giá
                </button>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewPreview;
