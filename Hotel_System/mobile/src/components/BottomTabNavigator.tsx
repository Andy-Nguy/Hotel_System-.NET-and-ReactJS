import React from "react";
import { View, StyleSheet, Text } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { COLORS, SIZES } from "../constants/theme";
import HomeScreen from "../screens/HomeScreen";
import CheckAvailableRoomsScreen from "../screens/CheckAvailableRoomsScreen";
import PromotionDetail from "../screens/PromotionDetail";
import RoomTypeDetail from "../screens/RoomTypeDetail";
import ServiceDetail from "../screens/ServiceDetail";
import SelectRoomsScreen from "../screens/SelectRoomsScreen";
import ServicesSelectionScreen from "../screens/ServicesSelectionScreen";
import CheckoutScreen from "../screens/CheckoutScreen";
import PaymentScreen from "../screens/PaymentScreen";
import BookingSuccessScreen from "../screens/BookingSuccessScreen";
import RoomsScreen from "../screens/RoomsScreen";
import BookingsScreen from "../screens/BookingsScreen";
import OffersScreen from "../screens/OffersScreen";
import ProfileScreen from "../screens/ProfileScreen";

export type TabParamList = {
  HomeTab: undefined;
  Book: undefined;
  Trips: undefined;
  Wishlists: undefined;
  Account: undefined;
};

export type HomeStackParamList = {
  Home: undefined;
  CheckAvailableRooms: undefined;
  PromotionDetail: { promotionId: string };
  RoomTypeDetail: { idloaiPhong: string; tenLoaiPhong: string };
  ServiceDetail: { serviceId: string };
  SelectRooms: {
    checkIn: string;
    checkOut: string;
    guests: number;
    availableRooms: any[];
  };
  ServicesSelection: {
    selectedRooms: any[];
    checkIn: string;
    checkOut: string;
    guests: number;
    rooms: number;
  };
  Checkout: undefined;
  Payment: undefined;
  BookingSuccess: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();

const HomeStackNavigator: React.FC = () => {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="Home" component={HomeScreen} />
      <HomeStack.Screen
        name="CheckAvailableRooms"
        component={CheckAvailableRoomsScreen}
      />
      <HomeStack.Screen name="PromotionDetail" component={PromotionDetail} />
      <HomeStack.Screen name="RoomTypeDetail" component={RoomTypeDetail} />
      <HomeStack.Screen name="ServiceDetail" component={ServiceDetail} />
      <HomeStack.Screen name="SelectRooms" component={SelectRoomsScreen} />
      <HomeStack.Screen
        name="ServicesSelection"
        component={ServicesSelectionScreen}
      />
      <HomeStack.Screen name="Checkout" component={CheckoutScreen} />
      <HomeStack.Screen name="Payment" component={PaymentScreen} />
      <HomeStack.Screen
        name="BookingSuccess"
        component={BookingSuccessScreen}
      />
    </HomeStack.Navigator>
  );
};

interface TabIconProps {
  focused: boolean;
  color: string;
  size: number;
  icon: string;
}

const TabIcon: React.FC<TabIconProps> = ({ focused, color, size, icon }) => (
  <View style={styles.iconContainer}>
    <Text style={[styles.icon, { fontSize: size, color }]}>{icon}</Text>
  </View>
);

const BottomTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#333",
        tabBarInactiveTintColor: "#bbb",
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarIconStyle: styles.tabBarIcon,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{
          title: "Home",
          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              focused={focused}
              color={color}
              size={24}
              icon={focused ? "🏠" : "🏠"}
            />
          ),
        }}
      />

      <Tab.Screen
        name="Book"
        component={RoomsScreen}
        options={{
          title: "Book",
          tabBarIcon: ({ focused, color }) => (
            <TabIcon focused={focused} color={color} size={24} icon="📅" />
          ),
        }}
      />

      <Tab.Screen
        name="Trips"
        component={BookingsScreen}
        options={{
          title: "Trips",
          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              focused={focused}
              color={color}
              size={24}
              icon={focused ? "✈️" : "✈️"}
            />
          ),
        }}
      />

      <Tab.Screen
        name="Wishlists"
        component={OffersScreen}
        options={{
          title: "Wishlists",
          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              focused={focused}
              color={color}
              size={24}
              icon={focused ? "❤️" : "🤍"}
            />
          ),
        }}
      />

      <Tab.Screen
        name="Account"
        component={ProfileScreen}
        options={{
          title: "Account",
          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              focused={focused}
              color={color}
              size={24}
              icon={focused ? "👤" : "👤"}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
    paddingBottom: 5,
    paddingTop: 5,
    height: 70,
    ...{
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 5,
    },
  },
  tabBarLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
  tabBarIcon: {
    marginBottom: 0,
  },
  iconContainer: {
    justifyContent: "center",
    alignItems: "center",
    width: 30,
    height: 30,
  },
  icon: {
    textAlign: "center",
  },
});

export default BottomTabNavigator;
