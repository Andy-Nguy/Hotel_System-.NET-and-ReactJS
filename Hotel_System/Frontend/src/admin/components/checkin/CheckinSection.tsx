// import React, { useEffect, useState } from "react";
// import {
//   getTodayBookings,
//   getCheckinById,
//   confirmCheckIn,
//   cancelCheckIn,
//   UsingBooking,
// } from "../../../api/checkinApi";

// const CheckinSection: React.FC = () => {
//   const [Bookings, setBookings] = useState<UsingBooking[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [query, setQuery] = useState("");
//   const [statusFilter, setStatusFilter] = useState<string>("");

//   useEffect(() => {
//     loadBookings();
//   }, []);

//   const loadBookings = async () => {
//     try {
//       setLoading(true);
//       const data = await getTodayBookings();
//       setBookings(data || []);
//     } catch (error) {
//       console.error("Failed to load Bookings", error);
//       setBookings([]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Booking update/delete operations are intentionally omitted here.
//   // Use check-in APIs (confirmCheckIn / cancelCheckIn) for check-in flows.

//   const handleConfirmBooking = async (id: string) => {
//     if (!confirm("Xác nhận đặt phòng này và gửi mail xác nhận cho khách?"))
//       return;
//     try {
//       // Call CheckInController to mark Booking as 'Đang sử dụng' (TrangThai = 3)
//       await confirmCheckIn(id);
//       await loadBookings();
//       alert("Đã xác nhận và gửi mail ");
//     } catch (error) {
//       console.error("Failed to BookingBooking", error);
//       // extract server message if axios-style error
//       const serverMsg = (error as any)?.response?.data?.message || (error as any)?.message || null;
//       if (typeof serverMsg === 'string' && serverMsg.toLowerCase().includes('quá hạn')) {
//         alert(serverMsg);
//         try { await loadBookings(); } catch (_) {}
//         return;
//       }
//       alert(serverMsg || "Lỗi khi xác nhận đặt phòng.");
//     }
//   };

//   const handleCancelBooking = async (id: string) => {
//     if (
//       !confirm("Bạn có chắc muốn huỷ đặt phòng này và gửi mail thông báo huỷ?")
//     )
//       return;
//     try {
//       // Call CheckInController cancel endpoint so room status is freed on server
//       await cancelCheckIn(id);
//       await loadBookings();
//       alert("Đã huỷ đặt phòng và gửi mail ");
//     } catch (error) {
//       console.error("Failed to cancel Booking", error);
//       alert("Lỗi khi huỷ đặt phòng.");
//     }
//   };

//   const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
//   const [showModal, setShowModal] = useState(false);
//   const [currentPage, setCurrentPage] = useState(1);
//   const pageSize = 8;

//   const openModal = (b: UsingBooking) => {
//     // show modal immediately with basic booking, then load details in background
//     try {
//       console.log("openModal clicked", b?.iddatPhong);
//     } catch {}
//     setSelectedBooking(b);
//     setShowModal(true);
//     (async () => {
//       try {
//         const detail = await getCheckinById(b.iddatPhong);
//         if (detail) setSelectedBooking(detail);
//       } catch (err) {
//         console.error("Failed to load booking detail", err);
//       }
//     })();
//   };

//   const closeModal = () => {
//     setShowModal(false);
//     setSelectedBooking(null);
//   };

//   const filteredBookings = Bookings.filter((b) => {
//     if (statusFilter && (b.trangThai ?? 0).toString() !== statusFilter) return false;
//     if (query) {
//       const q = query.toLowerCase();
//       if (
//         !(
//           b.tenKhachHang?.toLowerCase().includes(q) ||
//           b.tenPhong?.toLowerCase().includes(q) ||
//           b.iddatPhong.toLowerCase().includes(q)
//         )
//       )
//         return false;
//     }
//     return true;
//   });

//   const totalPages = Math.max(1, Math.ceil(filteredBookings.length / pageSize));
//   const pagedBookings = filteredBookings.slice(
//     (currentPage - 1) * pageSize,
//     currentPage * pageSize
//   );

//   const getStatusLabel = (status: number) => {
//     switch (status) {
//       case 0:
//         return "Đã hủy";
//       case 1:
//         return "Chờ xác nhận";
//       case 2:
//         return "Đã xác nhận";
//       case 3:
//         return "Đã trả phòng";
//       default:
//         return "Chưa rõ";
//     }
//   };

//   const getStatusColor = (status: number) => {
//     switch (status) {
//       case 0:
//         return "#ef4444";
//       case 1:
//         return "#f59e0b";
//       case 2:
//         return "#10b981";
//       case 3:
//         return "#6b7280";
//       default:
//         return "#6b7280";
//     }
//   };

