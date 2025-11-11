import React from "react";
import BookingForm from "./BookingForm";
const HeroSection: React.FC = () => {
  return (
    <section className="hero-section">
      <div className="container">
        <div className="row">
          <div className="col-lg-6">
            <div className="hero-text">
              <h1>Robins Villa</h1>
              <p>
                Here are the best hotel booking sites, including recommendations
                for international travel and for finding low-priced hotel rooms.
              </p>
              <a href="#" className="primary-btn">
                Discover Now
              </a>
            </div>
          </div>
          <div className="col-xl-4 col-lg-5 offset-xl-2 offset-lg-1">
            <BookingForm />
          </div>
        </div>
      </div>
      <div className="hero-slider owl-carousel">
        <div
          className="hs-item"
          style={{ backgroundImage: "url(/img/hero/hero-1.jpg)" }}
        ></div>
        <div
          className="hs-item"
          style={{ backgroundImage: "url(/img/hero/hero-2.jpg)" }}
        ></div>
        <div
          className="hs-item"
          style={{ backgroundImage: "url(/img/hero/hero-3.jpg)" }}
        ></div>
      </div>
    </section>
  );
};

export default HeroSection;
