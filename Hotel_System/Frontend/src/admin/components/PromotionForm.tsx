import React, { useState, useEffect } from "react";
import {
  Form,
  Input,
  Button,
  DatePicker,
  Select,
  InputNumber,
  Card,
  Space,
  Transfer,
  message,
  Spin,
  Row,
  Col,
  Upload,
  Image,
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
  const [bannerImage, setBannerImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    // Load rooms from API
    const loadRooms = async () => {
      try {
        setLoadingRooms(true);
        const response = await fetch("/api/Phong");
        const data = await response.json();
        const roomList = data.map((room: any) => ({
          key: room.idphong,
          title: `${room.tenPhong} (${room.idphong})`,
        }));
        setRooms(roomList);
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
        moTa: promotion.moTa,
        loaiGiamGia: promotion.loaiGiamGia,
        giaTriGiam: promotion.giaTriGiam,
        ngayBatDau: dayjs(promotion.ngayBatDau),
        ngayKetThuc: dayjs(promotion.ngayKetThuc),
        trangThai: promotion.trangThai,
      });

      // Set selected rooms
      const selectedPhongIds = promotion.khuyenMaiPhongs.map((kmp) => kmp.idphong);
      setSelectedRooms(selectedPhongIds);

      // Set banner image
      setBannerImage(promotion.hinhAnhBanner || null);
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

      const payload = {
        tenKhuyenMai: values.tenKhuyenMai,
        moTa: values.moTa,
        loaiGiamGia: values.loaiGiamGia,
        giaTriGiam: values.giaTriGiam,
        ngayBatDau: values.ngayBatDau.format("YYYY-MM-DD"),
        ngayKetThuc: values.ngayKetThuc.format("YYYY-MM-DD"),
        phongIds: selectedRooms,
        hinhAnhBanner: bannerImage,
        ...(promotion && { trangThai: values.trangThai || promotion.trangThai }),
      };

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
      message.error(`Lỗi: ${error instanceof Error ? error.message : "Lỗi không xác định"}`);
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
      message.error(`Lỗi upload: ${error instanceof Error ? error.message : "Lỗi không xác định"}`);
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
                rules={[{ required: true, message: "Vui lòng chọn loại giảm giá" }]}
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
                rules={[{ required: true, message: "Vui lòng chọn ngày bắt đầu" }]}
              >
                <DatePicker format="DD/MM/YYYY" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                label="Ngày Kết Thúc"
                name="ngayKetThuc"
                rules={[{ required: true, message: "Vui lòng chọn ngày kết thúc" }]}
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
                    src={bannerImage.startsWith("/") ? bannerImage : `/img/promotion/${bannerImage}`}
                    alt="Banner preview"
                    style={{ maxWidth: "300px", maxHeight: "150px", objectFit: "cover" }}
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

          <Form.Item label="Chọn Phòng Áp Dụng">
            <Transfer
              dataSource={rooms}
              titles={["Phòng Có Sẵn", "Phòng Áp Dụng"]}
              targetKeys={selectedRooms}
              onChange={(newTargetKeys) => {
                setSelectedRooms(newTargetKeys as string[]);
              }}
              render={(item) => item.title}
              listStyle={{ width: "100%", height: "300px" }}
            />
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
