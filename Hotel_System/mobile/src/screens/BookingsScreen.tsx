import React, { useEffect, useState, useMemo, useRef } from "react";
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
  Modal,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import authApi from "../api/authApi";
import reviewApi from "../api/reviewApi";
import { useAuth } from "../context/AuthContext";
import { useNavigation } from "@react-navigation/native";
import { COLORS as AppColors, SIZES, FONTS, SHADOWS } from "../constants/theme";
import ReviewScreen from "./ReviewScreen";

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
      case 5: // Overdue
        style = {
          backgroundColor: "#fef2f0",
          borderColor: "#ff7875",
          textColor: "#ff7875",
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
    case 5:
      return "Quá hạn";
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
  const [activeReviewBookingId, setActiveReviewBookingId] = useState<
    string | null
  >(null);
  const [activeReviewBookingCode, setActiveReviewBookingCode] = useState<
    string | null
  >(null);
  const refreshTimers = useRef<Array<any>>([]);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [reviewStatusMap, setReviewStatusMap] = useState<Record<string, boolean>>({});

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
      console.debug("Loaded bookings", {
        count: sortedData.length,
        sample: sortedData[0],
      });

      // Check review status for all completed bookings
      const statusMap: Record<string, boolean> = {};
      for (const booking of sortedData) {
        const statusCode = getProp(booking, "trangThai", "TrangThai");
        if (Number(statusCode) === 4) { // Only check for completed bookings
          const bookingId = getProp(
            booking,
            "IddatPhong",
            "iddatPhong",
            "IDDatPhong"
          );
          if (bookingId) {
            try {
              const res = await reviewApi.getReviewStatus(String(bookingId));
              if (res?.ok && res.data?.hasReview) {
                statusMap[String(bookingId)] = true;
              }
            } catch (err) {
              console.debug("Error checking review status for booking", bookingId, err);
            }
          }
        }
      }
      setReviewStatusMap(statusMap);
    } catch (e: any) {
      // Map backend/internal errors to friendly user-facing messages.
      const rawMsg = (e?.message || "").toString();
      const lower = rawMsg.toLowerCase();

      // Detect authorization/token related issues
      const isAuthError =
        lower.includes("401") ||
        lower.includes("unauthorized") ||
        lower.includes("token") ||
        lower.includes("phiên") ||
        lower.includes("không hợp lệ") ||
        lower.includes("invalid");

      if (isAuthError) {
        // Friendly non-blocking message for users
        const friendly =
          "Bạn chưa đăng nhập. Vui lòng đăng nhập để xem lịch sử đặt phòng.";
        // Do not show a popup; show inline error instead and log for debugging
        console.info("Auth error detected while loading bookings:", rawMsg);
        setError(friendly);
      } else {
        // Generic friendly message for non-auth errors
        console.error("Bookings load error:", rawMsg, e);
        setError("Không thể tải lịch sử. Vui lòng thử lại sau.");
      }
    } finally {
      setLoading(false);
    }
  };

  // When bookings change, do NOT auto-refresh based on checkout time.
  // Only allow manual refresh (pull-to-refresh or reload button) to avoid flickering.
  // This ensures all statuses (1, 2, 3, 4, 5) display smoothly without constant reloading.
  useEffect(() => {
    // Clear existing timers
    try {
      refreshTimers.current.forEach((t) => clearTimeout(t));
    } catch (e) {}
    refreshTimers.current = [];

    return () => {
      try {
        refreshTimers.current.forEach((t) => clearTimeout(t));
      } catch (e) {}
      refreshTimers.current = [];
    };
  }, [bookings]);

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
    // Preserve numeric IDs (0) by checking null/undefined explicitly
    // Lấy ID đặt phòng từ JSON: IddatPhong (hoặc iddatPhong nếu camelCase)
    const rawBookingId = getProp(
      item,
      "IddatPhong", // property C# => JSON mặc định
      "iddatPhong", // nếu bạn bật camelCase
      "IDDatPhong" // phòng khi bạn map đúng tên cột SQL
    );
    const bookingId =
      rawBookingId !== undefined && rawBookingId !== null
        ? String(rawBookingId)
        : ""; // nếu không có thì để rỗng, KHÔNG dùng index để tránh "0"

    // Mã đặt phòng hiển thị: hiện tại bảng chỉ có IDDatPhong, nên dùng luôn bookingId
    const rawBookingCode = getProp(
      item,
      "IddatPhong",
      "iddatPhong",
      "IDDatPhong"
    );
    const bookingCode =
      rawBookingCode !== undefined && rawBookingCode !== null
        ? String(rawBookingCode)
        : bookingId;
    const rawStatus = getProp(item, "trangThai", "TrangThai");
    const rawPayment = getProp(
      item,
      "trangThaiThanhToan",
      "TrangThaiThanhToan"
    );
    const statusCode = rawStatus !== undefined ? Number(rawStatus) : undefined;
    const paymentCode =
      rawPayment !== undefined ? Number(rawPayment) : undefined;

    const checkoutRaw = getProp(item, "ngayTraPhong", "NgayTraPhong");
    const checkoutDate = checkoutRaw ? new Date(checkoutRaw) : null;
    const now = new Date();
    // Only allow review when booking status is explicitly 'Hoàn thành' (4)
    // Previous behavior also allowed review when checkout date passed (now >= checkoutDate)
    // which caused the button to appear for many non-completed bookings. Restrict to 4.
    const canOpenReview = statusCode === 4;

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
          <Text style={styles.bookingCode}>{bookingCode}</Text>
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

        {/* Footer with expand icon and optional review button */}
        <View
          style={[
            styles.cardFooter,
            {
              justifyContent: "space-between",
              paddingHorizontal: SIZES.padding,
            },
          ]}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={styles.footerText}>
              {isExpanded ? "Thu gọn" : "Xem chi tiết"}
            </Text>
            <Ionicons
              name={isExpanded ? "chevron-up-outline" : "chevron-down-outline"}
              size={20}
              color={COLORS.primary}
            />
          </View>

          {canOpenReview && (
            <TouchableOpacity
              onPress={async () => {
                // Debug: log which ids/codes we will use when opening review
                console.debug("Opening review (button press)", {
                  bookingId,
                  bookingCode,
                  item,
                });

                // Use bookingId (DB id) for API calls; bookingCode is for display
                const bId = String(bookingId);

                // If status isn't marked completed (4) and not overdue (5), try completing checkout
                if (statusCode !== 4 && statusCode !== 5) {
                  try {
                    setCompletingId(bId);
                    const r = await reviewApi.completeCheckout(bId);
                    setCompletingId(null);

                    if (!r.ok) {
                      Alert.alert(
                        "Không thể hoàn tất",
                        r?.message || "Vui lòng thử lại sau."
                      );
                      return;
                    }

                    // Refresh to sync status
                    loadBookings();
                  } catch (e: any) {
                    setCompletingId(null);
                    Alert.alert(
                      "Không thể hoàn tất",
                      e?.message || "Vui lòng thử lại sau."
                    );
                    return;
                  }
                }

                // Check review status; if none, open inline review and pass code
                try {
                  const res = await reviewApi.getReviewStatus(bId);
                  const openInlineReview = (id: string, code?: string) => {
                    setActiveReviewBookingId(id);
                    setActiveReviewBookingCode(code ?? id);
                  };

                  if (res && res.ok && res.data) {
                    if (res.data.hasReview) {
                      // Cập nhật review status map
                      setReviewStatusMap(prev => ({ ...prev, [bId]: true }));
                      Alert.alert(
                        "Đã đánh giá",
                        "Bạn đã gửi đánh giá cho đặt phòng này rồi."
                      );
                    } else {
                      openInlineReview(bId, bookingCode);
                    }
                  } else if (res && res.ok === false && res.status === 404) {
                    openInlineReview(bId, bookingCode);
                  } else {
                    openInlineReview(bId, bookingCode);
                  }
                } catch (e: any) {
                  console.debug("Review button error", e);
                  setActiveReviewBookingId(bId);
                  setActiveReviewBookingCode(bookingCode);
                }
              }}
              disabled={completingId === String(bookingId)}
              style={{
                backgroundColor: reviewStatusMap[String(bookingId)] ? "#52c41a" : COLORS.primary,
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 6,
                opacity: completingId === String(bookingId) ? 0.7 : 1,
              }}
            >
              {completingId === String(bookingId) ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontWeight: "700" }}>
                  {reviewStatusMap[String(bookingId)] ? "Đã đánh giá" : "Đánh giá"}
                </Text>
              )}
            </TouchableOpacity>
          )}
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
        keyExtractor={(item, index) => {
          const id = getProp(item, "IddatPhong", "iddatPhong", "IDDatPhong");
          return id != null ? String(id) : `booking-${index}`;
        }}
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
      {/* Inline modal for the Review form. Render ReviewScreen and provide a
          small navigation stub so the screen's close actions work as expected. */}
      <Modal
        visible={!!activeReviewBookingId}
        animationType="slide"
        onRequestClose={() => {
          setActiveReviewBookingId(null);
          setActiveReviewBookingCode(null);
        }}
      >
        <View style={{ flex: 1, backgroundColor: "#fff" }}>
          {activeReviewBookingId ? (
            <ReviewScreen
              route={{
                params: {
                  bookingId: activeReviewBookingId,
                  bookingCode: activeReviewBookingCode,
                },
              }}
              navigation={
                {
                  goBack: () => {
                    setActiveReviewBookingId(null);
                    setActiveReviewBookingCode(null);
                  },
                  popToTop: () => {
                    setActiveReviewBookingId(null);
                    setActiveReviewBookingCode(null);
                  },
                  navigate: (name: string, params?: any) => {
                    // Close the inline modal first
                    setActiveReviewBookingId(null);
                    setActiveReviewBookingCode(null);

                    try {
                      // Prefer using the current screen's navigation to switch tabs
                      if (
                        navigation &&
                        typeof navigation.getParent === "function"
                      ) {
                        const parent = navigation.getParent();
                        if (parent && typeof parent.navigate === "function") {
                          // If caller asked to navigate to MainApp/HomeTab, translate accordingly
                          if (
                            name === "MainApp" ||
                            name === "HomeTab" ||
                            name === "Home"
                          ) {
                            parent.navigate("HomeTab", { screen: "Home" });
                            return;
                          }
                          parent.navigate(name as any, params);
                          return;
                        }
                      }

                      // Fallback: try global rootNavigation if present
                      const rootNav = (global as any).rootNavigation;
                      if (rootNav && typeof rootNav.navigate === "function") {
                        rootNav.navigate(name as any, params);
                      }
                    } catch (e) {
                      // swallow; modal already closed
                    }
                  },
                } as any
              }
            />
          ) : null}
        </View>
      </Modal>
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
