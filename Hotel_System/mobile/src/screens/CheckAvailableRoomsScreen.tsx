import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
} from "react-native";
import { Image } from "expo-image";
import { getPrimaryRoomImage, getRoomImages } from "../utils/imageUtils";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { COLORS, SIZES, FONTS, SHADOWS } from "../constants/theme";
import AppIcon from "../components/AppIcon";
import {
  checkAvailableRooms,
  AvailableRoom,
  getRoomById,
} from "../api/roomsApi";
import AvailableRoomCard from "../components/AvailableRoomCard";
import RoomDetail from "../components/RoomDetail";

const CheckAvailableRoomsScreen: React.FC = () => {
  const navigation = useNavigation();
  const [checkIn, setCheckIn] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [checkOut, setCheckOut] = useState(
    new Date(Date.now() + 86400000).toISOString().split("T")[0]
  );
  const [guests, setGuests] = useState(1);
  const [rooms, setRooms] = useState(1);
  const [availableRooms, setAvailableRooms] = useState<AvailableRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRoomDetail, setSelectedRoomDetail] = useState<any | null>(
    null
  );
  const [modalVisible, setModalVisible] = useState(false);
  const [searched, setSearched] = useState(false);
  const [modalImageIndex, setModalImageIndex] = useState(0);
  const [modalLoading, setModalLoading] = useState(false);

  // Date picker states
  const [isCheckInPickerVisible, setCheckInPickerVisibility] = useState(false);
  const [isCheckOutPickerVisible, setCheckOutPickerVisibility] =
    useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("vi-VN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatDateShort = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const handleCheckInConfirm = (date: Date) => {
    const dateString = date.toISOString().split("T")[0];
    setCheckIn(dateString);
    setCheckInPickerVisibility(false);

    // Auto-adjust check-out if it's before or same as check-in
    const checkOutDate = new Date(checkOut);
    if (checkOutDate <= date) {
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      setCheckOut(nextDay.toISOString().split("T")[0]);
    }
  };

  const handleCheckOutConfirm = (date: Date) => {
    const dateString = date.toISOString().split("T")[0];
    setCheckOut(dateString);
    setCheckOutPickerVisibility(false);
  };

  const handleSearchRooms = async () => {
    if (!checkIn || !checkOut) {
      Alert.alert("Lỗi", "Vui lòng chọn ngày nhận phòng và trả phòng");
      return;
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    if (checkInDate >= checkOutDate) {
      Alert.alert("Lỗi", "Ngày trả phòng phải sau ngày nhận phòng");
      return;
    }

    setLoading(true);
    try {
      const rooms = await checkAvailableRooms({
        checkIn,
        checkOut,
        numberOfGuests: guests,
      });
      setAvailableRooms(rooms);
      setSearched(true);
    } catch (error) {
      Alert.alert("Lỗi", "Không thể kiểm tra phòng trống. Vui lòng thử lại.");
      setAvailableRooms([]);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  };

  const openRoomDetail = async (room: AvailableRoom) => {
    // Show minimal item immediately (so RoomDetail can render), then try to fetch full details
    const base = {
      ...room,
      idphong: (room as any).idphong || (room as any).roomId,
    };
    setSelectedRoomDetail(base);
    setModalImageIndex(0);
    setModalVisible(true);

    try {
      const full = await getRoomById(String(room.roomId));
      // Ensure idphong is present
      const merged = {
        ...base,
        ...full,
        idphong: full?.idphong ?? base.idphong,
      };
      setSelectedRoomDetail(merged);
    } catch (err) {
      console.warn("Failed to load full room details, using list item:", err);
      // keep base item
    }
  };

  const closeRoomDetail = () => {
    setModalVisible(false);
    setSelectedRoomDetail(null);
  };

  const calculateNights = () => {
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    return Math.ceil(
      (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
    );
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

  const renderRoomItem = ({ item }: { item: AvailableRoom }) => (
    <AvailableRoomCard
      room={item}
      onOpenDetail={() => openRoomDetail(item)}
      onSelect={() =>
        (navigation as any).navigate("SelectRooms", {
          checkIn,
          checkOut,
          guests,
          rooms,
          availableRooms,
          initialSelectedRoom: item,
        })
      }
    />
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <AppIcon name="arrow-left" size={24} color={COLORS.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Đặt phòng</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Search Form */}
        <View style={styles.searchForm}>
          <Text style={styles.formTitle}>Tìm kiếm phòng nghỉ</Text>
          <Text style={styles.formSubtitle}>
            Chọn thời gian và số lượng khách
          </Text>

          {/* Date Selection Row */}
          <View style={styles.dateRow}>
            {/* Check-in Date */}
            <TouchableOpacity
              style={styles.dateInput}
              onPress={() => setCheckInPickerVisibility(true)}
            >
              <View style={styles.iconContainer}>
                <AppIcon name="calendar" size={20} color={COLORS.primary} />
              </View>
              <View style={styles.dateContent}>
                <Text style={styles.inputLabel}>Nhận phòng</Text>
                <Text style={styles.dateValue}>{formatDateShort(checkIn)}</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.dateDivider} />

            {/* Check-out Date */}
            <TouchableOpacity
              style={styles.dateInput}
              onPress={() => setCheckOutPickerVisibility(true)}
            >
              <View style={styles.iconContainer}>
                <AppIcon name="calendar" size={20} color={COLORS.primary} />
              </View>
              <View style={styles.dateContent}>
                <Text style={styles.inputLabel}>Trả phòng</Text>
                <Text style={styles.dateValue}>
                  {formatDateShort(checkOut)}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Guests & Rooms Row */}
          <View style={styles.selectionRow}>
            <View style={styles.selectionItem}>
              <Text style={styles.inputLabel}>Số khách</Text>
              <View style={styles.counterContainer}>
                <TouchableOpacity
                  style={styles.counterBtn}
                  onPress={() => setGuests(Math.max(1, guests - 1))}
                >
                  <AppIcon name="minus" size={14} color={COLORS.secondary} />
                </TouchableOpacity>
                <Text style={styles.counterValue}>{guests}</Text>
                <TouchableOpacity
                  style={styles.counterBtn}
                  onPress={() => setGuests(Math.min(10, guests + 1))}
                >
                  <AppIcon name="plus" size={14} color={COLORS.secondary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.verticalDivider} />

            <View style={styles.selectionItem}>
              <Text style={styles.inputLabel}>Số phòng</Text>
              <View style={styles.counterContainer}>
                <TouchableOpacity
                  style={styles.counterBtn}
                  onPress={() => setRooms(Math.max(1, rooms - 1))}
                >
                  <AppIcon name="minus" size={14} color={COLORS.secondary} />
                </TouchableOpacity>
                <Text style={styles.counterValue}>{rooms}</Text>
                <TouchableOpacity
                  style={styles.counterBtn}
                  onPress={() => setRooms(Math.min(10, rooms + 1))}
                >
                  <AppIcon name="plus" size={14} color={COLORS.secondary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.searchButton,
              loading && styles.searchButtonDisabled,
            ]}
            onPress={handleSearchRooms}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <Text style={styles.searchButtonText}>
                  Kiểm tra phòng trống
                </Text>
                <AppIcon name="arrow-right" size={20} color={COLORS.white} />
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Date Picker Modals */}
        <DateTimePickerModal
          isVisible={isCheckInPickerVisible}
          mode="date"
          date={new Date(checkIn)}
          minimumDate={new Date()}
          onConfirm={handleCheckInConfirm}
          onCancel={() => setCheckInPickerVisibility(false)}
          confirmTextIOS="Xác nhận"
          cancelTextIOS="Hủy"
        />

        <DateTimePickerModal
          isVisible={isCheckOutPickerVisible}
          mode="date"
          date={new Date(checkOut)}
          minimumDate={new Date(checkIn)}
          onConfirm={handleCheckOutConfirm}
          onCancel={() => setCheckOutPickerVisibility(false)}
          confirmTextIOS="Xác nhận"
          cancelTextIOS="Hủy"
        />

        {/* Results */}
        {searched && (
          <View style={styles.resultsSection}>
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsTitle}>Kết quả tìm kiếm</Text>
              <Text style={styles.resultsCount}>
                {availableRooms.length} phòng phù hợp
              </Text>
            </View>

            {availableRooms.length > 0 ? (
              <View style={{ gap: 16 }}>
                {availableRooms.map((item) => (
                  <View key={item.roomId} style={{ width: "100%" }}>
                    {renderRoomItem({ item })}
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.noResults}>
                <View style={styles.noResultsIcon}>
                  <AppIcon name="search" size={40} color={COLORS.gray} />
                </View>
                <Text style={styles.noResultsText}>Không tìm thấy phòng</Text>
                <Text style={styles.noResultsSubtext}>
                  Vui lòng thử thay đổi ngày hoặc số lượng khách
                </Text>
              </View>
            )}

            {availableRooms.length > 0 && (
              <TouchableOpacity
                style={styles.continueButton}
                onPress={() =>
                  (navigation as any).navigate("SelectRooms", {
                    checkIn,
                    checkOut,
                    guests,
                    rooms,
                    availableRooms,
                  })
                }
              >
                <Text style={styles.continueButtonText}>
                  Tiếp tục chọn phòng
                </Text>
                <AppIcon name="arrow-right" size={18} color={COLORS.white} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      {/* Room Detail Modal */}
      {/* Use shared RoomDetail component for consistency */}
      <RoomDetail
        selectedRoom={selectedRoomDetail}
        visible={modalVisible}
        onClose={closeRoomDetail}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
    backgroundColor: COLORS.white,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#F5F5F5",
  },
  headerTitle: {
    ...FONTS.h3,
    color: COLORS.secondary,
    fontWeight: "700",
  },
  scrollContent: {
    flex: 1,
  },
  searchForm: {
    backgroundColor: COLORS.white,
    margin: SIZES.padding,
    padding: 20,
    borderRadius: 24,
    ...SHADOWS.medium,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  formTitle: {
    ...FONTS.h2,
    color: COLORS.secondary,
    marginBottom: 4,
  },
  formSubtitle: {
    ...FONTS.body3,
    color: COLORS.gray,
    marginBottom: 24,
  },
  dateRow: {
    flexDirection: "row",
    backgroundColor: "#F8F9FA",
    borderRadius: 16,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E9ECEF",
  },
  dateInput: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(223, 169, 116, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  dateContent: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 11,
    color: COLORS.gray,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  dateValue: {
    fontSize: 15,
    color: COLORS.secondary,
    fontWeight: "700",
  },
  dateDivider: {
    width: 1,
    backgroundColor: "#E9ECEF",
    marginVertical: 8,
  },
  selectionRow: {
    flexDirection: "row",
    backgroundColor: "#F8F9FA",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#E9ECEF",
    alignItems: "center",
  },
  selectionItem: {
    flex: 1,
    alignItems: "center",
  },
  verticalDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#E9ECEF",
    marginHorizontal: 8,
  },
  counterContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 12,
  },
  counterBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#DEE2E6",
    ...SHADOWS.light,
  },
  counterValue: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.secondary,
    minWidth: 20,
    textAlign: "center",
  },
  searchButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  searchButtonDisabled: {
    opacity: 0.7,
  },
  searchButtonText: {
    fontSize: 16,
    color: COLORS.white,
    fontWeight: "700",
  },
  resultsSection: {
    paddingHorizontal: SIZES.padding,
    paddingBottom: 40,
  },
  resultsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 16,
  },
  resultsTitle: {
    ...FONTS.h3,
    color: COLORS.secondary,
  },
  resultsCount: {
    fontSize: 13,
    color: COLORS.gray,
    fontWeight: "500",
  },
  noResults: {
    alignItems: "center",
    paddingVertical: 40,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 24,
  },
  noResultsIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F8F9FA",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  noResultsText: {
    ...FONTS.h4,
    color: COLORS.secondary,
    marginBottom: 8,
  },
  noResultsSubtext: {
    ...FONTS.body3,
    color: COLORS.gray,
    textAlign: "center",
  },
  continueButton: {
    backgroundColor: COLORS.secondary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 24,
  },
  continueButtonText: {
    fontSize: 16,
    color: COLORS.white,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    height: "90%",
    ...SHADOWS.dark,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F3F5",
  },
  modalTitle: {
    ...FONTS.h3,
    color: COLORS.secondary,
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    flex: 1,
  },
  modalImageContainer: {
    width: "100%",
    height: 250,
    backgroundColor: "#F8F9FA",
  },
  modalImage: {
    width: "100%",
    height: "100%",
  },
  modalImagePlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  modalImagePlaceholderText: {
    fontSize: 64,
  },
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
  modalInfo: {
    padding: 24,
  },
  modalRoomName: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.secondary,
    marginBottom: 4,
  },
  modalRoomNumber: {
    fontSize: 14,
    color: COLORS.gray,
    marginBottom: 12,
  },
  modalRating: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    backgroundColor: "#FFF9F2",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  modalStars: {
    fontSize: 14,
    marginRight: 8,
  },
  modalRatingText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: "#F1F3F5",
    marginVertical: 24,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.secondary,
    marginBottom: 12,
  },
  modalDescription: {
    fontSize: 15,
    color: COLORS.gray,
    lineHeight: 24,
    marginBottom: 24,
  },
  modalPriceSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalPriceLabel: {
    fontSize: 15,
    color: COLORS.gray,
  },
  modalPrice: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.primary,
  },
  modalTotalSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
    padding: 16,
    borderRadius: 12,
  },
  modalTotalLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.secondary,
  },
  modalTotalValue: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.secondary,
  },
  modalFooter: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: "#F1F3F5",
    backgroundColor: COLORS.white,
  },
  modalCancelButton: {
    backgroundColor: "#F1F3F5",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.secondary,
  },
});

export default CheckAvailableRoomsScreen;
