// Slidebar improvements:
// - Scroll container with smooth scroll and custom thin scrollbar
// - Top/bottom shadow gradients to indicate more content
// - Auto-scroll active menu into view when route changes
// - Keyboard navigation (Enter/Space to activate, ArrowUp/ArrowDown to focus items)
// - Accessibility improvements: aria-label and aria-current for active item
import React, { useEffect, useState, useRef } from "react";
import "./Slidebar.css";
import { getUserInfo } from "../../context/UserContext";

// Helper to get user role from localStorage using getUserInfo
const getUserRole = (): number | null => {
  try {
    const info = getUserInfo();
    if (info) {
      const role = info.role ?? info.vaiTro ?? null;
      console.log("[Slidebar] getUserRole:", role, typeof role);
      // Ensure it's a number
      if (typeof role === "number") return role;
      if (typeof role === "string") {
        const num = parseInt(role, 10);
        if (!isNaN(num)) return num;
        // Handle string roles
        if (role.toLowerCase() === "admin") return 2;
        if (role.toLowerCase() === "nhanvien") return 1;
      }
    }
  } catch (e) {
    console.warn("Could not get userRole:", e);
  }
  return null;
};

const MenuItem: React.FC<{
  icon?: React.ReactNode;
  label: string;
  badge?: string;
}> = ({ icon, label, badge }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "10px 12px",
      borderRadius: 10,
      cursor: "pointer",
    }}
  >
    <div
      style={{
        width: 26,
        height: 26,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#6b7280",
      }}
    >
      {icon}
    </div>
    <div style={{ flex: 1, color: "#374151", fontWeight: 600 }}>{label}</div>
    {badge && (
      <div
        style={{
          background: "#ffd8b6",
          color: "#a75a00",
          padding: "2px 8px",
          borderRadius: 12,
          fontSize: 12,
        }}
      >
        {badge}
      </div>
    )}
  </div>
);

// Helper to get current route (supports pathname or hash)
const getCurrentRoute = () => {
  try {
    if (window.location.pathname && window.location.pathname !== "/")
      return window.location.pathname;
    if (window.location.hash) return window.location.hash;
  } catch (e) {}
  return "#";
};

// Icon components
const Icons = {
  Users: ({ active }: { active: boolean }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#3b82f6" : "#6b7280"} strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  Dashboard: ({ active }: { active: boolean }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M3 13h8V3H3v10zM3 21h8v-6H3v6zM13 21h8V11h-8v10zM13 3v6h8V3h-8z" fill={active ? "#3b82f6" : "#6b7280"}/>
    </svg>
  ),
  Bed: ({ active }: { active: boolean }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#3b82f6" : "#6b7280"} strokeWidth="2">
      <path d="M2 4v16"/>
      <path d="M2 8h18a2 2 0 0 1 2 2v10"/>
      <path d="M2 17h20"/>
      <path d="M6 8V4"/>
      <circle cx="7" cy="6" r="1"/>
    </svg>
  ),
  Star: ({ active }: { active: boolean }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? "#3b82f6" : "#6b7280"}>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>
  ),
  Service: ({ active }: { active: boolean }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#3b82f6" : "#6b7280"} strokeWidth="2">
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m5.08 5.08l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m5.08-5.08l4.24-4.24"/>
    </svg>
  ),
  Calendar: ({ active }: { active: boolean }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#3b82f6" : "#6b7280"} strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  Login: ({ active }: { active: boolean }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#3b82f6" : "#6b7280"} strokeWidth="2">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
      <polyline points="10 17 15 12 10 7"/>
      <line x1="15" y1="12" x2="3" y2="12"/>
    </svg>
  ),
  Logout: ({ active }: { active: boolean }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#3b82f6" : "#6b7280"} strokeWidth="2">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
  Invoice: ({ active }: { active: boolean }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#3b82f6" : "#6b7280"} strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  Tag: ({ active }: { active: boolean }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#3b82f6" : "#6b7280"} strokeWidth="2">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
      <line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
  ),
  Trophy: ({ active }: { active: boolean }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#3b82f6" : "#6b7280"} strokeWidth="2">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
      <path d="M4 22h16"/>
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>
    </svg>
  ),
  Document: ({ active }: { active: boolean }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#3b82f6" : "#6b7280"} strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <line x1="10" y1="9" x2="8" y2="9"/>
    </svg>
  ),
};

