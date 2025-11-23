import React from "react";
import BookingSection from "../components/BookingSection";

const BookingManager: React.FC = () => {
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
        <h2 style={{ marginBottom: 16 }}>Quản lý đặt phòng</h2>
        <BookingSection />
      </div>
    </>
  );
};

export default BookingManager;
