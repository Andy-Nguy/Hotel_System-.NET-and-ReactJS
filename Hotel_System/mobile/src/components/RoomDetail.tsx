import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Modal,
  Dimensions,
  TouchableOpacity,
  Platform,
  DeviceEventEmitter,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { getPrimaryRoomImage, getRoomImages } from "../utils/imageUtils";
import { Room, AvailableRoom } from "../api/roomsApi";
import { COLORS, SIZES } from "../constants/theme";
import reviewApi from "../api/reviewApi";
import { useEffect, useState } from "react";
import StarRating from "./StarRating";
import RoomReviews from "./RoomReviews";
import HeaderScreen from "./HeaderScreen";

interface Props {
  selectedRoom: Room | AvailableRoom | null;
  visible: boolean;
  onClose: () => void;
}

const RoomDetail: React.FC<Props> = ({ selectedRoom, visible, onClose }) => {
  // Ensure hooks run on every render (avoid early returns before hooks to satisfy Rules of Hooks)

  // Determine base price from whichever field is available (backend may return different schemas)
  const basePrice = Number(
    selectedRoom
      ? (selectedRoom as any).giaCoBanMotDem ??
          (selectedRoom as any).basePricePerNight ??
          (selectedRoom as any).giaCoBan ??
          0
      : 0
  );
  let discountPrice = basePrice;
  let hasDiscount = false;

  // Safely handle promotions and amenities even when selectedRoom is null
  const promotions = Array.isArray((selectedRoom as any)?.promotions)
    ? (selectedRoom as any)!.promotions
    : [];
  const amenities = Array.isArray((selectedRoom as any)?.amenities)
    ? (selectedRoom as any)!.amenities
    : [];
  if (promotions.length > 0) {
    const promo = promotions[0] as any;
    hasDiscount = true;
    if (promo.type === "percent" || promo.loaiGiamGia === "percent") {
      const percent = Number(promo.value ?? promo.giaTriGiam ?? 0);
      discountPrice = Math.round(basePrice * (1 - percent / 100));
    } else {
      const amount = Number(promo.value ?? promo.giaTriGiam ?? 0);
      discountPrice = Math.max(0, Math.round(basePrice - amount));
    }
  }

  const renderStars = (rating: number) => {
    const r = rating ?? 0;
    const fullStars = Math.floor(r);
    const hasHalfStar = r % 1 !== 0;
    const stars: string[] = [];
    for (let i = 0; i < 5; i++) {
      if (i < fullStars) stars.push("⭐");
      else if (i === fullStars && hasHalfStar) stars.push("⭐");
      else stars.push("☆");
    }
    return stars.join("");
  };

  // Use shared StarRating component imported above

  // Mobile review stats
  const [stats, setStats] = useState<any | null>(null);
  const [showReviews, setShowReviews] = useState(false);

  // Gallery index for multiple images
  const [galleryIndex, setGalleryIndex] = useState(0);

  useEffect(() => {
    // Reset gallery index whenever a different room is shown
    setGalleryIndex(0);
  }, [(selectedRoom as any)?.idphong, (selectedRoom as any)?.roomId]);

  // Derived display fields to support multiple API shapes
  const displayRoomType = selectedRoom
    ? (selectedRoom as any)?.tenLoaiPhong ||
      (selectedRoom as any)?.roomTypeName ||
      (selectedRoom as any)?.tenLoaiPhong ||
      null
    : null;

  const displayMaxOccupancy = selectedRoom
    ? (selectedRoom as any)?.soNguoiToiDa ??
      (selectedRoom as any)?.maxOccupancy ??
      (selectedRoom as any)?.maxGuests ??
      null
    : null;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const roomId = (selectedRoom as any)?.idphong || (selectedRoom as any)?.roomId;
      if (!roomId) return;
      try {
        const s = await reviewApi.getRoomStats(String(roomId));
        if (cancelled) return;
        setStats(s);
      } catch (err) {
        console.debug("RoomDetail: failed to load review stats", err);
      }
    };
    load();

    // Listen for review updates to refresh stats in real-time
    const subscription = DeviceEventEmitter.addListener(
      'reviewSubmitted',
      (data: { roomId: string }) => {
        const currentRoomId = String((selectedRoom as any)?.idphong || (selectedRoom as any)?.roomId || '');
        if (data.roomId === currentRoomId) {
          console.log(`[RoomDetail] Review submitted for room ${currentRoomId}, refreshing stats`);
          load();
        }
      }
    );

    return () => {
      cancelled = true;
      subscription.remove();
    };
    // keep dependency as id only so hook runs consistently
  }, [(selectedRoom as any)?.idphong, (selectedRoom as any)?.roomId]);

  const insets = useSafeAreaInsets();

  // If modal isn't visible or there is no selected room to show, render nothing
  if (!visible || !selectedRoom) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[
        styles.modalContainer, 
        { paddingTop: Platform.OS === 'ios' ? insets.top : 0 }
      ]}>
        <HeaderScreen title="Chi tiết phòng" onClose={onClose} />

        <ScrollView
          style={styles.modalContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.galleryContainer}>
            {getRoomImages(selectedRoom).length ? (
              <>
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={(ev) => {
                    const index = Math.round(
                      ev.nativeEvent.contentOffset.x /
                        ev.nativeEvent.layoutMeasurement.width
                    );
                    setGalleryIndex(index);
                  }}
                >
                  {getRoomImages(selectedRoom).map((item, idx) => (
                    <Image
                      key={`${item}_${idx}`}
                      source={{ uri: item }}
                      style={styles.modalImage}
                      contentFit="cover"
                    />
                  ))}
                </ScrollView>

                <View style={styles.imageDotsSmall}>
                  {getRoomImages(selectedRoom).map((_, i) => (
                    <View
                      key={`dot_small_${i}`}
                      style={[
                        styles.dotSmall,
                        i === galleryIndex && styles.dotSmallActive,
                      ]}
                    />
                  ))}
                </View>
              </>
            ) : (
              <Image
                source={{ uri: getPrimaryRoomImage(selectedRoom) || "" }}
                style={styles.modalImage}
                contentFit="cover"
              />
            )}
          </View>

          <View style={styles.detailsSection}>
            <Text style={styles.detailTitle}>
              {(selectedRoom as any)?.tenPhong ??
                (selectedRoom as any)?.roomTypeName ??
                (selectedRoom as any)?.tenLoaiPhong ??
                "Phòng"}
            </Text>
            <Text style={styles.detailSubtitle}>
              Phòng{" "}
              {(selectedRoom as any)?.soPhong ??
                (selectedRoom as any)?.roomNumber ??
                (selectedRoom as any)?.roomId ??
                "-"}
            </Text>

            <View style={styles.ratingRow}>
              {/* Use backend stats.averageRating when available, otherwise fallback to room.xepHangSao */}
              {(() => {
                const avg =
                  stats && typeof stats.averageRating === "number"
                    ? stats.averageRating
                    : (selectedRoom as any)?.xepHangSao || 0;
                return (
                  <>
                    <TouchableOpacity
                      onPress={() => setShowReviews(true)}
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      <StarRating avg={avg} size={18} />
                      <Text style={styles.ratingText}>
                        {avg.toFixed(1)}/5
                        {stats?.totalReviews != null
                          ? ` · ${stats.totalReviews} đánh giá`
                          : ""}
                      </Text>
                    </TouchableOpacity>
                  </>
                );
              })()}
            </View>

            {/* Room reviews modal (opens when tapping rating text) */}
            {showReviews && (
              <RoomReviews
                roomId={String((selectedRoom as any)?.idphong || (selectedRoom as any)?.roomId || "")}
                visible={showReviews}
                onClose={() => setShowReviews(false)}
              />
            )}

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Loại phòng:</Text>
              <Text style={styles.detailValue}>{displayRoomType ?? "N/A"}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Số người tối đa:</Text>
              <Text style={styles.detailValue}>
                {displayMaxOccupancy ? `${displayMaxOccupancy} người` : "N/A"}
              </Text>
            </View>

            <View style={styles.descriptionSection}>
              <Text style={styles.sectionLabel}>Mô tả</Text>
              <Text style={styles.descriptionText}>
                {(selectedRoom as any)?.moTa || (selectedRoom as any)?.description || "Không có mô tả"}
              </Text>
            </View>

            {amenities.length > 0 && (
              <View style={styles.amenitiesSection}>
                <Text style={styles.sectionLabel}>Tiện nghi</Text>
                <View style={styles.amenitiesList}>
                  {amenities.map((amenity: any) => (
                    <View key={amenity.id} style={styles.amenityItem}>
                      <Text style={styles.amenityBullet}>✓</Text>
                      <Text style={styles.amenityText}>{amenity.name}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {promotions.length > 0 && (
              <View style={styles.promotionSection}>
                <Text style={styles.sectionLabel}>Khuyến mãi</Text>
                {promotions.map((promo: any) => {
                  const p = promo as any;
                  return (
                  <View key={promo.id} style={styles.promotionItem}>
                    <Text style={styles.promotionName}>
                      {promo.name || p.tenKhuyenMai}
                    </Text>
                    {(promo.description || p.moTa) && (
                      <Text style={styles.promotionDesc}>
                        {promo.description || p.moTa}
                      </Text>
                    )}
                    <Text style={styles.promotionValue}>
                      {promo.type === "percent"
                        ? `Giảm ${promo.value ?? p.giaTriGiam}%`
                        : `Giảm ${Number(
                            promo.value ?? p.giaTriGiam
                          ).toLocaleString()} VND`}
                    </Text>
                  </View>
                )})}
              </View>
            )}

            <View style={styles.priceSection}>
              <View>
                <Text style={styles.priceLabel}>Giá mỗi đêm</Text>
                {hasDiscount && (
                  <Text style={styles.originalPrice}>
                    {(selectedRoom as any)?.giaCoBanMotDem != null
                      ? Number((selectedRoom as any).giaCoBanMotDem).toLocaleString()
                      : (selectedRoom as any)?.basePricePerNight != null
                      ? Number((selectedRoom as any).basePricePerNight).toLocaleString()
                      : ""}{" "}
                    VND
                  </Text>
                )}
              </View>
              <Text style={[styles.priceValue, { color: COLORS.primary }]}>
                {Number(discountPrice).toLocaleString()} VND
              </Text>
            </View>

            <View style={{ height: SIZES.padding * 2 }} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.white,
  },

  modalContent: { flex: 1, backgroundColor: COLORS.white },
  modalImage: { width: Dimensions.get("window").width, height: 250 },
  galleryContainer: { width: "100%", height: 250, backgroundColor: "#F8F9FA" },
  imageDotsSmall: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 8,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  dotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.7)",
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
  },
  dotSmallActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
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
  detailSubtitle: { fontSize: 14, color: COLORS.gray, marginBottom: 12 },
  ratingRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  stars: { fontSize: 18, marginRight: 8 },
  ratingText: { fontSize: 14, color: COLORS.secondary, fontWeight: "600" },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  detailLabel: { fontSize: 13, color: COLORS.gray, fontWeight: "500" },
  detailValue: { fontSize: 13, color: COLORS.secondary, fontWeight: "600" },
  descriptionSection: { marginTop: 16, marginBottom: 16 },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.secondary,
    marginBottom: 8,
  },
  descriptionText: { fontSize: 13, color: COLORS.gray, lineHeight: 20 },
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
  priceLabel: { fontSize: 13, color: COLORS.gray, fontWeight: "500" },
  originalPrice: {
    fontSize: 14,
    color: COLORS.gray,
    fontWeight: "500",
    textDecorationLine: "line-through",
    marginBottom: 4,
  },
  priceValue: { fontSize: 24, fontWeight: "700", color: COLORS.primary },
  amenitiesSection: {
    marginTop: 16,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  amenitiesList: { gap: 12 },
  amenityItem: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
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
  promotionValue: { fontSize: 13, fontWeight: "700", color: "#FF6B6B" },
  bookButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 16,
  },
  bookButtonText: { color: COLORS.white, fontSize: 16, fontWeight: "700" },
});

export default RoomDetail;
