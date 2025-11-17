import React, { useEffect, useMemo, useState } from "react";
import checkinApi, { UsingBooking } from "../../../api/checkinApi";

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
    try {
      const result = await checkinApi.confirmCheckIn(id);
      // Instead of reloading from the server (which would exclude this
      // booking because /today filters by TrangThai == 2), update local
      // state so the row remains visible but the "Xác nhận" action is hidden.
      setBookings((prev) => prev.map((b) => (b.iddatPhong === id ? { ...b, trangThai: 3 } : b)));
      if (selectedBooking && selectedBooking.iddatPhong === id) {
        setSelectedBooking({ ...selectedBooking, trangThai: 3 });
      }

      // user feedback based on server response
      const emailSent = result?.emailSent;
      if (emailSent === true) {
        alert("Xác nhận thành công. Email xác nhận đã được gửi đến khách.");
      } else if (emailSent === false) {
        alert("Xác nhận thành công. Không thể gửi email (kiểm tra cấu hình SMTP).\nEmail vẫn có thể được gửi thủ công later.");
      } else {
        alert("Xác nhận thành công.");
      }
    } catch (err: any) {
      alert(err?.message || "Xác nhận thất bại");
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
        return "Chưa thanh toán";
      case 1:
        return "Đã đặt cọc";
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
              <tr key={b.iddatPhong} style={{ borderBottom: "1px solid #f3f4f6", transition: "background 150ms ease" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
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
                  <span style={{ padding: "4px 10px", borderRadius: 999, background: `${getStatusColor(b.trangThai)}15`, color: getStatusColor(b.trangThai), fontWeight: 700, fontSize: 12, whiteSpace: "nowrap" }}>{getStatusLabel(b.trangThai)}</span>
                </td>
                <td style={{ padding: 12, textAlign: "center" }}>
                  <span style={{ padding: "4px 10px", borderRadius: 6, background: getPaymentStatusColor(b.trangThaiThanhToan).bg, color: getPaymentStatusColor(b.trangThaiThanhToan).color, fontWeight: 700, fontSize: 12 }}>{getPaymentStatusLabel(b.trangThaiThanhToan)}</span>
                </td>
                <td style={{ padding: 12, textAlign: "right" }}>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    {/* Show Confirm only for status 2 */}
                    {b.trangThai === 2 && (
                      <button onClick={() => handleConfirm(b.iddatPhong)}>Xác nhận</button>
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