import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface UserInfo {
  name?: string;
  email?: string;
  [key: string]: any;
}

interface AuthContextType {
  isLoggedIn: boolean;
  userInfo: UserInfo | null;
  token: string | null;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem("hs_token");
      if (storedToken) {
        setToken(storedToken);
        setIsLoggedIn(true);
        // Decode JWT to get user info
        try {
          const base64Payload = storedToken.split(".")[1];
          const decodedPayload = JSON.parse(
            decodeURIComponent(
              atob(base64Payload)
                .split("")
                .map(
                  (c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)
                )
                .join("")
            )
          );
          setUserInfo(decodedPayload);
        } catch (e) {
          console.warn("Could not decode token:", e);
        }
      }
    } catch (error) {
      console.error("Error checking auth:", error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (newToken: string) => {
    try {
      await AsyncStorage.setItem("hs_token", newToken);
      setToken(newToken);
      setIsLoggedIn(true);
      // Decode JWT
      try {
        const base64Payload = newToken.split(".")[1];
        const decodedPayload = JSON.parse(
          decodeURIComponent(
            atob(base64Payload)
              .split("")
              .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
              .join("")
          )
        );
        setUserInfo(decodedPayload);
      } catch (e) {
        console.warn("Could not decode token:", e);
      }
    } catch (error) {
      console.error("Error saving token:", error);
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem("hs_token");
      setToken(null);
      setIsLoggedIn(false);
      setUserInfo(null);
    } catch (error) {
      console.error("Error removing token:", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{ isLoggedIn, userInfo, token, login, logout, loading }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
