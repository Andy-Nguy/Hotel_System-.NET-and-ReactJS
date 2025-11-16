import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  Modal,
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { getRooms, Room } from "../api/roomsApi";
import { COLORS, SIZES, FONTS, SHADOWS } from "../constants/theme";
import RoomDetail from "../components/RoomDetail";

interface RoomType {
  loaiPhong: string;
  tenLoaiPhong: string;
  moTa?: string;
  rooms: Room[];
}

const RoomsScreen: React.FC = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [showDetails, setShowDetails] = useState(false);

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

      // Group rooms by type
      const grouped = new Map<string, RoomType>();
      (Array.isArray(data) ? data : []).forEach((room: Room) => {
        const key = room.idloaiPhong || "Unknown";
        if (!grouped.has(key)) {
          grouped.set(key, {
            loaiPhong: room.idloaiPhong || "Unknown",
            tenLoaiPhong: room.tenLoaiPhong || "Unknown Room Type",
            moTa: room.moTa, // Use room description if available
            rooms: [],
          });
        }
        grouped.get(key)!.rooms.push(room);
      });

      setRoomTypes(Array.from(grouped.values()));
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

  const renderRoomCard = (room: Room) => (
    <TouchableOpacity
      key={room.idphong}
      style={styles.roomCard}
      onPress={() => {
        setSelectedRoom(room);
        setShowDetails(true);
      }}
    >
      <View style={styles.roomCardImageContainer}>
        <Image
          source={{ uri: room.urlAnhPhong }}
          style={styles.roomCardImage}
          contentFit="cover"
        />
        {/* Promotion badge */}
        {room.promotions && room.promotions.length > 0 && (
          <View style={styles.promotionBadge}>
            <Text style={styles.promotionBadgeText}>
              {room.promotions[0].type === 'percent' 
                ? `-${room.promotions[0].value}%` 
                : `- ${room.promotions[0].value}`}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.roomCardContent}>
        <Text style={styles.roomCardTitle} numberOfLines={1}>
          {room.tenPhong}
        </Text>
        <Text style={styles.roomCardPrice}>
          {Number(room.giaCoBanMotDem).toLocaleString()} VND
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderRoomType = ({ item }: { item: RoomType }) => (
    <View key={item.loaiPhong} style={styles.roomTypeSection}>
      <View style={styles.roomTypeHeader}>
        <View>
          <Text style={styles.roomTypeName}>{item.tenLoaiPhong}</Text>
          {item.moTa && (
            <Text style={styles.roomTypeDesc} numberOfLines={1}>
              {item.moTa}
            </Text>
          )}
        </View>
        <Text style={styles.roomCount}>{item.rooms.length}</Text>
      </View>
      
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        style={styles.roomScroll}
        contentContainerStyle={styles.roomScrollContent}
      >
        {item.rooms.map((room) => renderRoomCard(room))}
      </ScrollView>
    </View>
  );

  // Room detail modal is extracted into `RoomDetail.tsx`

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
      <View style={styles.modalHeader}>
        <View style={{ width: 30 }} />
        <View style={styles.headerCenter}>
          <Text style={styles.modalTitle}>Các phòng có sẵn</Text>
          <Text style={styles.subtitle}>
            {roomTypes.reduce((sum, rt) => sum + rt.rooms.length, 0)} phòng
          </Text>
        </View>
        <View style={{ width: 30 }} />
      </View>

      <FlatList
        data={roomTypes}
        renderItem={renderRoomType}
        keyExtractor={(item) => item.loaiPhong}
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

      <RoomDetail
        selectedRoom={selectedRoom}
        visible={showDetails}
        onClose={() => setShowDetails(false)}
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
    paddingVertical: SIZES.padding,
  },
  // Room Type Section Styles
  roomTypeSection: {
    marginBottom: SIZES.padding * 2,
  },
  roomTypeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SIZES.padding,
    marginBottom: SIZES.padding,
  },
  roomTypeName: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.secondary,
    marginBottom: 4,
  },
  roomTypeDesc: {
    fontSize: 12,
    color: COLORS.gray,
  },
  roomCount: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primary,
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  roomScroll: {
    paddingHorizontal: SIZES.padding,
  },
  roomScrollContent: {
    gap: SIZES.padding,
  },
  // Room Card Styles (for horizontal scroll)
  roomCard: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: COLORS.white,
    width: 140,
    ...SHADOWS.medium,
  },
  roomCardImageContainer: {
    position: "relative",
    width: "100%",
    height: 100,
  },
  roomCardImage: {
    width: "100%",
    height: 100,
  },
  promotionBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#FF6B6B",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  promotionBadgeText: {
    color: COLORS.white,
    fontWeight: "700",
    fontSize: 12,
  },
  roomCardContent: {
    padding: 10,
  },
  roomCardTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.secondary,
    marginBottom: 6,
  },
  roomCardPrice: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primary,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  closeButton: {
    fontSize: 24,
    color: COLORS.secondary,
    fontWeight: "600",
    width: 30,
    textAlign: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.secondary,
  },
  headerCenter: {
    alignItems: "center",
  },
  modalContent: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  modalImage: {
    width: Dimensions.get("window").width,
    height: 250,
  },
  detailsSection: {
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
  },
  detailTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.secondary,
    marginBottom: 4,
  },
  detailSubtitle: {
    fontSize: 14,
    color: COLORS.gray,
    marginBottom: 12,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  stars: {
    fontSize: 18,
    marginRight: 8,
  },
  ratingText: {
    fontSize: 14,
    color: COLORS.secondary,
    fontWeight: "600",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  detailLabel: {
    fontSize: 13,
    color: COLORS.gray,
    fontWeight: "500",
  },
  detailValue: {
    fontSize: 13,
    color: COLORS.secondary,
    fontWeight: "600",
  },
  descriptionSection: {
    marginTop: 16,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.secondary,
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 13,
    color: COLORS.gray,
    lineHeight: 20,
  },
  priceSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    marginBottom: 16,
  },
  priceLabel: {
    fontSize: 13,
    color: COLORS.gray,
    fontWeight: "500",
  },
  originalPrice: {
    fontSize: 14,
    color: COLORS.gray,
    fontWeight: "500",
    textDecorationLine: "line-through",
    marginBottom: 4,
  },
  priceValue: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.primary,
  },
  // Amenities Styles
  amenitiesSection: {
    marginTop: 16,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  amenitiesList: {
    gap: 12,
  },
  amenityItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  amenityBullet: {
    fontSize: 16,
    color: "#4CAF50",
    fontWeight: "700",
    marginTop: 2,
  },
  amenityText: {
    fontSize: 13,
    color: COLORS.secondary,
    flex: 1,
    lineHeight: 18,
  },
  // Promotions Styles
  promotionSection: {
    marginTop: 16,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  promotionItem: {
    backgroundColor: "#FFF3E0",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: "#FF6B6B",
  },
  promotionName: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.secondary,
    marginBottom: 4,
  },
  promotionDesc: {
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 8,
    lineHeight: 16,
  },
  promotionValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FF6B6B",
  },
  bookButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 16,
  },
  bookButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "700",
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
