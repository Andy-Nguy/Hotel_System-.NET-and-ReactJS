import React, { useEffect, useState } from "react";

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
  const [firstName, setFirstName] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        // Prefer explicit cached user info
        const raw = localStorage.getItem("hs_userInfo");
        if (raw) {
          const u = JSON.parse(raw);
          const full = u?.name || u?.hoTen || u?.HoTen || u?.ten || u?.fullName;
          if (full) {
            setFirstName(String(full).trim().split(" ")[0]);
            return;
          }
        }

        // Fallback: try to decode JWT token stored as hs_token
        const token = localStorage.getItem("hs_token");
        if (token) {
          const parts = token.split(".");
          if (parts.length === 3) {
            try {
              const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
              const json = decodeURIComponent(
                atob(base64)
                  .split("")
                  .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
                  .join("")
              );
              const payload = JSON.parse(json);
              const full = payload?.name || payload?.hoTen || payload?.fullName || payload?.given_name;
              if (full) {
                setFirstName(String(full).trim().split(" ")[0]);
                return;
              }
            } catch {
              // ignore decode errors
            }
          }

          // If we couldn't decode or there was no name, try fetching profile from API (handles GUID tokens)
          try {
            const API_BASE = (import.meta as any).env?.VITE_API_URL
              ? `${(import.meta as any).env.VITE_API_URL.replace(/\/$/, "")}/api`
              : "/api";
            const res = await fetch(`${API_BASE}/Auth/profile`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              const profile = await res.json();
              const full = profile.hoTen || profile.HoTen || profile.name || profile.fullName;
              if (full) {
                setFirstName(String(full).trim().split(" ")[0]);
                try {
                  localStorage.setItem("hs_userInfo", JSON.stringify({ name: full }));
                } catch {}
              }
            }
          } catch {
            // ignore network errors here
          }
        }
      } catch {
        // swallow any errors; header should not crash the admin UI
      }
    };

    load();
  }, []);

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
            {firstName ? `Hi, ${firstName} 👋` : "Hi, Welcome back 👋"}
          </h1>
          <div style={{ marginTop: 8, color: "#6b7280" }}>
            Bạn có thể theo dõi đặt phòng, khách đến và báo cáo hôm nay.
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
    </header>
  );
};

export default HeaderSection;
