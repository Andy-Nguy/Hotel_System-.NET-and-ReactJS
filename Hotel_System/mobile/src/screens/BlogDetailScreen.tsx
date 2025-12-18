import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Animated,
  Dimensions,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, useNavigation } from "@react-navigation/native";
import { API_CONFIG } from "../config/apiConfig";
import * as theme from "../constants/theme";
import { getBlogById, getPublishedBlogs, BlogPost } from "../api/blogApi";

const { width } = Dimensions.get("window");
const baseConfig = API_CONFIG && (API_CONFIG as any).CURRENT;
const API_BASE = Array.isArray(baseConfig)
  ? baseConfig[0]
  : typeof baseConfig === "string"
  ? baseConfig
  : "";

interface RouteParams {
  blogId: number;
}

const BlogDetailScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { blogId } = route.params as RouteParams;

  const [post, setPost] = useState<BlogPost | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<BlogPost[]>([]);
  const [mainImage, setMainImage] = useState<string>("");
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchBlogDetail();
  }, [blogId]);

  const fetchBlogDetail = async () => {
    try {
      console.log(`📡 Fetching blog ${blogId}...`);
      const data = await getBlogById(blogId);
      console.log(`✅ Blog loaded:`, data.title);
      setPost(data);
      setMainImage(data.image || "");
      // Fetch related posts (robust matching)
      const allBlogs = await getPublishedBlogs();
      console.log(
        `🔎 Found ${allBlogs.length} published blogs for related lookup`
      );
      const categoryKey = (data.category || "").toString().trim().toLowerCase();
      let related: BlogPost[] = [];
      if (categoryKey) {
        related = allBlogs
          .filter(
            (b) =>
              (b.category || "").toString().trim().toLowerCase() ===
                categoryKey && b.id !== data.id
          )
          .slice(0, 3);
        console.log(
          `🔎 Related by category (${categoryKey}): ${related.length}`
        );
      }
      // Fallback: if no related by category, show up to 3 most recent other posts
      if (related.length === 0) {
        related = allBlogs.filter((b) => b.id !== data.id).slice(0, 3);
        console.log(`🔎 Fallback related posts count: ${related.length}`);
      }
      setRelatedPosts(related);
    } catch (e) {
      console.warn("Error fetching blog:", e);
    } finally {
      setLoading(false);
    }
  };

  // Increment view count
  useEffect(() => {
    if (!blogId) return;
    const updateViewCount = async () => {
      try {
        await fetch(`${API_BASE}/api/blog/${blogId}/tang-luot-xem`, {
          method: "POST",
        });
        console.log(`✅ View count incremented for blog ${blogId}`);
      } catch (e) {
        console.warn("Failed to increment view count:", e);
      }
    };
    updateViewCount();
  }, [blogId]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 7) return `${diffDays} ngày trước`;
    return date.toLocaleDateString("vi-VN");
  };

  const handleShare = async () => {
    if (!post) return;
    const url =
      post.type === "external" && post.externalLink
        ? post.externalLink
        : `${API_BASE}/blog/${post.slug || post.id}`;
    try {
      await Share.share({
        message: `${post.title} - ${url}`,
      });
    } catch (e) {
      console.warn("Share failed:", e);
    }
  };

  const getCategoryColor = (category?: string) => {
    if (!category) return "#B8860B";
    const cat = category.toLowerCase();
    if (cat.includes("cảnh báo")) return "#FF0000";
    if (cat.includes("khách sạn")) return "#0000FF";
    return "#B8860B";
  };

  const renderContent = (content: string) => {
    // Improved HTML-like rendering (basic)
    // For full HTML, use react-native-render-html
    const blocks = content.split(/(<[^>]*>)/).filter(Boolean);
    const elements: React.ReactNode[] = [];
    let key = 0;
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      if (block.startsWith("<h1>") || block.startsWith("<h2>")) {
        const text = block.replace(/<\/?h[12]>/g, "");
        elements.push(
          <Text key={key++} style={styles.contentHeading}>
            {text}
          </Text>
        );
      } else if (block.startsWith("<p>")) {
        const text = block.replace(/<\/?p>/g, "");
        elements.push(
          <Text key={key++} style={styles.contentParagraph}>
            {text}
          </Text>
        );
      } else if (block.startsWith("<ul>") || block.startsWith("<ol>")) {
        // Handle lists
        const listItems = block
          .split("<li>")
          .slice(1)
          .map((li) => li.replace("</li>", ""));
        elements.push(
          <View key={key++} style={styles.bulletList}>
            {listItems.map((item, idx) => (
              <View key={idx} style={styles.bulletItem}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>{item}</Text>
              </View>
            ))}
          </View>
        );
      } else if (!block.startsWith("<")) {
        elements.push(
          <Text key={key++} style={styles.contentParagraph}>
            {block}
          </Text>
        );
      }
    }
    return elements;
  };

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 200],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>← Quay lại</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.COLORS.primary} />
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

  const readingTime = Math.max(
    1,
    Math.round((post.content || "").split(/\s+/).filter(Boolean).length / 200)
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>←</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleShare}>
          <Text style={styles.shareButton}>📤</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        {/* Cover Slideshow */}
        <View style={styles.coverContainer}>
          {(() => {
            const images =
              post.images && post.images.length
                ? post.images
                : post.image
                ? [post.image]
                : [];
            return (
              <>
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={(e) => {
                    const idx = Math.round(
                      e.nativeEvent.contentOffset.x / width
                    );
                    setActiveIndex(idx);
                    if (images[idx]) setMainImage(images[idx]);
                  }}
                >
                  {images.map((img, idx) => (
                    <TouchableOpacity
                      key={idx}
                      activeOpacity={0.9}
                      onPress={() =>
                        (navigation as any).navigate("ImageViewer", {
                          images,
                          initialIndex: idx,
                        })
                      }
                    >
                      <Image
                        source={{ uri: img }}
                        style={[styles.coverImage, { width }]}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Dot indicator */}
                {images.length > 1 && (
                  <View style={styles.dotContainer} pointerEvents="none">
                    {images.map((_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.dot,
                          i === activeIndex ? styles.dotActive : null,
                        ]}
                      />
                    ))}
                  </View>
                )}

                {post.category?.toLowerCase().includes("cảnh báo") && (
                  <View style={styles.warningOverlay}>
                    <Text style={styles.warningIcon}>⚠️</Text>
                  </View>
                )}
              </>
            );
          })()}
        </View>

        {/* Title and Meta */}
        <View style={styles.titleSection}>
          <View
            style={[
              styles.categoryChip,
              { backgroundColor: getCategoryColor(post.category) },
            ]}
          >
            <Text style={styles.categoryText}>{post.category}</Text>
          </View>
          <Text style={styles.title}>{post.title}</Text>
          <View style={styles.metaContainer}>
            <View style={styles.metaRow}>
              {post.author && (
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Tác giả</Text>
                  <Text style={styles.metaValue}>{post.author}</Text>
                </View>
              )}
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Ngày</Text>
                <Text style={styles.metaValue}>{formatDate(post.date)}</Text>
              </View>
            </View>
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Lượt xem</Text>
                <Text style={styles.metaValue}>{post.viewCount || 0}</Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Thời gian đọc</Text>
                <Text style={styles.metaValue}>{readingTime} phút</Text>
              </View>
            </View>
          </View>
        </View>

        {/* External Link Button */}
        {post.type === "external" && post.externalLink && (
          <TouchableOpacity
            style={styles.externalButton}
            onPress={async () => {
              try {
                const url = post.externalLink!.toString();
                const can = await Linking.canOpenURL(url);
                if (can) {
                  await Linking.openURL(url);
                } else {
                  // Some platforms/links may refuse; try opening with https prefix if missing
                  const alt = url.startsWith("http") ? url : `https://${url}`;
                  const canAlt = await Linking.canOpenURL(alt);
                  if (canAlt) {
                    await Linking.openURL(alt);
                  } else {
                    console.warn("Cannot open external URL:", url);
                    alert("Không thể mở liên kết. Vui lòng thử lại sau.");
                  }
                }
              } catch (err) {
                console.warn("Error opening external link:", err);
                alert("Không thể mở liên kết. Vui lòng thử lại sau.");
              }
            }}
          >
            <Text style={styles.externalButtonText}>🔗 Đọc tại nguồn</Text>
          </TouchableOpacity>
        )}

        {/* Content */}
        <View style={styles.contentSection}>
          {post.content ? (
            renderContent(post.content)
          ) : (
            <Text style={styles.noContent}>
              {post.excerpt || "Nội dung đang được cập nhật."}
            </Text>
          )}
        </View>

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <View style={styles.tagsSection}>
            <View style={styles.tagsList}>
              {post.tags.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={styles.tag}
                  onPress={() => console.log("Filter by tag:", tag)}
                >
                  <Text style={styles.tagValue}>{tag}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Related Posts */}
        {relatedPosts.length > 0 && (
          <View style={styles.relatedSection}>
            <Text style={styles.relatedTitle}>Bài viết liên quan</Text>
            {relatedPosts.map((rel) => (
              <TouchableOpacity
                key={rel.id}
                style={styles.relatedCard}
                onPress={() =>
                  (navigation as any).navigate("BlogDetail", { blogId: rel.id })
                }
              >
                <Image
                  source={{ uri: rel.image }}
                  style={styles.relatedImage}
                  resizeMode="cover"
                />
                <View style={styles.relatedContent}>
                  <Text numberOfLines={2} style={styles.relatedTitleText}>
                    {rel.title}
                  </Text>
                  <Text style={styles.relatedCategory}>{rel.category}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: theme.SIZES.padding * 3 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.COLORS.white,
  },
  header: {
    paddingHorizontal: theme.SIZES.padding,
    paddingVertical: 12,
    marginTop: 5,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: theme.COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  backButton: {
    ...theme.FONTS.body4,
    color: theme.COLORS.primary,
    fontWeight: "700",
    fontSize: 18,
  },
  shareButton: {
    fontSize: 18,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: theme.SIZES.padding,
  },
  errorText: {
    ...theme.FONTS.h4,
    color: theme.COLORS.gray,
  },
  coverContainer: {
    width: "100%",
    height: 300,
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  dotContainer: {
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.6)",
    marginHorizontal: 4,
  },
  dotActive: {
    width: 12,
    height: 12,
    borderRadius: 12,
    backgroundColor: theme.COLORS.white,
  },
  warningOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 0, 0, 0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  warningIcon: {
    fontSize: 50,
  },
  titleSection: {
    paddingHorizontal: theme.SIZES.padding,
    paddingVertical: theme.SIZES.padding * 0.75,
  },
  categoryChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: theme.SIZES.margin,
  },
  categoryText: {
    ...theme.FONTS.body5,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: theme.COLORS.white,
    fontSize: 11,
  },
  title: {
    ...theme.FONTS.h2,
    color: theme.COLORS.secondary,
    marginBottom: theme.SIZES.margin * 0.6,
    fontWeight: "600",
    fontSize: 20,
    lineHeight: 26,
  },
  metaContainer: {
    marginTop: theme.SIZES.margin * 0.6,
    paddingTop: theme.SIZES.margin * 0.4,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginBottom: 8,
  },
  metaItem: {
    flex: 0.5,
    paddingRight: theme.SIZES.padding / 2,
  },
  metaLabel: {
    ...theme.FONTS.body5,
    color: "#9aa0a6",
    marginBottom: 4,
    fontSize: 11,
  },
  metaValue: {
    ...theme.FONTS.body4,
    color: theme.COLORS.secondary,
    fontWeight: "600",
    fontSize: 14,
  },
  externalButton: {
    marginHorizontal: theme.SIZES.padding,
    marginVertical: theme.SIZES.margin,
    backgroundColor: "#0084FF",
    paddingVertical: 12,
    paddingHorizontal: theme.SIZES.padding,
    borderRadius: 6,
    alignItems: "center",
  },
  externalButtonText: {
    ...theme.FONTS.body4,
    color: theme.COLORS.white,
    fontWeight: "600",
  },
  contentSection: {
    paddingHorizontal: theme.SIZES.padding,
    marginVertical: theme.SIZES.margin,
  },
  contentHeading: {
    ...theme.FONTS.h4,
    color: theme.COLORS.secondary,
    // marginVertical: theme.SIZES.margin,
    fontWeight: "600",
  },
  contentParagraph: {
    ...theme.FONTS.body4,
    color: "#555",
    // lineHeight: 26,
    // marginBottom: theme.SIZES.margin,
  },
  bulletList: {
    marginVertical: theme.SIZES.margin,
  },
  bulletItem: {
    flexDirection: "row",
    marginBottom: 8,
  },
  bullet: {
    ...theme.FONTS.body4,
    color: "#999",
    marginRight: 8,
    fontSize: 16,
  },
  bulletText: {
    ...theme.FONTS.body4,
    color: "#555",
    flex: 1,
    lineHeight: 22,
  },
  noContent: {
    ...theme.FONTS.body4,
    color: "#999",
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: theme.SIZES.padding,
  },
  sliderSection: {
    paddingHorizontal: theme.SIZES.padding,
    marginVertical: theme.SIZES.margin,
  },
  slider: {
    height: 160,
  },
  sliderImage: {
    width: 160,
    height: 160,
    marginRight: 8,
    borderRadius: 4,
  },
  tagsSection: {
    paddingHorizontal: theme.SIZES.padding,
    marginVertical: theme.SIZES.margin,
    paddingVertical: theme.SIZES.margin,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  tagsList: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  tag: {
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 6,
    marginBottom: 6,
  },
  tagValue: {
    ...theme.FONTS.body5,
    color: theme.COLORS.secondary,
    fontWeight: "500",
  },
  relatedSection: {
    paddingHorizontal: theme.SIZES.padding,
    marginVertical: theme.SIZES.margin,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    paddingTop: theme.SIZES.margin,
  },
  relatedTitle: {
    ...theme.FONTS.h4,
    color: theme.COLORS.secondary,
    marginBottom: theme.SIZES.margin,
    fontWeight: "600",
  },
  relatedCard: {
    flexDirection: "row",
    marginBottom: 12,
    backgroundColor: "#fafafa",
    borderRadius: 6,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  relatedImage: {
    width: 70,
    height: 70,
  },
  relatedContent: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: "center",
  },
  relatedTitleText: {
    ...theme.FONTS.body4,
    color: theme.COLORS.secondary,
    fontWeight: "500",
    marginBottom: 4,
  },
  relatedCategory: {
    ...theme.FONTS.body5,
    color: "#999",
  },
});

export default BlogDetailScreen;
