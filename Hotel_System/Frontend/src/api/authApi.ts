// Centralized auth API helper
const API_BASE = "";

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
  const content = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err =
      (content && (content.error || content.message)) || `HTTP ${res.status}`;
    throw new Error(err);
  }
  return content;
}

export async function register(req: RegisterRequest) {
  const res = await fetch(`${API_BASE}/api/Auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  return handleRes(res);
}

export async function verifyOtp(req: VerifyOtpRequest) {
  const res = await fetch(`${API_BASE}/api/Auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  return handleRes(res);
}

export async function login(req: LoginRequest) {
  const res = await fetch(`${API_BASE}/api/Auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  return handleRes(res);
}

export default { register, verifyOtp, login };
