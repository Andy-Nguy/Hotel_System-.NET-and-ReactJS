import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Modal,
  Image,
  StyleSheet,
  Alert,
} from "react-native";
import { COLORS, SIZES, FONTS } from "../constants/theme";
import AppIcon from "./AppIcon";

type Service = {
  id: string;
  HinhDichVu?: string;
  TenDichVu: string;
  TienDichVu: number;
  TrangThai?: string;
  thongTinDv?: string;
  ghiChu?: string;
};

type SelectedService = {
  serviceId: string;
  serviceName: string;
  price: number;
  quantity: number;
};

interface ServicesSelectorProps {
  onServicesChange?: (services: SelectedService[], total: number) => void;
}

const ServicesSelector: React.FC<ServicesSelectorProps> = ({
  onServicesChange,
}) => {
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>(
    []
  );
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedServiceDetail, setSelectedServiceDetail] =
    useState<Service | null>(null);

  useEffect(() => {
    loadServices();
  }, []);

  useEffect(() => {
    const total = selectedServices.reduce(
      (s, it) => s + it.price * it.quantity,
      0
    );
    onServicesChange?.(selectedServices, total);
  }, [selectedServices, onServicesChange]);

  const loadServices = async () => {
    setLoading(true);
    try {
      // Mock data for now - replace with actual API call
      const mockServices: Service[] = [
        {
          id: "1",
          TenDichVu: "Spa thư giãn",
          TienDichVu: 500000,
          TrangThai: "active",
          thongTinDv:
            "Dịch vụ spa thư giãn toàn thân với các liệu pháp massage chuyên nghiệp.",
          ghiChu: "Thời gian: 60 phút",
        },
        {
          id: "2",
          TenDichVu: "Hồ bơi",
          TienDichVu: 200000,
          TrangThai: "active",
          thongTinDv: "Truy cập hồ bơi vô cực với view biển tuyệt đẹp.",
          ghiChu: "Miễn phí cho khách lưu trú",
        },
        {
          id: "3",
          TenDichVu: "Gym",
          TienDichVu: 150000,
          TrangThai: "active",
          thongTinDv: "Phòng gym hiện đại với trang thiết bị chuyên nghiệp.",
          ghiChu: "Mở cửa 24/7",
        },
        {
          id: "4",
          TenDichVu: "Ăn sáng",
          TienDichVu: 100000,
          TrangThai: "active",
          thongTinDv: "Bữa sáng buffet với đa dạng món ăn Á - Âu.",
          ghiChu: "06:30 - 10:00",
        },
      ];
      setServices(mockServices);
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
    const idx = selectedServices.findIndex((s) => s.serviceId === svc.id);
    if (idx >= 0) {
      setSelectedServices(
        selectedServices.map((s) =>
          s.serviceId === svc.id ? { ...s, quantity: s.quantity + 1 } : s
        )
      );
    } else {
      setSelectedServices([
        ...selectedServices,
        {
          serviceId: svc.id,
          serviceName: svc.TenDichVu,
          price: svc.TienDichVu,
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

  const totalPrice = selectedServices.reduce(
    (s, it) => s + it.price * it.quantity,
    0
  );
  const available = services.filter((s) => isAvailable(s.TrangThai));

  const renderServiceItem = ({ item }: { item: Service }) => {
    const isSelected = selectedServices.some((s) => s.serviceId === item.id);
    return (
      <View style={styles.serviceItem}>
        <View style={styles.serviceImage}>
          <Image
            source={{
              uri:
                item.HinhDichVu ||
                "https://via.placeholder.com/80x80?text=Service",
            }}
            style={styles.image}
          />
        </View>
        <View style={styles.serviceContent}>
          <Text style={styles.serviceName}>{item.TenDichVu}</Text>
          <Text style={styles.servicePrice}>
            ${item.TienDichVu.toLocaleString()}/lần
          </Text>
        </View>
        <View style={styles.serviceActions}>
          <TouchableOpacity
            style={styles.detailButton}
            onPress={() => openDetail(item)}
          >
            <Text style={styles.detailButtonText}>Chi tiết</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.selectButton,
              isSelected && styles.selectButtonSelected,
            ]}
            onPress={() => toggleSelect(item)}
          >
            <Text
              style={[
                styles.selectButtonText,
                isSelected && styles.selectButtonTextSelected,
              ]}
            >
              {isSelected ? "✓ Đã chọn" : "Chọn"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderSelectedService = ({ item }: { item: SelectedService }) => (
    <View style={styles.selectedItem}>
      <View style={styles.selectedInfo}>
        <Text style={styles.selectedName}>{item.serviceName}</Text>
        <Text style={styles.selectedPrice}>
          ${item.price.toLocaleString()} x {item.quantity}
        </Text>
      </View>
      <View style={styles.selectedActions}>
        <TouchableOpacity
          style={styles.qtyButton}
          onPress={() => setQuantity(item.serviceId, item.quantity - 1)}
        >
          <Text style={styles.qtyButtonText}>-</Text>
        </TouchableOpacity>
        <Text style={styles.qtyText}>{item.quantity}</Text>
        <TouchableOpacity
          style={styles.qtyButton}
          onPress={() => setQuantity(item.serviceId, item.quantity + 1)}
        >
          <Text style={styles.qtyButtonText}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => removeService(item.serviceId)}
        >
          <AppIcon name="trash" size={16} color={COLORS.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View>
      <TouchableOpacity
        style={styles.toggleButton}
        onPress={() => setOpen(!open)}
      >
        <AppIcon
          name={open ? "minus" : "plus"}
          size={16}
          color={COLORS.primary}
        />
        <Text style={styles.toggleText}>
          Thêm dịch vụ
          {selectedServices.length > 0 && (
            <Text style={styles.badge}> ({selectedServices.length})</Text>
          )}
        </Text>
      </TouchableOpacity>

      {open && (
        <View style={styles.dropdown}>
          {loading ? (
            <Text style={styles.loadingText}>Đang tải dịch vụ...</Text>
          ) : available.length === 0 ? (
            <Text style={styles.emptyText}>Không có dịch vụ nào</Text>
          ) : (
            <FlatList
              data={available}
              renderItem={renderServiceItem}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      )}

      {selectedServices.length > 0 && (
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>Dịch vụ đã chọn</Text>
          <FlatList
            data={selectedServices}
            renderItem={renderSelectedService}
            keyExtractor={(item) => item.serviceId}
            showsVerticalScrollIndicator={false}
          />
          <View style={styles.total}>
            <Text style={styles.totalLabel}>Tổng dịch vụ:</Text>
            <Text style={styles.totalAmount}>
              ${totalPrice.toLocaleString()}
            </Text>
          </View>
        </View>
      )}

      <Modal
        visible={detailModalVisible}
        onRequestClose={() => setDetailModalVisible(false)}
        transparent
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setDetailModalVisible(false)}
            >
              <AppIcon name="times" size={20} color={COLORS.secondary} />
            </TouchableOpacity>

            {selectedServiceDetail && (
              <View style={styles.modalBody}>
                <Image
                  source={{
                    uri:
                      selectedServiceDetail.HinhDichVu ||
                      "https://via.placeholder.com/200x150?text=Service",
                  }}
                  style={styles.modalImage}
                />
                <Text style={styles.modalTitle}>
                  {selectedServiceDetail.TenDichVu}
                </Text>
                <Text style={styles.modalPrice}>
                  ${selectedServiceDetail.TienDichVu.toLocaleString()}/lần
                </Text>

                {selectedServiceDetail.thongTinDv && (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Mô tả:</Text>
                    <Text style={styles.modalSectionText}>
                      {selectedServiceDetail.thongTinDv}
                    </Text>
                  </View>
                )}

                {selectedServiceDetail.ghiChu && (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Ghi chú:</Text>
                    <Text style={styles.modalSectionText}>
                      {selectedServiceDetail.ghiChu}
                    </Text>
                  </View>
                )}

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalAddButton}
                    onPress={() => {
                      toggleSelect(selectedServiceDetail);
                      setDetailModalVisible(false);
                    }}
                  >
                    <Text style={styles.modalAddButtonText}>Thêm vào</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalCloseButton}
                    onPress={() => setDetailModalVisible(false)}
                  >
                    <Text style={styles.modalCloseButtonText}>Đóng</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  toggleButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: SIZES.padding,
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },
  toggleText: {
    ...FONTS.body3,
    color: COLORS.secondary,
    marginLeft: 8,
    flex: 1,
  },
  badge: {
    color: COLORS.primary,
    fontWeight: "600",
  },
  dropdown: {
    marginTop: 8,
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    maxHeight: 300,
  },
  loadingText: {
    ...FONTS.body3,
    color: COLORS.gray,
    textAlign: "center",
    padding: SIZES.padding,
  },
  emptyText: {
    ...FONTS.body3,
    color: COLORS.gray,
    textAlign: "center",
    padding: SIZES.padding,
  },
  serviceItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  serviceImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: "hidden",
    marginRight: 12,
  },
  image: {
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
    color: COLORS.gray,
  },
  serviceActions: {
    flexDirection: "row",
    gap: 8,
  },
  detailButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 4,
  },
  detailButtonText: {
    ...FONTS.body4,
    color: COLORS.primary,
  },
  selectButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.lightGray,
    borderRadius: 4,
  },
  selectButtonSelected: {
    backgroundColor: COLORS.primary,
  },
  selectButtonText: {
    ...FONTS.body4,
    color: COLORS.white,
  },
  selectButtonTextSelected: {
    color: COLORS.white,
  },
  summary: {
    marginTop: 16,
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    padding: SIZES.padding,
  },
  summaryTitle: {
    ...FONTS.body3,
    fontWeight: "600",
    color: COLORS.secondary,
    marginBottom: 12,
  },
  selectedItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  selectedInfo: {
    flex: 1,
  },
  selectedName: {
    ...FONTS.body4,
    color: COLORS.secondary,
    marginBottom: 2,
  },
  selectedPrice: {
    ...FONTS.body4,
    color: COLORS.gray,
  },
  selectedActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  qtyButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.lightGray,
    justifyContent: "center",
    alignItems: "center",
  },
  qtyButtonText: {
    ...FONTS.body3,
    color: COLORS.secondary,
    fontWeight: "600",
  },
  qtyText: {
    ...FONTS.body3,
    color: COLORS.secondary,
    minWidth: 20,
    textAlign: "center",
  },
  removeButton: {
    padding: 4,
  },
  total: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
  },
  totalLabel: {
    ...FONTS.body3,
    fontWeight: "600",
    color: COLORS.secondary,
  },
  totalAmount: {
    ...FONTS.h4,
    fontWeight: "700",
    color: COLORS.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    margin: SIZES.padding,
    maxHeight: "80%",
    width: "90%",
  },
  closeButton: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 1,
  },
  modalBody: {
    padding: SIZES.padding * 2,
  },
  modalImage: {
    width: "100%",
    height: 150,
    borderRadius: 8,
    marginBottom: SIZES.padding,
  },
  modalTitle: {
    ...FONTS.h3,
    fontWeight: "700",
    color: COLORS.secondary,
    marginBottom: 8,
  },
  modalPrice: {
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
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: SIZES.padding,
  },
  modalAddButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  modalAddButtonText: {
    ...FONTS.body3,
    color: COLORS.white,
    fontWeight: "600",
  },
  modalCloseButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  modalCloseButtonText: {
    ...FONTS.body3,
    color: COLORS.secondary,
  },
});

export default ServicesSelector;
