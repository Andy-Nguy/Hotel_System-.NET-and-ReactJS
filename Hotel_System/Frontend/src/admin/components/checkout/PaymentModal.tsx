import React, { useEffect } from 'react';
import { Modal, Form, InputNumber, Select, Table, Divider, Spin, Tag, Input, message } from 'antd';

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
  const roomTotal = Number(summary?.money?.roomTotal ?? 0);
  // Server-side services (from getSummary)
  const serverServices = Array.isArray(summary?.services)
    ? summary.services.map((s: any) => ({
        serviceName: s.tenDichVu ?? s.TenDichVu ?? s.ten ?? '',
        price: Number(s.donGia ?? s.DonGia ?? s.donGia ?? s.thanhTien ?? 0),
        amount: Number(s.thanhTien ?? s.ThanhTien ?? s.donGia ?? 0),
      }))
    : [];

  // Client-side selected services (not yet saved)
  const clientServices = Array.isArray(selectedServices)
    ? selectedServices.map((v: any) => ({ serviceName: v.serviceName ?? v.tenDichVu ?? '', price: Number(v.price ?? 0), amount: Number(v.price ?? 0) }))
    : [];

  const combinedServices = [...serverServices, ...clientServices];
  const serviceTotal = combinedServices.reduce((s, v) => s + (Number(v.amount) || 0), 0);

  const deposit = Number(summary?.money?.deposit ?? 0);
  // Prefer the invoice's TienThanhToan (from DB) when available; otherwise fall back to booking-level paidAmount
  const invoicePaid = Array.isArray(summary?.invoices) && summary.invoices.length > 0
    ? Number(summary.invoices[0].tienThanhToan ?? summary.invoices[0].TienThanhToan ?? 0)
    : 0;
  const paid = invoicePaid > 0 ? invoicePaid : Number(summary?.money?.paidAmount ?? 0);
  // Compute totals on the client side: total = (room + services) + VAT
  // The amount the guest needs to pay = TOTAL - ĐÃ THANH TOÁN
  // Important: `paid` is the canonical paid amount (HoaDon.TienThanhToan) and already includes any deposit.
  // We must NOT subtract `deposit` again here.
  const subTotal = roomTotal + serviceTotal; // trước VAT
  const vat = Math.round(subTotal * 0.1);
  const total = Math.round(subTotal + vat);
  const needToPay = Math.max(0, total - paid);

  useEffect(() => {
    if (visible) {
      form.setFieldsValue({ amount: needToPay, PhuongThucThanhToan: 1, GhiChu: '' });
    }
  }, [needToPay, visible, form]);

  // onOk should delegate to parent submit handler (onSubmit)

  return (
    <Modal title={`Thanh toán – ${paymentRow?.IddatPhong}`} open={visible} onCancel={onCancel} onOk={onSubmit}
      okText="Xác nhận" cancelText="Hủy" width={900}>
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
  title: 'Phong',
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
              
              { title: 'Phong', render: (_: any, r: any) => r.idPhong ?? r.IDPhong ?? r.IdPhong ?? r.TenPhong ?? r.SoPhong ?? '-' },
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
                { title: 'Đơn giá', render: (_: any, r: any) => `${Number(r.price || 0).toLocaleString()} đ`, align: 'right' },
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
            <span>Đã thanh toán (bao gồm tiền cọc):</span>
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