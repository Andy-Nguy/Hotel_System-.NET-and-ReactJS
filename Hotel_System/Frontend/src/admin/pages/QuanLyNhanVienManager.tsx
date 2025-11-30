import React, { useEffect, useState } from "react";
import { API_CONFIG } from "../../api/config";

const API_BASE = `${API_CONFIG.CURRENT}/api`;

interface NhanVien {
  idNguoiDung: number;
  idKhachHang: number;
  hoTen: string;
  email: string | null;
  soDienThoai: string | null;
  ngaySinh: string | null;
  ngayDangKy: string | null;
  vaiTro: number;
  tenVaiTro: string;
}

interface ThongKe {
  tongSo: number;
  soNhanVien: number;
  soAdmin: number;
}

const QuanLyNhanVienManager: React.FC = () => {
  const [nhanViens, setNhanViens] = useState<NhanVien[]>([]);
  const [thongKe, setThongKe] = useState<ThongKe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingNhanVien, setEditingNhanVien] = useState<NhanVien | null>(null);
  const [formData, setFormData] = useState({
    hoTen: "",
    email: "",
    matKhau: "",
    soDienThoai: "",
    ngaySinh: "",
    vaiTro: 1,
  });
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    idNguoiDung: 0,
    matKhauMoi: "",
    xacNhanMatKhau: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const getToken = () => localStorage.getItem("hs_token");

  // Fetch danh sách nhân viên
  const fetchNhanViens = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/QuanLyNhanVien`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setNhanViens(data.data || []);
      } else {
        setError(data.error || "Không thể tải danh sách nhân viên");
      }
    } catch (err) {
      setError("Lỗi kết nối server");
    } finally {
      setLoading(false);
    }
  };

  // Fetch thống kê
  const fetchThongKe = async () => {
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/QuanLyNhanVien/thong-ke`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setThongKe(data.data);
      }
    } catch (err) {
      console.error("Lỗi fetch thống kê:", err);
    }
  };

  useEffect(() => {
    fetchNhanViens();
    fetchThongKe();
  }, []);

  // Mở modal tạo mới
  const handleOpenCreate = () => {
    setEditingNhanVien(null);
    setFormData({
      hoTen: "",
      email: "",
      matKhau: "",
      soDienThoai: "",
      ngaySinh: "",
      vaiTro: 1,
    });
    setShowModal(true);
  };

  // Mở modal sửa
  const handleOpenEdit = (nv: NhanVien) => {
    setEditingNhanVien(nv);
    setFormData({
      hoTen: nv.hoTen || "",
      email: nv.email || "",
      matKhau: "",
      soDienThoai: nv.soDienThoai || "",
      ngaySinh: nv.ngaySinh ? nv.ngaySinh.split("T")[0] : "",
      vaiTro: nv.vaiTro,
    });
    setShowModal(true);
  };

  // Submit form tạo/sửa
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      const token = getToken();

      if (editingNhanVien) {
        // Cập nhật
        const res = await fetch(
          `${API_BASE}/QuanLyNhanVien/${editingNhanVien.idNguoiDung}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              hoTen: formData.hoTen,
              email: formData.email,
              soDienThoai: formData.soDienThoai,
              ngaySinh: formData.ngaySinh || null,
              vaiTro: formData.vaiTro,
            }),
          }
        );
        const data = await res.json();
        if (data.success) {
          setMessage({
            type: "success",
            text: "Cập nhật nhân viên thành công!",
          });
          setShowModal(false);
          fetchNhanViens();
          fetchThongKe();
        } else {
          setMessage({
            type: "error",
            text: data.error || "Cập nhật thất bại",
          });
        }
      } else {
        // Tạo mới
        if (!formData.matKhau || formData.matKhau.length < 6) {
          setMessage({
            type: "error",
            text: "Mật khẩu phải có ít nhất 6 ký tự",
          });
          setSubmitting(false);
          return;
        }
        const res = await fetch(`${API_BASE}/QuanLyNhanVien`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            hoTen: formData.hoTen,
            email: formData.email,
            matKhau: formData.matKhau,
            soDienThoai: formData.soDienThoai,
            ngaySinh: formData.ngaySinh || null,
            vaiTro: formData.vaiTro,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setMessage({ type: "success", text: "Tạo nhân viên thành công!" });
          setShowModal(false);
          fetchNhanViens();
          fetchThongKe();
        } else {
          setMessage({
            type: "error",
            text: data.error || "Tạo nhân viên thất bại",
          });
        }
      }
    } catch (err) {
      setMessage({ type: "error", text: "Lỗi kết nối server" });
    } finally {
      setSubmitting(false);
    }
  };

  // Xóa nhân viên
  const handleDelete = async (id: number, hoTen: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa nhân viên "${hoTen}"?`))
      return;

    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/QuanLyNhanVien/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: "Xóa nhân viên thành công!" });
        fetchNhanViens();
        fetchThongKe();
      } else {
        setMessage({ type: "error", text: data.error || "Xóa thất bại" });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Lỗi kết nối server" });
    }
  };

  // Mở modal đổi mật khẩu
  const handleOpenPasswordModal = (nv: NhanVien) => {
    setPasswordData({
      idNguoiDung: nv.idNguoiDung,
      matKhauMoi: "",
      xacNhanMatKhau: "",
    });
    setShowPasswordModal(true);
  };

  // Submit đổi mật khẩu
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.matKhauMoi !== passwordData.xacNhanMatKhau) {
      setMessage({ type: "error", text: "Mật khẩu xác nhận không khớp" });
      return;
    }
    if (passwordData.matKhauMoi.length < 6) {
      setMessage({ type: "error", text: "Mật khẩu phải có ít nhất 6 ký tự" });
      return;
    }

    setSubmitting(true);
    try {
      const token = getToken();
      const res = await fetch(
        `${API_BASE}/QuanLyNhanVien/${passwordData.idNguoiDung}/doi-mat-khau`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ matKhauMoi: passwordData.matKhauMoi }),
        }
      );
      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: "Đổi mật khẩu thành công!" });
        setShowPasswordModal(false);
      } else {
        setMessage({
          type: "error",
          text: data.error || "Đổi mật khẩu thất bại",
        });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Lỗi kết nối server" });
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      return new Date(dateStr).toLocaleDateString("vi-VN");
    } catch {
      return dateStr;
    }
  };

  return (
    <div style={{ padding: "24px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "24px",
              fontWeight: "700",
              color: "#1e293b",
              margin: 0,
            }}
          >
            Quản lý Nhân viên
          </h1>
          <p style={{ color: "#64748b", margin: "4px 0 0 0" }}>
            Quản lý danh sách nhân viên và admin trong hệ thống
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          style={{
            background: "#3b82f6",
            color: "#fff",
            border: "none",
            padding: "10px 20px",
            borderRadius: "8px",
            fontWeight: "600",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span style={{ fontSize: "18px" }}>+</span> Thêm nhân viên
        </button>
      </div>

      {/* Thống kê */}
      {thongKe && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: "20px",
              borderRadius: "12px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}
          >
            <div style={{ fontSize: "14px", color: "#64748b" }}>Tổng số</div>
            <div
              style={{ fontSize: "28px", fontWeight: "700", color: "#1e293b" }}
            >
              {thongKe.tongSo}
            </div>
          </div>
          <div
            style={{
              background: "#fff",
              padding: "20px",
              borderRadius: "12px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}
          >
            <div style={{ fontSize: "14px", color: "#64748b" }}>Nhân viên</div>
            <div
              style={{ fontSize: "28px", fontWeight: "700", color: "#3b82f6" }}
            >
              {thongKe.soNhanVien}
            </div>
          </div>
          <div
            style={{
              background: "#fff",
              padding: "20px",
              borderRadius: "12px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}
          >
            <div style={{ fontSize: "14px", color: "#64748b" }}>Admin</div>
            <div
              style={{ fontSize: "28px", fontWeight: "700", color: "#ef4444" }}
            >
              {thongKe.soAdmin}
            </div>
          </div>
        </div>
      )}

      {/* Message */}
      {message && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            marginBottom: "16px",
            background: message.type === "success" ? "#dcfce7" : "#fee2e2",
            color: message.type === "success" ? "#166534" : "#991b1b",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{message.text}</span>
          <button
            onClick={() => setMessage(null)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "18px",
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Loading / Error */}
      {loading && (
        <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
          Đang tải...
        </div>
      )}
      {error && (
        <div style={{ textAlign: "center", padding: "40px", color: "#ef4444" }}>
          {error}
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <div
          style={{
            background: "#fff",
            borderRadius: "12px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  background: "#f8fafc",
                  borderBottom: "1px solid #e2e8f0",
                }}
              >
                <th
                  style={{
                    padding: "12px 16px",
                    textAlign: "left",
                    fontWeight: "600",
                    color: "#475569",
                  }}
                >
                  ID
                </th>
                <th
                  style={{
                    padding: "12px 16px",
                    textAlign: "left",
                    fontWeight: "600",
                    color: "#475569",
                  }}
                >
                  Họ tên
                </th>
                <th
                  style={{
                    padding: "12px 16px",
                    textAlign: "left",
                    fontWeight: "600",
                    color: "#475569",
                  }}
                >
                  Email
                </th>
                <th
                  style={{
                    padding: "12px 16px",
                    textAlign: "left",
                    fontWeight: "600",
                    color: "#475569",
                  }}
                >
                  SĐT
                </th>
                <th
                  style={{
                    padding: "12px 16px",
                    textAlign: "left",
                    fontWeight: "600",
                    color: "#475569",
                  }}
                >
                  Ngày sinh
                </th>
                <th
                  style={{
                    padding: "12px 16px",
                    textAlign: "left",
                    fontWeight: "600",
                    color: "#475569",
                  }}
                >
                  Vai trò
                </th>
                <th
                  style={{
                    padding: "12px 16px",
                    textAlign: "center",
                    fontWeight: "600",
                    color: "#475569",
                  }}
                >
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {nhanViens.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      padding: "40px",
                      textAlign: "center",
                      color: "#64748b",
                    }}
                  >
                    Chưa có nhân viên nào
                  </td>
                </tr>
              ) : (
                nhanViens.map((nv) => (
                  <tr
                    key={nv.idNguoiDung}
                    style={{ borderBottom: "1px solid #e2e8f0" }}
                  >
                    <td style={{ padding: "12px 16px", color: "#64748b" }}>
                      {nv.idNguoiDung}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        fontWeight: "500",
                        color: "#1e293b",
                      }}
                    >
                      {nv.hoTen}
                    </td>
                    <td style={{ padding: "12px 16px", color: "#64748b" }}>
                      {nv.email || "-"}
                    </td>
                    <td style={{ padding: "12px 16px", color: "#64748b" }}>
                      {nv.soDienThoai || "-"}
                    </td>
                    <td style={{ padding: "12px 16px", color: "#64748b" }}>
                      {formatDate(nv.ngaySinh)}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span
                        style={{
                          padding: "4px 10px",
                          borderRadius: "20px",
                          fontSize: "12px",
                          fontWeight: "600",
                          background: nv.vaiTro === 2 ? "#fef2f2" : "#eff6ff",
                          color: nv.vaiTro === 2 ? "#dc2626" : "#2563eb",
                        }}
                      >
                        {nv.tenVaiTro}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          justifyContent: "center",
                        }}
                      >
                        <button
                          onClick={() => handleOpenEdit(nv)}
                          style={{
                            background: "#eef2ff",
                            color: "#4f46e5",
                            border: "none",
                            padding: "6px 12px",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontWeight: "500",
                            fontSize: "13px",
                          }}
                        >
                          Sửa
                        </button>
                        <button
                          onClick={() => handleOpenPasswordModal(nv)}
                          style={{
                            background: "#fef3c7",
                            color: "#d97706",
                            border: "none",
                            padding: "6px 12px",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontWeight: "500",
                            fontSize: "13px",
                          }}
                        >
                          Đổi MK
                        </button>
                        <button
                          onClick={() => handleDelete(nv.idNguoiDung, nv.hoTen)}
                          style={{
                            background: "#fee2e2",
                            color: "#dc2626",
                            border: "none",
                            padding: "6px 12px",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontWeight: "500",
                            fontSize: "13px",
                          }}
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Tạo/Sửa nhân viên */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "16px",
              padding: "24px",
              width: "100%",
              maxWidth: "500px",
              maxHeight: "90vh",
              overflow: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              style={{
                margin: "0 0 20px 0",
                fontSize: "20px",
                fontWeight: "700",
                color: "#1e293b",
              }}
            >
              {editingNhanVien ? "Cập nhật nhân viên" : "Thêm nhân viên mới"}
            </h2>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "6px",
                    fontWeight: "500",
                    color: "#374151",
                  }}
                >
                  Họ tên <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="text"
                  value={formData.hoTen}
                  onChange={(e) =>
                    setFormData({ ...formData, hoTen: e.target.value })
                  }
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: "8px",
                    fontSize: "14px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "6px",
                    fontWeight: "500",
                    color: "#374151",
                  }}
                >
                  Email <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: "8px",
                    fontSize: "14px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {!editingNhanVien && (
                <div style={{ marginBottom: "16px" }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "6px",
                      fontWeight: "500",
                      color: "#374151",
                    }}
                  >
                    Mật khẩu <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="password"
                    value={formData.matKhau}
                    onChange={(e) =>
                      setFormData({ ...formData, matKhau: e.target.value })
                    }
                    required={!editingNhanVien}
                    minLength={6}
                    placeholder="Tối thiểu 6 ký tự"
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: "1px solid #d1d5db",
                      borderRadius: "8px",
                      fontSize: "14px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              )}

              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "6px",
                    fontWeight: "500",
                    color: "#374151",
                  }}
                >
                  Số điện thoại
                </label>
                <input
                  type="tel"
                  value={formData.soDienThoai}
                  onChange={(e) =>
                    setFormData({ ...formData, soDienThoai: e.target.value })
                  }
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: "8px",
                    fontSize: "14px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "6px",
                    fontWeight: "500",
                    color: "#374151",
                  }}
                >
                  Ngày sinh
                </label>
                <input
                  type="date"
                  value={formData.ngaySinh}
                  onChange={(e) =>
                    setFormData({ ...formData, ngaySinh: e.target.value })
                  }
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: "8px",
                    fontSize: "14px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ marginBottom: "24px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "6px",
                    fontWeight: "500",
                    color: "#374151",
                  }}
                >
                  Vai trò <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <select
                  value={formData.vaiTro}
                  onChange={(e) =>
                    setFormData({ ...formData, vaiTro: Number(e.target.value) })
                  }
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: "8px",
                    fontSize: "14px",
                    boxSizing: "border-box",
                    background: "#fff",
                  }}
                >
                  <option value={1}>Nhân viên</option>
                  <option value={2}>Admin</option>
                </select>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    padding: "10px 20px",
                    border: "1px solid #d1d5db",
                    borderRadius: "8px",
                    background: "#fff",
                    color: "#374151",
                    fontWeight: "500",
                    cursor: "pointer",
                  }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: "10px 20px",
                    border: "none",
                    borderRadius: "8px",
                    background: "#3b82f6",
                    color: "#fff",
                    fontWeight: "500",
                    cursor: submitting ? "not-allowed" : "pointer",
                    opacity: submitting ? 0.7 : 1,
                  }}
                >
                  {submitting
                    ? "Đang xử lý..."
                    : editingNhanVien
                    ? "Cập nhật"
                    : "Tạo mới"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Đổi mật khẩu */}
      {showPasswordModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowPasswordModal(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "16px",
              padding: "24px",
              width: "100%",
              maxWidth: "400px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              style={{
                margin: "0 0 20px 0",
                fontSize: "20px",
                fontWeight: "700",
                color: "#1e293b",
              }}
            >
              Đổi mật khẩu nhân viên
            </h2>

            <form onSubmit={handleChangePassword}>
              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "6px",
                    fontWeight: "500",
                    color: "#374151",
                  }}
                >
                  Mật khẩu mới <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="password"
                  value={passwordData.matKhauMoi}
                  onChange={(e) =>
                    setPasswordData({
                      ...passwordData,
                      matKhauMoi: e.target.value,
                    })
                  }
                  required
                  minLength={6}
                  placeholder="Tối thiểu 6 ký tự"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: "8px",
                    fontSize: "14px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ marginBottom: "24px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "6px",
                    fontWeight: "500",
                    color: "#374151",
                  }}
                >
                  Xác nhận mật khẩu <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="password"
                  value={passwordData.xacNhanMatKhau}
                  onChange={(e) =>
                    setPasswordData({
                      ...passwordData,
                      xacNhanMatKhau: e.target.value,
                    })
                  }
                  required
                  placeholder="Nhập lại mật khẩu"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: "8px",
                    fontSize: "14px",
                    boxSizing: "border-box",
                  }}
                />
                {passwordData.xacNhanMatKhau &&
                  passwordData.matKhauMoi !== passwordData.xacNhanMatKhau && (
                    <small
                      style={{
                        color: "#ef4444",
                        marginTop: "4px",
                        display: "block",
                      }}
                    >
                      Mật khẩu không khớp
                    </small>
                  )}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  style={{
                    padding: "10px 20px",
                    border: "1px solid #d1d5db",
                    borderRadius: "8px",
                    background: "#fff",
                    color: "#374151",
                    fontWeight: "500",
                    cursor: "pointer",
                  }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={
                    submitting ||
                    passwordData.matKhauMoi !== passwordData.xacNhanMatKhau
                  }
                  style={{
                    padding: "10px 20px",
                    border: "none",
                    borderRadius: "8px",
                    background: "#f59e0b",
                    color: "#fff",
                    fontWeight: "500",
                    cursor: submitting ? "not-allowed" : "pointer",
                    opacity:
                      submitting ||
                      passwordData.matKhauMoi !== passwordData.xacNhanMatKhau
                        ? 0.7
                        : 1,
                  }}
                >
                  {submitting ? "Đang xử lý..." : "Đổi mật khẩu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuanLyNhanVienManager;
