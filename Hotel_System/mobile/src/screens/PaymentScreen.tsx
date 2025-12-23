import React, { useState, useEffect } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { COLORS, SIZES, FONTS, SHADOWS } from "../constants/theme";
import AppIcon from "../components/AppIcon";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { buildApiUrl } from "../config/apiConfig";
import BookingProgress from "../components/BookingProgress";
import HeaderScreen from "../components/HeaderScreen";

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
  selectedCombo?: any;
  pointsUsed?: number;
  pointsDiscount?: number;
}

const PaymentScreen: React.FC = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
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

  // Refresh data when screen is focused (e.g., when returning from CheckoutScreen)
  useFocusEffect(
    React.useCallback(() => {
      loadInvoiceInfo();
    }, [])
  );

  const loadInvoiceInfo = async () => {
    try {
      const invoiceData = await AsyncStorage.getItem("finalBookingData");
      if (invoiceData) {
        const parsed = JSON.parse(invoiceData);

        // Calculate service total including combo + individual services
        let serviceTotal = 0;
        if (parsed.selectedCombo) {
          serviceTotal += parsed.selectedCombo.price || 0;
        }
        if (parsed.selectedServices && Array.isArray(parsed.selectedServices)) {
          serviceTotal += parsed.selectedServices.reduce(
            (sum: number, s: any) => {
              return sum + (s.price || 0) * (s.quantity || 1);
            },
            0
          );
        }

        setInvoiceInfo({
          ...parsed,
          grandTotal: parsed.pricing?.totalAmount || parsed.totalAmount || 0,
          totalPrice: parsed.pricing?.roomTotal || 0 + serviceTotal,
          tax: parsed.pricing?.tax || 0,
          nights: calculateNights(parsed.checkIn, parsed.checkOut),
          rooms: parsed.selectedRooms,
          customer: parsed.customerInfo,
          selectedServices: parsed.selectedServices || [],
          selectedCombo: parsed.selectedCombo || null,
          // Include points information
          pointsUsed: parsed.pointsUsed || 0,
          pointsDiscount: parsed.pointsDiscount || 0,
        });
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

  const calculateNights = (checkIn: string, checkOut: string) => {
    const d1 = new Date(checkIn);
    const d2 = new Date(checkOut);
    return Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
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
        // Thanh toán tại khách sạn: chưa thanh toán
        paymentStatus = "unpaid";
        amountPaid = 0;
        trangThaiThanhToan = 1; // 1 = Chưa thanh toán
        phuongThucThanhToan = 1; // 1 = tiền mặt
        tienCoc = 0;
      } else if (selectedMethod === "bank-transfer") {
        if (depositOption === "deposit") {
          // Thanh toán cọc tiền 500.000đ
          paymentStatus = "deposit";
          amountPaid = DEPOSIT_AMOUNT;
          trangThaiThanhToan = 0; // 0 = Đã đặt cọc (không phải 2)
          tienCoc = DEPOSIT_AMOUNT; // Cọc đúng 500.000đ
        } else {
          // Thanh toán toàn bộ
          paymentStatus = "paid";
          amountPaid = invoiceInfo.grandTotal;
          trangThaiThanhToan = 2; // 2 = Đã thanh toán đầy đủ
          tienCoc = 0; // Không có cọc khi thanh toán toàn bộ
        }
        phuongThucThanhToan = 2; // 2 = Chuyển khoản
      } else if (selectedMethod === "momo") {
        // Thanh toán toàn bộ qua Momo
        paymentStatus = "paid";
        amountPaid = invoiceInfo.grandTotal;
        trangThaiThanhToan = 2; // 2 = Đã thanh toán đầy đủ
        phuongThucThanhToan = 3; // 3 = Momo
        tienCoc = 0; // Không có cọc khi thanh toán toàn bộ
      }

      // Prepare booking payload theo CreateBookingRequest của backend
      const bookingPayload = {
        hoTen: invoiceInfo.customer.fullName,
        email: invoiceInfo.customer.email,
        soDienThoai: invoiceInfo.customer.phone,
        diaChi: invoiceInfo.customer.address || "",
        ghiChu: invoiceInfo.customer.notes || "",
        ngayNhanPhong: invoiceInfo.checkIn,
        ngayTraPhong: invoiceInfo.checkOut,
        soLuongKhach: invoiceInfo.guests,
        rooms: invoiceInfo.rooms.map((r: any) => ({
          idPhong: r.room.roomId,
          soPhong: r.room.roomNumber || 0,
          giaCoBanMotDem:
            r.room.discountedPrice || r.room.basePricePerNight || 0,
        })),
      };

      // Call API to create booking
      const response = await fetch(buildApiUrl("/api/datphong/create"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bookingPayload),
      });

      if (response.ok) {
        // Success - booking created
        const result = await response.json();
        const idDatPhong = result.data?.idDatPhong;

        // Tính tiền phòng
        const nights = invoiceInfo.nights || 1;
        const tienPhong = invoiceInfo.rooms.reduce((sum: number, r: any) => {
          const price = r.room.discountedPrice || r.room.basePricePerNight || 0;
          return sum + price * nights;
        }, 0);

        // Tạo payload cho API hóa đơn (giống Web)
        // Build Services array including combo (if any) and individual services
        const services: any[] = [];

        // Add combo to services list with special format (combo:COMBOID)
        if (invoiceInfo.selectedCombo && invoiceInfo.selectedCombo.comboId) {
          services.push({
            IddichVu: `combo:${invoiceInfo.selectedCombo.comboId}`,
            SoLuong: 1,
            DonGia: invoiceInfo.selectedCombo.price,
            TienDichVu: invoiceInfo.selectedCombo.price,
          });
        }

        // Add individual services
        if (
          invoiceInfo.selectedServices &&
          invoiceInfo.selectedServices.length > 0
        ) {
          invoiceInfo.selectedServices.forEach((svc: any) => {
            services.push({
              IddichVu: svc.serviceId,
              SoLuong: svc.quantity || 1,
              DonGia: svc.price,
              TienDichVu: svc.price * (svc.quantity || 1),
            });
          });
        }

        const invoicePayload = {
          IDDatPhong: idDatPhong,
          TienPhong: Math.round(tienPhong),
          SoLuongNgay: nights,
          TongTien: Math.round(invoiceInfo.grandTotal),
          TienCoc: Math.round(tienCoc), // Ensure it's the deposit amount (500k or 0)
          TrangThaiThanhToan: trangThaiThanhToan,
          PhuongThucThanhToan: phuongThucThanhToan,
          GhiChu: `Mobile - ${selectedMethod}${
            paymentRef ? ` | Mã GD: ${paymentRef}` : ""
          }`,
          PaymentGateway:
            selectedMethod === "bank-transfer" ? "VietQR" : selectedMethod,
          Services: services,
          // Send points to backend using the correct field name (RedeemPoints)
          RedeemPoints: invoiceInfo.pointsUsed || 0,
        };

        console.log("Invoice Payload being sent:", {
          TongTien: invoicePayload.TongTien,
          TienCoc: invoicePayload.TienCoc,
          TrangThaiThanhToan: invoicePayload.TrangThaiThanhToan,
          RedeemPoints: invoicePayload.RedeemPoints,
          selectedMethod,
          depositOption,
        });

        // Gọi API tạo hóa đơn để clear ThoiHan và cập nhật trạng thái
        const invoiceResponse = await fetch(
          buildApiUrl("/api/Payment/hoa-don"),
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(invoicePayload),
          }
        );

        if (!invoiceResponse.ok) {
          console.warn(
            "Invoice creation failed, but booking was created:",
            await invoiceResponse.text()
          );
        }

        setQrModalVisible(false);
        setConfirmModalVisible(false);
        Alert.alert(
          "Thành công",
          "Đặt phòng thành công! Mã đặt phòng: " + (idDatPhong || ""),
          [{ text: "OK", onPress: () => (navigation as any).navigate("Home") }]
        );
      } else {
        const err = await response.text();
        console.error("Booking error:", err);
        try {
          const errJson = JSON.parse(err);
          Alert.alert(
            "Lỗi",
            errJson.message || "Đặt phòng thất bại. Vui lòng thử lại."
          );
        } catch {
          Alert.alert("Lỗi", "Đặt phòng thất bại. Vui lòng thử lại.");
        }
      }
    } catch (error) {
      console.error("Error processing payment:", error);
      Alert.alert("Lỗi", "Đã có lỗi xảy ra khi xử lý thanh toán.");
    } finally {
      setProcessingPayment(false);
    }
  };

  if (!invoiceInfo) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ marginTop: 10 }}>Đang tạo hóa đơn...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <HeaderScreen
        title="Thanh toán"
        onClose={() => navigation.goBack()}
        leftIcon={<AppIcon name="arrow-left" size={24} color={COLORS.secondary} />}
      />

      <BookingProgress
        currentStage="payment"
        totalRooms={invoiceInfo.rooms.length}
        currentRoom={invoiceInfo.rooms.length}
        selectedRoomNumbers={[]}
      />

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Invoice Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Chi tiết hóa đơn</Text>
          <View style={styles.invoiceCard}>
            <View style={styles.invoiceRow}>
              <Text style={styles.invoiceLabel}>Khách hàng</Text>
              <Text style={styles.invoiceValue}>
                {invoiceInfo.customer.fullName}
              </Text>
            </View>
            <View style={styles.invoiceRow}>
              <Text style={styles.invoiceLabel}>Số điện thoại</Text>
              <Text style={styles.invoiceValue}>
                {invoiceInfo.customer.phone}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.invoiceRow}>
              <Text style={styles.invoiceLabel}>Tiền phòng</Text>
              <Text style={styles.invoiceValue}>
                {invoiceInfo.rooms
                  .reduce((sum: number, r: any) => {
                    const price =
                      r.room?.discountedPrice || r.room?.basePricePerNight || 0;
                    return sum + price * invoiceInfo.nights;
                  }, 0)
                  .toLocaleString()}
                đ
              </Text>
            </View>
            {((invoiceInfo.selectedCombo &&
              invoiceInfo.selectedCombo.price > 0) ||
              (invoiceInfo.selectedServices &&
                invoiceInfo.selectedServices.length > 0)) && (
              <View style={styles.invoiceRow}>
                <Text style={styles.invoiceLabel}>Dịch vụ</Text>
                <Text style={styles.invoiceValue}>
                  {(() => {
                    const comboPrice = invoiceInfo.selectedCombo?.price || 0;
                    const servicesPrice = invoiceInfo.selectedServices
                      ? invoiceInfo.selectedServices.reduce(
                          (s: any, i: any) => s + i.price * i.quantity,
                          0
                        )
                      : 0;
                    return (comboPrice + servicesPrice).toLocaleString();
                  })()}
                  đ
                </Text>
              </View>
            )}
            <View style={styles.invoiceRow}>
              <Text style={styles.invoiceLabel}>Thuế VAT (10%)</Text>
              <Text style={styles.invoiceValue}>
                {invoiceInfo.tax.toLocaleString()}đ
              </Text>
            </View>
            {invoiceInfo.pointsDiscount && invoiceInfo.pointsDiscount > 0 && (
              <View style={styles.invoiceRow}>
                <Text style={[styles.invoiceLabel, { color: "#16A34A" }]}>
                  Giảm điểm ({invoiceInfo.pointsUsed} điểm)
                </Text>
                <Text
                  style={[
                    styles.invoiceValue,
                    { color: "#16A34A", fontWeight: "700" },
                  ]}
                >
                  -{invoiceInfo.pointsDiscount.toLocaleString()}đ
                </Text>
              </View>
            )}
            <View style={styles.divider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tổng thanh toán</Text>
              <Text style={styles.totalValue}>
                {invoiceInfo.grandTotal.toLocaleString()}đ
              </Text>
            </View>
          </View>
        </View>

        {/* Payment Methods */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Phương thức thanh toán</Text>

          <TouchableOpacity
            style={[
              styles.methodCard,
              selectedMethod === "bank-transfer" && styles.methodCardSelected,
            ]}
            onPress={() => setSelectedMethod("bank-transfer")}
          >
            <View style={styles.methodIconContainer}>
              <AppIcon
                name="credit-card"
                size={24}
                color={
                  selectedMethod === "bank-transfer"
                    ? COLORS.primary
                    : COLORS.gray
                }
              />
            </View>
            <View style={styles.methodContent}>
              <Text
                style={[
                  styles.methodTitle,
                  selectedMethod === "bank-transfer" && styles.textSelected,
                ]}
              >
                Chuyển khoản ngân hàng
              </Text>
              <Text style={styles.methodDesc}>
                Quét mã QR để thanh toán nhanh
              </Text>
            </View>
            {selectedMethod === "bank-transfer" && (
              <AppIcon name="check-circle" size={20} color={COLORS.primary} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.methodCard,
              selectedMethod === "momo" && styles.methodCardSelected,
            ]}
            onPress={() => setSelectedMethod("momo")}
          >
            <View style={styles.methodIconContainer}>
              <AppIcon
                name="mobile"
                size={24}
                color={selectedMethod === "momo" ? COLORS.primary : COLORS.gray}
              />
            </View>
            <View style={styles.methodContent}>
              <Text
                style={[
                  styles.methodTitle,
                  selectedMethod === "momo" && styles.textSelected,
                ]}
              >
                Ví MoMo
              </Text>
              <Text style={styles.methodDesc}>
                Thanh toán qua ứng dụng MoMo
              </Text>
            </View>
            {selectedMethod === "momo" && (
              <AppIcon name="check-circle" size={20} color={COLORS.primary} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.methodCard,
              selectedMethod === "hotel-payment" && styles.methodCardSelected,
            ]}
            onPress={() => setSelectedMethod("hotel-payment")}
          >
            <View style={styles.methodIconContainer}>
              <AppIcon
                name="home"
                size={24}
                color={
                  selectedMethod === "hotel-payment"
                    ? COLORS.primary
                    : COLORS.gray
                }
              />
            </View>
            <View style={styles.methodContent}>
              <Text
                style={[
                  styles.methodTitle,
                  selectedMethod === "hotel-payment" && styles.textSelected,
                ]}
              >
                Thanh toán tại khách sạn
              </Text>
              <Text style={styles.methodDesc}>Thanh toán khi nhận phòng</Text>
            </View>
            {selectedMethod === "hotel-payment" && (
              <AppIcon name="check-circle" size={20} color={COLORS.primary} />
            )}
          </TouchableOpacity>
        </View>

        {/* Deposit Option (Only for Bank Transfer) */}
        {selectedMethod === "bank-transfer" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tùy chọn thanh toán</Text>
            <View style={styles.depositContainer}>
              <TouchableOpacity
                style={[
                  styles.depositOption,
                  depositOption === "full" && styles.depositOptionSelected,
                ]}
                onPress={() => setDepositOption("full")}
              >
                <Text
                  style={[
                    styles.depositTitle,
                    depositOption === "full" && styles.textSelected,
                  ]}
                >
                  Thanh toán toàn bộ
                </Text>
                <Text
                  style={[
                    styles.depositAmount,
                    depositOption === "full" && styles.textSelected,
                  ]}
                >
                  {invoiceInfo.grandTotal.toLocaleString()}đ
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.depositOption,
                  depositOption === "deposit" && styles.depositOptionSelected,
                ]}
                onPress={() => setDepositOption("deposit")}
              >
                <Text
                  style={[
                    styles.depositTitle,
                    depositOption === "deposit" && styles.textSelected,
                  ]}
                >
                  Đặt cọc trước
                </Text>
                <Text
                  style={[
                    styles.depositAmount,
                    depositOption === "deposit" && styles.textSelected,
                  ]}
                >
                  {DEPOSIT_AMOUNT.toLocaleString()}đ
                </Text>
              </TouchableOpacity>
            </View>
            {depositOption === "deposit" && (
              <Text style={styles.depositNote}>
                * Bạn sẽ thanh toán phần còn lại (
                {(invoiceInfo.grandTotal - DEPOSIT_AMOUNT).toLocaleString()}đ)
                tại khách sạn.
              </Text>
            )}
          </View>
        )}
      </ScrollView>

      <View style={[
        styles.bottomBar,
        {
          bottom: Platform.OS === 'ios' 
            ? insets.bottom + 0
            : 0,
        },
      ]}>
        <View style={styles.totalContainer}>
          <Text style={styles.bottomTotalLabel}>
            {selectedMethod === "bank-transfer" && depositOption === "deposit"
              ? "Số tiền cọc"
              : "Tổng thanh toán"}
          </Text>
          <Text style={styles.bottomTotalPrice}>
            {selectedMethod === "bank-transfer" && depositOption === "deposit"
              ? DEPOSIT_AMOUNT.toLocaleString()
              : invoiceInfo.grandTotal.toLocaleString()}
            đ
          </Text>
        </View>
        <TouchableOpacity
          style={styles.confirmButton}
          onPress={handleConfirmPayment}
        >
          <Text style={styles.confirmButtonText}>Xác nhận thanh toán</Text>
          <AppIcon name="arrow-right" size={20} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {/* QR Code Modal */}
      <Modal
        visible={qrModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setQrModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.qrModalContent}>
            <Text style={styles.qrTitle}>Quét mã để thanh toán</Text>
            <Text style={styles.qrSubtitle}>
              Vui lòng chuyển khoản với nội dung bên dưới
            </Text>

            <View style={styles.qrPlaceholder}>
              <AppIcon name="qrcode" size={100} color={COLORS.secondary} />
              <Text style={{ marginTop: 10, color: COLORS.gray }}>QR Code</Text>
            </View>

            <View style={styles.transferInfo}>
              <Text style={styles.transferLabel}>Ngân hàng:</Text>
              <Text style={styles.transferValue}>MB Bank</Text>
            </View>
            <View style={styles.transferInfo}>
              <Text style={styles.transferLabel}>Số tài khoản:</Text>
              <Text style={styles.transferValue}>0000 1234 56789</Text>
            </View>
            <View style={styles.transferInfo}>
              <Text style={styles.transferLabel}>Chủ tài khoản:</Text>
              <Text style={styles.transferValue}>HOTEL SYSTEM</Text>
            </View>
            <View style={styles.transferInfo}>
              <Text style={styles.transferLabel}>Số tiền:</Text>
              <Text
                style={[
                  styles.transferValue,
                  { color: COLORS.primary, fontWeight: "700" },
                ]}
              >
                {depositOption === "deposit"
                  ? DEPOSIT_AMOUNT.toLocaleString()
                  : invoiceInfo.grandTotal.toLocaleString()}
                đ
              </Text>
            </View>
            <View style={styles.transferInfo}>
              <Text style={styles.transferLabel}>Nội dung:</Text>
              <Text style={[styles.transferValue, { fontWeight: "700" }]}>
                {paymentRef}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.paidButton}
              onPress={handleFinalConfirm}
              disabled={processingPayment}
            >
              {processingPayment ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.paidButtonText}>Tôi đã chuyển khoản</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setQrModalVisible(false)}
              disabled={processingPayment}
            >
              <Text style={styles.closeButtonText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Confirm Modal */}
      <Modal
        visible={confirmModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setConfirmModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalContent}>
            <AppIcon name="check-circle" size={48} color={COLORS.primary} />
            <Text style={styles.confirmTitle}>Xác nhận đặt phòng</Text>
            <Text style={styles.confirmMessage}>
              Bạn có chắc chắn muốn hoàn tất đặt phòng không?
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.cancelAction}
                onPress={() => setConfirmModalVisible(false)}
              >
                <Text style={styles.cancelActionText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmAction}
                onPress={handleFinalConfirm}
              >
                {processingPayment ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.confirmActionText}>Xác nhận</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
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
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#F5F5F5",
  },
  headerTitle: {
    ...FONTS.h3,
    fontWeight: "700",
    color: COLORS.secondary,
  },
  scrollContent: {
    flex: 1,
    padding: SIZES.padding,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.secondary,
    marginBottom: 16,
  },
  invoiceCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 20,
    ...SHADOWS.light,
  },
  invoiceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  invoiceLabel: {
    fontSize: 14,
    color: COLORS.gray,
  },
  invoiceValue: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.secondary,
  },
  divider: {
    height: 1,
    backgroundColor: "#F1F3F5",
    marginVertical: 12,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.secondary,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.primary,
  },
  methodCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "transparent",
    ...SHADOWS.light,
  },
  methodCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: "#FFF9F2",
  },
  methodIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#F8F9FA",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  methodContent: {
    flex: 1,
  },
  methodTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.secondary,
    marginBottom: 4,
  },
  methodDesc: {
    fontSize: 12,
    color: COLORS.gray,
  },
  textSelected: {
    color: COLORS.primary,
  },
  depositContainer: {
    flexDirection: "row",
    gap: 12,
  },
  depositOption: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "transparent",
    ...SHADOWS.light,
  },
  depositOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: "#FFF9F2",
  },
  depositTitle: {
    fontSize: 13,
    color: COLORS.gray,
    marginBottom: 8,
  },
  depositAmount: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.secondary,
  },
  depositNote: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 12,
    fontStyle: "italic",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    ...SHADOWS.dark,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  totalContainer: {
    flex: 1,
  },
  bottomTotalLabel: {
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 2,
  },
  bottomTotalPrice: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.primary,
  },
  confirmButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  confirmButtonText: {
    fontSize: 16,
    color: COLORS.white,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  qrModalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 24,
    width: "100%",
    alignItems: "center",
  },
  qrTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.secondary,
    marginBottom: 8,
  },
  qrSubtitle: {
    fontSize: 14,
    color: COLORS.gray,
    marginBottom: 24,
    textAlign: "center",
  },
  qrPlaceholder: {
    width: 200,
    height: 200,
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  transferInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F3F5",
    paddingBottom: 8,
  },
  transferLabel: {
    fontSize: 14,
    color: COLORS.gray,
  },
  transferValue: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.secondary,
  },
  paidButton: {
    backgroundColor: COLORS.primary,
    width: "100%",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 16,
  },
  paidButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.white,
  },
  closeButton: {
    marginTop: 16,
    padding: 8,
  },
  closeButtonText: {
    fontSize: 15,
    color: COLORS.gray,
    fontWeight: "600",
  },
  confirmModalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 32,
    width: "85%",
    alignItems: "center",
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.secondary,
    marginTop: 16,
    marginBottom: 8,
  },
  confirmMessage: {
    fontSize: 15,
    color: COLORS.gray,
    textAlign: "center",
    marginBottom: 24,
  },
  confirmActions: {
    flexDirection: "row",
    gap: 16,
    width: "100%",
  },
  cancelAction: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#F1F3F5",
    alignItems: "center",
  },
  cancelActionText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.secondary,
  },
  confirmAction: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: "center",
  },
  confirmActionText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.white,
  },
});

export default PaymentScreen;
