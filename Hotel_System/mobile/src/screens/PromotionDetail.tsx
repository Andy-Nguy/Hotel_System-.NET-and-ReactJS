import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ImageBackground,
  Dimensions,
  TextInput,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import {
  getPromotions,
  calculateDiscountedPrice,
  getServiceDetails,
} from "../api/promotionApi";
import { getPrimaryRoomImage } from "../utils/imageUtils";
import { checkAvailableRooms, AvailableRoom as ApiAvailableRoom } from "../api/roomsApi";
import { getAmenitiesForRoom } from "../api/amenitiesApi";
import HeaderScreen from "../components/HeaderScreen";
import AppIcon from "../components/AppIcon";
import { COLORS } from "../constants/theme";

const windowWidth = Dimensions.get("window").width;

type PromotionDetailProps = {
  route?: any;
  navigation?: any;
};

interface Promotion {
  idkhuyenMai: string;
  tenKhuyenMai: string;
  moTa?: string;
  loaiGiamGia: string;
  giaTriGiam?: number;
  ngayBatDau: string;
  ngayKetThuc: string;
  trangThai?: string;
  hinhAnhBanner?: string;
  khuyenMaiPhongs?: any[];
}

// Extend the API type to support additional properties from backend
interface AvailableRoom extends Partial<ApiAvailableRoom> {
  idphong?: string;
  tenPhong?: string;
  tenLoaiPhong?: string;
  TenLoaiPhong?: string;
  soPhong?: string;
  SoPhong?: string;
  giaCoBanMotDem?: number;
  GiaCoBanMotDem?: number;
  soNguoiToiDa?: number;
  SoNguoiToiDa?: number;
  urlAnhPhong?: string;
  UrlAnhPhong?: string;
  moTa?: string;
  MoTa?: string;
}

