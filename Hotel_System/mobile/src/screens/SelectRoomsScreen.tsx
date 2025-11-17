import React, { useState, useEffect } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Modal,
} from "react-native";
import { Image } from "expo-image";
import { useNavigation, useRoute } from "@react-navigation/native";
import { COLORS, SIZES, FONTS, SHADOWS } from "../constants/theme";
import AppIcon from "../components/AppIcon";
import AsyncStorage from "@react-native-async-storage/async-storage";
import BookingProgress from "../components/BookingProgress";
import ServicesSelector from "../components/ServicesSelector";

interface AvailableRoom {
  roomId: string;
  roomNumber: string;
  roomTypeName: string;
  basePricePerNight: number;
  discountedPrice?: number;
  maxOccupancy: number;
  description?: string;
  roomImageUrl?: string;
  promotionName?: string;
  discountPercent?: number;
}

interface SelectedRoom {
  roomNumber: number;
  room: AvailableRoom;
}

const SelectRoomsScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const {
    checkIn,
    checkOut,
    guests,
    rooms,
    availableRooms: initialRooms,
  } = route.params as {
    checkIn: string;
    checkOut: string;
    guests: number;
    rooms: number;
    availableRooms: AvailableRoom[];
  };

  const [availableRooms, setAvailableRooms] = useState<AvailableRoom[]>(
    initialRooms || []
  );
  const [selectedRooms, setSelectedRooms] = useState<SelectedRoom[]>([]);
  const [currentRoomNumber, setCurrentRoomNumber] = useState(1);
  const [totalRooms, setTotalRooms] = useState(rooms || 1);
  const [loading, setLoading] = useState(false);
  const [selectedServices, setSelectedServices] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedRoomDetail, setSelectedRoomDetail] =
    useState<AvailableRoom | null>(null);

  useEffect(() => {
    loadBookingData();
  }, []);

  const loadBookingData = async () => {
    try {
      const bookingData = await AsyncStorage.getItem("bookingData");
      if (bookingData) {
        const parsed = JSON.parse(bookingData);
        // Only load from AsyncStorage if it's the same booking session
        if (
          parsed.checkIn === checkIn &&
          parsed.checkOut === checkOut &&
          parsed.guests === guests &&
          parsed.rooms === rooms
        ) {
          setSelectedRooms(parsed.selectedRooms || []);
          setTotalRooms(parsed.totalRooms || rooms || 1);
          setCurrentRoomNumber(parsed.currentRoomNumber || 1);
          setSelectedServices(parsed.selectedServices || []);
        } else {
          // Different booking session, start fresh
          setTotalRooms(rooms || 1);
          setCurrentRoomNumber(1);
          setSelectedRooms([]);
          setSelectedServices([]);
        }
      } else {
        // No stored data, initialize with params
        setTotalRooms(rooms || 1);
        setCurrentRoomNumber(1);
        setSelectedRooms([]);
        setSelectedServices([]);
      }
    } catch (error) {
      console.error("Error loading booking data:", error);
      // Fallback to params
      setTotalRooms(rooms || 1);
      setCurrentRoomNumber(1);
      setSelectedRooms([]);
      setSelectedServices([]);
    }
  };

  const saveBookingData = async () => {
    try {
      const bookingData = {
        checkIn,
        checkOut,
        guests,
        rooms,
        totalRooms,
        selectedRooms,
        currentRoomNumber,
        availableRooms,
      };
      await AsyncStorage.setItem("bookingData", JSON.stringify(bookingData));
    } catch (error) {
      console.error("Error saving booking data:", error);
    }
  };

  const handleSelectRoom = (room: AvailableRoom) => {
    const alreadySelected = selectedRooms.some(
      (sr) => sr.room.roomId === room.roomId
    );

    if (alreadySelected) {
      Alert.alert("Thông báo", "Phòng này đã được chọn!");
      return;
    }

    if (selectedRooms.length >= totalRooms) {
      Alert.alert(
        "Thông báo",
        "Bạn đã chọn đủ số phòng. Xóa phòng hiện tại để chọn phòng khác."
      );
      return;
    }

    const newSelectedRooms = [
      ...selectedRooms,
      { roomNumber: currentRoomNumber, room },
    ];
    setSelectedRooms(newSelectedRooms);

    if (newSelectedRooms.length >= totalRooms) {
      setCurrentRoomNumber(totalRooms);
    } else {
      setCurrentRoomNumber(currentRoomNumber + 1);
    }

    saveBookingData();
  };

  const handleRemoveRoom = (roomNumber: number) => {
    const newSelectedRooms = selectedRooms.filter(
      (sr) => sr.roomNumber !== roomNumber
    );
    setSelectedRooms(newSelectedRooms);
    setCurrentRoomNumber(roomNumber);
    saveBookingData();
  };

  const handleProceedToCheckout = () => {
    if (selectedRooms.length < totalRooms) {
      Alert.alert("Thông báo", "Vui lòng chọn đủ số phòng trước khi tiếp tục.");
      return;
    }

    saveBookingData();
    (navigation as any).navigate("ServicesSelection", {
      selectedRooms,
      checkIn,
      checkOut,
      guests,
      rooms,
    });
  };

  const calculateTotal = () => {
    if (!selectedRooms.length) return 0;

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const nights = Math.ceil(
      (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const totalPrice = selectedRooms.reduce((sum, sr) => {
      const price =
        sr.room.discountedPrice &&
        sr.room.discountedPrice < sr.room.basePricePerNight
          ? sr.room.discountedPrice
          : sr.room.basePricePerNight || 0;
      return sum + (price || 0) * nights;
    }, 0);

    return totalPrice;
  };

  const handleServicesChange = (services: any[], total: number) => {
    setSelectedServices(services);
    // Save to AsyncStorage
    const bookingData = {
      checkIn,
      checkOut,
      guests,
      rooms,
      totalRooms,
      selectedRooms,
      currentRoomNumber,
      availableRooms,
      selectedServices: services,
    };
    AsyncStorage.setItem("bookingData", JSON.stringify(bookingData));
  };

  const openRoomDetail = (room: AvailableRoom) => {
    setSelectedRoomDetail(room);
    setModalVisible(true);
  };

  const closeRoomDetail = () => {
    setModalVisible(false);
    setSelectedRoomDetail(null);
  };

  const confirmSelectRoom = () => {
    if (selectedRoomDetail) {
      handleSelectRoom(selectedRoomDetail);
      closeRoomDetail();
    }
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
    const stars = [];
    for (let i = 0; i < 5; i++) {
      stars.push(i < fullStars ? "⭐" : "☆");
    }
    return stars.join("");
  };

  const renderRoomItem = ({ item }: { item: AvailableRoom }) => (
    <View style={styles.card}>
      <View style={styles.imageContainer}>
        {item.roomImageUrl ? (
          <Image
            source={{ uri: item.roomImageUrl }}
            style={styles.roomImage}
            contentFit="cover"
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.imagePlaceholderText}>🏨</Text>
          </View>
        )}
        <View style={[styles.statusBadge, { backgroundColor: "#4CAF50" }]}>
          <Text style={styles.statusText}>Còn phòng</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.titleSection}>
          <Text style={styles.roomName} numberOfLines={2}>
            {item.roomTypeName || "Unknown Room"}
          </Text>
          <Text style={styles.roomNumber}>Phòng {item.roomNumber || "-"}</Text>
        </View>

        <View style={styles.ratingSection}>
          <Text style={styles.stars}>{renderStars(4.5)}</Text>
          <Text style={styles.ratingText}>4.5/5</Text>
        </View>

        {item.description && (
          <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>
        )}

        <View style={styles.priceSection}>
          <Text style={styles.priceLabel}>Giá/đêm:</Text>
          <Text style={styles.price}>
            ${Number(item.basePricePerNight || 0).toLocaleString()}
          </Text>
        </View>

        <View style={styles.buttonSection}>
          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => handleSelectRoom(item)}
          >
            <Text style={styles.selectButtonText}>Chọn phòng</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.detailButton}
            onPress={() => openRoomDetail(item)}
          >
            <Text style={styles.detailButtonText}>Xem chi tiết</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const availableForSelection = availableRooms.filter(
    (room) => !selectedRooms.some((sr) => sr.room.roomId === room.roomId)
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <AppIcon name="arrow-left" size={20} color={COLORS.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chọn phòng</Text>
        <View style={{ width: 20 }} />
      </View>

      <BookingProgress
        currentStage="select"
        totalRooms={totalRooms}
        currentRoom={currentRoomNumber}
        selectedRoomNumbers={selectedRooms.map((sr) => sr.roomNumber)}
      />

      <ScrollView style={styles.scrollContent}>
        <View style={styles.summarySection}>
          <Text style={styles.sectionTitle}>
            Chọn phòng {currentRoomNumber} / {totalRooms}
          </Text>
          <Text style={styles.summaryText}>
            Nhận phòng: {new Date(checkIn).toLocaleDateString("vi-VN")} - Trả
            phòng: {new Date(checkOut).toLocaleDateString("vi-VN")}
          </Text>
          <Text style={styles.summaryText}>
            Số khách: {guests} | Số phòng: {rooms} | Số đêm: {calculateNights()}
          </Text>
        </View>

        {/* Selected Rooms Summary */}
        {selectedRooms.length > 0 && (
          <View style={styles.selectedRoomsSection}>
            <Text style={styles.sectionTitle}>Phòng đã chọn</Text>
            {selectedRooms.map((sr) => (
              <View key={sr.roomNumber} style={styles.selectedRoomItem}>
                <View style={styles.selectedRoomInfo}>
                  <Text style={styles.selectedRoomName}>
                    Phòng {sr.roomNumber}: {sr.room.roomTypeName}
                  </Text>
                  <Text style={styles.selectedRoomPrice}>
                    $
                    {(
                      sr.room.discountedPrice ||
                      sr.room.basePricePerNight ||
                      0
                    ).toLocaleString()}{" "}
                    x {calculateNights()} đêm
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleRemoveRoom(sr.roomNumber)}
                  style={styles.removeButton}
                >
                  <AppIcon name="trash" size={16} color={COLORS.error} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Services Selector */}
        <View style={styles.servicesSection}>
          <ServicesSelector onServicesChange={handleServicesChange} />
        </View>

        {/* Available Rooms */}
        <View style={styles.availableRoomsSection}>
          <Text style={styles.sectionTitle}>
            Phòng có sẵn ({availableForSelection.length})
          </Text>

          {availableForSelection.length > 0 ? (
            <FlatList
              data={availableForSelection}
              renderItem={renderRoomItem}
              keyExtractor={(item) => item.roomId}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={styles.noRooms}>
              <Text style={styles.noRoomsText}>
                Không còn phòng nào để chọn
              </Text>
            </View>
          )}
        </View>

        {/* Total and Proceed */}
        {selectedRooms.length > 0 && (
          <View style={styles.totalSection}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tổng tiền phòng:</Text>
              <Text style={styles.totalPrice}>
                ${calculateTotal().toLocaleString()}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.proceedButton,
                selectedRooms.length < totalRooms &&
                  styles.proceedButtonDisabled,
              ]}
              onPress={handleProceedToCheckout}
              disabled={selectedRooms.length < totalRooms}
            >
              <Text style={styles.proceedButtonText}>
                Tiếp tục ({selectedRooms.length}/{totalRooms} phòng)
              </Text>
            </TouchableOpacity>
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
                <Text style={styles.modalCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={confirmSelectRoom}
              >
                <Text style={styles.modalConfirmText}>Chọn phòng</Text>
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
  summarySection: {
    backgroundColor: COLORS.white,
    margin: SIZES.padding,
    padding: SIZES.padding,
    borderRadius: 12,
    ...SHADOWS.medium,
  },
  sectionTitle: {
    ...FONTS.h3,
    fontWeight: "600",
    color: COLORS.secondary,
    marginBottom: 8,
  },
  summaryText: {
    ...FONTS.body3,
    color: COLORS.gray,
    marginBottom: 4,
  },
  selectedRoomsSection: {
    backgroundColor: COLORS.white,
    marginHorizontal: SIZES.padding,
    marginBottom: SIZES.padding,
    padding: SIZES.padding,
    borderRadius: 12,
    ...SHADOWS.medium,
  },
  selectedRoomItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  selectedRoomInfo: {
    flex: 1,
  },
  selectedRoomName: {
    ...FONTS.body3,
    fontWeight: "600",
    color: COLORS.secondary,
  },
  selectedRoomPrice: {
    ...FONTS.body4,
    color: COLORS.gray,
  },
  removeButton: {
    padding: 8,
  },
  availableRoomsSection: {
    paddingHorizontal: SIZES.padding,
    paddingBottom: SIZES.padding,
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
  selectButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: "center",
    flex: 1,
  },
  selectButtonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "600",
  },
  buttonSection: {
    flexDirection: "row",
    gap: 8,
  },
  detailButton: {
    backgroundColor: COLORS.secondary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: "center",
    flex: 1,
  },
  detailButtonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "600",
  },
  noRooms: {
    alignItems: "center",
    paddingVertical: SIZES.padding * 3,
  },
  noRoomsText: {
    ...FONTS.h4,
    color: COLORS.gray,
  },
  totalSection: {
    backgroundColor: COLORS.white,
    marginHorizontal: SIZES.padding,
    marginBottom: SIZES.padding,
    padding: SIZES.padding,
    borderRadius: 12,
    ...SHADOWS.medium,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  totalLabel: {
    ...FONTS.body3,
    fontWeight: "600",
    color: COLORS.secondary,
  },
  totalPrice: {
    ...FONTS.h3,
    fontWeight: "700",
    color: COLORS.primary,
  },
  proceedButton: {
    backgroundColor: "#d47153ff",
    paddingVertical: SIZES.padding,
    borderRadius: 8,
    alignItems: "center",
  },
  proceedButtonDisabled: {
    opacity: 0.6,
  },
  proceedButtonText: {
    ...FONTS.h4,
    color: COLORS.white,
    fontWeight: "600",
  },
  servicesSection: {
    marginHorizontal: SIZES.padding,
    marginBottom: SIZES.padding,
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
    borderRightWidth: 1,
    borderRightColor: COLORS.lightGray,
  },
  modalCancelText: {
    ...FONTS.h4,
    color: COLORS.gray,
    fontWeight: "600",
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: SIZES.padding,
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 12,
  },
  modalConfirmText: {
    ...FONTS.h4,
    color: COLORS.white,
    fontWeight: "600",
  },
});

export default SelectRoomsScreen;
