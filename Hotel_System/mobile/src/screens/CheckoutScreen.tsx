import React, { useState, useEffect } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
  selectedCombo?: any;
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
  const [currentPoints, setCurrentPoints] = useState<number>(0);
  const [pointsToUse, setPointsToUse] = useState<string>("");
  const [usePointsOption, setUsePointsOption] = useState<"none" | "partial" | "all">("none");
  const [showPointsSection, setShowPointsSection] = useState(false);

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
      
      // Fetch current points from KhachHang
      fetchCustomerPoints();
    }
  }, [isLoggedIn, userInfo]);

  const fetchCustomerPoints = async () => {
    try {
      // Debug: log userInfo to see what's available
      console.log("UserInfo:", JSON.stringify(userInfo, null, 2));
      
      const idKhachHang = 
        userInfo?.idKhachHang || 
        userInfo?.IdKhachHang || 
        userInfo?.idkhachHang ||
        userInfo?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'];
      
      console.log("Customer ID:", idKhachHang);
      
      if (!idKhachHang) {
        console.log("No customer ID found in userInfo");
        return;
      }

      const url = `${DEFAULT_BASE_URL}/api/KhachHang/${idKhachHang}`;
      console.log("Fetching from:", url);
      
      const response = await fetch(url);
      
      console.log("Response status:", response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log("API Response:", JSON.stringify(data, null, 2));
        
        const points = data.tichDiem || data.TichDiem || 0;
        setCurrentPoints(points);
        console.log("Customer points loaded:", points);
      } else {
        console.error("API Error:", response.statusText);
      }
    } catch (error) {
      console.error("Error fetching customer points:", error);
    }
  };

  const loadBookingData = async () => {
    try {
      const params = route.params as any;
      if (params && ('selectedServices' in params || 'selectedCombo' in params)) {
        const bookingData = await AsyncStorage.getItem("bookingData");
        if (bookingData) {
          const parsed = JSON.parse(bookingData);
          const updatedBookingData = {
            ...parsed,
            // Use params value even if it's null/undefined (user deselected)
            selectedServices: 'selectedServices' in params ? params.selectedServices : parsed.selectedServices,
            selectedCombo: 'selectedCombo' in params ? params.selectedCombo : parsed.selectedCombo,
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
    let total = 0;
    
    // Add combo price if selected
    if (bookingInfo?.selectedCombo) {
      total += bookingInfo.selectedCombo.price || 0;
    }
    
    // Add individual services
    if (bookingInfo?.selectedServices) {
      total += bookingInfo.selectedServices.reduce(
        (sum, s) => sum + s.price * s.quantity,
        0
      );
    }
    
    return total;
  };

  const calculateTax = (subtotal: number) => {
    return subtotal * 0.1; // 10% VAT - follow CheckoutPage pattern (no rounding here)
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
      // Calculate separate combo and service totals
      const comboTotal = bookingInfo?.selectedCombo?.price || 0;
      const individualServiceTotal = (bookingInfo?.selectedServices || []).reduce(
        (sum, s) => sum + s.price * s.quantity,
        0
      );
      const serviceTotal = comboTotal + individualServiceTotal;
      const roomTotal = calculateRoomTotal();
      const subTotal = roomTotal + serviceTotal;
      const tax = calculateTax(subTotal);
      
      // Calculate points discount
      const pointsUsedValue = usePointsOption !== "none" && pointsToUse ? parseInt(pointsToUse) : 0;
      const pointsDiscountValue = pointsUsedValue * 10000;
      
      // Calculate final total and round it (matching PaymentPage pattern)
      const totalAmountAfterDiscount = Math.round(subTotal + tax - pointsDiscountValue);

      console.log("=== Payment Calculation ===");
      console.log("Room Total:", roomTotal);
      console.log("Service Total:", serviceTotal);
      console.log("SubTotal:", subTotal);
      console.log("Tax:", tax);
      console.log("Points Used:", pointsUsedValue);
      console.log("Points Discount:", pointsDiscountValue);
      console.log("Total After Discount (rounded):", totalAmountAfterDiscount);

      const finalBookingData = {
        ...bookingInfo,
        customerInfo,
        selectedCombo: bookingInfo?.selectedCombo || null,
        selectedServices: bookingInfo?.selectedServices || [],
        // Points information
        pointsUsed: pointsUsedValue,
        pointsDiscount: pointsDiscountValue,
        // Root level total amount for easy backend access (AFTER discount)
        totalAmount: totalAmountAfterDiscount,
        pricing: {
          roomTotal: Math.round(roomTotal),
          comboTotal: Math.round(comboTotal),
          individualServiceTotal: Math.round(individualServiceTotal),
          totalServiceAndCombo: Math.round(serviceTotal),
          subTotal: Math.round(subTotal),
          tax: Math.round(tax),
          pointsDiscount: pointsDiscountValue,
          totalAmount: totalAmountAfterDiscount, // This is the final amount to charge
        },
      };

      console.log("Final Booking Data:", finalBookingData);
      console.log("Total Amount to Save:", totalAmountAfterDiscount);

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
  
  // Calculate points discount
  const pointsUsed = usePointsOption !== "none" && pointsToUse ? parseInt(pointsToUse) : 0;
  const pointsDiscount = pointsUsed * 10000;
  // Round the final total (matching PaymentPage logic)
  const totalAmount = Math.round(subTotal + tax - pointsDiscount);

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
              <AppIcon name="moon-o" size={16} color={COLORS.gray} />
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
                <AppIcon name="envelope" size={20} color={COLORS.gray} />
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

            <View
              style={[
                styles.inputContainer,
                { alignItems: "flex-start", paddingVertical: 12 },
              ]}
            >
              <View style={[styles.inputIcon, { marginTop: 4 }]}>
                <AppIcon name="edit" size={20} color={COLORS.gray} />
              </View>
              <View style={styles.inputContent}>
                <Text style={styles.inputLabel}>Ghi chú</Text>
                <TextInput
                  style={[
                    styles.input,
                    { height: 60, textAlignVertical: "top" },
                  ]}
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

          {/* Loyalty Points Card */}
          <View style={styles.loyaltyCard}>
            <TouchableOpacity 
              style={styles.loyaltyHeader}
              onPress={() => setShowPointsSection(!showPointsSection)}
              activeOpacity={0.7}
            >
              <View style={styles.loyaltyIconContainer}>
                <AppIcon name="star" size={28} color={COLORS.white} />
              </View>
              <View style={styles.loyaltyTextContainer}>
                <Text style={styles.loyaltyTitle}>Điểm tích lũy</Text>
                <Text style={styles.loyaltySubtitle}>
                  Tiết kiệm thêm với điểm thưởng
                </Text>
              </View>
              <AppIcon 
                name={showPointsSection ? "chevron-up" : "chevron-down"} 
                size={24} 
                color={COLORS.primary} 
              />
            </TouchableOpacity>

            {/* Current Points & Earn Points */}
            {showPointsSection && (
            <>
              <View style={styles.pointsSummaryBox}>
                <View style={styles.pointsSummaryRow}>
                  <Text style={styles.pointsSummaryLabel}>Điểm hiện có:</Text>
                  <Text style={styles.pointsSummaryValue}>
                    {currentPoints.toLocaleString()} điểm
                  </Text>
                </View>
                <View style={styles.pointsSummaryRow}>
                  <AppIcon name="plus-circle" size={14} color="#52c41a" />
                  <Text style={styles.pointsEarnLabel}>
                    Sẽ kiếm được: {Math.floor(totalAmount / 500000)} điểm từ đơn
                    hàng này (cứ 500,000đ = 1 điểm, tính trên tổng sau giảm)
                  </Text>
                </View>
              </View>

              <View style={styles.dividerSmall} />

              {/* Usage Instructions */}
              <Text style={styles.usageTitle}>Cách sử dụng: 1 điểm = 10,000đ giảm giá</Text>

            {/* Radio Options */}
            <TouchableOpacity
              style={[
                styles.radioOption,
                usePointsOption === "none" && styles.radioOptionSelected,
              ]}
              onPress={() => {
                setUsePointsOption("none");
                setPointsToUse("");
              }}
            >
              <View
                style={[
                  styles.radioCircle,
                  usePointsOption === "none" && styles.radioCircleSelected,
                ]
              }
              >
                {usePointsOption === "none" && (
                  <View style={styles.radioInner} />
                )}
              </View>
              <Text style={styles.radioLabel}>Không sử dụng điểm</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.radioOption,
                usePointsOption === "partial" && styles.radioOptionSelected,
              ]}
              onPress={() => setUsePointsOption("partial")}
            >
              <View
                style={[
                  styles.radioCircle,
                  usePointsOption === "partial" && styles.radioCircleSelected,
                ]
              }
              >
                {usePointsOption === "partial" && (
                  <View style={styles.radioInner} />
                )}
              </View>
              <Text style={styles.radioLabel}>Sử dụng một phần điểm</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.radioOption,
                usePointsOption === "all" && styles.radioOptionSelected,
              ]}
              onPress={() => {
                setUsePointsOption("all");
                // Calculate max points based on subtotal+tax (before points discount)
                const baseTotal = subTotal + tax;
                const maxPoints = Math.floor((baseTotal * 0.5) / 10000);
                const pointsToUseAll = Math.min(currentPoints, maxPoints);
                setPointsToUse(String(pointsToUseAll));
              }}
            >
              <View
                style={[
                  styles.radioCircle,
                  usePointsOption === "all" && styles.radioCircleSelected,
                ]
              }
              >
                {usePointsOption === "all" && (
                  <View style={styles.radioInner} />
                )}
              </View>
              <Text style={styles.radioLabel}>
                Sử dụng tất cả {currentPoints} điểm
              </Text>
            </TouchableOpacity>

            {/* Input for partial points */}
            {usePointsOption === "partial" && (
              <View style={styles.pointsInputContainer}>
                <Text style={styles.pointsInputLabel}>
                  Nhập số điểm muốn sử dụng
                </Text>
                <TextInput
                  style={styles.pointsInput}
                  value={pointsToUse}
                  onChangeText={(text) => {
                    const num = parseInt(text) || 0;
                    // Calculate max points based on subtotal+tax (before points discount)
                    const baseTotal = subTotal + tax;
                    const maxPoints = Math.floor((baseTotal * 0.5) / 10000);
                    const maxAllowed = Math.min(currentPoints, maxPoints);
                    if (num <= maxAllowed) {
                      setPointsToUse(text);
                    }
                  }}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor="#ccc"
                />
              </View>
            )}

            {/* Discount Info */}
            {(usePointsOption === "partial" || usePointsOption === "all") &&
              pointsToUse &&
              parseInt(pointsToUse) > 0 && (
                <View style={styles.discountInfoBox}>
                  <View style={styles.discountInfoHeader}>
                    <AppIcon name="check-circle" size={18} color="#16A34A" />
                    <Text style={styles.discountInfoTitle}>
                      Giảm giá: {(parseInt(pointsToUse) * 10000).toLocaleString()}đ (
                      {((parseInt(pointsToUse) * 10000 / (subTotal + tax)) * 100).toFixed(1)}% tổng hóa đơn)
                    </Text>
                  </View>
                  <Text style={styles.discountInfoText}>
                    • Tối đa được dùng: {currentPoints} điểm (
                    {(currentPoints * 10000).toLocaleString()}đ)
                  </Text>
                  <Text style={styles.discountInfoText}>
                    • Hạn chế: không vượt quá 50% tổng hóa đơn (
                    {((subTotal + tax) * 0.5).toLocaleString()}đ)
                  </Text>
                  <Text style={styles.discountInfoText}>
                    • Điểm sẽ được trừ sau khi thanh toán thành công
                  </Text>
                </View>
              )}
            </>
            )}
          </View>

          {/* Price Breakdown */}
          <View style={styles.priceSection}>
            <Text style={styles.sectionTitle}>Chi tiết thanh toán</Text>

            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>
                Tiền phòng ({calculateNights()} đêm)
              </Text>
              <Text style={styles.priceValue}>
                {Math.round(roomTotal).toLocaleString()}đ
              </Text>
            </View>

            {serviceTotal > 0 && (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Dịch vụ thêm</Text>
                <Text style={styles.priceValue}>
                  {Math.round(serviceTotal).toLocaleString()}đ
                </Text>
              </View>
            )}

            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Thuế VAT (10%)</Text>
              <Text style={styles.priceValue}>{Math.round(tax).toLocaleString()}đ</Text>
            </View>

            {pointsDiscount > 0 && (
              <View style={styles.priceRow}>
                <Text style={[styles.priceLabel, { color: "#52c41a" }]}>
                  Giảm giá từ điểm ({pointsUsed} điểm)
                </Text>
                <Text style={[styles.priceValue, { color: "#52c41a" }]}>
                  -{pointsDiscount.toLocaleString()}đ
                </Text>
              </View>
            )}

            <View style={styles.divider} />

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tổng thanh toán</Text>
              <Text style={styles.totalValue}>
                {totalAmount.toLocaleString()}đ
              </Text>
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
    marginBottom: 16,
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
    marginBottom: 16,
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
    marginBottom: 12,
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
  loyaltyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    ...SHADOWS.medium,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  loyaltyHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  loyaltyIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    ...SHADOWS.light,
  },
  loyaltyTextContainer: {
    flex: 1,
  },
  loyaltyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.secondary,
    marginBottom: 2,
  },
  loyaltySubtitle: {
    fontSize: 12,
    color: COLORS.gray,
  },
  pointsSummaryBox: {
    backgroundColor: "#FFF9F2",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#FFE8CC",
    ...SHADOWS.light,
  },
  pointsSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  pointsSummaryLabel: {
    fontSize: 14,
    color: COLORS.secondary,
    fontWeight: "600",
  },
  pointsSummaryValue: {
    fontSize: 24,
    color: COLORS.primary,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  pointsEarnLabel: {
    fontSize: 12,
    color: "#52c41a",
    marginLeft: 4,
    flex: 1,
  },
  dividerSmall: {
    height: 1,
    backgroundColor: "#F1F3F5",
    marginVertical: 12,
  },
  usageTitle: {
    fontSize: 13,
    color: COLORS.gray,
    marginBottom: 12,
  },
  radioOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: "transparent",
  },
  radioOptionSelected: {
    backgroundColor: "#FFF9F2",
    borderColor: COLORS.primary,
  },
  radioCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  radioCircleSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.white,
  },
  radioLabel: {
    fontSize: 15,
    color: COLORS.secondary,
    fontWeight: "600",
    flex: 1,
  },
  pointsInputContainer: {
    marginTop: 12,
    backgroundColor: "#FFF9F2",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FFE8CC",
  },
  pointsInputLabel: {
    fontSize: 13,
    color: COLORS.gray,
    marginBottom: 8,
  },
  pointsInput: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    color: COLORS.primary,
    fontWeight: "700",
    borderWidth: 2,
    borderColor: COLORS.primary,
    textAlign: "center",
  },
  discountInfoBox: {
    backgroundColor: "#F0FDF4",
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderWidth: 2,
    borderColor: "#86EFAC",
    ...SHADOWS.light,
  },
  discountInfoHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  discountInfoTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#16A34A",
    marginLeft: 8,
  },
  discountInfoText: {
    fontSize: 13,
    color: "#166534",
    lineHeight: 20,
    marginTop: 4,
    fontWeight: "500",
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
    paddingBottom: 100,
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
