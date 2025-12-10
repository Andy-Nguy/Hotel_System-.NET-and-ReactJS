import React, { useEffect, useState } from 'react';
import { Modal, Input, InputNumber, Select, Button, message, Typography, Divider, Space, Card } from 'antd';
import paymentApi, { PaymentMethod } from '../../../api/paymentApi';
import invoiceApi from '../../../api/invoiceApi';

type Props = {
  visible: boolean;
  onClose: () => void;
  idHoaDon?: string;
  defaultAmount?: number;
  onSuccess?: () => void;
  bookingDetail?: any;
};

const { TextArea } = Input;
const { Title, Text } = Typography;

const RefundForm: React.FC<Props> = ({ visible, onClose, idHoaDon, defaultAmount, onSuccess, bookingDetail }) => {
  const [invoiceId, setInvoiceId] = useState<string | undefined>(idHoaDon);
  const [amount, setAmount] = useState<number | undefined>(defaultAmount ?? undefined);
  const [method, setMethod] = useState<PaymentMethod | undefined>('CASH');
  const [reason, setReason] = useState<string>('Hoàn chênh lệch do đổi phòng');
  const [refundDate, setRefundDate] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setInvoiceId(idHoaDon);
    setAmount(defaultAmount ?? undefined);
    setRefundDate(new Date().toISOString().slice(0, 10));

    if (bookingDetail) {
      try {
        const inv = (bookingDetail.hoaDons && bookingDetail.hoaDons[0]) || bookingDetail.hoaDon || (bookingDetail.HoaDons && bookingDetail.HoaDons[0]) || null;
        const invId = inv?.IdHoaDon ?? inv?.idHoaDon ?? inv?.id ?? null;
        if (!idHoaDon && invId) setInvoiceId(invId);
        if (!defaultAmount) {
          const suggested = bookingDetail.pendingRefund ?? bookingDetail.PendingRefund ?? inv?.RefundAmount ?? inv?.refundAmount ?? null;
          if (suggested) setAmount(Number(suggested));
        }
      } catch (e) {
        // ignore
      }
    }

    const resolveInvoice = async () => {
      let invId = idHoaDon || (bookingDetail && ((bookingDetail.hoaDons && bookingDetail.hoaDons[0]) || bookingDetail.hoaDon || (bookingDetail.HoaDons && bookingDetail.HoaDons[0]))?.IdHoaDon);

      // fallback: if we don't have an invoice id but have booking id, try listing invoices and find one for this booking
      if (!invId && bookingDetail?.iddatPhong) {
        try {
          const list = await invoiceApi.getInvoices();
          if (Array.isArray(list) && list.length > 0) {
            const found = list.find((x: any) => (x.idDatPhong ?? x.idDatPhong ?? x.idDatPhong) == bookingDetail.iddatPhong || (x.idDatPhong ?? x.idDatPhong ?? x.idDatPhong) == bookingDetail.IddatPhong);
            if (found) invId = found.idHoaDon ?? found.id ?? found.IDHoaDon ?? null;
          }
        } catch (e) {
          // ignore listing errors
        }
      }

      if (invId) {
        try {
          const res = await invoiceApi.getInvoiceDetail(invId);
          if (res && res.data && !defaultAmount && res.data.tienThanhToan != null && (amount == null || amount === undefined)) {
            setAmount(Number(res.data.tienThanhToan));
          }
          // also ensure invoiceId state is set so user sees the id
          if (!invoiceId) setInvoiceId(invId);
        } catch (e) {
          // ignore
        }
      }
    };

    void resolveInvoice();
  }, [idHoaDon, defaultAmount, visible]);

  const doRefund = async () => {
    if (!invoiceId) return message.error('Vui lòng nhập mã hóa đơn để hoàn tiền');
    if (!amount || Number(amount) <= 0) return message.error('Số tiền hoàn phải lớn hơn 0');
    setLoading(true);
    try {
      const req = { idHoaDon: invoiceId, refundAmount: Number(amount), reason, refundMethod: method, refundDate };
      const res = await paymentApi.refundPayment(req as any);
      if (res && res.success) {
        message.success(res.message || 'Yêu cầu hoàn tiền đã gửi');
        onClose();
        if (onSuccess) await onSuccess();
      } else {
        message.error(res.message || 'Hoàn tiền thất bại');
      }
    } catch (err: any) {
      message.error(err?.message || 'Lỗi khi gọi API hoàn tiền');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={<Title level={4} style={{ margin: 0 }}>Hoàn tiền cho khách hàng</Title>}
      open={visible}
      onCancel={onClose}
      footer={null}
      width={620}
      centered
      closeIcon={<span style={{ fontSize: 18 }}>×</span>}
    >
      <div style={{ padding: '8px 0' }}>
        {/* Thông tin khách hàng & đặt phòng - dạng Card đẹp */}
        {bookingDetail && (
          <Card size="small" style={{ marginBottom: 20, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <Title level={5} style={{ margin: '0 0 12px 0', color: '#1d39c4' }}>Thông tin khách hàng</Title>
            <Space direction="vertical" size={4} style={{ width: '100%', fontSize: 14 }}>
              <div><Text strong>Họ tên:</Text> {bookingDetail.idkhachHangNavigation?.hoTen ?? bookingDetail.tenKhachHang ?? '-'}</div>
              <div><Text strong>Liên hệ:</Text> {bookingDetail.idkhachHangNavigation?.soDienThoai ?? bookingDetail.soDienThoai ?? bookingDetail.emailKhachHang ?? '-'}</div>
              <div><Text strong>ID khách:</Text> {bookingDetail.idkhachHang ?? bookingDetail.idKhachHang ?? '-'}</div>
            </Space>

            <Divider style={{ margin: '16px 0' }} />

            <Title level={5} style={{ margin: '0 0 12px 0', color: '#1d39c4' }}>Thông tin đặt phòng & thanh toán</Title>
            <Space direction="vertical" size={4} style={{ width: '100%', fontSize: 14 }}>
              <div><Text strong>Mã đặt phòng:</Text> {bookingDetail.iddatPhong ?? bookingDetail.IddatPhong ?? '-'}</div>
              <div><Text strong>Phòng:</Text> {bookingDetail.idphong ?? bookingDetail.Idphong ?? '-'} ({bookingDetail.tenLoaiPhong ?? bookingDetail.roomTypeName ?? '-'})</div>
              <div>
                <Text strong>Thời gian:</Text>{' '}
                {bookingDetail.ngayNhanPhong ? new Date(bookingDetail.ngayNhanPhong).toLocaleDateString('vi-VN') : '-'} →{' '}
                {bookingDetail.ngayTraPhong ? new Date(bookingDetail.ngayTraPhong).toLocaleDateString('vi-VN') : '-'}
              </div>
              <div><Text strong>Tổng tiền phòng:</Text> {bookingDetail.tongTien ? Number(bookingDetail.tongTien).toLocaleString('vi-VN') + ' ₫' : '-'}</div>
              <div>
                <Text strong>Đã thanh toán:</Text>{' '}
                {(() => {
                  try {
                    const paidFromInvoice = bookingDetail?.invoiceDetail?.tienThanhToan ?? null;
                    if (paidFromInvoice != null) return Number(paidFromInvoice).toLocaleString('vi-VN') + ' ₫';
                    const inv = (bookingDetail.hoaDons && bookingDetail.hoaDons[0]) || bookingDetail.hoaDon || (bookingDetail.HoaDons && bookingDetail.HoaDons[0]) || null;
                    const paid = inv?.TienThanhToan ?? inv?.tienThanhToan ?? inv?.TienThanhToan ?? bookingDetail.tienCoc ?? bookingDetail.TienCoc ?? null;
                    return paid != null ? Number(paid).toLocaleString('vi-VN') + ' ₫' : '-';
                  } catch (e) {
                    return '-';
                  }
                })()}
              </div>
            </Space>
          </Card>
        )}

        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 8 }}>Mã hóa đơn (IdHoaDon)</Text>
            <Input
              size="large"
              value={invoiceId}
              onChange={(e) => setInvoiceId(e.target.value)}
              placeholder="VD: HD-20251205-001"
              allowClear
            />
          </div>

          <div>
            <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 8 }}>Số tiền hoàn trả (VND)</Text>
            <InputNumber
              size="large"
              value={amount}
              onChange={(v) => setAmount(typeof v === 'number' ? v : undefined)}
              style={{ width: '100%' }}
              min={1}
              step={10000}
              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => value!.replace(/\$\s?|(,*)/g, '') as any}
              placeholder="Nhập số tiền cần hoàn"
            />
          </div>

          <div>
            <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 8 }}>Phương thức hoàn tiền</Text>
            <Select
              size="large"
              value={method}
              onChange={(v) => setMethod(v as PaymentMethod)}
              style={{ width: '100%' }}
              options={[
                { value: 'CASH', label: '💵 Tiền mặt' },
                { value: 'BANK_TRANSFER', label: '🏦 Chuyển khoản ngân hàng' },
                { value: 'CREDIT_CARD', label: '💳 Thẻ tín dụng / Thẻ ghi nợ' },
              ]}
            />
          </div>

          <div>
            <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 8 }}>Ngày hoàn tiền</Text>
            <Input
              size="large"
              type="date"
              value={refundDate}
              onChange={(e) => setRefundDate(e.target.value)}
            />
          </div>

          <div>
            <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 8 }}>Lý do hoàn tiền</Text>
            <TextArea
              size="large"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Mô tả chi tiết lý do hoàn tiền..."
            />
          </div>
        </Space>

        <Divider style={{ margin: '24px 0 16px' }} />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <Button size="large" onClick={onClose}>
            Hủy bỏ
          </Button>
          <Button
            size="large"
            type="primary"
            loading={loading}
            onClick={doRefund}
            style={{ minWidth: 140 }}
            icon={<span style={{ marginRight: 6 }}>↩</span>}
          >
            Xác nhận hoàn tiền
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default RefundForm;