import React, { useEffect, useState } from "react";
import { Carousel, Button, Typography, Spin, Modal, List, Image, Tag, Divider } from "antd";
import { CheckCircleOutlined, ClockCircleOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
dayjs.extend(isBetween);
import { getAllPromotions, getPromotionById, Promotion } from "../api/promotionApi";

const { Title, Paragraph, Text } = Typography;

const PromotionSection: React.FC = () => {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPromo, setSelectedPromo] = useState<Promotion | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        // Request active promotions (backend will return active ones)
        const all = await getAllPromotions("active");
        const today = dayjs();
        const valid = all.filter((p) => {
          try {
            const start = dayjs(p.ngayBatDau);
            const end = dayjs(p.ngayKetThuc);
            return today.isBetween(start, end, "day", "[]");
          } catch {
            return false;
          }
        });
        setPromotions(valid.slice(0, 2));
      } catch (err) {
        console.error("[PromotionSection] Failed to load promotions", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const openPromo = async (id: string) => {
    try {
      setModalLoading(true);
      const p = await getPromotionById(id);
      setSelectedPromo(p);
      setModalVisible(true);
    } catch (err) {
      console.error("[PromotionSection] Failed to load promo detail", err);
    } finally {
      setModalLoading(false);
    }
  };

  const renderImageSrc = (hinh?: string) => {
    if (!hinh) return "/img/placeholder.png";
    return hinh.startsWith("/") ? hinh : `/img/promotion/${hinh}`;
  };

  if (loading) return <Spin />;

  if (promotions.length === 0) return null;

  return (
    <div style={{ marginBottom: 48, position: "relative", padding: 20, height: 'fit-content' }}>
      {/* Section Title */}
      <div style={{ marginBottom: 24, textAlign: "center" }}>
        <Title level={2} style={{ marginBottom: 8, color: "#1f1f1f" }}>
          🎉 Khuyến Mãi Nổi Bật
        </Title>
        <Text type="secondary" style={{ fontSize: 14 }}>
          Những ưu đãi tuyệt vời đang chờ bạn
        </Text>
      </div>

      {/* Carousel */}
      <Carousel
        autoplay
        autoplaySpeed={5000}
        dots={{
          className: "custom-dots",
        }}
        style={{
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 12px 32px rgba(0, 0, 0, 0.15)",
          width: "100%",
        }}
      >
        {promotions.map((p) => (
          <div key={p.idkhuyenMai} style={{ width: "100%" }}>
            <div
              style={{
                height: 450,
                width: "100%",
                backgroundImage: `url(${renderImageSrc(p.hinhAnhBanner)})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
                position: "relative",
              }}
            >
              {/* Dark gradient overlay - stronger for better text readability */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: "linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.2) 100%)",
                }}
              />

              {/* Content */}
              <div
                style={{
                  position: "relative",
                  zIndex: 2,
                  padding: "60px 60px",
                  color: "#fff",
                  maxWidth: "65%",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                }}
              >
                <div style={{ marginBottom: 16 }}>
                  <Tag color="volcano" style={{ fontSize: 13, fontWeight: "600", padding: "4px 12px" }}>
                    ⚡ KHUYẾN MÃI ĐẶC BIỆT
                  </Tag>
                </div>

                <Title
                  level={1}
                  style={{
                    color: "#fff",
                    margin: "12px 0",
                    fontSize: 42,
                    fontWeight: 800,
                    lineHeight: 1.2,
                    textShadow: "0 4px 12px rgba(0,0,0,0.3)",
                  }}
                >
                  {p.tenKhuyenMai}
                </Title>

                <Paragraph
                  style={{
                    color: "rgba(255,255,255,0.95)",
                    margin: "20px 0",
                    fontSize: 16,
                    lineHeight: 1.6,
                    textShadow: "0 2px 8px rgba(0,0,0,0.2)",
                  }}
                  ellipsis={{ rows: 3 }}
                >
                  {p.moTa}
                </Paragraph>

                <div style={{ marginTop: 24 }}>
                  <Button
                    type="primary"
                    size="large"
                    onClick={() => openPromo(p.idkhuyenMai)}
                    style={{
                      borderRadius: 8,
                      fontSize: 16,
                      fontWeight: 600,
                      height: 48,
                      paddingInline: 32,
                      minWidth: 200,
                    }}
                  >
                    🔥 Khám Phá Ngay
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </Carousel>

      {/* Modal */}
      <Modal
        open={modalVisible}
        title={
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {selectedPromo?.tenKhuyenMai}
            </Title>
          </div>
        }
        footer={
          <Button type="primary" onClick={() => setModalVisible(false)}>
            Đóng
          </Button>
        }
        onCancel={() => setModalVisible(false)}
        width={820}
        bodyStyle={{ maxHeight: "70vh", overflowY: "auto" }}
      >
        {modalLoading || !selectedPromo ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Spin size="large" />
          </div>
        ) : (
          <div>
            {/* Banner Image */}
            <Image
              src={renderImageSrc(selectedPromo.hinhAnhBanner)}
              alt="banner"
              style={{
                marginBottom: 24,
                borderRadius: 8,
                width: "100%",
                objectFit: "cover",
                maxHeight: 300,
              }}
              preview={{ mask: "Xem" }}
            />

            {/* Description */}
            <div style={{ marginBottom: 24 }}>
              <Title level={5} style={{ marginBottom: 8 }}>
                Chi Tiết Khuyến Mãi
              </Title>
              <Paragraph style={{ fontSize: 14, lineHeight: 1.6, color: "#666" }}>
                {selectedPromo.moTa}
              </Paragraph>
            </div>

            <Divider />

            {/* Rooms Applied */}
            <div style={{ marginTop: 24 }}>
              <Title level={5} style={{ marginBottom: 16 }}>
                📍 Phòng Áp Dụng ({selectedPromo.khuyenMaiPhongs?.length || 0})
              </Title>

              {selectedPromo.khuyenMaiPhongs && selectedPromo.khuyenMaiPhongs.length > 0 ? (
                <List
                  dataSource={selectedPromo.khuyenMaiPhongs}
                  renderItem={(item) => (
                    <List.Item
                      style={{
                        padding: "12px 0",
                        borderBottom: "1px solid #f0f0f0",
                      }}
                    >
                      <List.Item.Meta
                        avatar={
                          item.isActive ? (
                            <CheckCircleOutlined style={{ color: "#52c41a", fontSize: 18 }} />
                          ) : (
                            <ClockCircleOutlined style={{ color: "#faad14", fontSize: 18 }} />
                          )
                        }
                        title={
                          <Text strong style={{ fontSize: 14 }}>
                            {item.tenPhong || item.idphong}
                          </Text>
                        }
                        description={
                          <Tag
                            color={item.isActive ? "green" : "orange"}
                            style={{ marginTop: 4 }}
                          >
                            {item.isActive ? "✓ Đang Áp Dụng" : "⏳ Chưa Áp Dụng"}
                          </Tag>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <Text type="secondary">Không có phòng nào áp dụng khuyến mãi này</Text>
              )}
            </div>

            {/* Promotion Details */}
            <Divider />
            <div style={{ marginTop: 24 }}>
              <Title level={5} style={{ marginBottom: 12 }}>
                📋 Thông Tin Chi Tiết
              </Title>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <Text type="secondary" style={{ fontSize: 12, textTransform: "uppercase" }}>
                    Loại Giảm
                  </Text>
                  <Paragraph style={{ margin: 0, fontWeight: 500 }}>
                    {selectedPromo.loaiGiamGia === "percent" ? `${selectedPromo.giaTriGiam}%` : `${selectedPromo.giaTriGiam} đ`}
                  </Paragraph>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12, textTransform: "uppercase" }}>
                    Trạng Thái
                  </Text>
                  <Paragraph style={{ margin: 0, fontWeight: 500 }}>
                    <Tag
                      color={
                        selectedPromo.trangThai === "active"
                          ? "green"
                          : selectedPromo.trangThai === "inactive"
                          ? "orange"
                          : "red"
                      }
                    >
                      {selectedPromo.trangThai === "active"
                        ? "Đang Hoạt Động"
                        : selectedPromo.trangThai === "inactive"
                        ? "Chưa Bắt Đầu"
                        : "Đã Hết Hạn"}
                    </Tag>
                  </Paragraph>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 12 }}>
                <div>
                  <Text type="secondary" style={{ fontSize: 12, textTransform: "uppercase" }}>
                    Ngày Bắt Đầu
                  </Text>
                  <Paragraph style={{ margin: 0, fontWeight: 500 }}>
                    {dayjs(selectedPromo.ngayBatDau).format("DD/MM/YYYY")}
                  </Paragraph>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12, textTransform: "uppercase" }}>
                    Ngày Kết Thúc
                  </Text>
                  <Paragraph style={{ margin: 0, fontWeight: 500 }}>
                    {dayjs(selectedPromo.ngayKetThuc).format("DD/MM/YYYY")}
                  </Paragraph>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PromotionSection;
