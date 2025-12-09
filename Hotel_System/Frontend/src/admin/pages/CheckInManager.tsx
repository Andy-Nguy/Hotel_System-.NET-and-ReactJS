import React, { useEffect, useMemo, useState } from 'react';
import Slidebar from '../components/Slidebar';
import HeaderSection from '../components/HeaderSection';
import { Button, Card, Input, message, Space, Modal, DatePicker, Form } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import checkoutApi from '../../api/checkout.Api';
import checkinApi from '../../api/checkinApi';
import invoiceApi from '../../api/invoiceApi';

import CheckinTable from '../components/checkin/CheckinTable';
import PaymentModal from '../components/checkout/PaymentModal';
// InvoiceCheckin removed — UnifiedInvoiceModal is used instead
import UnifiedInvoiceModal from '../components/checkout/UnifiedInvoiceModal'; // Unified invoice modal for all scenarios
import ServicesSelector from '../../components/ServicesSelector';

import CheckinSection from "../components/checkin/CheckinSectionNewFixed";
import FormService from '../components/checkin/FormService';
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
  TienThanhToan?: number; // Amount prepaid (separate from TongTien)
  TrangThai: number;
  TrangThaiThanhToan: number;
  ChiTietDatPhongs?: Array<any>;
}

const fetchJson = async (url: string, init?: RequestInit) => {
  const res = await fetch(url, init);
  let text = '';
  try { text = await res.text(); } catch {}
  // Parse response text as JSON (if possible)
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || text || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data ?? { ok: true };
};

const getRoomInfo = (it: any) => {
  const ten = it?.TenPhong ?? it?.tenPhong ?? it?.Phong?.TenPhong ?? it?.Phong?.tenPhong ?? null;
  const so = it?.SoPhong ?? it?.soPhong ?? it?.Phong?.SoPhong ?? it?.Phong?.soPhong ?? null;
  return { ten, so };
};

const collectRoomInfos = (items?: any[], fallbackRow?: BookingRow) => {
  const arr = (items ?? []).map(getRoomInfo).filter(r => (r.ten || r.so));
  if (!arr.length && fallbackRow) {
    const ten = fallbackRow.TenPhong ?? null;
    const so = fallbackRow.SoPhong ?? null;
    if (ten || so) arr.push({ ten, so });
  }
  return arr;
};

// === HELPER: Lưu trữ booking đã gia hạn trong ngày vào localStorage ===
// Key format: extended_bookings_YYYY-MM-DD
const getExtendedBookingsKey = () => {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10); // YYYY-MM-DD
  return `extended_bookings_${dateStr}`;
};

const loadExtendedBookingsFromStorage = (): string[] => {
  try {
    const key = getExtendedBookingsKey();
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('[loadExtendedBookingsFromStorage] failed', e);
  }
  return [];
};

const saveExtendedBookingsToStorage = (ids: string[]) => {
  try {
    const key = getExtendedBookingsKey();
    localStorage.setItem(key, JSON.stringify(ids));
    // Dọn dẹp các key cũ (> 7 ngày)
    cleanupOldExtendedBookingsKeys();
  } catch (e) {
    console.warn('[saveExtendedBookingsToStorage] failed', e);
  }
};

