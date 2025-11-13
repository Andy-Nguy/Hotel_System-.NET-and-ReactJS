import React, { useEffect, useState } from "react";
import { Layout, Card, Typography, Button, Result, Divider, Row, Col, message } from "antd";
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

interface BookingData {
  bookingId: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  checkIn?: string;
  checkOut?: string;
  totalAmount?: number;
  rooms?: any[];
}

const BookingSuccessPage: React.FC = () => {
  const [bookingData, setBookingData] = useState<BookingData | null>(null);

  useEffect(() => {
    // Lấy thông tin từ sessionStorage
    const bookingInfoStr = sessionStorage.getItem("bookingInfo");
    const customerInfoStr = sessionStorage.getItem("customerInfo");
    const invoiceInfoStr = sessionStorage.getItem("invoiceInfo");
    const paymentResultStr = sessionStorage.getItem("paymentResult");

    console.log("🔍 Debug SessionStorage:");
    console.log("bookingInfo:", bookingInfoStr);
    console.log("customerInfo:", customerInfoStr);
    console.log("invoiceInfo:", invoiceInfoStr);
    console.log("paymentResult:", paymentResultStr);

    // Ưu tiên lấy từ bookingInfo (được lưu từ PaymentPage)
    if (bookingInfoStr) {
      const booking = JSON.parse(bookingInfoStr);
      const customer = customerInfoStr ? JSON.parse(customerInfoStr) : null;
      const invoice = invoiceInfoStr ? JSON.parse(invoiceInfoStr) : null;
      const payment = paymentResultStr ? JSON.parse(paymentResultStr) : null;

      setBookingData({
        bookingId: invoice?.bookingId || payment?.paymentId || `BK${Date.now().toString().slice(-8)}`,
        customerName: customer?.fullName || "Khách hàng",
        customerEmail: customer?.email || "",
        customerPhone: customer?.phone || "",
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        totalAmount: invoice?.grandTotal || 0, // Lấy tổng tiền đã bao gồm thuế từ invoice
        rooms: booking.selectedRooms || [],
      });
    } else if (invoiceInfoStr) {
      // Fallback: lấy từ invoiceInfo
      const invoice = JSON.parse(invoiceInfoStr);
      const customer = customerInfoStr ? JSON.parse(customerInfoStr) : null;

      setBookingData({
        bookingId: invoice.bookingId || `BK${Date.now().toString().slice(-8)}`,
        customerName: customer?.fullName || "Khách hàng",
        customerEmail: customer?.email || "",
        customerPhone: customer?.phone || "",
        checkIn: invoice.checkIn,
        checkOut: invoice.checkOut,
        totalAmount: invoice.grandTotal,
        rooms: invoice.rooms || [],
      });
    } else {
      console.error("❌ Không tìm thấy thông tin booking trong sessionStorage!");
    }
  }, []);

  const handleBackToHome = () => {
    // Xóa tất cả thông tin đặt phòng
    sessionStorage.removeItem("bookingInfo");
    sessionStorage.removeItem("bookingResults");
    sessionStorage.removeItem("customerInfo");
    sessionStorage.removeItem("invoiceInfo");
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
      const idHoaDon = invoiceInfo.idHoaDon;

      if (!idHoaDon) {
        message.error("Không tìm thấy mã hóa đơn!");
        return;
      }

      message.loading("Đang tải hóa đơn...", 0);

      // Gọi API tải PDF
      const response = await fetch(`/api/Payment/invoice/${idHoaDon}/pdf`);

      if (!response.ok) {
        throw new Error(`Lỗi tải PDF: ${response.status}`);
      }

      // Chuyển response thành blob
      const blob = await response.blob();
      
      // Tạo URL tạm để download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `HoaDon_${idHoaDon}.pdf`;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      message.destroy();
      message.success("Tải hóa đơn thành công!");

    } catch (error: any) {
      message.destroy();
      console.error("Error downloading PDF:", error);
      message.error(error.message || "Có lỗi khi tải hóa đơn. Vui lòng thử lại!");
    }
  };


  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("vi-VN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Loading state
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
          {/* Progress Bar - Hoàn tất */}
          <BookingProgress currentStage="complete" />

          {/* Success Result */}
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
                      {bookingData?.bookingId}
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
                      <Text>{bookingData?.customerName}</Text>
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <MailOutlined style={{ marginRight: 8, color: "#dfa974" }} />
                      <Text>{bookingData?.customerEmail}</Text>
                    </div>
                    <div>
                      <PhoneOutlined style={{ marginRight: 8, color: "#dfa974" }} />
                      <Text>{bookingData?.customerPhone}</Text>
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
                      <Text>{formatDate(bookingData?.checkIn || "")}</Text>
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <Text strong>Trả phòng: </Text>
                      <Text>{formatDate(bookingData?.checkOut || "")}</Text>
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
                        {bookingData?.totalAmount?.toLocaleString()}đ
                      </Text>
                    </div>
                  </Card>
                </Col>
              </Row>

              {/* Danh sách phòng */}
              {bookingData?.rooms && bookingData.rooms.length > 0 && (
                <Card
                  type="inner"
                  title="Danh sách phòng đã đặt"
                  style={{ marginTop: 24 }}
                >
                  {bookingData.rooms.map((item: any, index: number) => (
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
                      <Text strong>
                        Phòng {item.roomNumber || index + 1}:{" "}
                      </Text>
                      <Text>{item.room?.tenLoaiPhong || "Standard Room"}</Text>
                    </div>
                  ))}
                </Card>
              )}

              {/* Thông báo */}
              <Card
                style={{
                  marginTop: 24,
                  background: "#fff7e6",
                  border: "1px solid #ffd591",
                }}
              >
                <Paragraph style={{ marginBottom: 8, fontSize: 15 }}>
                  <CheckCircleOutlined
                    style={{ color: "#fa8c16", marginRight: 8 }}
                  />
                  Chúng tôi đã gửi email xác nhận đến:{" "}
                  <strong>{bookingData?.customerEmail}</strong>
                </Paragraph>
                <Paragraph style={{ marginBottom: 8, fontSize: 15 }}>
                  <CheckCircleOutlined
                    style={{ color: "#fa8c16", marginRight: 8 }}
                  />
                  Vui lòng kiểm tra email để xem chi tiết đặt phòng
                </Paragraph>
                <Paragraph style={{ marginBottom: 0, fontSize: 15 }}>
                  <CheckCircleOutlined
                    style={{ color: "#fa8c16", marginRight: 8 }}
                  />
                  Nếu có thắc mắc, vui lòng liên hệ: <strong>1900-xxxx</strong>
                </Paragraph>
              </Card>

              {/* Buttons */}
              <Row gutter={16} style={{ marginTop: 30 }}>
                <Col xs={24} sm={12}>
                  <Button
                    size="large"
                    block
                    icon={<FilePdfOutlined />}
                    onClick={handleDownloadPDF}
                    style={{
                      height: 50,
                      fontSize: 16,
                      fontWeight: 600,
                      borderColor: "#dfa974",
                      color: "#dfa974",
                    }}
                  >
                    <DownloadOutlined /> Tải hóa đơn PDF
                  </Button>
                </Col>
                <Col xs={24} sm={12}>
                  <Button
                    type="primary"
                    size="large"
                    block
                    icon={<HomeOutlined />}
                    onClick={handleBackToHome}
                    style={{
                      background: "#dfa974",
                      borderColor: "#dfa974",
                      height: 50,
                      fontSize: 16,
                      fontWeight: 600,
                    }}
                  >
                    Về trang chủ
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
