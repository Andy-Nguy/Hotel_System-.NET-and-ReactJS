import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Image,
} from "react-native";
import { COLORS, SIZES, FONTS } from "../constants/theme";

const Footer: React.FC = () => {
  const openLink = (url: string) => {
    Linking.openURL(url).catch((err) =>
      console.error("Failed to open URL:", err)
    );
  };

  return (
    <View style={styles.footer}>
      <View style={styles.container}>
        <View style={styles.section}>
          <Image
            source={require("../assets/robins-villa-logo.png")}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.description}>
            Your premier destination for luxury accommodation and exceptional
            hospitality.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Contact</Text>
          <Text style={styles.text}>📞 (12) 345 67890</Text>
          <Text style={styles.text}>📧 info@robinsvilla.com</Text>
          <Text style={styles.text}>📍 123 Hotel Street, City</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Follow Us</Text>
          <View style={styles.socialContainer}>
            <TouchableOpacity style={styles.socialBtn}>
              <Text style={styles.socialIcon}>📘</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialBtn}>
              <Text style={styles.socialIcon}>🐦</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialBtn}>
              <Text style={styles.socialIcon}>📸</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialBtn}>
              <Text style={styles.socialIcon}>💼</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.copyright}>
          <Text style={styles.copyrightText}>
            © {new Date().getFullYear()} Robins Villa. All rights reserved.
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  footer: {
    backgroundColor: COLORS.secondary,
    paddingVertical: SIZES.padding * 3,
    paddingHorizontal: SIZES.padding,
  },
  container: {
    width: "100%",
  },
  section: {
    marginBottom: SIZES.margin * 2,
  },
  logoImage: {
    width: 80,
    height: 80,
    marginBottom: SIZES.margin,
    alignSelf: "flex-start",
  },
  heading: {
    ...FONTS.h4,
    color: COLORS.white,
    marginBottom: SIZES.margin,
  },
  description: {
    ...FONTS.body3,
    color: COLORS.lightGray,
    lineHeight: 22,
  },
  text: {
    ...FONTS.body3,
    color: COLORS.lightGray,
    marginBottom: 8,
  },
  socialContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  socialBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.darkGray,
    justifyContent: "center",
    alignItems: "center",
    marginRight: SIZES.margin,
    marginBottom: SIZES.margin,
  },
  socialIcon: {
    fontSize: 20,
  },
  copyright: {
    borderTopWidth: 1,
    borderTopColor: COLORS.darkGray,
    paddingTop: SIZES.padding,
    marginTop: SIZES.margin,
  },
  copyrightText: {
    ...FONTS.body4,
    color: COLORS.gray,
    textAlign: "center",
  },
});

export default Footer;
