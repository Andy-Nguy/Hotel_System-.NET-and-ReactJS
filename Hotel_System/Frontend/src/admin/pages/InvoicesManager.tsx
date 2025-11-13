import React, { useEffect, useMemo, useState } from "react";
import Slidebar from "../components/Slidebar";
import HeaderSection from "../components/HeaderSection";
import { Button, Card, DatePicker, Input, Select, Space, Table, Tag, message, Modal, Statistic, Row, Col } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs, { Dayjs } from "dayjs";

interface InvoiceRow {
  idHoaDon: string;
  idDatPhong: string;
  ngayLap?: string;
  tongTien: number;
  tienCoc: number;
  tienThanhToan: number;
  trangThaiThanhToan: number;
  ghiChu?: string;
  customer?: { id?: number; hoTen?: string; email?: string; soDienThoai?: string; tichDiem?: number };
}

const statusColor = (s: number) => (s === 2 ? "green" : s === 1 ? "orange" : "default");
const statusText = (s: number) => (s === 2 ? "Đã thanh toán" : s === 1 ? "Chờ xử lý" : "Khác");

const fetchJson = async (url: string, init?: RequestInit) => {
  const res = await fetch(url, init);
  const txt = await res.text().catch(() => "");
  const data = txt ? JSON.parse(txt) : null;
  if (!res.ok) throw new Error((data && (data.message || data.error)) || `HTTP ${res.status}`);
  return data;
};

