import React, { useState } from "react";
import {
  Table,
  Button,
  Space,
  Tag,
  Modal,
  message,
  Row,
  Col,
  Select,
  DatePicker,
  Popconfirm,
  Tooltip,
  Image,
} from "antd";
import {
  EditOutlined,
  DeleteOutlined,
  PoweroffOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import {
  Promotion,
  deletePromotion,
  togglePromotion,
} from "../../api/promotionApi";
import PromotionModal from "./PromotionModal";

interface PromotionListProps {
  promotions: Promotion[];
  onEdit: (promotion: Promotion) => void;
  onRefresh: () => void;
  onFilterChange: (status?: string, discountType?: string) => void;
  onCreateNew?: () => void;
}

const PromotionList: React.FC<PromotionListProps> = ({
  promotions,
  onEdit,
  onRefresh,
  onFilterChange,
  onCreateNew,
}) => {
  const [selectedPromotion, setSelectedPromotion] = useState<Promotion | null>(
    null
  );
  const [showDetail, setShowDetail] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [filterDiscountType, setFilterDiscountType] = useState<
    string | undefined
  >();
  const [filterPromotionType, setFilterPromotionType] = useState<
    string | undefined
  >();

  const handleDelete = async (id: string) => {
    try {
      setLoading(true);
      await deletePromotion(id);
      message.success("Xóa khuyến mãi thành công");
      onRefresh();
    } catch (error) {
      console.error("[PROMOTION_LIST] Error deleting:", error);
      message.error(
        `Lỗi: ${error instanceof Error ? error.message : "Xóa thất bại"}`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id: string, currentStatus: string) => {
    try {
      setLoading(true);
      await togglePromotion(id);
      message.success(
        currentStatus === "active" ? "Đã ngưng hoạt động" : "Đã kích hoạt"
      );
      onRefresh();
    } catch (error) {
      console.error("[PROMOTION_LIST] Error toggling:", error);
      message.error(
        `Lỗi: ${error instanceof Error ? error.message : "Thay đổi thất bại"}`
      );
    } finally {
      setLoading(false);
    }
  };

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

  const getDiscountTypeLabel = (type: string) => {
    return type === "percent" ? "% Giảm" : "Giảm Tiền";
  };

  const getPromotionTypeLabel = (type?: string) => {
    switch (type) {
      case "room":
        return <Tag color="blue">Phòng</Tag>;
      case "service":
        return <Tag color="purple">Dịch Vụ</Tag>;
      case "combo":
        return <Tag color="cyan">Combo</Tag>;
      case "room_service":
        return <Tag color="magenta">Phòng + Dịch Vụ</Tag>;
      case "customer":
        return <Tag color="gold">Khách Hàng</Tag>;
      default:
        return <Tag>Không xác định</Tag>;
    }
  };

  const columns = [
    {
      title: "Tên Khuyến Mãi",
      dataIndex: "tenKhuyenMai",
      key: "tenKhuyenMai",
      width: 180,
    },
    {
      title: "Loại KM",
      key: "loaiKhuyenMai",
      width: 130,
      render: (_: any, record: Promotion) =>
        getPromotionTypeLabel(record.loaiKhuyenMai),
    },
    {
      title: "Banner",
      key: "banner",
      width: 100,
      render: (_: any, record: Promotion) =>
        record.hinhAnhBanner ? (
          <Image
            // If backend returns a full relative path (starts with '/'), use it directly.
            // Otherwise assume it's a filename and prepend the folder.
            src={
              record.hinhAnhBanner.startsWith("/") ||
              record.hinhAnhBanner.includes("/img/promotion")
                ? record.hinhAnhBanner
                : `/img/promotion/${record.hinhAnhBanner}`
            }
            alt="Banner"
            style={{
              width: 80,
              height: 40,
              objectFit: "cover",
              borderRadius: 4,
            }}
            fallback="/img/placeholder.png"
          />
        ) : (
          <span style={{ color: "#999", fontSize: "12px" }}>Không có</span>
        ),
    },
    {
      title: "Loại Giảm Giá",
      key: "loaiGiamGia",
      width: 120,
      render: (_: any, record: Promotion) =>
        getDiscountTypeLabel(record.loaiGiamGia),
    },
    {
      title: "Giá Trị Giảm",
      key: "giaTriGiam",
      width: 100,
      render: (_: any, record: Promotion) => (
        <>
          {record.giaTriGiam} {record.loaiGiamGia === "percent" ? "%" : "đ"}
        </>
      ),
    },
    {
      title: "Ngày Bắt Đầu",
      dataIndex: "ngayBatDau",
      key: "ngayBatDau",
      width: 120,
      render: (date: string) => dayjs(date).format("DD/MM/YYYY"),
    },
    {
      title: "Ngày Kết Thúc",
      dataIndex: "ngayKetThuc",
      key: "ngayKetThuc",
      width: 120,
      render: (date: string) => dayjs(date).format("DD/MM/YYYY"),
    },
    {
      title: "Trạng Thái",
      key: "trangThai",
      width: 120,
      render: (_: any, record: Promotion) => getStatusTag(record.trangThai),
    },
    {
      title: "Hành Động",
      key: "action",
      width: 200,
      render: (_: any, record: Promotion) => (
        <Space>
          <Tooltip title="Sửa">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => onEdit(record)}
              disabled={record.trangThai === "expired"}
            />
          </Tooltip>
          <Tooltip
            title={
              record.trangThai === "active" ? "Ngưng Hoạt Động" : "Kích Hoạt"
            }
          >
            <Button
              type="text"
              icon={<PoweroffOutlined />}
              onClick={() =>
                handleToggle(record.idkhuyenMai, record.trangThai || "active")
              }
              danger={record.trangThai === "active"}
              disabled={record.trangThai === "expired"}
            />
          </Tooltip>
          <Popconfirm
            title="Xóa Khuyến Mãi"
            description="Bạn chắc chắn muốn xóa khuyến mãi này? Dữ liệu sẽ không thể khôi phục."
            onConfirm={() => handleDelete(record.idkhuyenMai)}
            okText="Xóa"
            cancelText="Hủy"
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              loading={loading}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Row gutter={16} style={{ marginBottom: "16px" }}>
        <Col xs={24} sm={12} md={6}>
          <Select
            placeholder="Lọc theo trạng thái"
            allowClear
            value={filterStatus}
            onChange={(value) => {
              setFilterStatus(value);
              onFilterChange(value, filterDiscountType);
            }}
            options={[
              { label: "Đang Hoạt Động", value: "active" },
              { label: "Tạm Ngưng", value: "inactive" },
              { label: "Hết Hạn", value: "expired" },
            ]}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Select
            placeholder="Lọc theo loại giảm giá"
            allowClear
            value={filterDiscountType}
            onChange={(value) => {
              setFilterDiscountType(value);
              onFilterChange(filterStatus, value);
            }}
            options={[
              { label: "% Giảm", value: "percent" },
              { label: "Giảm Tiền", value: "amount" },
            ]}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Select
            placeholder="Lọc theo loại khuyến mãi"
            allowClear
            value={filterPromotionType}
            onChange={(value) => {
              setFilterPromotionType(value);
            }}
            options={[
              { label: "Phòng", value: "room" },
              { label: "Dịch Vụ", value: "service" },
              { label: "Combo", value: "combo" },
              { label: "Phòng + Dịch Vụ", value: "room_service" },
              { label: "Khách Hàng", value: "customer" },
            ]}
          />
        </Col>
      </Row>

      {/* Small inline style to indicate rows are clickable */}
      <style>{`.row-clickable { cursor: pointer; }`}</style>

      <Table
        columns={columns}
        dataSource={promotions
          .filter(
            (p) =>
              !filterPromotionType || p.loaiKhuyenMai === filterPromotionType
          )
          .map((p) => ({
            ...p,
            key: p.idkhuyenMai,
          }))}
        loading={loading}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        scroll={{ x: 1200 }}
        rowClassName={() => "row-clickable"}
        onRow={(record: Promotion) => ({
          onClick: (event) => {
            // Prevent opening detail when clicking action buttons inside the row
            if ((event.target as HTMLElement).closest(".ant-btn")) return;
            setSelectedPromotion(record);
            setShowDetail(true);
          },
        })}
      />

      {selectedPromotion && (
        <PromotionModal
          promotion={selectedPromotion}
          visible={showDetail}
          onClose={() => {
            setShowDetail(false);
            setSelectedPromotion(null);
          }}
        />
      )}
    </>
  );
};

export default PromotionList;
