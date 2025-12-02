import React, { useState } from "react";
import Slidebar from "../components/Slidebar";
import HeaderSection from "../components/HeaderSection";
import { AmenticsRoomSection } from "../components/AmenticsRoomSection";
import { AmenticsSection } from "../components/AmenticsSection";

const AmenticsManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"amenities" | "rooms">(
    "amenities"
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <Slidebar />
      <div style={{ marginLeft: 280 }}>
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
            {/* Tab Navigation */}
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <button
                onClick={() => setActiveTab("amenities")}
                style={{
                  padding: "8px 14px",
                  borderRadius: 10,
                  border:
                    activeTab === "amenities" ? "none" : "1px solid #e5e7eb",
                  background:
                    activeTab === "amenities"
                      ? "linear-gradient(135deg,#059669,#10b981)"
                      : "#fff",
                  color: activeTab === "amenities" ? "#fff" : "#374151",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Danh sách tiện nghi
              </button>
              <button
                onClick={() => setActiveTab("rooms")}
                style={{
                  padding: "8px 14px",
                  borderRadius: 10,
                  border: activeTab === "rooms" ? "none" : "1px solid #e5e7eb",
                  background:
                    activeTab === "rooms"
                      ? "linear-gradient(135deg,#059669,#10b981)"
                      : "#fff",
                  color: activeTab === "rooms" ? "#fff" : "#374151",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Tiện nghi phòng
              </button>
            </div>

            {/* Tab Content */}
            <section>
              {activeTab === "amenities" && <AmenticsSection />}
              {activeTab === "rooms" && <AmenticsRoomSection />}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AmenticsManager;
