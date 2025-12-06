import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  ScrollView,
  Image as RNImage,
  TextInput,
  Alert,
  Animated,
  Easing,
} from "react-native";
import { Image } from "expo-image";
import { useRoute, useNavigation } from "@react-navigation/native";
import { COLORS, SIZES, FONTS } from "../constants/theme";
import AppIcon from "../components/AppIcon";
import {
  getRooms,
  Room,
  checkAvailableRoomsByType,
  AvailableRoom,
} from "../api/roomsApi";
import RoomDetail from "../components/RoomDetail";
import DatePickerInput from "../components/DatePickerInput";
import GuestSelector from "../components/GuestSelector";

interface RoomTypeDetailRouteParams {
  idloaiPhong: string;
  tenLoaiPhong: string;
}

const RoomTypeDetail: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { idloaiPhong, tenLoaiPhong } =
    (route.params as RoomTypeDetailRouteParams) || {};

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [checkInDate, setCheckInDate] = useState<Date | null>(null);
  const [checkOutDate, setCheckOutDate] = useState<Date | null>(null);
  const [numberGuests, setNumberGuests] = useState<number>(1);
  const [showSearchForm, setShowSearchForm] = useState<boolean>(true);
  const anim = useRef(new Animated.Value(showSearchForm ? 1 : 0)).current;
  const [searching, setSearching] = useState(false);
  const [availabilityResult, setAvailabilityResult] = useState<
    | null
    | { available: boolean; availableCount: number; rooms?: AvailableRoom[] }
    | { message: string }
  >(null);

  useEffect(() => {
    fetchRoomsByType();
    // animate initial state
    Animated.timing(anim, {
      toValue: showSearchForm ? 1 : 0,
      duration: 1,
      useNativeDriver: false,
    }).start();
  }, []);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: showSearchForm ? 1 : 0,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [showSearchForm]);

  const fetchRoomsByType = async () => {
    try {
      setLoading(true);
      setError(null);

      const allRooms = await getRooms();
      const filteredRooms = allRooms.filter(
        (r: Room) => r.idloaiPhong === idloaiPhong
      );
      setRooms(filteredRooms);

      if (filteredRooms.length === 0) {
        setError("Không có phòng nào trong loại này");
      }
    } catch (err) {
      console.error("Error fetching rooms by type:", err);
      setError(err instanceof Error ? err.message : "Không thể tải phòng");
      setRooms([]);
    } finally {
      setLoading(false);
    }
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
    <TouchableOpacity
      style={styles.card}
      onPress={() => {
        setSelectedRoom(item);
        setShowDetails(true);
      }}
    >
      {/* Room Image */}
      <View style={styles.imageContainer}>
        {item.urlAnhPhong ? (
          <Image
            source={{ uri: item.urlAnhPhong }}
            style={styles.roomImage}
            contentFit="cover"
            onError={(e) => console.log("Image load error:", item.urlAnhPhong)}
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <AppIcon name="image" size={40} color="#ccc" />
          </View>
        )}
      </View>

      {/* Room Info */}
      <View style={styles.content}>
        {/* Title */}
        <Text style={styles.roomName} numberOfLines={2}>
          {item.tenPhong || "Unknown Room"}
        </Text>
        <Text style={styles.roomNumber}>Phòng {item.soPhong || "-"}</Text>

        {/* Rating */}
        <View style={styles.ratingSection}>
          <Text style={styles.stars}>{renderStars(item.xepHangSao || 0)}</Text>
          <Text style={styles.ratingText}>
            {(item.xepHangSao || 0).toFixed(1)}/5
          </Text>
        </View>

        {/* Description */}
        {item.moTa && (
          <Text style={styles.description} numberOfLines={2}>
            {item.moTa}
          </Text>
        )}

        {/* Amenities Preview */}
        <View style={styles.amenitiesSection}>
          <View style={styles.amenityBadge}>
            <Text style={styles.amenityText}>
              👥 {item.soNguoiToiDa || "-"} guests
            </Text>
          </View>
          {item.amenities && item.amenities.length > 0 && (
            <View style={styles.amenityBadge}>
              <Text style={styles.amenityText}>
                ✓ {item.amenities.length} amenities
              </Text>
            </View>
          )}
        </View>

        {/* Price Section */}
        <View style={styles.priceSection}>
          <Text style={styles.priceLabel}>Giá/đêm:</Text>
          <Text style={styles.price}>
            {Number(item.giaCoBanMotDem || 0).toLocaleString('vi-VN')} đ
          </Text>
        </View>

        {/* View Details Button */}
        <TouchableOpacity style={styles.detailButton}>
          <Text style={styles.detailButtonText}>Xem chi tiết</Text>
          <AppIcon name="arrow-right" size={14} color={COLORS.white} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  // Details modal moved to shared RoomDetail component

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>{tenLoaiPhong}</Text>
          <View style={{ width: 30 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error && rooms.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>{tenLoaiPhong}</Text>
          <View style={{ width: 30 }} />
        </View>
        <View style={styles.errorContainer}>
          <AppIcon name="exclamation-circle" size={48} color={COLORS.primary} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={fetchRoomsByType}
          >
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.modalHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.closeButton}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.modalTitle}>{tenLoaiPhong}</Text>
        <View style={{ width: 30 }} />
      </View>

      {/* Small action row under title: show/hide search form */}
      <View style={styles.headerActionContainer}>
        <TouchableOpacity
          style={styles.showFormButton}
          onPress={() => setShowSearchForm((s) => !s)}
          accessibilityLabel={
            showSearchForm ? "Ẩn form tìm phòng" : "Hiện form tìm phòng"
          }
        >
          <Text style={styles.showFormButtonText}>
            {showSearchForm ? "Ẩn tìm phòng" : "Tìm Phòng"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search form: check-in / check-out / guests (toggleable, animated) */}
      <Animated.View
        style={[
          styles.searchForm,
          {
            height: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 320],
            }),
            opacity: anim,
            overflow: "hidden",
          },
        ]}
        pointerEvents={showSearchForm ? "auto" : "none"}
      >
        <DatePickerInput
          label="Ngày Check-in"
          value={checkInDate}
          onChange={(date) => {
            setCheckInDate(date);
            // Reset check-out if it's before the new check-in date
            if (checkOutDate && checkOutDate <= date) {
              setCheckOutDate(null);
            }
          }}
          minimumDate={new Date()} // Today or future dates only
          placeholder="Chọn ngày check-in"
        />
        <DatePickerInput
          label="Ngày Check-out"
          value={checkOutDate}
          onChange={setCheckOutDate}
          minimumDate={
            checkInDate
              ? new Date(checkInDate.getTime() + 24 * 60 * 60 * 1000) // At least 1 day after check-in
              : new Date(new Date().getTime() + 24 * 60 * 60 * 1000)
          }
          placeholder="Chọn ngày check-out"
        />
        <GuestSelector
          value={numberGuests}
          onChange={setNumberGuests}
          label="Số lượng khách"
        />
        <TouchableOpacity
          style={styles.searchButton}
          onPress={async () => {
            if (!idloaiPhong) return Alert.alert("Lỗi", "Không có loại phòng");
            if (!checkInDate || !checkOutDate)
              return Alert.alert(
                "Lỗi",
                "Vui lòng chọn ngày check-in và check-out"
              );

            // Validate dates
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (checkInDate < today) {
              return Alert.alert(
                "Lỗi",
                "Ngày check-in phải là hôm nay hoặc trong tương lai"
              );
            }

            if (checkOutDate <= checkInDate) {
              return Alert.alert(
                "Lỗi",
                "Ngày check-out phải sau ngày check-in ít nhất 1 ngày"
              );
            }

            setSearching(true);
            setAvailabilityResult(null);
            try {
              const fmt = (d: Date) => {
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, "0");
                const dd = String(d.getDate()).padStart(2, "0");
                return `${yyyy}-${mm}-${dd}`;
              };

              const resRooms = await checkAvailableRoomsByType(
                idloaiPhong,
                fmt(checkInDate),
                fmt(checkOutDate),
                numberGuests
              );
              // roomsApi returns array; if empty means no rooms
              if (!resRooms || resRooms.length === 0) {
                const message =
                  "Không có phòng trống phù hợp với số khách và ngày đã chọn.";
                setAvailabilityResult({ message });
                Alert.alert("Thông báo", message);
              } else {
                setAvailabilityResult({
                  available: true,
                  availableCount: resRooms.length,
                  rooms: resRooms,
                });
                Alert.alert(
                  "Thành công",
                  `Tìm thấy ${resRooms.length} phòng phù hợp!`
                );
              }
            } catch (err: any) {
              console.error("check availability error", err);
              Alert.alert("Lỗi", err.message || "Không thể kiểm tra phòng");
            } finally {
              setSearching(false);
            }
          }}
        >
          {searching ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.searchButtonText}>Tìm phòng</Text>
          )}
        </TouchableOpacity>

        {availabilityResult && (
          <View style={styles.resultBanner}>
            {"message" in availabilityResult ? (
              <Text style={styles.resultText}>
                {availabilityResult.message}
              </Text>
            ) : (
              <Text style={styles.resultText}>
                {availabilityResult.available
                  ? `✓ Còn ${availabilityResult.availableCount} phòng trống phù hợp`
                  : "Không có phòng trống"}
              </Text>
            )}
          </View>
        )}
      </Animated.View>

      {/* Room List */}
      <FlatList
        data={
          availabilityResult &&
          "rooms" in availabilityResult &&
          availabilityResult.rooms
            ? availabilityResult.rooms.map((ar) => {
                // Map available rooms to Room type for display
                const matchingRoom = rooms.find((r) => r.idphong === ar.roomId);
                return (
                  matchingRoom ||
                  ({
                    idphong: ar.roomId,
                    tenPhong: ar.roomTypeName,
                    soPhong: ar.roomNumber,
                    moTa: ar.description,
                    soNguoiToiDa: ar.maxOccupancy,
                    giaCoBanMotDem: ar.basePricePerNight,
                    xepHangSao: 0,
                    trangThai: "Available",
                    urlAnhPhong: ar.roomImageUrl || "",
                    amenities: [],
                    promotions: [],
                  } as Room)
                );
              })
            : rooms
        }
        renderItem={renderRoomCard}
        keyExtractor={(item) => item.idphong}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        ListEmptyComponent={
          availabilityResult && "message" in availabilityResult ? (
            <View style={styles.emptyContainer}>
              <AppIcon name="inbox" size={48} color={COLORS.gray} />
              <Text style={styles.emptyText}>{availabilityResult.message}</Text>
            </View>
          ) : null
        }
      />

      {/* Details Modal */}
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
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  title: {
    ...FONTS.h2,
    fontWeight: "700",
    color: COLORS.secondary,
    fontSize: 20,
  },
  listContent: {
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: SIZES.padding,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
  roomName: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.secondary,
    marginBottom: 4,
  },
  roomNumber: {
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 8,
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
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  detailButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SIZES.padding,
  },
  errorText: {
    ...FONTS.body3,
    color: COLORS.secondary,
    marginTop: 12,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  retryButtonText: {
    color: COLORS.white,
    fontWeight: "600",
    fontSize: 14,
  },
  /* Modal Styles */
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding * 0.6,
    marginTop: 30,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  modalTitle: {
    ...FONTS.h2,
    fontWeight: "700",
    color: COLORS.secondary,
    fontSize: 20,
  },
  closeButton: {
    fontSize: 24,
    color: COLORS.secondary,
    fontWeight: "600",
    width: 30,
    textAlign: "center",
  },
  toggleButton: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  headerActionContainer: {
    paddingHorizontal: SIZES.padding,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
    alignItems: "center",
  },
  showFormButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  showFormButtonText: {
    color: COLORS.primary,
    fontWeight: "700",
  },
  modalContent: {
    flex: 1,
  },
  modalImage: {
    width: "100%",
    aspectRatio: 16 / 9,
  },
  detailsSection: {
    padding: SIZES.padding,
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
  starsLarge: {
    fontSize: 20,
    marginRight: 8,
  },
  ratingTextLarge: {
    fontSize: 16,
    color: COLORS.secondary,
    fontWeight: "600",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  detailLabel: {
    fontSize: 13,
    color: COLORS.gray,
    fontWeight: "600",
  },
  detailValue: {
    fontSize: 13,
    color: COLORS.secondary,
    fontWeight: "500",
  },
  descriptionSection: {
    marginTop: 16,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.secondary,
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 13,
    color: COLORS.gray,
    lineHeight: 20,
  },
  amenitiesDetailSection: {
    marginBottom: 16,
  },
  amenitiesList: {
    gap: 8,
  },
  amenityItem: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  amenityBullet: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: "700",
    marginRight: 8,
  },
  amenityItemText: {
    fontSize: 13,
    color: COLORS.secondary,
    flex: 1,
  },
  promotionDetailSection: {
    marginBottom: 16,
  },
  promotionItem: {
    backgroundColor: "#fff3cd",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
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
    marginBottom: 4,
  },
  promotionValue: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.primary,
  },
  priceSectionModal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  priceLabelModal: {
    fontSize: 13,
    color: COLORS.gray,
    fontWeight: "600",
    marginBottom: 4,
  },
  originalPrice: {
    fontSize: 14,
    color: COLORS.gray,
    textDecorationLine: "line-through",
  },
  priceValueModal: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.primary,
  },
  bookButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  bookButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "700",
  },
  /* Search form styles */
  searchForm: {
    paddingHorizontal: SIZES.padding,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
    backgroundColor: "#fff",
  },
  searchButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 8,
  },
  searchButtonText: {
    color: COLORS.white,
    fontWeight: "700",
  },
  resultBanner: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#eef7ff",
    borderWidth: 1,
    borderColor: "#d6edff",
  },
  resultText: {
    color: COLORS.secondary,
    fontWeight: "600",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: SIZES.padding,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 12,
    textAlign: "center",
  },
});

export default RoomTypeDetail;
