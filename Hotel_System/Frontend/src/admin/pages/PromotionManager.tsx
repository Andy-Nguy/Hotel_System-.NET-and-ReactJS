import React, { useState, useEffect } from "react";
import Slidebar from "../components/Slidebar";
import HeaderSection from "../components/HeaderSection";
import { getAllPromotions, updateExpiredStatus, Promotion } from "../../api/promotionApi";
import PromotionList from "../components/PromotionList";
import PromotionForm from "../components/PromotionForm";

const PromotionManager: React.FC = () => {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedPromotion, setSelectedPromotion] = useState<Promotion | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [filterDiscountType, setFilterDiscountType] = useState<string | undefined>();

  // Tabs: 'list' = Danh sách khuyến mãi (default), 'form' = Tạo/Chỉnh sửa
  const [activeTab, setActiveTab] = useState<"list" | "form">("list");

  const loadPromotions = async () => {
    try {
      setLoading(true);
      const data = await getAllPromotions(filterStatus, filterDiscountType);
      setPromotions(data);
      console.log("[PROMOTION_MANAGER] Loaded promotions:", data);
    } catch (error) {
      console.error("[PROMOTION_MANAGER] Error loading promotions:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPromotions();
  }, [refreshTrigger, filterStatus, filterDiscountType]);

  const handleUpdateExpired = async () => {
    try {
      setLoading(true);
      const result = await updateExpiredStatus();
      alert(`Cập nhật ${result.count} khuyến mãi thành trạng thái hết hạn`);
      setRefreshTrigger((prev) => prev + 1);
    } catch (error) {
      console.error("[PROMOTION_MANAGER] Error updating expired:", error);
      alert("Lỗi khi cập nhật trạng thái hết hạn");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setSelectedPromotion(null);
    setActiveTab("form");
  };

  const handleEdit = (promotion: Promotion) => {
    setSelectedPromotion(promotion);
    setActiveTab("form");
  };

  const handleFormClose = () => {
    setActiveTab("list");
    setSelectedPromotion(null);
  };

  const handleFormSuccess = () => {
    handleFormClose();
    setRefreshTrigger((prev) => prev + 1);
  };

  const TabBar: React.FC = () => (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <button
        onClick={() => setActiveTab("list")}
        style={{
          padding: "8px 14px",
          borderRadius: 10,
          border: activeTab === "list" ? "none" : "1px solid #e5e7eb",
          background:
            activeTab === "list"
              ? "linear-gradient(135deg,#1e40af,#3b82f6)"
              : "#fff",
          color: activeTab === "list" ? "#fff" : "#374151",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Danh sách khuyến mãi
      </button>
      {showForm && (
        <button
          onClick={() => setActiveTab("form")}
          style={{
            padding: "8px 14px",
            borderRadius: 10,
            border: activeTab === "form" ? "none" : "1px solid #e5e7eb",
            background:
              activeTab === "form"
                ? "linear-gradient(135deg,#1e40af,#3b82f6)"
                : "#fff",
            color: activeTab === "form" ? "#fff" : "#374151",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {selectedPromotion ? "Chỉnh sửa" : "Tạo mới"}
        </button>
      )}
    </div>
  );

  if (loading && promotions.length === 0) {
    return (
      <div style={{ padding: 24, marginLeft: 280 }}>Đang tải dữ liệu...</div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <Slidebar />
      <div style={{ marginLeft: 240 }}>
        <HeaderSection showStats={false} />

        <main style={{ padding: "0px 60px" }}>
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 20,
              boxShadow: "0 8px 24px rgba(2,6,23,0.06)",
            }}
          >
            {/* Tabs: Danh sách khuyến mãi | Tạo/Chỉnh sửa */}
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
              <TabBar />
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
              {activeTab === "list" && (
                <>
                  <button
                    onClick={handleCreateNew}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 10,
                      border: "1px solid #e5e7eb",
                      background: "#fff",
                      color: "#374151",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    + Thêm Khuyến Mãi
                  </button>
                  <button
                    onClick={handleUpdateExpired}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 10,
                      border: "1px solid #e5e7eb",
                      background: "#fff",
                      color: "#374151",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Cập Nhật Hết Hạn
                  </button>
                </>
              )}
            </div>

            <section style={{ marginBottom: 12 }}>
              {/* content switched by TabBar */}
              {activeTab === "list" ? (
                <PromotionList
                  promotions={promotions}
                  onEdit={handleEdit}
                  onRefresh={() => setRefreshTrigger((prev) => prev + 1)}
                  onFilterChange={(status?: string, discountType?: string) => {
                    setFilterStatus(status);
                    setFilterDiscountType(discountType);
                  }}
                />
              ) : (
                <PromotionForm
                  promotion={selectedPromotion}
                  onClose={handleFormClose}
                  onSuccess={handleFormSuccess}
                />
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
};

export default PromotionManager;

