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
      const token = res?.token;
      if (token) {
        // store token in localStorage for later calls
        localStorage.setItem("hs_token", token);
        setMessage("Đăng nhập thành công! Đang chuyển về trang chủ...");
        // return to home page after a short delay
        setTimeout(() => {
          // remove hash from URL while keeping path and query
          try {
            window.history.replaceState(
              null,
              "",
              window.location.pathname + window.location.search
            );
          } catch (e) {
            // fallback to clearing hash if replaceState is not available
            window.location.hash = "";
          }
          window.location.reload();
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
