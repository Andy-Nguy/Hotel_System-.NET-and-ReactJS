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
import reviewApi from "../../api/review.Api";

import CheckoutTable from "../components/checkout/CheckoutTable";
import PaymentModal from "../components/checkout/PaymentModal";
import InvoiceModal from "../components/checkout/InvoiceModal";
import ServicesSelector from "../../components/ServicesSelector";

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

const CheckoutManager: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<BookingRow[]>([]);
  const [keyword, setKeyword] = useState("");
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(dayjs());

  const [viewMode, setViewMode] = useState<"using" | "checkout">("checkout");
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

      // 2. Xác định những booking nào cần lấy summary (chỉ lấy những cái đang hiển thị)
      const todayStr = dayjs().format("YYYY-MM-DD");
      const relevantBookings = mapped.filter((b: BookingRow) => {
        if (viewMode === "using" || viewMode === "checkout") {
          return b.TrangThai === 3; // Đang sử dụng
        } else {
          // Checkout mode: trả phòng hôm nay
          return (
            b.NgayTraPhong?.startsWith(todayStr) &&
            [3, 4].includes(b.TrangThai ?? 0)
          );
        }
      });

      // 3. Gọi summary song song cho tất cả booking cần thiết
      const summaryResults = await Promise.all(
        relevantBookings.map(async (booking: BookingRow) => {
          try {
            const sum = await checkoutApi.getSummary(booking.IddatPhong);
            return { id: booking.IddatPhong, summary: sum };
          } catch (err) {
            console.warn(
              `Không lấy được summary cho ${booking.IddatPhong}`,
              err
            );
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
    setSummaryLoading(true);
    try {
      const sum = await checkoutApi.getSummary(row.IddatPhong);
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
    if (viewMode === "checkout") {
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

      const method = vals.PhuongThucThanhToan; // 1=Cash, 2=QR
      const existingInvoiceId =
        summary?.invoices?.[0]?.IDHoaDon ?? summary?.invoices?.[0]?.id ?? null;

      if (existingInvoiceId) {
        // NẾU ĐÃ CÓ HÓA ĐƠN
        if (method === 2) {
          // --- QR (use server remaining or compute remaining excluding deposit) ---
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
          // --- TIỀN MẶT (SỬA) ---
          // Tính số tiền còn thiếu để trả nốt
          const tongTien = Number(
            summary?.money?.tongTien ?? form.getFieldValue("TongTien") ?? 0
          );
          const daTra = Number(
            summary?.invoices?.[0]?.tienThanhToan ??
              summary?.money?.paidAmount ??
              0
          );
          const deposit = Number(summary?.money?.deposit ?? 0);
          const daTraExcl = Math.max(0, daTra - deposit);
          const remaining = Math.max(0, tongTien - daTraExcl);

          // Gọi confirmPaid thay vì createInvoice
          // Gửi remaining lên để server chốt đơn (Status=2, TienThanhToan=TongTien)
          await checkoutApi.confirmPaid(paymentRow.IddatPhong, {
            Amount: remaining,
            HoaDonId: existingInvoiceId,
            Note: vals.GhiChu,
          });

          msg.success("Cập nhật hóa đơn & thanh toán thành công");
          try {
            const fresh = await checkoutApi.getSummary(paymentRow.IddatPhong);
            setInvoiceData(fresh);
            setSummary(fresh);
          } catch (e) {
            console.warn("Failed to reload summary", e);
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

        const res = await checkoutApi.createInvoice({
          IDDatPhong: paymentRow.IddatPhong,
          PhuongThucThanhToan: method,
          // Tiền mặt (1) -> Gửi trạng thái 2 (Đã thanh toán). QR (2) -> Gửi 1 (Chờ)
          TrangThaiThanhToan: method === 2 ? 1 : 2,
          GhiChu: vals.GhiChu ?? '',
          TongTien: invoiceAmountToUse,
          TienPhong: Math.round(roomTotalForCalc),
          SoLuongNgay: vals.SoLuongNgay ?? 1,
          Services: [],
        });

        if (method === 2) {
          // After creating invoice for online payment, explicitly request a QR payment link
          // for the customer's remaining due (we computed remainingToPay above).
          try {
            const hoaDonId = res?.idHoaDon ?? res?.id ?? null;
            const payResp: any = await checkoutApi.payQr({ IDDatPhong: paymentRow.IddatPhong, HoaDonId: hoaDonId, Amount: remainingToPay });
            setQrUrl(payResp?.paymentUrl ?? payResp?.qr ?? null);
            setPaymentInvoiceId(hoaDonId);
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
                setInvoiceData(fresh);
              }
            } catch (e) { /* ignore */ }
            setQrModalVisible(true);
          } catch (e: any) {
            console.error('payQr after createInvoice failed', e);
            message.error(e?.message || 'Không thể tạo liên kết QR');
          }
        } else {
          msg.success("Thanh toán thành công");
          try {
            const fresh = await checkoutApi.getSummary(paymentRow.IddatPhong);
            setInvoiceData(fresh);
            setSummary(fresh);
            try {
              window.dispatchEvent(
                new CustomEvent("booking:services-updated", {
                  detail: { id: paymentRow.IddatPhong },
                })
              );
            } catch {}
          } catch (e) {}
          setInvoiceModalVisible(true);
        }
      }

      setPaymentModalVisible(false);
      form.resetFields();
      // Avoid immediately reloading bookings in checkout mode so the booking stays visible
      if (viewMode === "checkout") {
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
      message.loading({ content: "Đang thêm dịch vụ...", key, duration: 0 });
      try {
        // try to get current summary to find existing invoice
        let sum: any = null;
        try {
          sum = await checkoutApi.getSummary(paymentRow.IddatPhong);
        } catch {
          sum = null;
        }
        const existingInvoiceId =
          sum?.invoices?.[0]?.IDHoaDon ?? sum?.invoices?.[0]?.id ?? null;

        if (existingInvoiceId) {
          await fetchJson('/api/TraPhong/them-dich-vu-vao-hoa-don', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ IDDatPhong: paymentRow.IddatPhong, DichVu: selectedServices.map(s => ({ IddichVu: String(s.serviceId), TienDichVu: Math.round(Number(s.price) || 0) })) })
          });
        } else {
          // Do NOT auto-create invoice when adding services.
          // Require the operator to create an invoice first from the checkout/payment flow.
          message.destroy(key);
          message.error(
            "Chưa có hóa đơn. Vui lòng tạo hóa đơn trước khi thêm dịch vụ."
          );
          return;
        }

        msg.success("Thêm dịch vụ thành công");
        // mark booking so UI can show "Xem hóa đơn"
        setViewInvoiceIds((prev) =>
          Array.from(new Set([...(prev || []), paymentRow.IddatPhong]))
        );
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
        // refresh bookings list so UI reflects new invoice/service rows
        await load();
        message.destroy(key);
      } catch (e: any) {
        message.error(e?.message || "Thêm dịch vụ thất bại");
        message.destroy(key);
      }
      return;
    }

    // For checkout mode: require existing invoice and call backend
    try {
      const existingInvoiceId =
        summary?.invoices?.[0]?.IDHoaDon ?? summary?.invoices?.[0]?.id ?? null;
      if (!existingInvoiceId) {
        message.error("Chưa có hóa đơn để thêm dịch vụ!");
        return;
      }
      if (!paymentRow) {
        message.error("Không có đặt phòng được chọn");
        return;
      }
      await fetchJson('/api/TraPhong/them-dich-vu-vao-hoa-don', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ IDDatPhong: paymentRow.IddatPhong, DichVu: selectedServices.map(s => ({ IddichVu: String(s.serviceId), TienDichVu: Math.round(Number(s.price) || 0) })) })
      });
      msg.success("Thêm dịch vụ thành công");
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
        // notify other components that services/invoice changed for this booking
        try {
          window.dispatchEvent(
            new CustomEvent("booking:services-updated", {
              detail: { id: paymentRow.IddatPhong },
            })
          );
        } catch {}
      }
      await load();
    } catch (e: any) {
      message.error(e?.message || "Thêm dịch vụ thất bại");
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
    // Open the payment modal so the operator can choose cash or QR and submit once —
    // this removes the extra confirm dialog and lets the modal handle creating invoice / showing QR.
    setPaymentRow(row);
    try {
      const sum = await checkoutApi.getSummary(row.IddatPhong);
      setSummary(sum);
      setInvoiceData(sum);
    } catch {
      // keep existing summary to preserve previously-paid amounts
      setInvoiceData(null);
    }
    setPaymentModalVisible(true);
  };

  const due = useMemo(() => {
    const todayStr = dayjs().format("YYYY-MM-DD");
    return (data || []).filter((d: BookingRow) => {
      if ((d.TrangThai ?? 0) === 4) return false;
      const checkout = (d.NgayTraPhong || "").slice(0, 10);
      if (viewMode === "using") {
        if ((d.TrangThai ?? 0) !== 3) return false;
      } else {
        if (!checkout || checkout !== todayStr) return false;
        // Show both 'Đang sử dụng (3)' and recently 'Đã hoàn tất (4)' in the "Trả phòng hôm nay" view
        // so that a booking remains visible immediately after completing checkout for confirmation.
        if (!((d.TrangThai ?? 0) === 3 || (d.TrangThai ?? 0) === 4))
          return false;
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
  }, [data, keyword, viewMode, selectedDate]);

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
      <div style={{ marginLeft: 240 }}>
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
              data={due}
              loading={loading}
           onPay={markPaid}
           onOpenPaymentForm={openPaymentModal}
              onComplete={completeCheckout}
              onAddService={handleAddService}
              onViewInvoice={onViewInvoice}
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
                  if (typeof id !== "undefined" && id !== null) {
                    // Ensure invoice is marked as fully paid before completing checkout
                    try {
                      const hoaDonId =
                        invoiceData?.IDHoaDon ??
                        invoiceData?.idHoaDon ??
                        invoiceData?.IDHoaDon ??
                        null;
                      if (hoaDonId) {
                        // call confirmPaid with no amount (backend will treat as full payment)
                        await checkoutApi.confirmPaid(id, {
                          HoaDonId: hoaDonId,
                        });
                      } else {
                        await checkoutApi.confirmPaid(id);
                      }
                    } catch (e) {
                      // Log but continue to complete checkout — operator may still want to finish
                      console.warn("[onComplete] confirmPaid failed", e);
                    }

                    await checkoutApi.completeCheckout(id);

                    // Trigger review email send (async, non-blocking)
                    // Extract booking ID and send review reminder email
                    if (paymentRow && paymentRow.EmailKhachHang) {
                      try {
                        await reviewApi.sendReviewEmail(
                          paymentRow.IddatPhong,
                          paymentRow.EmailKhachHang
                        );
                        message.info(
                          "Email cảm ơn kèm liên kết đánh giá đã được gửi tới khách hàng"
                        );
                      } catch (emailErr: any) {
                        console.warn("Failed to send review email:", emailErr);
                        // Don't fail checkout if email fails — it's non-critical
                      }
                    }

                    msg.success("Hoàn tất trả phòng");
                    setInvoiceModalVisible(false);
                    await load();
                  } else {
                    throw new Error("Không có id để hoàn tất trả phòng");
                  }
                } catch (e: any) {
                  message.error(e?.message || "Hoàn tất thất bại");
                }
              }}
            />
          </div>
        </main>
      </div>
    </div>
  );
};

export default CheckoutManager;