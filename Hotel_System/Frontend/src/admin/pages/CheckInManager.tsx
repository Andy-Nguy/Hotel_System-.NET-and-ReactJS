import React, { useEffect, useMemo, useState } from "react";
import Slidebar from "../components/Slidebar";
import HeaderSection from "../components/HeaderSection";
import {
  Button,
  Card,
  Input,
  message,
  Space,
  Modal,
  DatePicker,
  Form,
} from "antd";
import dayjs, { Dayjs } from "dayjs";
import checkoutApi from "../../api/checkout.Api";
import checkinApi from "../../api/checkinApi";
import invoiceApi from "../../api/invoiceApi";

import CheckinTable from "../components/checkin/CheckinTable";
import PaymentModal from "../components/checkout/PaymentModal";
import InvoiceModal from "../components/checkin/InvoiceCheckin";
import ServicesSelector from "../../components/ServicesSelector";

import CheckinSection from "../components/checkin/CheckinSectionNewFixed";
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

// Resolve API base from Vite env when available (VITE_API_URL)
const _VITE_API = (import.meta as any).env?.VITE_API_URL || "";
const API_BASE = _VITE_API.replace(/\/$/, "")
  ? `${_VITE_API.replace(/\/$/, "")}/api`
  : "/api";

const fetchJson = async (url: string, init?: RequestInit) => {
  // Prepend API_BASE if url starts with /api
  const finalUrl = url.startsWith("/api") ? `${API_BASE}${url.slice(4)}` : url;
  const res = await fetch(finalUrl, init);
  let text = "";
  try {
    text = await res.text();
  } catch {}
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const msg =
      (data && (data.message || data.error)) || text || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data ?? { ok: true };
};

const getRoomInfo = (it: any) => {
  const ten =
    it?.TenPhong ??
    it?.tenPhong ??
    it?.Phong?.TenPhong ??
    it?.Phong?.tenPhong ??
    null;
  const so =
    it?.SoPhong ??
    it?.soPhong ??
    it?.Phong?.SoPhong ??
    it?.Phong?.soPhong ??
    null;
  return { ten, so };
};

const collectRoomInfos = (items?: any[], fallbackRow?: BookingRow) => {
  const arr = (items ?? []).map(getRoomInfo).filter((r) => r.ten || r.so);
  if (!arr.length && fallbackRow) {
    const ten = fallbackRow.TenPhong ?? null;
    const so = fallbackRow.SoPhong ?? null;
    if (ten || so) arr.push({ ten, so });
  }
  return arr;
};

