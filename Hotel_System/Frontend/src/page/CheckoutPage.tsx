import React, { useEffect, useState } from "react";
import { API_CONFIG } from "../api/config";

// Use centralized API config
const API_BASE = `${API_CONFIG.CURRENT}/api`;
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import duration from "dayjs/plugin/duration";
dayjs.extend(relativeTime);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(duration);
import {
  Layout,
  Card,
  Typography,
  Row,
  Col,
  Button,
  Form,
  Input,
  Divider,
  Alert,
  Modal,
  Carousel,
} from "antd";
import {
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  HomeOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  InfoCircleOutlined,
  EnvironmentOutlined,
} from "@ant-design/icons";
import BookingProgress from "../components/BookingProgress";

// Local image resolver (keeps behavior consistent with other components)
function resolveImageUrl(u: any, fallback = '/img/room/default.webp') {
  if (u == null) return fallback;
  if (Array.isArray(u)) {
    const first = u.find((x: any) => !!x);
    return resolveImageUrl(first, fallback);
  }
  if (typeof u === 'object') {
    const candidate = (u && (u.u || u.url || u.src || u.urlAnhPhong)) || null;
    return resolveImageUrl(candidate, fallback);
  }
  let s = String(u).trim();
  if (!s) return fallback;
  if (s.startsWith('[')) {
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr) && arr.length > 0) return resolveImageUrl(arr[0], fallback);
    } catch (e) {}
  }
  if (s.includes(',') || s.includes(';') || s.includes('|')) {
    const first = s.split(/[,|;]+/)[0].trim();
    return resolveImageUrl(first, fallback);
  }
  if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('//')) return s;
  if (s.startsWith('/img') || s.startsWith('/')) return s;
  return `/img/room/${s}`;
}

// Resolver for service images (folder is /img/services)
function resolveServiceImageUrl(u: any, fallback = '/img/services/default.webp') {
  if (u == null) return fallback;
  if (Array.isArray(u)) {
    const first = u.find((x: any) => !!x);
    return resolveServiceImageUrl(first, fallback);
  }
  if (typeof u === 'object') {
    const candidate = (u && (u.HinhDichVu || u.hinhDichVu || u.url || u.u || u.src)) || null;
    return resolveServiceImageUrl(candidate, fallback);
  }
  let s = String(u).trim();
  if (!s) return fallback;
  // If JSON array string, parse and use first
  if (s.startsWith('[')) {
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr) && arr.length > 0) return resolveServiceImageUrl(arr[0], fallback);
    } catch (e) {}
  }
  if (s.includes(',') || s.includes(';') || s.includes('|')) {
    const first = s.split(/[,|;]+/)[0].trim();
    return resolveServiceImageUrl(first, fallback);
  }
  if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('//')) return s;
  if (s.startsWith('/img') || s.startsWith('/')) return s;
  // encode filename to handle spaces
  return encodeURI(`/img/services/${s}`);
}

const { Content } = Layout;
const { Title, Text } = Typography;
const { TextArea } = Input;

interface SelectedRoom {
  roomNumber: number;
  room: any;
}

interface BookingInfo {
  selectedRooms: SelectedRoom[];
  checkIn: string;
  checkOut: string;
  guests: number;
  totalRooms: number;
  promotion?: {
    idkhuyenMai?: string;
    tenKhuyenMai?: string;
    loaiGiamGia?: string;
    giaTriGiam?: number;
  } | null;
  selectedServices?: any[];
  servicesTotal?: number;
}

