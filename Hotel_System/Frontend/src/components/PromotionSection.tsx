import React, { useEffect, useState } from "react";
import { Carousel, Button, Typography, Spin, Modal, Image, Tag, Divider } from "antd";
import { CheckCircleOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import { getAllPromotions, getPromotionById, Promotion } from "../api/promotionApi";
import { getServiceById } from "../api/serviceApi";
import { postCheckAvailableRooms } from "../api/roomsApi";
import { getAmenitiesForRoom } from "../api/amenticsApi";
// import ComboCard from "./ComboCard"; // Đã bỏ component này để dùng giao diện list trực tiếp
import DetailComboCard from "./DetailComboCard";

dayjs.extend(isBetween);

const { Title, Paragraph, Text } = Typography;

const PromotionSection: React.FC = () => {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPromo, setSelectedPromo] = useState<Promotion | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [promoServices, setPromoServices] = useState<any[] | null>(null);
  const [loadingPromoServices, setLoadingPromoServices] = useState(false);
  // Lưu tỉ lệ ảnh của từng promotion để tính toán height
  const [imageAspectRatios, setImageAspectRatios] = useState<Record<string, number>>({});
  // Track window size để cập nhật height khi resize
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  // Availability check form state
  const [checkIn, setCheckIn] = useState<string>("");
  const [checkOut, setCheckOut] = useState<string>("");
  const [guests, setGuests] = useState<number>(1);
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);
  const [expandedRoom, setExpandedRoom] = useState<string | null>(null);
  const [hasCheckedAvailability, setHasCheckedAvailability] = useState(false);
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  // Detail combo modal state
  const [detailComboVisible, setDetailComboVisible] = useState(false);
  const [selectedComboDetail, setSelectedComboDetail] = useState<any | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const all = await getAllPromotions("active");
        const today = dayjs();
        const valid = all.filter((p) => {
          try {
            const start = dayjs(p.ngayBatDau);
            const end = dayjs(p.ngayKetThuc);
            return today.isBetween(start, end, "day", "[]");
          } catch {
            return false;
          }
        });
        setPromotions(valid);
      } catch (err) {
        console.error("[PromotionSection] Failed to load promotions", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Handle window resize để cập nhật height
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const openPromo = async (id: string) => {
    try {
      setModalLoading(true);
      const p = await getPromotionById(id);
      setSelectedPromo(p);
      setModalVisible(true);
      
      // Reset form
      setCheckIn("");
      setCheckOut("");
      setGuests(1);
      setAvailableRooms([]);
      setExpandedRoom(null);
      setHasCheckedAvailability(false);

      // Load services if mapped
      const svcMappings = (p as any)?.khuyenMaiDichVus || (p as any)?.khuyenMaiDichVu || null;
      if (svcMappings && Array.isArray(svcMappings) && svcMappings.length > 0) {
        setLoadingPromoServices(true);
        try {
          const loaded = await Promise.all(
            svcMappings.map(async (m: any) => {
              try {
                const sid = m.iddichVu ?? m.IddichVu ?? m.idDichVu ?? null;
                if (!sid) return { mapping: m, service: null };
                const svc = await getServiceById(sid);
                return { mapping: m, service: svc };
              } catch (err) {
                return { mapping: m, service: null };
              }
            })
          );
          setPromoServices(loaded.map((x) => ({ mapping: x.mapping, service: x.service })));
        } catch (err) {
          setPromoServices([]);
        } finally {
          setLoadingPromoServices(false);
        }
      } else {
        setPromoServices(null);
      }
    } catch (err) {
      console.error("[PromotionSection] Failed to load promo detail", err);
    } finally {
      setModalLoading(false);
    }
  };

  const handleCheckAvailability = async () => {
    if (!checkIn || !checkOut) {
      alert("Vui lòng chọn ngày nhận và ngày trả phòng");
      return;
    }

    try {
      setLoadingAvailability(true);
      const checkInDate = checkIn.includes("-") ? checkIn : dayjs(checkIn).format("YYYY-MM-DD");
      const checkOutDate = checkOut.includes("-") ? checkOut : dayjs(checkOut).format("YYYY-MM-DD");
      
      const allAvailableRooms = await postCheckAvailableRooms(checkInDate, checkOutDate, guests);
      
      const promotionRoomIds = new Set(
        selectedPromo?.khuyenMaiPhongs?.map((p: any) => p.idphong) || []
      );
      
      const filteredRooms = allAvailableRooms.filter((room: any) => 
        promotionRoomIds.has(room.idphong)
      );
      
      setAvailableRooms(filteredRooms);
      setHasCheckedAvailability(true);
    } catch (err) {
      console.error("[PromotionSection] check availability error", err);
      setAvailableRooms([]);
      setHasCheckedAvailability(true);
    } finally {
      setLoadingAvailability(false);
    }
  };

  const handleQuickBook = (room: any) => {
    const bookingInfo = {
      selectedRooms: [
        {
          roomNumber: 1,
          room,
        },
      ],
      checkIn: checkIn,
      checkOut: checkOut,
      guests: guests,
      totalRooms: 1,
      promotion: selectedPromo
        ? {
            idkhuyenMai: selectedPromo.idkhuyenMai,
            tenKhuyenMai: selectedPromo.tenKhuyenMai,
            loaiGiamGia: selectedPromo.loaiGiamGia,
            giaTriGiam: selectedPromo.giaTriGiam,
          }
        : null,
    };
    sessionStorage.setItem("bookingInfo", JSON.stringify(bookingInfo));
    window.location.href = "/checkout";
  };

  const toggleExpand = (id: string) => {
    setExpandedRoom(expandedRoom === id ? null : id);
  };

  const getValidationError = () => {
    if (!checkIn || !checkOut) return null;
    const checkInDate = new Date(checkIn);
    checkInDate.setHours(0, 0, 0, 0);
    const checkOutDate = new Date(checkOut);
    checkOutDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (checkInDate < today) return "Ngày nhận phòng không được là ngày trong quá khứ.";
    const minCheckOut = new Date(checkInDate);
    minCheckOut.setDate(minCheckOut.getDate() + 1);
    if (checkOutDate < minCheckOut) return "Ngày trả phòng phải hơn ngày nhận phòng ít nhất 1 ngày.";
    return null;
  };

  const validationError = getValidationError();
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const todayString = todayDate.toISOString().split('T')[0];

  const getMinDate = () => todayString;

  const formatToDisplay = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const handleCheckinChange = (value: string) => {
    setCheckIn(value);
    if (value) {
      const checkInDate = new Date(value);
      checkInDate.setHours(0, 0, 0, 0);
      const minCheckOut = new Date(checkInDate);
      minCheckOut.setDate(minCheckOut.getDate() + 1);
      if (checkOut) {
        const curCheckoutDate = new Date(checkOut);
        curCheckoutDate.setHours(0, 0, 0, 0);
        if (curCheckoutDate < minCheckOut) {
          setCheckOut('');
        }
      }
    }
  };

  const renderImageSrc = (hinh?: string) => {
    if (!hinh) return "/img/placeholder.png";
    return hinh.startsWith("/") ? hinh : `/img/promotion/${hinh}`;
  };

  if (loading) return <Spin />;
  if (promotions.length === 0) return null;

  return (
    <div style={{ marginBottom: 48, position: "relative", padding: 20, height: 'fit-content' }}>
      {/* Section Title */}
      <div style={{ marginBottom: 24, textAlign: "center" }}>
        <Title level={2} style={{ marginBottom: 8, color: "#1f1f1f" }}>
          🎉 Khuyến Mãi Nổi Bật
        </Title>
        <Text type="secondary" style={{ fontSize: 14 }}>
          Những ưu đãi tuyệt vời đang chờ bạn
        </Text>
      </div>

      {/* Carousel */}
      <Carousel
        autoplay
        autoplaySpeed={5000}
        dots={{ className: "custom-dots" }}
        style={{
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 12px 32px rgba(0, 0, 0, 0.15)",
          width: "100%",
        }}
      >
        {promotions.map((p) => {
          const aspectRatio = imageAspectRatios[p.idkhuyenMai] || null;
          // Tính height dựa trên width và tỉ lệ ảnh, nhưng giới hạn trong khoảng hợp lý
          const getContainerHeight = () => {
            if (!aspectRatio) return 450; // Default height khi chưa load xong ảnh
            // Lấy width của container (100% viewport width)
            // Container có padding 20px mỗi bên từ parent, nên width thực tế = viewport width - 40px
            const containerWidth = Math.max(windowSize.width - 40, 320); // Tối thiểu 320px cho mobile
            const calculatedHeight = containerWidth * aspectRatio;
            // Giới hạn chiều cao: tối thiểu 450px, tối đa 70vh
            const minHeight = 450;
            const maxHeight = windowSize.height * 0.7;
            const finalHeight = Math.max(minHeight, Math.min(calculatedHeight, maxHeight));
            return finalHeight;
          };

          return (
            <div key={p.idkhuyenMai} style={{ width: "100%" }}>
              {/* Ảnh ẩn để load và lấy tỉ lệ */}
              <img
                src={renderImageSrc(p.hinhAnhBanner)}
                alt=""
                style={{ display: "none" }}
                onLoad={(e) => {
                  const img = e.currentTarget;
                  if (img.naturalWidth && img.naturalHeight) {
                    const ratio = img.naturalHeight / img.naturalWidth;
                    setImageAspectRatios((prev) => ({
                      ...prev,
                      [p.idkhuyenMai]: ratio,
                    }));
                  }
                }}
              />
              
              <div
                style={{
                  width: "100%",
                  height: `${getContainerHeight()}px`,
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  overflow: "hidden",
                  background: "#000",
                }}
              >
                {/* Background Image - full width và height theo tỉ lệ gốc */}
                <img
                  src={renderImageSrc(p.hinhAnhBanner)}
                  alt={p.tenKhuyenMai}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: "center",
                    zIndex: 0,
                  }}
                />
              
              {/* Dark gradient overlay - stronger for better text readability */}
              <div
                style={{
                  position: "absolute",
                  top: 0, left: 0, right: 0, bottom: 0,
                  background: "linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.2) 100%)",
                  zIndex: 1,
                }}
              />

              <div
                style={{
                  position: "relative",
                  zIndex: 2,
                  padding: "60px 60px",
                  color: "#fff",
                  maxWidth: "65%",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                }}
              >
                <div style={{ marginBottom: 16 }}>
                  <Tag color="volcano" style={{ fontSize: 13, fontWeight: "600", padding: "4px 12px" }}>
                    ⚡ KHUYẾN MÃI ĐẶC BIỆT
                  </Tag>
                </div>

                <Title
                  level={1}
                  style={{
                    color: "#fff", margin: "12px 0", fontSize: 42,
                    fontWeight: 800, lineHeight: 1.2, textShadow: "0 4px 12px rgba(0,0,0,0.3)",
                  }}
                >
                  {p.tenKhuyenMai}
                </Title>

                <Paragraph
                  style={{
                    color: "rgba(255,255,255,0.95)", margin: "20px 0", fontSize: 16,
                    lineHeight: 1.6, textShadow: "0 2px 8px rgba(0,0,0,0.2)",
                  }}
                  ellipsis={{ rows: 3 }}
                >
                  {p.moTa}
                </Paragraph>

                <div style={{ marginTop: 24 }}>
                  <Button
                    type="primary"
                    size="large"
                    onClick={() => openPromo(p.idkhuyenMai)}
                    style={{
                      borderRadius: 8, fontSize: 16, fontWeight: 600,
                      height: 48, paddingInline: 32, minWidth: 200,
                    }}
                  >
                    🔥 Khám Phá Ngay
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
        })}
      </Carousel>

      {/* Modal Detail */}
      <Modal
        open={modalVisible}
        title={<Title level={4} style={{ margin: 0 }}>{selectedPromo?.tenKhuyenMai}</Title>}
        footer={<Button type="primary" onClick={() => setModalVisible(false)}>Đóng</Button>}
        onCancel={() => setModalVisible(false)}
        width={820}
        centered
        zIndex={9999}
        maskStyle={{ backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9999 }}
        style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.35)', borderRadius: 16, overflow: 'hidden' }}
        bodyStyle={{ maxHeight: '70vh', overflowY: 'auto', padding: '24px' }}
      >
        {modalLoading || !selectedPromo ? (
          <div style={{ textAlign: "center", padding: 40 }}><Spin size="large" /></div>
        ) : (
          <div>
            {/* Banner Image in Modal */}
            <div style={{ marginBottom: 24, borderRadius: 8, overflow: 'hidden', width: '100%' }}>
              <Image
                src={renderImageSrc(selectedPromo.hinhAnhBanner)}
                alt="banner"
                style={{
                  display: 'block', width: '100%', height: 'auto', maxHeight: 420,
                  objectFit: 'contain', borderRadius: 8, background: '#f7f7f7'
                }}
                preview={{ mask: "Xem" }}
              />
            </div>

            {/* Description */}
            <div style={{ marginBottom: 24 }}>
              <Title level={5} style={{ marginBottom: 8 }}>Chi Tiết Khuyến Mãi</Title>
              <Paragraph style={{ fontSize: 14, lineHeight: 1.6, color: "#666" }}>
                {selectedPromo.moTa}
              </Paragraph>
            </div>

            <Divider />

            {/* Promotion Stats */}
            <div style={{ marginTop: 24 }}>
              <Title level={5} style={{ marginBottom: 12 }}>📋 Thông Tin Chi Tiết</Title>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <Text type="secondary" style={{ fontSize: 12, textTransform: "uppercase" }}>Loại Giảm</Text>
                  <Paragraph style={{ margin: 0, fontWeight: 500 }}>
                    {selectedPromo.loaiGiamGia === "percent" ? `${selectedPromo.giaTriGiam}%` : `${selectedPromo.giaTriGiam} đ`}
                  </Paragraph>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12, textTransform: "uppercase" }}>Trạng Thái</Text>
                  <Paragraph style={{ margin: 0, fontWeight: 500 }}>
                    <Tag color={selectedPromo.trangThai === "active" ? "green" : selectedPromo.trangThai === "inactive" ? "orange" : "red"}>
                      {selectedPromo.trangThai === "active" ? "Đang Hoạt Động" : selectedPromo.trangThai === "inactive" ? "Chưa Bắt Đầu" : "Đã Hết Hạn"}
                    </Tag>
                  </Paragraph>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 12 }}>
                <div>
                  <Text type="secondary" style={{ fontSize: 12, textTransform: "uppercase" }}>Ngày Bắt Đầu</Text>
                  <Paragraph style={{ margin: 0, fontWeight: 500 }}>{dayjs(selectedPromo.ngayBatDau).format("DD/MM/YYYY")}</Paragraph>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12, textTransform: "uppercase" }}>Ngày Kết Thúc</Text>
                  <Paragraph style={{ margin: 0, fontWeight: 500 }}>{dayjs(selectedPromo.ngayKetThuc).format("DD/MM/YYYY")}</Paragraph>
                </div>
              </div>
            </div>

            <Divider />

            {/* Content Logic: Combo vs Service vs Room */}
            <div style={{ marginTop: 24 }}>
              {(() => {
                const combos = (selectedPromo as any)?.khuyenMaiCombos || [];
                const isComboPromotion = combos.length > 0;

                // --- GIAO DIỆN COMBO MỚI ---
                if (isComboPromotion) {
                  return (
                    <div style={{ padding: '0 8px 16px 8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', marginBottom: 16 }}>
                        <Title level={5} style={{ margin: 0 }}>Combo dịch vụ ưu đãi</Title>
                        <Text type="secondary" style={{ fontSize: 13 }}>Chưa bao gồm thuế & phí</Text>
                      </div>
                      
                      <div style={{ display: 'grid', gap: 12 }}>
                        {combos.map((combo: any) => {
                          // 1. Lấy dịch vụ
                          const services = combo.khuyenMaiComboDichVus || combo.KhuyenMaiComboDichVus || [];
                          
                          // 2. Tính giá
                          const originalPrice = services.reduce((sum: number, s: any) => sum + Number(s.tienDichVu || s.TienDichVu || 0), 0);
                          
                          const discountType = (selectedPromo as any)?.loaiGiamGia || 'percent';
                          const discountValue = Number((selectedPromo as any)?.giaTriGiam || 0);
                          
                          let finalPrice = originalPrice;
                          let savedAmount = 0;
                          
                          if (discountType === 'percent') {
                            savedAmount = originalPrice * (discountValue / 100);
                            finalPrice = originalPrice - savedAmount;
                          } else {
                            savedAmount = discountValue;
                            finalPrice = originalPrice - savedAmount;
                          }
                          finalPrice = Math.max(0, Math.round(finalPrice));

                          return (
                            <div 
                              key={combo.idkhuyenMaiCombo || combo.IdkhuyenMaiCombo}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '16px',
                                border: '1px solid #e5e7eb',
                                borderRadius: '12px',
                                background: '#fff',
                                transition: 'all 0.2s ease',
                                cursor: 'pointer',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                              }}
                              onClick={() => {
                                // Mở chi tiết
                                const fullComboData = {
                                  comboId: combo.idkhuyenMaiCombo || combo.IdkhuyenMaiCombo,
                                  name: combo.tenCombo || combo.TenCombo,
                                  description: combo.moTa || combo.MoTa,
                                  originalPrice,
                                  finalPrice,
                                  serviceDetails: services.map((s: any) => ({
                                    ...s,
                                    iddichVu: s.iddichVu || s.IddichVu,
                                    tenDichVu: s.tenDichVu || s.TenDichVu,
                                    tienDichVu: s.tienDichVu || s.TienDichVu,
                                    hinhDichVu: s.hinhDichVu || s.HinhDichVu,
                                    thongTinDv: s.thongTinDv || s.ThongTinDV,
                                    thoiLuongUocTinh: s.thoiLuongUocTinh || s.ThoiLuongUocTinh,
                                  })),
                                  hinhAnhBanner: selectedPromo?.hinhAnhBanner,
                                  loaiGiamGia: discountType,
                                  giaTriGiam: discountValue,
                                };
                                setSelectedComboDetail(fullComboData);
                                setDetailComboVisible(true);
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = '#d97706';
                                e.currentTarget.style.backgroundColor = '#fffbf0';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = '#e5e7eb';
                                e.currentTarget.style.backgroundColor = '#fff';
                              }}
                            >
                              {/* CỘT TRÁI */}
                              <div style={{ flex: 1, paddingRight: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                  <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1f2937' }}>
                                    {combo.tenCombo || combo.TenCombo || 'Combo Tiết Kiệm'}
                                  </h4>
                                  {savedAmount > 0 && (
                                    <span style={{ 
                                      fontSize: 11, fontWeight: 700, color: '#dc2626', 
                                      background: '#fee2e2', padding: '2px 8px', borderRadius: 99 
                                    }}>
                                      -{discountType === 'percent' ? `${discountValue}%` : `${(discountValue/1000)}k`}
                                    </span>
                                  )}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  {services.map((s: any, idx: number) => (
                                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 13, color: '#4b5563' }}>
                                      <CheckCircleOutlined style={{ color: '#10b981', marginTop: 3 }} />
                                      <span style={{flex: 1}}>{s.tenDichVu || s.TenDichVu}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* CỘT PHẢI */}
                              <div style={{ textAlign: 'right', minWidth: 120, borderLeft: '1px dashed #e5e7eb', paddingLeft: 16 }}>
                                <div style={{ fontSize: 12, textDecoration: 'line-through', color: '#9ca3af' }}>
                                  {originalPrice.toLocaleString('vi-VN')} ₫
                                </div>
                                <div style={{ fontSize: 18, fontWeight: 800, color: '#d97706', marginBottom: 8 }}>
                                  {finalPrice.toLocaleString('vi-VN')} ₫
                                </div>
                                <Button size="small" style={{ fontSize: 12, fontWeight: 600, borderColor: '#d97706', color: '#d97706', borderRadius: 6 }}>
                                  Xem Chi Tiết
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16, borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
                        <div style={{ textAlign: 'right' }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>Bạn chưa chọn phòng nào?</Text>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>Hãy tiếp tục để chọn phòng nghỉ</div>
                        </div>
                        <button
                          onClick={() => {
                            const bookingInfo = { 
                              selectedRooms: [], 
                              promotion: selectedPromo ? { 
                                idkhuyenMai: selectedPromo.idkhuyenMai, 
                                tenKhuyenMai: selectedPromo.tenKhuyenMai, 
                                loaiGiamGia: selectedPromo.loaiGiamGia, 
                                giaTriGiam: selectedPromo.giaTriGiam 
                              } : null 
                            };
                            try { sessionStorage.setItem('bookingInfo', JSON.stringify(bookingInfo)); } catch (_) {}
                            window.location.href = '/rooms';
                          }}
                          style={{ 
                            padding: '12px 24px', borderRadius: 8, 
                            background: 'linear-gradient(135deg,#dfa974 0%,#c8956d 100%)', 
                            color: '#fff', border: 'none', fontWeight: 700, 
                            cursor: 'pointer', boxShadow: '0 4px 12px rgba(223, 169, 116, 0.4)'
                          }}
                        >
                          Tiến hành đặt phòng ngay →
                        </button>
                      </div>
                    </div>
                  );
                } 
                // --- KẾT THÚC GIAO DIỆN COMBO MỚI ---

                else if (promoServices !== null) {
                  // Regular Services (Non-Combo)
                  return (
                    <div style={{ padding: 16 }}>
                      <Title level={5} style={{ marginBottom: 12 }}>🎯 Dịch vụ áp dụng</Title>
                      {loadingPromoServices ? (
                        <div style={{ padding: 24, textAlign: 'center' }}>Đang tải dịch vụ…</div>
                      ) : promoServices.length === 0 ? (
                        <div style={{ padding: 16, background: '#fff7e6', borderRadius: 8 }}>Không có dịch vụ nào áp dụng khuyến mãi này.</div>
                      ) : (
                        <div style={{ display: 'grid', gap: 12 }}>
                          {promoServices.map((entry: any, idx: number) => {
                            const mapping = entry.mapping || {};
                            const svc = entry.service || null;
                            const original = Number((svc && (svc.tienDichVu ?? svc.TienDichVu)) || 0);
                            const discountPercent = selectedPromo?.loaiGiamGia === 'percent' ? Number((selectedPromo as any)?.giaTriGiam ?? 0) : 0;
                            const discountAmount = selectedPromo?.loaiGiamGia === 'amount' ? Number((selectedPromo as any)?.giaTriGiam ?? 0) : 0;
                            const discounted = discountPercent > 0 ? Math.round(original * (1 - discountPercent / 100)) : Math.max(0, Math.round(original - discountAmount));

                            return (
                              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 8, background: '#fff', border: '1px solid #eee' }}>
                                <div style={{ width: 88, height: 64, borderRadius: 6, overflow: 'hidden', background: '#fafafa', flex: '0 0 88px' }}>
                                  <img src={(svc && (svc.hinhDichVu || svc.HinhDichVu)) || '/img/services/default.png'} alt={svc?.tenDichVu || mapping.tenDichVu || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: 700 }}>{svc?.tenDichVu || mapping.tenDichVu || 'Dịch vụ'}</div>
                                  <div style={{ color: '#666', fontSize: 13, marginTop: 6 }}>
                                    {original ? <span style={{ textDecoration: discounted < original ? 'line-through' : 'none', color: '#999', marginRight: 8 }}>{original.toLocaleString('vi-VN')} ₫</span> : <span>Liên hệ</span>}
                                    {discounted < original && <span style={{ color: '#ff4d4f', fontWeight: 700 }}>{discounted.toLocaleString('vi-VN')} ₫</span>}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                        <button
                          onClick={() => {
                            const bookingInfo = { selectedRooms: [], promotion: selectedPromo ? { idkhuyenMai: selectedPromo.idkhuyenMai, tenKhuyenMai: selectedPromo.tenKhuyenMai, loaiGiamGia: selectedPromo.loaiGiamGia, giaTriGiam: selectedPromo.giaTriGiam } : null };
                            try { sessionStorage.setItem('bookingInfo', JSON.stringify(bookingInfo)); } catch (_) {}
                            window.location.href = '/rooms';
                          }}
                          style={{ padding: '10px 16px', borderRadius: 8, background: 'linear-gradient(135deg,#dfa974 0%,#c8956d 100%)', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}
                        >
                          Tiến hành đặt phòng ngay
                        </button>
                      </div>
                    </div>
                  );
                } else {
                  // Room Availability Check
                  return (
                    <>
                      <Title level={5} style={{ marginBottom: 16 }}>🔍 Kiểm Tra Phòng Trống Trong Khuyến Mãi</Title>
                      <div style={{ padding: '24px', borderBottom: '1px solid #eee' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 24 }}>
                          <div style={{ padding: '0', background: 'transparent' }}>
                            <div style={{ display: 'grid', gap: 12 }}>
                              <div>
                                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#333' }}>📅 Ngày nhận phòng</label>
                                <input type="date" value={checkIn} onChange={(e) => handleCheckinChange(e.target.value)} min={getMinDate()} style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #ddd' }} />
                                <div style={{ marginTop: 6, color: '#888', fontSize: 12 }}>{checkIn ? formatToDisplay(checkIn) : 'dd/mm/yyyy'}</div>
                              </div>
                              <div>
                                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#333' }}>📅 Ngày trả phòng</label>
                                <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} min={checkIn ? new Date(new Date(checkIn).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] : getMinDate()} style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #ddd' }} />
                                <div style={{ marginTop: 6, color: '#888', fontSize: 12 }}>{checkOut ? formatToDisplay(checkOut) : 'dd/mm/yyyy'}</div>
                              </div>
                              <div>
                                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#333' }}>👥 Số người</label>
                                <select value={guests} onChange={(e) => setGuests(parseInt(e.target.value))} style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #ddd' }}>
                                  {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n} người</option>)}
                                </select>
                              </div>
                              {validationError && <div style={{ padding: 10, background: '#fdecea', borderRadius: 6, color: '#c0392b', fontSize: 13 }}>{'⚠️ ' + validationError}</div>}
                              <button onClick={handleCheckAvailability} disabled={loadingAvailability || !checkIn || !checkOut || !!validationError} style={{ width: '100%', padding: '12px 14px', borderRadius: 6, border: 'none', background: loadingAvailability || validationError ? '#ccc' : 'linear-gradient(135deg,#dfa974 0%,#c8956d 100%)', color: '#fff', fontWeight: 600, cursor: validationError ? 'not-allowed' : 'pointer' }}>{loadingAvailability ? '⏳ Đang kiểm tra...' : '🔍 Kiểm tra phòng trống'}</button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div style={{ padding: '24px' }}>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600 }}>Danh sách phòng khuyến mãi</h3>
                        {!hasCheckedAvailability ? (
                          <div style={{ padding: 16, background: '#f0f8ff', borderRadius: 8, color: '#1890ff', textAlign: 'center', fontSize: '16px', fontWeight: 500 }}>
                            📅 Vui lòng chọn ngày nhận/trả phòng và kiểm tra phòng trống để xem danh sách phòng khả dụng
                          </div>
                        ) : availableRooms.length === 0 && !loadingAvailability && checkIn && checkOut ? (
                          <div style={{ padding: 16, background: '#fdecea', borderRadius: 8, color: '#c0392b', textAlign: 'center', fontSize: '16px', fontWeight: 500 }}>
                            ❌ Không có phòng trống cho khoảng thời gian đã chọn
                          </div>
                        ) : (
                          <div style={{ display: 'grid', gap: 16 }}>
                            {availableRooms.map((room) => {
                              const originalPrice = Number(room.giaCoBanMotDem || 0);
                              const discountPercent = selectedPromo?.loaiGiamGia === "percent" ? Number(selectedPromo.giaTriGiam || 0) : 0;
                              const discountedPrice = Math.round(originalPrice * (1 - discountPercent / 100));

                              return (
                                <div key={room.idphong} style={{ border: '1px solid #e0e0e0', borderRadius: 8, overflow: 'hidden', background: '#fff', transition: 'all 0.3s ease', boxShadow: expandedRoom === room.idphong ? '0 4px 12px rgba(0,0,0,0.1)' : 'none' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', padding: '16px', gap: 16, background: '#fafafa' }}>
                                    <div style={{ width: 180, height: 120, flex: '0 0 180px', overflow: 'hidden', borderRadius: 8, background: '#fff', border: '1px solid #f0f0f0' }}>
                                      <img src={room.urlAnhPhong ?? '/img/room/default.webp'} alt={room.tenPhong ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                        <div style={{ fontWeight: 700, fontSize: '16px', color: '#333' }}>{room.tenPhong} {room.soPhong ? `- ${room.soPhong}` : ''}</div>
                                      </div>
                                      <div style={{ color: '#666', fontSize: '13px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                        <span>{room.soNguoiToiDa ? `👥 Tối đa ${room.soNguoiToiDa} người` : '—'}</span>
                                        <span>•</span>
                                        <span>💰 Giá gốc: {originalPrice ? originalPrice.toLocaleString() + ' ₫/đêm' : 'Liên hệ'}</span>
                                        {discountPercent > 0 && (
                                          <>
                                            <span>•</span>
                                            <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>🎉 Giá KM: {discountedPrice.toLocaleString()} ₫/đêm</span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                      <button onClick={() => toggleExpand(room.idphong)} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}>
                                        {expandedRoom === room.idphong ? '▼ Ẩn chi tiết' : '▶ Xem chi tiết'}
                                      </button>
                                      <button onClick={() => handleQuickBook(room)} disabled={!checkIn || !checkOut} style={{ padding: '8px 14px', borderRadius: 6, background: (checkIn && checkOut) ? 'linear-gradient(135deg,#dfa974 0%,#c8956d 100%)' : '#ccc', color: '#fff', border: 'none', cursor: (checkIn && checkOut) ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: 500 }}>
                                        Đặt ngay
                                      </button>
                                    </div>
                                  </div>

                                  {expandedRoom === room.idphong && (
                                    <div style={{ padding: 16, borderTop: '1px solid #e0e0e0', background: '#fff' }}>
                                      <div style={{ width: '100%', height: 360, overflow: 'hidden', borderRadius: 8, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa' }}>
                                        <img src={room.urlAnhPhong ?? '/img/room/default.webp'} alt={room.tenPhong ?? ''} style={{ width: '100%', height: 360, objectFit: 'contain', display: 'block', borderRadius: 8, background: '#f7f7f7' }} />
                                      </div>
                                      <div>
                                        {room.moTa && <div style={{ marginBottom: 12, color: '#555', fontSize: '14px', lineHeight: 1.5 }}>{room.moTa}</div>}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                                          <div style={{ padding: 12, background: '#f5f7fa', borderRadius: 8, border: '1px solid #e8eff7' }}>
                                            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: '13px', color: '#333' }}>📊 Thông tin</div>
                                            <div style={{ color: '#666', fontSize: '13px', lineHeight: 1.8 }}>
                                              <div>Sức chứa: <strong>{room.soNguoiToiDa ?? '—'} người</strong></div>
                                              {room.soPhong && <div>Số phòng: <strong>{room.soPhong}</strong></div>}
                                              <div>Giá gốc: <strong>{originalPrice ? originalPrice.toLocaleString('vi-VN') + ' ₫' : 'Liên hệ'}</strong></div>
                                              {discountPercent > 0 && <div style={{ color: '#ff4d4f', fontWeight: 'bold' }}>Giá khuyến mãi: <strong>{discountedPrice.toLocaleString('vi-VN')} ₫</strong></div>}
                                            </div>
                                          </div>
                                          <div style={{ padding: 12, background: '#f5f7fa', borderRadius: 8, border: '1px solid #e8eff7' }}>
                                            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: '13px', color: '#333' }}>✨ Tiện ích</div>
                                            <AmenitiesForRoom roomId={room.idphong} />
                                          </div>
                                        </div>
                                        <button onClick={() => handleQuickBook(room)} disabled={!checkIn || !checkOut} style={{ width: '100%', padding: '10px 12px', borderRadius: 6, background: (checkIn && checkOut) ? 'linear-gradient(135deg,#dfa974 0%,#c8956d 100%)' : '#ccc', color: '#fff', border: 'none', cursor: (checkIn && checkOut) ? 'pointer' : 'not-allowed', fontSize: '14px', fontWeight: 600 }}>
                                          💳 Đặt phòng ngay
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </>
                  );
                }
              })()}
            </div>
          </div>
        )}
      </Modal>

      {/* Detail Combo Modal */}
      <DetailComboCard
        visible={detailComboVisible}
        combo={selectedComboDetail}
        onClose={() => {
          setDetailComboVisible(false);
          setSelectedComboDetail(null);
        }}
      />
    </div>
  );
};

function AmenitiesForRoom({ roomId }: { roomId?: string | null }) {
  const [items, setItems] = useState<{ idtienNghi: string; tenTienNghi: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!roomId) {
      setItems([]);
      return;
    }
    setLoading(true);
    getAmenitiesForRoom(roomId)
      .then((data: any) => {
        if (cancelled) return;
        const norm = (data || []).map((d: any) => ({ idtienNghi: d.idtienNghi || d.IdtienNghi || '', tenTienNghi: d.tenTienNghi || d.TenTienNghi || '' }));
        setItems(norm);
      })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [roomId]);

  if (loading) return <div style={{ color: '#666' }}>Loading…</div>;
  if (!items || items.length === 0) return <div style={{ color: '#666' }}>—</div>;
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {items.map((it) => (
        <span key={it.idtienNghi || it.tenTienNghi} style={{ background: '#f1f5f9', color: '#111827', padding: '6px 10px', borderRadius: 999, fontSize: 13, border: '1px solid #e2e8f0' }}>{it.tenTienNghi || it.idtienNghi}</span>
      ))}
    </div>
  );
}

export default PromotionSection;