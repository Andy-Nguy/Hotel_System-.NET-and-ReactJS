import { buildApiUrl } from "../config/apiConfig";

export const getRoomImages = (room: any): string[] => {
  if (!room) return [];

  // Gather candidates as an array (from common fields)
  let imgs: any[] = [];

  if (Array.isArray(room.UrlAnhPhong) && room.UrlAnhPhong.length)
    imgs = room.UrlAnhPhong;
  else if (Array.isArray(room.urlAnhPhong) && room.urlAnhPhong.length)
    imgs = room.urlAnhPhong;
  else if (Array.isArray(room.RoomImageUrls) && room.RoomImageUrls.length)
    imgs = room.RoomImageUrls;
  else if (Array.isArray(room.roomImageUrls) && room.roomImageUrls.length)
    imgs = room.roomImageUrls;
  else {
    const single =
      room.roomImageUrl ||
      room.urlAnhPhong ||
      room.UrlAnhPhong ||
      room.roomImage ||
      room.image;
    if (single) imgs = [single];
  }

  // Normalize all image entries to full URLs
  const normalized = imgs
    .map((s: any) => (s === null || s === undefined ? "" : String(s).trim()))
    .filter((s: string) => s.length > 0)
    .map((s: string) => {
      if (s.startsWith("http://") || s.startsWith("https://")) return s;
      // If it's a relative path or filename, build a full URL
      // Ensure path starts with '/'
      const path = s.startsWith("/") ? s : `/${s}`;
      return buildApiUrl(path);
    });

  return normalized;
};

export const getPrimaryRoomImage = (room: any): string | null => {
  const imgs = getRoomImages(room);
  return imgs.length ? imgs[0] : null;
};
