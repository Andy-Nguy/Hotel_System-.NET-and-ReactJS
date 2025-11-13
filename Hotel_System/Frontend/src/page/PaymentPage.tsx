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
  Divider,
  Alert,
  Modal,
  message,
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
  ExportOutlined,
} from "@ant-design/icons";
import BookingProgress from "../components/BookingProgress";
import PromotionLoyaltyPanel from "../components/PromotionLoyaltyPanel";
import PromotionsAvailable from "../components/PromotionsAvailable";
import type { ApplyPromotionResponse } from "../api/promotionApi";

const { Content } = Layout;
const { Title, Text, Paragraph } = Typography;

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
}

const PaymentPage: React.FC = () => {
  const [bookingInfo, setBookingInfo] = useState<BookingInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<string>("bank-transfer");
  const [processingPayment, setProcessingPayment] = useState(false);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [paymentRef, setPaymentRef] = useState<string>("");
  const [momoModalVisible, setMomoModalVisible] = useState(false);
  const [momoProcessing, setMomoProcessing] = useState(false);
  const [creditModalVisible, setCreditModalVisible] = useState(false);
  const [creditForm] = Form.useForm();
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [atmModalVisible, setAtmModalVisible] = useState(false);
  const [cashModalVisible, setCashModalVisible] = useState(false);
  const [ewalletModalVisible, setEwalletModalVisible] = useState(false);
  const [currentWallet, setCurrentWallet] = useState<string>("");
  const [currentPaymentMethod, setCurrentPaymentMethod] = useState<string>("");
  const [promoResult, setPromoResult] = useState<ApplyPromotionResponse | null>(null);
  const [invoiceInfoState, setInvoiceInfoState] = useState<any>(null);

  // Check for presence of public images (avoid rendering empty src and noisy 404s)
  const [vcbQrExists, setVcbQrExists] = useState<boolean | null>(null);
  const [momoQrExists, setMomoQrExists] = useState<boolean | null>(null);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      message.success("Đã sao chép");
    } catch (e) {
      message.error("Không thể sao chép");
    }
  };

  useEffect(() => {
    // probe bank QR
    const img = new Image();
    img.onload = () => setVcbQrExists(true);
    img.onerror = () => setVcbQrExists(false);
    img.src = "";

    // probe momo QR
    const mimg = new Image();
    mimg.onload = () => setMomoQrExists(true);
    mimg.onerror = () => setMomoQrExists(false);
    mimg.src = "";
  }, []);

  const confirmBankTransfer = async () => {
    // Đóng modal QR trước
    setQrModalVisible(false);
    
    // Đặt phương thức thanh toán hiện tại
    setCurrentPaymentMethod("bank-transfer");
    
    // Hiển thị modal xác nhận thanh toán
    setConfirmModalVisible(true);
  };

  const confirmCreditCard = async () => {
    try {
      await creditForm.validateFields();
      setCreditModalVisible(false);
      setCurrentPaymentMethod("credit-card");
      setConfirmModalVisible(true);
    } catch (e: any) {
      Modal.error({ title: "Lỗi", content: "Vui lòng kiểm tra lại thông tin thẻ" });
    }
  };

  const confirmEwallet = async () => {
    setEwalletModalVisible(false);
    setCurrentPaymentMethod(currentWallet);
    setConfirmModalVisible(true);
  };

  const confirmAtm = async () => {
    setAtmModalVisible(false);
    setCurrentPaymentMethod("atm");
    setConfirmModalVisible(true);
  };

  const confirmCash = async () => {
    setCashModalVisible(false);
    setCurrentPaymentMethod("cash");
    setConfirmModalVisible(true);
  };

  const handleFinalConfirm = async () => {
    setProcessingPayment(true);
    
    try {
      // Lấy thông tin từ sessionStorage
      const invoiceData = sessionStorage.getItem("invoiceInfo");
      const bookingData = sessionStorage.getItem("bookingInfo");
      
      console.log("📋 Debug sessionStorage:");
      console.log("- invoiceInfo:", invoiceData);
      console.log("- bookingInfo:", bookingData);

      if (!invoiceData || !bookingData) {
        Modal.error({
          title: "Thiếu thông tin",
          content: "Vui lòng quay lại trang tìm phòng và đặt lại."
        });
        return;
      }

      const invoice = JSON.parse(invoiceData);
      const booking = JSON.parse(bookingData);

      console.log("🔍 DEBUG: invoice =", invoice);
      console.log("🔍 DEBUG: booking =", booking);

      // Tính toán thông tin cần thiết để tạo hóa đơn
      const nights = Math.ceil(
        (new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / (1000 * 60 * 60 * 24)
      );
      
      const totalPrice = booking.selectedRooms.reduce((sum: number, sr: any) => {
        return sum + (sr.room.giaCoBanMotDem || 0) * nights;
      }, 0);

      const discountedBase = promoResult ? promoResult.tongTienSauGiam : totalPrice;
      const tax = discountedBase * 0.1;
      const grandTotal = discountedBase + tax;

      // Xác định trạng thái thanh toán
      let trangThaiThanhToan = 0; // Mặc định: Chưa thanh toán
      if (currentPaymentMethod !== "cash") {
        // Nếu thanh toán online thì coi như đã thanh toán
        trangThaiThanhToan = 2; // Đã thanh toán đủ
      } else {
        // Tiền mặt: chưa thanh toán (trả tại quầy)
        trangThaiThanhToan = 0;
      }

      // BƯỚC 1: TẠO HÓA ĐƠN
      console.log("📝 Bước 1: Tạo hóa đơn...");
      const hoaDonPayload = {
        IDDatPhong: invoice.idDatPhong,
        TienPhong: Math.round(discountedBase), // Tổng tiền phòng sau giảm giá (chưa bao gồm thuế)
        SoLuongNgay: nights,
        TongTien: Math.round(grandTotal), // Tổng tiền bao gồm thuế
        TrangThaiThanhToan: trangThaiThanhToan,
        GhiChu: `Thanh toán qua ${currentPaymentMethod}`
      };

      console.log("� Payload tạo hóa đơn:", hoaDonPayload);

      const hoaDonResponse = await fetch("/api/Payment/hoa-don", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hoaDonPayload)
      });

      if (!hoaDonResponse.ok) {
        const errorText = await hoaDonResponse.text();
        throw new Error(`Lỗi tạo hóa đơn: ${errorText}`);
      }

      const hoaDonResult = await hoaDonResponse.json();
      console.log("✅ Tạo hóa đơn thành công:", hoaDonResult);

      // Lưu ID hóa đơn và grandTotal vào invoice info
      invoice.idHoaDon = hoaDonResult.idHoaDon;
      invoice.grandTotal = Math.round(grandTotal); // Lưu tổng tiền bao gồm thuế
      sessionStorage.setItem("invoiceInfo", JSON.stringify(invoice));

      // Đóng modal confirm
      setConfirmModalVisible(false);

      // Lưu payment result vào sessionStorage
      sessionStorage.setItem("paymentResult", JSON.stringify({
        success: true,
        idDatPhong: invoice.idDatPhong,
        idHoaDon: hoaDonResult.idHoaDon,
        tongTien: hoaDonResult.tongTien,
        tienCoc: hoaDonResult.tienCoc,
        tienThanhToan: hoaDonResult.tienThanhToan,
        trangThaiThanhToan: trangThaiThanhToan,
        paymentMethod: currentPaymentMethod,
        paymentMethodName: 
          currentPaymentMethod === "bank-transfer" ? "Chuyển khoản ngân hàng" :
          currentPaymentMethod === "credit-card" ? "Thẻ tín dụng" :
          currentPaymentMethod === "momo" ? "Ví MoMo" :
          currentPaymentMethod === "zalopay" ? "Ví ZaloPay" :
          currentPaymentMethod === "vnpay" ? "Ví VNPay" :
          currentPaymentMethod === "shopeepay" ? "Ví ShopeePay" :
          currentPaymentMethod === "atm" ? "Thẻ ATM" :
          currentPaymentMethod === "cash" ? "Tiền mặt tại quầy" : ""
      }));

      console.log("🔄 Redirecting to /#booking-success...");

      // Chuyển sang trang BookingSuccess (dùng hash routing)
      window.location.href = "/#booking-success";
      
    } catch (e: any) {
      console.error("❌ Error in handleFinalConfirm:", e);
      setConfirmModalVisible(false);
      Modal.error({ 
        title: "Lỗi thanh toán", 
        content: e?.message || "Có lỗi xảy ra khi xử lý thanh toán. Vui lòng thử lại." 
      });
    } finally {
      setProcessingPayment(false);
    }
  };

  // Handler cho Credit Card - XÓA (không dùng nữa)
  const handleCreditCardSubmit = async () => {
    // Chuyển sang dùng confirmCreditCard
  };

  // Handler cho E-Wallet - XÓA (không dùng nữa)
  const handleEwalletConfirm = async () => {
    // Chuyển sang dùng confirmEwallet
  };

  // Handler cho ATM - XÓA (không dùng nữa)
  const handleAtmConfirm = async () => {
    // Chuyển sang dùng confirmAtm
  };

  // Handler cho Cash - XÓA (không dùng nữa)
  const handleCashConfirm = async () => {
    // Chuyển sang dùng confirmCash
  };

  const paymentMethods = [
    {
      key: "bank-transfer",
      title: "Chuyển khoản QR",
      desc: "Quét mã QR để chuyển khoản",
      icon: <QrcodeOutlined style={{ fontSize: 24 }} />,
      badge: "Miễn phí",
    },
    {
      key: "credit-card",
      title: "Thẻ tín dụng",
      desc: "Visa, Master, JCB",
      icon: <CreditCardOutlined style={{ fontSize: 24 }} />,
      badge: "Miễn phí",
    },
    {
      key: "momo",
      title: "Ví điện tử MoMo",
      desc: "Thanh toán qua ví MoMo",
      icon: <WalletOutlined style={{ fontSize: 24 }} />,
      badge: "Miễn phí",
    },
    {
      key: "zalopay",
      title: "Ví ZaloPay",
      desc: "Thanh toán qua ZaloPay",
      icon: <WalletOutlined style={{ fontSize: 24 }} />,
      badge: "Miễn phí",
    },
    {
      key: "vnpay",
      title: "Ví VNPay",
      desc: "Thanh toán qua VNPay",
      icon: <WalletOutlined style={{ fontSize: 24 }} />,
      badge: "Miễn phí",
    },
    {
      key: "shopeepay",
      title: "Ví ShopeePay",
      desc: "Thanh toán qua ShopeePay",
      icon: <WalletOutlined style={{ fontSize: 24 }} />,
      badge: "Miễn phí",
    },
    {
      key: "atm",
      title: "Thẻ ATM",
      desc: "Thẻ ghi nợ nội địa",
      icon: <BankOutlined style={{ fontSize: 24 }} />,
      badge: "Miễn phí",
    },
    {
      key: "cash",
      title: "Thanh toán tại quầy",
      desc: "Thanh toán trực tiếp tại khách sạn",
      icon: <HomeOutlined style={{ fontSize: 24 }} />,
      badge: "Miễn phí",
    },
  ];

  useEffect(() => {
    // Lấy thông tin đặt phòng từ sessionStorage
    const bookingData = sessionStorage.getItem("bookingInfo");
    const invoiceData = sessionStorage.getItem("invoiceInfo");
    
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

    if (invoiceData) {
      try {
        setInvoiceInfoState(JSON.parse(invoiceData));
      } catch {}
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
      // Mở modal nhập thông tin thẻ tín dụng
      setCreditModalVisible(true);
      return;
    }

    // Ví điện tử: MoMo, ZaloPay, VNPay, ShopeePay
    if (["momo", "zalopay", "vnpay", "shopeepay"].includes(selectedMethod)) {
      setCurrentWallet(selectedMethod);
      const ref = `IVIVU${Date.now().toString().slice(-9)}`;
      setPaymentRef(ref);
      setEwalletModalVisible(true);
      return;
    }

    // Thẻ ATM
    if (selectedMethod === "atm") {
      setAtmModalVisible(true);
      return;
    }

    // Tiền mặt
    if (selectedMethod === "cash") {
      setCashModalVisible(true);
      return;
    }

    // Chuyển khoản QR
    if (selectedMethod === "bank-transfer") {
      const ref = `IVIVU${Date.now().toString().slice(-9)}`;
      setPaymentRef(ref);
      setQrModalVisible(true);
      return;
    }
  };

  const handleGoBack = () => {
    window.history.back();
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

  const totalPrice = calculateTotal();
  const nights = calculateNights();
  const discountedBase = promoResult ? promoResult.tongTienSauGiam : totalPrice;
  const tax = discountedBase * 0.1;
  const grandTotal = discountedBase + tax;

  return (
    <Layout>
      <Content
        style={{
          padding: "24px 50px",
          maxWidth: "1400px",
          margin: "auto",
          width: "100%",
          minHeight: "100vh",
        }}
      >
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={handleGoBack}
          style={{ marginBottom: 16 }}
        >
          Quay lại
        </Button>

        <BookingProgress
          totalRooms={bookingInfo?.totalRooms || 1}
          currentStage="checkout"
          selectedRoomNumbers={
            bookingInfo?.selectedRooms?.map((sr) => sr.roomNumber) || []
          }
        />

        <Title level={2} style={{ marginBottom: 24, textAlign: "center" }}>
          Chọn hình thức thanh toán
        </Title>

        <Row gutter={[24, 24]}>
          {/* Left: Payment Methods */}
          <Col xs={24} lg={14}>
            <div style={{ display: "grid", gap: 12 }}>
              {paymentMethods.map((method) => (
                <Card
                  key={method.key}
                  size="small"
                  hoverable
                  onClick={() => setSelectedMethod(method.key)}
                  style={{
                    cursor: "pointer",
                    border:
                      selectedMethod === method.key
                        ? "2px solid #dfa974"
                        : "1px solid #d9d9d9",
                    background:
                      selectedMethod === method.key ? "#fffaf0" : "#fff",
                  }}
                >
                  <Row gutter={16} align="middle">
                    <Col xs={4} style={{ textAlign: "center", color: "#dfa974" }}>
                      {method.icon}
                    </Col>
                    <Col xs={14}>
                      <div>
                        <Text strong style={{ fontSize: 16 }}>
                          {method.title}
                        </Text>
                        <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                          {method.desc}
                        </div>
                      </div>
                    </Col>
                    <Col xs={6} style={{ textAlign: "right" }}>
                      <Text style={{ color: "#dfa974", fontSize: 12 }}>
                        {method.badge}
                      </Text>
                    </Col>
                  </Row>
                </Card>
              ))}
            </div>

            {/* MoMo info */}
            {selectedMethod === "momo" && (
              <Card style={{ marginTop: 16 }}>
                <Text>
                  Bạn sẽ được chuyển hướng tới ứng dụng MoMo để hoàn tất thanh
                  toán.
                </Text>
              </Card>
            )}

            {/* ZaloPay info */}
            {selectedMethod === "zalopay" && (
              <Card style={{ marginTop: 16 }}>
                <Text>
                  Bạn sẽ được chuyển hướng tới ứng dụng ZaloPay để hoàn tất thanh toán.
                </Text>
              </Card>
            )}

            {/* VNPay info */}
            {selectedMethod === "vnpay" && (
              <Card style={{ marginTop: 16 }}>
                <Text>
                  Bạn sẽ được chuyển hướng tới cổng thanh toán VNPay để hoàn tất thanh toán.
                </Text>
              </Card>
            )}

            {/* ShopeePay info */}
            {selectedMethod === "shopeepay" && (
              <Card style={{ marginTop: 16 }}>
                <Text>
                  Bạn sẽ được chuyển hướng tới ứng dụng ShopeePay để hoàn tất thanh toán.
                </Text>
              </Card>
            )}

            {/* Confirm Button */}
            <Button
              type="primary"
              block
              size="large"
              loading={processingPayment}
              onClick={handleConfirmPayment}
              icon={<CheckCircleOutlined />}
              style={{
                background: "#dfa974",
                borderColor: "#dfa974",
                height: 50,
                fontSize: 16,
                fontWeight: 600,
                marginTop: 24,
                color: "#000",
              }}
            >
              Xác nhận thanh toán {grandTotal.toLocaleString()}đ
            </Button>
          </Col>

          {/* Right: Booking Summary & Total */}
          <Col xs={24} lg={10}>
            <div
              style={{
                position: "sticky",
                top: 24,
                background: "#ffffff",
                color: "#000",
                padding: "24px",
                borderRadius: "8px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              }}
            >
              {/* Header - Total Price */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 12, marginBottom: 8, opacity: 0.6, color: "#666" }}>
                  Tổng thanh toán
                </div>
                <div style={{ fontSize: 32, fontWeight: 700, color: "#dfa974" }}>
                  {Math.round(grandTotal).toLocaleString()}đ
                </div>
              </div>

              {/* Guest Info - Thông tin khách */}
              <div
                style={{
                  marginBottom: 24,
                  paddingBottom: 16,
                  borderBottom: "1px solid #eee",
                }}
              >
                <div style={{ fontSize: 12, marginBottom: 12, opacity: 0.6, fontWeight: 500, color: "#666" }}>
                  THÔNG TIN KHÁCH
                </div>
                <Row gutter={16}>
                  <Col span={12}>
                    <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4, color: "#000" }}>
                      {bookingInfo.guests}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.6, color: "#666" }}>Người lớn</div>
                  </Col>
                  <Col span={12}>
                    <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4, color: "#000" }}>
                      {bookingInfo.selectedRooms.length}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.6, color: "#666" }}>Phòng</div>
                  </Col>
                </Row>
                <div style={{ fontSize: 12, marginTop: 12, opacity: 0.7, color: "#666" }}>
                  Tổng {bookingInfo.guests} khách · {nights} đêm
                </div>
              </div>

              {/* Room Image */}
              {bookingInfo.selectedRooms.length > 0 && bookingInfo.selectedRooms[0]?.room.urlAnhPhong && (
                <div style={{ marginBottom: 20 }}>
                  <img
                    src={bookingInfo.selectedRooms[0].room.urlAnhPhong}
                    alt={bookingInfo.selectedRooms[0].room.tenPhong}
                    style={{
                      width: "100%",
                      height: "160px",
                      objectFit: "cover",
                      borderRadius: "4px",
                    }}
                  />
                </div>
              )}

              {/* Check-in/out Times */}
              <div style={{ marginBottom: 20 }}>
                <Row gutter={16}>
                  <Col span={12}>
                    <div style={{ fontSize: 11, marginBottom: 4, opacity: 0.6, color: "#666" }}>
                      NHẬN PHÒNG
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "#000" }}>14:00</div>
                    <div style={{ fontSize: 12, opacity: 0.6, color: "#666" }}>
                      {bookingInfo.checkIn}
                    </div>
                  </Col>
                  <Col span={12}>
                    <div style={{ fontSize: 11, marginBottom: 4, opacity: 0.6, color: "#666" }}>
                      TRẢ PHÒNG
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "#000" }}>11:00</div>
                    <div style={{ fontSize: 12, opacity: 0.6, color: "#666" }}>
                      {bookingInfo.checkOut}
                    </div>
                  </Col>
                </Row>
              </div>

              {/* Promotion & Loyalty */}
              <PromotionLoyaltyPanel
                invoiceId={invoiceInfoState?.idHoaDon || 0}
                roomIds={(bookingInfo?.selectedRooms || []).map((sr: any) => sr.room?.idphong || sr.room?.idPhong).filter(Boolean)}
                baseAmount={totalPrice}
                customerId={invoiceInfoState?.idKhachHang}
                onApplied={(res: ApplyPromotionResponse | null) => setPromoResult(res)}
              />

              {/* Danh sách khuyến mãi đầy đủ */}
              <div style={{ marginBottom: 20 }}>
                <PromotionsAvailable
                  roomIds={(bookingInfo?.selectedRooms || []).map((sr: any) => sr.room?.idphong || sr.room?.idPhong).filter(Boolean)}
                  title="Tất cả khuyến mãi"
                  compact
                />
              </div>

              {/* Pricing Details - Chi tiết giá */}
              <div
                style={{
                  marginBottom: 24,
                  paddingBottom: 16,
                  borderBottom: "1px solid #eee",
                }}
              >
                <div style={{ fontSize: 12, marginBottom: 12, opacity: 0.6, fontWeight: 500, color: "#666" }}>
                  CHI TIẾT GIÁ
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 8,
                      fontSize: 13,
                      color: "#666",
                    }}
                  >
                    <span>Giá phòng</span>
                    <span>{totalPrice.toLocaleString()}</span>
                  </div>
                  {promoResult && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 8,
                        fontSize: 13,
                        color: "#666",
                      }}
                    >
                      <span>Khuyến mãi</span>
                      <span style={{ color: "#cf1322" }}>- {promoResult.soTienGiam.toLocaleString()}đ</span>
                    </div>
                  )}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 8,
                      fontSize: 13,
                      color: "#666",
                    }}
                  >
                    <span>Thuế VAT (10%)</span>
                    <span>{Math.round(tax).toLocaleString()}đ</span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 13,
                      color: "#666",
                    }}
                  >
                    <span>Phí tiện ích</span>
                    <span>Miễn phí</span>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#000",
                  }}
                >
                  <span>Tổng cộng</span>
                  <span style={{ color: "#dfa974" }}>{Math.round(grandTotal).toLocaleString()}đ</span>
                </div>
              </div>

              {/* Info note */}
              <Alert
                message="Miễn phí hủy trong 24h"
                description="Bạn có thể hủy miễn phí trước 24 giờ nhận phòng"
                type="info"
                showIcon
                style={{ fontSize: 12 }}
              />
            </div>
          </Col>
        </Row>

        {/* Modal QR Chuyển khoản ngân hàng */}
        <Modal
          open={qrModalVisible}
          onCancel={() => setQrModalVisible(false)}
          footer={null}
          width={500}
          centered
        >
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <Title level={4} style={{ marginBottom: 20 }}>
              Quét mã QR để thanh toán
            </Title>

            {/* QR Code từ VietQR API */}
            <div style={{ marginBottom: 20 }}>
              <img
                src={`https://img.vietqr.io/image/bidv-8639699999-print.png?amount=${Math.round(grandTotal)}&addInfo=Thanh toan tien phong ${paymentRef}&accountName=ROBINS VILLA HOTEL`}
                alt="QR Code"
                style={{ width: "100%", maxWidth: 350, height: "auto" }}
              />
            </div>

            {/* Thông tin chuyển khoản */}
            <Card style={{ marginBottom: 20, textAlign: "left" }}>
              <div style={{ marginBottom: 12 }}>
                <Text strong>Ngân hàng: </Text>
                <Text>BIDV - Ngân hàng TMCP Đầu tư và Phát triển Việt Nam</Text>
              </div>
              <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <Text strong>Số tài khoản: </Text>
                  <Text>8639699999</Text>
                </div>
                <Button size="small" onClick={() => copyToClipboard("8639699999")}>
                  Sao chép
                </Button>
              </div>
              <div style={{ marginBottom: 12 }}>
                <Text strong>Chủ tài khoản: </Text>
                <Text>ROBINS VILLA HOTEL</Text>
              </div>
              <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <Text strong>Số tiền: </Text>
                  <Text style={{ color: "#dfa974", fontWeight: 600, fontSize: 16 }}>
                    {Math.round(grandTotal).toLocaleString()}đ
                  </Text>
                </div>
                <Button
                  size="small"
                  onClick={() =>
                    copyToClipboard(
                      Math.round(grandTotal).toString()
                    )
                  }
                >
                  Sao chép
                </Button>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <Text strong>Nội dung: </Text>
                  <Text>{paymentRef}</Text>
                </div>
                <Button size="small" onClick={() => copyToClipboard(paymentRef)}>
                  Sao chép
                </Button>
              </div>
            </Card>

            <Alert
              message="Lưu ý"
              description={
                <div>
                  <p>• Vui lòng chuyển khoản đúng nội dung: <strong>{paymentRef}</strong></p>
                  <p>• Sau khi chuyển khoản thành công, vui lòng nhấn nút bên dưới</p>
                </div>
              }
              type="warning"
              showIcon
              style={{ marginBottom: 20, textAlign: "left" }}
            />

            <Button
              type="primary"
              size="large"
              block
              icon={<CheckCircleOutlined />}
              loading={processingPayment}
              onClick={confirmBankTransfer}
              style={{
                background: "#dfa974",
                borderColor: "#dfa974",
                height: 48,
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              Tôi đã chuyển khoản
            </Button>
          </div>
        </Modal>

        {/* Modal Xác nhận hoàn tất thanh toán */}
        <Modal
          open={confirmModalVisible}
          onCancel={() => setConfirmModalVisible(false)}
          footer={null}
          width={600}
          centered
        >
          <div style={{ textAlign: "center", padding: "30px 20px" }}>
            <CheckCircleOutlined
              style={{ fontSize: 80, color: "#52c41a", marginBottom: 20 }}
            />
            
            <Title level={3} style={{ marginBottom: 16, color: "#52c41a" }}>
              Xác nhận hoàn tất thanh toán
            </Title>

            <Paragraph style={{ fontSize: 16, color: "#666", marginBottom: 24 }}>
              {currentPaymentMethod === "bank-transfer" && (
                <>
                  Bạn đã chuyển khoản thành công số tiền{" "}
                  <Text strong style={{ color: "#dfa974", fontSize: 18 }}>
                    {Math.round(grandTotal).toLocaleString()}đ
                  </Text>
                  ?
                </>
              )}
              {currentPaymentMethod === "credit-card" && (
                <>
                  Xác nhận thanh toán bằng thẻ tín dụng số tiền{" "}
                  <Text strong style={{ color: "#dfa974", fontSize: 18 }}>
                    {Math.round(grandTotal).toLocaleString()}đ
                  </Text>
                  ?
                </>
              )}
              {["momo", "zalopay", "vnpay", "shopeepay"].includes(currentPaymentMethod) && (
                <>
                  Bạn đã thanh toán qua {currentPaymentMethod === "momo" ? "MoMo" : currentPaymentMethod === "zalopay" ? "ZaloPay" : currentPaymentMethod === "vnpay" ? "VNPay" : "ShopeePay"} thành công số tiền{" "}
                  <Text strong style={{ color: "#dfa974", fontSize: 18 }}>
                    {Math.round(grandTotal).toLocaleString()}đ
                  </Text>
                  ?
                </>
              )}
              {currentPaymentMethod === "atm" && (
                <>
                  Bạn đã thanh toán bằng thẻ ATM thành công số tiền{" "}
                  <Text strong style={{ color: "#dfa974", fontSize: 18 }}>
                    {Math.round(grandTotal).toLocaleString()}đ
                  </Text>
                  ?
                </>
              )}
              {currentPaymentMethod === "cash" && (
                <>
                  Xác nhận đặt phòng và thanh toán tại quầy số tiền{" "}
                  <Text strong style={{ color: "#dfa974", fontSize: 18 }}>
                    {Math.round(calculateTotal() + calculateTotal() * 0.1).toLocaleString()}đ
                  </Text>
                  ?
                </>
              )}
            </Paragraph>

            <Card style={{ marginBottom: 24, textAlign: "left", background: "#f9f9f9" }}>
              <Row gutter={[16, 16]}>
                <Col span={24}>
                  <Text strong>Phương thức thanh toán: </Text>
                  <Text style={{ color: "#dfa974" }}>
                    {currentPaymentMethod === "bank-transfer" && "Chuyển khoản ngân hàng"}
                    {currentPaymentMethod === "credit-card" && "Thẻ tín dụng"}
                    {currentPaymentMethod === "momo" && "Ví MoMo"}
                    {currentPaymentMethod === "zalopay" && "Ví ZaloPay"}
                    {currentPaymentMethod === "vnpay" && "Ví VNPay"}
                    {currentPaymentMethod === "shopeepay" && "Ví ShopeePay"}
                    {currentPaymentMethod === "atm" && "Thẻ ATM"}
                    {currentPaymentMethod === "cash" && "Tiền mặt tại quầy"}
                  </Text>
                </Col>
                {currentPaymentMethod === "bank-transfer" && (
                  <>
                    <Col span={24}>
                      <Text strong>Mã giao dịch: </Text>
                      <Text style={{ color: "#dfa974" }}>{paymentRef}</Text>
                    </Col>
                    <Col span={24}>
                      <Text strong>Ngân hàng: </Text>
                      <Text>BIDV - Số TK: 8639699999</Text>
                    </Col>
                    <Col span={24}>
                      <Text strong>Chủ TK: </Text>
                      <Text>ROBINS VILLA HOTEL</Text>
                    </Col>
                  </>
                )}
                {["momo", "zalopay", "vnpay", "shopeepay", "atm"].includes(currentPaymentMethod) && paymentRef && (
                  <Col span={24}>
                    <Text strong>Mã giao dịch: </Text>
                    <Text style={{ color: "#dfa974" }}>{paymentRef}</Text>
                  </Col>
                )}
                <Col span={24}>
                  <Text strong>Số tiền: </Text>
                  <Text style={{ color: "#dfa974", fontSize: 16 }}>
                    {Math.round(grandTotal).toLocaleString()}đ
                  </Text>
                </Col>
              </Row>
            </Card>

            <Paragraph style={{ fontSize: 14, color: "#999", marginBottom: 24 }}>
              {currentPaymentMethod === "cash" 
                ? "Vui lòng thanh toán tại quầy lễ tân khi nhận phòng. Mang theo CMND/CCCD để xác nhận."
                : "Hệ thống sẽ kiểm tra giao dịch của bạn trong vòng 5-10 phút. Bạn sẽ nhận được email xác nhận khi thanh toán được xác thực."
              }
            </Paragraph>

            <Row gutter={16}>
              <Col span={12}>
                <Button
                  size="large"
                  block
                  onClick={() => {
                    setConfirmModalVisible(false);
                    // Quay lại modal tương ứng
                    if (currentPaymentMethod === "bank-transfer") setQrModalVisible(true);
                    else if (currentPaymentMethod === "credit-card") setCreditModalVisible(true);
                    else if (["momo", "zalopay", "vnpay", "shopeepay"].includes(currentPaymentMethod)) setEwalletModalVisible(true);
                    else if (currentPaymentMethod === "atm") setAtmModalVisible(true);
                    else if (currentPaymentMethod === "cash") setCashModalVisible(true);
                  }}
                  style={{ height: 48 }}
                >
                  Quay lại
                </Button>
              </Col>
              <Col span={12}>
                <Button
                  type="primary"
                  size="large"
                  block
                  loading={processingPayment}
                  onClick={handleFinalConfirm}
                  icon={<CheckCircleOutlined />}
                  style={{
                    background: "#52c41a",
                    borderColor: "#52c41a",
                    height: 48,
                    fontSize: 16,
                    fontWeight: 600,
                  }}
                >
                  Xác nhận
                </Button>
              </Col>
            </Row>
          </div>
        </Modal>

        {/* Modal Credit Card */}
        <Modal
          open={creditModalVisible}
          onCancel={() => setCreditModalVisible(false)}
          footer={null}
          width={500}
          centered
          title="Thanh toán bằng thẻ tín dụng"
        >
          <Form form={creditForm} layout="vertical" style={{ marginTop: 20 }}>
            <Form.Item
              label="Số thẻ"
              name="cardNumber"
              rules={[
                { required: true, message: "Vui lòng nhập số thẻ" },
                { pattern: /^\d{16}$/, message: "Số thẻ phải có 16 chữ số" }
              ]}
            >
              <Input placeholder="1234 5678 9012 3456" maxLength={16} />
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="Ngày hết hạn"
                  name="expiry"
                  rules={[
                    { required: true, message: "Vui lòng nhập ngày hết hạn" },
                    { pattern: /^\d{2}\/\d{2}$/, message: "Định dạng: MM/YY" }
                  ]}
                >
                  <Input placeholder="MM/YY" maxLength={5} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="CVV"
                  name="cvv"
                  rules={[
                    { required: true, message: "Vui lòng nhập CVV" },
                    { pattern: /^\d{3}$/, message: "CVV phải có 3 chữ số" }
                  ]}
                >
                  <Input placeholder="123" maxLength={3} type="password" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              label="Tên chủ thẻ"
              name="cardName"
              rules={[{ required: true, message: "Vui lòng nhập tên chủ thẻ" }]}
            >
              <Input placeholder="NGUYEN VAN A" style={{ textTransform: 'uppercase' }} />
            </Form.Item>

            <Button
              type="primary"
              size="large"
              block
              loading={processingPayment}
              onClick={confirmCreditCard}
              icon={<CheckCircleOutlined />}
              style={{
                background: "#dfa974",
                borderColor: "#dfa974",
                height: 48,
                fontSize: 16,
                fontWeight: 600,
                marginTop: 10,
              }}
            >
              Thanh toán {Math.round(grandTotal).toLocaleString()}đ
            </Button>
          </Form>
        </Modal>

        {/* Modal E-Wallet (MoMo, ZaloPay, VNPay, ShopeePay) */}
        <Modal
          open={ewalletModalVisible}
          onCancel={() => setEwalletModalVisible(false)}
          footer={null}
          width={500}
          centered
        >
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <WalletOutlined style={{ fontSize: 60, color: "#dfa974", marginBottom: 20 }} />
            
            <Title level={4} style={{ marginBottom: 20 }}>
              Thanh toán qua {currentWallet === "momo" ? "MoMo" : currentWallet === "zalopay" ? "ZaloPay" : currentWallet === "vnpay" ? "VNPay" : "ShopeePay"}
            </Title>

            <div style={{ marginBottom: 20, padding: 20, background: "#f9f9f9", borderRadius: 8 }}>
              <QrcodeOutlined style={{ fontSize: 120, color: "#666" }} />
              <Paragraph style={{ marginTop: 15, color: "#666" }}>
                Quét mã QR bằng ứng dụng {currentWallet === "momo" ? "MoMo" : currentWallet === "zalopay" ? "ZaloPay" : currentWallet === "vnpay" ? "VNPay" : "ShopeePay"}
              </Paragraph>
            </div>

            <Card style={{ marginBottom: 20, textAlign: "left" }}>
              <div style={{ marginBottom: 12 }}>
                <Text strong>Mã giao dịch: </Text>
                <Text style={{ color: "#dfa974" }}>{paymentRef}</Text>
              </div>
              <div style={{ marginBottom: 12 }}>
                <Text strong>Số tiền: </Text>
                <Text style={{ color: "#dfa974", fontSize: 16, fontWeight: 600 }}>
                  {Math.round(grandTotal).toLocaleString()}đ
                </Text>
              </div>
            </Card>

            <Alert
              message="Hướng dẫn"
              description={
                <div style={{ textAlign: "left" }}>
                  <p>1. Mở ứng dụng {currentWallet === "momo" ? "MoMo" : currentWallet === "zalopay" ? "ZaloPay" : currentWallet === "vnpay" ? "VNPay" : "ShopeePay"} trên điện thoại</p>
                  <p>2. Quét mã QR phía trên</p>
                  <p>3. Xác nhận thanh toán trong ứng dụng</p>
                  <p>4. Nhấn "Tôi đã thanh toán" bên dưới</p>
                </div>
              }
              type="info"
              showIcon
              style={{ marginBottom: 20, textAlign: "left" }}
            />

            <Button
              type="primary"
              size="large"
              block
              icon={<CheckCircleOutlined />}
              loading={processingPayment}
              onClick={confirmEwallet}
              style={{
                background: "#dfa974",
                borderColor: "#dfa974",
                height: 48,
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              Tôi đã thanh toán
            </Button>
          </div>
        </Modal>

        {/* Modal ATM */}
        <Modal
          open={atmModalVisible}
          onCancel={() => setAtmModalVisible(false)}
          footer={null}
          width={500}
          centered
        >
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <BankOutlined style={{ fontSize: 60, color: "#dfa974", marginBottom: 20 }} />
            
            <Title level={4} style={{ marginBottom: 20 }}>
              Thanh toán bằng thẻ ATM
            </Title>

            <div style={{ marginBottom: 20, padding: 20, background: "#f9f9f9", borderRadius: 8 }}>
              <QrcodeOutlined style={{ fontSize: 120, color: "#666" }} />
              <Paragraph style={{ marginTop: 15, color: "#666" }}>
                Quét mã QR bằng ứng dụng ngân hàng của bạn
              </Paragraph>
            </div>

            <Card style={{ marginBottom: 20, textAlign: "left" }}>
              <div style={{ marginBottom: 12 }}>
                <Text strong>Số tiền: </Text>
                <Text style={{ color: "#dfa974", fontSize: 16, fontWeight: 600 }}>
                  {Math.round(grandTotal).toLocaleString()}đ
                </Text>
              </div>
              <div style={{ marginBottom: 12 }}>
                <Text strong>Nội dung: </Text>
                <Text>Thanh toán đặt phòng {paymentRef}</Text>
              </div>
            </Card>

            <Alert
              message="Hướng dẫn"
              description="Quét mã QR bằng ứng dụng Mobile Banking của bạn và xác nhận thanh toán"
              type="info"
              showIcon
              style={{ marginBottom: 20 }}
            />

            <Button
              type="primary"
              size="large"
              block
              icon={<CheckCircleOutlined />}
              loading={processingPayment}
              onClick={confirmAtm}
              style={{
                background: "#dfa974",
                borderColor: "#dfa974",
                height: 48,
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              Tôi đã thanh toán
            </Button>
          </div>
        </Modal>

        {/* Modal Cash */}
        <Modal
          open={cashModalVisible}
          onCancel={() => setCashModalVisible(false)}
          footer={null}
          width={500}
          centered
        >
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <DollarOutlined style={{ fontSize: 60, color: "#52c41a", marginBottom: 20 }} />
            
            <Title level={4} style={{ marginBottom: 20 }}>
              Thanh toán tại quầy
            </Title>

            <Card style={{ marginBottom: 20, background: "#f9f9f9" }}>
              <div style={{ marginBottom: 15 }}>
                <Text style={{ fontSize: 14, color: "#666" }}>Tổng thanh toán</Text>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#dfa974", marginTop: 5 }}>
                  {Math.round(grandTotal).toLocaleString()}đ
                </div>
              </div>
            </Card>

            <Alert
              message="Thông tin thanh toán"
              description={
                <div style={{ textAlign: "left" }}>
                  <p>• Vui lòng thanh toán tại quầy lễ tân khi nhận phòng</p>
                  <p>• Mang theo CMND/CCCD để xác nhận đặt phòng</p>
                  <p>• Chúng tôi chấp nhận thanh toán bằng tiền mặt hoặc thẻ</p>
                </div>
              }
              type="info"
              showIcon
              style={{ marginBottom: 20, textAlign: "left" }}
            />

            <Button
              type="primary"
              size="large"
              block
              icon={<CheckCircleOutlined />}
              loading={processingPayment}
              onClick={confirmCash}
              style={{
                background: "#52c41a",
                borderColor: "#52c41a",
                height: 48,
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              Xác nhận đặt phòng
            </Button>
          </div>
        </Modal>
      </Content>
    </Layout>
  );
};

export default PaymentPage;
