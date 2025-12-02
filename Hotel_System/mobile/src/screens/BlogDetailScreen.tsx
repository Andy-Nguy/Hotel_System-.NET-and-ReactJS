import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { COLORS, SIZES, FONTS } from "../constants/theme";

interface BlogPost {
  id: number;
  title: string;
  category: string;
  type: "internal" | "external";
  externalLink?: string;
  image: string;
  date: string;
  excerpt?: string;
  author?: string;
  tags?: string[];
  content?: string;
  images?: string[];
  status?: string;
}

interface RouteParams {
  blogId: number;
}

const BlogDetailScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { blogId } = route.params as RouteParams;

  const [post, setPost] = useState<BlogPost | null>(null);
  const [mainImage, setMainImage] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBlogDetail();
  }, [blogId]);

  const fetchBlogDetail = async () => {
    try {
      const apiEndpoints = [
        `https://localhost:5001/api/blog/${blogId}`,
        `http://localhost:5001/api/blog/${blogId}`,
      ];

      let res: Response | null = null;

      for (const endpoint of apiEndpoints) {
        try {
          res = await fetch(endpoint, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          });
          if (res.ok) break;
          res = null;
        } catch (e) {
          continue;
        }
      }

      if (res && res.ok) {
        const data = await res.json();
        const mapped: BlogPost = {
          id: data.id || data.Id || blogId,
          title: data.title || data.Title || '',
          category: data.category || data.Category || '',
          type: (data.type || data.Type || 'internal') as 'internal' | 'external',
          image: data.image || data.Image || '',
          date: data.date || data.Date || data.publishedAt || data.PublishedAt || '',
          excerpt: data.excerpt || data.Excerpt || '',
          author: data.author || data.Author || '',
          tags: typeof data.tags === 'string' ? data.tags.split(',').map((t: string) => t.trim()) : (data.tags || data.Tags || []),
          content: data.content || data.Content || '',
          images: data.images || data.Images || [],
          externalLink: data.externalLink || data.ExternalLink || '',
          status: data.status || data.Status || '',
        };
        setPost(mapped);
        setMainImage(mapped.images?.[0] || mapped.image);
      } else {
        console.warn('Blog API not accessible');
      }
    } catch (e) {
      console.warn('Error fetching blog:', e);
    } finally {
      setLoading(false);
    }
  };

  // Increment view count
  useEffect(() => {
    if (!blogId) return;
    const updateViewCount = async () => {
      const endpoints = [
        `https://localhost:5001/api/blog/${blogId}/tang-luot-xem`,
        `http://localhost:5001/api/blog/${blogId}/tang-luot-xem`,
      ];
      for (const endpoint of endpoints) {
        try {
          await fetch(endpoint, { method: 'POST' });
          break;
        } catch (e) {
          continue;
        }
      }
    };
    updateViewCount();
  }, [blogId]);

  const renderContent = (content: string) => {
    if (!content) return null;
    const cleanContent = content.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/g, (match) => {
      const entities: Record<string, string> = { '&lt;': '<', '&gt;': '>', '&amp;': '&', '&quot;': '"', '&#039;': "'", '&nbsp;': ' ' };
      return entities[match] || match;
    });
    return cleanContent.trim().split('\n\n').map((block, idx) => {
      if (block.startsWith('## ') || block.startsWith('#')) {
        return <Text key={idx} style={styles.contentHeading}>{block.replace(/^#+\s+/, '')}</Text>;
      }
      if (block.trim().startsWith('*') || block.trim().startsWith('-')) {
        const items = block.trim().split('\n').map(item => item.trim().replace(/^[\*\-]\s+/, '').trim());
        return (
          <View key={idx} style={styles.bulletList}>
            {items.map((item, itemIdx) => (
              <View key={itemIdx} style={styles.bulletItem}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>{item}</Text>
              </View>
            ))}
          </View>
        );
      }
      return <Text key={idx} style={styles.contentParagraph}>{block.trim()}</Text>;
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>← Quay lại</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>← Quay lại</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Bài viết không tìm thấy</Text>
        </View>
      </SafeAreaView>
    );
  }

  const readingTime = Math.max(1, Math.round((post.content || "").split(/\s+/).filter(Boolean).length / 200));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Quay lại</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Title and Meta Info */}
        <View style={styles.titleSection}>
          <View style={styles.categoryTag}>
            <Text style={[styles.categoryText, { color: post.type === 'external' ? '#FF4500' : '#B8860B' }]}>
              {post.category}
            </Text>
          </View>
          <Text style={styles.title}>{post.title}</Text>
          <View style={styles.metaInfo}>
            <Text style={styles.metaText}>🕐 {post.date}</Text>
            <Text style={styles.metaText}>• {readingTime} phút đọc</Text>
            {post.author && <Text style={styles.metaText}>• Bởi {post.author}</Text>}
          </View>
        </View>

        {/* Main Image and Gallery */}
        <View style={styles.imageSection}>
          <Image
            source={{ uri: mainImage || post.image }}
            style={styles.mainImage}
            resizeMode="cover"
          />

          {/* Thumbnail Selector */}
          {post.images && post.images.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbnailContainer}>
              {(post.images || [post.image]).map((src, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => setMainImage(src)}
                  style={[
                    styles.thumbnail,
                    { borderColor: mainImage === src ? '#B8860B' : '#eee', borderWidth: mainImage === src ? 2 : 1 }
                  ]}
                >
                  <Image source={{ uri: src }} style={styles.thumbnailImage} resizeMode="cover" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Content */}
        <View style={styles.contentSection}>
          {post.content ? renderContent(post.content) : <Text style={styles.noContent}>{post.excerpt || 'Nội dung đang được cập nhật.'}</Text>}
        </View>

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <View style={styles.tagsSection}>
            <Text style={styles.tagsLabel}>Tags:</Text>
            <View style={styles.tagsList}>
              {post.tags.map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagValue}>#{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* External Link Button */}
        {post.type === 'external' && post.externalLink && (
          <TouchableOpacity 
            style={styles.externalButton}
            onPress={() => {
              // Handle opening external link
              console.log('Opening external link:', post.externalLink);
            }}
          >
            <Text style={styles.externalButtonText}>📄 Mở nguồn tin chính thống</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: SIZES.padding * 2 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    ...FONTS.body4,
    color: COLORS.primary,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
  },
  errorText: {
    ...FONTS.h4,
    color: COLORS.gray,
  },
  titleSection: {
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding * 1.5,
  },
  categoryTag: {
    alignSelf: 'flex-start',
    marginBottom: SIZES.margin,
  },
  categoryText: {
    ...FONTS.body5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    ...FONTS.h2,
    color: COLORS.secondary,
    marginBottom: SIZES.margin,
    fontWeight: '300',
  },
  metaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    ...FONTS.body4,
    color: COLORS.gray,
  },
  imageSection: {
    paddingHorizontal: SIZES.padding,
    marginVertical: SIZES.margin * 1.5,
  },
  mainImage: {
    width: '100%',
    height: 300,
    borderRadius: SIZES.radiusLarge,
    marginBottom: SIZES.margin,
  },
  thumbnailContainer: {
    marginBottom: SIZES.margin,
  },
  thumbnail: {
    marginRight: 8,
    borderRadius: SIZES.radius,
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: 80,
    height: 80,
  },
  contentSection: {
    paddingHorizontal: SIZES.padding,
    marginVertical: SIZES.margin,
  },
  contentHeading: {
    ...FONTS.h4,
    color: COLORS.secondary,
    marginVertical: SIZES.margin,
    fontWeight: '500',
  },
  contentParagraph: {
    ...FONTS.body4,
    color: COLORS.gray,
    lineHeight: 24,
    marginBottom: SIZES.margin,
  },
  bulletList: {
    marginVertical: SIZES.margin,
  },
  bulletItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  bullet: {
    ...FONTS.body4,
    color: COLORS.gray,
    marginRight: 8,
  },
  bulletText: {
    ...FONTS.body4,
    color: COLORS.gray,
    flex: 1,
    lineHeight: 20,
  },
  noContent: {
    ...FONTS.body4,
    color: COLORS.gray,
    fontStyle: 'italic',
  },
  tagsSection: {
    paddingHorizontal: SIZES.padding,
    marginVertical: SIZES.margin * 1.5,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: SIZES.margin,
  },
  tagsLabel: {
    ...FONTS.body5,
    color: COLORS.gray,
    fontWeight: '700',
    marginBottom: SIZES.margin,
  },
  tagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#f8f8f8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  tagValue: {
    ...FONTS.body5,
    color: COLORS.gray,
  },
  externalButton: {
    marginHorizontal: SIZES.padding,
    marginVertical: SIZES.margin,
    backgroundColor: '#FF4500',
    paddingVertical: SIZES.padding,
    borderRadius: SIZES.radius,
    alignItems: 'center',
  },
  externalButtonText: {
    ...FONTS.body4,
    color: COLORS.white,
    fontWeight: '700',
  },
});

export default BlogDetailScreen;
