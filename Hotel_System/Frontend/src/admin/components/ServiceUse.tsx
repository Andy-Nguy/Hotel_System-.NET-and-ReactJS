import React, { useEffect, useState } from 'react';
import serviceApi, { Service } from '../../api/serviceApi';

interface Props {
	onDone?: () => void;
}

const ServiceUse: React.FC<Props> = ({ onDone }) => {
	const [services, setServices] = useState<Service[]>([]);
	const [selectedService, setSelectedService] = useState<string>('');
	const [hoaDonId, setHoaDonId] = useState('');
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		(async () => {
			try {
				const data = await serviceApi.getServices();
				setServices(data);
			} catch (err) {
				console.error(err);
			}
		})();
	}, []);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!selectedService || !hoaDonId) return alert('Chọn dịch vụ và nhập ID hóa đơn');
		setLoading(true);
		try {
			// find service price
			const svc = services.find(s => s.iddichVu === selectedService);
			await serviceApi.recordServiceUsage({
				idhoaDon: hoaDonId,
				iddichVu: selectedService,
				tienDichVu: svc?.tienDichVu ?? 0,
				thoiGianThucHien: new Date().toISOString(),
			});
			alert('Ghi nhận dịch vụ thành công');
			setHoaDonId('');
			setSelectedService('');
			onDone && onDone();
		} catch (err) {
			console.error(err);
			alert('Lỗi khi ghi nhận dịch vụ');
		} finally {
			setLoading(false);
		}
	}

	return (
		<form onSubmit={handleSubmit} style={{ padding: 12, border: '1px solid #f3f4f6', borderRadius: 8, background: '#fff' }}>
			<h3 style={{ marginTop: 0 }}>Ghi nhận sử dụng dịch vụ</h3>
			<div style={{ marginBottom: 8 }}>
				<label style={{ display: 'block', marginBottom: 6 }}>Chọn dịch vụ</label>
				<select value={selectedService} onChange={e => setSelectedService(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #e5e7eb' }}>
					<option value="">-- Chọn --</option>
					{services.map(s => (
						<option key={s.iddichVu} value={s.iddichVu}>{s.tenDichVu} - {s.tienDichVu ?? 0}</option>
					))}
				</select>
			</div>
			<div style={{ marginBottom: 8 }}>
				<label style={{ display: 'block', marginBottom: 6 }}>ID Hóa đơn (IDHoaDon)</label>
				<input value={hoaDonId} onChange={e => setHoaDonId(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #e5e7eb' }} />
			</div>
			<div>
				<button type="submit" disabled={loading} style={{ padding: '8px 14px', borderRadius: 10, background: 'linear-gradient(135deg,#1e40af,#3b82f6)', color: '#fff', border: 'none', fontWeight: 700 }}>{loading ? 'Đang ghi nhận...' : 'Ghi nhận'}</button>
			</div>
		</form>
	);
};

export default ServiceUse;
