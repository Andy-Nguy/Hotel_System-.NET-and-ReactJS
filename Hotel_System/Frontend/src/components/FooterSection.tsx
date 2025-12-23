import React from "react";

const FooterSection: React.FC = () => {
  // Màu chủ đạo
  const goldColor = "#C5A47E"; // Màu vàng cát sang trọng hơn màu vàng cam cũ
  const darkBg = "#111111"; // Đen sâu
  const textColor = "#9B9B9B"; // Xám bạc trung tính
  const whiteText = "#FFFFFF"; // Trắng cho điểm nhấn

  return (
    <>
      {/* --- Google Map Section --- */}
      <div style={{ position: "relative" }}>
        <div
          style={{
            width: "100%",
            height: "400px", // Tăng chiều cao map chút cho thoáng
            background: "#f5f5f5",
            filter: "grayscale(10%) contrast(1.1)", // Xử lý màu map cho bớt rực, hợp tone sang
          }}
        >
          <iframe
            style={{ width: "100%", height: "100%", border: "none" }}
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d487.92472606091314!2d108.42546419505824!3d11.946935801970934!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31716cd36d64fcb7%3A0xdc7a799cd611e62!2sRobins%20Villa!5e0!3m2!1svi!2s!4v1763214666910!5m2!1svi!2s"
            allowFullScreen={true}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          ></iframe>
        </div>

        {/* Đường viền vàng ngăn cách Map và Footer */}
        <div
          style={{ height: "4px", background: goldColor, width: "100%" }}
        ></div>
      </div>

      {/* --- Footer Section --- */}
      <footer
        style={{
          background: "#212529",
          color: textColor,
          paddingTop: "80px", // Tăng khoảng cách trên
          paddingBottom: "30px",
          fontFamily: "'Helvetica Neue', sans-serif", // Nên dùng font có chân như 'Playfair Display' nếu có thể
        }}
      >
        <div className="container">
          <div className="row">
            {/* Column 1: Brand & Social */}
            <div className="col-lg-4 mb-4">
              <div className="ft-about">
                <div className="logo" style={{ marginBottom: "30px" }}>
                  <a href="#" style={{ textDecoration: "none" }}>
                    {/* Nếu chưa có logo ảnh chuẩn, dùng text demo style sang trọng */}
                    <h2
                      style={{
                        color: whiteText,
                        textTransform: "uppercase",
                        letterSpacing: "4px",
                        fontSize: "24px",
                        margin: 0,
                        borderLeft: `3px solid ${goldColor}`,
                        paddingLeft: "15px",
                      }}
                    >
                      Robins Villa
                    </h2>
                  </a>
                </div>
                <p
                  style={{
                    color: textColor,
                    lineHeight: "1.8",
                    marginBottom: "30px",
                    fontSize: "15px",
                  }}
                >
                  Trải nghiệm sự bình yên giữa lòng Đà Lạt. <br />
                  Nơi thiên nhiên và kiến trúc giao hòa.
                </p>

                {/* Social Icons - Minimal Style */}
                <div style={{ display: "flex", gap: "15px" }}>
                  {["facebook", "instagram", "twitter", "tripadvisor"].map(
                    (social, idx) => (
                      <a
                        key={idx}
                        href="#"
                        style={{
                          width: "35px",
                          height: "35px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: whiteText,
                          background: "rgba(255,255,255,0.05)", // Nền trong suốt mờ
                          borderRadius: "50%",
                          fontSize: "14px",
                          transition: "all 0.3s ease",
                          textDecoration: "none",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = goldColor;
                          e.currentTarget.style.transform = "translateY(-3px)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background =
                            "rgba(255,255,255,0.05)";
                          e.currentTarget.style.transform = "translateY(0)";
                        }}
                      >
                        <i className={`fa fa-${social}`}></i>
                      </a>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Column 2: Contact Info */}
            <div className="col-lg-3 offset-lg-1 mb-4">
              <h6
                style={{
                  color: whiteText,
                  marginBottom: "25px",
                  fontWeight: 700,
                  fontSize: "14px",
                  textTransform: "uppercase",
                  letterSpacing: "2px", // Key point: Giãn chữ tiêu đề
                }}
              >
                Liên Hệ
              </h6>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {[
                  {
                    icon: "phone",
                    text: "(+84) 263 3888 999",
                    link: "tel:0123456789",
                  },
                  {
                    icon: "envelope",
                    text: "info.robinsvilla@gmail.com",
                    link: "mailto:info...",
                  },
                  {
                    icon: "map-marker",
                    text: "Hồ Tuyền Lâm, Đà Lạt",
                    link: "#",
                  },
                ].map((item, index) => (
                  <li
                    key={index}
                    style={{
                      marginBottom: "15px",
                      display: "flex",
                      alignItems: "flex-start",
                    }}
                  >
                    <i
                      className={`fa fa-${item.icon}`}
                      style={{
                        color: goldColor,
                        marginTop: "5px",
                        width: "20px",
                      }}
                    ></i>
                    <span style={{ color: textColor, fontSize: "14px" }}>
                      {item.link !== "#" ? (
                        <a
                          href={item.link}
                          style={{
                            color: textColor,
                            textDecoration: "none",
                            transition: "0.3s",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.color = goldColor)
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.color = textColor)
                          }
                        >
                          {item.text}
                        </a>
                      ) : (
                        item.text
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 3: Newsletter - Style Tối giản */}
            <div className="col-lg-3 offset-lg-1 mb-4">
              <h6
                style={{
                  color: whiteText,
                  marginBottom: "25px",
                  fontWeight: 700,
                  fontSize: "14px",
                  textTransform: "uppercase",
                  letterSpacing: "2px",
                }}
              >
                Bản Tin
              </h6>
              <p
                style={{
                  color: textColor,
                  marginBottom: "20px",
                  fontSize: "14px",
                }}
              >
                Nhận ưu đãi độc quyền mới nhất.
              </p>

              <form style={{ position: "relative", marginTop: "10px" }}>
                <input
                  type="text"
                  placeholder="Email của bạn..."
                  style={{
                    width: "100%",
                    padding: "10px 0",
                    background: "transparent",
                    border: "none",
                    borderBottom: `1px solid ${textColor}`, // Chỉ gạch chân
                    color: whiteText,
                    outline: "none",
                    fontSize: "14px",
                  }}
                  onFocus={(e) =>
                    (e.target.style.borderBottom = `1px solid ${goldColor}`)
                  }
                  onBlur={(e) =>
                    (e.target.style.borderBottom = `1px solid ${textColor}`)
                  }
                />
                <button
                  type="submit"
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "10px",
                    background: "transparent",
                    border: "none",
                    color: goldColor,
                    cursor: "pointer",
                    fontSize: "16px",
                  }}
                >
                  <i className="fa fa-paper-plane"></i>
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Copyright Line */}
        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.05)", // Đường kẻ siêu mờ
            marginTop: "50px",
            paddingTop: "25px",
            textAlign: "center",
          }}
        >
          <p
            style={{
              color: "#555",
              fontSize: "12px",
              letterSpacing: "1px",
              margin: 0,
              textTransform: "uppercase",
            }}
          >
            © {new Date().getFullYear()} Robins Villa Da Lat. All Rights
            Reserved.
          </p>
        </div>
      </footer>
    </>
  );
};

export default FooterSection;