const PromotionDetail: React.FC<PromotionDetailProps> = ({
  route,
  navigation,
}) => {
  const promotionId = route?.params?.promotionId;

  const [promotion, setPromotion] = useState<Promotion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Availability check states
  const [checkIn, setCheckIn] = useState<Date | null>(null);
  const [checkOut, setCheckOut] = useState<Date | null>(null);
  const [guests, setGuests] = useState("1");
  const [showCheckInPicker, setShowCheckInPicker] = useState(false);
  const [showCheckOutPicker, setShowCheckOutPicker] = useState(false);
  const [availableRooms, setAvailableRooms] = useState<AvailableRoom[]>([]);
  const [hasCheckedAvailability, setHasCheckedAvailability] = useState(false);
  const [checking, setChecking] = useState(false);
  const [expandedRoom, setExpandedRoom] = useState<string | null>(null);
  const [roomAmenities, setRoomAmenities] = useState<Map<string, any[]>>(
    new Map()
  );
  const [amenitiesLoading, setAmenitiesLoading] = useState<
    Map<string, boolean>
  >(new Map());

  // Load promotion details
  useEffect(() => {
    const loadPromotion = async () => {
      try {
        setLoading(true);
        setError(null);
        const promotions = await getPromotions();
        const selected = promotions.find((p) => p.idkhuyenMai === promotionId);
        if (selected) {
          setPromotion(selected);
        } else {
          setError("Promotion not found");
        }
      } catch (err: any) {
        console.error("[PromotionDetail] Error loading promotion:", err);
        setError(err?.message || "Failed to load promotion");
      } finally {
        setLoading(false);
      }
    };

    if (promotionId) {
      loadPromotion();
    }
  }, [promotionId]);

  // Format date for display
  const formatDate = (date: Date | null): string => {
    if (!date) return "";
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  // Convert date to ISO string YYYY-MM-DD
  const toISOString = (date: Date): string => {
    return date.toISOString().split("T")[0];
  };

  // Handle check-in date change (modal)
  const handleConfirmCheckIn = (selectedDate: Date) => {
    if (selectedDate) {
      setCheckIn(selectedDate);
      if (checkOut && selectedDate >= checkOut) {
        setCheckOut(null);
      }
    }
    setShowCheckInPicker(false);
  };

  // Handle check-out date change (modal)
  const handleConfirmCheckOut = (selectedDate: Date) => {
    if (selectedDate && checkIn && selectedDate > checkIn) {
      setCheckOut(selectedDate);
    }
    setShowCheckOutPicker(false);
  };

  // Check availability
  const handleCheckAvailability = async () => {
    if (!checkIn || !checkOut) {
      Alert.alert("Lỗi", "Vui lòng chọn ngày nhận và ngày trả phòng");
      return;
    }

    const guestCount = parseInt(guests, 10);
    if (isNaN(guestCount) || guestCount < 1) {
      Alert.alert("Lỗi", "Số khách phải lớn hơn 0");
      return;
    }

    try {
      setChecking(true);
      const checkInStr = toISOString(checkIn);
      const checkOutStr = toISOString(checkOut);

      // Get all available rooms from API
      const allAvailableRooms = await checkAvailableRooms({
        checkIn: checkInStr,
        checkOut: checkOutStr,
        numberOfGuests: guestCount,
      });

      // Filter to only rooms in the promotion
      const promotionRoomIds = new Set(
        promotion?.khuyenMaiPhongs?.map((p: any) => p.idphong) || []
      );

      const filteredRooms = (allAvailableRooms || []).filter((room: any) =>
        promotionRoomIds.has(room.idphong || room.roomId)
      );

      setAvailableRooms(filteredRooms);
      setHasCheckedAvailability(true);
      setExpandedRoom(null);
      setRoomAmenities(new Map());
    } catch (err: any) {
      console.error("[PromotionDetail] Check availability error:", err);
      Alert.alert("Lỗi", err?.message || "Không thể kiểm tra phòng trống");
      setAvailableRooms([]);
      setHasCheckedAvailability(true);
    } finally {
      setChecking(false);
    }
  };

  // Load amenities for room
  const loadAmenities = async (roomId: string) => {
    if (!roomId || roomAmenities.has(roomId)) {
      return;
    }
    try {
      console.log("[PromotionDetail] Loading amenities for room:", roomId);
      setAmenitiesLoading((prev) => new Map(prev).set(roomId, true));
      const amenities = await getAmenitiesForRoom(roomId);
      console.log("[PromotionDetail] Loaded amenities:", amenities);
      setRoomAmenities((prev) => new Map(prev).set(roomId, amenities || []));
      setAmenitiesLoading((prev) => {
        const next = new Map(prev);
        next.delete(roomId);
        return next;
      });
    } catch (err) {
      console.error("[PromotionDetail] Error loading amenities:", err);
      setRoomAmenities((prev) => new Map(prev).set(roomId, []));
      setAmenitiesLoading((prev) => {
        const next = new Map(prev);
        next.delete(roomId);
        return next;
      });
    }
  };

  // Toggle room expansion
  const toggleExpand = (roomId: string) => {
    if (!roomId) return;
    if (expandedRoom === roomId) {
      setExpandedRoom(null);
    } else {
      setExpandedRoom(roomId);
      loadAmenities(roomId);
    }
  };

  // Get minimum date (today)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get minimum checkout date
  const minCheckOut = checkIn ? new Date(checkIn) : null;
  if (minCheckOut) {
    minCheckOut.setDate(minCheckOut.getDate() + 1);
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  if (error || !promotion) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error || "Promotion not found"}</Text>
      </View>
    );
  }

  const isGuestCountValid = parseInt(guests, 10) > 0;
  const isCheckAvailableDisabled =
    !checkIn || !checkOut || !isGuestCountValid || checking;

  // Determine if promotion contains combos so we can hide global title/description
  const combosList =
    (promotion as any)?.khuyenMaiCombos ||
    (promotion as any)?.khuyenMaiCombo ||
    (promotion as any)?.combos ||
    [];

  return (
    <SafeAreaView style={styles.outerContainer}>
      {/* Header */}
      {navigation && (
        <HeaderScreen
          title="Chi tiết khuyến mãi"
          onClose={() => navigation.goBack()}
          leftIcon={
            <AppIcon name="arrow-left" size={24} color={COLORS.secondary} />
          }
        />
      )}
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Banner Image */}
        <View style={styles.bannerContainer}>
          {promotion.hinhAnhBanner ? (
            <ImageBackground
              source={{ uri: promotion.hinhAnhBanner }}
              style={styles.banner}
              resizeMode="cover"
            >
              <View style={styles.overlay} />
            </ImageBackground>
          ) : (
            <View style={[styles.banner, { backgroundColor: "#e0e0e0" }]}>
              <Text style={styles.placeholderText}>No image</Text>
            </View>
          )}
        </View>

        {/* Title (hidden when combos present) */}
        {!(Array.isArray(combosList) && combosList.length > 0) && (
          <Text style={styles.title}>{promotion.tenKhuyenMai}</Text>
        )}

        {/* Status Badge */}
        <View style={styles.statusBadgeContainer}>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  promotion.trangThai === "active"
                    ? "#4CAF50"
                    : promotion.trangThai === "inactive"
                    ? "#FF9800"
                    : "#f44336",
              },
            ]}
          >
            <Text style={styles.statusBadgeText}>
              {promotion.trangThai === "active"
                ? "✓ Đang hoạt động"
                : promotion.trangThai === "inactive"
                ? "⊘ Tạm dừng"
                : "✕ Ngừng"}
            </Text>
          </View>
        </View>

        {/* Description (hidden when combos present) */}
        {(!(Array.isArray(combosList) && combosList.length > 0) && promotion.moTa) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Chi tiết khuyến mãi</Text>
            <Text style={styles.description}>{promotion.moTa}</Text>
          </View>
        )}

        {/* Promotion Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thông tin chi tiết</Text>
          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Loại Giảm</Text>
              <Text style={styles.detailValue}>
                {promotion.loaiGiamGia === "percent"
                  ? `${promotion.giaTriGiam}%`
                  : `${promotion.giaTriGiam?.toLocaleString()} đ`}
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Loại Giảm Giá</Text>
              <Text style={styles.detailValue}>
                {promotion.loaiGiamGia === "percent" ? "Phần trăm" : "Số tiền"}
              </Text>
            </View>
          </View>

          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Ngày Bắt Đầu</Text>
              <Text style={styles.detailValue}>
                {new Date(promotion.ngayBatDau).toLocaleDateString("vi-VN")}
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Ngày Kết Thúc</Text>
              <Text style={styles.detailValue}>
                {new Date(promotion.ngayKetThuc).toLocaleDateString("vi-VN")}
              </Text>
            </View>
          </View>
        </View>

        {/* Promotion Type Specific Content */}
        {(() => {
          const combos =
            (promotion as any)?.khuyenMaiCombos ||
            (promotion as any)?.khuyenMaiCombo ||
            (promotion as any)?.combos ||
            [];
          const promoServices =
            (promotion as any)?.khuyenMaiDichVus ||
            (promotion as any)?.khuyenMaiDichVu ||
            (promotion as any)?.dichVus ||
            null;

          if (Array.isArray(combos) && combos.length > 0) {
            // Render combo list: show services applied with original and discounted totals
            return (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🎁 Combo Dịch Vụ</Text>
                <View style={{ marginBottom: 12 }}>
                  {combos.map((combo: any, idx: number) => {
                    const services =
                      combo.khuyenMaiComboDichVus ||
                      combo.KhuyenMaiComboDichVus ||
                      combo.services ||
                      [];

                    const originalPrice = (services || []).reduce(
                      (sum: number, s: any) =>
                        sum +
                        Number(s.tienDichVu ?? s.TienDichVu ?? s.price ?? 0),
                      0
                    );

                    const promoType = (promotion as any)?.loaiGiamGia;
                    const promoVal = Number((promotion as any)?.giaTriGiam ?? 0);
                    const discountedTotal =
                      promoType === "percent"
                        ? Math.round(originalPrice * (1 - promoVal / 100))
                        : Math.max(0, Math.round(originalPrice - promoVal));

                    return (
                      <View
                        key={combo.idkhuyenMaiCombo ?? combo.IdkhuyenMaiCombo ?? idx}
                        style={{
                          padding: 12,
                          backgroundColor: "#fff",
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: "#eee",
                          marginBottom: 12,
                        }}
                      >
                        {/* Services list */}
                        <View style={{ marginBottom: 8 }}>
                          {(services || []).map((svc: any, si: number) => (
                            <ServiceCardWithImage
                              key={svc.iddichVu ?? svc.IddichVu ?? svc.serviceId ?? si}
                              serviceId={svc.iddichVu || svc.IddichVu || svc.serviceId}
                              serviceData={svc}
                              promotion={promotion}
                            />
                          ))}
                        </View>

                        {/* Totals */}
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <Text style={{ color: "#999" }}>
                            Giá gốc: {originalPrice.toLocaleString()} ₫
                          </Text>
                          <Text style={{ color: "#ff4d4f", fontWeight: "700" }}>
                            {discountedTotal.toLocaleString()} ₫
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          }

          if (Array.isArray(promoServices) && promoServices.length > 0) {
            // Render services list
            return (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🎯 Dịch Vụ Áp Dụng</Text>
                <View style={{ marginBottom: 8 }}>
                  {promoServices.map((m: any, idx: number) => (
                    <ServiceCardWithImage
                      key={m.iddichVu ?? m.IddichVu ?? idx}
                      serviceId={m.iddichVu || m.IddichVu}
                      serviceData={m}
                      promotion={promotion}
                    />
                  ))}
                </View>
              </View>
            );
          }

          // Default: render availability check (rooms)
          return (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🔍 Kiểm Tra Phòng Trống</Text>

              {/* Date Inputs */}
              <View style={styles.datePickerContainer}>
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() => setShowCheckInPicker(true)}
                >
                  <Text style={styles.datePickerLabel}>Nhận phòng</Text>
                  <Text style={styles.datePickerValue}>
                    {formatDate(checkIn) || "Chọn ngày"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() => setShowCheckOutPicker(true)}
                  disabled={!checkIn}
                >
                  <Text style={styles.datePickerLabel}>Trả phòng</Text>
                  <Text style={styles.datePickerValue}>
                    {formatDate(checkOut) || "Chọn ngày"}
                  </Text>
                </TouchableOpacity>
              </View>

              <DateTimePickerModal
                isVisible={showCheckInPicker}
                mode="date"
                date={checkIn || today}
                onConfirm={(date) => handleConfirmCheckIn(date)}
                onCancel={() => setShowCheckInPicker(false)}
                minimumDate={today}
                display={Platform.OS === "ios" ? "spinner" : "default"}
                locale="vi-VN"
              />

              <DateTimePickerModal
                isVisible={showCheckOutPicker}
                mode="date"
                date={checkOut || minCheckOut || today}
                onConfirm={(date) => handleConfirmCheckOut(date)}
                onCancel={() => setShowCheckOutPicker(false)}
                minimumDate={minCheckOut || today}
                display={Platform.OS === "ios" ? "spinner" : "default"}
                locale="vi-VN"
              />

              {/* Guest Count */}
              <View style={styles.guestCountContainer}>
                <Text style={styles.datePickerLabel}>Số khách</Text>
                <View style={styles.guestCountInput}>
                  <TouchableOpacity
                    onPress={() => {
                      const count = Math.max(1, parseInt(guests, 10) - 1);
                      setGuests(count.toString());
                    }}
                    style={styles.guestCountButton}
                  >
                    <Text style={styles.guestCountButtonText}>−</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={styles.guestCountText}
                    value={guests}
                    onChangeText={(text) => {
                      const num = parseInt(text, 10);
                      if (!isNaN(num) && num > 0) {
                        setGuests(num.toString());
                      }
                    }}
                    keyboardType="number-pad"
                  />
                  <TouchableOpacity
                    onPress={() => {
                      const count = parseInt(guests, 10) + 1;
                      setGuests(count.toString());
                    }}
                    style={styles.guestCountButton}
                  >
                    <Text style={styles.guestCountButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Check Button */}
              <TouchableOpacity
                style={[
                  styles.checkButton,
                  isCheckAvailableDisabled && styles.checkButtonDisabled,
                ]}
                onPress={handleCheckAvailability}
                disabled={isCheckAvailableDisabled}
              >
                {checking ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.checkButtonText}>
                    Kiểm Tra Phòng Trống
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          );
        })()}

        {/* Room List */}
        {hasCheckedAvailability && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Danh sách phòng khuyến mãi</Text>

            {availableRooms.length === 0 && !checking && checkIn && checkOut ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  ❌ Không có phòng trống cho khoảng thời gian đã chọn
                </Text>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {availableRooms.map((room) => {
                  const roomId = room.idphong || room.roomId || "";
                  // Try multiple field names for room name/type
                  const roomName =
                    room.tenLoaiPhong ||
                    room.TenLoaiPhong ||
                    room.tenPhong ||
                    room.roomNumber ||
                    "Phòng không xác định";
                  const roomNumber = room.soPhong || room.SoPhong || "";
                  const originalPrice =
                    room.giaCoBanMotDem ||
                    room.basePricePerNight ||
                    room.GiaCoBanMotDem ||
                    0;
                  const maxGuests =
                    room.soNguoiToiDa ||
                    room.maxOccupancy ||
                    room.SoNguoiToiDa ||
                    0;
                  const description =
                    room.moTa || room.description || room.MoTa || "";
                  const imageUrl = getPrimaryRoomImage(room) || "";

                  // Calculate discounted price
                  const discountPercent =
                    promotion?.loaiGiamGia === "percent"
                      ? Number(promotion.giaTriGiam || 0)
                      : 0;
                  const discountedPrice = Math.round(
                    originalPrice * (1 - discountPercent / 100)
                  );

                  return (
                    <View
                      key={roomId}
                      style={[
                        styles.roomCardContainer,
                        expandedRoom === roomId && styles.roomCardExpanded,
                      ]}
                    >
                      {/* Room Header with Image and Basic Info */}
                      <TouchableOpacity
                        style={styles.roomHeaderSection}
                        onPress={() => roomId && toggleExpand(roomId)}
                        activeOpacity={0.7}
                      >
                        {/* Room Image */}
                        <View style={styles.roomImageContainer}>
                          {imageUrl ? (
                            <ImageBackground
                              source={{ uri: imageUrl }}
                              style={styles.roomImage}
                              resizeMode="cover"
                            />
                          ) : (
                            <View
                              style={[
                                styles.roomImage,
                                { backgroundColor: "#e0e0e0" },
                              ]}
                            >
                              <Text style={styles.noImageText}>
                                Không có ảnh
                              </Text>
                            </View>
                          )}
                        </View>

                        {/* Room Info */}
                        <View style={styles.roomInfoSection}>
                          {/* Room Name and Number */}
                          <View style={styles.roomNameRow}>
                            <Text style={styles.roomNameText}>
                              {roomName}
                              {roomNumber ? ` - ${roomNumber}` : ""}
                            </Text>
                          </View>

                          {/* Room Meta */}
                          <Text style={styles.roomMetaInfo} numberOfLines={2}>
                            {maxGuests ? `👥 Tối đa ${maxGuests} người` : "—"}
                            {" • "}
                            💰 {originalPrice.toLocaleString()} ₫/đêm
                            {discountPercent > 0 && (
                              <>
                                {" • "}
                                <Text style={styles.discountedPrice}>
                                  🎉 {discountedPrice.toLocaleString()} ₫
                                </Text>
                              </>
                            )}
                          </Text>
                        </View>

                        {/* Expand Icon */}
                        <View style={styles.expandButtonContainer}>
                          <Text style={styles.expandIconText}>
                            {expandedRoom === roomId ? "▼" : "▶"}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      {/* Expanded Details */}
                      {expandedRoom === roomId && (
                        <View style={styles.expandedDetailsSection}>
                          {/* Full Image */}
                          {imageUrl && (
                            <View style={styles.fullImageContainer}>
                              <ImageBackground
                                source={{ uri: imageUrl }}
                                style={styles.fullImage}
                                resizeMode="contain"
                              />
                            </View>
                          )}

                          {/* Description */}
                          {description && (
                            <Text style={styles.descriptionText}>
                              {description}
                            </Text>
                          )}

                          {/* Info Grid */}
                          <View style={styles.infoGrid}>
                            {/* Box 1: Thông tin */}
                            <View style={styles.infoBox}>
                              <Text style={styles.infoBoxTitle}>
                                📊 Thông tin
                              </Text>
                              <Text style={styles.infoBoxContent}>
                                Sức chứa:{" "}
                                <Text style={styles.infoBoxBold}>
                                  {maxGuests} người
                                </Text>
                                {"\n"}
                                Giá gốc:{" "}
                                <Text style={styles.infoBoxBold}>
                                  {originalPrice.toLocaleString()} ₫
                                </Text>
                                {discountPercent > 0 && (
                                  <>
                                    {"\n"}
                                    <Text style={styles.discountedPriceBox}>
                                      Giá KM: {discountedPrice.toLocaleString()}{" "}
                                      ₫
                                    </Text>
                                  </>
                                )}
                              </Text>
                            </View>

                            {/* Box 2: Tiện ích */}
                            <View style={styles.infoBox}>
                              <Text style={styles.infoBoxTitle}>
                                ✨ Tiện ích
                              </Text>
                              <AmenitiesDisplay
                                roomId={roomId}
                                amenities={roomAmenities.get(roomId) || []}
                                loading={amenitiesLoading.get(roomId) || false}
                              />
                            </View>
                          </View>

                          {/* Book Button */}
                          <TouchableOpacity
                            style={styles.bookButtonLarge}
                            onPress={() => {
                              const bookingInfo = {
                                selectedRooms: [
                                  {
                                    roomNumber: 1,
                                    room,
                                  },
                                ],
                                checkIn: toISOString(checkIn!),
                                checkOut: toISOString(checkOut!),
                                guests: parseInt(guests, 10),
                                totalRooms: 1,
                                promotion: promotion
                                  ? {
                                      idkhuyenMai: promotion.idkhuyenMai,
                                      tenKhuyenMai: promotion.tenKhuyenMai,
                                      loaiGiamGia: promotion.loaiGiamGia,
                                      giaTriGiam: promotion.giaTriGiam,
                                    }
                                  : null,
                              };
                              Alert.alert(
                                "Booking",
                                `Đặt ${roomName} từ ${formatDate(
                                  checkIn
                                )} đến ${formatDate(checkOut)}`
                              );
                            }}
                          >
                            <Text style={styles.bookButtonLargeText}>
                              💳 Đặt phòng ngay
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
  },
  bannerContainer: {
    marginVertical: 12,
    borderRadius: 12,
    overflow: "hidden",
  },
  banner: {
    width: "100%",
    height: 280,
    justifyContent: "center",
    alignItems: "center",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
  },
  placeholderText: {
    color: "#999",
    fontSize: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111",
    marginVertical: 12,
  },
  statusBadgeContainer: {
    marginVertical: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  statusBadgeText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  section: {
    marginVertical: 16,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111",
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  detailsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  detailItem: {
    flex: 1,
    paddingHorizontal: 8,
  },
  detailLabel: {
    fontSize: 12,
    color: "#999",
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111",
  },
  datePickerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  datePickerButton: {
    flex: 1,
    marginHorizontal: 6,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  datePickerLabel: {
    fontSize: 12,
    color: "#999",
    fontWeight: "600",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  datePickerValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111",
  },
  guestCountContainer: {
    marginBottom: 12,
  },
  guestCountInput: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  guestCountButton: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  guestCountButtonText: {
    fontSize: 24,
    fontWeight: "600",
    color: "#111",
  },
  guestCountText: {
    flex: 1,
    marginHorizontal: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    fontSize: 16,
    fontWeight: "600",
    color: "#111",
    textAlign: "center",
  },
  checkButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "#007AFF",
    borderRadius: 8,
    alignItems: "center",
    marginTop: 12,
  },
  checkButtonDisabled: {
    backgroundColor: "#ccc",
  },
  checkButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  emptyState: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: "#fdeaea",
    borderRadius: 8,
    alignItems: "center",
  },
  emptyStateText: {
    fontSize: 14,
    color: "#c0392b",
    fontWeight: "500",
    textAlign: "center",
  },
  roomCard: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    overflow: "hidden",
  },
  roomCardContainer: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  roomCardExpanded: {
    borderColor: "#1890ff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  roomHeaderSection: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12,
    backgroundColor: "#fafafa",
  },
  roomImageContainer: {
    width: 140,
    height: 100,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#f0f0f0",
    flexShrink: 0,
  },
  roomImage: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  noImageText: {
    color: "#999",
    fontSize: 12,
  },
  roomInfoSection: {
    flex: 1,
    minWidth: 0,
  },
  roomNameRow: {
    marginBottom: 6,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  roomNameText: {
    fontWeight: "700",
    fontSize: 15,
    color: "#333",
    flexWrap: "wrap",
    flex: 1,
  },
  roomMetaInfo: {
    color: "#666",
    fontSize: 12,
    lineHeight: 16,
  },
  discountedPrice: {
    color: "#ff4d4f",
    fontWeight: "bold",
  },
  expandButtonContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  expandIconText: {
    fontSize: 12,
    color: "#999",
    fontWeight: "600",
  },
  expandedDetailsSection: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  fullImageContainer: {
    width: "100%",
    height: 300,
    marginBottom: 12,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#f9f9f9",
  },
  fullImage: {
    width: "100%",
    height: "100%",
  },
  descriptionText: {
    fontSize: 13,
    color: "#555",
    lineHeight: 18,
    marginBottom: 12,
  },
  infoGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  infoBox: {
    flex: 1,
    padding: 12,
    backgroundColor: "#f5f7fa",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e8eff7",
  },
  infoBoxTitle: {
    fontWeight: "600",
    marginBottom: 8,
    fontSize: 13,
    color: "#333",
  },
  infoBoxContent: {
    color: "#666",
    fontSize: 13,
    lineHeight: 18,
  },
  infoBoxBold: {
    fontWeight: "700",
    color: "#333",
  },
  discountedPriceBox: {
    color: "#ff4d4f",
    fontWeight: "bold",
  },
  bookButtonLarge: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#dfa974",
    borderRadius: 8,
    alignItems: "center",
    marginTop: 12,
  },
  bookButtonLargeText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  errorText: {
    fontSize: 16,
    color: "#d00",
    textAlign: "center",
    marginTop: 24,
  },
});

// Amenities Display Component
interface AmenitiesDisplayProps {
  roomId: string;
  amenities: any[];
  loading?: boolean;
}

const AmenitiesDisplay: React.FC<AmenitiesDisplayProps> = ({
  roomId,
  amenities,
  loading = false,
}) => {
  if (loading) {
    return <Text style={{ color: "#666", fontSize: 12 }}>Đang tải...</Text>;
  }

  if (!amenities || amenities.length === 0) {
    return <Text style={{ color: "#666", fontSize: 12 }}>—</Text>;
  }

  return (
    <View
      style={
        {
          display: "flex",
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 6,
        } as any
      }
    >
      {amenities.map((amenity: any) => (
        <View
          key={amenity.idtienNghi || amenity.tenTienNghi}
          style={{
            backgroundColor: "#f1f5f9",
            paddingVertical: 4,
            paddingHorizontal: 8,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#e2e8f0",
            marginRight: 6,
            marginBottom: 6,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              color: "#111827",
              fontWeight: "500",
            }}
          >
            {amenity.tenTienNghi || amenity.idtienNghi}
          </Text>
        </View>
      ))}
    </View>
  );
};

// Service Card Component with Image loaded from backend
interface ServiceCardProps {
  serviceId: string;
  serviceData: any;
  promotion: Promotion | null;
}

const ServiceCardWithImage: React.FC<ServiceCardProps> = ({
  serviceId,
  serviceData,
  promotion,
}) => {
  const [serviceInfo, setServiceInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadServiceInfo();
  }, [serviceId]);

  const loadServiceInfo = async () => {
    try {
      setLoading(true);
      if (serviceId) {
        const details = await getServiceDetails(serviceId);
        setServiceInfo(details);
      }
    } catch (err) {
      console.error("Error loading service info:", err);
    } finally {
      setLoading(false);
    }
  };

  const svc =
    serviceInfo ||
    serviceData.service ||
    serviceData.dichVu ||
    serviceData.serviceDetail ||
    serviceData;
  const name =
    svc?.tenDichVu ||
    svc?.TenDichVu ||
    svc?.name ||
    serviceData.tenDichVu ||
    serviceData.TenDichVu ||
    `Dịch vụ`;
  const image = svc?.hinhDichVu || svc?.HinhDichVu || svc?.image || null;
  const original = Number(
    svc?.tienDichVu ?? svc?.TienDichVu ?? svc?.price ?? 0
  );
  const promoType = promotion?.loaiGiamGia;
  const promoVal = Number(promotion?.giaTriGiam ?? 0);
  const discounted = calculateDiscountedPrice(
    original,
    promoType || "percent",
    promoVal
  );
  const discountPercent =
    promoType === "percent"
      ? promoVal
      : (((original - discounted) / original) * 100).toFixed(0);

  return (
    <View
      style={{
        padding: 12,
        backgroundColor: "#fff",
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#eee",
        marginBottom: 12,
        flexDirection: "row",
        gap: 12,
      }}
    >
      {/* Service Image */}
      <View
        style={{
          width: 100,
          height: 100,
          borderRadius: 8,
          overflow: "hidden",
          backgroundColor: "#f0f0f0",
          flexShrink: 0,
        }}
      >
        {loading ? (
          <View
            style={{
              width: "100%",
              height: "100%",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <ActivityIndicator size="small" color="#999" />
          </View>
        ) : image ? (
          <Image
            source={{ uri: image }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            onError={(e) => console.log("Service image load error:", image, e)}
          />
        ) : (
          <View
            style={{
              width: "100%",
              height: "100%",
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: "#e0e0e0",
            }}
          >
            <Text style={{ fontSize: 24 }}>🎁</Text>
          </View>
        )}
      </View>

      {/* Service Info */}
      <View style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 6,
          }}
        >
          <Text
            style={{
              fontWeight: "600",
              fontSize: 15,
              flex: 1,
              paddingRight: 8,
            }}
          >
            {name}
          </Text>
          {promoVal > 0 && (
            <View
              style={{
                backgroundColor: "#ff4d4f",
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 4,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>
                -{discountPercent}%
              </Text>
            </View>
          )}
        </View>

        {original > 0 && (
          <View style={{ marginTop: 6 }}>
            <Text
              style={{
                color: "#999",
                marginBottom: 4,
                textDecorationLine:
                  original !== discounted ? "line-through" : "none",
                fontSize: 13,
              }}
            >
              {original.toLocaleString()} ₫
            </Text>
            {original !== discounted && (
              <Text
                style={{ color: "#ff4d4f", fontWeight: "700", fontSize: 15 }}
              >
                {discounted?.toLocaleString()} ₫
              </Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
};

export default PromotionDetail;
