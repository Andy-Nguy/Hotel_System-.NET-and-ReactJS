import React, { useState } from "react";

const ContactPage: React.FC = () => {
  // Navigation helper that works without react-router
  const handleNavigate = (path: string) => {
    try {
      window.history.pushState(null, "", path);
      window.dispatchEvent(new PopStateEvent("popstate"));
    } catch (e) {
      window.location.pathname = path;
    }
  };

  // === State cho Form ===
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  // === State cho Hiệu ứng Hover & Focus ===
  const [isSubmitHovered, setIsSubmitHovered] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // --- Định nghĩa Styles ---

  // Style cho các ô input
  const inputBaseStyle: React.CSSProperties = {
    width: "100%",
    padding: "14px 18px",
    border: "1px solid #ddd",
    borderRadius: "8px",
    fontSize: "16px",
    color: "#333",
    transition: "all 0.3s ease",
    outline: "none",
  };

  // Style khi ô input được focus
  const inputFocusedStyle: React.CSSProperties = {
    ...inputBaseStyle,
    borderColor: "#dfa974",
    boxShadow: "0 0 8px rgba(223, 169, 116, 0.3)",
  };

  // Style cho các mục thông tin (Địa chỉ, SĐT, Email)
  const infoItemStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "flex-start",
    gap: "16px",
    marginBottom: "24px",
  };

  const infoIconStyle: React.CSSProperties = {
    fontSize: "24px",
    color: "#dfa974",
    marginTop: "4px",
  };
  
  const infoTextStyle: React.CSSProperties = {
    fontSize: "16px",
    color: "#555",
    lineHeight: 1.7,
  };

  // --- Hàm xử lý ---

  // Cập nhật state khi gõ
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Xử lý khi submit form
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Logic gửi form (ví dụ: gửi đến API)
    console.log("Form Data Submitted:", formData);
    // Thông báo (tạm thời)
    alert(
      `Cảm ơn, ${formData.name}! Chúng tôi đã nhận được tin nhắn của bạn và sẽ phản hồi sớm nhất.`
    );
    // Reset form
    setFormData({
      name: "",
      email: "",
      subject: "",
      message: "",
    });
  };

  return (
    <main>
      {/* === PHẦN TIÊU ĐỀ === */}
      <section style={{ padding: "80px 0 60px 0", background: "#fdfcfb", textAlign: "center" }}>
        <div className="container">
          <span
            style={{
              fontSize: "14px",
              fontWeight: 700,
              color: "#dfa974",
              textTransform: "uppercase",
              letterSpacing: "2px",
            }}
          >
            Kết Nối
          </span>
          <h1
            style={{
              fontSize: "48px",
              fontWeight: 700,
              color: "#19191a",
              marginTop: "12px",
              marginBottom: "16px",
            }}
          >
            Liên Hệ Với Chúng Tôi
          </h1>
          <p style={{ ...infoTextStyle, fontSize: "17px", color: "#666", maxWidth: "700px", margin: "0 auto" }}>
            Bạn có câu hỏi, yêu cầu đặt phòng đặc biệt, hay góp ý? Đừng ngần ngại,
            hãy cho chúng tôi biết. Đội ngũ Robins Villa luôn sẵn sàng hỗ trợ.
          </p>
        </div>
      </section>

      {/* === PHẦN THÔNG TIN & FORM === */}
      <section style={{ padding: "80px 0", background: "#fff" }}>
        <div className="container">
          <div className="row" style={{ rowGap: "50px" }}>
            {/* Cột Thông tin liên hệ */}
            <div className="col-lg-5">
              <h2
                style={{
                  fontSize: "32px",
                  fontWeight: 700,
                  color: "#222",
                  marginBottom: "30px",
                  borderLeft: "4px solid #dfa974",
                  paddingLeft: "12px",
                }}
              >
                Thông Tin Liên Hệ
              </h2>

              <div style={infoItemStyle}>
                <span style={infoIconStyle}>📍</span>
                <div>
                  <h4 style={{ margin: "0 0 5px 0", fontSize: "18px", color: "#222", fontWeight: 600 }}>Địa chỉ</h4>
                  <p style={infoTextStyle}>
                    123 Đường Hùng Vương, Phường 10, <br />
                    Thành phố Đà Lạt, Lâm Đồng
                  </p>
                </div>
              </div>

              <div style={infoItemStyle}>
                <span style={infoIconStyle}>📞</span>
                <div>
                  <h4 style={{ margin: "0 0 5px 0", fontSize: "18px", color: "#222", fontWeight: 600 }}>Điện thoại</h4>
                  <p style={infoTextStyle}>
                    Lễ tân: (+84) 263 3888 999 <br />
                    Đặt phòng: (+84) 909 123 456
                  </p>
                </div>
              </div>

              <div style={infoItemStyle}>
                <span style={infoIconStyle}>✉️</span>
                <div>
                  <h4 style={{ margin: "0 0 5px 0", fontSize: "18px", color: "#222", fontWeight: 600 }}>Email</h4>
                  <p style={infoTextStyle}>
                    Hỗ trợ: info@robinsvilla.vn <br />
                    Đặt phòng: booking@robinsvilla.vn
                  </p>
                </div>
              </div>
            </div>

            {/* Cột Form liên hệ */}
            <div className="col-lg-7">
              <h2
                style={{
                  fontSize: "32px",
                  fontWeight: 700,
                  color: "#222",
                  marginBottom: "30px",
                  borderLeft: "4px solid #dfa974",
                  paddingLeft: "12px",
                }}
              >
                Gửi Tin Nhắn Cho Chúng Tôi
              </h2>
              <form onSubmit={handleSubmit}>
                <div className="row" style={{ rowGap: "20px" }}>
                  {/* Tên */}
                  <div className="col-md-6">
                    <input
                      type="text"
                      name="name"
                      placeholder="Tên của bạn *"
                      required
                      value={formData.name}
                      onChange={handleChange}
                      onFocus={() => setFocusedField("name")}
                      onBlur={() => setFocusedField(null)}
                      style={focusedField === "name" ? inputFocusedStyle : inputBaseStyle}
                    />
                  </div>
                  {/* Email */}
                  <div className="col-md-6">
                    <input
                      type="email"
                      name="email"
                      placeholder="Email của bạn *"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      onFocus={() => setFocusedField("email")}
                      onBlur={() => setFocusedField(null)}
                      style={focusedField === "email" ? inputFocusedStyle : inputBaseStyle}
                    />
                  </div>
                  {/* Chủ đề */}
                  <div className="col-12">
                    <input
                      type="text"
                      name="subject"
                      placeholder="Chủ đề"
                      value={formData.subject}
                      onChange={handleChange}
                      onFocus={() => setFocusedField("subject")}
                      onBlur={() => setFocusedField(null)}
                      style={focusedField === "subject" ? inputFocusedStyle : inputBaseStyle}
                    />
                  </div>
                  {/* Tin nhắn */}
                  <div className="col-12">
                    <textarea
                      name="message"
                      placeholder="Tin nhắn của bạn *"
                      required
                      rows={6}
                      value={formData.message}
                      onChange={handleChange}
                      onFocus={() => setFocusedField("message")}
                      onBlur={() => setFocusedField(null)}
                      style={focusedField === "message" ? inputFocusedStyle : inputBaseStyle}
                    ></textarea>
                  </div>
                  {/* Nút gửi */}
                  <div className="col-12">
                    <button
                      type="submit"
                      style={{
                        padding: "16px 40px",
                        background: isSubmitHovered ? "#c88a5d" : "#dfa974",
                        color: "#fff",
                        border: "none",
                        borderRadius: "8px",
                        fontSize: "16px",
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.3s ease",
                        boxShadow: isSubmitHovered ? "0 10px 25px rgba(223, 169, 116, 0.5)" : "0 6px 20px rgba(223, 169, 116, 0.3)",
                        transform: isSubmitHovered ? "translateY(-3px)" : "translateY(0)",
                      }}
                      onMouseEnter={() => setIsSubmitHovered(true)}
                      onMouseLeave={() => setIsSubmitHovered(false)}
                    >
                      Gửi Tin Nhắn
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* === PHẦN 3: BẢN ĐỒ === */}
      <section style={{ padding: "0 0 80px 0" }}>
        <div className="container">
          <div className="row">
            <div className="col-12">
              <div style={{ borderRadius: "16px", overflow: "hidden", boxShadow: "0 10px 40px rgba(0,0,0,0.1)", height: "450px" }}>
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d62459.7547188722!2d108.41113645012557!3d11.940419495111977!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x317112fef20988b1%3A0xad5f228b672bf930!2sDa%20Lat%2C%20Lam%20Dong%2C%20Vietnam!5e0!3m2!1sen!2sus"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen={true}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                ></iframe>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default ContactPage;