import React, { useEffect, useState } from "react";
import serviceApi, { Service, ServiceUsage } from "../../api/serviceApi";
import ServiceSection from "../components/ServiceSection";
import Slidebar from "../components/Slidebar";
import HeaderSection from "../components/HeaderSection";

const ServiceManager: React.FC = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState<Partial<Service>>({
    tenDichVu: "",
    tienDichVu: 0,
    hinhDichVu: "",
  });

  // modal for add/edit
  const [showModal, setShowModal] = useState(false);
  const [modalForm, setModalForm] = useState<Partial<Service>>({
    tenDichVu: "",
    tienDichVu: 0,
    hinhDichVu: "",
    thoiGianBatDau: "08:00:00",
    thoiGianKetThuc: "22:00:00",
    trangThai: "Đang hoạt động",
  });
  const [modalFile, setModalFile] = useState<File | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState<string>("");
  // TTDichVu form fields
  const [modalDetails, setModalDetails] = useState({
    thongTinDv: "",
    thoiLuongUocTinh: 60,
    ghiChu: "",
  });

  // usages (global history)
  const [usages, setUsages] = useState<ServiceUsage[]>([]);
  const [loadingUsages, setLoadingUsages] = useState(false);
  // details modal state
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailService, setDetailService] = useState<Service | null>(null);
  const [serviceDetails, setServiceDetails] = useState<Service[]>([]);
  const [serviceUsage, setServiceUsage] = useState<ServiceUsage[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailEditMode, setDetailEditMode] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await serviceApi.getServices();
      setServices(data);
    } catch (err) {
      console.error(err);
      alert("Không thể tải danh sách dịch vụ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    loadUsages();
  }, []);

  function startEdit(s: Service) {
    setEditing(s);
    setModalForm({
      tenDichVu: s.tenDichVu,
      tienDichVu: s.tienDichVu ?? 0,
      hinhDichVu: s.hinhDichVu,
      thoiGianBatDau: s.thoiGianBatDau ?? "08:00:00",
      thoiGianKetThuc: s.thoiGianKetThuc ?? "22:00:00",
      trangThai: s.trangThai ?? "Đang hoạt động",
    });
    setImageUrlInput(s.hinhDichVu ?? "");
    setModalFile(null);

    // Fetch merged service data (includes TTDichVu fields) and populate modal details
    serviceApi.getServiceById(s.iddichVu).then((d) => {
      if (d) {
        setModalDetails({
          thongTinDv: d.thongTinDv ?? "",
          thoiLuongUocTinh: d.thoiLuongUocTinh ?? 60,
          ghiChu: d.ghiChu ?? "",
        });
      } else {
        setModalDetails({ thongTinDv: "", thoiLuongUocTinh: 60, ghiChu: "" });
      }
    });

    setShowModal(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("Xóa dịch vụ này?")) return;
    try {
      await serviceApi.deleteService(id);
      await load();
    } catch (err) {
      console.error(err);
      alert("Xóa không thành công");
    }
  }

  async function openDetails(s: Service) {
    setDetailVisible(true);
    setDetailEditMode(false);
    setLoadingDetails(true);
    try {
      // Fetch fresh service data to ensure latest trangThai
      console.log("[DEBUG] Opening details for service ID:", s.iddichVu);
      const freshService = await serviceApi.getServiceById(s.iddichVu);
      console.log("[DEBUG] Fresh service fetched:", freshService);
      setDetailService(freshService);

      console.log(
        "[DEBUG] Fetch merged service data from getServiceById for id:",
        s.iddichVu
      );
      const merged = await serviceApi.getServiceById(s.iddichVu);
      console.log("[DEBUG] ✅ Merged service response:", merged);

      console.log(
        "[DEBUG] Fetching usage from endpoint: /api/dich-vu/lich-su/" +
          s.iddichVu
      );
      let usage = await serviceApi.getServiceUsage(s.iddichVu);
      console.log("[DEBUG] Service Usage API response (per-service):", usage);

      if (!usage || (Array.isArray(usage) && usage.length === 0)) {
        console.log(
          "[DEBUG] Per-service usage empty, fetching all usages as fallback"
        );
        const all = await serviceApi.getAllUsage();
        usage = Array.isArray(all)
          ? all.filter((u) => (u.iddichVu ?? s.iddichVu) === s.iddichVu)
          : [];
        console.log("[DEBUG] Fallback filtered usages:", usage);
      } else {
        // Ensure returned array only contains this service's entries (defensive)
        usage = Array.isArray(usage)
          ? usage.filter((u) => (u.iddichVu ?? s.iddichVu) === s.iddichVu)
          : [];
      }

      // Service details are now included in 'merged' (single object). For compatibility
      // keep serviceDetails as array shape expected by UI.
      setServiceDetails(merged ? [merged as any] : []);
      setServiceUsage(usage);
    } catch (err) {
      console.error("[DEBUG] ❌ Error loading details:", err);
      alert("Không thể tải thông tin chi tiết hoặc lịch sử sử dụng");
    } finally {
      setLoadingDetails(false);
    }
  }

  async function openDetailsForEdit(s: Service) {
    setDetailVisible(true);
    setDetailEditMode(true);
    setLoadingDetails(true);
    try {
      // Fetch fresh service data to ensure latest trangThai
      const freshService = await serviceApi.getServiceById(s.iddichVu);
      setDetailService(freshService);

      const [merged, perServiceUsage] = await Promise.all([
        serviceApi.getServiceById(s.iddichVu),
        serviceApi.getServiceUsage(s.iddichVu),
      ]);
      console.log("Service Details fetched (merged):", merged);
      console.log("Service Usage (per-service) fetched:", perServiceUsage);

      let usage = perServiceUsage;
      if (!usage || (Array.isArray(usage) && usage.length === 0)) {
        console.log(
          "Per-service usage empty, fetching all usages as fallback (edit)"
        );
        const all = await serviceApi.getAllUsage();
        usage = Array.isArray(all)
          ? all.filter((u) => (u.iddichVu ?? s.iddichVu) === s.iddichVu)
          : [];
        console.log("Fallback filtered usages (edit):", usage);
      } else {
        usage = Array.isArray(usage)
          ? usage.filter((u) => (u.iddichVu ?? s.iddichVu) === s.iddichVu)
          : [];
      }

      setServiceDetails(merged ? [merged as any] : []);
      setServiceUsage(usage);
    } catch (err) {
      console.error("Error loading details for edit:", err);
      alert("Không thể tải thông tin chi tiết");
    } finally {
      setLoadingDetails(false);
    }
  }

  async function handleDetailEdit(updatedService: Service, isActive: boolean) {
    try {
      const payload: Partial<Service> = {
        tenDichVu: updatedService.tenDichVu,
        tienDichVu: updatedService.tienDichVu,
        hinhDichVu: updatedService.hinhDichVu,
        thoiGianBatDau: updatedService.thoiGianBatDau,
        thoiGianKetThuc: updatedService.thoiGianKetThuc,
        trangThai: isActive ? "Đang hoạt động" : "Ngưng hoạt động",
        // Include detail fields
        thongTinDv: updatedService.thongTinDv,
        thoiLuongUocTinh: updatedService.thoiLuongUocTinh,
        ghiChu: updatedService.ghiChu,
      };
      await serviceApi.updateService(updatedService.iddichVu, payload);

      // Reload services and get fresh data
      setLoading(true);
      try {
        const freshServices = await serviceApi.getServices();
        setServices(freshServices);

        // Update detailService with fresh data
        const updatedDetailService = freshServices.find(
          (s) => s.iddichVu === updatedService.iddichVu
        );
        if (updatedDetailService) {
          setDetailService(updatedDetailService);
        }
      } finally {
        setLoading(false);
      }

      await loadUsages();
      alert("Cập nhật dịch vụ thành công");
      setDetailVisible(false);
    } catch (err) {
      console.error(err);
      const msg =
        err && (err as any).message
          ? (err as any).message
          : "Cập nhật dịch vụ thất bại";
      alert(msg);
    }
  }

  // modal submit handler (create or update with optional image upload)
  async function handleModalSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setModalLoading(true);
    try {
      let imageUrl = modalForm.hinhDichVu ?? "";
      if (modalFile) {
        const res = await serviceApi.uploadServiceImage(
          modalFile,
          editing?.iddichVu,
          modalForm.tenDichVu
        );
        // Store only the fileName (e.g., "DV_Spa L'Occitane.jpg"), not the full URL path
        imageUrl = res.fileName;
      }

      const payload: Partial<Service> = {
        tenDichVu: modalForm.tenDichVu,
        tienDichVu: modalForm.tienDichVu,
        hinhDichVu: imageUrl,
        thoiGianBatDau: modalForm.thoiGianBatDau,
        thoiGianKetThuc: modalForm.thoiGianKetThuc,
        trangThai: modalForm.trangThai,
      };

      let serviceId: string;
      if (editing) {
        await serviceApi.updateService(editing.iddichVu, payload);
        serviceId = editing.iddichVu;
      } else {
        const newService = await serviceApi.createService(payload);
        serviceId = newService.iddichVu;
      }

      // Create or update TTDichVu (service details)
      // Always create/update TTDichVu, even if user didn't fill it in, to ensure consistency
      const detailPayload: Partial<Service> = {
        thongTinDv: modalDetails.thongTinDv,
        thoiLuongUocTinh: modalDetails.thoiLuongUocTinh,
        ghiChu: modalDetails.ghiChu,
      };

      try {
        // The API now stores detail fields on the main service. Update the service with
        // the detail payload to persist thongTinDv / thoiLuongUocTinh / ghiChu.
        await serviceApi.updateService(serviceId, {
          thongTinDv: detailPayload.thongTinDv,
          thoiLuongUocTinh: detailPayload.thoiLuongUocTinh,
          ghiChu: detailPayload.ghiChu,
        });
        console.log("Updated merged service with detail payload");
      } catch (detailErr) {
        console.error("Error saving service detail (merged):", detailErr);
      }

      setModalForm({
        tenDichVu: "",
        tienDichVu: 0,
        hinhDichVu: "",
        thoiGianBatDau: "08:00:00",
        thoiGianKetThuc: "22:00:00",
        trangThai: "Đang hoạt động",
      });
      setModalDetails({ thongTinDv: "", thoiLuongUocTinh: 60, ghiChu: "" });
      setModalFile(null);
      setShowModal(false);
      await load();
      await loadUsages();
    } catch (err) {
      console.error(err);
      // show server-provided error if available
      const msg =
        err && (err as any).message
          ? (err as any).message
          : "Lưu dịch vụ thất bại";
      alert(msg);
    } finally {
      setModalLoading(false);
    }
  }

  async function loadUsages() {
    setLoadingUsages(true);
    try {
      const data = await serviceApi.getAllUsage();
      setUsages(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingUsages(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <Slidebar />
      <div style={{ marginLeft: 280 }}>
        <HeaderSection showStats={false} />

        <main style={{ padding: "0px 60px" }}>
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 20,
              boxShadow: "0 8px 24px rgba(2,6,23,0.06)",
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: 12 }}>Quản lý dịch vụ</h2>
            <section style={{ marginBottom: 16 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <div>
                  <button
                    onClick={() => {
                      setEditing(null);
                      setModalForm({
                        tenDichVu: "",
                        tienDichVu: 0,
                        hinhDichVu: "",
                        thoiGianBatDau: "08:00:00",
                        thoiGianKetThuc: "22:00:00",
                        trangThai: "Đang hoạt động",
                      });
                      setImageUrlInput("");
                      setModalDetails({
                        thongTinDv: "",
                        thoiLuongUocTinh: 60,
                        ghiChu: "",
                      });
                      setModalFile(null);
                      setShowModal(true);
                    }}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 10,
                      background: "linear-gradient(135deg,#1e40af,#3b82f6)",
                      color: "#fff",
                      border: "none",
                      fontWeight: 700,
                    }}
                  >
                    Thêm dịch vụ
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <h3 style={{ marginBottom: 8 }}>Lịch sử sử dụng</h3>
                {loadingUsages ? (
                  <div>Đang tải...</div>
                ) : (
                  <div
                    style={{
                      maxHeight: 240,
                      overflow: "auto",
                      border: "1px solid #f3f4f6",
                      borderRadius: 8,
                    }}
                  >
                    {usages.length === 0 ? (
                      <div style={{ padding: 12 }} className="text-muted">
                        Chưa có lịch sử sử dụng.
                      </div>
                    ) : (
                      <table
                        style={{ width: "100%", borderCollapse: "collapse" }}
                      >
                        <thead>
                          <tr
                            style={{
                              textAlign: "left",
                              borderBottom: "1px solid #eef2f7",
                            }}
                          >
                            <th style={{ padding: "8px" }}>ID Hóa đơn</th>
                            <th style={{ padding: "8px" }}>ID Dịch vụ</th>
                            <th style={{ padding: "8px" }}>Tiền</th>
                            <th style={{ padding: "8px" }}>Thời gian</th>
                          </tr>
                        </thead>
                        <tbody>
                          {usages.map((u) => (
                            <tr key={u.idhoaDon + String(u.thoiGianThucHien)}>
                              <td style={{ padding: 8 }}>{u.idhoaDon}</td>
                              <td style={{ padding: 8 }}>{u.iddichVu}</td>
                              <td style={{ padding: 8 }}>
                                {u.tienDichVu != null
                                  ? new Intl.NumberFormat("vi-VN").format(
                                      u.tienDichVu
                                    )
                                  : ""}
                              </td>
                              <td style={{ padding: 8 }}>
                                {u.thoiGianThucHien
                                  ? new Date(
                                      u.thoiGianThucHien
                                    ).toLocaleString()
                                  : ""}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>

              <h3 style={{ marginBottom: 8 }}>Danh sách dịch vụ</h3>
              {loading ? (
                <div>Đang tải...</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr
                        style={{
                          textAlign: "left",
                          borderBottom: "1px solid #eef2f7",
                        }}
                      >
                        <th style={{ padding: "12px 8px" }}>Ảnh</th>
                        <th style={{ padding: "12px 8px" }}>Tên</th>
                        <th style={{ padding: "12px 8px" }}>Giá</th>
                        <th style={{ padding: "12px 8px" }}>Hành động</th>
                      </tr>
                    </thead>
                    <tbody>
                      {services.map((s) => (
                        <ServiceSection
                          key={s.iddichVu}
                          service={s}
                          onEdit={startEdit}
                          onDelete={handleDelete}
                          onDetails={openDetails}
                          onEditModal={openDetailsForEdit}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            {/* Add/Edit modal */}
            {showModal && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(0,0,0,0.5)",
                  zIndex: 1000,
                }}
                onClick={() => setShowModal(false)}
              >
                <div
                  style={{
                    width: 800,
                    maxHeight: "90vh",
                    overflow: "auto",
                    background: "#fff",
                    borderRadius: 16,
                    boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
                    border: "2px solid #e5e7eb",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div
                    style={{
                      color: "white",
                      padding: "20px 24px",
                      borderTopLeftRadius: 14,
                      borderTopRightRadius: 14,
                    }}
                  >
                    <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>
                      {editing ? "🔧 Sửa dịch vụ" : "➕ Thêm dịch vụ mới"}
                    </h2>
                  </div>

                  {/* Content */}
                  <div style={{ padding: 24 }}>
                    <form onSubmit={handleModalSubmit}>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 16,
                        }}
                      >
                        <div>
                          <label
                            style={{
                              display: "block",
                              marginBottom: 6,
                              fontWeight: 600,
                            }}
                          >
                            Tên dịch vụ
                          </label>
                          <input
                            value={modalForm.tenDichVu ?? ""}
                            onChange={(e) =>
                              setModalForm({
                                ...modalForm,
                                tenDichVu: e.target.value,
                              })
                            }
                            style={{
                              width: "100%",
                              padding: 8,
                              borderRadius: 8,
                              border: "1px solid #e5e7eb",
                            }}
                          />
                        </div>
                        <div>
                          <label
                            style={{
                              display: "block",
                              marginBottom: 6,
                              fontWeight: 600,
                            }}
                          >
                            Giá (VNĐ)
                          </label>
                          <input
                            type="number"
                            step="1"
                            value={modalForm.tienDichVu ?? 0}
                            onChange={(e) =>
                              setModalForm({
                                ...modalForm,
                                tienDichVu: Number(e.target.value),
                              })
                            }
                            style={{
                              width: "100%",
                              padding: 8,
                              borderRadius: 8,
                              border: "1px solid #e5e7eb",
                            }}
                          />
                        </div>
                      </div>

                      <div style={{ marginTop: 16 }}>
                        <label
                          style={{
                            display: "block",
                            marginBottom: 6,
                            fontWeight: 600,
                          }}
                        >
                          🖼️ Ảnh dịch vụ
                        </label>
                        <div
                          style={{
                            display: "flex",
                            gap: 12,
                            alignItems: "flex-start",
                          }}
                        >
                          <div
                            style={{
                              width: 160,
                              height: 100,
                              borderRadius: 8,
                              overflow: "hidden",
                              background: "#f3f4f6",
                              flex: "0 0 160px",
                              border: "1px solid #e5e7eb",
                            }}
                          >
                            <img
                              src={
                                modalForm.hinhDichVu ??
                                "/img/service/default.webp"
                              }
                              alt="preview"
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                              }}
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                            {!modalForm.hinhDichVu && (
                              <div
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 48,
                                  color: "#9ca3af",
                                }}
                              >
                                🖼️
                              </div>
                            )}
                          </div>
                          <div style={{ flex: 1 }}>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file =
                                  e.target.files && e.target.files[0]
                                    ? e.target.files[0]
                                    : null;
                                setModalFile(file);
                                // Create preview URL for the selected file
                                if (file) {
                                  const previewUrl = URL.createObjectURL(file);
                                  setModalForm({
                                    ...modalForm,
                                    hinhDichVu: previewUrl,
                                  });
                                }
                              }}
                              style={{ marginBottom: 8, display: "block" }}
                            />
                            <div style={{ display: "flex", gap: 8 }}>
                              <input
                                placeholder="Hoặc dán URL ảnh"
                                value={imageUrlInput}
                                onChange={(e) =>
                                  setImageUrlInput(e.target.value)
                                }
                                style={{
                                  flex: 1,
                                  padding: 8,
                                  borderRadius: 8,
                                  border: "1px solid #d1d5db",
                                }}
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setModalForm((prev) => ({
                                    ...prev,
                                    hinhDichVu: imageUrlInput,
                                  }))
                                }
                                style={{
                                  padding: "8px 12px",
                                  borderRadius: 8,
                                  background: "#1e40af",
                                  color: "#fff",
                                  border: "none",
                                  cursor: "pointer",
                                  fontWeight: 600,
                                }}
                              >
                                Dùng URL
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Time and Status Fields */}
                      <div
                        style={{
                          marginTop: 16,
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr 1fr",
                          gap: 16,
                        }}
                      >
                        <div>
                          <label
                            style={{
                              display: "block",
                              marginBottom: 6,
                              fontWeight: 600,
                            }}
                          >
                            ⏰ Giờ bắt đầu
                          </label>
                          <input
                            type="time"
                            value={modalForm.thoiGianBatDau ?? "08:00:00"}
                            onChange={(e) =>
                              setModalForm({
                                ...modalForm,
                                thoiGianBatDau: e.target.value,
                              })
                            }
                            style={{
                              width: "100%",
                              padding: 8,
                              borderRadius: 8,
                              border: "1px solid #e5e7eb",
                            }}
                          />
                        </div>
                        <div>
                          <label
                            style={{
                              display: "block",
                              marginBottom: 6,
                              fontWeight: 600,
                            }}
                          >
                            ⏰ Giờ kết thúc
                          </label>
                          <input
                            type="time"
                            value={modalForm.thoiGianKetThuc ?? "22:00:00"}
                            onChange={(e) =>
                              setModalForm({
                                ...modalForm,
                                thoiGianKetThuc: e.target.value,
                              })
                            }
                            style={{
                              width: "100%",
                              padding: 8,
                              borderRadius: 8,
                              border: "1px solid #e5e7eb",
                            }}
                          />
                        </div>
                        <div>
                          <label
                            style={{
                              display: "block",
                              marginBottom: 6,
                              fontWeight: 600,
                            }}
                          >
                            ⏳ Trạng thái
                          </label>
                          <select
                            value={modalForm.trangThai ?? "Đang hoạt động"}
                            onChange={(e) =>
                              setModalForm({
                                ...modalForm,
                                trangThai: e.target.value,
                              })
                            }
                            style={{
                              width: "100%",
                              padding: 8,
                              borderRadius: 8,
                              border: "1px solid #e5e7eb",
                            }}
                          >
                            <option value="Đang hoạt động">
                              ✅ Đang hoạt động
                            </option>
                            <option value="Ngưng hoạt động">
                              🛑 Ngưng hoạt động
                            </option>
                          </select>
                        </div>
                      </div>

                      {/* TTDichVu Details Section */}
                      <div
                        style={{
                          marginTop: 24,
                          paddingTop: 20,
                          borderTop: "2px solid #e5e7eb",
                        }}
                      >
                        <h4
                          style={{
                            margin: "0 0 16px",
                            fontSize: 16,
                            fontWeight: 600,
                            color: "#1f2937",
                          }}
                        >
                          📋 Thông tin chi tiết dịch vụ
                        </h4>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 16,
                          }}
                        >
                          <div style={{ gridColumn: "1 / -1" }}>
                            <label
                              style={{
                                display: "block",
                                marginBottom: 6,
                                fontWeight: 600,
                              }}
                            >
                              Mô tả dịch vụ
                            </label>
                            <textarea
                              value={modalDetails.thongTinDv ?? ""}
                              onChange={(e) =>
                                setModalDetails({
                                  ...modalDetails,
                                  thongTinDv: e.target.value,
                                })
                              }
                              placeholder="Nhập mô tả chi tiết về dịch vụ..."
                              style={{
                                width: "100%",
                                padding: 8,
                                borderRadius: 8,
                                border: "1px solid #e5e7eb",
                                minHeight: 100,
                                fontFamily: "inherit",
                              }}
                            />
                          </div>

                          <div>
                            <label
                              style={{
                                display: "block",
                                marginBottom: 6,
                                fontWeight: 600,
                              }}
                            >
                              ⏱️ Thời lượng ước tính (phút)
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={modalDetails.thoiLuongUocTinh ?? 60}
                              onChange={(e) =>
                                setModalDetails({
                                  ...modalDetails,
                                  thoiLuongUocTinh: Number(e.target.value),
                                })
                              }
                              style={{
                                width: "100%",
                                padding: 8,
                                borderRadius: 8,
                                border: "1px solid #e5e7eb",
                              }}
                            />
                          </div>

                          <div>
                            <label
                              style={{
                                display: "block",
                                marginBottom: 6,
                                fontWeight: 600,
                              }}
                            >
                              📝 Ghi chú
                            </label>
                            <textarea
                              value={modalDetails.ghiChu ?? ""}
                              onChange={(e) =>
                                setModalDetails({
                                  ...modalDetails,
                                  ghiChu: e.target.value,
                                })
                              }
                              placeholder="Nhập ghi chú thêm (nếu có)..."
                              style={{
                                width: "100%",
                                padding: 8,
                                borderRadius: 8,
                                border: "1px solid #e5e7eb",
                                minHeight: 80,
                                fontFamily: "inherit",
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div
                        style={{
                          marginTop: 24,
                          display: "flex",
                          justifyContent: "flex-end",
                          gap: 12,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setShowModal(false);
                            setModalFile(null);
                            setEditing(null);
                          }}
                          style={{
                            padding: "10px 20px",
                            borderRadius: 8,
                            border: "1px solid #d1d5db",
                            background: "#fff",
                            color: "#6b7280",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          ✕ Hủy
                        </button>
                        <button
                          type="submit"
                          disabled={modalLoading}
                          style={{
                            padding: "10px 24px",
                            borderRadius: 8,
                            background:
                              "linear-gradient(135deg,#059669,#10b981)",
                            color: "#fff",
                            border: "none",
                            fontWeight: 700,
                            cursor: modalLoading ? "not-allowed" : "pointer",
                            opacity: modalLoading ? 0.7 : 1,
                          }}
                        >
                          {modalLoading
                            ? "⏳ Đang lưu..."
                            : editing
                            ? "💾 Cập nhật"
                            : "➕ Tạo mới"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            )}
            {/* Details modal */}
            {detailVisible && detailService && (
              <ServiceDetailModal
                service={detailService}
                details={serviceDetails}
                usage={serviceUsage}
                loading={loadingDetails}
                onClose={() => setDetailVisible(false)}
                onEdit={handleDetailEdit}
                onDelete={() => handleDelete(detailService.iddichVu)}
                initialEditMode={detailEditMode}
              />
            )}{" "}
          </div>
        </main>
      </div>
    </div>
  );
};

// ServiceDetailModal Component
interface ServiceDetailModalProps {
  service: Service;
  details: Service[];
  usage: ServiceUsage[];
  loading: boolean;
  onClose: () => void;
  onEdit: (updatedService: Service, isActive: boolean) => void;
  onDelete: () => void;
  initialEditMode?: boolean;
}

const ServiceDetailModal: React.FC<ServiceDetailModalProps> = ({
  service,
  details,
  usage,
  loading,
  onClose,
  onEdit,
  onDelete,
  initialEditMode = false,
}) => {
  const [activeTab, setActiveTab] = React.useState<"info" | "usage">("info");
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(initialEditMode);
  const [form, setForm] = React.useState<Service>(service);
  const [imageUrlInput, setImageUrlInput] = React.useState<string>(
    service.hinhDichVu ?? ""
  );
  const [imageFile, setImageFile] = React.useState<File | null>(null);
  const [isActive, setIsActive] = React.useState(
    service.trangThai !== "Ngưng hoạt động"
  );

  React.useEffect(() => {
    setForm(service);
    setImageUrlInput(service.hinhDichVu ?? "");
    setIsActive(service.trangThai !== "Ngưng hoạt động");
  }, [service]);

  // Calculate stats from usage data
  const usageCount = usage.length;
  const totalRevenue = usage.reduce((sum, u) => sum + (u.tienDichVu ?? 0), 0);

  const formatPrice = (v?: number | null) =>
    v ? new Intl.NumberFormat("vi-VN").format(v) : "—";
  const formatTime = (t?: string | null) =>
    t ? new Date(t).toLocaleString("vi-VN") : "—";

  const handleImageFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setForm((prev) => ({ ...prev, hinhDichVu: result }));
      setImageFile(file);
    };
    reader.readAsDataURL(file);
  };

  const ImageEditor = () => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
        Hình ảnh dịch vụ
      </label>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div
          style={{
            width: 160,
            height: 100,
            borderRadius: 8,
            overflow: "hidden",
            background: "#f3f4f6",
            flex: "0 0 160px",
          }}
        >
          <img
            src={form.hinhDichVu ?? "/img/service/default.webp"}
            alt="preview"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleImageFile(e.target.files?.[0])}
          />
          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            <input
              placeholder="Hoặc dán URL ảnh"
              value={imageUrlInput}
              onChange={(e) => setImageUrlInput(e.target.value)}
              style={{
                flex: 1,
                padding: 8,
                borderRadius: 8,
                border: "1px solid #d1d5db",
              }}
            />
            <button
              onClick={() =>
                setForm((prev) => ({ ...prev, hinhDichVu: imageUrlInput }))
              }
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                background: "#1e40af",
                color: "#fff",
                border: "none",
                cursor: "pointer",
              }}
            >
              Dùng URL
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.5)",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 900,
          maxHeight: "90vh",
          overflow: "auto",
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          border: "2px solid #e5e7eb",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
            color: "white",
            padding: "20px 24px",
            borderTopLeftRadius: 14,
            borderTopRightRadius: 14,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>
            Chi tiết dịch vụ
          </h2>
        </div>

        {/* Content */}
        <div style={{ padding: 24 }}>
          {!isEditing ? (
            <>
              {/* Service Image */}
              <div
                style={{
                  width: "100%",
                  height: 240,
                  borderRadius: 12,
                  overflow: "hidden",
                  marginBottom: 20,
                  border: "2px solid #e5e7eb",
                  backgroundColor: "#f3f4f6",
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {service.hinhDichVu ? (
                  <img
                    src={service.hinhDichVu}
                    alt={service.tenDichVu}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      objectPosition: "center",
                    }}
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : null}
                {!service.hinhDichVu && (
                  <div style={{ fontSize: 48, color: "#9ca3af" }}>🎯</div>
                )}
              </div>

              {/* Basic Info Display */}
              <div
                style={{
                  background: "#f8fafc",
                  padding: 20,
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  marginBottom: 20,
                }}
              >
                <div
                  style={{
                    borderBottom: "2px solid #e5e7eb",
                    paddingBottom: 16,
                    marginBottom: 16,
                    textAlign: "center",
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 22,
                      fontWeight: 700,
                      color: "#1f2937",
                    }}
                  >
                    💇 {service.tenDichVu}
                  </h3>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "12px 24px",
                    fontSize: 16,
                    lineHeight: 1.6,
                  }}
                >
                  <div>
                    <strong>Mã dịch vụ:</strong> {service.iddichVu ?? "—"}
                  </div>
                  <div>
                    <strong>Giá:</strong> {formatPrice(service.tienDichVu)} VNĐ
                  </div>
                  <div>
                    <strong>Khung giờ phục vụ:</strong>{" "}
                    {service.thoiGianBatDau || service.thoiGianKetThuc
                      ? `${service.thoiGianBatDau ?? "?"} – ${
                          service.thoiGianKetThuc ?? "?"
                        }`
                      : "—"}
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div style={{ marginBottom: 20 }}>
                <div
                  style={{
                    display: "flex",
                    gap: 0,
                    borderBottom: "2px solid #e5e7eb",
                  }}
                >
                  <button
                    onClick={() => setActiveTab("info")}
                    style={{
                      padding: "12px 24px",
                      background: activeTab === "info" ? "#fff" : "#f3f4f6",
                      border:
                        activeTab === "info"
                          ? "2px solid #1e40af"
                          : "2px solid transparent",
                      borderBottom:
                        activeTab === "info"
                          ? "2px solid #1e40af"
                          : "2px solid #e5e7eb",
                      color: activeTab === "info" ? "#1e40af" : "#6b7280",
                      fontWeight: activeTab === "info" ? 700 : 500,
                      cursor: "pointer",
                      fontSize: 16,
                      marginBottom: "-2px",
                    }}
                  >
                    📋 Thông tin chi tiết
                  </button>
                  <button
                    onClick={() => setActiveTab("usage")}
                    style={{
                      padding: "12px 24px",
                      background: activeTab === "usage" ? "#fff" : "#f3f4f6",
                      border:
                        activeTab === "usage"
                          ? "2px solid #1e40af"
                          : "2px solid transparent",
                      borderBottom:
                        activeTab === "usage"
                          ? "2px solid #1e40af"
                          : "2px solid #e5e7eb",
                      color: activeTab === "usage" ? "#1e40af" : "#6b7280",
                      fontWeight: activeTab === "usage" ? 700 : 500,
                      cursor: "pointer",
                      fontSize: 16,
                      marginBottom: "-2px",
                    }}
                  >
                    📊 Lịch sử sử dụng
                  </button>
                </div>
              </div>

              {/* Tab Content: Info */}
              {activeTab === "info" && (
                <div style={{ marginBottom: 20 }}>
                  {loading ? (
                    <div
                      style={{
                        padding: 20,
                        textAlign: "center",
                        color: "#6b7280",
                      }}
                    >
                      Đang tải...
                    </div>
                  ) : (
                    <>
                      {/* Details from TTDichVu */}
                      {console.log(
                        "[RENDER] Details tab - details array:",
                        details,
                        "length:",
                        details.length
                      )}
                      {details.length > 0 ? (
                        <div style={{ marginBottom: 20 }}>
                          <h4
                            style={{
                              fontSize: 16,
                              fontWeight: 600,
                              marginBottom: 12,
                              color: "#1f2937",
                            }}
                          >
                            🧩 Thông tin chi tiết dịch vụ
                          </h4>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr",
                              gap: 16,
                            }}
                          >
                            {details.map((d) => (
                              <div
                                key={d.idttdichVu}
                                style={{
                                  padding: 16,
                                  borderRadius: 8,
                                  border: "1px solid #e5e7eb",
                                  background: "#f9fafb",
                                }}
                              >
                                <div
                                  style={{
                                    fontWeight: 600,
                                    marginBottom: 8,
                                    color: "#1f2937",
                                  }}
                                >
                                  ID: {d.idttdichVu}
                                </div>
                                {d.thongTinDv && (
                                  <div
                                    style={{
                                      marginBottom: 8,
                                      color: "#6b7280",
                                      fontSize: 14,
                                    }}
                                  >
                                    <strong>Mô tả:</strong> {d.thongTinDv}
                                  </div>
                                )}
                                {d.thoiLuongUocTinh && (
                                  <div
                                    style={{
                                      marginBottom: 8,
                                      color: "#6b7280",
                                      fontSize: 14,
                                    }}
                                  >
                                    <strong>⏱️ Thời lượng:</strong>{" "}
                                    {d.thoiLuongUocTinh} phút
                                  </div>
                                )}
                                {d.ghiChu && (
                                  <div
                                    style={{ color: "#6b7280", fontSize: 14 }}
                                  >
                                    <strong>📝 Ghi chú:</strong> {d.ghiChu}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div
                          style={{
                            padding: 16,
                            borderRadius: 8,
                            background: "#f3f4f6",
                            color: "#6b7280",
                          }}
                        >
                          Chưa có thông tin chi tiết dịch vụ.
                        </div>
                      )}

                      {/* Activity Stats */}
                      <div style={{ marginTop: 20 }}>
                        <h4
                          style={{
                            fontSize: 16,
                            fontWeight: 600,
                            marginBottom: 12,
                            color: "#1f2937",
                          }}
                        >
                          📊 Thông tin hoạt động
                        </h4>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr 1fr",
                            gap: 16,
                          }}
                        >
                          <div
                            style={{
                              padding: 16,
                              borderRadius: 8,
                              background: "#f0f9ff",
                              border: "1px solid #bfdbfe",
                            }}
                          >
                            <div
                              style={{
                                fontSize: 14,
                                color: "#6b7280",
                                marginBottom: 8,
                              }}
                            >
                              Số lần sử dụng
                            </div>
                            <div
                              style={{
                                fontSize: 28,
                                fontWeight: 700,
                                color: "#1e40af",
                              }}
                            >
                              {usageCount}
                            </div>
                          </div>
                          <div
                            style={{
                              padding: 16,
                              borderRadius: 8,
                              background: "#f0fdf4",
                              border: "1px solid #bbf7d0",
                            }}
                          >
                            <div
                              style={{
                                fontSize: 14,
                                color: "#6b7280",
                                marginBottom: 8,
                              }}
                            >
                              Doanh thu
                            </div>
                            <div
                              style={{
                                fontSize: 24,
                                fontWeight: 700,
                                color: "#059669",
                              }}
                            >
                              {formatPrice(totalRevenue)}
                            </div>
                          </div>
                          <div
                            style={{
                              padding: 16,
                              borderRadius: 8,
                              background: "#fef3c7",
                              border: "1px solid #fcd34d",
                            }}
                          >
                            <div
                              style={{
                                fontSize: 14,
                                color: "#6b7280",
                                marginBottom: 8,
                              }}
                            >
                              Trạng thái
                            </div>
                            <div style={{ fontSize: 20 }}>
                              {service.trangThai &&
                              service.trangThai !== "Ngưng hoạt động"
                                ? "✅ Đang hoạt động"
                                : "🛑 Ngưng hoạt động"}
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Tab Content: Usage History */}
              {activeTab === "usage" && (
                <div style={{ marginBottom: 20 }}>
                  {loading ? (
                    <div
                      style={{
                        padding: 20,
                        textAlign: "center",
                        color: "#6b7280",
                      }}
                    >
                      Đang tải...
                    </div>
                  ) : usage.length > 0 ? (
                    <div style={{ overflowX: "auto" }}>
                      <table
                        style={{ width: "100%", borderCollapse: "collapse" }}
                      >
                        <thead>
                          <tr
                            style={{
                              textAlign: "left",
                              borderBottom: "2px solid #e5e7eb",
                              background: "#f3f4f6",
                            }}
                          >
                            <th style={{ padding: 12, fontWeight: 600 }}>
                              🏷️ ID Hóa đơn
                            </th>
                            <th style={{ padding: 12, fontWeight: 600 }}>
                              💰 Giá tiền
                            </th>
                            <th style={{ padding: 12, fontWeight: 600 }}>
                              📅 Thời gian thực hiện
                            </th>
                            <th style={{ padding: 12, fontWeight: 600 }}>
                              🕐 Từ - Đến
                            </th>
                            <th style={{ padding: 12, fontWeight: 600 }}>
                              📌 Trạng thái
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {usage.map((u, idx) => (
                            <tr
                              key={idx}
                              style={{
                                borderBottom: "1px solid #e5e7eb",
                                background: idx % 2 === 0 ? "#fff" : "#f9fafb",
                              }}
                            >
                              <td style={{ padding: 12 }}>
                                <span
                                  style={{
                                    background: "#f0f9ff",
                                    padding: "4px 8px",
                                    borderRadius: 4,
                                    fontSize: 13,
                                  }}
                                >
                                  {u.idhoaDon}
                                </span>
                              </td>
                              <td
                                style={{
                                  padding: 12,
                                  fontWeight: 600,
                                  color: "#059669",
                                }}
                              >
                                {formatPrice(u.tienDichVu)}
                              </td>
                              <td style={{ padding: 12, color: "#6b7280" }}>
                                {formatTime(u.thoiGianThucHien)}
                              </td>
                              <td
                                style={{
                                  padding: 12,
                                  color: "#6b7280",
                                  fontSize: 13,
                                }}
                              >
                                {u.thoiGianBatDau && u.thoiGianKetThuc
                                  ? `${u.thoiGianBatDau} – ${u.thoiGianKetThuc}`
                                  : "—"}
                              </td>
                              <td style={{ padding: 12 }}>
                                <span
                                  style={{
                                    background: u.trangThai?.includes("Chờ")
                                      ? "#fef3c7"
                                      : u.trangThai?.includes("Hoàn")
                                      ? "#f0fdf4"
                                      : "#f0f9ff",
                                    color: u.trangThai?.includes("Chờ")
                                      ? "#b45309"
                                      : u.trangThai?.includes("Hoàn")
                                      ? "#15803d"
                                      : "#1e40af",
                                    padding: "4px 8px",
                                    borderRadius: 4,
                                    fontSize: 13,
                                  }}
                                >
                                  {u.trangThai ?? "—"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: 16,
                        borderRadius: 8,
                        background: "#f3f4f6",
                        color: "#6b7280",
                      }}
                    >
                      Chưa có lịch sử sử dụng dịch vụ.
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            /* Edit Form */
            <div
              style={{
                background: "#fff",
                padding: 20,
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                marginBottom: 20,
              }}
            >
              <h4
                style={{
                  margin: "0 0 16px",
                  fontSize: 18,
                  fontWeight: 600,
                  color: "#1f2937",
                }}
              >
                Chỉnh sửa dịch vụ
              </h4>
              <ImageEditor />

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                  marginBottom: 16,
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontWeight: 600,
                      marginBottom: 4,
                    }}
                  >
                    Tên dịch vụ
                  </label>
                  <input
                    value={form.tenDichVu ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, tenDichVu: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #d1d5db",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontWeight: 600,
                      marginBottom: 4,
                    }}
                  >
                    Giá (VNĐ)
                  </label>
                  <input
                    type="number"
                    value={String(form.tienDichVu ?? "")}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        tienDichVu: Number(e.target.value) || 0,
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #d1d5db",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontWeight: 600,
                      marginBottom: 4,
                    }}
                  >
                    Giờ bắt đầu
                  </label>
                  <input
                    type="time"
                    value={form.thoiGianBatDau ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, thoiGianBatDau: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #d1d5db",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontWeight: 600,
                      marginBottom: 4,
                    }}
                  >
                    Giờ kết thúc
                  </label>
                  <input
                    type="time"
                    value={form.thoiGianKetThuc ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, thoiGianKetThuc: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #d1d5db",
                    }}
                  />
                </div>
              </div>

              {/* Detail Fields Section */}
              <div
                style={{
                  marginTop: 20,
                  padding: 16,
                  borderRadius: 8,
                  background: "#f9fafb",
                  border: "1px solid #e5e7eb",
                }}
              >
                <h5
                  style={{
                    margin: "0 0 16px",
                    fontSize: 16,
                    fontWeight: 600,
                    color: "#1f2937",
                  }}
                >
                  Thông tin chi tiết dịch vụ
                </h5>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                    marginBottom: 16,
                  }}
                >
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label
                      style={{
                        display: "block",
                        fontWeight: 600,
                        marginBottom: 4,
                      }}
                    >
                      Mô tả dịch vụ
                    </label>
                    <textarea
                      value={form.thongTinDv ?? ""}
                      onChange={(e) =>
                        setForm({ ...form, thongTinDv: e.target.value })
                      }
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "1px solid #d1d5db",
                        fontFamily: "inherit",
                        minHeight: 80,
                        resize: "vertical",
                      }}
                      placeholder="Nhập mô tả chi tiết về dịch vụ..."
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontWeight: 600,
                        marginBottom: 4,
                      }}
                    >
                      Thời lượng ước tính (phút)
                    </label>
                    <input
                      type="number"
                      value={String(form.thoiLuongUocTinh ?? "")}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          thoiLuongUocTinh: Number(e.target.value) || 0,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "1px solid #d1d5db",
                      }}
                      placeholder="60"
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontWeight: 600,
                        marginBottom: 4,
                      }}
                    >
                      Ghi chú
                    </label>
                    <input
                      type="text"
                      value={form.ghiChu ?? ""}
                      onChange={(e) =>
                        setForm({ ...form, ghiChu: e.target.value })
                      }
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "1px solid #d1d5db",
                      }}
                      placeholder="Ghi chú thêm nếu có..."
                    />
                  </div>
                </div>
              </div>

              {/* Status Toggle Section */}
              <div
                style={{
                  marginTop: 20,
                  padding: 16,
                  borderRadius: 8,
                  background: "#f0f9ff",
                  border: "1px solid #bfdbfe",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <h5
                      style={{
                        margin: "0 0 4px",
                        fontSize: 16,
                        fontWeight: 600,
                        color: "#1f2937",
                      }}
                    >
                      Trạng thái hoạt động
                    </h5>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 14,
                        color: "#6b7280",
                      }}
                    >
                      {isActive ? "✅ Đang hoạt động" : "🛑 Ngưng hoạt động"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsActive(!isActive)}
                    style={{
                      padding: "10px 20px",
                      borderRadius: 8,
                      border: "none",
                      background: isActive ? "#059669" : "#dc2626",
                      color: "#fff",
                      fontWeight: 600,
                      cursor: "pointer",
                      fontSize: 14,
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = "0.9";
                      e.currentTarget.style.boxShadow =
                        "0 4px 12px rgba(0,0,0,0.2)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = "1";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    {isActive ? "🔄 Chuyển ngưng" : "🔄 Bật lại"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete Confirmation Modal */}
          {showDeleteConfirm && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(0,0,0,0.4)",
                zIndex: 1100,
              }}
              onClick={() => setShowDeleteConfirm(false)}
            >
              <div
                style={{
                  width: 420,
                  background: "#fff",
                  borderRadius: 12,
                  padding: 24,
                  boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3
                  style={{
                    margin: "0 0 12px",
                    fontSize: 20,
                    fontWeight: 700,
                    color: "#1f2937",
                  }}
                >
                  Xác nhận xóa dịch vụ
                </h3>
                <p style={{ margin: "0 0 20px", color: "#6b7280" }}>
                  Bạn có chắc chắn muốn xóa dịch vụ{" "}
                  <strong>{service.tenDichVu}</strong>? Hành động này không thể
                  hoàn tác.
                </p>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 12,
                  }}
                >
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 8,
                      border: "1px solid #d1d5db",
                      background: "#f9fafb",
                      color: "#374151",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    ❌ Hủy
                  </button>
                  <button
                    onClick={() => {
                      onDelete();
                      setShowDeleteConfirm(false);
                      onClose();
                    }}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 8,
                      border: "none",
                      background: "#dc2626",
                      color: "#fff",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    🗑️ Xóa
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              paddingTop: 20,
              borderTop: "1px solid #e5e7eb",
            }}
          >
            <button
              onClick={onClose}
              style={{
                padding: "12px 24px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                background: "#f9fafb",
                color: "#374151",
                fontSize: 16,
                fontWeight: 500,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#f3f4f6";
                e.currentTarget.style.borderColor = "#9ca3af";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#f9fafb";
                e.currentTarget.style.borderColor = "#d1d5db";
              }}
            >
              ⬅️ Đóng
            </button>

            <div style={{ display: "flex", gap: 12 }}>
              {!isEditing ? (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    style={{
                      padding: "12px 24px",
                      borderRadius: 8,
                      border: "none",
                      background: "#1e40af",
                      color: "#fff",
                      fontSize: 16,
                      fontWeight: 500,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#1e3a8a";
                      e.currentTarget.style.boxShadow =
                        "0 4px 12px rgba(30, 64, 175, 0.4)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "#1e40af";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    ✏️ Chỉnh sửa
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    style={{
                      padding: "12px 24px",
                      borderRadius: 8,
                      border: "none",
                      background: "#dc2626",
                      color: "#fff",
                      fontSize: 16,
                      fontWeight: 500,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#b91c1c";
                      e.currentTarget.style.boxShadow =
                        "0 4px 12px rgba(220, 38, 38, 0.4)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "#dc2626";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    🗑️ Xóa
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setIsEditing(false)}
                    style={{
                      padding: "12px 24px",
                      borderRadius: 8,
                      border: "1px solid #d1d5db",
                      background: "#f9fafb",
                      color: "#374151",
                      fontSize: 16,
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    ❌ Hủy
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        // If user selected a file, upload it first and use returned fileName
                        if (imageFile) {
                          const uploadRes = await serviceApi.uploadServiceImage(
                            imageFile,
                            form.iddichVu,
                            form.tenDichVu
                          );
                          const fileName =
                            uploadRes?.fileName ?? imageFile.name;
                          setForm((prev) => ({
                            ...prev,
                            hinhDichVu: fileName,
                          }));
                          // ensure updated form is passed
                          await onEdit(
                            { ...form, hinhDichVu: fileName },
                            isActive
                          );
                        } else {
                          // If hinhDichVu is a data URL, we should not send it — try to detect
                          const v = form.hinhDichVu ?? "";
                          if (v.startsWith("data:") || v.startsWith("blob:")) {
                            // No file object but data URL present — attempt to strip and warn
                            alert(
                              "Vui lòng chọn ảnh rồi nhấn Lưu để tải ảnh lên."
                            );
                          } else {
                            await onEdit(form, isActive);
                          }
                        }
                      } catch (err) {
                        console.error(
                          "Error uploading image in detail modal",
                          err
                        );
                        alert("Lỗi khi tải ảnh lên");
                      } finally {
                        setIsEditing(false);
                        setImageFile(null);
                      }
                    }}
                    style={{
                      padding: "12px 24px",
                      borderRadius: 8,
                      border: "none",
                      background: "#059669",
                      color: "#fff",
                      fontSize: 16,
                      fontWeight: 500,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    💾 Lưu thay đổi
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServiceManager;
