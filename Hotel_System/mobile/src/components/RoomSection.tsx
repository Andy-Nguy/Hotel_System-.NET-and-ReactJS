import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  DeviceEventEmitter,
} from "react-native";
import { Image } from "expo-image";
import { MaterialIcons } from "@expo/vector-icons";
import { getRoomImages } from "../utils/imageUtils";
import reviewApi from "../api/reviewApi";
import StarRating from "./StarRating";
import AppIcon from "./AppIcon";
import { COLORS, SIZES, SHADOWS } from "../constants/theme";
import { Room } from "../api/roomsApi";

interface RoomSectionProps {
  room: Room;
  onPress: () => void;
}

const RoomSection: React.FC<RoomSectionProps> = ({ room, onPress }) => {
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const handleImageScroll = (event: any) => {
    const index = Math.round(
      event.nativeEvent.contentOffset.x /
        event.nativeEvent.layoutMeasurement.width
    );
    setActiveImageIndex(index);
  };

  // Price calculation: determine promotional price when promotions exist
  const basePrice = Number(room.giaCoBanMotDem) || 0;
  const promotion =
    room.promotions && room.promotions.length > 0 ? room.promotions[0] : null;
  const getPromoPrice = () => {
    if (!promotion) return basePrice;
    if (promotion.type === "percent") {
      const pct = Number(promotion.value) || 0;
      return Math.round(basePrice * (1 - pct / 100));
    }
    const val = Number(promotion.value) || 0;
    return Math.max(0, basePrice - val);
  };
  const displayPrice = getPromoPrice();
  const hasPromotion = !!promotion && displayPrice !== basePrice;

  // use shared StarRating component (imports above)

  const [stats, setStats] = useState<any | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Load stats function - always fetch fresh data
  const loadStats = async () => {
    const key = String(room.idphong);
    setLoadingStats(true);
    try {
      const s = await reviewApi.getRoomStats(key);
      if (s) {
        console.log(`[RoomSection] Stats loaded for roomId=${key}:`, s);
        setStats(s);
      }
    } catch (err) {
      console.debug("RoomSection: failed to load stats", err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    loadStats();

    // Listen for review updates to refresh stats in real-time
    const subscription = DeviceEventEmitter.addListener(
      'reviewSubmitted',
      (data: { roomId: string }) => {
        if (data.roomId === String(room.idphong)) {
          console.log(`[RoomSection] Review submitted for room ${room.idphong}, refreshing stats`);
          loadStats();
        }
      }
    );

    return () => {
      subscription.remove();
    };
  }, [room.idphong]);

  // Format promotion label based on type: percent -> "-10%", amount -> "- 1.000.000 VND"
  const promoLabel = (() => {
    if (!promotion) return null;
    const val = Number(promotion.value ?? 0);
    if (
      promotion.type === "percent" ||
      String(promotion.type).toLowerCase() === "percent"
    ) {
      return `-${val}%`;
    }
    // treat other types (amount) as currency VND
    return `- ${val.toLocaleString("vi-VN")} VND`;
  })();

  const images = getRoomImages(room);

  return (
    <TouchableOpacity
      style={styles.roomCard}
      onPress={onPress}
      activeOpacity={0.9}
    >
      {/* Image Container */}
      <View style={styles.imageContainer}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onMomentumScrollEnd={handleImageScroll}
        >
          {images.length > 0 ? (
            images.map((img, idx) => (
              <Image
                key={idx}
                source={{ uri: img }}
                style={styles.carouselImage}
                contentFit="cover"
              />
            ))
          ) : (
            <View style={styles.imagePlaceholder}>
              <AppIcon name="image" size={40} color={COLORS.gray} />
            </View>
          )}
        </ScrollView>

        {/* Image Indicators */}
        {images.length > 1 && (
          <View style={styles.indicatorContainer}>
            {images.map((_, idx) => (
              <View
                key={idx}
                style={[
                  styles.indicator,
                  activeImageIndex === idx && styles.indicatorActive,
                ]}
              />
            ))}
          </View>
        )}

        {/* Promotion Badge */}
        {hasPromotion && promotion && (
          <View style={styles.badgeContainer}>
            <View style={styles.promoBadge}>
              <AppIcon name="tag" size={12} color={COLORS.white} />
              <Text style={styles.promoText}>{promoLabel}</Text>
            </View>
          </View>
        )}

        <View style={styles.imageOverlay} />
      </View>

      {/* Room Info */}
      <View style={styles.roomInfo}>
        <View style={styles.headerRow}>
          <View style={styles.titleContainer}>
            <Text style={styles.roomTitle} numberOfLines={1}>
              {room.tenPhong}
            </Text>
            <Text style={styles.roomNumber}>Phòng {room.soPhong}</Text>
          </View>
          
          {(() => {
            const avg =
              stats && typeof stats.averageRating === "number"
                ? stats.averageRating
                : room.xepHangSao ?? 0;
            if (avg > 0) {
              return (
                <View style={styles.ratingContainer}>
                  <AppIcon name="star" size={14} color="#FFD700" />
                  <Text style={styles.ratingText}>{avg.toFixed(1)}</Text>
                </View>
              );
            }
            return null;
          })()}
        </View>

        {room.moTa && (
          <Text style={styles.roomDescription} numberOfLines={2}>
            {room.moTa}
          </Text>
        )}

        <View style={styles.divider} />

        {/* Price Section */}
        <View style={styles.footer}>
          <View style={styles.priceWrapper}>
            {hasPromotion ? (
              <View style={styles.priceContainer}>
                <View style={styles.discountTag}>
                  <Text style={styles.discountText}>
                    -
                    {Math.round(
                      (1 - displayPrice / (basePrice || 1)) * 100
                    )}
                    %
                  </Text>
                </View>
                <View>
                  <Text style={styles.originalPrice}>
                    {basePrice.toLocaleString()}đ
                  </Text>
                  <View style={styles.priceRow}>
                    <Text style={styles.finalPrice}>
                      {displayPrice.toLocaleString()}đ
                    </Text>
                    <Text style={styles.perNight}>/đêm</Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.priceRow}>
                <Text style={styles.finalPrice}>
                  {displayPrice.toLocaleString()}đ
                </Text>
                <Text style={styles.perNight}>/đêm</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  roomCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    marginBottom: 20,
    ...SHADOWS.medium,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    overflow: "visible",
  },
  imageContainer: {
    height: 220,
    width: "100%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#F0F0F0",
  },
  carouselImage: {
    width: Dimensions.get("window").width - SIZES.padding * 2,
    height: 220,
  },
  imagePlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#E0E0E0",
  },
  imageOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: "transparent",
  },
  indicatorContainer: {
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
  },
  indicatorActive: {
    backgroundColor: "#ffffff",
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  badgeContainer: {
    position: "absolute",
    top: 16,
    left: 16,
    flexDirection: "row",
    gap: 8,
  },
  promoBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF4757",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  promoText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "700",
  },
  roomInfo: {
    padding: 20,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  titleContainer: {
    flex: 1,
    marginRight: 12,
  },
  roomTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.secondary,
    marginBottom: 4,
  },
  roomNumber: {
    fontSize: 13,
    color: COLORS.gray,
    fontWeight: "500",
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF9F2",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.secondary,
  },
  roomDescription: {
    fontSize: 14,
    color: COLORS.gray,
    lineHeight: 20,
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: "#F1F3F5",
    marginBottom: 16,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priceWrapper: {
    flex: 1,
  },
  priceContainer: {
    alignItems: "flex-start",
  },
  discountTag: {
    backgroundColor: "#FFE3E3",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  discountText: {
    color: "#FF4757",
    fontSize: 11,
    fontWeight: "700",
  },
  originalPrice: {
    fontSize: 13,
    color: COLORS.gray,
    textDecorationLine: "line-through",
    marginBottom: 2,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  finalPrice: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.primary,
  },
  perNight: {
    fontSize: 13,
    color: COLORS.gray,
    marginLeft: 4,
  },
});

export default RoomSection;
