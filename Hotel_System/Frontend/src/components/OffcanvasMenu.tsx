import React, { useState, useEffect } from "react";
import { getUserInfo, checkIsNhanVien } from "../context/UserContext";

const OffcanvasMenu: React.FC = () => {
  const [currentRoute, setCurrentRoute] = useState<string>("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);

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
        console.log("[OffcanvasMenu] Using getUserInfo:", info);
        setUserInfo(info);
        return;
      }

      // Fallback: gọi API profile
      try {
        const _VITE_API = (import.meta as any).env?.VITE_API_URL || "";
        const API_BASE = _VITE_API.replace(/\/$/, "")
          ? `${_VITE_API.replace(/\/$/, "")}/api`
          : "/api";
        const res = await fetch(`${API_BASE}/Auth/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const profile = await res.json();
          console.log("[OffcanvasMenu] Profile from API:", profile);
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
        console.warn("[OffcanvasMenu] Could not fetch user profile:", e);
        setUserInfo({ name: "User" });
      }
    } else {
      setUserInfo(null);
      localStorage.removeItem("hs_userInfo");
    }
  };

  useEffect(() => {
    setCurrentRoute(resolveRoute());
    refreshAuth();
    const onLocationChange = () => {
      setCurrentRoute(resolveRoute());
      refreshAuth();
    };
    window.addEventListener("hashchange", onLocationChange);
    window.addEventListener("popstate", onLocationChange);
    return () => {
      window.removeEventListener("hashchange", onLocationChange);
      window.removeEventListener("popstate", onLocationChange);
    };
  }, []);

  useEffect(() => {
    refreshAuth();
    const handleStorageChange = () => refreshAuth();
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Sử dụng hàm thống nhất
  const isNhanVien = () => {
    return checkIsNhanVien(userInfo);
  };

  const handleLogout = () => {
    localStorage.removeItem("hs_token");
    localStorage.removeItem("hs_userInfo");
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
            <li
              className={
                currentRoute === "/" || currentRoute === "#" ? "active" : ""
              }
            >
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
                    window.dispatchEvent(new PopStateEvent("popstate"));
                  } catch {
                    window.location.href = "/rooms";
                  }
                }}
              >
                Rooms
              </a>
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
              <a href="#">
                {isLoggedIn
                  ? (() => {
                      try {
                        const fullName =
                          userInfo?.[
                            "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"
                          ] ||
                          userInfo?.name ||
                          "User";
                        const firstName =
                          String(fullName).trim().split(" ")[0] || "User";
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
                            window.history.pushState(null, "", "/profile");
                            window.dispatchEvent(new PopStateEvent("popstate"));
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
                            window.history.pushState(null, "", "/bookings");
                            window.dispatchEvent(new PopStateEvent("popstate"));
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
                              window.location.href = "/admin/dashboard";
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
                            window.history.pushState(null, "", "/login");
                            window.dispatchEvent(new PopStateEvent("popstate"));
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
                            window.history.pushState(null, "", "/register");
                            window.dispatchEvent(new PopStateEvent("popstate"));
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
