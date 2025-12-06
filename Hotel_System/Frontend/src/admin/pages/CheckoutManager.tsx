import React, { useEffect, useMemo, useState } from 'react';
import Slidebar from '../components/Slidebar';
import HeaderSection from '../components/HeaderSection';
import { Button, Card, Input, message, Space, Modal, DatePicker, Form, List, Image, notification } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import checkoutApi from '../../api/checkout.Api';
import reviewApi from '../../api/review.Api';
import { getRooms, findAvailableRooms } from '../../api/roomsApi';

import CheckoutTable from '../components/checkout/CheckoutTable';
import PaymentModal from '../components/checkout/PaymentModal';
import InvoiceModal from '../components/checkout/InvoiceModal';
import ExtendInvoiceModal from '../components/checkout/ExtendInvoiceModal';
import InvoiceModalWithLateFee from '../components/checkout/InvoiceModalWithLateFee';
import ServicesSelector from '../../components/ServicesSelector';

export interface BookingRow {
  IddatPhong: string;
  IdkhachHang?: number;
  TenKhachHang?: string;
  EmailKhachHang?: string;
  Idphong?: string;
  TenPhong?: string;
  SoPhong?: string;
  NgayNhanPhong?: string;
  NgayTraPhong?: string;
  SoDem?: number;
  TongTien: number;
  TienCoc?: number;
  TrangThai: number;
  TrangThaiThanhToan: number;
  ChiTietDatPhongs?: Array<any>;
}

const getRoomInfo = (it: any) => {
  const ten = it?.TenPhong ?? it?.tenPhong ?? it?.Phong?.TenPhong ?? it?.Phong?.tenPhong ?? null;
  const so = it?.SoPhong ?? it?.soPhong ?? it?.Phong?.SoPhong ?? it?.Phong?.soPhong ?? null;
  return { ten, so };
};

const collectRoomInfos = (items?: any[], fallbackRow?: BookingRow) => {
  const arr = (items ?? []).map(getRoomInfo).filter((r: any) => (r.ten || r.so));
  if (!arr.length && fallbackRow) {
    const ten = fallbackRow.TenPhong ?? null;
    const so = fallbackRow.SoPhong ?? null;
    if (ten || so) arr.push({ ten, so });
  }
  return arr;
};

const fetchJson = async (url: string, init?: RequestInit) => {
  const res = await fetch(url, init);
  let text = '';
  try { text = await res.text(); } catch {}
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || text || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data ?? { ok: true };

};

