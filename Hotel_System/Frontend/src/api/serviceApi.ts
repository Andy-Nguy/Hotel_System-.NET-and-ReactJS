// Frontend API helper for service (DichVu) management
// Frontend API helper for service (DichVu) management
// Provides CRUD operations for DichVu, TTDichVu (details) and recording service usage (CTHDDV)

export interface Service {
	iddichVu: string;
	tenDichVu: string;
	tienDichVu?: number | null;
	hinhDichVu?: string | null;
	thoiGianBatDau?: string | null; // serialized TimeSpan (e.g. "08:00:00")
	thoiGianKetThuc?: string | null;
	trangThai?: string | null; // "Đang hoạt động" or "Ngưng hoạt động"
}

export interface ServiceDetail {
	idttdichVu: string;
	iddichVu: string;
	thongTinDv?: string | null;
	thoiLuongUocTinh?: number | null;
	ghiChu?: string | null;
}

export interface ServiceUsage {
	idhoaDon: string;
	iddichVu: string;
	tienDichVu?: number;
	thoiGianThucHien?: string; // ISO string
	thoiGianBatDau?: string | null; // ISO datetime string
	thoiGianKetThuc?: string | null;
	trangThai?: string | null;
}

const API_BASE = ""; // use relative paths so Vite proxy forwards /api to backend in dev

async function fetchApi(endpoint: string, options?: RequestInit) {
	try {
		const res = await fetch(`${API_BASE}${endpoint}`, options);

		// treat not-found and no-content as null (caller will handle)
		if (res.status === 404 || res.status === 204) return null;

		if (!res.ok) {
			const text = await res.text().catch(() => null);
			if (text) console.warn(`API ${endpoint} returned ${res.status}: ${text}`);
			// For non-GET methods (POST/PUT/DELETE) throw an error so callers can surface server messages.
			const method = (options && (options.method as string)) ?? 'GET';
			if (method.toUpperCase() !== 'GET') {
				// try to parse JSON error body
				let parsed: any = text;
				try { parsed = JSON.parse(text ?? ''); } catch { /* ignore */ }
				throw new Error(parsed?.message ?? text ?? `API error ${res.status}`);
			}
			// For GET requests, return null for 404/other client errors so UI lists stay usable
			return null;
		}

		const contentType = res.headers.get("content-type") ?? "";
		if (!contentType.includes("application/json")) return null;
		return await res.json();
	} catch (err: any) {
		// network/CORS/fetch errors surface as TypeError in browsers. Log and return null so UI stays usable.
		console.warn(`fetchApi: ${endpoint} failed - ${err?.message ?? err}`);
		return null;
	}
}

function normalizeService(raw: any): Service {
	if (!raw) {
		// return a safe empty service to avoid runtime crashes; callers should handle errors earlier
		return {
			iddichVu: "",
			tenDichVu: "",
			tienDichVu: null,
			hinhDichVu: null,
			thoiGianBatDau: null,
			thoiGianKetThuc: null,
			trangThai: null,
		};
	}
	let hinhDichVu = raw.hinhDichVu ?? raw.HinhDichVu ?? null;
	// If fileName is stored (without path), prepend the path
	if (hinhDichVu && !hinhDichVu.startsWith('/') && !hinhDichVu.startsWith('http')) {
		hinhDichVu = `/img/services/${hinhDichVu}`;
	}
	return {
		iddichVu: raw.iddichVu ?? raw.IddichVu ?? raw.id ?? "",
		tenDichVu: raw.tenDichVu ?? raw.TenDichVu ?? "",
		tienDichVu: raw.tienDichVu ?? raw.TienDichVu ?? null,
		hinhDichVu,
		thoiGianBatDau: raw.thoiGianBatDau ?? raw.ThoiGianBatDau ?? null,
		thoiGianKetThuc: raw.thoiGianKetThuc ?? raw.ThoiGianKetThuc ?? null,
		trangThai: raw.trangThai ?? raw.TrangThai ?? null,
	};
}

export async function getServices(): Promise<Service[]> {
	const data = await fetchApi('/api/DichVu');
	if (!data) return [];
	const arr = Array.isArray(data) ? data : (data.items ?? data.data ?? [data]);
	return arr.map(normalizeService);
}

export async function getServiceById(serviceId: string): Promise<Service> {
	const data = await fetchApi(`/api/DichVu/${serviceId}`);
	if (!data) throw new Error('Service not found');
	return normalizeService(data);
}

export async function createService(payload: Partial<Service>): Promise<Service> {
	const data = await fetchApi('/api/DichVu', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	});
	if (!data) throw new Error('Empty response from server when creating service');
	return normalizeService(data);
}

