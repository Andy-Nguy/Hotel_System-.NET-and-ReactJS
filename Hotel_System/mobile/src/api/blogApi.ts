// Simplified API client for Mobile: only 3 functions
// - getPublishedBlogs()
// - getBlogBySlug(slugOrId)
// - getBlogById(id)

// NOTE: Do NOT import JSON files from the backend folder here.
// Metro (React Native bundler) does not allow importing files located
// outside the mobile project root by default. This file intentionally
// relies on the backend API endpoints only. If you need a local
// development fallback, either:
// - Serve the JSON via the backend (recommended): `GET ${API_BASE}/api/blog`;
// - Copy the backend JSON into `mobile/src/data/blogposts.json` (dev only);
// - Or configure Metro to allow extra roots (advanced).
import { API_CONFIG } from "../config/apiConfig";

export interface BlogPost {
  id: number;
  title: string;
  category?: string;
  type?: "internal" | "external";
  slug?: string;
  image?: string;
  images?: string[];
  date?: string;
  excerpt?: string;
  author?: string;
  tags?: string[];
  content?: string;
  externalLink?: string;
  status?: string;
  displayOrder?: number | null;
  viewCount?: number;
}

// Resolve base URL (API_CONFIG.CURRENT can be string or array)
const baseConfig = API_CONFIG && (API_CONFIG as any).CURRENT;
const API_BASE = Array.isArray(baseConfig)
  ? baseConfig[0]
  : typeof baseConfig === "string"
  ? baseConfig
  : "";
const API_ROOT = `${API_BASE.replace(/\/$/, "")}/api`;

const toAbsoluteUrl = (p?: any): string | undefined => {
  if (p === undefined || p === null) return undefined;
  const s = String(p).trim();
  if (!s) return undefined;
  if (s.startsWith("http")) return s;
  if (!s.startsWith("/")) return s;
  return `${API_BASE.replace(/\/$/, "")}${s}`;
};

const normalize = (d: any): BlogPost => {
  const id = d?.id ?? d?.Id ?? 0;
  const title = d?.title ?? d?.Title ?? "";
  const slug = d?.slug ?? d?.Slug;
  const category = d?.category ?? d?.Category ?? "";
  const type = (d?.type ?? d?.Type ?? "internal") as "internal" | "external";
  const image = d?.image ?? d?.Image;
  const images = d?.images ?? d?.Images ?? [];
  const date = d?.date ?? d?.Date ?? d?.publishedAt ?? d?.PublishedAt;
  const excerpt = d?.excerpt ?? d?.Excerpt ?? "";
  const author = d?.author ?? d?.Author;
  const tags = d?.tags ?? d?.Tags;
  const content = d?.content ?? d?.Content ?? "";
  const externalLink = d?.externalLink ?? d?.ExternalLink;
  const status = (d?.status ?? d?.Status ?? "").toString().toUpperCase();
  const displayOrder = d?.displayOrder ?? d?.DisplayOrder ?? null;
  const viewCount = d?.viewCount ?? d?.ViewCount ?? 0;

  return {
    id,
    title,
    category,
    type,
    slug,
    image: toAbsoluteUrl(image) || image,
    images: Array.isArray(images)
      ? images.map((i: string) => toAbsoluteUrl(i) || i)
      : [],
    date,
    excerpt,
    author,
    tags:
      typeof tags === "string"
        ? tags
          ? tags
              .split(",")
              .map((t: string) => t.trim())
              .filter(Boolean)
          : []
        : Array.isArray(tags)
        ? tags
        : [],
    content,
    externalLink,
    status,
    displayOrder,
    viewCount,
  };
};

const fetchApi = async (path: string, options: RequestInit = {}) => {
  const url = `${API_ROOT}${path.startsWith("/") ? path : "/" + path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export const getPublishedBlogs = async (): Promise<BlogPost[]> => {
  try {
    const data = await fetchApi("/blog");
    const arr = Array.isArray(data) ? data : [];
    return arr
      .map(normalize)
      .filter((b) => (b.status || "").toString().toUpperCase() === "PUBLISHED")
      .sort(
        (a, b) =>
          (typeof a.displayOrder === "number" ? a.displayOrder : 999) -
          (typeof b.displayOrder === "number" ? b.displayOrder : 999)
      );
  } catch (e) {
    console.warn(
      "getPublishedBlogs: API failed and no local fallback is configured",
      e
    );
    // No local JSON fallback here by design (see note above). Return empty array so UI can handle it.
    return [];
  }
};

export const getBlogBySlug = async (
  slugOrId: string | number
): Promise<BlogPost> => {
  try {
    const data = await fetchApi(`/blog/${slugOrId}`);
    return normalize(data);
  } catch (e) {
    console.warn(
      `getBlogBySlug: API failed for ${slugOrId} and no local fallback is configured`,
      e
    );
    // No local fallback by design; bubble up the error so caller can show an appropriate message.
    throw e;
  }
};

export const getBlogById = async (id: number): Promise<BlogPost> => {
  return getBlogBySlug(id);
};

export default { getPublishedBlogs, getBlogBySlug, getBlogById };
