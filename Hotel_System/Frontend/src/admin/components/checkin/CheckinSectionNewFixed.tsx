import React, { useEffect, useMemo, useState } from "react";
import { Modal, List, Tag, Image, Button, Select, message as antdMessage, Alert, notification } from 'antd';
import checkinApi, { UsingBooking } from "../../../api/checkinApi";
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
            if (res && typeof res.priceDelta !== 'undefined' && Number(res.priceDelta) > 0) {
              updated.trangThaiThanhToan = 1;
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
          if (res && typeof res.priceDelta !== 'undefined' && Number(res.priceDelta) > 0) {
            // update payment status on the open detail modal too
            newDetail.trangThaiThanhToan = 1;
            newDetail.TrangThaiThanhToan = 1;
          }
          setSelectedBooking(newDetail);
        }
      } catch (e) {
        // non-fatal; we'll still refresh lists below
        console.error('Error updating local booking after reassign', e);
      }

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
      setSelectedBooking(detail);
      setShowModal(true);
    } catch (err: any) {
      alert(err?.message || "Không thể tải chi tiết đặt phòng");
    } finally {
      setLoading(false);
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
    switch (s) {
      case 0:
        return { bg: "#f8fafc", color: "#64748b" };
      case 1:
        return { bg: "#fef3c7", color: "#92400e" };
      case 2:
        return { bg: "#dcfce7", color: "#166534" };
      default:
        return { bg: "#f8fafc", color: "#64748b" };
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
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 }}
          onClick={closeModal}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "96%", maxWidth: 1100, maxHeight: "90vh", overflow: "auto", background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 12px 40px rgba(2,6,23,0.22)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div>
                <h3 style={{ margin: 0 }}>Chi tiết đặt phòng</h3>
                <div style={{ color: "#6b7280", fontSize: 13 }}>{selectedBooking.iddatPhong} • {selectedBooking.tenKhachHang || "N/A"}</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ padding: "6px 10px", borderRadius: 999, background: `${getStatusColor(selectedBooking.trangThai)}20`, color: getStatusColor(selectedBooking.trangThai), fontWeight: 700, fontSize: 13 }}>
                  {getStatusLabel(selectedBooking.trangThai)}
                </div>
                <button onClick={closeModal} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff" }}>Đóng</button>
              </div>
            </div>

            <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <div style={{ marginBottom: 8 }}><strong>Khách hàng:</strong> {selectedBooking.idkhachHangNavigation?.hoTen || selectedBooking.tenKhachHang || "N/A"}</div>
                <div style={{ marginBottom: 8 }}><strong>Email:</strong> {selectedBooking.idkhachHangNavigation?.email || selectedBooking.emailKhachHang || "N/A"}</div>
                <div style={{ marginBottom: 8 }}><strong>ID khách hàng:</strong> {selectedBooking.idkhachHang ?? (selectedBooking.idkhachHangNavigation?.id ?? "N/A")}</div>
                <div style={{ marginBottom: 8 }}><strong>Số đêm:</strong> {selectedBooking.soDem ?? "N/A"}</div>
                <div style={{ marginBottom: 8 }}><strong>Tiền cọc:</strong> {selectedBooking.tienCoc ? Number(selectedBooking.tienCoc).toLocaleString() + " VND" : "N/A"}</div>
              </div>
              <div>
                <div style={{ marginBottom: 8 }}><strong>Phòng:</strong> {selectedBooking.idphongNavigation?.tenPhong || selectedBooking.tenPhong || selectedBooking.idphong} ({selectedBooking.idphongNavigation?.soPhong || selectedBooking.soPhong || "N/A"})</div>
                
                <div style={{ marginBottom: 8 }}><strong>Nhận phòng:</strong> {selectedBooking.ngayNhanPhong ? new Date(selectedBooking.ngayNhanPhong).toLocaleString() : "N/A"}</div>
                <div style={{ marginBottom: 8 }}><strong>Trả phòng:</strong> {selectedBooking.ngayTraPhong ? new Date(selectedBooking.ngayTraPhong).toLocaleString() : "N/A"}</div>
                <div style={{ marginBottom: 8 }}><strong>Tổng tiền:</strong> {selectedBooking.tongTien ? Number(selectedBooking.tongTien).toLocaleString() + " VND" : "N/A"}</div>
                <div style={{ marginTop: 6 }}><strong>Thanh toán:</strong> {getPaymentStatusLabel(selectedBooking.trangThaiThanhToan)}</div>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <strong>Ghi chú / Thông tin thêm:</strong>
              <div style={{ marginTop: 8, color: "#374151" }}>{(selectedBooking as any).ghiChu || (selectedBooking as any).note || "Không có"}</div>
            </div>

            <div style={{ marginTop: 14 }}>
              <strong>Chi tiết các phòng trong đơn:</strong>
              { (selectedBooking as any).chiTietDatPhongs && (selectedBooking as any).chiTietDatPhongs.length > 0 ? (
                <ul style={{ marginTop: 8 }}>
                  {(selectedBooking as any).chiTietDatPhongs.map((ct: any) => (
                    <li key={ct.idChiTiet} style={{ marginBottom: 6 }}>
                      <strong>{ct.tenPhongChiTiet || ct.idPhong}</strong> — {ct.soDem} đêm • {ct.giaPhong.toLocaleString()} VND/đêm = {ct.thanhTien.toLocaleString()} VND {ct.ghiChu ? `— ${ct.ghiChu}` : ""}
                    </li>
                  ))}
                </ul>
              ) : (
                <div style={{ color: "#6b7280", marginTop: 8 }}>Không có chi tiết nào.</div>
              ) }
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
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
                style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb" }}
              >
                <option value={0}>Đã hủy</option>
                <option value={1}>Chờ xác nhận</option>
                <option value={2}>Đã xác nhận</option>
                <option value={3}>Đang sử dụng</option>
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
                style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb" }}
              >
                <option value={0}>Chưa thanh toán</option>
                <option value={1}>Đã đặt cọc</option>
                <option value={2}>Đã thanh toán</option>
              </select>

              <button
                onClick={async () => {
                  if (!selectedBooking) return;
                  if (!confirm("Xác nhận xóa?")) return;
                  await handleDelete(selectedBooking.iddatPhong);
                  closeModal();
                }}
                style={{ padding: "8px 12px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 8 }}
              >
                Xóa
              </button>
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
              <tr key={b.iddatPhong} style={{ borderBottom: "1px solid #f3f4f6", transition: "background 150ms ease", background: Number(b.trangThai ?? 0) === 5 ? '#fff1f0' : undefined }} onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
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
                      <button disabled={disabledConfirmIds.has(b.iddatPhong)} onClick={() => handleConfirm(b.iddatPhong)}>Xác nhận</button>
                    )}

                    {/* Show Đổi phòng button for status 3 (Đang sử dụng) */}
                    {b.trangThai === 3 && (
                      <button onClick={() => openReassignModal(b.iddatPhong)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #3b82f6", background: "#eff6ff", color: "#3b82f6", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Đổi phòng</button>
                    )}

                    {/* Show a single Cancel button for any non-cancelled booking so it stays visible after confirm */}
                    {b.trangThai !== 0 && (
                      <button onClick={() => handleCancelBooking(b.iddatPhong)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #ef4444", background: "#fff", color: "#ef4444", cursor: "pointer", fontSize: 12 }}>Hủy</button>
                    )}

                    <button onClick={() => openModal(b)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", fontSize: 12 }}>Chi tiết</button>
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
            const price = item.giaCoBanMotDem ?? item.basePricePerNight ?? item.BasePricePerNight ?? item.discountedPrice ?? item.DiscountedPrice ?? 0;
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
                        <div style={{ color: '#6b7280', fontSize: 13, marginTop: 6 }}>{item.tenLoaiPhong ?? item.roomTypeName ?? ''} • Sức chứa: {item.soNguoiToiDa ?? item.maxOccupancy ?? '—'}</div>
                        {item.promotionName && <div style={{ marginTop: 6, color: '#d97706', fontSize: 13 }}>{item.promotionName}</div>}
                      </div>
                      <div style={{ textAlign: 'right', minWidth: 140 }}>
                        <div style={{ fontWeight: 800, fontSize: 16 }}>{Number(price ?? 0).toLocaleString()} đ</div>
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