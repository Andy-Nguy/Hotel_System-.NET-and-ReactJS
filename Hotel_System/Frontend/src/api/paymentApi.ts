// Frontend Payment API helper mapping to backend PaymentController
// Provides typed functions for processing payments, checking status, refunds, invoices, etc.

// Resolve API base from Vite env when available, otherwise keep empty for Vite proxy in dev
const _VITE_API = (import.meta as any).env?.VITE_API_URL || "";
const API_BASE = _VITE_API.replace(/\/$/, ""); // empty string if not set

// === Types mirrored from backend DTOs (simplified to TS) ===
export type CreditCardInfo = {
  cardNumber: string;
  cardHolderName: string;
  expiryMonth: string; // MM
  expiryYear: string; // YYYY
  cvv: string;
  cardType?: "VISA" | "MASTERCARD" | string;
};

export type PaymentMethod =
  | "CASH"
  | "BANK_TRANSFER"
  | "CREDIT_CARD"
  | "MOMO"
  | "ZALOPAY"
  | "VNPAY"
  | "SHOPEEPAY";

export type PaymentRequest = {
  idHoaDon: string;
  paymentMethod: PaymentMethod;
  amount: number;
  creditCardInfo?: CreditCardInfo;
  eWalletPhone?: string | null;
  note?: string | null;
};

export type PaymentResponse = {
  success: boolean;
  message: string;
  paymentId?: string | null;
  idHoaDon?: string | null;
  paymentMethod?: PaymentMethod | null;
  amountPaid?: number | null;
  paymentDate?: string | null; // ISO string
  status?: 0 | 1 | 2 | 3 | null; // 1 Pending, 2 Completed, 3 Refunded, 0 Cancelled
  paymentUrl?: string | null;
  qrCode?: string | null;
};

export type RefundRequest = {
  idHoaDon: string;
  refundAmount: number;
  reason: string;
  refundMethod?: PaymentMethod | null;
};

export type InvoiceDetailResponse = any; // can be shaped later to the exact DTO if needed

export type ConfirmBankTransferRequest = {
  idHoaDon: string;
  amount: number;
  note?: string | null;
};

export type CancelPaymentRequest = {
  idHoaDon: string;
  reason: string;
};

// === helpers ===
async function handleJson<T>(res: Response): Promise<T> {
  const text = await res.text().catch(() => "");
  const content = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err =
      (content && (content.error || content.message)) || `HTTP ${res.status}`;
    throw new Error(err);
  }
  return content as T;
}

// normalize keys from PascalCase (C#) to camelCase (TS) for PaymentResponse
function normalizePaymentResponse(raw: any): PaymentResponse {
  if (!raw) return { success: false, message: "Empty response" };
  return {
    success: raw.success ?? raw.Success ?? false,
    message: raw.message ?? raw.Message ?? "",
    paymentId: raw.paymentId ?? raw.PaymentId ?? null,
    idHoaDon: raw.idHoaDon ?? raw.IdHoaDon ?? null,
    paymentMethod: raw.paymentMethod ?? raw.PaymentMethod ?? null,
    amountPaid: raw.amountPaid ?? raw.AmountPaid ?? null,
    paymentDate: raw.paymentDate ?? raw.PaymentDate ?? null,
    status: raw.status ?? raw.Status ?? null,
    paymentUrl: raw.paymentUrl ?? raw.PaymentUrl ?? null,
    qrCode: raw.qrCode ?? raw.QrCode ?? null,
  } as PaymentResponse;
}

// === Payment API calls ===

export async function processPayment(
  req: PaymentRequest
): Promise<PaymentResponse> {
  const res = await fetch(`${API_BASE}/api/Payment/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      IdHoaDon: req.idHoaDon,
      PaymentMethod: req.paymentMethod,
      Amount: req.amount,
      CreditCardInfo: req.creditCardInfo
        ? {
            CardNumber: req.creditCardInfo.cardNumber,
            CardHolderName: req.creditCardInfo.cardHolderName,
            ExpiryMonth: req.creditCardInfo.expiryMonth,
            ExpiryYear: req.creditCardInfo.expiryYear,
            CVV: req.creditCardInfo.cvv,
            CardType: req.creditCardInfo.cardType ?? "VISA",
          }
        : undefined,
      EWalletPhone: req.eWalletPhone,
      Note: req.note,
    }),
  });
  const data = await handleJson<any>(res);
  return normalizePaymentResponse(data);
}

export async function payCash(
  idHoaDon: string,
  amount: number,
  note?: string
): Promise<PaymentResponse> {
  const res = await fetch(`${API_BASE}/api/Payment/cash`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      IdHoaDon: idHoaDon,
      PaymentMethod: "CASH",
      Amount: amount,
      Note: note,
    }),
  });
  const data = await handleJson<any>(res);
  return normalizePaymentResponse(data);
}

export async function payBankTransfer(
  idHoaDon: string,
  amount: number,
  note?: string
): Promise<PaymentResponse> {
  const res = await fetch(`${API_BASE}/api/Payment/bank-transfer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      IdHoaDon: idHoaDon,
      PaymentMethod: "BANK_TRANSFER",
      Amount: amount,
      Note: note,
    }),
  });
  const data = await handleJson<any>(res);
  return normalizePaymentResponse(data);
}

