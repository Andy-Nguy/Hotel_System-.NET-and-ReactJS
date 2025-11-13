import React from "react";
import Slidebar from "../components/Slidebar";
import HeaderSection from "../components/HeaderSection";
import BookingSection from "../components/BookingSection";

const BookingManager: React.FC = () => {
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
            <h2 style={{ marginBottom: 16 }}>Quản lý đặt phòng</h2>
            <BookingSection />
          </div>
        </main>
      </div>
    </div>
  );
};

export default BookingManager;
