import React, { useEffect, useMemo, useState } from 'react';
import { getRoomTypes, getRooms, Room, RoomType } from '../../api/roomsApi';
import Slidebar from '../components/Slidebar';
import HeaderSection from '../components/HeaderSection';
import RoomTypeSection from '../components/RoomTypeSection';
import RoomSection from '../components/RoomSection';

const resolveImage = (u?: string | null) => {
  if (!u) return '/img/room/room-b1.jpg';
  if (u.startsWith('/')) return u;
  return `/img/room/${u}`;
};

const Badge: React.FC<{ status?: string | null }> = ({ status }) => {
  const map: Record<string, { color: string; label: string }> = {
    'Trống': { color: '#10b981', label: 'Trống' },
    'Bảo trì': { color: '#9ca3af', label: 'Bảo trì' },
    'Đang sử dụng': { color: '#f59e0b', label: 'Đang sử dụng' },
  };
  const s = status ? (map[status] ?? { color: '#6b7280', label: status }) : { color: '#6b7280', label: 'Chưa rõ' };
  return <span style={{ padding: '6px 10px', borderRadius: 999, background: `${s.color}20`, color: s.color, fontWeight: 700, fontSize: 13 }}>{s.label}</span>;
};

const RoomManager: React.FC = () => {
  const [types, setTypes] = useState<RoomType[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [selectedType, setSelectedType] = useState<RoomType | null>(null);
  const [showTypeModal, setShowTypeModal] = useState(false);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // tabs: 'list' = Danh sách phòng (default), 'types' = Quản lý loại phòng
  const [activeTab, setActiveTab] = useState<'list' | 'types'>('list');

  const TabBar: React.FC = () => (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <button
        onClick={() => setActiveTab('list')}
        style={{
          padding: '8px 14px',
          borderRadius: 10,
          border: activeTab === 'list' ? 'none' : '1px solid #e5e7eb',
          background: activeTab === 'list' ? 'linear-gradient(135deg,#1e40af,#3b82f6)' : '#fff',
          color: activeTab === 'list' ? '#fff' : '#374151',
          fontWeight: 700,
          cursor: 'pointer'
        }}
      >
        Danh sách phòng
      </button>
      <button
        onClick={() => setActiveTab('types')}
        style={{
          padding: '8px 14px',
          borderRadius: 10,
          border: activeTab === 'types' ? 'none' : '1px solid #e5e7eb',
          background: activeTab === 'types' ? 'linear-gradient(135deg,#1e40af,#3b82f6)' : '#fff',
          color: activeTab === 'types' ? '#fff' : '#374151',
          fontWeight: 700,
          cursor: 'pointer'
        }}
      >
        Quản lý loại phòng
      </button>
    </div>
  );

  const TabContent: React.FC = () => (
    <div>
      {activeTab === 'list' ? (
        <RoomSection />
      ) : (
        <RoomTypeSection />
      )}
    </div>
  );

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [t, r] = await Promise.all([getRoomTypes(), getRooms()]);
        if (!mounted) return;
        setTypes(t);
        setRooms(r);
      } catch (e) {
        console.error('Failed to load rooms/types', e);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  const roomsByType = useMemo(() => {
    if (!selectedType) return [];
    return rooms.filter(r => (r.idloaiPhong ?? '').toString() === (selectedType.idLoaiPhong ?? '').toString());
  }, [rooms, selectedType]);

  const filteredRooms = useMemo(() => {
    return rooms.filter(r => {
      if (statusFilter && String(r.trangThai || '').toLowerCase() !== statusFilter.toLowerCase()) return false;
      if (query) {
        const q = query.toLowerCase();
        if (!((r.tenPhong || '').toLowerCase().includes(q) || (r.tenLoaiPhong || '').toLowerCase().includes(q) || (r.soPhong || '').toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [rooms, statusFilter, query]);

  const quickToggleStatus = (roomId: string) => {
    setRooms(prev => prev.map(r => r.idphong === roomId ? ({ ...r, trangThai: (r.trangThai === 'Bảo trì' ? 'Trống' : 'Bảo trì') }) : r));
  };

  const removeRoom = (roomId: string) => {
    if (!confirm('Xác nhận xoá phòng này?')) return;
    setRooms(prev => prev.filter(r => r.idphong !== roomId));
  };

  const openType = (t: RoomType) => {
    setSelectedType(t);
    setShowTypeModal(true);
  };

  if (loading) return <div style={{ padding: 24, marginLeft: 280 }}>Đang tải dữ liệu...</div>;

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <Slidebar />
      <div style={{ marginLeft: 240 }}>
        <HeaderSection showStats={false} />

        <main style={{ padding: '0px 60px' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 8px 24px rgba(2,6,23,0.06)' }}>

            {/* Tabs: Danh sách phòng | Quản lý loại phòng */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
              <TabBar />
            </div>

            <section style={{ marginBottom: 12 }}>
              {/* content switched by TabBar via global simple state hook */}
              <TabContent />
            </section>

            {/* Modal: rooms in selected type */}
            {showTypeModal && selectedType && (
              <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={() => setShowTypeModal(false)}>
                <div style={{ width: '80%', maxHeight: '80%', overflow: 'auto', background: '#fff', borderRadius: 12, padding: 20 }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>{selectedType.tenLoaiPhong} — Danh sách phòng</h3>
                    <div><button onClick={() => setShowTypeModal(false)} style={{ padding: 8, borderRadius: 8 }}>Đóng</button></div>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    {roomsByType.length === 0 && <div className="text-muted">Không có phòng nào thuộc loại này.</div>}
                    {roomsByType.map(r => (
                      <div key={r.idphong} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 12, borderBottom: '1px solid #f3f4f6' }}>
                        <div style={{ width: 120, height: 80, backgroundImage: `url(${resolveImage(r.urlAnhPhong)})`, backgroundSize: 'cover', backgroundPosition: 'center', borderRadius: 8 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <div style={{ fontWeight: 700 }}>{r.tenPhong}</div>
                            <div><Badge status={r.trangThai} /></div>
                          </div>
                          <div style={{ color: '#6b7280' }}>{r.moTa}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default RoomManager;
