import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Alert,
  LayoutAnimation,
  UIManager,
  Platform,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import authApi from "../api/authApi";
import { useAuth } from "../context/AuthContext";
import { useNavigation } from "@react-navigation/native";
import { COLORS as AppColors, SIZES, FONTS, SHADOWS } from "../constants/theme";

const COLORS = { ...AppColors, primary: "#dfa974" };

// Helper to try multiple property names (PascalCase/camelCase) and return the first found value
function getProp(obj: any, ...names: string[]) {
  if (!obj) return undefined;
  for (const n of names) {
    if (obj[n] !== undefined && obj[n] !== null) return obj[n];
  }
  return undefined;
}

// Status badge helper
const getStatusBadgeStyle = (
  type: "booking" | "payment",
  status?: number | null
) => {
  let style = {
    backgroundColor: AppColors.lightGray,
    borderColor: AppColors.gray,
    textColor: AppColors.secondary,
  };

  if (type === "booking") {
    switch (status) {
      case 0: // Cancelled
        style = {
          backgroundColor: "#fff1f0",
          borderColor: AppColors.error,
          textColor: AppColors.error,
        };
        break;
      case 1: // Pending
        style = {
          backgroundColor: "#fffbe6",
          borderColor: AppColors.warning,
          textColor: AppColors.warning,
        };
        break;
      case 2: // Confirmed
      case 3: // In Use
      case 4: // Completed
        style = {
          backgroundColor: "#f6ffed",
          borderColor: AppColors.success,
          textColor: AppColors.success,
        };
        break;
    }
  } else if (type === "payment") {
    switch (status) {
      case 0: // Deposit
        style = {
          backgroundColor: "#e6f7ff",
          borderColor: AppColors.primary,
          textColor: AppColors.primary,
        };
        break;
      case 1: // Unpaid
        style = {
          backgroundColor: "#fff1f0",
          borderColor: AppColors.error,
          textColor: AppColors.error,
        };
        break;
      case 2: // Paid
        style = {
          backgroundColor: "#f6ffed",
          borderColor: AppColors.success,
          textColor: AppColors.success,
        };
        break;
    }
  }

  return style;
};

// NOTE: `mapBookingStatusText`, `mapPaymentStatusText`, and `getRoomDisplayName`
// are defined later down the file so we can reuse them consistently.

// Map numeric booking status to human readable Vietnamese (fallback if server doesn't provide)
const mapBookingStatusText = (status: number | undefined | null) => {
  switch (status) {
    case 1:
      return "Chờ xác nhận";
    case 2:
      return "Đã xác nhận";
    case 0:
      return "Đã hủy";
    case 3:
      return "Đang sử dụng";
    case 4:
      return "Hoàn thành";
    default:
      return "Không xác định";
  }
};

const mapPaymentStatusText = (status: number | undefined | null) => {
  switch (status) {
    case 0:
      return "Đã cọc";
    case 1:
      return "Chưa thanh toán";
    case 2:
      return "Đã thanh toán";
    default:
      return "Không xác định";
  }
};

// Get readable room name; fallback to room type or room number
const getRoomDisplayName = (room: any, soPhongFallback?: any) => {
  if (!room) return `Số ${soPhongFallback || "-"}`;
  const name = getProp(
    room,
    "tenPhong",
    "TenPhong",
    "tenPhongChiTiet",
    "TenPhongChiTiet",
    "tenLoaiPhong",
    "TenLoaiPhong"
  );
  const soPhong =
    getProp(room, "soPhong", "SoPhong") ||
    getProp(room, "SoPhongChiTiet", "soPhongChiTiet") ||
    soPhongFallback;

  // If name is just a room type, prepend it to the room number
  if (
    name &&
    soPhong &&
    (name.toLowerCase().includes("phòng") ||
      name.toLowerCase().includes("room")) &&
    !String(name).includes(String(soPhong))
  ) {
    return `${name} ${soPhong}`;
  }

  // Prevent duplicate number if name already contains the room number (e.g., "Deluxe Room 101")
  if (soPhong && String(name).includes(String(soPhong))) return name;
  return `${name || "Phòng"} ${soPhong || ""}`.trim();
};

