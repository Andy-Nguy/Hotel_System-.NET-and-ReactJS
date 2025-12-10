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

// === LUXURY COLORS ===
const COLORS = {
  primary: "#0F172A",
  accentGold: "#D4AF37",
  accentGoldLight: "#F5E6B3",
  background: "#F8FAFC",
  cardBg: "rgba(255, 255, 255, 0.95)",
  text: "#1E293B",
  textLight: "#64748B",
  border: "rgba(226, 232, 240, 0.6)",
  error: "#DC2626",
};

const SIZES = { padding: 24, margin: 16, radius: 20, radiusLarge: 28 };

// === FONTS ĐÃ FIX TYPESCRIPT ===
const FONTS = {
  h1: { fontSize: 48, fontWeight: "800" as const },
  h2: { fontSize: 28, fontWeight: "700" as const },
  h3: { fontSize: 22, fontWeight: "600" as const },
  body1: { fontSize: 17, fontWeight: "500" as const },
  body2: { fontSize: 16, fontWeight: "500" as const },
  body3: { fontSize: 15, fontWeight: "400" as const },
} as const;

const ProfileScreen: React.FC = () => {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { logout, userInfo, isLoggedIn } = useAuth();
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const tabBarHeight = useBottomTabBarHeight();

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
        <ActivityIndicator size="large" color={COLORS.accentGold} />
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: tabBarHeight + 40 }}
    >
      {/* Header sang trọng */}
      <LinearGradient
        colors={["#0F172A", "#1E293B", "#334155"]}
        style={styles.header}
      >
        <ImageBackground
          source={{
            uri: "https://images.unsplash.com/photo-1520250497591-1930b33a6002?w=800",
          }}
          style={{ flex: 1 }}
          imageStyle={{ opacity: 0.3 }}
        >
          <View style={styles.headerContent}>
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
              icon: "📋",
              title: "Lịch sử đặt phòng",
              screen: "Trips",
              gradient: [COLORS.accentGold, COLORS.accentGoldLight] as const,
            },
            {
              icon: "🔒",
              title: "Đổi mật khẩu",
              screen: "ChangePassword",
              gradient: [COLORS.primary, "#1E293B"] as const,
            },
          ].map((item, i) => (
            <TouchableOpacity
              key={i}
              style={styles.menuCard}
              activeOpacity={0.8}
              onPress={() => navigation.navigate(item.screen)}
            >
              <LinearGradient
                colors={item.gradient}
                style={styles.menuCardGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.menuIconContainer}>
                  <Text style={styles.menuIcon}>{item.icon}</Text>
                </View>
                <Text
                  style={styles.menuCardTitle}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                >
                  {item.title}
                </Text>
                <View style={styles.menuArrow}>
                  <Text style={styles.menuArrowText}>›</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <LinearGradient
            colors={["#DC2626", "#B91C1C"]}
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
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { ...FONTS.body3, color: COLORS.textLight, marginTop: 16 },

  header: { height: 360 },
  headerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 50,
  },
  avatarWrapper: { marginBottom: 20 },
  goldRing: {
    width: 124,
    height: 124,
    borderRadius: 62,
    backgroundColor: COLORS.accentGold,
    padding: 6,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: COLORS.accentGold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 15,
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
    color: COLORS.primary,
  },
  name: { ...FONTS.h2, color: "#fff", marginTop: 12 },
  email: { ...FONTS.body2, color: "#E2E8F0", marginTop: 4 },
  tierBadge: { alignItems: "center", marginTop: 20 },
  tierText: {
    color: COLORS.accentGoldLight,
    fontSize: 18,
    fontWeight: "700" as const,
  },
  pointsText: { color: "#E2E8F0", fontSize: 15, marginTop: 6 },

  section: { paddingHorizontal: SIZES.padding, marginTop: 24 },
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: SIZES.radiusLarge,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: { ...FONTS.h3, color: COLORS.text },
  editText: { color: COLORS.accentGold, fontWeight: "600" as const },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  infoLabel: { ...FONTS.body3, color: COLORS.textLight },
  infoValue: {
    ...FONTS.body2,
    color: COLORS.text,
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
  actionText: { ...FONTS.body1, color: COLORS.text, flex: 1 },
  arrow: { fontSize: 28, color: COLORS.textLight },

  // New Menu Styles
  menuSection: { paddingHorizontal: SIZES.padding, marginTop: 32 },
  menuTitle: {
    ...FONTS.h3,
    color: COLORS.text,
    marginBottom: 20,
    textAlign: "center",
  },
  menuGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  menuCard: {
    width: "48%",
    height: 160,
    borderRadius: SIZES.radiusLarge,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
  menuCardGradient: {
    flex: 1,
    borderRadius: SIZES.radiusLarge,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  menuIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  menuIcon: { fontSize: 24 },
  menuCardTitle: {
    ...FONTS.body2,
    color: "#fff",
    fontWeight: "600" as const,
    flex: 1,
  },
  menuArrow: {
    alignSelf: "flex-end",
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  menuArrowText: { color: "#fff", fontSize: 18, fontWeight: "bold" },

  logoutButton: {
    height: 60,
    borderRadius: SIZES.radiusLarge,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  logoutGradient: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: SIZES.radiusLarge,
    paddingHorizontal: 24,
  },
  logoutIcon: { fontSize: 24, marginRight: 12 },
  logoutButtonText: {
    color: "#fff",
    fontSize: 18,
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
    color: COLORS.text,
    textAlign: "center",
    marginBottom: 12,
  },
  welcomeSubtitle: {
    ...FONTS.body2,
    color: COLORS.textLight,
    textAlign: "center",
    marginBottom: 40,
  },
  luxuryBtn: {
    backgroundColor: COLORS.accentGold,
    paddingHorizontal: 50,
    paddingVertical: 16,
    borderRadius: 30,
  },
  luxuryBtnText: {
    color: COLORS.primary,
    fontSize: 18,
    fontWeight: "700" as const,
  },
});

export default ProfileScreen;