const InvoicesManager: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<InvoiceRow[]>([]);
  const [from, setFrom] = useState<Dayjs | null>(dayjs().startOf("month"));
  const [to, setTo] = useState<Dayjs | null>(dayjs());
  const [status, setStatus] = useState<number | undefined>(undefined);
  const [keyword, setKeyword] = useState("");
  const [summary, setSummary] = useState<{ totalInvoices: number; totalAmount: number; totalDeposit: number; totalPaid: number; totalPending: number } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (from) qs.set("from", from.format("YYYY-MM-DD"));
      if (to) qs.set("to", to.format("YYYY-MM-DD"));
      if (status != null) qs.set("status", String(status));
      const listRes = await fetchJson(`/api/Payment/invoices?${qs.toString()}`);
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
      const sumRes = await fetchJson(`/api/Payment/summary?${qs.toString()}`);
      setSummary(sumRes.data);
    } catch (e: any) {
      message.error(e.message || "Không thể tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const filtered = useMemo(() => {
    if (!keyword) return data;
    const k = keyword.toLowerCase();
    return data.filter((r) =>
      r.idHoaDon.toLowerCase().includes(k) ||
      r.idDatPhong.toLowerCase().includes(k) ||
      (r.customer?.hoTen || "").toLowerCase().includes(k) ||
      (r.customer?.email || "").toLowerCase().includes(k)
    );
  }, [data, keyword]);

  const resendEmail = async (row: InvoiceRow) => {
    try {
      await fetchJson(`/api/Payment/invoice/${row.idHoaDon}/send-email`, { method: "POST" });
      message.success("Đã gửi lại email hóa đơn");
    } catch (e: any) {
      message.error(e.message || "Gửi email thất bại");
    }
  };

  const downloadPdf = (row: InvoiceRow) => {
    const link = document.createElement("a");
    link.href = `/api/Payment/invoice/${row.idHoaDon}/pdf`;
    link.target = "_blank";
    link.click();
  };

  const addAdjustment = (row: InvoiceRow) => {
    let inputAmount = 0;
    let inputDesc = "";
    const modal = Modal.confirm({
      title: `Phụ phí / Điều chỉnh - HĐ ${row.idHoaDon}`,
      content: (
        <Space direction="vertical" style={{ width: "100%" }}>
          <Input type="number" placeholder="Số tiền (+/-)" onChange={(e) => (inputAmount = Number(e.target.value))} />
          <Input placeholder="Mô tả (tùy chọn)" onChange={(e) => (inputDesc = e.target.value)} />
        </Space>
      ),
      onOk: async () => {
        try {
          await fetchJson(`/api/Payment/invoice/${row.idHoaDon}/adjustments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount: inputAmount, description: inputDesc }),
          });
          message.success("Đã cập nhật phụ phí");
          load();
        } catch (e: any) {
          message.error(e.message || "Cập nhật thất bại");
        }
      },
    });
  };

  const updateStatus = async (row: InvoiceRow, newStatus: number) => {
    try {
      await fetchJson(`/api/Payment/update-payment-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ IDDatPhong: row.idDatPhong, TrangThaiThanhToan: newStatus, GhiChu: row.ghiChu }),
      });
      message.success("Đã cập nhật trạng thái");
      load();
    } catch (e: any) {
      message.error(e.message || "Cập nhật thất bại");
    }
  };

  const columns: ColumnsType<InvoiceRow> = [
    { title: "Hóa đơn", dataIndex: "idHoaDon", key: "idHoaDon", width: 140 },
    { title: "Đặt phòng", dataIndex: "idDatPhong", key: "idDatPhong", width: 140 },
    { title: "Khách hàng", key: "customer", render: (_, r) => (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div>{r.customer?.hoTen}</div>
          {typeof r.customer?.tichDiem === 'number' && (
            <Tag color="blue">{r.customer?.tichDiem} điểm</Tag>
          )}
        </div>
        <div style={{ fontSize: 12, color: "#64748b" }}>{r.customer?.email}</div>
      </div>
    ) },
    { title: "Ngày lập", dataIndex: "ngayLap", key: "ngayLap", width: 160, render: (v) => v ? new Date(v).toLocaleString("vi-VN") : "-" },
    { title: "Tổng tiền", dataIndex: "tongTien", key: "tongTien", align: "right", render: (v) => <b>{Number(v).toLocaleString()}đ</b> },
    { title: "Cọc", dataIndex: "tienCoc", key: "tienCoc", align: "right", render: (v) => Number(v).toLocaleString() },
    { title: "Thanh toán", dataIndex: "tienThanhToan", key: "tienThanhToan", align: "right", render: (v) => Number(v).toLocaleString() },
    { title: "Trạng thái", dataIndex: "trangThaiThanhToan", key: "status", render: (s) => <Tag color={statusColor(s)}>{statusText(s)}</Tag> },
    { title: "Thao tác", key: "actions", fixed: "right", render: (_, r) => (
      <Space>
        <Button onClick={() => resendEmail(r)}>Gửi email</Button>
        <Button onClick={() => downloadPdf(r)}>PDF</Button>
        <Button onClick={() => addAdjustment(r)}>Phụ phí</Button>
        <Select
          size="small"
          value={r.trangThaiThanhToan}
          style={{ width: 140 }}
          onChange={(val) => updateStatus(r, val)}
          options={[
            { value: 1, label: "Chờ xử lý" },
            { value: 2, label: "Đã thanh toán" },
          ]}
        />
      </Space>
    )},
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <Slidebar />
      <div style={{ marginLeft: 240 }}>
        <HeaderSection />
        <main style={{ padding: "24px 36px" }}>
          <Card style={{ marginBottom: 16 }}>
            <Space wrap>
              <DatePicker value={from} onChange={(d) => setFrom(d)} placeholder="Từ ngày" />
              <DatePicker value={to} onChange={(d) => setTo(d)} placeholder="Đến ngày" />
              <Select
                allowClear
                placeholder="Trạng thái"
                value={status}
                onChange={(v) => setStatus(v)}
                options={[{ value: 1, label: "Chờ xử lý" }, { value: 2, label: "Đã thanh toán" }]}
                style={{ width: 160 }}
              />
              <Input.Search placeholder="Tìm HĐ / ĐP / KH" value={keyword} onChange={(e) => setKeyword(e.target.value)} onSearch={() => load()} />
              <Button type="primary" onClick={load} loading={loading}>Tải dữ liệu</Button>
            </Space>
          </Card>

          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col xs={24} md={6}><Card><Statistic title="Số hóa đơn" value={summary?.totalInvoices || 0} /></Card></Col>
            <Col xs={24} md={6}><Card><Statistic title="Tổng tiền" value={(summary?.totalAmount || 0)} precision={0} suffix="đ" /></Card></Col>
            <Col xs={24} md={6}><Card><Statistic title="Đã thanh toán" value={(summary?.totalPaid || 0)} precision={0} suffix="đ" /></Card></Col>
            <Col xs={24} md={6}><Card><Statistic title="Còn lại" value={(summary?.totalPending || 0)} precision={0} suffix="đ" /></Card></Col>
          </Row>

          <Card>
            <Table
              rowKey={(r) => r.idHoaDon}
              columns={columns}
              dataSource={filtered}
              loading={loading}
              scroll={{ x: 1200 }}
            />
          </Card>
        </main>
      </div>
    </div>
  );
};

export default InvoicesManager;
