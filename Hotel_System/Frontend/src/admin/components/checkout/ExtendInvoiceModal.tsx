import React from 'react';
import { Modal, Button, Descriptions, Divider, Tag, message } from 'antd';
import { CheckCircleOutlined, PrinterOutlined } from '@ant-design/icons';

interface ExtendInvoiceModalProps {
  visible: boolean;
  onClose: () => void;
  extendData: {
    // Support both camelCase và PascalCase từ API response
    IddatPhong?: string;
    iddatPhong?: string;
    TenKhachHang?: string;
    tenKhachHang?: string;
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
    paymentMethod?: number; // 1 = tiền mặt, 2 = online
    TongTienHoaDonMoi?: number;
    tongTienHoaDonMoi?: number; // Tổng tiền hóa đơn sau khi cộng gia hạn
    IsRoomChange?: boolean;
    isRoomChange?: boolean; // Flag để biết có chuyển phòng hay không
  } | null;
}

const ExtendInvoiceModal: React.FC<ExtendInvoiceModalProps> = ({
  visible,
  onClose,
  extendData
}) => {
  if (!extendData) return null;

  // Normalize: lấy cả PascalCase và camelCase
  const iddatPhong = extendData.IddatPhong ?? extendData.iddatPhong;
  const tenKhachHang = extendData.TenKhachHang ?? extendData.tenKhachHang;
  const tenPhong = extendData.TenPhong ?? extendData.tenPhong;
  const soPhong = extendData.SoPhong ?? extendData.soPhong;
  const oldCheckout = extendData.OldCheckout ?? extendData.oldCheckout;
  const newCheckout = extendData.NewCheckout ?? extendData.newCheckout;
  const extendDescription = extendData.ExtendDescription ?? extendData.extendDescription;
  const extendFee = extendData.ExtendFee ?? extendData.extendFee ?? 0;
  const vatAmount = extendData.VatAmount ?? extendData.vatAmount ?? 0;
  const totalExtendFee = extendData.TotalExtendFee ?? extendData.totalExtendFee ?? 0;
  const hoaDonId = extendData.HoaDonId ?? extendData.hoaDonId;
  const newRoomId = extendData.NewRoomId ?? extendData.newRoomId;
  const newRoomName = extendData.NewRoomName ?? extendData.newRoomName;
  const paymentMethod = extendData.PaymentMethod ?? extendData.paymentMethod;
  const tongTienHoaDonMoi = extendData.TongTienHoaDonMoi ?? extendData.tongTienHoaDonMoi ?? 0;
  const isRoomChange = extendData.IsRoomChange ?? extendData.isRoomChange ?? false;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('vi-VN');
    } catch {
      return dateStr;
    }
  };

  const formatMoney = (amount?: number) => {
    return (amount ?? 0).toLocaleString('vi-VN') + ' đ';
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20 }} />
          <span>
            {isRoomChange ? 'Hóa đơn đặt phòng mới (Gia hạn + Chuyển phòng)' : 'Hóa đơn gia hạn phòng'}
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
        </Button>
      ]}
    >
      <div style={{ padding: '16px 0' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, color: '#1890ff' }}>ROBINS VILLA</h2>
          <p style={{ margin: '4px 0', color: '#666' }}>Hóa đơn gia hạn phòng</p>
          <Tag color="green">Đã xác nhận</Tag>
        </div>

        <Divider style={{ margin: '16px 0' }} />

        {/* Thông tin đặt phòng */}
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="Mã đặt phòng">
            <strong>{iddatPhong || '-'}</strong>
          </Descriptions.Item>
          <Descriptions.Item label="Mã hóa đơn">
            <strong style={{ color: '#1890ff' }}>{hoaDonId || '-'}</strong>
          </Descriptions.Item>
          <Descriptions.Item label="Khách hàng">
            {tenKhachHang || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Phòng">
            {isRoomChange ? (
              <span>
                <strong style={{ color: '#52c41a' }}>{tenPhong || newRoomName}</strong>
                <Tag color="blue" style={{ marginLeft: 8 }}>Phòng mới (chuyển)</Tag>
              </span>
            ) : (
              <span>{tenPhong || `Phòng ${soPhong}`}</span>
            )}
          </Descriptions.Item>
        </Descriptions>

        <Divider style={{ margin: '16px 0' }}>Chi tiết gia hạn</Divider>

        {/* Thông tin gia hạn */}
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="Loại gia hạn">
            <Tag color="purple">{extendDescription || 'Gia hạn'}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Ngày trả cũ">
            {formatDate(oldCheckout)}
          </Descriptions.Item>
          <Descriptions.Item label="Ngày trả mới">
            <strong style={{ color: '#52c41a' }}>{formatDate(newCheckout)}</strong>
          </Descriptions.Item>
        </Descriptions>

        <Divider style={{ margin: '16px 0' }}>Chi phí</Divider>

        {/* Chi phí */}
        <div style={{ background: '#fafafa', padding: 16, borderRadius: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span>Phí gia hạn:</span>
            <span>{formatMoney(extendFee)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span>VAT (10%):</span>
            <span>{formatMoney(vatAmount)}</span>
          </div>
          <Divider style={{ margin: '8px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: 16 }}>
            <span>Tổng phí gia hạn:</span>
            <span style={{ color: '#f5222d' }}>{formatMoney(totalExtendFee)}</span>
          </div>
          
          {tongTienHoaDonMoi > 0 && (
            <>
              <Divider style={{ margin: '12px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: 18, color: '#1890ff' }}>
                <span>Tổng hóa đơn (sau gia hạn):</span>
                <span>{formatMoney(tongTienHoaDonMoi)}</span>
              </div>
            </>
          )}
        </div>

        {/* Trạng thái thanh toán */}
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          {paymentMethod === 1 ? (
            <Tag color="green" style={{ fontSize: 14, padding: '4px 12px' }}>
              <CheckCircleOutlined /> Đã thanh toán (Tiền mặt)
            </Tag>
          ) : (
            <Tag color="blue" style={{ fontSize: 14, padding: '4px 12px' }}>
              Chờ thanh toán (Chuyển khoản)
            </Tag>
          )}
        </div>

        {/* Footer */}
        <Divider style={{ margin: '16px 0' }} />
        <div style={{ textAlign: 'center', color: '#666', fontSize: 12 }}>
          <p style={{ margin: 0 }}>Ngày lập: {new Date().toLocaleString('vi-VN')}</p>
          <p style={{ margin: '4px 0 0 0' }}>Cảm ơn quý khách đã sử dụng dịch vụ!</p>
        </div>
      </div>
    </Modal>
  );
};

export default ExtendInvoiceModal;
