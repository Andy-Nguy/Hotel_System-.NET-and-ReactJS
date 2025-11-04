import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import authApi from "../api/authApi";

const ProfileScreen: React.FC = () => {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await authApi.getProfile();
        setProfile(data);
      } catch (e) {
        // fallback: try decode token
        const token = await AsyncStorage.getItem("hs_token");
        if (token) {
          try {
            const base64Payload = token.split(".")[1];
            const decoded = decodeURIComponent(
              atob(base64Payload)
                .split("")
                .map(
                  (c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)
                )
                .join("")
            );
            setProfile(JSON.parse(decoded));
          } catch (e) {
            // ignore
          }
        }
      }
    };
    load();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Thông tin cá nhân</Text>
      <Text>Họ tên: {profile?.name || profile?.HoTen || "-"}</Text>
      <Text>Email: {profile?.email || profile?.Email || "-"}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 18, fontWeight: "600", marginBottom: 12 },
});

export default ProfileScreen;
