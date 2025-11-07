import React, { useEffect, useState } from 'react';
import { Spin, Alert } from 'antd';
import RoomCard from '../components/Room/RoomCard';
import DetailRoom from '../components/Room/DetailRoom';
import type { Room } from '../../../Backend/Hotel_System.API/Services/roomService';
import { getRooms } from '../../../Backend/Hotel_System.API/Services/roomService';

const RoomPage: React.FC = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Room | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  useEffect(() => {
    setLoading(true);
    getRooms()
      .then((r) => setRooms(r))
      .catch((e) => setError(e.message || 'Lỗi khi tải dữ liệu'))
      .finally(() => setLoading(false));
  }, []);

  const openDetail = (room: Room) => {
    setSelected(room);
    setDetailVisible(true);
  };

  const closeDetail = () => {
    setDetailVisible(false);
    setSelected(null);
  };

  const onBook = (room: Room) => {
    // Placeholder: navigate to booking flow or open booking modal
    // For now show console message and close detail
    console.log('Booking room', room.idphong);
    alert(`Tiếp tục đặt phòng: ${room.tenPhong ?? room.soPhong ?? room.idphong}`);
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>;
  if (error) return <div style={{ padding: 20 }}><Alert type="error" message="Lỗi" description={error} /></div>;

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ fontSize: '40px', paddingLeft: '130px', paddingBottom: '20px' }}>Danh sách phòng</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 30, paddingLeft: 130, paddingRight: 130 }}>
        {rooms.map((r) => (
          <RoomCard key={r.idphong} room={r} onOpenDetail={openDetail} onBook={onBook} />
        ))}
      </div>

      <DetailRoom visible={detailVisible} room={selected ?? undefined} onClose={closeDetail} onBook={onBook} />
    </div>
  );
};

export default RoomPage;
