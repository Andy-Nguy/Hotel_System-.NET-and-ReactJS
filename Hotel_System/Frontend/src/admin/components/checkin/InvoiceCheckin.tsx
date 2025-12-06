// src/components/checkout/InvoiceModal.tsx
import React from 'react';
import { Modal, Button, message } from 'antd';

interface Props {
  visible: boolean;
  invoiceData: any | null;
  paymentRow: any | null;
  selectedServices?: any[];
  servicesTotal?: number;
  onClose: () => void;
  onComplete: (idDatPhong: string) => Promise<void>;
}
// Lấy mã hóa đơn từ nhiều cấu trúc khác nhau
const getInvoiceId = (data: any): string | null => {
  if (!data) return null;

  // 1. Trên root
  const direct =
    data.IDHoaDon ??
    data.IdHoaDon ??
    data.IdhoaDon ??
    data.idHoaDon ??
    data.id ??
    data.ID;
  if (direct) return String(direct);

  // 2. Trong thuộc tính HoaDon (nếu có)
  const hoaDon = data.HoaDon ?? data.hoaDon;
  if (hoaDon) {
    const fromHoaDon =
      hoaDon.IDHoaDon ??
      hoaDon.IdHoaDon ??
      hoaDon.IdhoaDon ??
      hoaDon.idHoaDon ??
      hoaDon.id ??
      hoaDon.ID;
    if (fromHoaDon) return String(fromHoaDon);
  }

  // 3. Trong mảng invoices[0] (nếu có)
  const inv0 =
    Array.isArray(data.invoices) && data.invoices.length > 0
      ? data.invoices[0]
      : null;
  if (inv0) {
    const fromInv =
      inv0.IDHoaDon ??
      inv0.IdHoaDon ??
      inv0.IdhoaDon ??
      inv0.idHoaDon ??
      inv0.id ??
      inv0.ID;
    if (fromInv) return String(fromInv);
  }

  return null;
};
const InvoiceCheckin: React.FC<Props> = ({
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

  // Robust extraction of invoice/booking/customer fields (use server-provided values when available)
    const invoiceId = getInvoiceId(invoiceData);
  const rawInvoiceDate = invoiceData?.NgayLap ?? invoiceData?.NgayLap ?? invoiceData?.invoices?.[0]?.NgayLap ?? invoiceData?.invoices?.[0]?.ngayLap ?? invoiceData?.HoaDon?.NgayLap ?? null;
  const invoiceDateStr = rawInvoiceDate ? (() => {
    try { return new Date(rawInvoiceDate).toLocaleString('vi-VN'); } catch { return String(rawInvoiceDate); }
  })() : new Date().toLocaleString('vi-VN');

  const customerName = invoiceData?.customer?.name ?? invoiceData?.TenKhachHang ?? invoiceData?.HoTen ?? paymentRow?.TenKhachHang ?? '-';
  const customerEmail = invoiceData?.customer?.email ?? invoiceData?.EmailKhachHang ?? paymentRow?.EmailKhachHang ?? '-';
  const bookingId = invoiceData?.IDDatPhong ?? invoiceData?.idDatPhong ?? paymentRow?.IddatPhong ?? '-';
  const checkinDate = invoiceData?.dates?.checkin ?? paymentRow?.NgayNhanPhong ?? '-';
  const checkoutDate = invoiceData?.dates?.checkout ?? paymentRow?.NgayTraPhong ?? '-';

  // === CHỈ THAY ĐOẠN NÀY – TÍNH ĐÚNG, KHÔNG VAT ===
  const srcItems = (invoiceData?.items && Array.isArray(invoiceData.items) && invoiceData.items.length > 0)
    ? invoiceData.items
    : (paymentRow?.ChiTietDatPhongs ?? []);

  const normalized = (srcItems || []).map((it: any, idx: number) => {
    const rawThanh = Number(it?.ThanhTien ?? it?.thanhTien ?? it?.Tien ?? 0);
    const promo = Number(it?.GiamGia ?? it?.giamGia ?? it?.discount ?? 0) || 0;
    const discounted = Math.max(0, rawThanh - promo);
    return {
      IDPhong: it?.IDPhong ?? it?.idPhong ?? it?.IdPhong ?? it?.Phong?.Idphong ?? it?.SoPhong ?? it?.soPhong ?? null,
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

  // ===== KIỂM TRA CÓ GIA HẠN KHÔNG =====
  // Nếu có gia hạn (GhiChu chứa "Gia hạn" hoặc "gia hạn"), lấy TongTien từ server
  const ghiChu = invoiceData?.GhiChu ?? invoiceData?.ghiChu ?? 
                 invoiceData?.invoices?.[0]?.GhiChu ?? invoiceData?.invoices?.[0]?.ghiChu ?? 
                 invoiceData?.HoaDon?.GhiChu ?? '';
  const hasExtendFee = typeof ghiChu === 'string' && 
                       (ghiChu.toLowerCase().includes('gia hạn') || ghiChu.toLowerCase().includes('gia han'));

  // Lấy TongTien từ server (đã bao gồm phí gia hạn nếu có)
  const serverTongTien = Number(
    invoiceData?.TongTien ?? invoiceData?.tongTien ?? 
    invoiceData?.invoices?.[0]?.TongTien ?? invoiceData?.invoices?.[0]?.tongTien ??
    invoiceData?.HoaDon?.TongTien ?? invoiceData?.HoaDon?.tongTien ??
    invoiceData?.money?.total ??
    paymentRow?.TongTien ?? 0
  );

  // TỔNG CUỐI CỦA KHÁCH
  let finalTotal: number;
  let subTotal: number;
  let vat: number;

  if (hasExtendFee && serverTongTien > 0) {
    // Nếu có gia hạn, dùng TongTien từ server (đã bao gồm VAT và phí gia hạn)
    finalTotal = Math.round(serverTongTien);
    // Tính ngược lại subTotal và VAT từ finalTotal
    subTotal = Math.round(finalTotal / 1.1);
    vat = finalTotal - subTotal;
  } else {
    // Không có gia hạn, tính bình thường
    subTotal = roomTotal + serviceTotal; // trước VAT
    vat = Math.round(subTotal * 0.1);
    finalTotal = Math.round(subTotal + vat); // TỔNG CỘNG toàn bộ (gồm VAT)
  }

  // Tiền cọc
  const deposit = Number(invoiceData?.money?.deposit ?? invoiceData?.TienCoc ?? 0);

  // Tiền thanh toán trước (nếu khách đã thanh toán từng phần trước check-in)
  const previousPayment = Number(invoiceData?.money?.previousPayment ?? invoiceData?.TienThanhToan ?? paymentRow?.TienThanhToan ?? 0);

  // Đã thanh toán = Tiền cọc + Tiền thanh toán trước
  const alreadyPaid = Math.max(0, deposit + previousPayment);

  // Khách cần thanh toán = TỔNG CỘNG - Đã thanh toán
  const needToPay = Math.max(0, finalTotal - alreadyPaid);
  // ========================================

  // Determine if the invoice/row is already fully paid (server uses 2 = fully paid)
  const isPaid = [
    invoiceData?.TrangThaiThanhToan,
    invoiceData?.trangThaiThanhToan,
    paymentRow?.TrangThaiThanhToan,
    paymentRow?.trangThaiThanhToan,
  ].some((v) => Number(v) === 2);

  return (
    <Modal
      title="Thanh toán"
      open={visible}
      onCancel={onClose}
      width={500}
      centered
      footer={[
        <Button key="close" onClick={onClose}>Đóng</Button>,
        // Hide the confirm button when the invoice/row is already marked as paid
        !isPaid && (
          <Button key="complete" type="primary" onClick={handleComplete}>
            Hoàn tất thanh toán
          </Button>
        ),
      ]}
    >
      {invoiceData ? (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          {/* Icon thành công */}
          <div style={{ 
            width: 80, 
            height: 80, 
            borderRadius: '50%', 
            background: '#52c41a', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            margin: '0 auto 24px'
          }}>
            <span style={{ fontSize: 40, color: '#fff' }}>✓</span>
          </div>

          {/* Thông báo chính */}
          <div style={{ fontSize: 24, fontWeight: 700, color: '#1f2937', marginBottom: 16 }}>
            Thanh toán thành công
          </div>

          {/* Số tiền vừa thanh toán (needToPay - số tiền khách cần trả, sẽ được cộng dồn vào TienThanhToan) */}
          <div style={{ 
            fontSize: 32, 
            fontWeight: 700, 
            color: '#52c41a',
            marginBottom: 24
          }}>
            🟢 Đã thanh toán {needToPay.toLocaleString()}đ
          </div>

          {/* Thông tin phụ */}
          <div style={{ 
            background: '#f0f9ff', 
            borderRadius: 8, 
            padding: '16px 24px',
            marginBottom: 16
          }}>
            <div style={{ color: '#0369a1', fontSize: 16 }}>
              <strong>Mã đặt phòng:</strong> {bookingId}
            </div>
            <div style={{ color: '#0369a1', fontSize: 16, marginTop: 8 }}>
              <strong>Khách hàng:</strong> {customerName}
            </div>
          </div>

          {/* Trạng thái lưu trú */}
          <div style={{ 
            fontSize: 16, 
            color: '#059669',
            fontWeight: 500
          }}>
            ✨ Lưu trú vẫn tiếp tục
          </div>

          {/* Ghi chú nếu có gia hạn */}
          {hasExtendFee && (
            <div style={{ 
              marginTop: 16,
              padding: '8px 16px',
              background: '#fef3c7',
              borderRadius: 6,
              color: '#92400e',
              fontSize: 14
            }}>
              📌 Đã bao gồm phí gia hạn
            </div>
          )}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6b7280' }}>
          Không có dữ liệu hóa đơn
        </div>
      )}
    </Modal>
  );
};

export default InvoiceCheckin;