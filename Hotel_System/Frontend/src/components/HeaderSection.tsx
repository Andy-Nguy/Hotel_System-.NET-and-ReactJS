import React, { useState, useEffect, useRef } from "react";

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
      // Check if token is JWT (has 3 parts separated by dots)
      const parts = token.split(".");
      if (parts.length === 3) {
        // JWT token - decode payload
        try {
          const base64Payload = parts[1];
          const decodedPayload = decodeURIComponent(
            atob(base64Payload)
              .split("")
              .map(function (c) {
                return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
              })
              .join("")
          );
          const payload = JSON.parse(decodedPayload);
          setUserInfo(payload);
        } catch (e) {
          console.warn("Could not decode JWT token:", e);
          setUserInfo(null);
        }
      } else {
        // GUID token - need to fetch user profile from API
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
            console.log("[HeaderSection] Profile from API:", profile);
            // Map profile to userInfo format - use ?? to handle role=0 correctly
            setUserInfo({
              name: profile.hoTen || profile.HoTen || profile.name || "User",
              email: profile.email || profile.Email,
              role: profile.vaiTro ?? profile.VaiTro ?? profile.role,
              phone: profile.soDienThoai || profile.SoDienThoai,
            });
          } else {
            console.warn("Could not fetch profile:", res.status);
            setUserInfo({ name: "User" });
          }
        } catch (e) {
          console.warn("Could not fetch user profile:", e);
          setUserInfo({ name: "User" });
        }
      }
    } else {
      setUserInfo(null);
    }
  };

  // helper to check staff role
  const isNhanVien = () => {
    console.log("[HeaderSection.isNhanVien] userInfo:", userInfo);
    if (!userInfo) return false;
    // Use nullish coalescing (??) to handle role=0 correctly (0 is falsy but valid)
    const role =
      userInfo.role ??
      userInfo.Role ??
      userInfo.roles ??
      userInfo.vaiTro ??
      userInfo.VaiTro ??
      userInfo[
        "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"
      ] ??
      userInfo["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/role"];
    console.log("[HeaderSection.isNhanVien] role:", role, typeof role);
    if (role === undefined || role === null) return false;
    // Handle numeric role (1 = nhanvien)
    if (typeof role === "number") return role === 1;
    if (Array.isArray(role))
      return role.some(
        (r) => String(r).toLowerCase() === "nhanvien" || String(r) === "1"
      );
    const roleStr = String(role).toLowerCase().trim();
    return (
      roleStr === "nhanvien" ||
      roleStr === "admin" ||
      roleStr === "staff" ||
      roleStr === "1"
    );
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
                  <a href="/rooms" className="bk-btn">
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
                  <div className="nav-right search-switch">
                    <i className="icon_search"></i>
                  </div>
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
