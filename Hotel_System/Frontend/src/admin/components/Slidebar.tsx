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

const NavItem: React.FC<{ routeFragment: string; label: string }> = ({
  routeFragment,
  label,
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
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M3 13h8V3H3v10zM3 21h8v-6H3v6zM13 21h8V11h-8v10zM13 3v6h8V3h-8z"
            fill={active ? "#3b82f6" : "#6b7280"}
          />
        </svg>
      </div>
      <div>{label}</div>
    </div>
  );
};

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
        style={{ position: "sticky", top: 0, zIndex: 30, background: "#fff", padding: "4px 0", display: "flex", justifyContent: "center" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%" }}>
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
              position: "relative"
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
                background: "#ffffff"
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
        {/* Chỉ hiển thị menu Quản lý nhân viên khi role = 2 (Admin) - ĐẶT LÊN ĐẦU */}
        {isAdmin && (
          <NavItem
            key="nhanvien"
            routeFragment="admin/nhanvien"
            label="Quản lý Nhân viên"
          />
        )}

        {/* Dashboard link */}
        <NavItem
          key="dashboard"
          routeFragment="admin/dashboard"
          label="Dashboard"
        />

        {/* Room manager link */}
        <NavItem
          key="rooms"
          routeFragment="admin/rooms"
          label="Quản lý phòng"
        />

        {/* Amenities manager link */}
        <NavItem
          key="amenities"
          routeFragment="admin/amenities"
          label="Quản lý tiện nghi"
        />

        {/* Services manager link */}
        <NavItem
          key="services"
          routeFragment="admin/services"
          label="Quản lý dịch vụ"
        />

        {/* Promotions manager link */}
        <NavItem
          key="promotions"
          routeFragment="admin/promotions"
          label="Quản lý khuyến mãi"
        />

        {/* Bookings manager link */}
        <NavItem
          key="bookings"
          routeFragment="admin/bookings"
          label="Quản lý đặt phòng"
        />
        <NavItem
          key="invoices"
          routeFragment="admin/invoices"
          label="Quản lý hoá đơn"
        />
        <NavItem
          key="checkout"
          routeFragment="admin/checkout"
          label="Quản lý Checkout"
        />
        <NavItem
          key="checkin"
          routeFragment="admin/checkin"
          label="Quản lý Check-in"
        />
        {/* === THÊM: NavItem loyalty (giữ nguyên như bạn viết) === */}
        <NavItem
          key="loyalty"
          routeFragment="admin/loyalty"
          label="Điểm tích lũy & Cấp bậc"
        />

        <NavItem
          key="review"
          routeFragment="admin/review"
          label="Quản lý đánh giá"
        />

        <NavItem key="blog" routeFragment="admin/blog" label="Quản lý Blog" />
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
