// Centralized rooms API helper
// Exports a small wrapper around the /api/Phong endpoint so fetch usage
// is in one place and easier to control / mock / extend.

export type RawRoom = any;

const API_BASE = ""; // keep empty so relative paths (proxy) still work

export async function getRooms(): Promise<RawRoom[]> {
  const url = `${API_BASE}/api/Phong`;
  const res = await fetch(url);
  if (!res.ok) {
    // try to include response text for better diagnostics
    const text = await res.text().catch(() => null);
    throw new Error(`API error ${res.status}${text ? `: ${text}` : ""}`);
  }

  const data = await res.json();
  // normalize to array when possible
  if (Array.isArray(data)) return data;
  // sometimes APIs wrap results: try common shapes
  if (data && Array.isArray((data as any).items)) return (data as any).items;
  if (data && Array.isArray((data as any).data)) return (data as any).data;

  // fallback: if it's an object with keys, return as single-item array
  return data ? [data] : [];
}

export default { getRooms };
