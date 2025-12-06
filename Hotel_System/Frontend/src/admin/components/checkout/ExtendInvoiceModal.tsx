import React, { useEffect, useState } from 'react';
import { Modal, Button, Descriptions, Divider, Tag, Spin } from 'antd';
import { CheckCircleOutlined, PrinterOutlined } from '@ant-design/icons';
import checkoutApi from '../../../api/checkout.Api';

interface ExtendInvoiceModalProps {
  visible: boolean;
  onClose: () => void;
  extendData: {
    IddatPhong?: string;
    iddatPhong?: string;
    TenKhachHang?: string;
    tenKhachHang?: string;
    customer?: { name?: string; email?: string };
    EmailKhachHang?: string;
    email?: string;
    TenPhong?: string;
    tenPhong?: string;
    SoPhong?: string;
    soPhong?: string;
    OldCheckout?: string;
    oldCheckout?: string;
    NewCheckout?: string;
    newCheckout?: string;
    ExtendDescription?: string;
    extendDescription?: string;
    ExtendFee?: number;
    extendFee?: number;
    VatAmount?: number;
    vatAmount?: number;
    TotalExtendFee?: number;
    totalExtendFee?: number;
    HoaDonId?: string;
    hoaDonId?: string;
    NewRoomId?: string;
    newRoomId?: string;
    NewRoomName?: string;
    newRoomName?: string;
    PaymentMethod?: number;
    paymentMethod?: number; // 1 = tiền mặt, 2 = online, 3 = thanh toán sau
    TongTienHoaDonMoi?: number;
    tongTienHoaDonMoi?: number;
    IsRoomChange?: boolean;
    isRoomChange?: boolean;
  } | null;

  // 🔧 thêm: fallback info từ booking gốc
  paymentRow?: any | null;
}

