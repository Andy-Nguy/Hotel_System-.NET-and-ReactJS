import React, { useState, useEffect } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ImageBackground,
  FlatList,
  Image,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { COLORS, SIZES, FONTS } from "../constants/theme";
import Icon from "react-native-vector-icons/FontAwesome";
import AboutUs from "../components/AboutUs";
import BlogSection from "../components/BlogSection";
import Promotion from "../components/Promotion";

const HomeScreen: React.FC = () => {
  const { userInfo } = useAuth();
  const navigation = useNavigation();
  const [searchText, setSearchText] = useState("");

  const getUserName = () => {
    if (!userInfo) return "Nguyen";
    try {
      const fullName =
        userInfo[
          "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"
        ] ||
        userInfo.name ||
        "Nguyen";
      return String(fullName).trim().split(" ")[0] || "Nguyen";
    } catch (e) {
      return "Nguyen";
    }
  };

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
    >
      {/* Hero Banner - Full Screen with Image */}
      <View style={styles.heroContainer}>
        <ImageBackground
          source={{
            uri: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500&h=600",
          }}
          style={styles.heroBanner}
          imageStyle={styles.heroImage}
        >
          {/* Overlay */}
          <View style={styles.heroOverlay} />

          {/* Hero Header - Logo */}
          <View style={styles.heroHeader}>
            <Text style={styles.logoText}>ROBIN'S VILLA</Text>
          </View>

          {/* Hero Search Bar - Floating */}
          <View style={styles.heroSearchContainer}>
            <View style={styles.searchBox}>
              <Icon
                name="search"
                size={20}
                color="#999"
                style={styles.searchIcon}
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Can I help you?"
                placeholderTextColor="#999"
                value={searchText}
                onChangeText={setSearchText}
              />
            </View>
          </View>

          {/* Hero Content - Bottom */}
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>
              Elite Stays Await, Unlock Up to 20K Points
            </Text>
            <Text style={styles.heroSubtext}>Get the offer →</Text>
          </View>
        </ImageBackground>
      </View>

      {/* Bottom Info Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomLeft}>
          <Text style={styles.bottomLabel}>Hello, {getUserName()}</Text>
        </View>
        <TouchableOpacity style={styles.bottomRight}>
          <Text style={styles.bottomStats}>0 Nights • 0 Pts</Text>
          <Text style={styles.bottomArrow}>›</Text>
        </TouchableOpacity>
      </View>
      
      <AboutUs />


      {/* Promotion: Promotion will fetch latest promotion itself when no props provided */}
      <Promotion
        
      />
      {/* Check Available Rooms Button */}
      <View style={styles.checkRoomsContainer}>
        <TouchableOpacity
          style={styles.checkRoomsButton}
          onPress={() => navigation.navigate("CheckAvailableRooms" as never)}
        >
          <Text style={styles.checkRoomsText}>Check Available Rooms</Text>
          <Icon name="search" size={20} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {/* Bottom Spacing */}
      <View style={styles.spacing} />

      <BlogSection />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  heroContainer: {
    height: 600,
    overflow: "hidden",
    position: "relative",
  },
  heroBanner: {
    flex: 1,
    justifyContent: "space-between",
  },
  heroImage: {
    resizeMode: "cover",
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
  },
  heroHeader: {
    paddingTop: SIZES.padding * 6,
    paddingHorizontal: SIZES.padding,
    zIndex: 20,
  },
  logoText: {
    ...FONTS.h2,
    color: COLORS.white,
    fontWeight: "700",
    textAlign: "center",
    fontSize: 28,
    letterSpacing: 3,
  },
  heroSearchContainer: {
    paddingHorizontal: SIZES.padding,
    marginTop: SIZES.padding * -7,
    marginBottom: SIZES.padding * 2,
    zIndex: 25,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 50,
    paddingHorizontal: SIZES.padding * 0.8,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.08)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  searchIcon: {
    fontSize: 20,
    marginRight: 8,
    color: "#999",
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.secondary,
    padding: 0,
  },
  heroContent: {
    paddingHorizontal: SIZES.padding * 1.5,
    paddingBottom: SIZES.padding * 3,
    zIndex: 20,
  },
  heroTitle: {
    ...FONTS.h2,
    color: COLORS.white,
    fontWeight: "700",
    fontSize: 36,
    lineHeight: 44,
    marginBottom: SIZES.padding,
    textShadowColor: "rgba(0, 0, 0, 0.75)", // Màu bóng đổ (màu đen với 75% opacity)
    textShadowOffset: { width: 2, height: 2 }, // Hướng và khoảng cách bóng đổ (2px sang phải, 2px xuống dưới)
    textShadowRadius: 3, // Độ mờ của bóng đổ
  },
  heroSubtext: {
    ...FONTS.h4,
    color: COLORS.white,
    fontWeight: "600",
    fontSize: 16,
    textShadowColor: "rgba(0, 0, 0, 0.75)", // Màu bóng đổ (màu đen với 75% opacity)
    textShadowOffset: { width: 2, height: 2 }, // Hướng và khoảng cách bóng đổ (2px sang phải, 2px xuống dưới)
    textShadowRadius: 3, // Độ mờ của bóng đổ
  },
  bottomBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#d47153ff",
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding * 1.2,
    marginTop: -1,
  },
  bottomLeft: {
    flex: 1,
  },
  bottomLabel: {
    ...FONTS.h4,
    color: COLORS.white,
    fontWeight: "600",
    fontSize: 16,
  },
  bottomRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  bottomStats: {
    ...FONTS.body3,
    color: COLORS.white,
    fontWeight: "500",
    marginRight: 8,
  },
  bottomArrow: {
    fontSize: 20,
    color: COLORS.white,
    fontWeight: "300",
  },
  spacing: {
    height: SIZES.padding * 3,
  },
  checkRoomsContainer: {
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
  },
  checkRoomsButton: {
    backgroundColor: "#d47153ff",
    borderRadius: 25,
    paddingVertical: SIZES.padding,
    paddingHorizontal: SIZES.padding * 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  checkRoomsText: {
    ...FONTS.h4,
    color: COLORS.white,
    fontWeight: "600",
    marginRight: 10,
  },
});

export default HomeScreen;
