// API client for review/rating operations

export interface ReviewSubmitPayload {
  IddatPhong: string;
  Rating: number; // 1-5
  Title: string;
  Content: string;
  IsAnonym?: number; // 1 = anonymous, 0 = named
}

export interface ReviewResponse {
  id?: string;
  IddatPhong?: string;
  Rating?: number;
  Title?: string;
  Content?: string;
  IsAnonym?: number;
  CreatedAt?: string;
  message?: string;
}

export interface ReviewStatus {
  IddatPhong: string;
  hasReview?: boolean;
  emailSent?: boolean;
  lastSentAt?: string;
}

const baseUrl = '/api/Review';

const reviewApi = {
  /**
   * Submit a review for a booking
   */
  submitReview: async (payload: ReviewSubmitPayload): Promise<ReviewResponse> => {
    console.log('[reviewApi] Submitting review to backend:', payload);
    const res = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('[reviewApi] Review submission failed with status', res.status, data);
      throw new Error(data?.message || data?.error || `Failed to submit review: ${res.status}`);
    }
    console.log('[reviewApi] Review submitted successfully:', data);
    return data;
  },

  /**
   * Get review status for a booking (has it been reviewed, was email sent, etc)
   */
  getReviewStatus: async (IddatPhong: string): Promise<ReviewStatus> => {
    const res = await fetch(`${baseUrl}/status/${IddatPhong}`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || 'Failed to fetch review status');
    }
    return data;
  },

  /**
   * Get reviews for a specific booking
   */
  getBookingReviews: async (IddatPhong: string): Promise<ReviewResponse[]> => {
    const res = await fetch(`${baseUrl}/booking/${IddatPhong}`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || 'Failed to fetch reviews');
    }
    return Array.isArray(data) ? data : [];
  },

  /**
   * Get rating statistics (average, count, distribution)
   */
  getRatingStats: async (): Promise<any> => {
    const res = await fetch(`${baseUrl}/stats`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || 'Failed to fetch rating stats');
    }
    return data;
  },

  /**
   * Trigger sending review reminder email for a booking
   * (Normally called automatically after checkout, but exposed for admin override)
   */
  sendReviewEmail: async (IddatPhong: string, email: string): Promise<any> => {
    const res = await fetch(`${baseUrl}/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ IddatPhong, Email: email }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || 'Failed to send review email');
    }
    return data;
  },
};

export default reviewApi;
