import React from "react";

const NoAccessPage: React.FC = () => {
  const toHome = (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      window.history.pushState(null, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
    } catch {
      window.location.href = "/";
    }
  };

  const toLogin = (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      window.history.pushState(null, "", "/login");
      window.dispatchEvent(new PopStateEvent("popstate"));
    } catch {
      window.location.href = "/login";
    }
  };

  return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <h1>Bạn không có quyền truy cập</h1>
      <p>
        Bạn không có quyền xem trang này. Vui lòng đăng nhập với tài khoản quản
        trị.
      </p>
      <div style={{ marginTop: 20 }}>
        <button
          onClick={toHome}
          style={{ marginRight: 12 }}
          className="btn btn-primary"
        >
          Về trang chủ
        </button>
        <button onClick={toLogin} className="btn btn-secondary">
          Đăng nhập
        </button>
      </div>
    </div>
  );
};

export default NoAccessPage;
