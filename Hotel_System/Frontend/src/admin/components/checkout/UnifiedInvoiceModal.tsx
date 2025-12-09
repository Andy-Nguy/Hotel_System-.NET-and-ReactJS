import React, { useEffect, useState } from 'react';
import { Modal, Button, Descriptions, Table, Tag, message, Spin, Divider } from 'antd';
import { CheckCircleOutlined, PrinterOutlined } from '@ant-design/icons';
import checkoutApi from '../../../api/checkout.Api';

interface Props {
  visible: boolean;
  invoiceData: any | null;
  paymentRow: any | null;
  selectedServices?: any[];
  servicesTotal?: number;
  onClose: () => void;
  onComplete: (idDatPhong: string) => Promise<void>;
  // Cờ từ parent để đánh dấu trạng thái
  isExtended?: boolean;
  isOverdue?: boolean;
  // Cho ExtendInvoice
  extendData?: any | null;
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

const UnifiedInvoiceModal: React.FC<Props> = ({
  visible,
  invoiceData,
  paymentRow,
  selectedServices = [],
  onClose,
  onComplete,
  isExtended = false,
  isOverdue = false,
  extendData = null,
}) => {
  const [freshInvoice, setFreshInvoice] = useState<any | null>(null);
  const [loadingFresh, setLoadingFresh] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [computedLateFeePreview, setComputedLateFeePreview] = useState<number>(0);
  const [customerInfo, setCustomerInfo] = useState<{ name: string; email: string }>({ name: '', email: '' });
  const [roomInfo, setRoomInfo] = useState<{ tenPhong: string; soPhong: string }>({ tenPhong: '', soPhong: '' });

  // Refresh invoice data khi modal mở
  useEffect(() => {
    let mounted = true;
    const tryRefresh = async () => {
      if (!visible) return;
      
      // Ưu tiên extendData nếu có
      const id = extendData?.IddatPhong ?? extendData?.iddatPhong ?? 
                 invoiceData?.IDDatPhong ?? invoiceData?.idDatPhong ?? 
                 paymentRow?.IddatPhong;
      
      if (!id) return;
      setLoadingFresh(true);
      try {
        const s = await checkoutApi.getSummary(String(id));
        if (mounted && s) {
          setFreshInvoice(s);
          
          // Lấy thông tin khách hàng và phòng
          const name = s?.customer?.name ?? s?.TenKhachHang ?? s?.tenKhachHang ?? 
                       s?.invoices?.[0]?.tenKhachHang ?? s?.invoices?.[0]?.TenKhachHang ?? '';
          const email = s?.customer?.email ?? s?.EmailKhachHang ?? s?.emailKhachHang ?? 
                        s?.invoices?.[0]?.emailKhachHang ?? s?.invoices?.[0]?.EmailKhachHang ?? '';
          setCustomerInfo({ name, email });

          const firstItem = Array.isArray(s?.items) && s.items.length > 0 ? s.items[0] : null;
          const tenPhong = firstItem?.tenPhong ?? firstItem?.TenPhong ?? s?.Room?.tenPhong ?? s?.Room?.TenPhong ?? '';
          const soPhong = firstItem?.soPhong ?? firstItem?.SoPhong ?? s?.Room?.soPhong ?? s?.Room?.SoPhong ?? '';
          if (tenPhong || soPhong) {
            setRoomInfo({ tenPhong, soPhong });
          }
        }
      } catch (e) {
        console.warn('[UnifiedInvoiceModal] failed to refresh summary', e);
      } finally {
        if (mounted) setLoadingFresh(false);
      }
    };
    tryRefresh();
    return () => { mounted = false; };
  }, [visible, invoiceData, paymentRow, extendData]);

  const displayData = freshInvoice || invoiceData || extendData;

  // Nếu là ExtendInvoice mode (có extendData)
  const isExtendInvoiceMode = !!extendData;

  // Helper: normalize Vietnamese text
  const normalizeVN = (s?: string) =>
    (s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

  const extractNotes = (data: any): string[] => {
    const notes: string[] = [];
    const root = data?.GhiChu ?? data?.ghiChu;
    if (root) notes.push(String(root));
    const hdon = data?.HoaDon ?? data?.hoaDon;
    if (hdon?.GhiChu || hdon?.ghiChu) notes.push(String(hdon.GhiChu ?? hdon.ghiChu));
    const inv0 = Array.isArray(data?.invoices) && data.invoices.length > 0 ? data.invoices[0] : null;
    if (inv0?.GhiChu || inv0?.ghiChu) notes.push(String(inv0.GhiChu ?? inv0.ghiChu));
    return notes;
  };

  // Detect extend/overdue từ nhiều nguồn
  const rawNotes = extractNotes(displayData);
  const notes = rawNotes.map(normalizeVN);
  const statusFromData = Number(displayData?.TrangThai ?? paymentRow?.TrangThai ?? 0);
  const isOverdueBooking = isOverdue || statusFromData === 5;
  // Only mark as extended if explicitly flagged OR has extend note AND NOT just an overdue booking
  const hasExtendNote = (isExtended && !isOverdueBooking) || (notes.some((n) => n.includes('gia han')) && !isOverdueBooking);

  // Late fee regex
  const lateFeeRegex = /trả phòng muộn|phí trả phòng muộn|phu.?phi.?tra phong muon/i;

  // Extend duration & percent
  let extendDurationLabel: string | null = null;
  let extendPercent: number | null = null;
  const moneyAny = displayData?.money ?? {};

  const durCandidates = [moneyAny.extendDuration, moneyAny.extendHours, moneyAny.extendHoursLabel, moneyAny.extendTime];
  for (const c of durCandidates) {
    if (c) {
      extendDurationLabel = String(c);
      break;
    }
  }

  const pctCandidates = [moneyAny.extendPercent, moneyAny.extend_pct, moneyAny.extendRate, moneyAny.extendRatePercent];
  for (const p of pctCandidates) {
    if (p !== undefined && p !== null && p !== '') {
      const num = Number(p);
      if (!isNaN(num)) {
        extendPercent = num;
        break;
      }
    }
  }

  if (!extendDurationLabel || extendPercent == null) {
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      if (!extendDurationLabel) {
        const m = n.match(/(\d+)\s*(gio|h|phut|ngay)/i);
        if (m) {
          const unit = m[2];
          const num = m[1];
          extendDurationLabel = `${num} ${unit.replace('gio', 'giờ').replace('phut', 'phút')}`;
        }
      }
      if (extendPercent == null) {
        const m2 = n.match(/(\d+(?:\.\d+)?)\s*%/);
        if (m2) {
          extendPercent = Number(m2[1]);
        } else {
          const m3 = n.match(/(\d+(?:\.\d+)?)\s*phan\s*tram/);
          if (m3) extendPercent = Number(m3[1]);
        }
      }
      if (extendDurationLabel && extendPercent != null) break;
    }
  }

  const handleCompleteClick = async () => {
    const id = displayData?.IDDatPhong ?? displayData?.idDatPhong ?? paymentRow?.IddatPhong;
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

  // ================== TÍNH TOÁN TIỀN ==================

  const srcItems = displayData?.items && Array.isArray(displayData.items) && displayData.items.length > 0
    ? displayData.items
    : paymentRow?.ChiTietDatPhongs ?? [];

  const normalized = (srcItems || []).map((it: any, idx: number) => {
    const rawThanh = Number(it?.ThanhTien ?? it?.thanhTien ?? it?.Tien ?? 0);
    const promo = Number(it?.GiamGia ?? it?.giamGia ?? it?.discount ?? 0) || 0;
    const discounted = Math.max(0, rawThanh - promo);
    return {
      key: String(idx),
      IDPhong: it?.IDPhong ?? it?.idPhong ?? it?.IdPhong ?? it?.Phong?.Idphong ?? it?.SoPhong ?? it?.soPhong ?? null,
      TenPhong: it?.TenPhong ?? it?.tenPhong ?? it?.Phong?.TenPhong ?? '-',
      SoPhong: it?.SoPhong ?? it?.soPhong ?? null,
      SoDem: Number(it?.SoDem ?? it?.soDem ?? 1),
      GiaPhong: Number(it?.GiaPhong ?? it?.giaPhong ?? 0),
      ThanhTien: rawThanh,
      promoAmount: promo,
      discounted,
      hasPromotion: promo > 0,
    };
  });

  const computedRoomTotal = normalized.reduce((s: number, r: any) => s + Number(r.discounted ?? r.ThanhTien ?? 0), 0);

  // Services
  const serverServices = Array.isArray(displayData?.services)
    ? displayData.services.map((s: any) => ({
        tenDichVu: s.tenDichVu ?? s.TenDichVu ?? s.ten ?? '',
        donGia: s.donGia ?? s.DonGia ?? 0,
        thanhTien: Number(s.thanhTien ?? s.ThanhTien ?? (s.donGia ?? 0) * (s.soLuong ?? 1)),
      }))
    : [];

  const clientServices = (selectedServices || []).map((s: any) => ({
    tenDichVu: s.serviceName ?? s.tenDichVu ?? '',
    donGia: s.price ?? s.donGia ?? 0,
    thanhTien: Number(s.price ?? s.donGia ?? 0),
  }));

  const combinedServices = [...serverServices, ...clientServices];

  // Tách late fee từ services (nếu có)
  const canonicalLateFromServer = Number(displayData?.money?.lateFee ?? displayData?.money?.latefee ?? displayData?.lateFee ?? 0) || 0;
  const potentialLateFromServices = combinedServices
    .filter((sv: any) => lateFeeRegex.test(String(sv.tenDichVu ?? '')))
    .reduce((sum: number, sv: any) => sum + Number(sv.thanhTien ?? 0), 0);

  const lateFeeFromLines = potentialLateFromServices;
  const lateFee = canonicalLateFromServer > 0 ? canonicalLateFromServer : (lateFeeFromLines > 0 ? lateFeeFromLines : computedLateFeePreview);

  const displayServices = combinedServices.filter((sv: any) => !lateFeeRegex.test(String(sv.tenDichVu ?? '')));
  const computedServiceTotal = displayServices.reduce((s: number, sv: any) => s + Number(sv.thanhTien ?? 0), 0);

  // Ưu tiên số từ backend
  const money = displayData?.money ?? {};
  const roomTotalSrv = Number(money.roomTotal ?? NaN);
  const serviceTotalSrv = Number(money.serviceTotal ?? NaN);
  const vatSrv = Number(money.vat ?? NaN);
  const totalSrv = Number(money.tongTien ?? NaN);

  const roomTotal = !isNaN(roomTotalSrv) ? roomTotalSrv : computedRoomTotal;
  const serviceTotal = !isNaN(serviceTotalSrv) ? serviceTotalSrv : computedServiceTotal;

  const subTotal = roomTotal + serviceTotal;
  const vat = !isNaN(vatSrv) ? vatSrv : Math.round(subTotal * 0.1);

  // Tổng tiền tốt nhất
  const hoaDonTotal = Number(displayData?.HoaDon?.TongTien ?? displayData?.HoaDon?.tongTien ?? NaN);
  const inv0 = Array.isArray(displayData?.invoices) && displayData.invoices.length > 0 ? displayData.invoices[0] : null;
  const inv0Total = Number(inv0?.TongTien ?? inv0?.tongTien ?? NaN);

  const candidates = [totalSrv, hoaDonTotal, inv0Total].filter((v) => !isNaN(v) && v > 0);
  const bestTotal = candidates.length > 0 ? Math.max(...candidates) : Math.round(subTotal + vat);

  // Extend fee calculation
  // NOTE: Extend fee and late fee are independent. Do NOT subtract late fee when calculating extend fee diff.
  // IMPORTANT: Only calculate extend fee if booking is NOT overdue (late fee and extend fee are separate concepts).
  let extendFee = 0;
  let extendDescription: string | null = null;
  let hasActualExtend = false; // Track if this is a true extension, not just a late fee

  const backendExtendFee = Number(money.extendFee ?? money.extend ?? money.extra ?? money.phiGiaHan ?? money.ExtendFee ?? 0);

  if (backendExtendFee > 0) {
    extendFee = backendExtendFee;
    extendDescription = 'Phí gia hạn (đã gồm VAT)';
    hasActualExtend = true;
  } else if (!isOverdueBooking) {
    // Only calculate extend fee diff if NOT overdue (late fee should not be confused with extend fee)
    const baseTotal = Math.round(subTotal + vat);
    const diff = bestTotal - baseTotal;
    if (diff > 0) {
      extendFee = diff;
      extendDescription = 'Phí gia hạn (đã gồm VAT)';
      hasActualExtend = true;
    }
  }

  if (hasExtendNote && !extendDescription) {
    extendDescription = 'Phí gia hạn (đã gồm VAT)';
    hasActualExtend = true;
  }

  // Final total calculation
  let finalTotal = bestTotal;

  // Nếu là overdue và có late fee, thêm vào tổng
  if (isOverdueBooking && lateFee > 0) {
    // Late fee không tính VAT, cộng trực tiếp
    finalTotal = Math.round(subTotal + vat + lateFee);
  }

  const deposit = Number(money.deposit ?? displayData?.TienCoc ?? 0);
  const paidFromServer = Number(money.paidAmount ?? NaN);
  const paid = !isNaN(paidFromServer) ? paidFromServer : 0;
  
  // Đã thanh toán hiển thị
  const displayedPaid = isOverdueBooking ? Math.max(0, finalTotal - deposit) : paid;
  const needToPay = Math.max(0, finalTotal - paid - deposit);

  // Fetch late fee preview nếu overdue
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!visible || !isOverdueBooking) return;
        const aggregated = lateFeeFromLines ?? 0;
        const serverVal = canonicalLateFromServer ?? 0;
        if (aggregated > 0 || serverVal > 0) return;
        const bookingId = displayData?.IDDatPhong ?? displayData?.idDatPhong ?? paymentRow?.IddatPhong;
        if (!bookingId) return;
        const resp = await fetch(`/api/Checkout/tinh-phu-phi/${bookingId}`);
        if (!mounted || !resp.ok) return;
        const data = await resp.json();
        const amt = Number(data?.surchargeAmount ?? data?.surcharge ?? data?.lateFee ?? 0) || 0;
        if (amt > 0) setComputedLateFeePreview(amt);
      } catch (e) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, [visible, isOverdueBooking, lateFeeFromLines, canonicalLateFromServer, displayData, paymentRow]);

  const invoiceId = getInvoiceId(displayData) ?? '';
  const invoiceDateStr = displayData?.NgayLap 
    ? new Date(displayData.NgayLap).toLocaleString('vi-VN') 
    : (displayData?.ngayLap ? new Date(displayData.ngayLap).toLocaleString('vi-VN') : new Date().toLocaleString('vi-VN'));

  // ExtendInvoice specific data
  const oldCheckout = extendData?.OldCheckout ?? extendData?.oldCheckout;
  const newCheckout = extendData?.NewCheckout ?? extendData?.newCheckout;
  const isRoomChange = extendData?.IsRoomChange ?? extendData?.isRoomChange ?? false;
  const newRoomName = extendData?.NewRoomName ?? extendData?.newRoomName ?? null;
  const paymentMethod = extendData?.PaymentMethod ?? extendData?.paymentMethod;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('vi-VN');
    } catch {
      return dateStr;
    }
  };

  const formatMoney = (amount?: number) => (amount ?? 0).toLocaleString('vi-VN') + ' đ';

  const handlePrint = () => {
    window.print();
  };

  // Modal title
  let modalTitle = `Hóa đơn - ${invoiceId}`;
  let modalIcon = null;
  
  if (isExtendInvoiceMode) {
    modalIcon = <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20 }} />;
    modalTitle = isRoomChange 
      ? 'Hóa đơn đặt phòng mới (Gia hạn + Chuyển phòng)' 
      : 'Hóa đơn gia hạn phòng';
  } else if (isOverdueBooking && lateFee > 0) {
    modalTitle = `Hóa đơn (Có phí trả phòng muộn) - ${invoiceId}`;
  } else if (hasExtendNote) {
    modalTitle = `Hóa đơn (Đã gia hạn) - ${invoiceId}`;
  }

  // Footer buttons
  const footerButtons = isExtendInvoiceMode ? [
    <Button key="print" icon={<PrinterOutlined />} onClick={handlePrint}>
      In hóa đơn
    </Button>,
    <Button key="close" type="primary" onClick={onClose}>
      Đóng
    </Button>,
  ] : [
    <Button key="close" onClick={onClose}>Đóng</Button>,
    <Button key="complete" type="primary" onClick={handleCompleteClick} loading={submitting} disabled={submitting}>
      Hoàn tất trả phòng
    </Button>,
  ];

  // === RENDER EXTEND INVOICE MODE ===
  if (isExtendInvoiceMode) {
    const bookingId = extendData?.IddatPhong ?? extendData?.iddatPhong ?? 
                      invoiceData?.IDDatPhong ?? invoiceData?.idDatPhong;
    
    const hoaDonId = extendData?.HoaDonId ?? extendData?.hoaDonId ?? 
                     (Array.isArray(extendData?.invoices) && extendData.invoices[0]?.idHoaDon) ??
                     (Array.isArray(extendData?.invoices) && extendData.invoices[0]?.IDHoaDon) ?? null;

    const customerName = customerInfo.name || extendData?.customer?.name || 
                        extendData?.TenKhachHang || extendData?.tenKhachHang || 
                        paymentRow?.TenKhachHang || '-';
    
    const customerEmail = customerInfo.email || extendData?.customer?.email || 
                         extendData?.EmailKhachHang || extendData?.email || 
                         paymentRow?.EmailKhachHang || '-';

    const tenPhongGoc = extendData?.TenPhong ?? extendData?.tenPhong ?? 
                       (roomInfo.tenPhong || paymentRow?.TenPhong || '-');
    
    const extractedSoPhong = extendData?.SoPhong ?? extendData?.soPhong ?? 
                            (roomInfo.soPhong || paymentRow?.SoPhong || null);

    const roomDisplayName = newRoomName ?? tenPhongGoc ?? 
                           (extractedSoPhong ? `Phòng ${extractedSoPhong}` : '-');

    const extendFeeAmount = extendData?.ExtendFee ?? extendData?.extendFee ?? 0;
    const extendFeeBeforeDiscount = extendData?.ExtendFeeBeforeDiscount ?? extendData?.extendFeeBeforeDiscount ?? extendFeeAmount;
    const discountAmount = extendData?.DiscountAmount ?? extendData?.discountAmount ?? 0;
    const promotionName = extendData?.PromotionName ?? extendData?.promotionName;
    const promotionType = extendData?.PromotionType ?? extendData?.promotionType;
    const promotionValue = extendData?.PromotionValue ?? extendData?.promotionValue;
    const vatAmount = extendData?.VatAmount ?? extendData?.vatAmount ?? 0;
    const totalExtendFee = extendData?.TotalExtendFee ?? extendData?.totalExtendFee ?? 0;
    const tongTienHoaDonMoi = extendData?.TongTienHoaDonMoi ?? extendData?.tongTienHoaDonMoi ?? 0;
    const extendDescription = extendData?.ExtendDescription ?? extendData?.extendDescription;

    return (
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {modalIcon}
            <span>{modalTitle}</span>
          </div>
        }
        open={visible}
        onCancel={onClose}
        width={600}
        centered
        footer={footerButtons}
      >
        <div style={{ padding: '16px 0' }}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <h2 style={{ margin: 0, color: '#1890ff' }}>ROBINS VILLA</h2>
            <p style={{ margin: '4px 0', color: '#666' }}>Hóa đơn gia hạn phòng</p>
            <Tag color="green">Đã xác nhận</Tag>
          </div>

          <Divider style={{ margin: '16px 0' }} />

          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Mã đặt phòng">
              <strong>{bookingId ?? '-'}</strong>
            </Descriptions.Item>
            <Descriptions.Item label="Mã hóa đơn">
              <strong style={{ color: '#1890ff' }}>{hoaDonId ?? '-'}</strong>
            </Descriptions.Item>
            <Descriptions.Item label="Khách hàng">
              {loadingFresh ? (
                <Spin size="small" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 600 }}>{customerName}</span>
                  <span style={{ color: '#6b7280', fontSize: 12 }}>{customerEmail}</span>
                </div>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Phòng">
              {isRoomChange ? (
                <div>
                  <div style={{ fontWeight: 600, color: '#52c41a' }}>{roomDisplayName}</div>
                  {extractedSoPhong && <div style={{ color: '#64748b' }}>Phòng {extractedSoPhong}</div>}
                  <Tag color="blue" style={{ marginTop: 6 }}>Phòng mới (chuyển)</Tag>
                </div>
              ) : (
                <div>
                  <div style={{ fontWeight: 600 }}>{roomDisplayName}</div>
                  {extractedSoPhong && <div style={{ color: '#64748b' }}>Phòng {extractedSoPhong}</div>}
                </div>
              )}
            </Descriptions.Item>
          </Descriptions>

          <Divider style={{ margin: '16px 0' }}>Chi tiết gia hạn</Divider>

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

          <div style={{ background: '#fafafa', padding: 16, borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span>Phí gia hạn (gốc):</span>
              <span>{formatMoney(extendFeeBeforeDiscount)}</span>
            </div>
            
            {/* Hiển thị khuyến mãi nếu có */}
            {discountAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, color: '#52c41a', fontWeight: 600 }}>
                <span>
                  Khuyến mãi: {promotionName || 'Áp dụng'}
                  {promotionType === 'percent' && promotionValue && <span> ({promotionValue}%)</span>}
                  {promotionType === 'amount' && promotionValue && <span> ({formatMoney(promotionValue)})</span>}
                </span>
                <span>- {formatMoney(discountAmount)}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span>Phí gia hạn (sau khuyến mãi):</span>
              <span><strong>{formatMoney(extendFeeAmount)}</strong></span>
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
                  <span>Tổng tiền (sau gia hạn):</span>
                  <span>{formatMoney(tongTienHoaDonMoi)}</span>
                </div>
              </>
            )}
          </div>

          <div style={{ marginTop: 16, textAlign: 'center' }}>
            {paymentMethod === 1 && (
              <Tag color="green" style={{ fontSize: 14, padding: '4px 12px' }}>
                <CheckCircleOutlined /> Đã thanh toán (Tiền mặt)
              </Tag>
            )}
            {paymentMethod === 2 && (
              <Tag color="green" style={{ fontSize: 14, padding: '4px 12px' }}>
                <CheckCircleOutlined /> Đã thanh toán (QR Code)
              </Tag>
            )}
            {paymentMethod === 3 && (
              <Tag color="blue" style={{ fontSize: 14, padding: '4px 12px' }}>
                Chờ thanh toán (Chuyển khoản)
              </Tag>
            )}
          </div>

          <Divider style={{ margin: '16px 0' }} />
          <div style={{ textAlign: 'center', color: '#666', fontSize: 12 }}>
            <p style={{ margin: 0 }}>Ngày lập: {new Date().toLocaleString('vi-VN')}</p>
            <p style={{ margin: '4px 0 0 0' }}>Cảm ơn quý khách đã sử dụng dịch vụ!</p>
          </div>
        </div>
      </Modal>
    );
  }

  // === RENDER NORMAL/OVERDUE INVOICE MODE ===

  return (
    <Modal
      title={modalTitle}
      open={visible}
      onCancel={onClose}
      width={920}
      centered
      footer={footerButtons}
    >
      {loadingFresh ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin />
        </div>
      ) : displayData ? (
        <div>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>Khách sạn Robins Villa</div>
              <div style={{ color: '#6b7280' }}>Địa chỉ: Số 1, Đường ABC, Quận XYZ</div>
              <div style={{ color: '#6b7280' }}>Hotline: 1900-xxxx</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div><strong>Hóa đơn:</strong> {invoiceId}</div>
              <div><strong>Ngày:</strong> {invoiceDateStr}</div>
              {(hasActualExtend || (hasExtendNote && extendFee > 0)) && (
                <div style={{ marginTop: 12, padding: '8px 12px', background: '#fef3c7', borderRadius: 6 }}>
                  <div style={{ color: '#92400e', fontWeight: 600 }}>⏰ ĐÃ GIA HẠN</div>
                  {extendDurationLabel && (
                    <div style={{ color: '#78350f', fontSize: 13 }}>Thời gian: {extendDurationLabel}</div>
                  )}
                  {extendPercent != null && (
                    <div style={{ color: '#78350f', fontSize: 13 }}>Phí: {extendPercent}%</div>
                  )}
                </div>
              )}
            </div>
          </div>

          <Descriptions bordered column={2} size="middle">
            <Descriptions.Item label="Khách hàng">
              {(customerInfo.name || displayData?.TenKhachHang) ?? paymentRow?.TenKhachHang ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Email">
              {(customerInfo.email || displayData?.EmailKhachHang) ?? paymentRow?.EmailKhachHang ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Mã đặt phòng">
              {displayData?.IDDatPhong ?? displayData?.idDatPhong ?? paymentRow?.IddatPhong ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Nhận phòng">
              {(displayData?.dates?.checkin ?? paymentRow?.NgayNhanPhong)?.toString()?.slice(0, 10) ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Trả phòng">
              {(displayData?.dates?.checkout ?? paymentRow?.NgayTraPhong)?.toString()?.slice(0, 10) ?? '-'}
            </Descriptions.Item>
          </Descriptions>

          {/* Bảng phòng */}
          <div style={{ marginTop: 16 }}>
            <Table
              size="small"
              pagination={false}
              dataSource={normalized}
              rowKey="key"
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
          {displayServices.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h4>Dịch vụ sử dụng</h4>
              <Table
                size="small"
                pagination={false}
                dataSource={displayServices}
                rowKey={(_: any, i?: number) => String(i ?? 0)}
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

              {hasActualExtend && extendFee > 0 && extendDescription && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, marginTop: 8 }}>
                  <span style={{ color: '#d97706' }}>{extendDescription}:</span>
                  <strong style={{ color: '#d97706' }}>+ {extendFee.toLocaleString()} đ</strong>
                </div>
              )}

              {isOverdueBooking && lateFee > 0 && !hasExtendNote && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, marginTop: 8 }}>
                  <span style={{ color: '#d4380d' }}>Phí trả phòng muộn (không VAT):</span>
                  <strong style={{ color: '#d4380d' }}>+ {lateFee.toLocaleString()} đ</strong>
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

              {needToPay > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: '1px dashed #ccc' }}>
                  <span style={{ fontSize: 18, fontWeight: 600 }}>Cần thanh toán:</span>
                  <strong style={{ fontSize: 18, color: '#d4380d' }}>{needToPay.toLocaleString()} đ</strong>
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

export default UnifiedInvoiceModal;
