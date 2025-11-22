import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import reviewApi from '../api/reviewApi';
import StarRating from '../components/StarRating';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../constants/theme';

interface Props {
  route: any;
  navigation: any;
}

const ReviewScreen: React.FC<Props> = ({ route, navigation }) => {
  const bookingId = route?.params?.bookingId ?? '';

  const [rating, setRating] = useState<number>(0);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isAnonym, setIsAnonym] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Reset form when bookingId changes so each deep-link shows the form fresh
  useEffect(() => {
    setRating(0);
    setTitle('');
    setContent('');
    setIsAnonym(false);
    setLoading(false);
    setSubmitted(false);
  }, [bookingId]);

  const contentMax = 500;
  const titleMax = 100;

  const contentLength = content.length;
  const isValid = rating > 0 && title.trim().length > 0 && contentLength > 0 && contentLength <= contentMax;

  const submit = async () => {
    if (!bookingId) {
      Alert.alert('Lỗi', 'Không tìm thấy mã đặt phòng.');
      return;
    }
    if (!isValid) {
      Alert.alert('Vui lòng điền đầy đủ', 'Hãy cung cấp xếp hạng, tiêu đề, và nội dung (tối đa 500 ký tự).');
      return;
    }
    setLoading(true);
    try {
      const payload: any = {
        IddatPhong: bookingId,
        Rating: rating,
        Title: title.trim(),
        Content: content.trim(),
        IsAnonym: isAnonym ? 1 : 0,
      };

      const res = await reviewApi.submitReview(payload as any);
      if (res?.ok) {
        setSubmitted(true);
      } else {
        Alert.alert('Lỗi', res?.message || 'Gửi đánh giá thất bại');
      }
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Gửi thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
      {submitted ? (
        <View style={{ alignItems: 'center', marginTop: 8 }}>
          <MaterialIcons name="check-circle" size={72} color={COLORS.primary} />
          <Text style={{ fontSize: 22, fontWeight: '700', color: COLORS.primary, marginTop: 12 }}>Đánh giá thành công!</Text>
          <Text style={{ color: COLORS.black, marginTop: 8 }}>Cảm ơn bạn đã dành thời gian chia sẻ trải nghiệm.</Text>

          <View style={styles.infoBox}>
            <Text style={{ fontWeight: '600', marginBottom: 6 }}>Thông tin đặt phòng</Text>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>Mã đặt phòng:</Text><Text style={styles.infoValue}>{bookingId}</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>Trạng thái:</Text><Text style={[styles.infoValue, { color: COLORS.primary }]}>Đã gửi đánh giá</Text></View>
          </View>

          <TouchableOpacity
            style={[styles.submit, styles.outlinedSubmit]}
            onPress={() => {
              try {
                if (navigation && typeof navigation.popToTop === 'function' && navigation.canGoBack && navigation.canGoBack()) {
                  navigation.popToTop();
                } else if (navigation && typeof navigation.navigate === 'function') {
                  navigation.navigate('MainApp');
                } else {
                  const nav = (global as any).rootNavigation;
                  if (nav && typeof nav.navigate === 'function') nav.navigate('MainApp');
                }
              } catch (e) {
                const nav = (global as any).rootNavigation;
                if (nav && typeof nav.navigate === 'function') nav.navigate('MainApp');
              }
            }}
          >
            <Text style={[styles.submitText, styles.outlinedSubmitText]}>Quay về trang chủ</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View>
          <View style={styles.headerRow}>
            <Text style={styles.header}>Chia sẻ ý kiến của bạn</Text>
            <TouchableOpacity
              onPress={() => {
                try {
                  // If there's a back history, go back; otherwise reset to MainApp
                  if (navigation && typeof navigation.canGoBack === 'function' && navigation.canGoBack()) {
                    navigation.goBack();
                  } else if (navigation && typeof navigation.reset === 'function') {
                    navigation.reset({ index: 0, routes: [{ name: 'MainApp' }] });
                  } else if (navigation && typeof navigation.navigate === 'function') {
                    navigation.navigate('MainApp');
                  } else {
                    const nav = (global as any).rootNavigation;
                    if (nav && typeof nav.reset === 'function') {
                      nav.reset({ index: 0, routes: [{ name: 'MainApp' }] });
                    } else if (nav && typeof nav.navigate === 'function') {
                      nav.navigate('MainApp');
                    }
                  }
                } catch (e) {
                  const nav = (global as any).rootNavigation;
                  if (nav && typeof nav.reset === 'function') nav.reset({ index: 0, routes: [{ name: 'MainApp' }] });
                  else if (nav && typeof nav.navigate === 'function') nav.navigate('MainApp');
                }
              }}
              style={styles.closeBtn}
              accessibilityLabel="Đóng"
            >
              <MaterialIcons name="close" size={24} color={COLORS.black} />
            </TouchableOpacity>
          </View>
          <Text style={styles.bookingId}>Mã đặt phòng: <Text style={{ color: COLORS.black, fontWeight: '700' }}>{bookingId}</Text></Text>

          <View style={{ marginVertical: 12 }}>
            <Text style={styles.label}>Đánh giá tổng thể trải nghiệm <Text style={styles.labelStar}>⭐</Text></Text>
            <StarRating avg={rating} size={36} onSelect={(v: number) => setRating(v)} />
          </View>

          <View style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[styles.label, { marginBottom: 6 }]}>Tiêu đề đánh giá <Text style={styles.required}>*</Text></Text>
              <Text style={{ color: COLORS.black, fontSize: 12 }}>{title.trim().length}/{titleMax}</Text>
            </View>
            <TextInput
              value={title}
              onChangeText={(t) => setTitle(t)}
              style={styles.input}
              placeholder="Ấn tượng chính của bạn là gì?"
              placeholderTextColor="#999"
              maxLength={titleMax}
            />
          </View>

          <View style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[styles.label, { marginBottom: 6 }]}>Nội dung chi tiết <Text style={styles.required}>*</Text></Text>
              <Text style={{ color: COLORS.black, fontSize: 12 }}>{contentLength}/{contentMax}</Text>
            </View>
            <TextInput
              value={content}
              onChangeText={(t) => setContent(t)}
              style={[styles.input, { height: 120, textAlignVertical: 'top' }]}
              placeholder="Chia sẻ trải nghiệm chi tiết về phòng, dịch vụ,..."
              placeholderTextColor="#9aa0a6"
              multiline
              maxLength={contentMax}
            />

            <View style={styles.progressBackground}>
              <View style={[styles.progressBar, { width: `${Math.min(100, (contentLength / contentMax) * 100)}%`, backgroundColor: contentLength > contentMax ? '#ff4d4f' : COLORS.primary }]} />
            </View>
          </View>

          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }} onPress={() => setIsAnonym(!isAnonym)}>
            <MaterialIcons name={isAnonym ? 'check-box' : 'check-box-outline-blank'} size={20} color={isAnonym ? COLORS.primary : '#999'} />
            <Text style={{ marginLeft: 8, color: COLORS.black }}>Gửi đánh giá ẩn danh</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.submit, isValid ? {} : styles.disabledSubmit]} onPress={submit} disabled={!isValid || loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>GỬI ĐÁNH GIÁ CỦA BẠN</Text>}
          </TouchableOpacity>

          <Text style={{ marginTop: 12, fontSize: 12, color: COLORS.black, textAlign: 'center' }}>Đánh giá của bạn giúp Khách sạn nâng cao chất lượng dịch vụ.</Text>
        </View>
      )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: SIZES.padding, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  card: { width: '96%', maxWidth: 720, backgroundColor: COLORS.white, borderRadius: 12, padding: SIZES.padding, borderWidth: 1, borderColor: COLORS.border },
  header: { fontSize: 22, fontWeight: '700', marginBottom: 8, color: COLORS.black, textAlign: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeBtn: { padding: 6 },
  bookingId: { color: COLORS.black, marginBottom: 6, textAlign: 'center' },
  label: { fontSize: 14, color: COLORS.black, marginTop: 8, marginBottom: 6 },
  labelStar: { color: COLORS.primary },
  required: { color: COLORS.primary, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: COLORS.border, padding: 12, borderRadius: 8, backgroundColor: COLORS.white, color: COLORS.black },
  submit: { marginTop: 16, backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  submitText: { color: '#fff', fontWeight: '700' },
  disabledSubmit: { backgroundColor: '#2b3238' },
  outlinedSubmit: { backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.primary, paddingVertical: 12 },
  outlinedSubmitText: { color: COLORS.primary },
  infoBox: { backgroundColor: COLORS.white, borderLeftWidth: 3, borderLeftColor: COLORS.primary, padding: 12, borderRadius: 8, marginTop: 18, width: '100%' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  infoLabel: { color: COLORS.black },
  infoValue: { color: COLORS.black, fontWeight: '700' },
  progressBackground: { height: 6, backgroundColor: COLORS.lightGray, borderRadius: 4, overflow: 'hidden', marginTop: 8 },
  progressBar: { height: 6 },
});

export default ReviewScreen;
