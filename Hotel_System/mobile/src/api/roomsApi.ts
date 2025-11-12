import AsyncStorage from "@react-native-async-storage/async-storage";

// Try multiple base URLs for different environments
const BASE_URLS = [
  "http://10.0.2.2:8080", // For Android emulator (PRIORITY)
  "http://192.168.1.129:8080", // Local network IP
  "http://localhost:8080", // For web/Expo web
  "http://127.0.0.1:8080", // Alternative localhost
];

export type Room = {
  idphong: string;
  tenPhong?: string;
  soPhong?: string;
  moTa?: string;
  soNguoiToiDa?: number;
  giaCoBanMotDem?: number;
  xepHangSao?: number;
  urlAnhPhong?: string;
  [key: string]: any;
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
      const timeoutId = setTimeout(() => controller.abort(), 5000); // Reduce timeout to 5s

      const res = await fetch(`${baseUrl}/api/Phong`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      console.log(`📡 Response from ${baseUrl}:`, res.status, res.statusText);

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
        console.warn(`⏰ Timeout with ${baseUrl} after 5 seconds`);
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

  const apiData = await tryFetchRooms();
  if (apiData && apiData.length > 0) {
    console.log("✅ Successfully loaded rooms from database:", apiData.length);
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

export default { getRooms, getRoomById };
