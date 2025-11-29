import React, { useEffect, useState } from "react";
import { getServices, getServiceById, Service as ApiService } from "../api/serviceApi";
import { getAllPromotions } from "../api/promotionApi";
import DetailComboCard from './DetailComboCard';

type Service = {
	id: string;
	HinhDichVu?: string;
	TenDichVu: string;
	TienDichVu: number;
	TrangThai?: string;
	thoiGianBatDau?: string | null;
	thoiGianKetThuc?: string | null;
	// Promotion fields (may come from joined promotion table)
	giaKhuyenMai?: number | null;
	tenKhuyenMai?: string | null;
	phanTramGiam?: number | null;
};

type SelectedService = {
	serviceId: string;
	serviceName: string;
	price: number;
	quantity: number;
};

interface ServicesSelectorProps {
	onServicesChange?: (services: SelectedService[], total: number) => void;
}

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
	style: "currency",
	currency: "VND",
});

const placeholderImg = "/img/service-placeholder.png";

function formatDuration(minutes?: number | null) {
	if (!minutes && minutes !== 0) return "";
	const m = Number(minutes) || 0;
	const h = Math.floor(m / 60);
	const mins = m % 60;
	if (h > 0) return `${h}h ${mins}m`;
	return `${mins}m`;
}

const ServicesSelector: React.FC<ServicesSelectorProps> = ({ onServicesChange }) => {
	const [services, setServices] = useState<Service[]>([]);
	const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);
	const [combos, setCombos] = useState<any[]>([]);
	const [lockedServiceIds, setLockedServiceIds] = useState<string[]>([]);
	const [open, setOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [detail, setDetail] = useState<ApiService | null>(null);
	const [showDetail, setShowDetail] = useState(false);
	const [detailLoading, setDetailLoading] = useState(false);
	
	// Mini tooltip: hiển thị bên trái dịch vụ vừa chọn
	const [activeTooltip, setActiveTooltip] = useState<{ serviceId: string; combo: any } | null>(null);
	const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(null);
	// Refs to service DOM nodes so tooltip can stay anchored
	const itemRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
	
	// Upgrade modal: hiển thị khi chọn 2+ dịch vụ của cùng combo
	const [upgradePrompt, setUpgradePrompt] = useState<{ combo: any; overlap: string[] } | null>(null);
	const [showUpgradeModal, setShowUpgradeModal] = useState(false);
	
	// Detail combo modal
	const [comboDetail, setComboDetail] = useState<any | null>(null);
	const [showComboDetail, setShowComboDetail] = useState(false);

	useEffect(() => {
		let mounted = true;
		const load = async () => {
			setLoading(true);
			setError(null);
			try {
				const data = await getServices();
				if (!mounted) return;
				
				const mapped: Service[] = (data || []).map((a: ApiService) => ({
					id: a.iddichVu ?? String(Math.random()),
					HinhDichVu: a.hinhDichVu ?? undefined,
					TenDichVu: a.tenDichVu ?? "",
					TienDichVu: a.tienDichVu ?? 0,
					TrangThai: a.trangThai ?? undefined,
					thoiGianBatDau: a.thoiGianBatDau ?? null,
					thoiGianKetThuc: a.thoiGianKetThuc ?? null,
					giaKhuyenMai: (a as any).giaKhuyenMai ?? (a as any).GiaKhuyenMai ?? null,
					tenKhuyenMai: (a as any).tenKhuyenMai ?? (a as any).TenKhuyenMai ?? null,
					phanTramGiam: (a as any).phanTramGiam ?? (a as any).PhanTramGiam ?? null,
				}));
				setServices(mapped);

				// Load combos từ promotions API
				try {
					const promos = await getAllPromotions("active");
					if (Array.isArray(promos) && promos.length > 0) {
						const allCombos: any[] = [];
						promos.forEach((p: any) => {
							const promoActive = (p.trangThai || p.TrangThai || '').toLowerCase() === 'active';
							if (!promoActive) return;

							const combos = p.khuyenMaiCombos || p.KhuyenMaiCombos || [];
							combos.forEach((combo: any) => {
								const comboActive = !combo.trangThai || (combo.trangThai || combo.TrangThai || '').toLowerCase() === 'active';
								if (!comboActive) return;

								const mappings = (combo.khuyenMaiComboDichVus || combo.KhuyenMaiComboDichVus || []);
								const serviceIds = mappings.map((s: any) => s.iddichVu || s.IddichVu).filter(Boolean);

								if (serviceIds.length > 0) {
									// Calculate original price from service details
									const originalPrice = mappings.reduce((sum: number, s: any) => sum + (Number(s.tienDichVu ?? s.TienDichVu ?? 0) || 0), 0);
									
									// Calculate combo price based on discount type
									const loaiGiamGia = (p.loaiGiamGia || p.LoaiGiamGia || 'amount').toLowerCase();
									const giaTriGiam = Number(p.giaTriGiam ?? p.GiaTriGiam ?? 0);
									const comboPrice = loaiGiamGia === 'percent' 
										? Math.round(originalPrice * (1 - giaTriGiam / 100))
										: Math.round(Math.max(0, originalPrice - giaTriGiam));

									allCombos.push({
										comboId: combo.idkhuyenMaiCombo || combo.IdkhuyenMaiCombo || String(Math.random()),
										promotionId: p.idkhuyenMai || p.IdkhuyenMai,
										name: combo.tenCombo || combo.TenCombo || 'Combo',
										services: serviceIds,
										serviceDetails: mappings.map((s: any) => ({
											iddichVu: s.iddichVu || s.IddichVu,
											tenDichVu: s.tenDichVu || s.TenDichVu || '',
											tienDichVu: Number(s.tienDichVu ?? s.TienDichVu ?? 0) || 0,
											hinhDichVu: s.hinhDichVu || s.HinhDichVu || null,
											thongTinDv: s.thongTinDv || s.ThongTinDv || null,
											thoiLuongUocTinh: s.thoiLuongUocTinh || s.ThoiLuongUocTinh || null,
											isActive: s.isActive ?? s.IsActive ?? true
										})),
										originalPrice,
										comboPrice,
										loaiGiamGia,
										giaTriGiam,
										moTa: combo.moTa || combo.MoTa || p.moTa || p.MoTa || null,
										ngayBatDau: combo.ngayBatDau || combo.NgayBatDau || p.ngayBatDau || p.NgayBatDau || null,
										ngayKetThuc: combo.ngayKetThuc || combo.NgayKetThuc || p.ngayKetThuc || p.NgayKetThuc || null,
										hinhAnhBanner: combo.hinhAnhBanner || combo.HinhAnhBanner || p.hinhAnhBanner || p.HinhAnhBanner || null,
										createdAt: combo.createdAt || combo.CreatedAt || p.createdAt || p.CreatedAt || null,
										updatedAt: combo.updatedAt || combo.UpdatedAt || p.updatedAt || p.UpdatedAt || null,
										isActive: comboActive
									});
								}
							});
						});
						setCombos(allCombos);
						console.log('Loaded combos:', allCombos);
					}
				} catch (err) {
					console.error('Failed to load combos:', err);
				}
			} catch (e) {
				console.error(e);
				setError("Không thể tải danh sách dịch vụ");
			} finally {
				setLoading(false);
			}
		};
		load();
		return () => { mounted = false; };
	}, []);

	// Use ref to avoid infinite loop if onServicesChange is not memoized
	const onServicesChangeRef = React.useRef(onServicesChange);
	useEffect(() => {
		onServicesChangeRef.current = onServicesChange;
	}, [onServicesChange]);

	useEffect(() => {
		const total = selectedServices.reduce((s, it) => s + it.price * it.quantity, 0);
		onServicesChangeRef.current?.(selectedServices, total);
	}, [selectedServices]);

	const isAvailable = (status?: string) => {
		if (!status) return true;
		const s = status.toLowerCase();
		if (s.includes("ngưng") || s.includes("inactive") || s.includes("không")) return false;
		return true;
	};

	const toggleSelect = (svc: Service, event?: React.MouseEvent) => {
		// Ngăn chặn nếu dịch vụ đã nằm trong combo đang chọn
		if (lockedServiceIds.includes(svc.id)) return;

		const idx = selectedServices.findIndex(s => s.serviceId === svc.id);
		if (idx >= 0) {
			// Tăng số lượng
			setSelectedServices(selectedServices.map(s => s.serviceId === svc.id ? { ...s, quantity: s.quantity + 1 } : s));
		} else {
			// Thêm mới dịch vụ
			const promoValid = svc.giaKhuyenMai != null && svc.giaKhuyenMai > 0 && svc.giaKhuyenMai < svc.TienDichVu;
			const appliedPrice = promoValid ? svc.giaKhuyenMai! : svc.TienDichVu;
			const next = [...selectedServices, { serviceId: svc.id, serviceName: svc.TenDichVu, price: appliedPrice, quantity: 1 }];
			setSelectedServices(next);

			// Logic gợi ý combo
			if (combos && combos.length > 0) {
				const selIds = next.map(n => n.serviceId);
				
				// Tìm combo chứa dịch vụ vừa chọn
				const matchedCombo = combos.find(c => (c.services || []).includes(svc.id));
				
				// Kiểm tra partial combo (2+ dịch vụ cùng combo)
				let partialCombo = null;
				for (const c of combos) {
					const overlap = (c.services || []).filter((id: string) => selIds.includes(id));
					if (overlap.length >= 2 && overlap.length < (c.services || []).length) {
						partialCombo = { combo: c, overlap };
						break;
					}
				}

				if (partialCombo) {
					// Hiển thị modal nâng cấp (ưu tiên cao)
					setUpgradePrompt(partialCombo);
					setShowUpgradeModal(true);
					setActiveTooltip(null);
				} else if (matchedCombo && selIds.length === 1 && event) {
					// Anchor tooltip to the service element and compute initial position
					setActiveTooltip({ serviceId: svc.id, combo: matchedCombo });
				} else {
					// keep existing tooltip unless explicitly cleared by user (Bỏ qua) or other actions
					// do nothing here to preserve tooltip
				}
			}
		}
	};

	const removeService = (serviceId: string) => {
		setSelectedServices(selectedServices.filter(s => s.serviceId !== serviceId));
		if (activeTooltip?.serviceId === serviceId) {
			setActiveTooltip(null);
			setTooltipPosition(null);
		}
		// Nếu xóa combo, unlock các dịch vụ của combo đó
		if (serviceId.startsWith('combo:')) {
			const comboId = serviceId.split(':')[1];
			const combo = combos.find(c => c.comboId === comboId);
			if (combo) {
				const servicesToUnlock = combo.services || [];
				setLockedServiceIds(prev => prev.filter(id => !servicesToUnlock.includes(id)));
			} else {
				// Fallback: clear all if combo not found (should not happen)
				setLockedServiceIds([]);
			}
		}
	};

	const setQuantity = (serviceId: string, qty: number) => {
		if (qty <= 0) return removeService(serviceId);
		setSelectedServices(selectedServices.map(s => s.serviceId === serviceId ? { ...s, quantity: qty } : s));
	};

	const applyCombo = (combo: any) => {
		const comboServiceIds = combo.services || [];
		// Giữ lại các dịch vụ KHÔNG thuộc combo này
		const others = selectedServices.filter(s => !comboServiceIds.includes(s.serviceId));
		
		// Thêm combo vào danh sách
		setSelectedServices([...others, {
			serviceId: `combo:${combo.comboId}`,
			serviceName: combo.name,
			price: combo.comboPrice,
			quantity: 1
		}]);
		
		// Lock các dịch vụ thuộc combo
		setLockedServiceIds(prev => Array.from(new Set([...prev, ...comboServiceIds])));
		
		setActiveTooltip(null);
		setTooltipPosition(null);
		setUpgradePrompt(null);
		setShowUpgradeModal(false);
	};

	const viewComboDetail = (combo: any) => {
		// Open detail but keep tooltip visible (user requested tooltip persist unless they click 'Bỏ qua')
		setComboDetail(combo);
		setShowComboDetail(true);
	};

	// Update tooltip position to stay parallel to the anchored service element
	const updateTooltipPosition = (serviceId?: string) => {
		const id = serviceId || activeTooltip?.serviceId;
		if (!id) return;
		const el = itemRefs.current[id];
		if (!el) return;
		const rect = el.getBoundingClientRect();
		const tooltipWidth = 320;
		const spaceLeft = rect.left;
		const left = spaceLeft > (tooltipWidth + 20) ? (rect.left + window.scrollX) - tooltipWidth - 10 : (rect.right + window.scrollX) + 10;
		const top = rect.top + window.scrollY;
		setTooltipPosition({ top, left });
	};

	// Recompute tooltip position on scroll/resize while tooltip is visible
	useEffect(() => {
		if (!activeTooltip) return;
		// initial position
		updateTooltipPosition(activeTooltip.serviceId);
		const onScroll = () => updateTooltipPosition();
		window.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('resize', onScroll);
		return () => {
			window.removeEventListener('scroll', onScroll);
			window.removeEventListener('resize', onScroll);
		};
	}, [activeTooltip]);

		const openDetail = async (svc: Service) => {
			// fetch service detail from API and show modal
			setDetail(null);
			setDetailLoading(true);
			setShowDetail(true);
			try {
				const d = await getServiceById(svc.id);
				setDetail(d || null);
			} catch (err) {
				console.warn(err);
				setDetail(null);
			} finally {
				setDetailLoading(false);
			}
		};

	const totalPrice = selectedServices.reduce((s, it) => s + it.price * it.quantity, 0);

	const available = services.filter(s => isAvailable(s.TrangThai));

	return (
		<div style={{ position: 'relative' }}>
			{/* Mini Tooltip - Gợi ý combo bên phải dịch vụ */}
			{activeTooltip && tooltipPosition && (
				<div style={{
					position: 'fixed',
					top: tooltipPosition.top,
					left: tooltipPosition.left,
					zIndex: 9999,
					background: '#fff',
					border: '2px solid #ffc107',
					borderRadius: 8,
					padding: '12px 16px',
					boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
					minWidth: 280,
					maxWidth: 320
				}}>
					<div style={{ marginBottom: 8 }}>
						<div style={{ fontSize: '0.85em', color: '#856404', fontWeight: 600 }}>💡 Gợi ý tiết kiệm</div>
						<div style={{ fontSize: '0.9em', fontWeight: 'bold', marginTop: 4 }}>{activeTooltip.combo.name}</div>
						{activeTooltip.combo.originalPrice && activeTooltip.combo.comboPrice && (
							<div style={{ fontSize: '0.85em', color: '#d9534f', marginTop: 2 }}>
								Tiết kiệm: {currencyFormatter.format(activeTooltip.combo.originalPrice - activeTooltip.combo.comboPrice)}
							</div>
						)}
					</div>
					<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
						<button className="btn btn-sm btn-light" onClick={() => setActiveTooltip(null)}>Bỏ qua</button>
						<button className="btn btn-sm btn-info" onClick={() => viewComboDetail(activeTooltip.combo)}>Xem chi tiết</button>
						<button className="btn btn-sm btn-primary" onClick={() => applyCombo(activeTooltip.combo)}>Chọn Combo</button>
					</div>
				</div>
			)}

			{/* Modal Nâng cấp - Hiển thị khi chọn 2+ dịch vụ của cùng combo */}
			{showUpgradeModal && upgradePrompt && (
				<div style={{
					position: 'fixed',
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					background: 'rgba(0,0,0,0.5)',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					zIndex: 10000
				}} onClick={() => setShowUpgradeModal(false)}>
					<div onClick={e => e.stopPropagation()} style={{
						background: '#fff',
						borderRadius: 12,
						padding: 24,
						maxWidth: 500,
						width: '90%'
					}}>
						<h3 style={{ marginBottom: 16 }}>🔥 Gợi ý nâng cấp lên Combo hoàn chỉnh</h3>
						<p style={{ marginBottom: 12 }}>
							<strong>Bạn đang chọn:</strong> {upgradePrompt.overlap.map(id => services.find(s => s.id === id)?.TenDichVu).filter(Boolean).join(', ')}
						</p>
						<p style={{ marginBottom: 12 }}>
							Các dịch vụ này nằm trong <strong>{upgradePrompt.combo.name}</strong>.
						</p>
						<p style={{ marginBottom: 20, color: '#d9534f', fontWeight: 'bold' }}>
							Chi phí thêm: {currencyFormatter.format(Math.max(0, upgradePrompt.combo.comboPrice - upgradePrompt.overlap.reduce((sum: number, id: string) => sum + (services.find(s => s.id === id)?.TienDichVu || 0), 0)))}
						</p>
						<div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
							<button className="btn btn-light" onClick={() => setShowUpgradeModal(false)}>Giữ nguyên</button>
							<button className="btn btn-primary" onClick={() => applyCombo(upgradePrompt.combo)}>Chuyển sang Combo</button>
						</div>
					</div>
				</div>
			)}

				{/* Use DetailComboCard component for combo details */}
				{showComboDetail && (
					<DetailComboCard visible={showComboDetail} combo={comboDetail} onClose={() => setShowComboDetail(false)} />
				)}

			<div className="services-toggle">
				<button className="services-toggle-btn" onClick={() => setOpen(!open)}>
					<span className="toggle-icon">{open ? '−' : '+'}</span>
					<span className="toggle-text">Thêm dịch vụ{selectedServices.length > 0 && <span className="services-badge">{selectedServices.length}</span>}</span>
				</button>
			</div>

			{open && (
				<div className="services-dropdown">
					{loading ? (
						<div className="services-loading">Đang tải dịch vụ...</div>
					) : error ? (
						<div className="services-error">{error}</div>
					) : available.length === 0 ? (
						<div className="services-empty">Không có dịch vụ nào</div>
					) : (
						<div className="services-list">
							{available.map(svc => {
								const sel = selectedServices.some(x => x.serviceId === svc.id);
								const isLocked = lockedServiceIds.includes(svc.id);
								return (
									<div ref={el => { itemRefs.current[svc.id] = el; }} key={svc.id} className={`service-item ${sel ? 'selected' : ''} ${isLocked ? 'locked' : ''}`}>
										<div className="service-item-image" style={{ position: 'relative' }}>
											<img src={svc.HinhDichVu || placeholderImg} alt={svc.TenDichVu} style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
											{(svc.phanTramGiam != null || (svc.giaKhuyenMai != null && svc.TienDichVu)) && (
												<div style={{
													position: 'absolute',
													top: 0,
													background: 'rgba(217,83,79,0.95)',
													color: '#fff',
													padding: '3px 6px',
													borderRadius: 4,
													fontSize: '0.7rem',
													fontWeight: 700,
													zIndex: 5,
													boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
													lineHeight: 1,
													letterSpacing: '0.2px'
												}}>
													{svc.phanTramGiam != null ? `Giảm ${svc.phanTramGiam}%` : `Giảm ${Math.round((1 - (svc.giaKhuyenMai!/svc.TienDichVu)) * 100)}%`}
												</div>
											)}
										</div>
										<div className="service-item-content">
											<h5 className="service-item-name">{svc.TenDichVu}</h5>
											<div className="service-item-price">
												{(svc.giaKhuyenMai != null && svc.giaKhuyenMai > 0 && svc.giaKhuyenMai < svc.TienDichVu) ? (
													<div style={{ display: 'flex', flexDirection: 'column' }}>
														<span style={{ textDecoration: 'line-through', color: '#999', fontSize: '0.9em' }}>
															{currencyFormatter.format(svc.TienDichVu)}
														</span>
														<div style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
															<span style={{ color: '#d9534f', fontWeight: 'bold', fontSize: 'clamp(0.85rem, 1.6vw, 1.05em)', paddingLeft: '65px' }}>
																{currencyFormatter.format(svc.giaKhuyenMai)}
															</span>
														</div>
													</div>
												) : (
													<span>{currencyFormatter.format(svc.TienDichVu)}</span>
												)}
											</div>
										</div>
										<div className="service-item-actions">
											<button className="btn-view-detail" onClick={() => openDetail(svc)}>Xem chi tiết</button>
											{isLocked ? (
												<button className="btn-select included" disabled>Đã bao gồm trong combo</button>
											) : (
												<button 
													className={`btn-select ${sel ? 'selected' : ''}`} 
													onClick={(e) => toggleSelect(svc, e)}
												>
													{sel ? '✓ Đã chọn' : 'Chọn'}
												</button>
											)}
										</div>
									</div>
								);
							})}
						</div>
					)}
				</div>
			)}

			{selectedServices.length > 0 && (
				<div className="services-summary">
					<div className="services-summary-title">Dịch vụ đã chọn</div>
					<div className="services-summary-list">
						{selectedServices.map(s => (
							<div className="summary-item" key={s.serviceId}>
								<div className="summary-item-name">{s.serviceName}</div>
								<div className="summary-item-details">
									<div className="summary-item-qty">
										<button onClick={() => setQuantity(s.serviceId, s.quantity - 1)}>-</button>
										<span>{s.quantity}</span>
										<button onClick={() => setQuantity(s.serviceId, s.quantity + 1)}>+</button>
									</div>
									<div className="summary-item-price">{currencyFormatter.format(s.price * s.quantity)}</div>
									<button className="btn-remove" onClick={() => removeService(s.serviceId)}>×</button>
								</div>
							</div>
						))}
					</div>
					<div className="services-total">
						<strong>Tổng dịch vụ:</strong>
						<strong className="total-amount">{currencyFormatter.format(totalPrice)}</strong>
					</div>
				</div>
			)}

					{showDetail && (
						<div className="service-detail-modal" onClick={() => setShowDetail(false)}>
							<div className="service-detail-content" onClick={e => e.stopPropagation()}>
								<div className="modal-body">
									  <div style={{ position: 'relative' }}>
										  <img src={services.find(s => s.id === detail?.iddichVu)?.HinhDichVu || placeholderImg} alt={services.find(s => s.id === detail?.iddichVu)?.TenDichVu || ''} className="modal-image" style={{ display: 'block', width: '100%', height: 'auto', objectFit: 'cover' }} />
										  {(() => {
											  const s = services.find(s => s.id === detail?.iddichVu);
											  if (!s) return null;
											  const pct = s.phanTramGiam != null ? s.phanTramGiam : (s.giaKhuyenMai ? Math.round((1 - (s.giaKhuyenMai!/s.TienDichVu)) * 100) : null);
											  return pct != null ? (
												  <div style={{
													  position: 'absolute',
													  top: 8,
													  left: 8,
													  background: 'rgba(217,83,79,0.95)',
													  color: '#fff',
													  padding: '3px 6px',
													  borderRadius: 4,
													  fontSize: '0.75rem',
													  fontWeight: 800,
													  zIndex: 6,
													  boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
													  lineHeight: 1,
													  letterSpacing: '0.2px'
												  }}>{`Giảm ${pct}%`}</div>
											  ) : null;
										  })()}
									  </div>
									<div className="modal-info">
										{/* Header: name + duration */}
										<h3 className="modal-title">{detail ? services.find(s => s.id === detail?.iddichVu)?.TenDichVu : ''}{detail && detail.thoiLuongUocTinh ? ` – ${formatDuration(detail.thoiLuongUocTinh)}` : ''}</h3>

										{/* Price and status */}
										<div className="info-row">
											<strong>Giá:</strong>
											<span>
												{(() => {
													const s = services.find(x => x.id === detail?.iddichVu);
													if (!s) return currencyFormatter.format(0);
													if (s.giaKhuyenMai != null && s.giaKhuyenMai > 0 && s.giaKhuyenMai < s.TienDichVu) {
														return (
															<div style={{ display: 'flex', flexDirection: 'column' }}>
																<span style={{ textDecoration: 'line-through', color: '#999', marginBottom: 6 }}>
																	{currencyFormatter.format(s.TienDichVu)}
																</span>
																<div style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
																	<span style={{ color: '#d9534f', fontWeight: 'bold', fontSize: 'clamp(0.85rem, 1.6vw, 1.05em)' }}>
																		{currencyFormatter.format(s.giaKhuyenMai)}
																	</span>
																	{(s.phanTramGiam != null) ? <div style={{ fontSize: '0.85em', color: '#d9534f' }}>{`(${s.phanTramGiam}% giảm)`}</div> : null}
																	<span style={{ marginLeft: 6, color: '#666', fontSize: '0.9em' }}>/lần</span>
																</div>
															</div>
														);
													}
													return currencyFormatter.format(s.TienDichVu);
												})()}
											</span>
										</div>
										<div className="info-row"><strong>Trạng thái:</strong><span className="status-badge">{detail ? (isAvailable(services.find(s => s.id === detail?.iddichVu)?.TrangThai) ? 'Khả dụng' : 'Không khả dụng') : '—'}</span></div>

										{/* Estimated duration */}
										{detail && detail.thoiLuongUocTinh != null && (
											<div className="info-row"><strong>Thời lượng ước tính:</strong><span>{formatDuration(detail.thoiLuongUocTinh)}</span></div>
										)}

										{/* Time window from service record */}
										{(() => {
											const svc = detail ? services.find(s => s.id === detail?.iddichVu) : undefined;
											if (svc && svc.thoiGianBatDau && svc.thoiGianKetThuc) {
												return <div className="info-row"><strong>Khung giờ áp dụng:</strong><span>{`${svc.thoiGianBatDau} — ${svc.thoiGianKetThuc}`}</span></div>;
											}
											return null;
										})()}

										{/* Description */}
										<div className="info-section">
											<strong>Mô tả:</strong>
											<div className="description">{detail && detail.thongTinDv ? detail.thongTinDv : '—'}</div>
										</div>

										{/* Note */}
										<div className="info-section">
											<strong>Ghi chú:</strong>
											<div className="note">{detail && detail.ghiChu ? detail.ghiChu : '—'}</div>
										</div>
										{detailLoading && <div className="detail-loading">Đang tải thông tin chi tiết...</div>}
									</div>
								</div>
								<div className="modal-actions">
									<button className="btn-primary" onClick={() => {
										// add to selection using base service record
										const svc = detail ? services.find(s => s.id === detail?.iddichVu) : undefined;
										if (svc) toggleSelect(svc);
										setShowDetail(false);
									}}>Thêm vào</button>
									<button className="btn-secondary" onClick={() => setShowDetail(false)}>Đóng</button>
								</div>
							</div>
						</div>
					)}
		</div>
	);
};

export default ServicesSelector;