//   const getPaymentStatusLabel = (status: number) => {
//     switch (status) {
//       case 0:
//         return "Đã đặt cọc";
//       case 1:
//         return "Chưa thanh toán";
//       case 2:
//         return "Đã thanh toán";
//       default:
//         return "Chưa rõ";
//     }
//   };

//   const getPaymentStatusColor = (status: number) => {
//     switch (status) {
//       case 0:
//         return { bg: "#fef3c7", color: "#92400e" };
//       case 1:
//         return { bg: "#dbeafe", color: "#1e40af" };
//       case 2:
//         return { bg: "#d1fae5", color: "#065f46" };
//       default:
//         return { bg: "#f3f4f6", color: "#6b7280" };
//     }
//   };

//   if (loading)
//     return (
//       <div style={{ padding: 20, textAlign: "center", color: "#6b7280" }}>
//         Đang tải dữ liệu đặt phòng...
//       </div>
//     );

//   return (
//     <div>
//       <div
//         style={{
//           display: "flex",
//           justifyContent: "space-between",
//           alignItems: "center",
//           marginBottom: 20,
//           paddingBottom: 16,
//           borderBottom: "2px solid #f1f5f9",
//         }}
//       >
//         <div>
//           <div style={{ color: "#6b7280", fontSize: 13 }}>
//             {Bookings.length} đặt phòng tổng • {filteredBookings.length} hiển
//             thị
//           </div>
//         </div>
//         <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
//           <div style={{ position: "relative" }}>
//             <svg
//               style={{
//                 position: "absolute",
//                 left: 10,
//                 top: "50%",
//                 transform: "translateY(-50%)",
//               }}
//               width="16"
//               height="16"
//               viewBox="0 0 24 24"
//               fill="none"
//               xmlns="http://www.w3.org/2000/svg"
//             >
//               <path
//                 d="M21 21l-4.35-4.35"
//                 stroke="#9CA3AF"
//                 strokeWidth="1.5"
//                 strokeLinecap="round"
//                 strokeLinejoin="round"
//               />
//               <circle
//                 cx="11"
//                 cy="11"
//                 r="6"
//                 stroke="#9CA3AF"
//                 strokeWidth="1.5"
//               />
//             </svg>
//             <input
//               type="text"
//               placeholder="Tìm kiếm tên, phòng, mã..."
//               value={query}
//               onChange={(e) => {
//                 setQuery(e.target.value);
//                 setCurrentPage(1);
//               }}
//               style={{
//                 padding: "8px 12px 8px 36px",
//                 border: "1px solid #e5e7eb",
//                 borderRadius: 10,
//                 minWidth: 280,
//                 fontSize: 13,
//               }}
//             />
//           </div>

//           <select
//             value={statusFilter}
//             onChange={(e) => {
//               setStatusFilter(e.target.value);
//               setCurrentPage(1);
//             }}
//             style={{
//               padding: "8px 12px",
//               border: "1px solid #e5e7eb",
//               borderRadius: 10,
//               background: "#fff",
//               fontSize: 13,
//             }}
//           >
//             <option value="">Tất cả trạng thái</option>
//             <option value="0">Đã hủy</option>
//             <option value="1">Chờ xác nhận</option>
//             <option value="2">Đã xác nhận</option>
//             <option value="3">Đã trả phòng</option>
//           </select>
//         </div>
//       </div>

//       {/* Modal: Booking details */}
//       {showModal && selectedBooking && (
//         <div
//           style={{
//             position: "fixed",
//             inset: 0,
//             background: "rgba(0,0,0,0.45)",
//             display: "flex",
//             alignItems: "center",
//             justifyContent: "center",
//             zIndex: 12000,
//           }}
//           onClick={closeModal}
//         >
//           <div
//             onClick={(e) => e.stopPropagation()}
//             style={{
//               width: "96%",
//               maxWidth: 1100,
//               maxHeight: "90vh",
//               overflow: "auto",
//               background: "#fff",
//               borderRadius: 12,
//               padding: 20,
//               boxShadow: "0 12px 40px rgba(2,6,23,0.22)",
//             }}
//           >
//             <div
//               style={{
//                 display: "flex",
//                 justifyContent: "space-between",
//                 alignItems: "center",
//                 gap: 12,
//               }}
//             >
//               <div>
//                 <h3 style={{ margin: 0 }}>Chi tiết đặt phòng</h3>
//                 <div style={{ color: "#6b7280", fontSize: 13 }}>
//                   {selectedBooking.iddatPhong} •{" "}
//                   {selectedBooking.tenKhachHang || "N/A"}
//                 </div>
//               </div>
//               <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
//                 <div
//                   style={{
//                     padding: "6px 10px",
//                     borderRadius: 999,
//                     background: `${getStatusColor(
//                       selectedBooking.trangThai
//                     )}20`,
//                     color: getStatusColor(selectedBooking.trangThai),
//                     fontWeight: 700,
//                     fontSize: 13,
//                   }}
//                 >
//                   {getStatusLabel(selectedBooking.trangThai)}
//                 </div>
//                 <button
//                   onClick={closeModal}
//                   style={{
//                     padding: "8px 12px",
//                     borderRadius: 8,
//                     border: "1px solid #e5e7eb",
//                     background: "#fff",
//                   }}
//                 >
//                   Đóng
//                 </button>
//               </div>
//             </div>