const cleanupOldExtendedBookingsKeys = () => {
  try {
    const today = new Date();
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('extended_bookings_')) {
        const dateStr = key.replace('extended_bookings_', '');
        const keyDate = new Date(dateStr);
        const diffDays = (today.getTime() - keyDate.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays > 7) keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (e) { /* ignore */ }
};

const CheckInManager: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<BookingRow[]>([]);
  const [keyword, setKeyword] = useState('');
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const [viewMode, setViewMode] = useState<'using' | 'checkin'>('using');
const [summaryMap, setSummaryMap] = useState<Record<string, any>>({});
  const [msg, contextHolder] = message.useMessage();

  useEffect(() => { load(); }, []);

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

// BỔ SUNG: lấy tổng tiền chuẩn từ API summary (tổng sau VAT)
const mappedWithTotals: BookingRow[] = await Promise.all(
  (mapped || []).map(async (row: BookingRow) => {
    try {
      // Có thể giới hạn chỉ cho booking đang sử dụng (TrangThai === 3)
      if ((row.TrangThai ?? 0) !== 3) return row;

      const sum: any = await checkoutApi.getSummary(row.IddatPhong);
      const apiTotal = Number(sum?.money?.tongTien ?? 0);
      const roomTotal = Number(sum?.money?.roomTotal ?? 0);
      const serviceTotal = Number(sum?.money?.serviceTotal ?? 0);
      const fallbackTotal = roomTotal + serviceTotal;

      return {
        ...row,
        TongTien: apiTotal > 0 ? apiTotal : fallbackTotal
      };
    } catch {
      // Nếu summary lỗi, giữ nguyên TongTien gốc
      return row;
    }
  })
);

setData(mappedWithTotals);
  } catch (e: any) {
    message.error(e.message || 'Không thể tải danh sách đặt phòng');
  } finally {
    setLoading(false);
  }
};

  // Payment/modal state
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentRow, setPaymentRow] = useState<BookingRow | null>(null);
  const [summary, setSummary] = useState<any | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [form] = Form.useForm();

  const openPaymentModal = async (row: BookingRow) => {
    setPaymentRow(row);
    setPaymentModalVisible(true);
    // keep existing summary while opening modal; we'll refresh if needed
    setSummaryLoading(true);
    try {
      const sum = await checkoutApi.getSummary(row.IddatPhong);
      // If summary doesn't include service lines but has an invoice id, try fetching invoice detail
      if (sum && (!Array.isArray(sum.services) || sum.services.length === 0) && Array.isArray(sum?.invoices) && sum.invoices.length > 0) {
        try {
          const firstInv = sum.invoices[0];
          const invId = firstInv?.id ?? firstInv?.IDHoaDon ?? firstInv?.ID ?? null;
          if (invId) {
            const invDetail = await invoiceApi.getInvoiceDetail(invId);
            if (invDetail && invDetail.data) {
              // normalize services from invoice detail if present
              const svc = invDetail.data.services ?? invDetail.data?.services ?? null;
              if (Array.isArray(svc) && svc.length > 0) {
                sum.services = svc;
              }
            }
          }
        } catch (e) { /* ignore fallback */ }
      }
      console.debug('[openPaymentModal] summary for', row.IddatPhong, sum);
      // merge any booking-level services or client-selected services so older services show up
      const serverServices = Array.isArray(sum?.services) ? sum.services : [];
      const bookingServices: any[] = [];
      // try to read services from paymentRow if present (some responses use different shapes)
      if (Array.isArray((row as any)?.services)) bookingServices.push(...(row as any).services);
      const mergedServices = [...serverServices, ...bookingServices, ...(selectedServices || [])];
      const mergedSummary = { ...sum, services: mergedServices };
      setSummary(mergeFreshSummary(summary, mergedSummary));
      
      // Auto-detect và đánh dấu nếu booking có gia hạn (từ server hoặc đã được đánh dấu trước đó)
      if (detectExtendFee(mergedSummary) || isBookingExtended(row.IddatPhong)) {
        markBookingAsExtended(row.IddatPhong);
      }
      
      const soDem = Number(sum?.dates?.soDem ?? row.SoDem ?? 1);
      const tienPhong = Math.round(Number(sum?.money?.roomTotal ?? (row.TongTien || 0)));
      const tongTien = Number(sum?.money?.tongTien ?? (row.TongTien || 0));
      form.setFieldsValue({ TienPhong: tienPhong, SoLuongNgay: soDem, TongTien: tongTien, PhuongThucThanhToan: 1, GhiChu: '' });
    } catch (e: any) {
      message.error(e.message || 'Không tải được tóm tắt thanh toán');
      form.setFieldsValue({ TienPhong: Math.round(row.TongTien || 0), SoLuongNgay: row.SoDem || 1, TongTien: Number(row.TongTien || 0), PhuongThucThanhToan: 1, GhiChu: '' });
    } finally { setSummaryLoading(false); }
  };

  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [paymentInvoiceId, setPaymentInvoiceId] = useState<string | null>(null);
  const [qrExpectedAmount, setQrExpectedAmount] = useState<number | null>(null);

  const [unifiedModalVisible, setUnifiedModalVisible] = useState(false);
  const [invoiceData, setInvoiceData] = useState<any | null>(null);
  const [refreshAfterInvoiceClose, setRefreshAfterInvoiceClose] = useState(false);
  const [isOverdueInvoice, setIsOverdueInvoice] = useState(false);
  const [isExtendedInvoice, setIsExtendedInvoice] = useState(false);

  // Track booking IDs that have been extended (gia hạn) trong ngày
  // Khởi tạo từ localStorage để không mất khi refresh hoặc thêm dịch vụ
  const [extendedBookingIds, setExtendedBookingIds] = useState<string[]>(() => loadExtendedBookingsFromStorage());

  // Lưu vào localStorage mỗi khi extendedBookingIds thay đổi
  useEffect(() => {
    if (extendedBookingIds.length > 0) {
      saveExtendedBookingsToStorage(extendedBookingIds);
    }
  }, [extendedBookingIds]);

  // Helper: check if a booking has been extended (gia hạn)
  const isBookingExtended = (bookingId: string | null | undefined): boolean => {
    if (!bookingId) return false;
    return extendedBookingIds.includes(bookingId);
  };

  // Helper: đánh dấu booking là đã gia hạn và lưu vào state + localStorage
  const markBookingAsExtended = (bookingId: string | null | undefined) => {
    if (!bookingId) return;
    setExtendedBookingIds(prev => {
      const current = prev || [];
      if (current.includes(bookingId)) return current;
      const updated = [...current, bookingId];
      // Lưu ngay vào localStorage để đảm bảo không mất
      saveExtendedBookingsToStorage(updated);
      return updated;
    });
  };

  // Helper: detect extend fee from invoice/summary data
  const detectExtendFee = (data: any): boolean => {
    if (!data) return false;
    // Check GhiChu for "gia hạn"
    const ghiChu = data?.GhiChu ?? data?.ghiChu ?? data?.invoices?.[0]?.GhiChu ?? data?.invoices?.[0]?.ghiChu ?? data?.HoaDon?.GhiChu ?? '';
    const hasExtendNote = typeof ghiChu === 'string' && (ghiChu.toLowerCase().includes('gia hạn') || ghiChu.toLowerCase().includes('gia han'));
    // Check money fields for extend fee
    const extendFromMoney = Number(data?.money?.extendFee ?? data?.money?.extend ?? data?.money?.extra ?? 0) > 0;
    // Check if TongTien includes extend component (tổng > tiền phòng + dịch vụ + VAT cơ bản)
    const roomTotal = Number(data?.money?.roomTotal ?? 0);
    const serviceTotal = Number(data?.money?.serviceTotal ?? 0);
    const tongTien = Number(data?.money?.tongTien ?? 0);
    const basicTotal = Math.round((roomTotal + serviceTotal) * 1.1);
    const hasExtraAmount = tongTien > 0 && basicTotal > 0 && (tongTien - basicTotal) > 1000; // có phần dư > 1000đ
    return hasExtendNote || extendFromMoney || hasExtraAmount;
  };

  // Merge fresh server summary into existing summary while preserving certain
  // locally-known values (paidAmount, extendFee) to avoid UI flicker and
  // accidental removal of the extend fee after adding services.
  const mergeFreshSummary = (prev: any | null, fresh: any | null) => {
    if (!fresh) return prev;
    if (!prev) return fresh;
    try {
      const prevPaid = Number(prev?.money?.paidAmount ?? prev?.money?.paid ?? 0);
      const freshPaid = Number(fresh?.money?.paidAmount ?? fresh?.money?.paid ?? NaN);
      if (!isNaN(prevPaid) && (isNaN(freshPaid) || freshPaid === 0) && prevPaid > 0) {
        const mergedMoney = { ...fresh.money, paidAmount: prevPaid };
        return { ...fresh, money: mergedMoney };
      }
      try {
        const prevExtend = Number(prev?.money?.extendFee ?? prev?.money?.ExtendFee ?? prev?.money?.extend ?? prev?.money?.phiGiaHan ?? 0);
        const freshExtend = Number(fresh?.money?.extendFee ?? fresh?.money?.ExtendFee ?? fresh?.money?.extend ?? fresh?.money?.phiGiaHan ?? 0);
        const bookingId = prev?.DatPhong?.IddatPhong ?? prev?.datPhong?.IddatPhong ?? fresh?.DatPhong?.IddatPhong ?? fresh?.datPhong?.IddatPhong ?? null;
        if (prevExtend > 0 && (isNaN(freshExtend) || freshExtend === 0) && bookingId && extendedBookingIds.includes(String(bookingId))) {
          const mergedMoney = { ...fresh.money, extendFee: prevExtend, ExtendFee: prevExtend, extend: prevExtend, phiGiaHan: prevExtend };
          return { ...fresh, money: mergedMoney };
        }
      } catch {
        // ignore and fallthrough
      }
    } catch {
      // ignore and return fresh
    }
    return fresh;
  };

  // helper: detect if a given date string corresponds to today (local date)
  const isDateToday = (d?: string | null) => {
    if (!d) return false;
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return false;
      const today = new Date();
      return dt.getFullYear() === today.getFullYear() && dt.getMonth() === today.getMonth() && dt.getDate() === today.getDate();
    } catch {
      return false;
    }
  };

  // Services state
  const [serviceModalVisible, setServiceModalVisible] = useState(false);
  const [selectedServices, setSelectedServices] = useState<Array<any>>([]);
  const [servicesTotal, setServicesTotal] = useState(0);
  const [formServiceVisible, setFormServiceVisible] = useState(false);
  const [formServiceInvoiceId, setFormServiceInvoiceId] = useState<string | null>(null);
  const [formServiceForm] = Form.useForm();

  // Track booking ids that should show "Xem hóa đơn" after adding services in 'using' mode
  const [viewInvoiceIds, setViewInvoiceIds] = useState<string[]>([]);

  const handleAddService = (row: BookingRow) => {
    setPaymentRow(row);
    setSelectedServices([]);
    setServicesTotal(0);
    setServiceModalVisible(true);
  };

  const handleServicesChange = (services: any[], total: number) => {
    setSelectedServices(services || []);
    setServicesTotal(Number(total || 0));
  };

  // When user clicks "Xem chi tiết" (or the checkout action), open Invoice or Payment modal depending on viewMode
  const onViewInvoice = async (row: BookingRow) => {
    // If we're in checkout mode, show the Invoice modal directly for review/complete.
    if (viewMode === 'checkin') {
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
        else {
          try {
            const dpFull = dp ?? await fetchJson(`/api/DatPhong/${row.IddatPhong}`);
            if (Array.isArray(dpFull?.ChiTietDatPhongs) && dpFull.ChiTietDatPhongs.length > 0) baseItems = dpFull.ChiTietDatPhongs;
          } catch { /* ignore */ }
        }

        // If we still don't have multiple room lines but the booking likely has multiple rooms
        // try fetching the full DatPhong record to ensure invoice shows all rooms.
        if ((!baseItems || baseItems.length < 2) && (!dp || (Array.isArray(row?.ChiTietDatPhongs) && row.ChiTietDatPhongs.length < 2))) {
          try {
            const dpFullFallback = await fetchJson(`/api/DatPhong/${row.IddatPhong}`);
            if (Array.isArray(dpFullFallback?.ChiTietDatPhongs) && dpFullFallback.ChiTietDatPhongs.length > 0) {
              baseItems = dpFullFallback.ChiTietDatPhongs;
            }
          } catch (e) { /* ignore fallback */ }
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
        // If this invoice indicates an extend fee, remember this booking so later
        // payment flows use the checkout invoice form with extend fee
        if (detectExtendFee(merged) || isBookingExtended(row.IddatPhong)) {
          markBookingAsExtended(row.IddatPhong);
          setIsExtendedInvoice(true);
        }
        setIsOverdueInvoice(Number(row?.TrangThai ?? 0) === 5);
        setUnifiedModalVisible(true);
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

      // simplified: reuse previous logic when viewMode === 'checkout'
      // For brevity this demo delegates to existing checkoutApi methods
      const method = vals.PhuongThucThanhToan;
      const existingInvoiceId = summary?.invoices?.[0]?.IDHoaDon ?? summary?.invoices?.[0]?.id ?? null;

      // ... keep implementation small here; in practice reuse earlier logic
      if (existingInvoiceId) {
        if (method === 2) {
          const serverRemaining = Number(summary?.soTienConLai ?? summary?.money?.soTienConLai ?? summary?.invoices?.[0]?.soTienConLai ?? 0);
          const tongTien = Number(summary?.money?.tongTien ?? form.getFieldValue('TongTien') ?? paymentRow?.TongTien ?? 0);
          const daTra = Number(summary?.invoices?.[0]?.tienThanhToan ?? summary?.money?.paidAmount ?? 0);
          const deposit = Number(summary?.money?.deposit ?? 0);
          const paidExcl = Math.max(0, daTra - deposit);
          const needToPay = serverRemaining > 0 ? serverRemaining : Math.max(0, tongTien - deposit - paidExcl);
          try {
            const resp: any = await checkoutApi.payQr({ IDDatPhong: paymentRow.IddatPhong, HoaDonId: existingInvoiceId, Amount: needToPay });
            setQrUrl(resp?.paymentUrl ?? null);
            setPaymentInvoiceId(resp?.idHoaDon ?? existingInvoiceId);
            setQrExpectedAmount(Number(needToPay ?? 0));
            // force late-fee invoice to display after confirming QR for overdue bookings
            if (Number(paymentRow?.TrangThai ?? 0) === 5 || Number(invoiceData?.TrangThai ?? 0) === 5) setIsOverdueInvoice(true);
            setQrModalVisible(true);
          } catch (err: any) {
            console.error('payQr failed', err);
            message.error(err?.message || 'Không thể tạo liên kết QR');
          }
        } else {
          const serverRemaining = Number(summary?.soTienConLai ?? summary?.money?.soTienConLai ?? summary?.invoices?.[0]?.soTienConLai ?? 0);
          if (serverRemaining > 0) {
            await checkoutApi.confirmPaid(paymentRow.IddatPhong, { Amount: serverRemaining, HoaDonId: existingInvoiceId });
          } else {
            const tongTien = Number(summary?.money?.tongTien ?? 0);
            const daTra = Number(summary?.invoices?.[0]?.tienThanhToan ?? summary?.money?.paidAmount ?? 0);
            const deposit = Number(summary?.money?.deposit ?? 0);
            const daTraExcl = Math.max(0, daTra - deposit);
            const remaining = Math.max(0, tongTien - daTraExcl);
            if (remaining > 0) await checkoutApi.confirmPaid(paymentRow.IddatPhong, { Amount: remaining, HoaDonId: existingInvoiceId });
          }
          msg.success('Cập nhật hóa đơn thành công');
          try {
            const fresh = await checkoutApi.getSummary(paymentRow.IddatPhong);
            // Merge server services with any client-selected services so newly added
            // services show up on the invoice immediately.
            const serverServices = Array.isArray(fresh?.services) ? fresh.services : [];
            const merged = { ...fresh, services: [...serverServices, ...(selectedServices || [])] };
            setInvoiceData(merged);
            setSummary(mergeFreshSummary(summary, merged));
            // Clear client-selected services after merge
            setSelectedServices([]);
            setServicesTotal(0);
            // Check if this booking has extend fee and mark it so InvoiceModal is used
            // Cũng kiểm tra nếu đã được đánh dấu gia hạn trước đó
            if (detectExtendFee(merged) || isBookingExtended(paymentRow?.IddatPhong)) {
              markBookingAsExtended(paymentRow?.IddatPhong);
              setIsExtendedInvoice(true);
            } else {
              setIsExtendedInvoice(false);
            }
            // Check if overdue
            if (Number(paymentRow?.TrangThai ?? merged?.TrangThai ?? 0) === 5) {
              setIsOverdueInvoice(true);
            } else {
              setIsOverdueInvoice(false);
            }
          } catch (e) {
            console.warn('[submitPayment] failed to reload summary after confirmPaid', e);
          }
          // Automatically open the invoice modal after payment confirmation
          setUnifiedModalVisible(true);
        }
      } else {
        // create invoice for checkout mode
        // Ensure we send a valid TongTien (>0). Prefer form value, then server summary, then compute from room+services.
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

        // Compute remaining due so QR invoice equals what customer actually owes
        const totalFromServer = Number(summary?.money?.tongTien ?? summaryTotal ?? computedTotalWithVat);
        const deposit = Number(summary?.money?.deposit ?? 0);
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

        const res = await checkoutApi.createInvoice({
          IDDatPhong: paymentRow!.IddatPhong,
          PhuongThucThanhToan: method,
          // Mark paid for cash checkouts, pending for online
          TrangThaiThanhToan: method === 2 ? 1 : 2,
          GhiChu: vals.GhiChu ?? '',
          TongTien: invoiceAmountToUse,
          TienPhong: Math.round(roomTotalForCalc),
          SoLuongNgay: vals.SoLuongNgay ?? 1,
          TienCoc: Number(paymentRow?.TienCoc ?? 0),
          PreviousPayment: Number(paymentRow?.TienThanhToan ?? 0),
          Services: []
        });
        if (method === 2) {
          try {
            const hoaDonId = res?.idHoaDon ?? res?.id ?? null;
            const payResp: any = await checkoutApi.payQr({ IDDatPhong: paymentRow.IddatPhong, HoaDonId: hoaDonId, Amount: remainingToPay });
            setQrUrl(payResp?.paymentUrl ?? payResp?.qr ?? null);
            setPaymentInvoiceId(hoaDonId);
            setQrExpectedAmount(Number(remainingToPay ?? 0));
            try {
              const fresh = await checkoutApi.getSummary(paymentRow.IddatPhong);
              if (fresh) {
                const prevPaid = Number(summary?.money?.paidAmount ?? 0);
                const freshPaid = Number(fresh?.money?.paidAmount ?? 0);
                if ((isNaN(freshPaid) || freshPaid === 0) && prevPaid > 0) {
                  fresh.money = { ...fresh.money, paidAmount: prevPaid };
                }
                // Merge server services with client-selected services
                const serverServices = Array.isArray(fresh?.services) ? fresh.services : [];
                const merged = { ...fresh, services: [...serverServices, ...(selectedServices || [])] };
                setSummary(mergeFreshSummary(summary, merged));
                setInvoiceData(merged);
                setSelectedServices([]);
                setServicesTotal(0);
              }
            } catch (e) { /* ignore */ }
            setQrModalVisible(true);
          } catch (e: any) {
            console.error('payQr after createInvoice failed', e);
            message.error(e?.message || 'Không thể tạo liên kết QR');
          }
        } else {
          msg.success('Tạo hóa đơn & thanh toán thành công');
          try {
            const fresh = await checkoutApi.getSummary(paymentRow.IddatPhong);
            const serverServices = Array.isArray(fresh?.services) ? fresh.services : [];
            const merged = { ...fresh, services: [...serverServices, ...(selectedServices || [])] };
            setInvoiceData(merged);
            setSummary(mergeFreshSummary(summary, merged));
            setSelectedServices([]);
            setServicesTotal(0);
            // Check if this booking has extend fee and mark it so InvoiceModal is used
            // Cũng kiểm tra nếu đã được đánh dấu gia hạn trước đó
            if (detectExtendFee(merged) || isBookingExtended(paymentRow?.IddatPhong)) {
              markBookingAsExtended(paymentRow?.IddatPhong);
              setIsExtendedInvoice(true);
            } else {
              setIsExtendedInvoice(false);
            }
            // Check if overdue
            if (Number(paymentRow?.TrangThai ?? merged?.TrangThai ?? 0) === 5) {
              setIsOverdueInvoice(true);
            } else {
              setIsOverdueInvoice(false);
            }
          } catch (e) {
            console.warn('[submitPayment] failed to load invoice summary after createInvoice', e);
          }
          // Auto-open invoice modal after cash payment confirmation
          setUnifiedModalVisible(true);
        }
      }

      setPaymentModalVisible(false);
      form.resetFields();
      // Avoid immediately reloading bookings in checkout mode so the booking stays visible
      if (viewMode === 'checkin') {
        setRefreshAfterInvoiceClose(true);
        message.info('Phòng sẽ tiếp tục hiển thị trong danh sách "Trả phòng hôm nay" để bạn kiểm tra hóa đơn.');
      } else {
        await load();
      }
    } catch (err: any) {
      message.error(err?.message || 'Thanh toán thất bại');
    }
  };

  // Handler for adding services from modal - CHỈ mở FormService, KHÔNG lưu ngay
  // Việc lưu xuống CSDL sẽ do FormService xử lý khi nhấn "Xác nhận"
  const handleServiceModalAdd = () => {
    if (selectedServices.length === 0) {
      message.warning('Vui lòng chọn ít nhất 1 dịch vụ');
      return;
    }

    if (!paymentRow) {
      message.error('Không có đặt phòng được chọn');
      return;
    }

    // Đóng modal chọn dịch vụ và mở FormService để xem trước
    // Chưa lưu gì xuống CSDL - chỉ khi nhấn "Xác nhận" trong FormService mới lưu
    setServiceModalVisible(false);
    setFormServiceVisible(true);
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
            try {
              const dpFull = dp ?? await fetchJson(`/api/DatPhong/${row.IddatPhong}`);
              if (Array.isArray(dpFull?.ChiTietDatPhongs) && dpFull.ChiTietDatPhongs.length > 0) baseItems = dpFull.ChiTietDatPhongs;
            } catch { /* ignore */ }
          }

          // If there is a chance the booking covers multiple rooms but we still only have one
          // try a second fetch to ensure we present all room lines on the invoice.
          if ((!baseItems || baseItems.length < 2) && (!dp || (Array.isArray(row?.ChiTietDatPhongs) && row.ChiTietDatPhongs.length < 2))) {
            try {
              const dpFullFallback = await fetchJson(`/api/DatPhong/${row.IddatPhong}`);
              if (Array.isArray(dpFullFallback?.ChiTietDatPhongs) && dpFullFallback.ChiTietDatPhongs.length > 0) {
                baseItems = dpFullFallback.ChiTietDatPhongs;
              }
            } catch (e) { /* ignore fallback */ }
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
          setIsExtendedInvoice(Boolean(row && (extendedBookingIds.includes(String(row?.IddatPhong)) || detectExtendFee(merged))));
          setIsOverdueInvoice(Number(row?.TrangThai ?? 0) === 5);
          setUnifiedModalVisible(true);
          message.success({ content: 'Mở form hóa đơn để kiểm tra trước khi hoàn tất trả phòng', key, duration: 2 });
        } catch (e: any) {
          message.error({ content: e?.message || 'Không thể tải dữ liệu hóa đơn', key, duration: 3 });
        }
      }
    });
  };

  const markPaid = async (row: BookingRow) => {
    // Open the payment modal so operator can choose cash or QR and submit — removes extra confirm
    setPaymentRow(row);
    try {
      const sum = await checkoutApi.getSummary(row.IddatPhong);
      setSummary(mergeFreshSummary(summary, sum));
      setInvoiceData(sum);
    } catch {
      // keep existing summary; avoid clearing paid amounts on cancel
      setInvoiceData(null);
    }
    setPaymentModalVisible(true);
  };

  const due = useMemo(() => {
    const sel = selectedDate ? selectedDate.format('YYYY-MM-DD') : null;
    return (data || []).filter((d: BookingRow) => {
      // If this booking was recently modified and we flagged it to show invoice details,
      // always keep it visible so the operator can click "Xem chi tiết" immediately.
      if (Array.isArray(viewInvoiceIds) && viewInvoiceIds.includes(d.IddatPhong)) return true;

      // Ở tab "Trả phòng hôm nay" (checkin mode): chỉ hiển thị những booking CHƯA thanh toán
      // TrangThaiThanhToan: 1 = Chưa TT, 2 = Đã TT, 0 = Đã cọc
      if (viewMode === 'checkin') {
        const paymentStatus = Number(d.TrangThaiThanhToan ?? 1);
        // Đã thanh toán đầy đủ (2) thì không hiển thị
        if (paymentStatus === 2) return false;
      }

      // If a status filter is set, filter by that status
      if (statusFilter && statusFilter.trim()) {
        if (String(d.TrangThai ?? 0) !== statusFilter) return false;
      } else {
        // Otherwise, only show bookings currently in use (TrangThai === 3)
        // Coerce to Number in case TrangThai is a string coming from the API/DB
        if (Number(d.TrangThai ?? 0) !== 3) return false;
      }
      // If a date is selected, match by NgayNhanPhong (check-in date)
      if (sel) {
        const checkin = (d.NgayNhanPhong || '').slice(0, 10);
        if (!checkin || checkin !== sel) return false;
      }
      if (keyword && keyword.trim()) {
        const k = keyword.trim().toLowerCase();
        return (String(d.IddatPhong || '') + ' ' + (d.TenKhachHang || '') + ' ' + (d.EmailKhachHang || '')).toLowerCase().includes(k);
      }
      return true;
    });
  }, [data, keyword, viewMode, selectedDate, viewInvoiceIds]);

  const roomLines = useMemo(() => {
    if (!paymentRow) return [] as string[];
    const infos = collectRoomInfos(paymentRow?.ChiTietDatPhongs, paymentRow || undefined);
    return infos.map((info) => (info.ten ?? (info.so ? `Phòng ${info.so}` : '-')));
  }, [paymentRow]);

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <Slidebar />
      <div style={{ marginLeft: 280 }}>
        <HeaderSection showStats={false} />
        <main style={{ padding: '0px 60px' }}>
          {contextHolder}

          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 20,
              boxShadow: '0 8px 24px rgba(2,6,23,0.06)'
            }}
          >
            <h2 style={{ marginBottom: 16 }}>Quản lý nhận phòng</h2>

            {/* Full Booking management section embedded on the Check-in page */}
            <Card style={{ marginBottom: 12 }}>
              <CheckinSection />
            </Card>
            <div style={{ marginBottom: 12 }}>
              <Card style={{ marginBottom: 12 }}>
              <Space wrap>
                <Input.Search placeholder="Tìm mã đặt / khách / email" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{ padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 10, background: '#fff', fontSize: 13 }}
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="0">Đã hủy</option>
                  <option value="1">Chờ xác nhận</option>
                  <option value="2">Đã xác nhận</option>
                  <option value="3">Đang sử dụng</option>
                  <option value="4">Hoàn thành</option>
                </select>
                <DatePicker value={selectedDate} onChange={(d) => setSelectedDate(d)} format="YYYY-MM-DD" allowClear={true} />
                <Button onClick={() => setSelectedDate(dayjs())}>Hôm nay</Button>
                <Button onClick={load}>Tải lại</Button>
              </Space>
            </Card>
          </div>

          <Card>
            <CheckinTable
              data={due}
              loading={loading}
           onPay={markPaid}
           onOpenPaymentForm={openPaymentModal}
              onComplete={completeCheckout}
              onAddService={handleAddService}
              onViewInvoice={onViewInvoice}
              viewInvoiceIds={viewInvoiceIds}
              viewMode={viewMode}
              onViewChange={(mode: 'using' | 'checkin') => setViewMode(mode)}
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

          <FormService
            visible={formServiceVisible}
            selectedServices={selectedServices}
            servicesTotal={servicesTotal}
            form={formServiceForm}
            bookingId={paymentRow?.IddatPhong ?? null}
            onCancel={() => { setFormServiceVisible(false); setSelectedServices([]); setServicesTotal(0); setFormServiceInvoiceId(null); }}
            onSubmit={async () => {
              try {
                // FormService đã lưu dịch vụ thành công -> đóng modal
                setFormServiceVisible(false);
                setFormServiceInvoiceId(null);

                // Mark booking để UI hiển thị "Xem hóa đơn"
                if (paymentRow) {
                  setViewInvoiceIds(prev => {
                    const id = paymentRow.IddatPhong;
                    if (!id) return prev || [];
                    return Array.from(new Set([...(prev || []), id]));
                  });
                  // Refresh summary and merge services
                  let freshSummary: any = null;
                  try {
                    freshSummary = await checkoutApi.getSummary(paymentRow.IddatPhong);
                    const serverServices = Array.isArray(freshSummary?.services) ? freshSummary.services : [];
                    const mergedServices = [...serverServices, ...(selectedServices || [])];
                    const mergedSummary = { ...freshSummary, services: mergedServices };
                    setSummary(mergeFreshSummary(summary, mergedSummary));
                    setInvoiceData(mergedSummary);
                    // If server summary indicates an extend fee, remember this booking so
                    // future payment flows always use the checkout invoice form with extend fee
                    // Cũng kiểm tra nếu đã được đánh dấu gia hạn trước đó trong localStorage
                    if (detectExtendFee(mergedSummary) || isBookingExtended(paymentRow?.IddatPhong)) {
                      markBookingAsExtended(paymentRow?.IddatPhong);
                    }
                  } catch (err) { /* ignore */ }
                  // Notify open detail views
                  try { window.dispatchEvent(new CustomEvent('booking:services-updated', { detail: { id: paymentRow.IddatPhong } })); } catch {}
                }
                // Refresh danh sách booking
                await load();
              } catch (e: any) {
                message.error(e?.message || 'Cập nhật sau khi lưu dịch vụ thất bại');
              }
            }}
          />

          <Modal
            title="Thanh toán online - Quét mã QR"
            open={qrModalVisible}
            width={900}
            centered
            bodyStyle={{ minHeight: 520, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onCancel={() => { setQrModalVisible(false); setQrUrl(null); setPaymentModalVisible(false); setPaymentRow(null); form.resetFields(); load(); setIsOverdueInvoice(false); setIsExtendedInvoice(false); }}
            footer={[
              <Button key="close" onClick={() => { setQrModalVisible(false); setQrUrl(null); setPaymentModalVisible(false); setPaymentRow(null); form.resetFields(); load(); }}>Đóng</Button>,
              <Button key="paid" type="primary" onClick={async () => {
              const key = `confirm_${paymentRow?.IddatPhong ?? 'unknown'}`;
              message.loading({ content: 'Đang xác nhận thanh toán...', key, duration: 0 });
              let freshSummary: any = null;
              const currentBookingId = paymentRow?.IddatPhong;
              try {
                if (paymentRow) {
                  const serverRemaining = Number(summary?.soTienConLai ?? summary?.money?.soTienConLai ?? summary?.invoices?.[0]?.soTienConLai ?? 0);
                  const tongTien = Number(summary?.money?.tongTien ?? form.getFieldValue('TongTien') ?? paymentRow?.TongTien ?? 0);
                  const daTra = Number(summary?.invoices?.[0]?.tienThanhToan ?? summary?.money?.paidAmount ?? 0);
                  const deposit = Number(summary?.money?.deposit ?? 0);
                  const paidExcl = Math.max(0, daTra - deposit);
                  const computedNeed = serverRemaining > 0 ? serverRemaining : Math.max(0, tongTien - deposit - paidExcl);
                  const amountToConfirm = Number(qrExpectedAmount ?? 0) > 0 ? Number(qrExpectedAmount) : computedNeed;

                  const payload: any = { IsOnline: true, Amount: Math.round(amountToConfirm) };
                  if (paymentInvoiceId) payload.HoaDonId = paymentInvoiceId;
                  const resp = await checkoutApi.confirmPaid(paymentRow.IddatPhong, payload);
                  if (resp !== null) {
                    message.success({ content: 'Xác nhận thanh toán thành công', key, duration: 2 });
                      try {
                      let fresh = await checkoutApi.getSummary(paymentRow.IddatPhong);
                      // If server hasn't reflected the online payment yet, merge expected QR amount
                      try {
                        const expected = Number(qrExpectedAmount ?? 0);
                        const serverPaid = Number(fresh?.money?.paidAmount ?? fresh?.invoices?.[0]?.tienThanhToan ?? 0);
                        if (expected > 0 && (isNaN(serverPaid) || serverPaid < expected)) {
                          const prevPaid = Number(fresh?.money?.paidAmount ?? 0) || 0;
                          fresh.money = { ...(fresh.money || {}), paidAmount: prevPaid + expected };
                          if (Array.isArray(fresh.invoices) && fresh.invoices.length > 0) {
                            fresh.invoices[0].tienThanhToan = (Number(fresh.invoices[0].tienThanhToan ?? 0) || 0) + expected;
                          }
                          try {
                            const tong = Number(fresh?.money?.tongTien ?? fresh?.money?.total ?? 0);
                            if (!isNaN(tong)) {
                              fresh.money.soTienConLai = Math.max(0, tong - (fresh.money.paidAmount || 0));
                            }
                          } catch {}
                        }
                      } catch (e) { /* ignore merge errors */ }
                      // Merge server services with any client-selected services so newly added services appear
                      const serverServices = Array.isArray(fresh?.services) ? fresh.services : [];
                      const merged = { ...fresh, services: [...serverServices, ...(selectedServices || [])] };
                      setInvoiceData(merged);
                      setSummary(mergeFreshSummary(summary, merged));
                      try { setQrExpectedAmount(null); } catch {}
                      try { setQrExpectedAmount(null); } catch {}
                      setSelectedServices([]);
                      setServicesTotal(0);
                      // Check if this booking has extend fee and mark it
                      // Cũng kiểm tra nếu đã được đánh dấu gia hạn trước đó
                      if (detectExtendFee(merged) || isBookingExtended(currentBookingId)) {
                        markBookingAsExtended(currentBookingId);
                      }
                    } catch { }
                  } else {
                    message.warning({ content: 'Không nhận được phản hồi xác nhận từ server', key, duration: 3 });
                  }
                }
              } catch (err: any) {
                message.error({ content: err?.message || 'Lỗi khi xác nhận thanh toán', key, duration: 3 });
              } finally {
                setQrModalVisible(false);
                setQrUrl(null);
                setPaymentModalVisible(false);
                // force showing the late-fee invoice after confirming online payment when in overdue context
                if (Number(paymentRow?.TrangThai ?? invoiceData?.TrangThai ?? 0) === 5) {
                  setIsOverdueInvoice(true);
                }

                // If we are in the checkout tab ("Trả phòng hôm nay") or the booking was
                // previously detected as having an extend fee, open the checkout InvoiceModal
                // so the operator can review the invoice including any extend fees.
                const wasExtended = isBookingExtended(paymentRow?.IddatPhong) || detectExtendFee(invoiceData) || detectExtendFee(summary);
                if (viewMode === 'checkin' || wasExtended) {
                  // Avoid clobbering the late-fee flow — late-fee has higher priority
                  if (Number(paymentRow?.TrangThai ?? invoiceData?.TrangThai ?? 0) !== 5) {
                    setIsExtendedInvoice(true);
                    setIsOverdueInvoice(false);
                    setUnifiedModalVisible(true);
                  }
                }
                setPaymentRow(null);
                // keep summary so the UI retains previous paid amount if not confirmed
                form.resetFields();
                await load();
              }
            }}>Đã thanh toán</Button>
          ]}>
            {qrUrl ? (
              <div style={{ textAlign: 'center', width: '100%' }}>
                <img
                  src={qrUrl ?? undefined}
                  alt="QR"
                  style={{ width: 420, height: 420, maxWidth: '100%', display: 'block', margin: '0 auto' }}
                />
              </div>
            ) : (<div style={{ minHeight: 220 }}>Không tìm thấy liên kết thanh toán</div>)}
          </Modal>

          {
            (() => {
              // === LOGIC PHÂN BIỆT FORM HÓA ĐƠN ===
              // Detect 3 scenarios: normal, overdue (TrangThai === 5), extended (has gia hạn)
              
              // 1. Check if booking is overdue (TrangThai === 5 OR has late fee service/amount)
              const isOverdue = Number(invoiceData?.TrangThai ?? paymentRow?.TrangThai ?? 0) === 5;
              const lateFeePresent = Number(invoiceData?.money?.lateFee ?? (paymentRow as any)?.TienPhuPhi ?? (paymentRow as any)?.tienPhuPhi ?? 0) > 0;
              const hasLateFeeService = (Array.isArray(paymentRow?.ChiTietDatPhongs) && paymentRow.ChiTietDatPhongs.some((s: any) => /trả phòng muộn|phí trả phòng muộn|phu.?phi.?tra phong muon/i.test(String(s.tenDichVu ?? s.TenDichVu ?? s.dichVu ?? ''))))
                || (Array.isArray(invoiceData?.services) && invoiceData.services.some((s: any) => /trả phòng muộn|phí trả phòng muộn|phu.?phi.?tra phong muon/i.test(String(s.tenDichVu ?? s.TenDichVu ?? s.ten ?? ''))))
                || (Array.isArray(invoiceData?.items) && invoiceData.items.some((s: any) => /trả phòng muộn|phí trả phòng muộn|phu.?phi.?tra phong muon/i.test(String(s.tenDichVu ?? s.TenDichVu ?? s.dichVu ?? s.TenDichVu ?? ''))));
              const isOverdueFlag = isOverdue || lateFeePresent || hasLateFeeService;

              // 2. Check if booking has been extended (gia hạn)
              const hasExtendFee = detectExtendFee(invoiceData) || isBookingExtended(paymentRow?.IddatPhong);
              const isExtendedFlag = hasExtendFee;

              // Use UnifiedInvoiceModal for all scenarios
              return (
                <UnifiedInvoiceModal
                  visible={unifiedModalVisible}
                  invoiceData={invoiceData}
                  paymentRow={paymentRow}
                  selectedServices={selectedServices}
                  isExtended={isExtendedFlag}
                  isOverdue={isOverdueFlag}
                  onClose={async () => {
                    setUnifiedModalVisible(false);
                    setInvoiceData(null);
                    setSelectedServices([]);
                    setServicesTotal(0);
                    setIsOverdueInvoice(false);
                    setIsExtendedInvoice(false);
                    if (refreshAfterInvoiceClose) {
                      await load();
                      setRefreshAfterInvoiceClose(false);
                    }
                  }}
                  onComplete={async (id: string) => {
                    try {
                      if (typeof id !== 'undefined' && id !== null) {
                        const resp = await checkinApi.completePayment(id);
                        msg.success('Thanh toán thành công');
                        setUnifiedModalVisible(false);
                        setIsOverdueInvoice(false);
                        setIsExtendedInvoice(false);
                        await load();
                      } else {
                        throw new Error('Không có id để hoàn tất thanh toán');
                      }
                    } catch (e: any) {
                      message.error(e?.message || 'Thanh toán thất bại');
                    }
                  }}
                />
              );

              // 3. Tab "Đang sử dụng" (using mode) KHÔNG có gia hạn -> dùng InvoiceCheckin (form đơn giản)
              // return (
              //   <InvoiceCheckin
              //     visible={invoiceModalVisible}
              //     invoiceData={invoiceData}
              //     paymentRow={paymentRow}
              //     selectedServices={selectedServices}
              //     servicesTotal={servicesTotal}
              //     onClose={async () => {
              //       setInvoiceModalVisible(false);
              //       setInvoiceData(null);
              //       setSelectedServices([]);
              //       setServicesTotal(0);
              //       if (refreshAfterInvoiceClose) {
              //         await load();
              //         setRefreshAfterInvoiceClose(false);
              //       }
              //       setIsOverdueInvoice(false);
              //     }}
              //     onComplete={async (id) => {
              //       try {
              //         // For check-ins we must only update the payment status and keep the booking.TrangThai = 3 (Đang sử dụng)
              //         if (typeof id !== 'undefined' && id !== null) {
              //           const resp = await checkinApi.completePayment(id);
              //           msg.success('Thanh toán thành công');
              //           setInvoiceModalVisible(false);
              //           await load();
              //         } else {
              //           throw new Error('Không có id để hoàn tất thanh toán');
              //         }
              //       } catch (e: any) {
              //         message.error(e?.message || 'Thanh toán thất bại');
              //       }
              //     }}
              //   />
              // );
            })()
          }
          </div>
        </main>
      </div>
    </div>
  );
};


export default CheckInManager;