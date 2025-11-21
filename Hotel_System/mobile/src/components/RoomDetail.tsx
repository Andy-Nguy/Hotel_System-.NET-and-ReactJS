import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Modal,
  Dimensions,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { Image } from "expo-image";
import { Room } from "../api/roomsApi";
import { COLORS, SIZES } from "../constants/theme";
import reviewApi from "../api/reviewApi";
import { useEffect, useState } from "react";
import StarRating from './StarRating';
import RoomReviews from './RoomReviews';

interface Props {
  selectedRoom: Room | null;
  visible: boolean;
  onClose: () => void;
}

const RoomDetail: React.FC<Props> = ({ selectedRoom, visible, onClose }) => {
  if (!selectedRoom) return null;

  let discountPrice = selectedRoom.giaCoBanMotDem;
  let hasDiscount = false;

  if (selectedRoom.promotions && selectedRoom.promotions.length > 0) {
    const promo = selectedRoom.promotions[0];
    hasDiscount = true;
    if (promo.type === "percent") {
      discountPrice = selectedRoom.giaCoBanMotDem * (1 - promo.value / 100);
    } else {
      discountPrice = selectedRoom.giaCoBanMotDem - promo.value;
    }
  }

  const renderStars = (rating: number) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
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

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!selectedRoom?.idphong) return;
      try {
        const s = await reviewApi.getRoomStats(String(selectedRoom.idphong));
        if (cancelled) return;
        setStats(s);
      } catch (err) {
        console.debug('RoomDetail: failed to load review stats', err);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [selectedRoom?.idphong]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Chi tiết phòng</Text>
          <View style={{ width: 30 }} />
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          <Image
            source={{ uri: selectedRoom.urlAnhPhong }}
            style={styles.modalImage}
            contentFit="cover"
          />

          <View style={styles.detailsSection}>
            <Text style={styles.detailTitle}>{selectedRoom.tenPhong}</Text>
            <Text style={styles.detailSubtitle}>Phòng {selectedRoom.soPhong}</Text>

            <View style={styles.ratingRow}>
              {/* Use backend stats.averageRating when available, otherwise fallback to room.xepHangSao */}
              {(() => {
                const avg = (stats && typeof stats.averageRating === 'number') ? stats.averageRating : (selectedRoom.xepHangSao || 0);
                return (
                  <>
                        <TouchableOpacity onPress={() => setShowReviews(true)} style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <StarRating avg={avg} size={18} />
                          <Text style={styles.ratingText}>
                            {avg.toFixed(1)}/5{stats?.totalReviews != null ? ` · ${stats.totalReviews} đánh giá` : ''}
                          </Text>
                        </TouchableOpacity>
                  </>
                );
              })()}
            </View>

            {/* Room reviews modal (opens when tapping rating text) */}
            {showReviews && (
              <RoomReviews roomId={String(selectedRoom.idphong)} visible={showReviews} onClose={() => setShowReviews(false)} />
            )}

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Loại phòng:</Text>
              <Text style={styles.detailValue}>{selectedRoom.tenLoaiPhong || "N/A"}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Số người tối đa:</Text>
              <Text style={styles.detailValue}>{selectedRoom.soNguoiToiDa} người</Text>
            </View>



            <View style={styles.descriptionSection}>
              <Text style={styles.sectionLabel}>Mô tả</Text>
              <Text style={styles.descriptionText}>{selectedRoom.moTa || "Không có mô tả"}</Text>
            </View>

            {selectedRoom.amenities && selectedRoom.amenities.length > 0 && (
              <View style={styles.amenitiesSection}>
                <Text style={styles.sectionLabel}>Tiện nghi</Text>
                <View style={styles.amenitiesList}>
                  {selectedRoom.amenities.map((amenity) => (
                    <View key={amenity.id} style={styles.amenityItem}>
                      <Text style={styles.amenityBullet}>✓</Text>
                      <Text style={styles.amenityText}>{amenity.name}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {selectedRoom.promotions && selectedRoom.promotions.length > 0 && (
              <View style={styles.promotionSection}>
                <Text style={styles.sectionLabel}>Khuyến mãi</Text>
                {selectedRoom.promotions.map((promo) => (
                  <View key={promo.id} style={styles.promotionItem}>
                    <Text style={styles.promotionName}>{promo.name}</Text>
                    {promo.description && <Text style={styles.promotionDesc}>{promo.description}</Text>}
                    <Text style={styles.promotionValue}>
                      {promo.type === "percent" ? `Giảm ${promo.value}%` : `Giảm $${promo.value}`}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.priceSection}>
              <View>
                <Text style={styles.priceLabel}>Giá mỗi đêm</Text>
                {hasDiscount && (
                  <Text style={styles.originalPrice}>${Number(selectedRoom.giaCoBanMotDem).toLocaleString()}</Text>
                )}
              </View>
              <Text style={[styles.priceValue, { color: COLORS.primary }]}>${Number(discountPrice).toLocaleString()}</Text>
            </View>

            <TouchableOpacity style={styles.bookButton}>
              <Text style={styles.bookButtonText}>Đặt phòng ngay</Text>
            </TouchableOpacity>

            <View style={{ height: SIZES.padding * 2 }} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
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
  modalContent: { flex: 1, backgroundColor: COLORS.white },
  modalImage: { width: Dimensions.get("window").width, height: 250 },
  detailsSection: { paddingHorizontal: SIZES.padding, paddingVertical: SIZES.padding },
  detailTitle: { fontSize: 24, fontWeight: "700", color: COLORS.secondary, marginBottom: 4 },
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
  sectionLabel: { fontSize: 14, fontWeight: "700", color: COLORS.secondary, marginBottom: 8 },
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
  originalPrice: { fontSize: 14, color: COLORS.gray, fontWeight: "500", textDecorationLine: "line-through", marginBottom: 4 },
  priceValue: { fontSize: 24, fontWeight: "700", color: COLORS.primary },
  amenitiesSection: { marginTop: 16, marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#e0e0e0" },
  amenitiesList: { gap: 12 },
  amenityItem: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  amenityBullet: { fontSize: 16, color: "#4CAF50", fontWeight: "700", marginTop: 2 },
  amenityText: { fontSize: 13, color: COLORS.secondary, flex: 1, lineHeight: 18 },
  promotionSection: { marginTop: 16, marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#e0e0e0" },
  promotionItem: { backgroundColor: "#FFF3E0", paddingHorizontal: 12, paddingVertical: 12, borderRadius: 8, marginBottom: 10, borderLeftWidth: 4, borderLeftColor: "#FF6B6B" },
  promotionName: { fontSize: 13, fontWeight: "700", color: COLORS.secondary, marginBottom: 4 },
  promotionDesc: { fontSize: 12, color: COLORS.gray, marginBottom: 8, lineHeight: 16 },
  promotionValue: { fontSize: 13, fontWeight: "700", color: "#FF6B6B" },
  bookButton: { backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: 8, alignItems: "center", marginBottom: 16 },
  bookButtonText: { color: COLORS.white, fontSize: 16, fontWeight: "700" },
});

export default RoomDetail;
