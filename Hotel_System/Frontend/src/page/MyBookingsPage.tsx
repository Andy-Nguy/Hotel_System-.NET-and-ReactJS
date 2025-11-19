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

  // Cancel button removed - no UI trigger

  // Reschedule state & handlers
  const [rescheduleModalVisible, setRescheduleModalVisible] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] =
    useState<BookingSummary | null>(null);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  // Details modal
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsData, setDetailsData] = useState<any | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);

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

  const openDetails = (idDatPhong: string) => {
    setDetailsModalVisible(true);
    setDetailsLoading(false);
    setDetailsData(null);
    setDetailsError(null);

    const cached = bookings.find((b) => b.idDatPhong === idDatPhong);
    if (!cached) {
      setDetailsError("Không tìm thấy chi tiết đặt phòng trong bộ nhớ.");
      return;
    }

    const d = {
      IddatPhong:
        cached.idDatPhong ||
        (cached as any).IddatPhong ||
        (cached as any).IdDatPhong ||
        (cached as any).iddatPhong,
      IdkhachHang:
        (cached as any).idkhachHang || (cached as any).IdkhachHang || undefined,
      TenKhachHang: cached.tenKhachHang || (cached as any).TenKhachHang || "",
      EmailKhachHang:
        cached.emailKhachHang || (cached as any).EmailKhachHang || "",
      NgayDatPhong: cached.ngayDatPhong,
      NgayNhanPhong: cached.ngayNhanPhong,
      NgayTraPhong: cached.ngayTraPhong,
      TongTien:
        cached.tongTien || (cached as any).TongTien || (cached as any).tongTien,
      TienCoc: (cached as any).tienCoc || (cached as any).TienCoc,
      TrangThai: cached.trangThai,
      TrangThaiThanhToan: cached.trangThaiThanhToan,
      ChiTietDatPhongs: (cached.rooms || (cached as any).ChiTietDatPhongs || [])
        .map((r: any) => ({
          TenPhongChiTiet:
            r.tenPhong || r.TenPhong || r.TenPhongChiTiet || r.tenPhongChiTiet,
          tenPhong:
            r.tenPhong || r.TenPhong || r.TenPhongChiTiet || r.tenPhongChiTiet,
          SoPhongChiTiet:
            r.soPhong || r.SoPhong || r.SoPhongChiTiet || r.soPhongChiTiet,
          soPhong:
            r.soPhong || r.SoPhong || r.SoPhongChiTiet || r.soPhongChiTiet,
          GiaPhong: r.giaPhong || r.GiaPhong,
          giaPhong: r.giaPhong || r.GiaPhong,
          SoDem: r.soDem || r.SoDem,
          soDem: r.soDem || r.SoDem,
          ThanhTien: r.thanhTien || r.ThanhTien,
          thanhTien: r.thanhTien || r.ThanhTien,
        }))
        .map((ct: any) => ({
          ...ct,
          moTa: ct.moTa || ct.MoTaPhongChiTiet || ct.MoTa,
          giaCoBanMotDem: ct.giaCoBanMotDem || ct.GiaCoBanMotDem,
          idLoaiPhong: ct.idLoaiPhong || ct.IdLoaiPhong,
          tenLoaiPhong: ct.tenLoaiPhong || ct.TenLoaiPhong,
          urlAnhPhong: ct.urlAnhPhong || ct.UrlAnhPhong,
          soNguoiToiDa: ct.soNguoiToiDa || ct.SoNguoiToiDa,
          xepHangSao: ct.xepHangSao || ct.XepHangSao,
        })),
      Services: cached.services || [],
    } as any;

    setDetailsData(d);
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
          const { statusColor, paymentColor } = getStatusBadge(
            b.trangThai,
            b.trangThaiThanhToan
          );
          const isCancelled = b.trangThai === 0;

          return (
            <Card
              key={b.idDatPhong}
              hoverable
              onClick={() => openDetails(b.idDatPhong)}
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
                      openDetails(b.idDatPhong);
                    }}
                    title={"Xem chi tiết"}
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
                    <div style={{ marginBottom: 8 }}>
                      <Text strong style={{ fontSize: 15 }}>
                        Khách hàng: {b.tenKhachHang || "N/A"}
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

                  {b.services && b.services.length > 0 && (
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <Text type="secondary" style={{ fontSize: 13 }}>
                        Dịch vụ kèm theo:
                      </Text>
                      <div style={{ marginTop: 6 }}>
                        {b.services.slice(0, 2).map((s, i) => (
                          <Tag
                            key={i}
                            style={{ marginBottom: 4, fontSize: 12 }}
                          >
                            {s.tenDichVu}
                          </Tag>
                        ))}
                        {b.services.length > 2 && (
                          <Tag style={{ fontSize: 12 }}>
                            +{b.services.length - 2} khác
                          </Tag>
                        )}
                      </div>
                    </div>
                  )}
                </div>
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

          {/* Details Modal */}
          <Modal
            title="Chi tiết đặt phòng"
            open={detailsModalVisible}
            onCancel={() => {
              setDetailsModalVisible(false);
              setDetailsData(null);
            }}
            footer={null}
            width={800}
            zIndex={10050}
            style={{ top: 90 }}
            bodyStyle={{ maxHeight: "60vh", overflow: "auto" }}
            centered
            destroyOnClose
          >
            {detailsLoading ? (
              <div style={{ textAlign: "center", padding: 40 }}>
                <Spin />
              </div>
            ) : detailsData ? (
              <div>
                {/* STATUS SECTION - Most prominent at top */}
                <div
                  style={{
                    padding: 16,
                    background: "#fafafa",
                    borderRadius: 8,
                    marginBottom: 20,
                    border: "1px solid #f0f0f0",
                  }}
                >
                  <div style={{ marginBottom: 8 }}>
                    <Text type="secondary">Trạng thái đặt phòng</Text>
                  </div>
                  {(() => {
                    const trangThai = getProp(
                      detailsData,
                      "TrangThai",
                      "trangThai"
                    ) as number;
                    const trangThaiThanhToan = getProp(
                      detailsData,
                      "TrangThaiThanhToan",
                      "trangThaiThanhToan"
                    ) as number;
                    const { statusColor, paymentColor } = getStatusBadge(
                      trangThai,
                      trangThaiThanhToan
                    );

                    // Map status text
                    let statusText = "Không xác định";
                    switch (trangThai) {
                      case 1:
                        statusText = "Chờ xác nhận";
                        break;
                      case 2:
                        statusText = "Đã xác nhận";
                        break;
                      case 0:
                        statusText = "Đã hủy";
                        break;
                      case 3:
                        statusText = "Đang sử dụng";
                        break;
                      case 4:
                        statusText = "Hoàn thành";
                        break;
                    }

                    let paymentText = "Không xác định";
                    switch (trangThaiThanhToan) {
                      case 1:
                        paymentText = "Chưa thanh toán";
                        break;
                      case 2:
                        paymentText = "Đã thanh toán";
                        break;
                      case 0:
                        paymentText = "Đã cọc";
                        break;
                    }

                    return (
                      <Space size={12}>
                        <Tag
                          color={statusColor}
                          style={{
                            fontSize: 16,
                            padding: "6px 16px",
                            margin: 0,
                          }}
                        >
                          {statusText}
                        </Tag>
                        <Tag
                          color={paymentColor}
                          style={{
                            fontSize: 16,
                            padding: "6px 16px",
                            margin: 0,
                          }}
                        >
                          {paymentText}
                        </Tag>
                      </Space>
                    );
                  })()}
                </div>

                {/* BOOKING INFO */}
                <div style={{ marginBottom: 16 }}>
                  <Title level={5} style={{ marginBottom: 12 }}>
                    Thông tin đặt phòng
                  </Title>
                  <p style={{ marginBottom: 8 }}>
                    <strong>Khách hàng:</strong>{" "}
                    {getProp(detailsData, "TenKhachHang", "tenKhachHang") ||
                      "N/A"}
                  </p>
                  <p style={{ marginBottom: 8 }}>
                    <strong>Email:</strong>{" "}
                    {getProp(detailsData, "EmailKhachHang", "emailKhachHang") ||
                      "N/A"}
                  </p>
                  <p style={{ marginBottom: 8 }}>
                    <strong>Ngày đặt:</strong>{" "}
                    {getProp(detailsData, "NgayDatPhong", "ngayDatPhong")
                      ? new Date(
                          getProp(detailsData, "NgayDatPhong", "ngayDatPhong")
                        ).toLocaleDateString("vi-VN")
                      : "N/A"}
                  </p>
                  <p style={{ marginBottom: 8 }}>
                    <strong>Nhận phòng:</strong>{" "}
                    {getProp(detailsData, "NgayNhanPhong", "ngayNhanPhong")
                      ? new Date(
                          getProp(detailsData, "NgayNhanPhong", "ngayNhanPhong")
                        ).toLocaleDateString("vi-VN")
                      : "N/A"}
                  </p>
                  <p style={{ marginBottom: 8 }}>
                    <strong>Trả phòng:</strong>{" "}
                    {getProp(detailsData, "NgayTraPhong", "ngayTraPhong")
                      ? new Date(
                          getProp(detailsData, "NgayTraPhong", "ngayTraPhong")
                        ).toLocaleDateString("vi-VN")
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
                      {Number(
                        getProp(detailsData, "TongTien", "tongTien") ?? 0
                      ).toLocaleString()}{" "}
                      đ
                    </Text>
                  </p>
                  <p style={{ marginBottom: 0 }}>
                    <strong>Tiền cọc:</strong>{" "}
                    {Number(
                      getProp(detailsData, "TienCoc", "tienCoc") ?? 0
                    ).toLocaleString()}{" "}
                    đ
                  </p>
                </div>

                <div style={{ marginTop: 16 }}>
                  <Title level={5} style={{ marginBottom: 12 }}>
                    Chi tiết phòng
                  </Title>
                  {(
                    getProp(
                      detailsData,
                      "ChiTietDatPhongs",
                      "chiTietDatPhongs",
                      "ChiTiet"
                    ) || []
                  ).length ? (
                    <Space
                      direction="vertical"
                      size={12}
                      style={{ width: "100%" }}
                    >
                      {(
                        getProp(
                          detailsData,
                          "ChiTietDatPhongs",
                          "chiTietDatPhongs",
                          "ChiTiet"
                        ) || []
                      ).map((ct: any, idx: number) => (
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
                              {ct?.tenPhong ??
                                ct?.TenPhong ??
                                ct?.TenPhongChiTiet ??
                                ct?.Phong?.TenPhong ??
                                ct?.Phong?.tenPhong}
                            </Text>
                            <Tag color="blue" style={{ marginLeft: 8 }}>
                              {ct?.soPhong ??
                                ct?.SoPhong ??
                                ct?.SoPhongChiTiet ??
                                ct?.Phong?.SoPhong ??
                                ct?.Phong?.soPhong}
                            </Tag>
                          </div>
                          <div style={{ marginBottom: 4 }}>
                            <Text type="secondary">Loại phòng: </Text>
                            <Text>{ct?.tenLoaiPhong || ct?.TenLoaiPhong}</Text>
                          </div>
                          <div
                            style={{ display: "flex", gap: 20, marginTop: 8 }}
                          >
                            <div>
                              <Text type="secondary">Giá/đêm: </Text>
                              <Text strong>
                                {(() => {
                                  const pricePerNight =
                                    ct?.giaPhong ??
                                    ct?.GiaPhong ??
                                    ct?.giaCoBanMotDem ??
                                    ct?.GiaCoBanMotDem ??
                                    0;
                                  return Number(pricePerNight).toLocaleString();
                                })()}{" "}
                                đ
                              </Text>
                            </div>
                            <div>
                              <Text type="secondary">Số đêm: </Text>
                              <Text>{ct?.SoDem ?? ct?.soDem}</Text>
                            </div>
                            {ct?.soNguoiToiDa && (
                              <div>
                                <Text type="secondary">Sức chứa: </Text>
                                <Text>{ct?.soNguoiToiDa} khách</Text>
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
                              {ct?.ThanhTien ?? ct?.thanhTien} đ
                            </Text>
                          </div>
                          {ct?.moTa && (
                            <div style={{ marginTop: 8 }}>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                {ct?.moTa}
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
                <div style={{ marginTop: 16 }}>
                  <Title level={5} style={{ marginBottom: 12 }}>
                    Dịch vụ kèm theo
                  </Title>
                  {detailsData?.Services && detailsData.Services.length ? (
                    <Space
                      direction="vertical"
                      size={8}
                      style={{ width: "100%" }}
                    >
                      {detailsData.Services.map((s: any, idx: number) => (
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
                            <Text strong>{s.tenDichVu ?? s.TenDichVu}</Text>
                            {s.thoiGianThucHien || s.ThoiGianThucHien ? (
                              <div>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  {s.thoiGianThucHien || s.ThoiGianThucHien}
                                </Text>
                              </div>
                            ) : null}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              gap: 12,
                              alignItems: "center",
                            }}
                          >
                            <Text strong style={{ color: "#dfa974" }}>
                              {Number(
                                s.tienDichVu || s.TienDichVu || 0
                              ).toLocaleString()}{" "}
                              đ
                            </Text>
                            {s.trangThai || s.TrangThai ? (
                              <Tag color="green" style={{ margin: 0 }}>
                                {s.trangThai || s.TrangThai}
                              </Tag>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </Space>
                  ) : (
                    <Empty description="Không có dịch vụ kèm theo" />
                  )}
                </div>
                {/* removed raw debug output to keep UI clean */}
              </div>
            ) : detailsError ? (
              <div style={{ color: "red" }}>{detailsError}</div>
            ) : (
              <div>Không có dữ liệu.</div>
            )}
          </Modal>
        </div>
      </div>
    </div>
  );
};

export default MyBookingsPage;
