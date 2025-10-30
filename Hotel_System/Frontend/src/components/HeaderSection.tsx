import React from "react";

const HeaderSection: React.FC = () => {
  return (
    <header className="header-section">
      <div className="top-nav">
        <div className="container">
          <div className="row">
            <div className="col-lg-6">
              <ul className="tn-left">
                <li>
                  <i className="fa fa-phone"></i> (12) 345 67890
                </li>
                <li>
                  <i className="fa fa-envelope"></i> info.colorlib@gmail.com
                </li>
              </ul>
            </div>
            <div className="col-lg-6">
              <div className="tn-right">
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
                <a href="#" className="bk-btn">
                  Booking Now
                </a>
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
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="menu-item">
        <div className="container">
          <div className="row">
            <div className="col-lg-2">
              <div className="logo">
                <a href="#">
                  <img src="/img/logo.png" alt="" />
                </a>
              </div>
            </div>
            <div className="col-lg-10">
              <div className="nav-menu">
                <nav className="mainmenu">
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
                          <a href="#">Blog Details</a>
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
                <div className="nav-right search-switch">
                  <i className="icon_search"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default HeaderSection;
