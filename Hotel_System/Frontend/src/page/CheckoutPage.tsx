import React, { useEffect, useState } from "react";
import {
  Layout,
  Card,
  Typography,
  Row,
  Col,
  Button,
  Form,
  Input,
  Select,
  Divider,
  Alert,
  Modal,
} from "antd";
import {
  CreditCardOutlined,
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  HomeOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import BookingProgress from "../components/BookingProgress";

const { Content } = Layout;
const { Title, Text } = Typography;
const { TextArea } = Input;

interface SelectedRoom {
  roomNumber: number;
  room: any;
}

interface BookingInfo {
  selectedRooms: SelectedRoom[];
  checkIn: string;
  checkOut: string;
  guests: number;
  totalRooms: number;
  promotion?: {
    idkhuyenMai?: string;
    tenKhuyenMai?: string;
    loaiGiamGia?: string;
    giaTriGiam?: number;
  } | null;
}

const CheckoutPage: React.FC = () => {
  const [form] = Form.useForm();
  const [bookingInfo, setBookingInfo] = useState<BookingInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Lấy thông tin đặt phòng từ sessionStorage
    const bookingData = sessionStorage.getItem("bookingInfo");
    if (bookingData) {
      try {
        const parsed = JSON.parse(bookingData);
        setBookingInfo(parsed);
      } catch (e) {
        setError("Không thể tải thông tin đặt phòng");
      }
    } else {
      setError("Không tìm thấy thông tin đặt phòng. Vui lòng chọn phòng lại.");
    }
  }, []);

  const calculateTotal = () => {
    if (!bookingInfo) return 0;

    const checkInDate = new Date(bookingInfo.checkIn);
    const checkOutDate = new Date(bookingInfo.checkOut);
    const nights = Math.ceil(
      (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const totalPrice = bookingInfo.selectedRooms.reduce((sum, sr) => {
      return sum + (sr.room.giaCoBanMotDem || 0) * nights;
    }, 0);

    return totalPrice;
  };

  const calculateNights = () => {
    if (!bookingInfo) return 0;
    const checkInDate = new Date(bookingInfo.checkIn);
    const checkOutDate = new Date(bookingInfo.checkOut);
    return Math.ceil(
      (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
    );
  };

  const handleSubmit = async (values: any) => {
    if (!bookingInfo) return;

    setLoading(true);
    try {
      // TODO: Gọi API để tạo đơn đặt phòng
      // const response = await createBooking({
      //   ...values,
      //   rooms: bookingInfo.selectedRooms.map(sr => sr.room.idphong),
      //   checkIn: bookingInfo.checkIn,
      //   checkOut: bookingInfo.checkOut,
      //   guests: bookingInfo.guests,
      // });

      // Giả lập thành công
      await new Promise((resolve) => setTimeout(resolve, 2000));

      Modal.success({
        title: "Đặt phòng thành công!",
        content: (
          <div>
            <p>
              Cảm ơn bạn đã đặt phòng tại <strong>Robins Villa</strong>
            </p>
            <p>
              Chúng tôi đã gửi email xác nhận đến:{" "}
              <strong>{values.email}</strong>
            </p>
            <p>
              Mã đặt phòng của bạn:{" "}
              <strong>BK{Date.now().toString().slice(-8)}</strong>
            </p>
          </div>
        ),
        onOk: () => {
          // Xóa thông tin đặt phòng từ sessionStorage
          sessionStorage.removeItem("bookingInfo");
          sessionStorage.removeItem("bookingResults");
          window.location.href = "/";
        },
      });
    } catch (err: any) {
      Modal.error({
        title: "Đặt phòng thất bại",
        content: err.message || "Đã có lỗi xảy ra. Vui lòng thử lại.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <Layout>
        <Content style={{ padding: "50px" }}>
          <Alert
            type="error"
            message="Lỗi"
            description={error}
            showIcon
            action={
              <Button
                type="primary"
                onClick={() => (window.location.href = "/rooms")}
              >
                Quay lại tìm kiếm
              </Button>
            }
          />
        </Content>
      </Layout>
    );
  }

  if (!bookingInfo) {
    return (
      <Layout>
        <Content style={{ padding: "50px", textAlign: "center" }}>
          <div>Đang tải...</div>
        </Content>
      </Layout>
    );
  }

  const totalBefore = calculateTotal();
  const nights = calculateNights();

  const promotion = (bookingInfo as any).promotion;

  // Calculate total after applying promotion per-room per-night
  let totalAfter = 0;
  bookingInfo.selectedRooms.forEach((sr) => {
    const original = Number(sr.room.giaCoBanMotDem || 0);
    let discountedPerNight = original;
    if (promotion) {
      if (promotion.loaiGiamGia === "percent") {
        discountedPerNight = Math.round(original * (1 - Number(promotion.giaTriGiam || 0) / 100));
      } else {
        // assume fixed amount off per night
        discountedPerNight = Math.max(0, original - Number(promotion.giaTriGiam || 0));
      }
    }
    totalAfter += discountedPerNight * nights;
  });

  const discountAmount = Math.max(0, totalBefore - totalAfter);
  const totalPrice = totalAfter; // Show total as price after promotion x nights
  const tax = totalPrice * 0.1; // 10% thuế on discounted price
  const grandTotal = totalPrice + tax;

  return (
    <Layout>
      <Content
        style={{
          padding: "24px 50px",
          maxWidth: "1400px",
          margin: "auto",
          width: "100%",
        }}
      >
        <BookingProgress
          totalRooms={bookingInfo?.totalRooms || 1}
          currentStage="checkout"
          selectedRoomNumbers={
            bookingInfo?.selectedRooms?.map((sr) => sr.roomNumber) || []
          }
        />

        <Title level={2} style={{ marginBottom: 24, textAlign: "center" }}>
          Hoàn tất đặt phòng của bạn
        </Title>

        <Row gutter={[24, 24]}>
          {/* Left: Form thông tin khách hàng */}
          <Col xs={24} lg={14}>
            <Card title="Thông tin khách hàng">
              <Form
                form={form}
                layout="vertical"
                onFinish={handleSubmit}
                initialValues={{
                  paymentMethod: "credit-card",
                }}
              >
                <Row gutter={16}>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      label="Họ và tên"
                      name="fullName"
                      rules={[
                        { required: true, message: "Vui lòng nhập họ tên" },
                      ]}
                    >
                      <Input
                        prefix={<UserOutlined />}
                        placeholder="Nguyễn Văn A"
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      label="Email"
                      name="email"
                      rules={[
                        { required: true, message: "Vui lòng nhập email" },
                        { type: "email", message: "Email không hợp lệ" },
                      ]}
                    >
                      <Input
                        prefix={<MailOutlined />}
                        placeholder="example@email.com"
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      label="Số điện thoại"
                      name="phone"
                      rules={[
                        {
                          required: true,
                          message: "Vui lòng nhập số điện thoại",
                        },
                      ]}
                    >
                      <Input
                        prefix={<PhoneOutlined />}
                        placeholder="0912345678"
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item label="CMND/CCCD" name="idNumber">
                      <Input placeholder="001234567890" />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item label="Địa chỉ" name="address">
                  <Input prefix={<HomeOutlined />} placeholder="Địa chỉ" />
                </Form.Item>

                <Form.Item label="Ghi chú" name="notes">
                  <TextArea
                    rows={3}
                    placeholder="Yêu cầu đặc biệt (tùy chọn)"
                  />
                </Form.Item>

                <Divider />

                <Title level={4}>Phương thức thanh toán</Title>
                <Form.Item name="paymentMethod">
                  <Select>
                    <Select.Option value="credit-card">
                      <CreditCardOutlined /> Thẻ tín dụng/Ghi nợ
                    </Select.Option>
                    <Select.Option value="bank-transfer">
                      Chuyển khoản ngân hàng
                    </Select.Option>
                    <Select.Option value="cash">
                      Thanh toán tại quầy
                    </Select.Option>
                    <Select.Option value="momo">Ví MoMo</Select.Option>
                    <Select.Option value="vnpay">VNPay</Select.Option>
                  </Select>
                </Form.Item>

                <Button
                  type="primary"
                  htmlType="submit"
                  size="large"
                  block
                  loading={loading}
                  icon={<CheckCircleOutlined />}
                  style={{
                    background: "#dfa974",
                    borderColor: "#dfa974",
                    height: 50,
                    fontSize: 16,
                    fontWeight: 600,
                  }}
                >
                  Xác nhận đặt phòng
                </Button>
              </Form>
            </Card>
          </Col>

          {/* Right: Tóm tắt đơn đặt phòng */}
          <Col xs={24} lg={10}>
            <Card
              title="Chi tiết đặt phòng"
              style={{ position: "sticky", top: 24 }}
            >
              <div style={{ marginBottom: 16 }}>
                <Text strong>Thông tin lưu trú</Text>
                <div style={{ marginTop: 8 }}>
                  <Text>Nhận phòng: </Text>
                  <Text strong>{bookingInfo.checkIn}</Text>
                </div>
                <div>
                  <Text>Trả phòng: </Text>
                  <Text strong>{bookingInfo.checkOut}</Text>
                </div>
                <div>
                  <Text>Số đêm: </Text>
                  <Text strong>{nights} đêm</Text>
                </div>
                <div>
                  <Text>Số người: </Text>
                  <Text strong>{bookingInfo.guests} người</Text>
                </div>
              </div>

              <Divider />

              <div style={{ marginBottom: 16 }}>
                <Text strong>Danh sách phòng đã chọn</Text>
                {bookingInfo.selectedRooms.map((sr, index) => (
                  <Card
                    key={index}
                    size="small"
                    style={{
                      marginTop: 12,
                      background: "#fafafa",
                    }}
                  >
                    <div style={{ display: "flex", gap: 12 }}>
                      {sr.room.urlAnhPhong && (
                        <img
                          src={sr.room.urlAnhPhong}
                          alt={sr.room.tenPhong}
                          style={{
                            width: 80,
                            height: 80,
                            objectFit: "cover",
                            borderRadius: 4,
                          }}
                        />
                      )}
                      <div style={{ flex: 1 }}>
                        <Text strong>Phòng {sr.roomNumber}</Text>
                        <br />
                        <Text>{sr.room.tenPhong || sr.room.soPhong}</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {(sr.room.giaCoBanMotDem || 0).toLocaleString()}đ x{" "}
                          {nights} đêm
                        </Text>
                        <br />
                        <Text strong style={{ color: "#dfa974" }}>
                          {(
                            (sr.room.giaCoBanMotDem || 0) * nights
                          ).toLocaleString()}
                          đ
                        </Text>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              <Divider />
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <Text>Tổng tiền phòng:</Text>
                  <Text strong>{totalPrice.toLocaleString()}đ</Text>
                </div>

                {promotion && (
                  <div style={{ marginTop: 8, marginBottom: 8, padding: 12, background: '#fff7e6', borderRadius: 6 }}>
                    <Text strong style={{ color: '#b45309' }}>{promotion.tenKhuyenMai || 'Khuyến mãi'}</Text>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                      <Text type="secondary">Giảm:</Text>
                      <Text strong style={{ color: '#ff4d4f' }}>{discountAmount.toLocaleString()}đ</Text>
                    </div>
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <Text>Thuế & phí (10%):</Text>
                  <Text>{tax.toLocaleString()}đ</Text>
                </div>
                <Divider style={{ margin: "12px 0" }} />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text strong style={{ fontSize: 18 }}>
                    Tổng cộng:
                  </Text>
                  <Text strong style={{ fontSize: 24, color: "#dfa974" }}>
                    {grandTotal.toLocaleString()}đ
                  </Text>
                </div>
              </div>

              <Alert
                message="Miễn phí hủy trong 24h"
                description="Bạn có thể hủy miễn phí trước 24 giờ nhận phòng"
                type="info"
                showIcon
                style={{ marginTop: 16 }}
              />
            </Card>
          </Col>
        </Row>
      </Content>
    </Layout>
  );
};

export default CheckoutPage;