const NavItem: React.FC<{ routeFragment: string; label: string; icon?: keyof typeof Icons }> = ({
  routeFragment,
  label,
  icon = "Dashboard",
}) => {
  const [route, setRoute] = useState<string>(getCurrentRoute());

  useEffect(() => {
    const onChange = () => setRoute(getCurrentRoute());
    window.addEventListener("hashchange", onChange);
    window.addEventListener("popstate", onChange);
    return () => {
      window.removeEventListener("hashchange", onChange);
      window.removeEventListener("popstate", onChange);
    };
  }, []);

  const active = route.includes(routeFragment);
  const IconComponent = Icons[icon];

  const baseStyle: React.CSSProperties = {
    padding: "10px",
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    gap: 12,
    cursor: "pointer",
  };
  const activeStyle: React.CSSProperties = {
    ...baseStyle,
    background: "#eef7ff",
    color: "#0f172a",
    fontWeight: 700,
  };

  const handleClick = () => {
    // Use history.pushState to create clean pathname URLs like `/admin/rooms`.
    // This keeps URLs consistent with the dashboard and avoids leftover hashes.
    try {
      const path = routeFragment.startsWith("/")
        ? routeFragment
        : `/${routeFragment}`;
      window.history.pushState(null, "", path);
      // notify listeners (MainPage listens for popstate)
      window.dispatchEvent(new PopStateEvent("popstate"));
    } catch (e) {
      // fallback to hash if pushState is unavailable
      window.location.hash = `#${routeFragment}`;
    }
  };

  return (
    <div
      onClick={handleClick}
      style={active ? activeStyle : baseStyle}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
        // Support arrow key navigation within the sidebar
        if (e.key === "ArrowDown") {
          e.preventDefault();
          const next =
            (e.currentTarget.nextElementSibling as HTMLElement) || null;
          if (next) next.focus();
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          const prev =
            (e.currentTarget.previousElementSibling as HTMLElement) || null;
          if (prev) prev.focus();
        }
      }}
      data-route={routeFragment}
      data-active={active}
      aria-current={active ? "page" : undefined}
      aria-label={label}
      className={active ? "nav-item nav-item-active" : "nav-item"}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: active ? "#e6f0ff" : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <IconComponent active={active} />
      </div>
      <div>{label}</div>
    </div>
  );
};

// Small helper component to render section titles inside the sidebar.
const NavGroup: React.FC<{ title: string }> = ({ title }) => (
  <div className="nav-group-title" style={{
    padding: "8px 12px",
    color: "#6b7280",
    fontSize: 13,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  }}>{title}</div>
);

