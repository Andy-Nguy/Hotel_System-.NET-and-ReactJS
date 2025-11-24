import React, { useEffect, useMemo, useState } from "react";
import Slidebar from "../components/Slidebar";
import HeaderSection from "../components/HeaderSection";
import {
  Button,
  Card,
  DatePicker,
  Input,
  Select,
  Space,
  Tag,
  message,
  Modal,
  Statistic,
  Row,
  Col,
  Tooltip,
  Descriptions,
  Typography,
  Divider,
  Avatar,
} from "antd";
import {
  DownloadOutlined,
  FileTextOutlined,
  UserOutlined,
  CalendarOutlined,
  DollarOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs, { Dayjs } from "dayjs";
import { getRoomTypes } from "../../api/roomsApi";
import invoiceApi from "../../api/invoiceApi";
import DataTable from "../components/DataTable";

interface InvoiceRow {
  idHoaDon: string;
  idDatPhong: string;
  ngayLap?: string;
  tongTien: number;
  tienCoc: number;
  tienThanhToan: number;
  trangThaiThanhToan: number;
  ghiChu?: string;
  customer?: {
    id?: number;
    hoTen?: string;
    email?: string;
    soDienThoai?: string;
    tichDiem?: number;
  };
}

// Chi tiết hóa đơn (dùng cho modal xem chi tiết)
interface InvoiceDetail {
  idHoaDon: string;
  idDatPhong: string;
  ngayLap?: string;
  tongTien?: number;
  tienCoc?: number;
  tienThanhToan?: number;
  trangThaiThanhToan?: number;
  ghiChu?: string;
  customer?: {
    id?: number;
    hoTen?: string;
    email?: string;
    soDienThoai?: string;
    tichDiem?: number;
  };
  roomLines?: Array<{
    IDPhong?: string;
    SoDem?: number;
    GiaPhong?: number;
    ThanhTien?: number;
  }>;
  services?: Array<{
    IddichVu?: string;
    TienDichVu?: number;
    ThoiGianThucHien?: string;
    TrangThai?: string;
  }>;
}

const statusColor = (s: number) =>
  s === 2 ? "green" : s === 1 ? "red" : s === 0 ? "orange" : "default";
const statusText = (s: number) =>
  s === 2
    ? "Đã thanh toán"
    : s === 1
    ? "Chưa thanh toán"
    : s === 0
    ? "Đã cọc"
    : "Khác";

// Resolve API base from Vite env when available (VITE_API_URL)
const _VITE_API = (import.meta as any).env?.VITE_API_URL || "";
const API_BASE = _VITE_API.replace(/\/$/, "")
  ? `${_VITE_API.replace(/\/$/, "")}/api`
  : "/api";

const fetchJson = async (url: string, init?: RequestInit) => {
  // Prepend API_BASE if url starts with /api
  const finalUrl = url.startsWith("/api") ? `${API_BASE}${url.slice(4)}` : url;
  const res = await fetch(finalUrl, init);
  const txt = await res.text().catch(() => "");
  const data = txt ? JSON.parse(txt) : null;
  if (!res.ok)
    throw new Error(
      (data && (data.message || data.error)) || `HTTP ${res.status}`
    );
  return data;
};

const InvoicesManager: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<InvoiceRow[]>([]);
  const [from, setFrom] = useState<Dayjs | null>(dayjs().startOf("month"));
  const [to, setTo] = useState<Dayjs | null>(dayjs());
  const [status, setStatus] = useState<number | undefined>(undefined);
  const [keyword, setKeyword] = useState("");
  const [roomTypes, setRoomTypes] = useState<any[]>([]);
  const [selectedRoomType, setSelectedRoomType] = useState<string | undefined>(
    undefined
  );
  const [staff, setStaff] = useState<string | undefined>(undefined);
  const [selectedCustomer, setSelectedCustomer] = useState<number | undefined>(
    undefined
  );
  const [summary, setSummary] = useState<{
    totalInvoices: number;
    totalAmount: number;
    totalDeposit: number;
    totalPaid: number;
    totalPending: number;
  } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (from) qs.set("from", from.format("YYYY-MM-DD"));
      if (to) qs.set("to", to.format("YYYY-MM-DD"));
      if (status != null) qs.set("status", String(status));
      if (selectedRoomType) qs.set("roomType", selectedRoomType);
      if (staff) qs.set("staff", staff);
      if (selectedCustomer) qs.set("customer", String(selectedCustomer));
      const listRes = await fetchJson(
        `/api/Invoices/invoices?${qs.toString()}`
      );
      const rows: InvoiceRow[] = (listRes.data || []).map((x: any) => ({
        idHoaDon: x.idHoaDon,
        idDatPhong: x.idDatPhong,
        ngayLap: x.ngayLap,
        tongTien: x.tongTien,
        tienCoc: x.tienCoc,
        tienThanhToan: x.tienThanhToan,
        trangThaiThanhToan: x.trangThaiThanhToan,
        ghiChu: x.ghiChu,
        customer: x.customer,
      }));
      setData(rows);
      const sumRes = await fetchJson(`/api/Invoices/summary?${qs.toString()}`);
      setSummary(sumRes.data);
    } catch (e: any) {
      message.error(e.message || "Không thể tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const types = await getRoomTypes();
        setRoomTypes(types || []);
      } catch (e) {
        // ignore
      }
    })();
    // eslint-disable-next-line
  }, []);

  const [detailVisible, setDetailVisible] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);

  const openDetail = async (idHoaDon: string) => {
    try {
      setLoading(true);
      const d = await invoiceApi.getInvoiceDetail(idHoaDon);
      if (d && d.data) {
        const raw = d.data as any;
        const rawRoomLines =
          raw.roomLines ??
          raw.roomLines ??
          raw.roomLines ??
          raw.roomLines ??
          raw.roomLines ??
          raw.roomLines ??
          raw.roomLines;
        const roomLines = (
          raw.roomLines ??
          raw.roomLines ??
          raw.roomLines ??
          raw.roomLines ??
          raw.roomLines ??
          raw.roomLines ??
          raw.roomLines ??
          []
        ).map((r: any) => ({
          IDPhong:
            r.IDPhong ??
            r.idPhong ??
            r.IDPhòng ??
            r.idphong ??
            r.IDPHONG ??
            r.IDPhong,
          SoDem: r.SoDem ?? r.soDem ?? r.sodem ?? r.SoDem ?? r.SoDem,
          GiaPhong:
            r.GiaPhong ?? r.giaPhong ?? r.giaPhong ?? r.GiaPhong ?? r.GiaPhong,
          ThanhTien: r.ThanhTien ?? r.thanhTien ?? r.ThanhTien ?? r.ThanhTien,
        }));

        const rawServices = raw.services ?? raw.services ?? [];
        const services = (raw.services ?? raw.services ?? []).map((s: any) => ({
          IddichVu:
            s.IddichVu ?? s.iddichVu ?? s.idDichVu ?? s.idDichVu ?? s.IddichVu,
          TienDichVu:
            s.TienDichVu ??
            s.tienDichVu ??
            s.tiendichvu ??
            s.TienDichVu ??
            s.TienDichVu,
          ThoiGianThucHien:
            s.ThoiGianThucHien ?? s.thoiGianThucHien ?? s.ThoiGianThucHien,
          TrangThai: s.TrangThai ?? s.trangThai ?? s.TrangThai,
        }));

        d.data.roomLines = roomLines;
        d.data.services = services;
      }
      setDetail(d as { data: InvoiceDetail } | null);
      setDetailVisible(true);
    } catch (e: any) {
      message.error(e.message || "Không thể tải chi tiết");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, []);

  const filtered = useMemo(() => {
    if (!keyword) return data;
    const k = keyword.toLowerCase();
    return data.filter(
      (r) =>
        r.idHoaDon.toLowerCase().includes(k) ||
        r.idDatPhong.toLowerCase().includes(k) ||
        (r.customer?.hoTen || "").toLowerCase().includes(k) ||
        (r.customer?.email || "").toLowerCase().includes(k)
    );
  }, [data, keyword]);

  const downloadPdf = async (row: InvoiceRow) => {
    const url = `/api/ThanhToan/hoa-don/${row.idHoaDon}/pdf`;
    try {
      setLoading(true);
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/pdf",
        },
      });

      if (!res.ok) {
        // Try to read response as text/JSON to show useful error message
        const txt = await res.text().catch(() => "");
        let errMsg = txt ? txt.substring(0, 1000) : `HTTP ${res.status}`;
        try {
          const parsed = JSON.parse(txt);
          errMsg = (parsed && (parsed.message || parsed.error)) || errMsg;
        } catch {
          /* not JSON, keep text */
        }
        throw new Error(`Lỗi ${res.status}: ${errMsg}`);
      }

      // Get filename from Content-Disposition header if provided
      const contentDisposition = res.headers.get("content-disposition") || "";
      let filename = `HoaDon_${row.idHoaDon}.pdf`;
      const fileMatch = contentDisposition.match(
        /filename\*?=(?:UTF-8'')?["']?([^;"']+)/i
      );
      if (fileMatch && fileMatch[1]) {
        try {
          filename = decodeURIComponent(fileMatch[1]);
        } catch {
          filename = fileMatch[1];
        }
      }

      const blob = await res.blob();
      const link = document.createElement("a");
      const href = URL.createObjectURL(blob);
      link.href = href;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(href);

      message.success("Đã tải hóa đơn thành công!");
    } catch (err: any) {
      console.error("Lỗi tải PDF:", err);
      message.error(err?.message || "Không thể tải hóa đơn PDF");
    } finally {
      setLoading(false);
    }
  };
  const handleDownloadPdf = (row: InvoiceRow) => {
    downloadPdf(row);
  };

  const updateStatus = async (row: InvoiceRow, newStatus: number) => {
    try {
      const token = localStorage.getItem("hs_token");
      const headers: any = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`/api/ThanhToan/cap-nhat-trang-thanh-toan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          IDDatPhong: row.idDatPhong,
          TrangThaiThanhToan: newStatus,
          GhiChu: row.ghiChu,
        }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        let err = `HTTP ${res.status}`;
        try { const parsed = txt ? JSON.parse(txt) : null; err = (parsed && (parsed.message || parsed.error)) || err; } catch {}
        throw new Error(err);
      }
      message.success("Đã cập nhật trạng thái");
      load();
    } catch (e: any) {
      message.error(e.message || "Cập nhật thất bại");
    }
  };

  const columns: ColumnsType<InvoiceRow> = [
    {
      title: "Hóa đơn",
      dataIndex: "idHoaDon",
      key: "idHoaDon",
      width: 140,
      render: (text) => (
        <Tooltip title={text}>
          <span style={{ fontSize: 13 }}>
            {text && text.length > 8 ? text.substring(0, 8) + "..." : text}
          </span>
        </Tooltip>
      ),
    },
    {
      title: "Đặt phòng",
      dataIndex: "idDatPhong",
      key: "idDatPhong",
      width: 140,
      render: (text) => (
        <Tooltip title={text}>
          <span style={{ fontSize: 13 }}>
            {text && text.length > 8 ? text.substring(0, 8) + "..." : text}
          </span>
        </Tooltip>
      ),
    },
    {
      title: "Khách hàng",
      key: "customer",
      render: (_, r) => (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div>{r.customer?.hoTen}</div>
            {typeof r.customer?.tichDiem === "number" && (
              <Tag color="blue">{r.customer?.tichDiem} điểm</Tag>
            )}
          </div>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            {r.customer?.email}
          </div>
        </div>
      ),
    },
    {
      title: "Ngày lập",
      dataIndex: "ngayLap",
      key: "ngayLap",
      width: 160,
      render: (v) => (v ? new Date(v).toLocaleString("vi-VN") : "-"),
    },
    {
      title: "Tổng tiền",
      dataIndex: "tongTien",
      key: "tongTien",
      align: "right",
      render: (v) => <b>{Number(v).toLocaleString()}đ</b>,
    },
    {
      title: "Cọc",
      dataIndex: "tienCoc",
      key: "tienCoc",
      align: "right",
      render: (v) => Number(v).toLocaleString(),
    },
    {
      title: "Thanh toán",
      dataIndex: "tienThanhToan",
      key: "tienThanhToan",
      align: "right",
      render: (v) => Number(v).toLocaleString(),
    },
    {
      title: "Thao tác",
      key: "actions",
      render: (_, r) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Space>
            <Button
              icon={<DownloadOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                handleDownloadPdf(r);
              }}
            >
              Tải hóa đơn PDF
            </Button>
            <Select
              size="small"
              value={r.trangThaiThanhToan}
              style={{ width: 140 }}
              onClick={(e) => e.stopPropagation()}
              onChange={(val, opt) => {
                updateStatus(r, val as number);
              }}
              options={[
                { value: 0, label: "Đã cọc" },
                { value: 1, label: "Chưa thanh toán" },
                { value: 2, label: "Đã thanh toán" },
              ]}
            />
          </Space>
        </div>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "trangThaiThanhToan",
      key: "status",
      fixed: "right",
      render: (s) => <Tag color={statusColor(s)}>{statusText(s)}</Tag>,
    },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <Slidebar />
      <div style={{ marginLeft: 240 }}>
        <HeaderSection showStats={false} />
        <main style={{ padding: "0px 60px" }}>
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 20,
              boxShadow: "0 8px 24px rgba(2,6,23,0.06)",
            }}
          >
            <h2 style={{ marginBottom: 16 }}>Quản lý hóa đơn</h2>
            <Card style={{ marginBottom: 16 }}>
              <Space wrap>
                <DatePicker
                  value={from}
                  onChange={(d) => setFrom(d)}
                  placeholder="Từ ngày"
                />
                <DatePicker
                  value={to}
                  onChange={(d) => setTo(d)}
                  placeholder="Đến ngày"
                />
                <Select
                  allowClear
                  placeholder="Khách hàng"
                  style={{ width: 220 }}
                  value={selectedCustomer}
                  onChange={(v) => setSelectedCustomer(v)}
                />
                <Select
                  allowClear
                  placeholder="Trạng thái"
                  value={status}
                  onChange={(v) => setStatus(v)}
                  options={[
                    { value: 0, label: "Đã cọc" },
                    { value: 1, label: "Chưa thanh toán" },
                    { value: 2, label: "Đã thanh toán" },
                  ]}
                  style={{ width: 160 }}
                />
                <Input.Search
                  placeholder="Tìm HĐ / ĐP / KH"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onSearch={() => load()}
                />
                <Button type="primary" onClick={load} loading={loading}>
                  Tải dữ liệu
                </Button>
              </Space>
            </Card>

            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col xs={24} md={6}>
                <Card>
                  <Statistic
                    title="Số hóa đơn"
                    value={summary?.totalInvoices || 0}
                  />
                </Card>
              </Col>
              <Col xs={24} md={6}>
                <Card>
                  <Statistic
                    title="Tổng tiền"
                    value={summary?.totalAmount || 0}
                    precision={0}
                    suffix="đ"
                  />
                </Card>
              </Col>
              <Col xs={24} md={6}>
                <Card>
                  <Statistic
                    title="Đã thanh toán"
                    value={summary?.totalPaid || 0}
                    precision={0}
                    suffix="đ"
                  />
                </Card>
              </Col>
              <Col xs={24} md={6}>
                <Card>
                  <Statistic
                    title="Còn lại"
                    value={summary?.totalPending || 0}
                    precision={0}
                    suffix="đ"
                  />
                </Card>
              </Col>
            </Row>

            <Card>
              <DataTable
                rowKey={(r) => r.idHoaDon}
                onRow={(record) => ({
                  onClick: () => openDetail(record.idHoaDon),
                })}
                columns={columns}
                dataSource={filtered}
                loading={loading}
                pagination={false}
              />
            </Card>
            <Modal
              visible={detailVisible}
              title={
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    paddingBottom: 8,
                    borderBottom: "1px solid #f0f0f0",
                  }}
                >
                  <Avatar
                    size="large"
                    icon={<FileTextOutlined />}
                    style={{ backgroundColor: "#1890ff" }}
                  />
                  <div>
                    <Typography.Title level={4} style={{ margin: 0 }}>
                      Chi tiết hóa đơn
                    </Typography.Title>
                    <Typography.Text type="secondary" style={{ fontSize: 14 }}>
                      #{detail?.data?.idHoaDon ?? detail?.idHoaDon ?? ""}
                    </Typography.Text>
                  </div>
                </div>
              }
              onCancel={() => setDetailVisible(false)}
              footer={null}
              width={900}
              centered
              styles={{ body: { padding: "24px 24px 40px" } }}
            >
              {detail ? (
                <Space
                  direction="vertical"
                  size="large"
                  style={{ width: "100%" }}
                >
                  <Card
                    bordered={false}
                    style={{ background: "#f9fafb", borderRadius: 12 }}
                  >
                    <Descriptions
                      column={{ xxl: 2, xl: 2, lg: 2, md: 1, sm: 1, xs: 1 }}
                      labelStyle={{ color: "#6b7280", fontWeight: 500 }}
                      contentStyle={{ fontWeight: 600, color: "#1f2937" }}
                    >
                      <Descriptions.Item
                        label={
                          <Space>
                            <FileTextOutlined /> Mã đặt phòng
                          </Space>
                        }
                      >
                        {detail.data?.idDatPhong ?? detail.idDatPhong}
                      </Descriptions.Item>
                      <Descriptions.Item
                        label={
                          <Space>
                            <UserOutlined /> Khách hàng
                          </Space>
                        }
                      >
                        <div
                          style={{ display: "flex", flexDirection: "column" }}
                        >
                          <span style={{ fontSize: 16 }}>
                            {detail.data?.customer?.hoTen ??
                              detail.customer?.hoTen}
                          </span>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 400,
                              color: "#9ca3af",
                            }}
                          >
                            {detail.data?.customer?.email ??
                              detail.customer?.email}
                          </span>
                        </div>
                      </Descriptions.Item>
                      <Descriptions.Item
                        label={
                          <Space>
                            <CalendarOutlined /> Ngày lập
                          </Space>
                        }
                      >
                        {new Date(
                          detail.data?.ngayLap ?? detail.ngayLap
                        ).toLocaleString("vi-VN")}
                      </Descriptions.Item>
                      <Descriptions.Item
                        label={
                          <Space>
                            <DollarOutlined /> Tổng tiền
                          </Space>
                        }
                      >
                        <span style={{ fontSize: 18, color: "#059669" }}>
                          {(
                            detail.data?.tongTien ?? detail.tongTien
                          )?.toLocaleString()}{" "}
                          VND
                        </span>
                      </Descriptions.Item>
                      <Descriptions.Item label="Tiền cọc">
                        <span style={{ color: "#f59e0b" }}>
                          {(
                            detail.data?.tienCoc ??
                            detail.tienCoc ??
                            0
                          )?.toLocaleString()}{" "}
                          VND
                        </span>
                      </Descriptions.Item>
                      <Descriptions.Item label="Đã thanh toán">
                        <span style={{ color: "#10b981" }}>
                          {(
                            detail.data?.tienThanhToan ??
                            detail.tienThanhToan ??
                            0
                          )?.toLocaleString()}{" "}
                          VND
                        </span>
                      </Descriptions.Item>
                      <Descriptions.Item label="Trạng thái" span={2}>
                        <Tag
                          color={statusColor(
                            detail.data?.trangThaiThanhToan ??
                              detail.trangThaiThanhToan
                          )}
                          style={{ fontSize: 14, padding: "4px 10px" }}
                        >
                          {statusText(
                            detail.data?.trangThaiThanhToan ??
                              detail.trangThaiThanhToan
                          )}
                        </Tag>
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>

                  <Divider orientation="left" style={{ margin: "12px 0" }}>
                    <Typography.Title level={5} style={{ margin: 0 }}>
                      Danh sách phòng
                    </Typography.Title>
                  </Divider>
                  <DataTable
                    dataSource={
                      detail.data?.roomLines ?? detail.roomLines ?? []
                    }
                    pagination={false}
                    rowKey={(r: any) => r.IDPhong}
                    columns={[
                      { title: "Phòng", dataIndex: "IDPhong", key: "IDPhong" },
                      { title: "Số đêm", dataIndex: "SoDem", key: "SoDem" },
                      {
                        title: "Giá/đêm",
                        dataIndex: "GiaPhong",
                        key: "GiaPhong",
                        render: (v: number) => v?.toLocaleString(),
                      },
                      {
                        title: "Thành tiền",
                        dataIndex: "ThanhTien",
                        key: "ThanhTien",
                        render: (v: number) => <b>{v?.toLocaleString()}đ</b>,
                      },
                    ]}
                  />
                  <Divider orientation="left" style={{ margin: "12px 0" }}>
                    <Typography.Title level={5} style={{ margin: 0 }}>
                      Dịch vụ sử dụng
                    </Typography.Title>
                  </Divider>
                  <DataTable
                    dataSource={detail.data?.services ?? detail.services ?? []}
                    pagination={false}
                    rowKey={(r: any) => r.IddichVu}
                    columns={[
                      {
                        title: "Mã DV",
                        dataIndex: "IddichVu",
                        key: "IddichVu",
                      },
                      {
                        title: "Tiền",
                        dataIndex: "TienDichVu",
                        key: "TienDichVu",
                        render: (v: number) => v?.toLocaleString(),
                      },
                      {
                        title: "Thời gian",
                        dataIndex: "ThoiGianThucHien",
                        key: "ThoiGianThucHien",
                        render: (v: any) =>
                          v ? new Date(v).toLocaleString() : "-",
                      },
                      {
                        title: "Trạng thái",
                        dataIndex: "TrangThai",
                        key: "TrangThai",
                      },
                    ]}
                  />
                </Space>
              ) : null}
            </Modal>
          </div>
        </main>
      </div>
    </div>
  );
};

export default InvoicesManager;
