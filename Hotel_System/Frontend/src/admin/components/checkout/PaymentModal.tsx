import React, { useEffect, useState, useRef } from 'react';
import invoiceApi from '../../../api/invoiceApi';
import { getServiceById } from '../../../api/serviceApi';
import { Modal, Form, Select, Table, Divider, Spin, Tag, Input, Button } from 'antd';

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
  // Indicates the booking/invoice has a confirmed extension (gia hạn)
  isExtended?: boolean;
}

const PaymentModal: React.FC<Props> = ({
  visible,
  paymentRow,
  summary,
  summaryLoading,
  selectedServices,
  form,
  onCancel,
  onSubmit,
  isExtended = false
}) => {
  // Tổng tiền phòng: đọc từ summary
  const roomTotal = Number(summary?.money?.roomTotal ?? 0);

  // Dịch vụ: đọc các dòng dịch vụ từ summary — cố gắng hỗ trợ nhiều tên trường
  const deriveServerRowsFromSummary = (s: any) => {
    let raw = s?.services ?? s?.cthddv ?? s?.CTHDDV ?? s?.cthddvs ?? [];
    if ((!raw || raw.length === 0) && Array.isArray(s?.invoices) && s.invoices.length > 0) {
      const inv = s.invoices[0];
      raw =
        inv?.services ??
        inv?.chiTietHoaDons ??
        inv?.ChiTietHoaDons ??
        inv?.ChiTietHoaDon ??
        inv?.cthddv ??
        inv?.CTHDDV ??
        raw;
    }
    if (!Array.isArray(raw)) return [];
    return raw.map((r: any) => {
      const id = r.IddichVu ?? r.iddichVu ?? r.IdDichVu ?? r.Id ?? r.id ?? null;
      const serviceName =
        r.TenDichVu ??
        r.tenDichVu ??
        r.serviceName ??
        r.Ten ??
        r.name ??
        r.ten ??
        '';
      const qty = Number(r.soLuong ?? r.SoLuong ?? r.quantity ?? r.Quantity ?? 1) || 1;
      const price =
        Number(r.donGia ?? r.DonGia ?? r.price ?? r.gia ?? r.Gia ?? 0) || 0;
      const amount =
        Number(
          r.TienDichVu ??
            r.tienDichVu ??
            r.ThanhTien ??
            r.thanhTien ??
            r.amount ??
            price * qty
        ) || price * qty;
      return {
        serviceName: serviceName || (id ? `Dịch vụ ${id}` : ''),
        price,
        amount,
        qty,
        raw: r
      };
    });
  };

  const [dbServices, setDbServices] = useState<any[]>(
    () => deriveServerRowsFromSummary(summary) || []
  );
  const serviceNameCache = useRef<Record<string, string>>({});

  // Đồng bộ dbServices khi summary thay đổi
  useEffect(() => {
    const derived = deriveServerRowsFromSummary(summary) || [];
    if (Array.isArray(derived) && derived.length > 0) {
      setDbServices(derived);
    }
  }, [summary]);

  // Bổ sung tên dịch vụ từ serviceApi nếu thiếu
  useEffect(() => {
    let mounted = true;
    const missingIds = new Set<string>();

    (dbServices || []).forEach((d) => {
      const raw = d?.raw ?? {};
      const id =
        raw?.IddichVu ??
        raw?.iddichVu ??
        raw?.IDDichVu ??
        raw?.IdDichVu ??
        raw?.Id ??
        raw?.iddichVu ??
        null;
      const hasName = d && d.serviceName && String(d.serviceName).trim().length > 0;
      if (id && !hasName && !serviceNameCache.current[String(id)]) {
        missingIds.add(String(id));
      }
    });

    if (missingIds.size === 0) return;

    (async () => {
      try {
        const promises: Array<Promise<void>> = [];
        missingIds.forEach((id) => {
          const p = getServiceById(id)
            .then((svc) => {
              if (!mounted) return;
              const name = svc?.tenDichVu ?? '';
              if (name) serviceNameCache.current[id] = name;
            })
            .catch((err) => {
              console.debug('[PaymentModal] service lookup failed for', id, err?.message ?? err);
            });
          promises.push(p as Promise<void>);
        });
        await Promise.all(promises);
        if (!mounted) return;
        setDbServices((prev) =>
          (prev || []).map((d) => {
            const raw = d?.raw ?? {};
            const id =
              raw?.IddichVu ??
              raw?.iddichVu ??
              raw?.IDDichVu ??
              raw?.IdDichVu ??
              raw?.Id ??
              raw?.iddichVu ??
              null;
            if (
              id &&
              serviceNameCache.current[String(id)] &&
              (!d.serviceName || String(d.serviceName).trim().length === 0)
            ) {
              return { ...d, serviceName: serviceNameCache.current[String(id)] };
            }
            return d;
          })
        );
      } catch (e) {
        // ignore
      }
    })();

    return () => {
      mounted = false;
    };
  }, [dbServices]);

  // Nếu summary không có service lines → fallback: tìm theo invoice
  useEffect(() => {
    let mounted = true;

    const tryFetchInvoiceServices = async () => {
      if (!visible) return;
      if (Array.isArray(dbServices) && dbServices.length > 0) return;

      const inv =
        Array.isArray(summary?.invoices) && summary.invoices.length > 0
          ? summary.invoices[0]
          : null;
      const possibleInvId =
        inv?.id ??
        inv?.IDHoaDon ??
        inv?.IdHoaDon ??
        inv?.ID ??
        inv?.HoaDonId ??
        summary?.idHoaDon ??
        summary?.IdHoaDon ??
        null;
      if (!possibleInvId) return;

      try {
        const detail = await invoiceApi.getInvoiceDetail(String(possibleInvId));
        if (!mounted) return;
        const detailAny: any = detail?.data as any;
        const svcRaw =
          (detailAny?.services ??
            detailAny?.chiTietHoaDons ??
            detailAny?.CTHDDV ??
            detailAny?.cthddv) ?? [];
        if (Array.isArray(svcRaw) && svcRaw.length > 0) {
          setDbServices(
            svcRaw.map((r: any) => {
              const serviceName =
                r.tenDichVu ??
                r.TenDichVu ??
                r.serviceName ??
                r.Ten ??
                r.ten ??
                '';
              const qty =
                Number(
                  r.soLuong ?? r.SoLuong ?? r.quantity ?? r.Quantity ?? 1
                ) || 1;
              const price =
                Number(
                  r.donGia ?? r.DonGia ?? r.price ?? r.gia ?? r.Gia ?? 0
                ) || 0;
              const amount =
                Number(
                  r.TienDichVu ??
                    r.tienDichVu ??
                    r.ThanhTien ??
                    r.thanhTien ??
                    r.amount ??
                    price * qty
                ) || price * qty;
              return { serviceName, price, amount, qty, raw: r };
            })
          );
        }
      } catch (err) {
        console.debug('[PaymentModal] invoice detail fetch failed', err);
      }
    };

    const tryFindInvoiceByBooking = async () => {
      if (!visible) return;
      if (Array.isArray(dbServices) && dbServices.length > 0) return;
      const bookingId =
        paymentRow?.IddatPhong ??
        (paymentRow as any)?.IdDatPhong ??
        (paymentRow as any)?.iddatPhong ??
        null;
      if (!bookingId) return;
      try {
        const list = await invoiceApi.getInvoices();
        if (!mounted || !Array.isArray(list)) return;
        const found = (list as any[]).find(
          (it) =>
            (it.idDatPhong ??
              it.IDDatPhong ??
              it.idDatPhong ??
              it.iddatPhong) == bookingId
        );
        const invoiceId =
          found?.idHoaDon ??
          found?.IdHoaDon ??
          found?.IDHoaDon ??
          found?.id ??
          null;
        if (!invoiceId) return;
        const detail = await invoiceApi.getInvoiceDetail(String(invoiceId));
        if (!mounted) return;
        const detailAny: any = detail?.data as any;
        const svcRaw =
          (detailAny?.services ??
            detailAny?.chiTietHoaDons ??
            detailAny?.CTHDDV ??
            detailAny?.cthddv) ?? [];
        if (Array.isArray(svcRaw) && svcRaw.length > 0) {
          setDbServices(
            svcRaw.map((r: any) => {
              const serviceName =
                r.tenDichVu ??
                r.TenDichVu ??
                r.serviceName ??
                r.Ten ??
                r.ten ??
                '';
              const qty =
                Number(
                  r.soLuong ?? r.SoLuong ?? r.quantity ?? r.Quantity ?? 1
                ) || 1;
              const price =
                Number(
                  r.donGia ?? r.DonGia ?? r.price ?? r.gia ?? r.Gia ?? 0
                ) || 0;
              const amount =
                Number(
                  r.TienDichVu ??
                    r.tienDichVu ??
                    r.ThanhTien ??
                    r.thanhTien ??
                    r.amount ??
                    price * qty
                ) || price * qty;
              return { serviceName, price, amount, qty, raw: r };
            })
          );
        }
      } catch (err) {
        console.debug('[PaymentModal] find invoice by booking failed', err);
      }
    };

    tryFetchInvoiceServices();
    tryFindInvoiceByBooking();

    return () => {
      mounted = false;
    };
  }, [visible, summary, dbServices, paymentRow]);

  // Dịch vụ mới (chưa lưu CSDL) – KHÔNG dùng selectedServices vì nó đã được merge vào summary.services ở CheckoutManager
  // clientServices = [] để tránh nhân đôi
  const clientServices: any[] = [];

  const combinedServices = [...(dbServices || []), ...clientServices];
  // Tổng dịch vụ
  const serviceTotalFromServer = Number(summary?.money?.serviceTotal ?? 0);
  const serviceTotalServerPreferred = serviceTotalFromServer;

  // detect a late-fee service by name (case-insensitive)
  const lateFeeRegex = /trả phòng muộn|phí trả phòng muộn|phu.?phi.?tra phong muon/i;

  // Merge duplicate late-fee lines and optionally fetch computed late-fee preview from backend
  const [computedLateFee, setComputedLateFee] = useState<number>(0);

  const isOverdueBooking = Number(paymentRow?.TrangThai ?? 0) === 5;

  // Aggregate existing combined services and prepare a deduped display list
  const displayServices = React.useMemo(() => {
    const base = [...(dbServices || []), ...clientServices];
    const normal: any[] = [];
    let aggregatedLate = 0;
    base.forEach((s) => {
      if (lateFeeRegex.test(String(s.serviceName ?? s.TenDichVu ?? ''))) {
        aggregatedLate += Number(s.amount ?? s.TienDichVu ?? 0);
      } else {
        normal.push(s);
      }
    });
    return { normal, aggregatedLate };
  }, [dbServices, clientServices, computedLateFee]);

  // If overdue and no persisted late-fee line found, fetch preview from server
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!visible) return;
        if (!isOverdueBooking) return;
        const aggregated = (displayServices as any).aggregatedLate ?? 0;
        if (aggregated > 0) return; // server already provided a persisted line
        const bookingId = paymentRow?.IddatPhong ?? (paymentRow as any)?.IdDatPhong ?? (paymentRow as any)?.iddatPhong ?? null;
        if (!bookingId) return;
        const resp = await fetch(`/api/Checkout/tinh-phu-phi/${bookingId}`);
        if (!mounted) return;
        if (!resp.ok) return;
        const data = await resp.json();
        const amt = Number(data?.surchargeAmount ?? 0) || 0;
        if (amt > 0) setComputedLateFee(amt);
      } catch (e) {
        console.debug('[PaymentModal] fetch late-fee failed', e);
      }
    })();
    return () => { mounted = false; };
  }, [visible, isOverdueBooking, paymentRow, displayServices]);

  const finalDisplayServices = React.useMemo(() => {
    return (displayServices as any).normal ?? [];
  }, [displayServices]);

  const serviceTotalFromCombined = finalDisplayServices.reduce((acc: number, s: any) => acc + Number(s.amount ?? s.TienDichVu ?? 0), 0);

  const lateFeeFromLines = (displayServices as any).aggregatedLate ?? 0;
  const serverLateFee = Number(summary?.money?.lateFee ?? 0);
  let lateFee = serverLateFee > 0 ? serverLateFee : (lateFeeFromLines > 0 ? lateFeeFromLines : computedLateFee);

  // Tạm tính & VAT & Tổng cộng: prefer backend
  const subTotalFromServer = Number(summary?.money?.subTotal ?? 0);
  const vatFromServer = Number(summary?.money?.vat ?? 0);
  const totalFromServer = Number(summary?.money?.tongTien ?? 0);

  // ----- Thử tách ghi chú để phát hiện marker gia hạn -----
  const extractNotesFromSummary = (s: any) => {
    const notes: string[] = [];
    if (!s) return notes;
    if (s?.GhiChu) notes.push(String(s.GhiChu));
    if (s?.ghiChu) notes.push(String(s.ghiChu));
    if (s?.HoaDon && (s.HoaDon.GhiChu || s.HoaDon.ghiChu)) notes.push(String(s.HoaDon.GhiChu ?? s.HoaDon.ghiChu));
    const inv0 = Array.isArray(s?.invoices) && s.invoices.length > 0 ? s.invoices[0] : null;
    if (inv0?.GhiChu) notes.push(String(inv0.GhiChu));
    if (inv0?.ghiChu) notes.push(String(inv0.ghiChu));
    return notes;
  };

  const rawNotes = extractNotesFromSummary(summary);
  const notesNorm = rawNotes.map((nn) =>
    (nn || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
  );

  // Chỉ coi là đã gia hạn nếu ghi chú có 'Gia hạn đến' hoặc 'Gia hạn thêm'
  const hasExtendNote = notesNorm.some((n) =>
    /\bgia\s*han\s*(den|them)\b/.test(n) && !/\bkhong\s*gia\s*han\b/.test(n)
  );

  let extendDurationLabel: string | null = null;
  let extendPercent: number | null = null;
  const moneyAny = summary?.money ?? {};
  if (moneyAny.extendDuration || moneyAny.extendHours || moneyAny.extendTime) {
    extendDurationLabel = String(moneyAny.extendDuration ?? moneyAny.extendHours ?? moneyAny.extendTime);
  }
  if (moneyAny.extendPercent || moneyAny.extend_pct || moneyAny.extendRate) {
    const p = moneyAny.extendPercent ?? moneyAny.extend_pct ?? moneyAny.extendRate;
    const pnum = Number(p);
    if (!isNaN(pnum)) extendPercent = pnum;
  }
  if (!extendDurationLabel || extendPercent == null) {
    for (let i = 0; i < notesNorm.length; i++) {
      const n = notesNorm[i];
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
        if (m2) extendPercent = Number(m2[1]);
        else {
          const m3 = n.match(/(\d+(?:\.\d+)?)\s*phan\s*tram/);
          if (m3) extendPercent = Number(m3[1]);
        }
      }
      if (extendDurationLabel && extendPercent != null) break;
    }
  }

  const paidFromBooking = Number(summary?.money?.paidAmount ?? 0);

  const invoicePaid =
    Array.isArray(summary?.invoices) && summary.invoices.length > 0
      ? Number(
          summary.invoices[0].tienThanhToan ??
            summary.invoices[0].TienThanhToan ??
            0
        )
      : 0;

  const paidRaw = paidFromBooking > 0 ? paidFromBooking : invoicePaid;
  const paidExcludingDepositRaw = Math.max(0, paidRaw - Number(summary?.money?.deposit ?? 0));
  const paid = Math.min(paidExcludingDepositRaw, totalFromServer > 0 ? totalFromServer : Math.round((roomTotal + serviceTotalServerPreferred) * 1.1));

  const serverRemaining = Number(
    summary?.soTienConLai ??
      summary?.money?.soTienConLai ??
      summary?.invoices?.[0]?.soTienConLai ??
      0
  );

  // Use calculated total from displayed services to avoid mismatch between rows and total
  let serviceTotal = serviceTotalFromCombined;
  let subTotal = subTotalFromServer > 0 ? subTotalFromServer : roomTotal + serviceTotal;
  let vat = vatFromServer > 0 ? vatFromServer : Math.round(subTotal * 0.1);
  let total = totalFromServer > 0 ? totalFromServer : subTotal + vat;

  if (isOverdueBooking && lateFee > 0) {
    // Overdue: TongTien = (room + service) * 1.1 + lateFee (lateFee không VAT)
    serviceTotal = serviceTotalFromCombined;
    subTotal = roomTotal + serviceTotal;
    vat = Math.round(subTotal * 0.1);
    total = subTotal + vat + lateFee;
  }

  // Detect extend fee:
  // 1) Prefer explicit backend value `summary.money.extendFee` when present
  // 2) If not present and booking is not overdue, but `extendPercent` is available
  //    compute fee as `perNightRate * (extendPercent/100)` then apply VAT (x1.1)
  // 3) Otherwise fall back to previous heuristic: diff between server total and computed basic
  let ef = Number(summary?.money?.extendFee ?? 0);
  if (isOverdueBooking) {
    ef = 0;
  } else {
    if ((!ef || ef <= 0) && extendPercent != null) {
      // Derive a per-night room rate.
      let perNight = 0;
      try {
        const items = Array.isArray(summary?.items) ? summary.items : [];
        // try to find a best candidate
        let candidate: any = null;
        for (const it of items) {
          const gp = Number(it?.giaPhong ?? it?.gia ?? 0) || 0;
          const nights = Number(it?.soDem ?? it?.soNgay ?? it?.soNgayO ?? 0) || 0;
          if (gp > 0 && nights > 0) {
            candidate = it;
            break;
          }
          if (!candidate) candidate = it;
        }
        if (candidate) {
          perNight = Number(candidate?.giaPhong ?? candidate?.gia ?? 0) || 0;
          const nights = Number(candidate?.soDem ?? candidate?.soNgay ?? candidate?.soNgayO ?? 0) || 0;
          if ((perNight === 0 || perNight <= 0) && nights > 0) {
            perNight = Math.round(Number(roomTotal) / nights);
          }
        }
        if (!perNight || perNight <= 0) {
          // try global total nights
          const totalNights = items.reduce((acc: number, it: any) => acc + (Number(it?.soDem ?? it?.soNgay ?? 0) || 0), 0);
          if (totalNights > 0) {
            perNight = Math.round(Number(roomTotal) / totalNights);
          }
        }
        if (!perNight || perNight <= 0) {
          perNight = Math.round(Number(roomTotal));
        }
      } catch (e) {
        perNight = Math.round(Number(roomTotal));
      }

      const feeBeforeVat = Math.round(perNight * (Number(extendPercent) / 100));
      const feeWithVat = Math.round(feeBeforeVat * 1.1);
      ef = feeWithVat;
    } else if ((!ef || ef <= 0) && hasExtendNote) {
      const computedBasic = Math.round((roomTotal + (serviceTotalServerPreferred > 0 ? serviceTotalServerPreferred : serviceTotalFromCombined)) * 1.1);
      const possibleTotal = totalFromServer > 0 ? totalFromServer : NaN;
      if (!isNaN(possibleTotal) && possibleTotal > 0) {
        const diff = possibleTotal - computedBasic;
        if (diff > 1000) ef = diff;
      }
    }
  }
  let extendFee = ef;

  // Do NOT add a separate extendFee to totals here. The room total should reflect
  // any extension (display-only change below). Avoid double-counting.

  // Đã thanh toán & Cần thanh toán
  const deposit = Number(summary?.money?.deposit ?? 0);

  const effectiveTotal = totalFromServer > 0 ? totalFromServer : total;

  let needToPay: number;
  // Prefer any server-provided remaining amount (authoritative). If not available,
  // prefer invoice-level remaining (`soTienConLai`) when present. Otherwise compute.
  const invoiceRemaining = Number(
    (Array.isArray(summary?.invoices) && summary.invoices.length > 0
      ? summary.invoices[0]?.soTienConLai ?? summary.invoices[0]?.soTienConLai
      : undefined) ?? 0
  );

  if (isOverdueBooking) {
    needToPay = Math.max(0, Math.round(Number(total ?? 0) - Number(paid ?? 0) - Number(deposit ?? 0)));
  } else {
    if (serverRemaining > 0) {
      needToPay = serverRemaining;
    } else if (invoiceRemaining > 0) {
      needToPay = invoiceRemaining;
    } else {
      needToPay = Math.max(0, effectiveTotal - deposit - paidExcludingDepositRaw);
    }
  }

  // Khi mở modal, set default method & ghi chú
  useEffect(() => {
    if (visible) {
      form.setFieldsValue({
        amount: needToPay,
        PhuongThucThanhToan: 1,
        GhiChu: ''
      });
    }
  }, [needToPay, visible, form]);

  const [submitting, setSubmitting] = useState(false);

  const handleOk = async () => {
    if (typeof onSubmit !== 'function') return;
    try {
      setSubmitting(true);
      await onSubmit();
    } finally {
      setSubmitting(false);
    }
  };

  // Label nút xác nhận: nếu cần thu > 0 thì “Thanh toán & mở hóa đơn”, ngược lại “Mở hóa đơn”
  const confirmLabel = needToPay > 0 ? 'Thanh toán & mở hóa đơn' : 'Xác nhận thanh toán';

  return (
    <Modal
      title={`Thanh toán – ${paymentRow?.IddatPhong}`}
      open={visible}
      onCancel={onCancel}
      width={900}
      footer={[
        <Button key="close" onClick={onCancel}>Đóng</Button>,
        <Button
          key="confirm"
          type="primary"
          onClick={handleOk}
          loading={submitting}
          disabled={summaryLoading}
        >
          {confirmLabel}
        </Button>
      ]}
    >
      <Spin spinning={summaryLoading}>
        <Form form={form} layout="vertical">
          {/* Header */}
          <div
            style={{
              padding: '12px 16px',
              background: '#f9fafb',
              borderRadius: 8,
              marginBottom: 16
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 18 }}>
              Khách sạn Robins Villa
            </div>
            <div style={{ marginTop: 8 }}>
              <div>
                Khách: <strong>{paymentRow?.TenKhachHang}</strong>
              </div>
              <div>
                Nhận phòng:{' '}
                <strong>{paymentRow?.NgayNhanPhong?.slice(0, 10)}</strong> → Trả:{' '}
                <strong>{paymentRow?.NgayTraPhong?.slice(0, 10)}</strong>
              </div>
            </div>
            {(!isOverdueBooking && (hasExtendNote || extendPercent != null || extendDurationLabel)) && (
              <div style={{ marginTop: 8 }}>
                <Tag color="gold" style={{ fontWeight: 700 }}>ĐÃ GIA HẠN</Tag>
              </div>
            )}
            {(extendDurationLabel || extendPercent !== null) && (hasExtendNote || extendPercent != null || extendDurationLabel) && (
              <div style={{ marginTop: 8, color: '#92400e' }}>
                {extendDurationLabel && (
                  <div style={{ fontSize: 12 }}>Thời gian gia hạn: {extendDurationLabel}</div>
                )}
                {extendPercent !== null && extendPercent !== undefined && (
                  <div style={{ fontSize: 12 }}>Tỷ lệ gia hạn: {Number(extendPercent).toString()}%</div>
                )}
              </div>
            )}
          </div>

          {/* Phòng */}
          {summary?.items?.length > 0 && (
            <Table
              size="small"
              pagination={false}
              dataSource={summary.items}
              style={{ marginBottom: 16 }}
              columns={[
                {
                  title: 'Phòng',
                  render: (_: any, r: any) => {
                    const idPhong =
                      r.idPhong ?? r.IDPhong ?? r.IdPhong ?? '';
                    const tenPhong =
                      r.tenPhong ??
                      r.TenPhong ??
                      r.Phong?.TenPhong ??
                      '';
                    const name = [tenPhong].filter(Boolean).join(' ');
                    return (
                      <div>
                        <div style={{ fontWeight: 600 }}>{name || '-'}</div>
                        {idPhong && (
                          <div style={{ color: '#64748b' }}>{idPhong}</div>
                        )}
                      </div>
                    );
                  }
                },
                { title: 'Số đêm', dataIndex: 'soDem', align: 'center' },
                {
                  title: 'Giá/đêm',
                  render: (_: any, r: any) =>
                    `${Number(r.giaPhong || 0).toLocaleString()} đ`,
                  align: 'right'
                },
                {
                  title: 'Thành tiền',
                  render: (_: any, r: any) =>
                    `${Number(r.thanhTien || 0).toLocaleString()} đ`,
                  align: 'right'
                }
              ]}
            />
          )}

          {/* Dịch vụ (server + mới thêm) */}
          {finalDisplayServices.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <h4>
                <Tag color="blue">Dịch vụ sử dụng</Tag>
              </h4>
              <Table
                size="small"
                pagination={false}
                dataSource={finalDisplayServices}
                columns={[
                  { title: 'Dịch vụ', dataIndex: 'serviceName' },
                  {
                    title: 'Thành tiền',
                    render: (_: any, r: any) =>
                      `${Number(r.amount || 0).toLocaleString()} đ`,
                    align: 'right'
                  }
                ]}
              />
            </div>
          )}

          {/* Tổng kết */}
          <div
            style={{
              background: '#fff7e6',
              padding: 16,
              borderRadius: 8
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 8
              }}
            >
              <span>
                {(!isOverdueBooking && (hasExtendNote || extendPercent != null || extendDurationLabel))
                  ? `Tiền phòng (gồm ${extendDurationLabel ? `Gia hạn đến ${extendDurationLabel}` : 'gia hạn'}${extendPercent != null ? ` (${Number(extendPercent)}%)` : ''}):`
                  : 'Tiền phòng:'}
              </span>
              <strong>{roomTotal.toLocaleString()} đ</strong>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 8
              }}
            >
              <span>Dịch vụ:</span>
              <strong>{serviceTotal.toLocaleString()} đ</strong>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 8
              }}
            >
              <span>Tạm tính (chưa VAT):</span>
              <strong>{(roomTotal + serviceTotal).toLocaleString()} đ</strong>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 8
              }}
            >
              <span>Thuế VAT (10%):</span>
              <strong>{vat.toLocaleString()} đ</strong>
            </div>
            {/* Show late-fee AFTER VAT for overdue booking - phí phạt không tính VAT */}
            {isOverdueBooking && lateFee > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#d4380d' }}>Phí trả phòng muộn (không VAT):</span>
                <strong style={{ color: '#d4380d' }}>+ {Number(lateFee).toLocaleString()} đ</strong>
              </div>
            )}
            <Divider />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 20,
                fontWeight: 700
              }}
            >
              <span>TỔNG CỘNG:</span>
              <span style={{ color: '#d4380d' }}>
                {total.toLocaleString()} đ
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between'
              }}
            >
              <span>Tiền cọc:</span>
              <strong>{deposit.toLocaleString()} đ</strong>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between'
              }}
            >
              <span>Đã thanh toán:</span>
              <strong>{paid.toLocaleString()} đ</strong>
            </div>
            <Divider />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 22,
                fontWeight: 700,
                color: '#d4380d'
              }}
            >
              <span>KHÁCH CẦN THANH TOÁN:</span>
              <span>{needToPay.toLocaleString()} đ</span>
            </div>
          </div>

          {/* Chọn phương thức + ghi chú */}
          <div style={{ marginTop: 12 }}>
            <Form.Item
              name="PhuongThucThanhToan"
              label="Phương thức thanh toán"
              style={{ marginBottom: 8 }}
            >
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