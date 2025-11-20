// src/components/checkout/InvoiceModal.tsx
import React from 'react';
import { Modal, Button, Descriptions, Table, Tag, message } from 'antd';

interface Props {
  visible: boolean;
  invoiceData: any | null;
  paymentRow: any | null;
  selectedServices?: any[];
  servicesTotal?: number;
  onClose: () => void;
  onComplete: (idDatPhong: string) => Promise<void>;
}

const InvoiceModal: React.FC<Props> = ({
  visible,
  invoiceData,
  paymentRow,
  selectedServices = [],
  onClose,
  onComplete,
}) => {
  const handleComplete = async () => {
    const id = invoiceData?.IDDatPhong ?? invoiceData?.idDatPhong ?? paymentRow?.IddatPhong;
    if (!id) return message.error('Không xác định được mã đặt phòng');
    await onComplete(String(id));
  };

  // === CHỈ THAY ĐOẠN NÀY – TÍNH ĐÚNG, KHÔNG VAT ===
  const srcItems = (invoiceData?.items && Array.isArray(invoiceData.items) && invoiceData.items.length > 0)
    ? invoiceData.items
    : (paymentRow?.ChiTietDatPhongs ?? []);

  const normalized = (srcItems || []).map((it: any, idx: number) => {
    const rawThanh = Number(it?.ThanhTien ?? it?.thanhTien ?? it?.Tien ?? 0);
    const promo = Number(it?.GiamGia ?? it?.giamGia ?? it?.discount ?? 0) || 0;
    const discounted = Math.max(0, rawThanh - promo);
    return {
      ID: it?.id ?? it?.IDChiTiet ?? idx,
      TenPhong: it?.TenPhong ?? it?.tenPhong ?? it?.Phong?.TenPhong ?? '-',
      SoPhong: it?.SoPhong ?? it?.soPhong ?? null,
      SoDem: Number(it?.SoDem ?? it?.soDem ?? 1),
      GiaPhong: Number(it?.GiaPhong ?? it?.giaPhong ?? 0),
      ThanhTien: rawThanh,
      promoAmount: promo,
      discounted: discounted,
      hasPromotion: promo > 0,
    };
  });

  // Tính tiền phòng (sau khuyến mãi)
  const roomTotal = normalized.reduce((s: number, r: any) => s + Number(r.discounted ?? r.ThanhTien ?? 0), 0);

  // Dịch vụ từ server
  const serverServices = Array.isArray(invoiceData?.services)
    ? invoiceData.services.map((s: any) => ({
        tenDichVu: s.tenDichVu ?? s.TenDichVu ?? s.ten ?? '',
        // treat service as single unit; present donGia and thanhTien
        donGia: s.donGia ?? s.DonGia ?? 0,
        thanhTien: Number(s.thanhTien ?? s.ThanhTien ?? (s.donGia ?? 0) * (s.soLuong ?? 1)),
      }))
    : [];

  // Dịch vụ mới thêm ở client (no quantity)
  const clientServices = selectedServices.map((s: any) => ({
    tenDichVu: s.serviceName ?? s.tenDichVu ?? '',
    donGia: s.price ?? s.donGia ?? 0,
    thanhTien: Number(s.price ?? s.donGia ?? 0),
  }));

  const combinedServices = [...serverServices, ...clientServices];
  const serviceTotal = combinedServices.reduce((s: number, sv: any) => s + Number(sv.thanhTien ?? 0), 0);

  // TỔNG CUỐI CỦA KHÁCH (ÁP VAT 10%)
  const subTotal = roomTotal + serviceTotal; // trước VAT
  const vat = Math.round(subTotal * 0.1);
  const finalTotal = Math.round(subTotal + vat); // TỔNG CỘNG toàn bộ (gồm VAT)

  // Tiền cọc
  const deposit = Number(invoiceData?.money?.deposit ?? invoiceData?.TienCoc ?? 0);

  // Tiền thanh toán trước (nếu khách đã thanh toán từng phần trước check-in)
  const previousPayment = Number(invoiceData?.money?.previousPayment ?? invoiceData?.TienThanhToan ?? paymentRow?.TienThanhToan ?? 0);

  // Đã thanh toán = Tiền cọc + Tiền thanh toán trước
  const alreadyPaid = Math.max(0, deposit + previousPayment);

  // Khách cần thanh toán = TỔNG CỘNG - Đã thanh toán
  const needToPay = Math.max(0, finalTotal - alreadyPaid);
  // ========================================

  return (
    <Modal
      title={invoiceData ? `Hóa đơn - ${invoiceData?.IDHoaDon ?? invoiceData?.idHoaDon ?? ''}` : 'Hóa đơn'}
      open={visible}
      onCancel={onClose}
      width={900}
      centered
      footer={[
        <Button key="close" onClick={onClose}>Đóng</Button>,
        <Button key="complete" type="primary" onClick={handleComplete}>
          Hoàn tất thanh toán
        </Button>,
      ]}
    >
      {invoiceData ? (
        <div>
          {/* Header khách sạn */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>Khách sạn Robins Villa</div>
              <div style={{ color: '#6b7280' }}>Địa chỉ: Số 1, Đường ABC, Quận XYZ</div>
              <div style={{ color: '#6b7280' }}>Hotline: 1900-xxxx</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div><strong>Hóa đơn:</strong> {invoiceData?.IDHoaDon ?? invoiceData?.idHoaDon}</div>
              <div><strong>Ngày:</strong> {new Date().toLocaleString('vi-VN')}</div>
            </div>
          </div>

          <Descriptions bordered column={2} size="middle">
            <Descriptions.Item label="Khách hàng">
              {invoiceData?.TenKhachHang ?? paymentRow?.TenKhachHang ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Email">
              {invoiceData?.EmailKhachHang ?? paymentRow?.EmailKhachHang ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Mã đặt phòng">
              {invoiceData?.IDDatPhong ?? paymentRow?.IddatPhong ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Nhận phòng">
              {paymentRow?.NgayNhanPhong?.slice(0, 10) ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Trả phòng">
              {paymentRow?.NgayTraPhong?.slice(0, 10) ?? '-'}
            </Descriptions.Item>
              <Descriptions.Item label="Phòng" span={2}>
                {normalized.map((r: any) => (
                  <div key={r.ID}>
                    <strong>{r.TenPhong}</strong> {r.SoPhong && `(Phòng ${r.SoPhong})`}
                  </div>
                ))}
              </Descriptions.Item>
          </Descriptions>

          {/* Bảng phòng */}
          <div style={{ marginTop: 16 }}>
              <Table
              size="small"
              pagination={false}
              dataSource={normalized}
              rowKey="ID"
              columns={[
                {
                  title: 'Phòng',
                  render: (_: any, r: any) => (
                    <div>
                      <div style={{ fontWeight: 600 }}>{r.TenPhong}</div>
                      {r.SoPhong && <div style={{ color: '#64748b' }}>Phòng {r.SoPhong}</div>}
                      {r.hasPromotion && (
                        <Tag color="orange" style={{ marginTop: 4 }}>
                          KHUYẾN MÃI -{r.promoAmount.toLocaleString()} đ
                        </Tag>
                      )}
                    </div>
                  ),
                },
                { title: 'Số đêm', dataIndex: 'SoDem', align: 'center' },
                { title: 'Giá/đêm', dataIndex: 'GiaPhong', align: 'right', render: (v: any) => Number(v ?? 0).toLocaleString() + ' đ' },
                {
                  title: 'Thành tiền',
                  align: 'right',
                  render: (_: any, r: any) => (
                    <div>
                      {r.promoAmount > 0 && (
                        <div style={{ textDecoration: 'line-through', color: '#888' }}>
                          {r.ThanhTien.toLocaleString()} đ
                        </div>
                      )}
                      <strong>{r.discounted.toLocaleString()} đ</strong>
                    </div>
                  ),
                },
              ]}
            />
          </div>

          {/* Dịch vụ */}
          {combinedServices.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h4>Dịch vụ sử dụng</h4>
              <Table
                size="small"
                pagination={false}
                dataSource={combinedServices}
                rowKey={(r: any, i?: number) => String(i ?? 0)}
                columns={[
                  { title: 'Dịch vụ', dataIndex: 'tenDichVu' },
                  { title: 'Đơn giá', dataIndex: 'donGia', align: 'right', render: (v: any) => Number(v ?? 0).toLocaleString() + ' đ' },
                  { title: 'Thành tiền', dataIndex: 'thanhTien', align: 'right', render: (v: any) => Number(v ?? 0).toLocaleString() + ' đ' },
                ]}
              />
            </div>
          )}

          {/* Tổng kết */}
          <div style={{ marginTop: 24, textAlign: 'right' }}>
            <div style={{ width: 400, display: 'inline-block' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16 }}>
                <span>Tổng tiền phòng:</span>
                <strong>{roomTotal.toLocaleString()} đ</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16 }}>
                <span>Tiền dịch vụ:</span>
                <strong>{serviceTotal.toLocaleString()} đ</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16 }}>
                <span>Tạm tính (chưa VAT):</span>
                <strong>{subTotal.toLocaleString()} đ</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16 }}>
                <span>Thuế VAT (10%):</span>
                <strong>{vat.toLocaleString()} đ</strong>
              </div>
              <div style={{ borderTop: '2px solid #000', margin: '12px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 700 }}>
                <span>TỔNG CỘNG:</span>
                <span style={{ color: '#d4380d' }}>{finalTotal.toLocaleString()} đ</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                <span>Tiền cọc:</span>
                <strong>- {deposit.toLocaleString()} đ</strong>
              </div>
              {previousPayment > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Tiền thanh toán trước:</span>
                  <strong>- {previousPayment.toLocaleString()} đ</strong>
                </div>
              )}
              {alreadyPaid > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 600 }}>
                  <span>Đã thanh toán:</span>
                  <strong>- {alreadyPaid.toLocaleString()} đ</strong>
                </div>
              )}
              {needToPay > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, color: '#d4380d', marginTop: 8 }}>
                  <span>KHÁCH CẦN THANH TOÁN:</span>
                  <strong>{needToPay.toLocaleString()} đ</strong>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div>Không có dữ liệu hóa đơn</div>
      )}
    </Modal>
  );
};

export default InvoiceModal;