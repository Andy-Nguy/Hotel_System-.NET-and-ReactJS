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
    // Auto-fill user info if logged in (highest priority)
    if (isLoggedIn && userInfo) {
      // console.log('Auto-filling user info:', userInfo); // Debug log
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
      // Check if services were passed from ServicesSelectionScreen
      const params = route.params as any;
      if (params?.selectedServices) {
        // Services were selected, merge with existing booking data
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
        }
      } else {
        // Load from AsyncStorage
        const bookingData = await AsyncStorage.getItem("bookingData");
        if (bookingData) {
          const parsed = JSON.parse(bookingData);
          setBookingInfo(parsed);
        } else {
          Alert.alert("Lỗi", "Không tìm thấy thông tin đặt phòng");
          navigation.goBack();
        }
      }

      // Load saved customer info (lower priority than userInfo)
      const savedCustomerInfo = await AsyncStorage.getItem("customerInfo");
      if (savedCustomerInfo && !isLoggedIn) {
        const parsedCustomer = JSON.parse(savedCustomerInfo);
        setCustomerInfo((prev) => ({ ...prev, ...parsedCustomer }));
      }
    } catch (error) {
      console.error("Error loading booking data:", error);
      Alert.alert("Lỗi", "Không thể tải thông tin đặt phòng");
      navigation.goBack();
    }
  };

  const calculateTotal = () => {
    if (!bookingInfo) return 0;

    const checkInDate = new Date(bookingInfo.checkIn);
    const checkOutDate = new Date(bookingInfo.checkOut);
    const nights = Math.ceil(
      (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const roomPrice = bookingInfo.selectedRooms.reduce((sum, sr) => {
      const price =
        sr.room.discountedPrice &&
        sr.room.discountedPrice < sr.room.basePricePerNight
          ? sr.room.discountedPrice
          : sr.room.basePricePerNight || 0;
      return sum + (typeof price === "number" ? price : 0) * nights;
    }, 0);

    const servicesPrice =
      bookingInfo.selectedServices?.reduce((sum, service) => {
        const price = typeof service.price === "number" ? service.price : 0;
        const quantity =
          typeof service.quantity === "number" ? service.quantity : 1;
        return sum + price * quantity;
      }, 0) || 0;

    return roomPrice + servicesPrice;
  };

  const calculateNights = () => {
    if (!bookingInfo) return 0;
    const checkInDate = new Date(bookingInfo.checkIn);
    const checkOutDate = new Date(bookingInfo.checkOut);
    return Math.ceil(
      (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
    );
  };

  const calculateTax = () => {
    const subtotal = calculateTotal();
    return subtotal * 0.1;
  };

  const calculateGrandTotal = () => {
    return calculateTotal() + calculateTax();
  };

  const handleSubmit = async () => {
    if (!bookingInfo) return;

    // Validation
    if (!customerInfo.fullName.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập họ và tên");
      return;
    }
    if (!customerInfo.email.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập email");
      return;
    }
    if (!customerInfo.phone.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập số điện thoại");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerInfo.email)) {
      Alert.alert("Lỗi", "Email không hợp lệ");
      return;
    }

    setLoading(true);
    try {
      const roomsPayload = bookingInfo.selectedRooms.map((sr) => ({
        IdPhong: sr.room.roomId,
        SoPhong: sr.roomNumber,
        GiaCoBanMotDem: sr.room.basePricePerNight || 0,
      }));

      const bookingPayload = {
        hoTen: customerInfo.fullName,
        email: customerInfo.email,
        soDienThoai: customerInfo.phone,
        ngayNhanPhong: bookingInfo.checkIn,
        ngayTraPhong: bookingInfo.checkOut,
        soLuongKhach: bookingInfo.guests,
        rooms: roomsPayload,
        ghiChu: customerInfo.notes,
      };

      const response = await fetch(`${DEFAULT_BASE_URL}/api/datphong/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bookingPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Không thể tạo đặt phòng");
      }

      const result = await response.json();
      if (!result.success || !result.data || !result.data.idDatPhong) {
        throw new Error(result.message || "Tạo đặt phòng thất bại");
      }

      const invoiceInfo = {
        idDatPhong: result.data.idDatPhong,
        idKhachHang: result.data.idKhachHang,
        rooms: bookingInfo.selectedRooms,
        checkIn: bookingInfo.checkIn,
        checkOut: bookingInfo.checkOut,
        nights: calculateNights(),
        guests: bookingInfo.guests,
        totalPrice: calculateTotal(),
        tax: calculateTax(),
        grandTotal: calculateGrandTotal(),
        holdExpiresAt: result.data.holdExpiresAt,
        customer: customerInfo,
      };

      await AsyncStorage.setItem("customerInfo", JSON.stringify(customerInfo));
      await AsyncStorage.setItem("invoiceInfo", JSON.stringify(invoiceInfo));

      setLoading(false);
      navigation.navigate("Payment" as never);
    } catch (error: any) {
      console.error("Error:", error);
      const errorMessage =
        typeof error.message === "string"
          ? error.message
          : "Đặt phòng thất bại. Vui lòng thử lại.";
      Alert.alert("Lỗi", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!bookingInfo) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Đang tải...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const nights = calculateNights();
  const totalPrice = calculateTotal();
  const tax = calculateTax();
  const grandTotal = calculateGrandTotal();

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <AppIcon name="arrow-left" size={20} color={COLORS.secondary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Thông tin đặt phòng</Text>
          <View style={{ width: 20 }} />
        </View>

        <BookingProgress
          currentStage="checkout"
          totalRooms={bookingInfo.totalRooms}
          selectedRoomNumbers={bookingInfo.selectedRooms.map(
            (sr) => sr.roomNumber
          )}
        />

        <ScrollView
          style={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Booking Summary */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tóm tắt đặt phòng</Text>

            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Nhận phòng:</Text>
              <Text style={styles.summaryValue}>
                {new Date(bookingInfo.checkIn).toLocaleDateString("vi-VN")}
              </Text>
            </View>

            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Trả phòng:</Text>
              <Text style={styles.summaryValue}>
                {new Date(bookingInfo.checkOut).toLocaleDateString("vi-VN")}
              </Text>
            </View>

            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Số đêm:</Text>
              <Text style={styles.summaryValue}>{nights}</Text>
            </View>

            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Số khách:</Text>
              <Text style={styles.summaryValue}>
                {String(bookingInfo.guests)}
              </Text>
            </View>

            <View style={styles.roomList}>
              <Text style={styles.roomListTitle}>Phòng đã chọn:</Text>
              {bookingInfo.selectedRooms.map((sr) => (
                <View key={sr.roomNumber} style={styles.roomItem}>
                  <Text style={styles.roomName}>
                    Phòng {sr.roomNumber}:{" "}
                    {String(sr.room.roomTypeName || "Unknown")}
                  </Text>
                  <Text style={styles.roomPrice}>
                    $
                    {String(
                      (typeof sr.room.discountedPrice === "number"
                        ? sr.room.discountedPrice
                        : typeof sr.room.basePricePerNight === "number"
                        ? sr.room.basePricePerNight
                        : 0
                      ).toLocaleString()
                    )}{" "}
                    x {nights} đêm
                  </Text>
                </View>
              ))}
            </View>

            {bookingInfo.selectedServices &&
              bookingInfo.selectedServices.length > 0 && (
                <View style={styles.roomList}>
                  <Text style={styles.roomListTitle}>Dịch vụ đã chọn:</Text>
                  {bookingInfo.selectedServices.map((service, index) => (
                    <View key={index} style={styles.roomItem}>
                      <Text style={styles.roomName}>
                        {String(service.serviceName || "Dịch vụ")}
                      </Text>
                      <Text style={styles.roomPrice}>
                        $
                        {String(
                          typeof service.price === "number"
                            ? service.price.toLocaleString()
                            : "0"
                        )}{" "}
                        x{" "}
                        {String(
                          typeof service.quantity === "number"
                            ? service.quantity
                            : 1
                        )}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
          </View>

          {/* Customer Information */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Thông tin khách hàng</Text>
              {isLoggedIn && (
                <View style={styles.loggedInBadge}>
                  <AppIcon name="user" size={12} color={COLORS.success} />
                  <Text style={styles.loggedInText}>Đã đăng nhập</Text>
                </View>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Họ và tên *</Text>
              <TextInput
                style={styles.input}
                value={customerInfo.fullName}
                onChangeText={(text) =>
                  setCustomerInfo((prev) => ({ ...prev, fullName: text }))
                }
                placeholder="Nguyễn Văn A"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email *</Text>
              <TextInput
                style={styles.input}
                value={customerInfo.email}
                onChangeText={(text) =>
                  setCustomerInfo((prev) => ({ ...prev, email: text }))
                }
                placeholder="example@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Số điện thoại *</Text>
              <TextInput
                style={styles.input}
                value={customerInfo.phone}
                onChangeText={(text) =>
                  setCustomerInfo((prev) => ({ ...prev, phone: text }))
                }
                placeholder="0912345678"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Địa chỉ</Text>
              <TextInput
                style={styles.input}
                value={customerInfo.address}
                onChangeText={(text) =>
                  setCustomerInfo((prev) => ({ ...prev, address: text }))
                }
                placeholder="Địa chỉ của bạn"
                multiline
                numberOfLines={2}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Ghi chú</Text>
              <TextInput
                style={styles.input}
                value={customerInfo.notes}
                onChangeText={(text) =>
                  setCustomerInfo((prev) => ({ ...prev, notes: text }))
                }
                placeholder="Yêu cầu đặc biệt (tùy chọn)"
                multiline
                numberOfLines={3}
              />
            </View>
          </View>

          {/* Price Summary */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tóm tắt chi phí</Text>

            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Tiền phòng:</Text>
              <Text style={styles.priceValue}>
                ${totalPrice.toLocaleString()}
              </Text>
            </View>

            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Thuế & phí (10%):</Text>
              <Text style={styles.priceValue}>${tax.toLocaleString()}</Text>
            </View>

            <View style={[styles.priceRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Tổng cộng:</Text>
              <Text style={styles.totalValue}>
                ${grandTotal.toLocaleString()}
              </Text>
            </View>
          </View>

          {/* Policies */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Chính sách & lưu ý</Text>

            <View style={styles.policyItem}>
              <AppIcon name="clock-o" size={16} color={COLORS.primary} />
              <Text style={styles.policyText}>
                Giờ nhận phòng: 14:00, trả phòng: 12:00
              </Text>
            </View>

            <View style={styles.policyItem}>
              <AppIcon name="ban" size={16} color={COLORS.error} />
              <Text style={styles.policyText}>
                Hút thuốc nghiêm cấm trong phòng
              </Text>
            </View>

            <View style={styles.policyItem}>
              <AppIcon name="undo" size={16} color={COLORS.success} />
              <Text style={styles.policyText}>Miễn phí hủy trong 24 giờ</Text>
            </View>
          </View>
        </ScrollView>

        {/* Submit Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.submitButton,
              loading && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.submitButtonText}>
              {loading ? "Đang xử lý..." : "Xác nhận đặt phòng"}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SIZES.padding,
  },
  loggedInBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.success + "20",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  loggedInText: {
    ...FONTS.body4,
    color: COLORS.success,
    fontWeight: "600",
    marginLeft: 4,
  },
  summaryItem: {
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
  inputGroup: {
    marginBottom: SIZES.padding,
  },
  inputLabel: {
    ...FONTS.body3,
    fontWeight: "600",
    color: COLORS.secondary,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: 8,
    padding: SIZES.padding * 0.8,
    fontSize: 16,
    color: COLORS.secondary,
    backgroundColor: COLORS.white,
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
  policyItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  policyText: {
    ...FONTS.body4,
    color: COLORS.gray,
    marginLeft: 8,
  },
  footer: {
    backgroundColor: COLORS.white,
    padding: SIZES.padding,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
  },
  submitButton: {
    backgroundColor: "#d47153ff",
    paddingVertical: SIZES.padding,
    borderRadius: 8,
    alignItems: "center",
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    ...FONTS.h4,
    color: COLORS.white,
    fontWeight: "600",
  },
});

export default CheckoutScreen;
