import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_CONFIG } from "../config/apiConfig";
const BASE_URL = API_CONFIG.CURRENT;

// Type definitions
export type RegisterRequest = {
  Hoten?: string;
  Email?: string;
  Password?: string;
  Sodienthoai?: string;
  Ngaysinh?: string;
};

export type VerifyOtpRequest = {
  PendingId: number;
  Otp: string;
};

export type LoginRequest = {
  Email?: string;
  Password?: string;
};

export type LoginResponse = {
  token?: string;
  message?: string;
};

export type RegisterResponse = {
  pendingId?: number;
  message?: string;
};

async function handleRes(res: Response) {
  const text = await res.text().catch(() => "");
  let content = null;
  try {
    content = text ? JSON.parse(text) : null;
  } catch (e) {
    // non-JSON response
    content = text;
  }
  if (!res.ok) {
    const err =
      (content && (content.error || content.message)) || `HTTP ${res.status}`;
    throw new Error(err);
  }
  return content;
}

// Simple fetch wrapper with timeout to avoid hanging requests
async function fetchWithTimeout(
  input: RequestInfo,
  init?: RequestInit,
  timeout = 8000
) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(input, {
      ...(init || {}),
      signal: controller.signal,
    });
    return res;
  } catch (err: any) {
    if (err.name === "AbortError") throw new Error("Request timed out");
    throw err;
  } finally {
    clearTimeout(id);
  }
}

export async function register(
  req: RegisterRequest
): Promise<RegisterResponse> {
  const url = `${BASE_URL}/api/Auth/register`;
  console.log("authApi.register ->", url, req?.Email);
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  return handleRes(res);
}

export async function verifyOtp(req: VerifyOtpRequest): Promise<LoginResponse> {
  const url = `${BASE_URL}/api/Auth/verify`;
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  return handleRes(res);
}

export async function login(req: LoginRequest): Promise<LoginResponse> {
  const url = `${BASE_URL}/api/Auth/login`;
  console.log("authApi.login ->", url, req?.Email);
  try {
    const res = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    return handleRes(res);
  } catch (err: any) {
    console.error("authApi.login error:", err?.message || err);
    throw err;
  }
}

export async function getProfile() {
  const token = await AsyncStorage.getItem("hs_token");
  const url = `${BASE_URL}/api/Auth/profile`;
  console.log("authApi.getProfile ->", url, "token?", !!token);
  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: "GET",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
      10000
    );
    return handleRes(res);
  } catch (err: any) {
    console.error("authApi.getProfile error:", err?.message || err);
    throw err;
  }
}

export interface LoyaltyInfo {
  tichDiem: number;
  tier: string;
  vndPerPoint: number;
  totalSpent: number;
  totalNights: number;
  rewards?: Array<{
    id: string;
    name: string;
    description: string;
    costPoints: number;
    canRedeem: boolean;
  }>;
}

export async function getLoyalty(): Promise<LoyaltyInfo | null> {
  const token = await AsyncStorage.getItem("hs_token");
  const url = `${BASE_URL}/api/Auth/loyalty`;
  console.log("authApi.getLoyalty ->", url, "token?", !!token);
  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: "GET",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
      10000
    );
    return handleRes(res);
  } catch (err: any) {
    console.error("authApi.getLoyalty error:", err?.message || err);
    return null;
  }
}

export async function getBookings() {
  const token = await AsyncStorage.getItem("hs_token");
  const res = await fetch(`${BASE_URL}/api/datphong`, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return handleRes(res);
}

export async function getMyBookingHistory() {
  const token = await AsyncStorage.getItem("hs_token");
  const res = await fetch(`${BASE_URL}/api/DatPhong/LichSuDatPhong`, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return handleRes(res);
}

export async function getToken(): Promise<string | null> {
  return await AsyncStorage.getItem("hs_token");
}

export type UpdateProfileRequest = {
  hoTen?: string;
  soDienThoai?: string;
  email?: string;
  avatar?: string;
};

export async function updateProfile(request: UpdateProfileRequest) {
  const token = await AsyncStorage.getItem("hs_token");
  if (!token) throw new Error("Chưa đăng nhập");

  const url = `${BASE_URL}/api/Auth/profile`;
  console.log("authApi.updateProfile ->", url);
  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      },
      10000
    );
    return handleRes(res);
  } catch (err: any) {
    console.error("authApi.updateProfile error:", err?.message || err);
    throw err;
  }
}

export default {
  register,
  verifyOtp,
  login,
  getProfile,
  getLoyalty,
  getBookings,
  getMyBookingHistory,
  getToken,
  updateProfile,
};
