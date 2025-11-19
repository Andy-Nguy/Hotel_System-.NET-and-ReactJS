import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Modal,
  ScrollView,
  Alert,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import authApi from "../api/authApi";
import { useAuth } from "../context/AuthContext";
import { useNavigation } from "@react-navigation/native";
import { COLORS, SIZES, FONTS, SHADOWS } from "../constants/theme";

// Helper to try multiple property names (PascalCase/camelCase) and return the first found value
function getProp(obj: any, ...names: string[]) {
  if (!obj) return undefined;
  for (const n of names) {
    if (obj[n] !== undefined && obj[n] !== null) return obj[n];
  }
  return undefined;
}

// Status badge helper
const getStatusBadge = (
  trangThai?: number | null,
  trangThaiThanhToan?: number | null
) => {
  const isCancelled = trangThai === 0;
  const isPaid = trangThaiThanhToan === 2;
  const isConfirmed = trangThai === 2;
  const isInUse = trangThai === 3;
  const isCompleted = trangThai === 4;

  let statusColor = COLORS.gray;
  let paymentColor = COLORS.gray;

  if (isCancelled) statusColor = COLORS.error;
  else if (isCompleted) statusColor = COLORS.success;
  else if (isInUse) statusColor = COLORS.warning;
  else if (isConfirmed) statusColor = COLORS.success;
  else statusColor = COLORS.warning;

  if (isPaid) paymentColor = COLORS.success;
  else if (trangThaiThanhToan === 0) paymentColor = COLORS.primary;
  else paymentColor = COLORS.warning;

  return { statusColor, paymentColor };
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
  // Prevent duplicate number if name already contains the room number (e.g., "Deluxe Room 101")
  if (soPhong && String(name).includes(String(soPhong))) return name;
  return `${name || "N/A"} ${soPhong || ""}`.trim();
};

