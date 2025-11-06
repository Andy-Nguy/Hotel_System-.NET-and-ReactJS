import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Pressable,
  Image,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import { useAuth } from "../context/AuthContext";
import { COLORS, SIZES, FONTS, SHADOWS } from "../constants/theme";

type HeaderNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const Header: React.FC = () => {
  const navigation = useNavigation<HeaderNavigationProp>();
  const { isLoggedIn, userInfo, logout } = useAuth();
  const [menuVisible, setMenuVisible] = useState(false);

  const handleLogout = async () => {
    await logout();
    setMenuVisible(false);
    navigation.navigate("Home");
  };

  const getUserName = () => {
    if (!userInfo) return "User";
    try {
      const fullName =
        userInfo[
          "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"
        ] ||
        userInfo.name ||
        "User";
      return String(fullName).trim().split(" ")[0] || "User";
    } catch (e) {
      return "User";
    }
  };

  return (
    <View style={styles.header}>
      <View style={styles.topBar}>
        <View style={styles.contactInfo}>
          <Text style={styles.contactText}>📞 (12) 345 67890</Text>
        </View>
        <TouchableOpacity style={styles.bookingBtn}>
          <Text style={styles.bookingBtnText}>Booking Now</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.mainHeader}>
        <TouchableOpacity
          onPress={() => navigation.navigate("Home")}
          style={styles.logoContainer}
        >
          <Image
            source={require("../assets/robins-villa-logo.png")}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => setMenuVisible(true)}
        >
          <View style={styles.menuIcon}>
            <View style={styles.menuLine} />
            <View style={styles.menuLine} />
            <View style={styles.menuLine} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setMenuVisible(false)}
        >
          <Pressable
            style={styles.menuModal}
            onPress={(e) => e.stopPropagation()}
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.menuHeader}>
                <Text style={styles.menuTitle}>Menu</Text>
                <TouchableOpacity onPress={() => setMenuVisible(false)}>
                  <Text style={styles.closeButton}>✕</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  navigation.navigate("Home");
                  setMenuVisible(false);
                }}
              >
                <Text style={styles.menuItemText}>Home</Text>
              </TouchableOpacity>

              {isLoggedIn ? (
                <>
                  <View style={styles.menuDivider} />
                  <View style={styles.userSection}>
                    <Text style={styles.userGreeting}>
                      Xin chào, {getUserName()}!
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                      navigation.navigate("Profile");
                      setMenuVisible(false);
                    }}
                  >
                    <Text style={styles.menuItemText}>
                      👤 Thông tin cá nhân
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                      navigation.navigate("Bookings");
                      setMenuVisible(false);
                    }}
                  >
                    <Text style={styles.menuItemText}>
                      📋 Lịch sử đặt phòng
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.menuItem, styles.logoutItem]}
                    onPress={handleLogout}
                  >
                    <Text style={styles.logoutText}>🚪 Đăng xuất</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={styles.menuDivider} />
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                      navigation.navigate("Login");
                      setMenuVisible(false);
                    }}
                  >
                    <Text style={styles.menuItemText}>🔑 Đăng nhập</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                      navigation.navigate("Register");
                      setMenuVisible(false);
                    }}
                  >
                    <Text style={styles.menuItemText}>📝 Đăng ký</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: COLORS.white,
    ...SHADOWS.light,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SIZES.padding,
    paddingVertical: 8,
    backgroundColor: COLORS.secondary,
  },
  contactInfo: {
    flex: 1,
  },
  contactText: {
    fontSize: SIZES.body5,
    color: COLORS.white,
  },
  bookingBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: SIZES.radius,
  },
  bookingBtnText: {
    fontSize: SIZES.body5,
    color: COLORS.white,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  mainHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SIZES.padding,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoImage: {
    width: 50,
    height: 50,
  },
  menuButton: {
    padding: 8,
  },
  menuIcon: {
    width: 24,
    justifyContent: "space-between",
    height: 18,
  },
  menuLine: {
    width: "100%",
    height: 2,
    backgroundColor: COLORS.secondary,
    borderRadius: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: "flex-end",
  },
  menuModal: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: SIZES.radiusLarge * 2,
    borderTopRightRadius: SIZES.radiusLarge * 2,
    maxHeight: "80%",
    ...SHADOWS.dark,
  },
  menuHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: SIZES.padding * 1.5,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuTitle: {
    ...FONTS.h3,
    color: COLORS.secondary,
  },
  closeButton: {
    fontSize: 28,
    color: COLORS.gray,
    fontWeight: "300",
  },
  menuItem: {
    paddingVertical: SIZES.padding,
    paddingHorizontal: SIZES.padding * 1.5,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  menuItemText: {
    ...FONTS.body2,
    color: COLORS.secondary,
    fontWeight: "500",
  },
  menuDivider: {
    height: 8,
    backgroundColor: COLORS.background,
  },
  userSection: {
    padding: SIZES.padding * 1.5,
    backgroundColor: COLORS.background,
  },
  userGreeting: {
    ...FONTS.body2,
    color: COLORS.primary,
    fontWeight: "600",
  },
  logoutItem: {
    marginTop: SIZES.margin,
  },
  logoutText: {
    ...FONTS.body2,
    color: COLORS.error,
    fontWeight: "600",
  },
});

export default Header;
