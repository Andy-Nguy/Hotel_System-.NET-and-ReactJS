import React, { useEffect, useState } from "react";
import { Modal, Descriptions, Tag, Table, Empty, Divider, Row, Col } from "antd";
import dayjs from "dayjs";
import { Promotion } from "../../api/promotionApi";

interface PromotionModalProps {
  promotion: Promotion;
  visible: boolean;
  onClose: () => void;
}

interface PromotionService {
  id: number;
  iddichVu: string;
  tenDichVu: string;
  isActive: boolean;
  ngayApDung?: string;
  ngayKetThuc?: string;
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

  const [serviceList, setServiceList] = useState<PromotionService[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);

  const serviceColumns = [
    {
      title: "Mã Dịch Vụ",
      dataIndex: "iddichVu",
      key: "iddichVu",
      width: "30%",
    },
    {
      title: "Tên Dịch Vụ",
      dataIndex: "tenDichVu",
      key: "tenDichVu",
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

  useEffect(() => {
    // load service mappings when modal is visible and promotion involves services
    const loadServices = async () => {
      if (!visible || !promotion) return;
      const loai = (promotion as any).loaiKhuyenMai;
      if (!loai) return;

      try {
        setLoadingServices(true);

        // If the promotion object already contains khuyenMaiDichVus mapping, use it.
        const existing = (promotion as any).khuyenMaiDichVus;
        if (existing && Array.isArray(existing) && existing.length > 0) {
          // map to PromotionService shape
          const mapped = existing.map((m: any, idx: number) => ({
            id: m.id || idx,
            iddichVu: m.iddichVu || m.IddichVu || m.iddichvu,
            tenDichVu: m.tenDichVu || m.TenDichVu || m.ten || m.name || '',
            isActive: true,
            ngayApDung: undefined,
            ngayKetThuc: undefined,
          }));
          setServiceList(mapped);
          return;
        }

        // Fallback: call API that returns service mappings for this promotion
        const resp = await fetch(`/api/KhuyenMai/${promotion.idkhuyenMai}/services`);
        if (!resp.ok) {
          setServiceList([]);
          return;
        }
        const data = await resp.json();
        setServiceList(data || []);
      } catch (err) {
        console.error("Failed to load promotion services", err);
        setServiceList([]);
      } finally {
        setLoadingServices(false);
      }
    };

    loadServices();
  }, [visible, promotion]);

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
      {
        (() => {
          const loai = (promotion as any).loaiKhuyenMai;
          if (loai === "service") {
            return (
              <>
                <h3>Danh Sách Dịch Vụ Áp Dụng ({serviceList.length} dịch vụ)</h3>
                {serviceList.length > 0 ? (
                  <Table
                    columns={serviceColumns}
                    dataSource={serviceList.map((s, index) => ({ ...s, key: `${s.id}_${index}` }))}
                    pagination={false}
                    size="small"
                    loading={loadingServices}
                  />
                ) : (
                  <Empty description="Không có dịch vụ nào áp dụng khuyến mãi này" />
                )}
              </>
            );
          }

          if (loai === "combo") {
            return (
              <>
                <h3>Combo Dịch Vụ ({serviceList.length} dịch vụ)</h3>
                {serviceList.length > 0 ? (
                  <Table
                    columns={serviceColumns}
                    dataSource={serviceList.map((s, index) => ({ ...s, key: `${s.id}_${index}` }))}
                    pagination={false}
                    size="small"
                    loading={loadingServices}
                  />
                ) : (
                  <Empty description="Không có dịch vụ nào trong combo" />
                )}
              </>
            );
          }

          if (loai === "room_service") {
            return (
              <>
                <h3>Danh Sách Phòng Áp Dụng ({promotion.khuyenMaiPhongs?.length ?? 0} phòng)</h3>

                {promotion.khuyenMaiPhongs && promotion.khuyenMaiPhongs.length > 0 ? (
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

                <Divider />
                <h3>Dịch Vụ Áp Dụng cho Gói ({serviceList.length} dịch vụ)</h3>
                {serviceList.length > 0 ? (
                  <Table
                    columns={serviceColumns}
                    dataSource={serviceList.map((s, index) => ({ ...s, key: `${s.id}_${index}` }))}
                    pagination={false}
                    size="small"
                    loading={loadingServices}
                  />
                ) : (
                  <Empty description="Không có dịch vụ nào được gán cho gói" />
                )}
              </>
            );
          }

          // default: show rooms if any
          return (
            <>
              <h3>Danh Sách Phòng Áp Dụng ({promotion.khuyenMaiPhongs?.length ?? 0} phòng)</h3>

              {promotion.khuyenMaiPhongs && promotion.khuyenMaiPhongs.length > 0 ? (
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
            </>
          );
        })()
      }

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