const CheckInManager: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<BookingRow[]>([]);
  const [keyword, setKeyword] = useState("");
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const [viewMode, setViewMode] = useState<"using" | "checkin">("using");
  const [summaryMap, setSummaryMap] = useState<Record<string, any>>({});
  const [msg, contextHolder] = message.useMessage();

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const list = await fetchJson("/api/DatPhong");
      const normalizeBooking = (item: any) => {
        const chiTiet = (
          item.ChiTietDatPhongs ??
          item.chiTietDatPhongs ??
          []
        ).map((ct: any) => ({
          ...ct,
          TenPhong:
            ct.TenPhong ??
            ct.tenPhong ??
            ct?.Phong?.TenPhong ??
            ct?.Phong?.tenPhong ??
            ct?.SoPhong ??
            ct?.soPhong,
          SoPhong:
            ct.SoPhong ??
            ct.soPhong ??
            ct?.Phong?.SoPhong ??
            ct?.Phong?.soPhong,
          GiaPhong: ct.GiaPhong ?? ct.giaPhong,
          SoDem: ct.SoDem ?? ct.soDem,
          ThanhTien: ct.ThanhTien ?? ct.thanhTien,
        }));

        const topTen =
          item.TenPhong ??
          item.tenPhong ??
          (chiTiet && chiTiet.length === 1
            ? chiTiet[0].TenPhong ?? chiTiet[0].tenPhong
            : null);
        const topSo =
          item.SoPhong ??
          item.soPhong ??
          (chiTiet && chiTiet.length === 1
            ? chiTiet[0].SoPhong ?? chiTiet[0].soPhong
            : null);

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
          TrangThaiThanhToan:
            item.TrangThaiThanhToan ?? item.trangThaiThanhToan,
          ChiTietDatPhongs: chiTiet,
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
              TongTien: apiTotal > 0 ? apiTotal : fallbackTotal,
            };
          } catch {
            // Nếu summary lỗi, giữ nguyên TongTien gốc
            return row;
          }
        })
      );

      setData(mappedWithTotals);
    } catch (e: any) {
      message.error(e.message || "Không thể tải danh sách đặt phòng");
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
    setSummary(null);
    setSummaryLoading(true);
    try {
      const sum = await checkoutApi.getSummary(row.IddatPhong);
      // If summary doesn't include service lines but has an invoice id, try fetching invoice detail
      if (
        sum &&
        (!Array.isArray(sum.services) || sum.services.length === 0) &&
        Array.isArray(sum?.invoices) &&
        sum.invoices.length > 0
      ) {
        try {
          const firstInv = sum.invoices[0];
          const invId =
            firstInv?.id ?? firstInv?.IDHoaDon ?? firstInv?.ID ?? null;
          if (invId) {
            const invDetail = await invoiceApi.getInvoiceDetail(invId);
            if (invDetail && invDetail.data) {
              // normalize services from invoice detail if present
              const svc =
                invDetail.data.services ?? invDetail.data?.services ?? null;
              if (Array.isArray(svc) && svc.length > 0) {
                sum.services = svc;
              }
            }
          }
        } catch (e) {
          /* ignore fallback */
        }
      }
      console.debug("[openPaymentModal] summary for", row.IddatPhong, sum);
      // merge any booking-level services or client-selected services so older services show up
      const serverServices = Array.isArray(sum?.services) ? sum.services : [];
      const bookingServices: any[] = [];
      // try to read services from paymentRow if present (some responses use different shapes)
      if (Array.isArray((row as any)?.services))
        bookingServices.push(...(row as any).services);
      const mergedServices = [
        ...serverServices,
        ...bookingServices,
        ...(selectedServices || []),
      ];
      setSummary({ ...sum, services: mergedServices });
      const soDem = Number(sum?.dates?.soDem ?? row.SoDem ?? 1);
      const tienPhong = Math.round(
        Number(sum?.money?.roomTotal ?? (row.TongTien || 0))
      );
      const tongTien = Number(sum?.money?.tongTien ?? (row.TongTien || 0));
      form.setFieldsValue({
        TienPhong: tienPhong,
        SoLuongNgay: soDem,
        TongTien: tongTien,
        PhuongThucThanhToan: 1,
        GhiChu: "",
      });
    } catch (e: any) {
      message.error(e.message || "Không tải được tóm tắt thanh toán");
      form.setFieldsValue({
        TienPhong: Math.round(row.TongTien || 0),
        SoLuongNgay: row.SoDem || 1,
        TongTien: Number(row.TongTien || 0),
        PhuongThucThanhToan: 1,
        GhiChu: "",
      });
    } finally {
      setSummaryLoading(false);
    }
  };

  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [paymentInvoiceId, setPaymentInvoiceId] = useState<string | null>(null);

  const [invoiceModalVisible, setInvoiceModalVisible] = useState(false);
  const [invoiceData, setInvoiceData] = useState<any | null>(null);
  const [refreshAfterInvoiceClose, setRefreshAfterInvoiceClose] =
    useState(false);

  // Services state
  const [serviceModalVisible, setServiceModalVisible] = useState(false);
  const [selectedServices, setSelectedServices] = useState<Array<any>>([]);
  const [servicesTotal, setServicesTotal] = useState(0);

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
    if (viewMode === "checkin") {
      try {
        setPaymentRow(row);
        setInvoiceData(null);

        let sum: any = null;
        try {
          sum = await checkoutApi.getSummary(row.IddatPhong);
        } catch {
          sum = null;
        }

        let dp: any = null;
        if (!sum) {
          try {
            dp = await fetchJson(`/api/DatPhong/${row.IddatPhong}`);
          } catch {
            dp = null;
          }
        }

        const customer =
          sum?.customer ??
          (dp
            ? {
                name: dp?.TenKhachHang ?? dp?.idkhachHangNavigation?.HoTen,
                email: dp?.EmailKhachHang ?? dp?.idkhachHangNavigation?.Email,
              }
            : { name: row.TenKhachHang, email: row.EmailKhachHang });

        const dates =
          sum?.dates ??
          (dp
            ? { checkin: dp?.NgayNhanPhong, checkout: dp?.NgayTraPhong }
            : { checkin: row.NgayNhanPhong, checkout: row.NgayTraPhong });

        const room =
          sum?.room ??
          (dp
            ? {
                id: dp?.Idphong ?? dp?.idphong,
                tenPhong: dp?.TenPhong ?? dp?.idphongNavigation?.TenPhong,
                soPhong: dp?.SoPhong ?? dp?.idphongNavigation?.SoPhong,
              }
            : {
                id: row.Idphong,
                tenPhong: row.TenPhong,
                soPhong: row.SoPhong,
              });

        let baseItems: any[] = [];
        if (Array.isArray(sum?.items) && sum.items.length > 0)
          baseItems = sum.items;
        else if (
          Array.isArray(row?.ChiTietDatPhongs) &&
          row.ChiTietDatPhongs.length > 0
        )
          baseItems = row.ChiTietDatPhongs;
        else {
          try {
            const dpFull =
              dp ?? (await fetchJson(`/api/DatPhong/${row.IddatPhong}`));
            if (
              Array.isArray(dpFull?.ChiTietDatPhongs) &&
              dpFull.ChiTietDatPhongs.length > 0
            )
              baseItems = dpFull.ChiTietDatPhongs;
          } catch {
            /* ignore */
          }
        }

        if (!baseItems || baseItems.length === 0) {
          baseItems = [
            {
              TenPhong: row.TenPhong ?? room?.tenPhong ?? "Phòng",
              SoPhong: row.SoPhong ?? room?.soPhong ?? undefined,
              SoDem: row.SoDem ?? 1,
              GiaPhong: Math.round(
                (row.TongTien ?? 0) / Math.max(1, row.SoDem ?? 1)
              ),
              ThanhTien: row.TongTien ?? 0,
            },
          ];
        }

        const normalizedItems = (baseItems || []).map(
          (it: any, idx: number) => ({
            ID: it?.id ?? it?.IDChiTiet ?? idx,
            TenPhong:
              it?.TenPhong ??
              it?.tenPhong ??
              it?.Phong?.TenPhong ??
              it?.Phong?.tenPhong ??
              (it?.SoPhong ? `Phòng ${it.SoPhong}` : "Phòng"),
            SoPhong:
              it?.SoPhong ??
              it?.soPhong ??
              it?.Phong?.SoPhong ??
              it?.Phong?.soPhong ??
              null,
            SoDem: Number(it?.soDem ?? it?.SoDem ?? it?.Slngay ?? 1),
            GiaPhong: Number(it?.giaPhong ?? it?.GiaPhong ?? it?.Gia ?? 0),
            ThanhTien: Number(it?.thanhTien ?? it?.ThanhTien ?? it?.Tien ?? 0),
          })
        );

        // ensure services include server-side invoice services, any booking-level services and any client-selected ones
        const serverServices = Array.isArray(sum?.services) ? sum.services : [];
        const bookingServices = Array.isArray(dp?.services) ? dp.services : [];
        const mergedServices = [
          ...serverServices,
          ...bookingServices,
          ...(selectedServices || []),
        ];

        const merged: any = {
          customer,
          dates,
          Room: room,
          items: normalizedItems,
          invoiceRoomDetails: normalizedItems,
          services: mergedServices.length > 0 ? mergedServices : null,
          promotions: sum?.promotions ?? (dp ? dp?.promotions ?? null : null),
          money: sum?.money ?? (dp ? dp?.money ?? null : null),
          invoices: sum?.invoices ?? null,
        };

        const firstInv =
          sum?.invoices &&
          Array.isArray(sum.invoices) &&
          sum.invoices.length > 0
            ? sum.invoices[0]
            : null;
        if (firstInv) {
          merged.IDHoaDon =
            merged.IDHoaDon ??
            firstInv.id ??
            firstInv.IDHoaDon ??
            firstInv.IdhoaDon ??
            firstInv.idHoaDon ??
            null;
          merged.idHoaDon = merged.idHoaDon ?? merged.IDHoaDon;
          merged.HoaDon = merged.HoaDon ?? firstInv;
        }

        setInvoiceData(merged);
        console.debug(
          "[onViewInvoice] invoiceData prepared for",
          row.IddatPhong,
          merged
        );
        setInvoiceModalVisible(true);
      } catch (err) {
        message.error("Không thể mở hóa đơn");
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
      message.loading({
        content: "Đang xử lý thanh toán...",
        key,
        duration: 0,
      });

      // simplified: reuse previous logic when viewMode === 'checkout'
      // For brevity this demo delegates to existing checkoutApi methods
      const method = vals.PhuongThucThanhToan;
      const existingInvoiceId =
        summary?.invoices?.[0]?.IDHoaDon ?? summary?.invoices?.[0]?.id ?? null;

      // ... keep implementation small here; in practice reuse earlier logic
      if (existingInvoiceId) {
        if (method === 2) {
          const serverRemaining = Number(
            summary?.soTienConLai ??
              summary?.money?.soTienConLai ??
              summary?.invoices?.[0]?.soTienConLai ??
              0
          );
          const tongTien = Number(
            summary?.money?.tongTien ??
              form.getFieldValue("TongTien") ??
              paymentRow?.TongTien ??
              0
          );
          const daTra = Number(
            summary?.invoices?.[0]?.tienThanhToan ??
              summary?.money?.paidAmount ??
              0
          );
          const deposit = Number(summary?.money?.deposit ?? 0);
          const paidExcl = Math.max(0, daTra - deposit);
          const needToPay =
            serverRemaining > 0
              ? serverRemaining
              : Math.max(0, tongTien - deposit - paidExcl);
          try {
            const resp: any = await checkoutApi.payQr({
              IDDatPhong: paymentRow.IddatPhong,
              HoaDonId: existingInvoiceId,
              Amount: needToPay,
            });
            setQrUrl(resp?.paymentUrl ?? null);
            setPaymentInvoiceId(resp?.idHoaDon ?? existingInvoiceId);
            setQrModalVisible(true);
          } catch (err: any) {
            console.error("payQr failed", err);
            message.error(err?.message || "Không thể tạo liên kết QR");
          }
        } else {
          const serverRemaining = Number(
            summary?.soTienConLai ??
              summary?.money?.soTienConLai ??
              summary?.invoices?.[0]?.soTienConLai ??
              0
          );
          if (serverRemaining > 0) {
            await checkoutApi.confirmPaid(paymentRow.IddatPhong, {
              Amount: serverRemaining,
              HoaDonId: existingInvoiceId,
            });
          } else {
            const tongTien = Number(summary?.money?.tongTien ?? 0);
            const daTra = Number(
              summary?.invoices?.[0]?.tienThanhToan ??
                summary?.money?.paidAmount ??
                0
            );
            const deposit = Number(summary?.money?.deposit ?? 0);
            const daTraExcl = Math.max(0, daTra - deposit);
            const remaining = Math.max(0, tongTien - daTraExcl);
            if (remaining > 0)
              await checkoutApi.confirmPaid(paymentRow.IddatPhong, {
                Amount: remaining,
                HoaDonId: existingInvoiceId,
              });
          }
          msg.success("Cập nhật hóa đơn thành công");
          try {
            const fresh = await checkoutApi.getSummary(paymentRow.IddatPhong);
            setInvoiceData(fresh);
            setSummary(fresh);
          } catch (e) {
            console.warn(
              "[submitPayment] failed to reload summary after confirmPaid",
              e
            );
          }
          setInvoiceModalVisible(true);
        }
      } else {
        // create invoice for checkout mode
        // Ensure we send a valid TongTien (>0). Prefer form value, then server summary, then compute from room+services.
        const formTienPhong = Number(vals.TienPhong ?? 0);
        const formTongTien = Number(vals.TongTien ?? 0);
        const summaryRoom = Number(summary?.money?.roomTotal ?? 0);
        const summaryTotal = Number(summary?.money?.tongTien ?? 0);
        const svcTotal = Number(
          servicesTotal ?? summary?.money?.servicesTotal ?? 0
        );
        const roomTotalForCalc =
          formTienPhong > 0
            ? formTienPhong
            : summaryRoom > 0
            ? summaryRoom
            : Number(paymentRow?.TongTien ?? 0);
        const subtotalCalc = roomTotalForCalc + svcTotal;
        const computedTotalWithVat = Math.round(subtotalCalc * 1.1);
        let safeTongTien =
          formTongTien ||
          summaryTotal ||
          computedTotalWithVat ||
          Math.max(1, Math.round(roomTotalForCalc));
        if (safeTongTien <= 0)
          safeTongTien = Math.max(
            1,
            computedTotalWithVat,
            Math.round(roomTotalForCalc)
          );

        const res = await checkoutApi.createInvoice({
          IDDatPhong: paymentRow!.IddatPhong,
          PhuongThucThanhToan: method,
          // Mark paid for cash checkouts, pending for online
          TrangThaiThanhToan: method === 2 ? 1 : 2,
          GhiChu: vals.GhiChu ?? "",
          TongTien: safeTongTien,
          TienPhong: Math.round(roomTotalForCalc),
          SoLuongNgay: vals.SoLuongNgay ?? 1,
          TienCoc: Number(paymentRow?.TienCoc ?? 0),
          PreviousPayment: Number(paymentRow?.TienThanhToan ?? 0),
          Services: [],
        });
        if (method === 2) {
          setQrUrl(res?.paymentUrl || null);
          setPaymentInvoiceId(res?.idHoaDon ?? res?.id ?? null);
          setQrModalVisible(true);
        } else {
          msg.success("Tạo hóa đơn & thanh toán thành công");
          try {
            const fresh = await checkoutApi.getSummary(paymentRow.IddatPhong);
            setInvoiceData(fresh);
            setSummary(fresh);
          } catch (e) {
            console.warn(
              "[submitPayment] failed to load invoice summary after createInvoice",
              e
            );
          }
          setInvoiceModalVisible(true);
        }
      }

      setPaymentModalVisible(false);
      form.resetFields();
      // Avoid immediately reloading bookings in checkout mode so the booking stays visible
      if (viewMode === "checkin") {
        setRefreshAfterInvoiceClose(true);
        message.info(
          'Phòng sẽ tiếp tục hiển thị trong danh sách "Trả phòng hôm nay" để bạn kiểm tra hóa đơn.'
        );
      } else {
        await load();
      }
    } catch (err: any) {
      message.error(err?.message || "Thanh toán thất bại");
    }
  };

  // Handler for adding services from modal
  const handleServiceModalAdd = async () => {
    if (selectedServices.length === 0) {
      message.warning("Vui lòng chọn ít nhất 1 dịch vụ");
      return;
    }

    // In 'using' mode: add services to invoice (create invoice if needed), then refresh summary
    if (viewMode === "using") {
      if (!paymentRow) {
        message.error("Không có đặt phòng được chọn");
        return;
      }
      const key = `add_service_${paymentRow.IddatPhong}`;
      msg.loading({ content: "Đang thêm dịch vụ...", key, duration: 0 });
      try {
        // The business rule is: ONE booking has ONE invoice.
        // If an invoice exists, we add services to it.
        // If it does NOT exist, we create it.
        // The backend's `add-service-to-invoice` endpoint handles both cases now.
        await checkoutApi.addServiceToInvoice({
          IDDatPhong: paymentRow.IddatPhong,
          DichVu: selectedServices.map((s) => ({
            IddichVu: String(s.serviceId),
            TenDichVu: s.serviceName,
            DonGia: Math.round(Number(s.price) || 0),
            TongTien: Math.round(
              Number((s.price || 0) * (s.quantity || 1)) || 0
            ),
            TienDichVu: Math.round(
              Number((s.price || 0) * (s.quantity || 1)) || 0
            ),
            GhiChu: "",
          })),
        });

        msg.success("Thêm dịch vụ thành công");
        // mark booking so UI can show "Xem hóa đơn"
        setViewInvoiceIds((prev) => {
          const id = paymentRow?.IddatPhong;
          if (!id) return prev || [];
          return Array.from(new Set([...(prev || []), id]));
        });
        // Insert a minimal temporary row immediately so the operator sees the booking
        setData((prev) => {
          if (!paymentRow) return prev;
          const exists = (prev || []).some(
            (p) => p.IddatPhong === paymentRow.IddatPhong
          );
          if (exists) return prev;
          const newRow: BookingRow = {
            IddatPhong: paymentRow.IddatPhong,
            IdkhachHang: paymentRow.IdkhachHang,
            TenKhachHang: paymentRow.TenKhachHang,
            EmailKhachHang: paymentRow.EmailKhachHang,
            Idphong: paymentRow.Idphong,
            TenPhong: paymentRow.TenPhong,
            SoPhong: paymentRow.SoPhong,
            NgayNhanPhong: paymentRow.NgayNhanPhong,
            NgayTraPhong: paymentRow.NgayTraPhong,
            SoDem: paymentRow.SoDem,
            TongTien: paymentRow.TongTien ?? 0,
            TienCoc: paymentRow.TienCoc,
            TrangThai: paymentRow.TrangThai ?? 3,
            TrangThaiThanhToan: paymentRow.TrangThaiThanhToan ?? 1,
            ChiTietDatPhongs: paymentRow.ChiTietDatPhongs ?? [],
          };
          return [newRow, ...(prev || [])];
        });
        setServiceModalVisible(false);
        setSelectedServices([]);
        setServicesTotal(0);

        // refresh summary so payment/invoice modal shows newly added services
        try {
          const fresh = await checkoutApi.getSummary(paymentRow.IddatPhong);
          setSummary(fresh);
        } catch {
          /* ignore */
        }
        // notify any open detail views that this booking's services changed
        try {
          window.dispatchEvent(
            new CustomEvent("booking:services-updated", {
              detail: { id: paymentRow.IddatPhong },
            })
          );
        } catch {}
        // refresh bookings list so UI reflects new invoice/service rows
        await load();
        // If the booking disappeared from the loaded data for any reason, re-insert it
        setData((prev) => {
          if (!paymentRow) return prev;
          const exists = (prev || []).some(
            (p) => p.IddatPhong === paymentRow.IddatPhong
          );
          if (exists) return prev;
          const newRow: BookingRow = {
            IddatPhong: paymentRow.IddatPhong,
            IdkhachHang: paymentRow.IdkhachHang,
            TenKhachHang: paymentRow.TenKhachHang,
            EmailKhachHang: paymentRow.EmailKhachHang,
            Idphong: paymentRow.Idphong,
            TenPhong: paymentRow.TenPhong,
            SoPhong: paymentRow.SoPhong,
            NgayNhanPhong: paymentRow.NgayNhanPhong,
            NgayTraPhong: paymentRow.NgayTraPhong,
            SoDem: paymentRow.SoDem,
            TongTien: paymentRow.TongTien ?? 0,
            TienCoc: paymentRow.TienCoc,
            TrangThai: paymentRow.TrangThai ?? 3,
            TrangThaiThanhToan: paymentRow.TrangThaiThanhToan ?? 1,
            ChiTietDatPhongs: paymentRow.ChiTietDatPhongs ?? [],
          };
          return [newRow, ...prev];
        });
        msg.destroy(key);
      } catch (e: any) {
        msg.error(e?.message || "Thêm dịch vụ thất bại");
        msg.destroy(key);
      }
      return;
    }

    // For checkout mode: require existing invoice and call backend
    try {
      const existingInvoiceId =
        summary?.invoices?.[0]?.IDHoaDon ?? summary?.invoices?.[0]?.id ?? null;
      if (!existingInvoiceId) {
        msg.error("Chưa có hóa đơn để thêm dịch vụ!");
        return;
      }
      await checkoutApi.addServiceToInvoice({
        IDDatPhong: paymentRow!.IddatPhong,
        DichVu: selectedServices.map((s) => ({
          IddichVu: String(s.serviceId),
          TenDichVu: s.serviceName,
          DonGia: Math.round(Number(s.price) || 0),
          TongTien: Math.round(Number((s.price || 0) * (s.quantity || 1)) || 0),
          TienDichVu: Math.round(
            Number((s.price || 0) * (s.quantity || 1)) || 0
          ),
          GhiChu: "",
        })),
      });
      msg.success("Thêm dịch vụ thành công");
      // keep UI consistent with 'using' flow: mark booking to show invoice details and keep it visible
      setServiceModalVisible(false);
      setSelectedServices([]);
      setServicesTotal(0);
      // refresh summary and bookings list
      if (paymentRow) {
        const fresh = await checkoutApi.getSummary(paymentRow.IddatPhong);
        console.debug(
          "[handleServiceModalAdd] fresh summary after add-service",
          paymentRow.IddatPhong,
          fresh
        );
        setSummary(fresh);
        // also update invoice modal data so checkout invoice form shows new services immediately
        setInvoiceData(fresh);
        // notify any open detail views that this booking's services changed
        try {
          window.dispatchEvent(
            new CustomEvent("booking:services-updated", {
              detail: { id: paymentRow.IddatPhong },
            })
          );
        } catch {}
      }
      // mark booking so UI can show "Xem hóa đơn" immediately
      setViewInvoiceIds((prev) => {
        const id = paymentRow?.IddatPhong;
        if (!id) return prev || [];
        return Array.from(new Set([...(prev || []), id]));
      });
      // Insert a minimal temporary row immediately so the operator sees the booking
      setData((prev) => {
        if (!paymentRow) return prev;
        const exists = (prev || []).some(
          (p) => p.IddatPhong === paymentRow.IddatPhong
        );
        if (exists) return prev;
        const newRow: BookingRow = {
          IddatPhong: paymentRow.IddatPhong,
          IdkhachHang: paymentRow.IdkhachHang,
          TenKhachHang: paymentRow.TenKhachHang,
          EmailKhachHang: paymentRow.EmailKhachHang,
          Idphong: paymentRow.Idphong,
          TenPhong: paymentRow.TenPhong,
          SoPhong: paymentRow.SoPhong,
          NgayNhanPhong: paymentRow.NgayNhanPhong,
          NgayTraPhong: paymentRow.NgayTraPhong,
          SoDem: paymentRow.SoDem,
          TongTien: paymentRow.TongTien ?? 0,
          TienCoc: paymentRow.TienCoc,
          TrangThai: paymentRow.TrangThai ?? 3,
          TrangThaiThanhToan: paymentRow.TrangThaiThanhToan ?? 1,
          ChiTietDatPhongs: paymentRow.ChiTietDatPhongs ?? [],
        };
        return [newRow, ...(prev || [])];
      });
      await load();
      // If the booking disappeared from the loaded data for any reason, re-insert it so the operator can still view details
      setData((prev) => {
        if (!paymentRow) return prev;
        const exists = (prev || []).some(
          (p) => p.IddatPhong === paymentRow.IddatPhong
        );
        if (exists) return prev;
        const newRow: BookingRow = {
          IddatPhong: paymentRow.IddatPhong,
          IdkhachHang: paymentRow.IdkhachHang,
          TenKhachHang: paymentRow.TenKhachHang,
          EmailKhachHang: paymentRow.EmailKhachHang,
          Idphong: paymentRow.Idphong,
          TenPhong: paymentRow.TenPhong,
          SoPhong: paymentRow.SoPhong,
          NgayNhanPhong: paymentRow.NgayNhanPhong,
          NgayTraPhong: paymentRow.NgayTraPhong,
          SoDem: paymentRow.SoDem,
          TongTien: paymentRow.TongTien ?? 0,
          TienCoc: paymentRow.TienCoc,
          TrangThai: paymentRow.TrangThai ?? 3,
          TrangThaiThanhToan: paymentRow.TrangThaiThanhToan ?? 1,
          ChiTietDatPhongs: paymentRow.ChiTietDatPhongs ?? [],
        };
        return [newRow, ...prev];
      });
    } catch (e: any) {
      msg.error(e?.message || "Thêm dịch vụ thất bại");
    }
  };

  const completeCheckout = async (row: BookingRow) => {
    Modal.confirm({
      title: `Hoàn tất trả phòng - ${row.IddatPhong}`,
      content:
        "Xác nhận hoàn tất trả phòng? Sau khi xác nhận, sẽ mở form hóa đơn để bạn kiểm tra trước khi hoàn tất và gửi mail cho khách.",
      onOk: async () => {
        const key = `complete_${row.IddatPhong}`;
        message.loading({
          content: "Chuẩn bị dữ liệu hóa đơn...",
          key,
          duration: 0,
        });
        try {
          setPaymentRow(row);
          setInvoiceData(null);

          // Try load summary first, fallback to DatPhong details
          let sum: any = null;
          try {
            sum = await checkoutApi.getSummary(row.IddatPhong);
          } catch {
            sum = null;
          }

          let dp: any = null;
          if (!sum) {
            try {
              dp = await fetchJson(`/api/DatPhong/${row.IddatPhong}`);
            } catch {
              dp = null;
            }
          }

          const customer =
            sum?.customer ??
            (dp
              ? {
                  name: dp?.TenKhachHang ?? dp?.idkhachHangNavigation?.HoTen,
                  email: dp?.EmailKhachHang ?? dp?.idkhachHangNavigation?.Email,
                }
              : { name: row.TenKhachHang, email: row.EmailKhachHang });

          const dates =
            sum?.dates ??
            (dp
              ? { checkin: dp?.NgayNhanPhong, checkout: dp?.NgayTraPhong }
              : { checkin: row.NgayNhanPhong, checkout: row.NgayTraPhong });

          const room =
            sum?.room ??
            (dp
              ? {
                  id: dp?.Idphong ?? dp?.idphong,
                  tenPhong: dp?.TenPhong ?? dp?.idphongNavigation?.TenPhong,
                  soPhong: dp?.SoPhong ?? dp?.idphongNavigation?.SoPhong,
                }
              : {
                  id: row.Idphong,
                  tenPhong: row.TenPhong,
                  soPhong: row.SoPhong,
                });

          // Build base items (room lines)
          let baseItems: any[] = [];
          if (Array.isArray(sum?.items) && sum.items.length > 0)
            baseItems = sum.items;
          else if (
            Array.isArray(row?.ChiTietDatPhongs) &&
            row.ChiTietDatPhongs.length > 0
          )
            baseItems = row.ChiTietDatPhongs;
          else {
            try {
              const dpFull =
                dp ?? (await fetchJson(`/api/DatPhong/${row.IddatPhong}`));
              if (
                Array.isArray(dpFull?.ChiTietDatPhongs) &&
                dpFull.ChiTietDatPhongs.length > 0
              )
                baseItems = dpFull.ChiTietDatPhongs;
            } catch {
              /* ignore */
            }
          }

          if (!baseItems || baseItems.length === 0) {
            baseItems = [
              {
                TenPhong: row.TenPhong ?? room?.tenPhong ?? "Phòng",
                SoPhong: row.SoPhong ?? room?.soPhong ?? undefined,
                SoDem: row.SoDem ?? 1,
                GiaPhong: Math.round(
                  (row.TongTien ?? 0) / Math.max(1, row.SoDem ?? 1)
                ),
                ThanhTien: row.TongTien ?? 0,
              },
            ];
          }

          const normalizedItems = (baseItems || []).map(
            (it: any, idx: number) => ({
              ID: it?.id ?? it?.IDChiTiet ?? idx,
              TenPhong:
                it?.TenPhong ??
                it?.tenPhong ??
                it?.Phong?.TenPhong ??
                it?.Phong?.tenPhong ??
                (it?.SoPhong ? `Phòng ${it.SoPhong}` : "Phòng"),
              SoPhong:
                it?.SoPhong ??
                it?.soPhong ??
                it?.Phong?.SoPhong ??
                it?.Phong?.soPhong ??
                null,
              SoDem: Number(it?.soDem ?? it?.SoDem ?? it?.Slngay ?? 1),
              GiaPhong: Number(it?.giaPhong ?? it?.GiaPhong ?? it?.Gia ?? 0),
              ThanhTien: Number(
                it?.thanhTien ?? it?.ThanhTien ?? it?.Tien ?? 0
              ),
            })
          );

          // merge server invoice services, booking-level services (if any) and any client-selected services
          const serverServices = Array.isArray(sum?.services)
            ? sum.services
            : [];
          const bookingServices = Array.isArray(dp?.services)
            ? dp.services
            : [];
          const mergedServices = [
            ...serverServices,
            ...bookingServices,
            ...(selectedServices || []),
          ];

          const merged: any = {
            customer,
            dates,
            Room: room,
            items: normalizedItems,
            invoiceRoomDetails: normalizedItems,
            services: mergedServices.length > 0 ? mergedServices : null,
            promotions: sum?.promotions ?? (dp ? dp?.promotions ?? null : null),
            money: sum?.money ?? (dp ? dp?.money ?? null : null),
            invoices: sum?.invoices ?? null,
          };

          const firstInv =
            sum?.invoices &&
            Array.isArray(sum.invoices) &&
            sum.invoices.length > 0
              ? sum.invoices[0]
              : null;
          if (firstInv) {
            merged.IDHoaDon =
              merged.IDHoaDon ??
              firstInv.id ??
              firstInv.IDHoaDon ??
              firstInv.IdhoaDon ??
              firstInv.idHoaDon ??
              null;
            merged.idHoaDon = merged.idHoaDon ?? merged.IDHoaDon;
            merged.HoaDon = merged.HoaDon ?? firstInv;
          }

          setInvoiceData(merged);
          setInvoiceModalVisible(true);
          message.success({
            content: "Mở form hóa đơn để kiểm tra trước khi hoàn tất trả phòng",
            key,
            duration: 2,
          });
        } catch (e: any) {
          message.error({
            content: e?.message || "Không thể tải dữ liệu hóa đơn",
            key,
            duration: 3,
          });
        }
      },
    });
  };

  const markPaid = async (row: BookingRow) => {
    // Open the payment modal so operator can choose cash or QR and submit — removes extra confirm
    setPaymentRow(row);
    try {
      const sum = await checkoutApi.getSummary(row.IddatPhong);
      setSummary(sum);
      setInvoiceData(sum);
    } catch {
      setSummary(null);
      setInvoiceData(null);
    }
    setPaymentModalVisible(true);
  };

  const due = useMemo(() => {
    const sel = selectedDate ? selectedDate.format("YYYY-MM-DD") : null;
    return (data || []).filter((d: BookingRow) => {
      // If this booking was recently modified and we flagged it to show invoice details,
      // always keep it visible so the operator can click "Xem chi tiết" immediately.
      if (
        Array.isArray(viewInvoiceIds) &&
        viewInvoiceIds.includes(d.IddatPhong)
      )
        return true;

      // If a status filter is set, filter by that status
      if (statusFilter && statusFilter.trim()) {
        if (String(d.TrangThai ?? 0) !== statusFilter) return false;
      } else {
        // Otherwise, only show bookings currently in use (TrangThai === 3)
        if ((d.TrangThai ?? 0) !== 3) return false;
      }
      // If a date is selected, match by NgayNhanPhong (check-in date)
      if (sel) {
        const checkin = (d.NgayNhanPhong || "").slice(0, 10);
        if (!checkin || checkin !== sel) return false;
      }
      if (keyword && keyword.trim()) {
        const k = keyword.trim().toLowerCase();
        return (
          String(d.IddatPhong || "") +
          " " +
          (d.TenKhachHang || "") +
          " " +
          (d.EmailKhachHang || "")
        )
          .toLowerCase()
          .includes(k);
      }
      return true;
    });
  }, [data, keyword, viewMode, selectedDate, viewInvoiceIds]);

  const roomLines = useMemo(() => {
    if (!paymentRow) return [] as string[];
    const infos = collectRoomInfos(
      paymentRow?.ChiTietDatPhongs,
      paymentRow || undefined
    );
    return infos.map(
      (info) => info.ten ?? (info.so ? `Phòng ${info.so}` : "-")
    );
  }, [paymentRow]);

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <Slidebar />
      <div style={{ marginLeft: 280 }}>
        <HeaderSection showStats={false} />
        <main style={{ padding: "0px 60px" }}>
          {contextHolder}

          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 20,
              boxShadow: "0 8px 24px rgba(2,6,23,0.06)",
            }}
          >
            <h2 style={{ marginBottom: 16 }}>Quản lý nhận phòng</h2>

            {/* Full Booking management section embedded on the Check-in page */}
            <Card style={{ marginBottom: 12 }}>
              <h3 style={{ marginBottom: 12 }}>Quản Lý Check-In</h3>
              <CheckinSection />
            </Card>
            <div style={{ marginBottom: 12 }}>
              <Card style={{ marginBottom: 12 }}>
                <Space wrap>
                  <Input.Search
                    placeholder="Tìm kiếm mã đặt / khách / email"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                  />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    style={{
                      padding: "8px 12px",
                      border: "1px solid #e5e7eb",
                      borderRadius: 10,
                      background: "#fff",
                      fontSize: 13,
                    }}
                  >
                    <option value="">Tất cả trạng thái</option>
                    <option value="0">Đã hủy</option>
                    <option value="1">Chờ xác nhận</option>
                    <option value="2">Đã xác nhận</option>
                    <option value="3">Đang sử dụng</option>
                    <option value="4">Hoàn thành</option>
                  </select>
                  <DatePicker
                    value={selectedDate}
                    onChange={(d) => setSelectedDate(d)}
                    format="YYYY-MM-DD"
                    allowClear={true}
                  />
                  <Button onClick={() => setSelectedDate(dayjs())}>
                    Hôm nay
                  </Button>
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
                onViewChange={(mode: "using" | "checkin") => setViewMode(mode)}
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
              onCancel={() => {
                setPaymentModalVisible(false);
                setPaymentRow(null);
                setSummary(null);
                form.resetFields();
              }}
              onSubmit={submitPayment}
            />

            <Modal
              title={
                paymentRow
                  ? `Thêm dịch vụ cho ${paymentRow.IddatPhong}`
                  : "Thêm dịch vụ"
              }
              open={serviceModalVisible}
              width={900}
              onCancel={() => {
                setServiceModalVisible(false);
                setSelectedServices([]);
                setServicesTotal(0);
              }}
              footer={[
                <Button
                  key="cancel"
                  onClick={() => {
                    setServiceModalVisible(false);
                    setSelectedServices([]);
                    setServicesTotal(0);
                  }}
                >
                  Hủy
                </Button>,
                <Button
                  key="add"
                  type="primary"
                  onClick={handleServiceModalAdd}
                >
                  Thêm dịch vụ
                </Button>,
              ]}
            >
              <div style={{ minHeight: 320 }}>
                <ServicesSelector onServicesChange={handleServicesChange} />
                {selectedServices && selectedServices.length > 0 && (
                  <div style={{ marginTop: 12, textAlign: "right" }}>
                    <div style={{ fontSize: 14 }}>
                      <strong>Tổng dịch vụ:</strong>{" "}
                      {Number(servicesTotal).toLocaleString()} đ
                    </div>
                  </div>
                )}
              </div>
            </Modal>

            <Modal
              title="Thanh toán online - Quét mã QR"
              open={qrModalVisible}
              onCancel={() => {
                setQrModalVisible(false);
                setQrUrl(null);
                setPaymentModalVisible(false);
                setPaymentRow(null);
                setSummary(null);
                form.resetFields();
                load();
              }}
              footer={[
                <Button
                  key="close"
                  onClick={() => {
                    setQrModalVisible(false);
                    setQrUrl(null);
                    setPaymentModalVisible(false);
                    setPaymentRow(null);
                    setSummary(null);
                    form.resetFields();
                    load();
                  }}
                >
                  Đóng
                </Button>,
                <Button
                  key="paid"
                  type="primary"
                  onClick={async () => {
                    const key = `confirm_${
                      paymentRow?.IddatPhong ?? "unknown"
                    }`;
                    message.loading({
                      content: "Đang xác nhận thanh toán...",
                      key,
                      duration: 0,
                    });
                    try {
                      if (paymentRow) {
                        const serverRemaining = Number(
                          summary?.soTienConLai ??
                            summary?.money?.soTienConLai ??
                            summary?.invoices?.[0]?.soTienConLai ??
                            0
                        );
                        const tongTien = Number(
                          summary?.money?.tongTien ??
                            form.getFieldValue("TongTien") ??
                            paymentRow?.TongTien ??
                            0
                        );
                        const daTra = Number(
                          summary?.invoices?.[0]?.tienThanhToan ??
                            summary?.money?.paidAmount ??
                            0
                        );
                        const deposit = Number(summary?.money?.deposit ?? 0);
                        const paidExcl = Math.max(0, daTra - deposit);
                        const amount =
                          serverRemaining > 0
                            ? serverRemaining
                            : Math.max(0, tongTien - deposit - paidExcl);
                        const payload: any = { Amount: amount };
                        if (paymentInvoiceId)
                          payload.HoaDonId = paymentInvoiceId;
                        const resp = await checkoutApi.confirmPaid(
                          paymentRow.IddatPhong,
                          payload
                        );
                        if (resp !== null) {
                          message.success({
                            content: "Xác nhận thanh toán thành công",
                            key,
                            duration: 2,
                          });
                          try {
                            const fresh = await checkoutApi.getSummary(
                              paymentRow.IddatPhong
                            );
                            setInvoiceData(fresh);
                          } catch {}
                        } else {
                          message.warning({
                            content:
                              "Không nhận được phản hồi xác nhận từ server",
                            key,
                            duration: 3,
                          });
                        }
                      }
                    } catch (err: any) {
                      message.error({
                        content: err?.message || "Lỗi khi xác nhận thanh toán",
                        key,
                        duration: 3,
                      });
                    } finally {
                      setQrModalVisible(false);
                      setQrUrl(null);
                      setPaymentModalVisible(false);
                      setInvoiceModalVisible(true);
                      setPaymentRow(null);
                      setSummary(null);
                      form.resetFields();
                      await load();
                    }
                  }}
                >
                  Đã thanh toán
                </Button>,
              ]}
            >
              {qrUrl ? (
                <div style={{ textAlign: "center" }}>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(
                      qrUrl
                    )}`}
                    alt="QR"
                  />
                  <div style={{ marginTop: 12 }}>
                    <a href={qrUrl} target="_blank" rel="noreferrer">
                      Mở liên kết thanh toán
                    </a>
                  </div>
                </div>
              ) : (
                <div>Không tìm thấy liên kết thanh toán</div>
              )}
            </Modal>

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
                if (refreshAfterInvoiceClose) {
                  await load();
                  setRefreshAfterInvoiceClose(false);
                }
              }}
              onComplete={async (id) => {
                try {
                  // For check-ins we must only update the payment status and keep the booking.TrangThai = 3 (Đang sử dụng)
                  if (typeof id !== "undefined" && id !== null) {
                    const resp = await checkinApi.completePayment(id);
                    // resp is expected to include trangThaiThanhToan; show success and refresh
                    msg.success("Thanh toán thành công");
                    setInvoiceModalVisible(false);
                    await load();
                  } else {
                    throw new Error("Không có id để hoàn tất thanh toán");
                  }
                } catch (e: any) {
                  message.error(e?.message || "Thanh toán thất bại");
                }
              }}
            />
          </div>
        </main>
      </div>
    </div>
  );
};

export default CheckInManager;
