import React, { useEffect, useState, useMemo } from 'react';
import { Spin, Alert, Row, Col, Card, Select, Slider, DatePicker, Typography, Layout } from 'antd';
import RoomCard from '../components/Room/RoomCard';
import DetailRoom from '../components/Room/DetailRoom';
import type { Dayjs } from 'dayjs';

// Import từ file api.ts đã gộp
import { getRooms, getRoomTypes } from '../api/roomsApi'; 
import type { Room, RoomType } from '../api/roomsApi';

const { Content } = Layout;
const { Title } = Typography;
const { RangePicker } = DatePicker;

type RangeValue = [Dayjs | null, Dayjs | null] | null;

const RoomPage: React.FC = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]); 

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Room | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  const [filterDates, setFilterDates] = useState<RangeValue>(null);
  const [filterGuests, setFilterGuests] = useState<number | null>(null);
  const [filterRoomType, setFilterRoomType] = useState<string | null>(null);
  const [filterRating, setFilterRating] = useState<number | null>(null);
  
  const [priceBounds, setPriceBounds] = useState<[number, number]>([0, 50000000]);
  const [filterPriceRange, setFilterPriceRange] = useState<[number, number]>([0, 50000000]);


  useEffect(() => {
    setLoading(true);
    Promise.all([
      getRooms(),
      getRoomTypes()
    ])
    .then(([roomsData, roomTypesData]) => {
      
      // api.ts đã tự động chuẩn hóa
      setRooms(roomsData);
      setRoomTypes(roomTypesData);

      if (roomsData.length > 0) {
        const prices = roomsData.map(r => r.giaCoBanMotDem ?? 0).filter(p => p > 0);
        if (prices.length > 0) {
          const min = Math.min(...prices);
          const max = Math.max(...prices);
          setPriceBounds([min, max]);
          setFilterPriceRange([min, max]);
        }
      }
    })
    .catch((e) => setError(e.message || 'Lỗi khi tải dữ liệu'))
    .finally(() => setLoading(false));
  }, []);

  const filteredRooms = useMemo(() => {
    return rooms.filter(room => {
      if (filterRoomType && room.idloaiPhong !== filterRoomType) {
        return false;
      }
      if (filterGuests && (room.soNguoiToiDa ?? 0) < filterGuests) {
        return false;
      }
      if (filterRating && (room.xepHangSao ?? 0) !== filterRating) {
        return false;
      }
      const price = room.giaCoBanMotDem ?? 0;
      if (price < filterPriceRange[0] || price > filterPriceRange[1]) {
        return false;
      }
      return true;
    });
  }, [rooms, filterRoomType, filterGuests, filterRating, filterPriceRange, filterDates]);


  // Handlers cho Modal
  const openDetail = (room: Room) => {
    setSelected(room);
    setDetailVisible(true);
  };

  const closeDetail = () => {
    setDetailVisible(false);
    setSelected(null);
  };

  const onBook = (room: Room) => {
    console.log('Booking room', room.idphong);
    alert(`Tiếp tục đặt phòng: ${room.tenPhong ?? room.soPhong ?? room.idphong}`);
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>;
  if (error) return <div style={{ padding: 20 }}><Alert type="error" message="Lỗi tải dữ liệu" description={error} /></div>;

  return (
    <Layout>
      <Content style={{ 
        padding: '24px 50px', 
        maxWidth: '1600px', 
        margin: 'auto',
        width: '100%'
      }}>
        {/* <Title level={1} style={{ marginBottom: 24, paddingLeft: 10 }}>Danh sách phòng</Title> */}

        <Card style={{ marginBottom: 24 }}>
          <Row gutter={[16, 16]} align="bottom">
            <Col xs={24} md={12} lg={6}>
              <label>Chọn ngày (Chưa hoạt động)</label>
              <RangePicker 
                style={{ width: '100%' }} 
                onChange={setFilterDates}
                value={filterDates}
                disabled 
              />
            </Col>
            <Col xs={12} md={6} lg={3}>
              <label>Số người</label>
              <Select
                placeholder="Tất cả"
                style={{ width: '100%' }}
                allowClear
                onChange={setFilterGuests}
              >
                <Select.Option value={1}>1 người</Select.Option>
                <Select.Option value={2}>2 người</Select.Option>
                <Select.Option value={3}>3 người</Select.Option>
                <Select.Option value={4}>4+ người</Select.Option>
              </Select>
            </Col>
            <Col xs={12} md={6} lg={5}>
              <label>Loại phòng</label>
              <Select
                placeholder="Tất cả"
                style={{ width: '100%' }}
                allowClear
                onChange={setFilterRoomType}
              >
                {roomTypes.map(rt => (
                  <Select.Option key={rt.idLoaiPhong} value={rt.idLoaiPhong}>
                    {rt.tenLoaiPhong}
                  </Select.Option>
                ))}
              </Select>
            </Col>
            <Col xs={12} md={6} lg={3}>
              <label>Hạng sao</label>
              <Select
                placeholder="Tất cả"
                style={{ width: '100%' }}
                allowClear
                onChange={setFilterRating}
              >
                <Select.Option value={5}>5 sao</Select.Option>
                <Select.Option value={4}>4 sao</Select.Option>
                <Select.Option value={3}>3 sao</Select.Option>
              </Select>
            </Col>
            <Col xs={24} md={12} lg={7}>
              <label>Khoảng giá (VND)</label>
              <Slider
                range
                min={priceBounds[0]}
                max={priceBounds[1]}
                step={100000}
                value={filterPriceRange}
                // === LỖI ĐÃ SỬA TẠI ĐÂY ===
                // 1. Đổi type của 'value' thành 'number[]' (theo yêu cầu của AntD)
                onChange={(value: number[]) => {
                  // 2. Ép kiểu 'value' thành [number, number] (theo yêu cầu của state)
                  setFilterPriceRange(value as [number, number]);
                }}
                tipFormatter={(value) => `${value?.toLocaleString()}đ`}
              />
            </Col>
          </Row>
          
          <Alert
            type="info"
            message="Các bộ lọc nâng cao (Tiện nghi, Đánh giá, Khuyến mãi) sẽ sớm được cập nhật khi có dữ liệu."
            style={{ marginTop: 16 }}
            showIcon
          />
        </Card>

        {/* <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', 
          gap: 30 
        }}>
          {filteredRooms.length === 0 && (
            <Alert
              message="Không tìm thấy phòng"
              description="Không có phòng nào phù hợp với tiêu chí tìm kiếm của bạn. Vui lòng thử lại."
              type="warning"
            />
          )}

          {filteredRooms.map((r) => (
            <RoomCard key={r.idphong} room={r} onOpenDetail={openDetail} onBook={onBook} />
          ))}
        </div>

        <DetailRoom visible={detailVisible} room={selected ?? undefined} onClose={closeDetail} onBook={onBook} />
      </Content>
    </Layout>
  );
};

export default RoomPage; */}

<div style={{ 
          display: 'grid', 
          // Thay đổi từ 'auto-fill' sang 'repeat(4, 1fr)'
          gridTemplateColumns: 'repeat(4, 1fr)', 
          gap: 30 
        }}>
          {filteredRooms.length === 0 && (
            <Alert
              message="Không tìm thấy phòng"
              description="Không có phòng nào phù hợp với tiêu chí tìm kiếm của bạn. Vui lòng thử lại."
              type="warning"
              // Thêm style để Alert chiếm trọn 4 cột
              style={{ gridColumn: '1 / -1' }} 
            />
          )}

          {filteredRooms.map((r) => (
            <RoomCard key={r.idphong} room={r} onOpenDetail={openDetail} onBook={onBook} />
          ))}
        </div>

        <DetailRoom visible={detailVisible} room={selected ?? undefined} onClose={closeDetail} onBook={onBook} />
      </Content>
    </Layout>
  );
};

export default RoomPage;