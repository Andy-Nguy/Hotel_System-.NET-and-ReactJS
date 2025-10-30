import React from "react";

const OffcanvasMenu: React.FC = () => {
  return (
    <>
      <div className="offcanvas-menu-overlay"></div>
      <div className="canvas-open">
        <i className="icon_menu"></i>
      </div>
      <div className="offcanvas-menu-wrapper">
        <div className="canvas-close">
          <i className="icon_close"></i>
        </div>
        <div className="search-icon  search-switch">
          <i className="icon_search"></i>
        </div>
        <div className="header-configure-area">
          <div className="language-option">
            <img src="/img/flag.jpg" alt="" />
            <span>
              EN <i className="fa fa-angle-down"></i>
            </span>
            <div className="flag-dropdown">
              <ul>
                <li>
                  <a href="#">Zi</a>
                </li>
                <li>
                  <a href="#">Fr</a>
                </li>
              </ul>
            </div>
          </div>
          <a href="#" className="bk-btn">
            Booking Now
          </a>
        </div>
        <nav className="mainmenu mobile-menu">
          <ul>
            <li className="active">
              <a href="#">Home</a>
            </li>
            <li>
              <a href="#">Rooms</a>
            </li>
            <li>
              <a href="#">About Us</a>
            </li>
            <li>
              <a href="#">Pages</a>
              <ul className="dropdown">
                <li>
                  <a href="#">Room Details</a>
                </li>
                <li>
                  <a href="#">Deluxe Room</a>
                </li>
                <li>
                  <a href="#">Family Room</a>
                </li>
                <li>
                  <a href="#">Premium Room</a>
                </li>
              </ul>
            </li>
            <li>
              <a href="#">News</a>
            </li>
            <li>
              <a href="#">Contact</a>
            </li>
            <li>
              <a href="#">Tài khoản</a>
              <ul className="dropdown">
                <li>
                  <a href="#">Đăng nhập</a>
                </li>
                <li>
                  <a href="#">Đăng ký</a>
                </li>
              </ul>
            </li>
          </ul>
        </nav>
        <div id="mobile-menu-wrap"></div>
        <div className="top-social">
          <a href="#">
            <i className="fa fa-facebook"></i>
          </a>
          <a href="#">
            <i className="fa fa-twitter"></i>
          </a>
          <a href="#">
            <i className="fa fa-tripadvisor"></i>
          </a>
          <a href="#">
            <i className="fa fa-instagram"></i>
          </a>
        </div>
        <ul className="top-widget">
          <li>
            <i className="fa fa-phone"></i> (12) 345 67890
          </li>
          <li>
            <i className="fa fa-envelope"></i> info.colorlib@gmail.com
          </li>
        </ul>
      </div>
    </>
  );
};

export default OffcanvasMenu;
