import React from 'react';
import { Modal, Image, Tag, Divider } from 'antd';
import dayjs from 'dayjs';

const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });

type Props = {
  visible: boolean;
  combo: any | null;
  onClose: () => void;
};

const placeholderCombo = '/img/combo-placeholder.jpg';
const placeholderService = '/img/service-placeholder.png';

const DetailComboCard: React.FC<Props> = ({ visible, combo, onClose }) => {
  if (!combo) return null;

  const services: any[] = combo.serviceDetails || combo.services || [];

  // LOGIC TÍNH GIÁ - ĐIỀU CHỈNH ĐỂ GIỐNG PROMOTIONSECTION.TSX
  const originalPrice: number = typeof combo.originalPrice === 'number'
    ? combo.originalPrice
    : services.reduce((s, it) => s + (Number(it.tienDichVu ?? it.TienDichVu ?? 0) || 0), 0);

  const loai = (combo.loaiGiamGia || combo.LoaiGiamGia || '').toString().toLowerCase();
  const giaTri = Number(combo.giaTriGiam ?? combo.GiaTriGiam ?? 0);
  
  // Match PromotionSection.tsx logic
  let giaCombo = 0;
  let tietKiem = 0;
  let savingPercent = 0;

  if (combo.comboPrice !== undefined) {
    // Interpret combo.comboPrice by loaiGiamGia when possible.
    // If loaiGiamGia === 'percent' then combo.comboPrice is percent; if 'amount' it's VND.
    const val = Number(combo.comboPrice);
    const kind = (combo.loaiGiamGia || combo.LoaiGiamGia || '').toString().toLowerCase();
    if (kind === 'percent') {
      const pct = val;
      giaCombo = Math.round(originalPrice * (1 - pct / 100));
      tietKiem = originalPrice - giaCombo;
      savingPercent = pct;
    } else if (kind === 'amount') {
      const amt = val;
      giaCombo = Math.max(0, Math.round(originalPrice - amt));
      tietKiem = Math.min(amt, originalPrice);
      savingPercent = originalPrice > 0 ? Math.round((tietKiem / originalPrice) * 100) : 0;
    } else {
      // guess: <=100 -> percent, else -> amount
      if (val > 0 && val <= 100) {
        const pct = val;
        giaCombo = Math.round(originalPrice * (1 - pct / 100));
        tietKiem = originalPrice - giaCombo;
        savingPercent = pct;
      } else {
        tietKiem = val;
        giaCombo = Math.max(0, Math.round(originalPrice - tietKiem));
        savingPercent = originalPrice > 0 ? Math.round((tietKiem / originalPrice) * 100) : 0;
      }
    }
  } else if (combo.loaiGiamGia && combo.giaTriGiam !== undefined && combo.giaTriGiam !== null) {
    // Calculate from discount type and value
    const discountValue = Number(combo.giaTriGiam);
    const discountPercent = loai === 'percent' ? discountValue : 0;
    const discountAmount = loai === 'amount' ? discountValue : 0;
    
    if (discountPercent > 0) {
      giaCombo = Math.round(originalPrice * (1 - discountPercent / 100));
      tietKiem = originalPrice - giaCombo;
      savingPercent = discountPercent;
    } else if (discountAmount > 0) {
      giaCombo = Math.max(0, Math.round(originalPrice - discountAmount));
      tietKiem = Math.min(discountAmount, originalPrice);
      savingPercent = originalPrice > 0 ? Math.round((tietKiem / originalPrice) * 100) : 0;
    } else {
      giaCombo = originalPrice;
      tietKiem = 0;
      savingPercent = 0;
    }
  } else {
    giaCombo = originalPrice;
    tietKiem = 0;
    savingPercent = 0;
  }
  // KẾT THÚC LOGIC TÍNH GIÁ

  // --- THIẾT KẾ SANG TRỌNG ---
  const PRIMARY_COLOR = '#dfa974'; // Màu vàng/nâu chủ đạo, sang trọng
  const TEXT_COLOR = '#333333';
  const LIGHT_TEXT_COLOR = '#777777';
  const FONT_WEIGHT_LIGHT = 400;
  const FONT_WEIGHT_BOLD = 600;

  return (
		<Modal
			open={visible}
			onCancel={onClose}
			footer={null}
			width={900}
			centered
			maskClosable={true}
			styles={{ body: { padding: 0 } }}
		>
      <div style={{ 
        display: 'flex', 
        maxHeight: '90vh', 
        overflow: 'hidden', 
        borderRadius: 12, // Bo tròn góc cho sang trọng
        background: '#ffffff'
      }}>
        
        {/* CỘT TRÁI: HÌNH ẢNH VÀ TÓM TẮT GIÁ */}
        <div style={{ flex: '0 0 320px', background: '#f8f8f8', padding: 24, display: 'flex', flexDirection: 'column' }}>
          <Image
            src={combo.hinhAnhBanner || combo.banner || placeholderCombo}
            alt={combo.name || combo.tenCombo}
            preview={false}
            style={{ width: '100%', height: 200, objectFit: 'cover', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
          />          <div style={{ marginTop: 18, borderBottom: '1px solid #eeeeee', paddingBottom: 12 }}>
            <h2 style={{ margin: 0, color: TEXT_COLOR, fontWeight: 700 }}>{combo.name || combo.tenCombo}</h2>
            <p style={{ color: LIGHT_TEXT_COLOR, fontSize: 13, marginTop: 4 }}>{combo.description || combo.moTa || 'Gói dịch vụ cao cấp.'}</p>
          </div>

          {/* BẢNG TÓM TẮT GIÁ COMBO (Tổ chức lại) */}
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: LIGHT_TEXT_COLOR, fontWeight: FONT_WEIGHT_LIGHT }}>Tổng giá lẻ:</span>
              <span style={{ color: LIGHT_TEXT_COLOR, textDecoration: 'line-through' }}>{currency.format(originalPrice)}</span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: 'green', fontWeight: FONT_WEIGHT_LIGHT }}>Tiết kiệm:</span>
              <span style={{ color: 'green', fontWeight: FONT_WEIGHT_BOLD }}>{currency.format(tietKiem)} ({savingPercent}%)</span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, padding: '10px 0', borderTop: '2px solid #ddd' }}>
              <span style={{ fontWeight: FONT_WEIGHT_BOLD, fontSize: '1.1rem', color: TEXT_COLOR }}>Giá Combo:</span>
              <span style={{ fontWeight: 800, fontSize: '1.4rem', color: PRIMARY_COLOR }}>{currency.format(giaCombo)}</span>
            </div>
          </div>

          {/* PHỤ: TRẠNG THÁI VÀ NGÀY TẠO */}
          <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid #eeeeee' }}>
            <div style={{ marginBottom: 8 }}>
              {combo.isActive === false ? <Tag color="orange">Ngưng hoạt động</Tag> : <Tag color="green">Đang hoạt động</Tag>}
            </div>
            <div style={{ color: '#aaa', fontSize: 11 }}>
              <div>Tạo: {combo.comboMeta?.createdAt ? dayjs(combo.comboMeta.createdAt).format('DD/MM/YYYY') : (combo.createdAt ? dayjs(combo.createdAt).format('DD/MM/YYYY') : '-')}</div>
              <div>Cập nhật: {combo.comboMeta?.updatedAt ? dayjs(combo.comboMeta.updatedAt).format('DD/MM/YYYY') : (combo.updatedAt ? dayjs(combo.updatedAt).format('DD/MM/YYYY') : '-')}</div>
            </div>
          </div>
        </div>

        {/* CỘT PHẢI: CHI TIẾT DỊCH VỤ VÀ NÚT ĐÓNG */}
        <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
          <h3 style={{ margin: '0 0 16px 0', color: TEXT_COLOR, fontWeight: 700 }}>Dịch vụ trong Combo</h3>

          {/* DANH SÁCH DỊCH VỤ */}
          <div style={{ display: 'grid', gap: 15 }}>
            {services.map((s, idx) => (
              <div 
                key={s.iddichVu ?? s.id ?? idx} 
                style={{ 
                  display: 'flex', 
                  gap: 15, 
                  alignItems: 'center', 
                  paddingBottom: 15,
                  borderBottom: (idx < services.length - 1) ? '1px dashed #e0e0e0' : 'none' // Dùng dashed line cho tinh tế
                }}
              >
                <div style={{ width: 80, height: 60, flex: '0 0 80px' }}>
                  <Image 
                    src={s.HinhDichVu || s.hinhDichVu || placeholderService} 
                    alt={s.TenDichVu || s.tenDichVu} 
                    preview={false} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4 }} 
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: FONT_WEIGHT_BOLD, color: TEXT_COLOR }}>{s.TenDichVu ?? s.tenDichVu ?? 'Dịch vụ'}</div>
                  <div style={{ color: LIGHT_TEXT_COLOR, fontSize: 12 }}>
                    {s.ThongTinDV ?? s.thongTinDv ?? 'Liệu trình cao cấp'} • {s.ThoiLuongUocTinh ? `${s.ThoiLuongUocTinh} phút` : '-'}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: FONT_WEIGHT_BOLD, color: PRIMARY_COLOR }}>{currency.format(Number(s.TienDichVu ?? s.tienDichVu ?? 0))}</div>
                  <div style={{ marginTop: 4 }}>
                    {s.IsActive === false ? <Tag color="orange" style={{ fontSize: 11 }}>Ngừng</Tag> : <Tag color="blue" style={{ fontSize: 11 }}>Đã bao gồm</Tag>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Divider style={{ margin: '20px 0 10px 0' }} />

          {/* THÔNG TIN GIẢM GIÁ CHI TIẾT (Làm gọn lại) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px 20px', background: '#f8f8f8', padding: 15, borderRadius: 8 }}>
            <div>
              <div style={{ color: LIGHT_TEXT_COLOR, fontSize: 13 }}>Cơ chế giảm giá</div>
              <div style={{ fontWeight: FONT_WEIGHT_BOLD, color: TEXT_COLOR, textTransform: 'capitalize' }}>{(combo.loaiGiamGia || combo.LoaiGiamGia || '').toString()}</div>
            </div>
            <div>
              <div style={{ color: LIGHT_TEXT_COLOR, fontSize: 13 }}>Giá trị áp dụng</div>
              <div style={{ fontWeight: FONT_WEIGHT_BOLD, color: TEXT_COLOR }}>{currency.format(tietKiem)}</div>
            </div>
          </div>

          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
            <button 
              onClick={onClose}
              style={{ 
                background: PRIMARY_COLOR, 
                color: '#fff', 
                border: 'none', 
                padding: '10px 20px', 
                borderRadius: 4, 
                cursor: 'pointer',
                fontWeight: FONT_WEIGHT_BOLD
              }}
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default DetailComboCard;