//             <div
//               style={{
//                 marginTop: 14,
//                 display: "grid",
//                 gridTemplateColumns: "1fr 1fr",
//                 gap: 14,
//               }}
//             >
//               <div>
//                 <div style={{ marginBottom: 8 }}>
//                   <strong>Khách hàng:</strong>{" "}
//                   {selectedBooking.tenKhachHang || "N/A"}
//                 </div>
//                 <div style={{ marginBottom: 8 }}>
//                   <strong>Email:</strong>{" "}
//                   {selectedBooking.emailKhachHang || "N/A"}
//                 </div>
//                 <div style={{ marginBottom: 8 }}>
//                   <strong>ID khách hàng:</strong>{" "}
//                   {selectedBooking.idkhachHang ?? "N/A"}
//                 </div>
//                 <div style={{ marginBottom: 8 }}>
//                   <strong>Số đêm:</strong> {selectedBooking.soDem ?? "N/A"}
//                 </div>
//                 <div style={{ marginBottom: 8 }}>
//                   <strong>Tiền cọc:</strong>{" "}
//                   {selectedBooking.tienCoc
//                     ? selectedBooking.tienCoc.toLocaleString() + " VND"
//                     : "N/A"}
//                 </div>
//               </div>
//               <div>
//                 <div style={{ marginBottom: 8 }}>
//                   <strong>Phòng:</strong>{" "}
//                   {selectedBooking.tenPhong || selectedBooking.idphong} (
//                   {selectedBooking.soPhong || "N/A"})
//                 </div>
//                 <div style={{ marginBottom: 8 }}>
//                   <strong>Nhận phòng:</strong>{" "}
//                   {selectedBooking.ngayNhanPhong
//                     ? new Date(selectedBooking.ngayNhanPhong).toLocaleString()
//                     : "N/A"}
//                 </div>
//                 <div style={{ marginBottom: 8 }}>
//                   <strong>Trả phòng:</strong>{" "}
//                   {selectedBooking.ngayTraPhong
//                     ? new Date(selectedBooking.ngayTraPhong).toLocaleString()
//                     : "N/A"}
//                 </div>
//                 <div style={{ marginBottom: 8 }}>
//                   <strong>Tổng tiền:</strong>{" "}
//                   {selectedBooking.tongTien?.toLocaleString() ?? "N/A"} VND
//                 </div>
//                 <div style={{ marginTop: 6 }}>
//                   <strong>Thanh toán:</strong>{" "}
//                   {getPaymentStatusLabel(selectedBooking.trangThaiThanhToan)}
//                 </div>
//               </div>
//             </div>

//             <div style={{ marginTop: 12 }}>
//               <strong>Ghi chú / Thông tin thêm:</strong>
//               <div style={{ marginTop: 8, color: "#374151" }}>
//                 {(selectedBooking as any)?.ghiChu ||
//                   (selectedBooking as any)?.note ||
//                   "Không có"}
//               </div>
//             </div>

//             <div style={{ marginTop: 12 }}>
//               <strong>Chi tiết các phòng trong đơn:</strong>
//               {selectedBooking?.chiTietDatPhongs &&
//               selectedBooking.chiTietDatPhongs.length > 0 ? (
//                 <ul style={{ marginTop: 8 }}>
//                   {selectedBooking.chiTietDatPhongs.map((ct: any) => (
//                     <li key={ct.idChiTiet || ct.id} style={{ marginBottom: 6 }}>
//                       <strong>{ct.tenPhongChiTiet || ct.idPhong}</strong> — {ct.soDem} đêm • {ct.giaPhong?.toLocaleString?.() || 0} VND/đêm = {ct.thanhTien?.toLocaleString?.() || 0} VND {ct.ghiChu ? `— ${ct.ghiChu}` : ""}
//                     </li>
//                   ))}
//                 </ul>
//               ) : (
//                 <div style={{ color: "#6b7280", marginTop: 8 }}>
//                   Không có chi tiết nào.
//                 </div>
//               )}
//             </div>

