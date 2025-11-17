import React, { useState, useEffect } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  Modal,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { COLORS, SIZES, FONTS, SHADOWS } from "../constants/theme";
import AppIcon from "../components/AppIcon";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { buildApiUrl } from "../config/apiConfig";
import BookingProgress from "../components/BookingProgress";

interface InvoiceInfo {
  idDatPhong: string;
  idKhachHang: string;
  rooms: any[];
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  totalPrice: number;
  tax: number;
  grandTotal: number;
  holdExpiresAt?: string;
  customer: any;
  selectedServices?: any[];
}

const PaymentScreen: React.FC = () => {
  const navigation = useNavigation();
  const [invoiceInfo, setInvoiceInfo] = useState<InvoiceInfo | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<string>("bank-transfer");
  const [depositOption, setDepositOption] = useState<"deposit" | "full">(
    "full"
  );
  const [processingPayment, setProcessingPayment] = useState(false);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [paymentRef, setPaymentRef] = useState<string>("");
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);

  const DEPOSIT_AMOUNT = 500000; // 500,000 VND

  useEffect(() => {
    loadInvoiceInfo();
  }, []);

  const loadInvoiceInfo = async () => {
    try {
      const invoiceData = await AsyncStorage.getItem("invoiceInfo");
      if (invoiceData) {
        const parsed = JSON.parse(invoiceData);
        setInvoiceInfo(parsed);
      } else {
        Alert.alert("Lỗi", "Không tìm thấy thông tin hóa đơn");
        navigation.goBack();
      }
    } catch (error) {
      console.error("Error loading invoice info:", error);
      Alert.alert("Lỗi", "Không thể tải thông tin hóa đơn");
      navigation.goBack();
    }
  };

  const handleConfirmPayment = () => {
    if (selectedMethod === "bank-transfer") {
      const ref = `IVIVU${Date.now().toString().slice(-9)}`;
      setPaymentRef(ref);
      setQrModalVisible(true);
    } else {
      setConfirmModalVisible(true);
    }
  };

  const handleFinalConfirm = async () => {
    if (!invoiceInfo) return;

    setProcessingPayment(true);
    try {
      let paymentStatus: "unpaid" | "deposit" | "paid" = "unpaid";
      let amountPaid = 0;
      let trangThaiThanhToan = 1; // 1: Chưa TT
      let phuongThucThanhToan = 1; // 1 = tiền mặt
      let tienCoc = 0;

      if (selectedMethod === "hotel-payment") {
        paymentStatus = "unpaid";
        amountPaid = 0;
        trangThaiThanhToan = 1;
        phuongThucThanhToan = 1;
        tienCoc = 0;
      } else if (selectedMethod === "bank-transfer") {
        if (depositOption === "deposit") {
          paymentStatus = "deposit";
          amountPaid = DEPOSIT_AMOUNT;
          trangThaiThanhToan = 0; // 0 = Đã cọc
          phuongThucThanhToan = 2; // 2 = online
          tienCoc = DEPOSIT_AMOUNT;
        } else {
          paymentStatus = "paid";
          amountPaid = Math.round(invoiceInfo.grandTotal);
          trangThaiThanhToan = 2; // 2 = Đã thanh toán
          phuongThucThanhToan = 2;
          tienCoc = 0;
        }
      } else {
        paymentStatus = "paid";
        amountPaid = Math.round(invoiceInfo.grandTotal);
        trangThaiThanhToan = 2;
        phuongThucThanhToan = 2;
        tienCoc = 0;
      }

      const invoicePayload = {
        IDDatPhong: invoiceInfo.idDatPhong,
        TienPhong: invoiceInfo.totalPrice,
        SoLuongNgay: invoiceInfo.nights,
        TongTien: Math.round(invoiceInfo.grandTotal),
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
        Services:
          invoiceInfo.selectedServices && invoiceInfo.selectedServices.length
            ? invoiceInfo.selectedServices.map((svc: any) => ({
                IddichVu: svc.serviceId || svc.iddichVu || svc.serviceId,
                SoLuong: svc.quantity || svc.soLuong || 1,
                DonGia: svc.price || svc.donGia || 0,
                TienDichVu:
                  (svc.price || svc.donGia || 0) *
                  (svc.quantity || svc.soLuong || 1),
              }))
            : [],
      };

      const response = await fetch(buildApiUrl("/api/Payment/hoa-don"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(invoicePayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Không thể tạo hóa đơn");
      }

      const result = await response.json();

      const updatedInvoiceInfo = {
        ...invoiceInfo,
        idHoaDon: result.idHoaDon,
        trangThaiThanhToan: trangThaiThanhToan,
        paymentStatus: paymentStatus,
        amountPaid: amountPaid,
        depositAmount: tienCoc,
      };

      await AsyncStorage.setItem(
        "invoiceInfo",
        JSON.stringify(updatedInvoiceInfo)
      );
      await AsyncStorage.setItem(
        "paymentResult",
        JSON.stringify({
          success: true,
          paymentMethod: selectedMethod,
          paymentStatus: paymentStatus,
          amountPaid: amountPaid,
          depositAmount: tienCoc,
          totalAmount: Math.round(invoiceInfo.grandTotal),
          idHoaDon: result.idHoaDon,
        })
      );

      setProcessingPayment(false);
      setQrModalVisible(false);
      setConfirmModalVisible(false);

      // Navigate to success screen
      navigation.navigate("BookingSuccess" as never);
    } catch (error: any) {
      console.error("Error:", error);
      const errMsg =
        error?.message ||
        (typeof error === "string" ? error : null) ||
        "Có lỗi xảy ra. Vui lòng thử lại.";
      console.error(
        "Payment error details, API base:",
        buildApiUrl("/"),
        errMsg
      );
      Alert.alert(
        "Lỗi thanh toán",
        `${errMsg}\n(Thử kiểm tra biến DEFAULT_BASE_URL trong mobile/src/config/apiConfig.ts)`
      );
    } finally {
      setProcessingPayment(false);
    }
  };

  const paymentMethods = [
    {
      key: "bank-transfer",
      title: "Chuyển khoản",
      subtitle: "QR Code",
      icon: "qrcode",
      recommended: true,
    },
    {
      key: "momo",
      title: "Ví MoMo",
      subtitle: "Thanh toán nhanh",
      icon: "mobile",
    },
    {
      key: "hotel-payment",
      title: "Thanh toán tại khách sạn",
      subtitle: "Thanh toán khi nhận phòng",
      icon: "home",
    },
  ];

  if (!invoiceInfo) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Đang tải...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <AppIcon name="arrow-left" size={20} color={COLORS.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thanh toán</Text>
        <View style={{ width: 20 }} />
      </View>
      <BookingProgress
        currentStage="checkout"
        totalRooms={invoiceInfo.rooms.length}
        selectedRoomNumbers={invoiceInfo.rooms.map((_, index) => index + 1)}
      />
      <ScrollView
        style={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Booking Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Chi tiết đặt phòng</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Mã đặt phòng:</Text>
            <Text style={styles.summaryValue}>
              {String(invoiceInfo.idDatPhong)}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Nhận phòng:</Text>
            <Text style={styles.summaryValue}>
              {new Date(invoiceInfo.checkIn).toLocaleDateString("vi-VN")}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Trả phòng:</Text>
            <Text style={styles.summaryValue}>
              {new Date(invoiceInfo.checkOut).toLocaleDateString("vi-VN")}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Số đêm:</Text>
            <Text style={styles.summaryValue}>
              {String(invoiceInfo.nights)}
            </Text>
          </View>

          <View style={styles.roomList}>
            <Text style={styles.roomListTitle}>Phòng đã đặt:</Text>
            {invoiceInfo.rooms.map((room: any, index: number) => (
              <View key={index} style={styles.roomItem}>
                <Text style={styles.roomName}>
                  Phòng {String(room.roomNumber)}:{" "}
                  {String(room.room.roomTypeName)}
                </Text>
                <Text style={styles.roomPrice}>
                  $
                  {String(
                    (
                      room.room.discountedPrice ||
                      room.room.basePricePerNight ||
                      0
                    ).toLocaleString()
                  )}
                </Text>
              </View>
            ))}
          </View>

          {invoiceInfo.selectedServices &&
            invoiceInfo.selectedServices.length > 0 && (
              <View style={styles.roomList}>
                <Text style={styles.roomListTitle}>Dịch vụ đã đặt:</Text>
                {invoiceInfo.selectedServices.map(
                  (service: any, index: number) => (
                    <View key={index} style={styles.roomItem}>
                      <Text style={styles.roomName}>
                        {String(service.serviceName)}
                      </Text>
                      <Text style={styles.roomPrice}>
                        ${String(service.price.toLocaleString())} x{" "}
                        {String(service.quantity)}
                      </Text>
                    </View>
                  )
                )}
              </View>
            )}
        </View>

        {/* Payment Methods */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Chọn phương thức thanh toán</Text>

          {paymentMethods.map((method) => (
            <TouchableOpacity
              key={method.key}
              style={[
                styles.paymentMethod,
                selectedMethod === method.key && styles.paymentMethodSelected,
              ]}
              onPress={() => setSelectedMethod(method.key)}
            >
              <View style={styles.methodContent}>
                <AppIcon
                  name={method.icon as any}
                  size={24}
                  color={
                    selectedMethod === method.key ? COLORS.primary : COLORS.gray
                  }
                />
                <View style={styles.methodText}>
                  <Text
                    style={[
                      styles.methodTitle,
                      selectedMethod === method.key &&
                        styles.methodTitleSelected,
                    ]}
                  >
                    {method.title}
                  </Text>
                  <Text style={styles.methodSubtitle}>{method.subtitle}</Text>
                </View>
                {method.recommended && (
                  <View style={styles.recommendedBadge}>
                    <Text style={styles.recommendedText}>Khuyên dùng</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Deposit Option for Bank Transfer */}
        {selectedMethod === "bank-transfer" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tùy chọn thanh toán</Text>

            <TouchableOpacity
              style={[
                styles.optionButton,
                depositOption === "deposit" && styles.optionButtonSelected,
              ]}
              onPress={() => setDepositOption("deposit")}
            >
              <View style={styles.optionContent}>
                <Text
                  style={[
                    styles.optionTitle,
                    depositOption === "deposit" && styles.optionTitleSelected,
                  ]}
                >
                  Đặt cọc 500,000đ
                </Text>
                <Text style={styles.optionSubtitle}>
                  Giữ chỗ, thanh toán phần còn lại khi nhận phòng
                </Text>
              </View>
              <View style={styles.optionAmount}>
                <Text
                  style={[
                    styles.amountText,
                    depositOption === "deposit" && styles.amountTextSelected,
                  ]}
                >
                  {DEPOSIT_AMOUNT.toLocaleString()}đ
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.optionButton,
                depositOption === "full" && styles.optionButtonSelected,
              ]}
              onPress={() => setDepositOption("full")}
            >
              <View style={styles.optionContent}>
                <Text
                  style={[
                    styles.optionTitle,
                    depositOption === "full" && styles.optionTitleSelected,
                  ]}
                >
                  Thanh toán đủ
                </Text>
                <Text style={styles.optionSubtitle}>
                  Thanh toán toàn bộ ngay, nhận phòng không cần thanh toán thêm
                </Text>
              </View>
              <View style={styles.optionAmount}>
                <Text
                  style={[
                    styles.amountText,
                    depositOption === "full" && styles.amountTextSelected,
                  ]}
                >
                  {Math.round(invoiceInfo.grandTotal).toLocaleString()}đ
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Price Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tóm tắt thanh toán</Text>

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Tiền phòng:</Text>
            <Text style={styles.priceValue}>
              ${invoiceInfo.totalPrice.toLocaleString()}
            </Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Thuế & phí:</Text>
            <Text style={styles.priceValue}>
              ${invoiceInfo.tax.toLocaleString()}
            </Text>
          </View>

          <View style={[styles.priceRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Tổng cộng:</Text>
            <Text style={styles.totalValue}>
              ${invoiceInfo.grandTotal.toLocaleString()}
            </Text>
          </View>

          {selectedMethod === "bank-transfer" &&
            depositOption === "deposit" && (
              <View style={styles.depositNote}>
                <Text style={styles.depositNoteText}>
                  Còn lại cần thanh toán khi nhận phòng: $
                  {(invoiceInfo.grandTotal - DEPOSIT_AMOUNT).toLocaleString()}
                </Text>
              </View>
            )}
        </View>
      </ScrollView>
      {/* Confirm Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.confirmButton,
            processingPayment && styles.confirmButtonDisabled,
          ]}
          onPress={handleConfirmPayment}
          disabled={processingPayment}
        >
          <Text style={styles.confirmButtonText}>
            {processingPayment ? "Đang xử lý..." : "Xác nhận thanh toán"}
          </Text>
        </TouchableOpacity>
      </View>
      {/* QR Modal */}
      <Modal
        visible={qrModalVisible}
        onRequestClose={() => setQrModalVisible(false)}
        transparent
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Quét mã để thanh toán</Text>
            <Text style={styles.modalSubtitle}>
              Sử dụng ứng dụng ngân hàng để quét mã QR
            </Text>

            <View style={styles.qrPlaceholder}>
              <Text style={styles.qrText}>QR Code</Text>
              <Text style={styles.qrSubtext}>
                Số tiền:{" "}
                {(depositOption === "deposit"
                  ? DEPOSIT_AMOUNT
                  : Math.round(invoiceInfo.grandTotal)
                ).toLocaleString()}
                đ
              </Text>
              <Text style={styles.qrSubtext}>Mã GD: {String(paymentRef)}</Text>
            </View>

            <TouchableOpacity
              style={styles.modalButton}
              onPress={handleFinalConfirm}
              disabled={processingPayment}
            >
              <Text style={styles.modalButtonText}>
                {processingPayment ? "Đang xử lý..." : "Tôi đã chuyển khoản"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setQrModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* Confirm Modal */}
      <Modal
        visible={confirmModalVisible}
        onRequestClose={() => setConfirmModalVisible(false)}
        transparent
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Xác nhận thanh toán</Text>
            <Text style={styles.modalSubtitle}>
              Phương thức:{" "}
              {selectedMethod === "momo"
                ? "Ví MoMo"
                : "Thanh toán tại khách sạn"}
            </Text>

            <View style={styles.confirmDetails}>
              <Text style={styles.confirmAmount}>
                Số tiền: ${Math.round(invoiceInfo.grandTotal).toLocaleString()}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.modalButton}
              onPress={handleFinalConfirm}
              disabled={processingPayment}
            >
              <Text style={styles.modalButtonText}>
                {processingPayment ? "Đang xử lý..." : "Xác nhận"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setConfirmModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>Hủy</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    ...FONTS.h2,
    fontWeight: "700",
    color: COLORS.secondary,
  },
  scrollContent: {
    flex: 1,
    padding: SIZES.padding,
  },
  section: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SIZES.padding,
    marginBottom: SIZES.padding,
    ...SHADOWS.medium,
  },
  sectionTitle: {
    ...FONTS.h3,
    fontWeight: "600",
    color: COLORS.secondary,
    marginBottom: SIZES.padding,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  summaryLabel: {
    ...FONTS.body3,
    color: COLORS.gray,
  },
  summaryValue: {
    ...FONTS.body3,
    fontWeight: "600",
    color: COLORS.secondary,
  },
  roomList: {
    marginTop: 12,
  },
  roomListTitle: {
    ...FONTS.body3,
    fontWeight: "600",
    color: COLORS.secondary,
    marginBottom: 8,
  },
  roomItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  roomName: {
    ...FONTS.body4,
    color: COLORS.secondary,
    flex: 1,
  },
  roomPrice: {
    ...FONTS.body4,
    color: COLORS.gray,
  },
  paymentMethod: {
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: 8,
    padding: SIZES.padding,
    marginBottom: 8,
  },
  paymentMethodSelected: {
    borderColor: COLORS.primary,
    backgroundColor: "#fef8f1",
  },
  methodContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  methodText: {
    flex: 1,
    marginLeft: 12,
  },
  methodTitle: {
    ...FONTS.body3,
    fontWeight: "600",
    color: COLORS.secondary,
  },
  methodTitleSelected: {
    color: COLORS.primary,
  },
  methodSubtitle: {
    ...FONTS.body4,
    color: COLORS.gray,
  },
  recommendedBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  recommendedText: {
    ...FONTS.body4,
    color: COLORS.white,
    fontWeight: "600",
  },
  optionButton: {
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: 8,
    padding: SIZES.padding,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  optionButtonSelected: {
    borderColor: COLORS.primary,
    backgroundColor: "#fef8f1",
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    ...FONTS.body3,
    fontWeight: "600",
    color: COLORS.secondary,
  },
  optionTitleSelected: {
    color: COLORS.primary,
  },
  optionSubtitle: {
    ...FONTS.body4,
    color: COLORS.gray,
    marginTop: 4,
  },
  optionAmount: {
    alignItems: "flex-end",
  },
  amountText: {
    ...FONTS.h4,
    fontWeight: "700",
    color: COLORS.secondary,
  },
  amountTextSelected: {
    color: COLORS.primary,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  priceLabel: {
    ...FONTS.body3,
    color: COLORS.gray,
  },
  priceValue: {
    ...FONTS.body3,
    fontWeight: "600",
    color: COLORS.secondary,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
    paddingTop: 12,
    marginTop: 8,
  },
  totalLabel: {
    ...FONTS.h4,
    fontWeight: "700",
    color: COLORS.secondary,
  },
  totalValue: {
    ...FONTS.h4,
    fontWeight: "700",
    color: COLORS.primary,
  },
  depositNote: {
    backgroundColor: "#fff7e6",
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  depositNoteText: {
    ...FONTS.body4,
    color: "#d46b08",
    textAlign: "center",
  },
  footer: {
    backgroundColor: COLORS.white,
    padding: SIZES.padding,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
  },
  confirmButton: {
    backgroundColor: "#d47153ff",
    paddingVertical: SIZES.padding,
    borderRadius: 8,
    alignItems: "center",
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    ...FONTS.h4,
    color: COLORS.white,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SIZES.padding * 2,
    margin: SIZES.padding,
    width: "90%",
    maxWidth: 400,
  },
  modalTitle: {
    ...FONTS.h3,
    fontWeight: "700",
    color: COLORS.secondary,
    textAlign: "center",
    marginBottom: 8,
  },
  modalSubtitle: {
    ...FONTS.body3,
    color: COLORS.gray,
    textAlign: "center",
    marginBottom: SIZES.padding,
  },
  qrPlaceholder: {
    backgroundColor: "#f5f5f5",
    padding: SIZES.padding * 2,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: SIZES.padding,
  },
  qrText: {
    ...FONTS.h2,
    fontWeight: "700",
    color: COLORS.secondary,
    marginBottom: 8,
  },
  qrSubtext: {
    ...FONTS.body4,
    color: COLORS.gray,
    textAlign: "center",
  },
  modalButton: {
    backgroundColor: "#d47153ff",
    paddingVertical: SIZES.padding,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 12,
  },
  modalButtonText: {
    ...FONTS.h4,
    color: COLORS.white,
    fontWeight: "600",
  },
  modalCloseButton: {
    alignItems: "center",
  },
  modalCloseText: {
    ...FONTS.body3,
    color: COLORS.gray,
  },
  confirmDetails: {
    backgroundColor: "#f5f5f5",
    padding: SIZES.padding,
    borderRadius: 8,
    marginBottom: SIZES.padding,
  },
  confirmAmount: {
    ...FONTS.h4,
    fontWeight: "700",
    color: COLORS.primary,
    textAlign: "center",
  },
});

export default PaymentScreen;
