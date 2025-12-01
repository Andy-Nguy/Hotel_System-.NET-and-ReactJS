import React, { useEffect, useState } from "react";
import {
  getBookings,
  Booking,
  updateBooking,
  deleteBooking,
} from "../../api/bookingApi";
import {
  Tag,
  Button,
  Popconfirm,
  Input,
  Select,
  Tabs,
  Modal,
  Descriptions,
  Typography,
  List,
  Divider,
  Space,
  Card,
  Avatar,
} from "antd";
import {
  SearchOutlined,
  UserOutlined,
  HomeOutlined,
  CalendarOutlined,
  CreditCardOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import BookingTable from "./BookingTable";
import {
  getStatusColor,
  getStatusLabel,
  getPaymentStatusColor,
  getPaymentStatusLabel,
} from "../utils/bookingUtils";

const BookingSection: React.FC = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    try {
      const data = await getBookings();
      setBookings(data);
    } catch (error) {
      console.error("Failed to load bookings", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: number) => {
    try {
      await updateBooking(id, { trangThai: newStatus });
      await loadBookings(); // Reload list
      alert("Cập nhật trạng thái thành công!");
    } catch (error) {
      console.error("Failed to update booking", error);
      alert("Lỗi khi cập nhật trạng thái.");
    }
  };

  const handleUpdatePaymentStatus = async (
    id: string,
    newPaymentStatus: number
  ) => {
    try {
      await updateBooking(id, { trangThaiThanhToan: newPaymentStatus });
      await loadBookings(); // Reload list
      alert("Cập nhật trạng thái thanh toán thành công!");
    } catch (error) {
      console.error("Failed to update payment status", error);
      alert("Lỗi khi cập nhật trạng thái thanh toán.");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBooking(id);
      await loadBookings(); // Reload list
      alert("Xóa đặt phòng thành công!");
    } catch (error) {
      console.error("Failed to delete booking", error);
      alert("Lỗi khi xóa đặt phòng.");
    }
  };

  const handleConfirmBooking = async (id: string) => {
    try {
      await updateBooking(id, { trangThai: 2 });
      await loadBookings();
      alert("Đã xác nhận và gửi mail (nếu cấu hình SMTP).");
    } catch (error) {
      console.error("Failed to confirm booking", error);
      alert("Lỗi khi xác nhận đặt phòng.");
    }
  };

  const handleCancelBooking = async (id: string) => {
    try {
      await updateBooking(id, { trangThai: 0 });
      await loadBookings();
      alert("Đã huỷ đặt phòng và gửi mail (nếu cấu hình SMTP).");
    } catch (error) {
      console.error("Failed to cancel booking", error);
      alert("Lỗi khi huỷ đặt phòng.");
    }
  };

  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showModal, setShowModal] = useState(false);

  const openModal = (b: Booking) => {
    setSelectedBooking(b);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedBooking(null);
  };

  const filteredBookings = bookings.filter((b) => {
    if (statusFilter && b.trangThai.toString() !== statusFilter) return false;
    if (query) {
      const q = query.toLowerCase();
      if (
        !(
          b.tenKhachHang?.toLowerCase().includes(q) ||
          b.tenPhong?.toLowerCase().includes(q) ||
          b.iddatPhong.toLowerCase().includes(q)
        )
      )
        return false;
    }
    return true;
  });

  // Split bookings into two groups
  const activeBookings = filteredBookings.filter((b) =>
    [1, 2, 3].includes(b.trangThai)
  );
  const historyBookings = filteredBookings.filter((b) =>
    [0, 4].includes(b.trangThai)
  );

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
          paddingBottom: 16,
          borderBottom: "2px solid #f1f5f9",
        }}
      >
        <div>
          <div style={{ color: "#6b7280", fontSize: 13 }}>
            {bookings.length} đặt phòng tổng • {filteredBookings.length} hiển
            thị
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Input
            placeholder="Tìm kiếm tên, phòng, mã..."
            prefix={<SearchOutlined style={{ color: "#9CA3AF" }} />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: 280, borderRadius: 10 }}
          />

          <Select
            value={statusFilter}
            onChange={(value) => setStatusFilter(value)}
            style={{ width: 160 }}
            options={[
              { value: "", label: "Tất cả trạng thái" },
              { value: "0", label: "Đã hủy" },
              { value: "1", label: "Chờ xác nhận" },
              { value: "2", label: "Đã xác nhận" },
              { value: "3", label: "Đã trả phòng" },
            ]}
          />
        </div>
      </div>

      <Tabs
        defaultActiveKey="1"
        items={[
          {
            key: "1",
            label: `Đang xử lý / Phục vụ (${activeBookings.length})`,
            children: (
              <BookingTable
                bookings={activeBookings}
                loading={loading}
                onConfirm={handleConfirmBooking}
                onCancel={handleCancelBooking}
                onViewDetail={openModal}
              />
            ),
          },
          {
            key: "2",
            label: `Lịch sử (${historyBookings.length})`,
            children: (
              <BookingTable
                bookings={historyBookings}
                loading={loading}
                onConfirm={handleConfirmBooking}
                onCancel={handleCancelBooking}
                onViewDetail={openModal}
                showActions={false}
              />
            ),
          },
        ]}
      />

      {/* Modal: booking details */}
      <Modal
        title={
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              paddingBottom: 8,
              borderBottom: "1px solid #f0f0f0",
            }}
          >
            <Avatar
              size="large"
              icon={<FileTextOutlined />}
              style={{ backgroundColor: "#1890ff" }}
            />
            <div>
              <Typography.Title level={4} style={{ margin: 0 }}>
                Chi tiết đặt phòng
              </Typography.Title>
              <Typography.Text type="secondary" style={{ fontSize: 14 }}>
                #{selectedBooking?.iddatPhong}
              </Typography.Text>
            </div>
          </div>
        }
        open={showModal && !!selectedBooking}
        onCancel={closeModal}
        width={1200}
        footer={null}
        styles={{ body: { padding: "24px 24px 40px" } }}
        centered
      >
        {selectedBooking && (
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <Card
              bordered={false}
              style={{ background: "#f9fafb", borderRadius: 12 }}
            >
              <Descriptions
                column={{ xxl: 2, xl: 2, lg: 2, md: 1, sm: 1, xs: 1 }}
                labelStyle={{ color: "#6b7280", fontWeight: 500 }}
                contentStyle={{ fontWeight: 600, color: "#1f2937" }}
              >
                <Descriptions.Item
                  label={
                    <Space>
                      <UserOutlined /> Khách hàng
                    </Space>
                  }
                >
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: 16 }}>
                      {selectedBooking.tenKhachHang || "N/A"}
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 400,
                        color: "#9ca3af",
                      }}
                    >
                      {selectedBooking.emailKhachHang}
                    </span>
                  </div>
                </Descriptions.Item>

                <Descriptions.Item
                  label={
                    <Space>
                      <HomeOutlined /> Phòng
                    </Space>
                  }
                >
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: 16 }}>
                      {selectedBooking.tenPhong || selectedBooking.idphong}
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 400,
                        color: "#9ca3af",
                      }}
                    >
                      Số phòng: {selectedBooking.soPhong || "—"}
                    </span>
                  </div>
                </Descriptions.Item>

                <Descriptions.Item
                  label={
                    <Space>
                      <CalendarOutlined /> Thời gian lưu trú
                    </Space>
                  }
                >
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span>
                      {selectedBooking.ngayNhanPhong
                        ? new Date(
                            selectedBooking.ngayNhanPhong
                          ).toLocaleDateString("vi-VN")
                        : "N/A"}{" "}
                      —{" "}
                      {selectedBooking.ngayTraPhong
                        ? new Date(
                            selectedBooking.ngayTraPhong
                          ).toLocaleDateString("vi-VN")
                        : "N/A"}
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 400,
                        color: "#9ca3af",
                      }}
                    >
                      ({selectedBooking.soDem} đêm)
                    </span>
                  </div>
                </Descriptions.Item>

                <Descriptions.Item
                  label={
                    <Space>
                      <CreditCardOutlined /> Thanh toán
                    </Space>
                  }
                >
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 4 }}
                  >
                    <span style={{ fontSize: 18, color: "#059669" }}>
                      {selectedBooking.tongTien?.toLocaleString()} VND
                    </span>
                    <Space>
                      <Tag
                        color={getPaymentStatusColor(
                          selectedBooking.trangThaiThanhToan
                        )}
                      >
                        {getPaymentStatusLabel(
                          selectedBooking.trangThaiThanhToan
                        )}
                      </Tag>
                      {selectedBooking.tienCoc &&
                        selectedBooking.tienCoc > 0 && (
                          <Tag color="orange">
                            Cọc: {selectedBooking.tienCoc.toLocaleString()}
                          </Tag>
                        )}
                    </Space>
                  </div>
                </Descriptions.Item>

                <Descriptions.Item
                  label={
                    <Space>
                      <InfoCircleOutlined /> Trạng thái đơn
                    </Space>
                  }
                >
                  <Tag
                    style={{ fontSize: 14, padding: "4px 10px" }}
                    color={getStatusColor(selectedBooking.trangThai)}
                  >
                    {getStatusLabel(selectedBooking.trangThai)}
                  </Tag>
                </Descriptions.Item>

                <Descriptions.Item label="Ghi chú">
                  <span style={{ fontWeight: 400 }}>
                    {(selectedBooking as any).ghiChu ||
                      (selectedBooking as any).note ||
                      "Không có"}
                  </span>
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {selectedBooking.chiTietDatPhongs &&
              selectedBooking.chiTietDatPhongs.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <Typography.Title level={5} style={{ marginBottom: 16 }}>
                    Chi tiết phòng đặt
                  </Typography.Title>
                  <List
                    grid={{ gutter: 16, column: 2 }}
                    dataSource={selectedBooking.chiTietDatPhongs}
                    renderItem={(item) => (
                      <List.Item>
                        <Card
                          size="small"
                          hoverable
                          style={{
                            borderRadius: 8,
                            border: "1px solid #e5e7eb",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "start",
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 15 }}>
                                {item.tenPhongChiTiet || item.idPhong}
                              </div>
                              <div style={{ color: "#6b7280", fontSize: 13 }}>
                                {item.soDem} đêm x{" "}
                                {item.giaPhong.toLocaleString()}
                              </div>
                            </div>
                            <div style={{ fontWeight: 700, color: "#059669" }}>
                              {item.thanhTien.toLocaleString()} đ
                            </div>
                          </div>
                          {item.ghiChu && (
                            <div
                              style={{
                                marginTop: 8,
                                fontSize: 12,
                                color: "#9ca3af",
                                fontStyle: "italic",
                              }}
                            >
                              "{item.ghiChu}"
                            </div>
                          )}
                        </Card>
                      </List.Item>
                    )}
                  />
                </div>
              )}

            {selectedBooking.dichVuDaChon &&
              selectedBooking.dichVuDaChon.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <Typography.Title level={5} style={{ marginBottom: 16 }}>
                    Dịch vụ đã chọn
                  </Typography.Title>
                  <List
                    grid={{ gutter: 16, column: 2 }}
                    dataSource={selectedBooking.dichVuDaChon}
                    renderItem={(item) => (
                      <List.Item>
                        <Card
                          size="small"
                          hoverable
                          style={{
                            borderRadius: 8,
                            border: "1px solid #e5e7eb",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "start",
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 15 }}>
                                {item.tenDichVu || item.iddichVu}
                              </div>
                              <div style={{ color: "#6b7280", fontSize: 13 }}>
                                {item.soLuong || 1} x{" "}
                                {item.giaDichVu?.toLocaleString() || "N/A"}
                              </div>
                            </div>
                            <div style={{ fontWeight: 700, color: "#059669" }}>
                              {(
                                item.thanhTien ||
                                (item.giaDichVu && item.soLuong
                                  ? item.giaDichVu * item.soLuong
                                  : item.giaDichVu)
                              )?.toLocaleString()}{" "}
                              đ
                            </div>
                          </div>
                          {item.ghiChu && (
                            <div
                              style={{
                                marginTop: 8,
                                fontSize: 12,
                                color: "#9ca3af",
                                fontStyle: "italic",
                              }}
                            >
                              "{item.ghiChu}"
                            </div>
                          )}
                        </Card>
                      </List.Item>
                    )}
                  />
                </div>
              )}

            <Divider style={{ margin: "12px 0" }} />

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                background: "#f8fafc",
                padding: 16,
                borderRadius: 8,
              }}
            >
              <Space>
                {selectedBooking.trangThai === 1 && (
                  <Button
                    type="primary"
                    style={{ background: "#10b981", borderColor: "#10b981" }}
                    onClick={async () => {
                      if (!selectedBooking) return;
                      await handleConfirmBooking(selectedBooking.iddatPhong);
                      closeModal();
                    }}
                  >
                    Xác nhận
                  </Button>
                )}
                <Button onClick={closeModal}>Đóng</Button>
                <Popconfirm
                  title="Xóa đặt phòng?"
                  description="Hành động này không thể hoàn tác!"
                  onConfirm={async () => {
                    if (!selectedBooking) return;
                    await handleDelete(selectedBooking.iddatPhong);
                    closeModal();
                  }}
                  okText="Xóa ngay"
                  cancelText="Hủy"
                  okButtonProps={{ danger: true }}
                >
                  <Button danger type="primary">
                    Xóa đặt phòng
                  </Button>
                </Popconfirm>
              </Space>
            </div>
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default BookingSection;
