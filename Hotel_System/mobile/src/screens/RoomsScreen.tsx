import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { getRooms, Room } from "../api/roomsApi";
import { COLORS, SIZES, FONTS, SHADOWS } from "../constants/theme";

const RoomsScreen: React.FC = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRooms();
  }, []);

  const loadRooms = async () => {
    try {
      console.log("🔄 Starting to load rooms...");
      setLoading(true);
      setError(null);
      const data = await getRooms();
      console.log("✅ Rooms loaded:", data);
      setRooms(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error("❌ Failed to load rooms:", e);
      setError(e?.message || "Failed to load rooms");
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRooms();
    setRefreshing(false);
  };

  const renderStars = (rating: number) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    const stars = [];

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push("⭐");
      } else if (i === fullStars && hasHalfStar) {
        stars.push("⭐");
      } else {
        stars.push("☆");
      }
    }
    return stars.join("");
  };

  const renderRoomCard = ({ item }: { item: Room }) => (
    <TouchableOpacity style={styles.card}>
      {/* Room Image */}
      <View style={styles.imageContainer}>
        {item.urlAnhPhong ? (
          <Image
            source={{ uri: item.urlAnhPhong }}
            style={styles.roomImage}
            contentFit="cover"
            onError={(e) => console.log('Image load error:', item.urlAnhPhong, e)}
            onLoad={() => console.log('Image loaded successfully:', item.urlAnhPhong)}
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.imagePlaceholderText}>🏨</Text>
          </View>
        )}
        {/* Status Badge */}
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor:
                item.trangThai === "Available" || item.trangThai === "Còn phòng" ? "#4CAF50" : "#f44336",
            },
          ]}
        >
          <Text style={styles.statusText}>
            {item.trangThai === "Available" || item.trangThai === "Còn phòng" ? "Còn phòng" : "Hết phòng"}
          </Text>
        </View>
      </View>

      {/* Room Info */}
      <View style={styles.content}>
        {/* Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.roomName} numberOfLines={2}>
            {item.tenPhong || "Unknown Room"}
          </Text>
          <Text style={styles.roomNumber}>Phòng {item.soPhong || "-"}</Text>
        </View>

        {/* Rating */}
        <View style={styles.ratingSection}>
          <Text style={styles.stars}>{renderStars(item.xepHangSao || 0)}</Text>
          <Text style={styles.ratingText}>
            {(item.xepHangSao || 0).toFixed(1)}/5
          </Text>
        </View>

        {/* Description/Features */}
        {item.moTa && (
          <Text style={styles.description} numberOfLines={2}>
            {item.moTa}
          </Text>
        )}

        {/* Amenities - Key Features */}
        <View style={styles.amenitiesSection}>
          <View style={styles.amenityBadge}>
            <Text style={styles.amenityText}>📶 Wi-Fi</Text>
          </View>
          <View style={styles.amenityBadge}>
            <Text style={styles.amenityText}>🛏️ {item.soNguoiToiDa || "-"} guests</Text>
          </View>
          <View style={styles.amenityBadge}>
            <Text style={styles.amenityText}>🏊 Pool</Text>
          </View>
        </View>

        {/* Price Section */}
        <View style={styles.priceSection}>
          <Text style={styles.priceLabel}>Giá/đêm:</Text>
          <Text style={styles.price}>
            ${Number(item.giaCoBanMotDem || 0).toLocaleString()}
          </Text>
        </View>

        {/* View Details Button */}
        <TouchableOpacity style={styles.detailButton}>
          <Text style={styles.detailButtonText}>Xem chi tiết</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Đang tải phòng...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadRooms}>
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Các phòng có sẵn</Text>
        <Text style={styles.subtitle}>{rooms.length} phòng</Text>
      </View>

      <FlatList
        data={rooms}
        renderItem={renderRoomCard}
        keyExtractor={(item) => item.idphong}
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
            <Text style={styles.emptyIcon}>🚫</Text>
            <Text style={styles.emptyText}>Không có phòng nào</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding * 1.5,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    ...SHADOWS.medium,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.secondary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.gray,
  },
  listContainer: {
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
    gap: SIZES.padding,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 8,
    ...SHADOWS.medium,
  },
  imageContainer: {
    position: "relative",
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#f0f0f0",
  },
  roomImage: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
  },
  imagePlaceholderText: {
    fontSize: 48,
  },
  statusBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#4CAF50",
  },
  statusText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "600",
  },
  content: {
    padding: SIZES.padding,
  },
  titleSection: {
    marginBottom: 12,
  },
  roomName: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.secondary,
    marginBottom: 4,
  },
  roomNumber: {
    fontSize: 12,
    color: COLORS.gray,
  },
  ratingSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  stars: {
    fontSize: 16,
    marginRight: 8,
  },
  ratingText: {
    fontSize: 13,
    color: COLORS.secondary,
    fontWeight: "600",
  },
  description: {
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 12,
    lineHeight: 16,
  },
  amenitiesSection: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  amenityBadge: {
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  amenityText: {
    fontSize: 11,
    color: COLORS.secondary,
    fontWeight: "500",
  },
  priceSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    marginBottom: 12,
  },
  priceLabel: {
    fontSize: 13,
    color: COLORS.gray,
    fontWeight: "500",
  },
  price: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.primary,
  },
  detailButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  detailButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "600",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.gray,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.secondary,
    textAlign: "center",
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: COLORS.white,
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.secondary,
    marginBottom: 6,
  },
});

export default RoomsScreen;
