import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Image,
  Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { COLORS, SIZES, FONTS } from '../constants/theme';
import servicesApi, { Service } from '../api/servicesApi';

interface ServiceDetailRouteParams {
  serviceId: string;
}

const ServiceDetail: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { serviceId } = (route.params as ServiceDetailRouteParams) || {};

  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadServiceDetail();
  }, [serviceId]);

  const loadServiceDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      if (!serviceId) {
        setError('Không tìm thấy ID dịch vụ');
        return;
      }
      const data = await servicesApi.getServiceById(serviceId);
      setService(data);
    } catch (err) {
      console.error('Error loading service detail:', err);
      setError(err instanceof Error ? err.message : 'Không thể tải chi tiết dịch vụ');
    } finally {
      setLoading(false);
    }
  };

  const handleBooking = () => {
    if (!service) return;
    Alert.alert('Đặt dịch vụ', `Bạn có muốn đặt dịch vụ "${service.tenDichVu}"?`, [
      { text: 'Huỷ', onPress: () => {}, style: 'cancel' },
      { text: 'Đồng ý', onPress: () => Alert.alert('Thành công', 'Đã thêm vào giỏ hàng') },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Chi tiết dịch vụ</Text>
          <View style={{ width: 30 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !service) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Chi tiết dịch vụ</Text>
          <View style={{ width: 30 }} />
        </View>
        <View style={styles.center}>
          <Text style={styles.errorText}>⚠️</Text>
          <Text style={styles.errorMessage}>{error || 'Không tìm thấy dịch vụ'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadServiceDetail}>
            <Text style={styles.retryText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.modalHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.closeButton}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.modalTitle}>Chi tiết dịch vụ</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Image */}
        {service.hinhDichVu && (
          <Image source={{ uri: service.hinhDichVu }} style={styles.image} resizeMode="cover" />
        )}

        {/* Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>{service.tenDichVu || 'Dịch vụ'}</Text>
          {typeof service.tienDichVu === 'number' && (
            <Text style={styles.price}>{(service.tienDichVu).toLocaleString('vi-VN')} VND</Text>
          )}
        </View>

        {/* Info Grid */}
        <View style={styles.infoGrid}>
          {typeof service.thoiLuongUocTinh === 'number' && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>⏱️ Thời lượng</Text>
              <Text style={styles.infoValue}>{service.thoiLuongUocTinh} phút</Text>
            </View>
          )}
          {service.trangThai && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>📊 Trạng thái</Text>
              <Text style={styles.infoValue}>{service.trangThai}</Text>
            </View>
          )}
        </View>

        {/* Time Range */}
        {(service.thoiGianBatDau || service.thoiGianKetThuc) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⏰ Thời gian phục vụ</Text>
            <View style={styles.timeBox}>
              {service.thoiGianBatDau && (
                <Text style={styles.timeText}>Bắt đầu: {service.thoiGianBatDau}</Text>
              )}
              {service.thoiGianKetThuc && (
                <Text style={styles.timeText}>Kết thúc: {service.thoiGianKetThuc}</Text>
              )}
            </View>
          </View>
        )}

        {/* Description */}
        {service.thongTinDv && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📝 Mô tả dịch vụ</Text>
            <Text style={styles.description}>{service.thongTinDv}</Text>
          </View>
        )}

        {/* Notes */}
        {service.ghiChu && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📌 Ghi chú</Text>
            <Text style={styles.note}>{service.ghiChu}</Text>
          </View>
        )}

        {/* Spacer */}
        <View style={{ height: SIZES.padding * 4 }} />
      </ScrollView>

      {/* Footer Button */}
      <TouchableOpacity style={styles.bookButton} onPress={handleBooking}>
        <Text style={styles.bookButtonText}>Đặt ngay</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding * 0.8,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
  },
  closeButton: {
    fontSize: 24,
    color: COLORS.secondary,
    fontWeight: '600',
    width: 30,
    textAlign: 'center',
  },
  headerTitle: {
    ...FONTS.h4,
    color: COLORS.secondary,
    fontWeight: '600',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding * 0.6,
    marginTop: 30,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  modalTitle: {
    ...FONTS.h2,
    fontWeight: '700',
    color: COLORS.secondary,
    fontSize: 20,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 48,
    marginBottom: SIZES.padding,
  },
  errorMessage: {
    ...FONTS.body3,
    color: COLORS.gray,
    marginBottom: SIZES.padding * 2,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SIZES.padding * 2,
    paddingVertical: SIZES.padding,
    borderRadius: SIZES.radiusLarge,
  },
  retryText: {
    ...FONTS.body4,
    color: COLORS.white,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  image: {
    width: '100%',
    height: 280,
    backgroundColor: '#f0f0f0',
  },
  titleSection: {
    padding: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    ...FONTS.h3,
    color: COLORS.secondary,
    marginBottom: SIZES.padding * 0.5,
    fontWeight: '600',
  },
  price: {
    ...FONTS.h4,
    color: COLORS.primary,
    fontWeight: '700',
  },
  infoGrid: {
    flexDirection: 'row',
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
    gap: SIZES.padding,
  },
  infoItem: {
    flex: 1,
    backgroundColor: COLORS.white,
    padding: SIZES.padding,
    borderRadius: SIZES.radiusLarge,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  infoLabel: {
    ...FONTS.body5,
    color: COLORS.gray,
    marginBottom: 6,
  },
  infoValue: {
    ...FONTS.body3,
    color: COLORS.secondary,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding * 1.2,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    ...FONTS.h4,
    color: COLORS.secondary,
    marginBottom: SIZES.padding,
    fontWeight: '600',
  },
  timeBox: {
    backgroundColor: '#f9f9f9',
    padding: SIZES.padding,
    borderRadius: SIZES.radiusLarge,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  timeText: {
    ...FONTS.body3,
    color: COLORS.secondary,
    marginBottom: 6,
    lineHeight: 22,
  },
  description: {
    ...FONTS.body3,
    color: COLORS.secondary,
    lineHeight: 24,
    backgroundColor: '#f9f9f9',
    padding: SIZES.padding,
    borderRadius: SIZES.radiusLarge,
  },
  note: {
    ...FONTS.body3,
    color: COLORS.secondary,
    lineHeight: 24,
    backgroundColor: '#fff8f0',
    padding: SIZES.padding,
    borderRadius: SIZES.radiusLarge,
    borderLeftWidth: 4,
    borderLeftColor: '#FFB84D',
  },
  bookButton: {
    backgroundColor: COLORS.primary,
    marginHorizontal: SIZES.padding,
    marginVertical: SIZES.padding,
    paddingVertical: SIZES.padding * 1.2,
    borderRadius: SIZES.radiusLarge,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  bookButtonText: {
    ...FONTS.h4,
    color: COLORS.white,
    fontWeight: '600',
  },
});

export default ServiceDetail;
