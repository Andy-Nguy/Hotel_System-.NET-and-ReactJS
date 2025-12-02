import React from "react";
import BookingForm from "./BookingForm";
const HeroSection: React.FC = () => {
  return (
    <section className="hero-section">
      <div className="container">
        <div className="row">
          <div className="col-lg-6">
            <div
              className="hero-text"
              style={{ position: "relative", zIndex: 3 }}
            >
              <h1
                style={{
                  textShadow:
                    "0 8px 28px rgba(0,0,0,0.65), 0 2px 8px rgba(0,0,0,0.5)",
                  fontWeight: 800,
                }}
              >
                Robins Villa
              </h1>
              <p
                style={{
                  textShadow:
                    "0 6px 20px rgba(0,0,0,0.55), 0 1px 4px rgba(0,0,0,0.45)",
                }}
              >
                Khám phá và đặt phòng tại Robins Villa Đà Lạt, điểm đến lý tưởng
                cho kỳ nghỉ thư giãn giữa thiên nhiên cao nguyên. Nơi bạn dễ
                dàng tìm thấy những căn villa đẹp, giá tốt và trải nghiệm dịch
                vụ đẳng cấp.
              </p>

              {/* Direct booking button: go to /rooms with sensible defaults */}
              <button
                type="button"
                className="primary-btn"
                onClick={() => {
                  const today = new Date();
                  const tomorrow = new Date(
                    today.getTime() + 24 * 60 * 60 * 1000
                  );
                  const params = new URLSearchParams({
                    checkIn: today.toISOString().slice(0, 10),
                    checkOut: tomorrow.toISOString().slice(0, 10),
                    guests: "1",
                    rooms: "1",
                  });
                  window.location.href = `/rooms?${params.toString()}`;
                }}
                style={{
                  marginLeft: 12,
                  background: "#dfa974",
                  border: "2px solid #dfa974",
                  padding: "14px 32px",
                  fontSize: "13px",
                  fontWeight: "700",
                  color: "#ffffff",
                  letterSpacing: "2px",
                  textTransform: "uppercase",
                  borderRadius: "8px",
                  boxShadow: "0 4px 15px rgba(223, 169, 116, 0.3)",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#c89461";
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow =
                    "0 6px 20px rgba(223, 169, 116, 0.5)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#dfa974";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow =
                    "0 4px 15px rgba(223, 169, 116, 0.3)";
                }}
              >
                Kiểm Tra Phòng Trống
              </button>
            </div>
          </div>
          {/* Keep column space to preserve hero image sizing but hide the form visually */}
          <div className="col-xl-4 col-lg-5 offset-xl-2 offset-lg-1">
            <div style={{ visibility: "hidden" }}>
              <BookingForm />
            </div>
          </div>
        </div>
      </div>
      <div className="hero-slider owl-carousel">
        <div
          className="hs-item"
          style={{
            backgroundImage:
              "linear-gradient(rgba(0,0,0,0.20), rgba(0,0,0,0.20)), url(/img/hero/hero.jpeg)",
            backgroundSize: "cover",
            backgroundPosition: "center",
            zIndex: 1,
          }}
        ></div>
        <div
          className="hs-item"
          style={{
            backgroundImage:
              "linear-gradient(rgba(0,0,0,0.20), rgba(0,0,0,0.20)), url(/img/hero/hero2.jpg)",
            backgroundSize: "cover",
            backgroundPosition: "center",
            zIndex: 1,
          }}
        ></div>
        <div
          className="hs-item"
          style={{
            backgroundImage:
              "linear-gradient(rgba(0,0,0,0.20), rgba(0,0,0,0.20)), url(/img/hero/hero3.jpg)",
            backgroundSize: "cover",
            backgroundPosition: "center",
            zIndex: 1,
          }}
        ></div>
      </div>
    </section>
  );
};

export default HeroSection;
