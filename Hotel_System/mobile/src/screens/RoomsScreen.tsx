import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  Modal,
  Dimensions,
  TextInput,
  Pressable,
  ImageBackground,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { getRooms, Room, checkAvailableRooms, AvailableRoom } from "../api/roomsApi";
import { COLORS, SIZES, FONTS, SHADOWS } from "../constants/theme";
import RoomDetail from "../components/RoomDetail";
import RoomSection from "../components/RoomSection";
import DatePickerInput from "../components/DatePickerInput";
import TopRoom from "../components/TopRoom";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import AppIcon from "../components/AppIcon";

interface RoomType {
  loaiPhong: string;
  tenLoaiPhong: string;
  moTa?: string;
  rooms: Room[];
}

const RoomsScreen: React.FC = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Search form states
  const [showSearchForm, setShowSearchForm] = useState(false);
  const [checkIn, setCheckIn] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [checkOut, setCheckOut] = useState(
    new Date(Date.now() + 86400000).toISOString().split("T")[0]
  );
  const [guests, setGuests] = useState(1);
  const [roomsCount, setRoomsCount] = useState(1);
  const [availableRooms, setAvailableRooms] = useState<AvailableRoom[]>([]);
  const [searched, setSearched] = useState(false);
  
  // Date picker states
  const [isCheckInPickerVisible, setCheckInPickerVisibility] = useState(false);
  const [isCheckOutPickerVisible, setCheckOutPickerVisibility] = useState(false);

  useEffect(() => {
    loadRooms();
  }, []);

  // Reset search form and reload data when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      setShowSearchForm(false);
      loadRooms();
    }, [])
  );

  const navigation = useNavigation();

  const loadRooms = async () => {
    try {
      console.log("🔄 Starting to load rooms...");
      setLoading(true);
      setError(null);
      const data = await getRooms();
      console.log("✅ Rooms loaded:", data);
      setRooms(Array.isArray(data) ? data : []);

      // Group rooms by type
      const grouped = new Map<string, RoomType>();
      (Array.isArray(data) ? data : []).forEach((room: Room) => {
        const key = room.idloaiPhong || "Unknown";
        if (!grouped.has(key)) {
          grouped.set(key, {
            loaiPhong: room.idloaiPhong || "Unknown",
            tenLoaiPhong: room.tenLoaiPhong || "Unknown Room Type",
            moTa: room.moTa, // Use room description if available
            rooms: [],
          });
        }
        grouped.get(key)!.rooms.push(room);
      });

      setRoomTypes(Array.from(grouped.values()));
    } catch (e: any) {
      console.error("❌ Failed to load rooms:", e);
      setError(e?.message || "Failed to load rooms");
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRooms();
    setRefreshing(false);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
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
      
      // Auto navigate to SelectRooms screen after successful search
      if (rooms.length > 0) {
        (navigation as any).navigate("SelectRooms", {
          checkIn,
          checkOut,
          guests,
          rooms: roomsCount,
          availableRooms: rooms,
        });
      } else {
        Alert.alert("Thông báo", "Không tìm thấy phòng trống trong khoảng thời gian này.");
      }
    } catch (error) {
      Alert.alert("Lỗi", "Không thể kiểm tra phòng trống. Vui lòng thử lại.");
      setAvailableRooms([]);
      setSearched(false);
    } finally {
      setLoading(false);
    }
  };

  const renderRoomCard = (room: Room) => (
    <RoomSection
      key={room.idphong}
      room={room}
      onPress={() => {
        setSelectedRoom(room);
        setShowDetails(true);
      }}
    />
  );

  const renderRoomType = ({ item }: { item: RoomType }) => (
    <View key={item.loaiPhong} style={styles.roomTypeSection}>
      {item.rooms.map((room) => renderRoomCard(room))}
    </View>
  );

  const handleTopRoomPress = (roomId: string) => {
    // Try to find the full room object from loaded rooms
    const found = rooms.find((r) => r.idphong === roomId || r.idphong === roomId);
    if (found) {
      setSelectedRoom(found);
      setShowDetails(true);
    } else {
      // If not found in current list, navigate to RoomDetail screen with id
      (navigation as any).navigate("RoomDetail", { roomId });
    }
  };

  // Room detail modal is extracted into `RoomDetail.tsx`

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Đang tải phòng...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadRooms}>
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with Logo and Search */}
      <View style={styles.header}>
        <Text style={styles.logo}>ROBINS VILLA</Text>

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

      {/* Room List with Search Form in Header */}
      <FlatList
        data={roomTypes}
        renderItem={renderRoomType}
        keyExtractor={(item) => item.loaiPhong}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* Search Form */}
            <View style={styles.searchForm}>
              <TouchableOpacity 
                onPress={() => setShowSearchForm(!showSearchForm)}
                activeOpacity={0.7}
              >
                <View style={styles.formHeader}>
                  <Text style={styles.formTitle}>Tìm kiếm phòng nghỉ</Text>
                  <AppIcon 
                    name={showSearchForm ? "chevron-up" : "chevron-down"} 
                    size={24} 
                    color={COLORS.primary} 
                  />
                </View>
              </TouchableOpacity>
              
              {showSearchForm && (
              <>
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
                      onPress={() => setRoomsCount(Math.max(1, roomsCount - 1))}
                    >
                      <AppIcon name="minus" size={14} color={COLORS.secondary} />
                    </TouchableOpacity>
                    <Text style={styles.counterValue}>{roomsCount}</Text>
                    <TouchableOpacity
                      style={styles.counterBtn}
                      onPress={() => setRoomsCount(Math.min(10, roomsCount + 1))}
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
              </>
              )}
            </View>

            <View style={[styles.sectionTitle, styles.sectionTitleSpacing]}>
              <Text style={styles.span}>TOP PHÒNG ĐƯỢC ƯA CHUỘNG</Text>
              <Text style={styles.h2}>Phong cách thượng lưu  Điểm nhấn của năm</Text>
            </View>

            <TopRoom topCount={5} onRoomPress={handleTopRoomPress} />

            <View style={[styles.sectionTitle, styles.sectionTitleSpacing]}>
              <Text style={styles.span}>DANH SÁCH PHÒNG</Text>
              <Text style={styles.h2}>Sống sang trọn vẹn</Text>
            </View>
          </>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🚫</Text>
            <Text style={styles.emptyText}>Không có phòng nào</Text>
          </View>
        }
      />

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
    backgroundColor: "#f9f9f9",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  // Header Styles
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SIZES.padding,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    gap: 8,
  },
  sectionTitle: {
    marginBottom: SIZES.margin * 2,
    alignItems: "center",
  },
  // add spacing below section titles when used inside lists
  sectionTitleSpacing: {
    marginBottom: SIZES.padding * 1.5,
  },
  span: {
    ...FONTS.body5,
    color: COLORS.primary,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 8,
  },
  h2: {
    ...FONTS.h2,
    color: COLORS.secondary,
    marginTop: 8,
    textAlign: "center",
  },
  logo: {
    fontSize: 25,
    fontWeight: "700",
    color: "#dfa974",
    letterSpacing: 1,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    borderRadius: 20,
    paddingHorizontal: 12,
    height: 40,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 6,
    color: "#888",
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.secondary,
  },
  // Filter Bar Styles
  filterBar: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    paddingHorizontal: SIZES.padding,
    paddingVertical: 10,
    gap: 10,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    width: "100%",
  },
  filterInputSmall: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: COLORS.secondary,
    backgroundColor: "#f9f9f9",
    minWidth: 120,
  },
  filterDateGroup: {
    flex: 1,
  },
  filterDropdown: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#f9f9f9",
    justifyContent: "center",
    minHeight: 50,
  },
  filterDropdownLabel: {
    fontSize: 11,
    color: "#999",
    fontWeight: "600",
  },
  filterDropdownContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  filterDropdownValue: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.secondary,
  },
  filterDropdownArrow: {
    fontSize: 10,
    color: "#999",
  },
  filterCheckButton: {
    flex: 1,
    backgroundColor: "#dfa974",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  filterCheckButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.white,
  },
  filterResetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    backgroundColor: "#f9f9f9",
    marginTop: 20,
    alignItems: "center",
  },
  filterResetText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#dfa974",
  },
  advancedFilterToggle: {
    paddingVertical: 8,
    alignItems: "center",
  },
  advancedFilterToggleText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#999",
  },
  advancedFilterToggleBtn: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    backgroundColor: "#f9f9f9",
    justifyContent: "center",
    alignItems: "center",
  },
  advancedFilterToggleBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#999",
  },
  toggleAllFiltersBtn: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    paddingHorizontal: SIZES.padding,
    paddingVertical: 10,
    alignItems: "center",
  },
  toggleAllFiltersBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#999",
  },
  collapseAllFiltersBtn: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    paddingHorizontal: SIZES.padding,
    paddingVertical: 10,
    alignItems: "center",
  },
  collapseAllFiltersBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#999",
  },
  advancedFilterRow: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    gap: 10,
  },
  advancedFilterSection: {
    gap: 8,
  },
  advancedFilterSectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.secondary,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 20,
    backgroundColor: "#f9f9f9",
  },
  tagActive: {
    backgroundColor: "#dfa974",
    borderColor: "#dfa974",
  },
  tagText: {
    fontSize: 12,
    color: COLORS.secondary,
    fontWeight: "600",
  },
  tagTextActive: {
    color: COLORS.white,
  },
  priceInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  priceInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: COLORS.secondary,
    backgroundColor: "#f9f9f9",
  },
  priceSeparator: {
    fontSize: 16,
    color: "#999",
    fontWeight: "600",
  },
  dropdownMenu: {
    position: "absolute",
    top: "100%",
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    marginTop: 4,
    zIndex: 1000,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
    minWidth: "100%",
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  dropdownItemText: {
    fontSize: 13,
    color: COLORS.secondary,
    fontWeight: "500",
  },
  dropdownItemActive: {
    fontWeight: "700",
    color: "#dfa974",
  },
  listContainer: {
    paddingVertical: SIZES.padding,
  },
  // Room Type Section
  roomTypeSection: {
    paddingHorizontal: SIZES.padding,
    gap: SIZES.padding,
    marginBottom: SIZES.padding,
  },
  // Room Card Styles
  roomCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: SIZES.padding,
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
    marginBottom: 2,
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
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.gray,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.secondary,
    textAlign: "center",
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: COLORS.white,
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.secondary,
    marginBottom: 6,
  },
  // Search Form Styles (from CheckAvailableRoomsScreen)
  searchForm: {
    backgroundColor: COLORS.white,
    margin: SIZES.padding,
    padding: 20,
    borderRadius: 24,
    marginBottom: 40,
    ...SHADOWS.medium,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  formHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  formTitle: {
    ...FONTS.h3,
    color: COLORS.secondary,
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
    paddingBottom: 20,
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
  continueButton: {
    backgroundColor: COLORS.secondary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  continueButtonText: {
    fontSize: 16,
    color: COLORS.white,
    fontWeight: "700",
  },
});

export default RoomsScreen;