const Slidebar: React.FC = () => {
  const [userRole, setUserRole] = useState<number | null>(getUserRole());
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [showTopShadow, setShowTopShadow] = useState(false);
  const [showBottomShadow, setShowBottomShadow] = useState(false);

  // Listen for storage changes and route changes (in case user logs in/out)
  useEffect(() => {
    const handleChange = () => {
      const newRole = getUserRole();
      console.log("[Slidebar] Role changed:", newRole);
      setUserRole(newRole);
    };

    // Check on mount
    handleChange();

    // Listen for various events
    window.addEventListener("storage", handleChange);
    window.addEventListener("popstate", handleChange);
    window.addEventListener("hashchange", handleChange);

    // Also set an interval to check periodically (in case localStorage is updated without event)
    const interval = setInterval(handleChange, 3000); // Reduced frequency

    return () => {
      window.removeEventListener("storage", handleChange);
      window.removeEventListener("popstate", handleChange);
      window.removeEventListener("hashchange", handleChange);
      clearInterval(interval);
    };
  }, []);

  const isAdmin = userRole === 2;

  // Log isAdmin every render
  useEffect(() => {
    console.log(
      "[Slidebar] RENDER - isAdmin:",
      isAdmin,
      "userRole:",
      userRole,
      "type:",
      typeof userRole
    );
  }, [isAdmin, userRole]);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;

    const checkShadow = () => {
      const { scrollTop, clientHeight, scrollHeight } = scroller;
      setShowTopShadow(scrollTop > 2);
      setShowBottomShadow(scrollTop + clientHeight < scrollHeight - 2);
    };

    checkShadow();
    scroller.addEventListener("scroll", checkShadow, { passive: true });
    window.addEventListener("resize", checkShadow);
    return () => {
      scroller.removeEventListener("scroll", checkShadow);
      window.removeEventListener("resize", checkShadow);
    };
  }, [scrollRef]);

  // Scroll to active item when route changes (popstate/hashchange)
  useEffect(() => {
    const onRouteChange = () => {
      const scroller = scrollRef.current;
      if (!scroller) return;
      const activeEl = scroller.querySelector(
        '[data-active="true"]'
      ) as HTMLElement | null;
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    };
    window.addEventListener("popstate", onRouteChange);
    window.addEventListener("hashchange", onRouteChange);
    return () => {
      window.removeEventListener("popstate", onRouteChange);
      window.removeEventListener("hashchange", onRouteChange);
    };
  }, []);

  // Scroll active item into view when route or role changes
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const activeEl = scroller.querySelector(
      '[data-active="true"]'
    ) as HTMLElement | null;
    if (activeEl) {
      // Smooth scroll but keep the item within the viewport of the scroller
      activeEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [userRole]);

  return (
    <aside className="slidebar-aside">
      <div
        className="slidebar-header"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          background: "#fff",
          padding: "4px 0",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
          }}
        >
          <div
            className="logo-container"
            style={{
              width: 160,
              height: 72,
              padding: 0,
              borderRadius: 0,
              background: "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              boxShadow: "none",
              position: "relative",
            }}
          >
            <img
              src="/img/logo.webp"
              alt="Khách sạn"
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                height: 72,
                width: "auto",
                objectFit: "contain",
                display: "block",
                background: "#ffffff",
              }}
              onError={(e) => {
                // fallback to letter M if logo not found
                const el = e.target as HTMLImageElement;
                el.style.display = "none";
                try {
                  const parent = el.parentElement;
                  if (parent) parent.innerText = "M";
                } catch {}
              }}
            />
          </div>
        </div>
        {/* glossy separator removed per request */}
      </div>

      <div
        ref={scrollRef}
        className="slidebar-scroll"
        tabIndex={0}
        role="navigation"
        aria-label="Admin navigation"
      >
        {/* ===== HỆ THỐNG ===== */}
        {isAdmin && (
          <>
            <NavGroup title="Hệ thống" />
            <NavItem
              key="nhanvien"
              routeFragment="admin/nhanvien"
              label="Quản lý Nhân viên"
              icon="Users"
            />
          </>
        )}

        {/* ===== TỔNG QUAN ===== */}
        <NavGroup title="Tổng quan" />
        <NavItem
          key="dashboard"
          routeFragment="admin/dashboard"
          label="Dashboard"
          icon="Dashboard"
        />

        {/* ===== VẬN HÀNH KHÁCH SẠN ===== */}
        <NavGroup title="Vận hành khách sạn" />
        <NavItem
          key="rooms"
          routeFragment="admin/rooms"
          label="Quản lý phòng"
          icon="Bed"
        />
        <NavItem
          key="amenities"
          routeFragment="admin/amenities"
          label="Quản lý tiện nghi"
          icon="Star"
        />
        <NavItem
          key="services"
          routeFragment="admin/services"
          label="Quản lý dịch vụ"
          icon="Service"
        />

        {/* ===== ĐẶT PHÒNG & LƯU TRÚ ===== */}
        <NavGroup title="Đặt phòng & Lưu trú" />
        <NavItem
          key="bookings"
          routeFragment="admin/bookings"
          label="Quản lý đặt phòng"
          icon="Calendar"
        />
        <NavItem
          key="checkin"
          routeFragment="admin/checkin"
          label="Quản lý Check-in"
          icon="Login"
        />
        <NavItem
          key="checkout"
          routeFragment="admin/checkout"
          label="Quản lý Checkout"
          icon="Logout"
        />

        {/* ===== TÀI CHÍNH & KHÁCH HÀNG ===== */}
        <NavGroup title="Tài chính & Khách hàng" />
        <NavItem
          key="invoices"
          routeFragment="admin/invoices"
          label="Quản lý hoá đơn"
          icon="Invoice"
        />
        <NavItem
          key="promotions"
          routeFragment="admin/promotions"
          label="Quản lý khuyến mãi"
          icon="Tag"
        />
        <NavItem
          key="loyalty"
          routeFragment="admin/loyalty"
          label="Điểm tích lũy & Cấp bậc"
          icon="Trophy"
        />

        {/* ===== NỘI DUNG & PHẢN HỒI ===== */}
        <NavGroup title="Nội dung & Phản hồi" />
        <NavItem
          key="review"
          routeFragment="admin/review"
          label="Quản lý đánh giá"
          icon="Star"
        />
        <NavItem key="blog" routeFragment="admin/blog" label="Quản lý Blog" icon="Document" />
      </div>

      <div
        className={`slidebar-shadow-top ${
          showTopShadow ? "slidebar-shadow-visible" : ""
        }`}
        aria-hidden="true"
      />
      <div
        className={`slidebar-shadow-bottom ${
          showBottomShadow ? "slidebar-shadow-visible" : ""
        }`}
        aria-hidden="true"
      />
    </aside>
  );
};

export default Slidebar;