const CheckoutManager: React.FC = () => {

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<BookingRow[]>([]);
  const [keyword, setKeyword] = useState('');
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(dayjs());

  const [viewMode, setViewMode] = useState<'using' | 'checkout' | 'overdue'>('checkout');
  const [summaryMap, setSummaryMap] = useState<Record<string, any>>({});
  const [msg, contextHolder] = message.useMessage();

  const load = async () => {
    setLoading(true);
    try {
      const list = await fetchJson('/api/DatPhong');
      const normalizeBooking = (item: any) => {
        const chiTiet = (item.ChiTietDatPhongs ?? item.chiTietDatPhongs ?? []).map((ct: any) => ({
          ...ct,
          TenPhong: ct.TenPhong ?? ct.tenPhong ?? ct?.Phong?.TenPhong ?? ct?.Phong?.tenPhong ?? ct?.SoPhong ?? ct?.soPhong,
          SoPhong: ct.SoPhong ?? ct.soPhong ?? ct?.Phong?.SoPhong ?? ct?.Phong?.soPhong,
          GiaPhong: ct.GiaPhong ?? ct.giaPhong,
          SoDem: ct.SoDem ?? ct.soDem,
          ThanhTien: ct.ThanhTien ?? ct.thanhTien
        }));

        const topTen = item.TenPhong ?? item.tenPhong ?? (chiTiet && chiTiet.length === 1 ? (chiTiet[0].TenPhong ?? chiTiet[0].tenPhong) : null);
        const topSo = item.SoPhong ?? item.soPhong ?? (chiTiet && chiTiet.length === 1 ? (chiTiet[0].SoPhong ?? chiTiet[0].soPhong) : null);

        return {
          IddatPhong: item.IddatPhong ?? item.iddatPhong,
          IdkhachHang: item.IdkhachHang ?? item.idkhachHang,
          TenKhachHang: item.TenKhachHang ?? item.tenKhachHang,
          EmailKhachHang: item.EmailKhachHang ?? item.emailKhachHang,
          Idphong: item.Idphong ?? item.idphong,
          TenPhong: topTen,
          SoPhong: topSo,
          NgayDatPhong: item.NgayDatPhong ?? item.ngayDatPhong,
          NgayNhanPhong: item.NgayNhanPhong ?? item.ngayNhanPhong,
          NgayTraPhong: item.NgayTraPhong ?? item.ngayTraPhong,
          SoDem: item.SoDem ?? item.soDem,
          TongTien: item.TongTien ?? item.tongTien ?? 0,
          TienCoc: item.TienCoc ?? item.tienCoc,
          TrangThai: item.TrangThai ?? item.trangThai,
          TrangThaiThanhToan: item.TrangThaiThanhToan ?? item.trangThaiThanhToan,
          ChiTietDatPhongs: chiTiet
        } as BookingRow;
      };

      const mapped = (list || []).map((i: any) => normalizeBooking(i));

      // 2. Xác định những booking nào cần lấy summary (chỉ lấy những cái đang hiển thị)
      const todayStr = dayjs().format('YYYY-MM-DD');
      const relevantBookings = mapped.filter((b: BookingRow) => {
        if (viewMode === 'using' || viewMode === 'checkout') {
          return b.TrangThai === 3; // Đang sử dụng
        } else {
          // Checkout mode: trả phòng hôm nay
          return b.NgayTraPhong?.startsWith(todayStr) && [3, 4].includes(b.TrangThai ?? 0);
        }
      });

      // 3. Gọi summary song song cho tất cả booking cần thiết
      const summaryResults = await Promise.all(
        relevantBookings.map(async (booking: BookingRow) => {
          try {
            const sum = await checkoutApi.getSummary(booking.IddatPhong);
            return { id: booking.IddatPhong, summary: sum };
          } catch (err) {
            console.warn(`Không lấy được summary cho ${booking.IddatPhong}`, err);
            return { id: booking.IddatPhong, summary: null };
          }
        })
      );

      // 4. Cập nhật summaryMap
      const newSummaryMap: Record<string, any> = {};
      summaryResults.forEach(({ id, summary }) => {
        if (summary) newSummaryMap[id] = summary;
      });
      setSummaryMap(newSummaryMap);

      // 5. Cập nhật data
      setData(mapped);

    } catch (e: any) {
      message.error(e.message || 'Không thể tải danh sách đặt phòng');
    } finally {
      setLoading(false);
    }
  };

  // === HELPERS: persist bookings that were extended today (so UI shows "Đã gia hạn trong ngày") ===
  const getExtendedBookingsKey = () => {
    const dateStr = dayjs().format('YYYY-MM-DD');
    return `extended_bookings_${dateStr}`;
  };

  const loadExtendedBookingsFromStorage = (): string[] => {
    try {
      const key = getExtendedBookingsKey();
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch (e) {
      console.warn('[loadExtendedBookingsFromStorage] failed', e);
    }
    return [];
  };

  const saveExtendedBookingsToStorage = (ids: string[]) => {
    try {
      const key = getExtendedBookingsKey();
      localStorage.setItem(key, JSON.stringify(ids || []));
      cleanupOldExtendedBookingsKeys();
    } catch (e) {
      console.warn('[saveExtendedBookingsToStorage] failed', e);
    }
  };

  const cleanupOldExtendedBookingsKeys = () => {
    try {
      const keys: string[] = Object.keys(localStorage || {}).filter(k => k && k.startsWith('extended_bookings_'));
      const today = dayjs().format('YYYY-MM-DD');
      for (const key of keys) {
        const dateStr = key.replace('extended_bookings_', '');
        if (dateStr !== today) {
          try { localStorage.removeItem(key); } catch {}
        }
      }
    } catch (e) {
      // ignore
    }
  };

  const [extendedBookingIds, setExtendedBookingIds] = useState<string[]>(() => loadExtendedBookingsFromStorage());
  useEffect(() => {
    if (extendedBookingIds && extendedBookingIds.length > 0) saveExtendedBookingsToStorage(extendedBookingIds);
  }, [extendedBookingIds]);

  const markBookingAsExtended = (bookingId: string | null | undefined) => {
    if (!bookingId) return;
    setExtendedBookingIds(prev => {
      const updated = Array.from(new Set([...(prev || []), String(bookingId)]));
      try { saveExtendedBookingsToStorage(updated); } catch {}
      return updated;
    });
  };

  const detectExtendInSummary = (s: any) => {
    if (!s) return false;
    const money = s?.money ?? {};
    const backendExtend = Number(money.extendFee ?? money.extend ?? money.extra ?? money.phiGiaHan ?? 0);
    if (backendExtend > 0) return true;
    // check notes
    const notes = [] as string[];
    if (s?.GhiChu) notes.push(String(s.GhiChu));
    if (s?.ghiChu) notes.push(String(s.ghiChu));
    if (s?.HoaDon?.GhiChu) notes.push(String(s.HoaDon.GhiChu));
    if (Array.isArray(s?.invoices) && s.invoices.length > 0) {
      const inv = s.invoices[0];
      if (inv?.GhiChu) notes.push(String(inv.GhiChu));
      if (inv?.ghiChu) notes.push(String(inv.ghiChu));
    }
    const norm = notes.join('\n').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (norm.includes('gia han') || norm.includes('gia hạn') || norm.includes('gia-han')) return true;
    // fallback: compute diff
    const roomTotal = Number(money.roomTotal ?? NaN);
    const serviceTotal = Number(money.serviceTotal ?? NaN);
    const vat = Number(money.vat ?? NaN);
    const totalSrv = Number(money.tongTien ?? NaN);
    if (!isNaN(totalSrv) && !isNaN(roomTotal) && !isNaN(serviceTotal)) {
      const sub = roomTotal + serviceTotal;
      const base = Math.round((!isNaN(vat) && vat > 0) ? (sub + vat) : Math.round(sub * 1.1));
      if (totalSrv - base > 1000) return true;
    }
    return false;
  };

  useEffect(() => { load(); }, []);

  // Khi chuyển sang tab Quá hạn, tự động load summary cho các booking quá hạn
  useEffect(() => {
    if (viewMode !== 'overdue') return;
    
    const overdueBookings = (data || []).filter((b: BookingRow) => (b.TrangThai ?? 0) === 5);
    if (overdueBookings.length === 0) return;

    // Chỉ load những booking chưa có trong summaryMap
    const toLoad = overdueBookings.filter((b: BookingRow) => !summaryMap[b.IddatPhong]);
    if (toLoad.length === 0) return;

    const loadOverdueSummaries = async () => {
      const results = await Promise.all(
        toLoad.map(async (booking: BookingRow) => {
          try {
            const sum = await checkoutApi.getSummary(booking.IddatPhong);
            return { id: booking.IddatPhong, summary: sum };
          } catch (err) {
            console.warn(`Không lấy được summary cho ${booking.IddatPhong}`, err);
            return { id: booking.IddatPhong, summary: null };
          }
        })
      );

      setSummaryMap(prev => {
        const updated = { ...prev };
        results.forEach(({ id, summary }) => {
          if (summary) updated[id] = summary;
        });
        return updated;
      });
    };

    loadOverdueSummaries();
  }, [viewMode, data]);

  // Payment/modal state
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentRow, setPaymentRow] = useState<BookingRow | null>(null);
  const [summary, setSummary] = useState<any | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [form] = Form.useForm();

  const openPaymentModal = async (row: BookingRow) => {
    // If an extend form is open, hide it before showing the payment modal
    try { setExtendVisible(false); resetExtendState(); } catch {}
    setPaymentRow(row);
    setPaymentModalVisible(true);
    setSummaryLoading(true);
    try {
      const sum = await checkoutApi.getSummary(row.IddatPhong);
      console.debug('[openPaymentModal] summary for', row.IddatPhong, sum);
      // merge any booking-level services or client-selected services so older services show up
      const serverServices = Array.isArray(sum?.services) ? sum.services : [];
      const bookingServices: any[] = [];
      // try to read services from paymentRow if present (some responses use different shapes)
      if (Array.isArray((row as any)?.services)) bookingServices.push(...(row as any).services);
      const mergedServices = [...serverServices, ...bookingServices, ...(selectedServices || [])];
      // preserve previously-displayed paid amounts when server returns transient 0
      const newSummary = { ...sum, services: mergedServices };
      setSummary(mergeFreshSummary(summary, newSummary));
      const soDem = Number(sum?.dates?.soDem ?? row.SoDem ?? 1);
      const tienPhong = Math.round(Number(sum?.money?.roomTotal ?? (row.TongTien || 0)));
      const tongTien = Number(sum?.money?.tongTien ?? (row.TongTien || 0));
      form.setFieldsValue({ TienPhong: tienPhong, SoLuongNgay: soDem, TongTien: tongTien, PhuongThucThanhToan: 1, GhiChu: '' });
    } catch (e: any) {
      message.error(e.message || 'Không tải được tóm tắt thanh toán');
      form.setFieldsValue({ TienPhong: Math.round(row.TongTien || 0), SoLuongNgay: row.SoDem || 1, TongTien: Number(row.TongTien || 0), PhuongThucThanhToan: 1, GhiChu: '' });
    } finally { setSummaryLoading(false); }
  };

  // Non-invasive helper: merge fresh server summary into existing summary while
  // preserving previously-displayed paidAmount when the fresh summary reports 0.
  // This avoids UI flicker where an in-progress server update temporarily reports
  // paid = 0 and the UI would incorrectly show paid = 0 to the operator.
  const mergeFreshSummary = (prev: any | null, fresh: any | null) => {
    if (!fresh) return prev;
    if (!prev) return fresh;
    try {
      const prevPaid = Number(prev?.money?.paidAmount ?? prev?.money?.paid ?? 0);
      const freshPaid = Number(fresh?.money?.paidAmount ?? fresh?.money?.paid ?? NaN);
      if (!isNaN(prevPaid) && (isNaN(freshPaid) || freshPaid === 0) && prevPaid > 0) {
        // keep previous paidAmount to avoid showing 0 prematurely
        const mergedMoney = { ...fresh.money, paidAmount: prevPaid };
        return { ...fresh, money: mergedMoney };
      }
    } catch {
      // ignore and return fresh
    }
    return fresh;
  };

  // Build a normalized invoiceData object from server summary and optional booking row
  const buildInvoiceDataFromSummary = (sum: any | null, row?: any) => {
    if (!sum && !row) return null;
    const dp = sum?.DatPhong ?? sum?.datPhong ?? null;
    const customer =
      sum?.customer ??
      sum?.Customer ??
      dp?.TenKhachHang ??
      dp?.tenKhachHang ??
      (row && (row.TenKhachHang ?? row.tenKhachHang)) ??
      null;

    const dates = sum?.dates ?? (dp ? { checkin: dp.NgayNhanPhong, checkout: dp.NgayTraPhong } : null);

    const room = sum?.room ?? (dp
      ? { id: dp?.Idphong ?? dp?.idphong, tenPhong: dp?.TenPhong ?? dp?.idphongNavigation?.TenPhong, soPhong: dp?.SoPhong ?? dp?.idphongNavigation?.SoPhong }
      : row ? { id: row.Idphong, tenPhong: row.TenPhong, soPhong: row.SoPhong } : null);

    let baseItems: any[] = [];
    if (Array.isArray(sum?.items) && sum.items.length > 0) baseItems = sum.items;
    else if (Array.isArray(dp?.ChiTietDatPhongs) && dp.ChiTietDatPhongs.length > 0) baseItems = dp.ChiTietDatPhongs;
    else if (Array.isArray(row?.ChiTietDatPhongs) && row.ChiTietDatPhongs.length > 0) baseItems = row.ChiTietDatPhongs;
    else if (row) {
      baseItems = [{
        TenPhong: row.TenPhong ?? room?.tenPhong ?? 'Phòng',
        SoPhong: row.SoPhong ?? room?.soPhong ?? undefined,
        SoDem: Number(row.SoDem ?? 1),
        GiaPhong: Math.round((row.TongTien ?? 0) / Math.max(1, row.SoDem ?? 1)),
        ThanhTien: row.TongTien ?? 0
      }];
    }

    const normalizedItems = (baseItems || []).map((it: any, idx: number) => ({
      ID: it?.id ?? it?.IDChiTiet ?? idx,
      TenPhong: it?.TenPhong ?? it?.tenPhong ?? it?.Phong?.TenPhong ?? it?.Phong?.tenPhong ?? (it?.SoPhong ? `Phòng ${it.SoPhong}` : 'Phòng'),
      SoPhong: it?.SoPhong ?? it?.soPhong ?? it?.Phong?.SoPhong ?? it?.Phong?.soPhong ?? null,
      SoDem: Number(it?.soDem ?? it?.SoDem ?? it?.Slngay ?? 1),
      GiaPhong: Number(it?.giaPhong ?? it?.GiaPhong ?? it?.Gia ?? 0),
      ThanhTien: Number(it?.thanhTien ?? it?.ThanhTien ?? it?.Tien ?? 0)
    }));

    const serverServices = Array.isArray(sum?.services) ? sum.services : [];
    const bookingServices = Array.isArray(dp?.services) ? dp.services : [];
    const mergedServices = [...serverServices, ...bookingServices, ...(selectedServices || [])];

    const merged: any = {
      customer,
      dates,
      Room: room,
      items: normalizedItems,
      invoiceRoomDetails: normalizedItems,
      services: mergedServices.length > 0 ? mergedServices : null,
      promotions: sum?.promotions ?? (dp ? dp?.promotions ?? null : null),
      money: sum?.money ?? (dp ? dp?.money ?? null : null),
      invoices: sum?.invoices ?? null
    };

    const firstInv = (sum?.invoices && Array.isArray(sum.invoices) && sum.invoices.length > 0) ? sum.invoices[0] : null;
    if (firstInv) {
      merged.IDHoaDon = merged.IDHoaDon ?? (firstInv.id ?? firstInv.IDHoaDon ?? firstInv.IdhoaDon ?? firstInv.idHoaDon ?? null);
      merged.idHoaDon = merged.idHoaDon ?? merged.IDHoaDon;
      merged.HoaDon = merged.HoaDon ?? firstInv;
    }

    return merged;
  };

  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [paymentInvoiceId, setPaymentInvoiceId] = useState<string | null>(null);
  // Persist QR links per booking so we can retrieve them later (useful for overdue flow)
  const [qrMap, setQrMap] = useState<Record<string, { qrUrl?: string; hoaDonId?: string }>>({});

    const [forceLateFeeInvoice, setForceLateFeeInvoice] = useState(false);
  const [invoiceModalVisible, setInvoiceModalVisible] = useState(false);
  const [invoiceData, setInvoiceData] = useState<any | null>(null);
  const [refreshAfterInvoiceClose, setRefreshAfterInvoiceClose] = useState(false);
  // Services state
  
  const [serviceModalVisible, setServiceModalVisible] = useState(false);
  const [selectedServices, setSelectedServices] = useState<Array<any>>([]);
  const [servicesTotal, setServicesTotal] = useState(0);

  // Track booking ids that should show "Xem hóa đơn" after adding services in 'using' mode
  const [viewInvoiceIds, setViewInvoiceIds] = useState<string[]>([]);

  // State cho tính năng Gia hạn (đổi phòng cho booking quá hạn)
  const [extendVisible, setExtendVisible] = useState(false);
  const [extendBookingId, setExtendBookingId] = useState<string | null>(null);
  const [extendBookingDetail, setExtendBookingDetail] = useState<any | null>(null);
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  
  // State mới cho gia hạn đầy đủ
  const [extendAvailability, setExtendAvailability] = useState<any | null>(null);
  const [extendType, setExtendType] = useState<1 | 2>(1); // 1 = SameDay, 2 = ExtraNight
  const [selectedExtendHour, setSelectedExtendHour] = useState<number>(15);
  const [extraNights, setExtraNights] = useState<number>(1);
  const [extendPaymentMethod, setExtendPaymentMethod] = useState<1 | 2 | 3>(1);
  const [extendNote, setExtendNote] = useState<string>('');
  const [extendSubmitting, setExtendSubmitting] = useState(false);
  const [extendInvoiceModalVisible, setExtendInvoiceModalVisible] = useState(false);
  const [extendInvoiceData, setExtendInvoiceData] = useState<any | null>(null);
  const [extendFlowPending, setExtendFlowPending] = useState(false); // true when QR/pay pending for extend
  // When a room-change extend is performed, backend may create the new booking/invoice
  // but we should only show the extend invoice after the operator completes the old booking.
  // Store pending extend results keyed by old booking id so `completeCheckout` can show them.
  const [pendingExtendResults, setPendingExtendResults] = useState<Record<string, any>>({});
  // When backend requires payment before completing a room-change extend,
  // we store the payload here and open the payment modal for the old invoice.
  const [pendingExtendPayload, setPendingExtendPayload] = useState<any | null>(null);
  const [pendingExtendOldInvoiceId, setPendingExtendOldInvoiceId] = useState<string | null>(null);

  // State for rendering a local confirm modal for room-change extend (avoid Modal.confirm stacking issues)
  const [roomChangeConfirmVisible, setRoomChangeConfirmVisible] = useState(false);
  const handleAddService = (row: BookingRow) => {
    setPaymentRow(row);
    setSelectedServices([]);
    setServicesTotal(0);
    setServiceModalVisible(true);
    setForceLateFeeInvoice(true);
  };

  const handleServicesChange = (services: any[], total: number) => {
    setSelectedServices(services || []);
    setServicesTotal(Number(total || 0));
  };

  // When user clicks "Xem chi tiết" (or the checkout action), open Invoice or Payment modal depending on viewMode
  const onViewInvoice = async (row: BookingRow) => {
    // If we're in checkout mode, show the Invoice modal directly for review/complete.
    if (viewMode === 'checkout') {
      try {
        setPaymentRow(row);
        setInvoiceData(null);

        let sum: any = null;
        try { sum = await checkoutApi.getSummary(row.IddatPhong); } catch { sum = null; }

        let dp: any = null;
        if (!sum) { try { dp = await fetchJson(`/api/DatPhong/${row.IddatPhong}`); } catch { dp = null; } }

        const customer = sum?.customer ?? (dp
          ? { name: dp?.TenKhachHang ?? dp?.idkhachHangNavigation?.HoTen, email: dp?.EmailKhachHang ?? dp?.idkhachHangNavigation?.Email }
          : { name: row.TenKhachHang, email: row.EmailKhachHang });

        const dates = sum?.dates ?? (dp
          ? { checkin: dp?.NgayNhanPhong, checkout: dp?.NgayTraPhong }
          : { checkin: row.NgayNhanPhong, checkout: row.NgayTraPhong });

        const room = sum?.room ?? (dp
          ? { id: dp?.Idphong ?? dp?.idphong, tenPhong: dp?.TenPhong ?? dp?.idphongNavigation?.TenPhong, soPhong: dp?.SoPhong ?? dp?.idphongNavigation?.SoPhong }
          : { id: row.Idphong, tenPhong: row.TenPhong, soPhong: row.SoPhong });

        let baseItems: any[] = [];
        if (Array.isArray(sum?.items) && sum.items.length > 0) baseItems = sum.items;
        else if (Array.isArray(row?.ChiTietDatPhongs) && row.ChiTietDatPhongs.length > 0) baseItems = row.ChiTietDatPhongs;
        else { try { const dpFull = dp ?? await fetchJson(`/api/DatPhong/${row.IddatPhong}`); if (Array.isArray(dpFull?.ChiTietDatPhongs) && dpFull.ChiTietDatPhongs.length > 0) baseItems = dpFull.ChiTietDatPhongs; } catch { /* ignore */ } }

        if (!baseItems || baseItems.length === 0) {
          baseItems = [{
            TenPhong: row.TenPhong ?? room?.tenPhong ?? 'Phòng',
            SoPhong: row.SoPhong ?? room?.soPhong ?? undefined,
            SoDem: row.SoDem ?? 1,
            GiaPhong: Math.round((row.TongTien ?? 0) / Math.max(1, row.SoDem ?? 1)),
            ThanhTien: row.TongTien ?? 0
          }];
        }

        const normalizedItems = (baseItems || []).map((it: any, idx: number) => ({
          ID: it?.id ?? it?.IDChiTiet ?? idx,
          TenPhong: it?.TenPhong ?? it?.tenPhong ?? it?.Phong?.TenPhong ?? it?.Phong?.tenPhong ?? (it?.SoPhong ? `Phòng ${it.SoPhong}` : 'Phòng'),
          SoPhong: it?.SoPhong ?? it?.soPhong ?? it?.Phong?.SoPhong ?? it?.Phong?.soPhong ?? null,
          SoDem: Number(it?.soDem ?? it?.SoDem ?? it?.Slngay ?? 1),
          GiaPhong: Number(it?.giaPhong ?? it?.GiaPhong ?? it?.Gia ?? 0),
          ThanhTien: Number(it?.thanhTien ?? it?.ThanhTien ?? it?.Tien ?? 0)
        }));

        // ensure services include server-side invoice services, any booking-level services and any client-selected ones
        const serverServices = Array.isArray(sum?.services) ? sum.services : [];
        const bookingServices = Array.isArray(dp?.services) ? dp.services : [];
        const mergedServices = [...serverServices, ...bookingServices, ...(selectedServices || [])];

        const merged: any = {
          customer,
          dates,
          Room: room,
          items: normalizedItems,
          invoiceRoomDetails: normalizedItems,
          services: mergedServices.length > 0 ? mergedServices : null,
          promotions: sum?.promotions ?? (dp ? dp?.promotions ?? null : null),
          money: sum?.money ?? (dp ? dp?.money ?? null : null),
          invoices: sum?.invoices ?? null
        };

        const firstInv = (sum?.invoices && Array.isArray(sum.invoices) && sum.invoices.length > 0) ? sum.invoices[0] : null;
        if (firstInv) {
          merged.IDHoaDon = merged.IDHoaDon ?? (firstInv.id ?? firstInv.IDHoaDon ?? firstInv.IdhoaDon ?? firstInv.idHoaDon ?? null);
          merged.idHoaDon = merged.idHoaDon ?? merged.IDHoaDon;
          merged.HoaDon = merged.HoaDon ?? firstInv;
        }

        setInvoiceData(merged);
        console.debug('[onViewInvoice] invoiceData prepared for', row.IddatPhong, merged);
        setInvoiceModalVisible(true);
      } catch (err) {
        message.error('Không thể mở hóa đơn');
      }
      return;
    }

    // Otherwise, open the payment modal (existing behavior)
    await openPaymentModal(row);
  };

  const submitPayment = async () => {
    try {
      const vals = await form.validateFields();
      if (!paymentRow || !summary) return;
      const key = `pay_${paymentRow.IddatPhong}`;
      message.loading({ content: 'Đang xử lý thanh toán...', key, duration: 0 });

      const method = vals.PhuongThucThanhToan; // 1=Cash, 2=QR
      const existingInvoiceId = summary?.invoices?.[0]?.IDHoaDon ?? summary?.invoices?.[0]?.id ?? null;

      if (existingInvoiceId) {
        // NẾU ĐÃ CÓ HÓA ĐƠN
        if (method === 2) {
          // --- QR (use server remaining or compute remaining excluding deposit) ---
          const serverRemaining = Number(summary?.soTienConLai ?? summary?.money?.soTienConLai ?? summary?.invoices?.[0]?.soTienConLai ?? 0);
          const tongTien = Number(summary?.money?.tongTien ?? form.getFieldValue('TongTien') ?? paymentRow?.TongTien ?? 0);
          const daTra = Number(summary?.invoices?.[0]?.tienThanhToan ?? summary?.money?.paidAmount ?? 0);
          const deposit = Number(summary?.money?.deposit ?? 0);
          const paidExcl = Math.max(0, daTra - deposit);
          const needToPay = serverRemaining > 0 ? serverRemaining : Math.max(0, tongTien - deposit - paidExcl);
          try {
            const resp: any = await checkoutApi.payQr({ IDDatPhong: paymentRow.IddatPhong, HoaDonId: existingInvoiceId, Amount: needToPay });
            const paymentUrl = resp?.paymentUrl ?? null;
            const hoaDonId = resp?.idHoaDon ?? existingInvoiceId ?? null;
            setQrUrl(paymentUrl);
            setPaymentInvoiceId(hoaDonId);
            // persist for later retrieval
            setQrMap((prev) => ({ ...(prev || {}), [String(paymentRow.IddatPhong)]: { qrUrl: paymentUrl ?? undefined, hoaDonId: hoaDonId ?? undefined } }));
            try { setExtendVisible(false); resetExtendState(); } catch {}
            setQrModalVisible(true);
          } catch (err: any) {
            console.error('payQr failed', err);
            message.error(err?.message || 'Không thể tạo liên kết QR');
          }
        } else {
          // --- TIỀN MẶT (SỬA) ---
          // Xác định booking quá hạn
          const isOverdueBooking = viewMode === 'overdue' || Number(paymentRow?.TrangThai ?? 0) === 5;

          // If overdue: call confirmPaid with IsOverdue to have backend persist late-fee and finalize payment.
          if (isOverdueBooking) {
            try {
              await checkoutApi.confirmPaid(paymentRow.IddatPhong, {
                Amount: 0, // indicate full payment — backend will compute late fee and set TienThanhToan = TongTien
                HoaDonId: existingInvoiceId,
                Note: vals.GhiChu,
                IsOverdue: true
              });

              msg.success('Cập nhật hóa đơn & thanh toán thành công');
              try {
                const fresh = await checkoutApi.getSummary(paymentRow.IddatPhong);
                setInvoiceData(buildInvoiceDataFromSummary(fresh, paymentRow));
                setSummary(mergeFreshSummary(summary, fresh));
                try {
                  if (detectExtendInSummary(fresh)) markBookingAsExtended(paymentRow?.IddatPhong);
                } catch (e) {}
              } catch (e) {
                console.warn('Failed to reload summary', e);
              }
              setInvoiceModalVisible(true);
            } catch (e: any) {
              message.error(e?.message || 'Thanh toán thất bại');
            }
            setPaymentModalVisible(false);
            form.resetFields();
            if (viewMode === 'checkout') {
              setRefreshAfterInvoiceClose(true);
              message.info('Phòng sẽ tiếp tục hiển thị trong danh sách "Trả phòng hôm nay" để bạn kiểm tra hóa đơn.');
            } else if (viewMode === 'overdue') {
              message.info('Thanh toán phí quá hạn đã ghi nhận. Phòng vẫn hiển thị trong danh sách "Quá hạn". Vui lòng hoàn tất trả phòng khi sẵn sàng.');
            }
            return;
          }

          // Non-overdue: compute remaining from fresh summary and call confirmPaid normally
          const freshSummary = await checkoutApi.getSummary(paymentRow.IddatPhong);
          const tongTien = Number(freshSummary?.money?.tongTien ?? form.getFieldValue('TongTien') ?? 0);
          const daTra = Number(freshSummary?.invoices?.[0]?.tienThanhToan ?? freshSummary?.money?.paidAmount ?? 0);
          const deposit = Number(freshSummary?.money?.deposit ?? 0);
          const daTraExcl = Math.max(0, daTra - deposit);
          const remaining = Math.max(0, tongTien - daTraExcl);

          console.log('[Payment] Số tiền còn thiếu:', { tongTien, daTra, deposit, remaining, isOverdueBooking });

          // Gọi confirmPaid để chốt đơn
          await checkoutApi.confirmPaid(paymentRow.IddatPhong, {
            Amount: remaining,
            HoaDonId: existingInvoiceId,
            Note: vals.GhiChu,
            IsOverdue: false
          });

          msg.success('Cập nhật hóa đơn & thanh toán thành công');
          try {
            const fresh = await checkoutApi.getSummary(paymentRow.IddatPhong);
            setInvoiceData(buildInvoiceDataFromSummary(fresh, paymentRow));
            setSummary(mergeFreshSummary(summary, fresh));
            try { if (detectExtendInSummary(fresh)) markBookingAsExtended(paymentRow?.IddatPhong); } catch (e) {}
          } catch (e) {
            console.warn('Failed to reload summary', e);
          }
          setInvoiceModalVisible(true);
        }
      } else {
        // NẾU CHƯA CÓ HÓA ĐƠN -> TẠO MỚI (Giữ nguyên)
        // Backend CreateInvoice mới đã sửa để nếu Status=2 thì TienThanhToan=TongTien
        const formTienPhong = Number(vals.TienPhong ?? 0);
        const formTongTien = Number(vals.TongTien ?? 0);
        const summaryRoom = Number(summary?.money?.roomTotal ?? 0);
        const summaryTotal = Number(summary?.money?.tongTien ?? 0);
        const svcTotal = Number(servicesTotal ?? summary?.money?.servicesTotal ?? 0);
        const roomTotalForCalc = formTienPhong > 0 ? formTienPhong : (summaryRoom > 0 ? summaryRoom : Number(paymentRow?.TongTien ?? 0));
        const subtotalCalc = roomTotalForCalc + svcTotal;
        const computedTotalWithVat = Math.round(subtotalCalc * 1.1);
        let safeTongTien = formTongTien || summaryTotal || computedTotalWithVat || Math.max(1, Math.round(roomTotalForCalc));
        if (safeTongTien <= 0) safeTongTien = Math.max(1, computedTotalWithVat, Math.round(roomTotalForCalc));

        // Determine amount to create on invoice. For online (QR) payments we should
        // create the invoice with the customer's remaining due (tongTien - paid - deposit)
        // so the QR link shows the correct amount. For cash (method !== 2) keep full safeTongTien.
        const totalFromServer = Number(summary?.money?.tongTien ?? summaryTotal ?? computedTotalWithVat);
        const deposit = Number(summary?.money?.deposit ?? 0);
        // Prefer canonical total paid reported by summary.money.paidAmount (includes deposit when present).
        // Only fall back to invoice.tienThanhToan + deposit when paidAmount is not available.
        const paidAmountFromSummary = Number(summary?.money?.paidAmount ?? NaN);
        let paidIncludingDeposit: number;
        if (!isNaN(paidAmountFromSummary)) {
          paidIncludingDeposit = Math.max(0, paidAmountFromSummary);
        } else {
          const invPaid = summary?.invoices && Array.isArray(summary.invoices) && summary.invoices.length > 0
            ? Number(summary.invoices[0].tienThanhToan ?? NaN)
            : NaN;
          paidIncludingDeposit = !isNaN(invPaid) ? Math.max(0, invPaid + deposit) : 0;
        }
        const remainingToPay = Math.round(Math.max(0, totalFromServer - paidIncludingDeposit));

        const invoiceAmountToUse = method === 2 ? remainingToPay : safeTongTien;

        // Provide deposit and previous payment so backend initializes TienThanhToan correctly
        const tienCoc = Math.round(Number(summary?.money?.deposit ?? paymentRow?.TienCoc ?? 0));
        const previousPayment = Math.max(0, Math.round(paidIncludingDeposit - tienCoc));

        const res = await checkoutApi.createInvoice({
          IDDatPhong: paymentRow.IddatPhong,
          PhuongThucThanhToan: method,
          // Tiền mặt (1) -> Gửi trạng thái 2 (Đã thanh toán). QR (2) -> Gửi 1 (Chờ)
          TrangThaiThanhToan: method === 1 ? 2 : 1,
          GhiChu: vals.GhiChu ?? '',
          TongTien: invoiceAmountToUse,
          TienPhong: Math.round(roomTotalForCalc),
          TienCoc: tienCoc,
          PreviousPayment: previousPayment,
          SoLuongNgay: vals.SoLuongNgay ?? 1,
          Services: []
        });

        if (method === 2) {
          // After creating invoice for online payment, explicitly request a QR payment link
          // for the customer's remaining due (we computed remainingToPay above).
            try {
              const hoaDonId = res?.idHoaDon ?? res?.id ?? null;
              const payResp: any = await checkoutApi.payQr({ IDDatPhong: paymentRow.IddatPhong, HoaDonId: hoaDonId, Amount: remainingToPay });
              const paymentUrl = payResp?.paymentUrl ?? payResp?.qr ?? null;
              setQrUrl(paymentUrl);
              setPaymentInvoiceId(hoaDonId);
              // persist for later retrieval
              setQrMap((prev) => ({ ...(prev || {}), [String(paymentRow.IddatPhong)]: { qrUrl: paymentUrl ?? undefined, hoaDonId: hoaDonId ?? undefined } }));
              // update summary/invoiceData from server but preserve previously-paid if server shows 0
            try {
              const fresh = await checkoutApi.getSummary(paymentRow.IddatPhong);
            if (fresh) {
                const prevPaid = Number(summary?.money?.paidAmount ?? 0);
                const freshPaid = Number(fresh?.money?.paidAmount ?? 0);
                if ((isNaN(freshPaid) || freshPaid === 0) && prevPaid > 0) {
                  fresh.money = { ...fresh.money, paidAmount: prevPaid };
                }
                setSummary(fresh);
                setInvoiceData(buildInvoiceDataFromSummary(fresh, paymentRow));
              }
            } catch (e) { /* ignore */ }
            try { setExtendVisible(false); resetExtendState(); } catch {}
            setQrModalVisible(true);
          } catch (e: any) {
            console.error('payQr after createInvoice failed', e);
            message.error(e?.message || 'Không thể tạo liên kết QR');
          }
        } else {
          msg.success('Thanh toán thành công');
          try {
            const fresh = await checkoutApi.getSummary(paymentRow.IddatPhong);
            setInvoiceData(buildInvoiceDataFromSummary(fresh, paymentRow));
            setSummary(fresh);
            try { if (detectExtendInSummary(fresh)) markBookingAsExtended(paymentRow?.IddatPhong); } catch (e) {}
            try { window.dispatchEvent(new CustomEvent('booking:services-updated', { detail: { id: paymentRow.IddatPhong } })); } catch {}
          } catch (e) { }
          setInvoiceModalVisible(true);
        }
      }

      setPaymentModalVisible(false);
      form.resetFields();
      // If there's a pending extend that requested payment first, resume it now
      if (pendingExtendPayload) {
        try {
          message.loading('Đang hoàn tất thao tác gia hạn sau khi thanh toán...');
          const resumeResult = await checkoutApi.extendStay(pendingExtendPayload);
          // Clear pending state immediately to avoid retries
          setPendingExtendPayload(null);
          setPendingExtendOldInvoiceId(null);

          if (resumeResult?.Success || resumeResult?.success) {
              const desc = resumeResult.ExtendDescription ?? resumeResult.extendDescription ?? '';
              const fee = resumeResult.TotalExtendFee ?? resumeResult.totalExtendFee ?? 0;
              const hoaDonId = resumeResult.NewInvoiceId ?? resumeResult.newInvoiceId ?? resumeResult.HoaDonId ?? resumeResult.hoaDonid;
              const qr = resumeResult.QrUrl ?? resumeResult.qrUrl;

              // If this was a room-change extend, DO NOT show the invoice/QR immediately.
              // Store the extend result as pending and show it only after the operator
              // completes the old booking (completeCheckout). This enforces the
              // required flow: pay old booking -> complete checkout -> show extend.
              if (pendingExtendPayload?.IsRoomChange) {
                try {
                  const oldId = String(pendingExtendPayload?.IddatPhong ?? pendingExtendPayload?.Iddatphong ?? pendingExtendPayload?.iddatPhong ?? pendingExtendPayload?.iddatphong);
                  setPendingExtendResults(prev => ({ ...(prev || {}), [oldId]: { ...(resumeResult || {}), qrUrl: qr ?? null, hoaDonId: hoaDonId ?? null, requiresQr: !!qr } }));
                  message.info('Gia hạn đã tạo. Vui lòng hoàn tất trả phòng cũ để hiển thị hóa đơn/giao dịch gia hạn.');
                } catch (e) {
                  // Fallback to showing immediately if storing fails
                  if (qr) {
                    // Ensure extend form/modal is closed before showing QR
                    try { setExtendVisible(false); resetExtendState(); } catch {}
                    setQrUrl(qr);
                    setPaymentInvoiceId(hoaDonId);
                    setExtendInvoiceData(resumeResult);
                    setExtendFlowPending(true);
                    setQrModalVisible(true);
                  } else {
                    // Ensure extend form/modal is closed before showing invoice
                    try { setExtendVisible(false); resetExtendState(); } catch {}
                    try { setPaymentRow(paymentRow ?? null); } catch {}
                    setExtendInvoiceData(resumeResult);
                    setExtendInvoiceModalVisible(true);
                  }
                }
              } else {
                // Non room-change extend: show immediately as before
                if (pendingExtendPayload?.PaymentMethod === 2 && qr) {
                  try { setExtendVisible(false); resetExtendState(); } catch {}
                  setQrUrl(qr);
                  setPaymentInvoiceId(hoaDonId);
                  setExtendInvoiceData(resumeResult);
                  setExtendFlowPending(true);
                  setQrModalVisible(true);
                } else {
                  try { setExtendVisible(false); resetExtendState(); } catch {}
                  try { setPaymentRow(paymentRow ?? null); } catch {}
                  setExtendInvoiceData(resumeResult);
                  setExtendInvoiceModalVisible(true);
                }
              }

              notification.success({ message: 'Gia hạn hoàn tất', description: desc || `Phí: ${Number(fee).toLocaleString()}đ`, placement: 'topRight' });
              try { await load(); } catch {}
            } else {
              message.error(resumeResult?.Message ?? resumeResult?.message ?? 'Không thể hoàn tất gia hạn sau khi thanh toán');
            }
        } catch (err: any) {
          console.error('Resume extend after payment failed', err);
          message.error(err?.message || 'Không thể hoàn tất gia hạn sau khi thanh toán');
        } finally {
          setPendingExtendPayload(null);
          setPendingExtendOldInvoiceId(null);
        }
      }
      // After payment: for 'checkout' keep the booking visible until invoice close;
      // for 'overdue' DO NOT reload the bookings list here so the room remains visible
      // — operator will press "Xác nhận trả phòng" (complete) when ready.
      if (viewMode === 'checkout') {
        setRefreshAfterInvoiceClose(true);
        message.info('Phòng sẽ tiếp tục hiển thị trong danh sách "Trả phòng hôm nay" để bạn kiểm tra hóa đơn.');
      } else if (viewMode === 'overdue') {
        message.info('Thanh toán phí quá hạn đã ghi nhận. Phòng vẫn hiển thị trong danh sách "Quá hạn". Vui lòng hoàn tất trả phòng khi sẵn sàng.');
      } else {
        await load();
      }
    } catch (err: any) {
      message.error(err?.message || 'Thanh toán thất bại');
    }
  };

  // Handler for adding services from modal
  const handleServiceModalAdd = async () => {
    if (selectedServices.length === 0) {
      message.warning('Vui lòng chọn ít nhất 1 dịch vụ');
      return;
    }

    // In 'using' mode: add services to invoice (create invoice if needed), then refresh summary
    if (viewMode === 'using') {
      if (!paymentRow) {
        message.error('Không có đặt phòng được chọn');
        return;
      }
      const key = `add_service_${paymentRow.IddatPhong}`;
      message.loading({ content: 'Đang thêm dịch vụ...', key, duration: 0 });
      try {
        // try to get current summary to find existing invoice
        let sum: any = null;
        try { sum = await checkoutApi.getSummary(paymentRow.IddatPhong); } catch { sum = null; }
        const existingInvoiceId = sum?.invoices?.[0]?.IDHoaDon ?? sum?.invoices?.[0]?.id ?? null;

        if (existingInvoiceId) {
          await checkoutApi.addServiceToInvoice({
            IDDatPhong: paymentRow.IddatPhong,
            DichVu: selectedServices.map(s => ({ IddichVu: String(s.serviceId), TienDichVu: Math.round(Number(s.price) || 0) }))
          });
        } else {
          // Do NOT auto-create invoice when adding services.
          // Require the operator to create an invoice first from the checkout/payment flow.
          message.destroy(key);
          message.error('Chưa có hóa đơn. Vui lòng tạo hóa đơn trước khi thêm dịch vụ.');
          return;
        }

        msg.success('Thêm dịch vụ thành công');
        // mark booking so UI can show "Xem hóa đơn"
        setViewInvoiceIds(prev => Array.from(new Set([...(prev || []), paymentRow.IddatPhong])));
        setServiceModalVisible(false);
        setSelectedServices([]);
        setServicesTotal(0);

  // refresh summary so payment/invoice modal shows newly added services
  try { const fresh = await checkoutApi.getSummary(paymentRow.IddatPhong); setSummary(mergeFreshSummary(summary, fresh)); } catch { /* ignore */ }
  // refresh bookings list so UI reflects new invoice/service rows
  await load();
  message.destroy(key);
      } catch (e: any) {
        message.error(e?.message || 'Thêm dịch vụ thất bại');
        message.destroy(key);
      }
      return;
    }

    // For checkout mode: require existing invoice and call backend
    try {
      const existingInvoiceId = summary?.invoices?.[0]?.IDHoaDon ?? summary?.invoices?.[0]?.id ?? null;
      if (!existingInvoiceId) {
        message.error('Chưa có hóa đơn để thêm dịch vụ!');
        return;
      }
      if (!paymentRow) {
        message.error('Không có đặt phòng được chọn');
        return;
      }
      await fetchJson('/api/Checkout/add-service-to-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ IDDatPhong: paymentRow.IddatPhong, DichVu: selectedServices.map(s => ({ IddichVu: String(s.serviceId), TienDichVu: Math.round(Number(s.price) || 0) })) })
      });
      msg.success('Thêm dịch vụ thành công');
      setServiceModalVisible(false);
      setSelectedServices([]);
      setServicesTotal(0);
        // refresh summary and bookings list
        if (paymentRow) {
        const fresh = await checkoutApi.getSummary(paymentRow.IddatPhong);
        console.debug('[handleServiceModalAdd] fresh summary after add-service', paymentRow.IddatPhong, fresh);
        setSummary(mergeFreshSummary(summary, fresh));
        // also update invoice modal data so checkout invoice form shows new services immediately
        setInvoiceData(buildInvoiceDataFromSummary(fresh, paymentRow));
        // notify other components that services/invoice changed for this booking
        try { window.dispatchEvent(new CustomEvent('booking:services-updated', { detail: { id: paymentRow.IddatPhong } })); } catch {}
      }
      await load();
    } catch (e: any) {
      message.error(e?.message || 'Thêm dịch vụ thất bại');
    }
  };

  const completeCheckout = async (row: BookingRow) => {
    Modal.confirm({
      title: `Hoàn tất trả phòng - ${row.IddatPhong}`,
      content: 'Xác nhận hoàn tất trả phòng? Sau khi xác nhận, sẽ mở form hóa đơn để bạn kiểm tra trước khi hoàn tất và gửi mail cho khách.',
      onOk: async () => {
        const key = `complete_${row.IddatPhong}`;
        message.loading({ content: 'Chuẩn bị dữ liệu hóa đơn...', key, duration: 0 });
        try {
          setPaymentRow(row);
          setInvoiceData(null);

          // Try load summary first, fallback to DatPhong details
          let sum: any = null;
          try { sum = await checkoutApi.getSummary(row.IddatPhong); } catch { sum = null; }

          let dp: any = null;
          if (!sum) { try { dp = await fetchJson(`/api/DatPhong/${row.IddatPhong}`); } catch { dp = null; } }

          const customer = sum?.customer ?? (dp
            ? { name: dp?.TenKhachHang ?? dp?.idkhachHangNavigation?.HoTen, email: dp?.EmailKhachHang ?? dp?.idkhachHangNavigation?.Email }
            : { name: row.TenKhachHang, email: row.EmailKhachHang });

          const dates = sum?.dates ?? (dp
            ? { checkin: dp?.NgayNhanPhong, checkout: dp?.NgayTraPhong }
            : { checkin: row.NgayNhanPhong, checkout: row.NgayTraPhong });

          const room = sum?.room ?? (dp
            ? { id: dp?.Idphong ?? dp?.idphong, tenPhong: dp?.TenPhong ?? dp?.idphongNavigation?.TenPhong, soPhong: dp?.SoPhong ?? dp?.idphongNavigation?.SoPhong }
            : { id: row.Idphong, tenPhong: row.TenPhong, soPhong: row.SoPhong });

          // Build base items (room lines)
          let baseItems: any[] = [];
          if (Array.isArray(sum?.items) && sum.items.length > 0) baseItems = sum.items;
          else if (Array.isArray(row?.ChiTietDatPhongs) && row.ChiTietDatPhongs.length > 0) baseItems = row.ChiTietDatPhongs;
          else {
            try { const dpFull = dp ?? await fetchJson(`/api/DatPhong/${row.IddatPhong}`); if (Array.isArray(dpFull?.ChiTietDatPhongs) && dpFull.ChiTietDatPhongs.length > 0) baseItems = dpFull.ChiTietDatPhongs; } catch { /* ignore */ }
          }

          if (!baseItems || baseItems.length === 0) {
            baseItems = [{
              TenPhong: row.TenPhong ?? room?.tenPhong ?? 'Phòng',
              SoPhong: row.SoPhong ?? room?.soPhong ?? undefined,
              SoDem: row.SoDem ?? 1,
              GiaPhong: Math.round((row.TongTien ?? 0) / Math.max(1, row.SoDem ?? 1)),
              ThanhTien: row.TongTien ?? 0
            }];
          }

          const normalizedItems = (baseItems || []).map((it: any, idx: number) => ({
            ID: it?.id ?? it?.IDChiTiet ?? idx,
            TenPhong: it?.TenPhong ?? it?.tenPhong ?? it?.Phong?.TenPhong ?? it?.Phong?.tenPhong ?? (it?.SoPhong ? `Phòng ${it.SoPhong}` : 'Phòng'),
            SoPhong: it?.SoPhong ?? it?.soPhong ?? it?.Phong?.SoPhong ?? it?.Phong?.soPhong ?? null,
            SoDem: Number(it?.soDem ?? it?.SoDem ?? it?.Slngay ?? 1),
            GiaPhong: Number(it?.giaPhong ?? it?.GiaPhong ?? it?.Gia ?? 0),
            ThanhTien: Number(it?.thanhTien ?? it?.ThanhTien ?? it?.Tien ?? 0)
          }));

          // merge server invoice services, booking-level services (if any) and any client-selected services
          const serverServices = Array.isArray(sum?.services) ? sum.services : [];
          const bookingServices = Array.isArray(dp?.services) ? dp.services : [];
          const mergedServices = [...serverServices, ...bookingServices, ...(selectedServices || [])];

          const merged: any = {
            customer,
            dates,
            Room: room,
            items: normalizedItems,
            invoiceRoomDetails: normalizedItems,
            services: mergedServices.length > 0 ? mergedServices : null,
            promotions: sum?.promotions ?? (dp ? dp?.promotions ?? null : null),
            money: sum?.money ?? (dp ? dp?.money ?? null : null),
            invoices: sum?.invoices ?? null
          };

          const firstInv = (sum?.invoices && Array.isArray(sum.invoices) && sum.invoices.length > 0) ? sum.invoices[0] : null;
          if (firstInv) {
            merged.IDHoaDon = merged.IDHoaDon ?? (firstInv.id ?? firstInv.IDHoaDon ?? firstInv.IdhoaDon ?? firstInv.idHoaDon ?? null);
            merged.idHoaDon = merged.idHoaDon ?? merged.IDHoaDon;
            merged.HoaDon = merged.HoaDon ?? firstInv;
          }

          setInvoiceData(merged);
          setInvoiceModalVisible(true);
          message.success({ content: 'Mở form hóa đơn để kiểm tra trước khi hoàn tất trả phòng', key, duration: 2 });
        } catch (e: any) {
          message.error({ content: e?.message || 'Không thể tải dữ liệu hóa đơn', key, duration: 3 });
        }
      }
    });
  };

  const markPaid = async (row: BookingRow) => {
    // Open the payment modal so the operator can choose cash or QR and submit once —
    // this removes the extra confirm dialog and lets the modal handle creating invoice / showing QR.
    try { setExtendVisible(false); resetExtendState(); } catch {}
    setPaymentRow(row);
      try {
      const sum = await checkoutApi.getSummary(row.IddatPhong);
      setSummary(mergeFreshSummary(summary, sum));
      setInvoiceData(buildInvoiceDataFromSummary(sum, row));
    } catch {
      // keep existing summary to preserve previously-paid amounts
      setInvoiceData(null);
    }
    try { setExtendVisible(false); resetExtendState(); } catch {}
    setPaymentModalVisible(true);
  };

  // KHÔNG cộng tay phụ phí ở FE để tránh nhân 2, nhân 3.
  const handlePayOverdue = async (row: BookingRow) => {
    try {
      // Lấy summary chuẩn từ backend (trong đó backend đã tự tính phí trả phòng muộn cho trạng thái Quá hạn)
      const sum = await checkoutApi.getSummary(row.IddatPhong);

      // Không thêm dịch vụ tạm ở FE để tránh cộng trùng
      setSelectedServices([]);
      setServicesTotal(0);

      // Mở PaymentModal dựa trên dữ liệu server
      try { setExtendVisible(false); resetExtendState(); } catch {}
      setPaymentRow(row);
      setSummary(mergeFreshSummary(summary, sum));
      setInvoiceData(buildInvoiceDataFromSummary(sum, row));
      // If we're in the Overdue view, force the late-fee invoice form to be used when modal opens
      if (viewMode === 'overdue') setForceLateFeeInvoice(true);
      try { setExtendVisible(false); resetExtendState(); } catch {}
      setPaymentModalVisible(true);

      // If we've previously generated a QR for this booking, show it so operator can re-use it
      try {
        const bookingId = row?.IddatPhong ?? (row as any)?.iddatPhong ?? null;
        const existing = bookingId ? qrMap[String(bookingId)] : null;
        if (existing?.qrUrl) {
          setQrUrl(existing.qrUrl ?? null);
          setPaymentInvoiceId(existing.hoaDonId ?? null);
          try { setExtendVisible(false); resetExtendState(); } catch {}
          setQrModalVisible(true);
        }
      } catch {}

      // Trả về true để CheckoutTable có thể đánh dấu đã xử lý "Thanh toán phí quá hạn"
      return true;
    } catch (e: any) {
      message.error(e?.message || 'Không thể mở màn hình thanh toán phí trả phòng muộn');
      return false;
    }
  };

  // Mở modal gia hạn cho booking quá hạn hoặc đang sử dụng
  const handleExtend = async (row: BookingRow) => {
    try {
      setExtendBookingId(row.IddatPhong);
      setExtendVisible(true);
      setLoadingRooms(true);
      
      // Reset state
      setExtendType(1);
      setSelectedExtendHour(15);
      setExtraNights(1);
      setExtendPaymentMethod(1);
      setExtendNote('');
      setSelectedRoomId(null);
      setExtendAvailability(null);
      
      // Lấy thông tin chi tiết booking
      let detail: any = null;
      try { detail = await fetchJson(`/api/DatPhong/${row.IddatPhong}`); } catch { detail = null; }
      setExtendBookingDetail(detail || row);
      
      // Gọi API kiểm tra khả năng gia hạn
      const rawAvailability = await checkoutApi.checkExtendAvailability(row.IddatPhong);
      
      // Normalize response (API trả về camelCase, frontend dùng PascalCase)
      const nextBookingRaw = rawAvailability?.nextBooking ?? rawAvailability?.NextBooking ?? null;
      const availability = {
        CanExtend: rawAvailability?.canExtend ?? rawAvailability?.CanExtend ?? false,
        CanExtendSameRoom: rawAvailability?.canExtendSameRoom ?? rawAvailability?.CanExtendSameRoom ?? false,
        HasNextBooking: rawAvailability?.hasNextBooking ?? rawAvailability?.HasNextBooking ?? false,
        Message: rawAvailability?.message ?? rawAvailability?.Message ?? '',
        NextBooking: nextBookingRaw ? {
          IddatPhong: nextBookingRaw?.iddatPhong ?? nextBookingRaw?.IddatPhong ?? '',
          CustomerName: nextBookingRaw?.customerName ?? nextBookingRaw?.CustomerName ?? 'Khách',
          CheckinDate: nextBookingRaw?.checkinDate ?? nextBookingRaw?.CheckinDate ?? null,
        } : null,
        AvailableRooms: (rawAvailability?.availableRooms ?? rawAvailability?.AvailableRooms ?? []).map((room: any) => ({
          Idphong: room?.idphong ?? room?.Idphong ?? room?.roomId ?? '',
          TenPhong: room?.tenPhong ?? room?.TenPhong ?? room?.roomName ?? '',
          SoPhong: room?.soPhong ?? room?.SoPhong ?? room?.roomNumber ?? '',
          TenLoaiPhong: room?.tenLoaiPhong ?? room?.TenLoaiPhong ?? room?.roomTypeName ?? '',
          GiaMotDem: room?.giaMotDem ?? room?.GiaMotDem ?? room?.basePricePerNight ?? 0,
          UrlAnhPhong: (() => {
            const raw = room?.urlAnhPhong ?? room?.UrlAnhPhong ?? room?.roomImageUrl ?? room?.roomImageUrl ?? '';
            if (!raw) return '';
            // Absolute URLs or root-relative paths should be used as-is
            if (raw.startsWith('http') || raw.startsWith('/')) return raw;
            // If API returned only filename (e.g. "presidential-suite-501.webp"), prefix with expected folder
            if (raw.includes('/img/')) return raw;
            return `/img/room/${raw}`;
          })(),
          SoNguoiToiDa: room?.soNguoiToiDa ?? room?.SoNguoiToiDa ?? room?.maxOccupancy ?? 2,
          TrangThai: room?.TrangThai ?? room?.trangThai ?? room?.status ?? '',
          PromotionName: room?.promotionName ?? room?.PromotionName ?? null,
          DiscountPercent: room?.discountPercent ?? room?.DiscountPercent ?? null,
          DiscountedPrice: room?.discountedPrice ?? room?.DiscountedPrice ?? null,
          Description: room?.description ?? room?.Description ?? room?.moTa ?? room?.MoTa ?? null,
        })),
        SameDayOptions: (rawAvailability?.sameDayOptions ?? rawAvailability?.SameDayOptions ?? []).map((opt: any) => ({
          Hour: opt?.hour ?? opt?.Hour,
          Description: opt?.description ?? opt?.Description,
          Percentage: opt?.percentage ?? opt?.Percentage,
          Fee: opt?.fee ?? opt?.Fee,
          FeeWithVat: opt?.feeWithVat ?? opt?.FeeWithVat,
        })),
        ExtraNightRate: rawAvailability?.extraNightRate ?? rawAvailability?.ExtraNightRate ?? 0,
        ExtraNightRateWithVat: rawAvailability?.extraNightRateWithVat ?? rawAvailability?.ExtraNightRateWithVat ?? 0,
        // Thêm field kiểm tra đã gia hạn trong ngày chưa
        HasSameDayExtended: rawAvailability?.hasSameDayExtended ?? rawAvailability?.HasSameDayExtended ?? false,
      };
      
      console.log('Extend availability:', availability); // Debug log
      setExtendAvailability(availability);
      
      // Nếu đã gia hạn trong ngày rồi, auto-select "Thêm đêm"
      if (availability.HasSameDayExtended) {
        setExtendType(2); // Force to ExtraNight
      }
      
      // Nếu có danh sách phòng trống từ API
      if (availability?.AvailableRooms?.length > 0) {
        // Client-side safety: chỉ lấy những phòng có trạng thái "Trống" nếu thông tin trạng thái có sẵn
        const filtered = (availability.AvailableRooms || []).filter((r: any) => {
          const status = (r.TrangThai ?? r.trangThai ?? r.status ?? '').toString().trim().toLowerCase();
          return status === 'trống';
        });
        if (filtered.length !== (availability.AvailableRooms || []).length) {
          console.warn('Filtered out rooms that are not empty from extend availability list');
        }
        setAvailableRooms(filtered);
      } else {
        // Fallback: tìm phòng trống
        const guests = detail?.SoNguoi ?? detail?.soNguoi ?? 1;
        const extendCheckout = dayjs().add(1, 'day').format('YYYY-MM-DD');
        const available = await findAvailableRooms(dayjs().format('YYYY-MM-DD'), extendCheckout, guests);
        // Fallback safety: only keep rooms reported as 'Trống' by rooms API
        const fallbackFiltered = (available || []).filter((r: any) => {
          const status = (r.TrangThai ?? r.trangThai ?? r.status ?? '').toString().trim().toLowerCase();
          return status === 'trống';
        });
        if (fallbackFiltered.length !== (available || []).length) console.warn('Fallback: filtered out non-empty rooms');
        setAvailableRooms(fallbackFiltered || []);
      }
    } catch (e: any) {
      message.error(e?.message || 'Không thể tải thông tin gia hạn');
    } finally {
      setLoadingRooms(false);
    }
  };

  // Tính phí gia hạn hiển thị
  const calculateExtendFee = () => {
    if (!extendAvailability) return { fee: 0, feeWithVat: 0, description: '' };
    
    // Nếu đổi phòng, dùng giá phòng mới; nếu không, dùng giá phòng cũ
    let roomRate = extendAvailability.ExtraNightRate || 0;
    let roomRateWithVat = extendAvailability.ExtraNightRateWithVat || 0;
    
    if (selectedRoomId && availableRooms.length > 0) {
      const selectedRoom = availableRooms.find((r: any) => 
        (r.Idphong ?? r.idphong ?? r.RoomId ?? r.roomId) === selectedRoomId
      );
      if (selectedRoom) {
        const newRoomPrice = selectedRoom.GiaMotDem ?? selectedRoom.giaMotDem ?? 
                            selectedRoom.GiaCoBanMotDem ?? selectedRoom.giaCoBanMotDem ?? 
                            selectedRoom.basePricePerNight ?? 0;
        roomRate = newRoomPrice;
        roomRateWithVat = Math.round(newRoomPrice * 1.10);
      }
    }
    
    if (extendType === 1) {
      // Gia hạn trong ngày - tính theo % giá phòng (mới nếu đổi phòng)
      const option = extendAvailability.SameDayOptions?.find((o: any) => o.Hour === selectedExtendHour);
      if (option) {
        // Nếu đổi phòng, tính lại phí theo giá phòng mới
        if (selectedRoomId && availableRooms.length > 0) {
          const percentage = option.Percentage / 100;
          const fee = Math.round(roomRate * percentage);
          const feeWithVat = Math.round(fee * 1.10);
          return { fee, feeWithVat, description: option.Description };
        }
        return { fee: option.Fee, feeWithVat: option.FeeWithVat, description: option.Description };
      }
    } else {
      // Gia hạn qua đêm - dùng giá phòng mới nếu đổi phòng
      return { 
        fee: roomRate * extraNights, 
        feeWithVat: roomRateWithVat * extraNights, 
        description: `Thêm ${extraNights} đêm` 
      };
    }
    return { fee: 0, feeWithVat: 0, description: '' };
  };

  // Thực hiện gia hạn
  const doExtend = async () => {
    console.log('[doExtend] Called. extendBookingId=', extendBookingId, 'selectedRoomId=', selectedRoomId, 'CanExtendSameRoom=', extendAvailability?.CanExtendSameRoom);
    
    if (!extendBookingId) return message.warning('Không có booking để gia hạn');
    
    // TRƯỜNG HỢP 1: Đổi phòng → Bắt buộc checkout trước, tạo booking mới
    // Nếu có selectedRoomId HOẶC nếu CanExtendSameRoom = false (buộc phải đổi phòng) và có phòng để chọn
    const isRoomChange = !!selectedRoomId || (!extendAvailability?.CanExtendSameRoom && availableRooms.length > 0 && !!selectedRoomId);
    console.log('[doExtend] isRoomChange=', isRoomChange);
    
    if (isRoomChange) {
      console.log('[doExtend] Opening confirm dialog for room change (state-driven modal)...');
      // Use state-driven modal instead of Modal.confirm to guarantee it's rendered within the component
      setRoomChangeConfirmVisible(true);
      return;
    }
    
    // TRƯỜNG HỢP 2: Không đổi phòng (gia hạn giờ trong ngày) → Cộng phí vào hóa đơn cũ
    console.log('[doExtend] No room change, calling doExtendSameRoom...');
    await doExtendSameRoom();
  };
  
  // Gia hạn KHÔNG đổi phòng - cộng phí vào hóa đơn cũ
  const doExtendSameRoom = async () => {
    setExtendSubmitting(true);
    try {
      const payload: any = {
        IddatPhong: extendBookingId,
        ExtendType: extendType,
        PaymentMethod: extendPaymentMethod,
        Note: extendNote || undefined,
        IsRoomChange: false, // Không đổi phòng
      };
      
      if (extendType === 1) {
        payload.NewCheckoutHour = selectedExtendHour;
      } else {
        payload.ExtraNights = extraNights;
      }
      
      const result = await checkoutApi.extendStay(payload);
      
      if (result?.Success || result?.success) {
        const desc = result.ExtendDescription ?? result.extendDescription ?? '';
        const fee = result.TotalExtendFee ?? result.totalExtendFee ?? 0;
        const hoaDonId = result.HoaDonId ?? result.hoaDonId;
        const bookingId = result.IddatPhong ?? result.iddatPhong ?? extendBookingId;
        const isPaidNow = result.IsPaidNow ?? result.isPaidNow ?? false;
        const paymentStatus = result.PaymentStatus ?? result.paymentStatus ?? '';
        
        // Đóng modal gia hạn
        setExtendVisible(false);
        resetExtendState();

        // Immediately update local UI state for the booking so the new totals appear instantly
          try {
          // Use returned fields from API when present
          const newBookingTotal = result.TongTienBooking ?? result.tongTienBooking ?? result.TongTienBooking ?? null;
          const bookingPaymentStatus = result.BookingTrangThaiThanhToan ?? result.bookingTrangThaiThanhToan ?? null;
          const newCheckoutRaw = result.NewCheckout ?? result.newCheckout ?? result.NewCheckoutDate ?? result.newCheckoutDate ?? null;
          const newCheckoutStr = newCheckoutRaw ? String(newCheckoutRaw).slice(0, 10) : null;

          setData(prev => (prev || []).map(b => {
            if ((b.IddatPhong ?? '') === (bookingId ?? '')) {
              // compute new SoDem if we have new checkout date and original checkin
              let newSoDem = b.SoDem;
              if (newCheckoutStr && b.NgayNhanPhong) {
                try {
                  const checkin = String(b.NgayNhanPhong).slice(0,10);
                  const nights = Math.max(1, dayjs(newCheckoutStr).diff(dayjs(checkin), 'day'));
                  newSoDem = nights;
                } catch (dErr) {
                  // fallback: keep existing
                }
              }

              return {
                ...b,
                TongTien: newBookingTotal != null ? Number(newBookingTotal) : b.TongTien,
                TrangThaiThanhToan: bookingPaymentStatus != null ? Number(bookingPaymentStatus) : b.TrangThaiThanhToan,
                NgayTraPhong: newCheckoutStr ?? b.NgayTraPhong,
                SoDem: newSoDem
              } as BookingRow;
            }
            return b;
          }));
        } catch (uiErr) {
          console.warn('Failed to update booking row UI after extend', uiErr);
        }

        // Also attempt to fetch fresh summary (best-effort) to keep detailed modal and invoice modal consistent
        let freshSummary: any = null;
        try { freshSummary = await checkoutApi.getSummary(bookingId); } catch (e) { console.warn('Không lấy được summary sau gia hạn', e); }

        // Update summaryMap and global invoice/summary state immediately if we got a fresh summary
        if (freshSummary) {
          setSummaryMap(prev => ({ ...(prev || {}), [bookingId]: freshSummary }));
          try {
            // Update the invoice modal data and payment summary so any open invoice modal shows the updated fees
            setInvoiceData(buildInvoiceDataFromSummary(freshSummary, data.find((b: BookingRow) => b.IddatPhong === bookingId)));
            setSummary(mergeFreshSummary(summary, freshSummary));
            try { if (detectExtendInSummary(freshSummary)) markBookingAsExtended(bookingId); } catch (e) {}
          } catch (inner) {
            console.warn('Failed to set invoiceData/summary after freshSummary', inner);
          }
        }

        // Tìm paymentRow tương ứng (from updated data)
        const bookingRow = (data.find((b: BookingRow) => b.IddatPhong === bookingId) || paymentRow);
        
        // Nếu thanh toán QR, hiển thị QR trước
        const qrUrl = result.QrUrl ?? result.qrUrl;
        if (extendPaymentMethod === 2 && qrUrl) {
          try { setExtendVisible(false); resetExtendState(); } catch {}
          setQrUrl(qrUrl);
          setPaymentInvoiceId(hoaDonId);
          setQrModalVisible(true);
          // Mark that extend flow is pending so after QR confirm we open ExtendInvoiceModal
          setExtendFlowPending(true);
          setExtendInvoiceData(result);
          setPaymentRow(bookingRow);
        } else if (extendPaymentMethod === 3) {
          // Thanh toán sau: vẫn mở ExtendInvoiceModal nhưng hiển thị trạng thái chưa thanh toán
          notification.success({
            message: 'Gia hạn thành công (Thanh toán sau)',
            description: `${desc}. Phí: ${Number(fee).toLocaleString()}đ đã cộng vào hóa đơn. Khách sẽ thanh toán khi checkout.`,
            placement: 'topRight',
            duration: 6
          });
          try { setExtendVisible(false); resetExtendState(); } catch {}
          try { setExtendVisible(false); resetExtendState(); } catch {}
          setPaymentRow(bookingRow);
          setExtendInvoiceData(result);
          setExtendInvoiceModalVisible(true);
        } else {
          // Tiền mặt (PaymentMethod = 1): mở ExtendInvoiceModal luôn
          notification.success({
            message: 'Gia hạn thành công',
            description: `${desc}. Phí: ${Number(fee).toLocaleString()}đ (đã thanh toán & cộng vào hóa đơn)`,
            placement: 'topRight',
            duration: 5
          });
          
          setPaymentRow(bookingRow);
          setExtendInvoiceData(result);
          setExtendInvoiceModalVisible(true);
          try { if (Number(fee) > 0) markBookingAsExtended(bookingId); } catch (e) {}
        }
        
        // Emit event để cập nhật rooms
        try {
          const rooms = await getRooms();
          window.dispatchEvent(new CustomEvent('rooms:refreshed', { detail: { rooms } }));
        } catch (err) {
          // ignore
        }
        // Refresh booking list so UI reflects any booking-state changes (e.g., checkout date moved)
        try {
          await load();

          // If this was an ExtraNight extend and the new checkout date is no longer today,
          // remove the booking from the current list when in the "checkout" view so it disappears.
          try {
            const newCheckoutRaw = result.NewCheckout ?? result.newCheckout ?? result.NewCheckoutDate ?? result.newCheckoutDate ?? null;
            if (extendType === 2 && newCheckoutRaw) {
              const todayStr = dayjs().format('YYYY-MM-DD');
              const newCheckoutStr = String(newCheckoutRaw).slice(0, 10);
              if (viewMode === 'checkout' && newCheckoutStr !== todayStr) {
                // For QR payment (PaymentMethod = 2) we should NOT remove the booking until
                // the operator confirms payment (presses "Đã thanh toán"). Only remove when
                // payment is not QR or it was already paid immediately.
                const paidNow = result.IsPaidNow ?? result.isPaidNow ?? false;
                const pm = result.PaymentMethod ?? result.paymentMethod ?? extendPaymentMethod;
                if (pm !== 2 || paidNow) {
                  setData(prev => (prev || []).filter(b => (b.IddatPhong ?? '') !== (bookingId ?? '')));
                  setSummaryMap(prev => {
                    const updated = { ...(prev || {}) };
                    delete updated[bookingId];
                    return updated;
                  });
                } else {
                  // QR pending: keep booking visible. Optionally mark it as having a pending QR payment.
                  setData(prev => (prev || []).map(b => {
                    if ((b.IddatPhong ?? '') === (bookingId ?? '')) {
                      return { ...b, TrangThaiThanhToan: 1 } as BookingRow;
                    }
                    return b;
                  }));
                }
              }
            }
          } catch (innerErr) {
            console.warn('Error checking new checkout after extend', innerErr);
          }
        } catch (e) { console.warn('Failed to reload bookings after extend', e); }
      } else {
        message.error(result?.Message ?? result?.message ?? 'Gia hạn thất bại');
      }
    } catch (e: any) {
      message.error(e?.message || 'Gia hạn thất bại');
    } finally {
      setExtendSubmitting(false);
    }
  };
  
  // Gia hạn CÓ đổi phòng - checkout cũ + tạo booking mới + hóa đơn mới
  const doExtendWithRoomChange = async () => {
    setExtendSubmitting(true);
    let payload: any = null;
    try {
      // Lấy thông tin phòng mới
      const newRoom = availableRooms.find((r: any) => 
        (r.Idphong ?? r.idphong ?? r.RoomId ?? r.roomId) === selectedRoomId
      );
      
      if (!newRoom) {
        message.error('Không tìm thấy thông tin phòng mới');
        setExtendSubmitting(false);
        return;
      }
      
      payload = {
        IddatPhong: extendBookingId,
        ExtendType: extendType,
        PaymentMethod: extendPaymentMethod,
        Note: extendNote || undefined,
        IsRoomChange: true, // Có đổi phòng
        NewRoomId: selectedRoomId,
        NewRoomInfo: {
          Idphong: newRoom.Idphong ?? newRoom.idphong ?? newRoom.roomId,
          TenPhong: newRoom.TenPhong ?? newRoom.tenPhong ?? newRoom.roomName,
          GiaMotDem: newRoom.GiaMotDem ?? newRoom.giaMotDem ?? newRoom.basePricePerNight,
          TenLoaiPhong: newRoom.TenLoaiPhong ?? newRoom.tenLoaiPhong ?? newRoom.roomTypeName,
        }
      };
      
      if (extendType === 1) {
        payload.NewCheckoutHour = selectedExtendHour;
      } else {
        payload.ExtraNights = extraNights;
      }
      
      const result = await checkoutApi.extendStay(payload);
      
      if (result?.Success || result?.success) {
        const desc = result.ExtendDescription ?? result.extendDescription ?? '';
        const fee = result.TotalExtendFee ?? result.totalExtendFee ?? 0;
        const newBookingId = result.NewBookingId ?? result.newBookingId;
        const newInvoiceId = result.NewInvoiceId ?? result.newInvoiceId;
        
        notification.success({
          message: 'Đổi phòng & Gia hạn thành công',
          description: (
            <div>
              <div>{desc}</div>
              <div>Phí gia hạn: {Number(fee).toLocaleString()}đ</div>
              {newBookingId && <div>Booking mới: {newBookingId}</div>}
              {newInvoiceId && <div>Hóa đơn mới: {newInvoiceId}</div>}
            </div>
          ),
          placement: 'topRight',
          duration: 8
        });
        
        // Close the extend modal first to avoid modal stacking issues, then show the
        // appropriate UI for the new booking/invoice (QR or invoice modal).
        try {
          setExtendVisible(false);
          resetExtendState();
        } catch {}

        // If payment is QR and server provided a QR url, show QR modal first
        const qrUrl = result.QrUrl ?? result.qrUrl;
        const hoaDonId = result.NewInvoiceId ?? result.newInvoiceId ?? result.HoaDonId ?? result.hoaDonId;
        if (extendPaymentMethod === 2 && qrUrl) {
          // QR: keep extend data and mark the extend flow as pending so after QR confirm
          // we open the ExtendInvoiceModal rather than the regular InvoiceModal.
          setExtendInvoiceData(result);
          setQrUrl(qrUrl);
          setPaymentInvoiceId(hoaDonId);
          setExtendFlowPending(true);
          try { setPaymentRow({ IddatPhong: extendBookingId } as any); } catch {}
          setQrModalVisible(true);
        } else {
          // Cash or pay-later: DO NOT show the ExtendInvoiceModal immediately.
          // Instead store the result and show it after the operator completes the old booking.
          try {
            if (extendBookingId) {
              setPendingExtendResults(prev => ({ ...(prev || {}), [String(extendBookingId)]: result }));
              message.info('Gia hạn đã tạo. Vui lòng hoàn tất trả phòng cũ để hiện hóa đơn gia hạn.');
              } else {
              // Fallback: if we don't have old booking id, show immediately
              try { setExtendVisible(false); resetExtendState(); } catch {}
              try { setPaymentRow({ IddatPhong: extendBookingId } as any); } catch {}
              setExtendInvoiceData(result);
              setExtendInvoiceModalVisible(true);
            }
            try { if (Number(fee) > 0) markBookingAsExtended(extendBookingId); } catch (e) {}
          } catch (storeErr) {
            // If storing fails for any reason, show the extend invoice immediately
            setExtendInvoiceData(result);
            setExtendInvoiceModalVisible(true);
          }
        }
        
        // Refresh data
        await load();
        
        // Emit event để cập nhật rooms
        try {
          const rooms = await getRooms();
          window.dispatchEvent(new CustomEvent('rooms:refreshed', { detail: { rooms } }));
        } catch (err) {
          // ignore
        }
      } else {
        message.error(result?.Message ?? result?.message ?? 'Đổi phòng & gia hạn thất bại');
      }
    } catch (e: any) {
      // If backend returned a 400 and indicates payment is required before extend,
      // prepare the payment modal for the old booking/invoice and store the payload
      // so we can retry the extend after payment completes.
      console.error('doExtendWithRoomChange error', e);
      const data = e?.response?.data ?? e?.data ?? null;
      if (data && data.requirePaymentBeforeExtend) {
        const remaining = data.remaining ?? 0;
        const oldInvoiceId = data.oldInvoiceId ?? null;
        message.info('Booking cũ còn tiền chưa thanh toán — mở form thanh toán để hoàn tất trước khi đổi phòng.');
        // Save pending payload so submitPayment can resume extend after successful payment
        setPendingExtendPayload(payload);
        setPendingExtendOldInvoiceId(oldInvoiceId ?? null);
        // Open payment modal for the OLD booking (extendBookingId is the old booking)
        const bookingRow = data && data.oldBookingId ? data.oldBookingId : extendBookingId;
        const row = data && data.oldBookingId ? data.oldBookingId : extendBookingId;
        try {
          const targetRow = data && data.oldBookingId ? data.oldBookingId : extendBookingId;
        } catch {}
        // Find booking row in current data
        const oldRow = data && data.oldBookingId ? data.oldBookingId : (data && data.iddatPhong ? data.iddatPhong : extendBookingId);
        const found = data && data.iddatPhong ? data.iddatPhong : extendBookingId;
        // Use existing utilities to open payment modal
        const existingRow = data && data.iddatPhong ? data.iddatPhong : extendBookingId;
        const bookingObj = data && data.iddatPhong ? data.iddatPhong : extendBookingId;
        // Try to find full BookingRow object in `data` state
        const bookingRowObj = (data && data.iddatPhong) ? (data.iddatPhong) : (data && data.oldBookingId) ? (data.oldBookingId) : (data && data.oldInvoiceId) ? paymentRow : null;
        // Fallback: find by extendBookingId
        const rowObj = (data && data.iddatPhong) ? data.iddatPhong : extendBookingId;
        const resolvedRow = (data && data.iddatPhong) ? data.iddatPhong : extendBookingId;
        // Find booking in current `data` state
        const bookingToPay = (data && data.iddatPhong)
          ? data.iddatPhong
          : data && data.oldInvoiceId
            ? data.oldInvoiceId
            : extendBookingId;
        const foundRowObj = (data && data.iddatPhong)
          ? data.iddatPhong
          : (data && data.oldInvoiceId)
            ? data.oldInvoiceId
            : extendBookingId;
        // Simplify: lookup booking in current list by id
        const bookingObjFound = data.find ? data.find((b: any) => b.IddatPhong === extendBookingId) : null;
        // Open payment modal for the old booking
        try {
          if (bookingObjFound) {
            await openPaymentModal(bookingObjFound as BookingRow);
          } else {
            // fallback - load summary and set paymentRow manually
            const tmp: BookingRow = { IddatPhong: extendBookingId!, TongTien: 0, TrangThai: 3, TrangThaiThanhToan: 1 } as any;
            setPaymentRow(tmp);
            setSummaryLoading(true);
            try { const sum = await checkoutApi.getSummary(extendBookingId!); setSummary(mergeFreshSummary(summary, sum)); setInvoiceData(buildInvoiceDataFromSummary(sum, data.find((b: BookingRow) => b.IddatPhong === extendBookingId))); } catch { }
            setSummaryLoading(false);
            setPaymentModalVisible(true);
          }
        } catch (openErr) {
          console.warn('Failed to open payment modal for pending extend', openErr);
          setPaymentModalVisible(true);
        }
        setExtendSubmitting(false);
        return;
      }

      message.error(e?.message || 'Đổi phòng & gia hạn thất bại');
    } finally {
      setExtendSubmitting(false);
    }
  };
  
  // Reset state gia hạn
  const resetExtendState = () => {
    setSelectedRoomId(null);
    setAvailableRooms([]);
    setExtendBookingId(null);
    setExtendBookingDetail(null);
    setExtendAvailability(null);
    setExtendType(1);
    setSelectedExtendHour(15);
    setExtraNights(1);
    setExtendPaymentMethod(1);
    setExtendNote('');
  };

  const due = useMemo(() => {
    const todayStr = dayjs().format('YYYY-MM-DD');
    return (data || []).filter((d: BookingRow) => {
      // Skip already completed ones in general
      if ((d.TrangThai ?? 0) === 4 && viewMode !== 'overdue') return false;
      const checkout = (d.NgayTraPhong || '').slice(0, 10);
      if (viewMode === 'using') {
        if ((d.TrangThai ?? 0) !== 3) return false;
      } else if (viewMode === 'overdue') {
        // Show only overdue bookings (TrangThai == 5)
        if ((d.TrangThai ?? 0) !== 5) return false;
      } else {
        // checkout mode: trả phòng hôm nay
        if (!checkout || checkout !== todayStr) return false;
        // Show both 'Đang sử dụng (3)' and recently 'Đã hoàn tất (4)' in the "Trả phòng hôm nay" view
        if (!((d.TrangThai ?? 0) === 3 || (d.TrangThai ?? 0) === 4)) return false;
      }
      if (keyword && keyword.trim()) {
        const k = keyword.trim().toLowerCase();
        return (String(d.IddatPhong || '') + ' ' + (d.TenKhachHang || '') + ' ' + (d.EmailKhachHang || '')).toLowerCase().includes(k);
      }
      return true;
    });
  }, [data, keyword, viewMode, selectedDate]);

  const roomLines = useMemo(() => {
    if (!paymentRow) return [] as string[];
    const infos = collectRoomInfos(paymentRow?.ChiTietDatPhongs, paymentRow || undefined);
    return infos.map((info) => (info.ten ?? (info.so ? `Phòng ${info.so}` : '-')));
  }, [paymentRow]);
  
  // For the table display, include late-fee into the shown TongTien when in overdue view
