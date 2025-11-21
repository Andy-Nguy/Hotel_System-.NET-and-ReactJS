import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { COLORS, SIZES } from '../constants/theme';
import reviewApi from '../api/reviewApi';
import StarRating from './StarRating';

type Review = any;

interface Props {
  roomId: string;
  visible: boolean;
  onClose: () => void;
}

const PAGE_SIZE = 5;

const formatDate = (iso?: string) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } catch (e) {
    return iso;
  }
};

const getAuthorName = (r: Review) => {
  // Normalize potential anonymous flags (could be 0/1, '0'/'1', boolean)
  const flag = r.IsAnonym ?? r.isAnonym ?? r.IsAnonymous ?? r.anonymous ?? r.isAnonymous;
  const isAnon = flag === true || flag === 1 || flag === '1' || flag === 'true';
  if (isAnon) return 'Ẩn danh';

  // Try nested customer object first
  const kh = r.khachHang || r.KhachHang || r.customer || r.user || r.KhachHangDTO;
  const nameFromKh = kh && (kh.HoTen || kh.hoTen || kh.fullName || kh.name || kh.ten);
  if (nameFromKh) return nameFromKh;

  // Then check common top-level name fields
  const topName = r.hoTen || r.HoTen || r.fullName || r.tenNguoi || r.ten || r.name || r.author || r.userName || r.username;
  if (topName) return topName;

  // If not anonymous but we have an ID, show a helpful fallback
  const idKh = r.IDKhachHang ?? r.idKhachHang ?? r.idKh ?? r.khachHangId;
  if (idKh) return `Khách hàng ${idKh}`;

  // Final fallback
  return 'Người dùng';
};

const getTitle = (r: Review) => r.title || r.tieuDe || r.TieuDe || '';
const getContent = (r: Review) => r.content || r.noiDung || r.NoiDung || r.body || '';
const getRating = (r: Review) => r.rating || r.soSao || r.SoSao || 0;

