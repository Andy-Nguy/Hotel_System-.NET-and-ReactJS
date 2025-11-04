import React, { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import authApi from "../api/authApi";

const BookingsScreen: React.FC = () => {
  const [bookings, setBookings] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await authApi.getBookings();
        setBookings(Array.isArray(data) ? data : []);
      } catch (e) {
        // ignore
      }
    };
    load();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Lịch sử đặt phòng</Text>
      <FlatList
        data={bookings}
        keyExtractor={(item, idx) => String(item.id || item.bookingId || idx)}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text>Mã đặt: {item.id || item.bookingId}</Text>
            <Text>Phòng: {item.phong || item.roomName}</Text>
          </View>
        )}
        ListEmptyComponent={<Text>Không có dữ liệu</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 18, fontWeight: "600", marginBottom: 12 },
  item: { padding: 12, borderBottomWidth: 1, borderBottomColor: "#eee" },
});

export default BookingsScreen;
