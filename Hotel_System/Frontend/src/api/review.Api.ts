// API client for review/rating operations
// Uses axiosClient for centralized API configuration (local/prod switching via config.ts)
import axiosClient from "./axiosClient";

// axiosClient đã có baseURL = API_CONFIG.CURRENT/api
// và tự động thêm Authorization header từ localStorage

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

const reviewApi = {
  /**
   * Submit a review for a booking
   */
  submitReview: async (
    payload: ReviewSubmitPayload
  ): Promise<ReviewResponse> => {
    console.log("[reviewApi] Submitting review to backend:", payload);
    const res = await axiosClient.post(`/Review`, payload);
    console.log("[reviewApi] Review submitted successfully:", res.data);
    return res.data;
  },

  /**
   * Get review status for a booking (has it been reviewed, was email sent, etc)
   */
  getReviewStatus: async (IddatPhong: string): Promise<ReviewStatus> => {
    const res = await axiosClient.get(`/Review/status/${IddatPhong}`);
    return res.data;
  },

  /**
   * Get reviews for a specific booking
   */
  getBookingReviews: async (IddatPhong: string): Promise<ReviewResponse[]> => {
    const res = await axiosClient.get(`/Review/booking/${IddatPhong}`);
    return Array.isArray(res.data) ? res.data : [];
  },

  /**
   * Get rating statistics (average, count, distribution)
   */
  getRatingStats: async (): Promise<any> => {
    const res = await axiosClient.get(`/Review/stats`);
    return res.data;
  },

  /**
   * Trigger sending review reminder email for a booking
   * (Normally called automatically after checkout, but exposed for admin override)
   */
  sendReviewEmail: async (IddatPhong: string, email: string): Promise<any> => {
    const res = await axiosClient.post(`/Review/send-email`, {
      IddatPhong,
      Email: email,
    });
    return res.data;
  },

  // ================== ADMIN REVIEW MANAGEMENT ==================

  /**
   * Get all reviews for admin management (paginated)
   */
  getAllReviews: async (params: {
    page?: number;
    pageSize?: number;
    status?: string;
    keyword?: string;
  }): Promise<{
    total: number;
    page: number;
    pageSize: number;
    reviews: any[];
  }> => {
    const res = await axiosClient.get(`/Review`, { params });
    return res.data;
  },

  /**
   * Approve a review
   */
  approveReview: async (id: number): Promise<any> => {
    const res = await axiosClient.put(`/Review/${id}/approve`);
    return res.data;
  },

  /**
   * Delete a review
   */
  deleteReview: async (id: number): Promise<any> => {
    const res = await axiosClient.delete(`/Review/${id}`);
    return res.data;
  },

  /**
   * Send response email for a review (for negative reviews)
   */
  respondToReview: async (
    id: number,
    payload: {
      issueDescription: string;
      actionTaken: string;
      compensation?: string;
      senderName: string;
    }
  ): Promise<any> => {
    const res = await axiosClient.post(`/Review/${id}/respond`, payload);
    return res.data;
  },
};

export default reviewApi;
