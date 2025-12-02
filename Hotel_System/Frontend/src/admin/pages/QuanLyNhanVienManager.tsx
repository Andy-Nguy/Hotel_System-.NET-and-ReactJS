import React, { useEffect, useState, useMemo } from "react";
import { API_CONFIG } from "../../api/config";
import {
  Table,
  Button,
  Input,
  Space,
  Tag,
  Popconfirm,
  Tooltip,
  Modal,
  Form,
  DatePicker,
  Select,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import {
  EditOutlined,
  DeleteOutlined,
  KeyOutlined,
  PlusOutlined,
} from "@ant-design/icons";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingNhanVien, setEditingNhanVien] = useState<NhanVien | null>(null);
  const [form] = Form.useForm();
  // AntD Form handles form state for create/edit, remove legacy formData
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm] = Form.useForm();
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

  // Mở modal tạo mới (AntD Form)
  const handleOpenCreate = () => {
    setEditingNhanVien(null);
    form.resetFields();
    // keep password field present for creation
    form.setFieldsValue({ vaiTro: 1 });
    setShowModal(true);
  };

  // Mở modal sửa (AntD Form)
  const handleOpenEdit = (nv: NhanVien) => {
    setEditingNhanVien(nv);
    form.setFieldsValue({
      hoTen: nv.hoTen || "",
      email: nv.email || "",
      soDienThoai: nv.soDienThoai || "",
      ngaySinh: nv.ngaySinh ? dayjs(nv.ngaySinh) : undefined,
      vaiTro: nv.vaiTro,
    });
    setShowModal(true);
  };

  // Form submit handler (AntD Form)
  const handleFormFinish = async (values: any) => {
    setSubmitting(true);
    setMessage(null);
    try {
      const token = getToken();
      const payload = {
        hoTen: values.hoTen,
        email: values.email,
        soDienThoai: values.soDienThoai,
        ngaySinh: values.ngaySinh
          ? dayjs(values.ngaySinh).format("YYYY-MM-DD")
          : null,
        vaiTro: Number(values.vaiTro),
      };
      if (editingNhanVien) {
        // update
        const res = await fetch(
          `${API_BASE}/QuanLyNhanVien/${editingNhanVien.idNguoiDung}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
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
        // create
        if (!values.matKhau || values.matKhau.length < 6) {
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
          body: JSON.stringify({ ...payload, matKhau: values.matKhau }),
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

  // Form submission is handled by AntD Form via handleFormFinish

  // Xóa nhân viên
  const handleDelete = async (id: number, hoTen: string) => {
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
    passwordForm.resetFields();
    setShowPasswordModal(true);
  };

  // Submit đổi mật khẩu (AntD Form)
  const handleChangePassword = async (values: any) => {
    if (values.matKhauMoi !== values.xacNhanMatKhau) {
      setMessage({ type: "error", text: "Mật khẩu xác nhận không khớp" });
      return;
    }
    if (values.matKhauMoi.length < 6) {
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
          body: JSON.stringify({ matKhauMoi: values.matKhauMoi }),
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

  // Filters
  const filteredNhanViens = useMemo(() => {
    if (!searchQuery) return nhanViens;
    const q = searchQuery.trim().toLowerCase();
    return nhanViens.filter((nv) => {
      return (
        `${nv.hoTen} ${nv.email || ""} ${nv.soDienThoai || ""} ${
          nv.idNguoiDung
        }`
          .toLowerCase()
          .indexOf(q) >= 0
      );
    });
  }, [nhanViens, searchQuery]);

  const columns: ColumnsType<NhanVien> = [
    {
      title: "ID",
      dataIndex: "idNguoiDung",
      key: "idNguoiDung",
      width: 100,
    },
    {
      title: "Họ tên",
      dataIndex: "hoTen",
      key: "hoTen",
      render: (text?: string | null, record?: NhanVien) => (
        <strong>{text}</strong>
      ),
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
      render: (email?: string | null) => email || "-",
    },
    {
      title: "SĐT",
      dataIndex: "soDienThoai",
      key: "soDienThoai",
      render: (sdt?: string | null) => sdt || "-",
    },
    {
      title: "Ngày sinh",
      dataIndex: "ngaySinh",
      key: "ngaySinh",
      render: (ns: string) => formatDate(ns),
    },
    {
      title: "Vai trò",
      dataIndex: "tenVaiTro",
      key: "tenVaiTro",
      render: (_: string | null, record: NhanVien) => (
        <Tag color={record.vaiTro === 2 ? "volcano" : "geekblue"}>
          {record.tenVaiTro}
        </Tag>
      ),
    },
    {
      title: "Thao tác",
      key: "action",
      align: "center",
      render: (_: any, record: NhanVien) => (
        <Space>
          <Tooltip title="Sửa">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleOpenEdit(record)}
            />
          </Tooltip>
          <Tooltip title="Đổi mật khẩu">
            <Button
              size="small"
              icon={<KeyOutlined />}
              onClick={() => handleOpenPasswordModal(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Xóa nhân viên?"
            description={`Bạn có chắc muốn xóa nhân viên "${record.hoTen}"?`}
            onConfirm={() => handleDelete(record.idNguoiDung, record.hoTen)}
            okText="Xóa"
            cancelText="Hủy"
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

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
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleOpenCreate}
        >
          Thêm nhân viên
        </Button>
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
          <div style={{ padding: 16, borderBottom: "1px solid #f1f5f9" }}>
            <Space style={{ width: "100%", justifyContent: "space-between" }}>
              <Input.Search
                placeholder="Tìm kiếm nhân viên (tên, email, SĐT, ID)"
                style={{ width: 360 }}
                allowClear
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <Button onClick={() => fetchNhanViens()}>Làm mới</Button>
              </div>
            </Space>
          </div>
          <Table
            columns={columns}
            dataSource={filteredNhanViens.map((nv) => ({
              ...nv,
              key: nv.idNguoiDung,
            }))}
            loading={loading}
            pagination={{ pageSize: 10, showSizeChanger: true }}
            rowKey="idNguoiDung"
          />
        </div>
      )}

      {/* Modal Tạo/Sửa nhân viên - AntD Modal + Form */}
      <Modal
        open={showModal}
        title={editingNhanVien ? "Cập nhật nhân viên" : "Thêm nhân viên"}
        onCancel={() => setShowModal(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleFormFinish}
          preserve={false}
        >
          <Form.Item
            label="Họ tên"
            name="hoTen"
            rules={[{ required: true, message: "Vui lòng nhập họ tên" }]}
          >
            <Input placeholder="Họ tên" />
          </Form.Item>

          <Form.Item
            label="Email"
            name="email"
            rules={[
              {
                type: "email",
                required: true,
                message: "Vui lòng nhập email hợp lệ",
              },
            ]}
          >
            <Input placeholder="Email" />
          </Form.Item>

          {!editingNhanVien && (
            <Form.Item
              label="Mật khẩu"
              name="matKhau"
              rules={[
                { required: true, message: "Vui lòng nhập mật khẩu" },
                { min: 6, message: "Mật khẩu phải có ít nhất 6 ký tự" },
              ]}
            >
              <Input.Password placeholder="Tối thiểu 6 ký tự" />
            </Form.Item>
          )}

          <Form.Item label="Số điện thoại" name="soDienThoai">
            <Input placeholder="Số điện thoại" />
          </Form.Item>

          <Form.Item label="Ngày sinh" name="ngaySinh">
            <DatePicker style={{ width: "100%" }} format={"YYYY-MM-DD"} />
          </Form.Item>

          <Form.Item
            label="Vai trò"
            name="vaiTro"
            rules={[{ required: true, message: "Vui lòng chọn vai trò" }]}
          >
            <Select>
              <Select.Option value={1}>Nhân viên</Select.Option>
              <Select.Option value={2}>Admin</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item style={{ textAlign: "right" }}>
            <Space>
              <Button onClick={() => setShowModal(false)}>Hủy</Button>
              <Button type="primary" htmlType="submit" loading={submitting}>
                {editingNhanVien ? "Cập nhật" : "Tạo mới"}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Đổi mật khẩu - AntD Modal + Form */}
      <Modal
        open={showPasswordModal}
        title="Đổi mật khẩu nhân viên"
        onCancel={() => setShowPasswordModal(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={handleChangePassword}
          preserve={false}
        >
          <Form.Item
            label="Mật khẩu mới"
            name="matKhauMoi"
            rules={[
              { required: true, message: "Vui lòng nhập mật khẩu" },
              { min: 6, message: "Mật khẩu phải có ít nhất 6 ký tự" },
            ]}
          >
            <Input.Password placeholder="Tối thiểu 6 ký tự" />
          </Form.Item>

          <Form.Item
            label="Xác nhận mật khẩu"
            name="xacNhanMatKhau"
            dependencies={["matKhauMoi"]}
            rules={[
              { required: true, message: "Vui lòng xác nhận mật khẩu" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("matKhauMoi") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(
                    new Error("Mật khẩu xác nhận không khớp")
                  );
                },
              }),
            ]}
          >
            <Input.Password placeholder="Nhập lại mật khẩu" />
          </Form.Item>

          <Form.Item style={{ textAlign: "right" }}>
            <Space>
              <Button onClick={() => setShowPasswordModal(false)}>Hủy</Button>
              <Button type="primary" htmlType="submit" loading={submitting}>
                Đổi mật khẩu
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default QuanLyNhanVienManager;
