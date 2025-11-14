import apiConfig from '../config/apiConfig';

const API_BASE = `${apiConfig.BASE_URL}/api/TienNghiPhong`;

export interface Amenity {
  idtienNghi: string;
  tenTienNghi: string;
}

/**
 * Get amenities for a specific room
 * @param roomId The ID of the room
 */
export const getAmenitiesForRoom = async (roomId: string): Promise<Amenity[]> => {
  try {
    console.log(`[amenitiesApi] Fetching amenities for room: ${roomId}`);
    
    const response = await fetch(`${API_BASE}/room/${roomId}`);
    
    if (!response.ok) {
      console.warn(`[amenitiesApi] HTTP ${response.status} for room ${roomId}`);
      return [];
    }

    const data = await response.json();
    console.log(`[amenitiesApi] Raw amenities data:`, data);

    // Normalize property names from backend (PascalCase to camelCase)
    const normalized = (Array.isArray(data) ? data : []).map((item: any) => ({
      idtienNghi: item.idtienNghi || item.IdtienNghi || item.idTienNghi || item.IdTienNghi || '',
      tenTienNghi: item.tenTienNghi || item.TenTienNghi || '',
    }));

    console.log(`[amenitiesApi] Normalized amenities:`, normalized);
    return normalized;
  } catch (error) {
    console.error(`[amenitiesApi] Failed to get amenities for room ${roomId}:`, error);
    return [];
  }
};

export default { getAmenitiesForRoom };
