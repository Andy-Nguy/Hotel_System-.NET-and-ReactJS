import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";

type HeaderNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const Header: React.FC = () => {
  const navigation = useNavigation<HeaderNavigationProp>();

  return (
    <View style={styles.header}>
      <View style={styles.container}>
        <Text style={styles.logo}>Robins Villa</Text>
        <View style={styles.nav}>
          <TouchableOpacity onPress={() => navigation.navigate("Home")}>
            <Text style={styles.navItem}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate("Profile")}>
            <Text style={styles.navItem}>Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate("Bookings")}>
            <Text style={styles.navItem}>Bookings</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate("Login")}>
            <Text style={styles.navItem}>Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: "#fff",
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e8e8e8",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logo: {
    fontSize: 20,
    fontWeight: "700",
    color: "#dfa974",
  },
  nav: {
    flexDirection: "row",
    gap: 20,
  },
  navItem: {
    fontSize: 14,
    color: "#19191a",
    fontWeight: "600",
  },
});

export default Header;
