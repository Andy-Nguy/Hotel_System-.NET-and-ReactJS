import React, { useEffect, useState } from 'react';

import { Modal, Button, Descriptions, Table, Tag, message, Spin } from 'antd';

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

const InvoiceModal: React.FC<Props> = ({
  visible,
  invoiceData,
  paymentRow,
  selectedServices = [],
  onClose,
  onComplete,
}) => {
  const [freshInvoice, setFreshInvoice] = useState<any | null>(null);
  const [loadingFresh, setLoadingFresh] = useState(false);

  // Khi modal mở, luôn cố gắng lấy summary/invoice mới nhất từ server
  useEffect(() => {
    let mounted = true;
    const tryRefresh = async () => {
      if (!visible) return;
      const id =
        invoiceData?.IDDatPhong ??
        invoiceData?.idDatPhong ??
        paymentRow?.IddatPhong;
      if (!id) return;
      setLoadingFresh(true);
      try {
        const s = await checkoutApi.getSummary(String(id));
        if (mounted && s) setFreshInvoice(s);
      } catch (e) {
        console.warn('[InvoiceModal] failed to refresh summary', e);
      } finally {
        if (mounted) setLoadingFresh(false);
      }
    };
    tryRefresh();
    return () => {
      mounted = false;
    };
  }, [visible, invoiceData, paymentRow]);

  const displayData = freshInvoice || invoiceData;

  // Helper: bỏ dấu & lowercase để nhận diện "gia hạn" an toàn
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

  // Nhận diện có ghi chú "gia hạn"
  const rawNotes = extractNotes(displayData);
  const notes = rawNotes.map(normalizeVN);
  const hasExtendNote = notes.some((n) => n.includes('gia han'));

  // Thử tách thời gian gia hạn và phần trăm (nếu có) từ money hoặc ghi chú
  let extendDurationLabel: string | null = null;
  let extendPercent: number | null = null;
  const moneyAny = displayData?.money ?? {};
  // Direct money fields (possible names)
  const durCandidates = [
    moneyAny.extendDuration,
    moneyAny.extendHours,
    moneyAny.extendHoursLabel,
    moneyAny.extendTime,
  ];
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

  // Nếu chưa có, dò trong ghi chú (dùng normalized notes để tìm từ khóa không dấu)
  if (!extendDurationLabel || !extendPercent) {
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      // thời gian: số + (gio|phut|ngay)
      if (!extendDurationLabel) {
        const m = n.match(/(\d+)\s*(gio|h|phut|ngay)/i);
        if (m) {
          const unit = m[2];
          const num = m[1];
          extendDurationLabel = `${num} ${unit.replace('gio', 'giờ').replace('phut', 'phút')}`;
        }
      }
      // phần trăm: 10% hoặc 10 phan tram
      if (!extendPercent) {
        const m2 = n.match(/(\d+(?:\.\d+)?)\s*%/);
        if (m2) {
          extendPercent = Number(m2[1]);
        } else {
          const m3 = n.match(/(\d+(?:\.\d+)?)\s*phan\s*tram/);
          if (m3) extendPercent = Number(m3[1]);
        }
      }
      if (extendDurationLabel && extendPercent) break;
    }
  }

  // Lấy ID hóa đơn từ nhiều dạng dữ liệu khác nhau
  const invoiceId =
    displayData?.IDHoaDon ??
    displayData?.idHoaDon ??
    displayData?.HoaDon?.IDHoaDon ??
    displayData?.HoaDon?.idHoaDon ??
    displayData?.HoaDon?.IdhoaDon ??
    displayData?.invoices?.[0]?.IDHoaDon ??
    displayData?.invoices?.[0]?.IdHoaDon ??
    displayData?.invoices?.[0]?.IdhoaDon ??
    displayData?.invoices?.[0]?.idHoaDon ??
    displayData?.invoices?.[0]?.id ??
    null;

  const handleComplete = async () => {
    const id =
      displayData?.IDDatPhong ??
      displayData?.idDatPhong ??
      paymentRow?.IddatPhong;
    if (!id) return message.error('Không xác định được mã đặt phòng');
    await onComplete(String(id));
  };

  // ================== TÍNH TOÁN TIỀN ==================

  // 1) Dòng phòng từ displayData hoặc fallback paymentRow.ChiTietDatPhongs
  const srcItems =
    displayData?.items && Array.isArray(displayData.items) && displayData.items.length > 0
      ? displayData.items
      : paymentRow?.ChiTietDatPhongs ?? [];

  const normalized = (srcItems || []).map((it: any, idx: number) => {
    const rawThanh = Number(it?.ThanhTien ?? it?.thanhTien ?? it?.Tien ?? 0);
    const promo = Number(it?.GiamGia ?? it?.giamGia ?? it?.discount ?? 0) || 0;
    const discounted = Math.max(0, rawThanh - promo);
    return {
      key: String(idx),
      IDPhong:
        it?.IDPhong ??
        it?.idPhong ??
        it?.IdPhong ??
        it?.Phong?.Idphong ??
        it?.SoPhong ??
        it?.soPhong ??
        null,
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

  // Tiền phòng & dịch vụ tự tính từ FE (fallback)
  const computedRoomTotal = normalized.reduce(
    (s: number, r: any) => s + Number(r.discounted ?? r.ThanhTien ?? 0),
    0
  );

  // 2) Dịch vụ từ server
  const serverServices = Array.isArray(displayData?.services)
    ? displayData.services.map((s: any) => ({
        tenDichVu: s.tenDichVu ?? s.TenDichVu ?? s.ten ?? '',
        donGia: s.donGia ?? s.DonGia ?? 0,
        thanhTien: Number(
          s.thanhTien ??
            s.ThanhTien ??
            (s.donGia ?? 0) * (s.soLuong ?? 1)
        ),
      }))
    : [];

  // Dịch vụ mới thêm ở client (nếu có)
  const clientServices = (selectedServices || []).map((s: any) => ({
    tenDichVu: s.serviceName ?? s.tenDichVu ?? '',
    donGia: s.price ?? s.donGia ?? 0,
    thanhTien: Number(s.price ?? s.donGia ?? 0),
  }));

  const combinedServices = [...serverServices, ...clientServices];
  const computedServiceTotal = combinedServices.reduce(
    (s: number, sv: any) => s + Number(sv.thanhTien ?? 0),
    0
  );

  // 3) ƯU TIÊN DÙNG SỐ TỪ BACKEND
  const money = displayData?.money ?? {};
  const roomTotalSrv = Number(money.roomTotal ?? NaN);
  const serviceTotalSrv = Number(money.serviceTotal ?? NaN);
  const vatSrv = Number(money.vat ?? NaN);
  const totalSrv = Number(money.tongTien ?? NaN);
  const lateFeeSrv = Number(money.lateFee ?? 0); // phí trả phòng muộn (nếu có, thường chỉ ở overdue modal)

  const roomTotal = !isNaN(roomTotalSrv) ? roomTotalSrv : computedRoomTotal;
  const serviceTotal = !isNaN(serviceTotalSrv) ? serviceTotalSrv : computedServiceTotal;

  const subTotal = roomTotal + serviceTotal;
  const vat = !isNaN(vatSrv) ? vatSrv : Math.round(subTotal * 0.1);

  // NEW: Lấy tổng tiền tốt nhất từ hoá đơn nếu money.tongTien chưa kịp cập nhật
  const hoaDonTotal = Number(
    displayData?.HoaDon?.TongTien ??
    displayData?.HoaDon?.tongTien ??
    NaN
  );
  const inv0 = Array.isArray(displayData?.invoices) && displayData.invoices.length > 0 ? displayData.invoices[0] : null;
  const inv0Total = Number(
    inv0?.TongTien ??
    inv0?.tongTien ??
    NaN
  );

  // Ưu tiên chọn tổng lớn nhất & hợp lệ (hoặc tổng khác 0) giữa money.tongTien, HoaDon.TongTien, invoices[0].TongTien
  const candidates = [totalSrv, hoaDonTotal, inv0Total].filter((v) => !isNaN(v) && v > 0);
  const bestTotal = candidates.length > 0 ? Math.max(...candidates) : Math.round(subTotal + vat);

  // Tổng cộng hiển thị
  const finalTotal = bestTotal;

  // 4) Tách "phí gia hạn" - ưu tiên từ backend, fallback từ chênh lệch BEST_TOTAL
  let extendFee = 0;
  let extendDescription: string | null = null;

  // Ưu tiên đọc extendFee trực tiếp từ backend (nhiều tên có thể có)
  const backendExtendFee = Number(
    money.extendFee ??
    money.extend ??
    money.extra ??
    money.phiGiaHan ??
    money.ExtendFee ??
    0
  );

  if (backendExtendFee > 0) {
    extendFee = backendExtendFee;
    extendDescription = 'Phí gia hạn (đã gồm VAT)';
  } else {
    // Fallback: tính chênh lệch giữa bestTotal và baseTotal (room+service)*1.1, rồi loại trừ lateFee nếu có
    const baseTotal = Math.round(subTotal + vat);
    const diff = bestTotal - baseTotal - (lateFeeSrv > 0 ? lateFeeSrv : 0);
    if (diff > 0) {
      extendFee = diff;
      extendDescription = 'Phí gia hạn (đã gồm VAT)';
    }
  }

  // Nếu có ghi chú 'gia hạn' mà chưa detect được phí, vẫn hiển thị nhãn (phí = 0)
  if (hasExtendNote && !extendDescription) {
    extendDescription = 'Phí gia hạn (đã gồm VAT)';
  }

  // 5) Tiền cọc & đã thanh toán
  const deposit = Number(money.deposit ?? displayData?.TienCoc ?? 0);
  const paidFromServer = Number(money.paidAmount ?? NaN);
  const paid = !isNaN(paidFromServer) ? paidFromServer : 0;
  const needToPay = Math.max(0, finalTotal - paid - deposit);

  // ================== RENDER ==================

  return (
    <Modal
      title={invoiceData ? `Hóa đơn - ${getInvoiceId(displayData) ?? ''}` : 'Hóa đơn'}
      open={visible}
      onCancel={onClose}
      width={900}
      centered
      footer={[
        <Button key="close" onClick={onClose}>
          Đóng
        </Button>,
        <Button key="complete" type="primary" onClick={handleComplete}>
          Hoàn tất trả phòng
        </Button>,
      ]}
    >
      {loadingFresh ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin />
        </div>
      ) : displayData ? (
        <div>
          {/* Header khách sạn */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>
                Khách sạn Robins Villa
              </div>
              <div style={{ color: '#6b7280' }}>
                Địa chỉ: Số 1, Đường ABC, Quận XYZ
              </div>
              <div style={{ color: '#6b7280' }}>Hotline: 1900-xxxx</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div>
                <strong>Ngày:</strong>{' '}
                {new Date().toLocaleString('vi-VN')}
              </div>
              {/* Hiển thị badge gia hạn nếu có ghi chú hoặc phí gia hạn */}
              {(hasExtendNote || extendFee > 0) && (
                <div style={{ marginTop: 8 }}>
                  <Tag color="gold" style={{ fontWeight: 600 }}>ĐÃ GIA HẠN</Tag>
                  {/* Hiển thị thời gian và tỷ lệ gia hạn nếu có */}
                  {(extendDurationLabel || extendPercent !== null) && (
                    <div style={{ marginTop: 4, color: '#92400e', fontSize: 12 }}>
                      {extendDurationLabel && <span>Thời gian: {extendDurationLabel}</span>}
                      {extendDurationLabel && extendPercent !== null && <span> • </span>}
                      {extendPercent !== null && <span>Tỷ lệ: {extendPercent}%</span>}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <Descriptions bordered column={2} size="middle">
            <Descriptions.Item label="Khách hàng">
              {displayData?.TenKhachHang ??
                paymentRow?.TenKhachHang ??
                '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Email">
              {displayData?.EmailKhachHang ??
                paymentRow?.EmailKhachHang ??
                '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Mã đặt phòng">
              {displayData?.IDDatPhong ??
                displayData?.idDatPhong ??
                paymentRow?.IddatPhong ??
                '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Nhận phòng">
              {paymentRow?.NgayNhanPhong?.slice(0, 10) ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Trả phòng">
              {paymentRow?.NgayTraPhong?.slice(0, 10) ?? '-'}
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
                      {r.SoPhong && (
                        <div style={{ color: '#64748b' }}>
                          Phòng {r.SoPhong}
                        </div>
                      )}
                      {r.hasPromotion && (
                        <Tag color="orange" style={{ marginTop: 4 }}>
                          KHUYẾN MÃI -{r.promoAmount.toLocaleString()} đ
                        </Tag>
                      )}
                    </div>
                  ),
                },
                {
                  title: 'Số đêm',
                  dataIndex: 'SoDem',
                  align: 'center',
                },
                {
                  title: 'Giá/đêm',
                  dataIndex: 'GiaPhong',
                  align: 'right',
                  render: (v: any) =>
                    Number(v ?? 0).toLocaleString() + ' đ',
                },
                {
                  title: 'Thành tiền',
                  align: 'right',
                  render: (_: any, r: any) => (
                    <div>
                      {r.promoAmount > 0 && (
                        <div
                          style={{
                            textDecoration: 'line-through',
                            color: '#888',
                          }}
                        >
                          {r.ThanhTien.toLocaleString()} đ
                        </div>
                      )}
                      <strong>
                        {r.discounted.toLocaleString()} đ
                      </strong>
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
                rowKey={(_: any, i?: number) => String(i ?? 0)}
                columns={[
                  { title: 'Dịch vụ', dataIndex: 'tenDichVu' },
                  {
                    title: 'Đơn giá',
                    dataIndex: 'donGia',
                    align: 'right',
                    render: (v: any) =>
                      Number(v ?? 0).toLocaleString() + ' đ',
                  },
                  {
                    title: 'Thành tiền',
                    dataIndex: 'thanhTien',
                    align: 'right',
                    render: (v: any) =>
                      Number(v ?? 0).toLocaleString() + ' đ',
                  },
                ]}
              />
            </div>
          )}

          {/* Tổng kết */}
          <div style={{ marginTop: 24, textAlign: 'right' }}>
            <div
              style={{
                width: 400,
                display: 'inline-block',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 16,
                }}
              >
                <span>Tổng tiền phòng:</span>
                <strong>
                  {roomTotal.toLocaleString()} đ
                </strong>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 16,
                }}
              >
                <span>Tiền dịch vụ:</span>
                <strong>
                  {serviceTotal.toLocaleString()} đ
                </strong>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 16,
                }}
              >
                <span>Tạm tính (chưa VAT):</span>
                <strong>
                  {subTotal.toLocaleString()} đ
                </strong>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 16,
                }}
              >
                <span>Thuế VAT (10%):</span>
                <strong>
                  {vat.toLocaleString()} đ
                </strong>
              </div>
              {extendFee > 0 && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 16,
                    color: '#fa8c16',
                  }}
                >
                  <span title={extendDescription || ''}>
                    {extendDescription || 'Phí gia hạn (đã gồm VAT):'}
                  </span>
                  <strong>
                    {extendFee.toLocaleString()} đ
                  </strong>
                </div>
              )}
              <div
                style={{
                  borderTop: '2px solid #000',
                  margin: '12px 0',
                }}
              />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 20,
                  fontWeight: 700,
                }}
              >
                <span>TỔNG CỘNG:</span>
                <span style={{ color: '#d4380d' }}>
                  {finalTotal.toLocaleString()} đ
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>Tiền cọc:</span>
                <strong>
                  - {deposit.toLocaleString()} đ
                </strong>
              </div>
              {paid > 0 && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>Đã thanh toán:</span>
                  <strong>
                    {paid.toLocaleString()} đ
                  </strong>
                </div>
              )}
              {needToPay > 0 && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: 4,
                    color: '#d4380d',
                  }}
                >
                  <span>Còn phải thu (tham khảo):</span>
                  <strong>
                    {needToPay.toLocaleString()} đ
                  </strong>
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