import React, { useEffect, useState, useMemo } from "react";
import {
  Spin,
  Alert,
  Row,
  Col,
  Card,
  Select,
  Slider,
  DatePicker,
  Typography,
  Layout,
  Button,
} from "antd";
import { CloseOutlined } from '@ant-design/icons';
import RoomCard from "../components/Room/RoomCard";
import DetailRoom from "../components/Room/DetailRoom";
import BookingForm from "../components/BookingForm";
import type { Dayjs } from "dayjs";

// Import từ file api.ts đã gộp
import { getRooms, getRoomTypes } from "../api/roomsApi";
import type { Room, RoomType } from "../api/roomsApi";

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

  const [priceBounds, setPriceBounds] = useState<[number, number]>([
    0, 50000000,
  ]);
  const [filterPriceRange, setFilterPriceRange] = useState<[number, number]>([
    0, 50000000,
  ]);

  const [availableRooms, setAvailableRooms] = useState<Room[] | null>(null);
  const [bookingMessage, setBookingMessage] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);

    // Read loaiId from URL hash to pre-filter by room type
    const hash = window.location.hash;
    const urlParams = new URLSearchParams(
      hash.includes("?") ? hash.split("?")[1] : ""
    );
    const loaiIdParam = urlParams.get("loaiId");
    if (loaiIdParam) {
      setFilterRoomType(loaiIdParam);
    }

    Promise.all([getRooms(), getRoomTypes()])
      .then(([roomsData, roomTypesData]) => {
        // api.ts đã tự động chuẩn hóa
        setRooms(roomsData);
        setRoomTypes(roomTypesData);

        if (roomsData.length > 0) {
          const prices = roomsData
            .map((r) => r.giaCoBanMotDem ?? 0)
            .filter((p) => p > 0);
          if (prices.length > 0) {
            const min = Math.min(...prices);
            const max = Math.max(...prices);
            setPriceBounds([min, max]);
            setFilterPriceRange([min, max]);
          }
        }
      })
      .catch((e) => setError(e.message || "Lỗi khi tải dữ liệu"))
      .finally(() => setLoading(false));
  }, []);

  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      // Hide rooms under maintenance from public listing
      if ((room.trangThai ?? '').toString().toLowerCase().includes('bảo trì')) return false;
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
  }, [
    rooms,
    filterRoomType,
    filterGuests,
    filterRating,
    filterPriceRange,
    filterDates,
  ]);

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
    console.log("Booking room", room.idphong);
    alert(
      `Tiếp tục đặt phòng: ${room.tenPhong ?? room.soPhong ?? room.idphong}`
    );
  };

  const resetFilters = () => {
    setFilterDates(null);
    setFilterGuests(null);
    setFilterRoomType(null);
    setFilterRating(null);
    setFilterPriceRange(priceBounds);
    setAvailableRooms(null);
    setBookingMessage(null);
  };

  const handleBookingResults = (
    results: any[],
    message?: string,
    meta?: { rooms?: number }
  ) => {
    // Prefer rooms count from the callback metadata; fallback to URL param.
    const urlParams = new URLSearchParams(window.location.search);
    const roomsCount = Number(
      meta?.rooms ?? parseInt(urlParams.get("rooms") || "1")
    );

    if (roomsCount > 1 && results.length > 0) {
      // Redirect to select-room only when explicitly requested (rooms > 1)
      const checkIn = urlParams.get("checkIn") || "";
      const checkOut = urlParams.get("checkOut") || "";
      const guests = urlParams.get("guests") || "1";

      const params = new URLSearchParams({
        checkIn,
        checkOut,
        guests,
        rooms: roomsCount.toString(),
      });

      window.location.href = `/select-room?${params.toString()}`;
    } else {
      // Single room: show inline results
      setAvailableRooms(results);
      setBookingMessage(message || null);
    }
  };

  // Reset availableRooms when filters change
  useEffect(() => {
    setAvailableRooms(null);
    setBookingMessage(null);
  }, [
    filterDates,
    filterGuests,
    filterRoomType,
    filterRating,
    filterPriceRange,
  ]);

  if (loading)
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <Spin size="large" />
      </div>
    );
  if (error)
    return (
      <div style={{ padding: 20 }}>
        <Alert type="error" message="Lỗi tải dữ liệu" description={error} />
      </div>
    );

  return (
    <Layout>
      <Content
        style={{
          padding: "24px 50px",
          maxWidth: "1600px",
          margin: "auto",
          width: "100%",
        }}
      >
        {/* <Title level={1} style={{ marginBottom: 24, paddingLeft: 10 }}>Danh sách phòng</Title> */}

        <Card style={{ marginBottom: 24, padding: "20px 30px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 30,
            }}
          >
            {/* Left: Hotel name and address */}
            <div style={{ flex: "0 0 auto", minWidth: 200 }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: 24,
                  fontWeight: 600,
                  color: "#1f2937",
                  fontFamily: '"Lora", serif',
                }}
              >
                Robins Villa
              </h2>
              <p
                style={{
                  margin: "4px 0 0 0",
                  fontSize: 14,
                  color: "#6b7280",
                  lineHeight: 1.4,
                }}
              >
                4 Đường Dã Tượng, Phường 6, Thành phố Đà Lạt, Lâm Đồng
              </p>
            </div>

            {/* Right: Booking form */}
            <div style={{ flex: "1 1 auto" }}>
              <BookingForm
                horizontal
                fullWidth
                onResults={handleBookingResults}
              />
            </div>
          </div>

          <Row gutter={[16, 16]} align="bottom" style={{ marginTop: 20 }}>
            <Col xs={12} md={6} lg={3}>
              <label>Số người</label>
              <Select
                placeholder="Tất cả"
                style={{ width: "100%" }}
                allowClear
                value={filterGuests ?? undefined}
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
                style={{ width: "100%" }}
                allowClear
                value={filterRoomType ?? undefined}
                onChange={setFilterRoomType}
              >
                {roomTypes
                  .filter((rt) => rt.idLoaiPhong)
                  .map((rt) => (
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
                style={{ width: "100%" }}
                allowClear
                value={filterRating ?? undefined}
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
                onChange={(value: number[]) => {
                  setFilterPriceRange(value as [number, number]);
                }}
                tooltip={{
                  formatter: (value) => `${value?.toLocaleString()}đ`,
                }}
              />
            </Col>
              <Col xs={12} md={6} lg={3} style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                <Button onClick={resetFilters} icon={<CloseOutlined />}>Xóa bộ lọc</Button>
              </Col>
          </Row>
        </Card>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 30,
          }}
        >
          {bookingMessage && (
            <Alert
              message={bookingMessage}
              type={
                availableRooms && availableRooms.length > 0 ? "info" : "warning"
              }
              showIcon
              style={{ marginBottom: 16, gridColumn: "1 / -1" }}
            />
          )}

            {(() => {
            // Ensure maintenance rooms are hidden even when availableRooms is provided
            const source = availableRooms !== null ? availableRooms : filteredRooms;
            const roomsToDisplay = source.filter(r => !((r.trangThai ?? '').toString().toLowerCase().includes('bảo trì')));
            return roomsToDisplay.length === 0 ? (
              <Alert
                message="Không tìm thấy phòng"
                description="Không có phòng nào phù hợp với tiêu chí tìm kiếm của bạn. Vui lòng thử lại."
                type="warning"
              />
            ) : (
              roomsToDisplay.map((r) => (
                <RoomCard
                  key={r.idphong}
                  room={r}
                  onOpenDetail={openDetail}
                  onBook={onBook}
                />
              ))
            );
          })()}
        </div>

        <DetailRoom
          visible={detailVisible}
          room={selected ?? undefined}
          onClose={closeDetail}
          onBook={onBook}
        />
      </Content>
    </Layout>
  );
};

export default RoomPage;
