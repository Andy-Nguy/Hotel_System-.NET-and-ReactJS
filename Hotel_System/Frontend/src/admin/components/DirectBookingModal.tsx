import React, { useState, useEffect } from "react";
import {
  Modal,
  Form,
  DatePicker,
  Button,
  Steps,
  Card,
  Row,
  Col,
  Space,
  Empty,
  Spin,
  Alert,
  Input,
  Select,
  message,
  Divider,
  InputNumber,
} from "antd";
import {
  SearchOutlined,
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  EnvironmentOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { API_CONFIG } from "../../api/config";
import * as serviceApi from "../../api/serviceApi";

const API_BASE = `${API_CONFIG.CURRENT}/api`;

interface DirectBookingModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface SelectedRoom {
  roomNumber: number;
  room: any;
}

interface SelectedService {
  serviceId: string;
  serviceName: string;
  servicePrice: number;
  quantity: number;
}

type StepType =
  | "search"
  | "selectRoom"
  | "selectServices"
  | "checkout"
  | "payment";

const DirectBookingModal: React.FC<DirectBookingModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<StepType>("search");
  const [loading, setLoading] = useState(false);
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);
  const [selectedRooms, setSelectedRooms] = useState<SelectedRoom[]>([]);
  const [availableServices, setAvailableServices] = useState<any[]>([]);
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>(
    []
  );
  const [searchParams, setSearchParams] = useState({
    checkIn: dayjs().add(0, "days"),
    checkOut: dayjs().add(1, "days"),
    guests: 1,
  });
  const [error, setError] = useState<string | null>(null);
  const [customerInfo, setCustomerInfo] = useState({
    tenKhachHang: "",
    soDienThoai: "",
    email: "",
    diaChi: "",
  });

  const handleSearch = async () => {
    setError(null);
    setLoading(true);
    try {
      // Convert dayjs to YYYY-MM-DD string format first, then to Date (avoids timezone issues)
      const checkInStr = searchParams.checkIn.format("YYYY-MM-DD");
      const checkOutStr = searchParams.checkOut.format("YYYY-MM-DD");

      const checkInDate = new Date(checkInStr);
      const checkOutDate = new Date(checkOutStr);

      if (checkInDate >= checkOutDate) {
        setError("Ngày đến phải trước ngày đi.");
        setLoading(false);
        return;
      }

      const body = {
        CheckIn: checkInDate.toISOString(),
        CheckOut: checkOutDate.toISOString(),
        NumberOfGuests: searchParams.guests,
      };

      const res = await fetch(`${API_BASE}/Phong/check-available-rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.message || `HTTP ${res.status}`);
      }

      const json = await res.json();

      if (!Array.isArray(json)) {
        if (json && json.message) {
          setError(json.message);
          setAvailableRooms([]);
        } else {
          setError("Không có phòng phù hợp.");
          setAvailableRooms([]);
        }
      } else {
        // Normalize API response
        const normalize = (r: any) => {
          const roomTypeName = r.roomTypeName ?? r.RoomTypeName;
          const roomNumberOrId =
            r.roomNumber ?? r.RoomNumber ?? r.roomId ?? r.RoomId;
          const composedName =
            roomTypeName && roomNumberOrId
              ? `${roomTypeName} ${roomNumberOrId}`
              : roomTypeName ??
                (roomNumberOrId ? `Phòng ${roomNumberOrId}` : undefined);

          return {
            idphong:
              r.roomId ?? r.RoomId ?? r.idphong ?? String(roomNumberOrId ?? ""),
            idloaiPhong: r.idloaiPhong ?? null,
            tenPhong: composedName,
            tenLoaiPhong: roomTypeName,
            soPhong: r.roomNumber ?? r.RoomNumber ?? r.roomId ?? r.RoomId,
            moTa: r.description ?? r.Description,
            soNguoiToiDa: r.maxOccupancy ?? r.MaxOccupancy,
            giaCoBanMotDem: r.basePricePerNight ?? r.BasePricePerNight,
            basePricePerNight: r.basePricePerNight ?? r.BasePricePerNight,
            discountedPrice: r.discountedPrice ?? r.DiscountedPrice,
            promotionName: r.promotionName ?? r.PromotionName,
            discountPercent: r.discountPercent ?? r.DiscountPercent,
            urlAnhPhong:
              r.roomImageUrls ??
              r.RoomImageUrls ??
              r.roomImageUrl ??
              r.RoomImageUrl,
            __raw: r,
          };
        };

        const normalized = json.map(normalize);
        setAvailableRooms(normalized);
        if (normalized.length > 0) {
          setStep("selectRoom");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi khi tìm kiếm phòng");
      setAvailableRooms([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRoom = (room: any) => {
    const exists = selectedRooms.find((sr) => sr.room.idphong === room.idphong);
    if (!exists) {
      setSelectedRooms([
        ...selectedRooms,
        { roomNumber: selectedRooms.length + 1, room },
      ]);
    }
  };

  const handleRemoveRoom = (idphong: string) => {
    setSelectedRooms(
      selectedRooms
        .filter((sr) => sr.room.idphong !== idphong)
        .map((sr, idx) => ({ roomNumber: idx + 1, room: sr.room }))
    );
  };

  const handleSelectService = (service: any) => {
    const exists = selectedServices.find(
      (ss) => ss.serviceId === service.iddichVu
    );
    if (!exists) {
      setSelectedServices([
        ...selectedServices,
        {
          serviceId: service.iddichVu,
          serviceName: service.tenDichVu,
          servicePrice: service.tienDichVu || 0,
          quantity: 1,
        },
      ]);
    }
  };

  const handleUpdateServiceQuantity = (serviceId: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveService(serviceId);
      return;
    }
    setSelectedServices(
      selectedServices.map((ss) =>
        ss.serviceId === serviceId ? { ...ss, quantity } : ss
      )
    );
  };
  const handleRemoveService = (serviceId: string) => {
    setSelectedServices(
      selectedServices.filter((ss) => ss.serviceId !== serviceId)
    );
  };

  const handleProceedToCheckout = () => {
    if (selectedRooms.length === 0) {
      message.error("Vui lòng chọn ít nhất một phòng");
      return;
    }
    setStep("selectServices");
  };

  // Fetch available services when modal opens
  useEffect(() => {
    if (visible && step === "selectServices") {
      const loadServices = async () => {
        try {
          const services = await serviceApi.getServices();
          setAvailableServices(services || []);
        } catch (err) {
          console.error("Failed to load services:", err);
          setAvailableServices([]);
        }
      };
      loadServices();
    }
  }, [visible, step]);

  const handleCheckoutSubmit = async () => {
    if (
      !customerInfo.tenKhachHang ||
      !customerInfo.soDienThoai ||
      !customerInfo.email
    ) {
      message.error("Vui lòng điền đủ thông tin khách hàng");
      return;
    }

    setLoading(true);
    try {
      // Convert dayjs to YYYY-MM-DD string format first, then to Date (avoids timezone issues)
      const checkInStr = searchParams.checkIn.format("YYYY-MM-DD");
      const checkOutStr = searchParams.checkOut.format("YYYY-MM-DD");

      const checkInDate = new Date(checkInStr);
      const checkOutDate = new Date(checkOutStr);

      // Tính số đêm
      const nights = Math.ceil(
        (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Tính tổng tiền (bao gồm cả dịch vụ)
      let subtotal = 0;
      selectedRooms.forEach((sr) => {
        const roomPrice = sr.room.discountedPrice ?? sr.room.giaCoBanMotDem;
        subtotal += roomPrice * nights;
      });
      selectedServices.forEach((ss) => {
        subtotal += ss.servicePrice * ss.quantity;
      });

      // Tính thuế 10% (theo flow backend)
      const vat = subtotal * 0.1;
      const totalAmount = subtotal + vat;

      const body = {
        hoTen: customerInfo.tenKhachHang,
        soDienThoai: customerInfo.soDienThoai,
        email: customerInfo.email,
        diaChi: customerInfo.diaChi,
        ngayNhanPhong: checkInStr,
        ngayTraPhong: checkOutStr,
        soLuongKhach: searchParams.guests,
        rooms: selectedRooms.map((sr) => ({
          idPhong: sr.room.idphong,
          soPhong: parseInt(sr.room.soPhong) || 0,
          giaCoBanMotDem: sr.room.discountedPrice ?? sr.room.giaCoBanMotDem,
        })),
        ghiChu: "", // Dịch vụ sẽ được lưu qua hóa đơn, không lưu vào đây
        isDirectBooking: true, // Đặt phòng trực tiếp
        trangThaiThanhToan: 0, // Mặc định = 0 (cọc), sẽ cập nhật sau khi thanh toán
      };

      const res = await fetch(`${API_BASE}/datphong/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.message || `HTTP ${res.status}`);
      }

      const booking = await res.json();
      // Store for payment - booking.data contains the actual response
      const bookingId =
        booking.data?.idDatPhong || booking.idDatPhong || booking.id;
      if (!bookingId) {
        throw new Error("Không thể lấy ID đặt phòng từ server");
      }
      sessionStorage.setItem(
        "directBookingInfo",
        JSON.stringify({
          idDatPhong: bookingId,
          totalAmount,
          nights,
          customerInfo,
        })
      );

      setStep("payment");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi khi tạo đặt phòng");
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSubmit = async (paymentMethod: string) => {
    setLoading(true);
    try {
      const bookingData = sessionStorage.getItem("directBookingInfo");
      if (!bookingData) {
        throw new Error("Không tìm thấy thông tin đặt phòng");
      }

      const { idDatPhong, totalAmount } = JSON.parse(bookingData);

      // Convert payment method to backend enum:
      // 1 = Tiền mặt khi đến
      // 2 = Thanh toán online (VNPay, Momo, thẻ ngân hàng, ví điện tử)
      // 3 = Thanh toán tại quầy
      const phuongThucThanhToan = paymentMethod === "cash" ? 1 : 2;
      const trangThaiThanhToan = paymentMethod === "cash" ? 2 : 1;

      // Map services to backend DTO format
      const servicesPayload = selectedServices.map((ss) => ({
        IddichVu: ss.serviceId,
        SoLuong: ss.quantity,
        DonGia: ss.servicePrice || 0,
        TienDichVu: (ss.servicePrice || 0) * ss.quantity,
        Idphong: selectedRooms[0]?.room?.idphong || null,
        SoPhong: selectedRooms[0]?.room?.soPhong
          ? parseInt(selectedRooms[0].room.soPhong)
          : null,
      }));

      const body = {
        IDDatPhong: idDatPhong,
        TongTien: totalAmount,
        PhuongThucThanhToan: phuongThucThanhToan,
        TrangThaiThanhToan: trangThaiThanhToan,
        Services: servicesPayload,
        GhiChu: "", // Services sẽ được lưu vào bảng CTHDDV thay vì ghi chú
      };

      const res = await fetch(`${API_BASE}/Payment/hoa-don`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.message || `HTTP ${res.status}`);
      }

      message.success("Thanh toán thành công! Đặt phòng đã được xác nhận.");
      sessionStorage.removeItem("directBookingInfo");
      setStep("search");
      setSelectedRooms([]);
      setSelectedServices([]);
      setCustomerInfo({
        tenKhachHang: "",
        soDienThoai: "",
        email: "",
        diaChi: "",
      });
      onClose();
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi khi xử lý thanh toán");
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () => {
    // Convert dayjs to YYYY-MM-DD string format first, then to Date (avoids timezone issues)
    const checkInStr = searchParams.checkIn.format("YYYY-MM-DD");
    const checkOutStr = searchParams.checkOut.format("YYYY-MM-DD");

    const checkInDate = new Date(checkInStr);
    const checkOutDate = new Date(checkOutStr);
    const nights = Math.ceil(
      (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    let total = 0;
    // Add room costs
    selectedRooms.forEach((sr) => {
      const roomPrice = sr.room.discountedPrice ?? sr.room.giaCoBanMotDem;
      total += roomPrice * nights;
    });
    // Add service costs
    selectedServices.forEach((ss) => {
      total += ss.servicePrice * ss.quantity;
    });
    return total;
  };

  const calculatePriceBreakdown = () => {
    const subtotal = calculateTotal();
    const vat = Math.round(subtotal * 0.1);
    const totalWithVat = subtotal + vat;
    return { subtotal, vat, totalWithVat };
  };

  const renderSearchStep = () => (
    <div>
      <h3 style={{ marginBottom: "16px" }}>Tìm kiếm phòng trống</h3>
      <Space direction="vertical" style={{ width: "100%" }}>
        <Form layout="vertical">
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item label="Ngày đến">
                <DatePicker
                  value={searchParams.checkIn}
                  onChange={(date) =>
                    setSearchParams({ ...searchParams, checkIn: date! })
                  }
                  disabledDate={(current) =>
                    current && current < dayjs().startOf("day")
                  }
                  style={{ width: "100%" }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item label="Ngày đi">
                <DatePicker
                  value={searchParams.checkOut}
                  onChange={(date) =>
                    setSearchParams({ ...searchParams, checkOut: date! })
                  }
                  disabledDate={(current) =>
                    current && current <= searchParams.checkIn.startOf("day")
                  }
                  style={{ width: "100%" }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item label="Số khách">
                <Select
                  value={searchParams.guests}
                  onChange={(value) =>
                    setSearchParams({ ...searchParams, guests: value })
                  }
                  options={[1, 2, 3, 4, 5, 6].map((n) => ({
                    label: `${n} khách`,
                    value: n,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>

        <Button
          type="primary"
          icon={<SearchOutlined />}
          onClick={handleSearch}
          loading={loading}
          block
        >
          Tìm kiếm phòng
        </Button>

        {error && (
          <Alert
            message="Lỗi"
            description={error}
            type="error"
            closable
            onClose={() => setError(null)}
          />
        )}
      </Space>
    </div>
  );

  const renderSelectRoomStep = () => (
    <div>
      <h3 style={{ marginBottom: "16px" }}>
        Chọn phòng ({selectedRooms.length} phòng được chọn)
      </h3>

      {availableRooms.length === 0 ? (
        <Empty
          description="Không có phòng trống"
          style={{ marginTop: "20px" }}
        />
      ) : (
        <Row gutter={[16, 16]} style={{ marginBottom: "16px" }}>
          {availableRooms.map((room) => (
            <Col key={room.idphong} xs={24} sm={12} md={8}>
              <Card
                hoverable
                onClick={() => handleSelectRoom(room)}
                style={{
                  border: selectedRooms.some(
                    (sr) => sr.room.idphong === room.idphong
                  )
                    ? "2px solid #1890ff"
                    : "1px solid #d9d9d9",
                }}
              >
                {selectedRooms.some(
                  (sr) => sr.room.idphong === room.idphong
                ) && (
                  <div
                    style={{
                      position: "absolute",
                      top: 10,
                      right: 10,
                      background: "#1890ff",
                      color: "white",
                      borderRadius: "50%",
                      width: 24,
                      height: 24,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "12px",
                      fontWeight: "bold",
                    }}
                  >
                    ✓
                  </div>
                )}
                <h4>{room.tenPhong}</h4>
                <p style={{ margin: "8px 0", color: "#666" }}>{room.moTa}</p>
                <Divider style={{ margin: "8px 0" }} />
                <div style={{ textAlign: "right" }}>
                  {room.discountedPrice ? (
                    <>
                      <span
                        style={{
                          textDecoration: "line-through",
                          color: "#999",
                          marginRight: "8px",
                        }}
                      >
                        {room.giaCoBanMotDem.toLocaleString("vi-VN")}₫
                      </span>
                      <span style={{ color: "#ff4d4f", fontWeight: "bold" }}>
                        {room.discountedPrice.toLocaleString("vi-VN")}₫
                      </span>
                    </>
                  ) : (
                    <span style={{ color: "#1890ff", fontWeight: "bold" }}>
                      {room.giaCoBanMotDem.toLocaleString("vi-VN")}₫
                    </span>
                  )}
                  <span style={{ color: "#999", marginLeft: "8px" }}>/đêm</span>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {selectedRooms.length > 0 && (
        <div>
          <h4 style={{ marginTop: "20px", marginBottom: "12px" }}>
            Phòng được chọn:
          </h4>
          <Space direction="vertical" style={{ width: "100%" }}>
            {selectedRooms.map((sr) => (
              <Card key={sr.room.idphong} size="small">
                <Row justify="space-between" align="middle">
                  <Col>{sr.room.tenPhong}</Col>
                  <Col>
                    <Button
                      danger
                      size="small"
                      onClick={() => handleRemoveRoom(sr.room.idphong)}
                    >
                      Xóa
                    </Button>
                  </Col>
                </Row>
              </Card>
            ))}
          </Space>
        </div>
      )}

      <Space style={{ marginTop: "20px", width: "100%" }}>
        <Button onClick={() => setStep("search")}>Quay lại</Button>
        <Button
          type="primary"
          onClick={handleProceedToCheckout}
          disabled={selectedRooms.length === 0}
        >
          Tiếp tục chọn dịch vụ
        </Button>
      </Space>
    </div>
  );

  const renderSelectServicesStep = () => (
    <div>
      <h3 style={{ marginBottom: "16px" }}>
        Chọn dịch vụ ({selectedServices.length} dịch vụ được chọn)
      </h3>

      {availableServices.length === 0 ? (
        <Empty
          description="Không có dịch vụ nào"
          style={{ marginTop: "20px" }}
        />
      ) : (
        <Row gutter={[16, 16]} style={{ marginBottom: "16px" }}>
          {availableServices.map((service) => (
            <Col key={service.iddichVu} xs={24} sm={12} md={8}>
              <Card
                hoverable
                onClick={() => handleSelectService(service)}
                style={{
                  border: selectedServices.some(
                    (ss) => ss.serviceId === service.iddichVu
                  )
                    ? "2px solid #1890ff"
                    : "1px solid #d9d9d9",
                }}
              >
                {selectedServices.some(
                  (ss) => ss.serviceId === service.iddichVu
                ) && (
                  <div
                    style={{
                      position: "absolute",
                      top: 10,
                      right: 10,
                      background: "#1890ff",
                      color: "white",
                      borderRadius: "50%",
                      width: 24,
                      height: 24,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "12px",
                      fontWeight: "bold",
                    }}
                  >
                    ✓
                  </div>
                )}
                {service.hinhDichVu && (
                  <div
                    style={{
                      width: "100%",
                      height: "150px",
                      marginBottom: "12px",
                      overflow: "hidden",
                      borderRadius: "4px",
                    }}
                  >
                    <img
                      src={service.hinhDichVu}
                      alt={service.tenDichVu}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  </div>
                )}
                <h4>{service.tenDichVu}</h4>
                {service.thongTinDv && (
                  <p
                    style={{ margin: "8px 0", color: "#666", fontSize: "12px" }}
                  >
                    {service.thongTinDv}
                  </p>
                )}
                <Divider style={{ margin: "8px 0" }} />
                <div style={{ textAlign: "right" }}>
                  <span style={{ color: "#1890ff", fontWeight: "bold" }}>
                    {(service.tienDichVu || 0).toLocaleString("vi-VN")}₫
                  </span>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {selectedServices.length > 0 && (
        <div>
          <h4 style={{ marginTop: "20px", marginBottom: "12px" }}>
            Dịch vụ được chọn:
          </h4>
          <Space direction="vertical" style={{ width: "100%" }}>
            {selectedServices.map((ss) => (
              <Card key={ss.serviceId} size="small">
                <Row justify="space-between" align="middle">
                  <Col flex={1}>
                    <div>
                      <strong>{ss.serviceName}</strong>
                      <div style={{ color: "#999", fontSize: "12px" }}>
                        {ss.servicePrice.toLocaleString("vi-VN")}₫ x{" "}
                        <InputNumber
                          min={1}
                          value={ss.quantity}
                          onChange={(val) =>
                            handleUpdateServiceQuantity(ss.serviceId, val || 1)
                          }
                          style={{ width: "60px" }}
                          size="small"
                        />{" "}
                        ={" "}
                        {(ss.servicePrice * ss.quantity).toLocaleString(
                          "vi-VN"
                        )}
                        ₫
                      </div>
                    </div>
                  </Col>
                  <Col>
                    <Button
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => handleRemoveService(ss.serviceId)}
                    />
                  </Col>
                </Row>
              </Card>
            ))}
          </Space>
        </div>
      )}

      <Space style={{ marginTop: "20px", width: "100%" }}>
        <Button onClick={() => setStep("selectRoom")}>Quay lại</Button>
        <Button type="primary" onClick={() => setStep("checkout")}>
          Tiếp tục đến thông tin khách hàng
        </Button>
      </Space>
    </div>
  );

  const renderCheckoutStep = () => (
    <div>
      <h3 style={{ marginBottom: "16px" }}>Thông tin khách hàng</h3>

      <Form layout="vertical">
        <Form.Item
          label="Tên khách hàng"
          required
          rules={[{ required: true, message: "Vui lòng nhập tên" }]}
        >
          <Input
            value={customerInfo.tenKhachHang}
            onChange={(e) =>
              setCustomerInfo({
                ...customerInfo,
                tenKhachHang: e.target.value,
              })
            }
            prefix={<UserOutlined />}
            placeholder="Nhập tên khách hàng"
          />
        </Form.Item>

        <Form.Item
          label="Số điện thoại"
          required
          rules={[{ required: true, message: "Vui lòng nhập số điện thoại" }]}
        >
          <Input
            value={customerInfo.soDienThoai}
            onChange={(e) =>
              setCustomerInfo({
                ...customerInfo,
                soDienThoai: e.target.value,
              })
            }
            prefix={<PhoneOutlined />}
            placeholder="Nhập số điện thoại"
          />
        </Form.Item>

        <Form.Item
          label="Email"
          required
          rules={[{ required: true, message: "Vui lòng nhập email" }]}
        >
          <Input
            value={customerInfo.email}
            onChange={(e) =>
              setCustomerInfo({ ...customerInfo, email: e.target.value })
            }
            prefix={<MailOutlined />}
            placeholder="Nhập email"
            type="email"
          />
        </Form.Item>

        <Form.Item label="Địa chỉ">
          <Input
            value={customerInfo.diaChi}
            onChange={(e) =>
              setCustomerInfo({ ...customerInfo, diaChi: e.target.value })
            }
            prefix={<EnvironmentOutlined />}
            placeholder="Nhập địa chỉ (tùy chọn)"
          />
        </Form.Item>
      </Form>

      <Card style={{ marginTop: "16px", background: "#f5f5f5" }}>
        <Row justify="space-between" style={{ marginBottom: "8px" }}>
          <span>Phòng:</span>
          <span>{selectedRooms.length}</span>
        </Row>
        <Row justify="space-between" style={{ marginBottom: "8px" }}>
          <span>Ngày đến:</span>
          <span>{searchParams.checkIn.format("DD/MM/YYYY")}</span>
        </Row>
        <Row justify="space-between" style={{ marginBottom: "8px" }}>
          <span>Ngày đi:</span>
          <span>{searchParams.checkOut.format("DD/MM/YYYY")}</span>
        </Row>
        {selectedServices.length > 0 && (
          <>
            <Divider style={{ margin: "8px 0" }} />
            <Row justify="space-between" style={{ marginBottom: "8px" }}>
              <span>Dịch vụ:</span>
              <span>{selectedServices.length}</span>
            </Row>
            {selectedServices.map((ss) => (
              <Row
                key={ss.serviceId}
                justify="space-between"
                style={{ marginBottom: "4px", fontSize: "12px", color: "#666" }}
              >
                <span>
                  • {ss.serviceName} x{ss.quantity}
                </span>
                <span>
                  {(ss.servicePrice * ss.quantity).toLocaleString("vi-VN")}₫
                </span>
              </Row>
            ))}
          </>
        )}
        <Divider style={{ margin: "8px 0" }} />
        <Row
          justify="space-between"
          style={{ fontSize: "14px", color: "#666", marginBottom: "4px" }}
        >
          <span>Tạm tính:</span>
          <span>
            {calculatePriceBreakdown().subtotal.toLocaleString("vi-VN")}₫
          </span>
        </Row>
        <Row
          justify="space-between"
          style={{ fontSize: "14px", color: "#666", marginBottom: "8px" }}
        >
          <span>Thuế VAT (10%):</span>
          <span>{calculatePriceBreakdown().vat.toLocaleString("vi-VN")}₫</span>
        </Row>
        <Row
          justify="space-between"
          style={{ fontSize: "16px", fontWeight: "bold" }}
        >
          <span>Tổng cộng:</span>
          <span style={{ color: "#ff4d4f" }}>
            {calculatePriceBreakdown().totalWithVat.toLocaleString("vi-VN")}₫
          </span>
        </Row>
      </Card>

      {error && (
        <Alert
          message="Lỗi"
          description={error}
          type="error"
          closable
          onClose={() => setError(null)}
          style={{ marginTop: "16px" }}
        />
      )}

      <Space style={{ marginTop: "20px", width: "100%" }}>
        <Button onClick={() => setStep("selectServices")}>Quay lại</Button>
        <Button type="primary" onClick={handleCheckoutSubmit} loading={loading}>
          Tiếp tục đến thanh toán
        </Button>
      </Space>
    </div>
  );

  const renderPaymentStep = () => (
    <div>
      <h3 style={{ marginBottom: "16px" }}>Chọn phương thức thanh toán</h3>

      <Spin spinning={loading}>
        <Space direction="vertical" style={{ width: "100%" }}>
          <Card
            hoverable
            onClick={() => handlePaymentSubmit("cash")}
            style={{ cursor: "pointer" }}
          >
            <Row align="middle">
              <Col flex={1}>
                <h4 style={{ margin: 0 }}>💵 Thanh toán tiền mặt</h4>
                <p style={{ color: "#999", margin: "4px 0 0 0" }}>
                  Thanh toán trực tiếp tại quầy
                </p>
              </Col>
            </Row>
          </Card>

          <Card
            hoverable
            onClick={() => handlePaymentSubmit("online")}
            style={{ cursor: "pointer" }}
          >
            <Row align="middle">
              <Col flex={1}>
                <h4 style={{ margin: 0 }}>💳 Thanh toán online</h4>
                <p style={{ color: "#999", margin: "4px 0 0 0" }}>
                  Qua thẻ ngân hàng hoặc ví điện tử
                </p>
              </Col>
            </Row>
          </Card>

          {error && (
            <Alert
              message="Lỗi"
              description={error}
              type="error"
              closable
              onClose={() => setError(null)}
            />
          )}

          <Button onClick={() => setStep("checkout")}>Quay lại</Button>
        </Space>
      </Spin>
    </div>
  );

  const stepMap: Record<StepType, number> = {
    search: 0,
    selectRoom: 1,
    selectServices: 2,
    checkout: 3,
    payment: 4,
  };

  return (
    <Modal
      title="Đặt phòng trực tiếp"
      visible={visible}
      onCancel={onClose}
      footer={null}
      width={900}
      destroyOnClose
    >
      <Steps
        current={stepMap[step]}
        items={[
          { title: "Tìm kiếm", description: "Chọn ngày" },
          { title: "Chọn phòng", description: "Lựa chọn phòng" },
          { title: "Dịch vụ", description: "Chọn dịch vụ" },
          { title: "Thông tin", description: "Khách hàng" },
          { title: "Thanh toán", description: "Hoàn tất" },
        ]}
        style={{ marginBottom: "24px" }}
      />

      <Spin spinning={loading && step !== "payment"}>
        {step === "search" && renderSearchStep()}
        {step === "selectRoom" && renderSelectRoomStep()}
        {step === "selectServices" && renderSelectServicesStep()}
        {step === "checkout" && renderCheckoutStep()}
        {step === "payment" && renderPaymentStep()}
      </Spin>
    </Modal>
  );
};

export default DirectBookingModal;
