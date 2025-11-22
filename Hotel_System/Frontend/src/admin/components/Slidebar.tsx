import React, { useEffect, useState } from "react";

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
    <div onClick={handleClick} style={active ? activeStyle : baseStyle}>
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
  return (
    <aside
      style={{
        width: 280,
        padding: 20,
        background: "#fff",
        borderRight: "1px solid rgba(15,23,42,0.04)",
        height: "100vh",
        boxSizing: "border-box",
        position: "fixed",
        left: 0,
        top: 0,
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: "linear-gradient(135deg,#5eead4,#60a5fa)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 800,
            }}
          >
            M
          </div>
          <div>
            <div style={{ fontWeight: 800, color: "#111827" }}>MyAdmin</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Control panel</div>
          </div>
        </div>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {/* determine active state from current location (pathname or hash) */}
        {/* local state to trigger re-render when route changes */}

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

      </nav>
      
    </aside>
  );
};

export default Slidebar;
