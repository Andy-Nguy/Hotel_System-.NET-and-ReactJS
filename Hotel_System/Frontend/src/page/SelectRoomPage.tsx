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
  message,
} from "antd";
import { CheckCircleOutlined, UserOutlined } from "@ant-design/icons";
import RoomCard from "../components/Room/RoomCard";
import DetailRoom from "../components/Room/DetailRoom";
import BookingProgress from "../components/BookingProgress";
import ServicesSelector from "../components/ServicesSelector";

const { Content } = Layout;
const { Title, Text } = Typography;

interface SelectedRoom {
  roomNumber: number;
  room: any;
}

interface SelectedService {
  serviceId: string;
  serviceName: string;
  price: number;
  quantity: number;
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
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>(
    []
  );
  const [servicesTotal, setServicesTotal] = useState(0);
  const [selectionComplete, setSelectionComplete] = useState(false);
  const [extraSelectAlert, setExtraSelectAlert] = useState<string | null>(null);

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
        // Log chi tiết từng phòng để kiểm tra giá khuyến mãi
        parsed.forEach((room: any, index: number) => {
          console.log(`Room ${index + 1}:`, {
            tenPhong: room.tenPhong,
            giaCoBanMotDem: room.giaCoBanMotDem,
            basePricePerNight: room.basePricePerNight,
            discountedPrice: room.discountedPrice,
            promotionName: room.promotionName,
            discountPercent: room.discountPercent,
          });
        });
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

  // auto hide inline alert after a short time (kept here so hooks order stable)
  React.useEffect(() => {
    if (!extraSelectAlert) return;
    const t = setTimeout(() => setExtraSelectAlert(null), 5000);
    return () => clearTimeout(t);
  }, [extraSelectAlert]);

  const handleSelectRoom = (room: any) => {
    // Kiểm tra xem phòng đã được chọn chưa
    const alreadySelected = selectedRooms.some(
      (sr) => sr.room.idphong === room.idphong
    );

    // If the room is already selected, notify user
    if (alreadySelected) {
      message.info("Phòng này đã được chọn!");
      return;
    }

    // Prevent selecting additional rooms when user already selected the maximum allowed
    if (selectedRooms.length >= totalRooms) {
      const txt =
        "Bạn đã chọn đủ số phòng rồi. Xóa phòng hiện tại để chọn phòng khác.";
      // show toast
      message.warning(txt);
      // show inline alert banner for stronger visibility
      setExtraSelectAlert(txt);
      return;
    }

    // Thêm phòng vào danh sách đã chọn
    const newSelectedRooms = [
      ...selectedRooms,
      { roomNumber: currentRoomNumber, room },
    ];
    setSelectedRooms(newSelectedRooms);

    // Nếu đã chọn đủ số phòng, đánh dấu hoàn tất nhưng không chuyển ngay —
    // cho phép người dùng chọn dịch vụ hoặc bấm Thanh toán để tiếp tục.
    if (newSelectedRooms.length >= totalRooms) {
      setSelectionComplete(true);
      // keep currentRoomNumber at last room for review
      setCurrentRoomNumber(totalRooms);
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
    // Update completion flag if user removed a room
    setSelectionComplete(newSelectedRooms.length >= totalRooms);
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
          selectedServices,
          servicesTotal,
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

  const handleProceedToCheckout = () => {
    // Only allow when selectionComplete is true
    if (!selectionComplete || selectedRooms.length < totalRooms) return;
    sessionStorage.setItem(
      "bookingInfo",
      JSON.stringify({
        selectedRooms,
        selectedServices,
        servicesTotal,
        checkIn,
        checkOut,
        guests,
        totalRooms,
      })
    );
    window.location.href = "/checkout";
  };

  const calculateTotal = () => {
    if (!selectedRooms) return 0;

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const nights = Math.ceil(
      (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const totalPrice = selectedRooms.reduce((sum, sr) => {
      // Sử dụng giá sau khuyến mãi nếu có, nếu không thì dùng giá cơ bản
      const price =
        sr.room.discountedPrice &&
        sr.room.discountedPrice < sr.room.basePricePerNight
          ? sr.room.discountedPrice
          : sr.room.basePricePerNight || sr.room.giaCoBanMotDem;
      return sum + (price || 0) * nights;
    }, 0);

    return totalPrice;
  };

  const handleServicesChange = (services: SelectedService[], total: number) => {
    setSelectedServices(services);
    setServicesTotal(total);
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

        {extraSelectAlert && (
          <div style={{ marginTop: 12 }}>
            <Alert
              type="warning"
              message={extraSelectAlert}
              showIcon
              closable
              onClose={() => setExtraSelectAlert(null)}
            />
          </div>
        )}

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
                        <div style={{ textAlign: "right" }}>
                          {selected.room.discountedPrice &&
                          selected.room.discountedPrice <
                            (selected.room.basePricePerNight ||
                              selected.room.giaCoBanMotDem) ? (
                            <>
                              <Text
                                delete
                                type="secondary"
                                style={{ fontSize: "12px" }}
                              >
                                {(
                                  selected.room.basePricePerNight ||
                                  selected.room.giaCoBanMotDem ||
                                  0
                                ).toLocaleString()}
                                đ
                              </Text>
                              <br />
                              <Text strong style={{ color: "#dfa974" }}>
                                {(
                                  selected.room.discountedPrice || 0
                                ).toLocaleString()}
                                đ
                              </Text>
                            </>
                          ) : (
                            <Text>
                              {(
                                selected.room.basePricePerNight ||
                                selected.room.giaCoBanMotDem ||
                                0
                              ).toLocaleString()}
                              đ
                            </Text>
                          )}
                        </div>
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

              {/* Services Selector */}
              <ServicesSelector onServicesChange={handleServicesChange} />

              <Divider />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <Text strong>Tiền phòng:</Text>
                <Text strong>{calculateTotal().toLocaleString()}đ</Text>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <Text strong>Tiền dịch vụ:</Text>
                <Text strong>{servicesTotal.toLocaleString()}đ</Text>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: 12,
                  background: "#f5f5f5",
                  borderRadius: 6,
                }}
              >
                <Text strong style={{ fontSize: 16 }}>
                  Tổng chi phí:
                </Text>
                <Text strong style={{ fontSize: 16, color: "#dfa974" }}>
                  {(calculateTotal() + servicesTotal).toLocaleString()}đ
                </Text>
              </div>
              <div style={{ marginTop: 12 }}>
                <Button
                  type="primary"
                  block
                  disabled={selectedRooms.length < totalRooms}
                  onClick={handleProceedToCheckout}
                >
                  Thanh toán
                </Button>
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