export async function confirmBankTransfer(
  req: ConfirmBankTransferRequest
): Promise<PaymentResponse> {
  const res = await fetch(`${API_BASE}/api/Payment/confirm-bank-transfer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      IdHoaDon: req.idHoaDon,
      Amount: req.amount,
      Note: req.note,
    }),
  });
  const data = await handleJson<any>(res);
  return normalizePaymentResponse(data);
}

export async function payCreditCard(
  idHoaDon: string,
  amount: number,
  card: CreditCardInfo,
  note?: string
): Promise<PaymentResponse> {
  const res = await fetch(`${API_BASE}/api/Payment/credit-card`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      IdHoaDon: idHoaDon,
      PaymentMethod: "CREDIT_CARD",
      Amount: amount,
      CreditCardInfo: {
        CardNumber: card.cardNumber,
        CardHolderName: card.cardHolderName,
        ExpiryMonth: card.expiryMonth,
        ExpiryYear: card.expiryYear,
        CVV: card.cvv,
        CardType: card.cardType ?? "VISA",
      },
      Note: note,
    }),
  });
  const data = await handleJson<any>(res);
  return normalizePaymentResponse(data);
}

async function payEWallet(
  path: string,
  idHoaDon: string,
  amount: number,
  phone?: string | null,
  note?: string
) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      IdHoaDon: idHoaDon,
      Amount: amount,
      EWalletPhone: phone,
      Note: note,
    }),
  });
  const data = await handleJson<any>(res);
  return normalizePaymentResponse(data);
}

export const payMoMo = (
  idHoaDon: string,
  amount: number,
  phone?: string | null,
  note?: string
) => payEWallet("/api/Payment/momo", idHoaDon, amount, phone, note);

export const payZaloPay = (
  idHoaDon: string,
  amount: number,
  phone?: string | null,
  note?: string
) => payEWallet("/api/Payment/zalopay", idHoaDon, amount, phone, note);

export const payVNPay = (
  idHoaDon: string,
  amount: number,
  phone?: string | null,
  note?: string
) => payEWallet("/api/Payment/vnpay", idHoaDon, amount, phone, note);

export const payShopeePay = (
  idHoaDon: string,
  amount: number,
  phone?: string | null,
  note?: string
) => payEWallet("/api/Payment/shopeepay", idHoaDon, amount, phone, note);

export async function checkPaymentStatus(
  idHoaDon: string
): Promise<PaymentResponse> {
  const res = await fetch(
    `${API_BASE}/api/Payment/status/${encodeURIComponent(idHoaDon)}`
  );
  if (res.status === 404) {
    return { success: false, message: "Không tìm thấy hóa đơn", idHoaDon };
  }
  const data = await handleJson<any>(res);
  return normalizePaymentResponse(data);
}

export async function refundPayment(
  req: RefundRequest
): Promise<PaymentResponse> {
  const res = await fetch(`${API_BASE}/api/Payment/refund`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      IdHoaDon: req.idHoaDon,
      RefundAmount: req.refundAmount,
      Reason: req.reason,
      RefundMethod: req.refundMethod,
    }),
  });
  const data = await handleJson<any>(res);
  return normalizePaymentResponse(data);
}

export async function downloadInvoicePdf(idHoaDon: string): Promise<Blob> {
  const res = await fetch(
    `${API_BASE}/api/Payment/invoice/${encodeURIComponent(idHoaDon)}/pdf`
  );
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `HTTP ${res.status}`);
  }
  return await res.blob();
}

export async function getInvoiceDetail(
  idHoaDon: string
): Promise<InvoiceDetailResponse> {
  const res = await fetch(
    `${API_BASE}/api/Payment/invoice/${encodeURIComponent(idHoaDon)}`
  );
  return handleJson<InvoiceDetailResponse>(res);
}

export async function cancelPayment(
  req: CancelPaymentRequest
): Promise<PaymentResponse> {
  const res = await fetch(`${API_BASE}/api/Payment/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ IdHoaDon: req.idHoaDon, Reason: req.reason }),
  });
  const data = await handleJson<any>(res);
  return normalizePaymentResponse(data);
}

export async function getPaymentMethods(): Promise<
  Array<{ code: string; name: string; icon?: string; available?: boolean }>
> {
  const res = await fetch(`${API_BASE}/api/Payment/methods`);
  return handleJson(res);
}

export default {
  processPayment,
  payCash,
  payBankTransfer,
  confirmBankTransfer,
  payCreditCard,
  payMoMo,
  payZaloPay,
  payVNPay,
  payShopeePay,
  checkPaymentStatus,
  refundPayment,
  downloadInvoicePdf,
  getInvoiceDetail,
  cancelPayment,
  getPaymentMethods,
};
