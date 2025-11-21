import React from "react";

interface ReviewDetailPanelProps {
  visible: boolean;
  selectedReview: any | null;
  onClose: () => void;
  onBackToList: () => void;
}

const ReviewDetailPanel: React.FC<ReviewDetailPanelProps> = ({
  visible,
  selectedReview,
  onClose,
  onBackToList,
}) => {
  if (!visible || !selectedReview) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#fff", zIndex: 12500, overflow: "auto", padding: 20 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 18 }}>
        <button
          onClick={onBackToList}
          style={{ border: "none", background: "none", fontSize: 18, cursor: "pointer" }}
        >
          ← Quay lại danh sách đánh giá
        </button>
        <button
          onClick={onClose}
          style={{ border: "none", background: "none", fontSize: 14, cursor: "pointer", color: "#4a5a4a" }}
        >
          ← Quay lại chi tiết phòng
        </button>
        <h3 style={{ margin: 0 }}>{selectedReview.title}</h3>
      </div>
      <div style={{ border: "1px solid #eee", padding: 16, borderRadius: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>{selectedReview.customerName}</div>
          <div style={{ color: "#C9A043", fontWeight: 700 }}>
            {"★".repeat(Math.max(0, Math.min(5, selectedReview.rating)))}
          </div>
        </div>
        <div style={{ color: "#999", fontSize: 12, marginBottom: 12 }}>
          {new Date(selectedReview.createdAt).toLocaleDateString()}
        </div>
        <div style={{ whiteSpace: "pre-wrap", color: "#333" }}>
          {selectedReview.content || "—"}
        </div>
      </div>
    </div>
  );
};

export default ReviewDetailPanel;
