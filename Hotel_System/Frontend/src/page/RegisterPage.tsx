import React, { useState } from "react";
import authApi from "../api/authApi";

const RegisterPage: React.FC = () => {
  const [form, setForm] = useState({
    Hoten: "",
    Email: "",
    Password: "",
    Sodienthoai: "",
    Ngaysinh: "",
  });
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const submitRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await authApi.register(form);
      setPendingId(res?.pendingId ?? null);
      setMessage(
        "Đăng ký thành công! Vui lòng kiểm tra email hoặc console để lấy mã OTP."
      );
    } catch (err: any) {
      setMessage(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  };

  const submitVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingId) return setMessage("Thiếu mã pending");
    setLoading(true);
    try {
      const res = await authApi.verifyOtp({ PendingId: pendingId, Otp: otp });
      setMessage("Xác thực thành công! Đang chuyển đến trang đăng nhập...");
      // redirect to login after delay
      setTimeout(() => {
        window.location.hash = "#/login";
      }, 2000);
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
                <span>Tạo tài khoản mới</span>
                <h2>Đăng ký thành viên</h2>
              </div>

              {!pendingId ? (
                <form onSubmit={submitRegister} className="contact-form">
                  <div className="row">
                    <div className="col-lg-6">
                      <input
                        type="text"
                        name="Hoten"
                        placeholder="Họ và tên"
                        value={form.Hoten}
                        onChange={onChange}
                        required
                      />
                    </div>
                    <div className="col-lg-6">
                      <input
                        type="email"
                        name="Email"
                        placeholder="Địa chỉ email"
                        value={form.Email}
                        onChange={onChange}
                        required
                      />
                    </div>
                    <div className="col-lg-6">
                      <input
                        type="password"
                        name="Password"
                        placeholder="Mật khẩu"
                        value={form.Password}
                        onChange={onChange}
                        required
                        minLength={6}
                      />
                    </div>
                    <div className="col-lg-6">
                      <input
                        type="tel"
                        name="Sodienthoai"
                        placeholder="Số điện thoại"
                        value={form.Sodienthoai}
                        onChange={onChange}
                      />
                    </div>
                    <div className="col-lg-12">
                      <input
                        type="date"
                        name="Ngaysinh"
                        placeholder="Ngày sinh (YYYY-MM-DD)"
                        value={form.Ngaysinh}
                        onChange={onChange}
                        style={{ marginBottom: "20px" }}
                      />
                    </div>
                    <div className="col-lg-12">
                      <button
                        type="submit"
                        className="site-btn"
                        disabled={loading}
                      >
                        {loading ? "Đang xử lý..." : "Tạo tài khoản"}
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                <div className="contact-form">
                  <div
                    className="section-title"
                    style={{ marginBottom: "30px" }}
                  >
                    <span>Bước cuối</span>
                    <h3>Xác thực mã OTP</h3>
                    <p>
                      Chúng tôi đã gửi mã xác thực đến email của bạn. Vui lòng
                      nhập mã để hoàn tất đăng ký.
                    </p>
                  </div>
                  <form onSubmit={submitVerify}>
                    <div className="row">
                      <div className="col-lg-12">
                        <input
                          type="text"
                          placeholder="Nhập mã OTP (6 chữ số)"
                          value={otp}
                          onChange={(e) => setOtp(e.target.value)}
                          required
                          maxLength={6}
                          pattern="[0-9]{6}"
                          style={{
                            marginBottom: "20px",
                            textAlign: "center",
                            fontSize: "18px",
                            letterSpacing: "2px",
                          }}
                        />
                      </div>
                      <div className="col-lg-12">
                        <button
                          type="submit"
                          className="site-btn"
                          disabled={loading}
                        >
                          {loading ? "Đang xác thực..." : "Xác thực OTP"}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              )}

              {message && (
                <div className="row" style={{ marginTop: "20px" }}>
                  <div className="col-lg-12">
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
                </div>
              )}

              {!pendingId && (
                <div className="row" style={{ marginTop: "20px" }}>
                  <div className="col-lg-12" style={{ textAlign: "center" }}>
                    <p>
                      Đã có tài khoản?{" "}
                      <a href="#/login" style={{ color: "#dfa974" }}>
                        Đăng nhập ngay
                      </a>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default RegisterPage;
