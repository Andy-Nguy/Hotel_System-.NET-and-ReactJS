import React, { useState, useEffect } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { getPrimaryRoomImage, getRoomImages } from "../utils/imageUtils";
import { getRoomById } from "../api/roomsApi";
import RoomDetail from "../components/RoomDetail";
import { useNavigation, useRoute } from "@react-navigation/native";
import { COLORS, SIZES, FONTS, SHADOWS } from "../constants/theme";
import AppIcon from "../components/AppIcon";
import AsyncStorage from "@react-native-async-storage/async-storage";
import BookingProgress from "../components/BookingProgress";
import ServicesSelector from "../components/ServicesSelector";
import AvailableRoomCard from "../components/AvailableRoomCard";
import { AvailableRoom } from "../api/roomsApi";

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
  const [modalImageIndex, setModalImageIndex] = useState(0);

  useEffect(() => {
    // IMPORTANT: Always clear old booking data when entering this screen
    // to prevent stale room selections from previous booking sessions
    clearAndInitBooking();
  }, []);

  const clearAndInitBooking = async () => {
    try {
      // Clear old booking data first to ensure fresh state
      await AsyncStorage.removeItem("bookingData");
      console.log("🧹 Cleared old bookingData from AsyncStorage");

      const params = route.params as any;
      const initialSelectedRoom = params?.initialSelectedRoom;

      // Always start fresh
      setTotalRooms(rooms || 1);
      setSelectedServices([]);

      if (initialSelectedRoom) {
        console.log(
          "📦 Setting initial selected room:",
          initialSelectedRoom.roomName
        );
        setSelectedRooms([{ roomNumber: 1, room: initialSelectedRoom }]);
        setCurrentRoomNumber(rooms > 1 ? 2 : 1);
      } else {
        console.log("📦 No initial room, starting with empty selection");
        setSelectedRooms([]);
        setCurrentRoomNumber(1);
      }
    } catch (error) {
      console.error("Error initializing booking data:", error);
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
        selectedServices,
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

    // Find next available room number slot
    const selectedNumbers = newSelectedRooms.map((r) => r.roomNumber);
    let nextRoomNum = 1;
    while (selectedNumbers.includes(nextRoomNum) && nextRoomNum <= totalRooms) {
      nextRoomNum++;
    }

    if (nextRoomNum <= totalRooms) {
      setCurrentRoomNumber(nextRoomNum);
    } else {
      // All rooms selected
      setCurrentRoomNumber(totalRooms);
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

  const openRoomDetail = async (room: AvailableRoom) => {
    const base = {
      ...room,
      idphong: (room as any).idphong || (room as any).roomId,
    };
    setSelectedRoomDetail(base);
    setModalImageIndex(0);
    setModalVisible(true);
    try {
      const full = await getRoomById(String(room.roomId));
      const merged = {
        ...base,
        ...full,
        idphong: full?.idphong ?? base.idphong,
      };
      setSelectedRoomDetail(merged);
    } catch (err) {
      console.warn("SelectRoomsScreen: failed to load full room details", err);
    }
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
    <AvailableRoomCard
      room={item}
      onOpenDetail={() => openRoomDetail(item)}
      onSelect={() => handleSelectRoom(item)}
    />
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
          <AppIcon name="arrow-left" size={24} color={COLORS.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chọn phòng</Text>
        <View style={{ width: 40 }} />
      </View>

      <BookingProgress
        currentStage="select"
        totalRooms={totalRooms}
        currentRoom={currentRoomNumber}
        selectedRoomNumbers={selectedRooms.map((sr) => sr.roomNumber)}
      />

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <View style={styles.summarySection}>
          <View style={styles.summaryHeader}>
            <Text style={styles.sectionTitle}>
              Phòng{" "}
              {selectedRooms.length < totalRooms
                ? currentRoomNumber
                : totalRooms}{" "}
              / {totalRooms}
            </Text>
            <View style={styles.dateBadge}>
              <AppIcon name="calendar" size={12} color={COLORS.primary} />
              <Text style={styles.dateText}>
                {new Date(checkIn).getDate()}/{new Date(checkIn).getMonth() + 1}{" "}
                - {new Date(checkOut).getDate()}/
                {new Date(checkOut).getMonth() + 1}
              </Text>
            </View>
          </View>
          <Text style={styles.summaryText}>
            {guests} khách | {calculateNights()} đêm
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
                    {(
                      sr.room.discountedPrice ||
                      sr.room.basePricePerNight ||
                      0
                    ).toLocaleString()}
                    đ x {calculateNights()} đêm
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleRemoveRoom(sr.roomNumber)}
                  style={styles.removeButton}
                >
                  <AppIcon name="trash" size={18} color={COLORS.error} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Available Rooms */}
        <View style={styles.availableRoomsSection}>
          <Text style={styles.sectionTitle}>
            Phòng có sẵn ({availableForSelection.length})
          </Text>

          {availableForSelection.length > 0 ? (
            <View style={{ gap: 16 }}>
              {availableForSelection.map((item) => (
                <View key={item.roomId} style={{ width: "100%" }}>
                  {renderRoomItem({ item })}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.noRooms}>
              <AppIcon name="bed" size={40} color={COLORS.gray} />
              <Text style={styles.noRoomsText}>
                {selectedRooms.length >= totalRooms
                  ? "Bạn đã chọn đủ số phòng"
                  : "Không còn phòng nào để chọn"}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      {selectedRooms.length > 0 && (
        <View style={styles.bottomBar}>
          <View style={styles.totalContainer}>
            <Text style={styles.totalLabel}>Tổng cộng</Text>
            <Text style={styles.totalPrice}>
              {calculateTotal().toLocaleString()}đ
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.proceedButton,
              selectedRooms.length < totalRooms && styles.proceedButtonDisabled,
            ]}
            onPress={handleProceedToCheckout}
            disabled={selectedRooms.length < totalRooms}
          >
            <Text style={styles.proceedButtonText}>
              Tiếp tục ({selectedRooms.length}/{totalRooms})
            </Text>
            <AppIcon name="arrow-right" size={20} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      )}

      {/* Use shared RoomDetail component to keep UI consistent */}
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
    fontWeight: "700",
    color: COLORS.secondary,
  },
  scrollContent: {
    flex: 1,
  },
  summarySection: {
    backgroundColor: COLORS.white,
    margin: SIZES.padding,
    padding: 20,
    borderRadius: 20,
    ...SHADOWS.light,
  },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.secondary,
  },
  dateBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF9F2",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  dateText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: "600",
  },
  summaryText: {
    fontSize: 14,
    color: COLORS.gray,
  },
  selectedRoomsSection: {
    backgroundColor: COLORS.white,
    marginHorizontal: SIZES.padding,
    marginBottom: SIZES.padding,
    padding: 20,
    borderRadius: 20,
    ...SHADOWS.light,
  },
  selectedRoomItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F3F5",
  },
  selectedRoomInfo: {
    flex: 1,
  },
  selectedRoomName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.secondary,
    marginBottom: 4,
  },
  selectedRoomPrice: {
    fontSize: 13,
    color: COLORS.gray,
  },
  removeButton: {
    padding: 8,
    backgroundColor: "#FFF5F5",
    borderRadius: 8,
  },
  availableRoomsSection: {
    paddingHorizontal: SIZES.padding,
    paddingBottom: SIZES.padding,
  },
  noRooms: {
    alignItems: "center",
    paddingVertical: 40,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    marginTop: 20,
  },
  noRoomsText: {
    ...FONTS.body3,
    color: COLORS.gray,
    marginTop: 12,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    padding: 20,
    paddingBottom: 100,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    ...SHADOWS.dark,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  totalContainer: {
    flex: 1,
  },
  totalLabel: {
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 2,
  },
  totalPrice: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.primary,
  },
  proceedButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  proceedButtonDisabled: {
    opacity: 0.6,
    backgroundColor: COLORS.gray,
  },
  proceedButtonText: {
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
  imageDots: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.7)",
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
  },
  dotActive: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
    marginHorizontal: 4,
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
  modalNights: {
    fontSize: 14,
    color: COLORS.secondary,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 16,
  },
  modalFooter: {
    flexDirection: "row",
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: "#F1F3F5",
    backgroundColor: COLORS.white,
    gap: 16,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: "center",
    backgroundColor: "#F1F3F5",
    borderRadius: 16,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.secondary,
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 16,
  },
  modalConfirmText: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.white,
  },
});

export default SelectRoomsScreen;
