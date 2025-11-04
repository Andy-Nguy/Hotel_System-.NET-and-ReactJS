import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
} from "react-native";

// Mock rooms data - in production, fetch from API
const roomsData = [
  {
    id: 1,
    name: "Premium King Room",
    price: 159,
    image: "https://via.placeholder.com/300x400/dfa974/fff?text=Premium+Room",
    size: "30 m²",
    capacity: 3,
    rating: 5,
  },
  {
    id: 2,
    name: "Deluxe Suite",
    price: 259,
    image: "https://via.placeholder.com/300x400/dfa974/fff?text=Deluxe+Suite",
    size: "45 m²",
    capacity: 4,
    rating: 5,
  },
  {
    id: 3,
    name: "Superior Twin Room",
    price: 139,
    image: "https://via.placeholder.com/300x400/dfa974/fff?text=Twin+Room",
    size: "28 m²",
    capacity: 2,
    rating: 4,
  },
];

const HomeRoom: React.FC = () => {
  return (
    <View style={styles.section}>
      <View style={styles.container}>
        <View style={styles.sectionTitle}>
          <Text style={styles.span}>Our Rooms</Text>
          <Text style={styles.h2}>Featured Rooms</Text>
        </View>
        {roomsData.map((room) => (
          <ImageBackground
            key={room.id}
            source={{ uri: room.image }}
            style={styles.roomItem}
            imageStyle={styles.roomImage}
          >
            <View style={styles.roomOverlay}>
              <View style={styles.roomText}>
                <Text style={styles.roomName}>{room.name}</Text>
                <Text style={styles.roomPrice}>
                  ${room.price}
                  <Text style={styles.priceLabel}>/Pernight</Text>
                </Text>
                <View style={styles.roomDetails}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Size:</Text>
                    <Text style={styles.detailValue}>{room.size}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Capacity:</Text>
                    <Text style={styles.detailValue}>
                      Max {room.capacity} persons
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Rating:</Text>
                    <Text style={styles.detailValue}>{room.rating} ⭐</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Services:</Text>
                    <Text style={styles.detailValue}>Wifi, TV, Bathroom</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.primaryBtn}>
                  <Text style={styles.btnText}>More Details</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ImageBackground>
        ))}
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
    marginBottom: 30,
    alignItems: "center",
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
  roomItem: {
    width: "100%",
    height: 400,
    marginBottom: 20,
    borderRadius: 4,
    overflow: "hidden",
  },
  roomImage: {
    borderRadius: 4,
  },
  roomOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "flex-end",
  },
  roomText: {
    backgroundColor: "rgba(25,25,26,0.9)",
    padding: 20,
  },
  roomName: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 10,
  },
  roomPrice: {
    fontSize: 36,
    fontWeight: "700",
    color: "#dfa974",
    marginBottom: 15,
  },
  priceLabel: {
    fontSize: 14,
    color: "#fff",
    fontWeight: "400",
  },
  roomDetails: {
    marginBottom: 15,
  },
  detailRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: "#dfa974",
    fontWeight: "600",
    width: 100,
  },
  detailValue: {
    fontSize: 14,
    color: "#fff",
    flex: 1,
  },
  primaryBtn: {
    backgroundColor: "#dfa974",
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  btnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
});

export default HomeRoom;
