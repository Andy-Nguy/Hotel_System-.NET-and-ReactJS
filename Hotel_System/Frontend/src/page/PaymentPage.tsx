import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  Layout,
  Card,
  Typography,
  Row,
  Col,
  Button,
  Form,
  Input,
  InputNumber,
  Divider,
  Alert,
  Modal,
  message,
  Steps,
  Radio,
  Space,
  Tag,
  Collapse,
} from "antd";
import {
  QrcodeOutlined,
  CreditCardOutlined,
  WalletOutlined,
  BankOutlined,
  GiftOutlined,
  HomeOutlined,
  CheckCircleOutlined,
  ArrowLeftOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  UserOutlined,
  SafetyOutlined,
  LockOutlined,
  InfoCircleOutlined,
  EnvironmentOutlined,
  CalendarOutlined,
  TeamOutlined,
  CheckOutlined,
  TagOutlined,
  CopyOutlined,
} from "@ant-design/icons";

const { Content } = Layout;
const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;

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
  selectedServices?: any[];
  servicesTotal?: number;
}

const PaymentPage: React.FC = () => {
  const [bookingInfo, setBookingInfo] = useState<BookingInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<string>("bank-transfer");
  const [processingPayment, setProcessingPayment] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [paymentRef, setPaymentRef] = useState<string>("");
  const [creditModalVisible, setCreditModalVisible] = useState(false);
  const [creditForm] = Form.useForm();
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [invoiceInfoState, setInvoiceInfoState] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [redeemPoints, setRedeemPoints] = useState<number>(0);
  const [promoCode, setPromoCode] = useState<string>("");
  const [expandedSummary, setExpandedSummary] = useState(true);
  const [depositOption, setDepositOption] = useState<"deposit" | "full">(
    "full"
  ); // deposit = đặt cọc 500k, full = thanh toán đủ
  const DEPOSIT_AMOUNT = 500000; // 500,000 VND

  // Copy to clipboard helper
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      message.success("Đã sao chép");
    } catch (e) {
      message.error("Không thể sao chép");
    }
  };

  useEffect(() => {
    const bookingData = sessionStorage.getItem("bookingInfo");
    const invoiceData = sessionStorage.getItem("invoiceInfo");

    let parsedBooking: any = null;
    if (bookingData) {
      try {
        parsedBooking = JSON.parse(bookingData);
        setBookingInfo(parsedBooking);
      } catch (e) {
        setError("Không thể tải thông tin đặt phòng");
      }
    }

    if (invoiceData) {
      try {
        const parsedInvoice = JSON.parse(invoiceData);
        setInvoiceInfoState(parsedInvoice);

        if (
          (!parsedBooking ||
            !parsedBooking.selectedRooms ||
            parsedBooking.selectedRooms.length === 0) &&
          parsedInvoice.rooms &&
          parsedInvoice.rooms.length > 0
        ) {
          const recovered = {
            selectedRooms: parsedInvoice.rooms,
            checkIn: parsedInvoice.checkIn || parsedInvoice.ngayNhanPhong,
            checkOut: parsedInvoice.checkOut || parsedInvoice.ngayTraPhong,
            guests: parsedInvoice.guests || parsedInvoice.soLuongKhach || 1,
            totalRooms: (parsedInvoice.rooms || []).length,
            selectedServices:
              parsedInvoice.services || parsedInvoice.selectedServices || [],
            servicesTotal:
              parsedInvoice.servicesTotal || parsedInvoice.tienDichVu || 0,
          };
          setBookingInfo(recovered);
        }
      } catch {}
    }

    const token = localStorage.getItem("hs_token");
    if (token) {
      fetch("/api/auth/profile", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((data) => setProfile(data))
        .catch(() => {});
    }
  }, []);

  const calculateNights = () => {
    if (!bookingInfo) return 0;
    const checkInDate = new Date(bookingInfo.checkIn);
    const checkOutDate = new Date(bookingInfo.checkOut);
    return Math.ceil(
      (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
    );
  };

  const calculateTotal = () => {
    if (!bookingInfo) return 0;
    const nights = calculateNights();
    const totalPrice = bookingInfo.selectedRooms.reduce((sum, sr) => {
      return sum + (sr.room.giaCoBanMotDem || 0) * nights;
    }, 0);
    return totalPrice;
  };

  const handleConfirmPayment = async () => {
    if (selectedMethod === "credit-card") {
      setCreditModalVisible(true);
      return;
    }

    if (selectedMethod === "bank-transfer") {
      const ref = `IVIVU${Date.now().toString().slice(-9)}`;
      setPaymentRef(ref);
      setQrModalVisible(true);
      return;
    }

    // Handle other payment methods (hotel-payment, momo, etc.)
    // Thanh toán tại khách sạn sẽ lưu trạng thái chưa thanh toán
    setConfirmModalVisible(true);
  };

  const handleFinalConfirm = async () => {
    setProcessingPayment(true);
    try {
      // Xác định trạng thái thanh toán và số tiền
      let paymentStatus: "unpaid" | "deposit" | "paid" = "unpaid";
      let amountPaid = 0;
      let depositAmount = 0;
      let trangThaiThanhToan = 1; // 1:Chưa TT, 2:Đã TT, 0:Đã cọc
      let phuongThucThanhToan = 1; // 1 = tiền mặt, 2 = online, 3 = quầy
      let tienCoc = 0; // Tiền cọc

      if (selectedMethod === "hotel-payment") {
        // Thanh toán tại khách sạn = chưa thanh toán
        paymentStatus = "unpaid";
        amountPaid = 0;
        trangThaiThanhToan = 1;
        phuongThucThanhToan = 1;
        tienCoc = 0;
      } else if (selectedMethod === "bank-transfer") {
        // Chuyển khoản: kiểm tra option đặt cọc hay full
        if (depositOption === "deposit") {
          paymentStatus = "deposit";
          amountPaid = DEPOSIT_AMOUNT;
          depositAmount = DEPOSIT_AMOUNT;
          trangThaiThanhToan = 0; // 0 = Đã cọc
          phuongThucThanhToan = 2;
          tienCoc = DEPOSIT_AMOUNT;
        } else {
          paymentStatus = "paid";
          amountPaid = Math.round(grandTotal);
          trangThaiThanhToan = 2; // 2 = Đã thanh toán
          phuongThucThanhToan = 2;
          tienCoc = 0;
        }
      } else {
        // Các phương thức khác (credit-card, momo) = đã thanh toán
        paymentStatus = "paid";
        amountPaid = Math.round(grandTotal);
        trangThaiThanhToan = 2;
        phuongThucThanhToan = 2;
        tienCoc = 0;
      }

      // Lấy thông tin từ invoiceInfo
      const invoiceInfo = invoiceInfoState;
      if (!invoiceInfo || !invoiceInfo.idDatPhong) {
        throw new Error("Không tìm thấy thông tin đặt phòng");
      }

      if (!bookingInfo) {
        throw new Error("Không tìm thấy thông tin booking");
      }

      // Tạo payload để gọi API tạo hóa đơn
      const invoicePayload = {
        IDDatPhong: invoiceInfo.idDatPhong,
        TienPhong: totalPrice,
        SoLuongNgay: nights,
        TongTien: Math.round(grandTotal),
        TienCoc: tienCoc,
        TrangThaiThanhToan: trangThaiThanhToan,
        PhuongThucThanhToan: phuongThucThanhToan,
        GhiChu: `Phương thức: ${
          selectedMethod === "hotel-payment"
            ? "Thanh toán tại khách sạn"
            : selectedMethod === "bank-transfer"
            ? depositOption === "deposit"
              ? "Đặt cọc 500k"
              : "Chuyển khoản đủ"
            : selectedMethod
        }${paymentRef ? ` | Mã GD: ${paymentRef}` : ""}`,
        PaymentGateway:
          selectedMethod === "bank-transfer" ? "VietQR" : selectedMethod,
        Services: (bookingInfo.selectedServices || []).map((svc: any) => ({
          IddichVu: svc.serviceId,
          SoLuong: svc.quantity || 1,
          DonGia: svc.price,
          TienDichVu: svc.price * (svc.quantity || 1),
        })),
      };

      // Gọi API tạo hóa đơn
      const response = await fetch("/api/Payment/hoa-don", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(invoicePayload),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || "Không thể tạo hóa đơn");
      }

      const result = await response.json();

      // Cập nhật invoiceInfo với idHoaDon mới
      const updatedInvoiceInfo = {
        ...invoiceInfo,
        idHoaDon: result.idHoaDon,
        trangThaiThanhToan: trangThaiThanhToan,
        paymentStatus: paymentStatus,
        amountPaid: amountPaid,
        depositAmount: depositAmount,
      };

      // Lưu kết quả thanh toán
      sessionStorage.setItem("invoiceInfo", JSON.stringify(updatedInvoiceInfo));
      sessionStorage.setItem(
        "paymentResult",
        JSON.stringify({
          success: true,
          paymentMethod: selectedMethod,
          paymentStatus: paymentStatus,
          amountPaid: amountPaid,
          depositAmount: depositAmount,
          totalAmount: Math.round(grandTotal),
          idHoaDon: result.idHoaDon,
        })
      );

      message.success("Thanh toán thành công!");

      // Chuyển sang trang success sau 1 giây
      setTimeout(() => {
        window.location.href = "/#booking-success";
      }, 1000);
    } catch (e: any) {
      console.error("Error:", e);
      Modal.error({
        title: "Lỗi thanh toán",
        content: e.message || "Có lỗi xảy ra. Vui lòng thử lại.",
      });
    } finally {
      setProcessingPayment(false);
    }
  };

  if (error) {
    return (
      <Layout style={{ minHeight: "100vh", background: "#f8f9fa" }}>
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
      <Layout style={{ minHeight: "100vh", background: "#f8f9fa" }}>
        <Content style={{ padding: "50px", textAlign: "center" }}>
          <div>Đang tải...</div>
        </Content>
      </Layout>
    );
  }

  const totalPrice = calculateTotal();
  const nights = calculateNights();
  const servicesTotal = bookingInfo.servicesTotal || 0;
  const subtotal = totalPrice + servicesTotal;
  const tax = subtotal * 0.1;
  const grandTotal = subtotal + tax;

  const paymentMethods = [
    {
      key: "bank-transfer",
      title: "Chuyển khoản",
      subtitle: "QR Code",
      icon: <QrcodeOutlined />,
      recommended: true,
    },
    {
      key: "credit-card",
      title: "Thẻ tín dụng",
      subtitle: "Visa, Master, JCB",
      icon: <CreditCardOutlined />,
    },
    {
      key: "momo",
      title: "Ví MoMo",
      subtitle: "Thanh toán nhanh",
      icon: <WalletOutlined />,
    },
    {
      key: "hotel-payment",
      title: "Thanh toán tại khách sạn",
      subtitle: "Thanh toán khi nhận phòng",
      icon: <HomeOutlined />,
    },
  ];

  return (
    <Layout style={{ minHeight: "100vh", background: "#f8f9fa" }}>
      {/* Header Bar */}
      <div
        style={{
          background: "linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)",
          borderBottom: "2px solid #dfa974",
          padding: "16px 0",
          position: "sticky",
          top: 0,
          zIndex: 100,
          boxShadow: "0 2px 12px rgba(223, 169, 116, 0.15)",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "0 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => window.history.back()}
              style={{ color: "#2c3e50" }}
            >
              Quay lại
            </Button>
            <div>
              <Text strong style={{ fontSize: 18, color: "#2c3e50" }}>
                Thanh toán
              </Text>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <LockOutlined style={{ color: "#dfa974" }} />
            <Text type="secondary" style={{ fontSize: 13, color: "#7f8c8d" }}>
              Bảo mật SSL
            </Text>
          </div>
        </div>
      </div>

      <Content
        style={{
          padding: "40px 24px",
          maxWidth: "1200px",
          margin: "0 auto",
          width: "100%",
        }}
      >
        <Row gutter={[32, 32]}>
          {/* Left Column - Payment Form */}
          <Col xs={24} lg={14}>
            {/* Progress Steps */}
            <Card
              bordered={false}
              style={{
                marginBottom: 24,
                borderRadius: 12,
                boxShadow: "0 4px 12px rgba(223, 169, 116, 0.12)",
                border: "1px solid #f0f0f0",
              }}
            >
              <Steps
                current={0}
                size="small"
                items={[
                  { title: "Thanh toán", icon: <CreditCardOutlined /> },
                  { title: "Xác nhận", icon: <CheckCircleOutlined /> },
                  { title: "Hoàn tất", icon: <CheckOutlined /> },
                ]}
              />
            </Card>

            {/* Payment Methods */}
            <Card
              bordered={false}
              style={{
                marginBottom: 24,
                borderRadius: 12,
                boxShadow: "0 4px 12px rgba(223, 169, 116, 0.12)",
                border: "1px solid #f0f0f0",
              }}
            >
              <Title level={5} style={{ marginBottom: 20 }}>
                Chọn phương thức thanh toán
              </Title>

              <Radio.Group
                value={selectedMethod}
                onChange={(e) => setSelectedMethod(e.target.value)}
                style={{ width: "100%" }}
              >
                <Space direction="vertical" style={{ width: "100%" }} size={12}>
                  {paymentMethods.map((method) => (
                    <Radio.Button
                      key={method.key}
                      value={method.key}
                      style={{
                        width: "100%",
                        height: "auto",
                        padding: "16px 20px",
                        border:
                          selectedMethod === method.key
                            ? "2px solid #dfa974"
                            : "1px solid #e8e8e8",
                        borderRadius: 8,
                        background:
                          selectedMethod === method.key ? "#fef8f1" : "#fff",
                        transition: "all 0.3s",
                        boxShadow:
                          selectedMethod === method.key
                            ? "0 4px 12px rgba(223, 169, 116, 0.2)"
                            : "none",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          width: "100%",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 16,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 24,
                              color:
                                selectedMethod === method.key
                                  ? "#dfa974"
                                  : "#7f8c8d",
                            }}
                          >
                            {method.icon}
                          </div>
                          <div>
                            <div
                              style={{
                                fontWeight: 600,
                                fontSize: 15,
                                color: "#2c3e50",
                                marginBottom: 2,
                              }}
                            >
                              {method.title}
                            </div>
                            <div
                              style={{
                                fontSize: 13,
                                color: "#7f8c8d",
                              }}
                            >
                              {method.subtitle}
                            </div>
                          </div>
                        </div>
                        {method.recommended && (
                          <Tag
                            color="#dfa974"
                            style={{ margin: 0, borderColor: "#dfa974" }}
                          >
                            Khuyên dùng
                          </Tag>
                        )}
                      </div>
                    </Radio.Button>
                  ))}
                </Space>
              </Radio.Group>
            </Card>

            {/* Promo Code */}
            <Card
              bordered={false}
              style={{
                marginBottom: 24,
                borderRadius: 12,
                boxShadow: "0 4px 12px rgba(223, 169, 116, 0.12)",
                border: "1px solid #f0f0f0",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 16,
                }}
              >
                <TagOutlined style={{ color: "#dfa974" }} />
                <Text strong style={{ color: "#2c3e50" }}>
                  Mã khuyến mãi
                </Text>
              </div>

              <Input.Search
                placeholder="Nhập mã khuyến mãi"
                enterButton="Áp dụng"
                size="large"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                style={{ marginBottom: 12 }}
              />

              <Text type="secondary" style={{ fontSize: 13, color: "#7f8c8d" }}>
                Bạn có điểm tích lũy?{" "}
                <a style={{ color: "#dfa974" }}>Đăng nhập</a> để sử dụng
              </Text>
            </Card>

            {/* Security Notice */}
            <Alert
              message="Thanh toán an toàn & bảo mật"
              description="Thông tin thanh toán của bạn được mã hóa và bảo vệ bởi công nghệ SSL 256-bit"
              type="success"
              showIcon
              icon={<SafetyOutlined />}
              style={{
                borderRadius: 8,
                border: "1px solid #d4edda",
                background: "#f6ffed",
                marginBottom: 16,
              }}
            />

            {/* Payment Info Alert */}
            {selectedMethod === "hotel-payment" && (
              <Alert
                message="Thanh toán tại khách sạn"
                description="Bạn sẽ thanh toán toàn bộ chi phí khi làm thủ tục nhận phòng. Đặt phòng sẽ được xác nhận và giữ cho bạn."
                type="info"
                showIcon
                style={{
                  borderRadius: 8,
                  border: "1px solid #d1ecf1",
                  background: "#d1ecf1",
                }}
              />
            )}

            {selectedMethod === "bank-transfer" && (
              <Alert
                message="Chuyển khoản ngân hàng"
                description={
                  <div>
                    <p style={{ margin: 0 }}>
                      • <strong>Đặt cọc 500,000đ:</strong> Giữ chỗ, thanh toán
                      phần còn lại khi nhận phòng
                    </p>
                    <p style={{ margin: "8px 0 0 0" }}>
                      • <strong>Thanh toán đủ:</strong> Thanh toán toàn bộ ngay,
                      nhận phòng không cần thanh toán thêm
                    </p>
                  </div>
                }
                type="info"
                showIcon
                style={{
                  borderRadius: 8,
                  border: "1px solid #d1ecf1",
                  background: "#e7f3ff",
                }}
              />
            )}
          </Col>

          {/* Right Column - Booking Summary */}
          <Col xs={24} lg={10}>
            <div style={{ position: "sticky", top: 100 }}>
              <Card
                bordered={false}
                style={{
                  borderRadius: 12,
                  boxShadow: "0 4px 16px rgba(223, 169, 116, 0.15)",
                  overflow: "hidden",
                  border: "1px solid #f0f0f0",
                }}
              >
                <div
                  style={{
                    background:
                      "radial-gradient(circle at top left, #ffffff 0%, #fef8f1 100%)",
                    borderRadius: 8,
                    borderBottom: "2px solid #dfa974",
                    padding: "10px 12px",
                    marginBottom: 20,
                    marginTop: -24,
                    marginLeft: -24,
                    marginRight: -24,
                  }}
                >
                  <Title level={5} style={{ margin: 0, color: "#2c3e50" }}>
                    Tóm tắt đặt phòng
                  </Title>
                </div>

                {/* Room Details */}
                {bookingInfo.selectedRooms.map((sr, idx) => (
                  <div
                    key={idx}
                    style={{
                      marginBottom: 20,
                      paddingBottom: 20,
                      borderBottom:
                        idx < bookingInfo.selectedRooms.length - 1
                          ? "1px solid #f0f0f0"
                          : "none",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: 12,
                        marginBottom: 12,
                      }}
                    >
                      <div
                        style={{
                          width: 80,
                          height: 80,
                          borderRadius: 8,
                          overflow: "hidden",
                          flexShrink: 0,
                          background: "#f5f5f5",
                        }}
                      >
                        <img
                          src={sr.room?.urlAnhPhong || "/img/placeholder.png"}
                          alt={sr.room?.tenPhong}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <Text
                          strong
                          style={{
                            fontSize: 14,
                            display: "block",
                            marginBottom: 4,
                          }}
                        >
                          {sr.room?.tenPhong || `Phòng ${sr.roomNumber}`}
                        </Text>
                        <Text
                          type="secondary"
                          style={{ fontSize: 13, display: "block" }}
                        >
                          Phòng #{sr.roomNumber}
                        </Text>
                      </div>
                    </div>
                  </div>
                ))}

                <Divider style={{ margin: "20px 0" }} />

                {/* Date & Guests Info */}
                <Space
                  direction="vertical"
                  size={12}
                  style={{ width: "100%", marginBottom: 20 }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 12 }}
                  >
                    <CalendarOutlined style={{ color: "#666", fontSize: 16 }} />
                    <div>
                      <Text
                        type="secondary"
                        style={{ fontSize: 13, display: "block" }}
                      >
                        Nhận phòng - Trả phòng
                      </Text>
                      <Text strong style={{ fontSize: 14 }}>
                        {new Date(bookingInfo.checkIn).toLocaleDateString(
                          "vi-VN"
                        )}{" "}
                        -{" "}
                        {new Date(bookingInfo.checkOut).toLocaleDateString(
                          "vi-VN"
                        )}
                      </Text>
                    </div>
                  </div>

                  <div
                    style={{ display: "flex", alignItems: "center", gap: 12 }}
                  >
                    <ClockCircleOutlined
                      style={{ color: "#666", fontSize: 16 }}
                    />
                    <div>
                      <Text strong style={{ fontSize: 14 }}>
                        {nights} đêm
                      </Text>
                    </div>
                  </div>

                  <div
                    style={{ display: "flex", alignItems: "center", gap: 12 }}
                  >
                    <TeamOutlined style={{ color: "#666", fontSize: 16 }} />
                    <div>
                      <Text strong style={{ fontSize: 14 }}>
                        {bookingInfo.guests} khách
                      </Text>
                    </div>
                  </div>
                </Space>

                <Divider style={{ margin: "20px 0" }} />

                {/* Price Breakdown */}
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <Text type="secondary">Tiền phòng ({nights} đêm)</Text>
                    <Text>{totalPrice.toLocaleString()}đ</Text>
                  </div>

                  {servicesTotal > 0 && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <Text type="secondary">Dịch vụ</Text>
                      <Text>{servicesTotal.toLocaleString()}đ</Text>
                    </div>
                  )}

                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <Text type="secondary">Thuế & phí (10%)</Text>
                    <Text>{Math.round(tax).toLocaleString()}đ</Text>
                  </div>

                  <Divider style={{ margin: "12px 0" }} />

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Text strong style={{ fontSize: 16, color: "#2c3e50" }}>
                      Tổng cộng
                    </Text>
                    <Text strong style={{ fontSize: 20, color: "#dfa974" }}>
                      {Math.round(grandTotal).toLocaleString()}đ
                    </Text>
                  </div>
                </Space>

                <Button
                  type="primary"
                  size="large"
                  block
                  onClick={handleConfirmPayment}
                  loading={processingPayment}
                  icon={<CheckCircleOutlined />}
                  style={{
                    marginTop: 24,
                    height: 50,
                    fontSize: 16,
                    fontWeight: 600,
                    borderRadius: 8,
                    background:
                      "linear-gradient(135deg, #dfa974 0%, #c4915c 100%)",
                    border: "none",
                    boxShadow: "0 4px 12px rgba(223, 169, 116, 0.3)",
                  }}
                >
                  Xác nhận thanh toán
                </Button>

                <div
                  style={{
                    marginTop: 16,
                    padding: 12,
                    background: "#f6ffed",
                    borderRadius: 8,
                    border: "1px solid #b7eb8f",
                  }}
                >
                  <Text style={{ fontSize: 13, color: "#52c41a" }}>
                    <CheckCircleOutlined /> Miễn phí hủy trong 24h
                  </Text>
                </div>
              </Card>
            </div>
          </Col>
        </Row>

        {/* QR Modal */}
        <Modal
          open={qrModalVisible}
          onCancel={() => setQrModalVisible(false)}
          footer={null}
          width={480}
          centered
          styles={{
            body: { padding: 32 },
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #fef8f1 0%, #ffeedd 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
                boxShadow: "0 4px 12px rgba(223, 169, 116, 0.2)",
              }}
            >
              <QrcodeOutlined style={{ fontSize: 40, color: "#dfa974" }} />
            </div>

            <Title level={4} style={{ marginBottom: 8 }}>
              Quét mã để thanh toán
            </Title>
            <Text
              type="secondary"
              style={{ display: "block", marginBottom: 24 }}
            >
              Sử dụng ứng dụng ngân hàng để quét mã QR
            </Text>

            {/* Deposit Option Selector */}
            <Card
              size="small"
              style={{
                marginBottom: 20,
                textAlign: "left",
                background: "#fef8f1",
                border: "1px solid #dfa974",
              }}
            >
              <Text
                strong
                style={{ display: "block", marginBottom: 12, color: "#2c3e50" }}
              >
                Chọn hình thức thanh toán:
              </Text>
              <Radio.Group
                value={depositOption}
                onChange={(e) => setDepositOption(e.target.value)}
                style={{ width: "100%" }}
              >
                <Space direction="vertical" style={{ width: "100%" }} size={12}>
                  <Radio value="deposit" style={{ width: "100%" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        width: "100%",
                      }}
                    >
                      <span>Đặt cọc</span>
                      <Text strong style={{ color: "#dfa974" }}>
                        {DEPOSIT_AMOUNT.toLocaleString()}đ
                      </Text>
                    </div>
                    <Text
                      type="secondary"
                      style={{ fontSize: 12, display: "block", marginLeft: 24 }}
                    >
                      Thanh toán phần còn lại khi nhận phòng
                    </Text>
                  </Radio>
                  <Radio value="full" style={{ width: "100%" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        width: "100%",
                      }}
                    >
                      <span>Thanh toán đủ</span>
                      <Text strong style={{ color: "#dfa974" }}>
                        {Math.round(grandTotal).toLocaleString()}đ
                      </Text>
                    </div>
                    <Text
                      type="secondary"
                      style={{ fontSize: 12, display: "block", marginLeft: 24 }}
                    >
                      Thanh toán toàn bộ ngay
                    </Text>
                  </Radio>
                </Space>
              </Radio.Group>
            </Card>

            <div
              style={{
                padding: 20,
                background: "#f8f9fa",
                borderRadius: 12,
                marginBottom: 24,
              }}
            >
              <img
                src={`https://img.vietqr.io/image/bidv-8639699999-print.png?amount=${
                  depositOption === "deposit"
                    ? DEPOSIT_AMOUNT
                    : Math.round(grandTotal)
                }&addInfo=${paymentRef}&accountName=ROBINS VILLA HOTEL`}
                alt="QR Code"
                style={{ width: "100%", maxWidth: 280, height: "auto" }}
              />
            </div>

            <Card size="small" style={{ marginBottom: 20, textAlign: "left" }}>
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <Text type="secondary">Ngân hàng</Text>
                  <Text strong>BIDV</Text>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text type="secondary">Số TK</Text>
                  <div>
                    <Text strong style={{ marginRight: 8 }}>
                      8639699999
                    </Text>
                    <Button
                      type="text"
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => copyToClipboard("8639699999")}
                    />
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text type="secondary">Số tiền</Text>
                  <div>
                    <Text strong style={{ marginRight: 8, color: "#dfa974" }}>
                      {(depositOption === "deposit"
                        ? DEPOSIT_AMOUNT
                        : Math.round(grandTotal)
                      ).toLocaleString()}
                      đ
                    </Text>
                    <Button
                      type="text"
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() =>
                        copyToClipboard(
                          (depositOption === "deposit"
                            ? DEPOSIT_AMOUNT
                            : Math.round(grandTotal)
                          ).toString()
                        )
                      }
                    />
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text type="secondary">Nội dung</Text>
                  <div>
                    <Text strong style={{ marginRight: 8 }}>
                      {paymentRef}
                    </Text>
                    <Button
                      type="text"
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => copyToClipboard(paymentRef)}
                    />
                  </div>
                </div>
              </Space>
            </Card>

            <Button
              type="primary"
              size="large"
              block
              onClick={handleFinalConfirm}
              loading={processingPayment}
              style={{
                height: 48,
                borderRadius: 8,
                fontWeight: 600,
                background: "linear-gradient(135deg, #dfa974 0%, #c4915c 100%)",
                border: "none",
              }}
            >
              Tôi đã chuyển khoản
            </Button>
          </div>
        </Modal>

        {/* Credit Card Modal */}
        <Modal
          open={creditModalVisible}
          onCancel={() => setCreditModalVisible(false)}
          footer={null}
          width={480}
          centered
          styles={{
            body: { padding: 32 },
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #fef8f1 0%, #ffeedd 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
                boxShadow: "0 4px 12px rgba(223, 169, 116, 0.2)",
              }}
            >
              <CreditCardOutlined style={{ fontSize: 40, color: "#dfa974" }} />
            </div>
            <Title level={4} style={{ marginBottom: 8 }}>
              Thanh toán thẻ tín dụng
            </Title>
            <Text type="secondary">Thông tin thẻ được bảo mật tuyệt đối</Text>
          </div>

          <Form form={creditForm} layout="vertical">
            <Form.Item
              label="Số thẻ"
              name="cardNumber"
              rules={[
                { required: true, message: "Vui lòng nhập số thẻ" },
                { pattern: /^\d{16}$/, message: "Số thẻ không hợp lệ" },
              ]}
            >
              <Input
                size="large"
                placeholder="1234 5678 9012 3456"
                maxLength={16}
                prefix={<CreditCardOutlined style={{ color: "#dfa974" }} />}
                style={{ borderRadius: 8 }}
              />
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="Ngày hết hạn"
                  name="expiry"
                  rules={[
                    { required: true, message: "Vui lòng nhập" },
                    { pattern: /^\d{2}\/\d{2}$/, message: "Format: MM/YY" },
                  ]}
                >
                  <Input
                    size="large"
                    placeholder="MM/YY"
                    maxLength={5}
                    style={{ borderRadius: 8 }}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="CVV"
                  name="cvv"
                  rules={[
                    { required: true, message: "Vui lòng nhập CVV" },
                    { pattern: /^\d{3}$/, message: "CVV không hợp lệ" },
                  ]}
                >
                  <Input
                    size="large"
                    placeholder="123"
                    maxLength={3}
                    type="password"
                    prefix={<LockOutlined style={{ color: "#dfa974" }} />}
                    style={{ borderRadius: 8 }}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              label="Tên chủ thẻ"
              name="cardName"
              rules={[{ required: true, message: "Vui lòng nhập tên chủ thẻ" }]}
            >
              <Input
                size="large"
                placeholder="NGUYEN VAN A"
                style={{ textTransform: "uppercase", borderRadius: 8 }}
                prefix={<UserOutlined style={{ color: "#dfa974" }} />}
              />
            </Form.Item>

            <Alert
              message={
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <LockOutlined />
                  <Text>Thông tin được mã hóa SSL 256-bit</Text>
                </div>
              }
              type="success"
              style={{ marginBottom: 20, borderRadius: 8 }}
            />

            <Button
              type="primary"
              size="large"
              block
              onClick={async () => {
                try {
                  await creditForm.validateFields();
                  setCreditModalVisible(false);
                  handleFinalConfirm();
                } catch (e) {
                  message.error("Vui lòng kiểm tra lại thông tin");
                }
              }}
              loading={processingPayment}
              style={{
                height: 50,
                borderRadius: 8,
                fontWeight: 600,
                background: "linear-gradient(135deg, #dfa974 0%, #c4915c 100%)",
                border: "none",
                boxShadow: "0 4px 12px rgba(223, 169, 116, 0.3)",
              }}
            >
              Thanh toán {Math.round(grandTotal).toLocaleString()}đ
            </Button>
          </Form>
        </Modal>

        {/* Confirmation Modal */}
        <Modal
          open={confirmModalVisible}
          onCancel={() => setConfirmModalVisible(false)}
          footer={null}
          width={500}
          centered
          styles={{
            body: { padding: 40 },
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                width: 100,
                height: 100,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #52c41a 0%, #389e0d 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 24px",
                boxShadow: "0 8px 24px rgba(82, 196, 26, 0.3)",
              }}
            >
              <CheckCircleOutlined style={{ fontSize: 50, color: "#fff" }} />
            </div>

            <Title level={3} style={{ marginBottom: 12, color: "#52c41a" }}>
              {selectedMethod === "hotel-payment"
                ? "Đặt phòng thành công!"
                : "Thanh toán thành công!"}
            </Title>

            <Paragraph
              style={{ fontSize: 15, color: "#666", marginBottom: 30 }}
            >
              {selectedMethod === "hotel-payment"
                ? "Đơn đặt phòng của bạn đã được ghi nhận. Vui lòng thanh toán khi nhận phòng."
                : depositOption === "deposit" &&
                  selectedMethod === "bank-transfer"
                ? "Bạn đã đặt cọc thành công. Vui lòng thanh toán phần còn lại khi nhận phòng."
                : "Đơn đặt phòng của bạn đã được xác nhận và thanh toán hoàn tất"}
            </Paragraph>

            <Card
              size="small"
              style={{
                marginBottom: 24,
                textAlign: "left",
                background: "#f8f9fa",
                border: "none",
                borderRadius: 12,
              }}
            >
              <Space direction="vertical" size={16} style={{ width: "100%" }}>
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <Text type="secondary">Phương thức</Text>
                  <Text strong>
                    {selectedMethod === "bank-transfer" && "Chuyển khoản"}
                    {selectedMethod === "credit-card" && "Thẻ tín dụng"}
                    {selectedMethod === "momo" && "Ví MoMo"}
                    {selectedMethod === "hotel-payment" &&
                      "Thanh toán tại khách sạn"}
                  </Text>
                </div>
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <Text type="secondary">
                    {selectedMethod === "hotel-payment"
                      ? "Tổng tiền cần thanh toán"
                      : depositOption === "deposit" &&
                        selectedMethod === "bank-transfer"
                      ? "Số tiền đã đặt cọc"
                      : "Số tiền đã thanh toán"}
                  </Text>
                  <Text strong style={{ fontSize: 18, color: "#dfa974" }}>
                    {selectedMethod === "hotel-payment"
                      ? Math.round(grandTotal).toLocaleString()
                      : depositOption === "deposit" &&
                        selectedMethod === "bank-transfer"
                      ? DEPOSIT_AMOUNT.toLocaleString()
                      : Math.round(grandTotal).toLocaleString()}
                    đ
                  </Text>
                </div>
                {depositOption === "deposit" &&
                  selectedMethod === "bank-transfer" && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <Text type="secondary">Còn lại cần thanh toán</Text>
                      <Text strong style={{ fontSize: 16, color: "#fa8c16" }}>
                        {(
                          Math.round(grandTotal) - DEPOSIT_AMOUNT
                        ).toLocaleString()}
                        đ
                      </Text>
                    </div>
                  )}
                {paymentRef && (
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <Text type="secondary">Mã GD</Text>
                    <Text strong style={{ fontFamily: "monospace" }}>
                      {paymentRef}
                    </Text>
                  </div>
                )}
              </Space>
            </Card>

            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <Button
                type="primary"
                size="large"
                block
                onClick={async () => {
                  // Close modal and run the same final confirm flow to create invoice
                  setConfirmModalVisible(false);
                  await handleFinalConfirm();
                }}
                style={{
                  height: 50,
                  borderRadius: 8,
                  fontWeight: 600,
                  background:
                    "linear-gradient(135deg, #52c41a 0%, #389e0d 100%)",
                  border: "none",
                }}
              >
                Xác nhận và lưu
              </Button>

              <Button
                size="large"
                block
                onClick={() => setConfirmModalVisible(false)}
                style={{
                  height: 50,
                  borderRadius: 8,
                  fontWeight: 600,
                }}
              >
                Đóng
              </Button>
            </Space>
          </div>
        </Modal>
      </Content>

      {/* Footer */}
      <div
        style={{
          background: "linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)",
          borderTop: "2px solid #dfa974",
          padding: "24px 0",
          marginTop: 60,
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "0 24px",
            textAlign: "center",
          }}
        >
          <Space size={24}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <SafetyOutlined style={{ color: "#dfa974" }} />
              <Text type="secondary" style={{ fontSize: 13, color: "#7f8c8d" }}>
                Bảo mật thanh toán
              </Text>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircleOutlined style={{ color: "#52c41a" }} />
              <Text type="secondary" style={{ fontSize: 13, color: "#7f8c8d" }}>
                Xác nhận ngay lập tức
              </Text>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <InfoCircleOutlined style={{ color: "#dfa974" }} />
              <Text type="secondary" style={{ fontSize: 13, color: "#7f8c8d" }}>
                Hỗ trợ 24/7
              </Text>
            </div>
          </Space>
        </div>
      </div>
    </Layout>
  );
};

export default PaymentPage;
