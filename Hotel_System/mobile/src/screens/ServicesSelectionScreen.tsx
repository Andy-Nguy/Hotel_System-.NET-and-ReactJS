import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  ScrollView,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useNavigation, useRoute } from "@react-navigation/native";
import AppIcon from "../components/AppIcon";
import { COLORS, SIZES, FONTS, SHADOWS } from "../constants/theme";
import { DEFAULT_BASE_URL, buildApiUrl } from "../config/apiConfig";
import BookingProgress from "../components/BookingProgress";
import HeaderScreen from "../components/HeaderScreen";

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

type Combo = {
  idCombo: string;
  tenCombo: string;
  moTa?: string;
  giaCombo: number;
  dichVus: Array<{
    iddichVu: string;
    tenDichVu: string;
    tienDichVu: number;
    hinhDichVu?: string;
  }>;
  trangThai?: string;
  hinhAnhCombo?: string;
};

type SelectedCombo = {
  comboId: string;
  comboName: string;
  price: number;
  serviceIds: string[];
};

const ServicesSelectionScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { selectedRooms, checkIn, checkOut, guests, rooms } =
    route.params as any;

  const [services, setServices] = useState<Service[]>([]);
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>(
    []
  );
  const [combos, setCombos] = useState<Combo[]>([]);
  const [selectedCombo, setSelectedCombo] = useState<SelectedCombo | null>(null);
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
        // Load combos with the services data
        loadCombos(data);
      } else {
        console.error("Failed to fetch services, status:", response.status);
        setServices([]);
        loadCombos([]);
      }
    } catch (error) {
      console.error("Error loading services:", error);
      setServices([]);
      loadCombos([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCombos = async (loadedServices: Service[]) => {
    try {
      // Fetch combos from khuyenmai endpoint (without hyphen)
      const response = await fetch(
        `${DEFAULT_BASE_URL}/api/khuyenmai`
      );
      if (response.ok) {
        const data = await response.json();
        // Filter only promotions that have combos (KhuyenMaiCombos)
        const formattedCombos: Combo[] = (data || [])
          .filter((item: any) => item.khuyenMaiCombos && item.khuyenMaiCombos.length > 0)
          .flatMap((item: any) => {
            // Each KhuyenMai can have multiple combos
            return (item.khuyenMaiCombos || []).map((combo: any) => {
              // Get services from combo's dichVus
              const services = (combo.khuyenMaiComboDichVus || []).map((dv: any) => {
                // Look up service from loaded services first for accurate data
                const serviceData = loadedServices.find((s: Service) => s.iddichVu === dv.iddichVu);
                
                // Try to get from navigation as fallback
                const tenDichVu = serviceData?.tenDichVu || dv.iddichVuNavigation?.tenDichVu || `Dịch vụ ${dv.iddichVu}`;
                const tienDichVu = serviceData?.tienDichVu || dv.iddichVuNavigation?.tienDichVu || 0;
                const hinhDichVu = serviceData?.hinhDichVu || dv.iddichVuNavigation?.hinhDichVu;

                return {
                  iddichVu: dv.iddichVu,
                  tenDichVu: tenDichVu,
                  tienDichVu: tienDichVu,
                  hinhDichVu: hinhDichVu,
                };
              });

              // Calculate combo price based on original services total and discount
              const originalTotal = services.reduce(
                (sum: number, dv: any) => sum + (dv.tienDichVu || 0),
                0
              );
              const comboPrice = calculateComboPrice(originalTotal, item);

              console.log(`Combo: ${combo.tenCombo}, Services: ${JSON.stringify(services)}, Total: ${originalTotal}, Final Price: ${comboPrice}`);

              return {
                idCombo: combo.idkhuyenMaiCombo,
                tenCombo: combo.tenCombo,
                moTa: item.moTa,
                giaCombo: comboPrice,
                dichVus: services,
                trangThai: item.trangThai,
                hinhAnhCombo: item.hinhAnhBanner,
              };
            });
          });
        setCombos(formattedCombos);
      } else {
        console.error("Failed to fetch combos, status:", response.status);
        setCombos([]);
      }
    } catch (error) {
      console.error("Error loading combos:", error);
      setCombos([]);
    }
  };

  const calculateComboPrice = (originalTotal: number, promotionData: any): number => {
    const discountType = promotionData.loaiGiamGia;
    const discountValue = Number(promotionData.giaTriGiam || 0);

    if (!discountType || discountValue === 0) {
      return originalTotal;
    }

    if (discountType === "percent") {
      return Math.round(originalTotal * (1 - discountValue / 100));
    } else {
      // Fixed amount discount
        return Math.max(0, originalTotal - discountValue);
      }
    };
  
    const resolveServiceImageUri = (u: any) => {
    if (!u) return buildApiUrl('/img/services/default.webp');
    try {
      if (typeof u !== 'string') {
        if (Array.isArray(u)) u = u.find(x => !!x) || u[0];
        else u = JSON.stringify(u);
      }
      const s = String(u).trim();
      if (!s) return buildApiUrl('/img/services/default.webp');
      if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('//')) return s;
      if (s.startsWith('/img') || s.startsWith('/')) return buildApiUrl(s);
      return buildApiUrl(`/img/services/${encodeURI(s)}`);
    } catch (e) {
      return buildApiUrl('/img/services/default.webp');
    }
  };

  const handleQuantityChange = (service: Service, change: number) => {
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

  const isServiceInSelectedCombo = (serviceId: string): boolean => {
    return selectedCombo?.serviceIds.includes(serviceId) || false;
  };

  const isComboDisabled = (combo: Combo): boolean => {
    // Combo is disabled if any of its services are already selected
    return combo.dichVus.some((dv) =>
      selectedServices.some((s) => s.serviceId === dv.iddichVu)
    );
  };

  const handleComboSelect = (combo: Combo) => {
    if (selectedCombo?.comboId === combo.idCombo) {
      // Deselect combo
      setSelectedCombo(null);
    } else {
      // Select combo - remove any services that are now in the combo
      const comboServiceIds = combo.dichVus.map((dv) => dv.iddichVu);
      setSelectedServices(
        selectedServices.filter((s) => !comboServiceIds.includes(s.serviceId))
      );
      
      // Select the new combo
      setSelectedCombo({
        comboId: combo.idCombo,
        comboName: combo.tenCombo,
        price: combo.giaCombo,
        serviceIds: comboServiceIds,
      });
    }
  };

  const calculateTotal = () => {
    let total = 0;
    
    // Add combo price if selected
    if (selectedCombo) {
      total += selectedCombo.price;
    }
    
    // Add individual services (both combo and non-combo)
    total += selectedServices.reduce((sum, s) => sum + s.price * s.quantity, 0);
    
    return total;
  };

  const handleProceed = () => {
    (navigation as any).navigate("Checkout", {
      selectedRooms,
      selectedServices,
      selectedCombo,
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
    const selected = selectedServices.find(
      (s) => s.serviceId === item.iddichVu
    );
    const quantity = selected ? selected.quantity : 0;
    const isInCombo = isServiceInSelectedCombo(item.iddichVu);

    return (
      <TouchableOpacity
        style={styles.serviceCard}
        onPress={() => openServiceDetail(item)}
        activeOpacity={0.9}
        disabled={isInCombo}
      >
        <View style={styles.serviceImageContainer}>
          {item.hinhDichVu ? (
            <Image
              source={{ uri: resolveServiceImageUri(item.hinhDichVu) }}
              style={[styles.serviceImage, isInCombo ? { opacity: 0.5 } : undefined]}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.serviceImagePlaceholder, isInCombo && { opacity: 0.5 }]}>
              <AppIcon name="star" size={24} color={COLORS.gray} />
            </View>
          )}
        </View>

        <View style={styles.serviceContent}>
          <Text style={styles.serviceName}>{item.tenDichVu}</Text>
          <Text style={[styles.servicePrice, isInCombo && { color: "#999" }]}>
            {item.tienDichVu.toLocaleString()}đ
          </Text>
          {isInCombo ? (
            <Text style={styles.comboTagText}>✓ Đã bao gồm trong combo</Text>
          ) : item.ghiChu ? (
            <Text style={styles.serviceNote} numberOfLines={1}>
              {item.ghiChu}
            </Text>
          ) : null}
        </View>

        <View style={styles.quantityControl}>
          {isInCombo ? (
            <View style={styles.lockedService} />
          ) : quantity > 0 ? (
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
      <HeaderScreen
        title="Dịch vụ thêm"
        onClose={() => navigation.goBack()}
        leftIcon={<AppIcon name="arrow-left" size={24} color={COLORS.secondary} />}
      />

      <BookingProgress
        currentStage="services"
        totalRooms={rooms}
        currentRoom={rooms} // Finished room selection
        selectedRoomNumbers={selectedRooms.map((sr: any) => sr.roomNumber)}
      />

      <ScrollView
        style={styles.scrollContent}
        // Increased bottom padding to account for fixed bottomBar + native tab bar
        contentContainerStyle={{ paddingBottom: 220 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.introSection}>
          <Text style={styles.introTitle}>Trải nghiệm trọn vẹn</Text>
          <Text style={styles.introText}>
            Chọn thêm các dịch vụ tiện ích để kỳ nghỉ của bạn thêm phần hoàn
            hảo.
          </Text>
        </View>

        {/* Combos Section */}
        {combos.length > 0 && (
          <View style={{ paddingHorizontal: SIZES.padding, marginBottom: 16 }}>
            <Text style={styles.sectionTitle}>🎁 Combo Đặc Biệt</Text>
            {combos.map((combo) => {
              const isSelected = selectedCombo?.comboId === combo.idCombo;
              const isDisabled = isComboDisabled(combo);
              const totalIndividualPrice = combo.dichVus.reduce(
                (sum, dv) => sum + dv.tienDichVu,
                0
              );
              const savings = totalIndividualPrice - combo.giaCombo;

              return (
                <TouchableOpacity
                  key={combo.idCombo}
                  style={[
                    styles.comboCard,
                    isSelected && styles.comboCardSelected,
                    isDisabled && styles.comboCardDisabled,
                  ]}
                  onPress={() => handleComboSelect(combo)}
                  disabled={isDisabled}
                  activeOpacity={isDisabled ? 0.6 : 0.7}
                >
                  <View style={{ flex: 1 }}>
                    <View style={styles.comboHeader}>
                      <Text style={styles.comboName}>{combo.tenCombo}</Text>
                      {isSelected && (
                        <View style={styles.comboCheckmark}>
                          <AppIcon name="check" size={16} color={COLORS.white} />
                        </View>
                      )}
                    </View>
                    
                    {/* Detailed service list */}
                    <View style={styles.comboServicesList}>
                      {combo.dichVus.map((dv, index) => (
                        <View key={dv.iddichVu} style={styles.comboServiceItem}>
                          <AppIcon name="check-circle" size={14} color={COLORS.primary} />
                          <Text style={styles.comboServiceName} numberOfLines={1}>
                            {dv.tenDichVu || "Dịch vụ"}
                          </Text>
                          <Text style={styles.comboServicePrice}>
                            ({(dv.tienDichVu || 0).toLocaleString()}đ)
                          </Text>
                        </View>
                      ))}
                    </View>

                    {isDisabled && (
                      <Text style={styles.comboDisabledText}>
                        ⚠️ Chứa dịch vụ đã chọn
                      </Text>
                    )}
                  </View>

                  <View style={styles.comboPriceSection}>
                    <Text style={styles.comboOriginalPrice}>
                      {totalIndividualPrice.toLocaleString()}đ
                    </Text>
                    <Text style={[styles.comboPriceTag, isDisabled && { opacity: 0.5 }]}>
                      {combo.giaCombo.toLocaleString()}đ
                    </Text>
                    {savings > 0 && (
                      <Text style={styles.comboSavings}>
                        Tiết kiệm {savings.toLocaleString()}đ
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Services Section */}
        <View style={{ paddingHorizontal: SIZES.padding }}>
          <Text style={styles.sectionTitle}>
            {selectedCombo ? "Thêm dịch vụ khác (Tùy chọn)" : "Dịch vụ lẻ"}
          </Text>
          {services.map((s) => (
            <View key={s.iddichVu}>{renderServiceItem({ item: s })}</View>
          ))}
        </View>
      </ScrollView>

      <View style={[
        styles.bottomBar,
        {
          bottom: Platform.OS === 'ios' 
            ? insets.bottom + 0
            : 0,
        },
      ]}>
        <View style={styles.totalContainer}>
          <Text style={styles.totalLabel}>
            {selectedCombo ? `Combo: ${selectedCombo.comboName}` : "Tổng dịch vụ"}
          </Text>
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
                      source={{ uri: resolveServiceImageUri(selectedServiceDetail.hinhDichVu) }}
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
                    {selectedServiceDetail.thongTinDv ||
                      "Chưa có mô tả chi tiết."}
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.secondary,
    marginBottom: 12,
    marginTop: 16,
  },
  comboCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "#E9ECEF",
    ...SHADOWS.light,
  },
  comboCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: "#FFF8F3",
  },
  comboCardDisabled: {
    opacity: 0.6,
  },
  comboHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  comboName: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.secondary,
    flex: 1,
  },
  comboServicesList: {
    gap: 4,
  },
  comboServiceItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  comboServiceName: {
    fontSize: 13,
    color: COLORS.secondary,
    flex: 1,
  },
  comboServicePrice: {
    fontSize: 12,
    color: COLORS.gray,
    fontWeight: "600",
  },
  comboServices: {
    fontSize: 12,
    color: COLORS.gray,
  },
  comboPriceSection: {
    alignItems: "flex-end",
    marginHorizontal: 12,
  },
  comboOriginalPrice: {
    fontSize: 12,
    color: "#999",
    textDecorationLine: "line-through",
    marginBottom: 2,
  },
  comboPriceTag: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.primary,
    marginBottom: 2,
  },
  comboSavings: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: "600",
  },
  comboCheckmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  comboDisabledText: {
    fontSize: 11,
    color: COLORS.gray,
    fontStyle: "italic",
  },
  comboTagText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: "600",
    marginTop: 2,
  },
  lockedService: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F3F5",
  },
});

export default ServicesSelectionScreen;
