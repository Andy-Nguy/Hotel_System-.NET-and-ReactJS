import React, { useEffect, useMemo, useState } from "react";
import { Modal, List, Tag, Image, Button, Select, message as antdMessage, Alert, notification } from 'antd';
import RefundForm from '../payment/RefundForm';
import checkinApi, { UsingBooking } from "../../../api/checkinApi";
import invoiceApi from '../../../api/invoiceApi';
import * as roomsApi from '../../../api/roomsApi';
import checkoutApi from '../../../api/checkout.Api';
import InvoiceCheckin from './InvoiceCheckin';

const CheckinSectionNewFixed: React.FC = () => {
  const [bookings, setBookings] = useState<UsingBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [query, setQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [statusFilter, setStatusFilter] = useState<string>("");

  // modal / selected booking (detailed object fetched when opening)
  const [showModal, setShowModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  // track confirm buttons disabled after click (persist until error or page reload)
  const [disabledConfirmIds, setDisabledConfirmIds] = useState<Set<string>>(new Set());
  // Reassign / overdue UI state
  const [reassignVisible, setReassignVisible] = useState(false);
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [reassignBookingId, setReassignBookingId] = useState<string | null>(null);
  const [reassignBookingDetail, setReassignBookingDetail] = useState<any | null>(null);
  const [refundVisible, setRefundVisible] = useState(false);
  const [refundInvoiceId, setRefundInvoiceId] = useState<string | null>(null);
  const [refundAmount, setRefundAmount] = useState<number | null>(null);
  const [refundBookingDetail, setRefundBookingDetail] = useState<any | null>(null);

  const [showOverdueModal, setShowOverdueModal] = useState(false);
  const [overdueContext, setOverdueContext] = useState<{ bookingId?: string | null; message?: string | null; roomId?: string | null } | null>(null);
  const [overdueInvoiceVisible, setOverdueInvoiceVisible] = useState(false);
  const [overdueInvoiceData, setOverdueInvoiceData] = useState<any | null>(null);

  const loadToday = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await checkinApi.getTodayBookings();
      setBookings(data || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadToday();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadBookings = async () => {
    await loadToday();
  };

  const handleConfirm = async (id: string) => {
    if (!confirm("Xác nhận nhận khách?")) return;

    // khóa nút để tránh bấm nhiều lần
    setDisabledConfirmIds((s) => new Set(s).add(id));

    // lấy thông tin booking và roomId để dùng khi cần mở modal đổi phòng
    const booking = bookings.find((b) => b.iddatPhong === id);
    const roomId =
      booking?.idphong ??
      (booking as any)?.Idphong ??
      (booking as any)?.RoomId ??
      null;

    try {
      // GỌI THẲNG API, để backend check trong bảng ĐặtPhòng
      const result = await checkinApi.confirmCheckIn(id);

      // cập nhật trạng thái trên UI thành Đang sử dụng (3)
      setBookings((prev) =>
        prev.map((b) =>
          b.iddatPhong === id ? { ...b, trangThai: 3 } : b
        )
      );
      if (selectedBooking && selectedBooking.iddatPhong === id) {
        setSelectedBooking({ ...selectedBooking, trangThai: 3 });
      }

      // thông báo thành công
      antdMessage.success(result?.message || "Xác nhận thành công.");
    } catch (err: any) {
      // cho phép bấm lại nút
      setDisabledConfirmIds((s) => {
        const copy = new Set(s);
        copy.delete(id);
        return copy;
      });

      const serverMsg =
        err?.response?.data?.message || err?.message || "";

      // NẾU PHÒNG ĐANG CÓ KHÁCH SỬ DỤNG / QUÁ HẠN → mở modal Đổi phòng
      if (
        typeof serverMsg === "string" &&
        (serverMsg.toLowerCase().includes("quá hạn") ||
          serverMsg.toLowerCase().includes("đang có khách sử dụng"))
      ) {
        setOverdueContext({
          bookingId: id,
          message: serverMsg,
          roomId: roomId,
        });
        setShowOverdueModal(true);
        return;
      }

      // các lỗi khác → chỉ báo lỗi bình thường
      antdMessage.error(serverMsg || "Xác nhận thất bại");
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Xác nhận huỷ / no-show?")) return;
    try {
      await checkinApi.cancelCheckIn(id);
      await loadBookings();
    } catch (err: any) {
      alert(err?.message || "Huỷ thất bại");
    }
  };

  // Open reassign modal and load available rooms for given booking
  const openReassignModal = async (bookingId: string, detail?: any) => {
    try {
      setReassignBookingId(bookingId);
      setReassignVisible(true);
      setLoadingRooms(true);
      let det = detail;
      if (!det) det = await checkinApi.getCheckinById(bookingId);
      setReassignBookingDetail(det || null);
      const checkin = det?.ngayNhanPhong ?? det?.NgayNhanPhong;
      const checkout = det?.ngayTraPhong ?? det?.NgayTraPhong;
      const guests = det?.soNguoi ?? det?.SoNguoi ?? 1;
      const available = await roomsApi.findAvailableRooms(checkin, checkout, guests);

      // Try to enrich available rooms with canonical room records (to get room images)
      try {
        const allRooms = await roomsApi.getRooms();
        const roomMap: Record<string, any> = {};
        (allRooms || []).forEach((r: any) => { if (r.idphong) roomMap[String(r.idphong)] = r; });
        const enriched = (available || []).map((a: any) => {
          const id = a.idphong ?? a.roomId ?? a.RoomId;
          const base = roomMap[String(id)];
          return {
            ...a,
            // prefer available response image, fall back to canonical room's urlAnhPhong
            roomImageUrl: a.roomImageUrl ?? a.urlAnhPhong ?? a.UrlAnhPhong ?? base?.urlAnhPhong ?? base?.UrlAnhPhong ?? base?.roomImageUrl
          };
        });
        setAvailableRooms(enriched);
      } catch (e) {
        // if enrichment fails, fall back to raw available list
        setAvailableRooms(available || []);
      }
    } catch (e: any) {
      antdMessage.error(e?.message || 'Không thể tải danh sách phòng trống');
    } finally {
      setLoadingRooms(false);
    }
  };

  const doReassign = async () => {
    if (!reassignBookingId || !selectedRoomId) return antdMessage.warning('Vui lòng chọn phòng để đổi');
    try {
      const res = await checkinApi.reassignRoom(reassignBookingId, selectedRoomId);
      notification.success({
        message: 'Đổi phòng thành công',
        description: 'Phòng đã được đổi thành công. Bạn có thể nhận khách ngay hoặc thực hiện sau.',
        placement: 'topRight'
      });

      // close reassign UI
      const chosenRoomId = selectedRoomId;
      const chosenRoom = (availableRooms || []).find((r: any) => (r.idphong ?? r.RoomId ?? r.roomId) === chosenRoomId) || null;
      setReassignVisible(false);
      setSelectedRoomId(null);
      setAvailableRooms([]);

      // immediately update local bookings list so UI reflects the new room without waiting
      try {
        setBookings((prev) =>
          (prev || []).map((b) => {
            if (b.iddatPhong !== reassignBookingId) return b;
            const updated: any = { ...b };
            if (res && res.newRoom) updated.idphong = res.newRoom;
            if (chosenRoom) {
              updated.tenPhong = chosenRoom.tenPhong ?? chosenRoom.roomName ?? updated.tenPhong;
              updated.soPhong = chosenRoom.soPhong ?? chosenRoom.roomNumber ?? updated.soPhong;
              updated.roomImageUrl = chosenRoom.roomImageUrl ?? chosenRoom.urlAnhPhong ?? chosenRoom.UrlAnhPhong ?? updated.roomImageUrl;
            }
            if (res && typeof res.tongTien !== 'undefined') updated.tongTien = res.tongTien;
            // If server indicates a positive price delta, mark as unpaid (1 = Chưa thanh toán)
            if (res && typeof res.priceDelta !== 'undefined') {
              if (Number(res.priceDelta) > 0) {
                updated.trangThaiThanhToan = 1;
              } else if (Number(res.priceDelta) < 0) {
                // mark pending refund amount on the booking so UI can show quick refund
                const srvRef = res?.refundAmount ?? res?.refund ?? res?.refund_amount ?? null;
                updated.pendingRefund = srvRef != null && !isNaN(Number(srvRef)) ? Math.abs(Number(srvRef)) : Math.abs(Number(res.priceDelta));
              }
            }
            return updated;
          })
        );

        // if detail modal open for this booking, update it too
        if (selectedBooking && selectedBooking.iddatPhong === reassignBookingId) {
          const newDetail = { ...selectedBooking };
          if (res && res.newRoom) newDetail.Idphong = res.newRoom;
          if (chosenRoom) {
            newDetail.idphongNavigation = { ...(newDetail.idphongNavigation || {}), TenPhong: chosenRoom.tenPhong ?? chosenRoom.roomName, SoPhong: chosenRoom.soPhong ?? chosenRoom.roomNumber, UrlAnhPhong: chosenRoom.roomImageUrl ?? chosenRoom.urlAnhPhong };
          }
          if (res && typeof res.tongTien !== 'undefined') newDetail.TongTien = res.tongTien;
          if (res && typeof res.priceDelta !== 'undefined') {
            if (Number(res.priceDelta) > 0) {
              // update payment status on the open detail modal too
              newDetail.trangThaiThanhToan = 1;
              newDetail.TrangThaiThanhToan = 1;
            } else if (Number(res.priceDelta) < 0) {
              const srvRef = res?.refundAmount ?? res?.refund ?? res?.refund_amount ?? null;
              newDetail.pendingRefund = srvRef != null && !isNaN(Number(srvRef)) ? Math.abs(Number(srvRef)) : Math.abs(Number(res.priceDelta));
            }
          }
          setSelectedBooking(newDetail);
        }
      } catch (e) {
        // non-fatal; we'll still refresh lists below
        console.error('Error updating local booking after reassign', e);
      }

      // ==== REFUND: tiền khách đã trả (sum thanh toán + cọc) - tổng tiền phòng mới (VAT) ====
      try {
        // Lấy chi tiết mới nhất để tính paid
        let bd: any = selectedBooking && selectedBooking.iddatPhong === reassignBookingId
          ? selectedBooking
          : await checkinApi.getCheckinById(reassignBookingId).catch(() => null);

        // 1) Tổng tiền KHÁCH ĐÃ TRẢ = sum(TienThanhToan) + TienCoc
        const sumInvoicePaid = (() => {
          try {
            const invs = bd?.hoaDons ?? bd?.HoaDons ?? (bd?.hoaDon ? [bd.hoaDon] : null);
            if (Array.isArray(invs) && invs.length > 0) {
              return invs.reduce((s: number, i: any) => s + Number(i?.TienThanhToan ?? i?.tienThanhToan ?? 0), 0);
            }
            return 0;
          } catch { return 0; }
        })();
        const deposit = Number(bd?.tienCoc ?? bd?.TienCoc ?? 0);
        // Nếu hệ thống của bạn đã cộng cọc vào TienThanhToan rồi, thay đổi dòng dưới thành: const totalPaid = sumInvoicePaid;
        const totalPaid = sumInvoicePaid + deposit;

        // 2) Tổng tiền PHÒNG MỚI (có VAT)
        let newTotalWithVat: number;
        if (typeof res?.tongTien !== 'undefined' && res.tongTien != null) {
          newTotalWithVat = Number(res.tongTien);
        } else {
          // Tính từ phòng mới + các line cũ khác (noVAT) rồi *1.1
          const nights = bd?.SoDem ?? bd?.soDem ?? 1;
          const oldLines = (bd?.ChiTietDatPhongs ?? bd?.chiTietDatPhongs ?? []) || [];
          const oldRoomId = bd?.Idphong ?? bd?.idphong ?? null;

          const otherNoVat = Array.isArray(oldLines)
            ? oldLines.reduce((s: number, ct: any) => {
                const ctRoomId = ct?.IdPhong ?? ct?.IDPhong ?? ct?.idPhong ?? ct?.Phong?.Idphong ?? null;
                const gia = Number(ct?.GiaPhong ?? ct?.giaPhong ?? ct?.Gia ?? 0);
                const soDemLine = Number(ct?.SoDem ?? ct?.soDem ?? ct?.Slngay ?? nights ?? 1);
                const lineNoVat = gia * soDemLine;
                if (oldRoomId != null && ctRoomId != null && String(ctRoomId) === String(oldRoomId)) {
                  return s; // bỏ line phòng cũ
                }
                return s + lineNoVat;
              }, 0)
            : 0;

          const rawBasePrice =
            chosenRoom?.GiaMotDem ??
            chosenRoom?.giaCoBanMotDem ??
            chosenRoom?.basePricePerNight ??
            chosenRoom?.BasePricePerNight ??
            chosenRoom?.pricePerNight ??
            chosenRoom?.Gia ??
            0;
          const discounted =
            chosenRoom?.DiscountedPrice ??
            chosenRoom?.discountedPrice ??
            chosenRoom?.promotionPrice ??
            chosenRoom?.KhuyenMaiGia ??
            null;
          const pricePerNight =
            discounted != null && !isNaN(Number(discounted)) && Number(discounted) > 0
              ? Number(discounted)
              : Number(rawBasePrice);
          const newRoomNoVat = Number(pricePerNight) * (Number(bd?.SoDem ?? bd?.soDem ?? 1) || 1);

          newTotalWithVat = Math.round((otherNoVat + newRoomNoVat) * 1.1);
        }

        // Persist new room total as the paid amount on the booking/invoice so
        // the invoice reflects the new room total rather than the old payment.
        try {
          // Update booking record on server with new paid amount and new total
          await checkinApi.updateBooking(reassignBookingId, {
            tienThanhToan: Number(newTotalWithVat),
            TongTien: Number(newTotalWithVat),
            tongTien: Number(newTotalWithVat)
          }).catch(() => null);
        } catch (e) {
          // non-fatal: server update failed, continue and still show refund modal if needed
          console.warn('[reassign] failed to persist new paid amount', e);
        }

        // also update local UI state so invoice/modal shows the new paid amount immediately
        setBookings((prev) =>
          (prev || []).map((b) =>
            b.iddatPhong === reassignBookingId
              ? { ...b, tienThanhToan: Number(newTotalWithVat), tongTien: Number(newTotalWithVat), TongTien: Number(newTotalWithVat) }
              : b
          )
        );
        if (selectedBooking && selectedBooking.iddatPhong === reassignBookingId) {
          setSelectedBooking({ ...selectedBooking, tienThanhToan: Number(newTotalWithVat), tongTien: Number(newTotalWithVat), TongTien: Number(newTotalWithVat) });
        }
        // Prefer server-provided refundAmount (VAT-inclusive) when present
        const serverRefundRaw = res?.refundAmount ?? res?.refund ?? res?.refund_amount ?? null;
        let proposeRefund = NaN as any as number;
        if (serverRefundRaw != null && !isNaN(Number(serverRefundRaw))) {
          proposeRefund = Math.max(0, Math.round(Number(serverRefundRaw)));
        } else {
          proposeRefund = Math.max(0, Math.round(totalPaid - newTotalWithVat));
        }

        if (proposeRefund > 0) {
          const invIdFromRes = res?.invoiceId ?? res?.idHoaDon ?? res?.hoaDonId ?? null;
          setRefundInvoiceId(invIdFromRes || null);
          setRefundAmount(proposeRefund);
          try {
            if (!bd) bd = await checkinApi.getCheckinById(reassignBookingId);
          } catch {}
          setRefundBookingDetail(bd || null);
          setRefundVisible(true);
        }
      } catch {}
      // ==== END REFUND ====

      // Refresh bookings and rooms, but first ask receptionist if they want to check-in now
      const ask = () => {
        Modal.confirm({
          title: 'Đổi phòng thành công',
          content: 'Bạn có muốn nhận khách luôn không?',
          okText: 'Có, nhận ngay',
          cancelText: 'Không',
          centered: true,
          async onOk() {
            try {
              if (reassignBookingId) {
                await checkinApi.confirmCheckIn(reassignBookingId);
                antdMessage.success('Nhận khách thành công');
              }
            } catch (e: any) {
              antdMessage.error(e?.message || 'Nhận khách thất bại');
            } finally {
              // refresh bookings list
              await loadToday();
              // refresh rooms globally by fetching current rooms and emitting an event
              try {
                const rooms = await roomsApi.getRooms();
                window.dispatchEvent(new CustomEvent('rooms:refreshed', { detail: { rooms } }));
              } catch (err) {
                // ignore
              }
            }
          },
          async onCancel() {
            // just refresh lists
            await loadToday();
            try {
              const rooms = await roomsApi.getRooms();
              window.dispatchEvent(new CustomEvent('rooms:refreshed', { detail: { rooms } }));
            } catch (err) {
              // ignore
            }
          }
        });
      };

      // ask receptionist
      ask();
    } catch (e: any) {
      antdMessage.error(e?.message || 'Đổi phòng thất bại');
    }
  };

  const openOverdueInvoiceForRoom = async (roomId?: string) => {
    try {
      if (!roomId) return antdMessage.error('Không xác định phòng');
      const all = await checkinApi.getBookings();
      const overdue = (all || []).find((d: any) => (d.Idphong ?? d.idphong) === roomId && Number(d.TrangThai ?? d.trangThai ?? 0) === 5);
      if (!overdue) return antdMessage.error('Không tìm thấy đặt phòng quá hạn cho phòng này');
      // Try get summary for invoice modal
      const sum = await checkoutApi.getSummary(overdue.IddatPhong ?? overdue.iddatPhong ?? overdue.IdDatPhong);
      setOverdueInvoiceData(sum || overdue);
      setOverdueInvoiceVisible(true);
    } catch (e: any) {
      antdMessage.error(e?.message || 'Không thể tải hóa đơn quá hạn');
    }
  };

  // helper actions that modify bookings
  const handleUpdateStatus = async (id: string, status: number) => {
    try {
      await checkinApi.updateBooking(id, { trangThai: status });
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdatePaymentStatus = async (id: string, status: number) => {
    try {
      await checkinApi.updatePaymentStatus(id, status);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await checkinApi.deleteBooking(id);
      await loadBookings();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancelBooking = async (id: string) => {
    try {
      await checkinApi.cancelCheckIn(id);
      await loadBookings();
    } catch (err) {
      console.error(err);
    }
  };

  const openModal = async (b: UsingBooking) => {
    setLoading(true);
    try {
      // fetch full booking details (includes navigation properties like idkhachHangNavigation, idphongNavigation, hoaDons, cthddvs)
      const detail = await checkinApi.getCheckinById(b.iddatPhong);
      // attempt to fetch authoritative invoice detail from invoices table
      try {
        const inv = (detail?.hoaDons && detail.hoaDons[0]) || detail?.hoaDon || (detail?.HoaDons && detail.HoaDons[0]) || null;
        let invId = inv?.IdHoaDon ?? inv?.idHoaDon ?? inv?.id ?? null;

        // fallback: if no invoice id but booking id present, try list invoices and match by idDatPhong
        if (!invId && detail?.iddatPhong) {
          try {
            const list = await invoiceApi.getInvoices();
            if (Array.isArray(list) && list.length > 0) {
              const found = list.find((x: any) => (x.idDatPhong ?? x.idDatPhong) == detail.iddatPhong || (x.idDatPhong ?? x.idDatPhong) == detail.IddatPhong);
              if (found) invId = found.idHoaDon ?? found.id ?? found.IDHoaDon ?? null;
            }
          } catch (e) {
            // ignore
          }
        }

        if (invId) {
          const invRes = await invoiceApi.getInvoiceDetail(invId);
          if (invRes && invRes.data) {
            // attach invoiceDetail to detail for rendering authoritative values
            (detail as any).invoiceDetail = invRes.data;
          }
        }
      } catch (e) {
        // ignore invoice fetch failures
      }
      setSelectedBooking(detail);
      setShowModal(true);
    } catch (err: any) {
      alert(err?.message || "Không thể tải chi tiết đặt phòng");
    } finally {
      setLoading(false);
    }
  };

  // Row refund: đề xuất = tiền khách trả (sum thanh toán + cọc) - tổng hiện tại (VAT)
  const handleRowRefund = async (_e: any, b: any) => {
    try {
      // fetch detail to get invoice id if not present
      const detail = await checkinApi.getCheckinById(b.iddatPhong);
      // try to obtain invoice id from different shapes
      const inv = (detail?.hoaDons && detail.hoaDons[0]) || detail?.hoaDon || (detail?.HoaDons && detail.HoaDons[0]) || null;
      const invId = inv?.IdHoaDon ?? inv?.idHoaDon ?? inv?.id ?? null;

      // tổng đã trả = sum thanh toán + cọc
      const sumInvoicePaid = (() => {
        try {
          const invs = detail?.hoaDons ?? detail?.HoaDons ?? (detail?.hoaDon ? [detail.hoaDon] : null);
          if (Array.isArray(invs) && invs.length > 0) {
            return invs.reduce((s: number, i: any) => s + Number(i?.TienThanhToan ?? i?.tienThanhToan ?? 0), 0);
          }
          return 0;
        } catch { return 0; }
      })();
      const deposit = Number(detail?.tienCoc ?? detail?.TienCoc ?? 0);
      // nếu TienThanhToan đã bao gồm cọc thì đổi thành: const totalPaid = sumInvoicePaid;
      const totalPaid = sumInvoicePaid + deposit;

      // tổng hiện tại (VAT): ưu tiên TongTien, fallback sum(room)*1.1
      const lines = (detail?.ChiTietDatPhongs ?? detail?.chiTietDatPhongs ?? []) || [];
      const noVat = Array.isArray(lines)
        ? lines.reduce((s: number, ct: any) => {
            const gia = Number(ct?.GiaPhong ?? ct?.giaPhong ?? ct?.Gia ?? 0);
            const soDem = Number(ct?.SoDem ?? ct?.soDem ?? ct?.Slngay ?? 1);
            return s + (gia * soDem);
          }, 0)
        : 0;
      const currentTotalWithVat =
        (typeof detail?.TongTien !== 'undefined' && detail?.TongTien != null)
          ? Number(detail.TongTien)
          : (typeof detail?.tongTien !== 'undefined' && detail?.tongTien != null)
          ? Number(detail.tongTien)
          : Math.round(noVat * 1.1);

      const amt = Math.max(0, Math.round(totalPaid - currentTotalWithVat));

      setRefundInvoiceId(invId || null);
      setRefundAmount(amt > 0 ? amt : null);
      setRefundBookingDetail(detail || null);
      setRefundVisible(true);
    } catch (err) {
      antdMessage.error('Không thể lấy thông tin hóa đơn để hoàn tiền');
    }
  };

  // Refresh the open detail modal if services were added elsewhere
  React.useEffect(() => {
    const handler = async (e: any) => {
      try {
        const id = e?.detail?.id;
        if (!id) return;
        if (selectedBooking && selectedBooking.iddatPhong === id) {
          // re-fetch details for the open booking
          const detail = await checkinApi.getCheckinById(id);
          setSelectedBooking(detail);
        }
      } catch (err) {
        // ignore
      }
    };
    window.addEventListener('booking:services-updated', handler as EventListener);

    // also update the list row so the total shown in the table reflects added services
    const listHandler = async (e: any) => {
      try {
        const id = e?.detail?.id;
        if (!id) return;
        const detail = await checkinApi.getCheckinById(id);
        if (!detail) return;
        setBookings((prev) => (prev || []).map((b) => b.iddatPhong === id ? { ...b, tongTien: detail.tongTien ?? detail.TongTien ?? b.tongTien, trangThaiThanhToan: detail.trangThaiThanhToan ?? b.trangThaiThanhToan } : b));
      } catch (err) {
        // ignore
      }
    };
    window.addEventListener('booking:services-updated', listHandler as EventListener);

    return () => {
      window.removeEventListener('booking:services-updated', handler as EventListener);
      window.removeEventListener('booking:services-updated', listHandler as EventListener);
    };
  }, [selectedBooking]);

  const closeModal = () => {
    setShowModal(false);
    setSelectedBooking(null);
  };

  // simple status helpers
  const getStatusColor = (s: any) => {
    switch (s) {
      case 0:
        return "#ef4444"; // red
      case 1:
        return "#f59e0b"; // amber
      case 2:
        return "#06b6d4"; // cyan
      case 3:
        return "#10b981"; // green
      default:
        return "#64748b";
    }
  };

  const getStatusLabel = (s: any) => {
    switch (s) {
      case 0:
        return "Đã hủy";
      case 1:
        return "Chờ xác nhận";
      case 2:
        return "Đã xác nhận";
      case 3:
        return "Đang sử dụng";
      default:
        return "—";
    }
  };

  const getPaymentStatusColor = (s: any) => {
    // Muted palette (less flashy)
    switch (s) {
      case 0:
        return { bg: "#f1f5f9", color: "#475569" };
      case 1:
        return { bg: "#fff7ed", color: "#92400e" };
      case 2:
        return { bg: "#f8fafc", color: "#0f172a" };
      default:
        return { bg: "#f1f5f9", color: "#475569" };
    }
  };

  const getPaymentStatusLabel = (s: any) => {
    switch (s) {
      case 0:
        return "Đã đặt cọc";
      case 1:
        return "Chưa thanh toán";
      case 2:
        return "Đã thanh toán";
      default:
        return "—";
    }
  };

  // filtered and paged lists
  const filteredBookings = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bookings.filter((b) => {
      if (statusFilter !== "" && String(b.trangThai) !== statusFilter) return false;
      if (!q) return true;
      return (
        String(b.tenKhachHang || "").toLowerCase().includes(q) ||
        String(b.soPhong || "").toLowerCase().includes(q) ||
        String(b.iddatPhong || "").toLowerCase().includes(q)
      );
    });
  }, [bookings, query, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / pageSize));

  const pagedBookings = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredBookings.slice(start, start + pageSize);
  }, [filteredBookings, currentPage]);

  return (
    <div>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ position: "relative" }}>
          <svg
            style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M21 21l-4.35-4.35" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="11" cy="11" r="6" stroke="#9CA3AF" strokeWidth="1.5" />
          </svg>
          <input
            type="text"
            placeholder="Tìm kiếm tên, phòng, mã..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCurrentPage(1);
            }}
            style={{ padding: "8px 12px 8px 36px", border: "1px solid #e5e7eb", borderRadius: 10, minWidth: 280, fontSize: 13 }}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setCurrentPage(1);
          }}
          style={{ padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff", fontSize: 13 }}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="0">Đã hủy</option>
          <option value="1">Chờ xác nhận</option>
          <option value="2">Đã xác nhận</option>
          <option value="3">Đang sử dụng</option>
        </select>
      </div>

      {/* Modal: booking details */}
      {showModal && selectedBooking && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, backdropFilter: "blur(4px)" }}
          onClick={closeModal}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "96%", maxWidth: 900, maxHeight: "90vh", overflow: "auto", background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)", borderRadius: 20, padding: 0, boxShadow: "0 25px 60px rgba(0,0,0,0.25)" }}>
            {/* Header with gradient */}
            <div style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", padding: "24px 28px", borderRadius: "20px 20px 0 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h2 style={{ margin: 0, color: "#fff", fontWeight: 700, fontSize: 22 }}>🏨 Chi tiết đặt phòng</h2>
                  <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 14, marginTop: 6 }}>
                    <span style={{ background: "rgba(255,255,255,0.2)", padding: "4px 10px", borderRadius: 6, marginRight: 8 }}>{selectedBooking.iddatPhong}</span>
                    {selectedBooking.tenKhachHang || "N/A"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ padding: "8px 16px", borderRadius: 999, background: "rgba(255,255,255,0.95)", color: getStatusColor(selectedBooking.trangThai), fontWeight: 700, fontSize: 13, boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
                    {getStatusLabel(selectedBooking.trangThai)}
                  </div>
                  <button onClick={closeModal} style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: "rgba(255,255,255,0.9)", color: "#374151", fontWeight: 600, cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>✕ Đóng</button>
                </div>
              </div>
            </div>

            <div style={{ padding: "24px 28px" }}>
              {/* Customer & Payment Info Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                {/* Customer Card */}
                <div style={{ background: "linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)", borderRadius: 16, padding: 20, border: "1px solid #7dd3fc" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                    <span style={{ fontSize: 24 }}>👤</span>
                    <h4 style={{ margin: 0, color: "#0369a1", fontWeight: 700 }}>Thông tin khách hàng</h4>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#64748b" }}>Họ tên:</span>
                      <span style={{ fontWeight: 600, color: "#0f172a" }}>{selectedBooking.idkhachHangNavigation?.hoTen || selectedBooking.tenKhachHang || "N/A"}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#64748b" }}>Email:</span>
                      <span style={{ fontWeight: 500, color: "#0f172a", fontSize: 13 }}>{selectedBooking.idkhachHangNavigation?.email || selectedBooking.emailKhachHang || "N/A"}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#64748b" }}>ID khách:</span>
                      <span style={{ fontWeight: 500, color: "#0f172a" }}>{selectedBooking.idkhachHang ?? (selectedBooking.idkhachHangNavigation?.id ?? "N/A")}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#64748b" }}>Số đêm:</span>
                      <span style={{ fontWeight: 600, color: "#0369a1" }}>{selectedBooking.soDem ?? "N/A"} đêm</span>
                    </div>
                  </div>
                </div>

                {/* Payment Card */}
                <div style={{ background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)", borderRadius: 16, padding: 20, border: "1px solid #fbbf24" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                    <span style={{ fontSize: 24 }}>💳</span>
                    <h4 style={{ margin: 0, color: "#b45309", fontWeight: 700 }}>Thanh toán</h4>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#78716c" }}>Tiền cọc:</span>
                      <span style={{ fontWeight: 600, color: "#0f172a" }}>{selectedBooking.tienCoc ? Number(selectedBooking.tienCoc).toLocaleString('vi-VN') + " ₫" : "N/A"}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#78716c" }}>Đã thanh toán:</span>
                      <span style={{ fontWeight: 700, color: "#16a34a", fontSize: 16 }}>{
                        (() => {
                          try {
                            const paidFromInvDetail = (selectedBooking as any)?.invoiceDetail?.tienThanhToan ?? null;
                            if (paidFromInvDetail != null) return Number(paidFromInvDetail).toLocaleString('vi-VN') + ' ₫';
                            const inv = (selectedBooking.hoaDons && selectedBooking.hoaDons[0]) || selectedBooking.hoaDon || (selectedBooking.HoaDons && selectedBooking.HoaDons[0]) || null;
                            const paid = inv?.TienThanhToan ?? inv?.tienThanhToan ?? selectedBooking.tienCoc ?? selectedBooking.TienCoc ?? null;
                            return paid != null ? Number(paid).toLocaleString('vi-VN') + ' ₫' : 'N/A';
                          } catch (e) { return 'N/A'; }
                        })()
                      }</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: "#78716c" }}>Trạng thái:</span>
                      <span style={{ padding: "4px 12px", borderRadius: 999, background: getPaymentStatusColor(selectedBooking.trangThaiThanhToan).bg, color: getPaymentStatusColor(selectedBooking.trangThaiThanhToan).color, fontWeight: 600, fontSize: 12 }}>{getPaymentStatusLabel(selectedBooking.trangThaiThanhToan)}</span>
                    </div>
                    <div style={{ borderTop: "1px dashed #d97706", paddingTop: 10, marginTop: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "#b45309", fontWeight: 600 }}>Tổng tiền:</span>
                        <span style={{ fontWeight: 800, color: "#dc2626", fontSize: 18 }}>{selectedBooking.tongTien ? Number(selectedBooking.tongTien).toLocaleString('vi-VN') + " ₫" : "N/A"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Room Info Card */}
              <div style={{ background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)", borderRadius: 16, padding: 20, marginTop: 20, border: "1px solid #86efac" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <span style={{ fontSize: 24 }}>🛏️</span>
                  <h4 style={{ margin: 0, color: "#166534", fontWeight: 700 }}>Thông tin phòng</h4>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                  <div style={{ background: "#fff", borderRadius: 12, padding: 14, textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                    <div style={{ color: "#64748b", fontSize: 12, marginBottom: 4 }}>Phòng</div>
                    <div style={{ fontWeight: 700, color: "#166534", fontSize: 15 }}>{selectedBooking.idphongNavigation?.tenPhong || selectedBooking.tenPhong || selectedBooking.idphong}</div>
                    <div style={{ color: "#64748b", fontSize: 12 }}>({selectedBooking.idphongNavigation?.soPhong || selectedBooking.soPhong || "N/A"})</div>
                  </div>
                  <div style={{ background: "#fff", borderRadius: 12, padding: 14, textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                    <div style={{ color: "#64748b", fontSize: 12, marginBottom: 4 }}>📅 Nhận phòng</div>
                    <div style={{ fontWeight: 600, color: "#0f172a", fontSize: 14 }}>{selectedBooking.ngayNhanPhong ? new Date(selectedBooking.ngayNhanPhong).toLocaleDateString('vi-VN') : "N/A"}</div>
                    <div style={{ color: "#64748b", fontSize: 11 }}>{selectedBooking.ngayNhanPhong ? new Date(selectedBooking.ngayNhanPhong).toLocaleTimeString('vi-VN') : ""}</div>
                  </div>
                  <div style={{ background: "#fff", borderRadius: 12, padding: 14, textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                    <div style={{ color: "#64748b", fontSize: 12, marginBottom: 4 }}>📅 Trả phòng</div>
                    <div style={{ fontWeight: 600, color: "#0f172a", fontSize: 14 }}>{selectedBooking.ngayTraPhong ? new Date(selectedBooking.ngayTraPhong).toLocaleDateString('vi-VN') : "N/A"}</div>
                    <div style={{ color: "#64748b", fontSize: 11 }}>{selectedBooking.ngayTraPhong ? new Date(selectedBooking.ngayTraPhong).toLocaleTimeString('vi-VN') : ""}</div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div style={{ background: "#f8fafc", borderRadius: 12, padding: 16, marginTop: 16, border: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span>📝</span>
                  <strong style={{ color: "#475569" }}>Ghi chú / Thông tin thêm:</strong>
                </div>
                <div style={{ color: "#64748b", fontStyle: (selectedBooking as any).ghiChu || (selectedBooking as any).note ? "normal" : "italic" }}>{(selectedBooking as any).ghiChu || (selectedBooking as any).note || "Không có ghi chú"}</div>
              </div>

              {/* Room Details */}
              <div style={{ marginTop: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 20 }}>🛎️</span>
                  <strong style={{ color: "#374151", fontSize: 15 }}>Chi tiết các phòng trong đơn:</strong>
                </div>
                { (selectedBooking as any).chiTietDatPhongs && (selectedBooking as any).chiTietDatPhongs.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {(selectedBooking as any).chiTietDatPhongs.map((ct: any, idx: number) => (
                      <div key={ct.idChiTiet || idx} style={{ background: "linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)", borderRadius: 12, padding: 16, border: "1px solid #d8b4fe", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontWeight: 700, color: "#7c3aed", fontSize: 15 }}>{ct.tenPhongChiTiet || ct.idPhong}</div>
                          <div style={{ color: "#7c3aed", fontSize: 13, marginTop: 4 }}>{ct.soDem} đêm • {Number(ct.giaPhong || 0).toLocaleString('vi-VN')} ₫/đêm</div>
                          {ct.ghiChu && <div style={{ color: "#a78bfa", fontSize: 12, marginTop: 4 }}>💬 {ct.ghiChu}</div>}
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 800, color: "#7c3aed", fontSize: 18 }}>{Number(ct.thanhTien || 0).toLocaleString('vi-VN')} ₫</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: "#94a3b8", padding: 16, background: "#f8fafc", borderRadius: 10, textAlign: "center" }}>Không có chi tiết nào.</div>
                ) }
              </div>

              {/* Action Buttons */}
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: "2px solid #e2e8f0", display: "flex", gap: 12, justifyContent: "flex-end", alignItems: "center", flexWrap: "wrap" }}>
                <select
                  value={(selectedBooking as any).trangThai}
                  onChange={async (e) => {
                    const v = parseInt(e.target.value);
                    if (!selectedBooking) return;
                    await handleUpdateStatus(selectedBooking.iddatPhong, v);
                    await loadBookings();
                    const updated = bookings.find((x) => x.iddatPhong === selectedBooking.iddatPhong) || null;
                    setSelectedBooking(updated);
                  }}
                  style={{ padding: "10px 16px", borderRadius: 10, border: "2px solid #c7d2fe", background: "#eef2ff", color: "#4338ca", fontWeight: 600, cursor: "pointer" }}
                >
                  <option value={0}>🚫 Đã hủy</option>
                  <option value={1}>⏳ Chờ xác nhận</option>
                  <option value={2}>✅ Đã xác nhận</option>
                  <option value={3}>🔑 Đang sử dụng</option>
                </select>

                <select
                  value={(selectedBooking as any).trangThaiThanhToan}
                  onChange={async (e) => {
                    const v = parseInt(e.target.value);
                    if (!selectedBooking) return;
                    await handleUpdatePaymentStatus(selectedBooking.iddatPhong, v);
                    await loadBookings();
                    const updated = bookings.find((x) => x.iddatPhong === selectedBooking.iddatPhong) || null;
                    setSelectedBooking(updated);
                  }}
                  style={{ padding: "10px 16px", borderRadius: 10, border: "2px solid #fde68a", background: "#fffbeb", color: "#b45309", fontWeight: 600, cursor: "pointer" }}
                >
                  <option value={0}>💰 Chưa thanh toán</option>
                  <option value={1}>📋 Đã đặt cọc</option>
                  <option value={2}>✅ Đã thanh toán</option>
                </select>

                <button
                  onClick={async () => {
                    if (!selectedBooking) return;
                    if (!confirm("Xác nhận xóa?")) return;
                    await handleDelete(selectedBooking.iddatPhong);
                    closeModal();
                  }}
                  style={{ padding: "10px 20px", background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)", color: "#fff", border: "none", borderRadius: 10, fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 12px rgba(239,68,68,0.3)" }}
                >
                  🗑️ Xóa
                </button>
                <button
                  onClick={async () => {
                    if (!selectedBooking) return;
                    const inv = (selectedBooking.hoaDons && selectedBooking.hoaDons[0]) || selectedBooking.hoaDon || (selectedBooking.HoaDons && selectedBooking.HoaDons[0]) || null;
                    const invId = inv?.IdHoaDon ?? inv?.idHoaDon ?? inv?.id ?? null;
                    setRefundInvoiceId(invId || null);
                    const suggested = inv?.RefundAmount ?? inv?.refundAmount ?? null;
                    setRefundAmount(suggested ?? null);
                    setRefundBookingDetail(selectedBooking || null);
                    setRefundVisible(true);
                  }}
                  style={{ padding: "10px 20px", background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", color: "#fff", border: "none", borderRadius: 10, fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 12px rgba(16,185,129,0.3)" }}
                >
                  💸 Hoàn tiền
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ overflowX: "auto", marginTop: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #f1f5f9" }}>
              <th style={{ padding: 12, textAlign: "left", fontWeight: 700, color: "#64748b" }}>Mã đặt phòng</th>
              <th style={{ padding: 12, textAlign: "left", fontWeight: 700, color: "#64748b" }}>Khách hàng</th>
              <th style={{ padding: 12, textAlign: "left", fontWeight: 700, color: "#64748b" }}>Phòng</th>
              <th style={{ padding: 12, textAlign: "left", fontWeight: 700, color: "#64748b" }}>Ngày nhận - trả</th>
              <th style={{ padding: 12, textAlign: "right", fontWeight: 700, color: "#64748b" }}>Tổng tiền</th>
              <th style={{ padding: 12, textAlign: "center", fontWeight: 700, color: "#64748b" }}>Trạng thái</th>
              <th style={{ padding: 12, textAlign: "center", fontWeight: 700, color: "#64748b" }}>Thanh toán</th>
              <th style={{ padding: 12, textAlign: "right", fontWeight: 700, color: "#64748b" }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {pagedBookings.map((b) => (
              <tr
                key={b.iddatPhong}
                style={{ borderBottom: "1px solid #f3f4f6", transition: "background 150ms ease", background: Number(b.trangThai ?? 0) === 5 ? '#fff1f0' : undefined, cursor: 'pointer' }}
                onClick={() => openModal(b)}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <td style={{ padding: 12, fontWeight: 700, color: "#0f172a" }}>{b.iddatPhong}</td>
                <td style={{ padding: 12 }}>
                  <div style={{ fontWeight: 600, color: "#0f172a" }}>{b.tenKhachHang || "N/A"}</div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>{b.emailKhachHang || ""}</div>
                </td>
                <td style={{ padding: 12, color: "#475569" }}>
                  <div>{b.tenPhong || b.idphong}</div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>Phòng {b.soPhong || "—"}</div>
                </td>
                <td style={{ padding: 12, color: "#475569" }}>
                  <div>{b.ngayNhanPhong ? new Date(b.ngayNhanPhong).toLocaleDateString("vi-VN") : "-"}</div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>{b.ngayTraPhong ? new Date(b.ngayTraPhong).toLocaleDateString("vi-VN") : "-"}</div>
                </td>
                <td style={{ padding: 12, textAlign: "right", fontWeight: 700, color: "#0f172a" }}>{b.tongTien ? b.tongTien.toLocaleString() + " đ" : "-"}</td>
                <td style={{ padding: 12, textAlign: "center" }}>
                  {Number(b.trangThai ?? 0) === 5 ? (
                    <Tag color="red">Quá hạn</Tag>
                  ) : (
                    <span style={{ padding: "4px 10px", borderRadius: 999, background: `${getStatusColor(b.trangThai)}15`, color: getStatusColor(b.trangThai), fontWeight: 700, fontSize: 12, whiteSpace: "nowrap" }}>{getStatusLabel(b.trangThai)}</span>
                  )}
                </td>
                <td style={{ padding: 12, textAlign: "center" }}>
                  <span style={{ padding: "4px 10px", borderRadius: 6, background: getPaymentStatusColor(b.trangThaiThanhToan).bg, color: getPaymentStatusColor(b.trangThaiThanhToan).color, fontWeight: 700, fontSize: 12 }}>{getPaymentStatusLabel(b.trangThaiThanhToan)}</span>
                </td>
                <td style={{ padding: 12, textAlign: "right" }}>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    {/* Show Confirm only for status 2 */}
                    {b.trangThai === 2 && (
                      <button onClick={(e) => { e.stopPropagation(); handleConfirm(b.iddatPhong); }} disabled={disabledConfirmIds.has(b.iddatPhong)}>Xác nhận</button>
                    )}

                    {/* Show Đổi phòng button for status 3 (Đang sử dụng) */}
                    {b.trangThai === 3 && (
                      <button onClick={(e) => { e.stopPropagation(); openReassignModal(b.iddatPhong); }} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #3b82f6", background: "#eff6ff", color: "#3b82f6", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Đổi phòng</button>
                    )}

                    {/* Show a single Cancel button for any non-cancelled booking so it stays visible after confirm */}
                    {b.trangThai !== 0 && (
                      <button onClick={(e) => { e.stopPropagation(); handleCancelBooking(b.iddatPhong); }} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #ef4444", background: "#fff", color: "#ef4444", cursor: "pointer", fontSize: 12 }}>Hủy</button>
                    )}

                    <button onClick={(e) => { e.stopPropagation(); openModal(b); }} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", fontSize: 12 }}>Chi tiết</button>
                    {(b as any).pendingRefund && Number((b as any).pendingRefund) > 0 ? (
                      <button onClick={async (e) => { e.stopPropagation(); await handleRowRefund(e, b); }} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #10b981", background: "#ecfdf5", color: "#065f46", cursor: "pointer", fontSize: 12, fontWeight: 700, marginLeft: 6 }}>Hoàn tiền</button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredBookings.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Không có đặt phòng nào phù hợp.</div>
        )}
      </div>

      {/* Overdue options modal */}
      <Modal
        title={null}
        open={showOverdueModal}
        onCancel={() => setShowOverdueModal(false)}
        footer={null}
        centered
      >
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ flex: '0 0 46px' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="11" stroke="#f43f5e" strokeWidth="1.5" fill="#fff8f9" />
              <path d="M12 7v6" stroke="#f43f5e" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M12 16h.01" stroke="#f43f5e" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, color: '#111827' }}>Không thể nhận phòng</h3>
            <div style={{ marginTop: 6, color: '#6b7280' }}>Phòng hiện đang có khách sử dụng hoặc khách trước chưa checkout đúng giờ.</div>
            {overdueContext?.message && <div style={{ marginTop: 8, color: '#6b7280' }}>{overdueContext.message}</div>}
            <Alert 
              style={{ marginTop: 12 }} 
              type="info" 
              message="Vui lòng chờ khách trước checkout hoặc liên hệ bộ phận quản lý để xử lý." 
              showIcon 
            />

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <Button type="primary" onClick={() => setShowOverdueModal(false)}>Đã hiểu</Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Reassign room modal */}
      <Modal
        title="Chọn phòng trống để đổi"
        open={reassignVisible}
        onCancel={() => { setReassignVisible(false); setSelectedRoomId(null); setAvailableRooms([]); }}
        width={720}
        footer={[
          <Button key="cancel" onClick={() => { setReassignVisible(false); setSelectedRoomId(null); setAvailableRooms([]); }}>Hủy</Button>,
          <Button key="ok" type="primary" onClick={doReassign} disabled={!selectedRoomId}>Xác nhận đổi phòng</Button>
        ]}
      >
        {reassignBookingDetail && (
          <div style={{ marginBottom: 8 }}>
            <div><strong>Đang đổi cho đặt phòng:</strong> {reassignBookingDetail?.IddatPhong ?? reassignBookingDetail?.iddatPhong}</div>
            <div>Phòng cũ: {reassignBookingDetail?.Idphong ?? reassignBookingDetail?.idphong} • Ngày: {(reassignBookingDetail?.NgayNhanPhong ?? reassignBookingDetail?.ngayNhanPhong) ? new Date(reassignBookingDetail.NgayNhanPhong ?? reassignBookingDetail.ngayNhanPhong).toLocaleDateString('vi-VN') : ''} - {(reassignBookingDetail?.NgayTraPhong ?? reassignBookingDetail?.ngayTraPhong) ? new Date(reassignBookingDetail.NgayTraPhong ?? reassignBookingDetail.ngayTraPhong).toLocaleDateString('vi-VN') : ''}</div>
          </div>
        )}

        <List
          loading={loadingRooms}
          dataSource={availableRooms}
          renderItem={(item: any) => {
            const id = item.idphong ?? item.RoomId ?? item.roomId;
            const rawBasePrice = item.GiaMotDem ?? item.giaCoBanMotDem ?? item.basePricePerNight ?? item.BasePricePerNight ?? 0;
            const discounted = (item.DiscountedPrice ?? item.discountedPrice ?? item.discountedprice ?? null);
            const price = (discounted != null && !isNaN(Number(discounted)) && Number(discounted) > 0) ? Number(discounted) : Number(rawBasePrice);
            const isSelected = selectedRoomId === id;
            // compute price delta (approx)
            let oldPricePerNight = 0;
            if (reassignBookingDetail) {
              const first = Array.isArray(reassignBookingDetail.ChiTietDatPhongs) && reassignBookingDetail.ChiTietDatPhongs.length > 0 ? reassignBookingDetail.ChiTietDatPhongs[0] : null;
              if (first) oldPricePerNight = first.GiaPhong ?? first.giaPhong ?? (reassignBookingDetail.TongTien ? (reassignBookingDetail.TongTien / Math.max(1, reassignBookingDetail.SoDem || 1)) : 0);
              else oldPricePerNight = reassignBookingDetail.TongTien ? (reassignBookingDetail.TongTien / Math.max(1, reassignBookingDetail.SoDem || 1)) : 0;
            }
            const nights = reassignBookingDetail?.SoDem ?? reassignBookingDetail?.soDem ?? 1;
            const delta = Math.round(((price ?? 0) - (oldPricePerNight ?? 0)) * (nights ?? 1));

            return (
              <List.Item style={{ background: isSelected ? '#f0f9ff' : undefined, cursor: 'pointer', padding: 12 }} onClick={() => setSelectedRoomId(id)}>
                <div style={{ display: 'flex', gap: 12, width: '100%', alignItems: 'center' }}>
                  <div style={{ flex: '0 0 140px', height: 96, borderRadius: 8, overflow: 'hidden', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Image src={item.roomImageUrl ?? item.urlAnhPhong ?? item.UrlAnhPhong ?? item.roomImage} width={140} height={96} preview={false} fallback="/img/placeholder.png" />
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 15 }}>{item.tenPhong ?? item.roomName ?? `Phòng ${item.soPhong ?? item.roomNumber ?? id}`}</div>
                        <div style={{ color: '#6b7280', fontSize: 13, marginTop: 6 }}>
                          {item.tenLoaiPhong ?? item.roomTypeName ?? ''}
                          {" • "}
                          <span style={{ color: '#6b7280' }}>{(item.Description ?? item.moTa ?? item.description ?? '').toString().slice(0, 80) || 'Thông tin phòng'}</span>
                        </div>
                        {item.PromotionName || item.promotionName ? <div style={{ marginTop: 6, color: '#d97706', fontSize: 13 }}>{item.PromotionName ?? item.promotionName}</div> : null}
                      </div>
                      <div style={{ textAlign: 'right', minWidth: 140 }}>
                        {discounted != null && Number(discounted) > 0 ? (
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 16 }}>{Number(price).toLocaleString()} đ</div>
                            <div style={{ fontSize: 13, color: '#8b8b8b', textDecoration: 'line-through' }}>{Number(rawBasePrice).toLocaleString()} đ</div>
                          </div>
                        ) : (
                          <div style={{ fontWeight: 800, fontSize: 16 }}>{Number(price ?? 0).toLocaleString()} đ</div>
                        )}
                        <div style={{ marginTop: 8, color: delta >= 0 ? '#d4380d' : '#16a34a', fontWeight: 700 }}>{(delta >= 0 ? '+' : '') + delta.toLocaleString()} đ</div>
                      </div>
                    </div>
                  </div>
                </div>
              </List.Item>
            );
          }}
        />
      </Modal>

      {/* Overdue invoice modal using existing invoice component */}
      <InvoiceCheckin
        visible={overdueInvoiceVisible}
        invoiceData={overdueInvoiceData}
        paymentRow={null}
        onClose={() => { setOverdueInvoiceVisible(false); setOverdueInvoiceData(null); }}
        onComplete={async (id) => { await loadToday(); setOverdueInvoiceVisible(false); }}
      />

      <RefundForm
        visible={refundVisible}
        onClose={() => setRefundVisible(false)}
        idHoaDon={refundInvoiceId ?? undefined}
        defaultAmount={refundAmount ?? undefined}
        onSuccess={async () => {
          setRefundVisible(false);
          await loadToday();
          if (selectedBooking && selectedBooking.iddatPhong) {
            const d = await checkinApi.getCheckinById(selectedBooking.iddatPhong);
            setSelectedBooking(d || selectedBooking);
          }
        }}
        bookingDetail={refundBookingDetail ?? undefined}
      />

      {/* pagination */}
      {filteredBookings.length > pageSize && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 20, alignItems: "center", paddingTop: 16, borderTop: "1px solid #f1f5f9" }}>
          <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #e5e7eb", background: currentPage === 1 ? "#f8fafc" : "#fff", cursor: currentPage === 1 ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600 }}>← Trước</button>
          <div style={{ color: "#64748b", fontSize: 13, padding: "0 12px" }}>Trang {currentPage} / {totalPages}</div>
          <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #e5e7eb", background: currentPage === totalPages ? "#f8fafc" : "#fff", cursor: currentPage === totalPages ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600 }}>Tiếp →</button>
        </div>
      )}
    </div>
  );
};

export default CheckinSectionNewFixed;