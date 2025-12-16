import React, { useState } from "react";
import authApi from "../api/authApi";
import { EyeInvisibleOutlined, EyeTwoTone } from "@ant-design/icons";

type PageMode = "login" | "forgot-email" | "forgot-otp";

const LoginPage: React.FC = () => {
  const [mode, setMode] = useState<PageMode>("login");
  const [form, setForm] = useState({ Email: "", Password: "" });
  const [forgotEmail, setForgotEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const isSuccess = (msg: string | null) =>
    msg?.includes("thành công") || msg?.includes("đã được gửi");

  const renderMessage = () => {
    if (!message) return null;
    return (
      <div className="row" style={{ marginTop: "20px" }}>
        <div className="col-lg-12">
          <div
            style={{
              padding: "15px",
              borderRadius: "8px",
              backgroundColor: isSuccess(message) ? "#d4edda" : "#f8d7da",
              color: isSuccess(message) ? "#155724" : "#721c24",
              border: `1px solid ${isSuccess(message) ? "#c3e6cb" : "#f5c6cb"}`,
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <span style={{ fontSize: "18px" }}>
              {isSuccess(message) ? "✓" : "⚠"}
            </span>
            {message}
          </div>
        </div>
      </div>
    );
  };

  const inputStyle = {
    marginBottom: "20px",
    padding: "12px 15px",
    fontSize: "15px",
    borderRadius: "6px",
    border: "1px solid #e0e0e0",
    transition: "border-color 0.3s ease",
  };

  const passwordInputContainerStyle: React.CSSProperties = {
    position: "relative",
    marginBottom: "20px",
  };

  const passwordToggleStyle: React.CSSProperties = {
    position: "absolute",
    right: "15px",
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#888",
    fontSize: "14px",
    padding: "5px",
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await authApi.login(form);
      console.log("[Login] API response:", res);
      const token = res?.token || res?.Token;
      console.log(
        "[Login] Token extracted:",
        token ? token.substring(0, 50) + "..." : "null"
      );
      if (token) {
        localStorage.setItem("hs_token", token);
        const storedToken = localStorage.getItem("hs_token");
        console.log("[Login] Token stored successfully:", !!storedToken);
        if (res?.user || res?.User) {
          localStorage.setItem(
            "hs_user",
            JSON.stringify(res?.user || res?.User)
          );
        }
        if (res?.role || res?.Role) {
          localStorage.setItem("hs_role", res?.role || res?.Role);
        }

        let userInfoSaved = false;
        try {
          const API_BASE = `${
            (await import("../api/config")).API_CONFIG.CURRENT
          }/api`;
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
            userInfoSaved = true;
          }
        } catch (e) {
          console.warn("[Login] Could not fetch profile:", e);
        }

        setMessage("Đăng nhập thành công! Đang chuyển về trang chủ...");
        setTimeout(() => {
          try {
            // If there is a pending booking saved prior to login, restore it to sessionStorage
            const pendingRaw = localStorage.getItem("hs_pending_booking");
            if (pendingRaw) {
              try {
                const pending = JSON.parse(pendingRaw);
                if (pending && pending.bookingInfo) {
                  sessionStorage.setItem("bookingInfo", JSON.stringify(pending.bookingInfo));
                  // remove pending marker
                  localStorage.removeItem("hs_pending_booking");
                  // redirect back to payment page to continue flow
                  window.location.href = "/payment";
                  return;
                }
              } catch (e) {
                console.warn("Could not parse pending booking:", e);
              }
            }

            console.log(
              "[Login] Navigating to home, userInfoSaved:",
              userInfoSaved
            );
            window.history.pushState(null, "", "/");
            window.dispatchEvent(new PopStateEvent("popstate"));
          } catch (e) {
            try {
              window.location.href = "/";
            } catch {
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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      setMessage("Vui lòng nhập email");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      await authApi.forgotPassword(forgotEmail);
      setMessage("Mã OTP đã được gửi đến email của bạn!");
      setTimeout(() => {
        setMode("forgot-otp");
        setMessage(null);
      }, 1500);
    } catch (err: any) {
      setMessage(err?.message ?? "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) {
      setMessage("Vui lòng nhập mã OTP");
      return;
    }
    if (newPassword.length < 6) {
      setMessage("Mật khẩu phải có ít nhất 6 ký tự");
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage("Mật khẩu xác nhận không khớp");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      await authApi.resetPassword(forgotEmail, otp, newPassword);
      setMessage("Đặt lại mật khẩu thành công! Đang chuyển về đăng nhập...");
      setTimeout(() => {
        setMode("login");
        setForgotEmail("");
        setOtp("");
        setNewPassword("");
        setConfirmPassword("");
        setMessage(null);
      }, 2000);
    } catch (err: any) {
      setMessage(err?.message ?? "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  };

  const backToLogin = () => {
    setMode("login");
    setMessage(null);
    setForgotEmail("");
    setOtp("");
    setNewPassword("");
    setConfirmPassword("");
  };

  // ===================== FORGOT PASSWORD - STEP 1: EMAIL =====================
  if (mode === "forgot-email") {
    return (
      <section className="contact-section spad">
        <div className="container">
          <div className="row">
            <div className="col-lg-6 offset-lg-3">
              <div className="contact-form-warp">
                <div className="section-title" style={{ textAlign: "center" }}>
                  <span>Quên mật khẩu</span>
                  <h2>Khôi phục tài khoản</h2>
                  <p
                    style={{
                      color: "#707079",
                      marginTop: "15px",
                      fontSize: "15px",
                    }}
                  >
                    Nhập địa chỉ email đã đăng ký, chúng tôi sẽ gửi mã OTP để
                    đặt lại mật khẩu.
                  </p>
                </div>

                <form onSubmit={handleForgotPassword} className="contact-form">
                  <div className="row">
                    <div className="col-lg-12">
                      <div style={{ marginBottom: "25px" }}>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "8px",
                            fontWeight: "500",
                            color: "#19191a",
                          }}
                        >
                          Email đăng ký
                        </label>
                        <input
                          type="email"
                          placeholder="example@email.com"
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          required
                          style={{
                            ...inputStyle,
                            marginBottom: 0,
                            width: "100%",
                          }}
                        />
                      </div>
                    </div>
                    <div className="col-lg-12">
                      <button
                        type="submit"
                        className="site-btn"
                        disabled={loading}
                        style={{
                          width: "100%",
                          padding: "14px",
                          fontSize: "16px",
                        }}
                      >
                        {loading ? (
                          <span>
                            <span
                              className="spinner"
                              style={{ marginRight: "8px" }}
                            >
                              ⏳
                            </span>
                            Đang gửi...
                          </span>
                        ) : (
                          "Gửi mã OTP"
                        )}
                      </button>
                    </div>
                  </div>
                </form>

                {renderMessage()}

                <div className="row" style={{ marginTop: "25px" }}>
                  <div className="col-lg-12" style={{ textAlign: "center" }}>
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        backToLogin();
                      }}
                      style={{
                        color: "#dfa974",
                        textDecoration: "none",
                        fontSize: "15px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                      }}
                    >
                      ← Quay lại đăng nhập
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ===================== FORGOT PASSWORD - STEP 2: OTP & NEW PASSWORD =====================
  if (mode === "forgot-otp") {
    return (
      <section className="contact-section spad">
        <div className="container">
          <div className="row">
            <div className="col-lg-6 offset-lg-3">
              <div className="contact-form-warp">
                <div className="section-title" style={{ textAlign: "center" }}>
                  <span>Bước 2/2</span>
                  <h2>Đặt mật khẩu mới</h2>
                  <p
                    style={{
                      color: "#707079",
                      marginTop: "15px",
                      fontSize: "15px",
                    }}
                  >
                    Mã OTP đã được gửi đến{" "}
                    <strong style={{ color: "#dfa974" }}>{forgotEmail}</strong>
                    <br />
                    Vui lòng kiểm tra hộp thư và nhập mã bên dưới.
                  </p>
                </div>

                <form onSubmit={handleResetPassword} className="contact-form">
                  <div className="row">
                    {/* OTP Input */}
                    <div className="col-lg-12">
                      <div style={{ marginBottom: "20px" }}>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "8px",
                            fontWeight: "500",
                            color: "#19191a",
                          }}
                        >
                          Mã OTP
                        </label>
                        <input
                          type="text"
                          placeholder="Nhập 6 số"
                          value={otp}
                          onChange={(e) =>
                            setOtp(e.target.value.replace(/\D/g, ""))
                          }
                          maxLength={6}
                          required
                          style={{
                            ...inputStyle,
                            marginBottom: 0,
                            width: "100%",
                            textAlign: "center",
                            fontSize: "24px",
                            letterSpacing: "8px",
                            fontWeight: "600",
                          }}
                        />
                      </div>
                    </div>

                    {/* New Password */}
                    <div className="col-lg-12">
                      <div style={{ marginBottom: "20px" }}>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "8px",
                            fontWeight: "500",
                            color: "#19191a",
                          }}
                        >
                          Mật khẩu mới
                        </label>
                        <div style={passwordInputContainerStyle}>
                          <input
                            type={showNewPassword ? "text" : "password"}
                            placeholder="Tối thiểu 6 ký tự"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                            minLength={6}
                            style={{
                              ...inputStyle,
                              marginBottom: 0,
                              width: "100%",
                              paddingRight: "50px",
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            style={passwordToggleStyle}
                          >
                            {showNewPassword ? "🙈" : "👁️"}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Confirm Password */}
                    <div className="col-lg-12">
                      <div style={{ marginBottom: "25px" }}>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "8px",
                            fontWeight: "500",
                            color: "#19191a",
                          }}
                        >
                          Xác nhận mật khẩu
                        </label>
                        <div style={passwordInputContainerStyle}>
                          <input
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Nhập lại mật khẩu"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            style={{
                              ...inputStyle,
                              marginBottom: 0,
                              width: "100%",
                              paddingRight: "50px",
                            }}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setShowConfirmPassword(!showConfirmPassword)
                            }
                            style={passwordToggleStyle}
                          >
                            {showConfirmPassword ? "🙈" : "👁️"}
                          </button>
                        </div>
                        {confirmPassword && newPassword !== confirmPassword && (
                          <small
                            style={{
                              color: "#dc3545",
                              marginTop: "5px",
                              display: "block",
                            }}
                          >
                            Mật khẩu không khớp
                          </small>
                        )}
                        {confirmPassword &&
                          newPassword === confirmPassword &&
                          newPassword.length >= 6 && (
                            <small
                              style={{
                                color: "#28a745",
                                marginTop: "5px",
                                display: "block",
                              }}
                            >
                              ✓ Mật khẩu khớp
                            </small>
                          )}
                      </div>
                    </div>

                    <div className="col-lg-12">
                      <button
                        type="submit"
                        className="site-btn"
                        disabled={
                          loading ||
                          newPassword !== confirmPassword ||
                          newPassword.length < 6
                        }
                        style={{
                          width: "100%",
                          padding: "14px",
                          fontSize: "16px",
                        }}
                      >
                        {loading ? (
                          <span>
                            <span style={{ marginRight: "8px" }}>⏳</span>
                            Đang xử lý...
                          </span>
                        ) : (
                          "Đặt lại mật khẩu"
                        )}
                      </button>
                    </div>
                  </div>
                </form>

                {renderMessage()}

                <div className="row" style={{ marginTop: "25px" }}>
                  <div className="col-lg-12" style={{ textAlign: "center" }}>
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setMode("forgot-email");
                        setMessage(null);
                        setOtp("");
                      }}
                      style={{
                        color: "#dfa974",
                        textDecoration: "none",
                        fontSize: "15px",
                      }}
                    >
                      Gửi lại mã OTP
                    </a>
                    <span style={{ margin: "0 15px", color: "#ccc" }}>|</span>
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        backToLogin();
                      }}
                      style={{
                        color: "#dfa974",
                        textDecoration: "none",
                        fontSize: "15px",
                      }}
                    >
                      Quay lại đăng nhập
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ===================== LOGIN FORM =====================
  return (
    <section className="contact-section spad">
      <div className="container">
        <div className="row">
          <div className="col-lg-6 offset-lg-3">
            <div className="contact-form-warp">
              <div className="section-title" style={{ textAlign: "center" }}>
                <span>Chào mừng trở lại</span>
                <h2>Đăng nhập tài khoản</h2>
              </div>

              <form onSubmit={submit} className="contact-form">
                <div className="row">
                  {/* Email */}
                  <div className="col-lg-12">
                    <div style={{ marginBottom: "20px" }}>
                      <label
                        style={{
                          display: "block",
                          marginBottom: "8px",
                          fontWeight: "500",
                          color: "#19191a",
                        }}
                      >
                        Email
                      </label>
                      <input
                        type="email"
                        name="Email"
                        placeholder="Nhập địa chỉ email"
                        value={form.Email}
                        onChange={onChange}
                        required
                        style={{
                          ...inputStyle,
                          marginBottom: 0,
                          width: "100%",
                        }}
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="col-lg-12">
                    <div style={{ marginBottom: "10px" }}>
                      <label
                        style={{
                          display: "block",
                          marginBottom: "8px",
                          fontWeight: "500",
                          color: "#19191a",
                        }}
                      >
                        Mật khẩu
                      </label>
                      <div style={passwordInputContainerStyle}>
                        <input
                          type={showPassword ? "text" : "password"}
                          name="Password"
                          placeholder="Nhập mật khẩu"
                          value={form.Password}
                          onChange={onChange}
                          required
                          style={{
                            ...inputStyle,
                            marginBottom: 0,
                            width: "100%",
                            paddingRight: "50px",
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          style={passwordToggleStyle}
                        >
                          {showPassword ? (
                            <EyeInvisibleOutlined
                              style={{ color: "#000000" }}
                            />
                          ) : (
                            <EyeTwoTone twoToneColor="#000000" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Forgot Password Link */}
                  <div
                    className="col-lg-12"
                    style={{ textAlign: "right", marginBottom: "20px" }}
                  >
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setMode("forgot-email");
                        setMessage(null);
                      }}
                      style={{
                        color: "#dfa974",
                        fontSize: "14px",
                        textDecoration: "none",
                      }}
                    >
                      Quên mật khẩu?
                    </a>
                  </div>

                  {/* Submit Button */}
                  <div className="col-lg-12">
                    <button
                      type="submit"
                      className="site-btn"
                      disabled={loading}
                      style={{
                        width: "100%",
                        padding: "14px",
                        fontSize: "16px",
                      }}
                    >
                      {loading ? (
                        <span>
                          <span style={{ marginRight: "8px" }}>⏳</span>
                          Đang đăng nhập...
                        </span>
                      ) : (
                        "Đăng nhập"
                      )}
                    </button>
                  </div>
                </div>
              </form>

              {renderMessage()}

              {/* Register Link */}
              <div className="row" style={{ marginTop: "25px" }}>
                <div className="col-lg-12" style={{ textAlign: "center" }}>
                  <p style={{ color: "#707079", margin: 0 }}>
                    Chưa có tài khoản?{" "}
                    <a
                      href="#register"
                      onClick={(e) => {
                        e.preventDefault();
                        window.location.href =
                          window.location.origin + "/#register";
                      }}
                      style={{
                        color: "#dfa974",
                        fontWeight: "500",
                        textDecoration: "none",
                        cursor: "pointer",
                      }}
                    >
                      Đăng ký ngay
                    </a>
                  </p>
                </div>
              </div>

              {/* Divider */}
              <div className="row" style={{ marginTop: "30px" }}>
                <div className="col-lg-12">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "15px",
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        height: "1px",
                        backgroundColor: "#e0e0e0",
                      }}
                    ></div>
                    <span style={{ color: "#aaa", fontSize: "13px" }}>
                      hoặc
                    </span>
                    <div
                      style={{
                        flex: 1,
                        height: "1px",
                        backgroundColor: "#e0e0e0",
                      }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Social Login Placeholder */}
              <div className="row" style={{ marginTop: "20px" }}>
                <div className="col-lg-12" style={{ textAlign: "center" }}>
                  <p style={{ color: "#aaa", fontSize: "13px", margin: 0 }}>
                    Đăng nhập bằng mạng xã hội sẽ sớm được hỗ trợ
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LoginPage;
