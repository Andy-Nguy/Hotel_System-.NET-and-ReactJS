import React, { useEffect, useState } from 'react';
const BACKEND_BASE = ((import.meta as any).env?.VITE_API_BASE as string) || 'https://localhost:5001';

function resolveImageUrl(u?: string | null) {
	if (!u) return undefined;
	const s = String(u).trim();
	if (!s) return undefined;
	if (s.startsWith('http') || s.startsWith('//')) return s;
	if (s.startsWith('/assets')) return `${BACKEND_BASE}${s}`;
	if (s.startsWith('/img')) return s;
	if (s.startsWith('/')) return `${BACKEND_BASE}${s}`;
	return `${BACKEND_BASE}/assets/room/${s}`;
}
import { Modal, Button } from 'antd';
import type { Room } from '../../../../Backend/Hotel_System.API/Services/roomService';

type Props = {
	visible: boolean;
	room?: Room | null;
	onClose: () => void;
	onBook: (room: Room) => void;
};

const DetailRoom: React.FC<Props> = ({ visible, room, onClose, onBook }) => {
	if (!room) return null;

	// Modal with proper white border and full-bleed image matching reference design
	return (
		<Modal 
			visible={visible} 
			onCancel={onClose} 
			footer={null} 
			width={980} 
			title={null} 
			bodyStyle={{ padding: 20, background: '#fff' }} 
			centered
			style={{ top: 20 }}
			maskStyle={{ backgroundColor: 'rgba(0, 0, 0, 0.65)' }}
		>
			<div style={{ margin: '-20px', background: '#fff', borderRadius: 8, overflow: 'hidden' }}>
				{/* Black header bar with title and close */}
				<div style={{ 
					background: '#0b0b0b', 
					color: '#fff', 
					padding: '16px 20px', 
					display: 'flex', 
					alignItems: 'center', 
					justifyContent: 'space-between',
					position: 'relative',
					zIndex: 10
				}}>
					<div style={{ fontWeight: 700, fontSize: 18 }}>{room.tenPhong ?? 'Phòng'}</div>
					<button 
						onClick={onClose} 
						aria-label="Close" 
						style={{ 
							background: '#fff', 
							border: 'none', 
							color: '#000', 
							fontSize: 20, 
							cursor: 'pointer', 
							width: 32, 
							height: 32, 
							borderRadius: 4, 
							display: 'flex', 
							alignItems: 'center', 
							justifyContent: 'center',
							fontWeight: 'bold'
						}}
					>
						×
					</button>
				</div>

				{/* Full-bleed image container */}
				<div style={{ 
					width: '100%', 
					height: 400, 
					position: 'relative',
					background: '#f5f5f5'
				}}>
					<DetailImage srcHint={room.urlAnhPhong} alt={room.tenPhong || 'phong'} />
				</div>

				{/* Details area with proper padding */}
				<div style={{ padding: 24 }}>
					<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
						<h3 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>{room.tenPhong}</h3>
						<Button 
							type="default" 
							onClick={() => onBook(room)} 
							style={{ 
								borderRadius: 6, 
								background: '#4a5a4a', 
								color: '#fff', 
								borderColor: '#4a5a4a',
								padding: '8px 20px',
								height: 'auto'
							}}
						>
							Đặt ngay
						</Button>
					</div>

					{room.moTa && (
						<p style={{ color: '#666', marginBottom: 20, lineHeight: 1.6 }}>{room.moTa}</p>
					)}

					{/* Two-column layout */}
					<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginBottom: 24 }}>
						<div>
							<h4 style={{ marginTop: 0, marginBottom: 12, fontSize: 16, fontWeight: 600 }}>Room Overview</h4>
							{/* Show room type name if available */}
							<div style={{ color: '#666', marginBottom: 8 }}>
								{(room as any).tenLoaiPhong ?? (room.xepHangSao ? `${room.xepHangSao} sao` : '—')}
							</div>
							<div style={{ color: '#666' }}>
								Giá: {room.giaCoBanMotDem != null ? room.giaCoBanMotDem.toLocaleString('vi-VN') + '₫/đêm' : 'Liên hệ'}
							</div>
						</div>

						<div>
							<h4 style={{ marginTop: 0, marginBottom: 12, fontSize: 16, fontWeight: 600 }}>Special Benefits</h4>
							<div style={{ color: '#666' }}>Business services, for a fee</div>
						</div>
					</div>

					{/* Beds and features */}
					<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginBottom: 24 }}>
						<div>
							<h5 style={{ marginTop: 0, marginBottom: 8, fontSize: 14, fontWeight: 600 }}>Beds and Bedding</h5>
							<ul style={{ color: '#666', paddingLeft: 16, margin: 0 }}>
								<li style={{ marginBottom: 4 }}>Maximum occupancy: {room.soNguoiToiDa ?? 2}</li>
								<li>{room.soNguoiToiDa && room.soNguoiToiDa >= 1 ? '1 King bed' : 'Standard bedding'}</li>
							</ul>
						</div>

						<div>
							<h5 style={{ marginTop: 0, marginBottom: 8, fontSize: 14, fontWeight: 600 }}>Room Features</h5>
							<ul style={{ color: '#666', paddingLeft: 16, margin: 0 }}>
								<li style={{ marginBottom: 4 }}>{room.moTa?.split(',')[0]?.trim() ?? 'Premium amenities'}</li>
								<li>Air-conditioned</li>
							</ul>
						</div>
					</div>

					{/* Bottom actions */}
					<div style={{ display: 'flex', gap: 12, paddingTop: 16, borderTop: '1px solid #eee' }}>
						<Button 
							type="primary" 
							onClick={() => onBook(room)} 
							style={{ 
								background: '#1a365d', 
								borderColor: '#1a365d',
								borderRadius: 6,
								padding: '10px 24px',
								height: 'auto'
							}}
						>
							Đặt phòng ngay
						</Button>
						<Button 
							onClick={onClose}
							style={{ 
								borderRadius: 6,
								padding: '10px 24px',
								height: 'auto'
							}}
						>
							Đóng
						</Button>
					</div>
				</div>
			</div>
		</Modal>
	);
};

