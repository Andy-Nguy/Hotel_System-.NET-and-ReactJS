import React, { useState, useEffect } from "react";

// Resolve API base from Vite env
const _VITE_API = (import.meta as any).env?.VITE_API_URL || "";
const API_BASE = _VITE_API.replace(/\/$/, "")
  ? `${_VITE_API.replace(/\/$/, "")}/api`
  : "/api";
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

interface Room {
  key: string;
  title: string;
}

interface Service {
  iddichVu: string;
  tenDichVu: string;
  gia: number;
}

const ServiceAssignPanel: React.FC<{
  selectedIds: string[];
  onToggle: (id: string, checked: boolean) => void;
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
        setServices(data || []);
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
                onChange={(e) => onToggle(s.iddichVu, e.target.checked)}
              />
              <span style={{ fontSize: 13 }}>Gán dịch vụ</span>
            </label>
            <div style={{ marginLeft: "auto", color: "#333" }}>
              {s.gia?.toLocaleString?.() ?? s.gia}
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
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [roomObjects, setRoomObjects] = useState<any[]>([]);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [bannerImage, setBannerImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    // Load rooms from API
    const loadRooms = async () => {
      try {
        setLoadingRooms(true);
        const response = await fetch(`${API_BASE}/Phong`);
        const data = await response.json();
        const roomList = data.map((room: any) => ({
          key: room.idphong,
          title: `${room.tenPhong} (${room.idphong})`,
        }));
        setRooms(roomList);
        setRoomObjects(data);
      } catch (error) {
        console.error("[PROMOTION_FORM] Error loading rooms:", error);
        message.error("Lỗi khi tải danh sách phòng");
      } finally {
        setLoadingRooms(false);
      }
    };

    loadRooms();
  }, []);

  useEffect(() => {
    if (promotion) {
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

      // Try to load canonical promotion details to ensure khuyenMaiDichVus are present
      (async () => {
        try {
          const full = await getPromotionById(promotion.idkhuyenMai);
          if ((full as any).loaiKhuyenMai === "service") {
            const svcIds =
              (full as any).khuyenMaiDichVus?.map((m: any) => m.iddichVu) || [];
            setSelectedRooms(svcIds);
          } else {
            const selectedPhongIds =
              full.khuyenMaiPhongs?.map((kmp: any) => kmp.idphong) || [];
            setSelectedRooms(selectedPhongIds);
          }

          // Set banner image from canonical data
          setBannerImage(full.hinhAnhBanner || null);
        } catch (err) {
          // Fallback to whatever was passed in if fetch fails
          if ((promotion as any).loaiKhuyenMai === "service") {
            const svcIds =
              (promotion as any).khuyenMaiDichVus?.map(
                (m: any) => m.iddichVu
              ) || [];
            setSelectedRooms(svcIds);
          } else {
            const selectedPhongIds =
              promotion.khuyenMaiPhongs?.map((kmp: any) => kmp.idphong) || [];
            setSelectedRooms(selectedPhongIds);
          }
          setBannerImage(promotion.hinhAnhBanner || null);
        }
      })();
    } else {
      // Create mode: reset form
      form.resetFields();
      setSelectedRooms([]);
      setBannerImage(null);
    }
  }, [promotion, form]);

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
      if ((values.loaiKhuyenMai || "room") === "service") {
        payload.dichVuIds = selectedRooms;
      } else {
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
      title={promotion ? "Chỉnh Sửa Khuyến Mãi" : "Tạo Khuyến Mãi Mới"}
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
                    { label: "Khách Hàng", value: "customer" },
                  ]}
                />
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
                {({ getFieldValue }) => (
                  <div>
                    {getFieldValue("loaiKhuyenMai") === "service" ? (
                      <>
                        <Button onClick={() => setAssignModalVisible(true)}>
                          Gán Dịch Vụ
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button onClick={() => setAssignModalVisible(true)}>
                          Gán Phòng
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </Form.Item>

              {/* Assigned rooms list */}
              <div style={{ marginTop: 12 }}>
                {selectedRooms.length === 0 ? (
                  <div style={{ color: "#888" }}>Chưa có mục nào được gán</div>
                ) : (
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
                          border: "1px solid #e6e6e6",
                          borderRadius: 20,
                          background: "#fff",
                        }}
                      >
                        <div style={{ fontWeight: 700 }}>{id}</div>
                        <Button
                          size="small"
                          danger
                          onClick={() =>
                            setSelectedRooms((s) => s.filter((x) => x !== id))
                          }
                        >
                          X
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Modal
                title={
                  form.getFieldValue("loaiKhuyenMai") === "service"
                    ? "Gán Dịch Vụ cho Khuyến Mãi"
                    : "Gán Phòng cho Khuyến Mãi"
                }
                open={assignModalVisible}
                onCancel={() => setAssignModalVisible(false)}
                footer={null}
                width={900}
              >
                {form.getFieldValue("loaiKhuyenMai") === "service" ? (
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
                ) : (
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
              {promotion ? "Cập Nhật" : "Tạo"}
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
