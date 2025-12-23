import React, { useEffect, useState } from "react";
import { API_CONFIG } from "../api/config";

// Use centralized API config
const API_BASE = `${API_CONFIG.CURRENT}/api`;
import {
  Layout,
  Card,
  Typography,
  Button,
  Result,
  Divider,
  Row,
  Col,
  message,
} from "antd";
import {
  CheckCircleOutlined,
  HomeOutlined,
  MailOutlined,
  PhoneOutlined,
  CalendarOutlined,
  UserOutlined,
  FilePdfOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import BookingProgress from "../components/BookingProgress";

const { Content } = Layout;
const { Title, Text, Paragraph } = Typography;

type BookingData = {
  bookingId: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  checkIn?: string;
  checkOut?: string;
  totalAmount?: number;
  rooms?: any[];
};

const BookingSuccessPage: React.FC = () => {
  const [bookingData, setBookingData] = useState<BookingData | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<any>(null);

  useEffect(() => {
    const bookingInfoStr = sessionStorage.getItem("bookingInfo");
    const customerInfoStr = sessionStorage.getItem("customerInfo");
    const invoiceInfoStr = sessionStorage.getItem("invoiceInfo");
    const paymentResultStr = sessionStorage.getItem("paymentResult");

    const customer = customerInfoStr ? JSON.parse(customerInfoStr) : null;
    const invoice = invoiceInfoStr ? JSON.parse(invoiceInfoStr) : null;
    const payment = paymentResultStr ? JSON.parse(paymentResultStr) : null;
    const booking = bookingInfoStr ? JSON.parse(bookingInfoStr) : null;

    setPaymentInfo(payment);

    // Ưu tiên lấy ID từ invoice (có idDatPhong và idHoaDon từ API)
    const id =
      invoice?.idDatPhong ||
      invoice?.bookingId ||
      payment?.paymentId ||
      `BK${Date.now().toString().slice(-8)}`;
    const name =
      customer?.hoTen || customer?.fullName || customer?.name || "Khách hàng";
    const email = customer?.email || "";
    const phone =
      customer?.soDienThoai || customer?.phone || customer?.phoneNumber || "";
    const checkIn = booking?.checkIn || invoice?.checkIn;
    const checkOut = booking?.checkOut || invoice?.checkOut;
    const total =
      payment?.totalAmount ||
      invoice?.grandTotal ||
      invoice?.tongTien ||
      booking?.totalAmount ||
      0;
    const rooms = booking?.selectedRooms || invoice?.rooms || [];

    setBookingData({
      bookingId: id,
      customerName: name,
      customerEmail: email,
      customerPhone: phone,
      checkIn,
      checkOut,
      totalAmount: total,
      rooms,
    });
  }, []);

  const handleBackToHome = () => {
    sessionStorage.removeItem("bookingInfo");
    sessionStorage.removeItem("bookingResults");
    sessionStorage.removeItem("customerInfo");
    sessionStorage.removeItem("invoiceInfo");
    sessionStorage.removeItem("paymentResult");
    window.location.href = "/";
  };

  const handleDownloadPDF = async () => {
    try {
      const invoiceInfoStr = sessionStorage.getItem("invoiceInfo");
      if (!invoiceInfoStr) {
        message.error("Không tìm thấy thông tin hóa đơn!");
        return;
      }

      const invoiceInfo = JSON.parse(invoiceInfoStr);
      const idHoaDon =
        invoiceInfo.idHoaDon || invoiceInfo.id || invoiceInfo.invoiceId;
      if (!idHoaDon) {
        message.error("Không tìm thấy mã hóa đơn!");
        return;
      }

      message.loading({ content: "Đang tải hóa đơn...", key: "download" });
      const response = await fetch(
        `${API_BASE}/Payment/invoice/${idHoaDon}/pdf`
      );
      if (!response.ok) throw new Error(`Lỗi tải PDF: ${response.status}`);

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `HoaDon_${idHoaDon}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      message.success("Tải hóa đơn thành công!");
    } catch (err: any) {
      message.destroy();
      console.error(err);
      message.error(err?.message || "Có lỗi khi tải hóa đơn");
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("vi-VN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (!bookingData) {
    return (
      <Layout style={{ minHeight: "100vh", background: "#f5f5f5" }}>
        <Content style={{ padding: "50px 24px", textAlign: "center" }}>
          <div style={{ marginTop: 100 }}>
            <Title level={3}>Đang tải thông tin đặt phòng...</Title>
            <Text>Vui lòng đợi trong giây lát</Text>
          </div>
        </Content>
      </Layout>
    );
  }

  return (
    <Layout style={{ minHeight: "100vh", background: "#f5f5f5" }}>
      <Content style={{ padding: "50px 24px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          {/* Progress Bar */}
          <BookingProgress currentStage="complete" />

          {/* Success Card */}
          <Card
            style={{
              marginTop: 40,
              borderRadius: 12,
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            }}
          >
            <Result
              status="success"
              icon={
                <CheckCircleOutlined
                  style={{ fontSize: 80, color: "#52c41a" }}
                />
              }
              title={
                <Title level={2} style={{ color: "#52c41a", marginTop: 20 }}>
                  Đặt phòng thành công!
                </Title>
              }
              subTitle={
                <div style={{ fontSize: 16, color: "#666", marginTop: 10 }}>
                  <p>
                    Cảm ơn bạn đã đặt phòng tại{" "}
                    <strong style={{ color: "#dfa974" }}>Robins Villa</strong>
                  </p>
                  <p>
                    Mã đặt phòng của bạn:{" "}
                    <strong
                      style={{
                        color: "#dfa974",
                        fontSize: 20,
                        fontWeight: 700,
                      }}
                    >
                      {bookingData.bookingId}
                    </strong>
                  </p>
                </div>
              }
            />

            <Divider />

            {/* Thông tin đặt phòng */}
            <div style={{ padding: "0 50px 30px" }}>
              <Title level={4} style={{ marginBottom: 20 }}>
                Thông tin đặt phòng
              </Title>

              <Row gutter={[24, 24]}>
                {/* Thông tin khách hàng */}
                <Col xs={24} md={12}>
                  <Card
                    type="inner"
                    title={
                      <span>
                        <UserOutlined style={{ marginRight: 8 }} />
                        Thông tin khách hàng
                      </span>
                    }
                  >
                    <div style={{ marginBottom: 12 }}>
                      <Text strong>Họ và tên: </Text>
                      <Text>{bookingData.customerName}</Text>
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <MailOutlined
                        style={{ marginRight: 8, color: "#dfa974" }}
                      />
                      <Text>{bookingData.customerEmail}</Text>
                    </div>
                    <div>
                      <PhoneOutlined
                        style={{ marginRight: 8, color: "#dfa974" }}
                      />
                      <Text>{bookingData.customerPhone}</Text>
                    </div>
                  </Card>
                </Col>

                {/* Thông tin lưu trú */}
                <Col xs={24} md={12}>
                  <Card
                    type="inner"
                    title={
                      <span>
                        <CalendarOutlined style={{ marginRight: 8 }} />
                        Thông tin lưu trú
                      </span>
                    }
                  >
                    <div style={{ marginBottom: 12 }}>
                      <Text strong>Nhận phòng: </Text>
                      <Text>{formatDate(bookingData.checkIn)}</Text>
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <Text strong>Trả phòng: </Text>
                      <Text>{formatDate(bookingData.checkOut)}</Text>
                    </div>
                    <div>
                      <Text strong>Tổng tiền: </Text>
                      <Text
                        style={{
                          color: "#dfa974",
                          fontSize: 18,
                          fontWeight: 700,
                        }}
                      >
                        {bookingData.totalAmount?.toLocaleString()}đ
                      </Text>
                    </div>
                  </Card>
                </Col>
              </Row>

              {/* Danh sách phòng */}
              {bookingData.rooms && bookingData.rooms.length > 0 && (
                <Card
                  type="inner"
                  title="Danh sách phòng đã đặt"
                  style={{ marginTop: 24 }}
                >
                  {bookingData.rooms.map((item: any, index: number) => {
                    const rn = item.roomNumber || index + 1;
                    const room = item.room || {};
                    const rawName =
                      room.TenPhong || room.tenPhong || room.tenLoaiPhong || room.TenLoaiPhong || room.name || room.roomType || null;
                    let displayName = rawName || "Standard Room";
                    // append room number if not already present and name has no digits
                    try {
                      const numStr = String(rn);
                      const hasDigits = /\d/.test(displayName);
                      if (!hasDigits && !displayName.includes(numStr)) {
                        displayName = `${displayName} ${numStr}`;
                      }
                    } catch (e) {
                      /* ignore */
                    }

                    return (
                      <div
                        key={index}
                        style={{
                          padding: "12px 0",
                          borderBottom:
                            index < bookingData.rooms!.length - 1
                              ? "1px solid #f0f0f0"
                              : "none",
                        }}
                      >
                        <Text strong>Phòng {rn}: </Text>
                        <Text>{displayName}</Text>
                      </div>
                    );
                  })}
                </Card>
              )}

              {/* Thông báo */}
              <Card
                style={{
                  marginTop: 24,
                  background:
                    paymentInfo?.paymentStatus === "paid"
                      ? "#f6ffed"
                      : "#fff7e6",
                  border:
                    paymentInfo?.paymentStatus === "paid"
                      ? "1px solid #b7eb8f"
                      : "1px solid #ffd591",
                }}
              >
                {paymentInfo?.paymentStatus === "paid" && (
                  <>
                    <Paragraph style={{ marginBottom: 8, fontSize: 15 }}>
                      <CheckCircleOutlined
                        style={{ color: "#52c41a", marginRight: 8 }}
                      />
                      Email xác nhận đã được gửi đến:{" "}
                      <strong>{bookingData.customerEmail}</strong>
                    </Paragraph>
                    <Paragraph style={{ marginBottom: 8, fontSize: 15 }}>
                      <CheckCircleOutlined
                        style={{ color: "#52c41a", marginRight: 8 }}
                      />
                      Thanh toán đã hoàn tất. Vui lòng kiểm tra email để xem chi
                      tiết
                    </Paragraph>
                  </>
                )}
                {paymentInfo?.paymentStatus === "deposit" && (
                  <>
                    <Paragraph style={{ marginBottom: 8, fontSize: 15 }}>
                      <CheckCircleOutlined
                        style={{ color: "#fa8c16", marginRight: 8 }}
                      />
                      Bạn đã đặt cọc thành công:{" "}
                      <strong>
                        {paymentInfo.depositAmount?.toLocaleString()}đ
                      </strong>
                    </Paragraph>
                    <Paragraph style={{ marginBottom: 8, fontSize: 15 }}>
                      <CheckCircleOutlined
                        style={{ color: "#fa8c16", marginRight: 8 }}
                      />
                      Còn lại cần thanh toán khi nhận phòng:{" "}
                      <strong>
                        {(
                          paymentInfo.totalAmount - paymentInfo.depositAmount
                        ).toLocaleString()}
                        đ
                      </strong>
                    </Paragraph>
                    <Paragraph style={{ marginBottom: 8, fontSize: 15 }}>
                      <CheckCircleOutlined
                        style={{ color: "#fa8c16", marginRight: 8 }}
                      />
                      Vui lòng kiểm tra email để xem chi tiết đặt cọc
                    </Paragraph>
                  </>
                )}
                {paymentInfo?.paymentStatus === "unpaid" && (
                  <>
                    <Paragraph style={{ marginBottom: 8, fontSize: 15 }}>
                      <CheckCircleOutlined
                        style={{ color: "#fa8c16", marginRight: 8 }}
                      />
                      Đặt phòng thành công. Thanh toán khi nhận phòng
                    </Paragraph>
                    <Paragraph style={{ marginBottom: 8, fontSize: 15 }}>
                      <CheckCircleOutlined
                        style={{ color: "#fa8c16", marginRight: 8 }}
                      />
                      Tổng tiền cần thanh toán:{" "}
                      <strong>
                        {bookingData.totalAmount?.toLocaleString()}đ
                      </strong>
                    </Paragraph>
                    <Paragraph style={{ marginBottom: 8, fontSize: 15 }}>
                      <CheckCircleOutlined
                        style={{ color: "#fa8c16", marginRight: 8 }}
                      />
                      Vui lòng kiểm tra email để xem chi tiết đặt phòng
                    </Paragraph>
                  </>
                )}
                <Paragraph style={{ marginBottom: 8, fontSize: 15 }}>
                  <CheckCircleOutlined
                    style={{
                      color:
                        paymentInfo?.paymentStatus === "paid"
                          ? "#52c41a"
                          : "#fa8c16",
                      marginRight: 8,
                    }}
                  />
                  Vui lòng kiểm tra email để xem chi tiết đặt phòng
                </Paragraph>
                <Paragraph style={{ marginBottom: 0, fontSize: 15 }}>
                  <CheckCircleOutlined
                    style={{
                      color:
                        paymentInfo?.paymentStatus === "paid"
                          ? "#52c41a"
                          : "#fa8c16",
                      marginRight: 8,
                    }}
                  />
                    Nếu có thắc mắc, vui lòng liên hệ: <strong>(+84) 263 3888 999</strong>
                </Paragraph>
              </Card>

              {/* Buttons */}
              <Row gutter={16} style={{ marginTop: 30 }}>
                <Col xs={24} sm={12}>
                  <Button
                    type="default"
                    size="large"
                    block
                    icon={<HomeOutlined />}
                    onClick={handleBackToHome}
                  >
                    Về trang chủ
                  </Button>
                </Col>
                <Col xs={24} sm={12}>
                  <Button
                    type="primary"
                    size="large"
                    block
                    icon={<DownloadOutlined />}
                    onClick={handleDownloadPDF}
                    style={{ background: "#dfa974", borderColor: "#dfa974" }}
                  >
                    Tải hóa đơn PDF
                  </Button>
                </Col>
              </Row>
            </div>
          </Card>
        </div>
      </Content>
    </Layout>
  );
};

export default BookingSuccessPage;
