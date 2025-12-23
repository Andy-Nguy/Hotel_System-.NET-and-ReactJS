import React from "react";
import { View, StyleSheet, Text, Platform, Dimensions } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, SIZES } from "../constants/theme";
import { Ionicons } from "@expo/vector-icons";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const isSmallDevice = SCREEN_HEIGHT < 700;
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
import EditProfileScreen from "../screens/EditProfileScreen";
import BlogDetailScreen from "../screens/BlogDetailScreen";
import ImageViewerScreen from "../screens/ImageViewerScreen";
import HotelIntroductionScreen from "../screens/HotelIntroductionScreen";

export type TabParamList = {
  HomeTab: undefined;
  Book: undefined;
  Trips: undefined;
  About: undefined;
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
  BlogDetail: { blogId: number };
  ImageViewer: { images: string[]; initialIndex?: number };
};

export type AccountStackParamList = {
  Profile: undefined;
  EditProfile: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const AccountStack = createNativeStackNavigator<AccountStackParamList>();

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
      <HomeStack.Screen name="BlogDetail" component={BlogDetailScreen} />
      <HomeStack.Screen name="ImageViewer" component={ImageViewerScreen} />
    </HomeStack.Navigator>
  );
};

const AccountStackNavigator: React.FC = () => {
  return (
    <AccountStack.Navigator screenOptions={{ headerShown: false }}>
      <AccountStack.Screen name="Profile" component={ProfileScreen} />
      <AccountStack.Screen name="EditProfile" component={EditProfileScreen} />
    </AccountStack.Navigator>
  );
};

interface TabIconProps {
  focused: boolean;
  color: string;
  iconName: string;
  label: string;
}

const TabIcon: React.FC<TabIconProps> = ({
  focused,
  color,
  iconName,
  label,
}) => (
  <View style={styles.iconContainer}>
    <View style={[styles.iconWrapper, focused && styles.iconWrapperActive]}>
      <Ionicons
        name={iconName as any}
        size={focused ? 26 : 24}
        color={focused ? COLORS.primary : color}
      />
    </View>
    <Text
      style={[
        styles.tabLabel,
        { color: focused ? COLORS.primary : color },
        focused && styles.tabLabelActive,
      ]}
    >
      {label}
    </Text>
  </View>
);

const BottomTabNavigator: React.FC = () => {
  const insets = useSafeAreaInsets();
  
  // Calculate responsive tab bar height
  const TAB_BAR_HEIGHT = Platform.select({
    ios: isSmallDevice ? 75 : 85,
    android: isSmallDevice ? 60 : 68,
    default: 68,
  });

  const totalTabBarHeight = TAB_BAR_HEIGHT + (Platform.OS === 'ios' ? insets.bottom : 0);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary || "#1a1a1a",
        tabBarInactiveTintColor: "#8E8E93",
        tabBarStyle: {
          ...styles.tabBar,
          height: totalTabBarHeight,
          paddingBottom: Platform.OS === 'ios' ? insets.bottom : 8,
        },
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
      }}
      sceneContainerStyle={{
        paddingBottom: totalTabBarHeight,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              focused={focused}
              color={color}
              iconName="home"
              label="Home"
            />
          ),
        }}
      />

      <Tab.Screen
        name="Book"
        component={RoomsScreen}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              focused={focused}
              color={color}
              iconName="calendar"
              label="Book"
            />
          ),
        }}
      />

      <Tab.Screen
        name="Trips"
        component={BookingsScreen}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              focused={focused}
              color={color}
              iconName="airplane"
              label="Trips"
            />
          ),
        }}
      />

      <Tab.Screen
        name="About"
        component={HotelIntroductionScreen}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              focused={focused}
              color={color}
              iconName={focused ? "information-circle" : "information-circle-outline"}
              label="About"
            />
          ),
        }}
      />

      <Tab.Screen
        name="Account"
        component={AccountStackNavigator}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              focused={focused}
              color={color}
              iconName={focused ? "person" : "person-outline"}
              label="Account"
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 0,
    paddingTop: 8,
    paddingHorizontal: 4,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  iconContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 4,
  },
  iconWrapper: {
    alignItems: "center",
    justifyContent: "center",
    width: 48,
    height: 32,
    borderRadius: 16,
    marginBottom: 4,
  },
  iconWrapperActive: {
    backgroundColor: "rgba(0, 0, 0, 0.04)",
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
    letterSpacing: 0.1,
  },
  tabLabelActive: {
    fontWeight: "600",
  },
});

export default BottomTabNavigator;
