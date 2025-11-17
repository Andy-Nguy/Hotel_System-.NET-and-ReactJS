import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Alert,
  Image,
  Modal,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import AppIcon from "../components/AppIcon";
import { COLORS, SIZES, FONTS } from "../constants/theme";
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
      // TODO: Replace with actual API call
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
            thongTinDv: "Bữa sáng buffet với đa dạng món ăn Á - Âu.",
            ghiChu: "06:30 - 10:00",
          },
        ];
        setServices(mockServices);
      }
    } catch (error) {
      console.error("Error loading services:", error);
      Alert.alert("Lỗi", "Không thể tải danh sách dịch vụ");
    } finally {
      setLoading(false);
    }
  };

  const isAvailable = (status?: string) => {
    if (!status) return true;
    const s = status.toLowerCase();
    return (
      !s.includes("ngưng") && !s.includes("inactive") && !s.includes("không")
    );
  };

  const toggleSelect = (svc: Service) => {
    const idx = selectedServices.findIndex((s) => s.serviceId === svc.iddichVu);
    if (idx >= 0) {
      setSelectedServices(
        selectedServices.map((s) =>
          s.serviceId === svc.iddichVu ? { ...s, quantity: s.quantity + 1 } : s
        )
      );
    } else {
      setSelectedServices([
        ...selectedServices,
        {
          serviceId: svc.iddichVu,
          serviceName: svc.tenDichVu,
          price: svc.tienDichVu,
          quantity: 1,
        },
      ]);
    }
  };

  const removeService = (serviceId: string) => {
    setSelectedServices(
      selectedServices.filter((s) => s.serviceId !== serviceId)
    );
  };

  const setQuantity = (serviceId: string, qty: number) => {
    if (qty <= 0) {
      removeService(serviceId);
      return;
    }
    setSelectedServices(
      selectedServices.map((s) =>
        s.serviceId === serviceId ? { ...s, quantity: qty } : s
      )
    );
  };

  const openDetail = (svc: Service) => {
    setSelectedServiceDetail(svc);
    setDetailModalVisible(true);
  };

  const calculateTotalServices = () => {
    return selectedServices.reduce((total, service) => {
      const price = typeof service.price === "number" ? service.price : 0;
      const quantity =
        typeof service.quantity === "number" ? service.quantity : 1;
      return total + price * quantity;
    }, 0);
  };

  const calculateTotalRooms = () => {
    return selectedRooms.reduce((total: number, room: any) => {
      const nights = Math.ceil(
        (new Date(checkOut).getTime() - new Date(checkIn).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      const price = room.discountedPrice || room.basePricePerNight || 0;
      return total + (typeof price === "number" ? price : 0) * nights;
    }, 0);
  };

  const handleContinueToCheckout = () => {
    (navigation as any).navigate("Checkout", {
      selectedServices,
    });
  };

  const renderServiceItem = ({ item }: { item: Service }) => {
    const isSelected = selectedServices.some(
      (s) => s.serviceId === item.iddichVu
    );
    const selectedService = selectedServices.find(
      (s) => s.serviceId === item.iddichVu
    );

    return (
      <View style={styles.serviceCard}>
        <View style={styles.serviceImageContainer}>
          <Image
            source={{
              uri:
                item.hinhDichVu ||
                "https://via.placeholder.com/100x100?text=Service",
            }}
            style={styles.serviceImage}
          />
        </View>

        <View style={styles.serviceContent}>
          <Text style={styles.serviceName}>
            {String(item.tenDichVu || "Dịch vụ")}
          </Text>
          <Text style={styles.servicePrice}>
            $
            {typeof item.tienDichVu === "number"
              ? item.tienDichVu.toLocaleString()
              : "0"}
            /lần
          </Text>

          {item.thongTinDv && (
            <Text style={styles.serviceDescription} numberOfLines={2}>
              {String(item.thongTinDv)}
            </Text>
          )}

          <View style={styles.serviceActions}>
            <TouchableOpacity
              style={styles.detailButton}
              onPress={() => openDetail(item)}
            >
              <Text style={styles.detailButtonText}>Chi tiết</Text>
            </TouchableOpacity>

            {!isSelected ? (
              <TouchableOpacity
                style={styles.selectButton}
                onPress={() => toggleSelect(item)}
              >
                <Text style={styles.selectButtonText}>Chọn</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.quantityControls}>
                <TouchableOpacity
                  style={styles.qtyButton}
                  onPress={() =>
                    setQuantity(
                      item.iddichVu,
                      (selectedService?.quantity || 1) - 1
                    )
                  }
                >
                  <Text style={styles.qtyButtonText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.quantityText}>
                  {selectedService?.quantity || 1}
                </Text>
                <TouchableOpacity
                  style={styles.qtyButton}
                  onPress={() =>
                    setQuantity(
                      item.iddichVu,
                      (selectedService?.quantity || 1) + 1
                    )
                  }
                >
                  <Text style={styles.qtyButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  const availableServices = services.filter((s) => isAvailable(s.trangThai));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <AppIcon name="arrow-left" size={20} color={COLORS.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chọn dịch vụ</Text>
        <View style={{ width: 20 }} />
      </View>

      <BookingProgress currentStage="services" />

      <View style={styles.summarySection}>
        <Text style={styles.summaryTitle}>Tóm tắt đặt phòng</Text>
        <Text style={styles.summaryText}>
          Nhận phòng: {new Date(checkIn).toLocaleDateString("vi-VN")} - Trả
          phòng: {new Date(checkOut).toLocaleDateString("vi-VN")}
        </Text>
        <Text style={styles.summaryText}>
          {selectedRooms.length} phòng, {guests} khách
        </Text>
      </View>

      <View style={styles.servicesSection}>
        <Text style={styles.sectionTitle}>
          Dịch vụ có sẵn ({availableServices.length})
        </Text>

        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Đang tải dịch vụ...</Text>
          </View>
        ) : availableServices.length > 0 ? (
          <FlatList
            data={availableServices}
            renderItem={renderServiceItem}
            keyExtractor={(item) => item.iddichVu}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.servicesList}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Không có dịch vụ nào</Text>
              </View>
            }
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Không có dịch vụ nào</Text>
          </View>
        )}
      </View>

      {selectedServices.length > 0 && (
        <View style={styles.selectedServicesSection}>
          <Text style={styles.selectedTitle}>Dịch vụ đã chọn</Text>
          {selectedServices.map((service) => (
            <View key={service.serviceId} style={styles.selectedServiceItem}>
              <View style={styles.selectedServiceInfo}>
                <Text style={styles.selectedServiceName}>
                  {String(service.serviceName || "Dịch vụ")}
                </Text>
                <Text style={styles.selectedServicePrice}>
                  $
                  {typeof service.price === "number"
                    ? service.price.toLocaleString()
                    : "0"}{" "}
                  x {service.quantity || 1}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => removeService(service.serviceId)}
                style={styles.removeButton}
              >
                <AppIcon name="trash" size={16} color={COLORS.error} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <View style={styles.totalSection}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Tổng tiền phòng:</Text>
          <Text style={styles.totalAmount}>
            ${calculateTotalRooms().toLocaleString()}
          </Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Tổng tiền dịch vụ:</Text>
          <Text style={styles.totalAmount}>
            ${calculateTotalServices().toLocaleString()}
          </Text>
        </View>
        <View style={[styles.totalRow, styles.grandTotal]}>
          <Text style={styles.grandTotalLabel}>Tổng cộng:</Text>
          <Text style={styles.grandTotalAmount}>
            $
            {(
              calculateTotalRooms() + calculateTotalServices()
            ).toLocaleString()}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.continueButton}
          onPress={handleContinueToCheckout}
        >
          <Text style={styles.continueButtonText}>
            Tiếp tục ({selectedServices.length} dịch vụ)
          </Text>
        </TouchableOpacity>
      </View>

      {/* Service Detail Modal */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chi tiết dịch vụ</Text>
              <TouchableOpacity
                onPress={() => setDetailModalVisible(false)}
                style={styles.closeButton}
              >
                <AppIcon name="close" size={24} color={COLORS.secondary} />
              </TouchableOpacity>
            </View>

            {selectedServiceDetail && (
              <View style={styles.modalBody}>
                <Image
                  source={{
                    uri:
                      selectedServiceDetail.hinhDichVu ||
                      "https://via.placeholder.com/200x150?text=Service",
                  }}
                  style={styles.modalImage}
                />

                <Text style={styles.modalServiceName}>
                  {String(selectedServiceDetail.tenDichVu || "Dịch vụ")}
                </Text>
                <Text style={styles.modalServicePrice}>
                  $
                  {typeof selectedServiceDetail.tienDichVu === "number"
                    ? selectedServiceDetail.tienDichVu.toLocaleString()
                    : "0"}
                  /lần
                </Text>

                {selectedServiceDetail.thongTinDv && (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Mô tả:</Text>
                    <Text style={styles.modalSectionText}>
                      {String(selectedServiceDetail.thongTinDv)}
                    </Text>
                  </View>
                )}

                {selectedServiceDetail.ghiChu && (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Ghi chú:</Text>
                    <Text style={styles.modalSectionText}>
                      {String(selectedServiceDetail.ghiChu)}
                    </Text>
                  </View>
                )}
              </View>
            )}

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setDetailModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Đóng</Text>
              </TouchableOpacity>
              {selectedServiceDetail && (
                <TouchableOpacity
                  style={styles.modalSelectButton}
                  onPress={() => {
                    toggleSelect(selectedServiceDetail);
                    setDetailModalVisible(false);
                  }}
                >
                  <Text style={styles.modalSelectText}>Chọn dịch vụ</Text>
                </TouchableOpacity>
              )}
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
    backgroundColor: "#f5f5f5",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    ...FONTS.h2,
    fontWeight: "700",
    color: COLORS.secondary,
  },
  summarySection: {
    backgroundColor: COLORS.white,
    margin: SIZES.padding,
    padding: SIZES.padding,
    borderRadius: 12,
  },
  summaryTitle: {
    ...FONTS.h3,
    fontWeight: "600",
    color: COLORS.secondary,
    marginBottom: 8,
  },
  summaryText: {
    ...FONTS.body4,
    color: COLORS.gray,
    marginBottom: 4,
  },
  servicesSection: {
    flex: 1,
    paddingHorizontal: SIZES.padding,
  },
  sectionTitle: {
    ...FONTS.h3,
    fontWeight: "600",
    color: COLORS.secondary,
    marginBottom: SIZES.padding,
  },
  servicesList: {
    paddingBottom: SIZES.padding,
  },
  serviceCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SIZES.padding,
    marginBottom: 12,
    flexDirection: "row",
    ...{
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
  },
  serviceImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: "hidden",
    marginRight: SIZES.padding,
  },
  serviceImage: {
    width: "100%",
    height: "100%",
  },
  serviceContent: {
    flex: 1,
  },
  serviceName: {
    ...FONTS.body3,
    fontWeight: "600",
    color: COLORS.secondary,
    marginBottom: 4,
  },
  servicePrice: {
    ...FONTS.body4,
    color: COLORS.primary,
    fontWeight: "600",
    marginBottom: 8,
  },
  serviceDescription: {
    ...FONTS.body4,
    color: COLORS.gray,
    lineHeight: 18,
    marginBottom: 12,
  },
  serviceActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  detailButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 6,
  },
  detailButtonText: {
    ...FONTS.body4,
    color: COLORS.primary,
    fontWeight: "600",
  },
  selectButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  selectButtonText: {
    ...FONTS.body4,
    color: COLORS.white,
    fontWeight: "600",
  },
  quantityControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  qtyButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.lightGray,
    justifyContent: "center",
    alignItems: "center",
  },
  qtyButtonText: {
    ...FONTS.body3,
    color: COLORS.secondary,
    fontWeight: "600",
  },
  quantityText: {
    ...FONTS.body3,
    color: COLORS.secondary,
    minWidth: 20,
    textAlign: "center",
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: SIZES.padding * 3,
  },
  loadingText: {
    ...FONTS.body3,
    color: COLORS.gray,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: SIZES.padding * 3,
  },
  emptyText: {
    ...FONTS.h4,
    color: COLORS.gray,
  },
  selectedServicesSection: {
    backgroundColor: COLORS.white,
    marginHorizontal: SIZES.padding,
    marginBottom: SIZES.padding,
    padding: SIZES.padding,
    borderRadius: 12,
  },
  selectedTitle: {
    ...FONTS.h4,
    fontWeight: "600",
    color: COLORS.secondary,
    marginBottom: 12,
  },
  selectedServiceItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  selectedServiceInfo: {
    flex: 1,
  },
  selectedServiceName: {
    ...FONTS.body4,
    color: COLORS.secondary,
    marginBottom: 2,
  },
  selectedServicePrice: {
    ...FONTS.body4,
    color: COLORS.gray,
  },
  removeButton: {
    padding: 8,
  },
  totalSection: {
    backgroundColor: COLORS.white,
    margin: SIZES.padding,
    padding: SIZES.padding,
    borderRadius: 12,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  totalLabel: {
    ...FONTS.body4,
    color: COLORS.secondary,
  },
  totalAmount: {
    ...FONTS.body4,
    color: COLORS.primary,
    fontWeight: "600",
  },
  grandTotal: {
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
    paddingTop: 12,
    marginTop: 8,
  },
  grandTotalLabel: {
    ...FONTS.body3,
    fontWeight: "600",
    color: COLORS.secondary,
  },
  grandTotalAmount: {
    ...FONTS.h3,
    fontWeight: "700",
    color: COLORS.primary,
  },
  continueButton: {
    backgroundColor: "#d47153ff",
    paddingVertical: SIZES.padding,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
  continueButtonText: {
    ...FONTS.h4,
    color: COLORS.white,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    width: "90%",
    maxHeight: "80%",
    ...{
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5,
    },
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  modalTitle: {
    ...FONTS.h2,
    fontWeight: "700",
    color: COLORS.secondary,
  },
  closeButton: {
    padding: 8,
  },
  modalBody: {
    padding: SIZES.padding,
  },
  modalImage: {
    width: "100%",
    height: 150,
    borderRadius: 8,
    marginBottom: SIZES.padding,
  },
  modalServiceName: {
    ...FONTS.h3,
    fontWeight: "700",
    color: COLORS.secondary,
    marginBottom: 8,
  },
  modalServicePrice: {
    ...FONTS.h4,
    fontWeight: "600",
    color: COLORS.primary,
    marginBottom: SIZES.padding,
  },
  modalSection: {
    marginBottom: SIZES.padding,
  },
  modalSectionTitle: {
    ...FONTS.body3,
    fontWeight: "600",
    color: COLORS.secondary,
    marginBottom: 4,
  },
  modalSectionText: {
    ...FONTS.body4,
    color: COLORS.gray,
    lineHeight: 20,
  },
  modalFooter: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: SIZES.padding,
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: COLORS.lightGray,
  },
  modalCancelText: {
    ...FONTS.h4,
    color: COLORS.gray,
    fontWeight: "600",
  },
  modalSelectButton: {
    flex: 1,
    paddingVertical: SIZES.padding,
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 12,
  },
  modalSelectText: {
    ...FONTS.h4,
    color: COLORS.white,
    fontWeight: "600",
  },
});

export default ServicesSelectionScreen;
