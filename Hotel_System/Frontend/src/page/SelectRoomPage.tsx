import React, { useEffect, useState } from "react";
import {
  Layout,
  Card,
  Alert,
  Spin,
  Typography,
  Row,
  Col,
  Button,
  Divider,
} from "antd";
import { CheckCircleOutlined, UserOutlined } from "@ant-design/icons";
import RoomCard from "../components/Room/RoomCard";
import DetailRoom from "../components/Room/DetailRoom";
import BookingProgress from "../components/BookingProgress";

const { Content } = Layout;
const { Title, Text } = Typography;

interface SelectedRoom {
  roomNumber: number;
  room: any;
}

const SelectRoomPage: React.FC = () => {
  const searchParams = new URLSearchParams(window.location.search);

  // Lấy thông tin từ URL
  const totalRooms = parseInt(searchParams.get("rooms") || "1");
  const checkIn = searchParams.get("checkIn") || "";
  const checkOut = searchParams.get("checkOut") || "";
  const guests = parseInt(searchParams.get("guests") || "1");

  // Lấy danh sách phòng có sẵn từ sessionStorage
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);
  const [selectedRooms, setSelectedRooms] = useState<SelectedRoom[]>([]);
  const [currentRoomNumber, setCurrentRoomNumber] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal detail room
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedForDetail, setSelectedForDetail] = useState<any>(null);

  useEffect(() => {
    // Lấy danh sách phòng từ sessionStorage
    const roomsFromSession = sessionStorage.getItem("bookingResults");

    if (roomsFromSession) {
      try {
        const parsed = JSON.parse(roomsFromSession);
        console.log("Available rooms from sessionStorage:", parsed);
        setAvailableRooms(parsed);
        setLoading(false);
      } catch (e) {
        console.error("Error parsing booking results:", e);
        setError("Không thể tải danh sách phòng");
        setLoading(false);
      }
    } else {
      console.warn("No booking results found in sessionStorage");
      setError("Không tìm thấy danh sách phòng. Vui lòng tìm kiếm lại.");
      setLoading(false);
    }
  }, []);

  const handleSelectRoom = (room: any) => {
    // Kiểm tra xem phòng đã được chọn chưa
    const alreadySelected = selectedRooms.some(
      (sr) => sr.room.idphong === room.idphong
    );

    if (alreadySelected) {
      alert("Phòng này đã được chọn!");
      return;
    }

    // Thêm phòng vào danh sách đã chọn
    const newSelectedRooms = [
      ...selectedRooms,
      { roomNumber: currentRoomNumber, room },
    ];
    setSelectedRooms(newSelectedRooms);

    // Nếu đã chọn đủ số phòng, chuyển sang trang thanh toán
    if (currentRoomNumber >= totalRooms) {
      // Lưu thông tin đặt phòng vào sessionStorage
      sessionStorage.setItem(
        "bookingInfo",
        JSON.stringify({
          selectedRooms: newSelectedRooms,
          checkIn,
          checkOut,
          guests,
          totalRooms,
        })
      );
      window.location.href = "/checkout";
    } else {
      // Chuyển sang chọn phòng tiếp theo
      setCurrentRoomNumber(currentRoomNumber + 1);
    }
  };

  const handleRemoveRoom = (roomNumber: number) => {
    const newSelectedRooms = selectedRooms.filter(
      (sr) => sr.roomNumber !== roomNumber
    );
    setSelectedRooms(newSelectedRooms);
    // Quay lại chọn phòng vừa xóa
    setCurrentRoomNumber(roomNumber);
  };

  const handleOpenDetail = (room: any) => {
    setSelectedForDetail(room);
    setDetailVisible(true);
  };

  const handleCloseDetail = () => {
    setDetailVisible(false);
    setSelectedForDetail(null);
  };

  const handleTabChange = (key: string) => {
    if (key === "checkout") {
      // Lưu thông tin đặt phòng vào sessionStorage
      sessionStorage.setItem(
        "bookingInfo",
        JSON.stringify({
          selectedRooms,
          checkIn,
          checkOut,
          guests,
          totalRooms,
        })
      );
      window.location.href = "/checkout";
      return;
    }
    const roomNum = parseInt(key);
    setCurrentRoomNumber(roomNum);
  };

  const calculateTotal = () => {
    if (!selectedRooms) return 0;

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const nights = Math.ceil(
      (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const totalPrice = selectedRooms.reduce((sum, sr) => {
      return sum + (sr.room.giaCoBanMotDem || 0) * nights;
    }, 0);

    return totalPrice;
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <Layout>
        <Content style={{ padding: "50px" }}>
          <Alert
            type="error"
            message="Lỗi"
            description={error}
            showIcon
            action={
              <Button
                type="primary"
                onClick={() => (window.location.href = "/rooms")}
              >
                Quay lại tìm kiếm
              </Button>
            }
          />
        </Content>
      </Layout>
    );
  }

  // Tính toán steps
  const stepsItems = Array.from({ length: totalRooms }, (_, i) => ({
    title: `Phòng ${i + 1}`,
    status: selectedRooms.find((sr) => sr.roomNumber === i + 1)
      ? "finish"
      : currentRoomNumber === i + 1
      ? "process"
      : "wait",
    icon: selectedRooms.find((sr) => sr.roomNumber === i + 1) ? (
      <CheckCircleOutlined />
    ) : undefined,
  }));

  // Lọc ra các phòng chưa được chọn
  const availableForSelection = availableRooms.filter(
    (room) => !selectedRooms.some((sr) => sr.room.idphong === room.idphong)
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
        <BookingProgress
          totalRooms={totalRooms}
          currentStage="select"
          currentRoom={currentRoomNumber}
          selectedRoomNumbers={selectedRooms.map((sr) => sr.roomNumber)}
        />

        <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
          {/* Main content */}
          <Col xs={24} lg={16}>
            <div style={{ marginBottom: 24 }}>
              <Text>
                <a href="/rooms">Lần lưu trú của bạn</a> &gt; Chọn phòng
              </Text>
              <Title level={2} style={{ marginTop: 8 }}>
                Chọn một phòng
              </Title>
              <Text type="secondary">
                Phòng {currentRoomNumber} / {totalRooms}
              </Text>
            </div>

            {/* Room selector tabs removed — using top progress bar for navigation */}

            <Alert
              message={`Đã tìm thấy ${availableForSelection.length} phòng. Chúng tôi đang hiển thị giá trung bình mỗi đêm.`}
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
            />

            {/* Room list */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: 24,
              }}
            >
              {availableForSelection.map((room) => (
                <RoomCard
                  key={room.idphong}
                  room={room}
                  onOpenDetail={handleOpenDetail}
                  onBook={handleSelectRoom}
                  bookButtonText="Chọn phòng"
                />
              ))}
            </div>
          </Col>

          {/* Sidebar */}
          <Col xs={24} lg={8}>
            <Card style={{ position: "sticky", top: 24 }}>
              <Title level={4}>Tóm tắt về đặt phòng</Title>
              <Divider />
              {Array.from({ length: totalRooms }, (_, i) => {
                const selected = selectedRooms.find(
                  (sr) => sr.roomNumber === i + 1
                );
                return (
                  <div key={i} style={{ marginBottom: 16 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <Text strong>Phòng {i + 1}</Text>
                      {selected && (
                        <Text>
                          {(selected.room.giaCoBanMotDem || 0).toLocaleString()}
                          đ
                        </Text>
                      )}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Text type="secondary">
                        <UserOutlined /> 1 người lớn
                      </Text>
                      {selected && (
                        <Button
                          type="link"
                          danger
                          onClick={() => handleRemoveRoom(i + 1)}
                        >
                          Xóa
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
              <Divider />
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Text strong>Tổng chi phí của lần lưu trú:</Text>
                <Text strong>{calculateTotal().toLocaleString()}đ</Text>
              </div>
            </Card>
          </Col>
        </Row>

        <DetailRoom
          visible={detailVisible}
          room={selectedForDetail}
          onClose={handleCloseDetail}
          onBook={handleSelectRoom}
        />
      </Content>
    </Layout>
  );
};

export default SelectRoomPage;
