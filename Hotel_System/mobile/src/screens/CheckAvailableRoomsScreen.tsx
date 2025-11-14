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
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { COLORS, SIZES, FONTS, SHADOWS } from "../constants/theme";
import Icon from 'react-native-vector-icons/FontAwesome';
import { checkAvailableRooms, AvailableRoom } from "../api/roomsApi";

const CheckAvailableRoomsScreen: React.FC = () => {
  const navigation = useNavigation();
  const [checkIn, setCheckIn] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [checkOut, setCheckOut] = useState(
    new Date(Date.now() + 86400000).toISOString().split("T")[0]
  );
  const [guests, setGuests] = useState(1);
  const [availableRooms, setAvailableRooms] = useState<AvailableRoom[]>([]);
  const [loading, setLoading] = useState(false);
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
    <TouchableOpacity style={styles.card}>
      {/* Room Image */}
      <View style={styles.imageContainer}>
        {item.roomImageUrl ? (
          <Image
            source={{ uri: item.roomImageUrl }}
            style={styles.roomImage}
            contentFit="cover"
            onError={(e) =>
              console.log("Image load error:", item.roomImageUrl, e)
            }
            onLoad={() =>
              console.log("Image loaded successfully:", item.roomImageUrl)
            }
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.imagePlaceholderText}>🏨</Text>
          </View>
        )}
        {/* Status Badge */}
        <View style={[styles.statusBadge, { backgroundColor: "#4CAF50" }]}>
          <Text style={styles.statusText}>Còn phòng</Text>
        </View>
      </View>

      {/* Room Info */}
      <View style={styles.content}>
        {/* Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.roomName} numberOfLines={2}>
            {item.roomTypeName || "Unknown Room"}
          </Text>
          <Text style={styles.roomNumber}>Phòng {item.roomNumber || "-"}</Text>
        </View>

        {/* Rating */}
        <View style={styles.ratingSection}>
          <Text style={styles.stars}>{renderStars(4.5)}</Text>
          <Text style={styles.ratingText}>4.5/5</Text>
        </View>

        {/* Description/Features */}
        {item.description && (
          <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>
        )}

        {/* Amenities - Key Features */}
        <View style={styles.amenitiesSection}>
          <View style={styles.amenityBadge}>
            <Text style={styles.amenityText}>📶 Wi-Fi</Text>
          </View>
          <View style={styles.amenityBadge}>
            <Text style={styles.amenityText}>
              🛏️ {item.maxOccupancy || "-"} guests
            </Text>
          </View>
          <View style={styles.amenityBadge}>
            <Text style={styles.amenityText}>🏊 Pool</Text>
          </View>
        </View>

        {/* Price Section */}
        <View style={styles.priceSection}>
          <Text style={styles.priceLabel}>Giá/đêm:</Text>
          <Text style={styles.price}>
            ${Number(item.basePricePerNight || 0).toLocaleString()}
          </Text>
        </View>

        {/* View Details Button */}
        <TouchableOpacity style={styles.detailButton}>
          <Text style={styles.detailButtonText}>Xem chi tiết</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Icon name="arrow-left" size={20} color={COLORS.secondary} />
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
              <Icon
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
              <Icon name="chevron-down" size={16} color={COLORS.gray} />
            </TouchableOpacity>
          </View>

          {/* Check-out Date */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Ngày trả phòng</Text>
            <TouchableOpacity
              style={styles.dateInput}
              onPress={() => setCheckOutPickerVisibility(true)}
            >
              <Icon
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
              <Icon name="chevron-down" size={16} color={COLORS.gray} />
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
                <Icon name="minus" size={16} color={COLORS.primary} />
              </TouchableOpacity>
              <View style={styles.guestCount}>
                <Text style={styles.guestCountText}>{guests}</Text>
                <Text style={styles.guestLabel}>khách</Text>
              </View>
              <TouchableOpacity
                style={styles.guestButton}
                onPress={() => setGuests(Math.min(10, guests + 1))}
              >
                <Icon name="plus" size={16} color={COLORS.primary} />
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
                <Icon name="search" size={18} color={COLORS.white} />
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
                <Icon name="bed" size={48} color="#ccc" />
                <Text style={styles.noResultsText}>Không có phòng phù hợp</Text>
                <Text style={styles.noResultsSubtext}>
                  Thử chọn ngày khác hoặc ít khách hơn
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
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
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  detailButtonText: {
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
});

export default CheckAvailableRoomsScreen;