const ExtendInvoiceModal: React.FC<ExtendInvoiceModalProps> = ({
  visible,
  onClose,
  extendData,
  paymentRow,
}) => {
  const [customerInfo, setCustomerInfo] = useState<{ name: string; email: string }>({
    name: '',
    email: '',
  });
  const [roomInfo, setRoomInfo] = useState<{ tenPhong: string; soPhong: string }>({
    tenPhong: '',
    soPhong: '',
  });
  const [loading, setLoading] = useState(false);

  const getBookingId = (d: any) => {
    if (!d) return null;
    return (
      d?.IDDatPhong ??
      d?.IddatPhong ??
      d?.iddatPhong ??
      d?.idDatPhong ??
      d?.IdDatPhong ??
      d?.MaDatPhong ??
      d?.maDatPhong ??
      d?.DatPhongId ??
      d?.datPhongId ??
      d?.DatPhong?.IdDatPhong ??
      d?.DatPhong?.iddatPhong ??
      (Array.isArray(d?.invoices) && d.invoices[0]?.IDDatPhong) ??
      null
    );
  };

  const bookingId = getBookingId(extendData as any);

  useEffect(() => {
    if (visible && bookingId) {
      setLoading(true);
      checkoutApi
        .getSummary(String(bookingId))
        .then((res: any) => {
          // ---- Khách hàng ----
          const name =
            res?.customer?.name ??
            res?.TenKhachHang ??
            res?.tenKhachHang ??
            res?.invoices?.[0]?.tenKhachHang ??
            res?.invoices?.[0]?.TenKhachHang ??
            res?.CustomerName ??
            res?.customerName ??
            '';
          const email =
            res?.customer?.email ??
            res?.EmailKhachHang ??
            res?.emailKhachHang ??
            res?.invoices?.[0]?.emailKhachHang ??
            res?.invoices?.[0]?.EmailKhachHang ??
            res?.CustomerEmail ??
            res?.customerEmail ??
            '';
          setCustomerInfo({ name, email });

          // ---- Phòng ----
          const firstItem =
            Array.isArray(res?.items) && res.items.length > 0 ? res.items[0] : null;

          const tenPhongFromSummary =
            firstItem?.tenPhong ??
            firstItem?.TenPhong ??
            res?.Room?.tenPhong ??
            res?.Room?.TenPhong ??
            '';

          const soPhongFromSummary =
            firstItem?.soPhong ??
            firstItem?.SoPhong ??
            res?.Room?.soPhong ??
            res?.Room?.SoPhong ??
            '';

          if (tenPhongFromSummary || soPhongFromSummary) {
            setRoomInfo({
              tenPhong: tenPhongFromSummary,
              soPhong: soPhongFromSummary,
            });
          }
        })
        .catch((err) => {
          console.error('Lỗi lấy thông tin khách hàng/phòng:', err);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [visible, bookingId]);

  if (!extendData) return null;

  const tenKhachHang = extendData.TenKhachHang ?? extendData.tenKhachHang;

  const extractRoomName = (d: any) => {
    return (
      d?.NewRoomName ??
      d?.newRoomName ??
      d?.Phong?.TenPhong ??
      d?.Phong?.tenPhong ??
      d?.TenPhong ??
      d?.tenPhong ??
      d?.RoomName ??
      d?.roomName ??
      (d?.SoPhong
        ? `Phòng ${d.SoPhong ?? d.soPhong}`
        : d?.Phong?.SoPhong
        ? `Phòng ${d.Phong.SoPhong}`
        : undefined) ??
      undefined
    );
  };

  // 🔧 TÊN PHÒNG: ưu tiên extendData, sau đó paymentRow, sau đó roomInfo, cuối cùng mới ghép từ số phòng
  const safeRoomTenPhong = roomInfo.tenPhong ? roomInfo.tenPhong : undefined;
  const safeRoomSoPhong = roomInfo.soPhong ? roomInfo.soPhong : undefined;

  const tenPhongGoc =
    extendData.TenPhong ??
    extendData.tenPhong ??
    (extendData as any).Phong?.TenPhong ??
    (extendData as any).RoomName ??
    (extendData as any).roomName ??
    paymentRow?.TenPhong ??
    paymentRow?.tenPhong ??
    safeRoomTenPhong ??
    (extendData.SoPhong
      ? `Phòng ${extendData.SoPhong ?? extendData.soPhong}`
      : (extendData as any).Phong?.SoPhong
      ? `Phòng ${(extendData as any).Phong.SoPhong}`
      : undefined);

  const customerName =
    customerInfo.name ||
    extendData.customer?.name ||
    tenKhachHang ||
    paymentRow?.TenKhachHang ||
    '-';

  const customerEmail =
    customerInfo.email ||
    extendData.customer?.email ||
    extendData.EmailKhachHang ||
    extendData.email ||
    paymentRow?.EmailKhachHang ||
    '-';

  const oldCheckout = extendData.OldCheckout ?? extendData.oldCheckout;
  const newCheckout = extendData.NewCheckout ?? extendData.newCheckout;
  const extendDescription = extendData.ExtendDescription ?? extendData.extendDescription;
  const extendFee = extendData.ExtendFee ?? extendData.extendFee ?? 0;
  const vatAmount = extendData.VatAmount ?? extendData.vatAmount ?? 0;
  const totalExtendFee = extendData.TotalExtendFee ?? extendData.totalExtendFee ?? 0;

  const hoaDonId =
    extendData.HoaDonId ??
    extendData.hoaDonId ??
    (Array.isArray((extendData as any).invoices) &&
      (extendData as any).invoices[0]?.idHoaDon) ??
    (Array.isArray((extendData as any).invoices) &&
      (extendData as any).invoices[0]?.IDHoaDon) ??
    null;

  const newRoomName =
    extendData.NewRoomName ??
    extendData.newRoomName ??
    extractRoomName(
      (extendData as any).NewRoom ??
        (extendData as any).newRoom ??
        (extendData as any),
    ) ??
    null;

  const extractedSoPhong =
    (extendData as any).NewRoom?.SoPhong ??
    (extendData as any).NewRoom?.soPhong ??
    extendData.SoPhong ??
    extendData.soPhong ??
    (extendData as any).Phong?.SoPhong ??
    (extendData as any).Phong?.soPhong ??
    paymentRow?.SoPhong ??
    paymentRow?.soPhong ??
    safeRoomSoPhong ??
    null;

  const roomDisplayName =
    newRoomName ??
    tenPhongGoc ??
    safeRoomTenPhong ??
    extractRoomName(extendData) ??
    (extractedSoPhong ? `Phòng ${extractedSoPhong}` : '-');

  const paymentMethod = extendData.PaymentMethod ?? extendData.paymentMethod;
  const tongTienHoaDonMoi =
    extendData.TongTienHoaDonMoi ?? extendData.tongTienHoaDonMoi ?? 0;
  const isRoomChange =
    extendData.IsRoomChange ?? extendData.isRoomChange ?? false;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('vi-VN');
    } catch {
      return dateStr;
    }
  };

  const formatMoney = (amount?: number) =>
    (amount ?? 0).toLocaleString('vi-VN') + ' đ';

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20 }} />
          <span>
            {isRoomChange
              ? 'Hóa đơn đặt phòng mới (Gia hạn + Chuyển phòng)'
              : 'Hóa đơn gia hạn phòng'}
          </span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      width={600}
      footer={[
        <Button key="print" icon={<PrinterOutlined />} onClick={handlePrint}>
          In hóa đơn
        </Button>,
        <Button key="close" type="primary" onClick={onClose}>
          Đóng
        </Button>,
      ]}
    >
      <div style={{ padding: '16px 0' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, color: '#1890ff' }}>ROBINS VILLA</h2>
          <p style={{ margin: '4px 0', color: '#666' }}>
            Hóa đơn gia hạn phòng
          </p>
          <Tag color="green">Đã xác nhận</Tag>
        </div>

        <Divider style={{ margin: '16px 0' }} />

        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="Mã đặt phòng">
            <strong>{bookingId ?? '-'}</strong>
          </Descriptions.Item>
          <Descriptions.Item label="Mã hóa đơn">
            <strong style={{ color: '#1890ff' }}>
              {hoaDonId ?? '-'}
            </strong>
          </Descriptions.Item>
          <Descriptions.Item label="Khách hàng">
            {loading ? (
              <Spin size="small" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 600 }}>
                  {customerName || '-'}
                </span>
                <span
                  style={{
                    color: '#6b7280',
                    fontSize: 12,
                  }}
                >
                  {customerEmail || '-'}
                </span>
              </div>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Phòng">
            {isRoomChange ? (
              <div>
                <div
                  style={{
                    fontWeight: 600,
                    color: '#52c41a',
                  }}
                >
                  {roomDisplayName}
                </div>
                {extractedSoPhong && (
                  <div style={{ color: '#64748b' }}>
                    Phòng {extractedSoPhong}
                  </div>
                )}
                <Tag color="blue" style={{ marginTop: 6 }}>
                  Phòng mới (chuyển)
                </Tag>
              </div>
            ) : (
              <div>
                <div style={{ fontWeight: 600 }}>
                  {roomDisplayName}
                </div>
                {extractedSoPhong && (
                  <div style={{ color: '#64748b' }}>
                    Phòng {extractedSoPhong}
                  </div>
                )}
              </div>
            )}
          </Descriptions.Item>
        </Descriptions>

        <Divider style={{ margin: '16px 0' }}>Chi tiết gia hạn</Divider>

        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="Loại gia hạn">
            <Tag color="purple">
              {extendDescription || 'Gia hạn'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Ngày trả cũ">
            {formatDate(oldCheckout)}
          </Descriptions.Item>
          <Descriptions.Item label="Ngày trả mới">
            <strong style={{ color: '#52c41a' }}>
              {formatDate(newCheckout)}
            </strong>
          </Descriptions.Item>
        </Descriptions>

        <Divider style={{ margin: '16px 0' }}>Chi phí</Divider>

        <div
          style={{
            background: '#fafafa',
            padding: 16,
            borderRadius: 8,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}
          >
            <span>Phí gia hạn:</span>
            <span>{formatMoney(extendFee)}</span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}
          >
            <span>VAT (10%):</span>
            <span>{formatMoney(vatAmount)}</span>
          </div>
          <Divider style={{ margin: '8px 0' }} />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontWeight: 'bold',
              fontSize: 16,
            }}
          >
            <span>Tổng phí gia hạn:</span>
            <span style={{ color: '#f5222d' }}>
              {formatMoney(totalExtendFee)}
            </span>
          </div>

          {tongTienHoaDonMoi > 0 && (
            <>
              <Divider style={{ margin: '12px 0' }} />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontWeight: 'bold',
                  fontSize: 18,
                  color: '#1890ff',
                }}
              >
                <span>Tổng tiền (sau gia hạn):</span>
                <span>{formatMoney(tongTienHoaDonMoi)}</span>
              </div>
            </>
          )}
        </div>

        <div style={{ marginTop: 16, textAlign: 'center' }}>
          {paymentMethod === 1 && (
            <Tag
              color="green"
              style={{ fontSize: 14, padding: '4px 12px' }}
            >
              <CheckCircleOutlined /> Đã thanh toán (Tiền mặt)
            </Tag>
          )}
          {paymentMethod === 3 && (
            <Tag
              color="blue"
              style={{ fontSize: 14, padding: '4px 12px' }}
            >
              Chờ thanh toán (Chuyển khoản)
            </Tag>
          )}
        </div>

        <Divider style={{ margin: '16px 0' }} />
        <div
          style={{
            textAlign: 'center',
            color: '#666',
            fontSize: 12,
          }}
        >
          <p style={{ margin: 0 }}>
            Ngày lập:{' '}
            {new Date().toLocaleString('vi-VN')}
          </p>
          <p style={{ margin: '4px 0 0 0' }}>
            Cảm ơn quý khách đã sử dụng dịch vụ!
          </p>
        </div>
      </div>
    </Modal>
  );
};

export default ExtendInvoiceModal;