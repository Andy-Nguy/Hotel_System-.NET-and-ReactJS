import React from "react";

const StatCard: React.FC<{ title: string; value: string; accent?: string }> = ({
  title,
  value,
  accent,
}) => {
  // choose gentle gradient from accent
  const gradients: Record<string, string> = {
    "#3b82f6":
      "linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(59,130,246,0.06) 100%)",
    "#a78bfa":
      "linear-gradient(135deg, rgba(167,139,250,0.12) 0%, rgba(167,139,250,0.06) 100%)",
    "#f59e0b":
      "linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(245,158,11,0.06) 100%)",
    "#f97373":
      "linear-gradient(135deg, rgba(249,115,115,0.12) 0%, rgba(249,115,115,0.06) 100%)",
  };
  const bg = (accent && gradients[accent]) || "#fff";
  return (
    <div
      style={{
        flex: 1,
        padding: 20,
        borderRadius: 12,
        background: bg,
        boxShadow: "0 8px 24px rgba(2,6,23,0.04)",
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>{title}</div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 800,
              color: "#0f172a",
              marginTop: 8,
            }}
          >
            {value}
          </div>
        </div>
        <div
          style={{ color: accent || "#10b981", fontSize: 14, fontWeight: 700 }}
        >
          ▲
        </div>
      </div>
    </div>
  );
};

const HeaderSection: React.FC<{ showStats?: boolean }> = ({ showStats = true }) => {
  return (
    <header style={{ padding: "28px 36px", marginLeft: "20" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 20,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 26,
              fontWeight: 800,
              color: "#0f172a",
            }}
          >
            Hi, Welcome back 👋
          </h1>
          <div style={{ marginTop: 8, color: "#6b7280" }}>
            (overview of the system)
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <input
            placeholder="Search..."
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid rgba(15,23,42,0.06)",
              width: 220,
            }}
          />
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 6px 18px rgba(2,6,23,0.04)",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" fill="#dbeafe" />
              </svg>
            </div>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                overflow: "hidden",
              }}
            >
              <img
                src="/img/logo.webp"
                alt="avatar"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {showStats && (
        <div style={{ display: "flex", gap: 18, marginTop: 20 }}>
          <StatCard title="Weekly sales" value="714k" accent="#3b82f6" />
          <StatCard title="New users" value="1.35m" accent="#a78bfa" />
          <StatCard title="Purchase orders" value="1.72m" accent="#f59e0b" />
          <StatCard title="Messages" value="234" accent="#f97373" />
        </div>
      )}
    </header>
  );
};

export default HeaderSection;
