import React, { useEffect, useState } from 'react';
import { RoomType, getRoomTypes, createRoomType, updateRoomType, deleteRoomType, getRooms, Room, createRoom } from '../../api/roomsApi';

const Thumbnail: React.FC<{ src?: string | null; alt?: string; style?: React.CSSProperties }> = ({ src, alt, style }) => (
  <div style={{ width: 120, height: 80, background: '#f3f4f6', borderRadius: 8, overflow: 'hidden', ...style }}>
    {src ? <img src={src} alt={alt} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%' }} />}
  </div>
);

const RoomTypeSection: React.FC = () => {
  const [types, setTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);

  // modal state for CRUD
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RoomType | null>(null);

  // modal showing rooms of a type
  const [showRoomsModal, setShowRoomsModal] = useState(false);
  const [roomsForType, setRoomsForType] = useState<Room[]>([]);
  const [activeType, setActiveType] = useState<RoomType | null>(null);
  const [roomsAll, setRoomsAll] = useState<Room[]>([]);
  const [showAddRoomModal, setShowAddRoomModal] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [t, allRooms] = await Promise.all([getRoomTypes(), getRooms()]);
      setTypes(t);
      setRoomsAll(allRooms);
    } catch (e) {
      console.error(e);
      alert('Không thể tải loại phòng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openRooms = async (t: RoomType) => {
    setActiveType(t);
    setShowRoomsModal(true);
    try {
      const all = await getRooms();
      setRoomsForType(all.filter(r => String(r.idloaiPhong) === String(t.idLoaiPhong)));
      setRoomsAll(all);
    } catch (e) {
      console.error(e);
      setRoomsForType([]);
    }
  };

  const handleAddRoomSave = async (values: { tenPhong: string; soPhong?: string; giaCoBanMotDem?: number; urlAnhPhong?: string; moTa?: string; trangThai?: string }) => {
    if (!activeType) return;
    try {
      await createRoom({ ...values, idloaiPhong: activeType.idLoaiPhong });
      // refresh
      const all = await getRooms();
      setRoomsForType(all.filter(r => String(r.idloaiPhong) === String(activeType.idLoaiPhong)));
      setRoomsAll(all);
      setShowAddRoomModal(false);
    } catch (e) {
      console.error(e);
      alert('Lỗi khi thêm phòng');
    }
  };

  const handleAddClick = () => { setEditing(null); setShowForm(true); };

  const handleEditClick = (t: RoomType) => { setEditing(t); setShowForm(true); };

  const handleDelete = async (id: string) => {
    if (!confirm('Xác nhận xóa loại phòng?')) return;
    try {
      await deleteRoomType(id);
      await load();
    } catch (e) {
      console.error(e);
      alert('Lỗi khi xóa loại phòng');
    }
  };

  const handleFormSave = async (values: { tenLoaiPhong: string; moTa?: string; urlAnhLoaiPhong?: string }) => {
    try {
      if (editing) {
        await updateRoomType(editing.idLoaiPhong, values);
      } else {
        await createRoomType(values);
      }
      setShowForm(false);
      await load();
    } catch (e) {
      console.error(e);
      alert('Lỗi lưu loại phòng');
    }
  };

  if (loading) return <div>Đang tải loại phòng...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Loại phòng</h3>
        <div>
          <button onClick={handleAddClick} style={{ padding: '8px 12px', borderRadius: 8 }}>Thêm loại phòng</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
        {types.map(t => {
          const count = roomsAll.filter(r => String(r.idloaiPhong) === String(t.idLoaiPhong)).length;
          return (
            <div key={t.idLoaiPhong} style={{
              background: '#fff',
              borderRadius: 16,
              overflow: 'hidden',
              boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
              border: '1px solid #e5e7eb',
              position: 'relative',
              transition: 'transform 0.18s ease, box-shadow 0.18s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.12)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)'; }}>
              {/* Image */}
              <div style={{ position: 'relative', width: '100%', height: 160, overflow: 'hidden', backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img
                  src={t.urlAnhLoaiPhong ?? '/img/room/default.webp'}
                  alt={t.tenLoaiPhong}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }}
                  onError={e => { e.currentTarget.style.display = 'none'; const c = e.currentTarget.parentElement; if (c && !c.querySelector('.placeholder')) { const ph = document.createElement('div'); ph.className = 'placeholder'; ph.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:40px;color:#9ca3af'; ph.innerHTML = '🏨'; c.appendChild(ph); } }}
                />
                <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(255,255,255,0.95)', padding: '6px 12px', borderRadius: 999, fontWeight: 700, color: '#374151', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>{count} phòng</div>
              </div>

              {/* Content */}
              <div style={{ padding: 16 }}>
                <h4 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#111827' }}>{t.tenLoaiPhong}</h4>
                <p style={{ margin: '8px 0 12px', color: '#6b7280', fontSize: 14, minHeight: 36 }}>{t.moTa ?? ''}</p>

                <div style={{ display: 'flex', gap: 12 }}>
                  <button onClick={() => openRooms(t)} style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid #d1d5db', background: '#f9fafb', color: '#374151', fontWeight: 700, cursor: 'pointer' }}>👁️ Xem chi tiết</button>
                  <button onClick={() => handleEditClick(t)} style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#1e40af,#3b82f6)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>✏️ Chỉnh sửa</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Rooms modal */}
      {showRoomsModal && activeType && (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={() => setShowRoomsModal(false)}>
          <div style={{ width: '80%', maxHeight: '80%', overflow: 'auto', background: '#fff', borderRadius: 12, padding: 20 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>{activeType.tenLoaiPhong} — Danh sách phòng</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowAddRoomModal(true)} style={{ padding: 8, borderRadius: 8 }}>➕ Thêm phòng mới</button>
                <button onClick={() => setShowRoomsModal(false)} style={{ padding: 8, borderRadius: 8 }}>⬅️ Quay lại danh sách</button>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              {roomsForType.length === 0 && <div className="text-muted">Không có phòng nào thuộc loại này.</div>}
              <div style={{ display: 'grid', gap: 12 }}>
                {roomsForType.map(r => (
                  <div key={r.idphong} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 12, borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ width: 120, height: 80, backgroundImage: `url(${r.urlAnhPhong})`, backgroundSize: 'cover', backgroundPosition: 'center', borderRadius: 8 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div style={{ fontWeight: 700 }}>{r.tenPhong} {r.soPhong ? `(${r.soPhong})` : ''} {r.trangThai === 'Trống' ? '💚' : r.trangThai === 'Đang sử dụng' ? '❤️' : ''}</div>
                        <div style={{ color: '#6b7280' }}>{r.trangThai}</div>
                      </div>
                      <div style={{ color: '#6b7280' }}>{r.moTa}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {showAddRoomModal && activeType && (
            <AddRoomModal onClose={() => setShowAddRoomModal(false)} onSave={handleAddRoomSave} type={activeType} />
          )}
        </div>
      )}

      {/* Simple Form Modal for add/edit type */}
      {showForm && (
        <TypeFormModal initial={editing} onClose={() => setShowForm(false)} onSave={handleFormSave} />
      )}
    </div>
  );
};

const TypeFormModal: React.FC<{ initial?: RoomType | null; onClose: () => void; onSave: (v: { tenLoaiPhong: string; moTa?: string; urlAnhLoaiPhong?: string }) => void }> = ({ initial, onClose, onSave }) => {
  const [ten, setTen] = useState(initial?.tenLoaiPhong ?? '');
  const [moTa, setMoTa] = useState(initial?.moTa ?? '');
  const [url, setUrl] = useState(initial?.urlAnhLoaiPhong ?? '');

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div style={{ width: 520, background: '#fff', borderRadius: 12, padding: 18 }} onClick={e => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>{initial ? 'Sửa loại phòng' : 'Thêm loại phòng'}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label>Tên</label>
          <input value={ten} onChange={e => setTen(e.target.value)} style={{ padding: 8, borderRadius: 8, border: '1px solid #e5e7eb' }} />
          <label>Mô tả</label>
          <textarea value={moTa} onChange={e => setMoTa(e.target.value)} style={{ padding: 8, borderRadius: 8, border: '1px solid #e5e7eb' }} />
          <label>URL ảnh</label>
          <input value={url} onChange={e => setUrl(e.target.value)} style={{ padding: 8, borderRadius: 8, border: '1px solid #e5e7eb' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <button onClick={onClose} style={{ padding: '8px 12px', borderRadius: 8 }}>Huỷ</button>
          <button onClick={() => onSave({ tenLoaiPhong: ten, moTa, urlAnhLoaiPhong: url })} style={{ padding: '8px 12px', borderRadius: 8, background: '#3b82f6', color: '#fff' }}>Lưu</button>
        </div>
      </div>
    </div>
  );
};

export default RoomTypeSection;

const AddRoomModal: React.FC<{ type: RoomType; onClose: () => void; onSave: (v: { tenPhong: string; soPhong?: string; giaCoBanMotDem?: number; urlAnhPhong?: string; moTa?: string; trangThai?: string }) => void }> = ({ type, onClose, onSave }) => {
  const [ten, setTen] = useState('');
  const [so, setSo] = useState('');
  const [gia, setGia] = useState<number | ''>('');
  const [url, setUrl] = useState('');
  const [moTa, setMoTa] = useState('');
  const [trangThai, setTrangThai] = useState('Trống');

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div style={{ width: 520, background: '#fff', borderRadius: 12, padding: 18 }} onClick={e => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Thêm phòng cho {type.tenLoaiPhong}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label>Tên phòng</label>
          <input value={ten} onChange={e => setTen(e.target.value)} style={{ padding: 8, borderRadius: 8, border: '1px solid #e5e7eb' }} />
          <label>Số phòng</label>
          <input value={so} onChange={e => setSo(e.target.value)} style={{ padding: 8, borderRadius: 8, border: '1px solid #e5e7eb' }} />
          <label>Giá (VNĐ)</label>
          <input value={gia as any} onChange={e => setGia(e.target.value ? Number(e.target.value) : '')} style={{ padding: 8, borderRadius: 8, border: '1px solid #e5e7eb' }} />
          <label>URL ảnh</label>
          <input value={url} onChange={e => setUrl(e.target.value)} style={{ padding: 8, borderRadius: 8, border: '1px solid #e5e7eb' }} />
          <label>Trạng thái</label>
          <select value={trangThai} onChange={e => setTrangThai(e.target.value)} style={{ padding: 8, borderRadius: 8, border: '1px solid #e5e7eb' }}>
            <option value="Trống">Trống</option>
            <option value="Đang sử dụng">Đang sử dụng</option>
            <option value="Bảo trì">Bảo trì</option>
          </select>
          <label>Mô tả</label>
          <textarea value={moTa} onChange={e => setMoTa(e.target.value)} style={{ padding: 8, borderRadius: 8, border: '1px solid #e5e7eb' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <button onClick={onClose} style={{ padding: '8px 12px', borderRadius: 8 }}>Huỷ</button>
          <button onClick={() => onSave({ tenPhong: ten, soPhong: so, giaCoBanMotDem: typeof gia === 'number' ? gia : undefined, urlAnhPhong: url, moTa, trangThai })} style={{ padding: '8px 12px', borderRadius: 8, background: '#3b82f6', color: '#fff' }}>Thêm</button>
        </div>
      </div>
    </div>
  );
};
