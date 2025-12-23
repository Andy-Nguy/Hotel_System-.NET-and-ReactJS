import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  ImageBackground,
  Modal,
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
import { Ionicons } from "@expo/vector-icons";

const ProfileScreen: React.FC = () => {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [contactModalVisible, setContactModalVisible] = useState(false);
  const [loyaltyModalVisible, setLoyaltyModalVisible] = useState(false);
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
                onPress: () => setPaymentModalVisible(true),
                color: COLORS.warning,
              },
              {
                icon: "⭐",
                title: "Thẻ thành viên",
                onPress: () => setLoyaltyModalVisible(true),
                color: COLORS.primary,
              },
              {
                icon: "☎️",
                title: "Hỗ trợ & Liên hệ",
                onPress: () => setContactModalVisible(true),
                color: COLORS.gray,
              },
            ].map((item, i) => (
              <TouchableOpacity
                key={i}
                style={styles.menuCard}
                activeOpacity={0.85}
                onPress={
                  item.onPress || (() => navigation.navigate(item.screen))
                }
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

      {/* Payment Methods Modal */}
      <Modal
        visible={paymentModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setPaymentModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Phương thức thanh toán</Text>
              <TouchableOpacity
                onPress={() => setPaymentModalVisible(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.introText}>
                Robin's Villa cung cấp đa dạng phương thức thanh toán để đáp ứng
                mọi nhu cầu của quý khách. Tất cả giao dịch đều được bảo mật và
                xử lý nhanh chóng bởi đội ngũ chuyên nghiệp của chúng tôi.
              </Text>

              {[
                {
                  icon: "💵",
                  title: "Tiền mặt",
                  description:
                    "Khách hàng có thể thanh toán bằng tiền mặt VND trực tiếp tại quầy lễ tân khi nhận phòng. Nhân viên sẽ cung cấp biên lai và hướng dẫn chi tiết về các thủ tục nhận phòng.",
                },
                {
                  icon: "💳",
                  title: "Thẻ tín dụng/Ghi nợ",
                  description:
                    "Chúng tôi chấp nhận tất cả thẻ tín dụng và ghi nợ quốc tế bao gồm Visa, Mastercard, American Express và JCB. Thanh toán an toàn với công nghệ mã hóa SSL.",
                },
                {
                  icon: "🏦",
                  title: "Chuyển khoản ngân hàng",
                  description:
                    "Khách hàng có thể chuyển khoản trực tiếp vào tài khoản ngân hàng của Robin's Villa. Thông tin tài khoản sẽ được cung cấp qua email xác nhận đặt phòng với hướng dẫn chi tiết.",
                },
                {
                  icon: "📱",
                  title: "Ví điện tử",
                  description:
                    "Thanh toán tiện lợi qua các ví điện tử phổ biến tại Việt Nam: MoMo, ZaloPay, ViettelPay và ShopeePay. Quá trình thanh toán nhanh chóng và bảo mật cao.",
                },
                {
                  icon: "🏨",
                  title: "Thanh toán qua ứng dụng",
                  description:
                    "Khách hàng có thể thanh toán trực tiếp trong ứng dụng di động khi đặt phòng. Hỗ trợ thanh toán một phần hoặc toàn bộ với nhiều phương thức linh hoạt.",
                },
              ].map((method, index) => (
                <View key={index} style={styles.paymentMethod}>
                  <View style={styles.paymentIcon}>
                    <Text style={styles.paymentIconText}>{method.icon}</Text>
                  </View>
                  <View style={styles.paymentInfo}>
                    <Text style={styles.paymentTitle}>{method.title}</Text>
                    <Text style={styles.paymentDescription}>
                      {method.description}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setPaymentModalVisible(false)}
            >
              <Text style={styles.modalCloseButtonText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Contact Support Modal */}
      <Modal
        visible={contactModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setContactModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Hỗ trợ & Liên hệ</Text>
              <TouchableOpacity
                onPress={() => setContactModalVisible(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.introText}>
                Robin's Villa luôn sẵn sàng hỗ trợ quý khách 24/7. Hãy liên hệ
                với chúng tôi qua các kênh sau để được phục vụ tốt nhất.
              </Text>

              {[
                {
                  iconName: "call",
                  title: "Điện thoại",
                  value: "+84 28 1234 5678",
                  description: "Gọi trực tiếp để được hỗ trợ ngay lập tức",
                },
                {
                  iconName: "mail",
                  title: "Email",
                  value: "info@robinsvilla.vn",
                  description: "Gửi email cho chúng tôi về bất kỳ thắc mắc nào",
                },
                {
                  iconName: "logo-facebook",
                  title: "Facebook",
                  value: "@RobinsVillaVietnam",
                  description:
                    "Theo dõi và nhắn tin qua trang Facebook chính thức",
                },
                {
                  iconName: "logo-instagram",
                  title: "Instagram",
                  value: "@robinsvilla_vn",
                  description: "Khám phá hình ảnh và cập nhật mới nhất",
                },
                {
                  iconName: "globe",
                  title: "Website",
                  value: "www.robinsvilla.vn",
                  description: "Truy cập website để đặt phòng và xem thông tin",
                },
                {
                  iconName: "location",
                  title: "Địa chỉ",
                  value: "123 Đường ABC, Quận 1, TP.HCM",
                  description:
                    "Địa chỉ khách sạn chính tại trung tâm thành phố",
                },
                {
                  iconName: "time",
                  title: "Giờ làm việc",
                  value: "24/7",
                  description:
                    "Dịch vụ lễ tân và hỗ trợ khách hàng 24 giờ một ngày",
                },
              ].map((contact, index) => (
                <View key={index} style={styles.contactMethod}>
                  <View style={styles.contactIcon}>
                    <Ionicons
                      name={contact.iconName as any}
                      size={24}
                      color={COLORS.white}
                    />
                  </View>
                  <View style={styles.contactInfo}>
                    <Text style={styles.contactTitle}>{contact.title}</Text>
                    <Text style={styles.contactValue}>{contact.value}</Text>
                    <Text style={styles.contactDescription}>
                      {contact.description}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setContactModalVisible(false)}
            >
              <Text style={styles.modalCloseButtonText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Loyalty Program Modal */}
      <Modal
        visible={loyaltyModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setLoyaltyModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chương trình thẻ thành viên</Text>
              <TouchableOpacity
                onPress={() => setLoyaltyModalVisible(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.introText}>
                Tham gia chương trình thẻ thành viên Robin's Villa để nhận được
                nhiều ưu đãi đặc biệt và trải nghiệm dịch vụ cao cấp.
              </Text>

              {[
                {
                  level: "Silver",
                  color: "#C0C0C0",
                  icon: "🥈",
                  requirement: "5 đêm nghỉ",
                  benefits: [
                    "Giảm giá 5% cho lần đặt phòng tiếp theo",
                    "Ưu tiên đặt phòng",
                    "Nước uống chào mừng miễn phí",
                    "Hỗ trợ đặt bàn nhà hàng",
                  ],
                },
                {
                  level: "Gold",
                  color: "#FFD700",
                  icon: "🥇",
                  requirement: "15 đêm nghỉ",
                  benefits: [
                    "Giảm giá 10% cho lần đặt phòng tiếp theo",
                    "Nâng cấp phòng miễn phí (theo tình trạng phòng trống)",
                    "Bữa sáng miễn phí cho 2 người",
                    "Dịch vụ đưa đón sân bay",
                    "Ưu tiên check-in/check-out",
                  ],
                },
                {
                  level: "Platinum",
                  color: "#E5E4E2",
                  icon: "💎",
                  requirement: "30 đêm nghỉ",
                  benefits: [
                    "Giảm giá 15% cho lần đặt phòng tiếp theo",
                    "Phòng suite miễn phí (theo tình trạng phòng trống)",
                    "Bữa tối lãng mạn miễn phí",
                    "Dịch vụ spa 60 phút miễn phí",
                    "Quà tặng sinh nhật đặc biệt",
                    "Hỗ trợ concierge 24/7",
                  ],
                },
                {
                  level: "Diamond",
                  color: "#B9F2FF",
                  icon: "👑",
                  requirement: "50 đêm nghỉ",
                  benefits: [
                    "Giảm giá 20% cho lần đặt phòng tiếp theo",
                    "Phòng presidential miễn phí",
                    "Dịch vụ limousine đưa đón",
                    "Trải nghiệm ẩm thực cao cấp",
                    "Quà tặng hàng năm",
                    "Truy cập VIP lounge",
                    "Hỗ trợ cá nhân hóa dịch vụ",
                  ],
                },
              ].map((tier, index) => (
                <View
                  key={index}
                  style={[
                    styles.loyaltyCard,
                    { borderLeftColor: tier.color, borderLeftWidth: 6 },
                  ]}
                >
                  <View style={styles.loyaltyHeader}>
                    <View
                      style={[styles.tierIcon, { backgroundColor: tier.color }]}
                    >
                      <Text style={styles.tierIconText}>{tier.icon}</Text>
                    </View>
                    <View style={styles.tierInfo}>
                      <Text style={[styles.tierLevel, { color: tier.color }]}>
                        {tier.level}
                      </Text>
                      <Text style={styles.tierRequirement}>
                        Yêu cầu: {tier.requirement}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.benefitsContainer}>
                    <Text style={styles.benefitsTitle}>Quyền lợi:</Text>
                    {tier.benefits.map((benefit, benefitIndex) => (
                      <View key={benefitIndex} style={styles.benefitItem}>
                        <Text style={styles.benefitBullet}>•</Text>
                        <Text style={styles.benefitText}>{benefit}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setLoyaltyModalVisible(false)}
            >
              <Text style={styles.modalCloseButtonText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "70%",
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  modalTitle: {
    ...FONTS.h3,
    color: COLORS.primary,
    fontWeight: "700",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.lightGray,
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonText: {
    fontSize: 16,
    color: COLORS.gray,
    fontWeight: "bold",
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  introText: {
    ...FONTS.body2,
    color: COLORS.gray,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
    fontStyle: "italic",
  },
  paymentMethod: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    ...SHADOWS.light,
  },
  paymentIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  paymentIconText: {
    fontSize: 24,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentTitle: {
    ...FONTS.h4,
    color: COLORS.primary,
    marginBottom: 4,
    fontWeight: "600",
  },
  paymentDescription: {
    ...FONTS.body3,
    color: COLORS.gray,
    lineHeight: 18,
  },
  modalCloseButton: {
    marginHorizontal: 20,
    marginTop: 8,
    paddingVertical: 14,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    alignItems: "center",
  },
  modalCloseButtonText: {
    ...FONTS.body2,
    color: COLORS.white,
    fontWeight: "600",
  },

  // Contact Modal Styles
  contactMethod: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    ...SHADOWS.light,
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  contactInfo: {
    flex: 1,
  },
  contactTitle: {
    ...FONTS.h4,
    color: COLORS.primary,
    marginBottom: 4,
    fontWeight: "600",
  },
  contactValue: {
    ...FONTS.body2,
    color: COLORS.secondary,
    marginBottom: 4,
    fontWeight: "600",
  },
  contactDescription: {
    ...FONTS.body3,
    color: COLORS.gray,
    lineHeight: 18,
  },

  // Loyalty Modal Styles
  loyaltyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    marginBottom: 16,
    padding: 20,
    ...SHADOWS.medium,
    borderLeftWidth: 6,
  },
  loyaltyHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  tierIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  tierIconText: {
    fontSize: 28,
  },
  tierInfo: {
    flex: 1,
  },
  tierLevel: {
    ...FONTS.h3,
    fontWeight: "700",
    marginBottom: 4,
  },
  tierRequirement: {
    ...FONTS.body3,
    color: COLORS.gray,
    fontWeight: "500",
  },
  benefitsContainer: {
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
    paddingTop: 16,
  },
  benefitsTitle: {
    ...FONTS.h4,
    color: COLORS.primary,
    marginBottom: 12,
    fontWeight: "600",
  },
  benefitItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  benefitBullet: {
    ...FONTS.body2,
    color: COLORS.primary,
    marginRight: 8,
    fontWeight: "bold",
    marginTop: -2,
  },
  benefitText: {
    ...FONTS.body3,
    color: COLORS.gray,
    flex: 1,
    lineHeight: 20,
  },
});

export default ProfileScreen;
