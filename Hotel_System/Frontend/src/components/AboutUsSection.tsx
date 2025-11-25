import React, { useState } from "react";

const AboutUsSection: React.FC = () => {
  const handleNavigate = (path: string) => {
    window.location.pathname = path;
  };

  const [isButtonHovered, setIsButtonHovered] = useState(false);
  const [isButtonPressed, setIsButtonPressed] = useState(false);
  const [isLinkHovered, setIsLinkHovered] = useState(false);

  return (
    // Tăng padding và thêm overflow
    <section style={{ padding: "80px 0", background: "#fdfcfb", overflow: "hidden" }}>
      <div className="container">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 50, // Tăng khoảng cách
            flexWrap: "wrap",
          }}
        >
          {/* Cột hình ảnh - Tinh chỉnh bóng đổ và bo góc */}
          <div style={{ flex: "1 1 45%", minWidth: 300, position: "relative" }}>
            <div style={{ position: "relative", height: 400 }}>
              <div style={{ borderRadius: 16, overflow: "hidden", boxShadow: "0 15px 45px rgba(0,0,0,0.15)", height: "100%", width: "95%" }}>
                <img
                  src="/img/about/about-1.png"
                  alt="Robins Villa"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              </div>

              <div
                style={{
                  position: "absolute",
                  right: 0,
                  bottom: -30, // Đẩy xuống một chút
                  width: "50%", // Tăng kích thước
                  height: 220,
                  borderRadius: 16,
                  overflow: "hidden",
                  boxShadow: "0 12px 35px rgba(0,0,0,0.2)",
                  border: "8px solid #fff", // Border dày hơn
                  background: "#fff",
                }}
              >
                <img
                  src="/img/about/about-21.jpg"
                  alt="Không gian Villa"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              </div>
            </div>
          </div>

          {/* Cột văn bản - Bổ sung thông tin */}
          <div style={{ flex: "1 1 50%", minWidth: 300, paddingLeft: "15px" }}>
            <div style={{ paddingRight: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#dfa974", textTransform: "uppercase", letterSpacing: "2px" }}>
                Chào mừng đến với
              </span>

              <h2 style={{ fontSize: 40, fontWeight: 700, color: "#19191a", marginTop: 10, marginBottom: 16, lineHeight: 1.2 }}>
                Robins Villa Đà Lạt
              </h2>

              <div style={{ width: 60, height: 4, background: "#dfa974", borderRadius: 4, marginBottom: 24 }} />

              <p style={{ fontSize: 16, color: "#444", lineHeight: 1.9, marginBottom: 24 }}>
                Robins Villa là khách sạn boutique nằm trong khu vực yên tĩnh, gần trung tâm Đà Lạt — một nơi lưu giữ vẻ đẹp dịu dàng và sự thư thái cho kỳ nghỉ của bạn.
              </p>

              {/* --- PHẦN BỔ SUNG THÔNG TIN --- */}
              <ul style={{ listStyle: "none", padding: 0, margin: "24px 0 28px 0" }}>
                <li style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <span style={{ fontSize: 20, lineHeight: 1 }}>🌿</span>
                  <span style={{ fontSize: 16, color: "#333", fontWeight: 500 }}>View thung lũng & sân vườn BBQ yên tĩnh</span>
                </li>
                 <li style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <span style={{ fontSize: 20, lineHeight: 1 }}>📍</span>
                  <span style={{ fontSize: 16, color: "#333", fontWeight: 500 }}>Vị trí trung tâm, thuận tiện di chuyển</span>
                </li>
                <li style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <span style={{ fontSize: 20, lineHeight: 1 }}>☕</span>
                  <span style={{ fontSize: 16, color: "#333", fontWeight: 500 }}>Dịch vụ cafe & bữa sáng tại phòng</span>
                </li>
              </ul>
              {/* --- KẾT THÚC PHẦN BỔ SUNG --- */}

              <p style={{ fontSize: 16, color: "#555", lineHeight: 1.8, marginBottom: 30 }}>
                Với hệ thống phòng hiện đại và dịch vụ tận tâm, Robins Villa là lựa chọn lý tưởng cho chuyến đi lãng mạn, gia đình hoặc công tác của bạn.
              </p>

              {/* --- NÚT BẤM (CTAs) VỚI HIỆU ỨNG HOVER --- */}
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <button
                  onClick={() => handleNavigate("/AboutUsPage")}
                  style={{
                    padding: "14px 30px", // Tăng padding
                    background: "#dfa974",
                    color: "#fff",
                    border: "none",
                    borderRadius: 12, // Bo góc nhiều hơn
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: "pointer",
                    // Hiệu ứng động
                    boxShadow: isButtonHovered ? "0 12px 30px rgba(223,169,116,0.45)" : "0 8px 26px rgba(223,169,116,0.3)",
                    transition: "all 0.3s ease",
                    transform: isButtonPressed ? "translateY(1px)" : (isButtonHovered ? "translateY(-3px)" : "translateY(0)"),
                  }}
                  onMouseEnter={() => setIsButtonHovered(true)}
                  onMouseLeave={() => setIsButtonHovered(false)}
                  onMouseDown={() => setIsButtonPressed(true)}
                  onMouseUp={() => setIsButtonPressed(false)}
                >
                  Khám Phá Thêm
                </button>

                <a
                  href="/rooms"
                  style={{
                    // color: "#333", // <-- XOÁ DÒNG NÀY ĐI
                    fontWeight: 700,
                    textDecoration: "none",
                    padding: "14px 22px", // Đồng bộ padding
                    borderRadius: 12,
                    transition: "all 0.3s ease",
                    // Hiệu ứng hover
                    background: isLinkHovered ? "rgba(223,169,116,0.1)" : "transparent",
                    color: isLinkHovered ? "#000" : "#333", // <-- THUỘC TÍNH NÀY ĐÚNG
                  }}
                  onMouseEnter={() => setIsLinkHovered(true)}
                  onMouseLeave={() => setIsLinkHovered(false)}
                >
                  Đặt Phòng Ngay →
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutUsSection;