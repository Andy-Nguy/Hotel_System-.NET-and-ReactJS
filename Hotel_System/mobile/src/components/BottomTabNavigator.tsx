import React from "react";
import { View, StyleSheet, Text } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { COLORS, SIZES } from "../constants/theme";
import HomeScreen from "../screens/HomeScreen";
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

const Tab = createBottomTabNavigator<TabParamList>();

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
        component={HomeScreen}
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
            <TabIcon
              focused={focused}
              color={color}
              size={24}
              icon="📅"
            />
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