const RoomReviews: React.FC<Props> = ({ roomId, visible, onClose }) => {
  const [page, setPage] = useState(1);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any | null>(null);
  // expanded map to toggle long content per review id
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});

  const loadStats = async () => {
    const s = await reviewApi.getRoomStats(roomId);
    if (s) setStats(s);
  };

  const loadPage = async (p: number) => {
    setLoading(true);
    try {
      const res = await reviewApi.getRoomReviews(roomId, p, PAGE_SIZE);
      console.debug('RoomReviews: raw response', res);
      if (!res) {
        setReviews([]);
        setTotal(0);
        return;
      }

      // Normalize a variety of response shapes
      let items: any[] = [];
      let totalCount: number | null = null;

      if (Array.isArray(res)) {
        items = res;
        totalCount = res.length;
      } else if (Array.isArray(res.items)) {
        items = res.items;
        totalCount = typeof res.total === 'number' ? res.total : (res.totalCount ?? res.count ?? null);
      } else if (res.data) {
        if (Array.isArray(res.data)) {
          items = res.data;
          totalCount = res.data.length;
        } else if (Array.isArray(res.data.items)) {
          items = res.data.items;
          totalCount = typeof res.data.total === 'number' ? res.data.total : (res.data.totalCount ?? null);
        }
      } else if (Array.isArray(res.result)) {
        items = res.result;
        totalCount = typeof res.total === 'number' ? res.total : (res.totalCount ?? null);
      } else if (res.items === undefined && typeof res === 'object') {
        // try common single-level array properties
        const possible = res.reviews || res.rows || res.list || res.records;
        if (Array.isArray(possible)) items = possible;
        totalCount = typeof res.total === 'number' ? res.total : (res.count ?? null);
      }

      setReviews(items);
      setTotal(totalCount ?? items.length ?? 0);
    } catch (err) {
      console.debug('RoomReviews: failed to fetch reviews', err);
      setReviews([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!visible) return;
    setPage(1);
    loadStats();
    loadPage(1);
  }, [visible, roomId]);

  useEffect(() => {
    loadPage(page);
  }, [page]);

  const renderDistribution = () => {
    const dist = stats?.ratingDistribution || [];
    const totalCount = stats?.totalReviews || dist.reduce((s: number, d: any) => s + (d.count || 0), 0) || 0;
    const rows = [5,4,3,2,1];
    return (
      <View style={{ marginBottom: 12 }}>
        {rows.map(st => {
          const item = dist.find((d: any) => Number(d.stars) === st) || { count: 0 };
          const cnt = item.count || 0;
          const pct = totalCount > 0 ? Math.round((cnt / totalCount) * 100) : 0;
          return (
            <View key={st} style={styles.distRow}>
              <Text style={styles.distLabel}>{st}★</Text>
              <View style={styles.distBarBackground}>
                <View style={[styles.distBarFill, { width: `${pct}%` }]} />
              </View>
              <Text style={styles.distCount}>{cnt} · {pct}%</Text>
            </View>
          );
        })}
      </View>
    );
  };

  const renderItem = ({ item, index }: { item: Review; index: number }) => {
    const author = getAuthorName(item);
    const title = getTitle(item);
    const content = getContent(item);
    const rating = Number(getRating(item)) || 0;
    const date = formatDate(item.createdAt || item.CreatedAt || item.date || item.ngay || item.ngayTao || item.createdAtUtc);
    const id = String(item.IDDanhGia ?? item.id ?? item.reviewId ?? item.idDanhGia ?? item.ID ?? item.IDReview ?? item.review_id ?? `${roomId}_${index}`);
    const isExpanded = !!expandedMap[id];
    const short = content?.slice ? content.slice(0, 200) : content;
    return (
      <View style={styles.reviewCard}>
        <Text style={styles.reviewAuthorTop}>{author}</Text>
        <View style={{ height: 6 }} />
        <StarRating avg={rating} size={16} />
        {title ? <Text style={styles.reviewTitle}>{title}</Text> : null}
        <Text numberOfLines={isExpanded ? undefined : 3} style={styles.reviewContent}>{isExpanded ? content : short}</Text>
        <View style={styles.reviewFooter}>
          <Text style={styles.reviewDate}>{date}</Text>
          { (content && content.length > 200) ? (
            <TouchableOpacity onPress={() => setExpandedMap(m => ({ ...m, [id]: !m[id] }))}>
              <Text style={styles.viewDetail}>{isExpanded ? 'Thu gọn' : 'Xem thêm'}</Text>
            </TouchableOpacity>
          ) : null }
        </View>
      </View>
    );
  };

  const totalPages = total && total > 0 ? Math.ceil(total / PAGE_SIZE) : 1;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.back}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Đánh giá phòng</Text>
          <View style={{ width: 30 }} />
        </View>

        <View style={styles.content}>
          {stats ? (
            <View style={styles.statsSection}>
              <Text style={styles.statsSummary}>{(stats.averageRating || 0).toFixed(1)}/5 · {stats.totalReviews ?? 0} đánh giá</Text>
              {renderDistribution()}
            </View>
          ) : (
            <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: 8 }} />
          )}

          {loading ? (
            <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 24 }} />
          ) : (
            <FlatList
              data={reviews}
              keyExtractor={(item, idx) => String(item.IDDanhGia ?? item.id ?? item.reviewId ?? item.idDanhGia ?? item.ID ?? idx)}
              renderItem={renderItem}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 24, color: '#666' }}>Chưa có đánh giá</Text>}
            />
          )}

          <View style={styles.paginationRow}>
            <TouchableOpacity disabled={page <= 1} onPress={() => setPage(p => Math.max(1, p - 1))} style={[styles.pageBtn, page <=1 && styles.pageBtnDisabled]}>
              <Text style={styles.pageBtnText}>Trước</Text>
            </TouchableOpacity>
            <Text style={styles.pageIndicator}>{page} / {totalPages}</Text>
            <TouchableOpacity disabled={page >= totalPages} onPress={() => setPage(p => p + 1)} style={[styles.pageBtn, page >= totalPages && styles.pageBtnDisabled]}>
              <Text style={styles.pageBtnText}>Sau</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* detail modal removed — use inline expand/collapse 'Xem thêm' instead */}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SIZES.padding, borderBottomWidth: 1, borderBottomColor: '#eee' },
  back: { fontSize: 22, color: COLORS.secondary },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.secondary },
  content: { flex: 1, padding: SIZES.padding },
  statsSection: { marginBottom: 12 },
  statsSummary: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  distRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  distLabel: { width: 36, fontSize: 13, color: COLORS.gray },
  distBarBackground: { flex: 1, height: 8, backgroundColor: '#f0f0f0', borderRadius: 6, marginHorizontal: 8, overflow: 'hidden' },
  distBarFill: { height: 8, backgroundColor: '#C9A043' },
  distCount: { width: 90, fontSize: 12, color: COLORS.gray, textAlign: 'right' },
  reviewCard: { padding: 12, borderRadius: 8, backgroundColor: '#fff', marginBottom: 10, borderWidth: 1, borderColor: '#f0f0f0' },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  reviewAuthorTop: { fontSize: 15, fontWeight: '800', color: COLORS.secondary },
  reviewTitle: { fontSize: 13, fontWeight: '700', color: '#333', marginBottom: 6 },
  reviewContent: { fontSize: 13, color: '#555' },
  reviewFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  reviewDate: { fontSize: 12, color: '#888' },
  viewDetail: { fontSize: 13, color: COLORS.primary, fontWeight: '700' },
  paginationRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 12 },
  pageBtn: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: COLORS.primary, borderRadius: 6, marginHorizontal: 12 },
  pageBtnDisabled: { opacity: 0.4 },
  pageBtnText: { color: '#fff', fontWeight: '700' },
  pageIndicator: { fontSize: 14, color: COLORS.secondary, fontWeight: '700' },
});

export default RoomReviews;
