const BASE_URL = ""; // set this to your backend base URL, e.g. http://10.0.2.2:5000 for Android emulator
import AsyncStorage from "@react-native-async-storage/async-storage";

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

export async function register(req: any) {
  const res = await fetch(`${BASE_URL}/api/Auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  return handleRes(res);
}

export async function verifyOtp(req: any) {
  const res = await fetch(`${BASE_URL}/api/Auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  return handleRes(res);
}

export async function login(req: any) {
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
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  return handleRes(res);
}

export async function getBookings() {
  const token = await AsyncStorage.getItem("hs_token");
  const res = await fetch(`${BASE_URL}/api/Bookings/my`, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  return handleRes(res);
}

export default { register, verifyOtp, login, getProfile, getBookings };
