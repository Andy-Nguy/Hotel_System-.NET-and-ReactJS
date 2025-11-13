import AsyncStorage from "@react-native-async-storage/async-storage";

// Force backend host for mobile testing (use this IP for iPhone/device)
// All requests will go to: http://192.168.1.129:8080
const BASE_URLS = ["http://192.168.1.129:8080"]; // single preferred host

const TIMEOUT_MS = 2000; // Reduced from 5000ms to 2000ms

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

export type Room = {
  idphong: string;
  tenPhong: string;
  soPhong: string;
  moTa: string;
  soNguoiToiDa: number;
  giaCoBanMotDem: number;
  xepHangSao: number;
  trangThai: string;
  urlAnhPhong: string;
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
  baseUrl: string = BASE_URLS[0]
): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
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
  for (const baseUrl of BASE_URLS) {
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
          continue;
        }

        const processedData = (data || []).map((r: any) => {
          const normalizedUrl = normalizeImageUrl(
            r.urlAnhPhong ?? r.UrlAnhPhong,
            baseUrl
          );
          console.log(
            `🔄 Normalizing URL for ${r.tenPhong}: "${r.urlAnhPhong}" → "${normalizedUrl}"`
          );

          return {
            idphong: r.idphong ?? r.idPhong ?? r.Idphong ?? r.IdPhong,
            tenPhong: r.tenPhong ?? r.TenPhong,
            soPhong: r.soPhong ?? r.SoPhong,
            moTa: r.moTa ?? r.MoTa,
            soNguoiToiDa: r.soNguoiToiDa ?? r.SoNguoiToiDa,
            giaCoBanMotDem: r.giaCoBanMotDem ?? r.GiaCoBanMotDem,
            xepHangSao: r.xepHangSao ?? r.XepHangSao ?? 0,
            trangThai: r.trangThai ?? r.TrangThai ?? "Còn phòng",
            urlAnhPhong: normalizedUrl, // Force normalized URL last
          };
        });

        console.log("🔄 Processed data sample:", processedData[0]?.urlAnhPhong);
        return processedData;
      } else {
        console.warn(`⚠️ ${baseUrl} returned:`, res.status, res.statusText);
      }
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.warn(`⏰ Timeout with ${baseUrl} after ${TIMEOUT_MS}ms`);
      } else {
        console.warn(`❌ Failed with ${baseUrl}:`, error?.name, error?.message);
      }
      continue;
    }
  }
  return null;
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
    "❌ Cannot connect to backend database. Please ensure backend is running and accessible."
  );
}

export async function getRoomById(id: string): Promise<Room> {
  // Try each base URL until one works
  for (const baseUrl of BASE_URLS) {
    try {
      const res = await fetch(`${baseUrl}/api/Phong/${id}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      return await handleRes(res);
    } catch (error) {
      continue;
    }
  }
  throw new Error("Failed to fetch room by ID from all endpoints");
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

  for (const baseUrl of BASE_URLS) {
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
      }
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.warn(`⏰ Timeout with ${baseUrl} after ${TIMEOUT_MS}ms`);
      } else {
        console.warn(`❌ Failed with ${baseUrl}:`, error?.name, error?.message);
      }
      continue;
    }
  }
  throw new Error("Failed to check available rooms from all endpoints");
}

export default { getRooms, getRoomById, checkAvailableRooms };
