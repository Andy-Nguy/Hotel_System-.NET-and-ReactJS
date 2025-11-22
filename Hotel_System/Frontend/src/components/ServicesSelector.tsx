import React, { useEffect, useState } from "react";
import { getServices, getServiceById, Service as ApiService } from "../api/serviceApi";

type Service = {
	id: string;
	HinhDichVu?: string;
	TenDichVu: string;
	TienDichVu: number;
	TrangThai?: string;
	thoiGianBatDau?: string | null;
	thoiGianKetThuc?: string | null;
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
	const [open, setOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
		const [detail, setDetail] = useState<ApiService | null>(null);
		const [showDetail, setShowDetail] = useState(false);
		const [detailLoading, setDetailLoading] = useState(false);

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
				}));
				setServices(mapped);
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

	useEffect(() => {
		const total = selectedServices.reduce((s, it) => s + it.price * it.quantity, 0);
		onServicesChange?.(selectedServices, total);
	}, [selectedServices, onServicesChange]);

	const isAvailable = (status?: string) => {
		if (!status) return true;
		const s = status.toLowerCase();
		if (s.includes("ngưng") || s.includes("inactive") || s.includes("không")) return false;
		return true;
	};

	const toggleSelect = (svc: Service) => {
		const idx = selectedServices.findIndex(s => s.serviceId === svc.id);
		if (idx >= 0) {
			setSelectedServices(selectedServices.map(s => s.serviceId === svc.id ? { ...s, quantity: s.quantity + 1 } : s));
		} else {
			setSelectedServices([...selectedServices, { serviceId: svc.id, serviceName: svc.TenDichVu, price: svc.TienDichVu, quantity: 1 }]);
		}
	};

	const removeService = (serviceId: string) => setSelectedServices(selectedServices.filter(s => s.serviceId !== serviceId));
	const setQuantity = (serviceId: string, qty: number) => {
		if (qty <= 0) return removeService(serviceId);
		setSelectedServices(selectedServices.map(s => s.serviceId === serviceId ? { ...s, quantity: qty } : s));
	};

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
		<div>
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
								return (
									<div key={svc.id} className={`service-item ${sel ? 'selected' : ''}`}>
										<div className="service-item-image"><img src={svc.HinhDichVu || placeholderImg} alt={svc.TenDichVu} /></div>
										<div className="service-item-content">
											<h5 className="service-item-name">{svc.TenDichVu}</h5>
											<div className="service-item-price">{currencyFormatter.format(svc.TienDichVu)}/lần</div>
										</div>
										<div className="service-item-actions">
											<button className="btn-view-detail" onClick={() => openDetail(svc)}>Xem chi tiết</button>
											<button className={`btn-select ${sel ? 'selected' : ''}`} onClick={() => toggleSelect(svc)}>{sel ? '✓ Đã chọn' : 'Chọn'}</button>
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
									  <img src={services.find(s => s.id === detail?.iddichVu)?.HinhDichVu || placeholderImg} alt={services.find(s => s.id === detail?.iddichVu)?.TenDichVu || ''} className="modal-image" />
									<div className="modal-info">
										{/* Header: name + duration */}
										<h3 className="modal-title">{detail ? services.find(s => s.id === detail?.iddichVu)?.TenDichVu : ''}{detail && detail.thoiLuongUocTinh ? ` – ${formatDuration(detail.thoiLuongUocTinh)}` : ''}</h3>

										{/* Price and status */}
										<div className="info-row"><strong>Giá:</strong><span>{currencyFormatter.format((services.find(s => s.id === detail?.iddichVu)?.TienDichVu) ?? 0)}</span></div>
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