export async function updateService(id: string, payload: Partial<Service>): Promise<void> {
	// Ensure the payload includes the service id so model binding/validation on the server
	// does not reject the request due to the required IddichVu field.
	const bodyPayload = { ...payload, iddichVu: payload.iddichVu ?? id };
	await fetchApi(`/api/DichVu/${id}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(bodyPayload),
	});
}

export async function deleteService(id: string): Promise<void> {
	await fetchApi(`/api/DichVu/${id}`, { method: 'DELETE' });
}

// Service details (TTDichVu)
export async function createServiceDetail(serviceId: string, payload: Partial<ServiceDetail>): Promise<ServiceDetail> {
	const data = await fetchApi(`/api/DichVu/${serviceId}/details`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	});
	return {
		idttdichVu: data?.idttdichVu ?? data?.IdttdichVu ?? data?.id ?? "",
		iddichVu: data?.iddichVu ?? data?.IddichVu ?? serviceId,
		thongTinDv: data?.thongTinDv ?? data?.ThongTinDv ?? null,
	};
}

export async function updateServiceDetail(id: string, payload: Partial<ServiceDetail>): Promise<void> {
	await fetchApi(`/api/DichVu/details/${id}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	});
}

export async function deleteServiceDetail(id: string): Promise<void> {
	await fetchApi(`/api/DichVu/details/${id}`, { method: 'DELETE' });
}

// Record service usage (CTHDDV)
export async function recordServiceUsage(payload: ServiceUsage): Promise<void> {
	await fetchApi('/api/DichVu/use', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	});
}

export async function getServiceDetails(serviceId: string): Promise<ServiceDetail[]> {
	const endpoint = `/api/DichVu/${serviceId}/details`;
	const data = await fetchApi(endpoint);
	if (!data) return [];
	const arr = Array.isArray(data) ? data : (data.items ?? data.data ?? [data]);
	return arr.map((d: any) => ({
		idttdichVu: d.idttdichVu ?? d.IdttdichVu ?? d.id ?? "",
		iddichVu: d.iddichVu ?? d.IddichVu ?? serviceId,
		thongTinDv: d.thongTinDv ?? d.ThongTinDv ?? null,
		thoiLuongUocTinh: d.thoiLuongUocTinh ?? d.ThoiLuongUocTinh ?? null,
		ghiChu: d.ghiChu ?? d.GhiChu ?? null,
	}));
}

export async function getServiceUsage(serviceId: string): Promise<ServiceUsage[]> {
	const endpoint = `/api/DichVu/${serviceId}/usage`;
	const data = await fetchApi(endpoint);
	if (!data) return [];
	const arr = Array.isArray(data) ? data : (data.items ?? data.data ?? [data]);
	return arr.map((u: any) => ({
		idhoaDon: u.idhoaDon ?? u.IdhoaDon ?? u.IdHoaDon ?? u.idhoadon ?? "",
		iddichVu: u.iddichVu ?? u.IddichVu ?? serviceId,
		tienDichVu: u.tienDichVu ?? u.TienDichVu ?? null,
		thoiGianThucHien: u.thoiGianThucHien ?? u.ThoiGianThucHien ?? null,
		thoiGianBatDau: u.thoiGianBatDau ?? u.ThoiGianBatDau ?? null,
		thoiGianKetThuc: u.thoiGianKetThuc ?? u.ThoiGianKetThuc ?? null,
		trangThai: u.trangThai ?? u.TrangThai ?? null,
	}));
}

export async function getAllUsage(): Promise<ServiceUsage[]> {
	const endpoint = '/api/DichVu/usage/all';
	const data = await fetchApi(endpoint);
	if (!data) return [];
	const arr = Array.isArray(data) ? data : (data.items ?? data.data ?? [data]);
	return arr.map((u: any) => ({
		idhoaDon: u.idhoaDon ?? u.IdhoaDon ?? u.IdHoaDon ?? u.idhoadon ?? "",
		iddichVu: u.iddichVu ?? u.IddichVu ?? "",
		tienDichVu: u.tienDichVu ?? u.TienDichVu ?? null,
		thoiGianThucHien: u.thoiGianThucHien ?? u.ThoiGianThucHien ?? null,
		thoiGianBatDau: u.thoiGianBatDau ?? u.ThoiGianBatDau ?? null,
		thoiGianKetThuc: u.thoiGianKetThuc ?? u.ThoiGianKetThuc ?? null,
		trangThai: u.trangThai ?? u.TrangThai ?? null,
	}));
}

export async function uploadServiceImage(file: File): Promise<{ fileName: string }>
{
	const fd = new FormData();
	fd.append('file', file);
	const res = await fetch(`/api/DichVu/upload`, { method: 'POST', body: fd });
	if (!res.ok) {
		const t = await res.text().catch(() => null);
		throw new Error(`Upload failed ${res.status}${t ? `: ${t}` : ''}`);
	}
	const data = await res.json();
	return { fileName: data.fileName ?? '' };
}

export default {
	getServices,
	getServiceById,
	createService,
	updateService,
	deleteService,
	createServiceDetail,
	updateServiceDetail,
	deleteServiceDetail,
	recordServiceUsage,
	getServiceDetails,
	getServiceUsage,
	getAllUsage,
	uploadServiceImage,
};
