import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import authApi from "../api/authApi";
import { useAuth } from "../context/AuthContext";
import { COLORS, SIZES, FONTS, SHADOWS } from "../constants/theme";

const ProfileScreen: React.FC = () => {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { logout, userInfo, isLoggedIn } = useAuth();
  const navigation = useNavigation();
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused && isLoggedIn) {
      loadProfile();
    }
  }, [isFocused, isLoggedIn]);

  const loadProfile = async () => {
    try {
      console.log("ProfileScreen: loading profile...");
      setLoading(true);
      const data = await authApi.getProfile();
      console.log("ProfileScreen: got profile:", data);
      setProfile(data);
    } catch (e) {
      console.error("ProfileScreen: error fetching profile", e);
      // fallback: try decode token
      const token = await AsyncStorage.getItem("hs_token");
      if (token) {
        try {
          const base64Payload = token.split(".")[1];
          const decoded = decodeURIComponent(
            atob(base64Payload)
              .split("")
              .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
              .join("")
          );
          setProfile(JSON.parse(decoded));
        } catch (e) {
          console.error("Error decoding token:", e);
          // show user-friendly message
          // eslint-disable-next-line no-alert
          alert("Không thể tải thông tin tài khoản. Vui lòng thử lại.");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigation.navigate("Home" as never);
  };

  const getDisplayName = () => {
    return (
      profile?.name ||
      profile?.hoTen ||
      profile?.HoTen ||
      profile?.["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"] ||
      userInfo?.name ||
      "User"
    );
  };

  const getDisplayEmail = () => {
    return (
      profile?.email ||
      profile?.Email ||
      profile?.eMail ||
      profile?.["emailAddress"] ||
      profile?.[
        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"
      ] ||
      userInfo?.email ||
      "-"
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  // If user is not logged in, show prompt to login/register
  if (!isLoggedIn) {
    return (
      <View style={styles.notLoggedContainer}>
        <Text style={styles.notLoggedTitle}>Bạn chưa đăng nhập</Text>
        <Text style={styles.notLoggedSubtitle}>
          Vui lòng đăng nhập để xem thông tin tài khoản
        </Text>

        <View style={styles.notLoggedActions}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.navigate("Login" as never)}
          >
            <Text style={styles.primaryBtnText}>Đăng nhập</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkBtn}
            onPress={() => navigation.navigate("Register" as never)}
          >
            <Text style={styles.linkBtnText}>Đăng ký</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {getDisplayName()[0]?.toUpperCase()}
            </Text>
          </View>
        </View>
        <Text style={styles.name}>{getDisplayName()}</Text>
        <Text style={styles.email}>{getDisplayEmail()}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Thông tin cá nhân</Text>

        <View style={styles.infoCard}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Họ tên</Text>
            <Text style={styles.infoValue}>{getDisplayName()}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{getDisplayEmail()}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Số điện thoại</Text>
            <Text style={styles.infoValue}>
              {profile?.soDienThoai ||
                profile?.Sodienthoai ||
                profile?.phone ||
                "-"}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Ngày sinh</Text>
            <Text style={styles.infoValue}>
              {profile?.ngaySinh ||
                profile?.Ngaysinh ||
                profile?.birthday ||
                "-"}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Hành động</Text>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate("Bookings" as never)}
        >
          <Text style={styles.actionIcon}>📋</Text>
          <Text style={styles.actionText}>Lịch sử đặt phòng</Text>
          <Text style={styles.actionArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={loadProfile}>
          <Text style={styles.actionIcon}>🔄</Text>
          <Text style={styles.actionText}>Làm mới thông tin</Text>
          <Text style={styles.actionArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.logoutButton]}
          onPress={handleLogout}
        >
          <Text style={styles.actionIcon}>🚪</Text>
          <Text style={styles.logoutText}>Đăng xuất</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
  loadingText: {
    ...FONTS.body3,
    color: COLORS.gray,
    marginTop: SIZES.margin,
  },
  header: {
    backgroundColor: COLORS.primary,
    paddingVertical: SIZES.padding * 3,
    paddingHorizontal: SIZES.padding,
    alignItems: "center",
  },
  avatarContainer: {
    marginBottom: SIZES.margin * 1.5,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.white,
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.medium,
  },
  avatarText: {
    ...FONTS.h1,
    color: COLORS.primary,
    fontWeight: "700",
  },
  name: {
    ...FONTS.h3,
    color: COLORS.white,
    marginBottom: 8,
  },
  email: {
    ...FONTS.body3,
    color: COLORS.white,
    opacity: 0.9,
  },
  section: {
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding * 1.5,
  },
  sectionTitle: {
    ...FONTS.h4,
    color: COLORS.secondary,
    marginBottom: SIZES.margin * 1.5,
  },
  infoCard: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radiusLarge,
    padding: SIZES.padding,
    ...SHADOWS.light,
  },
  infoItem: {
    paddingVertical: SIZES.padding,
  },
  infoLabel: {
    ...FONTS.body4,
    color: COLORS.gray,
    marginBottom: 6,
  },
  infoValue: {
    ...FONTS.body2,
    color: COLORS.secondary,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    padding: SIZES.padding,
    borderRadius: SIZES.radiusLarge,
    marginBottom: SIZES.margin,
    ...SHADOWS.light,
  },
  actionIcon: {
    fontSize: 24,
    marginRight: SIZES.margin,
  },
  actionText: {
    ...FONTS.body2,
    color: COLORS.secondary,
    flex: 1,
    fontWeight: "500",
  },
  actionArrow: {
    ...FONTS.h3,
    color: COLORS.gray,
  },
  logoutButton: {
    backgroundColor: COLORS.error,
  },
  logoutText: {
    ...FONTS.body2,
    color: COLORS.white,
    flex: 1,
    fontWeight: "600",
  },
  notLoggedContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: SIZES.padding * 2,
    backgroundColor: COLORS.background,
  },
  notLoggedTitle: {
    ...FONTS.h2,
    color: COLORS.secondary,
    marginBottom: SIZES.margin,
  },
  notLoggedSubtitle: {
    ...FONTS.body3,
    color: COLORS.gray,
    textAlign: "center",
    marginBottom: SIZES.margin * 2,
  },
  notLoggedActions: {
    width: "100%",
    alignItems: "center",
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: SIZES.radius,
    marginBottom: SIZES.margin,
  },
  primaryBtnText: {
    color: COLORS.white,
    ...FONTS.body3,
    fontWeight: "700",
  },
  linkBtn: {
    paddingVertical: 10,
  },
  linkBtnText: {
    color: COLORS.primary,
    ...FONTS.body3,
    fontWeight: "600",
  },
});

export default ProfileScreen;