const CheckoutPage: React.FC = () => {
  const [form] = Form.useForm();
  const [bookingInfo, setBookingInfo] = useState<BookingInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [holdExpiresAt, setHoldExpiresAt] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<string | null>(null);

  useEffect(() => {
    const bookingData = sessionStorage.getItem("bookingInfo");
    if (bookingData) {
      try {
        const parsed = JSON.parse(bookingData);
        setBookingInfo(parsed);
      } catch (e) {
        setError("Không thể tải thông tin đặt phòng");
      }
    } else {
      setError("Không tìm thấy thông tin đặt phòng. Vui lòng chọn phòng lại.");
    }
  }, []);

  useEffect(() => {
    const inv = sessionStorage.getItem("invoiceInfo");
    if (!inv) return;

    (async () => {
      try {
        const parsed = JSON.parse(inv);
        if (!parsed) return;

        if (parsed.idDatPhong && parsed.holdExpiresAt) {
          try {
            const res = await fetch(
              `${API_BASE}/datphong/${encodeURIComponent(parsed.idDatPhong)}`
            );
            if (res.ok) {
              setHoldExpiresAt(parsed.holdExpiresAt);
            } else {
              parsed.holdExpiresAt = null;
              sessionStorage.setItem("invoiceInfo", JSON.stringify(parsed));
            }
          } catch (e) {
            console.warn(
              "Could not verify booking existence, skipping hold display",
              e
            );
          }
        }
      } catch (e) {
        console.warn("Invalid invoiceInfo in sessionStorage", e);
      }
    })();
  }, []);

  useEffect(() => {
    if (!holdExpiresAt) {
      setCountdown(null);
      return;
    }

    const target = dayjs(holdExpiresAt).utc();
    const tick = () => {
      const now = dayjs().utc();
      const diffMs = target.diff(now);
      if (diffMs <= 0) {
        setCountdown("Hết hạn");
        const inv = sessionStorage.getItem("invoiceInfo");
        if (inv) {
          try {
            const p = JSON.parse(inv);
            p.holdExpiresAt = null;
            sessionStorage.setItem("invoiceInfo", JSON.stringify(p));
          } catch {}
        }
        return;
      }
      const dur = dayjs.duration(diffMs);
      const mm = String(Math.floor(dur.asMinutes())).padStart(2, "0");
      const ss = String(dur.seconds()).padStart(2, "0");
      setCountdown(`${mm}:${ss}`);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [holdExpiresAt]);

  const calculateTotal = () => {
    if (!bookingInfo) return 0;

    const checkInDate = new Date(bookingInfo.checkIn);
    const checkOutDate = new Date(bookingInfo.checkOut);
    const nights = Math.ceil(
      (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const totalPrice = bookingInfo.selectedRooms.reduce((sum, sr) => {
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

  const calculateNights = () => {
    if (!bookingInfo) return 0;
    const checkInDate = new Date(bookingInfo.checkIn);
    const checkOutDate = new Date(bookingInfo.checkOut);
    return Math.ceil(
      (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
    );
  };

  const handleSubmit = async (values: any) => {
    if (!bookingInfo) return;

    setLoading(true);
    try {
      const customerInfo = {
        hoTen: values.fullName,
        email: values.email,
        soDienThoai: values.phone,
        cmnd: values.idNumber,
        diaChi: values.address,
        ghiChu: values.notes,
      };

      // GỌI API TẠO BOOKING THẬT
     
      const roomsPayload = (bookingInfo.selectedRooms || []).map((sr) => {
        const r = sr.room || {};
        const idPhong =
          r.idphong ?? r.idPhong ?? r.id ?? r.roomId ?? String(sr.roomNumber);
        const gia = r.giaCoBanMotDem ?? r.GiaCoBanMotDem ?? r.gia ?? r.Gia ?? 0;
        return {
          IdPhong: String(idPhong),
          SoPhong: sr.roomNumber,
          GiaCoBanMotDem: Number(gia) || 0,
        };
      });

      const bookingPayload = {
        hoTen: values.fullName,
        email: values.email,
        soDienThoai: values.phone,
        ngayNhanPhong: bookingInfo.checkIn,
        ngayTraPhong: bookingInfo.checkOut,
        soLuongKhach: bookingInfo.guests,
        rooms: roomsPayload,
        ghiChu: values.notes,
      };

      const response = await fetch(`${API_BASE}/datphong/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Booking API Error:", errorText);
        throw new Error("Không thể tạo đặt phòng. Vui lòng thử lại!");
      }

      const result = await response.json();
      console.log("✅ Booking created:", result);

      if (!result.success || !result.data || !result.data.idDatPhong) {
        console.error("Booking API returned unexpected response:", result);
        throw new Error(
          result.message ||
            "Tạo đặt phòng thất bại (không có ID đặt phòng trả về)!"
        );
      }

      const invoiceInfo = {
        idDatPhong: result.data.idDatPhong,
        idKhachHang: result.data.idKhachHang,
        rooms: bookingInfo.selectedRooms,
        checkIn: bookingInfo.checkIn,
        checkOut: bookingInfo.checkOut,
        nights: calculateNights(),
        guests: bookingInfo.guests,
        totalPrice: result.data.tongTien,
        tax: result.data.thue,
        grandTotal: result.data.tongCong,
        holdExpiresAt: result.data.holdExpiresAt ?? null,
        services: bookingInfo.selectedServices || [],
        servicesTotal: bookingInfo.servicesTotal || 0,
        customer: customerInfo,
      };

      sessionStorage.setItem("customerInfo", JSON.stringify(customerInfo));
      sessionStorage.setItem("invoiceInfo", JSON.stringify(invoiceInfo));

      setLoading(false);
      window.location.href = "/#payment";
    } catch (err: any) {
      console.error("Error in handleSubmit:", err);
      Modal.error({
        title: "Đặt phòng thất bại",
        content: err.message || "Đã có lỗi xảy ra. Vui lòng thử lại.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Prepare services list for the small autoplay banner under the confirm button
  const [allServices, setAllServices] = useState<any[] | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchServices = async () => {
      try {
        const res = await fetch(`${API_BASE}/dich-vu/lay-danh-sach`);
        if (!res.ok) throw new Error("Failed to load services");
        const data = await res.json();
        if (!mounted) return;
        // Map to simple {name,image} using service image resolver
        const mapped = (data || []).map((s: any) => {
          const name = s.TenDichVu || s.tenDichVu || s.name || "Dịch vụ";
          const rawImg = s.HinhDichVu ?? s.hinhDichVu ?? s.hinh ?? s.imageUrl ?? s.url ?? null;
          const image = rawImg ? resolveServiceImageUrl(rawImg, "https://via.placeholder.com/120x80?text=Service") : "https://via.placeholder.com/120x80?text=Service";
          return { name, image };
        });
        setAllServices(mapped);
      } catch (e) {
        console.warn("Could not fetch services for banner:", e);
        setAllServices([]);
      }
    };
    fetchServices();
    return () => {
      mounted = false;
    };
  }, []);

  const defaultServices = [
    { name: "Spa", image: "https://via.placeholder.com/120x80?text=Spa" },
    { name: "Hồ bơi", image: "https://via.placeholder.com/120x80?text=Pool" },
    { name: "Gym", image: "https://via.placeholder.com/120x80?text=Gym" },
    {
      name: "Ăn sáng",
      image: "https://via.placeholder.com/120x80?text=Breakfast",
    },
    {
      name: "Đưa đón",
      image: "https://via.placeholder.com/120x80?text=Transfer",
    },
    { name: "Wifi", image: "https://via.placeholder.com/120x80?text=WiFi" },
  ];

  // Prefer all services from API; fall back to selectedServices or defaults
  const servicesForBanner =
    allServices && allServices.length > 0
      ? allServices
      : (bookingInfo as any)?.selectedServices?.length > 0
      ? (bookingInfo as any).selectedServices.map((s: any) => ({
          name: s.serviceName || s.name || s.title || "Dịch vụ",
          image: resolveServiceImageUrl(
            s.HinhDichVu ?? s.hinhDichVu ?? s.imageUrl ?? s.url ?? s.icon ?? null,
            '/img/services/default.webp'
          ),
        }))
      : defaultServices;

  const [itemsPerSlide, setItemsPerSlide] = useState<number>(3);

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth || 1024;
      if (w >= 1200) setItemsPerSlide(4);
      else if (w >= 900) setItemsPerSlide(3);
      else if (w >= 600) setItemsPerSlide(2);
      else setItemsPerSlide(1);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const chunk = (arr: any[], size: number) => {
    const res: any[] = [];
    for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
    return res;
  };

  const bannerChunks = chunk(servicesForBanner, itemsPerSlide);

  // compute a CSS width that lets items fill the slide space evenly (accounting for gap)
  const gapPx = 12; // gap used in carousel item container
  const itemWidth = `calc((100% - ${Math.max(
    0,
    (itemsPerSlide - 1) * gapPx
  )}px) / ${itemsPerSlide})`;

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

  if (!bookingInfo) {
    return (
      <Layout>
        <Content style={{ padding: "50px", textAlign: "center" }}>
          <div>Đang tải...</div>
        </Content>
      </Layout>
    );
  }

  const totalBefore = calculateTotal();
  const nights = calculateNights();
  const promotion = (bookingInfo as any).promotion;

  let totalAfter = 0;
  bookingInfo.selectedRooms.forEach((sr) => {
    // Sử dụng giá sau khuyến mãi nếu có
    const price =
      sr.room.discountedPrice &&
      sr.room.discountedPrice < sr.room.basePricePerNight
        ? sr.room.discountedPrice
        : sr.room.basePricePerNight || sr.room.giaCoBanMotDem || 0;
    totalAfter += Number(price) * nights;
  });

  const discountAmount = Math.max(0, totalBefore - totalAfter);
  const totalPrice = totalAfter;
  const servicesTotal = (bookingInfo as any).servicesTotal || 0;
  const servicesList = (bookingInfo as any).selectedServices || [];

  const tax = (totalPrice + servicesTotal) * 0.1;
  const grandTotal = totalPrice + servicesTotal + tax;

  return (
    <Layout>
      <Content
        style={{
          padding: "24px 24px",
          maxWidth: "1280px",
          margin: "auto",
          width: "100%",
          background: "#f8f9fa",
        }}
      >
        <BookingProgress
          totalRooms={bookingInfo?.totalRooms || 1}
          currentStage="checkout"
          selectedRoomNumbers={
            bookingInfo?.selectedRooms?.map((sr) => sr.roomNumber) || []
          }
        />

        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <Title
            level={1}
            style={{
              marginBottom: 8,
              fontSize: 36,
              fontWeight: 400,
              color: "#2c3e50",
            }}
          >
            Hoàn tất đặt phòng
          </Title>
          <Text style={{ fontSize: 16, color: "#7f8c8d" }}>
            Vui lòng kiểm tra thông tin và xác nhận đặt phòng của bạn
          </Text>
        </div>

        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Card
            style={{
              borderRadius: 12,
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
              border: "1px solid #e8e8e8",
            }}
            bodyStyle={{ padding: 0 }}
          >
            <Row gutter={[0, 0]} style={{ alignItems: "stretch" }}>
              <Col xs={24} lg={14}>
                <div style={{ padding: 24, height: "100%" }}>
                  <div
                    style={{
                      background:
                        "radial-gradient(circle at top left, #ffffff 0%, #f3f5f6 100%)",
                      borderRadius: 8,
                      borderBottom: "2px solid #dfa974",
                      padding: "10px 12px",
                      marginBottom: 12,
                    }}
                  >
                    <Title level={4} style={{ margin: 0, color: "#2c3e50" }}>
                      Thông tin khách hàng
                    </Title>
                  </div>

                  <Row gutter={16}>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        label="Họ và tên"
                        name="fullName"
                        rules={[
                          { required: true, message: "Vui lòng nhập họ tên" },
                        ]}
                      >
                        <Input
                          prefix={<UserOutlined style={{ color: "#dfa974" }} />}
                          placeholder="Nguyễn Văn A"
                          style={{ height: 44, borderRadius: 8 }}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        label="Email"
                        name="email"
                        rules={[
                          { required: true, message: "Vui lòng nhập email" },
                          { type: "email", message: "Email không hợp lệ" },
                        ]}
                      >
                        <Input
                          prefix={<MailOutlined style={{ color: "#dfa974" }} />}
                          placeholder="example@email.com"
                          style={{ height: 44, borderRadius: 8 }}
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        label="Số điện thoại"
                        name="phone"
                        rules={[
                          {
                            required: true,
                            message: "Vui lòng nhập số điện thoại",
                          },
                        ]}
                      >
                        <Input
                          prefix={
                            <PhoneOutlined style={{ color: "#dfa974" }} />
                          }
                          placeholder="0912345678"
                          style={{ height: 44, borderRadius: 8 }}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                    </Col>
                  </Row>

                  <Form.Item label="Địa chỉ" name="address">
                    <Input
                      prefix={<HomeOutlined />}
                      placeholder="Địa chỉ"
                      style={{ height: 44, borderRadius: 8 }}
                    />
                  </Form.Item>

                  <Form.Item label="Ghi chú" name="notes">
                    <TextArea
                      rows={3}
                      placeholder="Yêu cầu đặc biệt (tùy chọn)"
                      style={{ borderRadius: 8 }}
                    />
                  </Form.Item>

                  <Divider />

                  <div style={{ paddingBottom: 8 }}>
                    <Button
                      type="primary"
                      htmlType="submit"
                      size="large"
                      block
                      loading={loading}
                      icon={<CheckCircleOutlined />}
                      style={{
                        background:
                          "linear-gradient(135deg, #dfa974 0%, #c4915c 100%)",
                        borderColor: "#dfa974",
                        height: 50,
                        fontSize: 16,
                        fontWeight: 600,
                        borderRadius: 8,
                        boxShadow: "0 4px 12px rgba(223, 169, 116, 0.3)",
                        transition: "all 0.3s ease",
                      }}
                    >
                      Xác nhận đặt phòng
                    </Button>
                  </div>

                  {/* Small autoplay services banner */}
                  <div style={{ marginTop: 12 }}>
                    <Carousel
                      autoplay
                      dots={false}
                      autoplaySpeed={2800}
                      draggable
                    >
                      {bannerChunks.map((group, gi) => (
                        <div key={gi}>
                          <div
                            style={{
                              display: "flex",
                              gap: 12,
                              justifyContent: "flex-start",
                              alignItems: "center",
                              padding: "6px 12px",
                            }}
                          >
                            {group.map((svc: any, si: number) => (
                              <div
                                key={si}
                                style={{
                                  width: itemWidth,
                                  textAlign: "left",
                                }}
                              >
                                <div
                                  style={{
                                    width: "100%",
                                    height: 140,
                                    overflow: "hidden",
                                    borderRadius: 10,
                                    boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
                                  }}
                                >
                                  <img
                                    src={svc.image}
                                    alt={svc.name}
                                    style={{
                                      width: "100%",
                                      height: "100%",
                                      objectFit: "cover",
                                      display: "block",
                                    }}
                                  />
                                </div>
                                <div
                                  style={{
                                    fontSize: 14,
                                    marginTop: 10,
                                    color: "#2c3e50",
                                    whiteSpace: "normal",
                                    overflow: "hidden",
                                    display: "-webkit-box",
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: "vertical",
                                    lineHeight: 1.25,
                                  }}
                                >
                                  {svc.name}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </Carousel>
                  </div>
                </div>
              </Col>

              <Col xs={24} lg={10}>
                <div
                  style={{
                    padding: 24,
                    height: "100%",
                    borderLeft: "1px solid #eef0f1",
                  }}
                >
                  <div
                    style={{
                      background:
                        "radial-gradient(circle at top left, #ffffff 0%, #f3f5f6 100%)",
                      borderRadius: 8,
                      borderBottom: "2px solid #dfa974",
                      padding: "10px 12px",
                      marginBottom: 12,
                    }}
                  >
                    <Title level={4} style={{ margin: 0, color: "#2c3e50" }}>
                      Chi tiết đặt phòng
                    </Title>
                  </div>

                  <div style={{ paddingTop: 8 }}>
                    <Text strong>Thông tin lưu trú</Text>
                    <div style={{ marginTop: 8 }}>
                      <Text>Nhận phòng: </Text>
                      <Text strong>{bookingInfo.checkIn}</Text>
                    </div>
                    <div>
                      <Text>Trả phòng: </Text>
                      <Text strong>{bookingInfo.checkOut}</Text>
                    </div>
                    {holdExpiresAt && (
                      <div style={{ marginTop: 8 }}>
                        <Text type="danger">Thời hạn giữ phòng: </Text>
                        <Text strong>
                          {dayjs(holdExpiresAt)
                            .utc()
                            .local()
                            .format("YYYY-MM-DD HH:mm:ss")}
                        </Text>
                        <div style={{ marginTop: 4 }}>
                          <Text type="secondary">Thời gian còn lại: </Text>
                          <Text strong>{countdown ?? "--:--"}</Text>
                        </div>
                      </div>
                    )}
                    <div>
                      <Text>Số đêm: </Text>
                      <Text strong>{nights} đêm</Text>
                    </div>
                    <div>
                      <Text>Số người: </Text>
                      <Text strong>{bookingInfo.guests} người</Text>
                    </div>
                  </div>

                  <Divider />

                  <div style={{ marginBottom: 16 }}>
                    <Text strong>Danh sách phòng đã chọn</Text>
                    {bookingInfo.selectedRooms.map((sr, index) => (
                      <Card
                        key={index}
                        size="small"
                        style={{ marginTop: 12, background: "#fafafa" }}
                      >
                        <div style={{ display: "flex", gap: 12 }}>
                          {sr.room.urlAnhPhong && (
                            <img
                              src={resolveImageUrl(sr.room.urlAnhPhong)}
                              alt={sr.room.tenPhong}
                              style={{
                                width: 80,
                                height: 80,
                                objectFit: "cover",
                                borderRadius: 4,
                              }}
                            />
                          )}
                          <div style={{ flex: 1 }}>
                            <Text strong>Phòng {sr.roomNumber}</Text>
                            <br />
                            <Text>{sr.room.tenPhong || sr.room.soPhong}</Text>
                            {sr.room.promotionName && (
                              <>
                                <br />
                                <Text style={{ fontSize: 12, color: "#52c41a" }}>
                                  🎉 {sr.room.promotionName}
                                </Text>
                              </>
                            )}
                            <br />
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {(() => {
                                const price =
                                  sr.room.discountedPrice &&
                                  sr.room.discountedPrice <
                                    sr.room.basePricePerNight
                                    ? sr.room.discountedPrice
                                    : sr.room.basePricePerNight ||
                                      sr.room.giaCoBanMotDem ||
                                      0;
                                const originalPrice =
                                  sr.room.basePricePerNight ||
                                  sr.room.giaCoBanMotDem ||
                                  0;
                                const hasDiscount =
                                  sr.room.discountedPrice &&
                                  sr.room.discountedPrice < originalPrice;
                                return (
                                  <>
                                    {hasDiscount && (
                                      <span
                                        style={{
                                          textDecoration: "line-through",
                                          marginRight: 8,
                                          color: "#999",
                                        }}
                                      >
                                        {originalPrice.toLocaleString()}đ
                                      </span>
                                    )}
                                    {price.toLocaleString()}đ x {nights} đêm
                                  </>
                                );
                              })()}
                            </Text>
                            <br />
                            <Text strong style={{ color: "#dfa974" }}>
                              {(() => {
                                const price =
                                  sr.room.discountedPrice &&
                                  sr.room.discountedPrice <
                                    sr.room.basePricePerNight
                                    ? sr.room.discountedPrice
                                    : sr.room.basePricePerNight ||
                                      sr.room.giaCoBanMotDem ||
                                      0;
                                return (price * nights).toLocaleString();
                              })()}
                              đ
                            </Text>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>

                  {servicesList.length > 0 && (
                    <>
                      <Divider />
                      <div style={{ marginBottom: 16 }}>
                        <Text strong>Dịch vụ đã chọn</Text>
                        {servicesList.map((s: any, idx: number) => (
                          <div
                            key={idx}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              marginTop: 8,
                            }}
                          >
                            <div>
                              <Text>{s.serviceName}</Text>
                              <div style={{ fontSize: 12, color: "#666" }}>
                                {s.quantity} x{" "}
                                {Number(s.price).toLocaleString()}đ
                              </div>
                            </div>
                            <div style={{ fontWeight: 700 }}>
                              {(
                                Number(s.price) * Number(s.quantity)
                              ).toLocaleString()}
                              đ
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  <Divider />
                  <div style={{ marginBottom: 16 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 8,
                      }}
                    >
                      <Text>Tổng tiền phòng:</Text>
                      <Text strong>{totalPrice.toLocaleString()}đ</Text>
                    </div>

                    {promotion && (
                      <div
                        style={{
                          marginTop: 8,
                          marginBottom: 8,
                          padding: 12,
                          background: "#fff7e6",
                          borderRadius: 6,
                        }}
                      >
                        <Text strong style={{ color: "#b45309" }}>
                          {promotion.tenKhuyenMai || "Khuyến mãi"}
                        </Text>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginTop: 6,
                          }}
                        >
                          <Text type="secondary">Giảm:</Text>
                          <Text strong style={{ color: "#ff4d4f" }}>
                            {discountAmount.toLocaleString()}đ
                          </Text>
                        </div>
                      </div>
                    )}

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 8,
                      }}
                    >
                      <Text>Tiền dịch vụ:</Text>
                      <Text strong>{servicesTotal.toLocaleString()}đ</Text>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 8,
                      }}
                    >
                      <Text>Thuế & phí (10%):</Text>
                      <Text>{tax.toLocaleString()}đ</Text>
                    </div>
                    <Divider style={{ margin: "12px 0" }} />
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Text strong style={{ fontSize: 18 }}>
                        Tổng cộng:
                      </Text>
                      <Text strong style={{ fontSize: 24, color: "#dfa974" }}>
                        {grandTotal.toLocaleString()}đ
                      </Text>
                    </div>
                  </div>

                  <Alert
                    message="Miễn phí hủy trong 24h"
                    description="Bạn có thể hủy miễn phí trước 24 giờ nhận phòng"
                    type="info"
                    showIcon
                    style={{ marginTop: 16 }}
                  />
                </div>
              </Col>
            </Row>
          </Card>
        </Form>

        <div style={{ marginTop: 24, marginBottom: 24 }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <Title level={2} style={{ color: "#2c3e50", marginBottom: 8 }}>
              Thông tin quan trọng
            </Title>
            <Text style={{ fontSize: 16, color: "#7f8c8d" }}>
              Vui lòng đọc kỹ các chính sách và quy định trước khi hoàn tất đặt
              phòng
            </Text>
          </div>
          <Row gutter={[24, 16]}>
            <Col xs={24} lg={8}>
              <Card
                style={{
                  height: "100%",
                  borderRadius: 12,
                  border: "1px solid #e8e8e8",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  transition: "all 0.3s ease",
                }}
                bodyStyle={{ padding: 24 }}
                hoverable
              >
                <div style={{ textAlign: "center", marginBottom: 20 }}>
                  <ClockCircleOutlined
                    style={{ fontSize: 32, color: "#dfa974" }}
                  />
                  <Title
                    level={4}
                    style={{ marginTop: 12, marginBottom: 0, color: "#2c3e50" }}
                  >
                    Quy định nhận/trả phòng
                  </Title>
                </div>
                <div style={{ lineHeight: 1.7 }}>
                  <div style={{ marginBottom: 16 }}>
                    <ClockCircleOutlined
                      style={{ color: "#52c41a", marginRight: 8 }}
                    />
                    <Text strong>Giờ nhận phòng:</Text>
                    <br />
                    <Text
                      style={{ color: "#666", fontSize: 14, marginLeft: 24 }}
                    >
                      14:00 (sớm hơn tùy thuộc vào tình trạng phòng)
                    </Text>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <ClockCircleOutlined
                      style={{ color: "#fa8c16", marginRight: 8 }}
                    />
                    <Text strong>Giờ trả phòng:</Text>
                    <br />
                    <Text
                      style={{ color: "#666", fontSize: 14, marginLeft: 24 }}
                    >
                      12:00 (muộn hơn có thể áp dụng phí phụ thu)
                    </Text>
                  </div>
                  <div>
                    <InfoCircleOutlined
                      style={{ color: "#1890ff", marginRight: 8 }}
                    />
                    <Text strong>Early check-in / Late check-out:</Text>
                    <br />
                    <Text
                      style={{ color: "#666", fontSize: 13, marginLeft: 24 }}
                    >
                      Có thể yêu cầu và sẽ được xác nhận tại quầy lễ tân (phụ
                      phí có thể áp dụng)
                    </Text>
                  </div>
                </div>
              </Card>
            </Col>

            <Col xs={24} lg={8}>
              <Card
                style={{
                  height: "100%",
                  borderRadius: 12,
                  border: "1px solid #e8e8e8",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  transition: "all 0.3s ease",
                }}
                bodyStyle={{ padding: 24 }}
                hoverable
              >
                <div style={{ textAlign: "center", marginBottom: 20 }}>
                  <InfoCircleOutlined
                    style={{ fontSize: 32, color: "#dfa974" }}
                  />
                  <Title
                    level={4}
                    style={{ marginTop: 12, marginBottom: 0, color: "#2c3e50" }}
                  >
                    Chính sách & lưu ý
                  </Title>
                </div>
                <div style={{ lineHeight: 1.6 }}>
                  <div style={{ marginBottom: 12 }}>
                    <InfoCircleOutlined
                      style={{ color: "#52c41a", marginRight: 8 }}
                    />
                    <Text strong>Hủy phòng:</Text>
                    <br />
                    <Text
                      style={{ color: "#666", fontSize: 13, marginLeft: 24 }}
                    >
                      Miễn phí hủy trong 24 giờ kể từ khi xác nhận
                    </Text>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <InfoCircleOutlined
                      style={{ color: "#1890ff", marginRight: 8 }}
                    />
                    <Text strong>Thanh toán:</Text>
                    <br />
                    <Text
                      style={{ color: "#666", fontSize: 13, marginLeft: 24 }}
                    >
                      Đặt cọc 50% khi nhận phòng, thanh toán đầy đủ khi trả
                      phòng
                    </Text>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <InfoCircleOutlined
                      style={{ color: "#fa8c16", marginRight: 8 }}
                    />
                    <Text strong>Ăn sáng:</Text>
                    <br />
                    <Text
                      style={{ color: "#666", fontSize: 13, marginLeft: 24 }}
                    >
                      Bao gồm trong giá phòng (06:30 - 10:00 tại nhà hàng)
                    </Text>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <InfoCircleOutlined
                      style={{ color: "#722ed1", marginRight: 8 }}
                    />
                    <Text strong>Trẻ em:</Text>
                    <br />
                    <Text
                      style={{ color: "#666", fontSize: 13, marginLeft: 24 }}
                    >
                      Trẻ em dưới 6 tuổi ở miễn phí, trẻ em từ 6-12 tuổi phụ thu
                      50%
                    </Text>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <InfoCircleOutlined
                      style={{ color: "#f5222d", marginRight: 8 }}
                    />
                    <Text strong>Hút thuốc:</Text>
                    <br />
                    <Text
                      style={{ color: "#666", fontSize: 13, marginLeft: 24 }}
                    >
                      Nghiêm cấm hút thuốc trong phòng (phạt 1.000.000đ)
                    </Text>
                  </div>
                  <div>
                    <InfoCircleOutlined
                      style={{ color: "#13c2c2", marginRight: 8 }}
                    />
                    <Text strong>Vật nuôi:</Text>
                    <br />
                    <Text
                      style={{ color: "#666", fontSize: 13, marginLeft: 24 }}
                    >
                      Một số phòng cho phép mang theo vật nuôi (liên hệ trước,
                      phụ phí 200.000đ/đêm)
                    </Text>
                  </div>
                </div>
              </Card>
            </Col>

            <Col xs={24} lg={8}>
              <Card
                style={{
                  height: "100%",
                  borderRadius: 12,
                  border: "1px solid #e8e8e8",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  transition: "all 0.3s ease",
                }}
                bodyStyle={{ padding: 24 }}
                hoverable
              >
                <div style={{ textAlign: "center", marginBottom: 20 }}>
                  <PhoneOutlined style={{ fontSize: 32, color: "#dfa974" }} />
                  <Title
                    level={4}
                    style={{ marginTop: 12, marginBottom: 0, color: "#2c3e50" }}
                  >
                    Cần hỗ trợ?
                  </Title>
                </div>
                <div style={{ lineHeight: 1.8 }}>
                  <div style={{ marginBottom: 20 }}>
                    <PhoneOutlined
                      style={{ color: "#52c41a", marginRight: 8 }}
                    />
                    <Text strong>Lễ tân 24/7:</Text>
                    <br />
                    <Text
                      style={{ color: "#666", fontSize: 14, marginLeft: 24 }}
                    >
                      +84 (28) 1234 5678
                    </Text>
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <MailOutlined
                      style={{ color: "#1890ff", marginRight: 8 }}
                    />
                    <Text strong>Email:</Text>
                    <br />
                    <Text
                      style={{ color: "#666", fontSize: 14, marginLeft: 24 }}
                    >
                      reservation@hoteljw.vn
                    </Text>
                  </div>
                  <div>
                    <EnvironmentOutlined
                      style={{ color: "#fa8c16", marginRight: 8 }}
                    />
                    <Text strong>Địa chỉ:</Text>
                    <br />
                    <Text
                      style={{ color: "#666", fontSize: 14, marginLeft: 24 }}
                    >
                      123 Đường ABC, Quận 1, TP.HCM
                    </Text>
                  </div>
                </div>
              </Card>
            </Col>
          </Row>
        </div>
      </Content>
    </Layout>
  );
};

export default CheckoutPage;
