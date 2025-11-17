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
        <>
          <Text style={styles.originalPrice}>
            {(room.basePricePerNight || 0).toLocaleString()}đ
          </Text>
          <View style={styles.promoRow}>
            <Text style={styles.promoPrice}>
              {discountedPrice.toLocaleString()}đ
            </Text>
            <Text style={styles.priceUnit}> / đêm</Text>
          </View>
        </>
      );
    }

    return (
      <View style={styles.priceInfoRow}>
        <Text style={styles.price}>
          {(room.basePricePerNight || 0).toLocaleString()}đ
        </Text>
        <Text style={styles.priceUnit}> / đêm</Text>
      </View>
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.imageContainer}>
        {room.roomImageUrl ? (
          <Image
            source={{ uri: room.roomImageUrl }}
            style={styles.image}
            contentFit="cover"
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text>🏨</Text>
          </View>
        )}

        {promotion && (
          <View style={styles.promotionBadge}>
            <Text style={styles.promoText}>
              {promotion.tenKhuyenMai || "KM"}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {room.roomTypeName || "Phòng"}
        </Text>
        <Text style={styles.roomNumber}>Phòng {room.roomNumber}</Text>

        <Text style={styles.description} numberOfLines={2}>
          {room.description || ""}
        </Text>

        <View style={styles.priceSection}>
          <Text style={styles.priceLabel}>Giá/đêm</Text>
          {priceText()}
        </View>

        <View style={styles.ctaRow}>
          <TouchableOpacity
            style={styles.primaryCta}
            onPress={() => onSelect?.(room)}
          >
            <AppIcon name="check" size={14} color={COLORS.white} />
            <Text style={styles.primaryCtaText}>Chọn phòng</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryCta}
            onPress={() => onOpenDetail?.(room)}
          >
            <Text style={styles.secondaryCtaText}>Xem chi tiết</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: SIZES.padding,
    ...SHADOWS.medium,
  },
  imageContainer: {
    position: "relative",
    width: "100%",
    height: 200,
    backgroundColor: "#eee",
  },
  image: { width: "100%", height: "100%" },
  imagePlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  promotionBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "#FF6B6B",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  promoText: { color: COLORS.white, fontWeight: "700" },
  content: { padding: SIZES.padding },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.secondary,
    marginBottom: 6,
  },
  roomNumber: { fontSize: 12, color: COLORS.gray },
  description: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 6,
    marginBottom: 6,
  },
  priceSection: { marginTop: 8, marginBottom: 12 },
  priceLabel: { fontSize: 11, color: "#999", marginBottom: 2 },
  originalPrice: {
    fontSize: 12,
    color: "#999",
    textDecorationLine: "line-through",
  },
  promoRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  promoPrice: { fontSize: 18, fontWeight: "800", color: "#E53935" },
  priceInfoRow: { flexDirection: "row", alignItems: "baseline" },
  price: { fontSize: 18, fontWeight: "700", color: COLORS.primary },
  priceUnit: { fontSize: 12, color: "#999", marginLeft: 6 },
  ctaRow: { flexDirection: "row", gap: 8 },
  primaryCta: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  primaryCtaText: { color: COLORS.white, fontWeight: "700", marginLeft: 8 },
  secondaryCta: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },
  secondaryCtaText: { color: COLORS.secondary, fontWeight: "700" },
});

export default AvailableRoomCard;
