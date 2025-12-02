import React, { useState, useEffect, useRef } from "react";
import {
  getAllPromotions,
  updateExpiredStatus,
  Promotion,
} from "../../api/promotionApi";
import PromotionList from "../components/PromotionList";
import PromotionForm from "../components/PromotionForm";

const PromotionManager: React.FC = () => {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPromotion, setSelectedPromotion] = useState<Promotion | null>(
    null
  );
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [filterDiscountType, setFilterDiscountType] = useState<
    string | undefined
  >();

  // Tabs: 'list' = Danh sách khuyến mãi (default), 'form' = Tạo/Chỉnh sửa
  const [activeTab, setActiveTab] = useState<"list" | "form">("list");

  // Track current request to prevent duplicate calls
  const requestInProgressRef = useRef<Promise<Promotion[]> | null>(null);
  const isMountedRef = useRef(true);

  // Load promotions - runs when filters or refreshTrigger changes
  useEffect(() => {
    const loadPromotions = async () => {
      // If a request is already in progress with same params, reuse it
      if (requestInProgressRef.current) {
        try {
          const data = await requestInProgressRef.current;
          if (isMountedRef.current) {
            setPromotions(data);
            console.log("[PROMOTION_MANAGER] Loaded promotions from cache:", data);
          }
        } catch (error) {
          if (isMountedRef.current) {
            console.error("[PROMOTION_MANAGER] Error loading promotions:", error);
          }
        }
        return;
      }

      // Start new request and cache it
      const newRequest = getAllPromotions(filterStatus, filterDiscountType);
      requestInProgressRef.current = newRequest;

      try {
        const data = await newRequest;
        if (isMountedRef.current && requestInProgressRef.current === newRequest) {
          setPromotions(data);
          console.log("[PROMOTION_MANAGER] Loaded promotions:", data);
        }
      } catch (error) {
        if (isMountedRef.current && requestInProgressRef.current === newRequest) {
          console.error("[PROMOTION_MANAGER] Error loading promotions:", error);
        }
      } finally {
        // Clear cache only if this was the current request
        if (requestInProgressRef.current === newRequest) {
          requestInProgressRef.current = null;
        }
      }
    };

    loadPromotions();

    // Cleanup on unmount
    return () => {
      // Don't clear requestInProgressRef here - let it complete
    };
  }, [refreshTrigger, filterStatus, filterDiscountType]);

  // Track mounted state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Auto-update expired promotions once per day on mount
  useEffect(() => {
    const autoUpdateExpired = async () => {
      console.log("[PROMOTION_MANAGER] ⏰ Checking for auto-update expired promotions");
      const today = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD in local time
      const lastUpdate = localStorage.getItem('lastPromotionUpdateDate');
      console.log("[PROMOTION_MANAGER] 📅 Today:", today, "Last update:", lastUpdate);
      
      // Always try to update - don't skip based on localStorage
      // We'll check if update actually happened and save date only if successful
      console.log("[PROMOTION_MANAGER] 🚀 Calling updateExpiredStatus");
      try {
        const result = await updateExpiredStatus();
        console.log("[PROMOTION_MANAGER] ✅ Update result:", result);
        
        if (result && result.count >= 0) {
          localStorage.setItem('lastPromotionUpdateDate', today);
          console.log("[PROMOTION_MANAGER] 💾 Saved today date to localStorage:", today);
        }
        
        // Small delay to ensure backend has persisted changes
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log("[PROMOTION_MANAGER] ⏳ Delay complete, refreshing promotions");
        setRefreshTrigger((prev) => prev + 1);
        console.log("[PROMOTION_MANAGER] ✨ Auto-updated expired promotions for", today);
      } catch (error) {
        console.error("[PROMOTION_MANAGER] ❌ Error auto-updating expired:", error);
        // Don't save lastUpdate if there was an error - will retry next time
        console.log("[PROMOTION_MANAGER] 🔄 Will retry update next time");
      }
    };
    
    // Add small delay to ensure component is fully mounted
    const timer = setTimeout(() => {
      autoUpdateExpired();
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

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
    </div>
  );

  if (loading && promotions.length === 0) {
    return <div style={{ padding: 24 }}>Đang tải dữ liệu...</div>;
  }

  return (
    <>
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 20,
          boxShadow: "0 8px 24px rgba(2,6,23,0.06)",
        }}
      >
        {/* Tabs: Danh sách khuyến mãi | Tạo/Chỉnh sửa */}
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <TabBar />
        </div>

        {/* Action buttons */}
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            marginBottom: 16,
          }}
        >
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
    </>
  );
};

export default PromotionManager;
