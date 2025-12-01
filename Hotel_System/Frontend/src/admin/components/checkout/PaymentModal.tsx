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
}

const PaymentModal: React.FC<Props> = ({
  visible,
  paymentRow,
  summary,
  summaryLoading,
  selectedServices,
  form,
  onCancel,
  onSubmit
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

  // Dịch vụ mới (chưa lưu CSDL) – chỉ hiển thị, chưa vào DB
  const clientServices = Array.isArray(selectedServices)
    ? selectedServices.map((v: any) => ({
        serviceName: v.serviceName ?? v.tenDichVu ?? v.name ?? '',
        price: Number(v.price ?? 0),
        amount: Number((v.price ?? 0) * (v.quantity ?? 1)),
        qty: Number(v.quantity ?? 1)
      }))
    : [];

  const combinedServices = [...(dbServices || []), ...clientServices];
  // Tổng dịch vụ (kết hợp server + client-added). We'll normally prefer server-side totals,
  // but for the overdue surcharge case we must include the local surcharge in totals
  // and show it explicitly under VAT.
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
    // We intentionally do NOT push the late-fee into the service list here —
    // late-fee is shown separately below the services table per UX requirement.
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

  // Build final display services (deduped, include computed late fee when needed)
  // Final services displayed in the "Dịch vụ sử dụng" table — explicitly exclude late-fee.
  const finalDisplayServices = React.useMemo(() => {
    return (displayServices as any).normal ?? [];
  }, [displayServices]);

  const serviceTotalFromCombined = finalDisplayServices.reduce((acc: number, s: any) => acc + Number(s.amount ?? s.TienDichVu ?? 0), 0);

  // effective late fee value for display — prefer server-provided `money.lateFee` if present
  const lateFeeFromLines = (displayServices as any).aggregatedLate ?? 0;
  const serverLateFee = Number(summary?.money?.lateFee ?? 0);
  let lateFee = serverLateFee > 0 ? serverLateFee : (lateFeeFromLines > 0 ? lateFeeFromLines : computedLateFee);

  // Tạm tính & VAT & Tổng cộng: by default prefer backend values
  const subTotalFromServer = Number(summary?.money?.subTotal ?? 0);
  const vatFromServer = Number(summary?.money?.vat ?? 0);
  const totalFromServer = Number(summary?.money?.tongTien ?? 0);

  let serviceTotal = serviceTotalServerPreferred;
  let subTotal = subTotalFromServer > 0 ? subTotalFromServer : roomTotal + serviceTotal;
  let vat = vatFromServer > 0 ? vatFromServer : Math.round(subTotal * 0.1);
  let total = totalFromServer > 0 ? totalFromServer : subTotal + vat;

    if (isOverdueBooking && lateFee > 0) {
    // recompute using finalDisplayServices (includes deduped + computed late fee)
    serviceTotal = serviceTotalFromCombined;
    subTotal = roomTotal + serviceTotal;
    vat = Math.round(subTotal * 0.1);
    total = subTotal + vat + lateFee;
  }

  // Đã thanh toán & Cần thanh toán
  const deposit = Number(summary?.money?.deposit ?? 0);

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
  const paidExcludingDepositRaw = Math.max(0, paidRaw - deposit);
  const paid = Math.min(paidExcludingDepositRaw, total);

  const serverRemaining = Number(
    summary?.soTienConLai ??
      summary?.money?.soTienConLai ??
      summary?.invoices?.[0]?.soTienConLai ??
      0
  );

  // Compute effective total: prefer authoritative server total when available.
  // Only use locally computed totals (which include computedLateFee) when server totals are not present.
  const effectiveTotal = totalFromServer > 0 ? totalFromServer : total;

  // For overdue bookings the operator expects the amount due to be exactly:
  // KHÁCH CẦN THANH TOÁN := tổng cộng - đã thanh toán - cọc
  // where `tổng cộng` is the displayed `total`, `đã thanh toán` is `paid` (excluding deposit),
  // and `cọc` is `deposit`.
  let needToPay: number;
  if (isOverdueBooking) {
    needToPay = Math.max(0, Math.round(Number(total ?? 0) - Number(paid ?? 0) - Number(deposit ?? 0)));
  } else {
    needToPay = serverRemaining > 0 ? serverRemaining : Math.max(0, effectiveTotal - deposit - paidExcludingDepositRaw);
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

  // Bấm OK: chỉ ủy quyền cho parent (submitPayment) xử lý thanh toán
  const handleOk = async () => {
    if (typeof onSubmit !== 'function') return;
    try {
      setSubmitting(true);
      await onSubmit();
    } finally {
      setSubmitting(false);
    }
  };

  // Kiểm tra đã thanh toán chưa (status = 2)
  const invoiceStatus =
    Array.isArray(summary?.invoices) && summary.invoices.length > 0
      ? summary.invoices[0].trangThaiThanhToan ??
        summary.invoices[0].TrangThaiThanhToan ??
        summary.invoices[0].trangThaiThanhToan
      : undefined;

  const statusCandidates = [
    invoiceStatus,
    paymentRow?.TrangThaiThanhToan,
    paymentRow?.trangThaiThanhToan
  ];
  const isPaid = statusCandidates.some(
    (v) => String(v ?? '').trim() === '2'
  );

  return (
    <Modal
      title={`Thanh toán – ${paymentRow?.IddatPhong}`}
      open={visible}
      onCancel={onCancel}
      onOk={handleOk}
      okText="Xác nhận"
      cancelText="Hủy"
      confirmLoading={submitting}
      width={900}
      footer={
        // For overdue bookings show both Close and a Confirm button next to it.
          isOverdueBooking
          ? [
              <Button key="close" onClick={onCancel}>Đóng</Button>,
              <Button key="confirm" type="primary" onClick={handleOk} loading={submitting}>
                Thanh toán
              </Button>
            ]
          : isPaid
          ? [<Button key="close" onClick={onCancel}>Đóng</Button>]
          : undefined
      }
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
              <span>Tiền phòng:</span>
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
              <strong>{subTotal.toLocaleString()} đ</strong>
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
            {/* Show late-fee under VAT only for overdue booking with a detected surcharge */}
            {isOverdueBooking && lateFee > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span>Phí trả phòng muộn:</span>
                <strong>{Number(lateFee).toLocaleString()} đ</strong>
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
              <span>Tiền cọc (chỉ để hiển thị):</span>
              <strong>{deposit.toLocaleString()} đ</strong>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between'
              }}
            >
              <span>Đã thanh toán (không bao gồm tiền cọc):</span>
              <strong>- {paid.toLocaleString()} đ</strong>
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