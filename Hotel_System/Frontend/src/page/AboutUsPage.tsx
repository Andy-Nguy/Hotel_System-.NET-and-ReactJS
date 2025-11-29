import React, { useState } from "react";

const AboutUsPage: React.FC = () => {
  // Fallback navigation that works without a Router
  const handleNavigate = (path: string) => {
    try {
      // try to use history API for clean navigation
      window.history.pushState(null, "", path);
      // trigger popstate listeners in app
      window.dispatchEvent(new PopStateEvent("popstate"));
    } catch (e) {
      window.location.pathname = path;
    }
  };

  // State cho hiệu ứng hover của các nút
  const [isPrimaryHovered, setIsPrimaryHovered] = useState(false);
  // const [isSecondaryHovered, setIsSecondaryHovered] = useState(false); // Đã bỏ nếu không dùng

  // State cho hiệu ứng hover của ảnh
  const [isImg1Hovered, setIsImg1Hovered] = useState(false);
  const [isImg2Hovered, setIsImg2Hovered] = useState(false);

  // State cho hover của thẻ Team
  const [hoveredTeamMember, setHoveredTeamMember] = useState<number | null>(null);
  
  // State cho hover của thẻ Core Value
  const [hoveredCoreValue, setHoveredCoreValue] = useState<number | null>(null);

  // --- Định nghĩa một số Style lặp lại cho dễ quản lý ---
  const headingStyle: React.CSSProperties = {
    fontSize: "36px", // Điều chỉnh kích thước cho tiêu đề phụ
    fontWeight: 700,
    color: "#222",
    marginBottom: "16px",
    borderLeft: "4px solid #dfa974",
    paddingLeft: "12px",
    lineHeight: 1.3,
  };

  const paragraphStyle: React.CSSProperties = {
    fontSize: "16px",
    color: "#555",
    lineHeight: 1.8,
    marginBottom: "20px",
  };

  const sectionStyle: React.CSSProperties = {
    padding: "80px 0",
  };

  const teamData = [
    { id: 1, name: "Nguyễn Phương Anh", role: "Quản lý tài sản khách sạn", icon: "👩‍💼" },
    { id: 2, name: "Nguyễn Dương Lệ Chi", role: "Quản lý check-in check-out", icon: "👩‍💼" },
    { id: 3, name: "Nguyễn Tô Duy Anh", role: "Quản lý toàn bộ hệ thống khách sạn", icon: "👨‍💻" },
  ];
  
  const coreValues = [
    { id: 1, icon: "✨", title: "Tinh Tế", description: "Mọi chi tiết được chăm chút để mang lại trải nghiệm ấm cúng, riêng tư và đáng nhớ." },
    { id: 2, icon: "💖", title: "Hiếu Khách", description: "Phục vụ bằng sự chân thành, luôn sẵn lòng hỗ trợ du khách như người nhà." },
    { id: 3, icon: "🌿", title: "Bình Yên", description: "Kiến tạo không gian nghỉ dưỡng giúp du khách tái tạo năng lượng và 'chữa lành'." },
  ];
  // ---------------------------------------------------

  // Thay đổi <section> thành <div> hoặc <main> để chứa nhiều section con
  return (
    <main>
      {/* === PHẦN 1: GIỚI THIỆU CHUNG (HERO SECTION) === */}
      <section style={{ ...sectionStyle, background: "#fdfcfb" }}>
        <div className="container">
          <div className="row" style={{ alignItems: "center", rowGap: "60px" }}>
            {/* Cột Văn bản (Nội dung) */}
            <div className="col-lg-6">
              <div style={{ paddingRight: "30px" }}>
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#dfa974",
                    textTransform: "uppercase",
                    letterSpacing: "2px",
                  }}
                >
                  Về Chúng Tôi
                </span>
                <h1
                  style={{
                    fontSize: "48px",
                    fontWeight: 700,
                    color: "#19191a",
                    marginTop: "12px",
                    marginBottom: "24px",
                    lineHeight: "1.2",
                  }}
                >
                  Chào mừng đến Robins Villa
                </h1>

                <p style={{ ...paragraphStyle, fontSize: "17px", color: "#333" }}>
                  Tọa lạc tại vị trí đắc địa của Đà Lạt, Robins Villa không chỉ là một nơi dừng chân, mà là một **ốc đảo bình yên** nơi sự sang trọng tinh tế và lòng hiếu khách nồng hậu giao thoa.
                </p>
                <p style={paragraphStyle}>
                  Chúng tôi tin rằng mỗi kỳ nghỉ là một hành trình kiếm tìm sự thư thái. Robins Villa được thiết kế để mang đến không gian nghỉ dưỡng ấm cúng, riêng tư và đầy đủ tiện nghi cho du khách muốn "chữa lành" tâm hồn giữa thành phố ngàn hoa.
                </p>

                {/* Nút bấm (CTAs) với State Hover */}
                <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginTop: "40px" }}>
                  <button
                    onClick={() => handleNavigate("/rooms")}
                    style={{
                      padding: "16px 36px",
                      background: isPrimaryHovered ? "#c88a5d" : "#dfa974",
                      color: "#fff",
                      border: "none",
                      borderRadius: "8px",
                      fontSize: "16px",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.3s ease",
                      boxShadow: isPrimaryHovered ? "0 10px 25px rgba(223, 169, 116, 0.5)" : "0 6px 20px rgba(223, 169, 116, 0.3)",
                      transform: isPrimaryHovered ? "translateY(-3px)" : "translateY(0)",
                    }}
                    onMouseEnter={() => setIsPrimaryHovered(true)}
                    onMouseLeave={() => setIsPrimaryHovered(false)}
                  >
                    Đặt Phòng Ngay
                  </button>

                </div>
              </div>
            </div>

            {/* Cột Hình ảnh (Nâng cấp hiệu ứng) */}
            <div className="col-lg-6">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                <div
                  style={{
                    borderRadius: "16px",
                    overflow: "hidden",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
                    height: "350px",
                    transition: "all 0.4s ease",
                    transform: isImg1Hovered ? "scale(1.03)" : "scale(1)",
                  }}
                  onMouseEnter={() => setIsImg1Hovered(true)}
                  onMouseLeave={() => setIsImg1Hovered(false)}
                >
                  <img
                    src="/img/about/about-1.png"
                    alt="Robins Villa Đà Lạt"
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                </div>
                <div
                  style={{
                    borderRadius: "16px",
                    overflow: "hidden",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
                    height: "350px",
                    marginTop: "40px", // Tạo hiệu ứng so le
                    transition: "all 0.4s ease",
                    transform: isImg2Hovered ? "scale(1.03)" : "scale(1)",
                  }}
                  onMouseEnter={() => setIsImg2Hovered(true)}
                  onMouseLeave={() => setIsImg2Hovered(false)}
                >
                  <img
                    src="/img/about/about-21.jpg"
                    alt="Không gian Villa"
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- Horizontal Rule --- */}
      <hr style={{ border: "0", height: "1px", background: "#eee", margin: "0 5%" }} />

      {/* === PHẦN 2: CÂU CHUYỆN CỦA CHÚNG TÔI === */}
      <section style={{ ...sectionStyle, background: "#fff" }}>
        <div className="container">
          <div className="row">
            <div className="col-lg-8 offset-lg-2 text-center">
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#dfa974",
                  textTransform: "uppercase",
                  letterSpacing: "2px",
                }}
              >
                Triết lý
              </span>
              <h2
                style={{
                  ...headingStyle,
                  borderLeft: "none",
                  paddingLeft: 0,
                  fontSize: "40px",
                  textAlign: "center",
                  marginTop: "12px",
                }}
              >
                Câu Chuyện Của Robins Villa 🏡
              </h2>
              <p style={{ ...paragraphStyle, fontSize: "17px", color: "#333", marginTop: "20px" }}>
                Robins Villa được thành lập từ tình yêu sâu sắc với vẻ đẹp và sự bình yên của Đà Lạt. Chúng tôi không chỉ xây dựng một khách sạn, chúng tôi mong muốn tạo ra một **"ngôi nhà thứ hai"** thực sự cho du khách.
              </p>
              <p style={paragraphStyle}>
                Tên **"Robins"** được lấy cảm hứng từ loài chim Robin (Chim Cổ Đỏ), biểu tượng của niềm hy vọng, sự đổi mới và niềm vui. Đó cũng chính là triết lý dịch vụ của chúng tôi: mang đến cho mỗi du khách một khởi đầu mới mẻ, tràn đầy năng lượng tích cực sau mỗi kỳ nghỉ. Mọi chi tiết, từ kiến trúc, nội thất đến cung cách phục vụ, đều được chăm chút để mang lại trải nghiệm ấm áp và đáng nhớ nhất.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --- Horizontal Rule --- */}
      <hr style={{ border: "0", height: "1px", background: "#eee", margin: "0 5%" }} />

      {/* === PHẦN 3: GIÁ TRỊ CỐT LÕI & CAM KẾT (Thay thế Bản đồ) === */}
      <section style={{ ...sectionStyle, background: "#fdfcfb" }}>
        <div className="container">
          <div className="row">
            <div className="col-12 text-center">
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#dfa974",
                  textTransform: "uppercase",
                  letterSpacing: "2px",
                }}
              >
                Cam Kết
              </span>
              <h2
                style={{
                  ...headingStyle,
                  borderLeft: "none",
                  paddingLeft: 0,
                  fontSize: "40px",
                  textAlign: "center",
                  marginTop: "12px",
                  marginBottom: "40px",
                }}
              >
                Giá Trị Cốt Lõi Của Chúng Tôi 🌟
              </h2>
            </div>
          </div>
          <div className="row justify-content-center" style={{ gap: "30px 0" }}>
            {coreValues.map((value) => (
              <div className="col-lg-4 col-md-6" key={value.id}>
                <div
                  style={{
                    background: "#fff",
                    padding: "40px 30px",
                    borderRadius: "12px",
                    boxShadow: hoveredCoreValue === value.id ? "0 15px 40px rgba(0,0,0,0.1)" : "0 8px 30px rgba(0,0,0,0.07)",
                    textAlign: "center",
                    transition: "all 0.4s ease",
                    height: "100%",
                    borderBottom: hoveredCoreValue === value.id ? "4px solid #dfa974" : "4px solid transparent",
                    transform: hoveredCoreValue === value.id ? "translateY(-5px)" : "translateY(0)",
                  }}
                  onMouseEnter={() => setHoveredCoreValue(value.id)}
                  onMouseLeave={() => setHoveredCoreValue(null)}
                >
                  <span style={{ fontSize: "60px", display: "block", marginBottom: "15px" }}>{value.icon}</span>
                  <h4 style={{ fontSize: "24px", fontWeight: 700, color: "#222", margin: "16px 0 10px 0" }}>
                    {value.title}
                  </h4>
                  <p style={{ ...paragraphStyle, marginBottom: 0, fontSize: "16px", color: "#666" }}>
                    {value.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="row mt-5">
              <div className="col-12 text-center">
                  <p style={{...paragraphStyle, fontSize: "17px", color: "#555", marginTop: "40px"}}>
                      Cam kết của chúng tôi là mang lại trải nghiệm nghỉ dưỡng hoàn hảo nhất, nơi chất lượng và sự tận tâm luôn được đặt lên hàng đầu.
                  </p>
              </div>
          </div>
        </div>
      </section>
      
      {/* --- Horizontal Rule --- */}
      <hr style={{ border: "0", height: "1px", background: "#eee", margin: "0 5%" }} />

      {/* === PHẦN 4: ĐỘI NGŨ TẬN TÂM (Đã chuyển xuống dưới) === */}
      <section style={{ ...sectionStyle, background: "#fff" }}>
        <div className="container">
          <div className="row">
            <div className="col-12 text-center">
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#dfa974",
                  textTransform: "uppercase",
                  letterSpacing: "2px",
                }}
              >
                Con người
              </span>
              <h2
                style={{
                  ...headingStyle,
                  borderLeft: "none",
                  paddingLeft: 0,
                  fontSize: "40px",
                  textAlign: "center",
                  marginTop: "12px",
                  marginBottom: "40px",
                }}
              >
                Đội Ngũ Chuyên Nghiệp Của Chúng Tôi 🤝
              </h2>
            </div>
          </div>
          <div className="row justify-content-center" style={{ gap: "30px 0" }}>
            {teamData.map((member) => (
              <div className="col-lg-4 col-md-6" key={member.id}>
                <div
                  style={{
                    background: "#fdfcfb",
                    padding: "30px",
                    borderRadius: "12px",
                    boxShadow: hoveredTeamMember === member.id ? "0 15px 40px rgba(0,0,0,0.1)" : "0 8px 30px rgba(0,0,0,0.07)",
                    textAlign: "center",
                    transition: "all 0.3s ease",
                    height: "100%",
                    transform: hoveredTeamMember === member.id ? "translateY(-10px)" : "translateY(0)",
                  }}
                  onMouseEnter={() => setHoveredTeamMember(member.id)}
                  onMouseLeave={() => setHoveredTeamMember(null)}
                >
                  <span style={{ fontSize: "48px" }}>{member.icon}</span>
                  <h4 style={{ fontSize: "22px", fontWeight: 600, color: "#222", margin: "16px 0 8px 0" }}>
                    {member.name}
                  </h4>
                  <p style={{ ...paragraphStyle, marginBottom: 0, fontSize: "15px", color: "#666" }}>
                    {member.role}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

    </main>
  );
};

export default AboutUsPage;