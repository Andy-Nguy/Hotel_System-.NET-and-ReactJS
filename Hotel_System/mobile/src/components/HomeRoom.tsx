import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { getRooms, Room } from "../api/roomsApi";
import { getPrimaryRoomImage } from "../utils/imageUtils";
import { COLORS, SIZES, FONTS, SHADOWS } from "../constants/theme";

const HomeRoom: React.FC = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const data = await getRooms();
      // Filter rooms with rating >= 4
      const filteredRooms = data.filter((r) => Number(r.xepHangSao ?? 0) >= 4);
      setRooms(filteredRooms);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load rooms");
    } finally {
      setLoading(false);
    }
  };

  const renderRoom = ({ item: room }: { item: Room }) => {
    const imageUrl =
      getPrimaryRoomImage(room) ||
      "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800";

    return (
      <ImageBackground
        source={{ uri: imageUrl }}
        style={styles.roomItem}
        imageStyle={styles.roomImage}
      >
        <View style={styles.roomOverlay}>
          <View style={styles.roomText}>
            <Text style={styles.roomName}>
              {room.tenPhong ?? `Room ${room.soPhong ?? ""}`}
            </Text>
            <Text style={styles.roomPrice}>
              {room.giaCoBanMotDem !== undefined && room.giaCoBanMotDem !== null
                ? `$${Number(room.giaCoBanMotDem).toLocaleString()}`
                : "Contact"}
              <Text style={styles.priceLabel}> /Pernight</Text>
            </Text>
            <View style={styles.roomDetails}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Size:</Text>
                <Text style={styles.detailValue}>{room.moTa ?? "-"}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Capacity:</Text>
                <Text style={styles.detailValue}>
                  Max {room.soNguoiToiDa ?? "-"} persons
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Rating:</Text>
                <Text style={styles.detailValue}>
                  {room.xepHangSao ?? "-"} ⭐
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Services:</Text>
                <Text style={styles.detailValue}>Wifi, TV, Bathroom</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.primaryBtn}>
              <Text style={styles.btnText}>More Details</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ImageBackground>
    );
  };

  if (loading) {
    return (
      <View style={styles.section}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading rooms...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.section}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Error: {error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchRooms}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.sectionTitle}>
        <Text style={styles.span}>Our Rooms</Text>
        <Text style={styles.h2}>Featured Rooms</Text>
      </View>

      {rooms.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No rooms with 4+ stars found.</Text>
        </View>
      ) : (
        <View style={styles.listContainer}>
          {rooms.map((item) => (
            <View
              key={item.idphong ?? item.soPhong ?? Math.random().toString()}
            >
              {renderRoom({ item })}
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    paddingVertical: SIZES.padding * 3,
    paddingHorizontal: SIZES.padding,
    backgroundColor: COLORS.white,
  },
  sectionTitle: {
    marginBottom: SIZES.margin * 2,
    alignItems: "center",
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
  },
  listContainer: {
    paddingBottom: SIZES.padding,
  },
  roomItem: {
    width: "100%",
    height: 450,
    marginBottom: SIZES.margin * 1.5,
    borderRadius: SIZES.radiusLarge,
    overflow: "hidden",
  },
  roomImage: {
    borderRadius: SIZES.radiusLarge,
  },
  roomOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.2)",
    justifyContent: "flex-end",
  },
  roomText: {
    backgroundColor: COLORS.overlayDark,
    padding: SIZES.padding * 1.5,
  },
  roomName: {
    ...FONTS.h3,
    color: COLORS.white,
    marginBottom: 10,
  },
  roomPrice: {
    ...FONTS.h1,
    color: COLORS.primary,
    marginBottom: 15,
  },
  priceLabel: {
    ...FONTS.body3,
    color: COLORS.white,
    fontWeight: "400",
  },
  roomDetails: {
    marginBottom: 15,
  },
  detailRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  detailLabel: {
    ...FONTS.body3,
    color: COLORS.primary,
    fontWeight: "600",
    width: 100,
  },
  detailValue: {
    ...FONTS.body3,
    color: COLORS.white,
    flex: 1,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: SIZES.radius,
    alignSelf: "flex-start",
  },
  btnText: {
    color: COLORS.white,
    ...FONTS.body4,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  centerContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SIZES.padding * 3,
  },
  loadingText: {
    ...FONTS.body2,
    color: COLORS.gray,
    marginTop: SIZES.margin,
  },
  errorText: {
    ...FONTS.body2,
    color: COLORS.error,
    textAlign: "center",
    marginBottom: SIZES.margin,
  },
  emptyText: {
    ...FONTS.body2,
    color: COLORS.gray,
    textAlign: "center",
  },
  retryBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: SIZES.radius,
    marginTop: SIZES.margin,
  },
  retryBtnText: {
    color: COLORS.white,
    ...FONTS.body3,
    fontWeight: "700",
  },
});

export default HomeRoom;
