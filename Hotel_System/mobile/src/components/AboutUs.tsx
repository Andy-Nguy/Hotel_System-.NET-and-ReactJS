import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { COLORS, SIZES, FONTS } from "../constants/theme";

const AboutUs: React.FC = () => {
  return (
    <View style={styles.section}>
      <View style={styles.sectionTitle}>
        <Text style={styles.span}>Về Chúng Tôi</Text>
        <Text style={styles.h2}>Chào mừng đến với Robins Villa</Text>
      </View>

      <View style={styles.content}>
        <Image
          source={require("../assets/img/aboutus.jpg")}
          style={styles.image}
          resizeMode="cover"
        />

        <View style={styles.textContainer}>
          <Text style={styles.description}>
            Giữa làn sương Đà Lạt, Robins Villa mang đến không gian nghỉ dưỡng
            yên bình và tinh tế. Nơi bạn chạm vào vẻ đẹp của thiên nhiên và tìm
            lại sự an yên trong từng khoảnh khắc.
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
