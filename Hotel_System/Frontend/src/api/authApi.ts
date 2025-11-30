// Centralized auth API helper
import { API_CONFIG } from "./config";

const API_BASE = `${API_CONFIG.CURRENT}/api`;

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

async function handleRes(res: Response) {
  const text = await res.text().catch(() => "");
  let content: any = null;
  if (text) {
    try {
      content = JSON.parse(text);
    } catch (e) {
      // Not JSON — keep raw text so caller can inspect it
      content = text;
    }
  }

  if (!res.ok) {
    // Prefer structured error message when available
    let errMsg = `HTTP ${res.status}`;
    if (content) {
      if (typeof content === "string") errMsg = content;
      else if (content.error) errMsg = content.error;
      else if (content.message) errMsg = content.message;
    }
    throw new Error(errMsg);
  }

  return content;
}

export async function register(req: RegisterRequest) {
  const res = await fetch(`${API_BASE}/Auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  return handleRes(res);
}

export async function verifyOtp(req: VerifyOtpRequest) {
  const res = await fetch(`${API_BASE}/Auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  return handleRes(res);
}

export async function login(req: LoginRequest) {
  const res = await fetch(`${API_BASE}/Auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  return handleRes(res);
}

export async function forgotPassword(email: string) {
  const res = await fetch(`${API_BASE}/Auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ Email: email }),
  });
  return handleRes(res);
}

export async function resetPassword(
  email: string,
  otp: string,
  newPassword: string
) {
  const res = await fetch(`${API_BASE}/Auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ Email: email, Otp: otp, NewPassword: newPassword }),
  });
  return handleRes(res);
}

export default { register, verifyOtp, login, forgotPassword, resetPassword };
