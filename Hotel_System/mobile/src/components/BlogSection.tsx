import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { COLORS, SIZES, FONTS } from "../constants/theme";

interface BlogData {
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
  displayOrder?: number;
}
const getCategoryColor = (category: string): string => {
  const colors: { [key: string]: string } = {
    "Travel Trip": COLORS.primary,
    "Camping": COLORS.secondary,
    "Event": COLORS.warning,
    "Blog": COLORS.primary,
    "Khách sạn Sang Trọng": COLORS.primary,
    "CẢNH BÁO KHẨN CẤP": COLORS.error,
    "Ẩm thực": COLORS.secondary,
  };
  return colors[category] || COLORS.primary;
};

const BlogSection: React.FC = () => {
  const navigation = useNavigation<any>();
  const [blogsData, setBlogsData] = useState<BlogData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBlogs();
  }, []);

  const fetchBlogs = async () => {
    // Android emulator: 10.0.2.2 maps to localhost
    // iOS simulator: localhost works directly
    const apiEndpoints = [
      "http://10.0.2.2:5001/api/blog",
      "http://localhost:5001/api/blog",
      "https://localhost:5001/api/blog",
    ];

    for (const endpoint of apiEndpoints) {
      try {
        console.log(`📡 Fetching from: ${endpoint}`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

        const res = await fetch(endpoint, {
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        console.log(`✅ Response from ${endpoint}: ${res.status}`);
        if (res.ok) {
          const data = await res.json();
          console.log(`✅ Data fetched successfully:`, data);
          if (!Array.isArray(data) || data.length === 0) {
            console.log("⚠️ Empty data, continuing to next endpoint...");
            continue;
          }

          const mapped: BlogData[] = (data as any[])
            .filter(d => (d.status || d.Status || '').toString().toUpperCase() === 'PUBLISHED' && (d.displayOrder !== undefined && d.displayOrder !== null))
            .map((d) => ({
            id: d.id || d.Id,
            title: d.title || d.Title || "",
            category: d.category || d.Category || "Blog",
            type: (d.type || d.Type || "internal") as "internal" | "external",
            externalLink: d.externalLink || d.ExternalLink,
            image: d.image || d.Image || "https://via.placeholder.com/800x400?text=No+Image",
            date: d.date || d.Date || d.publishedAt || d.PublishedAt || "",
            excerpt: d.excerpt || d.Excerpt || "",
            author: d.author || d.Author || "",
            tags: d.tags || d.Tags || [],
            content: d.content || d.Content || "",
            images: d.images || d.Images || [],
            status: d.status || d.Status || "published",
            displayOrder: typeof d.displayOrder === 'number' ? d.displayOrder : (typeof d.displayOrder === 'string' && !isNaN(parseInt(d.displayOrder)) ? parseInt(d.displayOrder) : undefined),
          }));
          // Sort by displayOrder ascending and take up to 5
          mapped.sort((a, b) => (typeof a.displayOrder === 'number' ? a.displayOrder! : 999) - (typeof b.displayOrder === 'number' ? b.displayOrder! : 999));
          setBlogsData(mapped.slice(0, 5));
          setLoading(false);
          console.log(`✅ Blog data loaded from ${endpoint}`);
          return;
        }
      } catch (e: any) {
        console.warn(`❌ Error from ${endpoint}:`, e.message);
        continue;
      }
    }
    // All endpoints failed
    console.warn("❌ All endpoints failed, no data available");
    setBlogsData([]);
    setLoading(false);
  };

  const handleBlogPress = (blog: BlogData) => {
    if (blog.type === "external" && blog.externalLink) {
      alert("External link: " + blog.externalLink);
    } else {
      navigation.navigate("BlogDetail", { blogId: blog.id });
    }
  };

  const renderBlog = ({ item, index }: { item: BlogData; index: number }) => {
    const isLarge = index === 0 || index === 1;
    const height = isLarge ? 300 : 200;

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        style={[styles.blogContainer, { height }]}
        onPress={() => handleBlogPress(item)}
      >
        <ImageBackground
          source={{ uri: item.image }}
          style={styles.blogItem}
          imageStyle={styles.blogImage}
        >
          <View style={styles.blogOverlay}>
            <View style={styles.blogText}>
              <View
                style={[
                  styles.tag,
                  { backgroundColor: getCategoryColor(item.category) },
                ]}
              >
                <Text style={styles.tagText}>{item.category}</Text>
              </View>
              <Text style={styles.blogTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <View style={styles.blogTime}>
                <Text style={styles.timeIcon}>🕐</Text>
                <Text style={styles.timeText} numberOfLines={1}>
                  {item.date}
                </Text>
              </View>
            </View>
          </View>
        </ImageBackground>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.section}>
        <View style={styles.sectionTitle}>
          <Text style={styles.span}>Hotel News</Text>
          <Text style={styles.h2}>Our Blog & Event</Text>
        </View>
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      </View>
    );
  }

  if (blogsData.length === 0) {
    return (
      <View style={styles.section}>
        <View style={styles.sectionTitle}>
          <Text style={styles.span}>Hotel News</Text>
          <Text style={styles.h2}>Our Blog & Event</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📰</Text>
          <Text style={styles.emptyText}>Không có bài viết nào</Text>
          <Text style={styles.emptySubtext}>Vui lòng kiểm tra kết nối mạng và thử lại</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.sectionTitle}>
        <Text style={styles.span}>Hotel News</Text>
        <Text style={styles.h2}>Our Blog & Event</Text>
      </View>

      <FlatList
        data={blogsData}
        renderItem={renderBlog}
        keyExtractor={(item) => item.id.toString()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
        scrollEnabled={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    paddingVertical: SIZES.padding * 3,
    paddingHorizontal: SIZES.padding,
    backgroundColor: COLORS.white,
  },
  sectionTitle: {
    marginBottom: SIZES.margin * 2,
    alignItems: "center",
  },
  span: {
    ...FONTS.body5,
    color: COLORS.primary,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 8,
  },
  h2: {
    ...FONTS.h2,
    color: COLORS.secondary,
    marginTop: 8,
    textAlign: "center",
  },
  listContainer: {
    paddingBottom: SIZES.padding,
  },
  blogContainer: {
    marginBottom: SIZES.margin * 1.5,
    borderRadius: SIZES.radiusLarge,
    overflow: "hidden",
  },
  blogItem: {
    width: "100%",
    borderRadius: SIZES.radiusLarge,
    overflow: "hidden",
  },
  blogImage: {
    borderRadius: SIZES.radiusLarge,
  },
  blogOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.2)",
    justifyContent: "flex-end",
  },
  blogText: {
    backgroundColor: "rgba(255,255,255,0.95)",
    padding: SIZES.padding * 1.5,
    borderBottomLeftRadius: SIZES.radiusLarge,
    borderBottomRightRadius: SIZES.radiusLarge,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: SIZES.radius,
    alignSelf: "flex-start",
    marginBottom: SIZES.margin,
  },
  tagText: {
    color: COLORS.white,
    ...FONTS.body5,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  blogTitle: {
    ...FONTS.h4,
    color: COLORS.secondary,
    marginBottom: SIZES.margin,
  },
  blogTime: {
    flexDirection: "row",
    alignItems: "center",
  },
  timeIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  timeText: {
    ...FONTS.body4,
    color: COLORS.gray,
    flex: 1,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SIZES.padding * 4,
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: SIZES.margin * 2,
  },
  emptyText: {
    ...FONTS.h3,
    color: COLORS.secondary,
    marginBottom: SIZES.margin,
    textAlign: "center",
  },
  emptySubtext: {
    ...FONTS.body4,
    color: COLORS.gray,
    textAlign: "center",
    paddingHorizontal: SIZES.padding * 2,
  },
});

export default BlogSection;
