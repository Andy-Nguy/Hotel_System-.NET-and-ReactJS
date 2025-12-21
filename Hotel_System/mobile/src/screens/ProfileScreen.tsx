import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  ImageBackground,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import authApi from "../api/authApi";
import { useAuth } from "../context/AuthContext";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { COLORS, SIZES, FONTS, SHADOWS } from "../constants/theme";

const ProfileScreen: React.FC = () => {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { logout, userInfo, isLoggedIn } = useAuth();
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (isFocused && isLoggedIn) loadProfile();
  }, [isFocused, isLoggedIn]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const data = await authApi.getProfile();
      setProfile(data);
    } catch (e) {
      console.log("Load profile error");
    } finally {
      setLoading(false);
    }
  };

  const getDisplayName = () =>
    profile?.name || profile?.hoTen || userInfo?.name || "Khách hàng";
  const getDisplayEmail = () => profile?.email || userInfo?.email || "-";
  const getPhone = () => profile?.soDienThoai || profile?.phone || "-";
  const getPoints = () => profile?.tichDiem || 0;

  const getTier = () => {
    if (getPoints() >= 5000) return { name: "Platinum", color: "#E5E4E2" };
    if (getPoints() >= 2000) return { name: "Gold", color: "#D4AF37" };
    return { name: "Silver", color: "#94A3B8" };
  };
  const tier = getTier();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.warning} />
        <Text style={styles.loadingText}>Đang tải hồ sơ...</Text>
      </View>
    );
  }

  if (!isLoggedIn) {
    return (
      <View style={styles.notLoggedContainer}>
        <Text style={styles.welcomeTitle}>Trải nghiệm dịch vụ đẳng cấp</Text>
        <Text style={styles.welcomeSubtitle}>
          Đăng nhập để nhận ưu đãi riêng
        </Text>
        <TouchableOpacity
          style={styles.luxuryBtn}
          onPress={() => navigation.navigate("Login")}
        >
          <Text style={styles.luxuryBtnText}>Đăng nhập ngay</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 40 }}
      >
        {/* Header sang trọng */}
        <LinearGradient
          colors={[COLORS.secondary, COLORS.primary]}
          style={styles.header}
        >
          <ImageBackground
            source={{
              uri: "https://images.unsplash.com/photo-1520250497591-1930b33a6002?w=800",
            }}
            style={{ flex: 1 }}
            imageStyle={{ opacity: 0.3 }}
          >
            <View
              style={[styles.headerContent, { paddingTop: insets.top + 20 }]}
            >
              <View style={styles.avatarWrapper}>
                <View style={styles.goldRing}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarLetter}>
                      {getDisplayName()[0]?.toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={styles.name}>{getDisplayName()}</Text>
              <Text style={styles.email}>{getDisplayEmail()}</Text>

              <View style={styles.tierBadge}>
                <Text style={styles.tierText}>✦ {tier.name} Member</Text>
                <Text style={styles.pointsText}>
                  {getPoints().toLocaleString()} điểm tích lũy
                </Text>
              </View>
            </View>
          </ImageBackground>
        </LinearGradient>

        {/* Thông tin cá nhân */}
        <View style={styles.section}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.sectionTitle}>Thông tin cá nhân</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate("EditProfile")}
              >
                <Text style={styles.editText}>Chỉnh sửa</Text>
              </TouchableOpacity>
            </View>

            {[
              { label: "Họ và tên", value: getDisplayName() },
              { label: "Email", value: getDisplayEmail() },
              { label: "Số điện thoại", value: getPhone() },
              {
                label: "Điểm tích lũy",
                value: `${getPoints().toLocaleString()} điểm`,
              },
            ].map((item, i) => (
              <View key={i}>
                {i > 0 && <View style={styles.divider} />}
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{item.label}</Text>
                  <Text style={styles.infoValue}>{item.value}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Menu Section */}
        <View style={styles.menuSection}>
          <Text style={styles.menuTitle}>Tài khoản & Dịch vụ</Text>

          <View style={styles.menuGrid}>
            {[
              {
                icon: "🧾",
                title: "Lịch sử đặt phòng",
                screen: "Trips",
                color: COLORS.primary,
              },
              {
                icon: "💳",
                title: "Phương thức thanh toán",
                screen: "Payment",
                color: COLORS.warning,
              },
              {
                icon: "⭐",
                title: "Thẻ thành viên",
                screen: "Loyalty",
                color: COLORS.primary,
              },
              {
                icon: "☎️",
                title: "Hỗ trợ & Liên hệ",
                screen: "Support",
                color: COLORS.gray,
              },
            ].map((item, i) => (
              <TouchableOpacity
                key={i}
                style={styles.menuCard}
                activeOpacity={0.85}
                onPress={() => navigation.navigate(item.screen)}
              >
                <View style={styles.menuCardInner}>
                  <View
                    style={[styles.iconCircle, { backgroundColor: item.color }]}
                  >
                    <Text style={styles.menuIcon}>{item.icon}</Text>
                  </View>
                  <Text style={styles.menuCardTitle}>{item.title}</Text>
                  <View style={styles.menuCardRight}>
                    <Text style={styles.menuArrowText}>›</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Logout Button */}
          <TouchableOpacity style={styles.logoutButton} onPress={logout}>
            <LinearGradient
              colors={[COLORS.error, "#B91C1C"]}
              style={styles.logoutGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.logoutIcon}>🚪</Text>
              <Text style={styles.logoutButtonText}>Đăng xuất</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { ...FONTS.body3, color: COLORS.gray, marginTop: 16 },

  header: { height: 340 },
  headerContent: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: 40,
    paddingBottom: 16,
  },
  avatarWrapper: { marginTop: 8, marginBottom: 20 },
  goldRing: {
    width: 124,
    height: 124,
    borderRadius: 62,
    backgroundColor: COLORS.warning,
    padding: 6,
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.dark,
  },
  avatar: {
    width: "100%",
    height: "100%",
    borderRadius: 56,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarLetter: {
    fontSize: 48,
    fontWeight: "800" as const,
    color: COLORS.secondary,
  },
  name: { ...FONTS.h2, color: "#fff", marginTop: 12 },
  email: { ...FONTS.body2, color: "#E2E8F0", marginTop: 4 },
  tierBadge: { alignItems: "center", marginTop: 20 },
  tierText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "700" as const,
  },
  pointsText: { color: COLORS.lightGray, fontSize: 15, marginTop: 6 },

  section: { paddingHorizontal: SIZES.padding, marginTop: 24 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: Math.max(SIZES.radiusLarge, 12),
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.medium,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: { ...FONTS.h3, color: COLORS.secondary },
  editText: { color: COLORS.warning, fontWeight: "600" as const },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  infoLabel: { ...FONTS.body3, color: COLORS.gray },
  infoValue: {
    ...FONTS.body2,
    color: COLORS.secondary,
    fontWeight: "600" as const,
    textAlign: "right",
  },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 4 },

  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 18,
    borderRadius: SIZES.radius,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 5,
  },
  actionIcon: { fontSize: 26, marginRight: 16 },
  actionText: { ...FONTS.body1, color: COLORS.secondary, flex: 1 },
  arrow: { fontSize: 28, color: COLORS.gray },

  // New Menu Styles
  menuSection: { paddingHorizontal: SIZES.padding, marginTop: 32 },
  menuTitle: {
    ...FONTS.h3,
    color: COLORS.secondary,
    marginBottom: 20,
    textAlign: "center",
  },
  menuGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  menuCard: {
    width: "48%",
    marginBottom: 16,
  },
  menuCardInner: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radiusLarge,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    ...SHADOWS.light,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  menuIcon: { fontSize: 22 },
  menuCardTitle: {
    ...FONTS.body2,
    color: COLORS.secondary,
    fontWeight: "700" as const,
    flex: 1,
  },
  menuCardRight: {
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  menuArrowText: { color: COLORS.gray, fontSize: 18, fontWeight: "bold" },

  logoutButton: {
    height: 56,
    borderRadius: SIZES.radiusLarge,
    ...SHADOWS.medium,
    marginTop: 8,
  },
  logoutGradient: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: SIZES.radiusLarge,
    paddingHorizontal: 24,
  },
  logoutIcon: { fontSize: 22, marginRight: 12 },
  logoutButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "700" as const,
  },

  logoutRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    padding: 18,
    borderRadius: SIZES.radius,
    marginTop: 24,
  },
  logoutText: {
    ...FONTS.body1,
    color: COLORS.error,
    fontWeight: "600" as const,
    flex: 1,
  },

  notLoggedContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  welcomeTitle: {
    ...FONTS.h2,
    color: COLORS.secondary,
    textAlign: "center",
    marginBottom: 12,
  },
  welcomeSubtitle: {
    ...FONTS.body2,
    color: COLORS.gray,
    textAlign: "center",
    marginBottom: 40,
  },
  luxuryBtn: {
    backgroundColor: COLORS.warning,
    paddingHorizontal: 50,
    paddingVertical: 16,
    borderRadius: 30,
  },
  luxuryBtnText: {
    color: COLORS.secondary,
    fontSize: 18,
    fontWeight: "700" as const,
  },
});

export default ProfileScreen;
