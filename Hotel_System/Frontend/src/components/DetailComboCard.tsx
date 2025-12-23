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

  // LOGIC TÍNH GIÁ - UNIFIED (THEO YÊU CẦU NGHIỆP VỤ MỚI)
  // 1. Original Price: Ưu tiên có sẵn -> Fallback tính tổng dịch vụ
  const originalPrice: number = typeof combo.originalPrice === 'number'
    ? combo.originalPrice
    : services.reduce((s, it) => s + (Number(it.tienDichVu ?? it.TienDichVu ?? 0) || 0), 0);

  // 2. Final Price: Ưu tiên finalPrice -> Tính toán từ comboPrice/giaTriGiam
  let giaCombo = 0;
  const loai = (combo.loaiGiamGia || combo.LoaiGiamGia || '').toString().toLowerCase();
  const giaTri = Number(combo.giaTriGiam ?? combo.GiaTriGiam ?? 0);

  if (combo.finalPrice !== undefined && combo.finalPrice !== null) {
    giaCombo = Number(combo.finalPrice);
  } else if (combo.comboPrice !== undefined && combo.comboPrice !== null) {
    const val = Number(combo.comboPrice);
    // Fix: Chỉ tính là % nếu giá trị hợp lý (<= 100). 
    // Nếu val lớn (vd: 2.380.000), coi như là giá cuối cùng (Final Price) bất kể loaiGiamGia là gì.
    // Điều này xử lý trường hợp ServicesSelector truyền comboPrice là giá cuối nhưng loai vẫn là 'percent'.
    if (loai === 'percent' && val <= 100) {
      giaCombo = Math.round(originalPrice * (1 - val / 100));
    } else if (loai === 'amount' && val < originalPrice / 2) {
       // Nếu là amount và giá trị nhỏ (< 50% giá gốc), có thể là số tiền giảm
       giaCombo = Math.max(0, Math.round(originalPrice - val));
    } else {
      // Trường hợp còn lại: coi comboPrice là giá cuối
      giaCombo = val;
    }
  } else {
    // Fallback calculation using giaTriGiam
    if (loai === 'percent') {
      giaCombo = Math.round(originalPrice * (1 - giaTri / 100));
    } else if (loai === 'amount') {
      giaCombo = Math.max(0, Math.round(originalPrice - giaTri));
    } else {
      giaCombo = originalPrice;
    }
  }

  // 3. Savings & Display
  const tietKiem = Math.max(0, originalPrice - giaCombo);
  const savingPercent = originalPrice > 0 ? Math.round((tietKiem / originalPrice) * 100) : 0;
  
  // Hiển thị giá trị giảm (nếu có) - infer nếu nguồn không nhất quán
  const rawComboPrice = combo.comboPrice ?? combo.ComboPrice ?? null;
  const comboPriceNum = rawComboPrice != null ? Number(rawComboPrice) : null;

  let displayDiscountValue: number | null = null;
  let displayLoai = loai || '';

  // 1) explicit server-provided discount value
  if (combo.discountValue !== undefined && combo.discountValue !== null) {
    displayDiscountValue = Number(combo.discountValue);
  }

  // 2) if not provided, try known fields
  if (displayDiscountValue == null) {
    if (displayLoai === 'percent' && giaTri > 0) {
      displayDiscountValue = giaTri;
    } else if (displayLoai === 'amount' && giaTri > 0) {
      displayDiscountValue = giaTri;
    } else if (comboPriceNum != null) {
      // If comboPrice looks like a percent (<=100) treat as percent
      if (comboPriceNum > 0 && comboPriceNum <= 100) {
        displayLoai = 'percent';
        displayDiscountValue = comboPriceNum;
      } else {
        // Otherwise treat comboPrice as final price -> compute percent saved
        displayLoai = 'percent';
        displayDiscountValue = originalPrice > 0 ? Math.round(((originalPrice - comboPriceNum) / originalPrice) * 100) : 0;
      }
    } else {
      // fallback to giaTri or zero
      displayDiscountValue = giaTri || 0;
    }
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
      zIndex={9999}
      maskClosable={true}
      maskStyle={{ backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9999 }}
      style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.35)', borderRadius: 16, overflow: 'hidden' }}
      bodyStyle={{ padding: 0 }}
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
            src={combo.hinhAnhBanner || combo.banner || combo.image || combo.Image || (services.length > 0 ? (services[0].HinhDichVu || services[0].hinhDichVu || services[0].image || services[0].Image) : null) || placeholderCombo}
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
              <div style={{ fontWeight: FONT_WEIGHT_BOLD, color: TEXT_COLOR, textTransform: 'capitalize' }}>
                {loai === 'percent' ? 'Percent' : loai === 'amount' ? 'Amount' : (combo.loaiGiamGia || combo.LoaiGiamGia || 'N/A')}
              </div>
            </div>
            <div>
              <div style={{ color: LIGHT_TEXT_COLOR, fontSize: 13 }}>Giá trị áp dụng</div>
              <div style={{ fontWeight: FONT_WEIGHT_BOLD, color: TEXT_COLOR }}>
                {loai === 'percent' ? `${displayDiscountValue}%` : currency.format(displayDiscountValue)}
              </div>
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