// For the table display, adjust TongTien for overdue view to match PaymentModalWithLateFee logic
const tableData = useMemo(() => {
  if (!due) return [] as BookingRow[];

  const lateRegex = /trả phòng muộn|phí trả phòng muộn|phu.?phi.?tra phong muon/i;

  return (due || []).map((r: BookingRow) => {
    // Chỉ xử lý đặc biệt cho tab Quá hạn
    if (viewMode === 'overdue') {
      const id = String(r.IddatPhong ?? '');
      const sum = summaryMap?.[id];
      const money = sum?.money;
      
      // Khi TrangThai = 5 (quá hạn), luôn hiển thị TrangThaiThanhToan = 1 (chưa thanh toán)
      // vì còn phí quá hạn chưa được thanh toán
      if (!money) return { ...r, TrangThaiThanhToan: 1 };

      const roomTotal = Number(money.roomTotal ?? 0);
      const serviceTotal = Number(money.serviceTotal ?? 0);

      // Lấy lateFee trực tiếp từ backend (money.lateFee)
      // Backend tính riêng lateFee, không gộp vào serviceTotal
      const serverLateFee = Number(money.lateFee ?? 0);

      // Nếu backend không có lateFee, fallback tìm từ services list
      const services = Array.isArray(sum?.services) ? sum.services : [];
      const lateFeeFromServices = services.reduce((acc: number, s: any) => {
        const name = String(s.tenDichVu ?? s.TenDichVu ?? s.ten ?? '');
        if (!lateRegex.test(name)) return acc;
        const amt = Number(
          s.thanhTien ??
          s.ThanhTien ??
          s.tienDichVu ??
          s.TienDichVu ??
          0
        );
        return acc + amt;
      }, 0);

      const lateFee = serverLateFee > 0 ? serverLateFee : lateFeeFromServices;

      // Công thức: (room + service) * 1.1 + lateFee
      // lateFee là phí phạt, KHÔNG cộng VAT
      const subTotal = roomTotal + serviceTotal;
      const vat = Math.round(subTotal * 0.1);
      const displayTotal = Math.round(subTotal + vat + lateFee);

      // Khi TrangThai = 5 (quá hạn), cần hiển thị TrangThaiThanhToan = 1 (chưa thanh toán)
      // vì còn phí quá hạn chưa được thanh toán
      return { ...r, TongTien: displayTotal, TrangThaiThanhToan: 1 };
    }

    // Các tab khác giữ nguyên
    return r;
  });
}, [due, viewMode, summaryMap]);
const shouldUseLateFeeModal =
  // Nếu đã bật cờ (từ luồng Thanh toán phí quá hạn hoặc QR) thì luôn dùng form late-fee
  forceLateFeeInvoice
  // Hoặc nếu đang ở tab Quá hạn và dữ liệu thể hiện rõ là booking Quá hạn / có phí muộn
  || (
    viewMode === 'overdue' && (
      Number(invoiceData?.TrangThai ?? paymentRow?.TrangThai ?? 0) === 5
      || Number(
           invoiceData?.money?.lateFee ??
           (paymentRow as any)?.TienPhuPhi ??
           (paymentRow as any)?.tienPhuPhi ??
           0
         ) > 0
      || (Array.isArray(paymentRow?.ChiTietDatPhongs) &&
          paymentRow.ChiTietDatPhongs.some((s: any) =>
            /trả phòng muộn|phí trả phòng muộn|phu.?phi.?tra phong muon/i
              .test(String(s.tenDichVu ?? s.TenDichVu ?? s.dichVu ?? ''))
          ))
      || (Array.isArray(invoiceData?.services) &&
          invoiceData.services.some((s: any) =>
            /trả phòng muộn|phí trả phòng muộn|phu.?phi.?tra phong muon/i
              .test(String(s.tenDichVu ?? s.TenDichVu ?? s.ten ?? ''))
          ))
      || (Array.isArray(invoiceData?.items) &&
          invoiceData.items.some((s: any) =>
            /trả phòng muộn|phí trả phòng muộn|phu.?phi.?tra phong muon/i
              .test(String(s.tenDichVu ?? s.TenDichVu ?? s.dichVu ?? s.TenDichVu ?? ''))
          ))
    )
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <Slidebar />
      <div style={{ marginLeft: 280 }}>
        <HeaderSection showStats={false} />
        <main style={{ padding: '0px 60px' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 8px 24px rgba(2,6,23,0.06)' }}>
            <h2 style={{ marginBottom: 16 }}>Quản lý trả phòng</h2>
          {contextHolder}

          <Card style={{ marginBottom: 12 }}>
            <Space wrap>
              <Input.Search placeholder="Tìm mã đặt / khách / email" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
              <DatePicker value={selectedDate} onChange={(d) => setSelectedDate(d)} format="YYYY-MM-DD" allowClear={false} />
              <Button onClick={() => setSelectedDate(dayjs())}>Hôm nay</Button>
              <Button onClick={load}>Tải lại</Button>
            </Space>
          </Card>

          <Card>
            <CheckoutTable
              data={tableData}
              loading={loading}
           onPay={markPaid}
           onOpenPaymentForm={openPaymentModal}
              onComplete={completeCheckout}
                onAddService={handleAddService}
                onPayOverdue={handlePayOverdue}
              onViewInvoice={onViewInvoice}
              onExtend={handleExtend}
              viewInvoiceIds={viewInvoiceIds}
              viewMode={viewMode}
              onViewChange={(mode) => setViewMode(mode)}
            />
          </Card>

          <PaymentModal
            visible={paymentModalVisible}
            paymentRow={paymentRow}
            summary={summary}
            summaryLoading={summaryLoading}
            form={form}
            roomLines={roomLines}
            selectedServices={selectedServices}
            servicesTotal={servicesTotal}
            onCancel={() => { setPaymentModalVisible(false); setPaymentRow(null); form.resetFields(); }}
            onSubmit={submitPayment}
          />

          <Modal
            title={paymentRow ? `Thêm dịch vụ cho ${paymentRow.IddatPhong}` : 'Thêm dịch vụ'}
            open={serviceModalVisible}
            width={900}
            onCancel={() => { setServiceModalVisible(false); setSelectedServices([]); setServicesTotal(0); }}
            footer={[
              <Button key="cancel" onClick={() => { setServiceModalVisible(false); setSelectedServices([]); setServicesTotal(0); }}>Hủy</Button>,
              <Button key="add" type="primary" onClick={handleServiceModalAdd}>Thêm dịch vụ</Button>
            ]}
          >
            <div style={{ minHeight: 320 }}>
              <ServicesSelector onServicesChange={handleServicesChange} />
              {selectedServices && selectedServices.length > 0 && (
                <div style={{ marginTop: 12, textAlign: 'right' }}>
                  <div style={{ fontSize: 14 }}><strong>Tổng dịch vụ:</strong> {Number(servicesTotal).toLocaleString()} đ</div>
                </div>
              )}
            </div>
          </Modal>

          {/* Confirm modal for room-change extend (rendered inside component to avoid stacking issues) */}
          <Modal
            title="Xác nhận đổi phòng và gia hạn"
            open={roomChangeConfirmVisible}
            centered
            zIndex={1500}
            onOk={async () => {
              try {
                console.log('[roomChangeConfirm] User confirmed room change. Calling doExtendWithRoomChange...');
                setRoomChangeConfirmVisible(false);
                await doExtendWithRoomChange();
              } catch (err) {
                console.error('[roomChangeConfirm] doExtendWithRoomChange failed', err);
              }
            }}
            onCancel={() => setRoomChangeConfirmVisible(false)}
            okText="Xác nhận trả phòng & đổi phòng"
            cancelText="Hủy"
          >
            <div>
              <p>Để gia hạn với phòng mới, hệ thống sẽ:</p>
              <ol>
                <li><strong>Trả phòng hiện tại</strong> và xuất hóa đơn cho booking cũ</li>
                <li><strong>Tạo booking mới</strong> cho phòng đã chọn</li>
                <li><strong>Xuất hóa đơn mới</strong> cho phần gia hạn</li>
              </ol>
              <p style={{ color: '#cf1322', marginTop: 12 }}>Bạn có muốn tiếp tục?</p>
            </div>
          </Modal>
          <Modal
            title="Thanh toán online - Quét mã QR" 
            open={qrModalVisible}
            width={'900'}
            centered
            onCancel={() => { setQrModalVisible(false); setQrUrl(null); setPaymentModalVisible(false); setPaymentRow(null); form.resetFields(); load(); }}
            footer={[
              <Button key="close" onClick={() => { setQrModalVisible(false); setQrUrl(null); setPaymentModalVisible(false); setPaymentRow(null); form.resetFields(); load(); }}>Đóng</Button>,
              <Button key="paid" type="primary" onClick={async () => {
                const key = `confirm_${paymentRow?.IddatPhong ?? 'unknown'}`;
                message.loading({ content: 'Đang xác nhận thanh toán...', key, duration: 0 });
                try {
                  if (paymentRow) {
                    // Xác định booking quá hạn
                    const isOverdueBooking = viewMode === 'overdue' || Number(paymentRow?.TrangThai ?? 0) === 5;
                    
                    const payload: any = {
                      IsOnline: true,
                      IsOverdue: isOverdueBooking
                    };
                    if (paymentInvoiceId) payload.HoaDonId = paymentInvoiceId;

                    const resp = await checkoutApi.confirmPaid(paymentRow.IddatPhong, payload);
                    if (resp !== null) {
                      message.success({ content: 'Xác nhận thanh toán thành công', key, duration: 2 });
                      try {
                        const fresh = await checkoutApi.getSummary(paymentRow.IddatPhong);
                        setInvoiceData(fresh);
                        try { if (detectExtendInSummary(fresh)) markBookingAsExtended(paymentRow?.IddatPhong); } catch (e) {}
                      } catch { /* ignore */ }
                    } else {
                      message.warning({ content: 'Không nhận được phản hồi xác nhận từ server', key, duration: 3 });
                    }
                  }
                } catch (err: any) {
                  message.error({ content: err?.message || 'Lỗi khi xác nhận thanh toán', key, duration: 3 });
                } finally {
                  // Close QR modal and payment modal, then open invoice modal for review
                  setQrModalVisible(false);
                  setQrUrl(null);
                  setPaymentModalVisible(false);

                  const isOverdueBooking = Number(paymentRow?.TrangThai ?? invoiceData?.TrangThai ?? 0) === 5;
                  if (isOverdueBooking && viewMode === 'overdue') setForceLateFeeInvoice(true);

                  // If this QR was for an extend flow, open the ExtendInvoiceModal with the data we saved
                          if (extendFlowPending && extendInvoiceData) {
                                    try { setExtendVisible(false); resetExtendState(); } catch {}
                                    try { setPaymentRow(extendInvoiceData?.paymentRow ?? paymentRow ?? null); } catch {}
                                    setExtendInvoiceModalVisible(true);
                                    setExtendFlowPending(false);
                                  } else {
                                    setInvoiceModalVisible(true);
                                  }
                  form.resetFields();
                  if (viewMode !== 'overdue') {
                    setPaymentRow(null);
                    await load();
                  }
                }
              }}>Đã thanh toán</Button>
          ]}>
            {qrUrl ? (
              <div style={{ textAlign: 'center' }}>
                <img
                  src={qrUrl ?? undefined}
                  alt="QR"
                  style={{ width: 420, height: 420, display: 'block', margin: '0 auto' }}
                />
                {/* link removed: use image only */}
              </div>
            ) : (<div>Không tìm thấy liên kết thanh toán</div>)}
          </Modal>

  {shouldUseLateFeeModal ? (
  <InvoiceModalWithLateFee
    visible={invoiceModalVisible}
    invoiceData={invoiceData}
    paymentRow={paymentRow}
    selectedServices={selectedServices}
    servicesTotal={servicesTotal}
                onClose={async () => {
  setInvoiceModalVisible(false);
  setInvoiceData(null);
  setSelectedServices([]);
  setServicesTotal(0);
  setForceLateFeeInvoice(false); // reset cờ
  if (refreshAfterInvoiceClose) {
    await load();
    setRefreshAfterInvoiceClose(false);
  }
}}
               onComplete={async (id) => {
  try {
    if (typeof id !== 'undefined' && id !== null) {
      try {
        const hoaDonId =
          invoiceData?.IDHoaDon ??
          invoiceData?.idHoaDon ??
          invoiceData?.HoaDon?.IDHoaDon ??
          invoiceData?.HoaDon?.IdhoaDon ??
          null;

        // 👉 BẤT KỂ ONLINE HAY TIỀN MẶT:
        // Khi bấm "Hoàn tất trả phòng" ở tab Quá hạn, ta coi như đã thu đủ tiền.
        // Gọi ConfirmPaid với IsOnline = true để backend:
        // - TienThanhToan = TongTien
        // - TrangThaiThanhToan = 2
        // - DatPhong.TrangThaiThanhToan = 2
        try {
          // Compute remaining amount (canonical total minus paid excluding deposit)
          const total = Number(invoiceData?.money?.tongTien ?? invoiceData?.HoaDon?.TongTien ?? invoiceData?.TongTien ?? 0);
          const paidAmount = Number(invoiceData?.money?.paidAmount ?? invoiceData?.HoaDon?.TienThanhToan ?? invoiceData?.invoices?.[0]?.tienThanhToan ?? 0);
          const deposit = Number(invoiceData?.money?.deposit ?? 0);
          const paidExclDeposit = Math.max(0, paidAmount - deposit);
          const remaining = Math.round(Math.max(0, total - paidExclDeposit));

          const payload: any = hoaDonId ? { HoaDonId: hoaDonId, Amount: remaining } : { Amount: remaining };
          await checkoutApi.confirmPaid(id, payload);
        } catch (e) {
          console.warn('[onComplete] confirmPaid (full) failed', e);
        }
      } catch (e) {
        console.warn('[onComplete] confirmPaid (full) failed', e);
      }

      // Sau khi chốt thanh toán full, hoàn tất trả phòng
      await checkoutApi.completeCheckout(id);

      if (paymentRow && paymentRow.EmailKhachHang) {
        try {
          await reviewApi.sendReviewEmail(paymentRow.IddatPhong, paymentRow.EmailKhachHang);
          message.info('Email cảm ơn kèm liên kết đánh giá đã được gửi tới khách hàng');
        } catch (emailErr: any) {
          console.warn('Failed to send review email:', emailErr);
        }
      }

      msg.success('Hoàn tất trả phòng');
      setInvoiceModalVisible(false);
      setForceLateFeeInvoice(false);
      await load();
      // After completing checkout for this booking, if there is a pending extend result
      // created earlier for this booking (room-change), show the ExtendInvoiceModal now.
      try {
        const pending = pendingExtendResults?.[String(id)];
        if (pending) {
          try { setExtendVisible(false); resetExtendState(); } catch {}
          try { setPaymentRow(pending?.paymentRow ?? { IddatPhong: id } as any); } catch {}
          setExtendInvoiceData(pending);
          setExtendInvoiceModalVisible(true);
          // clean up pending
          setPendingExtendResults(prev => {
            const copy = { ...(prev || {}) };
            delete copy[String(id)];
            return copy;
          });
        }
      } catch (e) { console.warn('Failed to show pending extend invoice after completeCheckout', e); }
    } else {
      throw new Error('Không có id để hoàn tất trả phòng');
    }
  } catch (e: any) {
    message.error(e?.message || 'Hoàn tất thất bại');
  }
}}
              />
            ) : (
              <InvoiceModal
                visible={invoiceModalVisible}
                invoiceData={invoiceData}
                paymentRow={paymentRow}
                selectedServices={selectedServices}
                servicesTotal={servicesTotal}
                onClose={async () => {
                  setInvoiceModalVisible(false);
                  setInvoiceData(null);
                  setSelectedServices([]);
                  setServicesTotal(0);
                  setForceLateFeeInvoice(false);
                  if (refreshAfterInvoiceClose) {
                    await load();
                    setRefreshAfterInvoiceClose(false);
                  }
                }}
                onComplete={async (id) => {
                  try {
                    if (typeof id !== 'undefined' && id !== null) {
                      try {
                        const hoaDonId = invoiceData?.IDHoaDon ?? invoiceData?.idHoaDon ?? invoiceData?.IDHoaDon ?? null;

                        const total = Number(invoiceData?.money?.tongTien ?? invoiceData?.HoaDon?.TongTien ?? invoiceData?.TongTien ?? 0);
                        const paidAmount = Number(invoiceData?.money?.paidAmount ?? invoiceData?.HoaDon?.TienThanhToan ?? invoiceData?.invoices?.[0]?.tienThanhToan ?? 0);
                        const deposit = Number(invoiceData?.money?.deposit ?? 0);
                        const paidExclDeposit = Math.max(0, paidAmount - deposit);
                        const remaining = Math.round(Math.max(0, total - paidExclDeposit));

                        if (hoaDonId) {
                          await checkoutApi.confirmPaid(id, { HoaDonId: hoaDonId, Amount: remaining });
                        } else {
                          await checkoutApi.confirmPaid(id, { Amount: remaining });
                        }
                      } catch (e) { console.warn('[onComplete] confirmPaid failed', e); }
                      
                      await checkoutApi.completeCheckout(id);
                      if (paymentRow && paymentRow.EmailKhachHang) {
                        try { await reviewApi.sendReviewEmail(paymentRow.IddatPhong, paymentRow.EmailKhachHang); message.info('Email cảm ơn kèm liên kết đánh giá đã được gửi tới khách hàng'); } catch (emailErr: any) { console.warn('Failed to send review email:', emailErr); }
                      }
                      msg.success('Hoàn tất trả phòng');
                      setInvoiceModalVisible(false);
                      await load();
                      // show pending extend invoice if exists for this booking
                      try {
                        const pending = pendingExtendResults?.[String(id)];
                        if (pending) {
                          try { setExtendVisible(false); resetExtendState(); } catch {}
                          try { setPaymentRow(pending?.paymentRow ?? { IddatPhong: id } as any); } catch {}
                          setExtendInvoiceData(pending);
                          setExtendInvoiceModalVisible(true);
                          setPendingExtendResults(prev => {
                            const copy = { ...(prev || {}) };
                            delete copy[String(id)];
                            return copy;
                          });
                        }
                      } catch (e) { console.warn('Failed to show pending extend invoice after completeCheckout', e); }
                    } else { throw new Error('Không có id để hoàn tất trả phòng'); }
                  } catch (e: any) { message.error(e?.message || 'Hoàn tất thất bại'); }
                }}
              />
            )
          }

          {/* Extend invoice modal shown after a successful same-room extend */}
          <ExtendInvoiceModal
            visible={extendInvoiceModalVisible}
            extendData={extendInvoiceData}
            onClose={async () => {
              setExtendInvoiceModalVisible(false);
              setExtendInvoiceData(null);
              setPaymentRow(null);
              try { await load(); } catch {};
            }}
          />

          {/* Modal Gia hạn phòng */}
          <Modal
            title="Gia hạn phòng"
            open={extendVisible}
            onCancel={() => { setExtendVisible(false); resetExtendState(); }}
            width={800}
            footer={[
              <Button key="cancel" onClick={() => { setExtendVisible(false); resetExtendState(); }}>Hủy</Button>,
              <Button 
                key="ok" 
                type="primary" 
                onClick={doExtend} 
                loading={extendSubmitting}
                disabled={!extendAvailability?.CanExtend || (!extendAvailability?.CanExtendSameRoom && !selectedRoomId)}
              >
                Xác nhận gia hạn ({Number(calculateExtendFee().feeWithVat).toLocaleString()}đ)
              </Button>
            ]}
          >
            {loadingRooms ? (
              <div style={{ textAlign: 'center', padding: 40 }}>Đang tải thông tin...</div>
            ) : (
              <>
                {/* Thông tin booking */}
                {extendBookingDetail && (
                  <div style={{ marginBottom: 16, padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                    <div><strong>Mã đặt phòng:</strong> {extendBookingDetail?.IddatPhong ?? extendBookingDetail?.iddatPhong}</div>
                    <div><strong>Phòng hiện tại:</strong> {extendBookingDetail?.TenPhong ?? extendBookingDetail?.tenPhong ?? extendBookingDetail?.Idphong ?? extendBookingDetail?.idphong}</div>
                    <div><strong>Checkout hiện tại:</strong> {(extendBookingDetail?.NgayTraPhong ?? extendBookingDetail?.ngayTraPhong) 
                      ? `12:00 ${new Date(extendBookingDetail.NgayTraPhong ?? extendBookingDetail.ngayTraPhong).toLocaleDateString('vi-VN')}` 
                      : '—'}</div>
                  </div>
                )}

                {/* Thông báo nếu có booking mới */}
                {extendAvailability?.HasNextBooking && (
                  <div style={{ marginBottom: 16, padding: 12, background: '#fff7e6', border: '1px solid #ffc069', borderRadius: 8 }}>
                    <div style={{ fontWeight: 600, color: '#d46b08' }}>⚠️ Phòng có khách mới check-in</div>
                    <div style={{ fontSize: 13, color: '#8c4a00' }}>
                      Khách: {extendAvailability.NextBooking?.CustomerName} - Check-in: {new Date(extendAvailability.NextBooking?.CheckinDate).toLocaleDateString('vi-VN')}
                    </div>
                    <div style={{ fontSize: 13, marginTop: 4 }}>{extendAvailability.Message}</div>
                  </div>
                )}

                {/* Không thể gia hạn */}
                {!extendAvailability?.CanExtend && (
                  <div style={{ marginBottom: 16, padding: 12, background: '#fff2f0', border: '1px solid #ffccc7', borderRadius: 8 }}>
                    <div style={{ fontWeight: 600, color: '#cf1322' }}>❌ Không thể gia hạn</div>
                    <div style={{ fontSize: 13 }}>{extendAvailability?.Message}</div>
                  </div>
                )}

                {/* Loại gia hạn */}
                {extendAvailability?.CanExtend && (
                  <>
                    {/* Thông báo đã gia hạn trong ngày */}
                    {extendAvailability?.HasSameDayExtended && (
                      <div style={{ marginBottom: 16, padding: 12, background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 8 }}>
                        <div style={{ fontWeight: 600, color: '#d48806' }}>⚠️ Đã gia hạn trong ngày</div>
                        <div style={{ fontSize: 13, marginTop: 4 }}>
                          Booking này đã được gia hạn trong ngày 1 lần. Bạn chỉ có thể chọn <strong>"Thêm đêm"</strong> để tiếp tục gia hạn.
                        </div>
                      </div>
                    )}
                    
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontWeight: 600, marginBottom: 8 }}>Loại gia hạn:</div>
                      <Space>
                        <Button 
                          type={extendType === 1 ? 'primary' : 'default'}
                          onClick={() => !extendAvailability?.HasSameDayExtended && setExtendType(1)}
                          disabled={extendAvailability?.HasSameDayExtended}
                          title={extendAvailability?.HasSameDayExtended ? 'Đã gia hạn trong ngày, không thể gia hạn thêm' : ''}
                        >
                          Trong ngày (Late checkout) {extendAvailability?.HasSameDayExtended && '✓'}
                        </Button>
                        <Button 
                          type={extendType === 2 ? 'primary' : 'default'}
                          onClick={() => setExtendType(2)}
                        >
                          Thêm đêm
                        </Button>
                      </Space>
                    </div>

                    {/* Options cho gia hạn trong ngày */}
                    {extendType === 1 && extendAvailability?.SameDayOptions && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontWeight: 600, marginBottom: 8 }}>Chọn giờ checkout mới:</div>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          {extendAvailability.SameDayOptions.map((opt: any) => (
                            <div 
                              key={opt.Hour}
                              onClick={() => setSelectedExtendHour(opt.Hour)}
                              style={{ 
                                padding: '12px 20px', 
                                border: selectedExtendHour === opt.Hour ? '2px solid #1890ff' : '1px solid #d9d9d9',
                                borderRadius: 8,
                                cursor: 'pointer',
                                background: selectedExtendHour === opt.Hour ? '#e6f7ff' : '#fff',
                                textAlign: 'center',
                                minWidth: 140
                              }}
                            >
                              <div style={{ fontWeight: 700 }}>{opt.Description}</div>
                              <div style={{ color: '#8c8c8c', fontSize: 12 }}>({opt.Percentage}% giá phòng)</div>
                              <div style={{ fontWeight: 700, color: '#1890ff', marginTop: 4 }}>
                                {Number(opt.FeeWithVat).toLocaleString()}đ
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Options cho thêm đêm */}
                    {extendType === 2 && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontWeight: 600, marginBottom: 8 }}>Số đêm thêm:</div>
                        <Space>
                          <Button onClick={() => setExtraNights(Math.max(1, extraNights - 1))}>-</Button>
                          <span style={{ minWidth: 40, textAlign: 'center', display: 'inline-block', fontWeight: 700, fontSize: 18 }}>{extraNights}</span>
                          <Button onClick={() => setExtraNights(extraNights + 1)}>+</Button>
                          <span style={{ marginLeft: 16, color: '#8c8c8c' }}>
                            × {Number(extendAvailability.ExtraNightRateWithVat).toLocaleString()}đ/đêm
                          </span>
                        </Space>
                        <div style={{ marginTop: 8, fontWeight: 700, color: '#1890ff' }}>
                          Tổng: {Number(extendAvailability.ExtraNightRateWithVat * extraNights).toLocaleString()}đ
                        </div>
                      </div>
                    )}

                    {/* Chọn phòng mới nếu cần */}
                    {!extendAvailability?.CanExtendSameRoom && availableRooms.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontWeight: 600, marginBottom: 8 }}>Chọn phòng mới:</div>
                        <List
                          dataSource={availableRooms}
                          locale={{ emptyText: 'Không có phòng trống' }}
                          renderItem={(item: any) => {
                            const id = item.Idphong ?? item.idphong ?? item.RoomId;
                            const isSelected = selectedRoomId === id;
                            const price = item.GiaMotDem ?? item.giaCoBanMotDem ?? 0;

                            return (
                              <List.Item 
                                style={{ 
                                  background: isSelected ? '#e6f7ff' : undefined, 
                                  cursor: 'pointer', 
                                  padding: 12, 
                                  border: isSelected ? '2px solid #1890ff' : '1px solid #f0f0f0', 
                                  borderRadius: 8, 
                                  marginBottom: 8 
                                }} 
                                onClick={() => setSelectedRoomId(id)}
                              >
                                <div style={{ display: 'flex', gap: 12, width: '100%', alignItems: 'center' }}>
                                  <div style={{ flex: '0 0 100px', height: 70, borderRadius: 8, overflow: 'hidden', background: '#f8fafc' }}>
                                    <Image 
                                      src={item.UrlAnhPhong ?? item.urlAnhPhong ?? '/img/placeholder.png'} 
                                      width={100} 
                                      height={70} 
                                      preview={false} 
                                      style={{ objectFit: 'cover' }}
                                    />
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700 }}>{item.TenPhong ?? item.tenPhong ?? `Phòng ${item.SoPhong ?? item.soPhong}`}</div>
                                    <div style={{ color: '#8c8c8c', fontSize: 13 }}>{item.TenLoaiPhong ?? item.tenLoaiPhong}</div>
                                  </div>
                                  <div style={{ fontWeight: 700, color: '#1890ff' }}>
                                    {Number(price).toLocaleString()}đ/đêm
                                  </div>
                                </div>
                              </List.Item>
                            );
                          }}
                        />
                      </div>
                    )}

                    {/* Phương thức thanh toán */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontWeight: 600, marginBottom: 8 }}>Phương thức thanh toán:</div>
                      <Space wrap>
                        <Button 
                          type={extendPaymentMethod === 1 ? 'primary' : 'default'}
                          onClick={() => setExtendPaymentMethod(1)}
                        >
                          💵 Tiền mặt (thanh toán ngay)
                        </Button>
                        <Button 
                          type={extendPaymentMethod === 2 ? 'primary' : 'default'}
                          onClick={() => setExtendPaymentMethod(2)}
                        >
                          📱 QR / Online
                        </Button>
                        <Button 
                          type={extendPaymentMethod === 3 ? 'primary' : 'default'}
                          onClick={() => setExtendPaymentMethod(3)}
                          style={{ borderColor: extendPaymentMethod === 3 ? '#faad14' : undefined, color: extendPaymentMethod === 3 ? '#fff' : '#d48806', background: extendPaymentMethod === 3 ? '#faad14' : undefined }}
                        >
                          ⏳ Thanh toán sau (khi checkout)
                        </Button>
                      </Space>
                    </div>

                    {/* Ghi chú */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontWeight: 600, marginBottom: 8 }}>Ghi chú:</div>
                      <Input.TextArea 
                        value={extendNote}
                        onChange={(e) => setExtendNote(e.target.value)}
                        placeholder="Ghi chú (tùy chọn)"
                        rows={2}
                      />
                    </div>

                    {/* Tóm tắt phí */}
                    <div style={{ padding: 16, background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span>Phí gia hạn:</span>
                        <span>{Number(calculateExtendFee().fee).toLocaleString()}đ</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span>VAT (10%):</span>
                        <span>{Number(calculateExtendFee().feeWithVat - calculateExtendFee().fee).toLocaleString()}đ</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 16, paddingTop: 8, borderTop: '1px solid #b7eb8f' }}>
                        <span>Tổng cộng:</span>
                        <span style={{ color: '#52c41a' }}>{Number(calculateExtendFee().feeWithVat).toLocaleString()}đ</span>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </Modal>

          </div>
        </main>
      </div>
    </div>
  );
};

export default CheckoutManager;