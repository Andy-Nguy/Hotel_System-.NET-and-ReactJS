import React, { useEffect, useState } from "react";
import { COLORS, SIZES, FONTS } from "../constants/theme";
import {
  View,
  Text,
  ImageBackground,
  StyleSheet,
  TouchableOpacity,
  GestureResponderEvent,
  ViewStyle,
  TextStyle,
  ImageBackgroundProps,
  FlatList,
  Dimensions,
} from "react-native";

type Props = {
  imageUri?: string;
  title?: string;
  onDetailsPress?: (e: GestureResponderEvent) => void;
  containerStyle?: ViewStyle;
  promotionId?: string;
  navigation?: any;
};

import { getPromotions } from "../api/promotionApi";

const Promotion: React.FC<Props> = ({
  imageUri,
  title,
  onDetailsPress,
  // onRegisterPress,
  containerStyle,
  promotionId,
  navigation,
}) => {
  const [remotePromos, setRemotePromos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      // always fetch latest promotions so component has accurate data
      setLoading(true);
      console.log("[Promotion] Starting to fetch promotions...");
      try {
        const data = await getPromotions();
        console.log("[Promotion] Fetched data:", data);
        if (!mounted) return;
        if (Array.isArray(data) && data.length > 0) {
          // only keep promotions that are currently active
          const activePromos = data.filter((p: any) => String(p.trangThai || p.status || "").toLowerCase() === "active");
          console.log("[Promotion] Active promos count:", activePromos.length);
          setRemotePromos(activePromos);
        } else {
          console.log("[Promotion] No promotions found or data is not array");
        }
      } catch (err: any) {
        if (!mounted) return;
        console.error("[Promotion] Error fetching:", err);
        setError(err?.message || String(err));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [imageUri, title]);

  // Use list of promos from backend, fallback to props if provided
  const promos = remotePromos && remotePromos.length > 0 ? remotePromos : [];

        console.log("[Promotion] render - promos count:", promos.length, "loading:", loading, "error:", error);

        // Loading placeholder
        if (loading) {
          return (
            <View
              style={[
                styles.wrap,
                containerStyle,
                {
                  justifyContent: "center",
                  alignItems: "center",
                  backgroundColor: "#f0f0f0",
                },
              ]}
            >
              <Text style={styles.debugText}>⏳ Loading promotions...</Text>
            </View>
          );
        }

        // Error placeholder
        if (error) {
          return (
            <View
              style={[
                styles.wrap,
                containerStyle,
                {
                  justifyContent: "center",
                  alignItems: "center",
                  backgroundColor: "#fdd",
                },
              ]}
            >
              <Text style={[styles.debugText, { color: "#d00" }]}>❌ Error loading promotions:</Text>
              <Text style={[styles.debugText, { color: "#d00", fontSize: 12 }]}>{error}</Text>
            </View>
          );
        }

        // No promos from backend: if props provided, show a single promo card, else show empty state
        const hasPropsData = (imageUri && imageUri.length > 0) || (title && title.length > 0);
        if (promos.length === 0 && !hasPropsData) {
          return (
            <View
              style={[
                styles.wrap,
                containerStyle,
                {
                  justifyContent: "center",
                  alignItems: "center",
                  backgroundColor: "#f9f9f9",
                },
              ]}
            >
              <Text style={styles.debugText}>ℹ️ No promotions available</Text>
              <Text style={[styles.debugText, { fontSize: 12, color: "#666" }]}>Check backend database</Text>
            </View>
          );
        }

        const windowWidth = Dimensions.get("window").width;

        const renderCard = (item: any, index?: number) => {
          const imageSrcRaw = item?.hinhAnhBanner || imageUri;
          const imageSrc = imageSrcRaw ? String(imageSrcRaw) : null;
          const titleText = item?.tenKhuyenMai ? String(item.tenKhuyenMai) : (title ? String(title) : "");

          return (
            <TouchableOpacity
              key={item?.idkhuyenMai ?? index}
              activeOpacity={0.9}
              onPress={() => {
                if (onDetailsPress) {
                  onDetailsPress({} as GestureResponderEvent);
                } else if (navigation && item?.idkhuyenMai) {
                  navigation.navigate("PromotionDetail", { promotionId: item.idkhuyenMai });
                }
              }}
            >
              <View style={[styles.wrap, { width: windowWidth - 32 }, containerStyle]}>
                <ImageBackground source={imageSrc ? { uri: imageSrc } : undefined} style={styles.bg} imageStyle={styles.imageStyle} resizeMode="cover">
                  <View style={styles.overlay} />
                  <View style={styles.content} pointerEvents="box-none">
                    <Text numberOfLines={3} style={styles.title}>{String(titleText)}</Text>
                    {/* description intentionally removed */}
                  </View>
                </ImageBackground>
              </View>
            </TouchableOpacity>
          );
        };

        return (
          <View style={styles.sectionTitle}>
            <Text style={styles.span}>Khuyến mãi</Text>
            <Text style={styles.h2}>Ưu đãi đặc biệt</Text>

            {promos.length > 0 ? (
              <FlatList
                data={promos}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item, idx) => (item?.idkhuyenMai ? String(item.idkhuyenMai) : String(idx))}
                renderItem={({ item, index }) => renderCard(item, index)}
                contentContainerStyle={{ paddingHorizontal: 16 }}
                // add spacing between items
                ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
              />
              ) : (
              // fallback to single card from props
              renderCard({ hinhAnhBanner: imageUri, tenKhuyenMai: title })
            )}
          </View>
        );
      };

      const styles = StyleSheet.create({
        wrap: {
          width: "100%",
          aspectRatio: 16 / 9,
          borderRadius: 14,
          overflow: "hidden",
          backgroundColor: "#000",
          marginVertical: 12,
          // shadow (iOS)
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.3,
          shadowRadius: 10,
          // elevation (Android)
          elevation: 6,
        },
  sectionTitle: {
    paddingTop: SIZES.padding * 3,
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
    marginBottom: 20,
  },
  bg: {
    flex: 1,
    justifyContent: "flex-end",
  },
  imageStyle: {
    borderRadius: 14,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.38)",
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  title: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "700",
    lineHeight: 36,
    marginBottom: 8,
  } as TextStyle,
  description: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    marginBottom: 14,
  } as TextStyle,
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    marginHorizontal: 6,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  } as ViewStyle,
  outlineButton: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "#fff",
  } as ViewStyle,
  filledButton: {
    backgroundColor: "#fff",
  } as ViewStyle,
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  } as TextStyle,
  outlineButtonText: {
    color: "#fff",
  } as TextStyle,
  filledButtonText: {
    color: "#111",
  } as TextStyle,
  debugText: {
    color: "#333",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  } as TextStyle,
});

export default Promotion;
