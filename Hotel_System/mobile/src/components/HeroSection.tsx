import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
} from "react-native";

const HeroSection: React.FC = () => {
  return (
    <ImageBackground
      source={{
        uri: "https://via.placeholder.com/800x600/dfa974/fff?text=Hotel+Hero",
      }}
      style={styles.hero}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <View style={styles.heroContent}>
          <Text style={styles.title}>Robins Villa</Text>
          <Text style={styles.description}>
            Here are the best hotel booking sites, including recommendations for
            international travel and for finding low-priced hotel rooms.
          </Text>
          <TouchableOpacity style={styles.primaryBtn}>
            <Text style={styles.btnText}>Discover Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  hero: {
    width: "100%",
    height: 400,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 20,
  },
  heroContent: {
    alignItems: "center",
  },
  title: {
    fontSize: 36,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 12,
    textAlign: "center",
  },
  description: {
    fontSize: 15,
    color: "#fff",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 24,
  },
  primaryBtn: {
    backgroundColor: "#dfa974",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 4,
  },
  btnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
});

export default HeroSection;
