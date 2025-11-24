// src/components/checkout/InvoiceModal.tsx
import React, { useEffect, useState } from 'react';
import { Modal, Button, Descriptions, Table, Tag, message } from 'antd';
import checkoutApi from '../../../api/checkout.Api';

interface Props {
  visible: boolean;
  invoiceData: any | null;
  paymentRow: any | null;
  selectedServices?: any[];
  servicesTotal?: number;
  onClose: () => void;
  onComplete: (idDatPhong: string) => Promise<void>;
}
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
const InvoiceModal: React.FC<Props> = ({
  visible,
  invoiceData,
  paymentRow,
  selectedServices = [],
  onClose,
  onComplete,
}) => {
  const handleComplete = async () => {
    const id = (mergedInvoice ?? invoiceData ?? paymentRow)?.IDDatPhong ?? (mergedInvoice ?? invoiceData ?? paymentRow)?.idDatPhong ?? paymentRow?.IddatPhong;
    if (!id) return message.error('Không xác định được mã đặt phòng');
    await onComplete(String(id));
  };

  const [submitting, setSubmitting] = useState(false);

  const handleCompleteClick = async () => {
    const id = (mergedInvoice ?? invoiceData ?? paymentRow)?.IDDatPhong ?? (mergedInvoice ?? invoiceData ?? paymentRow)?.idDatPhong ?? paymentRow?.IddatPhong;
    if (!id) return message.error('Không xác định được mã đặt phòng');
    try {
      setSubmitting(true);
      await onComplete(String(id));
    } catch (err: any) {
      message.error(err?.message || 'Hoàn tất thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  // === CHỈ THAY ĐOẠN NÀY – TÍNH ĐÚNG, KHÔNG VAT ===
    // Merge invoiceData with server summary when invoice lacks booking/customer info
    const [mergedInvoice, setMergedInvoice] = useState<any | null>(invoiceData);

    useEffect(() => {
      setMergedInvoice(invoiceData);
      if (!invoiceData) return;
      // If invoice doesn't include basic booking/customer fields, try fetching summary by booking id
      const hasCustomer = invoiceData?.TenKhachHang || invoiceData?.EmailKhachHang || invoiceData?.IDDatPhong || invoiceData?.idDatPhong;
      if (hasCustomer) return;
      // try to extract booking id from invoice payload (various shapes)
      const possibleId = invoiceData?.IDDatPhong ?? invoiceData?.idDatPhong ?? invoiceData?.idDatPhong ?? invoiceData?.hoaDon?.idDatPhong ?? invoiceData?.hoaDon?.IDDatPhong ?? invoiceData?.hoaDon?.iddatPhong ?? null;
      if (!possibleId) return;
      let cancelled = false;
      (async () => {
        try {
          const sum = await checkoutApi.getSummary(possibleId);
          if (cancelled) return;
          // merge: prefer fields from invoiceData, but fill missing pieces from summary
          const merged = { ...(invoiceData || {}), ...(sum || {}) };
          setMergedInvoice(merged);
        } catch (e) {
          // ignore
        }
      })();
      return () => { cancelled = true; };
    }, [invoiceData]);

    const data = mergedInvoice ?? invoiceData ?? paymentRow ?? {};

    const srcItems = (data?.items && Array.isArray(data.items) && data.items.length > 0)
      ? data.items
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

  // Dịch vụ từ server (từ merged data)
  const serverServices = Array.isArray(data?.services)
    ? data.services.map((s: any) => ({
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
  const finalTotal = Math.round(subTotal + vat);

  // Tiền cọc (ưu tiên giá trị server)
  const deposit = Number(data?.money?.deposit ?? data?.TienCoc ?? 0);

  // Lấy số tiền đã thanh toán từ server (hoaDon.TienThanhToan hoặc money.paidAmount)
  const dbPaid = Number(data?.money?.paidAmount ?? data?.tienThanhToan ?? data?.TienThanhToan ?? 0);
  // Đã thanh toán là giá trị thực tế từ DB
  const paid = Math.max(0, dbPaid);

  // Số tiền còn phải thanh toán = Tổng cộng - Đã thanh toán
  const needToPay = Math.max(0, finalTotal - paid);
  // ========================================

  const invoiceId = getInvoiceId(data) ?? data?.IDHoaDon ?? data?.idHoaDon ?? '';
  const invoiceDateStr = data?.NgayLap ? new Date(data.NgayLap).toLocaleString('vi-VN') : (data?.ngayLap ? new Date(data.ngayLap).toLocaleString('vi-VN') : new Date().toLocaleString('vi-VN'));

  return (
    <Modal
      title={data ? `Hóa đơn - ${invoiceId}` : 'Hóa đơn'}
      open={visible}
      onCancel={onClose}
      width={900}
      centered
      footer={[
        <Button key="close" onClick={onClose}>Đóng</Button>,
        <Button key="complete" type="primary" onClick={handleCompleteClick} loading={submitting} disabled={submitting}>
          Hoàn tất trả phòng
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
                <div><strong>Hóa đơn:</strong> {invoiceId}</div>
                <div><strong>Ngày:</strong> {invoiceDateStr}</div>
            </div>
          </div>

          <Descriptions bordered column={2} size="middle">
            <Descriptions.Item label="Khách hàng">
              {data?.TenKhachHang ?? data?.customer?.name ?? paymentRow?.TenKhachHang ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Email">
              {data?.EmailKhachHang ?? data?.customer?.email ?? paymentRow?.EmailKhachHang ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Mã đặt phòng">
              {data?.IDDatPhong ?? data?.idDatPhong ?? data?.idDatPhong ?? paymentRow?.IddatPhong ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Nhận phòng">
              {(data?.dates?.checkin ?? paymentRow?.NgayNhanPhong)?.toString()?.slice(0, 10) ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Trả phòng">
              {(data?.dates?.checkout ?? paymentRow?.NgayTraPhong)?.toString()?.slice(0, 10) ?? '-'}
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
              {paid > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                  <span>Đã thanh toán:</span>
                  <strong>- {paid.toLocaleString()} đ</strong>
                </div>
              )}
              {needToPay > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                  <span style={{ fontSize: 16 }}>Còn phải thanh toán:</span>
                  <strong style={{ color: '#d4380d', fontSize: 16 }}>{needToPay.toLocaleString()} đ</strong>
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