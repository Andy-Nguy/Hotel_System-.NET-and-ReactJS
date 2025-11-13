import React, { useEffect, useState } from "react";
import {
  getBookings,
  Booking,
  updateBooking,
  deleteBooking,
} from "../../api/bookingApi";

const BookingSection: React.FC = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    try {
      const data = await getBookings();
      setBookings(data);
    } catch (error) {
      console.error("Failed to load bookings", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: number) => {
    try {
      await updateBooking(id, { trangThai: newStatus });
      await loadBookings();
      alert("Cập nhật trạng thái thành công!");
    } catch (error) {
      console.error("Failed to update booking", error);
      alert("Lỗi khi cập nhật trạng thái.");
    }
  };

  const handleUpdatePaymentStatus = async (
    id: string,
    newPaymentStatus: number
  ) => {
    try {
      await updateBooking(id, { trangThaiThanhToan: newPaymentStatus });
      await loadBookings();
      alert("Cập nhật trạng thái thanh toán thành công!");
    } catch (error) {
      console.error("Failed to update payment status", error);
      alert("Lỗi khi cập nhật trạng thái thanh toán.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bạn có chắc muốn xóa đặt phòng này?")) return;
    try {
      await deleteBooking(id);
      await loadBookings();
      alert("Xóa đặt phòng thành công!");
    } catch (error) {
      console.error("Failed to delete booking", error);
      alert("Lỗi khi xóa đặt phòng.");
    }
  };

  const handleConfirmBooking = async (id: string) => {
    if (!confirm("Xác nhận đặt phòng này và gửi mail xác nhận cho khách?"))
      return;
    try {
      await updateBooking(id, { trangThai: 2 });
      await loadBookings();
      alert("Đã xác nhận và gửi mail (nếu cấu hình SMTP).");
    } catch (error) {
      console.error("Failed to confirm booking", error);
      alert("Lỗi khi xác nhận đặt phòng.");
    }
  };

  const handleCancelBooking = async (id: string) => {
    if (
      !confirm("Bạn có chắc muốn huỷ đặt phòng này và gửi mail thông báo huỷ?")
    )
      return;
    try {
      await updateBooking(id, { trangThai: 0 });
      await loadBookings();
      alert("Đã huỷ đặt phòng và gửi mail (nếu cấu hình SMTP).");
    } catch (error) {
      console.error("Failed to cancel booking", error);
      alert("Lỗi khi huỷ đặt phòng.");
    }
  };

  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const openModal = (b: Booking) => {
    setSelectedBooking(b);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedBooking(null);
  };

  const filteredBookings = bookings.filter((b) => {
    if (statusFilter && b.trangThai.toString() !== statusFilter) return false;
    if (query) {
      const q = query.toLowerCase();
      if (
        !(
          b.tenKhachHang?.toLowerCase().includes(q) ||
          b.tenPhong?.toLowerCase().includes(q) ||
          b.iddatPhong.toLowerCase().includes(q)
        )
      )
        return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / pageSize));
  const pagedBookings = filteredBookings.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const getStatusLabel = (status: number) => {
    switch (status) {
      case 0:
        return "Đã hủy";
      case 1:
        return "Chờ xác nhận";
      case 2:
        return "Đã xác nhận";
      case 3:
        return "Đã trả phòng";
      default:
        return "Chưa rõ";
    }
  };

  const getStatusColor = (status: number) => {
    switch (status) {
      case 0:
        return "#ef4444";
      case 1:
        return "#f59e0b";
      case 2:
        return "#10b981";
      case 3:
        return "#6b7280";
      default:
        return "#6b7280";
    }
  };

  const getPaymentStatusLabel = (status: number) => {
    switch (status) {
      case 0:
        return "Chưa thanh toán";
      case 1:
        return "Đã thanh toán";
      case 2:
        return "Đã hoàn tiền";
      default:
        return "Chưa rõ";
    }
  };

  if (loading)
    return (
      <div style={{ padding: 20, textAlign: "center", color: "#6b7280" }}>
        Đang tải dữ liệu đặt phòng...
      </div>
    );

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
          paddingBottom: 16,
          borderBottom: "2px solid #f1f5f9",
        }}
      >
        <div>
          <div style={{ color: "#64748b", fontSize: 13 }}>
            {bookings.length} đặt phòng tổng • {filteredBookings.length} hiển
            thị
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <svg
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
              }}
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M21 21l-4.35-4.35"
                stroke="#9CA3AF"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle
                cx="11"
                cy="11"
                r="6"
                stroke="#9CA3AF"
                strokeWidth="1.5"
              />
            </svg>
            <input
              type="text"
              placeholder="Tìm kiếm tên, phòng, mã..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                padding: "8px 12px 8px 36px",
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                minWidth: 280,
                fontSize: 13,
              }}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
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
            <option value="3">Đã trả phòng</option>
          </select>
        </div>
      </div>

      {/* Modal */}
      {showModal && selectedBooking && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 60,
            backdropFilter: "blur(4px)",
          }}
          onClick={closeModal}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "94%",
              maxWidth: 1000,
              maxHeight: "88vh",
              overflow: "auto",
              background: "#fff",
              borderRadius: 16,
              boxShadow: "0 20px 60px rgba(15,23,42,0.25)",
            }}
          >
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "2px solid #f1f5f9",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: 18,
                    fontWeight: 800,
                    color: "#0f172a",
                  }}
                >
                  Chi tiết đặt phòng
                </h3>
                <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
                  {selectedBooking.iddatPhong} •{" "}
                  {selectedBooking.tenKhachHang || "N/A"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    background: `${getStatusColor(
                      selectedBooking.trangThai
                    )}15`,
                    color: getStatusColor(selectedBooking.trangThai),
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                >
                  {getStatusLabel(selectedBooking.trangThai)}
                </div>
                <button
                  onClick={closeModal}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                    background: "#fff",
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  Đóng
                </button>
              </div>
            </div>

            <div style={{ padding: 24 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 20,
                  marginBottom: 20,
                }}
              >
                <div
                  style={{
                    padding: 16,
                    background: "#f8fafc",
                    borderRadius: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      color: "#64748b",
                      fontWeight: 700,
                      marginBottom: 12,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    Thông tin khách hàng
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <strong style={{ color: "#475569", fontSize: 13 }}>
                      Họ tên:
                    </strong>{" "}
                    <span style={{ color: "#0f172a" }}>
                      {selectedBooking.tenKhachHang || "N/A"}
                    </span>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <strong style={{ color: "#475569", fontSize: 13 }}>
                      Email:
                    </strong>{" "}
                    <span style={{ color: "#0f172a" }}>
                      {selectedBooking.emailKhachHang || "N/A"}
                    </span>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <strong style={{ color: "#475569", fontSize: 13 }}>
                      ID:
                    </strong>{" "}
                    <span style={{ color: "#0f172a" }}>
                      {selectedBooking.idkhachHang ?? "N/A"}
                    </span>
                  </div>
                </div>
                <div
                  style={{
                    padding: 16,
                    background: "#f8fafc",
                    borderRadius: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      color: "#64748b",
                      fontWeight: 700,
                      marginBottom: 12,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    Thông tin đặt phòng
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <strong style={{ color: "#475569", fontSize: 13 }}>
                      Phòng:
                    </strong>{" "}
                    <span style={{ color: "#0f172a" }}>
                      {selectedBooking.tenPhong || selectedBooking.idphong} (
                      {selectedBooking.soPhong || "N/A"})
                    </span>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <strong style={{ color: "#475569", fontSize: 13 }}>
                      Nhận phòng:
                    </strong>{" "}
                    <span style={{ color: "#0f172a" }}>
                      {selectedBooking.ngayNhanPhong
                        ? new Date(
                            selectedBooking.ngayNhanPhong
                          ).toLocaleString("vi-VN")
                        : "N/A"}
                    </span>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <strong style={{ color: "#475569", fontSize: 13 }}>
                      Trả phòng:
                    </strong>{" "}
                    <span style={{ color: "#0f172a" }}>
                      {selectedBooking.ngayTraPhong
                        ? new Date(selectedBooking.ngayTraPhong).toLocaleString(
                            "vi-VN"
                          )
                        : "N/A"}
                    </span>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <strong style={{ color: "#475569", fontSize: 13 }}>
                      Số đêm:
                    </strong>{" "}
                    <span style={{ color: "#0f172a" }}>
                      {selectedBooking.soDem ?? "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              <div
                style={{
                  padding: 16,
                  background: "#f8fafc",
                  borderRadius: 12,
                  marginBottom: 20,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    color: "#64748b",
                    fontWeight: 700,
                    marginBottom: 12,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  Thanh toán
                </div>
                <div style={{ display: "flex", gap: 30 }}>
                  <div>
                    <strong style={{ color: "#475569", fontSize: 13 }}>
                      Tiền cọc:
                    </strong>{" "}
                    <span style={{ color: "#0f172a", fontWeight: 700 }}>
                      {selectedBooking.tienCoc
                        ? selectedBooking.tienCoc.toLocaleString() + " đ"
                        : "N/A"}
                    </span>
                  </div>
                  <div>
                    <strong style={{ color: "#475569", fontSize: 13 }}>
                      Tổng tiền:
                    </strong>{" "}
                    <span
                      style={{
                        color: "#0f172a",
                        fontWeight: 700,
                        fontSize: 16,
                      }}
                    >
                      {selectedBooking.tongTien?.toLocaleString() ?? "N/A"} đ
                    </span>
                  </div>
                  <div>
                    <strong style={{ color: "#475569", fontSize: 13 }}>
                      TT:
                    </strong>{" "}
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: 6,
                        background:
                          selectedBooking.trangThaiThanhToan === 1
                            ? "#10b98110"
                            : "#f59e0b10",
                        color:
                          selectedBooking.trangThaiThanhToan === 1
                            ? "#10b981"
                            : "#f59e0b",
                        fontWeight: 700,
                        fontSize: 12,
                      }}
                    >
                      {getPaymentStatusLabel(
                        selectedBooking.trangThaiThanhToan
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {selectedBooking.chiTietDatPhongs &&
                selectedBooking.chiTietDatPhongs.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#64748b",
                        fontWeight: 700,
                        marginBottom: 12,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Chi tiết phòng
                    </div>
                    <div
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 8,
                        overflow: "hidden",
                      }}
                    >
                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          fontSize: 13,
                        }}
                      >
                        <thead>
                          <tr style={{ background: "#f8fafc" }}>
                            <th
                              style={{
                                padding: 10,
                                textAlign: "left",
                                fontWeight: 700,
                                color: "#64748b",
                              }}
                            >
                              Phòng
                            </th>
                            <th
                              style={{
                                padding: 10,
                                textAlign: "center",
                                fontWeight: 700,
                                color: "#64748b",
                              }}
                            >
                              Số đêm
                            </th>
                            <th
                              style={{
                                padding: 10,
                                textAlign: "right",
                                fontWeight: 700,
                                color: "#64748b",
                              }}
                            >
                              Giá/đêm
                            </th>
                            <th
                              style={{
                                padding: 10,
                                textAlign: "right",
                                fontWeight: 700,
                                color: "#64748b",
                              }}
                            >
                              Thành tiền
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedBooking.chiTietDatPhongs.map((ct) => (
                            <tr
                              key={ct.idChiTiet}
                              style={{ borderTop: "1px solid #f1f5f9" }}
                            >
                              <td style={{ padding: 10 }}>
                                <div
                                  style={{ fontWeight: 700, color: "#0f172a" }}
                                >
                                  {ct.tenPhongChiTiet || ct.idPhong}
                                </div>
                                {ct.ghiChu && (
                                  <div
                                    style={{ fontSize: 12, color: "#94a3b8" }}
                                  >
                                    {ct.ghiChu}
                                  </div>
                                )}
                              </td>
                              <td
                                style={{
                                  padding: 10,
                                  textAlign: "center",
                                  color: "#475569",
                                }}
                              >
                                {ct.soDem}
                              </td>
                              <td
                                style={{
                                  padding: 10,
                                  textAlign: "right",
                                  color: "#475569",
                                }}
                              >
                                {ct.giaPhong.toLocaleString()} đ
                              </td>
                              <td
                                style={{
                                  padding: 10,
                                  textAlign: "right",
                                  fontWeight: 700,
                                  color: "#0f172a",
                                }}
                              >
                                {ct.thanhTien.toLocaleString()} đ
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  justifyContent: "flex-end",
                  alignItems: "center",
                  paddingTop: 20,
                  borderTop: "2px solid #f1f5f9",
                }}
              >
                <div
                  style={{
                    marginRight: "auto",
                    color: "#64748b",
                    fontSize: 13,
                  }}
                >
                  Thao tác:
                </div>
                <select
                  value={selectedBooking.trangThai}
                  onChange={async (e) => {
                    const v = parseInt(e.target.value);
                    if (!selectedBooking) return;
                    await handleUpdateStatus(selectedBooking.iddatPhong, v);
                    await loadBookings();
                    const updated =
                      bookings.find(
                        (x) => x.iddatPhong === selectedBooking.iddatPhong
                      ) || null;
                    setSelectedBooking(updated);
                  }}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  <option value={0}>Đã hủy</option>
                  <option value={1}>Chờ xác nhận</option>
                  <option value={2}>Đã xác nhận</option>
                  <option value={3}>Đã trả phòng</option>
                </select>

                <select
                  value={selectedBooking.trangThaiThanhToan}
                  onChange={async (e) => {
                    const v = parseInt(e.target.value);
                    if (!selectedBooking) return;
                    await handleUpdatePaymentStatus(
                      selectedBooking.iddatPhong,
                      v
                    );
                    await loadBookings();
                    const updated =
                      bookings.find(
                        (x) => x.iddatPhong === selectedBooking.iddatPhong
                      ) || null;
                    setSelectedBooking(updated);
                  }}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  <option value={0}>Chưa thanh toán</option>
                  <option value={1}>Đã thanh toán</option>
                  <option value={2}>Đã hoàn tiền</option>
                </select>

                <button
                  onClick={async () => {
                    if (!selectedBooking) return;
                    if (!confirm("Xác nhận xóa đặt phòng này?")) return;
                    await handleDelete(selectedBooking.iddatPhong);
                    closeModal();
                  }}
                  style={{
                    padding: "8px 14px",
                    background: "linear-gradient(135deg,#dc2626,#ef4444)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  Xóa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
        >
          <thead>
            <tr style={{ borderBottom: "2px solid #f1f5f9" }}>
              <th
                style={{
                  padding: 12,
                  textAlign: "left",
                  fontWeight: 700,
                  color: "#64748b",
                }}
              >
                Mã đặt phòng
              </th>
              <th
                style={{
                  padding: 12,
                  textAlign: "left",
                  fontWeight: 700,
                  color: "#64748b",
                }}
              >
                Khách hàng
              </th>
              <th
                style={{
                  padding: 12,
                  textAlign: "left",
                  fontWeight: 700,
                  color: "#64748b",
                }}
              >
                Phòng
              </th>
              <th
                style={{
                  padding: 12,
                  textAlign: "left",
                  fontWeight: 700,
                  color: "#64748b",
                }}
              >
                Ngày nhận - trả
              </th>
              <th
                style={{
                  padding: 12,
                  textAlign: "right",
                  fontWeight: 700,
                  color: "#64748b",
                }}
              >
                Tổng tiền
              </th>
              <th
                style={{
                  padding: 12,
                  textAlign: "center",
                  fontWeight: 700,
                  color: "#64748b",
                }}
              >
                Trạng thái
              </th>
              <th
                style={{
                  padding: 12,
                  textAlign: "center",
                  fontWeight: 700,
                  color: "#64748b",
                }}
              >
                Thanh toán
              </th>
              <th
                style={{
                  padding: 12,
                  textAlign: "right",
                  fontWeight: 700,
                  color: "#64748b",
                }}
              >
                Thao tác
              </th>
            </tr>
          </thead>
          <tbody>
            {pagedBookings.map((b) => (
              <tr
                key={b.iddatPhong}
                style={{
                  borderBottom: "1px solid #f3f4f6",
                  transition: "background 150ms ease",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "#f8fafc")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <td style={{ padding: 12, fontWeight: 700, color: "#0f172a" }}>
                  {b.iddatPhong}
                </td>
                <td style={{ padding: 12 }}>
                  <div style={{ fontWeight: 600, color: "#0f172a" }}>
                    {b.tenKhachHang || "N/A"}
                  </div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>
                    {b.emailKhachHang || ""}
                  </div>
                </td>
                <td style={{ padding: 12, color: "#475569" }}>
                  <div>{b.tenPhong || b.idphong}</div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>
                    Phòng {b.soPhong || "—"}
                  </div>
                </td>
                <td style={{ padding: 12, color: "#475569" }}>
                  <div>
                    {new Date(b.ngayNhanPhong).toLocaleDateString("vi-VN")}
                  </div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>
                    {new Date(b.ngayTraPhong).toLocaleDateString("vi-VN")}
                  </div>
                </td>
                <td
                  style={{
                    padding: 12,
                    textAlign: "right",
                    fontWeight: 700,
                    color: "#0f172a",
                  }}
                >
                  {b.tongTien.toLocaleString()} đ
                </td>
                <td style={{ padding: 12, textAlign: "center" }}>
                  <span
                    style={{
                      padding: "4px 10px",
                      borderRadius: 999,
                      background: `${getStatusColor(b.trangThai)}15`,
                      color: getStatusColor(b.trangThai),
                      fontWeight: 700,
                      fontSize: 12,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {getStatusLabel(b.trangThai)}
                  </span>
                </td>
                <td style={{ padding: 12, textAlign: "center" }}>
                  <span
                    style={{
                      padding: "4px 10px",
                      borderRadius: 6,
                      background:
                        b.trangThaiThanhToan === 1 ? "#10b98110" : "#f59e0b10",
                      color: b.trangThaiThanhToan === 1 ? "#10b981" : "#f59e0b",
                      fontWeight: 700,
                      fontSize: 12,
                    }}
                  >
                    {getPaymentStatusLabel(b.trangThaiThanhToan)}
                  </span>
                </td>
                <td style={{ padding: 12, textAlign: "right" }}>
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      justifyContent: "flex-end",
                    }}
                  >
                    {b.trangThai === 1 && (
                      <button
                        onClick={() => handleConfirmBooking(b.iddatPhong)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "none",
                          background: "linear-gradient(135deg,#059669,#10b981)",
                          color: "#fff",
                          cursor: "pointer",
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        Xác nhận
                      </button>
                    )}
                    {b.trangThai !== 0 && b.trangThai !== 3 && (
                      <button
                        onClick={() => handleCancelBooking(b.iddatPhong)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid #ef4444",
                          background: "#fff",
                          color: "#ef4444",
                          cursor: "pointer",
                          fontSize: 12,
                        }}
                      >
                        Hủy
                      </button>
                    )}
                    <button
                      onClick={() => openModal(b)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid #e5e7eb",
                        background: "#fff",
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                    >
                      Chi tiết
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredBookings.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>
            Không có đặt phòng nào phù hợp.
          </div>
        )}
      </div>

      {filteredBookings.length > pageSize && (
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "center",
            marginTop: 20,
            alignItems: "center",
            paddingTop: 16,
            borderTop: "1px solid #f1f5f9",
          }}
        >
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: currentPage === 1 ? "#f8fafc" : "#fff",
              cursor: currentPage === 1 ? "not-allowed" : "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            ← Trước
          </button>
          <div style={{ color: "#64748b", fontSize: 13, padding: "0 12px" }}>
            Trang {currentPage} / {totalPages}
          </div>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: currentPage === totalPages ? "#f8fafc" : "#fff",
              cursor: currentPage === totalPages ? "not-allowed" : "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Tiếp →
          </button>
        </div>
      )}
    </div>
  );
};

export default BookingSection;
