import React, { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { buildApiUrl } from "../config/apiConfig";
import { Linking } from "react-native";
import { COLORS, SIZES, FONTS, SHADOWS } from "../constants/theme";
import AppIcon from "../components/AppIcon";
import AsyncStorage from "@react-native-async-storage/async-storage";
import BookingProgress from "../components/BookingProgress";

interface BookingData {
  bookingId: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  checkIn?: string;
  checkOut?: string;
  totalAmount?: number;
  rooms?: any[];
  selectedServices?: any[];
}

const BookingSuccessScreen: React.FC = () => {
  const navigation = useNavigation();
  const [bookingData, setBookingData] = useState<BookingData | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<any>(null);

  useEffect(() => {
    loadBookingData();
  }, []);

  const loadBookingData = async () => {
    try {
      const customerInfoStr = await AsyncStorage.getItem("customerInfo");
      const invoiceInfoStr = await AsyncStorage.getItem("invoiceInfo");
      const paymentResultStr = await AsyncStorage.getItem("paymentResult");

      const customer = customerInfoStr ? JSON.parse(customerInfoStr) : null;
      const invoice = invoiceInfoStr ? JSON.parse(invoiceInfoStr) : null;
      const payment = paymentResultStr ? JSON.parse(paymentResultStr) : null;

      const id =
        invoice?.idDatPhong ||
        payment?.paymentId ||
        `BK${Date.now().toString().slice(-8)}`;
      const name =
        customer?.hoTen || customer?.fullName || customer?.name || "Khách hàng";
      const email = customer?.email || "";
      const phone =
        customer?.soDienThoai || customer?.phone || customer?.phoneNumber || "";
      const checkIn = invoice?.checkIn;
      const checkOut = invoice?.checkOut;
      const total =
        payment?.totalAmount || invoice?.grandTotal || invoice?.tongTien || 0;
      const rooms = invoice?.rooms || [];
      const selectedServices = invoice?.selectedServices || [];

      setBookingData({
        bookingId: id,
        customerName: name,
        customerEmail: email,
        customerPhone: phone,
        checkIn,
        checkOut,
        totalAmount: total,
        rooms,
        selectedServices,
      });

      setPaymentInfo(payment);
    } catch (error) {
      console.error("Error loading booking data:", error);
      Alert.alert("Lỗi", "Không thể tải thông tin đặt phòng");
    }
  };

  const handleBackToHome = () => {
    // Clear booking data
    AsyncStorage.removeItem("bookingData");
    AsyncStorage.removeItem("customerInfo");
    AsyncStorage.removeItem("invoiceInfo");
    AsyncStorage.removeItem("paymentResult");

    // Navigate to home
    navigation.reset({
      index: 0,
      routes: [{ name: "Home" as never }],
    });
  };

  const handleDownloadInvoice = () => {
    // Try open invoice PDF from server if available
    const idHoaDon =
      paymentInfo?.idHoaDon || (bookingData as any)?.idHoaDon || null;
    if (!idHoaDon) {
      Alert.alert("Lỗi", "Không tìm thấy mã hóa đơn");
      return;
    }

    const url = buildApiUrl(`/api/ThanhToan/hoa-don/${idHoaDon}/pdf`);
    Linking.canOpenURL(url)
      .then((supported) => {
        if (!supported) {
          Alert.alert("Lỗi", "Không thể mở liên kết tải hóa đơn");
        } else {
          return Linking.openURL(url);
        }
      })
      .catch((err) => {
        console.error("Open invoice URL failed", err);
        Alert.alert("Lỗi", "Không thể mở liên kết hóa đơn");
      });
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
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Đang tải thông tin...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Đặt phòng thành công</Text>
      </View>

      <BookingProgress
        currentStage="complete"
        totalRooms={bookingData.rooms?.length || 1}
        selectedRoomNumbers={
          bookingData.rooms?.map((_, index) => index + 1) || []
        }
      />

      <ScrollView
        style={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Success Message */}
        <View style={styles.successCard}>
          <View style={styles.successIcon}>
            <AppIcon name="check-circle" size={60} color="#52c41a" />
          </View>

          <Text style={styles.successTitle}>Đặt phòng thành công!</Text>

          <Text style={styles.successMessage}>
            Cảm ơn bạn đã đặt phòng tại Robins Villa Hotel
          </Text>

          <View style={styles.bookingIdCard}>
            <Text style={styles.bookingIdLabel}>Mã đặt phòng:</Text>
            <Text style={styles.bookingId}>{bookingData.bookingId}</Text>
          </View>
        </View>

        {/* Customer Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thông tin khách hàng</Text>

          <View style={styles.infoRow}>
            <AppIcon name="user" size={16} color={COLORS.primary} />
            <Text style={styles.infoText}>{bookingData.customerName}</Text>
          </View>

          <View style={styles.infoRow}>
            <AppIcon name="envelope" size={16} color={COLORS.primary} />
            <Text style={styles.infoText}>{bookingData.customerEmail}</Text>
          </View>

          <View style={styles.infoRow}>
            <AppIcon name="phone" size={16} color={COLORS.primary} />
            <Text style={styles.infoText}>{bookingData.customerPhone}</Text>
          </View>
        </View>

        {/* Booking Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Chi tiết đặt phòng</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Nhận phòng:</Text>
            <Text style={styles.detailValue}>
              {formatDate(bookingData.checkIn)}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Trả phòng:</Text>
            <Text style={styles.detailValue}>
              {formatDate(bookingData.checkOut)}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Tổng tiền:</Text>
            <Text style={styles.detailValue}>
              ${bookingData.totalAmount?.toLocaleString()}đ
            </Text>
          </View>
        </View>

        {/* Rooms List */}
        {bookingData.rooms && bookingData.rooms.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Danh sách phòng</Text>

            {bookingData.rooms.map((room: any, index: number) => (
              <View key={index} style={styles.roomItem}>
                <Text style={styles.roomName}>
                  Phòng {room.roomNumber}: {room.room.roomTypeName}
                </Text>
                <Text style={styles.roomPrice}>
                  $
                  {(
                    room.room.discountedPrice ||
                    room.room.basePricePerNight ||
                    0
                  ).toLocaleString()}
                  đ/đêm
                </Text>
              </View>
            ))}

            {bookingData.selectedServices &&
              bookingData.selectedServices.length > 0 && (
                <>
                  <Text
                    style={[styles.sectionTitle, { marginTop: SIZES.padding }]}
                  >
                    Dịch vụ đã đặt
                  </Text>
                  {bookingData.selectedServices.map(
                    (service: any, index: number) => (
                      <View key={`service-${index}`} style={styles.roomItem}>
                        <Text style={styles.roomName}>
                          {service.serviceName}
                        </Text>
                        <Text style={styles.roomPrice}>
                          ${service.price.toLocaleString()}đ x{" "}
                          {service.quantity}
                        </Text>
                      </View>
                    )
                  )}
                </>
              )}
          </View>
        )}

        {/* Payment Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trạng thái thanh toán</Text>

          {paymentInfo?.paymentStatus === "paid" && (
            <View style={[styles.statusCard, styles.statusPaid]}>
              <AppIcon name="check-circle" size={20} color="#52c41a" />
              <View style={styles.statusContent}>
                <Text style={styles.statusTitle}>Đã thanh toán</Text>
                <Text style={styles.statusMessage}>
                  Email xác nhận đã được gửi đến {bookingData.customerEmail}
                </Text>
              </View>
            </View>
          )}

          {paymentInfo?.paymentStatus === "deposit" && (
            <View style={[styles.statusCard, styles.statusDeposit]}>
              <AppIcon name="clock-o" size={20} color="#fa8c16" />
              <View style={styles.statusContent}>
                <Text style={styles.statusTitle}>Đã đặt cọc</Text>
                <Text style={styles.statusMessage}>
                  Đã đặt cọc ${paymentInfo.depositAmount?.toLocaleString()}đ
                </Text>
                <Text style={styles.statusMessage}>
                  Còn lại: $
                  {(
                    paymentInfo.totalAmount - paymentInfo.depositAmount
                  ).toLocaleString()}
                  đ thanh toán khi nhận phòng
                </Text>
              </View>
            </View>
          )}

          {paymentInfo?.paymentStatus === "unpaid" && (
            <View style={[styles.statusCard, styles.statusUnpaid]}>
              <AppIcon name="home" size={20} color="#1890ff" />
              <View style={styles.statusContent}>
                <Text style={styles.statusTitle}>Thanh toán tại khách sạn</Text>
                <Text style={styles.statusMessage}>
                  Vui lòng thanh toán khi làm thủ tục nhận phòng
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Important Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lưu ý quan trọng</Text>

          <View style={styles.noteItem}>
            <AppIcon name="clock-o" size={16} color={COLORS.primary} />
            <Text style={styles.noteText}>
              Giờ nhận phòng: 14:00, trả phòng: 12:00
            </Text>
          </View>

          <View style={styles.noteItem}>
            <AppIcon name="ban" size={16} color="#ff4d4f" />
            <Text style={styles.noteText}>
              Hút thuốc nghiêm cấm trong phòng
            </Text>
          </View>

          <View style={styles.noteItem}>
            <AppIcon name="undo" size={16} color="#52c41a" />
            <Text style={styles.noteText}>Miễn phí hủy trong 24 giờ</Text>
          </View>

          <View style={styles.noteItem}>
            <AppIcon name="phone" size={16} color={COLORS.primary} />
            <Text style={styles.noteText}>Hỗ trợ 24/7: 1900-xxxx</Text>
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.downloadButton}
          onPress={handleDownloadInvoice}
        >
          <AppIcon name="download" size={16} color={COLORS.primary} />
          <Text style={styles.downloadButtonText}>Tải hóa đơn PDF</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.homeButton} onPress={handleBackToHome}>
          <AppIcon name="home" size={16} color={COLORS.white} />
          <Text style={styles.homeButtonText}>Về trang chủ</Text>
        </TouchableOpacity>
      </View>
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
  loadingText: {
    ...FONTS.body3,
    color: COLORS.gray,
  },
  header: {
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
    alignItems: "center",
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
  successCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SIZES.padding * 2,
    alignItems: "center",
    marginBottom: SIZES.padding,
    ...SHADOWS.medium,
  },
  successIcon: {
    marginBottom: SIZES.padding,
  },
  successTitle: {
    ...FONTS.h2,
    fontWeight: "700",
    color: "#52c41a",
    marginBottom: 8,
  },
  successMessage: {
    ...FONTS.body3,
    color: COLORS.gray,
    textAlign: "center",
    marginBottom: SIZES.padding,
  },
  bookingIdCard: {
    backgroundColor: "#f6ffed",
    borderWidth: 1,
    borderColor: "#b7eb8f",
    borderRadius: 8,
    padding: SIZES.padding,
    alignItems: "center",
  },
  bookingIdLabel: {
    ...FONTS.body4,
    color: "#52c41a",
    marginBottom: 4,
  },
  bookingId: {
    ...FONTS.h3,
    fontWeight: "700",
    color: "#52c41a",
    fontFamily: "monospace",
  },
  section: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SIZES.padding,
    marginBottom: SIZES.padding,
    ...SHADOWS.medium,
  },
  sectionTitle: {
    ...FONTS.h4,
    fontWeight: "600",
    color: COLORS.secondary,
    marginBottom: SIZES.padding,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  infoText: {
    ...FONTS.body3,
    color: COLORS.secondary,
    marginLeft: 12,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  detailLabel: {
    ...FONTS.body3,
    color: COLORS.gray,
  },
  detailValue: {
    ...FONTS.body3,
    fontWeight: "600",
    color: COLORS.secondary,
  },
  roomItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  roomName: {
    ...FONTS.body3,
    color: COLORS.secondary,
    flex: 1,
  },
  roomPrice: {
    ...FONTS.body4,
    color: COLORS.gray,
  },
  statusCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: SIZES.padding,
    borderRadius: 8,
  },
  statusPaid: {
    backgroundColor: "#f6ffed",
    borderWidth: 1,
    borderColor: "#b7eb8f",
  },
  statusDeposit: {
    backgroundColor: "#fff7e6",
    borderWidth: 1,
    borderColor: "#ffd591",
  },
  statusUnpaid: {
    backgroundColor: "#e6f7ff",
    borderWidth: 1,
    borderColor: "#91d5ff",
  },
  statusContent: {
    flex: 1,
    marginLeft: 12,
  },
  statusTitle: {
    ...FONTS.body3,
    fontWeight: "600",
    color: COLORS.secondary,
    marginBottom: 4,
  },
  statusMessage: {
    ...FONTS.body4,
    color: COLORS.gray,
    lineHeight: 18,
  },
  noteItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  noteText: {
    ...FONTS.body4,
    color: COLORS.gray,
    marginLeft: 12,
  },
  footer: {
    backgroundColor: COLORS.white,
    padding: SIZES.padding,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
    gap: 12,
  },
  downloadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SIZES.padding,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 8,
  },
  downloadButtonText: {
    ...FONTS.body3,
    color: COLORS.primary,
    fontWeight: "600",
    marginLeft: 8,
  },
  homeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SIZES.padding,
    backgroundColor: "#d47153ff",
    borderRadius: 8,
  },
  homeButtonText: {
    ...FONTS.body3,
    color: COLORS.white,
    fontWeight: "600",
    marginLeft: 8,
  },
});

export default BookingSuccessScreen;
