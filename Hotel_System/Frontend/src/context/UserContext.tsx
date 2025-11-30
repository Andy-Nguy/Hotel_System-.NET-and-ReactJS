import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { API_CONFIG } from "../api/config";

// Interface cho thông tin user
export interface UserInfo {
  name: string;
  email: string;
  role: number | string;
  phone?: string;
  idkhachHang?: number;
  vaiTro?: number | string;
}

// Interface cho context
interface UserContextType {
  userInfo: UserInfo | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  refreshUserInfo: () => Promise<void>;
  logout: () => void;
  isNhanVien: () => boolean;
  isAdmin: () => boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

/**
 * Utility function để lấy thông tin user một cách nhất quán
 * Ưu tiên: 1. Dữ liệu từ API profile (hs_userInfo với role là số)
 *          2. Fallback về JWT token nếu cần
 */
export const getUserInfo = (): UserInfo | null => {
  try {
    // Ưu tiên đọc từ hs_userInfo (dữ liệu từ API profile)
    const profileData = localStorage.getItem("hs_userInfo");
    if (profileData) {
      const profileInfo = JSON.parse(profileData);
      // Kiểm tra xem dữ liệu có phải từ API profile không (có role và không có claim URL dài)
      if (
        profileInfo.role !== undefined &&
        !profileInfo[
          "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"
        ]
      ) {
        console.log("[getUserInfo] Using API profile data:", profileInfo);
        return profileInfo;
      }
    }

    // Fallback: decode JWT token
    const token = localStorage.getItem("hs_token");
    if (token) {
      const parts = token.split(".");
      if (parts.length === 3) {
        try {
          const base64Payload = parts[1];
          const decodedPayload = decodeURIComponent(
            atob(base64Payload)
              .split("")
              .map(function (c) {
                return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
              })
              .join("")
          );
          const payload = JSON.parse(decodedPayload);

          // Tạo object đơn giản từ payload phức tạp của JWT
          const simplePayload: UserInfo = {
            name:
              payload[
                "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"
              ] ||
              payload.name ||
              "User",
            email:
              payload[
                "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"
              ] ||
              payload.email ||
              "",
            role:
              payload.role ||
              payload[
                "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"
              ] ||
              "khachhang",
            phone: payload.phone || "",
          };
          console.log(
            "[getUserInfo] Using JWT payload (fallback):",
            simplePayload
          );
          return simplePayload;
        } catch (e) {
          console.warn("[getUserInfo] JWT decode error:", e);
        }
      }
    }

    return null;
  } catch (error) {
    console.error("[getUserInfo] Error:", error);
    return null;
  }
};

/**
 * Kiểm tra role có phải nhân viên hoặc admin không
 */
export const checkIsNhanVien = (userInfo: UserInfo | null): boolean => {
  if (!userInfo) return false;

  const role = userInfo.role;
  console.log("[checkIsNhanVien] role:", role, typeof role);

  if (role === undefined || role === null) return false;

  // Handle numeric role (1 = nhanvien, 2 = admin)
  if (typeof role === "number") return role === 1 || role === 2;

  // Handle string role
  const roleStr = String(role).toLowerCase().trim();
  return (
    roleStr === "nhanvien" ||
    roleStr === "admin" ||
    roleStr === "staff" ||
    roleStr === "1" ||
    roleStr === "2"
  );
};

/**
 * Kiểm tra role có phải admin không
 */
export const checkIsAdmin = (userInfo: UserInfo | null): boolean => {
  if (!userInfo) return false;

  const role = userInfo.role;

  if (role === undefined || role === null) return false;

  // Handle numeric role (2 = admin)
  if (typeof role === "number") return role === 2;

  // Handle string role
  const roleStr = String(role).toLowerCase().trim();
  return roleStr === "admin" || roleStr === "2";
};

// Provider component
export const UserProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUserInfo = useCallback(async () => {
    const token = localStorage.getItem("hs_token");

    if (!token) {
      setUserInfo(null);
      setIsLoggedIn(false);
      setIsLoading(false);
      localStorage.removeItem("hs_userInfo");
      return;
    }

    setIsLoggedIn(true);

    // Ưu tiên kiểm tra cached data từ API profile
    const cachedInfo = getUserInfo();
    if (cachedInfo && typeof cachedInfo.role === "number") {
      console.log("[UserProvider] Using cached API profile data:", cachedInfo);
      setUserInfo(cachedInfo);
      setIsLoading(false);
      return;
    }

    // Gọi API profile để lấy thông tin chính xác
    try {
      const API_BASE = `${API_CONFIG.CURRENT}/api`;
      const res = await fetch(`${API_BASE}/Auth/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const profile = await res.json();
        console.log("[UserProvider] Profile from API:", profile);

        const mappedUserInfo: UserInfo = {
          idkhachHang: profile.idkhachHang || profile.IdkhachHang,
          name: profile.hoTen || profile.HoTen || profile.name || "User",
          email: profile.email || profile.Email || "",
          role: profile.vaiTro ?? profile.VaiTro ?? profile.role ?? 0,
          phone: profile.soDienThoai || profile.SoDienThoai || "",
        };

        setUserInfo(mappedUserInfo);
        localStorage.setItem("hs_userInfo", JSON.stringify(mappedUserInfo));
        console.log("[UserProvider] Saved userInfo:", mappedUserInfo);
      } else {
        // Fallback to cached or JWT data
        const fallbackInfo = getUserInfo();
        setUserInfo(fallbackInfo);
      }
    } catch (e) {
      console.warn("[UserProvider] API fetch error:", e);
      // Fallback to cached or JWT data
      const fallbackInfo = getUserInfo();
      setUserInfo(fallbackInfo);
    }

    setIsLoading(false);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("hs_token");
    localStorage.removeItem("hs_userInfo");
    setUserInfo(null);
    setIsLoggedIn(false);
  }, []);

  const isNhanVien = useCallback(() => {
    return checkIsNhanVien(userInfo);
  }, [userInfo]);

  const isAdmin = useCallback(() => {
    return checkIsAdmin(userInfo);
  }, [userInfo]);

  // Initialize on mount
  useEffect(() => {
    refreshUserInfo();
  }, [refreshUserInfo]);

  // Listen for storage changes (login/logout from other tabs)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "hs_token" || e.key === "hs_userInfo") {
        refreshUserInfo();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [refreshUserInfo]);

  // Listen for custom auth events
  useEffect(() => {
    const handleAuthChange = () => {
      refreshUserInfo();
    };

    window.addEventListener("authChange", handleAuthChange);
    window.addEventListener("popstate", handleAuthChange);
    window.addEventListener("hashchange", handleAuthChange);

    return () => {
      window.removeEventListener("authChange", handleAuthChange);
      window.removeEventListener("popstate", handleAuthChange);
      window.removeEventListener("hashchange", handleAuthChange);
    };
  }, [refreshUserInfo]);

  return (
    <UserContext.Provider
      value={{
        userInfo,
        isLoggedIn,
        isLoading,
        refreshUserInfo,
        logout,
        isNhanVien,
        isAdmin,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

// Custom hook để sử dụng context
export const useUser = (): UserContextType => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};

export default UserContext;
