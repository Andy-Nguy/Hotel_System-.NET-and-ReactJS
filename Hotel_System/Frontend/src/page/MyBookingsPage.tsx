import React, { useEffect, useMemo, useState } from "react";
import {
  getMyBookingHistory,
  rescheduleBooking,
  canModifyBooking,
  BookingSummary,
  RescheduleRequest,
} from "../api/bookingApi";
import {
  Card,
  Typography,
  Button,
  Tag,
  Space,
  message,
  Modal,
  Empty,
  Spin,
  DatePicker,
  Form,
  Collapse,
} from "antd";
import {
  CalendarOutlined,
  DollarOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

// Helper to try multiple property names (PascalCase/camelCase) and return the first found value
function getProp(obj: any, ...names: string[]) {
  if (!obj) return undefined;
  for (const n of names) {
    if (obj[n] !== undefined && obj[n] !== null) return obj[n];
  }
  return undefined;
}

// Status badge helper
const getStatusBadge = (trangThai: number, trangThaiThanhToan: number) => {
  const isCancelled = trangThai === 0;
  const isPaid = trangThaiThanhToan === 2;
  const isConfirmed = trangThai === 2;
  const isInUse = trangThai === 3;
  const isCompleted = trangThai === 4;

  let statusColor = "default";
  let paymentColor = "default";

  if (isCancelled) statusColor = "red";
  else if (isCompleted) statusColor = "cyan";
  else if (isInUse) statusColor = "blue";
  else if (isConfirmed) statusColor = "green";
  else statusColor = "orange";

  if (isPaid) paymentColor = "green";
  else if (trangThaiThanhToan === 0) paymentColor = "gold";
  else paymentColor = "orange";

  return { statusColor, paymentColor };
};

const { Title, Text } = Typography;

const MyBookingsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<BookingSummary[]>([]);
  const [openPanelId, setOpenPanelId] = useState<string | null>(null);

  // Reschedule state & handlers
  const [rescheduleModalVisible, setRescheduleModalVisible] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] =
    useState<BookingSummary | null>(null);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);

  // Use JWT token to fetch booking history (backend reads NameIdentifier claim)
  const token = localStorage.getItem("hs_token");

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await getMyBookingHistory();
      // Sort by check-in date desc
      list.sort(
        (a, b) =>
          new Date(b.ngayNhanPhong).getTime() -
          new Date(a.ngayNhanPhong).getTime()
      );
      setBookings(list);
    } catch (err: any) {
      message.error(err.message || "Không thể tải lịch sử đặt phòng");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("hs_token");
    if (token) {
      loadData();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openRescheduleModal = (b: BookingSummary) => {
    const { canModify, reason } = canModifyBooking(b);
    if (!canModify) {
      message.warning(reason || "Không thể thay đổi thời gian đặt phòng");
      return;
    }
    setRescheduleTarget(b);
    setRescheduleModalVisible(true);
  };

  const onFinishReschedule = async (values: any) => {
    if (!rescheduleTarget) return;
    try {
      setRescheduleLoading(true);
      const payload: RescheduleRequest = {
        ngayNhanPhong: dayjs(values.ngayNhanPhong).format("YYYY-MM-DD"),
        ngayTraPhong: dayjs(values.ngayTraPhong).format("YYYY-MM-DD"),
      };
      await rescheduleBooking(rescheduleTarget.idDatPhong, payload);
      message.success("Thay đổi thời gian đặt phòng thành công");
      setRescheduleModalVisible(false);
      setRescheduleTarget(null);
      loadData();
    } catch (err: any) {
      message.error(err.message || "Thay đổi thời gian thất bại");
    } finally {
      setRescheduleLoading(false);
    }
  };

  const content = useMemo(() => {
    if (loading) {
      return (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <Spin size="large" />
        </div>
      );
    }

    if (!token) {
      return (
        <Empty
          description={
            <div>
              <div style={{ marginBottom: 8 }}>
                Bạn chưa đăng nhập hoặc chưa có đặt phòng nào.
              </div>
              <Button
                type="primary"
                onClick={() => (window.location.href = "/#login")}
              >
                Đăng nhập
              </Button>
            </div>
          }
          style={{ padding: "60px 0" }}
        />
      );
    }

    if (!bookings.length) {
      return (
        <Empty
          description="Bạn chưa có đơn đặt phòng nào"
          style={{ padding: "60px 0" }}
        >
          <Button
            type="primary"
            onClick={() => (window.location.href = "/#rooms")}
          >
            Đặt phòng ngay
          </Button>
        </Empty>
      );
    }

    return (
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        {bookings.map((b) => {
          // Normalized id for panel key; try multiple fields returned by API
          const panelId =
            b.idDatPhong ||
            (b as any).IddatPhong ||
            b.bookingCode ||
            (b as any).bookingId ||
            "";
          const { statusColor, paymentColor } = getStatusBadge(
            b.trangThai,
            b.trangThaiThanhToan
          );
          const isCancelled = b.trangThai === 0;

          return (
            <Card
              key={b.idDatPhong}
              hoverable
              style={{
                cursor: "pointer",
                borderLeft: `4px solid ${
                  isCancelled
                    ? "#ff4d4f"
                    : statusColor === "green"
                    ? "#52c41a"
                    : statusColor === "blue"
                    ? "#1890ff"
                    : "#faad14"
                }`,
              }}
            >
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                {/* STATUS SECTION - Most prominent */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    gap: 8,
                    paddingBottom: 12,
                    borderBottom: "1px solid #f0f0f0",
                  }}
                >
                  <Space size={8} wrap>
                    <Tag
                      color={statusColor}
                      style={{ fontSize: 14, padding: "4px 12px", margin: 0 }}
                    >
                      {b.trangThaiText}
                    </Tag>
                    <Tag
                      color={paymentColor}
                      style={{ fontSize: 14, padding: "4px 12px", margin: 0 }}
                    >
                      {b.trangThaiThanhToanText}
                    </Tag>
                  </Space>
                  <Button
                    type="text"
                    icon={<EyeOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenPanelId((prev) =>
                        prev === panelId ? null : panelId
                      );
                    }}
                    title={openPanelId === panelId ? "Đóng" : "Xem chi tiết"}
                    size="large"
                  />
                </div>

                {/* BOOKING INFO */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 260 }}>
                    {/* Booking code and meta are presented below */}
                    <div style={{ marginBottom: 8 }}>
                      <Text strong style={{ fontSize: 15 }}>
                        Đơn đặt phòng: {b.bookingCode}
                      </Text>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <CalendarOutlined
                        style={{ color: "#dfa974", fontSize: 16 }}
                      />
                      <Text style={{ marginLeft: 8, fontSize: 15 }}>
                        {new Date(b.ngayNhanPhong).toLocaleDateString("vi-VN")}{" "}
                        → {new Date(b.ngayTraPhong).toLocaleDateString("vi-VN")}
                      </Text>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <DollarOutlined
                        style={{ color: "#dfa974", fontSize: 16 }}
                      />
                      <Text style={{ marginLeft: 8, fontSize: 16 }} strong>
                        {b.tongTien.toLocaleString()}đ
                      </Text>
                    </div>
                    <div>
                      <Tag
                        color="blue"
                        style={{ fontSize: 13, padding: "2px 10px" }}
                      >
                        Phòng:{" "}
                        {b.rooms && b.rooms.length > 0
                          ? b.rooms.length === 1
                            ? `${
                                b.rooms[0].tenPhong ||
                                b.rooms[0].tenLoaiPhong ||
                                "N/A"
                              } ${b.rooms[0].soPhong || b.soPhong}`
                            : `${
                                b.rooms[0].tenPhong ||
                                b.rooms[0].tenLoaiPhong ||
                                "N/A"
                              } ${b.rooms[0].soPhong || b.soPhong} +${
                                b.rooms.length - 1
                              } khác`
                          : `Số ${b.soPhong}`}
                      </Tag>
                    </div>
                  </div>
                </div>
                <Collapse
                  ghost
                  accordion
                  activeKey={openPanelId ?? undefined}
                  onChange={(key) =>
                    setOpenPanelId(
                      Array.isArray(key)
                        ? (key[0] as string)
                        : (key as string) || null
                    )
                  }
                >
                  <Collapse.Panel
                    header={`Xem chi tiết — ${b.rooms?.length || 0} phòng · ${
                      b.services?.length || 0
                    } dịch vụ`}
                    key={panelId}
                    collapsible="disabled"
                  >
                    {/* CUSTOMER INFO */}
                    <div style={{ marginBottom: 16 }}>
                      <Title level={5} style={{ marginBottom: 12 }}>
                        Thông tin khách hàng
                      </Title>
                      <p style={{ marginBottom: 8 }}>
                        <strong>Khách hàng:</strong> {b.tenKhachHang || "N/A"}
                      </p>
                      <p style={{ marginBottom: 8 }}>
                        <strong>Email:</strong> {b.emailKhachHang || "N/A"}
                      </p>
                      <p style={{ marginBottom: 8 }}>
                        <strong>Ngày đặt:</strong>{" "}
                        {b.ngayDatPhong
                          ? new Date(b.ngayDatPhong).toLocaleDateString("vi-VN")
                          : "N/A"}
                      </p>
                    </div>

                    {/* PAYMENT INFO */}
                    <div
                      style={{
                        padding: 12,
                        background: "#f6f8fa",
                        borderRadius: 6,
                        marginBottom: 16,
                      }}
                    >
                      <p style={{ marginBottom: 6 }}>
                        <strong>Tổng tiền:</strong>{" "}
                        <Text strong style={{ fontSize: 16, color: "#dfa974" }}>
                          {b.tongTien.toLocaleString()} đ
                        </Text>
                      </p>
                      <p style={{ marginBottom: 0 }}>
                        <strong>Tiền cọc:</strong> {(b as any).tienCoc || 0} đ
                      </p>
                    </div>

                    {/* ROOM DETAILS */}
                    <div style={{ marginBottom: 16 }}>
                      <Title level={5} style={{ marginBottom: 12 }}>
                        Chi tiết phòng
                      </Title>
                      {b.rooms && b.rooms.length > 0 ? (
                        <Space
                          direction="vertical"
                          size={12}
                          style={{ width: "100%" }}
                        >
                          {b.rooms.map((r, idx) => (
                            <div
                              key={idx}
                              style={{
                                padding: 12,
                                background: "#fafafa",
                                borderRadius: 6,
                                border: "1px solid #f0f0f0",
                              }}
                            >
                              <div style={{ marginBottom: 8 }}>
                                <Text strong style={{ fontSize: 15 }}>
                                  {r.tenPhong || r.tenLoaiPhong}
                                </Text>
                                <Tag color="blue" style={{ marginLeft: 8 }}>
                                  {r.soPhong}
                                </Tag>
                              </div>
                              <div style={{ marginBottom: 4 }}>
                                <Text type="secondary">Loại phòng: </Text>
                                <Text>{r.tenLoaiPhong}</Text>
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  gap: 20,
                                  marginTop: 8,
                                }}
                              >
                                <div>
                                  <Text type="secondary">Giá/đêm: </Text>
                                  <Text strong>
                                    {Number(r.giaPhong || 0).toLocaleString()} đ
                                  </Text>
                                </div>
                                <div>
                                  <Text type="secondary">Số đêm: </Text>
                                  <Text>{r.soDem}</Text>
                                </div>
                                {r.soNguoiToiDa && (
                                  <div>
                                    <Text type="secondary">Sức chứa: </Text>
                                    <Text>{r.soNguoiToiDa} khách</Text>
                                  </div>
                                )}
                              </div>
                              <div
                                style={{
                                  marginTop: 8,
                                  paddingTop: 8,
                                  borderTop: "1px solid #e8e8e8",
                                }}
                              >
                                <Text type="secondary">Thành tiền: </Text>
                                <Text
                                  strong
                                  style={{ color: "#dfa974", fontSize: 15 }}
                                >
                                  {Number(r.thanhTien || 0).toLocaleString()} đ
                                </Text>
                              </div>
                              {r.moTa && (
                                <div style={{ marginTop: 8 }}>
                                  <Text
                                    type="secondary"
                                    style={{ fontSize: 12 }}
                                  >
                                    {r.moTa}
                                  </Text>
                                </div>
                              )}
                            </div>
                          ))}
                        </Space>
                      ) : (
                        <Empty description="Không có chi tiết phòng" />
                      )}
                    </div>

                    {/* SERVICES */}
                    <div style={{ marginTop: 16 }}>
                      <Title level={5} style={{ marginBottom: 12 }}>
                        Dịch vụ kèm theo
                      </Title>
                      {b.services && b.services.length > 0 ? (
                        <Space
                          direction="vertical"
                          size={8}
                          style={{ width: "100%" }}
                        >
                          {b.services.map((s, idx) => (
                            <div
                              key={idx}
                              style={{
                                padding: 10,
                                background: "#f6f8fa",
                                borderRadius: 6,
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                flexWrap: "wrap",
                                gap: 8,
                              }}
                            >
                              <div style={{ flex: 1 }}>
                                <Text strong>{s.tenDichVu}</Text>
                                {s.thoiGianThucHien && (
                                  <div>
                                    <Text
                                      type="secondary"
                                      style={{ fontSize: 12 }}
                                    >
                                      {s.thoiGianThucHien}
                                    </Text>
                                  </div>
                                )}
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  gap: 12,
                                  alignItems: "center",
                                }}
                              >
                                <Text strong style={{ color: "#dfa974" }}>
                                  {Number(s.tienDichVu || 0).toLocaleString()} đ
                                </Text>
                                {s.trangThai && (
                                  <Tag color="green" style={{ margin: 0 }}>
                                    {s.trangThai}
                                  </Tag>
                                )}
                              </div>
                            </div>
                          ))}
                        </Space>
                      ) : (
                        <Empty description="Không có dịch vụ kèm theo" />
                      )}
                    </div>
                  </Collapse.Panel>
                </Collapse>
              </div>
            </Card>
          );
        })}
      </Space>
    );
  }, [loading, token, bookings]);

  return (
    <div className="container" style={{ padding: "80px 20px" }}>
      <div className="row">
        <div className="col-lg-10 offset-lg-1">
          <div className="section-title" style={{ marginBottom: 16 }}>
            <h2>Đơn đặt phòng của tôi</h2>
            <p>Xem và quản lý các đơn đặt phòng gần đây</p>
          </div>
          {content}

          {/* Reschedule Modal */}
          <Modal
            title={
              rescheduleTarget
                ? `Thay đổi thời gian: ${rescheduleTarget.bookingCode}`
                : "Thay đổi thời gian"
            }
            open={rescheduleModalVisible}
            onCancel={() => {
              setRescheduleModalVisible(false);
              setRescheduleTarget(null);
            }}
            footer={null}
          >
            {rescheduleTarget && (
              <Form
                layout="vertical"
                onFinish={onFinishReschedule}
                initialValues={{
                  ngayNhanPhong: dayjs(rescheduleTarget.ngayNhanPhong),
                  ngayTraPhong: dayjs(rescheduleTarget.ngayTraPhong),
                }}
              >
                <Form.Item
                  label="Ngày nhận phòng"
                  name="ngayNhanPhong"
                  rules={[{ required: true, message: "Chọn ngày nhận phòng" }]}
                >
                  <DatePicker style={{ width: "100%" }} />
                </Form.Item>
                <Form.Item
                  label="Ngày trả phòng"
                  name="ngayTraPhong"
                  rules={[{ required: true, message: "Chọn ngày trả phòng" }]}
                >
                  <DatePicker style={{ width: "100%" }} />
                </Form.Item>
                <Form.Item>
                  <Space>
                    <Button
                      htmlType="submit"
                      type="primary"
                      loading={rescheduleLoading}
                    >
                      Xác nhận thay đổi
                    </Button>
                    <Button
                      onClick={() => {
                        setRescheduleModalVisible(false);
                        setRescheduleTarget(null);
                      }}
                    >
                      Hủy
                    </Button>
                  </Space>
                </Form.Item>
              </Form>
            )}
          </Modal>
        </div>
      </div>
    </div>
  );
};

export default MyBookingsPage;
