import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";

const AboutUs: React.FC = () => {
  return (
    <View style={styles.section}>
      <View style={styles.container}>
        <View style={styles.sectionTitle}>
          <Text style={styles.span}>About Us</Text>
          <Text style={styles.h2}>Intercontinental LA Westlake Hotel</Text>
        </View>
        <Text style={styles.paragraph}>
          Robins Villa is a modern site template designed for hotels and related
          businesses. The template is crafted with attention to detail and is
          excellent for a booking site on any accommodation, from a simple hotel
          to a complex resort with multiple dining options and a spa.
        </Text>
        <Text style={styles.paragraph}>
          All components work seamlessly on all screen sizes and are designed to
          provide a luxurious, yet functional experience for the user. The
          template includes multiple layout options and can be easily customized
          to suit your specific needs.
        </Text>
        <TouchableOpacity style={styles.primaryBtn}>
          <Text style={styles.btnText}>Read More</Text>
        </TouchableOpacity>
        <View style={styles.imageRow}>
          <Image
            source={{
              uri: "https://via.placeholder.com/320x240/dfa974/fff?text=About+1",
            }}
            style={styles.image}
            resizeMode="cover"
          />
          <Image
            source={{
              uri: "https://via.placeholder.com/320x240/dfa974/fff?text=About+2",
            }}
            style={styles.image}
            resizeMode="cover"
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    paddingVertical: 50,
    paddingHorizontal: 20,
    backgroundColor: "#fff",
  },
  container: {
    width: "100%",
  },
  sectionTitle: {
    marginBottom: 24,
  },
  span: {
    fontSize: 12,
    color: "#dfa974",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 8,
  },
  h2: {
    fontSize: 32,
    fontWeight: "700",
    color: "#19191a",
    marginTop: 8,
  },
  paragraph: {
    fontSize: 15,
    color: "#707079",
    lineHeight: 24,
    marginBottom: 16,
  },
  primaryBtn: {
    backgroundColor: "#dfa974",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 4,
    alignSelf: "flex-start",
    marginBottom: 30,
  },
  btnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  imageRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  image: {
    width: "48%",
    height: 180,
    borderRadius: 4,
  },
});

export default AboutUs;