const BookingsScreen: React.FC = () => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [detailsData, setDetailsData] = useState<any | null>(null);

  const { token, loading: authLoading } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  useEffect(() => {
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

  const openDetails = (booking: any) => {
    setDetailsModalVisible(true);
    setDetailsData(booking);
  };

  const renderBooking = ({ item, index }: { item: any; index: number }) => {
    // Read status codes using getProp to support PascalCase from backend
    const rawStatus = getProp(item, "trangThai", "TrangThai");
    const rawPayment = getProp(
      item,
      "trangThaiThanhToan",
      "TrangThaiThanhToan"
    );
    const statusCode = rawStatus !== undefined ? Number(rawStatus) : undefined;
    const paymentCode =
      rawPayment !== undefined ? Number(rawPayment) : undefined;
    const { statusColor, paymentColor } = getStatusBadge(
      statusCode,
      paymentCode
    );
    // Normalize rooms array - backend returns different properties depending on endpoint
    const roomsArray =
      getProp(
        item,
        "rooms",
        "Rooms",
        "ChiTietDatPhongs",
        "chiTietDatPhongs",
        "ChiTiet"
      ) || [];
    const topName = getProp(item, "TenPhong", "tenPhong");
    const topSo = getProp(item, "SoPhong", "soPhong");
    const topRoomDisplay = topName
      ? topSo && String(topName).includes(String(topSo))
        ? topName
        : `${topName} ${topSo || ""}`
      : `Số ${topSo}`;
    const isCancelled = item.trangThai === 0;

    return (
      <TouchableOpacity
        style={[
          styles.bookingCard,
          {
            borderLeftWidth: 4,
            borderLeftColor: isCancelled
              ? COLORS.error
              : statusColor === COLORS.success
              ? COLORS.success
              : statusColor === COLORS.warning
              ? COLORS.warning
              : COLORS.primary,
          },
        ]}
        onPress={() => openDetails(item)}
      >
        {/* STATUS SECTION - Most prominent */}
        <View style={styles.statusSection}>
          <View style={styles.statusTags}>
            <View style={[styles.statusTag, { backgroundColor: statusColor }]}>
              <Text style={styles.statusTagText}>
                {item.trangThaiText ||
                  mapBookingStatusText(
                    Number(getProp(item, "trangThai", "TrangThai"))
                  )}
              </Text>
            </View>
            <View style={[styles.statusTag, { backgroundColor: paymentColor }]}>
              <Text style={styles.statusTagText}>
                {item.trangThaiThanhToanText ||
                  mapPaymentStatusText(
                    Number(
                      getProp(item, "trangThaiThanhToan", "TrangThaiThanhToan")
                    )
                  )}
              </Text>
            </View>
          </View>
        </View>

        {/* BOOKING INFO */}
        <View style={styles.bookingInfo}>
          <Text style={styles.customerName}>
            Khách hàng:{" "}
            {getProp(item, "tenKhachHang", "TenKhachHang", "hoTen", "HoTen") ||
              "N/A"}
          </Text>

          <View style={styles.infoRow}>
            <Text style={styles.calendarIcon}>📅</Text>
            <Text style={styles.dateText}>
              {new Date(item.ngayNhanPhong).toLocaleDateString("vi-VN")} →{" "}
              {new Date(item.ngayTraPhong).toLocaleDateString("vi-VN")}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.moneyIcon}>💰</Text>
            <Text style={styles.priceText}>
              {Number(
                getProp(item, "tongTien", "TongTien") ||
                  getProp(item, "TongTien") ||
                  0
              ).toLocaleString()}
              đ
            </Text>
          </View>

          <TouchableOpacity
            style={styles.roomTag}
            onPress={() => openDetails(item)}
            accessibilityRole="button"
          >
            <Text style={styles.roomTagText}>
              Phòng:{" "}
              {roomsArray && roomsArray.length > 0
                ? roomsArray.length === 1
                  ? getRoomDisplayName(
                      roomsArray[0],
                      getProp(item, "soPhong", "SoPhong")
                    )
                  : `${getRoomDisplayName(
                      roomsArray[0],
                      getProp(item, "soPhong", "SoPhong")
                    )} +${roomsArray.length - 1} khác`
                : // fallback to top-level TenPhong/SoPhong
                  topRoomDisplay}
            </Text>
            {/* Chevron removed; not needed and caused duplicate '>' */}
          </TouchableOpacity>

          {item.services && item.services.length > 0 && (
            <View style={styles.servicesContainer}>
              <Text style={styles.servicesLabel}>Dịch vụ kèm theo:</Text>
              <View style={styles.servicesTags}>
                {item.services.slice(0, 2).map((s: any, i: number) => (
                  <View key={i} style={styles.serviceTag}>
                    <Text style={styles.serviceTagText}>{s.tenDichVu}</Text>
                  </View>
                ))}
                {item.services.length > 2 && (
                  <View style={styles.serviceTag}>
                    <Text style={styles.serviceTagText}>
                      +{item.services.length - 2} khác
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };
  const renderDetailsModal = () => {
    if (!detailsData) return null;

    const rawStatus = getProp(detailsData, "trangThai", "TrangThai");
    const rawPayment = getProp(
      detailsData,
      "trangThaiThanhToan",
      "TrangThaiThanhToan"
    );
    const statusCode = rawStatus !== undefined ? Number(rawStatus) : undefined;
    const paymentCode =
      rawPayment !== undefined ? Number(rawPayment) : undefined;
    const { statusColor, paymentColor } = getStatusBadge(
      statusCode,
      paymentCode
    );

    return (
      <Modal
        visible={detailsModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDetailsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chi tiết đặt phòng</Text>
              <TouchableOpacity
                onPress={() => setDetailsModalVisible(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Status Section */}
              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>Trạng thái</Text>
                <View style={styles.statusTags}>
                  <View
                    style={[styles.statusTag, { backgroundColor: statusColor }]}
                  >
                    <Text style={styles.statusTagText}>
                      {detailsData.trangThaiText ||
                        mapBookingStatusText(
                          Number(getProp(detailsData, "trangThai", "TrangThai"))
                        )}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusTag,
                      { backgroundColor: paymentColor },
                    ]}
                  >
                    <Text style={styles.statusTagText}>
                      {detailsData.trangThaiThanhToanText ||
                        mapPaymentStatusText(
                          Number(
                            getProp(
                              detailsData,
                              "trangThaiThanhToan",
                              "TrangThaiThanhToan"
                            )
                          )
                        )}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Customer Info */}
              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>Thông tin khách hàng</Text>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Tên khách hàng:</Text>
                  <Text style={styles.value}>
                    {getProp(
                      detailsData,
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
                      detailsData,
                      "emailKhachHang",
                      "EmailKhachHang",
                      "email",
                      "Email"
                    ) || "N/A"}
                  </Text>
                </View>
              </View>

              {/* Booking Details */}
              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>Chi tiết đặt phòng</Text>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Mã đặt phòng:</Text>
                  <Text style={styles.value}>
                    {getProp(detailsData, "id", "idDatPhong", "IDDatPhong")}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Trạng thái:</Text>
                  <Text style={styles.value}>
                    {detailsData.trangThaiText ||
                      mapBookingStatusText(
                        Number(getProp(detailsData, "trangThai", "TrangThai"))
                      )}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Thanh toán:</Text>
                  <Text style={styles.value}>
                    {detailsData.trangThaiThanhToanText ||
                      mapPaymentStatusText(
                        Number(
                          getProp(
                            detailsData,
                            "trangThaiThanhToan",
                            "TrangThaiThanhToan"
                          )
                        )
                      )}
                  </Text>
                </View>
                {/* Trạng thái and Thanh toán already shown above with mapping (prevent duplicates) */}
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Ngày nhận phòng:</Text>
                  <Text style={styles.value}>
                    {new Date(detailsData.ngayNhanPhong).toLocaleDateString(
                      "vi-VN"
                    )}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Ngày trả phòng:</Text>
                  <Text style={styles.value}>
                    {new Date(detailsData.ngayTraPhong).toLocaleDateString(
                      "vi-VN"
                    )}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Tổng tiền:</Text>
                  <Text style={styles.priceValue}>
                    {Number(
                      getProp(detailsData, "tongTien", "TongTien") || 0
                    ).toLocaleString()}
                    đ
                  </Text>
                </View>
              </View>

              {/* Rooms */}
              {detailsData.rooms && detailsData.rooms.length > 0 && (
                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>Phòng đã đặt</Text>
                  {(
                    getProp(
                      detailsData,
                      "rooms",
                      "Rooms",
                      "ChiTietDatPhongs",
                      "chiTietDatPhongs",
                      "ChiTiet"
                    ) || []
                  ).map((room: any, index: number) => (
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
                    </View>
                  ))}
                </View>
              )}

              {/* Services */}
              {detailsData.services && detailsData.services.length > 0 && (
                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>Dịch vụ kèm theo</Text>
                  {detailsData.services.map((service: any, index: number) => (
                    <View key={index} style={styles.serviceItem}>
                      <Text style={styles.serviceName}>
                        {service.tenDichVu}
                      </Text>
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

              {/* Notes */}
              {detailsData.ghiChu && (
                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>Ghi chú</Text>
                  <Text style={styles.notesText}>{detailsData.ghiChu}</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
          String(item.id || item.bookingId || item.IdDatPhong || idx)
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
      {renderDetailsModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.white,
    paddingVertical: SIZES.base * 0.6,
    paddingHorizontal: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    ...SHADOWS.light,
  },
  title: {
    ...FONTS.h3,
    color: COLORS.secondary,
    marginBottom: 2,
  },
  subtitle: {
    ...FONTS.body3,
    color: COLORS.gray,
  },
  listContainer: {
    padding: SIZES.padding,
  },
  bookingCard: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radiusLarge,
    marginBottom: SIZES.margin * 1.5,
    overflow: "hidden",
    ...SHADOWS.medium,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: SIZES.padding,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  badge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: SIZES.radius,
  },
  badgeText: {
    ...FONTS.body4,
    color: COLORS.white,
    fontWeight: "700",
  },
  statusBadge: {
    backgroundColor: COLORS.success,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: SIZES.radius,
  },
  statusText: {
    ...FONTS.body5,
    color: COLORS.white,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  cardContent: {
    padding: SIZES.padding,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  label: {
    ...FONTS.body3,
    color: COLORS.gray,
  },
  value: {
    ...FONTS.body3,
    color: COLORS.secondary,
    fontWeight: "600",
  },
  priceValue: {
    ...FONTS.body2,
    color: COLORS.primary,
    fontWeight: "700",
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  detailButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    alignItems: "center",
  },
  detailButtonText: {
    ...FONTS.body3,
    color: COLORS.white,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
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
    fontSize: 64,
    marginBottom: SIZES.margin,
  },
  errorText: {
    ...FONTS.body2,
    color: COLORS.error,
    textAlign: "center",
    marginBottom: SIZES.margin * 1.5,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: SIZES.radius,
  },
  retryButtonText: {
    ...FONTS.body3,
    color: COLORS.white,
    fontWeight: "700",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SIZES.padding * 4,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: SIZES.margin,
  },
  emptyText: {
    ...FONTS.h4,
    color: COLORS.secondary,
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtext: {
    ...FONTS.body3,
    color: COLORS.gray,
    textAlign: "center",
  },
  statusSection: {
    padding: SIZES.padding,
    backgroundColor: COLORS.background,
  },
  statusTags: {
    flexDirection: "row",
    gap: SIZES.base,
  },
  statusTag: {
    paddingHorizontal: SIZES.base,
    paddingVertical: 4,
    borderRadius: SIZES.base / 2,
  },
  statusTagText: {
    color: COLORS.white,
    ...FONTS.body4,
    fontWeight: "bold",
  },
  bookingInfo: {
    padding: SIZES.padding,
  },
  customerName: {
    ...FONTS.h4,
    color: COLORS.secondary,
    marginBottom: SIZES.base,
  },
  calendarIcon: {
    fontSize: SIZES.h4,
    marginRight: SIZES.base,
  },
  moneyIcon: {
    fontSize: SIZES.h4,
    marginRight: SIZES.base,
  },
  dateText: {
    ...FONTS.body3,
    color: COLORS.gray,
    flex: 1,
  },
  priceText: {
    ...FONTS.h3,
    color: COLORS.primary,
    fontWeight: "bold",
  },
  roomTag: {
    backgroundColor: COLORS.lightGray,
    paddingHorizontal: SIZES.base,
    paddingVertical: 4,
    borderRadius: SIZES.base / 2,
    alignSelf: "flex-start",
    marginTop: SIZES.base,
  },
  roomTagText: {
    ...FONTS.body4,
    color: COLORS.primary,
    fontWeight: "bold",
  },
  // roomTagChevron removed to avoid extra '>' being shown in room tag
  servicesContainer: {
    marginTop: SIZES.base,
  },
  servicesLabel: {
    ...FONTS.body4,
    color: COLORS.gray,
    marginBottom: SIZES.base,
  },
  servicesTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SIZES.base,
  },
  serviceTag: {
    backgroundColor: COLORS.lightGray,
    paddingHorizontal: SIZES.base,
    paddingVertical: 2,
    borderRadius: SIZES.base / 2,
  },
  serviceTagText: {
    ...FONTS.body5,
    color: COLORS.success,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radiusLarge,
    width: "90%",
    maxHeight: "80%",
    ...SHADOWS.dark,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    ...FONTS.h3,
    color: COLORS.secondary,
  },
  closeButton: {
    padding: SIZES.base,
  },
  closeButtonText: {
    fontSize: SIZES.h3,
    color: COLORS.gray,
  },
  modalBody: {
    padding: SIZES.padding,
  },
  modalSection: {
    marginBottom: SIZES.margin,
  },
  sectionTitle: {
    ...FONTS.h4,
    color: COLORS.secondary,
    marginBottom: SIZES.base,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: SIZES.base,
  },
  roomItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: SIZES.base,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  roomName: {
    ...FONTS.body3,
    color: COLORS.secondary,
    flex: 1,
  },
  roomPrice: {
    ...FONTS.body3,
    color: COLORS.primary,
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
    flex: 1,
  },
  servicePrice: {
    ...FONTS.body3,
    color: COLORS.primary,
  },
  notesText: {
    ...FONTS.body3,
    color: COLORS.gray,
    lineHeight: 20,
  },
});

export default BookingsScreen;
