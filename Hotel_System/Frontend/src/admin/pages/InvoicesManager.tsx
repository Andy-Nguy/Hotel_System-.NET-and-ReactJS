import React, { useEffect, useMemo, useState } from "react";
import Slidebar from "../components/Slidebar";
import HeaderSection from "../components/HeaderSection";
import { Button, Card, DatePicker, Input, Select, Space, Table, Tag, message, Modal, Statistic, Row, Col } from "antd";
import { DownloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from "antd/es/table";
import dayjs, { Dayjs } from "dayjs";
import { getRoomTypes } from "../../api/roomsApi";
import invoiceApi, { InvoiceRow as ApiInvoiceRow, InvoiceDetail } from "../../api/invoiceApi";

type InvoiceRow = ApiInvoiceRow;

const statusColor = (s: number) => (s === 2 ? "green" : s === 1 ? "orange" : "default");
const statusText = (s: number) => (s === 2 ? "Đã thanh toán" : s === 1 ? "Chờ xử lý" : "Khác");

// Using `invoiceApi` helpers for data access; no local fetch helper needed

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
      const params: any = {};
      if (from) params.from = from.format("YYYY-MM-DD");
      if (to) params.to = to.format("YYYY-MM-DD");
      if (status != null) params.status = status;
      if (selectedRoomType) params.roomType = selectedRoomType;
      if (staff) params.staff = staff;
      if (selectedCustomer) params.customer = String(selectedCustomer);

      const rows = await invoiceApi.getInvoices(params);
      setData(rows || []);
      const sum = await invoiceApi.getSummary(params);
      setSummary(sum || null);
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
        const raw: any = d.data;
        const roomLinesRaw = raw.roomLines ?? raw.RoomLines ?? raw.room_lines ?? raw.Room_Lines ?? [];
        const servicesRaw = raw.services ?? raw.Services ?? raw.cThdDvs ?? [];

        const roomLines = (roomLinesRaw || []).map((r: any) => ({
          IDPhong: r.IDPhong ?? r.idPhong ?? r.id_phong ?? r.IDPHONG ?? r.idphong,
          SoDem: r.SoDem ?? r.soDem ?? r.sodem ?? 0,
          GiaPhong: r.GiaPhong ?? r.giaPhong ?? r.price ?? 0,
          ThanhTien: r.ThanhTien ?? r.thanhTien ?? r.total ?? 0,
        }));

        const services = (servicesRaw || []).map((s: any) => ({
          IddichVu: s.IddichVu ?? s.idDichVu ?? s.iddichVu ?? s.IddichVu,
          TienDichVu: s.TienDichVu ?? s.tienDichVu ?? s.price ?? 0,
          ThoiGianThucHien: s.ThoiGianThucHien ?? s.thoiGianThucHien ?? s.time ?? null,
          TrangThai: s.TrangThai ?? s.trangThai ?? null,
        }));

        d.data.roomLines = roomLines;
        d.data.services = services;
      }
      setDetail(d as { data: InvoiceDetail } | null);
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

 

  const downloadPdf = async (row: InvoiceRow) => {
    const url = `/api/ThanhToan/hoa-don/${row.idHoaDon}/pdf`;
    try {
      setLoading(true);
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/pdf',
        },
      });

      if (!res.ok) {
        // Try to read response as text/JSON to show useful error message
        const txt = await res.text().catch(() => "");
        let errMsg = txt ? txt.substring(0, 1000) : `HTTP ${res.status}`;
        try {
          const parsed = JSON.parse(txt);
          errMsg = (parsed && (parsed.message || parsed.error)) || errMsg;
        } catch { /* not JSON, keep text */ }
        throw new Error(`Lỗi ${res.status}: ${errMsg}`);
      }

      // Get filename from Content-Disposition header if provided
      const contentDisposition = res.headers.get('content-disposition') || '';
      let filename = `HoaDon_${row.idHoaDon}.pdf`;
      const fileMatch = contentDisposition.match(/filename\*?=(?:UTF-8'')?["']?([^;"']+)/i);
      if (fileMatch && fileMatch[1]) {
        try {
          filename = decodeURIComponent(fileMatch[1]);
        } catch { filename = fileMatch[1]; }
      }

      const blob = await res.blob();
      const link = document.createElement('a');
      const href = URL.createObjectURL(blob);
      link.href = href;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(href);

      message.success('Đã tải hóa đơn thành công!');
    } catch (err: any) {
      console.error('Lỗi tải PDF:', err);
      message.error(err?.message || 'Không thể tải hóa đơn PDF');
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
        headers,
        body: JSON.stringify({ IDDatPhong: row.idDatPhong, TrangThaiThanhToan: newStatus, GhiChu: row.ghiChu }),
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
      // Prevent clicks inside the actions cell from bubbling to the row onClick
      <div onClick={(e) => e.stopPropagation()}>
     <Space>
        <Button icon={<DownloadOutlined />} onClick={(e) => { e.stopPropagation(); handleDownloadPdf(r); }}>Tải hóa đơn PDF</Button>
        <Select
          size="small"
          value={r.trangThaiThanhToan}
          style={{ width: 140 }}
          onClick={(e) => e.stopPropagation()}
            onChange={(val, opt) => { updateStatus(r, val as number); }}
          options={[
            { value: 1, label: "Chờ xử lý" },
            { value: 2, label: "Đã thanh toán" },
          ]}
        />
      </Space>
      </div>
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
              <Select allowClear placeholder="Khách hàng" style={{ width: 220 }} value={selectedCustomer} onChange={(v) => setSelectedCustomer(v)} />
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
                <h4>Danh sách phòng</h4>
                <br />
                <Table dataSource={detail.data?.roomLines ?? detail.roomLines ?? []} pagination={false} rowKey={(r:any)=>r.IDPhong} columns={[{title:'Phòng',dataIndex:'IDPhong',key:'IDPhong'},{title:'Số đêm',dataIndex:'SoDem',key:'SoDem'},{title:'Giá/đêm',dataIndex:'GiaPhong',key:'GiaPhong',render:(v:number)=>v?.toLocaleString()},{title:'Thành tiền',dataIndex:'ThanhTien',key:'ThanhTien',render:(v:number)=><b>{v?.toLocaleString()}đ</b>}]} />
                <h4 style={{marginTop:12}}>Dịch vụ sử dụng</h4> <br />
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
