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

  // Simple in-memory cache to avoid refetching stats for the same room repeatedly
  const statsCache = ((global as any).__roomStatsCache ||= new Map<
    string,
    any
  >());
  const [stats, setStats] = useState<any | null>(
    () => statsCache.get(String(room.idphong)) ?? null
  );
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const key = String(room.idphong);
      const cached = statsCache.get(key);
      if (cached) {
        setStats(cached);
        return;
      }
      setLoadingStats(true);
      try {
        const s = await reviewApi.getRoomStats(key);
        if (cancelled) return;
        if (s) {
          statsCache.set(key, s);
          console.log(`[RoomSection] Stats loaded for roomId=${key}:`, s);
          setStats(s);
        }
      } catch (err) {
        console.debug("RoomSection: failed to load stats", err);
      } finally {
        if (!cancelled) setLoadingStats(false);
      }
    };
    load();
    return () => {
      cancelled = true;
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
      activeOpacity={0.8}
    >
      {/* Image Carousel */}
      <View style={styles.carouselContainer}>
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
            <View
              style={[
                styles.carouselImage,
                { justifyContent: "center", alignItems: "center" },
              ]}
            >
              <Text>Không có ảnh</Text>
            </View>
          )}
        </ScrollView>

        {/* Image Indicators */}
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

        {/* Promotion Badge */}
        {room.promotions && room.promotions.length > 0 && (
          <View style={styles.promotionBadge}>
            <Text style={styles.promotionBadgeText}>{promoLabel}</Text>
          </View>
        )}
      </View>

      {/* Room Info */}
      <View style={styles.roomInfo}>
        <Text style={styles.roomTitle} numberOfLines={2}>
          {room.tenPhong}
        </Text>

        <View style={styles.ratingRow}>
          {(() => {
            const avg =
              stats && typeof stats.averageRating === "number"
                ? stats.averageRating
                : room.xepHangSao ?? 0;
            return (
              <>
                <StarRating avg={avg} size={14} />
                <Text style={styles.ratingCount}>
                  {stats?.totalReviews != null
                    ? `${avg.toFixed(1)}/5 · ${stats.totalReviews} đánh giá`
                    : room.xepHangSao != null
                    ? `${room.xepHangSao.toFixed(1)}/5`
                    : "(chưa có đánh giá)"}
                </Text>
              </>
            );
          })()}
        </View>

        <Text style={styles.roomDescription} numberOfLines={2}>
          {room.moTa || "Phòng tiêu chuẩn với đầy đủ tiện ích"}
        </Text>

        {/* Price & CTA */}
        <View style={styles.priceRow}>
          <View
            style={
              hasPromotion ? styles.priceInfoPromoContainer : styles.priceInfo
            }
          >
            <Text style={styles.priceLabel}>Từ</Text>

            {hasPromotion ? (
              <View style={styles.promoStack}>
                <Text style={styles.originalPrice}>
                  {basePrice.toLocaleString()} VND
                </Text>
                <View style={styles.promoRow}>
                  <Text style={styles.promoPrice}>
                    {displayPrice.toLocaleString()} VND
                  </Text>
                  <Text style={styles.priceUnit}>/ đêm</Text>
                </View>
              </View>
            ) : (
              <View style={styles.priceInfoRow}>
                <Text style={styles.price}>
                  {displayPrice.toLocaleString()} VND
                </Text>
                <Text style={styles.priceUnit}>/ đêm</Text>
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
    borderRadius: 12,
    overflow: "hidden",
    // increase spacing between room cards for more even layout
    marginBottom: SIZES.padding * 1.5,
    ...SHADOWS.medium,
  },
  carouselContainer: {
    position: "relative",
    width: "100%",
    height: 200,
    backgroundColor: "#f0f0f0",
  },
  carouselImage: {
    width: Dimensions.get("window").width - SIZES.padding * 2,
    height: 200,
  },
  indicatorContainer: {
    position: "absolute",
    bottom: 10,
    left: "50%",
    transform: [{ translateX: -10 }],
    flexDirection: "row",
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
  },
  promotionBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "#FF6B6B",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  promotionBadgeText: {
    color: COLORS.white,
    fontWeight: "700",
    fontSize: 12,
  },
  roomInfo: {
    padding: SIZES.padding,
  },
  roomTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.secondary,
    marginBottom: 8,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 6,
  },
  stars: {
    fontSize: 14,
  },
  ratingCount: {
    fontSize: 12,
    color: "#888",
  },
  roomDescription: {
    fontSize: 13,
    color: "#666",
    lineHeight: 18,
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priceLabel: {
    fontSize: 11,
    color: "#999",
    marginRight: 6,
  },
  price: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.primary,
  },
  priceUnit: {
    fontSize: 11,
    color: "#999",
  },
  originalPrice: {
    fontSize: 12,
    color: "#999",
    textDecorationLine: "line-through",
    marginLeft: 0,
    alignSelf: "flex-start",
  },
  priceInfo: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  priceInfoRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  priceInfoPromoContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  promoStack: {
    flexDirection: "column",
    marginLeft: 6,
  },
  promoRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  promoPrice: {
    fontSize: 18,
    fontWeight: "800",
    color: "#E53935",
  },
  ctaButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  ctaButtonText: {
    color: COLORS.white,
    fontWeight: "700",
    fontSize: 13,
  },
});

export default RoomSection;
