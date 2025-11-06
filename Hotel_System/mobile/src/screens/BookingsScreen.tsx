import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import authApi from "../api/authApi";
import { COLORS, SIZES, FONTS, SHADOWS } from "../constants/theme";

const BookingsScreen: React.FC = () => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await authApi.getBookings();
      setBookings(Array.isArray(data) ? data : []);
    } catch (e: any) {
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

  const renderBooking = ({ item, index }: { item: any; index: number }) => (
    <View style={styles.bookingCard}>
      <View style={styles.cardHeader}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>#{index + 1}</Text>
        </View>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>
            {item.status || item.trangThai || "Active"}
          </Text>
        </View>
      </View>

      <View style={styles.cardContent}>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Mã đặt phòng:</Text>
          <Text style={styles.value}>{item.id || item.bookingId || "-"}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Text style={styles.label}>Phòng:</Text>
          <Text style={styles.value}>
            {item.phong || item.roomName || item.tenPhong || "-"}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Text style={styles.label}>Ngày nhận:</Text>
          <Text style={styles.value}>
            {item.checkIn || item.ngayNhan || "-"}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Text style={styles.label}>Ngày trả:</Text>
          <Text style={styles.value}>
            {item.checkOut || item.ngayTra || "-"}
          </Text>
        </View>

        {(item.price || item.totalPrice || item.tongGia) && (
          <>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.label}>Tổng giá:</Text>
              <Text style={styles.priceValue}>
                $
                {Number(
                  item.price || item.totalPrice || item.tongGia
                ).toLocaleString()}
              </Text>
            </View>
          </>
        )}
      </View>

      <TouchableOpacity style={styles.detailButton}>
        <Text style={styles.detailButtonText}>Xem chi tiết</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading bookings...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadBookings}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Lịch sử đặt phòng</Text>
        <Text style={styles.subtitle}>
          {bookings.length} {bookings.length === 1 ? "booking" : "bookings"}
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.white,
    paddingVertical: SIZES.padding * 1.5,
    paddingHorizontal: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    ...SHADOWS.light,
  },
  title: {
    ...FONTS.h3,
    color: COLORS.secondary,
    marginBottom: 4,
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
});

export default BookingsScreen;
