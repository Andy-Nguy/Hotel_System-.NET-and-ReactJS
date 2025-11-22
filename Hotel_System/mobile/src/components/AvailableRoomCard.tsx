import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Image } from "expo-image";
import AppIcon from "./AppIcon";
import { COLORS, SIZES, FONTS, SHADOWS } from "../constants/theme";
import { AvailableRoom } from "../api/roomsApi";
import { getPromotions } from "../api/promotionApi";

type Props = {
  room: AvailableRoom;
  onOpenDetail?: (room: AvailableRoom) => void;
  onSelect?: (room: AvailableRoom) => void;
};

const AvailableRoomCard: React.FC<Props> = ({
  room,
  onOpenDetail,
  onSelect,
}) => {
  const [promotion, setPromotion] = useState<any>(null);
  const [discountedPrice, setDiscountedPrice] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const promos = await getPromotions();
        if (cancelled) return;
        const found = promos.find(
          (p) =>
            Array.isArray(p.khuyenMaiPhongs) &&
            p.khuyenMaiPhongs.some(
              (r: any) => String(r.idphong) === String(room.roomId)
            )
        );
        if (found) {
          setPromotion(found);
          // calculate discounted price quick
          if (found.loaiGiamGia === "percent") {
            const p = Number(found.giaTriGiam || 0);
            setDiscountedPrice(
              Math.round((room.basePricePerNight || 0) * (1 - p / 100))
            );
          } else {
            const v = Number(found.giaTriGiam || 0);
            setDiscountedPrice(Math.max(0, (room.basePricePerNight || 0) - v));
          }
        }
      } catch (e) {
        // ignore
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [room.roomId]);

  const priceText = () => {
    if (
      discountedPrice &&
      discountedPrice > 0 &&
      discountedPrice < (room.basePricePerNight || 0)
    ) {
      return (
        <View style={styles.priceContainer}>
          <View style={styles.discountTag}>
            <Text style={styles.discountText}>
              -{Math.round((1 - discountedPrice / (room.basePricePerNight || 1)) * 100)}%
            </Text>
          </View>
          <View>
            <Text style={styles.originalPrice}>
              {(room.basePricePerNight || 0).toLocaleString()}đ
            </Text>
            <View style={styles.priceRow}>
              <Text style={styles.finalPrice}>
                {discountedPrice.toLocaleString()}đ
              </Text>
              <Text style={styles.perNight}>/đêm</Text>
            </View>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.priceRow}>
        <Text style={styles.finalPrice}>
          {(room.basePricePerNight || 0).toLocaleString()}đ
        </Text>
        <Text style={styles.perNight}>/đêm</Text>
      </View>
    );
  };

  return (
    <View style={styles.card}>
      <TouchableOpacity 
        activeOpacity={0.9} 
        onPress={() => onOpenDetail?.(room)}
        style={styles.imageContainer}
      >
        {room.roomImageUrl ? (
          <Image
            source={{ uri: room.roomImageUrl }}
            style={styles.image}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <AppIcon name="image" size={40} color={COLORS.gray} />
          </View>
        )}

        {promotion && (
          <View style={styles.badgeContainer}>
            <View style={styles.promoBadge}>
              <AppIcon name="tag" size={12} color={COLORS.white} />
              <Text style={styles.promoText}>
                {promotion.tenKhuyenMai || "Ưu đãi"}
              </Text>
            </View>
          </View>
        )}
        
        <View style={styles.imageOverlay} />
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.titleContainer}>
            <Text style={styles.roomType} numberOfLines={1}>
              {room.roomTypeName || "Phòng tiêu chuẩn"}
            </Text>
            <Text style={styles.roomNumber}>Phòng {room.roomNumber}</Text>
          </View>
          <View style={styles.ratingContainer}>
            <AppIcon name="star" size={14} color="#FFD700" />
            <Text style={styles.ratingText}>4.5</Text>
          </View>
        </View>

        {room.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {room.description}
          </Text>
        ) : null}

        <View style={styles.divider} />

        <View style={styles.footer}>
          <View style={styles.priceWrapper}>
            {priceText()}
          </View>

          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => onSelect?.(room)}
          >
            <Text style={styles.selectButtonText}>Chọn</Text>
            <AppIcon name="arrow-right" size={16} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    marginBottom: 20,
    ...SHADOWS.medium,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    overflow: 'visible', // Allow shadows to show
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
  image: {
    width: "100%",
    height: "100%",
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
    // gradient effect simulated with background color opacity if needed, 
    // but react-native doesn't support linear-gradient without a library.
    // We'll just leave it transparent or use a slight dark tint if needed.
    backgroundColor: 'transparent', 
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
  content: {
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
  roomType: {
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
  description: {
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
  selectButton: {
    backgroundColor: COLORS.secondary,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
    gap: 8,
  },
  selectButtonText: {
    color: COLORS.white,
    fontWeight: "700",
    fontSize: 14,
  },
});

export default AvailableRoomCard;
