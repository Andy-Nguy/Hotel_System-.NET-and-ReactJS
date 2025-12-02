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
  const direct = data.IDHoaDon ?? data.IdHoaDon ?? data.IdhoaDon ?? data.idHoaDon ?? data.id ?? data.ID;
  if (direct) return String(direct);
  const hoaDon = data.HoaDon ?? data.hoaDon;
  if (hoaDon) {
    const fromHoaDon = hoaDon.IDHoaDon ?? hoaDon.IdHoaDon ?? hoaDon.IdhoaDon ?? hoaDon.idHoaDon ?? hoaDon.id ?? hoaDon.ID;
    if (fromHoaDon) return String(fromHoaDon);
  }
  const inv0 = Array.isArray(data.invoices) && data.invoices.length > 0 ? data.invoices[0] : null;
  if (inv0) {
    const fromInv = inv0.IDHoaDon ?? inv0.IdHoaDon ?? inv0.IdhoaDon ?? inv0.idHoaDon ?? inv0.id ?? inv0.ID;
    if (fromInv) return String(fromInv);
  }
  return null;
};

const InvoiceModalWithLateFee: React.FC<Props> = ({
  visible,
  invoiceData,
  paymentRow,
  selectedServices = [],
  onClose,
  onComplete,
}) => {
  const [mergedInvoice, setMergedInvoice] = useState<any | null>(invoiceData);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setMergedInvoice(invoiceData);
    if (!invoiceData) return;
    const hasCustomer = invoiceData?.TenKhachHang || invoiceData?.EmailKhachHang || invoiceData?.IDDatPhong || invoiceData?.idDatPhong;
    if (hasCustomer) return;
    const possibleId = invoiceData?.IDDatPhong ?? invoiceData?.idDatPhong ?? invoiceData?.hoaDon?.idDatPhong ?? invoiceData?.hoaDon?.IDDatPhong ?? invoiceData?.hoaDon?.iddatPhong ?? null;
    if (!possibleId) return;
    let cancelled = false;
    (async () => {
      try {
        const sum = await checkoutApi.getSummary(possibleId);
        if (cancelled) return;
        setMergedInvoice({ ...(invoiceData || {}), ...(sum || {}) });
      } catch (e) {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [invoiceData]);

  const data = mergedInvoice ?? invoiceData ?? paymentRow ?? {};

  const srcItems = (data?.items && Array.isArray(data.items) && data.items.length > 0) ? data.items : (paymentRow?.ChiTietDatPhongs ?? []);

  const normalized = (srcItems || []).map((it: any) => {
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

  const roomTotal = normalized.reduce((s: number, r: any) => s + Number(r.discounted ?? r.ThanhTien ?? 0), 0);

  const serverServices: any[] = Array.isArray(data?.services)
    ? data.services.map((s: any) => ({
        tenDichVu: s.tenDichVu ?? s.TenDichVu ?? s.ten ?? '',
        donGia: s.donGia ?? s.DonGia ?? 0,
        thanhTien: Number(s.thanhTien ?? s.ThanhTien ?? (s.donGia ?? 0) * (s.soLuong ?? 1)),
      })) as any[]
    : [];

  const clientServices: any[] = (selectedServices || []).map((s: any) => ({
    tenDichVu: s.serviceName ?? s.tenDichVu ?? '',
    donGia: s.price ?? s.donGia ?? 0,
    thanhTien: Number(s.price ?? s.donGia ?? 0),
  }));

  const combinedServices: any[] = [...serverServices, ...clientServices];

  // Overdue detection (original source)
  const isOverdueBooking = Number(data?.TrangThai ?? paymentRow?.TrangThai ?? 0) === 5;

  // Late fee detection (regex) - preserve existing naming patterns
  const lateFeeRegex = /trả phòng muộn|phí trả phòng muộn|phu.?phi.?tra phong muon/i;

  // Prefer canonical server-provided value when available
  const canonicalLateFromServer = Number(data?.money?.lateFee ?? data?.money?.latefee ?? data?.lateFee ?? 0) || 0;

  // Compute late-fee from service lines as a fallback (or explicit persisted service)
  const potentialLateFromServices = combinedServices
    .filter((sv: any) => lateFeeRegex.test(String(sv.tenDichVu ?? '')))
    .reduce((sum: number, sv: any) => sum + Number(sv.thanhTien ?? 0), 0);

  // Final computed late fee: prefer server canonical value, otherwise use detected service lines
  // Local computed late fee (preview) — may be fetched from backend when needed
  const [computedLateFeePreview, setComputedLateFeePreview] = useState<number>(0);

  const lateFeeFromLines = potentialLateFromServices;

  // Final late fee used for display: prefer server, then persisted service lines, then preview
  const lateFee = canonicalLateFromServer > 0 ? canonicalLateFromServer : (lateFeeFromLines > 0 ? lateFeeFromLines : computedLateFeePreview);

  const displayServices: any[] = combinedServices.filter((sv: any) => !lateFeeRegex.test(String(sv.tenDichVu ?? '')));
  const serviceTotal = displayServices.reduce((s: number, sv: any) => s + Number((sv as any).thanhTien ?? 0), 0);

  const subTotal = roomTotal + serviceTotal; // before VAT
  
  // Phí trả phòng muộn KHÔNG tính VAT (là phí phạt)
  // Công thức: TongTien = (room + service) * 1.1 + lateFee
  const vat = Math.round(subTotal * 0.1);
  
  // Tổng cộng = (tiền phòng + dịch vụ) * 1.1 + phí trả muộn (không VAT)
  let finalTotal = Math.round(subTotal + vat + (isOverdueBooking ? lateFee : 0));

  const deposit = Number(data?.money?.deposit ?? data?.TienCoc ?? 0);
  
  // Đã thanh toán luôn luôn = TỔNG CỘNG - Tiền cọc
  const displayedPaid = Math.max(0, finalTotal - deposit);

  const invoiceId = getInvoiceId(data) ?? data?.IDHoaDon ?? data?.idHoaDon ?? '';
  const invoiceDateStr = data?.NgayLap ? new Date(data.NgayLap).toLocaleString('vi-VN') : (data?.ngayLap ? new Date(data.ngayLap).toLocaleString('vi-VN') : new Date().toLocaleString('vi-VN'));

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

  // If overdue and no persisted late-fee line and no server late fee, fetch preview
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!visible) return;
        if (!isOverdueBooking) return;
        const aggregated = lateFeeFromLines ?? 0;
        const serverVal = canonicalLateFromServer ?? 0;
        if (aggregated > 0 || serverVal > 0) return; // already have a value
        const bookingId = (mergedInvoice ?? invoiceData ?? paymentRow)?.IDDatPhong ?? (mergedInvoice ?? invoiceData ?? paymentRow)?.idDatPhong ?? paymentRow?.IddatPhong;
        if (!bookingId) return;
        const resp = await fetch(`/api/Checkout/tinh-phu-phi/${bookingId}`);
        if (!mounted) return;
        if (!resp.ok) return;
        const data = await resp.json();
        const amt = Number(data?.surchargeAmount ?? data?.surcharge ?? data?.lateFee ?? 0) || 0;
        if (amt > 0) setComputedLateFeePreview(amt);
      } catch (e) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, isOverdueBooking, lateFeeFromLines, canonicalLateFromServer, invoiceData, mergedInvoice, paymentRow]);

  return (
    <Modal
      title={data ? `Hóa đơn${isOverdueBooking && lateFee > 0 ? ' (Có phí trả phòng muộn)' : ''} - ${invoiceId}` : 'Hóa đơn'}
      open={visible}
      onCancel={onClose}
      width={920}
      centered
      footer={[
        <Button key="close" onClick={onClose}>Đóng</Button>,
        <Button key="complete" type="primary" onClick={handleCompleteClick} loading={submitting} disabled={submitting}>
          Hoàn tất trả phòng
        </Button>,
      ]}
    >
      {data ? (
        <div>
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
            <Descriptions.Item label="Khách hàng">{data?.TenKhachHang ?? data?.customer?.name ?? paymentRow?.TenKhachHang ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="Email">{data?.EmailKhachHang ?? data?.customer?.email ?? paymentRow?.EmailKhachHang ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="Mã đặt phòng">{data?.IDDatPhong ?? data?.idDatPhong ?? paymentRow?.IddatPhong ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="Nhận phòng">{(data?.dates?.checkin ?? paymentRow?.NgayNhanPhong)?.toString()?.slice(0, 10) ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="Trả phòng">{(data?.dates?.checkout ?? paymentRow?.NgayTraPhong)?.toString()?.slice(0, 10) ?? '-'}</Descriptions.Item>
          </Descriptions>

          <div style={{ marginTop: 16 }}>
            <Table
              size="small"
              pagination={false}
              dataSource={normalized}
              rowKey={(r: any) => String(r.IDPhong ?? r.TenPhong ?? Math.random())}
              columns={[
                {
                  title: 'Phòng',
                  render: (_: any, r: any) => (
                    <div>
                      <div style={{ fontWeight: 600 }}>{r.TenPhong}</div>
                      {r.SoPhong && <div style={{ color: '#64748b' }}>Phòng {r.SoPhong}</div>}
                      {r.hasPromotion && <Tag color="orange" style={{ marginTop: 4 }}>KHUYẾN MÃI -{r.promoAmount.toLocaleString()} đ</Tag>}
                    </div>
                  ),
                },
                { title: 'Số đêm', dataIndex: 'SoDem', align: 'center' },
                { title: 'Giá/đêm', dataIndex: 'GiaPhong', align: 'right', render: (v: any) => Number(v ?? 0).toLocaleString() + ' đ' },
                { title: 'Thành tiền', align: 'right', render: (_: any, r: any) => (
                  <div>
                    {r.promoAmount > 0 && <div style={{ textDecoration: 'line-through', color: '#888' }}>{r.ThanhTien.toLocaleString()} đ</div>}
                    <strong>{r.discounted.toLocaleString()} đ</strong>
                  </div>
                )},
              ]}
            />
          </div>

          {displayServices.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h4>Dịch vụ sử dụng</h4>
              <Table
                size="small"
                pagination={false}
                dataSource={displayServices}
                rowKey={(r: any, i?: number) => String(i ?? 0)}
                columns={[
                  { title: 'Dịch vụ', dataIndex: 'tenDichVu' },
                  { title: 'Đơn giá', dataIndex: 'donGia', align: 'right', render: (v: any) => Number(v ?? 0).toLocaleString() + ' đ' },
                  { title: 'Thành tiền', dataIndex: 'thanhTien', align: 'right', render: (v: any) => Number(v ?? 0).toLocaleString() + ' đ' },
                ]}
              />
            </div>
          )}

          <div style={{ marginTop: 24, textAlign: 'right' }}>
            <div style={{ width: 420, display: 'inline-block' }}>
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

              {isOverdueBooking && lateFee > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, marginTop: 8 }}>
                  <span style={{ color: '#d4380d' }}>Phí trả phòng muộn (không VAT):</span>
                  <strong style={{ color: '#d4380d' }}>+ {Number(lateFee).toLocaleString()} đ</strong>
                </div>
              )}

              <div style={{ borderTop: '2px solid #000', margin: '12px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 700 }}>
                <span>TỔNG CỘNG:</span>
                <span style={{ color: '#d4380d' }}>{finalTotal.toLocaleString()} đ</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                <span>Tiền cọc:</span>
                <strong>- {deposit.toLocaleString()} đ</strong>
              </div>

              {displayedPaid > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                  <span>Đã thanh toán:</span>
                  <strong>{displayedPaid.toLocaleString()} đ</strong>
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

export default InvoiceModalWithLateFee;
