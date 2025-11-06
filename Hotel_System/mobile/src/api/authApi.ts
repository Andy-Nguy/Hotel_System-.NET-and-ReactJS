import AsyncStorage from "@react-native-async-storage/async-storage";

// Base URL - set this to your backend URL
// For Android emulator: http://10.0.2.2:5000
// For iOS simulator: http://localhost:5000
// For physical device: http://YOUR_IP:5000
const BASE_URL = "http://10.0.2.2:5000";

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
  const content = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err =
      (content && (content.error || content.message)) || `HTTP ${res.status}`;
    throw new Error(err);
  }
  return content;
}

export async function register(
  req: RegisterRequest
): Promise<RegisterResponse> {
  const res = await fetch(`${BASE_URL}/api/Auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  return handleRes(res);
}

export async function verifyOtp(req: VerifyOtpRequest): Promise<LoginResponse> {
  const res = await fetch(`${BASE_URL}/api/Auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  return handleRes(res);
}

export async function login(req: LoginRequest): Promise<LoginResponse> {
  const res = await fetch(`${BASE_URL}/api/Auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  return handleRes(res);
}

export async function getProfile() {
  const token = await AsyncStorage.getItem("hs_token");
  const res = await fetch(`${BASE_URL}/api/Auth/profile`, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return handleRes(res);
}

export async function getBookings() {
  const token = await AsyncStorage.getItem("hs_token");
  const res = await fetch(`${BASE_URL}/api/Bookings/my`, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return handleRes(res);
}

export default { register, verifyOtp, login, getProfile, getBookings };
