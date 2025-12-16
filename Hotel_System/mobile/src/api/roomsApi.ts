import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_CONFIG } from "../config/apiConfig";

// All requests will use the host(s) defined in `src/config/apiConfig.ts`
// Increase timeout to be more tolerant on real devices / mobile networks
const TIMEOUT_MS = 8000; // 8s timeout to avoid spurious failures on slower networks

// Simple cache for API responses
const apiCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 30000; // 30 seconds cache

function getCacheKey(url: string, options?: any): string {
  return `${url}_${JSON.stringify(options || {})}`;
}

function getCachedData(key: string): any | null {
  const cached = apiCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`📋 Using cached data for: ${key}`);
    return cached.data;
  }
  return null;
}

function setCachedData(key: string, data: any): void {
  apiCache.set(key, { data, timestamp: Date.now() });
}

export type Amenity = {
  id: string;
  name: string;
};

export type Promotion = {
  id: string;
  name: string;
  description?: string;
  type: "percent" | "amount";
  value: number;
  startDate: string;
  endDate: string;
};

export type Room = {
  idphong: string;
  idloaiPhong?: string;
  tenPhong: string;
  tenLoaiPhong?: string;
  soPhong: string;
  moTa: string;
  soNguoiToiDa: number;
  giaCoBanMotDem: number;
  xepHangSao: number;
  trangThai: string;
  urlAnhPhong: string;
  // Image coming specifically for room TYPE in some API versions
  urlAnhLoaiPhong?: string;
  amenities?: Amenity[];
  promotions?: Promotion[];
};

export type TopRoom = {
  idPhong: string;
  tenPhong: string;
  soLanSuDung: number;
  tongDem: number;
  urlAnhPhong?: string;
  giaCoBanMotDem?: number;
  xepHangSao?: number;
  tenLoaiPhong?: string;
};

export type AvailableRoom = {
  roomId: string;
  roomNumber: string;
  description: string;
  basePricePerNight: number;
  roomImageUrl: string;
  roomTypeName: string;
  maxOccupancy: number;
};

export type CheckAvailableRoomsRequest = {
  checkIn: string; // ISO date string
  checkOut: string; // ISO date string
  numberOfGuests: number;
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

function normalizeImageUrl(
  url: string | null | undefined,
  baseUrl: string = API_CONFIG.CURRENT
): string | undefined {
  if (url === null || url === undefined) return undefined;
  // Coerce to string to avoid errors when API returns non-string (object/number)
  const s = String(url);
  const trimmed = s.trim();
  if (!trimmed) return undefined;
  console.log("normalizeImageUrl input:", { url, baseUrl, trimmed });
  // If already absolute
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    console.log("normalizeImageUrl: already absolute:", trimmed);
    return trimmed;
  }
  // If relative path
  if (trimmed.startsWith("/")) {
    const result = `${baseUrl}${trimmed}`;
    console.log("normalizeImageUrl: relative path result:", result);
    return result;
  }
  // If just filename
  const result = `${baseUrl}/img/room/${trimmed}`;
  console.log("normalizeImageUrl: filename result:", result);
  return result;
}

