import React, { useState, useEffect, useRef } from "react";
import { getUserInfo, checkIsNhanVien } from "../context/UserContext";
import { API_CONFIG } from "../api/config";

const HeaderSection: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [currentRoute, setCurrentRoute] = useState<string>("");

  const resolveRoute = () => {
    const p = window.location.pathname;
    if (p && p !== "/") return p;
    const h = window.location.hash;
    if (h) return h;
    return "/";
  };

  const refreshAuth = async () => {
    const token = localStorage.getItem("hs_token");
    setIsLoggedIn(!!token);

    if (token) {
      // Sử dụng hàm getUserInfo thống nhất
      const info = getUserInfo();
      if (info) {
        console.log("[HeaderSection] Using getUserInfo:", info);
        setUserInfo(info);
        return;
      }

      // Fallback: gọi API profile nếu getUserInfo không có dữ liệu
      try {
        const API_BASE = `${API_CONFIG.CURRENT}/api`;
        const res = await fetch(`${API_BASE}/Auth/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const profile = await res.json();
          console.log("[HeaderSection] Profile from API:", profile);
          const mappedUserInfo = {
            name: profile.hoTen || profile.HoTen || profile.name || "User",
            email: profile.email || profile.Email,
            role: profile.vaiTro ?? profile.VaiTro ?? profile.role,
            phone: profile.soDienThoai || profile.SoDienThoai,
          };
          setUserInfo(mappedUserInfo);
          localStorage.setItem("hs_userInfo", JSON.stringify(mappedUserInfo));
        } else {
          setUserInfo({ name: "User" });
        }
      } catch (e) {
        console.warn("Could not fetch user profile:", e);
        setUserInfo({ name: "User" });
      }
    } else {
      setUserInfo(null);
      localStorage.removeItem("hs_userInfo");
    }
  };

  // helper to check staff/admin role - sử dụng hàm thống nhất
  const isNhanVien = () => {
    return checkIsNhanVien(userInfo);
  };

  const headerRef = useRef<HTMLElement | null>(null);
  const [spacerHeight, setSpacerHeight] = useState<number>(0);

  useEffect(() => {
    setCurrentRoute(resolveRoute());
    // ensure auth state is read on mount
    refreshAuth();
    const onLocationChange = () => {
      setCurrentRoute(resolveRoute());
      refreshAuth();
    };
    window.addEventListener("hashchange", onLocationChange);
    window.addEventListener("popstate", onLocationChange);

    // set spacer height to header height to avoid content overlap
    const updateSpacer = () => {
      try {
        const h = headerRef.current?.offsetHeight ?? 0;
        setSpacerHeight(h);
      } catch {
        setSpacerHeight(0);
      }
    };
    updateSpacer();
    window.addEventListener("resize", updateSpacer);

    return () => {
      window.removeEventListener("hashchange", onLocationChange);
      window.removeEventListener("popstate", onLocationChange);
      window.removeEventListener("resize", updateSpacer);
    };
  }, []);

  useEffect(() => {
    // initialize auth and listen for storage changes (other tabs)
    refreshAuth();
    const handleStorageChange = () => refreshAuth();
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("hs_token");
    setIsLoggedIn(false);
    setUserInfo(null);
    // Redirect to home page and remove hash from URL
    try {
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search
      );
    } catch (e) {
      window.location.hash = "";
    }
    window.location.reload();
  };

  return (
    <>
      <header
        ref={headerRef}
        className="header-section"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          background: "#fff",
          boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
        }}
      >
        <div className="top-nav">
          <div className="container">
            <div className="row">
              <div className="col-lg-6">
                <ul className="tn-left">
                  <li>
                    <i className="fa fa-phone"></i> 0123 456 789
                  </li>
                  <li>
                    <i className="fa fa-envelope"></i>{" "}
                    info.robinsvilla@gmail.com
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
                      <i className="fa fa-instagram"></i>
                    </a>
                  </div>
                  <a href="/rooms" className="bk-btn">
                    Booking Now
                  </a>
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
                  <a
                    href="/"
                    onClick={(e) => {
                      e.preventDefault();
                      try {
                        window.history.pushState(null, "", "/");
                        window.dispatchEvent(new PopStateEvent("popstate"));
                      } catch {
                        window.location.href = "/";
                      }
                    }}
                  >
                    <img src="/img/logo.webp" alt="" />
                  </a>
                </div>
              </div>
              <div className="col-lg-10">
                <div className="nav-menu">
                  <nav className="mainmenu">
                    <ul>
                      <li
                        className={
                          currentRoute === "/" || currentRoute === "#"
                            ? "active"
                            : ""
                        }
                      >
                        <a
                          href="/"
                          onClick={(e) => {
                            e.preventDefault();
                            try {
                              window.history.pushState(null, "", "/");
                              window.dispatchEvent(
                                new PopStateEvent("popstate")
                              );
                            } catch {
                              window.location.href = "/";
                            }
                          }}
                        >
                          Home
                        </a>
                      </li>
                      <li
                        className={
                          currentRoute === "/rooms" || currentRoute === "#rooms"
                            ? "active"
                            : ""
                        }
                      >
                        <a
                          href="/rooms"
                          onClick={(e) => {
                            e.preventDefault();
                            try {
                              window.history.pushState(null, "", "/rooms");
                              window.dispatchEvent(
                                new PopStateEvent("popstate")
                              );
                            } catch {
                              window.location.href = "/rooms";
                            }
                          }}
                        >
                          Rooms
                        </a>
                      </li>
                      <li
                        className={
                          currentRoute === "/AboutUsPage" ||
                          currentRoute === "#AboutUsPage"
                            ? "active"
                            : ""
                        }
                      >
                        <a
                          href="/AboutUsPage"
                          onClick={(e) => {
                            e.preventDefault();
                            try {
                              window.history.pushState(
                                null,
                                "",
                                "/AboutUsPage"
                              );
                              window.dispatchEvent(
                                new PopStateEvent("popstate")
                              );
                            } catch {
                              window.location.href = "/AboutUsPage";
                            }
                          }}
                        >
                          About Us
                        </a>
                      </li>
                      {/* <li>
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
                    </li> */}
                      {/* <li>
                      <a href="#">News</a>
                    </li> */}
                      <li
                        className={
                          currentRoute === "/contact" ||
                          currentRoute === "#contact"
                            ? "active"
                            : ""
                        }
                      >
                        <a
                          href="/contact"
                          onClick={(e) => {
                            e.preventDefault();
                            try {
                              window.history.pushState(null, "", "/contact");
                              window.dispatchEvent(
                                new PopStateEvent("popstate")
                              );
                            } catch {
                              window.location.href = "/contact";
                            }
                          }}
                        >
                          Contact
                        </a>
                      </li>
                      <li>
                        <a href="#">
                          {isLoggedIn
                            ? (() => {
                                try {
                                  const fullName =
                                    userInfo?.name ||
                                    userInfo?.hoTen ||
                                    userInfo?.HoTen ||
                                    userInfo?.[
                                      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"
                                    ] ||
                                    "User";
                                  const firstName =
                                    String(fullName).trim().split(" ")[0] ||
                                    "User";
                                  return `Xin chào ${firstName}`;
                                } catch (e) {
                                  return "Tài khoản";
                                }
                              })()
                            : "Tài khoản"}
                        </a>
                        <ul className="dropdown">
                          {isLoggedIn ? (
                            <>
                              <li>
                                <a
                                  href="/profile"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    try {
                                      window.history.pushState(
                                        null,
                                        "",
                                        "/profile"
                                      );
                                      window.dispatchEvent(
                                        new PopStateEvent("popstate")
                                      );
                                    } catch {
                                      window.location.href = "/profile";
                                    }
                                  }}
                                >
                                  Thông tin cá nhân
                                </a>
                              </li>
                              <li>
                                <a
                                  href="/bookings"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    try {
                                      window.history.pushState(
                                        null,
                                        "",
                                        "/bookings"
                                      );
                                      window.dispatchEvent(
                                        new PopStateEvent("popstate")
                                      );
                                    } catch {
                                      window.location.href = "/bookings";
                                    }
                                  }}
                                >
                                  Lịch sử đặt phòng
                                </a>
                              </li>
                              {isNhanVien() && (
                                <li>
                                  <a
                                    href="/admin/dashboard"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      try {
                                        window.history.pushState(
                                          null,
                                          "",
                                          "/admin/dashboard"
                                        );
                                        window.dispatchEvent(
                                          new PopStateEvent("popstate")
                                        );
                                      } catch {
                                        window.location.href =
                                          "/admin/dashboard";
                                      }
                                    }}
                                  >
                                    Quản trị
                                  </a>
                                </li>
                              )}
                              <li>
                                <a
                                  href="#"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleLogout();
                                  }}
                                >
                                  Đăng xuất
                                </a>
                              </li>
                            </>
                          ) : (
                            <>
                              <li>
                                <a
                                  href="/login"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    try {
                                      window.history.pushState(
                                        null,
                                        "",
                                        "/login"
                                      );
                                      window.dispatchEvent(
                                        new PopStateEvent("popstate")
                                      );
                                    } catch {
                                      window.location.href = "/login";
                                    }
                                  }}
                                >
                                  Đăng nhập
                                </a>
                              </li>
                              <li>
                                <a
                                  href="/register"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    try {
                                      window.history.pushState(
                                        null,
                                        "",
                                        "/register"
                                      );
                                      window.dispatchEvent(
                                        new PopStateEvent("popstate")
                                      );
                                    } catch {
                                      window.location.href = "/register";
                                    }
                                  }}
                                >
                                  Đăng ký
                                </a>
                              </li>
                            </>
                          )}
                        </ul>
                      </li>
                    </ul>
                  </nav>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* spacer to avoid content being covered by fixed header */}
      <div style={{ height: spacerHeight, width: "100%" }} aria-hidden />
    </>
  );
};

export default HeaderSection;
