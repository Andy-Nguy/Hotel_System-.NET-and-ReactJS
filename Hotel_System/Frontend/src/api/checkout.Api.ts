// Checkout API helper
// Centralized frontend functions for the admin checkout workflow.
// Each function calls a corresponding backend endpoint if available and returns sensible null/fallback values otherwise.

const API_BASE = ""; // relative paths so dev proxy forwards /api

async function fetchJson(endpoint: string, init?: RequestInit) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, init);
    if (res.status === 404 || res.status === 204) return null;
    const text = await res.text().catch(() => "");
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
      // throw for non-GET so callers can show messages
      const method = (init && (init.method as string)) ?? 'GET';
      if (method.toUpperCase() !== 'GET') {
        throw new Error(data?.message ?? `HTTP ${res.status}`);
      }
      return null;
    }
    return data;
  } catch (err: any) {
    console.warn(`checkoutApi ${endpoint} failed:`, err?.message ?? err);
    return null;
  }
}

// Search booking by code / room number / guest name
export async function searchBooking(query: { code?: string; room?: string; guest?: string }) {
  const qs = new URLSearchParams();
  if (query.code) qs.set('code', query.code);
  if (query.room) qs.set('room', query.room);
  if (query.guest) qs.set('guest', query.guest);
  return await fetchJson(`/api/Checkout/search?${qs.toString()}`);
}

// Get booking details and charges (server-calculated if available)
export async function getBookingDetails(bookingId: string | number) {
  return await fetchJson(`/api/Checkout/bookings/${bookingId}`);
}

// Get room status (housekeeping check) and attached notes
export async function getRoomStatus(roomId: string | number) {
  return await fetchJson(`/api/Checkout/rooms/${roomId}/status`);
}

// Add or update incidental charges (food, spa, minibar, damages)
export async function addIncidentalCharge(bookingId: string | number, payload: { description: string; amount: number }) {
  return await fetchJson(`/api/Checkout/bookings/${bookingId}/charges`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

// Generate invoice (server calculates taxes/fees if supported)
export async function generateInvoice(bookingId: string | number, options?: { includeVat?: boolean; serviceFeePercent?: number }) {
  const body = { includeVat: options?.includeVat ?? true, serviceFeePercent: options?.serviceFeePercent ?? 5 };
  return await fetchJson(`/api/Checkout/bookings/${bookingId}/invoice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Process payment -- returns receipt / status
export async function processPayment(bookingId: string | number, payload: { method: string; amount: number; reference?: string }) {
  return await fetchJson(`/api/Checkout/bookings/${bookingId}/payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

// Finalize checkout: sets booking/room status, issues invoice, add loyalty points, send email
export async function finalizeCheckout(bookingId: string | number, payload?: { addLoyalty?: boolean; loyaltyPoints?: number; note?: string }) {
  return await fetchJson(`/api/Checkout/bookings/${bookingId}/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload ?? {}),
  });
}

export default {
  searchBooking,
  getBookingDetails,
  getRoomStatus,
  addIncidentalCharge,
  generateInvoice,
  processPayment,
  finalizeCheckout,
};