//             <div
//               style={{
//                 marginTop: 12,
//                 display: "flex",
//                 gap: 8,
//                 justifyContent: "flex-end",
//                 alignItems: "center",
//               }}
//             >
//               <button
//                 onClick={() => closeModal()}
//                 style={{
//                   padding: "8px 12px",
//                   borderRadius: 8,
//                   border: "1px solid #e5e7eb",
//                   background: "#fff",
//                 }}
//               >
//                 Đóng
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       <div style={{ overflowX: "auto" }}>
//         <table
//           style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
//         >
//           <thead>
//             <tr style={{ borderBottom: "2px solid #f1f5f9" }}>
//               <th
//                 style={{
//                   padding: 12,
//                   textAlign: "left",
//                   fontWeight: 700,
//                   color: "#64748b",
//                 }}
//               >
//                 Mã đặt phòng
//               </th>
//               <th
//                 style={{
//                   padding: 12,
//                   textAlign: "left",
//                   fontWeight: 700,
//                   color: "#64748b",
//                 }}
//               >
//                 Khách hàng
//               </th>
//               <th
//                 style={{
//                   padding: 12,
//                   textAlign: "left",
//                   fontWeight: 700,
//                   color: "#64748b",
//                 }}
//               >
//                 Phòng
//               </th>
//               <th
//                 style={{
//                   padding: 12,
//                   textAlign: "left",
//                   fontWeight: 700,
//                   color: "#64748b",
//                 }}
//               >
//                 Ngày nhận - trả
//               </th>
//               <th
//                 style={{
//                   padding: 12,
//                   textAlign: "right",
//                   fontWeight: 700,
//                   color: "#64748b",
//                 }}
//               >
//                 Tổng tiền
//               </th>
//               <th
//                 style={{
//                   padding: 12,
//                   textAlign: "center",
//                   fontWeight: 700,
//                   color: "#64748b",
//                 }}
//               >
//                 Trạng thái
//               </th>
//               <th
//                 style={{
//                   padding: 12,
//                   textAlign: "center",
//                   fontWeight: 700,
//                   color: "#64748b",
//                 }}
//               >
//                 Thanh toán
//               </th>
//               <th
//                 style={{
//                   padding: 12,
//                   textAlign: "right",
//                   fontWeight: 700,
//                   color: "#64748b",
//                 }}
//               >
//                 Thao tác
//               </th>
//             </tr>
//           </thead>
//           <tbody>
//             {pagedBookings.map((b) => (
//               <tr
//                 key={b.iddatPhong}
//                 role="button"
//                 tabIndex={0}
//                 onClick={() => openModal(b)}
//                 onKeyDown={(e) => { if (e.key === 'Enter') openModal(b); }}
//                 style={{
//                   cursor: "pointer",
//                   borderBottom: "1px solid #f3f4f6",
//                   transition: "background 150ms ease",
//                 }}
//                 onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
//                 onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
//               >
//                 <td style={{ padding: 12, fontWeight: 700, color: "#0f172a" }}>
//                   {b.iddatPhong}
//                 </td>
//                 <td style={{ padding: 12 }}>
//                   <div style={{ fontWeight: 600, color: "#0f172a" }}>
//                     {b.tenKhachHang || "N/A"}
//                   </div>
//                   <div style={{ fontSize: 12, color: "#94a3b8" }}>
//                     {b.emailKhachHang || ""}
//                   </div>
//                 </td>
//                 <td style={{ padding: 12, color: "#475569" }}>
//                   <div>{b.tenPhong || b.idphong}</div>
//                   <div style={{ fontSize: 12, color: "#94a3b8" }}>
//                     Phòng {b.soPhong || "—"}
//                   </div>
//                 </td>
//                 <td style={{ padding: 12, color: "#475569" }}>
//                   <div>
//                     {b.ngayNhanPhong ? new Date(b.ngayNhanPhong).toLocaleDateString("vi-VN") : "-"}
//                   </div>
//                   <div style={{ fontSize: 12, color: "#94a3b8" }}>
//                     {b.ngayTraPhong ? new Date(b.ngayTraPhong).toLocaleDateString("vi-VN") : "-"}
//                   </div>
//                 </td>
//                 <td
//                   style={{
//                     padding: 12,
//                     textAlign: "right",
//                     fontWeight: 700,
//                     color: "#0f172a",
//                   }}
//                 >
//                   {(b.tongTien ?? 0).toLocaleString()} đ
//                 </td>
//                 <td style={{ padding: 12, textAlign: "center" }}>
//                   <span
//                     style={{
//                       padding: "4px 10px",
//                       borderRadius: 999,
//                       background: `${getStatusColor(b.trangThai ?? 0)}15`,
//                       color: getStatusColor(b.trangThai ?? 0),
//                       fontWeight: 700,
//                       fontSize: 12,
//                       whiteSpace: "nowrap",
//                     }}
//                   >
//                     {getStatusLabel(b.trangThai ?? 0)}
//                   </span>
//                 </td>
//                 <td style={{ padding: 12, textAlign: "center" }}>
//                   <span
//                     style={{
//                       padding: "4px 10px",
//                       borderRadius: 6,
//                       background: getPaymentStatusColor(b.trangThaiThanhToan ?? 0)
//                         .bg,
//                       color: getPaymentStatusColor(b.trangThaiThanhToan ?? 0).color,
//                       fontWeight: 700,
//                       fontSize: 12,
//                     }}
//                   >
//                     {getPaymentStatusLabel(b.trangThaiThanhToan ?? 0)}
//                   </span>
//                 </td>
//                 <td style={{ padding: 12, textAlign: "right" }}>
//                   <div
//                     style={{
//                       display: "flex",
//                       gap: 6,
//                       justifyContent: "flex-end",
//                     }}
//                   >
//                     { (b.trangThai === 2) && (
//                       <button
//                         onClick={(e) => { e.stopPropagation(); handleConfirmBooking(b.iddatPhong); }}
//                         style={{
//                           padding: "6px 10px",
//                           borderRadius: 8,
//                           border: "none",
//                           background: "linear-gradient(135deg,#059669,#10b981)",
//                           color: "#fff",
//                           cursor: "pointer",
//                           fontSize: 12,
//                           fontWeight: 700,
//                         }}
//                       >
//                         Xác nhận
//                       </button>
//                     )}
//                     {b.trangThai !== 0 && b.trangThai !== 3 && (
//                       <button
//                         onClick={(e) => { e.stopPropagation(); handleCancelBooking(b.iddatPhong); }}
//                         style={{
//                           padding: "6px 10px",
//                           borderRadius: 8,
//                           border: "1px solid #ef4444",
//                           background: "#fff",
//                           color: "#ef4444",
//                           cursor: "pointer",
//                           fontSize: 12,
//                         }}
//                       >
//                         Hủy
//                       </button>
//                     )}
//                     <button
//                       onClick={(e) => { e.stopPropagation(); openModal(b); }}
//                       style={{
//                         padding: "6px 10px",
//                         borderRadius: 8,
//                         border: "1px solid #e5e7eb",
//                         background: "#fff",
//                         cursor: "pointer",
//                         fontSize: 12,
//                       }}
//                     >
//                       Chi tiết
//                     </button>
//                   </div>
//                 </td>
//               </tr>
//             ))}
//           </tbody>
//         </table>
//         {filteredBookings.length === 0 && (
//           <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>
//             Không có đặt phòng nào phù hợp.
//           </div>
//         )}
//       </div>
//       {/* pagination */}
//       {filteredBookings.length > pageSize && (
//         <div
//           style={{
//             display: "flex",
//             gap: 8,
//             justifyContent: "center",
//             marginTop: 20,
//             alignItems: "center",
//             paddingTop: 16,
//             borderTop: "1px solid #f1f5f9",
//           }}
//         >
//           <button
//             onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
//             disabled={currentPage === 1}
//             style={{
//               padding: "8px 14px",
//               borderRadius: 8,
//               border: "1px solid #e5e7eb",
//               background: currentPage === 1 ? "#f8fafc" : "#fff",
//               cursor: currentPage === 1 ? "not-allowed" : "pointer",
//               fontSize: 13,
//               fontWeight: 600,
//             }}
//           >
//             ← Trước
//           </button>
//           <div style={{ color: "#64748b", fontSize: 13, padding: "0 12px" }}>
//             Trang {currentPage} / {totalPages}
//           </div>
//           <button
//             onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
//             disabled={currentPage === totalPages}
//             style={{
//               padding: "8px 14px",
//               borderRadius: 8,
//               border: "1px solid #e5e7eb",
//               background: currentPage === totalPages ? "#f8fafc" : "#fff",
//               cursor: currentPage === totalPages ? "not-allowed" : "pointer",
//               fontSize: 13,
//               fontWeight: 600,
//             }}
//           >
//             Tiếp →
//           </button>
//         </div>
//       )}
//     </div>
//   );
// };

// export default CheckinSection;
