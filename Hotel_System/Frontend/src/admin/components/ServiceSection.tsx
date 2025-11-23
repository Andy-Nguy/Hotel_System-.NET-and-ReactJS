import React from 'react';
import { Service } from '../../api/serviceApi';

interface Props {
	service: Service;
	onEdit?: (s: Service) => void;
	onDelete?: (id: string) => void;
	onDetails?: (s: Service) => void;
	onEditModal?: (s: Service) => void;
}

const ServiceSection: React.FC<Props> = ({ service, onEdit, onDelete, onDetails, onEditModal }) => {
	return (
		<tr
			onClick={() => onDetails && onDetails(service)}
			style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
		>
			<td style={{ padding: 12 }}>
				{service.hinhDichVu ? (
					<img src={service.hinhDichVu} alt={service.tenDichVu} style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 8 }} />
				) : (
					<div style={{ width: 80, height: 60, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, color: '#9ca3af' }}>No image</div>
				)}
			</td>
			<td style={{ padding: 12, verticalAlign: 'middle', fontWeight: 700 }}>{service.tenDichVu}</td>
			<td style={{ padding: 12, verticalAlign: 'middle', color: '#6b7280' }}>{service.tienDichVu != null ? new Intl.NumberFormat('vi-VN').format(service.tienDichVu) : ''}</td>
					<td style={{ padding: 12, verticalAlign: 'middle' }}>
						<button
							onClick={(e) => {
								e.stopPropagation();
								onEditModal ? onEditModal(service) : onEdit && onEdit(service);
							}}
							style={{ marginRight: 8, padding: '6px 10px', borderRadius: 8, background: 'linear-gradient(135deg,#1e40af,#3b82f6)', color: '#fff', border: 'none', fontWeight: 700 }}
						>
							Sửa
						</button>
						<button
							onClick={(e) => {
								e.stopPropagation();
								onDelete && onDelete(service.iddichVu);
							}}
							style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #f3f4f6' }}
						>
							Xóa
						</button>
					</td>
		</tr>
	);
};

export default ServiceSection;
