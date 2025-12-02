import React, { useState, useEffect, useRef } from "react";
import { API_CONFIG } from "../../api/config";

const API_BASE = `${API_CONFIG.CURRENT}/api`;
import {
  Form,
  Input,
  Button,
  DatePicker,
  Select,
  InputNumber,
  Card,
  Space,
  // Transfer, (no longer used)
  message,
  Spin,
  Row,
  Col,
  Upload,
  Image,
  Modal,
} from "antd";
import { UploadOutlined, DeleteOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import {
  Promotion,
  CreatePromotionRequest,
  UpdatePromotionRequest,
  createPromotion,
  updatePromotion,
  uploadBanner,
  getPromotionById,
} from "../../api/promotionApi";

interface PromotionFormProps {
  promotion?: Promotion | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface Service {
  iddichVu: string;
  tenDichVu: string;
  gia: number;
}

const ServiceAssignPanel: React.FC<{
  selectedIds: string[];
  onToggle: (
    id: string,
    checked: boolean,
    service?: { id: string; name: string; price: number }
  ) => void;
}> = ({ selectedIds, onToggle }) => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        // backend route is `api/dich-vu/lay-danh-sach`
        const res = await fetch(`${API_BASE}/dich-vu/lay-danh-sach`);
        const data = await res.json();
        // Map TienDichVu from API to gia field expected by frontend
        const mappedData = (data || []).map((item: any) => ({
          iddichVu: item.iddichVu || item.IddichVu,
          tenDichVu: item.tenDichVu || item.TenDichVu,
          gia: item.tienDichVu || item.TienDichVu || 0,
        }));
        setServices(mappedData);
      } catch (err) {
        console.error("Error loading services", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (loading) return <Spin />;

  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}
    >
      {services.map((s) => (
        <div
          key={s.iddichVu}
          style={{ border: "1px solid #eee", borderRadius: 8, padding: 8 }}
        >
          <div style={{ fontWeight: 700 }}>{s.tenDichVu}</div>
          <div style={{ color: "#666", marginBottom: 8 }}>{s.iddichVu}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={selectedIds.includes(s.iddichVu)}
                onChange={(e) =>
                  onToggle(s.iddichVu, e.target.checked, {
                    id: s.iddichVu,
                    name: s.tenDichVu,
                    price: s.gia || 0,
                  })
                }
              />
              <span style={{ fontSize: 13 }}>Gán dịch vụ</span>
            </label>
            <div style={{ marginLeft: "auto", color: "#333", fontWeight: 600 }}>
              {(s.gia || 0).toLocaleString("vi-VN")} ₫
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const PromotionForm: React.FC<PromotionFormProps> = ({
  promotion,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);
  // Track promotion ID to avoid re-fetching on object reference change
  const promotionIdRef = useRef<string | undefined>(undefined);
  // Track if rooms already loaded to prevent double-fetch in Strict Mode
  const roomsLoadedRef = useRef(false);
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [roomObjects, setRoomObjects] = useState<any[]>([]);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [bannerImage, setBannerImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  // State cho combo: lưu danh sách dịch vụ với giá để tính tổng
  const [comboServices, setComboServices] = useState<
    { id: string; name: string; price: number }[]
  >([]);

  // Load rooms from API - only once
  useEffect(() => {
    const controller = new AbortController();

    const loadRooms = async () => {
      try {
        setLoadingRooms(true);
        const response = await fetch(`${API_BASE}/Phong`);
        // const response = await fetch("/api/Phong", { signal: controller.signal });
        if (!response.ok) throw new Error("Failed to fetch rooms");
        const data = await response.json();
        setRoomObjects(data);
        roomsLoadedRef.current = true;
      } catch (error: any) {
        if (error.name !== "AbortError") {
          console.error("[PROMOTION_FORM] Error loading rooms:", error);
          message.error("Lỗi khi tải danh sách phòng");
        }
      } finally {
        setLoadingRooms(false);
      }
    };

    // Only load if not already loaded
    if (!roomsLoadedRef.current) {
      loadRooms();
    }

    return () => controller.abort();
  }, []);

  // Populate form and selected IDs in Edit mode
  useEffect(() => {
    // Only proceed if promotion ID changed
    if (promotion?.idkhuyenMai === promotionIdRef.current) {
      return; // Same promotion, no need to reload
    }

    if (promotion) {
      promotionIdRef.current = promotion.idkhuyenMai;
      // Edit mode: populate form with promotion data
      form.setFieldsValue({
        tenKhuyenMai: promotion.tenKhuyenMai,
        loaiKhuyenMai: (promotion as any).loaiKhuyenMai || "room",
        moTa: promotion.moTa,
        loaiGiamGia: promotion.loaiGiamGia,
        giaTriGiam: promotion.giaTriGiam,
        ngayBatDau: dayjs(promotion.ngayBatDau),
        ngayKetThuc: dayjs(promotion.ngayKetThuc),
        trangThai: promotion.trangThai,
      });

      // Try to load canonical promotion details to ensure khuyenMaiDichVus and combos are present
      (async () => {
        try {
          const full = await getPromotionById(promotion.idkhuyenMai);
          const promoType = (full as any).loaiKhuyenMai;

          if (promoType === "service") {
            // Loại 'service': ID dịch vụ được lưu vào selectedRooms
            const svcIds =
              (full as any).khuyenMaiDichVus?.map(
                (m: any) => m.iddichVu || m.IddichVu
              ) || [];
            setSelectedRooms(svcIds);
            setSelectedServiceIds([]);
            setComboServices([]);
          } else if (promoType === "combo") {
            // Loại 'combo': Load combo dịch vụ và giá từ khuyenMaiCombos
            const selectedPhongIds =
              full.khuyenMaiPhongs?.map(
                (kmp: any) => kmp.idphong || kmp.Idphong
              ) || [];
            setSelectedRooms(selectedPhongIds);

            // Extract service IDs and prices from combos
            const combos = (full as any).khuyenMaiCombos || [];
            const allComboItems: any[] = [];
            combos.forEach((c: any) => {
              const items =
                c.khuyenMaiComboDichVus || c.KhuyenMaiComboDichVus || [];
              items.forEach((it: any) => {
                if (
                  !allComboItems.find(
                    (x) => x.id === (it.iddichVu || it.IddichVu)
                  )
                ) {
                  allComboItems.push({
                    id: it.iddichVu || it.IddichVu || it.id || "",
                    name: it.tenDichVu || it.TenDichVu || it.ten || "",
                    price: it.gia || it.Gia || 0,
                  });
                }
              });
            });

            // If prices are missing, fetch from service API
            const itemsWithoutPrice = allComboItems.filter(
              (item) => !item.price || item.price === 0
            );
            if (itemsWithoutPrice.length > 0) {
              try {
                const res = await fetch("/api/dich-vu/lay-danh-sach");
                const allServices = await res.json();
                itemsWithoutPrice.forEach((item) => {
                  const svc = allServices.find(
                    (s: any) => (s.iddichVu || s.IddichVu) === item.id
                  );
                  if (svc) {
                    item.price = svc.tienDichVu || svc.TienDichVu || 0;
                    if (!item.name)
                      item.name = svc.tenDichVu || svc.TenDichVu || item.id;
                  }
                });
              } catch (err) {
                console.error("Error fetching service prices", err);
              }
            }

            setSelectedServiceIds(allComboItems.map((x) => x.id));
            setComboServices(allComboItems);
          }
          // Set banner image from canonical data
          setBannerImage(full.hinhAnhBanner || null);
        } catch (err) {
          console.error("Error loading promotion details for edit", err);
          // Fallback to whatever was passed in if fetch fails
          const promoType = (promotion as any).loaiKhuyenMai;

          if (promoType === "service") {
            const svcIds =
              (promotion as any).khuyenMaiDichVus?.map(
                (m: any) => m.iddichVu || m.IddichVu
              ) || [];
            setSelectedRooms(svcIds);
            setSelectedServiceIds([]);
            setComboServices([]);
          } else if (promoType === "combo") {
            const selectedPhongIds =
              promotion.khuyenMaiPhongs?.map(
                (kmp: any) => kmp.idphong || kmp.Idphong
              ) || [];
            const combos = (promotion as any).khuyenMaiCombos || [];
            const allComboItems: any[] = [];
            combos.forEach((c: any) => {
              const items =
                c.khuyenMaiComboDichVus || c.KhuyenMaiComboDichVus || [];
              items.forEach((it: any) => {
                if (
                  !allComboItems.find(
                    (x) => x.id === (it.iddichVu || it.IddichVu)
                  )
                ) {
                  allComboItems.push({
                    id: it.iddichVu || it.IddichVu || it.id || "",
                    name: it.tenDichVu || it.TenDichVu || it.ten || "",
                    price: it.gia || it.Gia || 0,
                  });
                }
              });
            });

            // If prices are missing, fetch from service API (fallback case)
            const itemsWithoutPrice = allComboItems.filter(
              (item) => !item.price || item.price === 0
            );
            if (itemsWithoutPrice.length > 0) {
              try {
                const res = await fetch("/api/dich-vu/lay-danh-sach");
                const allServices = await res.json();
                itemsWithoutPrice.forEach((item) => {
                  const svc = allServices.find(
                    (s: any) => (s.iddichVu || s.IddichVu) === item.id
                  );
                  if (svc) {
                    item.price = svc.tienDichVu || svc.TienDichVu || 0;
                    if (!item.name)
                      item.name = svc.tenDichVu || svc.TenDichVu || item.id;
                  }
                });
              } catch (err) {
                console.error("Error fetching service prices (fallback)", err);
              }
            }

            setSelectedRooms(selectedPhongIds);
            setSelectedServiceIds(allComboItems.map((x) => x.id));
            setComboServices(allComboItems);
          }
          setBannerImage(promotion.hinhAnhBanner || null);
        }
      })();
    } else {
      // Create mode: reset form and ref
      promotionIdRef.current = undefined;
      form.resetFields();
      setSelectedRooms([]);
      setSelectedServiceIds([]);
      setBannerImage(null);
    }
  }, [promotion]);

  const handleSubmit = async (values: any) => {
    try {
      setLoading(true);

      const base = {
        tenKhuyenMai: values.tenKhuyenMai,
        loaiKhuyenMai: values.loaiKhuyenMai || "room",
        moTa: values.moTa,
        loaiGiamGia: values.loaiGiamGia,
        giaTriGiam: values.giaTriGiam,
        ngayBatDau: values.ngayBatDau.format("YYYY-MM-DD"),
        ngayKetThuc: values.ngayKetThuc.format("YYYY-MM-DD"),
        hinhAnhBanner: bannerImage,
        ...(promotion && {
          trangThai: values.trangThai || promotion.trangThai,
        }),
      };

      const payload: any = { ...base };
      const promoType = values.loaiKhuyenMai || "room";

      if (promoType === "service") {
        // Loại 'service': selectedRooms đang chứa ID Dịch vụ
        payload.dichVuIds = selectedRooms;
      } else if (promoType === "combo") {
        // Loại 'combo': gửi cả phòng và dịch vụ
        payload.phongIds = selectedRooms;
        payload.dichVuIds = selectedServiceIds;
      } else {
        // Loại 'room': selectedRooms chứa ID Phòng
        payload.phongIds = selectedRooms;
      }

      if (promotion) {
        // Update
        await updatePromotion(promotion.idkhuyenMai, {
          ...payload,
          trangThai: values.trangThai || promotion.trangThai || "active",
        } as UpdatePromotionRequest);
        message.success("Cập nhật khuyến mãi thành công");
      } else {
        // Create
        await createPromotion(payload as CreatePromotionRequest);
        message.success("Tạo khuyến mãi thành công");
      }

      onSuccess();
    } catch (error) {
      console.error("[PROMOTION_FORM] Error submitting:", error);
      message.error(
        `Lỗi: ${error instanceof Error ? error.message : "Lỗi không xác định"}`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleUploadBanner = async (file: File) => {
    try {
      setUploading(true);
      const result = await uploadBanner(file);
      // store the backend relative path (e.g. "/img/promotion/xxx.jpg") so
      // the server-side rename logic can locate the file and the DB stores
      // the correct path
      setBannerImage(result.relativePath || result.fileName);
      message.success("Upload banner thành công");
      return false; // Prevent default upload behavior
    } catch (error) {
      console.error("[PROMOTION_FORM] Error uploading banner:", error);
      message.error(
        `Lỗi upload: ${
          error instanceof Error ? error.message : "Lỗi không xác định"
        }`
      );
      return false;
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveBanner = () => {
    setBannerImage(null);
    message.success("Đã xóa banner");
  };

  return (
    <Card
      title={promotion ? "Chỉnh sửa khuyến mãi" : "Tạo khuyến mãi mới"}
      extra={
        <Button onClick={onClose} disabled={loading}>
          Đóng
        </Button>
      }
    >
      <Spin spinning={loading || loadingRooms}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          autoComplete="off"
        >
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Tên Khuyến Mãi"
                name="tenKhuyenMai"
                rules={[
                  { required: true, message: "Vui lòng nhập tên khuyến mãi" },
                  { min: 3, message: "Tên phải có ít nhất 3 ký tự" },
                ]}
              >
                <Input placeholder="Nhập tên khuyến mãi" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label="Loại Giảm Giá"
                name="loaiGiamGia"
                rules={[
                  { required: true, message: "Vui lòng chọn loại giảm giá" },
                ]}
              >
                <Select
                  placeholder="Chọn loại giảm giá"
                  options={[
                    { label: "% Giảm", value: "percent" },
                    { label: "Giảm Tiền", value: "amount" },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Loại Khuyến Mãi"
                name="loaiKhuyenMai"
                initialValue={"room"}
              >
                <Select
                  options={[
                    { label: "Phòng", value: "room" },
                    { label: "Dịch Vụ", value: "service" },
                    { label: "Combo Dịch Vụ", value: "combo" },
                    { label: "Khách Hàng", value: "customer" },
                  ]}
                  onChange={() => {
                    // Only reset when creating new promotion, not when editing
                    if (!promotion) {
                      setSelectedRooms([]);
                      setSelectedServiceIds([]);
                      setComboServices([]);
                    }
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                noStyle
                shouldUpdate={(prev, cur) =>
                  prev.loaiKhuyenMai !== cur.loaiKhuyenMai
                }
              >
                {({ getFieldValue }) => {
                  const loai = getFieldValue("loaiKhuyenMai");
                  let helpText = "";
                  if (loai === "combo") {
                    helpText =
                      "💡 Combo: Khách mua TẤT CẢ các dịch vụ trong combo mới được giảm giá";
                  } else if (loai === "service") {
                    helpText = "💡 Dịch vụ: Giảm giá cho từng dịch vụ đơn lẻ";
                  } else if (loai === "room") {
                    helpText = "💡 Phòng: Giảm giá cho từng phòng riêng lẻ";
                  }
                  return helpText ? (
                    <div
                      style={{
                        marginTop: -8,
                        padding: "8px 12px",
                        background: "#f0f7ff",
                        border: "1px solid #d6e9ff",
                        borderRadius: 6,
                        fontSize: 13,
                        color: "#0066cc",
                      }}
                    >
                      {helpText}
                    </div>
                  ) : null;
                }}
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                label="Giá Trị Giảm"
                name="giaTriGiam"
                rules={[
                  { required: true, message: "Vui lòng nhập giá trị giảm" },
                  { type: "number", min: 0, message: "Giá trị phải lớn hơn 0" },
                ]}
              >
                <InputNumber
                  min={0}
                  placeholder="Nhập giá trị giảm"
                  step={0.01}
                  style={{ width: "100%" }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                label="Ngày Bắt Đầu"
                name="ngayBatDau"
                rules={[
                  { required: true, message: "Vui lòng chọn ngày bắt đầu" },
                ]}
              >
                <DatePicker format="DD/MM/YYYY" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                label="Ngày Kết Thúc"
                name="ngayKetThuc"
                rules={[
                  { required: true, message: "Vui lòng chọn ngày kết thúc" },
                ]}
              >
                <DatePicker format="DD/MM/YYYY" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="Mô Tả"
            name="moTa"
            rules={[{ max: 500, message: "Mô tả không vượt quá 500 ký tự" }]}
          >
            <Input.TextArea
              rows={3}
              placeholder="Nhập mô tả khuyến mãi (tùy chọn)"
              maxLength={500}
              showCount
            />
          </Form.Item>

          <Form.Item label="Hình Ảnh Banner">
            <Space direction="vertical" style={{ width: "100%" }}>
              <Upload
                accept="image/*"
                beforeUpload={handleUploadBanner}
                showUploadList={false}
                disabled={uploading}
              >
                <Button icon={<UploadOutlined />} loading={uploading}>
                  {uploading ? "Đang upload..." : "Chọn hình ảnh banner"}
                </Button>
              </Upload>

              {bannerImage && (
                <div style={{ position: "relative", display: "inline-block" }}>
                  <Image
                    // bannerImage may already be a relative path returned from backend
                    src={
                      bannerImage.startsWith("/")
                        ? bannerImage
                        : `/img/promotion/${bannerImage}`
                    }
                    alt="Banner preview"
                    style={{
                      maxWidth: "300px",
                      maxHeight: "150px",
                      objectFit: "cover",
                    }}
                    fallback="/img/placeholder.png"
                  />
                  <Button
                    type="primary"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={handleRemoveBanner}
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                    }}
                  >
                    Xóa
                  </Button>
                </div>
              )}
            </Space>
          </Form.Item>

          {promotion && (
            <Form.Item
              label="Trạng Thái"
              name="trangThai"
              initialValue={promotion.trangThai}
            >
              <Select
                disabled={promotion.trangThai === "expired"}
                options={[
                  { label: "Đang Hoạt Động", value: "active" },
                  { label: "Tạm Ngưng", value: "inactive" },
                  { label: "Hết Hạn", value: "expired", disabled: true },
                ]}
              />
            </Form.Item>
          )}

          {/* Assignment area: either rooms or services depending on promotion type */}
          <Form.Item label="Gán Áp Dụng">
            <div>
              <Form.Item
                noStyle
                shouldUpdate={(prev, cur) =>
                  prev.loaiKhuyenMai !== cur.loaiKhuyenMai
                }
              >
                {({ getFieldValue }) => {
                  const promoType = getFieldValue("loaiKhuyenMai");
                  return (
                    <div>
                      {promoType === "service" ? (
                        <Button onClick={() => setAssignModalVisible(true)}>
                          Gán Dịch Vụ
                        </Button>
                      ) : promoType === "combo" ? (
                        <Button onClick={() => setAssignModalVisible(true)}>
                          Gán Combo Dịch Vụ
                        </Button>
                      ) : (
                        <Button onClick={() => setAssignModalVisible(true)}>
                          Gán Phòng
                        </Button>
                      )}
                    </div>
                  );
                }}
              </Form.Item>

              {/* Assigned rooms list */}
              <div style={{ marginTop: 12 }}>
                {selectedRooms.length === 0 &&
                selectedServiceIds.length === 0 ? (
                  <div style={{ color: "#888" }}>Chưa có mục nào được gán</div>
                ) : (
                  <div>
                    <Form.Item
                      noStyle
                      shouldUpdate={(prev, cur) =>
                        prev.loaiKhuyenMai !== cur.loaiKhuyenMai
                      }
                    >
                      {({ getFieldValue }) => {
                        const promoType = getFieldValue("loaiKhuyenMai");
                        const isServiceType = promoType === "service";

                        return (
                          <>
                            {selectedRooms.length > 0 && (
                              <div style={{ marginBottom: 8 }}>
                                <div
                                  style={{
                                    fontWeight: 600,
                                    marginBottom: 4,
                                    color: "#666",
                                  }}
                                >
                                  {isServiceType
                                    ? "Dịch vụ đã chọn:"
                                    : "Phòng đã chọn:"}
                                </div>
                                <div
                                  style={{
                                    display: "flex",
                                    gap: 8,
                                    flexWrap: "wrap",
                                    alignItems: "center",
                                  }}
                                >
                                  {selectedRooms.map((id) => (
                                    <div
                                      key={id}
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 8,
                                        padding: "6px 10px",
                                        border: isServiceType
                                          ? "1px solid #1890ff"
                                          : "1px solid #e6e6e6",
                                        borderRadius: 20,
                                        background: isServiceType
                                          ? "#e6f7ff"
                                          : "#fff",
                                      }}
                                    >
                                      <div
                                        style={{
                                          fontWeight: 700,
                                          color: isServiceType
                                            ? "#1890ff"
                                            : "#000",
                                        }}
                                      >
                                        {id}
                                      </div>
                                      <Button
                                        size="small"
                                        danger
                                        onClick={() =>
                                          setSelectedRooms((s) =>
                                            s.filter((x) => x !== id)
                                          )
                                        }
                                      >
                                        X
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {promoType === "combo" &&
                              selectedServiceIds.length > 0 && (
                                <div>
                                  <div
                                    style={{
                                      fontWeight: 600,
                                      marginBottom: 4,
                                      color: "#666",
                                    }}
                                  >
                                    {promoType === "combo"
                                      ? "Dịch vụ trong Combo:"
                                      : "Dịch vụ đã chọn (trong gói):"}
                                  </div>
                                  <div
                                    style={{
                                      display: "flex",
                                      gap: 8,
                                      flexWrap: "wrap",
                                      alignItems: "center",
                                    }}
                                  >
                                    {selectedServiceIds.map((id) => {
                                      const service = comboServices.find(
                                        (s) => s.id === id
                                      );
                                      return (
                                        <div
                                          key={id}
                                          style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: 8,
                                            padding: "6px 10px",
                                            border: "1px solid #1890ff",
                                            borderRadius: 20,
                                            background: "#e6f7ff",
                                          }}
                                        >
                                          <div
                                            style={{
                                              fontWeight: 700,
                                              color: "#1890ff",
                                            }}
                                          >
                                            {service?.name || id}
                                            {service &&
                                              promoType === "combo" && (
                                                <span
                                                  style={{
                                                    marginLeft: 6,
                                                    fontSize: 12,
                                                    fontWeight: 400,
                                                  }}
                                                >
                                                  (
                                                  {service.price.toLocaleString(
                                                    "vi-VN"
                                                  )}{" "}
                                                  ₫)
                                                </span>
                                              )}
                                          </div>
                                          <Button
                                            size="small"
                                            danger
                                            onClick={() => {
                                              setSelectedServiceIds((s) =>
                                                s.filter((x) => x !== id)
                                              );
                                              setComboServices((prev) =>
                                                prev.filter((x) => x.id !== id)
                                              );
                                            }}
                                          >
                                            X
                                          </Button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                  {promoType === "combo" &&
                                    comboServices.length > 0 && (
                                      <div>
                                        <div
                                          style={{
                                            marginTop: 12,
                                            padding: 12,
                                            background: "#f0f7ff",
                                            borderRadius: 8,
                                            fontSize: 14,
                                          }}
                                        >
                                          <div
                                            style={{
                                              fontWeight: 700,
                                              color: "#0066cc",
                                            }}
                                          >
                                            {(() => {
                                              const total =
                                                comboServices.reduce(
                                                  (sum, s) => sum + s.price,
                                                  0
                                                );
                                              const discount =
                                                form.getFieldValue(
                                                  "giaTriGiam"
                                                ) || 0;
                                              const type =
                                                form.getFieldValue(
                                                  "loaiGiamGia"
                                                );
                                              const final =
                                                type === "percent"
                                                  ? total * (1 - discount / 100)
                                                  : total - discount;
                                              return `💰 Tổng tiền combo: ${Math.max(
                                                0,
                                                Math.round(final)
                                              ).toLocaleString("vi-VN")} ₫`;
                                            })()}
                                          </div>
                                        </div>
                                        <div
                                          style={{
                                            display: "flex",
                                            gap: 8,
                                            flexWrap: "wrap",
                                            alignItems: "center",
                                          }}
                                        >
                                          {selectedServiceIds.map((id) => {
                                            const service = comboServices.find(
                                              (s) => s.id === id
                                            );
                                            return (
                                              <div
                                                key={id}
                                                style={{
                                                  display: "inline-flex",
                                                  alignItems: "center",
                                                  gap: 8,
                                                  padding: "6px 10px",
                                                  border: "1px solid #1890ff",
                                                  borderRadius: 20,
                                                  background: "#e6f7ff",
                                                }}
                                              >
                                                <div
                                                  style={{
                                                    fontWeight: 700,
                                                    color: "#1890ff",
                                                  }}
                                                >
                                                  {service?.name || id}
                                                  {service &&
                                                    promoType === "combo" && (
                                                      <span
                                                        style={{
                                                          marginLeft: 6,
                                                          fontSize: 12,
                                                          fontWeight: 400,
                                                        }}
                                                      >
                                                        (
                                                        {service.price.toLocaleString(
                                                          "vi-VN"
                                                        )}{" "}
                                                        ₫)
                                                      </span>
                                                    )}
                                                </div>
                                                <Button
                                                  size="small"
                                                  danger
                                                  onClick={() => {
                                                    setSelectedServiceIds((s) =>
                                                      s.filter((x) => x !== id)
                                                    );
                                                    setComboServices((prev) =>
                                                      prev.filter(
                                                        (x) => x.id !== id
                                                      )
                                                    );
                                                  }}
                                                >
                                                  X
                                                </Button>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                </div>
                              )}
                          </>
                        );
                      }}
                    </Form.Item>
                  </div>
                )}
              </div>

              <Modal
                title={
                  form.getFieldValue("loaiKhuyenMai") === "service"
                    ? "Gán Dịch Vụ cho Khuyến Mãi"
                    : form.getFieldValue("loaiKhuyenMai") === "combo"
                    ? "Gán Phòng & Dịch Vụ cho Combo/Gói"
                    : "Gán Phòng cho Khuyến Mãi"
                }
                open={assignModalVisible}
                onCancel={() => setAssignModalVisible(false)}
                footer={null}
                width={900}
              >
                {form.getFieldValue("loaiKhuyenMai") === "service" ? (
                  // Gán Dịch vụ cho selectedRooms
                  <ServiceAssignPanel
                    selectedIds={selectedRooms}
                    onToggle={(id: string, checked: boolean) => {
                      if (checked)
                        setSelectedRooms((s) =>
                          s.includes(id) ? s : [...s, id]
                        );
                      else setSelectedRooms((s) => s.filter((x) => x !== id));
                    }}
                  />
                ) : form.getFieldValue("loaiKhuyenMai") === "combo" ? (
                  // Combo Dịch Vụ: Chỉ chọn 2-3 dịch vụ, tính tổng tiền
                  <div>
                    <h3 style={{ marginBottom: 12 }}>
                      Chọn Dịch Vụ cho Combo (2-3 dịch vụ)
                    </h3>
                    <ServiceAssignPanel
                      selectedIds={selectedServiceIds}
                      onToggle={(id: string, checked: boolean, service) => {
                        if (checked && service) {
                          setSelectedServiceIds((s) =>
                            s.includes(id) ? s : [...s, id]
                          );
                          setComboServices((prev) => [
                            ...prev.filter((x) => x.id !== id),
                            service,
                          ]);
                        } else {
                          setSelectedServiceIds((s) =>
                            s.filter((x) => x !== id)
                          );
                          setComboServices((prev) =>
                            prev.filter((x) => x.id !== id)
                          );
                        }
                      }}
                    />
                    {selectedServiceIds.length > 0 && (
                      <div
                        style={{
                          marginTop: 16,
                          padding: 16,
                          background: "#f0f7ff",
                          borderRadius: 8,
                          border: "1px solid #d6e9ff",
                        }}
                      >
                        <h4 style={{ margin: "0 0 12px 0", color: "#0066cc" }}>
                          🎁 Thông tin Combo
                        </h4>
                        <div style={{ marginBottom: 8 }}>
                          <strong>Các dịch vụ đã chọn:</strong>
                          {comboServices.map((s) => (
                            <div
                              key={s.id}
                              style={{ marginLeft: 16, fontSize: 14 }}
                            >
                              • {s.name}:{" "}
                              <span style={{ fontWeight: 600 }}>
                                {s.price.toLocaleString("vi-VN")} ₫
                              </span>
                            </div>
                          ))}
                        </div>
                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: 700,
                            marginTop: 12,
                            paddingTop: 12,
                            borderTop: "1px solid #b3d9ff",
                          }}
                        >
                          Tổng tiền combo:{" "}
                          <span style={{ color: "#333" }}>
                            {comboServices
                              .reduce((sum, s) => sum + s.price, 0)
                              .toLocaleString("vi-VN")}{" "}
                            ₫
                          </span>
                        </div>
                        {form.getFieldValue("loaiGiamGia") &&
                          form.getFieldValue("giaTriGiam") && (
                            <div
                              style={{
                                fontSize: 16,
                                fontWeight: 700,
                                color: "#d9534f",
                                marginTop: 8,
                              }}
                            >
                              Giá sau giảm:{" "}
                              {(() => {
                                const total = comboServices.reduce(
                                  (sum, s) => sum + s.price,
                                  0
                                );
                                const discount =
                                  form.getFieldValue("giaTriGiam") || 0;
                                const type = form.getFieldValue("loaiGiamGia");
                                const final =
                                  type === "percent"
                                    ? total * (1 - discount / 100)
                                    : total - discount;
                                return Math.max(0, final).toLocaleString(
                                  "vi-VN"
                                );
                              })()}{" "}
                              ₫
                            </div>
                          )}
                      </div>
                    )}
                  </div>
                ) : (
                  // Gán Phòng cho selectedRooms
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4,1fr)",
                      gap: 12,
                    }}
                  >
                    {roomObjects.map((r) => (
                      <div
                        key={r.idphong}
                        style={{
                          border: "1px solid #eee",
                          borderRadius: 8,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: 120,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            backgroundImage: `url(${
                              (r?.urlAnhPhong &&
                                (r.urlAnhPhong.startsWith("http")
                                  ? r.urlAnhPhong
                                  : `/img/room/${r.urlAnhPhong}`)) ||
                              "/img/placeholder.png"
                            })`,
                          }}
                        />
                        <div style={{ padding: 8 }}>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>
                            {r.tenPhong}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: "#666",
                              marginBottom: 8,
                            }}
                          >
                            {r.idphong}
                          </div>
                          <div>
                            <label
                              style={{
                                display: "flex",
                                gap: 8,
                                alignItems: "center",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={selectedRooms.includes(r.idphong)}
                                onChange={(e) => {
                                  if (e.target.checked)
                                    setSelectedRooms((s) =>
                                      s.includes(r.idphong)
                                        ? s
                                        : [...s, r.idphong]
                                    );
                                  else
                                    setSelectedRooms((s) =>
                                      s.filter((x) => x !== r.idphong)
                                    );
                                }}
                              />
                              <span style={{ fontSize: 13 }}>Gán phòng</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: 12, textAlign: "right" }}>
                  <Button onClick={() => setAssignModalVisible(false)}>
                    Hoàn tất
                  </Button>
                </div>
              </Modal>
            </div>
          </Form.Item>

          <Space>
            <Button type="primary" htmlType="submit" loading={loading}>
              {promotion ? "Cập nhật" : "Tạo mới"}
            </Button>
            <Button onClick={onClose} disabled={loading}>
              Hủy
            </Button>
          </Space>
        </Form>
      </Spin>
    </Card>
  );
};

export default PromotionForm;
