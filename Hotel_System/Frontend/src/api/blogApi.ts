// API client for blog operations
// Uses axiosClient for centralized API configuration (local/prod switching via config.ts)
import axiosClient from "./axiosClient";
import axios from "axios";
import { API_CONFIG } from "./config";

// ===== TYPES =====
export interface BlogPost {
  id: number;
  title: string;
  slug?: string;
  category: string;
  type: "internal" | "external";
  image: string;
  date?: string;
  excerpt?: string;
  author?: string;
  tags?: string | string[];
  content?: string;
  images?: string[];
  externalLink?: string;
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED" | "PENDING" | "APPROVED" | "REJECTED" | "DELETED";
  displayOrder?: number | null;
  viewCount?: number;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
}

export interface CreateBlogRequest {
  title: string;
  category: string;
  type: "internal" | "external";
  image: string;
  date?: string;
  excerpt?: string;
  author?: string;
  tags?: string[];
  content?: string;
  images?: string[];
  externalLink?: string;
  status?: "DRAFT" | "PUBLISHED";
  displayOrder?: number;
  slug?: string;
}

export interface UpdateBlogRequest {
  id?: number;
  title?: string;
  slug?: string;
  category?: string;
  type?: "internal" | "external";
  image?: string;
  date?: string;
  excerpt?: string;
  author?: string;
  tags?: string;
  content?: string;
  images?: string[];
  externalLink?: string;
  status?: string;
  displayOrder?: number | null;
}

// ===== API FUNCTIONS =====

export interface GetAllBlogsParams {
  admin?: boolean;
  limit?: number;
}

// Normalize image paths returned by backend (convert `/img/...` -> absolute URL)
const toAbsoluteUrl = (p?: string) => {
  if (!p) return p;
  if (p.startsWith("http")) return p;
  return `${API_CONFIG.CURRENT}${p}`;
};

const normalizePost = (d: any): BlogPost => ({
  ...d,
  image: toAbsoluteUrl(d?.image),
  images: Array.isArray(d?.images) ? d.images.map((i: string) => toAbsoluteUrl(i)) : d?.images,
} as BlogPost);

/**
 * Get all blogs (admin mode includes all statuses)
 * @param params - Optional parameters: admin (boolean), limit (number)
 */
export const getAllBlogs = async (params: GetAllBlogsParams = {}): Promise<BlogPost[]> => {
  const res = await axiosClient.get(`/blog`, { params });
  const arr = res.data as any[];
  return Array.isArray(arr) ? arr.map(normalizePost) : arr;
};

/**
 * Get blog by slug or ID
 */
export const getBlogBySlug = async (slugOrId: string | number): Promise<BlogPost> => {
  const res = await axiosClient.get(`/blog/${slugOrId}`);
  return normalizePost(res.data);
};

/**
 * Get blog by ID (alias for getBlogBySlug)
 */
export const getBlogById = async (id: number): Promise<BlogPost> => {
  return getBlogBySlug(id);
};

/**
 * Create new blog (admin endpoint)
 */
export const createBlog = async (data: CreateBlogRequest): Promise<BlogPost> => {
  // Use admin endpoint for blog creation
  // Backend defines admin create as an absolute route `/admin/blogs` (no `/api` prefix),
  // so call the full host URL rather than using axiosClient (which prefixes `/api`).
  const url = `${API_CONFIG.CURRENT}/admin/blogs`;
  const res = await axios.post(url, data);
  return normalizePost(res.data);
};

/**
 * Update blog by ID
 */
export const updateBlog = async (id: number, data: UpdateBlogRequest): Promise<BlogPost> => {
  const res = await axiosClient.put(`/blog/${id}`, data);
  return normalizePost(res.data);
};

/**
 * Delete blog by ID
 */
export const deleteBlog = async (id: number): Promise<void> => {
  await axiosClient.delete(`/blog/${id}`);
};

/**
 * Approve a pending blog
 */
export const approveBlog = async (id: number): Promise<BlogPost> => {
  const res = await axiosClient.post(`/blog/${id}/duyet`);
  return normalizePost(res.data);
};

/**
 * Reject a pending blog
 */
export const rejectBlog = async (id: number, reason: string): Promise<BlogPost> => {
  const res = await axiosClient.post(`/blog/${id}/tu-choi`, { reason });
  return normalizePost(res.data);
};

/**
 * Publish an approved blog
 */
export const publishBlog = async (id: number): Promise<BlogPost> => {
  const res = await axiosClient.post(`/blog/${id}/xuat-ban`);
  return normalizePost(res.data);
};

/**
 * Hide/archive a published blog
 */
export const hideBlog = async (id: number): Promise<BlogPost> => {
  const res = await axiosClient.post(`/blog/${id}/an`);
  return normalizePost(res.data);
};

/**
 * Set display order for a blog
 */
export const setDisplayOrder = async (id: number, displayOrder: number | null): Promise<BlogPost> => {
  const res = await axiosClient.post(`/blog/${id}/thu-tu-hien-thi`, displayOrder);
  return normalizePost(res.data);
};

/**
 * Increment view count for a blog
 */
export const incrementViewCount = async (id: number): Promise<{ viewCount: number }> => {
  const res = await axiosClient.post(`/blog/${id}/tang-luot-xem`);
  return res.data;
};

/**
 * Upload blog image (cover or gallery)
 */
export const uploadBlogImage = async (
  file: File,
  title?: string,
  type: "banner" | "gallery" = "gallery",
  replacePath?: string
): Promise<{ url: string }> => {
  const formData = new FormData();
  formData.append("file", file);
  // Use full host URL for admin upload endpoint because the backend
  // defines the route as an absolute path (`/admin/blogs/upload-image`)
  // while axiosClient.baseURL includes `/api` which would produce
  // `/api/admin/blogs/upload-image` and not match the controller route.
  const params = new URLSearchParams();
  if (title) params.append("title", title);
  if (type) params.append("type", type);
  if (replacePath) params.append("replacePath", replacePath);
  const uploadUrl = `${API_CONFIG.CURRENT}/admin/blogs/upload-image?${params.toString()}`;
  const res = await axios.post(uploadUrl, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  
  // Backend returns response like KhuyenMai controller:
  // { fileName, relativePath, fullPath, size, contentType }
  const returned = res.data as { relativePath: string };
  if (!returned || !returned.relativePath) {
    throw new Error("Invalid response from upload endpoint");
  }
  
  const url = returned.relativePath;
  const absolute = url.startsWith("http") ? url : `${API_CONFIG.CURRENT}${url}`;
  return { url: absolute };
};

/**
 * Delete blog image
 */
export const deleteBlogImage = async (path: string): Promise<void> => {
  // The frontend may pass an absolute URL (e.g. from uploadBlogImage).
  // The backend expects a server-local path like `/img/blog/xxx` so strip host if present.
  let sendPath = path;
  try {
    if (path && path.startsWith("http")) {
      const parsed = new URL(path);
      sendPath = parsed.pathname;
    }
  } catch (e) {
    // If URL parsing fails, fall back to original path
    sendPath = path;
  }
  await axiosClient.delete(`/blog/delete-image`, { params: { path: sendPath } });
};

export default {
  getAllBlogs,
  getBlogBySlug,
  getBlogById,
  createBlog,
  updateBlog,
  deleteBlog,
  approveBlog,
  rejectBlog,
  publishBlog,
  hideBlog,
  setDisplayOrder,
  incrementViewCount,
  uploadBlogImage,
  deleteBlogImage,
};