async function tryFetchRooms(): Promise<Room[] | null> {
  // Use only the current configured API
  const baseUrl = API_CONFIG.CURRENT;
  try {
    console.log(`🌐 Trying: ${baseUrl}/api/Phong`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS); // Reduce timeout to 2s

    const res = await fetch(`${baseUrl}/api/Phong`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    console.log(`Response from ${baseUrl}: ${res.status}`);

    if (res.ok) {
      const data = await handleRes(res);
      console.log(`✅ Success with ${baseUrl}:`, data?.length || 0, "rooms");

      if (!data || data.length === 0) {
        console.warn(`⚠️ ${baseUrl} returned empty data`);
        throw new Error("No rooms data");
      }

      const processedData = (data || []).map((r: any) => {
        const normalizedUrl = normalizeImageUrl(
          r.urlAnhLoaiPhong ?? r.urlAnhPhong ?? r.UrlAnhPhong ?? r.UrlAnhLoaiPhong,
          baseUrl
        );
        console.log(
          `🔄 Normalizing URL for ${r.tenPhong}: "${r.urlAnhPhong}" → "${normalizedUrl}"`
        );

        return {
          idphong: r.idphong ?? r.idPhong ?? r.Idphong ?? r.IdPhong,
          idloaiPhong:
            r.idloaiPhong ?? r.idLoaiPhong ?? r.IdloaiPhong ?? r.IdLoaiPhong,
          tenPhong: r.tenPhong ?? r.TenPhong,
          tenLoaiPhong: r.tenLoaiPhong ?? r.TenLoaiPhong,
          soPhong: r.soPhong ?? r.SoPhong,
          moTa: r.moTa ?? r.MoTa,
          soNguoiToiDa: r.soNguoiToiDa ?? r.SoNguoiToiDa,
          giaCoBanMotDem: r.giaCoBanMotDem ?? r.GiaCoBanMotDem,
          xepHangSao: r.xepHangSao ?? r.XepHangSao ?? 0,
          trangThai: r.trangThai ?? r.TrangThai,
          urlAnhPhong: normalizedUrl, // Force normalized URL last (may be urlAnhLoaiPhong normalized)
          // Add amenities and promotions from API
          amenities: r.amenities ?? [],
          promotions: r.promotions ?? [],
        };
      });

      console.log("🔄 Processed data sample:", processedData[0]?.urlAnhPhong);
      console.log(
        "🎁 Sample room amenities:",
        processedData[0]?.amenities?.length || 0
      );
      console.log(
        "🏷️ Sample room promotions:",
        processedData[0]?.promotions?.length || 0
      );
      return processedData;
    } else {
      console.warn(`⚠️ ${baseUrl} returned:`, res.status, res.statusText);
      return null;
    }
  } catch (error: any) {
    if (error.name === "AbortError") {
      console.warn(`⏰ Timeout with ${baseUrl} after ${TIMEOUT_MS}ms`);
    } else {
      console.warn(`❌ Failed with ${baseUrl}:`, error?.name, error?.message);
    }
    return null;
  }
}

export async function getRooms(): Promise<Room[]> {
  console.log("🎯 Fetching rooms from database (no mock fallback)");

  // Check cache first
  const cacheKey = getCacheKey("getRooms");
  const cachedData = getCachedData(cacheKey);
  if (cachedData) {
    return cachedData;
  }

  const apiData = await tryFetchRooms();
  if (apiData && apiData.length > 0) {
    console.log("✅ Successfully loaded rooms from database:", apiData.length);
    setCachedData(cacheKey, apiData);
    return apiData;
  }

  // No fallback - force real connection
  throw new Error(
    `❌ Cannot connect to backend at ${API_CONFIG.CURRENT}. Please ensure backend is running and accessible.`
  );
}

export async function getRoomById(id: string): Promise<Room> {
  // Use only the current configured API
  const baseUrl = API_CONFIG.CURRENT;
  try {
    const res = await fetch(`${baseUrl}/api/Phong/${id}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    return await handleRes(res);
  } catch (error) {
    throw new Error(`Failed to fetch room by ID from ${baseUrl}: ${error}`);
  }
}

/**
 * Fetch room types (LoaiPhong) and normalize fields for mobile usage
 */
export type RoomTypeMobile = {
  idloaiPhong: string;
  tenLoaiPhong?: string | null;
  moTa?: string | null;
  urlAnhLoaiPhong?: string | null;
};

export async function getRoomTypes(): Promise<RoomTypeMobile[]> {
  const cacheKey = getCacheKey("getRoomTypes");
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  const baseUrl = API_CONFIG.CURRENT;
  try {
    const res = await fetch(`${baseUrl}/api/LoaiPhong`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      console.warn(`Failed to fetch RoomTypes: ${res.status}`);
      setCachedData(cacheKey, []);
      return [];
    }

    const data = await handleRes(res);
    const arr = Array.isArray(data) ? data : data && Array.isArray(data.data) ? data.data : [];

    const normalized = (arr || []).map((rt: any) => ({
      idloaiPhong:
        rt.idloaiPhong ?? rt.idLoaiPhong ?? rt.IdloaiPhong ?? rt.IdLoaiPhong ?? String(rt.id) ?? "",
      tenLoaiPhong: rt.tenLoaiPhong ?? rt.TenLoaiPhong ?? null,
      moTa: rt.moTa ?? rt.MoTa ?? null,
      urlAnhLoaiPhong: normalizeImageUrl(rt.urlAnhLoaiPhong ?? rt.UrlAnhLoaiPhong ?? rt.urlAnhLoaiPhong ?? null, baseUrl) ?? null,
    }));

    setCachedData(cacheKey, normalized);
    return normalized;
  } catch (error) {
    console.warn("Error fetching room types:", error);
    setCachedData(cacheKey, []);
    return [];
  }
}

export async function checkAvailableRooms(
  request: CheckAvailableRoomsRequest
): Promise<AvailableRoom[]> {
  // Create cache key based on request parameters
  const cacheKey = getCacheKey("checkAvailableRooms", request);
  const cachedData = getCachedData(cacheKey);
  if (cachedData) {
    return cachedData;
  }

  // Use only the current configured API
  const baseUrl = API_CONFIG.CURRENT;
  try {
    console.log(
      `🌐 Trying check available rooms: ${baseUrl}/api/Phong/check-available-rooms`
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(`${baseUrl}/api/Phong/check-available-rooms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        CheckIn: request.checkIn,
        CheckOut: request.checkOut,
        NumberOfGuests: request.numberOfGuests,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await handleRes(res);
      console.log(`✅ Available rooms from ${baseUrl}:`, data);

      // Normalize image URLs for mobile app
      const processedData = (data || []).map((room: any) => ({
        ...room,
        roomImageUrl: normalizeImageUrl(room.roomImageUrl, baseUrl),
      }));

      // Cache the result
      setCachedData(cacheKey, processedData || []);

      return processedData || [];
    } else {
      console.warn(`⚠️ ${baseUrl} returned:`, res.status, res.statusText);
      throw new Error(`Failed to check available rooms: ${res.status}`);
    }
  } catch (error: any) {
    if (error.name === "AbortError") {
      console.warn(`⏰ Timeout with ${baseUrl} after ${TIMEOUT_MS}ms`);
      throw new Error(`Request timeout after ${TIMEOUT_MS}ms`);
    } else {
      console.warn(`❌ Failed with ${baseUrl}:`, error?.name, error?.message);
      throw error;
    }
  }
}

// GET: /api/Phong/kiem-tra-trong-theo-loai-phong?loaiPhongId={id}&checkin={YYYY-MM-DD}&checkout={YYYY-MM-DD}&numberOfGuests={n}
export async function checkAvailableRoomsByType(
  loaiPhongId: string,
  checkIn: string,
  checkOut: string,
  numberOfGuests = 1
): Promise<AvailableRoom[]> {
  const cacheKey = getCacheKey("checkAvailableRoomsByType", {
    loaiPhongId,
    checkIn,
  });
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  // Use only the current configured API
  const baseUrl = API_CONFIG.CURRENT;
  try {
    console.log(
      `🌐 Trying GET availability: ${baseUrl}/api/Phong/kiem-tra-trong-theo-loai-phong`
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const qs = `?loaiPhongId=${encodeURIComponent(
      loaiPhongId
    )}&checkin=${encodeURIComponent(checkIn)}&checkout=${encodeURIComponent(
      checkOut
    )}&numberOfGuests=${numberOfGuests}`;
    const res = await fetch(
      `${baseUrl}/api/Phong/kiem-tra-trong-theo-loai-phong${qs}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await handleRes(res);
      // Backend may return either an array of rooms or an object { message: '...' }
      if (!data) {
        console.warn("GET availability returned empty body");
        setCachedData(cacheKey, []);
        return [];
      }

      if (Array.isArray(data)) {
        const processed = data.map(
          (r: any) =>
            ({
              roomId:
                r.roomId ?? r.idphong ?? r.Idphong ?? r.idPhong ?? r.IdPhong,
              roomNumber: r.roomNumber ?? r.soPhong ?? r.SoPhong ?? "",
              description: r.description ?? r.MoTa ?? r.moTa ?? "",
              basePricePerNight:
                r.basePricePerNight ??
                r.giaCoBanMotDem ??
                r.GiaCoBanMotDem ??
                0,
              roomImageUrl: normalizeImageUrl(
                r.roomImageUrl ?? r.urlAnh ?? r.UrlAnhPhong ?? r.urlAnhPhong,
                baseUrl
              ),
              roomTypeName:
                r.roomTypeName ?? r.tenLoaiPhong ?? r.TenLoaiPhong ?? "",
              maxOccupancy:
                r.maxOccupancy ?? r.soNguoiToiDa ?? r.SoNguoiToiDa ?? 1,
            } as AvailableRoom)
        );

        setCachedData(cacheKey, processed);
        return processed;
      }

      // If server returned an object with message => no rooms
      if (typeof data === "object" && data.message) {
        console.warn("GET availability returned message:", data.message);
        setCachedData(cacheKey, []);
        return [];
      }

      // Unexpected shape
      console.warn("GET availability unexpected response shape", data);
      setCachedData(cacheKey, []);
      return [];
    } else {
      console.warn(`⚠️ ${baseUrl} returned:`, res.status, res.statusText);
      throw new Error(`Failed to check availability: ${res.status}`);
    }
  } catch (error: any) {
    if (error.name === "AbortError") {
      console.warn(`⏰ Timeout with ${baseUrl} after ${TIMEOUT_MS}ms`);
      throw new Error(`Request timeout after ${TIMEOUT_MS}ms`);
    } else {
      console.warn(
        `❌ Failed GET availability with ${baseUrl}:`,
        error?.name,
        error?.message
      );
      throw error;
    }
  }
}

/**
 * Get top rooms for 2025 based on booking frequency
 * @param top - Number of top rooms to retrieve (default: 5)
 * @returns Array of TopRoom objects
 */
export async function getTopRooms2025(top: number = 5): Promise<TopRoom[]> {
  console.log(`🔍 Fetching top ${top} rooms for 2025...`);

  const cacheKey = getCacheKey(`/api/Phong/top-rooms-2025?top=${top}`);
  const cached = getCachedData(cacheKey);
  if (cached) {
    return cached;
  }

  const errors: string[] = [];
  // Use only the current configured API
  const baseUrl = API_CONFIG.CURRENT;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const url = `${baseUrl}/api/Phong/top-rooms-2025?top=${top}`;
    console.log(`🌐 Trying GET top rooms: ${url}`);

    const res = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await handleRes(res);
      console.log("✅ GET top rooms success:", data);

      // Handle response structure
      if (Array.isArray(data)) {
        // Normalize image URLs
        const normalized = data.map((room: any) => ({
          ...room,
          urlAnhPhong: normalizeImageUrl(room.urlAnhPhong, baseUrl),
        }));
        setCachedData(cacheKey, normalized);
        return normalized;
      } else if (data && Array.isArray(data.data)) {
        const normalized = data.data.map((room: any) => ({
          ...room,
          urlAnhPhong: normalizeImageUrl(room.urlAnhPhong, baseUrl),
        }));
        setCachedData(cacheKey, normalized);
        return normalized;
      } else {
        console.warn("GET top rooms unexpected response shape", data);
        setCachedData(cacheKey, []);
        return [];
      }
    } else {
      const msg = `⚠️ ${baseUrl} returned ${res.status} ${res.statusText}`;
      console.warn(msg);
      throw new Error(msg);
    }
  } catch (error: any) {
    const baseMsg =
      error?.name === "AbortError"
        ? `⏰ Timeout with ${baseUrl} after ${TIMEOUT_MS}ms`
        : `❌ Failed GET top rooms with ${baseUrl}: ${error?.message || error}`;
    console.warn(baseMsg);
    throw new Error(baseMsg);
  }
}

export default {
  getRooms,
  getRoomById,
  checkAvailableRooms,
  checkAvailableRoomsByType,
  getTopRooms2025,
  getRoomTypes,
};
