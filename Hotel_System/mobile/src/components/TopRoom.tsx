import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { getPrimaryRoomImage } from "../utils/imageUtils";
import { COLORS, SIZES, FONTS, SHADOWS } from "../constants/theme";
import {
  TopRoom as TopRoomType,
  getTopRooms2025,
  getRooms,
} from "../api/roomsApi";
import { useNavigation } from "@react-navigation/native";

const { width, height } = Dimensions.get("window");

// Responsive calculations
const isSmallDevice = width < 375;
const isMediumDevice = width >= 375 && width < 414;
const isLargeDevice = width >= 414;

const CARD_WIDTH = isSmallDevice 
  ? width * 0.88 
  : isMediumDevice 
  ? width * 0.85 
  : width * 0.82;

const CARD_SPACING = isSmallDevice ? 12 : 16;
const IMAGE_HEIGHT = isSmallDevice ? 180 : isMediumDevice ? 200 : 220;

interface TopRoomProps {
  topCount?: number;
  onRoomPress?: (roomId: string) => void;
}

const TopRoom: React.FC<TopRoomProps> = ({ topCount = 5, onRoomPress }) => {
  // Extend the TopRoom type locally to include possible description fields
  type TopRoomWithDescription = TopRoomType & {
    moTa?: string; // Vietnamese field returned by `getRooms`/backend
    description?: string; // English/alternate field
    mota?: string; // other possible casing
  };

  const [topRooms, setTopRooms] = useState<TopRoomWithDescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigation = useNavigation();

  useEffect(() => {
    loadTopRooms();
  }, [topCount]);

  const getRandomRooms = (allRooms: any[], count: number) => {
    // Shuffle and pick random rooms
    const shuffled = [...allRooms].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map((r: any) => ({
      idPhong: r.idphong || r.idPhong,
      tenPhong: r.tenPhong,
      soLanSuDung: 0,
      tongDem: 0,
      urlAnhPhong: r.urlAnhPhong,
      // include description fields if present on fallback rooms
      moTa: r.moTa ?? r.MoTa ?? r.description ?? r.mota,
      giaCoBanMotDem: r.giaCoBanMotDem,
      xepHangSao: r.xepHangSao || 0,
      tenLoaiPhong: r.tenLoaiPhong,
    }));
  };

  const loadTopRooms = async () => {
    try {
      setLoading(true);
      setError(null);

      try {
        const topRoomsData = await getTopRooms2025(topCount);
        if (topRoomsData && topRoomsData.length > 0) {
          console.log(`✅ Loaded ${topRoomsData.length} top rooms`);
          setTopRooms(topRoomsData);
          return;
        }
      } catch (topErr) {
        console.warn(
          "⚠️ Failed to get top rooms, falling back to random rooms:",
          topErr
        );
      }

      // Fallback: lấy đại 5 phòng ngẫu nhiên nếu không có phòng top
      console.log("🎲 Lấy đại phòng ngẫu nhiên...");
      const allRooms = await getRooms();
      if (allRooms && allRooms.length > 0) {
        const randomRooms = getRandomRooms(allRooms, topCount);
        console.log(`✅ Loaded ${randomRooms.length} random rooms as fallback`);
        setTopRooms(randomRooms);
      } else {
        setError("Không có dữ liệu phòng");
        setTopRooms([]);
      }
    } catch (err: any) {
      console.error("❌ Error loading top rooms:", err);
      setError(err.message || "Không thể tải danh sách phòng");
      setTopRooms([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRoomPress = (roomId: string) => {
    if (onRoomPress) {
      onRoomPress(roomId);
    } else {
      // Navigate to room detail screen
      (navigation as any).navigate("RoomDetail", { roomId });
    }
  };

  const formatPrice = (price?: number) => {
    if (!price) return "Liên hệ";
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(price);
  };

  if (loading || error || topRooms.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Horizontal Scrolling Carousel */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH + CARD_SPACING}
        snapToAlignment="center"
      >
        {topRooms.map((room, index) => (
          <TouchableOpacity
            key={room.idPhong}
            style={[
              styles.card,
              index === 0 && styles.firstCard,
              index === topRooms.length - 1 && styles.lastCard,
            ]}
            onPress={() => handleRoomPress(room.idPhong)}
            activeOpacity={0.95}
          >
            {/* Room Image */}
            <Image
              source={{ uri: getPrimaryRoomImage(room) || "" }}
              style={[
                styles.cardImage,
                { height: IMAGE_HEIGHT }
              ]}
              contentFit="cover"
              transition={300}
            />

            {/* Room Info */}
            <View style={styles.cardContent}>
              {/* Category Badge */}
              {room.tenLoaiPhong && (
                <View
                  style={[
                    styles.categoryBadge,
                    getCategoryBadgeColor(room.tenLoaiPhong),
                  ]}
                >
                  <Text style={styles.categoryBadgeText}>
                    {room.tenLoaiPhong}
                  </Text>
                </View>
              )}

              {/* Room Name */}
              <Text style={styles.roomName} numberOfLines={2}>
                {room.tenPhong}
              </Text>

              {/* Description from backend (moTa / description) with safe fallback */}
              <Text style={styles.description} numberOfLines={3}>
                {room.moTa ??
                  room.description ??
                  room.mota ??
                  "Trải nghiệm sang trọng với đầy đủ tiện nghi hiện đại."}
              </Text>

              {/* Footer: Avatar + Rating + Date */}
              <View style={styles.footer}>
                <View style={styles.avatarContainer}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>#{index + 1}</Text>
                  </View>
                  <View style={styles.metaInfo}>
                    <Text style={styles.metaName}>Top Room</Text>
                    <Text style={styles.metaDate}>
                      {room.soLanSuDung} lượt đặt
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const getCategoryBadgeColor = (category: string) => {
  const lowerCategory = category.toLowerCase();
  if (lowerCategory.includes("vip") || lowerCategory.includes("deluxe")) {
    return styles.badgeAutomobile;
  } else if (
    lowerCategory.includes("standard") ||
    lowerCategory.includes("tiêu chuẩn")
  ) {
    return styles.badgeTechnology;
  }
  return styles.badgeFood;
};

const styles = StyleSheet.create({
  container: {
    // ensure spacing above and below top room section
    marginVertical: SIZES.margin,
    marginBottom: SIZES.padding * 2,
  },
  header: {
    paddingHorizontal: SIZES.padding,
    marginBottom: 12,
  },
  title: {
    ...FONTS.h2,
    color: COLORS.primary,
  },

  scrollContent: {
    paddingHorizontal: SIZES.base,
    paddingVertical: Platform.OS === 'ios' ? 4 : 2,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: COLORS.white,
    borderRadius: isSmallDevice ? 12 : 16,
    marginHorizontal: CARD_SPACING / 2,
    overflow: "hidden",
    marginBottom: SIZES.padding * 1.5,
    ...SHADOWS.medium,
    // Add elevation for Android
    elevation: Platform.OS === 'android' ? 8 : 0,
  },
  firstCard: {
    marginLeft: SIZES.padding,
  },
  lastCard: {
    marginRight: SIZES.padding,
  },
  cardImage: {
    width: "100%",
    backgroundColor: COLORS.lightGray,
    borderTopLeftRadius: isSmallDevice ? 12 : 16,
    borderTopRightRadius: isSmallDevice ? 12 : 16,
  },
  cardContent: {
    padding: isSmallDevice ? 12 : 16,
  },
  categoryBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: isSmallDevice ? 10 : 12,
    paddingVertical: isSmallDevice ? 5 : 6,
    borderRadius: isSmallDevice ? 12 : 16,
    marginBottom: isSmallDevice ? 8 : 12,
  },
  badgeTechnology: {
    backgroundColor: "#4A90E2",
  },
  badgeFood: {
    backgroundColor: "#F5A623",
  },
  badgeAutomobile: {
    backgroundColor: "#E94B3C",
  },
  categoryBadgeText: {
    color: COLORS.white,
    ...FONTS.body5,
    fontSize: isSmallDevice ? 11 : FONTS.body5.fontSize,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  roomName: {
    ...FONTS.h3,
    fontSize: isSmallDevice ? 16 : isMediumDevice ? 18 : FONTS.h3.fontSize,
    color: COLORS.secondary,
    marginBottom: isSmallDevice ? 6 : 8,
    fontWeight: "600",
  },
  description: {
    ...FONTS.body4,
    fontSize: isSmallDevice ? 13 : FONTS.body4.fontSize,
    color: COLORS.gray,
    lineHeight: isSmallDevice ? 18 : 20,
    marginBottom: isSmallDevice ? 12 : 16,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  avatarContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatar: {
    width: isSmallDevice ? 36 : 40,
    height: isSmallDevice ? 36 : 40,
    borderRadius: isSmallDevice ? 18 : 20,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: isSmallDevice ? 8 : 10,
  },
  avatarText: {
    color: COLORS.white,
    ...FONTS.body3,
    fontSize: isSmallDevice ? 13 : FONTS.body3.fontSize,
    fontWeight: "700",
  },
  metaInfo: {
    flex: 1,
  },
  metaName: {
    ...FONTS.body4,
    fontSize: isSmallDevice ? 13 : FONTS.body4.fontSize,
    color: COLORS.secondary,
    fontWeight: "600",
    marginBottom: 2,
  },
  metaDate: {
    ...FONTS.body5,
    fontSize: isSmallDevice ? 11 : FONTS.body5.fontSize,
    color: COLORS.gray,
  },
});

export default TopRoom;
