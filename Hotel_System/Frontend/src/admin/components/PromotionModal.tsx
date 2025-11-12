import React from "react";
import { Modal, Descriptions, Tag, Table, Empty, Divider, Row, Col } from "antd";
import dayjs from "dayjs";
import { Promotion } from "../../api/promotionApi";

interface PromotionModalProps {
  promotion: Promotion;
  visible: boolean;
  onClose: () => void;
}

const PromotionModal: React.FC<PromotionModalProps> = ({
  promotion,
  visible,
  onClose,
}) => {
  const getStatusTag = (status?: string) => {
    switch (status) {
      case "active":
        return <Tag color="green">Đang Hoạt Động</Tag>;
      case "inactive":
        return <Tag color="orange">Tạm Ngưng</Tag>;
      case "expired":
        return <Tag color="red">Hết Hạn</Tag>;
      default:
        return <Tag>Không Xác Định</Tag>;
    }
  };

  const roomColumns = [
    {
      title: "Mã Phòng",
      dataIndex: "idphong",
      key: "idphong",
      width: "30%",
    },
    {
      title: "Tên Phòng",
      dataIndex: "tenPhong",
      key: "tenPhong",
      width: "40%",
    },
    {
      title: "Trạng Thái Áp Dụng",
      key: "isActive",
      width: "30%",
      render: (_: any, record: any) =>
        record.isActive ? (
          <Tag color="blue">Đang Áp Dụng</Tag>
        ) : (
          <Tag>Không Áp Dụng</Tag>
        ),
    },
  ];

  return (
    <Modal
      title={`Chi Tiết Khuyến Mãi: ${promotion.tenKhuyenMai}`}
      open={visible}
      onCancel={onClose}
      width={900}
      footer={null}
    >
      <Descriptions bordered size="small" column={2}>
        <Descriptions.Item label="Mã Khuyến Mãi">
          {promotion.idkhuyenMai}
        </Descriptions.Item>
        <Descriptions.Item label="Trạng Thái">
          {getStatusTag(promotion.trangThai)}
        </Descriptions.Item>
        <Descriptions.Item label="Loại Giảm Giá">
          {promotion.loaiGiamGia === "percent" ? "% Giảm" : "Giảm Tiền"}
        </Descriptions.Item>
        <Descriptions.Item label="Giá Trị Giảm">
          {promotion.giaTriGiam} {promotion.loaiGiamGia === "percent" ? "%" : "đ"}
        </Descriptions.Item>
        <Descriptions.Item label="Ngày Bắt Đầu">
          {dayjs(promotion.ngayBatDau).format("DD/MM/YYYY")}
        </Descriptions.Item>
        <Descriptions.Item label="Ngày Kết Thúc">
          {dayjs(promotion.ngayKetThuc).format("DD/MM/YYYY")}
        </Descriptions.Item>
      </Descriptions>

      {promotion.moTa && (
        <>
          <Divider />
          <Row gutter={16}>
            <Col span={24}>
              <h3>Mô Tả</h3>
              <p style={{ whiteSpace: "pre-wrap" }}>{promotion.moTa}</p>
            </Col>
          </Row>
        </>
      )}

      <Divider />
      <h3>Danh Sách Phòng Áp Dụng ({promotion.khuyenMaiPhongs.length} phòng)</h3>

      {promotion.khuyenMaiPhongs.length > 0 ? (
        <Table
          columns={roomColumns}
          dataSource={promotion.khuyenMaiPhongs.map((room, index) => ({
            ...room,
            key: `${room.idphong}_${index}`,
          }))}
          pagination={false}
          size="small"
        />
      ) : (
        <Empty description="Không có phòng nào áp dụng khuyến mãi này" />
      )}

      {promotion.createdAt && promotion.updatedAt && (
        <>
          <Divider />
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <p style={{ fontSize: "12px", color: "#999" }}>
                <strong>Ngày Tạo:</strong> {dayjs(promotion.createdAt).format("DD/MM/YYYY HH:mm")}
              </p>
            </Col>
            <Col xs={24} md={12}>
              <p style={{ fontSize: "12px", color: "#999" }}>
                <strong>Ngày Cập Nhật:</strong> {dayjs(promotion.updatedAt).format("DD/MM/YYYY HH:mm")}
              </p>
            </Col>
          </Row>
        </>
      )}
    </Modal>
  );
};

export default PromotionModal;
