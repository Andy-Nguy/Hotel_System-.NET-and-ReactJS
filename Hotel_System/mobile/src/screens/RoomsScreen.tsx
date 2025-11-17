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
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { getRooms, Room } from "../api/roomsApi";
import { COLORS, SIZES, FONTS, SHADOWS } from "../constants/theme";
import RoomDetail from "../components/RoomDetail";
import RoomSection from "../components/RoomSection";
import DatePickerInput from "../components/DatePickerInput";
import TopRoom from "../components/TopRoom";
import { useNavigation } from "@react-navigation/native";

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
  const [showRoomsDropdown, setShowRoomsDropdown] = useState(false);
  const [showGuestsDropdown, setShowGuestsDropdown] = useState(false);
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [showAllFilters, setShowAllFilters] = useState(true);
  const [filters, setFilters] = useState({
    location: "",
    checkInDate: new Date(),
    checkOutDate: new Date(Date.now() + 86400000),
    rooms: 1,
    guests: 1,
    roomType: "Tất cả",
    stars: "Tất cả",
    priceRange: [0, 10000000],
  });

  useEffect(() => {
    loadRooms();
  }, []);

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
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm phòng..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Inline Filter Section - Vertical Layout */}
      {showAllFilters && (
        <View style={styles.filterBar}>
          {/* Row 1: Check-in & Check-out Dates */}
          <View style={styles.filterRow}>
            <View style={[styles.filterDateGroup, { flex: 1 }]}>
              <DatePickerInput
                label="📅 Nhận"
                value={filters.checkInDate}
                onChange={(date) => setFilters({ ...filters, checkInDate: date })}
                minimumDate={new Date()}
              />
            </View>
            <View style={[styles.filterDateGroup, { flex: 1 }]}>
              <DatePickerInput
                label="📅 Trả"
                value={filters.checkOutDate}
                onChange={(date) => setFilters({ ...filters, checkOutDate: date })}
                minimumDate={filters.checkInDate}
              />
            </View>
          </View>

          {/* Row 2: Rooms & Guests Dropdowns & Advanced Filter Toggle */}
          <View style={styles.filterRow}>
            {/* Rooms Dropdown */}
            <View style={{ flex: 1, zIndex: 200 }}>
              <TouchableOpacity 
                style={styles.filterDropdown}
                onPress={() => {
                  setShowRoomsDropdown(!showRoomsDropdown);
                  setShowGuestsDropdown(false);
                }}
              >
                <Text style={styles.filterDropdownLabel}>🏠 Phòng</Text>
                <View style={styles.filterDropdownContent}>
                  <Text style={styles.filterDropdownValue}>{filters.rooms}</Text>
                  <Text style={[styles.filterDropdownArrow, { transform: [{ rotate: showRoomsDropdown ? '180deg' : '0deg' }] }]}>▼</Text>
                </View>
              </TouchableOpacity>
              
              {showRoomsDropdown && (
                <View style={[styles.dropdownMenu, { width: '100%' }]}>
                  {[1, 2, 3, 4, 5].map((num) => (
                    <TouchableOpacity 
                      key={num}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setFilters({ ...filters, rooms: num });
                        setShowRoomsDropdown(false);
                      }}
                    >
                      <Text style={[styles.dropdownItemText, filters.rooms === num && styles.dropdownItemActive]}>
                        {num} phòng
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Guests Dropdown */}
            <View style={{ flex: 1, zIndex: 100, marginLeft: 8 }}>
              <TouchableOpacity 
                style={styles.filterDropdown}
                onPress={() => {
                  setShowGuestsDropdown(!showGuestsDropdown);
                  setShowRoomsDropdown(false);
                }}
              >
                <Text style={styles.filterDropdownLabel}>👥 Người</Text>
                <View style={styles.filterDropdownContent}>
                  <Text style={styles.filterDropdownValue}>{filters.guests}</Text>
                  <Text style={[styles.filterDropdownArrow, { transform: [{ rotate: showGuestsDropdown ? '180deg' : '0deg' }] }]}>▼</Text>
                </View>
              </TouchableOpacity>
              
              {showGuestsDropdown && (
                <View style={[styles.dropdownMenu, { width: '100%' }]}>
                  {[1, 2, 3, 4, 5, 6].map((num) => (
                    <TouchableOpacity 
                      key={num}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setFilters({ ...filters, guests: num });
                        setShowGuestsDropdown(false);
                      }}
                    >
                      <Text style={[styles.dropdownItemText, filters.guests === num && styles.dropdownItemActive]}>
                        {num} người
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Advanced Filter Toggle */}
            <TouchableOpacity 
              style={styles.advancedFilterToggleBtn}
              onPress={() => setShowAdvancedFilter(!showAdvancedFilter)}
            >
              <Text style={styles.advancedFilterToggleBtnText}>
                {showAdvancedFilter ? "▲" : "▼"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Row 3: Check Availability & Reset Buttons */}
          <View style={[styles.filterRow, { gap: 8 }]}>
            <TouchableOpacity style={[styles.filterCheckButton, { flex: 2 }]}>
              <Text style={styles.filterCheckButtonText}>🔍 Kiểm tra phòng trống</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.filterResetBtn, { flex: 1 }]}
              onPress={() => setFilters({
                location: "",
                checkInDate: new Date(),
                checkOutDate: new Date(Date.now() + 86400000),
                rooms: 1,
                guests: 1,
                roomType: "Tất cả",
                stars: "Tất cả",
                priceRange: [0, 10000000],
              })}
            >
              <Text style={styles.filterResetText}>🔄 Đặt lại</Text>
            </TouchableOpacity>
          </View>

          {/* Row 4: Advanced Filter (Hidden/Shown) */}
          {showAdvancedFilter && (
            <View style={styles.advancedFilterRow}>
              {/* Room Type Tags */}
              <View style={styles.advancedFilterSection}>
                <Text style={styles.advancedFilterSectionTitle}>🛏️ Loại phòng</Text>
                <View style={styles.tagRow}>
                  {["Tất cả", "Phòng đơn", "Phòng đôi", "Phòng gia đình"].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.tag,
                        filters.roomType === type && styles.tagActive,
                      ]}
                      onPress={() => setFilters({ ...filters, roomType: type })}
                    >
                      <Text
                        style={[
                          styles.tagText,
                          filters.roomType === type && styles.tagTextActive,
                        ]}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Stars Tags */}
              <View style={styles.advancedFilterSection}>
                <Text style={styles.advancedFilterSectionTitle}>⭐ Hạng sao</Text>
                <View style={styles.tagRow}>
                  {["Tất cả", "1 ⭐", "2 ⭐", "3 ⭐", "4 ⭐", "5 ⭐"].map((star) => (
                    <TouchableOpacity
                      key={star}
                      style={[
                        styles.tag,
                        filters.stars === star && styles.tagActive,
                      ]}
                      onPress={() => setFilters({ ...filters, stars: star })}
                    >
                      <Text
                        style={[
                          styles.tagText,
                          filters.stars === star && styles.tagTextActive,
                        ]}
                      >
                        {star}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Price Range */}
              <View style={styles.advancedFilterSection}>
                <Text style={styles.advancedFilterSectionTitle}>💰 Khoảng giá (VND)</Text>
                <View style={styles.priceInputRow}>
                  <TextInput
                    style={styles.priceInput}
                    placeholder="Từ"
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                    value={filters.priceRange[0].toString()}
                    onChangeText={(text) =>
                      setFilters({
                        ...filters,
                        priceRange: [parseInt(text) || 0, filters.priceRange[1]],
                      })
                    }
                  />
                  <Text style={styles.priceSeparator}>—</Text>
                  <TextInput
                    style={styles.priceInput}
                    placeholder="Đến"
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                    value={filters.priceRange[1].toString()}
                    onChangeText={(text) =>
                      setFilters({
                        ...filters,
                        priceRange: [filters.priceRange[0], parseInt(text) || 10000000],
                      })
                    }
                  />
                </View>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Collapse/Expand All Filters Button */}
      {!showAllFilters && (
        <TouchableOpacity 
          style={styles.toggleAllFiltersBtn}
          onPress={() => setShowAllFilters(true)}
        >
          <Text style={styles.toggleAllFiltersBtnText}>▼ Hiển thị bộ lọc</Text>
        </TouchableOpacity>
      )}

      {showAllFilters && (
        <TouchableOpacity 
          style={styles.collapseAllFiltersBtn}
          onPress={() => setShowAllFilters(false)}
        >
          <Text style={styles.collapseAllFiltersBtnText}>▲ Ẩn bộ lọc</Text>
        </TouchableOpacity>
      )}

      {/* Room List - TopRoom is now inside as ListHeaderComponent so it scrolls with content */}
      <FlatList
        data={roomTypes}
        renderItem={renderRoomType}
        keyExtractor={(item) => item.loaiPhong}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <View style={[styles.sectionTitle, styles.sectionTitleSpacing]}>
              <Text style={styles.span}>TOP PHÒNG ĐƯỢC ƯA CHUỘNG</Text>
              <Text style={styles.h2}>Chào mừng đến với Robins Villa</Text>
            </View>

            <TopRoom topCount={5} onRoomPress={handleTopRoomPress} />

            <View style={[styles.sectionTitle, styles.sectionTitleSpacing]}>
              <Text style={styles.span}>DANH SÁCH PHÒNG</Text>
              <Text style={styles.h2}>Chào mừng đến với Robins Villa</Text>
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
    fontSize: 18,
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
});

export default RoomsScreen;
