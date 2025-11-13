import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { COLORS, SIZES, FONTS } from "../constants/theme";

const AboutUs: React.FC = () => {
  return (
    <View style={styles.section}>
      <View style={styles.sectionTitle}>
        <Text style={styles.span}>About Us</Text>
        <Text style={styles.h2}>Welcome to Robins Villa</Text>
      </View>

      <View style={styles.content}>
        <Image
          source={{
            uri: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800",
          }}
          style={styles.image}
          resizeMode="cover"
        />

        <View style={styles.textContainer}>
          <Text style={styles.description}>
            Robins Villa is a premier hotel providing exceptional hospitality
            and luxury accommodations. We are dedicated to making your stay
            unforgettable with our world-class services and amenities.
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    paddingTop: SIZES.padding * 3,
    paddingHorizontal: SIZES.padding,
    backgroundColor: COLORS.white,
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
    marginTop: 8,
    textAlign: "center",
  },
  content: {
    width: "100%",
  },
  image: {
    width: "100%",
    height: 240,
    borderRadius: SIZES.radiusLarge,
    marginBottom: SIZES.margin * 1.5,
  },
  textContainer: {
    width: "100%",
  },
  description: {
    ...FONTS.body2,
    color: COLORS.gray,
    lineHeight: 28,
    textAlign: "center",
    // marginBottom: SIZES.margin,
  },
  features: {
    width: "100%",
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background,
    padding: SIZES.padding,
    borderRadius: SIZES.radius,
    marginBottom: SIZES.margin,
  },
  featureIcon: {
    fontSize: 32,
    marginRight: SIZES.margin,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    ...FONTS.body2,
    color: COLORS.secondary,
    fontWeight: "700",
    marginBottom: 4,
  },
  featureDesc: {
    ...FONTS.body3,
    color: COLORS.gray,
  },
});

export default AboutUs;
