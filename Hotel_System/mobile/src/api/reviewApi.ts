import { DEFAULT_BASE_URL } from '../config/apiConfig';

type StatsResponse = {
  averageRating?: number;
  totalReviews?: number;
  ratingDistribution?: Array<{ stars: number; count: number }>;
};

export async function getRoomStats(roomId: string): Promise<StatsResponse | null> {
  try {
    const res = await fetch(`${DEFAULT_BASE_URL}/api/Review/room/${roomId}/stats`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      console.warn('[reviewApi] stats fetch failed', res.status);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.debug('[reviewApi] getRoomStats error', err);
    return null;
  }
}

export async function getRoomReviews(roomId: string, page = 1, pageSize = 10) {
  try {
    const res = await fetch(`${DEFAULT_BASE_URL}/api/Review/room/${roomId}/reviews?page=${page}&pageSize=${pageSize}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      console.warn('[reviewApi] reviews fetch failed', res.status);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.debug('[reviewApi] getRoomReviews error', err);
    return null;
  }
}

export default { getRoomStats, getRoomReviews };
