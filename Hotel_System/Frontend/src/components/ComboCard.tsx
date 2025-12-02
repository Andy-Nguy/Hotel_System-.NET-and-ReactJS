import React from 'react';

type ComboService = {
  iddichVu: string;
  tenDichVu: string;
  tienDichVu?: number | null;
};

type Combo = {
  comboId: string;
  name: string;
  description?: string | null;
  banner?: string | null;
  services: ComboService[];
  originalPrice?: number | null; // sum of service prices
  comboPrice?: number; // Make optional - can be calculated from loaiGiamGia and giaTriGiam
  loaiGiamGia?: string | null; // 'percent' or 'amount'
  giaTriGiam?: number | null;
  ngayBatDau?: string | null;
  ngayKetThuc?: string | null;
  conditions?: string | null;
  isActive?: boolean;
};

const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });

interface Props {
  combo: Combo;
  onView?: (combo: Combo) => void;
}

const ComboCard: React.FC<Props> = ({ combo, onView }) => {
  const originalPrice = combo.originalPrice ?? combo.services.reduce((s, it) => s + (it.tienDichVu ?? 0), 0);
  
  // Calculate final combo price based on discount type
  let finalPrice = 0;
  let saving = 0;
  let savingPercent = 0;
  
  if (combo.comboPrice !== undefined) {
    // If comboPrice is provided, use it
    saving = combo.comboPrice;
    finalPrice = originalPrice - saving;
    savingPercent = originalPrice > 0 ? Math.round((saving / originalPrice) * 100) : 0;
  } else if (combo.loaiGiamGia && combo.giaTriGiam !== undefined && combo.giaTriGiam !== null) {
    // Calculate from discount type and value
    const discountValue = Number(combo.giaTriGiam);
    const discountPercent = combo.loaiGiamGia.toLowerCase() === 'percent' ? discountValue : 0;
    const discountAmount = combo.loaiGiamGia.toLowerCase() === 'amount' ? discountValue : 0;
    
    // Match PromotionSection.tsx logic
    if (discountPercent > 0) {
      finalPrice = Math.round(originalPrice * (1 - discountPercent / 100));
      saving = originalPrice - finalPrice;
      savingPercent = discountPercent;
    } else if (discountAmount > 0) {
      finalPrice = Math.max(0, Math.round(originalPrice - discountAmount));
      saving = Math.min(discountAmount, originalPrice);
      savingPercent = originalPrice > 0 ? Math.round((saving / originalPrice) * 100) : 0;
    } else {
      // No valid discount
      finalPrice = originalPrice;
      saving = 0;
      savingPercent = 0;
    }
  } else {
    // No discount info available
    finalPrice = originalPrice;
    saving = 0;
    savingPercent = 0;
  }

  if (combo.isActive === false) return null;

  return (
    <div style={{ display: 'flex', gap: 12, background: '#fff7e6', borderRadius: 10, padding: 12, alignItems: 'stretch', boxShadow: '0 6px 18px rgba(0,0,0,0.06)' }}>
      <div style={{ width: 160, minWidth: 120 }}>
        <img src={combo.banner || '/img/combo-placeholder.jpg'} alt={combo.name} style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 8 }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ background: '#d9534f', color: '#fff', padding: '4px 8px', borderRadius: 6, fontWeight: 700, display: 'inline-block', marginBottom: 6 }}>Combo tiết kiệm</div>
            <h4 style={{ margin: 0 }}>{combo.name}</h4>
            {combo.description ? <div style={{ color: '#666', fontSize: 13, marginTop: 6 }}>{combo.description}</div> : null}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#999', textDecoration: 'line-through' }}>{currency.format(originalPrice)}</div>
            <div style={{ color: '#d9534f', fontWeight: 800, fontSize: '1.15rem' }}>{currency.format(finalPrice)}</div>
            <div style={{ color: '#3c763d', fontWeight: 700 }}>Tiết kiệm {savingPercent}% • {currency.format(saving)}</div>
          </div>
        </div>

        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {combo.services.slice(0,3).map((s, idx) => (
            <div key={(s as any).iddichVu ?? (s as any).id ?? idx} style={{ background: '#fff', padding: '6px 8px', borderRadius: 6, boxShadow: '0 2px 6px rgba(0,0,0,0.06)', fontSize: 13 }}>
              {(s as any).tenDichVu ?? (s as any).TenDichVu ?? 'Dịch vụ'} • {currency.format((s as any).tienDichVu ?? (s as any).TienDichVu ?? 0)}
            </div>
          ))}
        </div>

        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button onClick={() => onView?.(combo)} className="btn btn-primary">Xem chi tiết</button>
        </div>

      </div>
    </div>
  );
};

export default ComboCard;
