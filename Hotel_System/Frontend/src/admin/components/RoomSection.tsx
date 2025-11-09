import React, { useEffect, useState } from 'react';
import { Room, getRooms, getRoomTypes, createRoom, updateRoom, deleteRoom, RoomType } from '../../api/roomsApi';

const statusColor = (s?: string | null) => {
  if (!s) return '#6b7280';
  if (s.toLowerCase().includes('trống')) return '#10b981';
  if (s.toLowerCase().includes('bảo trì')) return '#9ca3af';
  if (s.toLowerCase().includes('đang')) return '#f59e0b';
  return '#6b7280';
};

const formatPrice = (v?: number | null) => v ? new Intl.NumberFormat('vi-VN').format(v) : '—';

const statusEmoji = (s?: string | null) => {
  if (!s) return '⚪';
  const low = s.toLowerCase();
  if (low.includes('trống')) return '🟢';
  if (low.includes('đang')) return '🔴';
  if (low.includes('bảo')) return '🟡';
  return '⚪';
};

const RoomSection: React.FC = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [types, setTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);

  // filters
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // detail modal
  const [showDetail, setShowDetail] = useState(false);
  const [detailRoom, setDetailRoom] = useState<Room | null>(null);
  // when opening detail we may want to start in edit mode immediately
  const [detailStartEditing, setDetailStartEditing] = useState(false);
  // status modal
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusTarget, setStatusTarget] = useState<Room | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [r, t] = await Promise.all([getRooms(), getRoomTypes()]);
      setRooms(r);
      setTypes(t);
    } catch (e) {
      console.error(e);
      alert('Không thể tải danh sách phòng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // allow other parts to open the status modal via a CustomEvent (used by detail modal)
  useEffect(() => {
    const handler = (e: any) => {
      try {
        const d = e?.detail;
        if (!d) return;
        const id = d.id;
        const current = d.current;
        // find room by id
        const found = rooms.find(r => String(r.idphong) === String(id));
        if (found) {
          setStatusTarget(found);
          setShowStatusModal(true);
        } else {
          // if not found, still open with minimal info
          setStatusTarget({ idphong: id } as Room);
          setShowStatusModal(true);
        }
      } catch (err) {
        // ignore
      }
    };
    window.addEventListener('openStatusFromDetail', handler as EventListener);
    return () => window.removeEventListener('openStatusFromDetail', handler as EventListener);
  }, [rooms]);

  const filtered = rooms.filter(r => {
    if (typeFilter && String(r.idloaiPhong) !== String(typeFilter)) return false;
    if (statusFilter && (r.trangThai || '').toLowerCase() !== statusFilter.toLowerCase()) return false;
    if (query) {
      const q = query.toLowerCase();
      return (r.tenPhong || '').toLowerCase().includes(q) || (r.soPhong || '').toLowerCase().includes(q) || (r.tenLoaiPhong || '').toLowerCase().includes(q);
    }
    return true;
  });

  const openDetail = (r: Room, edit = false) => { setDetailRoom(r); setDetailStartEditing(edit); setShowDetail(true); };

  const saveDetail = async (updated: Room) => {
    try {
      await updateRoom(updated.idphong, updated);
      await load();
      setShowDetail(false);
    } catch (e) {
      console.error(e);
      alert('Lỗi lưu phòng');
    }
  };

  const quickToggleStatus = async (r: Room) => {
    // legacy quick toggle replaced by status modal — kept for backward compat but not used
    const newStatus = (r.trangThai === 'Bảo trì') ? 'Trống' : 'Bảo trì';
    try {
      await updateRoom(r.idphong, { trangThai: newStatus });
      await load();
    } catch (e) {
      console.error(e);
      alert('Lỗi cập nhật trạng thái');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Xác nhận xóa phòng?')) return;
    try {
      await deleteRoom(id);
      await load();
    } catch (e) {
      console.error(e);
      alert('Lỗi khi xóa phòng');
    }
  };

  if (loading) return <div>Đang tải phòng...</div>;

  const openStatusModal = (r: Room) => { setStatusTarget(r); setShowStatusModal(true); };

  const handleStatusSave = async (rId: string, newStatus: string) => {
    try {
      await updateRoom(rId, { trangThai: newStatus });
      await load();
      setShowStatusModal(false);
      setStatusTarget(null);
    } catch (e) {
      console.error(e);
      alert('Lỗi cập nhật trạng thái');
    }
  };

  

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Danh sách phòng</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input placeholder="Tìm theo tên, số phòng hoặc loại" value={query} onChange={e => setQuery(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', width: 260 }} />
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb' }}>
            <option value="">-- Tất cả loại --</option>
            {types.map(t => <option key={t.idLoaiPhong} value={t.idLoaiPhong}>{t.tenLoaiPhong}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb' }}>
            <option value="">-- Trạng thái --</option>
            <option value="Trống">Trống</option>
            <option value="Đang sử dụng">Đang sử dụng</option>
            <option value="Bảo trì">Bảo trì</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20 }}>
        {filtered.map(r => (
          <div key={r.idphong} style={{ 
            background: '#fff', 
            borderRadius: 16, 
            overflow: 'hidden', 
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            border: '1px solid #e5e7eb',
            position: 'relative',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            margin: 0,
            padding: 0,
            lineHeight: 0
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.16)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
          }}>
            {/* Room Image */}
            <div style={{ 
              position: 'relative', 
              height: 220, 
              width: '100%',
              overflow: 'hidden',
              backgroundColor: '#f3f4f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundImage: 'linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)',
              backgroundSize: '20px 20px',
              backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
            }}>
              <img 
                src={r.urlAnhPhong ?? '/img/room/default.webp'} 
                alt={r.tenPhong ?? ''} 
                style={{ 
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'cover',
                  objectPosition: 'center',
                  transition: 'transform 0.3s ease',
                  display: 'block',
                  margin: 0,
                  padding: 0,
                  border: 'none',
                  outline: 'none',
                  backgroundColor: '#f3f4f6'
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                onError={e => {
                  // If image fails to load, show placeholder
                  e.currentTarget.style.display = 'none';
                  const container = e.currentTarget.parentElement;
                  if (container && !container.querySelector('.placeholder')) {
                    const placeholder = document.createElement('div');
                    placeholder.className = 'placeholder';
                    placeholder.style.cssText = `
                      position: absolute;
                      top: 50%;
                      left: 50%;
                      transform: translate(-50%, -50%);
                      text-align: center;
                      color: #9ca3af;
                      font-size: 48px;
                    `;
                    placeholder.innerHTML = '🏨';
                    container.appendChild(placeholder);
                  }
                }}
              />
              {/* Price Tag */}
              <div style={{ 
                position: 'absolute', 
                top: 12, 
                left: 12, 
                background: 'linear-gradient(135deg, #1e40af, #3b82f6)', 
                color: 'white', 
                padding: '6px 14px', 
                borderRadius: 20, 
                fontSize: 14, 
                fontWeight: 700,
                boxShadow: '0 4px 12px rgba(30, 64, 175, 0.3)'
              }}>
                {formatPrice(r.giaCoBanMotDem)} ₫
              </div>
              {/* Status Badge */}
              <div style={{ 
                position: 'absolute', 
                top: 12, 
                right: 12, 
                background: 'rgba(255,255,255,0.95)', 
                padding: '6px 12px', 
                borderRadius: 20, 
                fontSize: 12, 
                fontWeight: 600,
                color: statusColor(r.trangThai),
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                backdropFilter: 'blur(8px)'
              }}>
                {statusEmoji(r.trangThai)} {r.trangThai ?? 'Chưa rõ'}
              </div>
            </div>

            {/* Room Info */}
            <div style={{ 
              padding: 20, 
              margin: 0, 
              lineHeight: 'normal' 
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1f2937', lineHeight: 1.3 }}>{r.tenPhong}</h4>
                  <p style={{ margin: '6px 0 0', color: '#6b7280', fontSize: 15, fontWeight: 500 }}>{r.tenLoaiPhong}</p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16, fontSize: 14, color: '#6b7280' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>👥 {r.soNguoiToiDa ?? '—'} người</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>🏷️ {r.idphong ?? r.soPhong ?? '—'}</span>
                {r.xepHangSao && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>⭐ {r.xepHangSao} sao</span>}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button 
                  onClick={() => openDetail(r)}
                  style={{ 
                    flex: 1,
                    padding: '12px 16px', 
                    borderRadius: 10, 
                    border: '1px solid #d1d5db',
                    background: '#f9fafb',
                    color: '#374151',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#f3f4f6';
                    e.currentTarget.style.borderColor = '#9ca3af';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = '#f9fafb';
                    e.currentTarget.style.borderColor = '#d1d5db';
                  }}
                >
                  👁️ Xem chi tiết
                </button>
                <button 
                  onClick={() => openDetail(r, true)}
                  style={{ 
                    flex: 1,
                    padding: '12px 16px', 
                    borderRadius: 10, 
                    border: 'none',
                    background: 'linear-gradient(135deg, #1e40af, #3b82f6)',
                    color: 'white',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 12px rgba(30, 64, 175, 0.3)'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(30, 64, 175, 0.4)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(30, 64, 175, 0.3)';
                  }}
                >
                  ✏️ Chỉnh sửa
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showDetail && detailRoom && (
        <RoomDetailModal room={detailRoom} types={types} initialEdit={detailStartEditing} onClose={() => { setShowDetail(false); setDetailStartEditing(false); }} onSave={saveDetail} />
      )}
      {showStatusModal && statusTarget && (
        <StatusModal current={statusTarget.trangThai ?? ''} roomId={statusTarget.idphong} onClose={() => { setShowStatusModal(false); setStatusTarget(null); }} onSave={handleStatusSave} />
      )}
    </div>
  );
};

const RoomDetailModal: React.FC<{ room: Room; types: RoomType[]; initialEdit?: boolean; onClose: () => void; onSave: (r: Room) => void }> = ({ room, types, initialEdit, onClose, onSave }) => {
  const [form, setForm] = useState<Room>({ ...room });
  const [isEditing, setIsEditing] = useState(initialEdit ?? false);

  useEffect(() => {
    setForm({ ...room });
    // if modal opened with initialEdit true, reflect it
    if (initialEdit) setIsEditing(true);
  }, [room, initialEdit]);

  // image editor state & helpers
  const [imageUrlInput, setImageUrlInput] = useState<string>(form.urlAnhPhong ?? '');
  useEffect(() => { setImageUrlInput(form.urlAnhPhong ?? ''); }, [form.urlAnhPhong]);

  const handleImageFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setForm(prev => ({ ...prev, urlAnhPhong: result }));
    };
    reader.readAsDataURL(file);
  };

  const ImageEditor: React.FC = () => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>Hình ảnh phòng</label>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ width: 160, height: 100, borderRadius: 8, overflow: 'hidden', background: '#f3f4f6', flex: '0 0 160px' }}>
          <img src={form.urlAnhPhong ?? '/img/room/default.webp'} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <div style={{ flex: 1 }}>
          <input type="file" accept="image/*" onChange={e => handleImageFile(e.target.files?.[0])} />
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <input placeholder="Hoặc dán URL ảnh" value={imageUrlInput} onChange={e => setImageUrlInput(e.target.value)} style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid #d1d5db' }} />
            <button onClick={() => setForm(prev => ({ ...prev, urlAnhPhong: imageUrlInput }))} style={{ padding: '8px 12px', borderRadius: 8, background: '#1e40af', color: '#fff', border: 'none' }}>Dùng URL</button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', zIndex: 1000 }} onClick={onClose}>
      <div style={{ 
        width: 800, 
        maxHeight: '90vh', 
        overflow: 'auto', 
        background: '#fff', 
        borderRadius: 16, 
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        border: '2px solid #e5e7eb'
      }} onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div style={{ 
          background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', 
          color: 'white', 
          padding: '20px 24px',
          borderTopLeftRadius: 14,
          borderTopRightRadius: 14
        }}>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Chi tiết phòng</h2>
        </div>

        {/* Content */}
        <div style={{ padding: 24 }}>
          {/* Room Image */}
          <div style={{ 
            width: '100%', 
            height: 280, 
            borderRadius: 12, 
            overflow: 'hidden', 
            marginBottom: 20,
            border: '2px solid #e5e7eb',
            backgroundColor: '#f3f4f6',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundImage: 'linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)',
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
          }}>
            <img 
              src={form.urlAnhPhong ?? '/img/room/default.webp'} 
              alt={form.tenPhong ?? ''} 
              style={{ 
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%', 
                height: '100%', 
                objectFit: 'cover',
                objectPosition: 'center',
                display: 'block',
                margin: 0,
                padding: 0,
                border: 'none',
                outline: 'none',
                backgroundColor: '#f3f4f6'
              }}
              onError={e => {
                // If image fails to load, show placeholder
                e.currentTarget.style.display = 'none';
                const container = e.currentTarget.parentElement;
                if (container && !container.querySelector('.placeholder')) {
                  const placeholder = document.createElement('div');
                  placeholder.className = 'placeholder';
                  placeholder.style.cssText = `
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    text-align: center;
                    color: #9ca3af;
                    font-size: 64px;
                  `;
                  placeholder.innerHTML = '🏨';
                  container.appendChild(placeholder);
                }
              }}
            />
          </div>

          {/* Room Info Display */}
          <div style={{ 
            background: '#f8fafc', 
            padding: 20, 
            borderRadius: 12, 
            border: '1px solid #e5e7eb',
            marginBottom: 20
          }}>
            <div style={{ 
              borderBottom: '2px solid #e5e7eb', 
              paddingBottom: 16, 
              marginBottom: 16,
              textAlign: 'center'
            }}>
              <h3 style={{ 
                margin: 0, 
                fontSize: 22, 
                fontWeight: 700, 
                color: '#1f2937'
              }}>
                🏞️ {form.tenPhong}
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', fontSize: 16, lineHeight: 1.6 }}>
              <div><strong>Mã phòng:</strong> {form.idphong ?? form.soPhong ?? '—'}</div>
              <div><strong>Tên phòng:</strong> {form.tenPhong ?? '—'}</div>
              <div><strong>Loại phòng:</strong> {form.tenLoaiPhong ?? '—'}</div>
              <div><strong>Số phòng:</strong> {form.soPhong ?? '—'}</div>
              <div><strong>Số người tối đa:</strong> {form.soNguoiToiDa ?? '—'}</div>
              <div><strong>Giá cơ bản:</strong> {formatPrice(form.giaCoBanMotDem)} VND / đêm</div>
              <div><strong>Xếp hạng sao:</strong> {form.xepHangSao ? '⭐'.repeat(Math.max(0, Math.min(5, form.xepHangSao))) : '—'}</div>
              <div><strong>Trạng thái:</strong> {statusEmoji(form.trangThai)} {form.trangThai ?? '—'}</div>
            </div>

            {form.moTa && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Mô tả:</div>
                <div style={{ color: '#6b7280', lineHeight: 1.6 }}>{form.moTa}</div>
              </div>
            )}
          </div>

          {/* Edit Form (conditionally rendered) */}
          {isEditing && (
            <div style={{ 
              background: '#fff', 
              padding: 20, 
              borderRadius: 12, 
              border: '1px solid #e5e7eb',
              marginBottom: 20
            }}>
              <h4 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 600, color: '#1f2937' }}>Chỉnh sửa thông tin</h4>
              {/* Image editor: preview, file input and URL input */}
              <ImageEditor />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Tên phòng</label>
                  <input 
                    value={form.tenPhong ?? ''} 
                    onChange={e => setForm({ ...form, tenPhong: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db' }}
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Số phòng</label>
                  <input 
                    value={form.soPhong ?? ''} 
                    onChange={e => setForm({ ...form, soPhong: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Loại phòng</label>
                  <select 
                    value={String(form.idloaiPhong ?? '')} 
                    onChange={e => setForm({ ...form, idloaiPhong: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db' }}
                  >
                    <option value="">-- Chọn --</option>
                    {types.map(t => <option key={t.idLoaiPhong} value={t.idLoaiPhong}>{t.tenLoaiPhong}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Giá (VNĐ)</label>
                  <input 
                    type="number"
                    value={String(form.giaCoBanMotDem ?? '')} 
                    onChange={e => setForm({ ...form, giaCoBanMotDem: Number(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Trạng thái</label>
                  <select 
                    value={form.trangThai ?? ''} 
                    onChange={e => setForm({ ...form, trangThai: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db' }}
                  >
                    <option value="Trống">Trống</option>
                    <option value="Đang sử dụng">Đang sử dụng</option>
                    <option value="Bảo trì">Bảo trì</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Số người tối đa</label>
                  <input 
                    type="number"
                    value={String(form.soNguoiToiDa ?? '')} 
                    onChange={e => setForm({ ...form, soNguoiToiDa: Number(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db' }}
                  />
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Mô tả</label>
                <textarea 
                  value={form.moTa ?? ''} 
                  onChange={e => setForm({ ...form, moTa: e.target.value })}
                  rows={3}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', resize: 'vertical' }}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            gap: 12, 
            paddingTop: 20,
            borderTop: '1px solid #e5e7eb'
          }}>
            <button 
              onClick={onClose}
              style={{ 
                padding: '12px 24px', 
                borderRadius: 8, 
                border: '1px solid #d1d5db',
                background: '#f9fafb',
                color: '#374151',
                fontSize: 16,
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              ⬅️ Quay lại
            </button>

            <div style={{ display: 'flex', gap: 12 }}>
              {!isEditing ? (
                <>
                  <button 
                    onClick={() => setIsEditing(true)}
                    style={{ 
                      padding: '12px 24px', 
                      borderRadius: 8, 
                      border: 'none',
                      background: '#1e40af',
                      color: 'white',
                      fontSize: 16,
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }}
                  >
                    ✏️ Sửa thông tin
                  </button>
                  <button 
                    onClick={() => window.dispatchEvent(new CustomEvent('openStatusFromDetail', { detail: { id: form.idphong, current: form.trangThai } }))}
                    style={{ 
                      padding: '12px 24px', 
                      borderRadius: 8, 
                      border: 'none',
                      background: '#f59e0b',
                      color: 'white',
                      fontSize: 16,
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }}
                  >
                    🔄 Cập nhật trạng thái
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => setIsEditing(false)}
                    style={{ 
                      padding: '12px 24px', 
                      borderRadius: 8, 
                      border: '1px solid #d1d5db',
                      background: '#f9fafb',
                      color: '#374151',
                      fontSize: 16,
                      fontWeight: 500,
                      cursor: 'pointer'
                    }}
                  >
                    Hủy
                  </button>
                  <button 
                    onClick={() => {
                      onSave(form);
                      setIsEditing(false);
                    }}
                    style={{ 
                      padding: '12px 24px', 
                      borderRadius: 8, 
                      border: 'none',
                      background: '#059669',
                      color: 'white',
                      fontSize: 16,
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }}
                  >
                    💾 Lưu thay đổi
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatusModal: React.FC<{ current: string; roomId: string; onClose: () => void; onSave: (id: string, newStatus: string) => void }> = ({ current, roomId, onClose, onSave }) => {
  const [value, setValue] = useState(current || 'Trống');
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div style={{ width: 420, background: '#fff', borderRadius: 12, padding: 18 }} onClick={e => e.stopPropagation()}>
        <h3>Chọn trạng thái mới cho phòng {roomId}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          <label><input type="radio" name="status" checked={value === 'Trống'} onChange={() => setValue('Trống')} /> Trống</label>
          <label><input type="radio" name="status" checked={value === 'Đang sử dụng'} onChange={() => setValue('Đang sử dụng')} /> Đang sử dụng</label>
          <label><input type="radio" name="status" checked={value === 'Bảo trì'} onChange={() => setValue('Bảo trì')} /> Bảo trì</label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <button onClick={onClose} style={{ padding: '8px 12px', borderRadius: 8 }}>❌ Hủy</button>
          <button onClick={() => onSave(roomId, value)} style={{ padding: '8px 12px', borderRadius: 8, background: '#10b981', color: '#fff' }}>💾 Lưu</button>
        </div>
      </div>
    </div>
  );
};

export default RoomSection;
