import React, { useState, useEffect } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { COLORS, SIZES, FONTS, SHADOWS } from "../constants/theme";
import AppIcon from "../components/AppIcon";
import AsyncStorage from "@react-native-async-storage/async-storage";
import BookingProgress from "../components/BookingProgress";
import { useAuth } from "../context/AuthContext";
import { DEFAULT_BASE_URL } from "../config/apiConfig";

interface SelectedRoom {
  roomNumber: number;
  room: any;
}

interface BookingInfo {
  checkIn: string;
  checkOut: string;
  guests: number;
  totalRooms: number;
  selectedRooms: SelectedRoom[];
  selectedServices?: any[];
}

const CheckoutScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { userInfo, isLoggedIn } = useAuth();
  const [bookingInfo, setBookingInfo] = useState<BookingInfo | null>(null);
  const [customerInfo, setCustomerInfo] = useState({
    fullName: "",
    email: "",
    phone: "",
    address: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadBookingData();
  }, []);

  useEffect(() => {
    if (isLoggedIn && userInfo) {
      setCustomerInfo((prev) => ({
        ...prev,
        fullName:
          userInfo.name ||
          userInfo.hoTen ||
          userInfo[
            "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"
          ] ||
          prev.fullName,
        email:
          userInfo.email ||
          userInfo.Email ||
          userInfo[
            "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"
          ] ||
          prev.email,
        phone:
          userInfo.soDienThoai ||
          userInfo.phone ||
          userInfo.Phone ||
          prev.phone,
      }));
    }
  }, [isLoggedIn, userInfo]);

  const loadBookingData = async () => {
    try {
      const params = route.params as any;
      if (params?.selectedServices) {
        const bookingData = await AsyncStorage.getItem("bookingData");
        if (bookingData) {
          const parsed = JSON.parse(bookingData);
          const updatedBookingData = {
            ...parsed,
            selectedServices: params.selectedServices,
          };
          setBookingInfo(updatedBookingData);
          await AsyncStorage.setItem(
            "bookingData",
            JSON.stringify(updatedBookingData)
          );
        } else {
          setBookingInfo({
            ...params,
            totalRooms: params.rooms,
            selectedRooms: params.selectedRooms,
          });
        }
      } else {
        const bookingData = await AsyncStorage.getItem("bookingData");
        if (bookingData) {
          setBookingInfo(JSON.parse(bookingData));
        }
      }
    } catch (error) {
      console.error("Error loading booking data:", error);
      Alert.alert("Lỗi", "Không thể tải thông tin đặt phòng");
    }
  };

  const calculateNights = () => {
    if (!bookingInfo) return 0;
    const checkInDate = new Date(bookingInfo.checkIn);
    const checkOutDate = new Date(bookingInfo.checkOut);
    return Math.ceil(
      (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
    );
  };

  const calculateRoomTotal = () => {
    if (!bookingInfo) return 0;
    const nights = calculateNights();
    return bookingInfo.selectedRooms.reduce((sum, sr) => {
      const price =
        sr.room.discountedPrice &&
        sr.room.discountedPrice < sr.room.basePricePerNight
          ? sr.room.discountedPrice
          : sr.room.basePricePerNight || 0;
      return sum + (price || 0) * nights;
    }, 0);
  };

  const calculateServiceTotal = () => {
    if (!bookingInfo?.selectedServices) return 0;
    return bookingInfo.selectedServices.reduce(
      (sum, s) => sum + s.price * s.quantity,
      0
    );
  };

  const calculateTax = (subtotal: number) => {
    return Math.round(subtotal * 0.1); // 10% VAT
  };

  const handleProceedToPayment = async () => {
    if (!customerInfo.fullName || !customerInfo.phone || !customerInfo.email) {
      Alert.alert("Thông báo", "Vui lòng điền đầy đủ thông tin bắt buộc (*)");
      return;
    }

    // Validate phone
    const phoneRegex = /^[0-9]{10,11}$/;
    if (!phoneRegex.test(customerInfo.phone)) {
      Alert.alert("Lỗi", "Số điện thoại không hợp lệ");
      return;
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerInfo.email)) {
      Alert.alert("Lỗi", "Email không hợp lệ");
      return;
    }

    try {
      const finalBookingData = {
        ...bookingInfo,
        customerInfo,
        pricing: {
          roomTotal: calculateRoomTotal(),
          serviceTotal: calculateServiceTotal(),
          tax: calculateTax(calculateRoomTotal() + calculateServiceTotal()),
          totalAmount:
            calculateRoomTotal() +
            calculateServiceTotal() +
            calculateTax(calculateRoomTotal() + calculateServiceTotal()),
        },
      };

      await AsyncStorage.setItem(
        "finalBookingData",
        JSON.stringify(finalBookingData)
      );
      (navigation as any).navigate("Payment");
    } catch (error) {
      console.error("Error saving final booking data:", error);
      Alert.alert("Lỗi", "Đã có lỗi xảy ra. Vui lòng thử lại.");
    }
  };

  if (!bookingInfo) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Đang tải thông tin...</Text>
      </View>
    );
  }

  const roomTotal = calculateRoomTotal();
  const serviceTotal = calculateServiceTotal();
  const subTotal = roomTotal + serviceTotal;
  const tax = calculateTax(subTotal);
  const totalAmount = subTotal + tax;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <AppIcon name="arrow-left" size={24} color={COLORS.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thông tin khách hàng</Text>
        <View style={{ width: 40 }} />
      </View>

      <BookingProgress
        currentStage="checkout"
        totalRooms={bookingInfo.totalRooms}
        currentRoom={bookingInfo.totalRooms}
        selectedRoomNumbers={bookingInfo.selectedRooms.map(
          (sr) => sr.roomNumber
        )}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Booking Summary Card */}
          <View style={styles.summaryCard}>
            <Text style={styles.cardTitle}>Tóm tắt đặt phòng</Text>
            
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Nhận phòng</Text>
                <Text style={styles.summaryValue}>
                  {new Date(bookingInfo.checkIn).toLocaleDateString("vi-VN")}
                </Text>
              </View>
              <View style={styles.verticalLine} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Trả phòng</Text>
                <Text style={styles.summaryValue}>
                  {new Date(bookingInfo.checkOut).toLocaleDateString("vi-VN")}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.summaryDetailRow}>
              <AppIcon name="user" size={16} color={COLORS.gray} />
              <Text style={styles.summaryDetailText}>
                {bookingInfo.guests} khách
              </Text>
              <View style={styles.dot} />
              <AppIcon name="home" size={16} color={COLORS.gray} />
              <Text style={styles.summaryDetailText}>
                {bookingInfo.totalRooms} phòng
              </Text>
              <View style={styles.dot} />
              <AppIcon name="moon" size={16} color={COLORS.gray} />
              <Text style={styles.summaryDetailText}>
                {calculateNights()} đêm
              </Text>
            </View>
          </View>

          {/* Customer Info Form */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Thông tin liên hệ</Text>
            
            <View style={styles.inputContainer}>
              <View style={styles.inputIcon}>
                <AppIcon name="user" size={20} color={COLORS.gray} />
              </View>
              <View style={styles.inputContent}>
                <Text style={styles.inputLabel}>Họ và tên *</Text>
                <TextInput
                  style={styles.input}
                  value={customerInfo.fullName}
                  onChangeText={(text) =>
                    setCustomerInfo({ ...customerInfo, fullName: text })
                  }
                  placeholder="Nhập họ tên đầy đủ"
                  placeholderTextColor="#ccc"
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <View style={styles.inputIcon}>
                <AppIcon name="phone" size={20} color={COLORS.gray} />
              </View>
              <View style={styles.inputContent}>
                <Text style={styles.inputLabel}>Số điện thoại *</Text>
                <TextInput
                  style={styles.input}
                  value={customerInfo.phone}
                  onChangeText={(text) =>
                    setCustomerInfo({ ...customerInfo, phone: text })
                  }
                  placeholder="Nhập số điện thoại"
                  placeholderTextColor="#ccc"
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <View style={styles.inputIcon}>
                <AppIcon name="mail" size={20} color={COLORS.gray} />
              </View>
              <View style={styles.inputContent}>
                <Text style={styles.inputLabel}>Email *</Text>
                <TextInput
                  style={styles.input}
                  value={customerInfo.email}
                  onChangeText={(text) =>
                    setCustomerInfo({ ...customerInfo, email: text })
                  }
                  placeholder="Nhập địa chỉ email"
                  placeholderTextColor="#ccc"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <View style={styles.inputIcon}>
                <AppIcon name="map-pin" size={20} color={COLORS.gray} />
              </View>
              <View style={styles.inputContent}>
                <Text style={styles.inputLabel}>Địa chỉ</Text>
                <TextInput
                  style={styles.input}
                  value={customerInfo.address}
                  onChangeText={(text) =>
                    setCustomerInfo({ ...customerInfo, address: text })
                  }
                  placeholder="Nhập địa chỉ của bạn"
                  placeholderTextColor="#ccc"
                />
              </View>
            </View>

            <View style={[styles.inputContainer, { alignItems: 'flex-start', paddingVertical: 12 }]}>
              <View style={[styles.inputIcon, { marginTop: 4 }]}>
                <AppIcon name="edit" size={20} color={COLORS.gray} />
              </View>
              <View style={styles.inputContent}>
                <Text style={styles.inputLabel}>Ghi chú</Text>
                <TextInput
                  style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
                  value={customerInfo.notes}
                  onChangeText={(text) =>
                    setCustomerInfo({ ...customerInfo, notes: text })
                  }
                  placeholder="Yêu cầu đặc biệt (không bắt buộc)"
                  placeholderTextColor="#ccc"
                  multiline
                />
              </View>
            </View>
          </View>

          {/* Price Breakdown */}
          <View style={styles.priceSection}>
            <Text style={styles.sectionTitle}>Chi tiết thanh toán</Text>
            
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Tiền phòng ({calculateNights()} đêm)</Text>
              <Text style={styles.priceValue}>{roomTotal.toLocaleString()}đ</Text>
            </View>

            {serviceTotal > 0 && (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Dịch vụ thêm</Text>
                <Text style={styles.priceValue}>{serviceTotal.toLocaleString()}đ</Text>
              </View>
            )}

            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Thuế VAT (10%)</Text>
              <Text style={styles.priceValue}>{tax.toLocaleString()}đ</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tổng thanh toán</Text>
              <Text style={styles.totalValue}>{totalAmount.toLocaleString()}đ</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.bottomBar}>
        <View style={styles.totalContainer}>
          <Text style={styles.bottomTotalLabel}>Tổng cộng</Text>
          <Text style={styles.bottomTotalPrice}>
            {totalAmount.toLocaleString()}đ
          </Text>
        </View>
        <TouchableOpacity
          style={styles.paymentButton}
          onPress={handleProceedToPayment}
        >
          <Text style={styles.paymentButtonText}>Thanh toán</Text>
          <AppIcon name="arrow-right" size={20} color={COLORS.white} />
        </TouchableOpacity>
      </View>
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
  summaryCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    ...SHADOWS.light,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.secondary,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.secondary,
  },
  verticalLine: {
    width: 1,
    backgroundColor: "#F1F3F5",
    marginHorizontal: 16,
  },
  divider: {
    height: 1,
    backgroundColor: "#F1F3F5",
    marginVertical: 16,
  },
  summaryDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  summaryDetailText: {
    fontSize: 13,
    color: COLORS.gray,
    fontWeight: "500",
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
  },
  formSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.secondary,
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F1F3F5",
  },
  inputIcon: {
    marginRight: 12,
  },
  inputContent: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 11,
    color: COLORS.gray,
    marginBottom: 2,
  },
  input: {
    fontSize: 15,
    color: COLORS.secondary,
    fontWeight: "500",
    padding: 0,
  },
  priceSection: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    ...SHADOWS.light,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  priceLabel: {
    fontSize: 14,
    color: COLORS.gray,
  },
  priceValue: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.secondary,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    padding: 20,
    paddingBottom: 34,
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
  paymentButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  paymentButtonText: {
    fontSize: 16,
    color: COLORS.white,
    fontWeight: "700",
  },
});

export default CheckoutScreen;
