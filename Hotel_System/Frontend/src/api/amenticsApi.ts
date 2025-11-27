// Frontend API client for amenities (TienNghi) and room-amenity assignments (TienNghiPhong)

// Resolve API base from Vite env when available (VITE_API_URL). Fall back to "/api" for dev proxy.
const _VITE_API = (import.meta as any).env?.VITE_API_URL || "";
const API_BASE = _VITE_API.replace(/\/$/, "")
  ? `${_VITE_API.replace(/\/$/, "")}/api`
  : "/api";

// ========== AMENITY (TienNghi) CRUD ==========

export interface Amenity {
  idtienNghi: string;
  tenTienNghi: string;
  roomCount?: number;
}

/**
 * Get all amenities with room usage count
 */
export const getAmenities = async (): Promise<Amenity[]> => {
  try {
    const headers: any = {};
    const response = await fetch(`${API_BASE}/TienNghi`, { headers });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();

    // Normalize property names from backend (PascalCase to camelCase)
    return data.map((item: any) => ({
      idtienNghi:
        item.idtienNghi ||
        item.IdtienNghi ||
        item.idTienNghi ||
        item.IdTienNghi,
      tenTienNghi: item.tenTienNghi || item.TenTienNghi,
      roomCount: item.roomCount || item.RoomCount || 0,
    }));
  } catch (error) {
    console.error("Failed to get amenities:", error);
    throw error;
  }
};

/**
 * Get a single amenity by ID
 */
export const getAmenityById = async (id: string): Promise<Amenity> => {
  try {
    const headers: any = {};
    const response = await fetch(`${API_BASE}/TienNghi/${id}`, { headers });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    return {
      idtienNghi: data.idtienNghi || data.IdtienNghi,
      tenTienNghi: data.tenTienNghi || data.TenTienNghi,
      roomCount: data.roomCount || data.RoomCount || 0,
    };
  } catch (error) {
    console.error(`Failed to get amenity ${id}:`, error);
    throw error;
  }
};

/**
 * Create a new amenity
 */
export const createAmenity = async (tenTienNghi: string): Promise<Amenity> => {
  if (!tenTienNghi || tenTienNghi.trim().length === 0) {
    throw new Error("Amenity name is required");
  }
  if (tenTienNghi.length > 100) {
    throw new Error("Amenity name is too long (max 100 characters)");
  }

  try {
    const token = localStorage.getItem("hs_token");
    const headers: any = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${API_BASE}/TienNghi`, {
      method: "POST",
      headers,
      // do not send idtienNghi so backend can assign a TNxx code
      body: JSON.stringify({ tenTienNghi }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return {
      idtienNghi: data.idtienNghi || data.IdtienNghi,
      tenTienNghi: data.tenTienNghi || data.TenTienNghi,
      roomCount: 0,
    };
  } catch (error) {
    console.error("Failed to create amenity:", error);
    throw error;
  }
};

/**
 * Update an amenity
 */
export const updateAmenity = async (
  id: string,
  tenTienNghi: string
): Promise<void> => {
  if (!tenTienNghi || tenTienNghi.trim().length === 0) {
    throw new Error("Amenity name is required");
  }
  if (tenTienNghi.length > 100) {
    throw new Error("Amenity name is too long (max 100 characters)");
  }

  try {
    const token = localStorage.getItem("hs_token");
    const headers: any = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${API_BASE}/TienNghi/${id}`, {
      method: "PUT",
      headers,
      // include both camelCase and PascalCase keys to be robust across serializers
      body: JSON.stringify({
        idtienNghi: id,
        IdtienNghi: id,
        tenTienNghi,
        TenTienNghi: tenTienNghi,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || `HTTP ${response.status}`);
    }
  } catch (error) {
    console.error(`Failed to update amenity ${id}:`, error);
    throw error;
  }
};

/**
 * Delete an amenity (only if not assigned to any room)
 */
export const deleteAmenity = async (id: string): Promise<void> => {
  try {
    const token = localStorage.getItem("hs_token");
    const headers: any = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${API_BASE}/TienNghi/${id}`, {
      method: "DELETE",
      headers,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || `HTTP ${response.status}`);
    }
  } catch (error) {
    console.error(`Failed to delete amenity ${id}:`, error);
    throw error;
  }
};

// ========== ROOM-AMENITY ASSIGNMENT (TienNghiPhong) ==========

export interface RoomAmenityAssignment {
  idPhong: string;
  idtienNghi: string;
  phongName?: string;
  amenityName?: string;
}

/**
 * Get all amenities assigned to a specific room
 */
export const getAmenitiesForRoom = async (roomId: string): Promise<any[]> => {
  try {
    const token = localStorage.getItem("hs_token");
    const headers: any = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${API_BASE}/TienNghiPhong/room/${roomId}`, {
      headers,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    return data.map((item: any) => ({
      idtienNghi: item.idtienNghi || item.IdtienNghi,
      tenTienNghi: item.tenTienNghi || item.TenTienNghi,
    }));
  } catch (error) {
    console.error(`Failed to get amenities for room ${roomId}:`, error);
    throw error;
  }
};

/**
 * Assign an amenity to a room
 */
export const assignAmenityToRoom = async (
  roomId: string,
  amenityId: string
): Promise<void> => {
  if (!roomId || !amenityId) {
    throw new Error("Room ID and Amenity ID are required");
  }

  try {
    const token = localStorage.getItem("hs_token");
    const headers: any = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${API_BASE}/TienNghiPhong`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        // include both camelCase and PascalCase variants to be robust against backend binder expectations
        idPhong: roomId,
        Idphong: roomId,
        idtienNghi: amenityId,
        IdtienNghi: amenityId,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || `HTTP ${response.status}`);
    }
  } catch (error) {
    console.error(
      `Failed to assign amenity ${amenityId} to room ${roomId}:`,
      error
    );
    throw error;
  }
};

/**
 * Remove an amenity from a room
 */
export const removeAmenityFromRoom = async (
  roomId: string,
  amenityId: string
): Promise<void> => {
  if (!roomId || !amenityId) {
    throw new Error("Room ID and Amenity ID are required");
  }

  try {
    const token = localStorage.getItem("hs_token");
    const headers: any = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(
      `${API_BASE}/TienNghiPhong/${roomId}/${amenityId}`,
      {
        method: "DELETE",
        headers,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || `HTTP ${response.status}`);
    }
  } catch (error) {
    console.error(
      `Failed to remove amenity ${amenityId} from room ${roomId}:`,
      error
    );
    throw error;
  }
};
