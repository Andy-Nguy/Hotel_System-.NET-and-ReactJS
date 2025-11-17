import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { useNavigation } from "@react-navigation/native";
import { COLORS, SIZES, FONTS } from "../constants/theme";
import { getRooms, Room } from "../api/roomsApi";

const { width } = Dimensions.get("window");
import AppIcon from "./AppIcon";
const CARD_WIDTH = width * 0.78;

interface RoomTypeData {
  idloaiPhong: string;
  tenLoaiPhong: string;
  urlAnhPhong?: string;
  moTa?: string;
  minPrice: number;
}

const RoomType: React.FC = () => {
  const navigation = useNavigation();
  const [roomTypes, setRoomTypes] = useState<RoomTypeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRoomTypes();
  }, []);

  const fetchRoomTypes = async () => {
    try {
      setLoading(true);
      setError(null);

      const rooms = await getRooms();

      // Group rooms by loại phòng and get min price for each type
      const roomTypeMap = new Map<string, RoomTypeData>();

      rooms.forEach((room: Room) => {
        const typeId = room.idloaiPhong || "unknown";
        const typeName = room.tenLoaiPhong || "Loại phòng";

        if (!roomTypeMap.has(typeId)) {
          roomTypeMap.set(typeId, {
            idloaiPhong: typeId,
            tenLoaiPhong: typeName,
            urlAnhPhong: room.urlAnhPhong,
            moTa: room.moTa,
            minPrice: room.giaCoBanMotDem || 0,
          });
        } else {
          // Update min price if current room is cheaper
          const existing = roomTypeMap.get(typeId)!;
          if (room.giaCoBanMotDem && room.giaCoBanMotDem < existing.minPrice) {
            existing.minPrice = room.giaCoBanMotDem;
          }
        }
      });

      const typesArray = Array.from(roomTypeMap.values());
      setRoomTypes(typesArray);
    } catch (err) {
      console.error("Error fetching room types:", err);
      setError(err instanceof Error ? err.message : "Không thể tải loại phòng");
      setRoomTypes([]);
    } finally {
      setLoading(false);
    }
  };

  const renderRoomTypeCard = ({ item }: { item: RoomTypeData }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.88}
      onPress={() => {
        (navigation as any).navigate("RoomTypeDetail", {
          idloaiPhong: item.idloaiPhong,
          tenLoaiPhong: item.tenLoaiPhong,
        });
      }}
    >
      {/* Full image card with rounded corners */}
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
            <AppIcon name="image" size={44} color="#e0e0e0" />
          </View>
        )}

        {/* Bottom overlay */}
        <View style={styles.bottomOverlay} />

        {/* Overlay content: title + price */}
        <View style={styles.overlayContent} pointerEvents="none">
          <Text
            style={styles.overlayTitle}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {item.tenLoaiPhong}
          </Text>

          <View style={styles.overlayRow}>
            <Text style={styles.overlayPrice}>
              <Text style={{ fontSize: 14 }}>🏨</Text> Từ{" "}
              {Number(item.minPrice).toLocaleString()} VND
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.sectionTitle}>
        <Text style={styles.span}>Loại Phòng</Text>
        <Text style={styles.h2}>Không gian lưu trú tại Robins Villa</Text>
      </View>

      {roomTypes.length > 0 ? (
        <FlatList
          data={roomTypes}
          renderItem={renderRoomTypeCard}
          keyExtractor={(item) => item.idloaiPhong}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToAlignment="start"
          decelerationRate="fast"
          pagingEnabled={false}
          contentContainerStyle={styles.listContainer}
          scrollEventThrottle={16}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <AppIcon name="bed" size={40} color="#ccc" />
          <Text style={styles.emptyText}>Không có loại phòng</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: SIZES.padding,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: SIZES.padding,
    marginBottom: SIZES.padding,
  },
  title: {
    ...FONTS.h2,
    fontWeight: "700",
    color: COLORS.secondary,
    fontSize: 24,
  },
  listContainer: {
    paddingHorizontal: SIZES.padding,
    gap: 12,
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
    textAlign: "center",
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: COLORS.white,
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 6,
  },
  imageContainer: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#f0f0f0",
    overflow: "hidden",
    position: "relative",
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
  content: {
    padding: SIZES.padding,
  },
  /* New overlay styles (bottom overlay + text) */
  bottomOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "40%",
    backgroundColor: "rgba(0,0,0,0.32)",
  },
  overlayContent: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
  },
  overlayTitle: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: "600",
    letterSpacing: 0.2,
    textShadowColor: "rgba(0,0,0,0.65)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  overlayRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  overlayPrice: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "700",
  },
  roomTypeName: {
    ...FONTS.h4,
    fontWeight: "700",
    color: COLORS.secondary,
    marginBottom: 8,
    fontSize: 16,
  },
  description: {
    ...FONTS.body3,
    color: COLORS.gray,
    marginBottom: 12,
    lineHeight: 18,
    fontSize: 12,
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 12,
    backgroundColor: "#f8f9fa",
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
  },
  priceLabel: {
    ...FONTS.body3,
    color: COLORS.gray,
    marginRight: 4,
    fontSize: 12,
  },
  price: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.primary,
  },
  perNight: {
    ...FONTS.body3,
    color: COLORS.gray,
    marginLeft: 4,
    fontSize: 12,
  },
  viewButton: {
    flexDirection: "row",
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  viewButtonText: {
    color: COLORS.white,
    fontWeight: "600",
    fontSize: 12,
    marginRight: 6,
  },
  loadingContainer: {
    height: 200,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    height: 200,
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
  emptyContainer: {
    height: 150,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SIZES.padding,
  },
  emptyText: {
    ...FONTS.body3,
    color: COLORS.gray,
    marginTop: 8,
  },
});

export default RoomType;