const BookingsScreen: React.FC = () => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { token, loading: authLoading } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    // Enable LayoutAnimation for Android
    if (Platform.OS === "android") {
      UIManager.setLayoutAnimationEnabledExperimental &&
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
    // Wait until auth provider finishes checking token; otherwise request may be unauthenticated
    if (!authLoading) {
      loadBookings();
    }
  }, [authLoading]);

  // If token becomes available later (e.g., user logged in), reload bookings
  useEffect(() => {
    if (!authLoading && token) loadBookings();
  }, [token, authLoading]);

  const loadBookings = async () => {
    try {
      // If there's no token, prompt user to login
      if (!token) {
        setError("Bạn cần đăng nhập để xem lịch sử đặt phòng");
        return;
      }
      // Detect demo/mock token added by-dev (eg. demo signature); don't call protected endpoints with it
      if (typeof token === "string" && token.includes("mock_signature")) {
        setBookings([]);
        setError("Bạn đang ở chế độ demo. Đăng nhập để xem lịch sử thực tế.");
        return;
      }
      setLoading(true);
      setError(null);
      const data = await authApi.getMyBookingHistory();
      // Sort by check-in date desc
      const sortedData = Array.isArray(data)
        ? data.sort(
            (a, b) =>
              new Date(b.ngayNhanPhong).getTime() -
              new Date(a.ngayNhanPhong).getTime()
          )
        : [];
      setBookings(sortedData);
    } catch (e: any) {
      // If server returns 401, navigate to login so user can reauthenticate
      const errMsg = e?.message || "Failed to load bookings";
      if (
        errMsg.includes("401") ||
        errMsg.toLowerCase().includes("unauthorized")
      ) {
        Alert.alert(
          "Không có quyền",
          "Bạn cần đăng nhập để xem lịch sử đặt phòng.",
          [
            {
              text: "Đăng nhập",
              onPress: () => navigation.navigate("Login" as never),
            },
            { text: "Hủy", style: "cancel" },
          ]
        );
      }
      setError(e?.message || "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBookings();
    setRefreshing(false);
  };

  const toggleExpand = (id: string) => {
    // Animate layout change
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const renderDetails = (item: any) => {
    const roomsArray =
      getProp(
        item,
        "rooms",
        "Rooms",
        "ChiTietDatPhongs",
        "chiTietDatPhongs",
        "ChiTiet"
      ) || [];
    return (
      <View style={styles.detailsContainer}>
        {/* Customer Info */}
        <View style={styles.modalSection}>
          <Text style={styles.sectionTitle}>Thông tin khách hàng</Text>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Tên khách hàng:</Text>
            <Text style={styles.value}>
              {getProp(
                item,
                "tenKhachHang",
                "TenKhachHang",
                "hoTen",
                "HoTen"
              ) || "N/A"}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Email:</Text>
            <Text style={styles.value}>
              {getProp(
                item,
                "emailKhachHang",
                "EmailKhachHang",
                "email",
                "Email"
              ) || "N/A"}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Ngày đặt:</Text>
            <Text style={styles.value}>
              {item.ngayDatPhong
                ? new Date(item.ngayDatPhong).toLocaleDateString("vi-VN")
                : "N/A"}
            </Text>
          </View>
        </View>

        {/* Payment Info */}
        <View style={styles.modalSection}>
          <Text style={styles.sectionTitle}>Thanh toán</Text>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Tổng tiền:</Text>
            <Text style={styles.priceValue}>
              {Number(
                getProp(item, "tongTien", "TongTien") || 0
              ).toLocaleString()}
              đ
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Tiền cọc:</Text>
            <Text style={styles.value}>
              {Number(
                getProp(item, "tienCoc", "TienCoc") || 0
              ).toLocaleString()}
              đ
            </Text>
          </View>
        </View>

        {/* Rooms */}
        {roomsArray && roomsArray.length > 0 && (
          <View style={styles.modalSection}>
            <Text style={styles.sectionTitle}>Chi tiết phòng</Text>
            {roomsArray.map((room: any, index: number) => (
              <View key={index} style={styles.roomItem}>
                <Text style={styles.roomName}>
                  {getRoomDisplayName(room, room.soPhong)}
                </Text>
                <Text style={styles.roomPrice}>
                  {Number(
                    getProp(room, "giaPhong", "GiaPhong") || 0
                  ).toLocaleString()}
                  đ/đêm
                </Text>
                <Text style={styles.roomDetails}>
                  Số đêm: {getProp(room, "soDem", "SoDem") || 0}
                </Text>
                <Text style={styles.roomDetails}>
                  Thành tiền:{" "}
                  {Number(
                    getProp(room, "thanhTien", "ThanhTien") || 0
                  ).toLocaleString()}
                  đ
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Services */}
        {item.services && item.services.length > 0 && (
          <View style={styles.modalSection}>
            <Text style={styles.sectionTitle}>Dịch vụ kèm theo</Text>
            {item.services.map((service: any, index: number) => (
              <View key={index} style={styles.serviceItem}>
                <Text style={styles.serviceName}>{service.tenDichVu}</Text>
                <Text style={styles.servicePrice}>
                  {Number(
                    getProp(
                      service,
                      "tienDichVu",
                      "TienDichVu",
                      "giaDichVu",
                      "GiaDichVu"
                    ) || 0
                  ).toLocaleString()}
                  đ
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderBooking = ({ item, index }: { item: any; index: number }) => {
    const bookingId =
      getProp(item, "idDatPhong", "IddatPhong", "bookingId", "id") ||
      String(index);
    const rawStatus = getProp(item, "trangThai", "TrangThai");
    const rawPayment = getProp(
      item,
      "trangThaiThanhToan",
      "TrangThaiThanhToan"
    );
    const statusCode = rawStatus !== undefined ? Number(rawStatus) : undefined;
    const paymentCode =
      rawPayment !== undefined ? Number(rawPayment) : undefined;

    const bookingStatusStyle = getStatusBadgeStyle("booking", statusCode);
    const paymentStatusStyle = getStatusBadgeStyle("payment", paymentCode);

    const roomsArray =
      getProp(
        item,
        "rooms",
        "Rooms",
        "ChiTietDatPhongs",
        "chiTietDatPhongs",
        "ChiTiet"
      ) || [];

    const isExpanded = expandedId === bookingId;

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => toggleExpand(bookingId)}
        style={styles.bookingCard}
      >
        {/* Header with Status */}
        <View
          style={[
            styles.cardHeader,
            {
              borderTopColor: bookingStatusStyle.borderColor,
            },
          ]}
        >
          <Text style={styles.bookingCode}>
            {getProp(item, "bookingCode", "BookingCode", "idDatPhong")}
          </Text>
          <View style={styles.statusTags}>
            <View
              style={[
                styles.statusTag,
                {
                  backgroundColor: bookingStatusStyle.backgroundColor,
                  borderColor: bookingStatusStyle.borderColor,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusTagText,
                  { color: bookingStatusStyle.textColor },
                ]}
              >
                {item.trangThaiText || mapBookingStatusText(statusCode)}
              </Text>
            </View>
            <View
              style={[
                styles.statusTag,
                {
                  backgroundColor: paymentStatusStyle.backgroundColor,
                  borderColor: paymentStatusStyle.borderColor,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusTagText,
                  { color: paymentStatusStyle.textColor },
                ]}
              >
                {item.trangThaiThanhToanText ||
                  mapPaymentStatusText(paymentCode)}
              </Text>
            </View>
          </View>
        </View>

        {/* Main Content */}
        <View style={styles.cardContent}>
          <Text style={styles.roomSummaryText}>
            {roomsArray.length > 0
              ? roomsArray.length === 1
                ? getRoomDisplayName(
                    roomsArray[0],
                    getProp(item, "soPhong", "SoPhong")
                  )
                : `${getRoomDisplayName(
                    roomsArray[0],
                    getProp(item, "soPhong", "SoPhong")
                  )} & ${roomsArray.length - 1} phòng khác`
              : "Chi tiết đặt phòng"}
          </Text>

          <View style={styles.infoRow}>
            <Ionicons
              name="calendar-outline"
              size={20}
              color={COLORS.secondary}
            />
            <Text style={styles.dateText}>
              {new Date(item.ngayNhanPhong).toLocaleDateString("vi-VN")} -{" "}
              {new Date(item.ngayTraPhong).toLocaleDateString("vi-VN")}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="cash-outline" size={20} color={COLORS.secondary} />
            <Text style={styles.priceText}>
              {Number(
                getProp(item, "tongTien", "TongTien") || 0
              ).toLocaleString()}
              đ
            </Text>
          </View>
        </View>

        {/* Expanded Details */}
        {isExpanded && (
          <>
            <View style={styles.divider} />
            {renderDetails(item)}
          </>
        )}

        {/* Footer with expand icon */}
        <View style={styles.cardFooter}>
          <Text style={styles.footerText}>
            {isExpanded ? "Thu gọn" : "Xem chi tiết"}
          </Text>
          <Ionicons
            name={isExpanded ? "chevron-up-outline" : "chevron-down-outline"}
            size={20}
            color={COLORS.primary}
          />
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Đang tải lịch sử đặt phòng...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadBookings}>
          <Text style={styles.retryButtonText}>Thử lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Use minimal extra spacing in addition to the safe-area top inset to avoid
  // excessive empty area on devices with notches / Dynamic Island.
  // `SIZES.base` is small (8); this keeps a small consistent gap without hiding
  // the header under cutouts.
  // Minimal spacing so the header is not shoved too far down on devices with
  // larger top safe area (Dynamic Island / notch).
  // Clamp the top inset so big notches (e.g. iPhone Dynamic Island) don't add
  // a huge gap. Keep a small gap, e.g. at most 12px.
  const topPadding = Math.min(insets.top, 8);

  return (
    <SafeAreaView style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Lịch sử đặt phòng</Text>
        <Text style={styles.subtitle}>
          {bookings.length} {bookings.length === 1 ? "đặt phòng" : "đặt phòng"}
        </Text>
      </View>

      <FlatList
        data={bookings}
        renderItem={renderBooking}
        keyExtractor={(item, idx) =>
          String(
            getProp(item, "idDatPhong", "IddatPhong", "bookingId", "id") || idx
          )
        }
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>Không có lịch sử đặt phòng</Text>
            <Text style={styles.emptySubtext}>
              Các đặt phòng của bạn sẽ hiển thị ở đây
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: SIZES.padding,
    paddingBottom: SIZES.base,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    ...FONTS.h2,
    color: COLORS.secondary,
    fontWeight: "bold",
  },
  subtitle: {
    ...FONTS.body3,
    color: COLORS.gray,
  },
  listContainer: {
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
  },
  bookingCard: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    marginBottom: SIZES.margin * 1.5,
    ...SHADOWS.medium,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.base,
    backgroundColor: COLORS.white,
    borderTopWidth: 4,
  },
  bookingCode: {
    ...FONTS.body3,
    color: COLORS.secondary,
    fontWeight: "bold",
  },
  statusTags: {
    flexDirection: "row",
    gap: SIZES.base,
  },
  statusTag: {
    paddingHorizontal: SIZES.base,
    paddingVertical: 4,
    borderRadius: SIZES.radius,
    borderWidth: 1,
  },
  statusTagText: {
    ...FONTS.body5,
    fontWeight: "bold",
  },
  cardContent: {
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.padding,
  },
  roomSummaryText: {
    ...FONTS.h4,
    color: COLORS.secondary,
    marginBottom: SIZES.margin,
    fontWeight: "bold",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SIZES.base,
  },
  dateText: {
    ...FONTS.body3,
    color: COLORS.secondary,
    marginLeft: SIZES.base,
  },
  priceText: {
    ...FONTS.body3,
    color: COLORS.primary,
    fontWeight: "bold",
    marginLeft: SIZES.base,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: SIZES.base,
    backgroundColor: COLORS.lightGray,
  },
  footerText: {
    ...FONTS.body4,
    color: COLORS.primary,
    marginRight: SIZES.base / 2,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: SIZES.padding,
  },
  detailsContainer: {
    padding: SIZES.padding,
    backgroundColor: COLORS.background, // A slightly different background for details
  },
  modalSection: {
    marginBottom: SIZES.margin,
  },
  sectionTitle: {
    ...FONTS.h4,
    color: COLORS.secondary,
    marginBottom: SIZES.margin,
    paddingBottom: SIZES.base,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  label: {
    ...FONTS.body4,
    color: COLORS.gray,
    flex: 1,
  },
  value: {
    ...FONTS.body4,
    color: COLORS.secondary,
    fontWeight: "600",
    textAlign: "right",
  },
  priceValue: {
    ...FONTS.body3,
    color: COLORS.primary,
    fontWeight: "bold",
    textAlign: "right",
  },
  roomItem: {
    paddingVertical: SIZES.base,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  roomName: {
    ...FONTS.body3,
    color: COLORS.secondary,
    fontWeight: "600",
    marginBottom: 4,
  },
  roomDetails: {
    ...FONTS.body4,
    color: COLORS.gray,
  },
  roomPrice: {
    ...FONTS.body4,
    color: COLORS.primary,
    fontWeight: "bold",
    textAlign: "right",
  },
  serviceItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: SIZES.base,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  serviceName: {
    ...FONTS.body3,
    color: COLORS.secondary,
  },
  servicePrice: {
    ...FONTS.body3,
    color: COLORS.primary,
    fontWeight: "bold",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
    padding: SIZES.padding * 2,
  },
  loadingText: {
    ...FONTS.body3,
    color: COLORS.gray,
    marginTop: SIZES.margin,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: SIZES.margin,
    color: COLORS.error,
  },
  errorText: {
    ...FONTS.h4,
    color: COLORS.secondary,
    textAlign: "center",
    marginBottom: SIZES.base,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: SIZES.radius,
    marginTop: SIZES.margin,
  },
  retryButtonText: {
    ...FONTS.body3,
    color: COLORS.white,
    fontWeight: "bold",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: "40%",
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: SIZES.margin,
    color: COLORS.gray,
  },
  emptyText: {
    ...FONTS.h3,
    color: COLORS.secondary,
    marginBottom: SIZES.base,
  },
  emptySubtext: {
    ...FONTS.body3,
    color: COLORS.gray,
    textAlign: "center",
    paddingHorizontal: SIZES.padding * 2,
  },
});

export default BookingsScreen;
