import React, { useEffect, useState } from "react";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import SplashScreen from "./components/SplashScreen";
import { COLORS, FONTS } from "./constants/theme";
import { useAuth } from "./context/AuthContext";
import { AuthProvider } from "./context/AuthContext";
import Header from "./components/Header";
import BottomTabNavigator from "./components/BottomTabNavigator";
import LoginScreen from "./screens/LoginScreen";
import RegisterScreen from "./screens/RegisterScreen";

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  MainApp: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function MainAppWithHeader() {
  return (
    <View style={{ flex: 1 }}>
      <BottomTabNavigator />
    </View>
  );
}

function RootNavigator() {
  const { isLoggedIn, loading } = useAuth();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {isLoggedIn ? (
        <Stack.Screen name="MainApp" component={MainAppWithHeader} />
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  useEffect(() => {
    // Preload vector icon font to avoid missing glyphs at runtime
    if (FontAwesome && typeof FontAwesome.loadFont === "function") {
      FontAwesome.loadFont();
    }
  }, []);
  return (
    <SafeAreaProvider>
      <AuthProvider>
        {showSplash ? (
          <SplashScreen
            backgroundColor={COLORS.secondary}
            accentColor={COLORS.primary}
            text={
              <View style={splashStyles.textContainer}>
                <FontAwesome name="home" size={56} color={COLORS.primary} />
                <Text style={splashStyles.appName}>ROBIN'S VILLA</Text>
                <Text style={splashStyles.tagline}>Luxury Experience</Text>
              </View>
            }
            onFinish={() => setShowSplash(false)}
          />
        ) : (
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        )}
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const splashStyles = StyleSheet.create({
  textContainer: {
    alignItems: "center",
    gap: 12,
  },
  appName: {
    ...FONTS.h2,
    color: COLORS.primary,
    letterSpacing: 3,
    marginTop: 16,
  },
  tagline: {
    ...FONTS.body2,
    color: COLORS.white,
    opacity: 0.8,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
});
