import React, { useEffect, useMemo, useState } from "react";
import Slidebar from "../components/Slidebar";
import HeaderSection from "../components/HeaderSection";
import { Button, Card, DatePicker, Input, Select, Space, Table, Tag, message, Modal, Statistic, Row, Col } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs, { Dayjs } from "dayjs";
import { getRoomTypes } from "../../api/roomsApi";
import invoiceApi from "../../api/invoiceApi";

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
  const [roomTypes, setRoomTypes] = useState<any[]>([]);
  const [selectedRoomType, setSelectedRoomType] = useState<string | undefined>(undefined);
  const [staff, setStaff] = useState<string | undefined>(undefined);
  const [selectedCustomer, setSelectedCustomer] = useState<number | undefined>(undefined);
  const [summary, setSummary] = useState<{ totalInvoices: number; totalAmount: number; totalDeposit: number; totalPaid: number; totalPending: number } | null>(null);

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
  const listRes = await fetchJson(`/api/Invoices/invoices?${qs.toString()}`);
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
      // Normalize roomLines and services to handle different JSON naming (camelCase or PascalCase)
      if (d && d.data) {
        const raw = d.data as any;
        const rawRoomLines = raw.roomLines ?? raw.roomLines ?? raw.roomLines ?? raw.roomLines ?? raw.roomLines ?? raw.roomLines ?? raw.roomLines;
        const roomLines = (raw.roomLines ?? raw.roomLines ?? raw.roomLines ?? raw.roomLines ?? raw.roomLines ?? raw.roomLines ?? raw.roomLines ?? [])
          .map((r: any) => ({
            IDPhong: r.IDPhong ?? r.idPhong ?? r.IDPhòng ?? r.idphong ?? r.IDPHONG ?? r.IDPhong,
            SoDem: r.SoDem ?? r.soDem ?? r.sodem ?? r.SoDem ?? r.SoDem,
            GiaPhong: r.GiaPhong ?? r.giaPhong ?? r.giaPhong ?? r.GiaPhong ?? r.GiaPhong,
            ThanhTien: r.ThanhTien ?? r.thanhTien ?? r.ThanhTien ?? r.ThanhTien
          }));

        const rawServices = raw.services ?? raw.services ?? [];
        const services = (raw.services ?? raw.services ?? [])
          .map((s: any) => ({
            IddichVu: s.IddichVu ?? s.iddichVu ?? s.idDichVu ?? s.idDichVu ?? s.IddichVu,
            TienDichVu: s.TienDichVu ?? s.tienDichVu ?? s.tiendichvu ?? s.TienDichVu ?? s.TienDichVu,
            ThoiGianThucHien: s.ThoiGianThucHien ?? s.thoiGianThucHien ?? s.ThoiGianThucHien,
            TrangThai: s.TrangThai ?? s.trangThai ?? s.TrangThai
          }));

        // overwrite arrays so modal rendering uses normalized keys
        d.data.roomLines = roomLines;
        d.data.services = services;
      }
      setDetail(d);
      setDetailVisible(true);
    } catch (e: any) {
      message.error(e.message || 'Không thể tải chi tiết');
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

  // derive customer options from loaded data
  const customerOptions = useMemo(() => {
    const map = new Map<number, { id: number; hoTen?: string }>();
    data.forEach(d => {
      const id = d.customer?.id;
      if (typeof id === 'number' && !map.has(id)) map.set(id, { id, hoTen: d.customer?.hoTen });
    });
    return Array.from(map.values()).map(c => ({ value: c.id, label: c.hoTen || `KH ${c.id}` }));
  }, [data]);

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
        <Button onClick={() => downloadPdf(r)}>PDF</Button>
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
        <HeaderSection showStats={false} />
        <main style={{ padding: "0px 60px" }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 8px 24px rgba(2,6,23,0.06)' }}>
            <h2 style={{ marginBottom: 16 }}>Quản lý hóa đơn</h2>
          <Card style={{ marginBottom: 16 }}>
            <Space wrap>
              <DatePicker value={from} onChange={(d) => setFrom(d)} placeholder="Từ ngày" />
              <DatePicker value={to} onChange={(d) => setTo(d)} placeholder="Đến ngày" />
              <Select allowClear placeholder="Khách hàng" style={{ width: 220 }} value={selectedCustomer} onChange={(v) => setSelectedCustomer(v)} options={customerOptions} />
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
              onRow={(record) => ({
                onClick: () => openDetail(record.idHoaDon),
              })}
              columns={columns}
              dataSource={filtered}
              loading={loading}
              scroll={{ x: 1200 }}
            />
          </Card>
          <Modal visible={detailVisible} title={`Hóa đơn ${detail?.data?.idHoaDon ?? detail?.idHoaDon ?? ''}`} onCancel={() => setDetailVisible(false)} footer={null} width={800}>
            {detail ? (
              <div>
                <p><b>Mã đặt phòng:</b> {detail.data?.idDatPhong ?? detail.idDatPhong}</p>
                <p><b>Khách hàng:</b> {detail.data?.customer?.hoTen ?? detail.customer?.hoTen}</p>
                <p><b>Ngày lập:</b> {new Date(detail.data?.ngayLap ?? detail.ngayLap).toLocaleString()}</p>
                <p><b>Tổng:</b> {(detail.data?.tongTien ?? detail.tongTien)?.toLocaleString()}đ</p>
                <h4>Dòng phòng</h4>
                <Table dataSource={detail.data?.roomLines ?? detail.roomLines ?? []} pagination={false} rowKey={(r:any)=>r.IDPhong} columns={[{title:'Phòng',dataIndex:'IDPhong',key:'IDPhong'},{title:'Số đêm',dataIndex:'SoDem',key:'SoDem'},{title:'Giá/đêm',dataIndex:'GiaPhong',key:'GiaPhong',render:(v:number)=>v?.toLocaleString()},{title:'Thành tiền',dataIndex:'ThanhTien',key:'ThanhTien',render:(v:number)=><b>{v?.toLocaleString()}đ</b>}]} />
                <h4 style={{marginTop:12}}>Dịch vụ</h4>
                <Table dataSource={detail.data?.services ?? detail.services ?? []} pagination={false} rowKey={(r:any)=>r.IddichVu} columns={[{title:'Mã DV',dataIndex:'IddichVu',key:'IddichVu'},{title:'Tiền',dataIndex:'TienDichVu',key:'TienDichVu',render:(v:number)=>v?.toLocaleString()},{title:'Thời gian',dataIndex:'ThoiGianThucHien',key:'ThoiGianThucHien',render:(v:any)=>v?new Date(v).toLocaleString():'-'},{title:'Trạng thái',dataIndex:'TrangThai',key:'TrangThai'}]} />
              </div>
            ) : null}
          </Modal>
          </div>
        </main>
      </div>
    </div>
  );
};

export default InvoicesManager;
