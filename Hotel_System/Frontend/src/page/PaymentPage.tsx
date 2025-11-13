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
  const [appliedPromotionObj, setAppliedPromotionObj] = useState<any | null>(null);
  const [invoiceInfoState, setInvoiceInfoState] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [redeemPoints, setRedeemPoints] = useState<number>(0);
  const [promoCode, setPromoCode] = useState<string>("");
  const [applyingPromoCode, setApplyingPromoCode] = useState(false);
  const [externalPromoApplied, setExternalPromoApplied] = useState<ApplyPromotionResponse | null>(null);
  const [disableAutoApplyPromos, setDisableAutoApplyPromos] = useState(false);

  // derive profile points from several possible sources (backend uses different casings sometimes)
  const profilePoints: number | null = (() => {
    try {
      if (profile) return profile.tichDiem ?? profile.tichdiem ?? profile.points ?? profile.Points ?? null;
      if (invoiceInfoState) return invoiceInfoState.tichDiem ?? invoiceInfoState.tichdiem ?? null;
      const cust = sessionStorage.getItem("customerInfo");
      if (cust) {
        const parsed = JSON.parse(cust);
        return parsed.tichDiem ?? parsed.tichdiem ?? null;
      }
    } catch (e) {
      // ignore
    }
    return null;
  })();

  // Computed discount value (legacy UI expects soTienGiam)
  const promoDiscount = promoResult ? (promoResult.soTienGiam ?? promoResult.discountAmount ?? 0) : 0;

  // Fetch full promotion details when a promo is applied (auto or external) so we can show per-room breakdown
  useEffect(() => {
    let mounted = true;
    const fetchPromo = async (id?: string | null) => {
      if (!id) {
        setAppliedPromotionObj(null);
        return;
      }
      try {
        const { getPromotionById } = await import('../api/promotionApi');
        const p = await getPromotionById(id);
        if (mounted) setAppliedPromotionObj(p || null);
      } catch (e) {
        if (mounted) setAppliedPromotionObj(null);
      }
    };

    const id = promoResult?.appliedPromotionId || externalPromoApplied?.appliedPromotionId || null;
    fetchPromo(id as any);
    return () => { mounted = false; };
  }, [promoResult?.appliedPromotionId, externalPromoApplied?.appliedPromotionId]);

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
  // apply client-side redeem preview (1 point = 1000đ)
  const POINT_VALUE = 1000;
  const redeemValueClient = Math.min(redeemPoints * POINT_VALUE, grandTotal);
  const grandTotalAfterRedeem = Math.max(0, grandTotal - redeemValueClient);

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
      // Ensure we extract IDDatPhong robustly (backend may have different casing)
      const idDatPhong = invoice.IDDatPhong || invoice.idDatPhong || invoice.idDatphong || invoice.idDatPhong;

      // Ensure numeric values are proper numbers (no commas or NaN)
      const tienPhongInt = Number.isFinite(Number(discountedBase)) ? Math.round(Number(discountedBase)) : Math.round(Number(totalPrice || 0));
      const tongTienDecimal = Number.isFinite(Number(grandTotalAfterRedeem)) ? Number(Math.round(Number(grandTotalAfterRedeem))) : Number(Math.round(Number(grandTotal || 0)));

      const hoaDonPayload = {
        IDDatPhong: idDatPhong,
        TienPhong: tienPhongInt,
        SoLuongNgay: Number.isFinite(Number(nights)) ? Number(nights) : 1,
        TongTien: tongTienDecimal,
        TrangThaiThanhToan: Number.isFinite(Number(trangThaiThanhToan)) ? Number(trangThaiThanhToan) : 0,
        GhiChu: `Thanh toán qua ${currentPaymentMethod}`,
        RedeemPoints: redeemPoints > 0 ? Number(redeemPoints) : undefined
      };

      // Ensure we have a booking id to send
      if (!hoaDonPayload.IDDatPhong) {
        Modal.error({ title: "Thiếu thông tin", content: "Không tìm thấy mã đặt phòng (IDDatPhong). Vui lòng quay lại trang đặt phòng." });
        return;
      }

      // Log the exact JSON being sent for easier debugging
      console.log("📤 Payload tạo hóa đơn (JSON):", JSON.stringify(hoaDonPayload));

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

      // Lưu payment result vào sessionStorage (bao gồm thông tin server-applied về điểm và redeem)
      sessionStorage.setItem("paymentResult", JSON.stringify({
        success: true,
        idDatPhong: invoice.idDatPhong,
        idHoaDon: hoaDonResult.idHoaDon,
        tongTien: hoaDonResult.tongTien,
        tienCoc: hoaDonResult.tienCoc,
        tienThanhToan: hoaDonResult.tienThanhToan,
        trangThaiThanhToan: trangThaiThanhToan,
        redeemedPoints: hoaDonResult.redeemedPoints,
        redeemedValue: hoaDonResult.redeemedValue,
        pointsEarned: hoaDonResult.pointsEarned,
        pointsAfter: hoaDonResult.pointsAfter,
        appliedPromotionValue: hoaDonResult.appliedPromotionValue,
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

        // If bookingInfo is missing or has no selectedRooms, try to recover from invoiceInfo (rooms saved at checkout)
        if ((!parsedBooking || !parsedBooking.selectedRooms || parsedBooking.selectedRooms.length === 0) && parsedInvoice.rooms && parsedInvoice.rooms.length > 0) {
          const recovered = {
            selectedRooms: parsedInvoice.rooms,
            checkIn: parsedInvoice.checkIn || parsedInvoice.ngayNhanPhong,
            checkOut: parsedInvoice.checkOut || parsedInvoice.ngayTraPhong,
            guests: parsedInvoice.guests || parsedInvoice.soLuongKhach || 1,
            totalRooms: (parsedInvoice.rooms || []).length,
          };
          setBookingInfo(recovered);
        }
      } catch {}
    }
    // If user is logged in, fetch profile to read current points
    const token = localStorage.getItem("hs_token");
    if (token) {
      fetch("/api/auth/profile", { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.ok ? r.json() : Promise.reject())
        .then((data) => setProfile(data))
        .catch(() => { /* ignore */ });
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

  // Stable memoized list of selected room ids to avoid recreating arrays each render
  const memoRoomIds = useMemo(() => {
    return (bookingInfo?.selectedRooms || []).map((sr: any) => sr.room?.idphong || sr.room?.idPhong).filter(Boolean);
  }, [bookingInfo?.selectedRooms]);

  // Chi tiết giá theo phòng: phòng nào được giảm, phòng nào giá thường
  const perRoomPricing = useMemo(() => {
    try {
      if (!bookingInfo || !bookingInfo.selectedRooms || bookingInfo.selectedRooms.length === 0) {
        return { rows: [], totalAfterPromo: 0 };
      }

      const n = Math.max(
        1,
        Math.ceil(
          (new Date(bookingInfo.checkOut).getTime() - new Date(bookingInfo.checkIn).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      );

      const rooms = (bookingInfo.selectedRooms || []).map((sr: any) => {
        const rid = sr.room?.idphong || sr.room?.idPhong || sr.room?.id || sr.roomId;
        const pricePerNight = sr.room?.giaCoBanMotDem || sr.room?.gia || 0;
        const base = pricePerNight * n;
        const name = sr.room?.tenPhong || `Phòng ${sr.roomNumber}`;
        return {
          key: sr.roomNumber,
          rid,
          roomNumber: sr.roomNumber,
          name,
          pricePerNight,
          nights: n,
          base,
        };
      });

      // Các phòng được promo áp dụng (nếu có)
      const eligibleIds: any[] = (appliedPromotionObj?.khuyenMaiPhongs || [])
        .map((kp: any) => kp?.idphong ?? kp?.idPhong)
        .filter(Boolean);

      // Tổng tiền giảm từ API/promoResult (để phân bổ theo tỷ lệ cho các phòng được áp dụng)
      const totalDiscount =
        Number(promoResult?.soTienGiam ?? promoResult?.discountAmount ?? 0) || 0;

      // Tổng tiền gốc của các phòng có áp dụng khuyến mãi
      const eligibleBaseSum = rooms.reduce(
        (sum, r) => sum + (eligibleIds.includes(r.rid) ? r.base : 0),
        0
      );

      const rows = rooms.map((r) => ({
        ...r,
        eligible: eligibleIds.includes(r.rid),
        discount: 0,
        after: r.base,
      }));

      if (totalDiscount > 0 && eligibleBaseSum > 0) {
        // Phân bổ số tiền giảm theo tỷ lệ trên các phòng đủ điều kiện
        let allocated = 0;
        const eligibleRows = rows.filter((r) => r.eligible);
        eligibleRows.forEach((r, idx) => {
          // chia theo tỷ lệ base của từng phòng
          let d = Math.round((r.base / eligibleBaseSum) * totalDiscount);
          // điều chỉnh làm tròn ở item cuối để tổng khớp tuyệt đối
          if (idx === eligibleRows.length - 1) {
            d = Math.max(0, totalDiscount - allocated);
          }
          r.discount = Math.min(d, r.base);
          r.after = Math.max(0, r.base - r.discount);
          allocated += d;
        });
      } else if (
        eligibleBaseSum > 0 &&
        (appliedPromotionObj?.loaiGiamGia === "percent" ||
          appliedPromotionObj?.loaiGiamGia === "percentage")
      ) {
        // Trường hợp không có totalDiscount cụ thể, nhưng biết khuyến mãi % -> tính theo % cho phòng đủ điều kiện
        const percent = Number(appliedPromotionObj?.giaTriGiam ?? 0) / 100;
        rows.forEach((r) => {
          if (r.eligible && percent > 0) {
            r.discount = Math.round(r.base * percent);
            r.after = Math.max(0, r.base - r.discount);
          }
        });
      }
      // Tổng sau khuyến mãi (cộng tất cả phòng)
      const totalAfterPromo = rows.reduce((sum, r) => sum + r.after, 0);

      return { rows, totalAfterPromo };
    } catch {
      return { rows: [], totalAfterPromo: 0 };
    }
  }, [
    bookingInfo?.selectedRooms,
    bookingInfo?.checkIn,
    bookingInfo?.checkOut,
    appliedPromotionObj,
    promoResult?.soTienGiam,
    promoResult?.discountAmount,
  ]);

  // Stable handler passed to Promotion components to avoid re-triggering their effects
  const handlePromotionApplied = useCallback((res: ApplyPromotionResponse | null) => {
    setPromoResult(res);
  }, [setPromoResult]);

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

  <Row gutter={[24, 24]} style={{ alignItems: 'stretch' }}>
          {/* Top: main column (left) + enlarged right image/info column */}
          <Col xs={24} lg={16}>
            <div
              style={{
                background: "#ffffff",
                color: "#000",
                padding: "18px",
                borderRadius: "8px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                display: 'flex',
                gap: 20,
                alignItems: 'flex-start',
                flexWrap: 'wrap'
              }}
            >
              {/* Left column header (label only) */}
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 12, marginBottom: 8, opacity: 0.6, color: "#666", fontWeight: 700 }}>THÔNG TIN ĐẶT PHÒNG</div>
              </div>

              {/* selected rooms pills moved to right column per UX request */}
            </div>

            {/* (selected-room panel moved to right column) */}

            {/* Below summary: promotions, loyalty and pricing */}
            <div style={{ marginTop: 18 }}>
              <PromotionLoyaltyPanel
                invoiceId={invoiceInfoState?.idHoaDon || 0}
                roomIds={memoRoomIds}
                baseAmount={totalPrice}
                selectedRooms={bookingInfo.selectedRooms}
                nights={nights}
                checkIn={bookingInfo.checkIn}
                checkOut={bookingInfo.checkOut}
                customerId={invoiceInfoState?.idKhachHang}
                onApplied={handlePromotionApplied}
                disableAutoApply={disableAutoApplyPromos}
                externalApplied={externalPromoApplied}
              />

              <div style={{ marginTop: 12 }}>
                <PromotionsAvailable
                  roomIds={memoRoomIds}
                  checkIn={bookingInfo.checkIn}
                  checkOut={bookingInfo.checkOut}
                  title="Tất cả khuyến mãi"
                  compact
                />
              </div>

              <div style={{ marginTop: 12 }}>
                <Input.Search
                  placeholder="Nhập mã khuyến mãi"
                  enterButton="Áp dụng"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  loading={applyingPromoCode}
                  onSearch={async (value) => {
                    const code = (value || promoCode || "").trim();
                    if (!code) {
                      message.warning("Vui lòng nhập mã khuyến mãi");
                      return;
                    }
                    try {
                      setApplyingPromoCode(true);
                      const { getAllPromotions } = await import("../api/promotionApi");
                      const all = await getAllPromotions("active");
                      const match = all.find((p: any) => (p.tenKhuyenMai || "").toLowerCase() === code.toLowerCase() || (p.idkhuyenMai || "").toLowerCase() === code.toLowerCase());
                      if (!match) {
                        message.error("Mã khuyến mãi không hợp lệ");
                        return;
                      }
                      const roomIds = memoRoomIds;
                      const promoRoomIds = (match.khuyenMaiPhongs || []).map((kp: any) => kp.idphong);
                      const intersects = roomIds.some((rid: any) => promoRoomIds.includes(rid));
                      if (!intersects) {
                        message.error("Mã này không áp dụng cho phòng đã chọn");
                        return;
                      }
                      // compute eligible total only for rooms covered by this promo
                      const eligibleTotal = (bookingInfo.selectedRooms || []).reduce((sum: number, sr: any) => {
                        const rid = sr.room?.idphong || sr.room?.idPhong || sr.room?.id || sr.roomId;
                        if (!rid) return sum;
                        if (promoRoomIds.includes(rid)) {
                          const price = sr.room?.giaCoBanMotDem || sr.room?.gia || 0;
                          return sum + (price * (nights || 1));
                        }
                        return sum;
                      }, 0);

                      let discount = 0;
                      if (match.loaiGiamGia === "percent") {
                        discount = (match.giaTriGiam || 0) / 100 * eligibleTotal;
                      } else {
                        discount = Math.min(match.giaTriGiam || 0, eligibleTotal);
                      }
                      const totalAfter = Math.max(0, totalPrice - discount);
                      const points = Math.floor(totalAfter / 100000);
                      const applied: ApplyPromotionResponse = {
                        tongTienSauGiam: Math.round(totalAfter),
                        discountAmount: Math.round(discount),
                        appliedPromotionId: match.idkhuyenMai,
                        appliedPromotionName: match.tenKhuyenMai,
                        pointsEstimated: points,
                      };
                      setExternalPromoApplied(applied);
                      setDisableAutoApplyPromos(true);
                      setPromoResult(applied);
                      message.success("Áp dụng mã khuyến mãi thành công");
                    } catch (e: any) {
                      console.error(e);
                      message.error("Lỗi khi áp dụng mã");
                    } finally {
                      setApplyingPromoCode(false);
                    }
                  }}
                />
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, marginBottom: 8, opacity: 0.7 }}>Sử dụng điểm tích lũy</div>
                {profilePoints != null && profilePoints !== undefined ? (
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ fontSize: 13 }}>
                      Điểm hiện có: <b>{profilePoints}</b>
                    </div>
                    <InputNumber min={0} max={profilePoints ?? 0} value={redeemPoints} onChange={(v) => setRedeemPoints(Number(v) || 0)} />
                    <div style={{ color: '#888', fontSize: 12 }}>Mỗi điểm = 1.000đ</div>
                  </div>
                ) : (
                  <div style={{ color: '#888', fontSize: 13 }}>Đăng nhập để dùng điểm tích lũy</div>
                )}
              </div>

              {/* Chi tiết giá theo phòng: giúp khách thấy phòng nào giảm/không giảm */}
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  border: '1px dashed #eee',
                  borderRadius: 8,
                  background: '#fff',
                }}
              >
                <div style={{ fontSize: 12, marginBottom: 8, fontWeight: 700, color: '#666' }}>
                  Chi tiết giá theo phòng
                </div>

                {perRoomPricing.rows.length === 0 ? (
                  <div style={{ color: '#888', fontSize: 13 }}>Không có dữ liệu phòng</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {perRoomPricing.rows.map((r: any) => (
                      <div
                        key={r.key}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 10px',
                          border: '1px solid #f5f5f5',
                          borderRadius: 8,
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>
                            {r.name}{' '}
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 500,
                                marginLeft: 8,
                                color: r.discount > 0 ? '#52c41a' : '#999',
                              }}
                            >
                              {r.discount > 0 ? 'Được khuyến mãi' : 'Giá thường'}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: '#888' }}>
                            {r.nights} đêm x {r.pricePerNight.toLocaleString()}đ ={' '}
                            {r.base.toLocaleString()}đ
                            {r.discount > 0 && (
                              <span style={{ marginLeft: 8, color: '#cf1322' }}>
                                − {r.discount.toLocaleString()}đ
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          {r.discount > 0 ? (
                            <>
                              <div
                                style={{
                                  fontSize: 12,
                                  color: '#999',
                                  textDecoration: 'line-through',
                                }}
                              >
                                {r.base.toLocaleString()}đ
                              </div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: '#dfa974' }}>
                                {r.after.toLocaleString()}đ
                              </div>
                            </>
                          ) : (
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#333' }}>
                              {r.after.toLocaleString()}đ
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 4 }}>
                      <span style={{ color: '#666' }}>Tổng giá phòng sau khuyến mãi</span>
                      <span style={{ fontWeight: 600 }}>
                        {perRoomPricing.totalAfterPromo.toLocaleString()}đ
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ marginTop: 12, marginBottom: 6, paddingTop: 12, borderTop: '1px solid #eee' }}>
                {/* Ẩn Giá phòng + Khuyến mãi + Đổi điểm theo yêu cầu, chỉ giữ Thuế + Tổng cộng */}
                {false && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, color: '#666' }}>
                    <span>Giá phòng</span>
                    <span>{totalPrice.toLocaleString()}</span>
                  </div>
                )}
                {false && promoDiscount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, color: '#666' }}>
                        <span>Khuyến mãi {promoResult?.appliedPromotionName ? `(${promoResult?.appliedPromotionName})` : ""}</span>
                    <span style={{ color: '#cf1322' }}>- {promoDiscount.toLocaleString()}đ</span>
                  </div>
                )}
                {false && redeemPoints > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, color: '#666' }}>
                    <span>Đổi điểm ({redeemPoints} điểm)</span>
                    <span style={{ color: '#cf1322' }}>- {(Math.min(redeemPoints * 1000, Math.round(grandTotal))).toLocaleString()}đ</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, color: '#666' }}>
                  <span>Thuế VAT (10%)</span>
                  <span>{Math.round(tax).toLocaleString()}đ</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: '#000' }}>
                  <span>Tổng cộng</span>
                  <span style={{ color: '#dfa974' }}>{Math.round(grandTotal).toLocaleString()}đ</span>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <Alert
                  message="Miễn phí hủy trong 24h"
                  description="Bạn có thể hủy miễn phí trước 24 giờ nhận phòng"
                  type="info"
                  showIcon
                  style={{ fontSize: 12 }}
                />
              </div>
            </div>
          </Col>

          {/* Right column: show selected rooms and compact booking summary */}
          <Col xs={24} lg={8}>
            <div style={{ height: '100%' }}>
              <div style={{ background: '#fff', borderRadius: 8, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', height: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#666' }}>PHÒNG ĐÃ CHỌN</div>

                {/* Hình phòng dọc, full chiều ngang, cao hơn để đẹp mắt */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {(bookingInfo.selectedRooms || []).map((sr: any) => (
                    <div
                      key={sr.roomNumber}
                      style={{
                        padding: 8,
                        border: '1px solid #f5f5f5',
                        borderRadius: 10,
                        background: '#fff',
                      }}
                    >
                      <div
                        style={{
                          width: '100%',
                          height: 200, // chiều cao ảnh dọc
                          overflow: 'hidden',
                          borderRadius: 8,
                          background: '#f2f2f2',
                        }}
                      >
                        <img
                          src={sr.room?.urlAnhPhong || '/img/placeholder.png'}
                          alt={sr.room?.tenPhong}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            display: 'block',
                          }}
                        />
                      </div>
                      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#333' }}>
                          {sr.room?.tenPhong || `Phòng ${sr.roomNumber}`}
                        </div>
                        <div style={{ fontSize: 12, color: '#888' }}>
                          Phòng #{sr.roomNumber}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 'auto', paddingTop: 8, borderTop: '1px solid #f0f0f0' }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <div style={{ fontSize: 13 }}><b>{bookingInfo.guests}</b> người</div>
                    <div style={{ fontSize: 13 }}><b>{bookingInfo.selectedRooms.length}</b> phòng</div>
                    <div style={{ fontSize: 13 }}><b>{nights}</b> đêm</div>
                  </div>
                  <div style={{ fontSize: 13, color: '#888' }}>{bookingInfo.checkIn} → {bookingInfo.checkOut}</div>
                </div>
              </div>
            </div>
          </Col>

          {/* Bottom: Payment methods (full width, below summary) */}
          <Col xs={24}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "stretch", marginTop: 6 }}>
              {paymentMethods.map((method) => (
                <Card
                  key={method.key}
                  size="small"
                  hoverable
                  onClick={() => setSelectedMethod(method.key)}
                  bodyStyle={{ padding: 10 }}
                  style={{
                    cursor: "pointer",
                    border:
                      selectedMethod === method.key
                        ? "2px solid #dfa974"
                        : "1px solid #d9d9d9",
                    background:
                      selectedMethod === method.key ? "#fffaf0" : "#fff",
                    width: "calc(25% - 9px)",
                    minWidth: 160,
                    boxSizing: "border-box",
                  }}
                >
                  <Row gutter={8} align="middle">
                    <Col xs={6} style={{ textAlign: "center", color: "#dfa974" }}>
                      {React.cloneElement(method.icon as any, { style: { fontSize: 18 } })}
                    </Col>
                    <Col xs={14}>
                      <div>
                        <Text strong style={{ fontSize: 13 }}>
                          {method.title}
                        </Text>
                        <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
                          {method.desc}
                        </div>
                      </div>
                    </Col>
                    <Col xs={4} style={{ textAlign: "right" }}>
                      <Text style={{ color: "#dfa974", fontSize: 12 }}>
                        {method.badge}
                      </Text>
                    </Col>
                  </Row>
                </Card>
              ))}
            </div>

            {/* method-specific info (momo, zalopay, vnpay, shopeepay) */}
            <div style={{ marginTop: 12 }}>
              {selectedMethod === "momo" && (
                <Card style={{ marginTop: 8 }}>
                  <Text>
                    Bạn sẽ được chuyển hướng tới ứng dụng MoMo để hoàn tất thanh toán.
                  </Text>
                </Card>
              )}
              {selectedMethod === "zalopay" && (
                <Card style={{ marginTop: 8 }}>
                  <Text>
                    Bạn sẽ được chuyển hướng tới ứng dụng ZaloPay để hoàn tất thanh toán.
                  </Text>
                </Card>
              )}
              {selectedMethod === "vnpay" && (
                <Card style={{ marginTop: 8 }}>
                  <Text>
                    Bạn sẽ được chuyển hướng tới cổng thanh toán VNPay để hoàn tất thanh toán.
                  </Text>
                </Card>
              )}
              {selectedMethod === "shopeepay" && (
                <Card style={{ marginTop: 8 }}>
                  <Text>
                    Bạn sẽ được chuyển hướng tới ứng dụng ShopeePay để hoàn tất thanh toán.
                  </Text>
                </Card>
              )}
            </div>

            {/* Confirm button */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <Button
                type="primary"
                size="middle"
                loading={processingPayment}
                onClick={handleConfirmPayment}
                icon={<CheckCircleOutlined />}
                style={{
                  background: "#dfa974",
                  borderColor: "#dfa974",
                  height: 36,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#000",
                  padding: '0 12px',
                }}
              >
                Thanh toán {Math.round(grandTotal).toLocaleString()}đ
              </Button>
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