export default DetailRoom;

type DetailImageProps = { srcHint?: string | null; alt?: string };

const DetailImage: React.FC<DetailImageProps> = ({ srcHint, alt }) => {
	const BACKEND_BASE = ((import.meta as any).env?.VITE_API_BASE as string) || 'https://localhost:5001';
	const defaultJpg = '/img/room/room-1.jpg';

	const makeVariant = (base: string, ext: string) => {
		try {
			const idx = base.lastIndexOf('.');
			if (idx > base.lastIndexOf('/')) return base.substring(0, idx) + ext;
		} catch {}
		return base + ext;
	};

	const makeCandidates = (u?: string | null) => {
		const out: string[] = [];
		if (!u) return out;
		// allow comma/pipe-separated list of images
		const parts = String(u).split(/[,|;]+/).map(s => s.trim()).filter(Boolean);
		if (parts.length > 1) {
			for (const p of parts) {
				out.push(...makeCandidates(p));
			}
			return out;
		}

		const s = parts[0] ?? '';
		if (!s) return out;

		// Preserve original format: do not add forced .webp/.jpg variants first
		if (s.startsWith('http') || s.startsWith('//')) {
			out.push(s);
			return out;
		}
		if (s.startsWith('/assets')) {
			out.push(`${BACKEND_BASE}${s}`);
			out.push(`${BACKEND_BASE}${s}`.replace('https:', 'http:').replace(':5001', ':5000'));
			return out;
		}
		if (s.startsWith('/img')) {
			out.push(s);
			return out;
		}
		if (s.startsWith('/')) {
			out.push(`${BACKEND_BASE}${s}`);
			out.push(`${BACKEND_BASE}${s}`.replace('https:', 'http:').replace(':5001', ':5000'));
			return out;
		}
		// filename only
		out.push(`${BACKEND_BASE}/assets/room/${s}`);
		out.push(`${BACKEND_BASE.replace('https:', 'http:').replace(':5001', ':5000')}/assets/room/${s}`);
		return out;
	};

	// Build a list of image candidates for gallery
	const gallerySources = (() => {
		if (!srcHint) return [defaultJpg];
		const parts = String(srcHint).split(/[,|;]+/).map(s => s.trim()).filter(Boolean);
		if (parts.length <= 1) {
			const candidates = makeCandidates(srcHint);
			return candidates.length ? candidates : [defaultJpg];
		}
		// if multiple parts, resolve each to at least one candidate
		const out: string[] = [];
		for (const p of parts) {
			const c = makeCandidates(p);
			if (c.length) out.push(c[0]);
		}
		return out.length ? out : [defaultJpg];
	})();

	const [index, setIndex] = useState(0);
	const [loadedSrcs, setLoadedSrcs] = useState<Record<string, boolean>>({});
	const [displaySrc, setDisplaySrc] = useState<string>(gallerySources[0] ?? defaultJpg);

	useEffect(() => {
		// preload all gallery sources (first available wins for each slot)
		let canceled = false;
		const preload = async () => {
			const results: Record<string, boolean> = {};
			for (const s of gallerySources) {
				try {
					await new Promise<void>((res, rej) => {
						const img = new Image();
						img.crossOrigin = 'anonymous';
						img.onload = () => res();
						img.onerror = () => rej(new Error('failed'));
						img.src = s;
					});
					results[s] = true;
					if (!canceled && !displaySrc) setDisplaySrc(s);
				} catch {
					results[s] = false;
				}
			}
			if (!canceled) {
				setLoadedSrcs(results);
				// ensure current index points to a valid loaded src or fallback
				const cur = gallerySources[index] && results[gallerySources[index]] ? gallerySources[index] : (gallerySources.find(ss => results[ss]) ?? defaultJpg);
				setDisplaySrc(cur);
			}
		};
		preload();
		return () => { canceled = true; };
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [srcHint]);

	useEffect(() => {
		// update display when index changes
		const s = gallerySources[index] ?? defaultJpg;
		setDisplaySrc(loadedSrcs[s] ? s : (gallerySources.find(ss => loadedSrcs[ss]) ?? defaultJpg));
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [index, loadedSrcs]);

	const prev = () => setIndex(i => (i - 1 + gallerySources.length) % gallerySources.length);
	const next = () => setIndex(i => (i + 1) % gallerySources.length);

	return (
		<div style={{ 
			position: 'relative', 
			width: '100%', 
			height: '100%', 
			overflow: 'hidden', 
			backgroundColor: '#f8f9fa',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center'
		}}>
			<img 
				src={displaySrc} 
				alt={alt} 
				crossOrigin="anonymous" 
				style={{ 
					maxWidth: '100%', 
					maxHeight: '100%', 
					width: 'auto', 
					height: 'auto',
					objectFit: 'contain',
					display: 'block'
				}} 
			/>

			{/* Prev/Next controls */}
			{gallerySources.length > 1 && (
				<>
					<button 
						onClick={prev} 
						aria-label="Prev" 
						style={{ 
							position: 'absolute', 
							left: 16, 
							top: '50%', 
							transform: 'translateY(-50%)', 
							background: 'rgba(0,0,0,0.6)', 
							color: '#fff', 
							border: 'none', 
							padding: '12px 16px', 
							borderRadius: 4, 
							cursor: 'pointer',
							fontSize: 16,
							fontWeight: 'bold'
						}}
					>
						‹
					</button>
					<button 
						onClick={next} 
						aria-label="Next" 
						style={{ 
							position: 'absolute', 
							right: 16, 
							top: '50%', 
							transform: 'translateY(-50%)', 
							background: 'rgba(0,0,0,0.6)', 
							color: '#fff', 
							border: 'none', 
							padding: '12px 16px', 
							borderRadius: 4, 
							cursor: 'pointer',
							fontSize: 16,
							fontWeight: 'bold'
						}}
					>
						›
					</button>
				</>
			)}

			{/* Progress indicator */}
			{gallerySources.length > 1 && (
				<div style={{ 
					position: 'absolute', 
					left: '50%', 
					bottom: 16, 
					transform: 'translateX(-50%)',
					background: 'rgba(0,0,0,0.6)', 
					color: '#fff', 
					padding: '6px 12px', 
					borderRadius: 20, 
					fontSize: 14
				}}>
					{index + 1} / {gallerySources.length}
				</div>
			)}
		</div>
	);
};
