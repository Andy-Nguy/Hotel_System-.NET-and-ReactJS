import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { COLORS, SIZES, FONTS, SHADOWS } from "../constants/theme";
import servicesApi, { Service } from "../api/servicesApi";

const cardWidth = Math.round(Dimensions.get("window").width * 0.75);

const Services: React.FC = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigation = useNavigation();
  const { isLoggedIn } = useAuth();

  const loadServices = useCallback(async () => {
    let mounted = true;
    setLoading(true);
    setError(null);
    try {
      const data = await servicesApi.getServices();
      if (!mounted) return;
      setServices(data || []);
    } catch (err: any) {
      console.warn("Failed to load services", err);
      if (mounted) setError(err?.message || String(err));
    } finally {
      if (mounted) setLoading(false);
    }
    // cleanup not necessary here
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await loadServices();
    })();
    return () => {
      mounted = false;
    };
  }, [isLoggedIn]);

  const openDetail = (id?: string) => {
    if (!id) return;
    // @ts-ignore
    navigation.navigate("ServiceDetail", { serviceId: id });
  };

  const renderItem = ({ item }: { item: Service }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => openDetail(item.iddichVu)}
    >
      <Image
        source={{ uri: item.hinhDichVu || undefined }}
        style={styles.cardImage}
        resizeMode="cover"
      />

      <View style={styles.cardContent}>
        <Text numberOfLines={1} style={styles.cardTitle}>
          {item.tenDichVu || "Dịch vụ"}
        </Text>
        {typeof item.tienDichVu === "number" && (
          <Text style={styles.cardPrice}>
            {item.tienDichVu.toLocaleString("vi-VN")} VND
          </Text>
        )}
        {typeof item.thoiLuongUocTinh === "number" && (
          <Text style={styles.cardDuration}>{item.thoiLuongUocTinh} phút</Text>
        )}
      </View>

      {/* Bottom accent stripe */}
      <View style={styles.cardAccent} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.section}>
      <View style={styles.sectionTitle}>
        <Text style={styles.span}>Dịch vụ</Text>
        <Text style={styles.h2}>Sự tinh tế trong từng khoảnh khắc</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} />
      ) : (
        <FlatList
          data={services}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(i) => String(i.iddichVu ?? i.tenDichVu)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: SIZES.padding }}
          ItemSeparatorComponent={() => <View style={{ width: 14 }} />}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    paddingVertical: SIZES.padding * 2.5,
    backgroundColor: COLORS.background,
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
    fontWeight: "600",
    marginTop: 8,
    textAlign: "center",
  },
  card: {
    width: cardWidth,
    backgroundColor: "#1a1a1a",
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  cardImage: {
    width: "100%",
    height: Math.round(cardWidth * 0.6),
    backgroundColor: "#2a2a2a",
  },
  cardContent: {
    padding: SIZES.padding * 1.2,
    paddingBottom: SIZES.padding * 1.5,
  },
  cardTitle: {
    ...FONTS.h4,
    color: COLORS.white,
    marginBottom: 8,
    fontWeight: "600",
  },
  cardPrice: {
    ...FONTS.body4,
    color: "#FFD700",
    fontWeight: "700",
    marginBottom: 6,
  },
  cardDuration: {
    ...FONTS.body5,
    color: "#a0a0a0",
    fontSize: 12,
  },
  cardAccent: {
    height: 6,
    backgroundColor: COLORS.primary,
    width: "100%",
  },
});

export default Services;
