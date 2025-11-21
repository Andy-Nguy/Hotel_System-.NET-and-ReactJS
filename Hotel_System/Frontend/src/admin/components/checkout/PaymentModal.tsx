import React, { useEffect, useState } from 'react';
import invoiceApi from '../../../api/invoiceApi';
import { getServiceById } from '../../../api/serviceApi';
import { useRef } from 'react';
import { Modal, Form, InputNumber, Select, Table, Divider, Spin, Tag, Input, message, Button } from 'antd';

interface Props {
  visible: boolean;
  paymentRow: any;
  summary: any;
  summaryLoading: boolean;
  selectedServices: any[];
  form: any;
  roomLines?: string[];
  servicesTotal?: number;
  onCancel: () => void;
  onSubmit: () => void;
}

const PaymentModal: React.FC<Props> = ({
  visible, paymentRow, summary, summaryLoading, selectedServices, form, onCancel, onSubmit
}) => {
  // 1. Tiền phòng lấy từ summary (CSDL)
const roomTotal = Number(summary?.money?.roomTotal ?? 0);

// 2. Dịch vụ: đọc các dòng dịch vụ từ summary — cố gắng hỗ trợ nhiều tên trường
//    (trả về từ bảng CTHDDV trên server). Nếu summary không chứa dòng dịch vụ,
//    cố gắng gọi endpoint chi tiết hóa đơn để lấy `CTHDDV`.
const deriveServerRowsFromSummary = (s: any) => {
  let raw = s?.services ?? s?.cthddv ?? s?.CTHDDV ?? s?.cthddvs ?? [];
  if ((!raw || raw.length === 0) && Array.isArray(s?.invoices) && s.invoices.length > 0) {
    const inv = s.invoices[0];
    raw = inv?.services ?? inv?.chiTietHoaDons ?? inv?.ChiTietHoaDons ?? inv?.ChiTietHoaDon ?? inv?.cthddv ?? inv?.CTHDDV ?? raw;
  }
  if (!Array.isArray(raw)) return [];
  return raw.map((r: any) => {
    const id = r.IddichVu ?? r.iddichVu ?? r.IdDichVu ?? r.Id ?? r.id ?? null;
    const serviceName = r.TenDichVu ?? r.tenDichVu ?? r.serviceName ?? r.Ten ?? r.name ?? r.ten ?? '';
    const qty = Number(r.soLuong ?? r.SoLuong ?? r.quantity ?? r.Quantity ?? 1) || 1;
    const price = Number(r.donGia ?? r.DonGia ?? r.price ?? r.gia ?? r.Gia ?? 0) || 0;
    const amount = Number(r.TienDichVu ?? r.tienDichVu ?? r.ThanhTien ?? r.thanhTien ?? r.amount ?? price * qty) || price * qty;
    return { serviceName: serviceName || (id ? `Dịch vụ ${id}` : ''), price, amount, qty, raw: r };
  });
};

const [dbServices, setDbServices] = useState<any[]>(() => deriveServerRowsFromSummary(summary) || []);
  // cache for service names to avoid repeated fetches
  const serviceNameCache = useRef<Record<string, string>>({});

// Keep dbServices in sync when summary changes (quick replace from summary if present)
useEffect(() => {
  const derived = deriveServerRowsFromSummary(summary) || [];
  // If the server provides service lines, replace the cached list.
  // If not, keep the existing `dbServices` to avoid losing resolved names
  // (prevents UI losing service names on subsequent opens when summary is sparse).
  if (Array.isArray(derived) && derived.length > 0) {
    setDbServices(derived);
  }
}, [summary]);

// When dbServices are present, ensure we resolve service names from service API
useEffect(() => {
  let mounted = true;
  const missingIds = new Set<string>();
  (dbServices || []).forEach(d => {
    const raw = d?.raw ?? {};
    const id = raw?.IddichVu ?? raw?.iddichVu ?? raw?.IDDichVu ?? raw?.IDDichVu ?? raw?.IdDichVu ?? raw?.Id ?? raw?.iddichVu ?? null;
    const hasName = d && d.serviceName && String(d.serviceName).trim().length > 0;
    if (id && !hasName && !serviceNameCache.current[String(id)]) missingIds.add(String(id));
  });
  if (missingIds.size === 0) return;
  (async () => {
    try {
      const promises: Array<Promise<void>> = [];
      missingIds.forEach(id => {
        const p = getServiceById(id).then(svc => {
          if (!mounted) return;
          const name = svc?.tenDichVu ?? svc?.tenDichVu ?? svc?.tenDichVu ?? '';
          if (name) serviceNameCache.current[id] = name;
        }).catch(err => {
          // ignore missing service
          // eslint-disable-next-line no-console
          console.debug('[PaymentModal] service lookup failed for', id, err?.message ?? err);
        });
        promises.push(p as Promise<void>);
      });
      await Promise.all(promises);
      if (!mounted) return;
      // update dbServices with cached names
      setDbServices(prev => (prev || []).map(d => {
        const raw = d?.raw ?? {};
        const id = raw?.IddichVu ?? raw?.iddichVu ?? raw?.IDDichVu ?? raw?.IDDichVu ?? raw?.IdDichVu ?? raw?.Id ?? raw?.iddichVu ?? null;
        if (id && serviceNameCache.current[String(id)] && (!d.serviceName || String(d.serviceName).trim().length === 0)) {
          return { ...d, serviceName: serviceNameCache.current[String(id)] };
        }
        return d;
      }));
    } catch (e) {
      // ignore
    }
  })();
  return () => { mounted = false; };
}, [dbServices]);

// If no service lines are present in the summary, try fetching invoice detail (fallback)
useEffect(() => {
  let mounted = true;
  const tryFetchInvoiceServices = async () => {
    if (!visible) return;
    if (Array.isArray(dbServices) && dbServices.length > 0) return;
    // try to find an invoice id in summary
    const inv = Array.isArray(summary?.invoices) && summary.invoices.length > 0 ? summary.invoices[0] : null;
    const possibleInvId = inv?.id ?? inv?.IDHoaDon ?? inv?.IdHoaDon ?? inv?.ID ?? inv?.HoaDonId ?? summary?.idHoaDon ?? summary?.IdHoaDon ?? null;
    if (!possibleInvId) return;
    try {
      const detail = await invoiceApi.getInvoiceDetail(String(possibleInvId));
      if (!mounted) return;
      const detailAny: any = detail?.data as any;
      const svcRaw = (detailAny?.services ?? detailAny?.chiTietHoaDons ?? detailAny?.CTHDDV ?? detailAny?.cthddv) ?? [];
      if (Array.isArray(svcRaw) && svcRaw.length > 0) {
        setDbServices(svcRaw.map((r: any) => {
          const serviceName = r.tenDichVu ?? r.TenDichVu ?? r.serviceName ?? r.Ten ?? r.ten ?? '';
          const qty = Number(r.soLuong ?? r.SoLuong ?? r.quantity ?? r.Quantity ?? 1) || 1;
          const price = Number(r.donGia ?? r.DonGia ?? r.price ?? r.gia ?? r.Gia ?? 0) || 0;
          const amount = Number(r.TienDichVu ?? r.tienDichVu ?? r.ThanhTien ?? r.thanhTien ?? r.amount ?? price * qty) || price * qty;
          return { serviceName, price, amount, qty, raw: r };
        }));
      }
    } catch (err) {
      // ignore; this is a best-effort enhancement to show CTHDDV
      // eslint-disable-next-line no-console
      console.debug('[PaymentModal] invoice detail fetch failed', err);
    }
  };
  // If summary doesn't contain invoice id, try searching invoices for this booking id
  const tryFindInvoiceByBooking = async () => {
    if (!visible) return;
    if (Array.isArray(dbServices) && dbServices.length > 0) return;
    const bookingId = paymentRow?.IddatPhong ?? paymentRow?.IdDatPhong ?? paymentRow?.iddatPhong ?? null;
    if (!bookingId) return;
    try {
      const list = await invoiceApi.getInvoices();
      if (!mounted || !Array.isArray(list)) return;
      const found = (list as any[]).find(it => (it.idDatPhong ?? it.IDDatPhong ?? it.idDatPhong ?? it.iddatPhong) == bookingId);
      const invoiceId = found?.idHoaDon ?? found?.idHoaDon ?? found?.IdHoaDon ?? found?.IDHoaDon ?? found?.id ?? null;
      if (!invoiceId) return;
      const detail = await invoiceApi.getInvoiceDetail(String(invoiceId));
      if (!mounted) return;
      const detailAny: any = detail?.data as any;
      const svcRaw = (detailAny?.services ?? detailAny?.chiTietHoaDons ?? detailAny?.CTHDDV ?? detailAny?.cthddv) ?? [];
      if (Array.isArray(svcRaw) && svcRaw.length > 0) {
        setDbServices(svcRaw.map((r: any) => {
          const serviceName = r.tenDichVu ?? r.TenDichVu ?? r.serviceName ?? r.Ten ?? r.ten ?? '';
          const qty = Number(r.soLuong ?? r.SoLuong ?? r.quantity ?? r.Quantity ?? 1) || 1;
          const price = Number(r.donGia ?? r.DonGia ?? r.price ?? r.gia ?? r.Gia ?? 0) || 0;
          const amount = Number(r.TienDichVu ?? r.tienDichVu ?? r.ThanhTien ?? r.thanhTien ?? r.amount ?? price * qty) || price * qty;
          return { serviceName, price, amount, qty, raw: r };
        }));
      }
    } catch (err) {
      console.debug('[PaymentModal] find invoice by booking failed', err);
    }
  };
  tryFetchInvoiceServices();
  tryFindInvoiceByBooking();
  return () => { mounted = false; };
  // intentionally only run when modal visible or summary changes
}, [visible, summary]);

// (debug logging will be emitted below after service total is computed)

// Dịch vụ mới (chưa lưu CSDL) – chỉ hiển thị, chưa vào DB
const clientServices = Array.isArray(selectedServices)
  ? selectedServices.map((v: any) => ({
      serviceName: v.serviceName ?? v.tenDichVu ?? v.name ?? '',
      price: Number(v.price ?? 0),
      amount: Number((v.price ?? 0) * (v.quantity ?? 1)),
      qty: Number(v.quantity ?? 1),
    }))
  : [];
const combinedServices = [...(dbServices || []), ...clientServices];

// 1. Tổng dịch vụ CHÍNH THỨC từ backend (CHƯA VAT)
//    Backend đã tính trong GetSummary: money.serviceTotal = sum(CTHDDV.TienDichVu)
const serviceTotalFromServer = Number(summary?.money?.serviceTotal ?? 0);

// 2. Dịch vụ mới (client) chỉ để HIỂN THỊ, KHÔNG cộng vào tổng chính thức
//    → để tránh FE tự “vẽ thêm” tiền ngoài DB. Khi lưu dịch vụ mới xuống CSDL,
//      backend sẽ tính lại và lần mở sau sẽ thấy trong serviceTotalFromServer.
const newServicesTotal = clientServices.reduce(
  (s, v) => s + (Number(v.amount) || 0),
  0
);

// Tổng dịch vụ dùng để hiển thị “Dịch vụ:” trong phần Tổng kết (số CHÍNH THỨC từ DB)
const serviceTotal = serviceTotalFromServer;

// 3. Tạm tính & VAT & Tổng cộng: ƯU TIÊN số backend
//    - subTotal: trước VAT
//    - vat:  tiền thuế 10%
//    - tongTien: tổng cộng sau VAT = DatPhong.TongTien / HoaDon.TongTien
const subTotalFromServer = Number(summary?.money?.subTotal ?? 0);
const vatFromServer = Number(summary?.money?.vat ?? 0);
const totalFromServer = Number(summary?.money?.tongTien ?? 0);

// Nếu backend chưa gửi đủ subTotal/vat thì fallback theo công thức chuẩn
const subTotal = subTotalFromServer > 0
  ? subTotalFromServer
  : (roomTotal + serviceTotal);

const fallbackVat = Math.round(subTotal * 0.1);
const vat = vatFromServer > 0
  ? vatFromServer
  : Math.max(0, totalFromServer - subTotal) || fallbackVat;

const total = totalFromServer > 0
  ? totalFromServer
  : subTotal + vat;

// 5. Đã thanh toán & Khách cần thanh toán
const deposit = Number(summary?.money?.deposit ?? 0);

const invoicePaid = Array.isArray(summary?.invoices) && summary.invoices.length > 0
  ? Number(summary.invoices[0].tienThanhToan ?? summary.invoices[0].TienThanhToan ?? 0)
  : 0;

const paidFromBooking = Number(summary?.money?.paidAmount ?? 0);
const paidRaw = invoicePaid > 0 ? invoicePaid : paidFromBooking;

// Trừ tiền cọc khỏi số đã thanh toán để hiển thị (không bao gồm tiền cọc)
const paidExcludingDepositRaw = Math.max(0, paidRaw - deposit);

// Không cho "đã thanh toán" > "tổng cộng" khi hiển thị
const paid = Math.min(paidExcludingDepositRaw, total);

// Nếu khách trả thừa (không bắt buộc hiển thị)
const overPaid = Math.max(0, paidExcludingDepositRaw - total);

// Khách cần thanh toán: ưu tiên server-provided remaining (soTienConLai)
const serverRemaining = Number(summary?.soTienConLai ?? summary?.money?.soTienConLai ?? summary?.invoices?.[0]?.soTienConLai ?? 0);
const needToPay = (serverRemaining > 0) ? serverRemaining : Math.max(0, total - deposit - paidExcludingDepositRaw);

  useEffect(() => {
    if (visible) {
      form.setFieldsValue({ amount: needToPay, PhuongThucThanhToan: 1, GhiChu: '' });
    }
  }, [needToPay, visible, form]);

  // Determine if invoice/booking is already fully paid (server uses 2)
  // Support different casing and string/number types
  const invoiceStatus = Array.isArray(summary?.invoices) && summary.invoices.length > 0
    ? (summary.invoices[0].trangThaiThanhToan ?? summary.invoices[0].TrangThaiThanhToan ?? summary.invoices[0].trangThaiThanhToan)
    : undefined;
  const statusCandidates = [
    invoiceStatus,
    paymentRow?.TrangThaiThanhToan,
    paymentRow?.trangThaiThanhToan,
  ];
  const isPaid = statusCandidates.some((v) => String(v ?? '').trim() === '2');

  // onOk should delegate to parent submit handler (onSubmit)

  return (
    <Modal
      title={`Thanh toán – ${paymentRow?.IddatPhong}`}
      open={visible}
      onCancel={onCancel}
      onOk={onSubmit}
      okText="Xác nhận"
      cancelText="Hủy"
      width={900}
      footer={isPaid ? [<Button key="close" onClick={onCancel}>Đóng</Button>] : undefined}
    >
      <Spin spinning={summaryLoading}>
        <Form form={form} layout="vertical">
        {/* Header */}
        <div style={{ padding: '12px 16px', background: '#f9fafb', borderRadius: 8, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>Khách sạn Robins Villa</div>
          <div style={{ marginTop: 8 }}>
            <div>Khách: <strong>{paymentRow?.TenKhachHang}</strong></div>
            <div>Nhận phòng: <strong>{paymentRow?.NgayNhanPhong?.slice(0,10)}</strong> → Trả: <strong>{paymentRow?.NgayTraPhong?.slice(0,10)}</strong></div>
          </div>
        </div>

        {/* Phòng */}
        {summary?.items?.length > 0 && (
          <Table size="small" pagination={false} dataSource={summary.items} style={{ marginBottom: 16 }}
            columns={[
               {
  title: 'Phòng',
  render: (_: any, r: any) => {
    const idPhong  = r.idPhong ?? r.IDPhong ?? r.IdPhong ?? '';
    const tenPhong = r.tenPhong ?? r.TenPhong ?? r.Phong?.TenPhong ?? ''; // lấy từ API
    const name = [tenPhong].filter(Boolean).join(' '); // "Deluxe Room 102"

    return (
      <div>
        <div style={{ fontWeight: 600 }}>{name || '-'}</div>
        {(idPhong) && <div style={{ color: '#64748b' }}>{idPhong}</div>}
      </div>
    );
  },
},
              { title: 'Số đêm', dataIndex: 'soDem', align: 'center' },
              { title: 'Giá/đêm', render: (_, r: any) => `${Number(r.giaPhong || 0).toLocaleString()} đ`, align: 'right' },
              { title: 'Thành tiền', render: (_, r: any) => `${Number(r.thanhTien || 0).toLocaleString()} đ`, align: 'right' },
            ]}
          />
        )}

        {/* Dịch vụ (server + mới thêm) */}
        {combinedServices.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <h4><Tag color="blue">Dịch vụ sử dụng</Tag></h4>
            <Table size="small" pagination={false} dataSource={combinedServices}
              columns={[
                { title: 'Dịch vụ', dataIndex: 'serviceName' },
                { title: 'Thành tiền', render: (_: any, r: any) => `${Number(r.amount || 0).toLocaleString()} đ`, align: 'right' },
              ]}
            />
          </div>
        )}

        {/* Tổng kết */}
        <div style={{ background: '#fff7e6', padding: 16, borderRadius: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span>Tiền phòng:</span>
            <strong>{roomTotal.toLocaleString()} đ</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span>Dịch vụ:</span>
            <strong>{serviceTotal.toLocaleString()} đ</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span>Tạm tính (chưa VAT):</span>
            <strong>{subTotal.toLocaleString()} đ</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span>Thuế VAT (10%):</span>
            <strong>{vat.toLocaleString()} đ</strong>
          </div>
          <Divider />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 700 }}>
            <span>TỔNG CỘNG:</span>
            <span style={{ color: '#d4380d' }}>{total.toLocaleString()} đ</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Tiền cọc (chỉ để hiển thị):</span>
            <strong>{deposit.toLocaleString()} đ</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Đã thanh toán (không bao gồm tiền cọc):</span>
            <strong>- {paid.toLocaleString()} đ</strong>
          </div>
          <Divider />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, fontWeight: 700, color: '#d4380d' }}>
            <span>KHÁCH CẦN THANH TOÁN:</span>
            <span>{needToPay.toLocaleString()} đ</span>
          </div>
        </div>

        {/* Payment method & note */}
        <div style={{ marginBottom: 12 }}>
          <Form.Item name="PhuongThucThanhToan" label="Phương thức thanh toán" style={{ marginBottom: 8 }}>
            <Select style={{ width: 260 }}>
              <Select.Option value={1}>Tiền mặt / Quầy</Select.Option>
              <Select.Option value={2}>Online (QR)</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="GhiChu" label="Ghi chú">
            <Input.TextArea rows={2} placeholder="Ghi chú (nếu cần)" />
          </Form.Item>
        </div>

        </Form>
      </Spin>
    </Modal>
  );
};


export default PaymentModal;