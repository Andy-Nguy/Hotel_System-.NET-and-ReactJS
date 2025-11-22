import React, { useEffect } from "react";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { View, Alert, Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useAuth } from "./context/AuthContext";
import { AuthProvider } from "./context/AuthContext";
import Header from "./components/Header";
import BottomTabNavigator from "./components/BottomTabNavigator";
import LoginScreen from "./screens/LoginScreen";
import RegisterScreen from "./screens/RegisterScreen";
import ReviewScreen from "./screens/ReviewScreen";


export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Review: { bookingId: string } | undefined;
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
  const { isLoggedIn } = useAuth();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {/* Allow opening review links even if not logged in */}
      <Stack.Screen name="Review" component={ReviewScreen} />
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
  useEffect(() => {
    // Preload vector icon font to avoid missing glyphs at runtime
    if (FontAwesome && typeof FontAwesome.loadFont === "function") {
      FontAwesome.loadFont();
    }
    // Deep link handling: handle initial URL and incoming URLs
    const handleUrl = (url: string | null) => {
      if (!url) return;
      try {
        // Prefer Expo-style exp://.../--/review/{id}
        if (url.includes('--/review/')) {
          try {
            const bookingIdRaw = url.split('--/review/')[1] ?? '';
            const bookingId = decodeURIComponent((bookingIdRaw || '').split(/[?#]/)[0]);
            console.debug('[DeepLink][expo-format] incoming url:', url, '-> bookingId:', bookingId);
            if (Platform.OS !== 'web') {
              try { Alert.alert('Mã đặt phòng', bookingId); } catch (e) { console.debug('Alert failed', e); }
            }
            setTimeout(() => {
              const nav = (global as any).rootNavigation;
              if (nav && typeof nav.navigate === 'function') {
                nav.navigate('Review', { bookingId });
              } else {
                console.debug('[DeepLink] rootNavigation not ready yet');
              }
            }, 300);
            return;
          } catch (e) {
            console.debug('[DeepLink] expo-format parse failed', e);
          }
        }

        // Fallback: accept various formats and stop at query/hash or trailing slash.
        // Examples:
        // - hotelsystem://review/DH123
        // - hotelsystem://review/DH123?src=email
        // - https://app.example.com/review/DH123
        const match = url.match(/review\/([^\/?#]+)/i);
        if (match && match[1]) {
          const bookingId = decodeURIComponent(match[1]);
          console.debug('[DeepLink] incoming url:', url, '-> bookingId:', bookingId);
          if (Platform.OS !== 'web') {
            try { Alert.alert('Mã đặt phòng', bookingId); } catch (e) { console.debug('Alert failed', e); }
          }
          // navigate to Review screen
          setTimeout(() => {
            const nav = (global as any).rootNavigation;
            if (nav && typeof nav.navigate === 'function') {
              nav.navigate('Review', { bookingId });
            } else {
              console.debug('[DeepLink] rootNavigation not ready yet');
            }
          }, 300);
        } else {
          console.debug('[DeepLink] no review id found in url:', url);
        }
      } catch (e) {
        console.debug('Deep link parse failed', e);
      }
    };

    // initial URL
    import('react-native').then(({ Linking }) => {
      Linking.getInitialURL().then(handleUrl).catch(() => {});
      const sub = Linking.addEventListener('url', (ev: any) => handleUrl(ev.url));
      return () => sub.remove();
    });
  }, []);
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer ref={(nav) => { (global as any).rootNavigation = nav; }}>
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
