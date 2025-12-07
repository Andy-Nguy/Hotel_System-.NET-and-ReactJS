import { API_CONFIG } from "../config/apiConfig";

type StatsResponse = {
  averageRating?: number;
  totalReviews?: number;
  ratingDistribution?: Array<{ stars: number; count: number }>;
};

export async function getRoomStats(
  roomId: string
): Promise<StatsResponse | null> {
  try {
    const res = await fetch(
      `${API_CONFIG.CURRENT}/api/Review/room/${roomId}/stats`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    );
    if (!res.ok) {
      console.warn("[reviewApi] stats fetch failed", res.status);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.debug("[reviewApi] getRoomStats error", err);
    return null;
  }
}

export async function getRoomReviews(roomId: string, page = 1, pageSize = 10) {
  try {
    const res = await fetch(
      `${API_CONFIG.CURRENT}/api/Review/room/${roomId}/reviews?page=${page}&pageSize=${pageSize}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    );
    if (!res.ok) {
      console.warn("[reviewApi] reviews fetch failed", res.status);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.debug("[reviewApi] getRoomReviews error", err);
    return null;
  }
}

export async function submitReview(payload: any) {
  try {
    const res = await fetch(`${API_CONFIG.CURRENT}/api/Review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    let data = null;
    try {
      data = await res.json();
    } catch (_) {
      /* ignore */
    }
    return {
      ok: res.ok,
      status: res.status,
      data,
      message: data?.message || (res.ok ? "OK" : `HTTP ${res.status}`),
    };
  } catch (err: any) {
    console.debug("[reviewApi] submitReview error", err);
    return {
      ok: false,
      status: 0,
      data: null,
      message: err?.message || "Network error",
    };
  }
}

export async function completeCheckout(bookingId: string) {
  try {
    const res = await fetch(
      `${API_CONFIG.CURRENT}/api/Checkout/complete/${encodeURIComponent(
        bookingId
      )}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }
    );

    let data: any = null;
    try {
      data = await res.json();
    } catch (_) {}

    return {
      ok: res.ok,
      status: res.status,
      data,
      message: data?.message || (res.ok ? "OK" : `HTTP ${res.status}`),
    };
  } catch (err: any) {
    console.debug("[reviewApi] completeCheckout error", err);
    return {
      ok: false,
      status: 0,
      data: null,
      message: err?.message || "Network error",
    };
  }
}

export async function getReviewStatus(bookingId: string) {
  try {
    const res = await fetch(
      `${API_CONFIG.CURRENT}/api/Review/status/${encodeURIComponent(
        bookingId
      )}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    );

    let data: any = null;
    try {
      data = await res.json();
    } catch (_) {}

    return {
      ok: res.ok,
      status: res.status,
      data,
      message: data?.message || (res.ok ? "OK" : `HTTP ${res.status}`),
    };
  } catch (err: any) {
    console.debug("[reviewApi] getReviewStatus error", err);
    return {
      ok: false,
      status: 0,
      data: null,
      message: err?.message || "Network error",
    };
  }
}

export default {
  getRoomStats,
  getRoomReviews,
  submitReview,
  completeCheckout,
  getReviewStatus,
};
