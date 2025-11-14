import React, { useEffect, useMemo, useState } from 'react';
import Slidebar from '../components/Slidebar';
import HeaderSection from '../components/HeaderSection';
import { Button, Card, Input, message, Space, Table, Tag, Modal, DatePicker, Form, Select, InputNumber } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import checkoutApi from '../../api/checkout.Api';

interface BookingRow {
  IddatPhong: string;
  IdkhachHang?: number;
  TenKhachHang?: string;
  EmailKhachHang?: string;
  Idphong?: string;
  TenPhong?: string;
  SoPhong?: string;
  NgayNhanPhong?: string;
  NgayTraPhong?: string;
  SoDem?: number;
  TongTien: number;
  TienCoc?: number;
  TrangThai: number;
  TrangThaiThanhToan: number;
  ChiTietDatPhongs?: Array<any>;
}

const fetchJson = async (url: string, init?: RequestInit) => {
  const res = await fetch(url, init);
  const txt = await res.text().catch(() => '');
  const data = txt ? JSON.parse(txt) : null;
  if (!res.ok) throw new Error((data && (data.message || data.error)) || `HTTP ${res.status}`);
  return data;
};

const CheckoutManager: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<BookingRow[]>([]);
  const [keyword, setKeyword] = useState('');
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(dayjs());

  const load = async () => {
    setLoading(true);
    try {
      const list = await fetchJson('/api/DatPhong');
      // DatPhongController returns array of bookings but server JSON is camelCase (see Program.cs)
      // Normalize properties so the rest of this file (which expects PascalCase names) still works.
      const normalizeBooking = (item: any) => {
        const chiTiet = (item.ChiTietDatPhongs ?? item.chiTietDatPhongs ?? []).map((ct: any) => ({
          ...ct,
          GiaPhong: ct.GiaPhong ?? ct.giaPhong,
          SoDem: ct.SoDem ?? ct.soDem,
          ThanhTien: ct.ThanhTien ?? ct.thanhTien
        }));

        return {
          IddatPhong: item.IddatPhong ?? item.iddatPhong,
          IdkhachHang: item.IdkhachHang ?? item.idkhachHang,
          TenKhachHang: item.TenKhachHang ?? item.tenKhachHang,
          EmailKhachHang: item.EmailKhachHang ?? item.emailKhachHang,
          Idphong: item.Idphong ?? item.idphong,
          TenPhong: item.TenPhong ?? item.tenPhong,
          SoPhong: item.SoPhong ?? item.soPhong,
          NgayDatPhong: item.NgayDatPhong ?? item.ngayDatPhong,
          NgayNhanPhong: item.NgayNhanPhong ?? item.ngayNhanPhong,
          NgayTraPhong: item.NgayTraPhong ?? item.ngayTraPhong,
          SoDem: item.SoDem ?? item.soDem,
          TongTien: item.TongTien ?? item.tongTien ?? 0,
          TienCoc: item.TienCoc ?? item.tienCoc,
          TrangThai: item.TrangThai ?? item.trangThai,
          TrangThaiThanhToan: item.TrangThaiThanhToan ?? item.trangThaiThanhToan,
          ChiTietDatPhongs: chiTiet
        } as BookingRow;
      };

      const mapped = (list || []).map((i: any) => normalizeBooking(i));
      setData(mapped);
    } catch (e: any) {
      message.error(e.message || 'Không thể tải danh sách đặt phòng');
    } finally {
      setLoading(false);
    }
  };

  const performCheckout = async (row: BookingRow) => {
    // Confirm
    Modal.confirm({
      title: `Checkout - ${row.IddatPhong}`,
      content: 'Tạo hóa đơn và đánh dấu đã thanh toán? (Nếu backend hỗ trợ, hệ thống sẽ tạo hóa đơn, xử lý thanh toán và hoàn tất checkout. Nếu không, fallback sang API cũ.)',
      onOk: async () => {
        try {
          // Prefer server-side checkout flow if available
          const invoice = await checkoutApi.generateInvoice(row.IddatPhong as any, { includeVat: true, serviceFeePercent: 5 });
          if (invoice) {
            // attempt an immediate payment with cash by default (UI could prompt for method)
            const total = invoice.total ?? invoice.Total ?? invoice.amount ?? row.TongTien;
            const pay = await checkoutApi.processPayment(row.IddatPhong as any, { method: 'cash', amount: Number(total || row.TongTien || 0) });
            // finalize
            await checkoutApi.finalizeCheckout(row.IddatPhong as any, { addLoyalty: true, loyaltyPoints: Math.round((invoice.total ?? total) / 10000) });
            message.success('Checkout hoàn tất (server): Hóa đơn #' + (invoice.id ?? invoice.IDHoaDon ?? ''));
            load();
            return;
          }

          // Fallback: use legacy Payment endpoint
          // compute TienPhong = sum of GiaPhong from ChiTietDatPhongs, fallback to TongTien
          const rooms = row.ChiTietDatPhongs || [];
          let tienPhong = 0;
          let soNgay = row.SoDem || 1;
          if (rooms.length) {
            tienPhong = rooms.reduce((s:any, r:any) => s + (Number(r.GiaPhong || r.giaPhong || 0)), 0);
          } else {
            tienPhong = Math.round((row.TongTien || 0) / Math.max(1, soNgay));
          }

          const body = {
            IDDatPhong: row.IddatPhong,
            TienPhong: Math.max(1, Math.round(tienPhong)),
            SoLuongNgay: Math.max(1, Number(soNgay)),
            TongTien: Number(row.TongTien || 0),
            TrangThaiThanhToan: 2,
            GhiChu: 'Checkout by admin (fallback)'
          };

          const res = await fetchJson('/api/Payment/hoa-don', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });

          message.success('Checkout thành công. Hóa đơn: ' + (res?.IDHoaDon || ''));
          load();
        } catch (e: any) {
          message.error(e.message || 'Checkout thất bại');
        }
      }
    });
  };

  const markPaid = async (row: BookingRow) => {
    // Open payment modal to perform full invoice/payment flow (server will create invoice and send email)
    openPaymentModal(row);
  };

  // Payment modal/form state
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentRow, setPaymentRow] = useState<BookingRow | null>(null);
  const [form] = Form.useForm();

  const openPaymentModal = (row: BookingRow) => {
    setPaymentRow(row);
    // compute default TienPhong
    const rooms = row.ChiTietDatPhongs || [];
    let tienPhong = 0;
    if (rooms.length) {
      tienPhong = rooms.reduce((s:any, r:any) => s + (Number(r.GiaPhong ?? r.giaPhong ?? 0)), 0);
    } else {
      tienPhong = Math.round((row.TongTien || 0) / Math.max(1, row.SoDem || 1));
    }
    form.setFieldsValue({ TienPhong: tienPhong, SoLuongNgay: row.SoDem || 1, TongTien: Number(row.TongTien || 0), PhuongThucThanhToan: 1, GhiChu: '' });
    setPaymentModalVisible(true);
  };

  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [paymentInvoiceId, setPaymentInvoiceId] = useState<string | null>(null);

  const submitPayment = async () => {
    try {
      const vals = await form.validateFields();
      if (!paymentRow) return;
      const body = {
        IDDatPhong: paymentRow.IddatPhong,
        TienPhong: Number(vals.TienPhong),
        SoLuongNgay: Number(vals.SoLuongNgay),
        TongTien: Number(vals.TongTien),
        TrangThaiThanhToan: 2,
        GhiChu: vals.GhiChu || undefined
      };

      const res = await fetchJson('/api/Payment/hoa-don', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res) throw new Error('Không nhận được phản hồi từ server');

      // If server returned a payment URL (online gateway), show QR for guest to scan
      const paymentUrl = (res as any).paymentUrl ?? (res as any).PaymentUrl ?? (res as any).paymentUrl;
      const invoiceId = (res as any)?.IDHoaDon ?? (res as any)?.idHoaDon ?? (res as any)?.idHoaDon ?? (res as any)?.idHoaDon ?? null;
      if (invoiceId) setPaymentInvoiceId(String(invoiceId));

      if (paymentUrl) {
        setQrUrl(paymentUrl);
        setQrModalVisible(true);
        // keep payment modal open (admin can then confirm after guest scans)
      } else {
        // If admin selected online payment and server did not provide a paymentUrl, construct VietQR image URL using amount
        const method = form.getFieldValue('PhuongThucThanhToan');
        if (method === 2) {
          // Use provided VietQR template
          const amount = Number((res as any)?.TienThanhToan ?? form.getFieldValue('TongTien') ?? 0);
          const addInfo = 'Thanh toán tiền phòng';
          const accountName = 'Ủy ban Trung ương Mặt trận Tổ quốc Việt Nam';
          const vietQr = `https://img.vietqr.io/image/bidv-8639699999-print.png?amount=${encodeURIComponent(String(amount))}&addInfo=${encodeURIComponent(addInfo)}&accountName=${encodeURIComponent(accountName)}`;
          setQrUrl(vietQr);
          setQrModalVisible(true);
        } else {
          message.success('Thanh toán thành công. Hóa đơn: ' + ((res as any)?.IDHoaDon || (res as any)?.idHoaDon || ''));
          setPaymentModalVisible(false);
          setPaymentRow(null);
          form.resetFields();
          load();
        }
      }
    } catch (e: any) {
      message.error(e.message || 'Thanh toán thất bại');
    }
  };

  const completeCheckout = async (row: BookingRow) => {
    Modal.confirm({
      title: `Hoàn tất trả phòng - ${row.IddatPhong}`,
      content: 'Xác nhận hoàn tất trả phòng? Hành động này sẽ cập nhật trạng thái đặt phòng là Hoàn thành (4).',
      onOk: async () => {
        try {
          // Prefer server-side finalize if available
          try {
            const res = await checkoutApi.finalizeCheckout(row.IddatPhong as any, { note: 'admin-complete' });
            if (res) {
              message.success('Đã hoàn tất trả phòng (server)');
              load();
              return;
            }
          } catch (err) {
            // ignore and fallback
          }

          // Fallback: update booking status via DatPhongController (use camelCase body to match server JSON policy)
          // Try both casing to be tolerant to any model binder expectations
          await fetchJson(`/api/DatPhong/${row.IddatPhong}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ TrangThai: 4, trangThai: 4 })
          });

          // Try to find invoice for this booking and resend email (if exists)
          try {
            const invRes = await fetchJson('/api/Payment/invoices');
            const invoices = (invRes && (invRes.data || invRes.data === 0) ? invRes.data : invRes) || [];
            const found = (invoices || []).find((x: any) => (x.idDatPhong ?? x.idDatPhong ?? x.idDatPhong) == row.IddatPhong || (x.idDatPhong ?? x.idDatPhong) == row.IddatPhong || x.idDatPhong == row.IddatPhong || x.idDatPhong == row.IddatPhong || x.idDatPhong == row.IddatPhong);
            if (found) {
              const id = found.idHoaDon ?? found.idHoaDon ?? found.idHoaDon ?? found.idHoaDon;
              if (id) {
                await fetchJson(`/api/Payment/invoice/${id}/send-email`, { method: 'POST' });
              }
            }
          } catch (e) {
            // ignore email sending errors
          }

          message.success('Đã đánh dấu Hoàn thành (4)');
          load();
        } catch (e: any) {
          // show details in console and a friendly message to the user
          console.error('completeCheckout failed', e);
          message.error(e?.message ? `Hoàn tất thất bại: ${e.message}` : 'Hoàn tất thất bại (xem console để biết chi tiết)');
        }
      }
    });
  };

  const due = useMemo(() => {
    const s = selectedDate ? selectedDate.format('YYYY-MM-DD') : null;
    return (data || []).filter(d => {
      // only confirmed bookings (TrangThai === 2)
      if ((d.TrangThai ?? 0) !== 2) return false;
      if (s && d.NgayTraPhong) {
        const nd = (d.NgayTraPhong || '').slice(0, 10);
        if (nd !== s) return false;
      }
      if (keyword && keyword.trim()) {
        const k = keyword.trim().toLowerCase();
        return (String(d.IddatPhong || '') + ' ' + (d.TenKhachHang || '') + ' ' + (d.EmailKhachHang || '')).toLowerCase().includes(k);
      }
      return true;
    });
  }, [data, selectedDate, keyword]);

  const columns: ColumnsType<BookingRow> = [
    { title: 'Mã đặt phòng', dataIndex: 'IddatPhong', key: 'IddatPhong', width: 160 },
    { title: 'Khách hàng', key: 'customer', render: (_, r) => (<div>{r.TenKhachHang}<div style={{fontSize:12,color:'#64748b'}}>{r.EmailKhachHang}</div></div>) },
    { title: 'Nhận', dataIndex: 'NgayNhanPhong', key: 'NgayNhanPhong', width: 120 },
    { title: 'Trả', dataIndex: 'NgayTraPhong', key: 'NgayTraPhong', width: 120 },
    { title: 'Tổng tiền', dataIndex: 'TongTien', key: 'TongTien', align: 'right', render: (v) => Number(v).toLocaleString() + ' đ' },
    { title: 'Trạng thái TT', dataIndex: 'TrangThaiThanhToan', key: 'tt', render: (s) => <Tag color={s===2?'green':'orange'}>{s===2? 'Đã thanh toán' : 'Chưa/Chờ'}</Tag> },
    { title: 'Hành động', key: 'actions', fixed: 'right', render: (_, r) => {
      const isPaid = (r.TrangThaiThanhToan ?? 0) === 2;
      const isCompleted = (r.TrangThai ?? 0) === 4;
      return (
        <Space>

          {/* If not paid yet, require payment first */}
          {!isPaid && <Button type="primary" onClick={() => markPaid(r)}>Thanh toán</Button>}

          {/* If paid but not completed, allow finalizing checkout */}
          {isPaid && !isCompleted && <Button onClick={() => completeCheckout(r)}>Hoàn tất trả phòng</Button>}

          {/* If already completed, show disabled button */}
          {isCompleted && <Button disabled>Đã hoàn tất</Button>}
        </Space>
      );
    }}
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <Slidebar />
      <div style={{ marginLeft: 240 }}>
        <HeaderSection />
        <main style={{ padding: 24 }}>
          <Card style={{ marginBottom: 12 }}>
            <Space>
              <Input.Search placeholder="Tìm mã đặt / khách / email" value={keyword} onChange={(e) => setKeyword(e.target.value)} onSearch={() => {}} />
              {/* Date picker to choose the checkout date used by the 'due' filter */}
              <DatePicker
                value={selectedDate}
                onChange={(d) => setSelectedDate(d)}
                format="YYYY-MM-DD"
                allowClear={false}
                placeholder="Chọn ngày checkout"
              />
              <Button onClick={() => setSelectedDate(dayjs())}>Hôm nay</Button>
              <Button onClick={load}>Tải lại</Button>
            </Space>
          </Card>

          <Card>
            <Table rowKey={(r) => r.IddatPhong} dataSource={due} columns={columns} loading={loading} scroll={{ x: 1000 }} />
          </Card>
          {/* Payment modal */}
          <Modal
            title={paymentRow ? `Thanh toán - ${paymentRow.IddatPhong}` : 'Thanh toán'}
            open={paymentModalVisible}
            onCancel={() => { setPaymentModalVisible(false); setPaymentRow(null); form.resetFields(); }}
            onOk={submitPayment}
            okText="Xác nhận thanh toán"
          >
            <div style={{ marginBottom: 12, borderBottom: '1px solid #f0f0f0', paddingBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Khách sạn Robins Villa</div>
              <div style={{ marginTop: 8 }}>
                <div><strong>Khách:</strong> {paymentRow?.TenKhachHang} {paymentRow?.EmailKhachHang ? `- ${paymentRow.EmailKhachHang}` : ''}</div>
                <div><strong>Phòng:</strong> {paymentRow?.SoPhong || paymentRow?.TenPhong || ''}</div>
                <div><strong>Nhận:</strong> {paymentRow?.NgayNhanPhong} &nbsp; <strong>Trả:</strong> {paymentRow?.NgayTraPhong}</div>
              </div>
            </div>

            <Form form={form} layout="vertical">
              <Form.Item name="TienPhong" label="Tiền phòng" rules={[{ required: true }] }>
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
              <Form.Item name="SoLuongNgay" label="Số lượng ngày" rules={[{ required: true }] }>
                <InputNumber style={{ width: '100%' }} min={1} />
              </Form.Item>
              <Form.Item name="TongTien" label="Tổng tiền" rules={[{ required: true }] }>
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
              <Form.Item name="PhuongThucThanhToan" label="Phương thức thanh toán" rules={[{ required: true }] }>
                <Select>
                  <Select.Option value={1}>Tiền mặt</Select.Option>
                  <Select.Option value={2}>Thanh toán online (QR)</Select.Option>
                  <Select.Option value={3}>Thanh toán tại quầy</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item name="GhiChu" label="Ghi chú">
                <Input />
              </Form.Item>
            </Form>
          </Modal>

          {/* QR modal */}
          <Modal
            title="Thanh toán online - Quét mã QR"
            open={qrModalVisible}
            onCancel={() => { setQrModalVisible(false); setQrUrl(null); setPaymentModalVisible(false); setPaymentRow(null); form.resetFields(); load(); }}
            footer={[
              <Button key="close" onClick={() => { setQrModalVisible(false); setQrUrl(null); setPaymentModalVisible(false); setPaymentRow(null); form.resetFields(); load(); }}>Đóng</Button>,
              <Button key="paid" type="primary" onClick={() => { setQrModalVisible(false); setQrUrl(null); setPaymentModalVisible(false); setPaymentRow(null); form.resetFields(); load(); }}>Đã thanh toán</Button>
            ]}
          >
            {qrUrl ? (
              <div style={{ textAlign: 'center' }}>
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(qrUrl)}`} alt="QR" />
                <div style={{ marginTop: 12 }}>
                  <a href={qrUrl} target="_blank" rel="noreferrer">Mở liên kết thanh toán</a>
                </div>
              </div>
            ) : (<div>Không tìm thấy liên kết thanh toán</div>)}
          </Modal>
        </main>
      </div>
    </div>
  );
};

export default CheckoutManager;
