import React, { useEffect, useMemo, useState } from "react";
import { Card, Typography, Button, Tag, Space, message, Modal, Empty, Spin, DatePicker, Form } from "antd";
import { getCustomerBookingHistory, cancelBooking, canCancelBooking, rescheduleBooking, canModifyBooking, BookingSummary, RescheduleRequest } from "../api/bookingApi";
import {
  CalendarOutlined,
  DollarOutlined,
  DeleteOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const MyBookingsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<BookingSummary[]>([]);
  const [customerId, setCustomerId] = useState<number | null>(null);

  // Try to resolve customer id from session storage (invoiceInfo) or profile token later
  useEffect(() => {
    // Prefer invoiceInfo.idKhachHang saved during booking flow
    const invoiceInfoStr = sessionStorage.getItem("invoiceInfo");
    if (invoiceInfoStr) {
      try {
        const inv = JSON.parse(invoiceInfoStr);
        if (inv?.idKhachHang) {
          setCustomerId(Number(inv.idKhachHang));
          return;
        }
      } catch {}
    }

    // Fallback: if profile API stores user id in localStorage (hs_profile) or token payload
    try {
      const profileStr = localStorage.getItem("hs_profile");
      if (profileStr) {
        const prof = JSON.parse(profileStr);
        if (prof?.idkhachHang) {
          setCustomerId(Number(prof.idkhachHang));
          return;
        }
      }
    } catch {}

    setCustomerId(null);
  }, []);

  const loadData = async (cid: number) => {
    setLoading(true);
    try {
      const list = await getCustomerBookingHistory(cid);
      // Sort by check-in date desc
      list.sort((a, b) => new Date(b.ngayNhanPhong).getTime() - new Date(a.ngayNhanPhong).getTime());
      setBookings(list);
    } catch (err: any) {
      message.error(err.message || "Không thể tải lịch sử đặt phòng");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (customerId != null) {
      loadData(customerId);
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const handleCancel = (b: BookingSummary) => {
    const { canCancel, reason } = canCancelBooking(b);
    if (!canCancel) {
      message.warning(reason || "Không thể hủy đặt phòng này");
      return;
    }

    Modal.confirm({
      title: "Xác nhận hủy đặt phòng",
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          Bạn có chắc muốn hủy mã đặt phòng <strong>{b.bookingCode}</strong>?
          <div style={{ marginTop: 8 }}>
            <Text type="secondary">Hủy miễn phí trước 24 giờ nhận phòng.</Text>
          </div>
        </div>
      ),
      okText: "Hủy đặt phòng",
      okType: "danger",
      cancelText: "Đóng",
      onOk: async () => {
        try {
          await cancelBooking(b.idDatPhong);
          message.success("Đã hủy đặt phòng thành công");
          if (customerId != null) loadData(customerId);
        } catch (err: any) {
          message.error(err.message || "Hủy đặt phòng thất bại");
        }
      },
    });
  };

  // Reschedule state & handlers
  const [rescheduleModalVisible, setRescheduleModalVisible] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<BookingSummary | null>(null);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);

  const openRescheduleModal = (b: BookingSummary) => {
    const { canModify, reason } = canModifyBooking(b);
    if (!canModify) {
      message.warning(reason || 'Không thể thay đổi thời gian đặt phòng');
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
        ngayNhanPhong: dayjs(values.ngayNhanPhong).format('YYYY-MM-DD'),
        ngayTraPhong: dayjs(values.ngayTraPhong).format('YYYY-MM-DD')
      };
      await rescheduleBooking(rescheduleTarget.idDatPhong, payload);
      message.success('Thay đổi thời gian đặt phòng thành công');
      setRescheduleModalVisible(false);
      setRescheduleTarget(null);
      if (customerId != null) loadData(customerId);
    } catch (err: any) {
      message.error(err.message || 'Thay đổi thời gian thất bại');
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

    if (customerId == null) {
      return (
        <Empty
          description={
            <div>
              <div style={{ marginBottom: 8 }}>Bạn chưa đăng nhập hoặc chưa có đặt phòng nào.</div>
              <Button type="primary" onClick={() => (window.location.href = "/#login")}>Đăng nhập</Button>
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
          <Button type="primary" onClick={() => (window.location.href = "/#rooms")}>Đặt phòng ngay</Button>
        </Empty>
      );
    }

    return (
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        {bookings.map((b) => {
          const { canCancel, reason } = canCancelBooking(b);
          const isPaid = b.trangThaiThanhToan === 2;
          const isCancelled = b.trangThai === 2;
          return (
            <Card key={b.idDatPhong}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                <div style={{ minWidth: 260 }}>
                  <Title level={5} style={{ marginBottom: 8 }}>
                    Mã đặt phòng: <Text code>{b.bookingCode}</Text>
                  </Title>
                  <div style={{ marginBottom: 6 }}>
                    <CalendarOutlined style={{ color: "#dfa974" }} />
                    <Text style={{ marginLeft: 8 }}>
                      {new Date(b.ngayNhanPhong).toLocaleDateString("vi-VN")} → {new Date(b.ngayTraPhong).toLocaleDateString("vi-VN")}
                    </Text>
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    <DollarOutlined style={{ color: "#dfa974" }} />
                    <Text style={{ marginLeft: 8 }} strong>{b.tongTien.toLocaleString()}đ</Text>
                  </div>
                  <Space wrap>
                    <Tag color={isCancelled ? "red" : isPaid ? "green" : "orange"}>
                      {b.trangThaiThanhToanText}
                    </Tag>
                    <Tag>{b.trangThaiText}</Tag>
                    <Tag>Phòng: {b.soPhong}</Tag>
                  </Space>
                </div>
                <Space align="center" style={{ marginLeft: "auto" }}>
                  <Button icon={<ReloadOutlined />} onClick={() => customerId!=null && loadData(customerId)}>
                    Tải lại
                  </Button>
                  <Button
                    type="default"
                    onClick={() => openRescheduleModal(b)}
                    title={"Thay đổi ngày nhận/trả phòng"}
                  >
                    Thay đổi thời gian
                  </Button>
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    disabled={!canCancel}
                    onClick={() => handleCancel(b)}
                    title={canCancel ? "Hủy đặt phòng" : (reason || "")}
                  >
                    Hủy đặt phòng
                  </Button>
                </Space>
              </div>
            </Card>
          );
        })}
      </Space>
    );
  }, [loading, customerId, bookings]);

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
            title={rescheduleTarget ? `Thay đổi thời gian: ${rescheduleTarget.bookingCode}` : 'Thay đổi thời gian'}
            open={rescheduleModalVisible}
            onCancel={() => { setRescheduleModalVisible(false); setRescheduleTarget(null); }}
            footer={null}
          >
            {rescheduleTarget && (
              <Form layout="vertical" onFinish={onFinishReschedule} initialValues={{
                ngayNhanPhong: dayjs(rescheduleTarget.ngayNhanPhong),
                ngayTraPhong: dayjs(rescheduleTarget.ngayTraPhong)
              }}>
                <Form.Item label="Ngày nhận phòng" name="ngayNhanPhong" rules={[{ required: true, message: 'Chọn ngày nhận phòng' }]}> 
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item label="Ngày trả phòng" name="ngayTraPhong" rules={[{ required: true, message: 'Chọn ngày trả phòng' }]}> 
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item>
                  <Space>
                    <Button htmlType="submit" type="primary" loading={rescheduleLoading}>Xác nhận thay đổi</Button>
                    <Button onClick={() => { setRescheduleModalVisible(false); setRescheduleTarget(null); }}>Hủy</Button>
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
