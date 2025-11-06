import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  Animated,
} from "react-native";
import { COLORS, SIZES, FONTS, SHADOWS } from "../constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Hero images - replace with your actual images
const heroImages = [
  "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800",
  "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800",
  "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800",
];

const HeroSection: React.FC = () => {
  const [activeSlide, setActiveSlide] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    {
      useNativeDriver: false,
      listener: (event: any) => {
        const slideIndex = Math.round(
          event.nativeEvent.contentOffset.x / SCREEN_WIDTH
        );
        setActiveSlide(slideIndex);
      },
    }
  );

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {heroImages.map((image, index) => (
          <ImageBackground
            key={index}
            source={{ uri: image }}
            style={styles.hero}
            resizeMode="cover"
          >
            <View style={styles.overlay}>
              <View style={styles.heroContent}>
                <Text style={styles.title}>Robins Villa</Text>
                <Text style={styles.description}>
                  Here are the best hotel booking sites, including
                  recommendations for international travel and for finding
                  low-priced hotel rooms.
                </Text>
                <TouchableOpacity style={styles.primaryBtn}>
                  <Text style={styles.btnText}>Discover Now</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ImageBackground>
        ))}
      </ScrollView>

      {/* Pagination dots */}
      <View style={styles.pagination}>
        {heroImages.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index === activeSlide ? styles.activeDot : styles.inactiveDot,
            ]}
          />
        ))}
      </View>

      {/* Booking Form Card */}
      <View style={styles.bookingCard}>
        <Text style={styles.bookingTitle}>Booking Your Hotel</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Check In:</Text>
          <TouchableOpacity style={styles.input}>
            <Text style={styles.inputText}>Select date</Text>
            <Text style={styles.icon}>📅</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Check Out:</Text>
          <TouchableOpacity style={styles.input}>
            <Text style={styles.inputText}>Select date</Text>
            <Text style={styles.icon}>📅</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.label}>Guests:</Text>
            <TouchableOpacity style={styles.input}>
              <Text style={styles.inputText}>2 Adults</Text>
              <Text style={styles.icon}>👥</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
            <Text style={styles.label}>Room:</Text>
            <TouchableOpacity style={styles.input}>
              <Text style={styles.inputText}>1 Room</Text>
              <Text style={styles.icon}>🛏️</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.checkBtn}>
          <Text style={styles.checkBtnText}>Check Availability</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  hero: {
    width: SCREEN_WIDTH,
    height: 450,
  },
  overlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: "center",
    paddingHorizontal: SIZES.padding * 2,
  },
  heroContent: {
    alignItems: "center",
  },
  title: {
    ...FONTS.h1,
    color: COLORS.white,
    marginBottom: SIZES.margin,
    textAlign: "center",
  },
  description: {
    ...FONTS.body2,
    color: COLORS.white,
    textAlign: "center",
    marginBottom: SIZES.margin * 1.5,
    lineHeight: 24,
    paddingHorizontal: SIZES.padding,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: SIZES.radius,
  },
  btnText: {
    color: COLORS.white,
    ...FONTS.body4,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  pagination: {
    position: "absolute",
    top: 420,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: COLORS.primary,
    width: 24,
  },
  inactiveDot: {
    backgroundColor: COLORS.white,
    opacity: 0.5,
  },
  bookingCard: {
    marginHorizontal: SIZES.padding,
    marginTop: -40,
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radiusLarge,
    padding: SIZES.padding * 1.5,
    ...SHADOWS.medium,
  },
  bookingTitle: {
    ...FONTS.h4,
    color: COLORS.secondary,
    marginBottom: SIZES.margin * 1.5,
    textAlign: "center",
  },
  inputGroup: {
    marginBottom: SIZES.margin,
  },
  label: {
    ...FONTS.body3,
    color: COLORS.secondary,
    fontWeight: "600",
    marginBottom: 8,
  },
  input: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.padding,
    paddingVertical: 12,
    backgroundColor: COLORS.background,
  },
  inputText: {
    ...FONTS.body3,
    color: COLORS.gray,
  },
  icon: {
    fontSize: 18,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  checkBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: SIZES.radius,
    marginTop: SIZES.margin,
    alignItems: "center",
  },
  checkBtnText: {
    color: COLORS.white,
    ...FONTS.body3,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
});

export default HeroSection;
