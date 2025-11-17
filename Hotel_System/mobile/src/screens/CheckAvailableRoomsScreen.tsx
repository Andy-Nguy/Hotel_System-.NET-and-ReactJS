import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { COLORS, SIZES, FONTS, SHADOWS } from "../constants/theme";
import AppIcon from "../components/AppIcon";
import { checkAvailableRooms, AvailableRoom } from "../api/roomsApi";
import AvailableRoomCard from "../components/AvailableRoomCard";

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
  const [selectedRoomDetail, setSelectedRoomDetail] =
    useState<AvailableRoom | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [searched, setSearched] = useState(false);

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

  const openRoomDetail = (room: AvailableRoom) => {
    setSelectedRoomDetail(room);
    setModalVisible(true);
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
          <AppIcon name="arrow-left" size={20} color={COLORS.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Kiểm tra phòng trống</Text>
        <View style={{ width: 20 }} />
      </View>

      <ScrollView
        style={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Search Form */}
        <View style={styles.searchForm}>
          <Text style={styles.sectionTitle}>Chọn thời gian đặt phòng</Text>

          {/* Check-in Date */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Ngày nhận phòng</Text>
            <TouchableOpacity
              style={styles.dateInput}
              onPress={() => setCheckInPickerVisibility(true)}
            >
              <AppIcon
                name="calendar"
                size={20}
                color={COLORS.primary}
                style={styles.dateIcon}
              />
              <View style={styles.dateTextContainer}>
                <Text style={styles.dateText}>{formatDate(checkIn)}</Text>
                <Text style={styles.dateSubtext}>
                  {formatDateShort(checkIn)}
                </Text>
              </View>
              <AppIcon name="chevron-down" size={16} color={COLORS.gray} />
            </TouchableOpacity>
          </View>

          {/* Check-out Date */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Ngày trả phòng</Text>
            <TouchableOpacity
              style={styles.dateInput}
              onPress={() => setCheckOutPickerVisibility(true)}
            >
              <AppIcon
                name="calendar"
                size={20}
                color={COLORS.primary}
                style={styles.dateIcon}
              />
              <View style={styles.dateTextContainer}>
                <Text style={styles.dateText}>{formatDate(checkOut)}</Text>
                <Text style={styles.dateSubtext}>
                  {formatDateShort(checkOut)}
                </Text>
              </View>
              <AppIcon name="chevron-down" size={16} color={COLORS.gray} />
            </TouchableOpacity>
          </View>

          {/* Number of Guests */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Số lượng khách</Text>
            <View style={styles.guestSelector}>
              <TouchableOpacity
                style={styles.guestButton}
                onPress={() => setGuests(Math.max(1, guests - 1))}
              >
                <AppIcon name="minus" size={16} color={COLORS.primary} />
              </TouchableOpacity>
              <View style={styles.guestCount}>
                <Text style={styles.guestCountText}>{guests}</Text>
                <Text style={styles.guestLabel}>khách</Text>
              </View>
              <TouchableOpacity
                style={styles.guestButton}
                onPress={() => setGuests(Math.min(10, guests + 1))}
              >
                <AppIcon name="plus" size={16} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Number of Rooms */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Số lượng phòng</Text>
            <View style={styles.guestSelector}>
              <TouchableOpacity
                style={styles.guestButton}
                onPress={() => setRooms(Math.max(1, rooms - 1))}
              >
                <AppIcon name="minus" size={16} color={COLORS.primary} />
              </TouchableOpacity>
              <View style={styles.guestCount}>
                <Text style={styles.guestCountText}>{rooms}</Text>
                <Text style={styles.guestLabel}>phòng</Text>
              </View>
              <TouchableOpacity
                style={styles.guestButton}
                onPress={() => setRooms(Math.min(10, rooms + 1))}
              >
                <AppIcon name="plus" size={16} color={COLORS.primary} />
              </TouchableOpacity>
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
                <AppIcon name="search" size={18} color={COLORS.white} />
                <Text style={styles.searchButtonText}>Tìm phòng trống</Text>
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
            <Text style={styles.resultsTitle}>
              {availableRooms.length > 0
                ? `Tìm thấy ${availableRooms.length} phòng trống`
                : "Không có phòng trống"}
            </Text>

            {availableRooms.length > 0 ? (
              <FlatList
                data={availableRooms}
                renderItem={renderRoomItem}
                keyExtractor={(item) => item.roomId}
                scrollEnabled={false}
                showsVerticalScrollIndicator={false}
              />
            ) : (
              <View style={styles.noResults}>
                <AppIcon name="bed" size={48} color="#ccc" />
                <Text style={styles.noResultsText}>Không có phòng phù hợp</Text>
                <Text style={styles.noResultsSubtext}>
                  Thử chọn ngày khác hoặc ít khách hơn
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
                  Tiếp tục đặt phòng
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      {/* Room Detail Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeRoomDetail}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chi tiết phòng</Text>
              <TouchableOpacity
                onPress={closeRoomDetail}
                style={styles.closeButton}
              >
                <AppIcon name="close" size={24} color={COLORS.secondary} />
              </TouchableOpacity>
            </View>

            {selectedRoomDetail && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.modalImageContainer}>
                  {selectedRoomDetail.roomImageUrl ? (
                    <Image
                      source={{ uri: selectedRoomDetail.roomImageUrl }}
                      style={styles.modalImage}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={styles.modalImagePlaceholder}>
                      <Text style={styles.modalImagePlaceholderText}>🏨</Text>
                    </View>
                  )}
                </View>

                <View style={styles.modalInfo}>
                  <Text style={styles.modalRoomName}>
                    {selectedRoomDetail.roomTypeName}
                  </Text>
                  <Text style={styles.modalRoomNumber}>
                    Phòng {selectedRoomDetail.roomNumber}
                  </Text>

                  <View style={styles.modalRating}>
                    <Text style={styles.modalStars}>{renderStars(4.5)}</Text>
                    <Text style={styles.modalRatingText}>4.5/5</Text>
                  </View>

                  {selectedRoomDetail.description && (
                    <Text style={styles.modalDescription}>
                      {selectedRoomDetail.description}
                    </Text>
                  )}

                  <View style={styles.modalPriceSection}>
                    <Text style={styles.modalPriceLabel}>Giá/đêm:</Text>
                    <Text style={styles.modalPrice}>
                      $
                      {Number(
                        selectedRoomDetail.basePricePerNight || 0
                      ).toLocaleString()}
                    </Text>
                  </View>

                  <Text style={styles.modalNights}>
                    Số đêm: {calculateNights()} | Tổng: $
                    {(
                      Number(selectedRoomDetail.basePricePerNight || 0) *
                      calculateNights()
                    ).toLocaleString()}
                  </Text>
                </View>
              </ScrollView>
            )}

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={closeRoomDetail}
              >
                <Text style={styles.modalCancelText}>Đóng</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
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
  backButton: {
    padding: 8,
  },
  headerTitle: {
    ...FONTS.h2,
    fontWeight: "700",
    color: COLORS.secondary,
  },
  scrollContent: {
    flex: 1,
  },
  searchForm: {
    backgroundColor: COLORS.white,
    margin: SIZES.padding,
    padding: SIZES.padding,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    ...FONTS.h3,
    fontWeight: "600",
    color: COLORS.secondary,
    marginBottom: SIZES.padding,
  },
  inputGroup: {
    marginBottom: SIZES.padding,
  },
  inputLabel: {
    ...FONTS.body3,
    fontWeight: "600",
    color: COLORS.secondary,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: 8,
    padding: SIZES.padding * 0.8,
    fontSize: 16,
    color: COLORS.secondary,
    backgroundColor: COLORS.white,
  },
  searchButton: {
    backgroundColor: "#d47153ff",
    borderRadius: 8,
    paddingVertical: SIZES.padding,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: SIZES.padding,
  },
  searchButtonDisabled: {
    opacity: 0.6,
  },
  searchButtonText: {
    ...FONTS.h4,
    color: COLORS.white,
    fontWeight: "600",
    marginLeft: 8,
  },
  resultsSection: {
    padding: SIZES.padding,
  },
  resultsTitle: {
    ...FONTS.h3,
    fontWeight: "600",
    color: COLORS.secondary,
    marginBottom: SIZES.padding,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 8,
    ...SHADOWS.medium,
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
  imagePlaceholderText: {
    fontSize: 48,
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
  titleSection: {
    marginBottom: 12,
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
    backgroundColor: COLORS.secondary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    flex: 1,
  },
  detailButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "600",
  },
  buttonSection: {
    flexDirection: "row",
    gap: 8,
  },
  selectButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    flex: 1,
  },
  selectButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "600",
  },
  noResults: {
    alignItems: "center",
    paddingVertical: SIZES.padding * 3,
  },
  noResultsText: {
    ...FONTS.h4,
    color: COLORS.secondary,
    marginTop: SIZES.padding,
    marginBottom: 8,
  },
  noResultsSubtext: {
    ...FONTS.body3,
    color: COLORS.gray,
    textAlign: "center",
  },
  dateInput: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: 12,
    padding: SIZES.padding,
    backgroundColor: COLORS.white,
  },
  dateIcon: {
    marginRight: 12,
  },
  dateTextContainer: {
    flex: 1,
  },
  dateText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.secondary,
    marginBottom: 2,
  },
  dateSubtext: {
    fontSize: 12,
    color: COLORS.gray,
  },
  guestSelector: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    overflow: "hidden",
  },
  guestButton: {
    width: 50,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
  },
  guestCount: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
  },
  guestCountText: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.secondary,
  },
  guestLabel: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2,
  },
  continueButton: {
    backgroundColor: "#d47153ff",
    paddingVertical: SIZES.padding,
    borderRadius: 8,
    alignItems: "center",
    marginTop: SIZES.padding,
  },
  continueButtonText: {
    ...FONTS.h4,
    color: COLORS.white,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    width: "90%",
    maxHeight: "80%",
    ...SHADOWS.medium,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  modalTitle: {
    ...FONTS.h2,
    fontWeight: "700",
    color: COLORS.secondary,
  },
  closeButton: {
    padding: 8,
  },
  modalBody: {
    padding: SIZES.padding,
  },
  modalImageContainer: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: SIZES.padding,
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
    fontSize: 48,
  },
  modalInfo: {
    paddingVertical: SIZES.padding,
  },
  modalRoomName: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.secondary,
    marginBottom: 8,
  },
  modalRoomNumber: {
    fontSize: 16,
    color: COLORS.gray,
    marginBottom: 12,
  },
  modalRating: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  modalStars: {
    fontSize: 18,
    marginRight: 8,
  },
  modalRatingText: {
    fontSize: 14,
    color: COLORS.secondary,
    fontWeight: "600",
  },
  modalDescription: {
    fontSize: 14,
    color: COLORS.gray,
    lineHeight: 20,
    marginBottom: 16,
  },
  modalPriceSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    marginBottom: 12,
  },
  modalPriceLabel: {
    fontSize: 14,
    color: COLORS.gray,
    fontWeight: "500",
  },
  modalPrice: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.primary,
  },
  modalNights: {
    fontSize: 14,
    color: COLORS.secondary,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 16,
  },
  modalFooter: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: SIZES.padding,
    alignItems: "center",
  },
  modalCancelText: {
    ...FONTS.h4,
    color: COLORS.gray,
    fontWeight: "600",
  },
});

export default CheckAvailableRoomsScreen;
