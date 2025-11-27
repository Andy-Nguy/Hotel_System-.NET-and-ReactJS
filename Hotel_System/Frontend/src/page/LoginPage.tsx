import React, { useState } from "react";
import authApi from "../api/authApi";

const LoginPage: React.FC = () => {
  const [form, setForm] = useState({ Email: "", Password: "" });
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await authApi.login(form);
      console.log("[Login] API response:", res);
      // Handle both camelCase and PascalCase response from backend
      const token = res?.token || res?.Token;
      console.log(
        "[Login] Token extracted:",
        token ? token.substring(0, 50) + "..." : "null"
      );
      if (token) {
        // store token in localStorage for later calls
        localStorage.setItem("hs_token", token);
        // Verify it was stored
        const storedToken = localStorage.getItem("hs_token");
        console.log("[Login] Token stored successfully:", !!storedToken);
        // Also store user info if available
        if (res?.user || res?.User) {
          localStorage.setItem(
            "hs_user",
            JSON.stringify(res?.user || res?.User)
          );
        }
        if (res?.role || res?.Role) {
          localStorage.setItem("hs_role", res?.role || res?.Role);
        }

        // Fetch user profile to get role and save to localStorage for immediate access
        try {
          const _VITE_API = (import.meta as any).env?.VITE_API_URL || "";
          const API_BASE = _VITE_API.replace(/\/$/, "")
            ? `${_VITE_API.replace(/\/$/, "")}/api`
            : "/api";
          const profileRes = await fetch(`${API_BASE}/Auth/profile`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (profileRes.ok) {
            const profile = await profileRes.json();
            console.log("[Login] Profile fetched:", profile);
            const userInfo = {
              name: profile.hoTen || profile.HoTen || profile.name,
              email: profile.email || profile.Email,
              role: profile.vaiTro ?? profile.VaiTro ?? profile.role,
              phone: profile.soDienThoai || profile.SoDienThoai,
            };
            localStorage.setItem("hs_userInfo", JSON.stringify(userInfo));
            console.log("[Login] userInfo saved to localStorage:", userInfo);
          }
        } catch (e) {
          console.warn("[Login] Could not fetch profile:", e);
        }

        setMessage("Đăng nhập thành công! Đang chuyển về trang chủ...");
        // return to home page after a short delay
        setTimeout(() => {
          // Prefer client-side SPA navigation: push '/' and dispatch popstate so
          // MainPage will re-evaluate route without a full reload.
          try {
            window.history.pushState(null, "", "/");
            // notify listeners (MainPage listens for popstate)
            window.dispatchEvent(new PopStateEvent("popstate"));
          } catch (e) {
            // fallback to full navigation if history API isn't available
            try {
              window.location.href = "/";
            } catch {
              // last resort: reload current page
              window.location.reload();
            }
          }
        }, 1500);
      } else {
        setMessage("Không nhận được token từ server");
      }
    } catch (err: any) {
      setMessage(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="contact-section spad">
      <div className="container">
        <div className="row">
          <div className="col-lg-8 offset-lg-2">
            <div className="contact-form-warp">
              <div className="section-title">
                <span>Chào mừng trở lại</span>
                <h2>Đăng nhập tài khoản</h2>
              </div>
              <form onSubmit={submit} className="contact-form">
                <div className="row">
                  <div className="col-lg-12">
                    <input
                      type="email"
                      name="Email"
                      placeholder="Địa chỉ email của bạn"
                      value={form.Email}
                      onChange={onChange}
                      required
                      style={{ marginBottom: "20px" }}
                    />
                  </div>
                  <div className="col-lg-12">
                    <input
                      type="password"
                      name="Password"
                      placeholder="Mật khẩu"
                      value={form.Password}
                      onChange={onChange}
                      required
                      style={{ marginBottom: "20px" }}
                    />
                  </div>
                  <div className="col-lg-12">
                    <button
                      type="submit"
                      className="site-btn"
                      disabled={loading}
                    >
                      {loading ? "Đang đăng nhập..." : "Đăng nhập"}
                    </button>
                  </div>
                </div>
                {message && (
                  <div className="col-lg-12" style={{ marginTop: "20px" }}>
                    <div
                      className={`alert ${
                        message.includes("thành công")
                          ? "alert-success"
                          : "alert-danger"
                      }`}
                      style={{
                        padding: "15px",
                        borderRadius: "4px",
                        backgroundColor: message.includes("thành công")
                          ? "#d4edda"
                          : "#f8d7da",
                        color: message.includes("thành công")
                          ? "#155724"
                          : "#721c24",
                        border: `1px solid ${
                          message.includes("thành công") ? "#c3e6cb" : "#f5c6cb"
                        }`,
                      }}
                    >
                      {message}
                    </div>
                  </div>
                )}
                <div
                  className="col-lg-12"
                  style={{ marginTop: "20px", textAlign: "center" }}
                >
                  <p>
                    Chưa có tài khoản?{" "}
                    <a href="#register" style={{ color: "#dfa974" }}>
                      Đăng ký ngay
                    </a>
                  </p>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LoginPage;
