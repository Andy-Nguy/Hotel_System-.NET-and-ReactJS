import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Alert,
  Modal,
  ScrollView,
} from "react-native";
import { Image } from "expo-image";
import { useNavigation, useRoute } from "@react-navigation/native";
import AppIcon from "../components/AppIcon";
import { COLORS, SIZES, FONTS, SHADOWS } from "../constants/theme";
import { DEFAULT_BASE_URL } from "../config/apiConfig";
import BookingProgress from "../components/BookingProgress";

type Service = {
  iddichVu: string;
  tenDichVu: string;
  tienDichVu: number;
  hinhDichVu?: string;
  thoiGianBatDau?: string;
  thoiGianKetThuc?: string;
  trangThai?: string;
  idttdichVu?: string;
  thongTinDv?: string;
  thoiLuongUocTinh?: number;
  ghiChu?: string;
};

type SelectedService = {
  serviceId: string;
  serviceName: string;
  price: number;
  quantity: number;
};

const ServicesSelectionScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { selectedRooms, checkIn, checkOut, guests, rooms } =
    route.params as any;

  const [services, setServices] = useState<Service[]>([]);
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedServiceDetail, setSelectedServiceDetail] =
    useState<Service | null>(null);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${DEFAULT_BASE_URL}/api/dich-vu/lay-danh-sach`
      );
      if (response.ok) {
        const data = await response.json();
        setServices(data);
      } else {
        // Fallback to mock data
        const mockServices: Service[] = [
          {
            iddichVu: "DV001",
            tenDichVu: "Spa thư giãn",
            tienDichVu: 500000,
            trangThai: "Đang hoạt động",
            thongTinDv:
              "Dịch vụ spa thư giãn toàn thân với các liệu pháp massage chuyên nghiệp.",
            ghiChu: "Thời gian: 60 phút",
          },
          {
            iddichVu: "DV002",
            tenDichVu: "Hồ bơi",
            tienDichVu: 200000,
            trangThai: "Đang hoạt động",
            thongTinDv: "Truy cập hồ bơi vô cực với view biển tuyệt đẹp.",
            ghiChu: "Miễn phí cho khách lưu trú",
          },
          {
            iddichVu: "DV003",
            tenDichVu: "Gym",
            tienDichVu: 150000,
            trangThai: "Đang hoạt động",
            thongTinDv: "Phòng gym hiện đại với trang thiết bị chuyên nghiệp.",
            ghiChu: "Mở cửa 24/7",
          },
          {
            iddichVu: "DV004",
            tenDichVu: "Ăn sáng",
            tienDichVu: 100000,
            trangThai: "Đang hoạt động",
            thongTinDv: "Buffet sáng đa dạng các món Á - Âu.",
            ghiChu: "6:00 - 10:00",
          },
        ];
        setServices(mockServices);
      }
    } catch (error) {
      console.error("Error loading services:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuantityChange = (
    service: Service,
    change: number
  ) => {
    const existing = selectedServices.find(
      (s) => s.serviceId === service.iddichVu
    );
    const currentQty = existing ? existing.quantity : 0;
    const newQty = Math.max(0, currentQty + change);

    if (newQty === 0) {
      setSelectedServices(
        selectedServices.filter((s) => s.serviceId !== service.iddichVu)
      );
    } else {
      if (existing) {
        setSelectedServices(
          selectedServices.map((s) =>
            s.serviceId === service.iddichVu ? { ...s, quantity: newQty } : s
          )
        );
      } else {
        setSelectedServices([
          ...selectedServices,
          {
            serviceId: service.iddichVu,
            serviceName: service.tenDichVu,
            price: service.tienDichVu,
            quantity: newQty,
          },
        ]);
      }
    }
  };

  const calculateTotal = () => {
    return selectedServices.reduce(
      (sum, s) => sum + s.price * s.quantity,
      0
    );
  };

  const handleProceed = () => {
    (navigation as any).navigate("Checkout", {
      selectedRooms,
      selectedServices,
      checkIn,
      checkOut,
      guests,
      rooms,
    });
  };

  const openServiceDetail = (service: Service) => {
    setSelectedServiceDetail(service);
    setDetailModalVisible(true);
  };

  const closeServiceDetail = () => {
    setDetailModalVisible(false);
    setSelectedServiceDetail(null);
  };

  const renderServiceItem = ({ item }: { item: Service }) => {
    const selected = selectedServices.find((s) => s.serviceId === item.iddichVu);
    const quantity = selected ? selected.quantity : 0;

    return (
      <TouchableOpacity
        style={styles.serviceCard}
        onPress={() => openServiceDetail(item)}
        activeOpacity={0.9}
      >
        <View style={styles.serviceImageContainer}>
          {item.hinhDichVu ? (
            <Image
              source={{ uri: item.hinhDichVu }}
              style={styles.serviceImage}
              contentFit="cover"
            />
          ) : (
            <View style={styles.serviceImagePlaceholder}>
              <AppIcon name="star" size={24} color={COLORS.gray} />
            </View>
          )}
        </View>

        <View style={styles.serviceContent}>
          <Text style={styles.serviceName}>{item.tenDichVu}</Text>
          <Text style={styles.servicePrice}>
            {item.tienDichVu.toLocaleString()}đ
          </Text>
          {item.ghiChu && (
            <Text style={styles.serviceNote} numberOfLines={1}>
              {item.ghiChu}
            </Text>
          )}
        </View>

        <View style={styles.quantityControl}>
          {quantity > 0 ? (
            <>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={(e) => {
                  e.stopPropagation();
                  handleQuantityChange(item, -1);
                }}
              >
                <AppIcon name="minus" size={12} color={COLORS.secondary} />
              </TouchableOpacity>
              <Text style={styles.qtyText}>{quantity}</Text>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={(e) => {
                  e.stopPropagation();
                  handleQuantityChange(item, 1);
                }}
              >
                <AppIcon name="plus" size={12} color={COLORS.secondary} />
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={styles.addBtn}
              onPress={(e) => {
                e.stopPropagation();
                handleQuantityChange(item, 1);
              }}
            >
              <AppIcon name="plus" size={16} color={COLORS.white} />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <AppIcon name="arrow-left" size={24} color={COLORS.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dịch vụ thêm</Text>
        <View style={{ width: 40 }} />
      </View>

      <BookingProgress
        currentStage="services"
        totalRooms={rooms}
        currentRoom={rooms} // Finished room selection
        selectedRoomNumbers={selectedRooms.map((sr: any) => sr.roomNumber)}
      />

      <ScrollView 
        style={styles.scrollContent} 
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.introSection}>
          <Text style={styles.introTitle}>Trải nghiệm trọn vẹn</Text>
          <Text style={styles.introText}>
            Chọn thêm các dịch vụ tiện ích để kỳ nghỉ của bạn thêm phần hoàn hảo.
          </Text>
        </View>

        <FlatList
          data={services}
          renderItem={renderServiceItem}
          keyExtractor={(item) => item.iddichVu}
          scrollEnabled={false}
          contentContainerStyle={{ paddingHorizontal: SIZES.padding }}
        />
      </ScrollView>

      <View style={styles.bottomBar}>
        <View style={styles.totalContainer}>
          <Text style={styles.totalLabel}>Tổng dịch vụ</Text>
          <Text style={styles.totalPrice}>
            {calculateTotal().toLocaleString()}đ
          </Text>
        </View>
        <TouchableOpacity style={styles.proceedButton} onPress={handleProceed}>
          <Text style={styles.proceedButtonText}>Tiếp tục</Text>
          <AppIcon name="arrow-right" size={20} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {/* Service Detail Modal */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeServiceDetail}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chi tiết dịch vụ</Text>
              <TouchableOpacity
                onPress={closeServiceDetail}
                style={styles.closeButton}
              >
                <AppIcon name="close" size={24} color={COLORS.secondary} />
              </TouchableOpacity>
            </View>

            {selectedServiceDetail && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.modalImageContainer}>
                  {selectedServiceDetail.hinhDichVu ? (
                    <Image
                      source={{ uri: selectedServiceDetail.hinhDichVu }}
                      style={styles.modalImage}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={styles.modalImagePlaceholder}>
                      <Text style={styles.modalImagePlaceholderText}>✨</Text>
                    </View>
                  )}
                </View>

                <View style={styles.modalInfo}>
                  <Text style={styles.modalServiceName}>
                    {selectedServiceDetail.tenDichVu}
                  </Text>
                  <Text style={styles.modalServicePrice}>
                    {selectedServiceDetail.tienDichVu.toLocaleString()}đ
                  </Text>

                  <View style={styles.divider} />

                  <Text style={styles.modalSectionTitle}>Mô tả</Text>
                  <Text style={styles.modalDescription}>
                    {selectedServiceDetail.thongTinDv || "Chưa có mô tả chi tiết."}
                  </Text>

                  {selectedServiceDetail.ghiChu && (
                    <View style={styles.noteContainer}>
                      <AppIcon name="info" size={16} color={COLORS.primary} />
                      <Text style={styles.noteText}>
                        {selectedServiceDetail.ghiChu}
                      </Text>
                    </View>
                  )}
                </View>
              </ScrollView>
            )}

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={closeServiceDetail}
              >
                <Text style={styles.modalCloseText}>Đóng</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
    backgroundColor: COLORS.white,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#F5F5F5",
  },
  headerTitle: {
    ...FONTS.h3,
    fontWeight: "700",
    color: COLORS.secondary,
  },
  scrollContent: {
    flex: 1,
  },
  introSection: {
    padding: SIZES.padding,
    marginBottom: 8,
  },
  introTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.secondary,
    marginBottom: 8,
  },
  introText: {
    fontSize: 14,
    color: COLORS.gray,
    lineHeight: 20,
  },
  serviceCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    ...SHADOWS.light,
  },
  serviceImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: "#F8F9FA",
    overflow: "hidden",
    marginRight: 16,
  },
  serviceImage: {
    width: "100%",
    height: "100%",
  },
  serviceImagePlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  serviceContent: {
    flex: 1,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.secondary,
    marginBottom: 4,
  },
  servicePrice: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.primary,
  },
  serviceNote: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2,
  },
  quantityControl: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F8F9FA",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E9ECEF",
  },
  qtyText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.secondary,
    minWidth: 16,
    textAlign: "center",
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    padding: 20,
    paddingBottom: 34,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    ...SHADOWS.dark,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  totalContainer: {
    flex: 1,
  },
  totalLabel: {
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 2,
  },
  totalPrice: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.primary,
  },
  proceedButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  proceedButtonText: {
    fontSize: 16,
    color: COLORS.white,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    height: "80%",
    ...SHADOWS.dark,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F3F5",
  },
  modalTitle: {
    ...FONTS.h3,
    color: COLORS.secondary,
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    flex: 1,
  },
  modalImageContainer: {
    width: "100%",
    height: 250,
    backgroundColor: "#F8F9FA",
  },
  modalImage: {
    width: "100%",
    height: "100%",
  },
  modalImagePlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  modalImagePlaceholderText: {
    fontSize: 64,
  },
  modalInfo: {
    padding: 24,
  },
  modalServiceName: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.secondary,
    marginBottom: 8,
  },
  modalServicePrice: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.primary,
    marginBottom: 24,
  },
  divider: {
    height: 1,
    backgroundColor: "#F1F3F5",
    marginBottom: 24,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.secondary,
    marginBottom: 12,
  },
  modalDescription: {
    fontSize: 15,
    color: COLORS.gray,
    lineHeight: 24,
    marginBottom: 24,
  },
  noteContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF9F2",
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  noteText: {
    fontSize: 13,
    color: COLORS.secondary,
    flex: 1,
  },
  modalFooter: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: "#F1F3F5",
    backgroundColor: COLORS.white,
  },
  modalCloseButton: {
    backgroundColor: "#F1F3F5",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.secondary,
  },
});

export default ServicesSelectionScreen;
