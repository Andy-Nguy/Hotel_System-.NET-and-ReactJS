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
  Dimensions,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import { COLORS, SIZES, FONTS, SHADOWS } from "../constants/theme";

type HeaderNavigationProp = NativeStackNavigationProp<any>;

const Header: React.FC = () => {
  const navigation = useNavigation<HeaderNavigationProp>();
  const { isLoggedIn, userInfo, logout } = useAuth();
  const [menuVisible, setMenuVisible] = useState(false);
  
  const { width } = Dimensions.get("window");
  const isSmallDevice = width < 375;

  const handleLogout = async () => {
    await logout();
    setMenuVisible(false);
    navigation.navigate("Login");
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
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <View style={styles.topBar}>
          <View style={styles.contactInfo}>
            <Text style={styles.contactText}>📞 (12) 345 67890</Text>
          </View>
        </View>

        <View style={styles.mainHeader}>
          <TouchableOpacity
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
      </View>

      {/* Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setMenuVisible(false)}
      >
        <SafeAreaView style={styles.modalSafeArea} edges={["top", "bottom", "left", "right"]}>
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
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: COLORS.white,
    flex: 0,
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: COLORS.overlay,
  },
  header: {
    backgroundColor: COLORS.white,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SIZES.padding,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
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
    paddingVertical: Platform.OS === "ios" ? 14 : 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoImage: {
    width: Platform.select({ ios: 55, android: 50 }),
    height: Platform.select({ ios: 55, android: 50 }),
  },
  menuButton: {
    padding: Platform.OS === "ios" ? 10 : 8,
    borderRadius: SIZES.radius,
  },
  menuIcon: {
    width: 26,
    justifyContent: "space-between",
    height: 20,
  },
  menuLine: {
    width: "100%",
    height: 2.5,
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
    maxHeight: "85%",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  menuHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: SIZES.padding * 1.5,
    paddingTop: SIZES.padding * 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuTitle: {
    ...FONTS.h3,
    color: COLORS.secondary,
    fontWeight: "700",
  },
  closeButton: {
    fontSize: 32,
    color: COLORS.gray,
    fontWeight: "300",
    width: 32,
    height: 32,
    textAlign: "center",
  },
  menuItem: {
    paddingVertical: SIZES.padding * 1.2,
    paddingHorizontal: SIZES.padding * 1.5,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  menuItemText: {
    ...FONTS.body2,
    color: COLORS.secondary,
    fontWeight: "500",
    fontSize: Platform.OS === "ios" ? 16 : 15,
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
    fontWeight: "700",
    fontSize: Platform.OS === "ios" ? 17 : 16,
  },
  logoutItem: {
    marginTop: SIZES.margin,
    backgroundColor: "#fff5f5",
  },
  logoutText: {
    ...FONTS.body2,
    color: COLORS.error,
    fontWeight: "600",
    fontSize: Platform.OS === "ios" ? 16 : 15,
  },
});

export default Header;
