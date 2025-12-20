import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { COLORS, SIZES, FONTS } from "../constants/theme";
import { getPublishedBlogs, BlogPost } from "../api/blogApi";

type BlogData = BlogPost;
const getCategoryColor = (category?: string): string => {
  const colors: { [key: string]: string } = {
    "Travel Trip": COLORS.primary,
    Camping: COLORS.secondary,
    Event: COLORS.warning,
    Blog: COLORS.primary,
    "Khách sạn Sang Trọng": COLORS.primary,
    "CẢNH BÁO KHẨN CẤP": COLORS.error,
    "Ẩm thực": COLORS.secondary,
  };
  return colors[category || ""] || COLORS.primary;
};

const BlogSection: React.FC = () => {
  const navigation = useNavigation<any>();
  const [blogsData, setBlogsData] = useState<BlogData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBlogs();
  }, []);

  const fetchBlogs = async () => {
    try {
      console.log("📡 Fetching published blogs...");
      const data = await getPublishedBlogs();
      console.log(`✅ Published blogs loaded: ${data.length} blogs`);
      console.log("📝 Blog data sample:", JSON.stringify(data[0], null, 2));
      setBlogsData(data);
    } catch (e) {
      console.warn("❌ Failed to fetch blogs:", e);
      setBlogsData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleBlogPress = (blog: BlogData) => {
    if (blog.type === "external" && blog.externalLink) {
      Linking.openURL(blog.externalLink).catch((err) => {
        console.error("Failed to open URL:", err);
        Alert.alert("Lỗi", "Không thể mở liên kết này");
      });
    } else {
      navigation.navigate("BlogDetail", { blogId: blog.id });
    }
  };

  const renderBlog = ({ item, index }: { item: BlogData; index: number }) => {
    console.log(
      `🎨 Rendering blog ${index}: ${item.title}, image: ${item.image}`
    );

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        style={styles.blogCard}
        onPress={() => handleBlogPress(item)}
      >
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: item.image }}
            style={styles.blogImage}
            resizeMode="cover"
          />
          <View style={styles.imageDarkOverlay} />
          <View
            style={[
              styles.categoryBadge,
              { backgroundColor: getCategoryColor(item.category) },
            ]}
          >
            <Text style={styles.categoryText}>{item.category}</Text>
          </View>
        </View>
        
        <View style={styles.contentContainer}>
          <Text style={styles.blogTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <View style={styles.blogFooter}>
            <View style={styles.dateContainer}>
              <Text style={styles.dateIcon}>📅</Text>
              <Text style={styles.dateText}>{item.date}</Text>
            </View>
            <View style={styles.readMoreContainer}>
              <Text style={styles.readMoreText}>Xem thêm</Text>
              <Text style={styles.arrowIcon}>→</Text>
            </View>
          </View>
        </View>
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
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
          style={{ marginTop: 40 }}
        />
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
          <Text style={styles.emptySubtext}>
            Vui lòng kiểm tra kết nối mạng và thử lại
          </Text>
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

      <View style={styles.listContainer}>
        {blogsData.map((item, index) => (
          <View key={item.id.toString()}>{renderBlog({ item, index })}</View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    paddingVertical: SIZES.padding * 2.5,
    paddingHorizontal: SIZES.padding,
    backgroundColor: "#F8F9FA",
  },
  sectionTitle: {
    marginBottom: SIZES.margin * 2.5,
    alignItems: "center",
  },
  span: {
    ...FONTS.body5,
    color: COLORS.primary,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  h2: {
    ...FONTS.h2,
    color: COLORS.secondary,
    fontWeight: "700",
    marginTop: 4,
    textAlign: "center",
  },
  listContainer: {
    paddingBottom: SIZES.padding,
  },
  blogCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    marginBottom: SIZES.margin * 2,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  imageContainer: {
    width: "100%",
    height: 220,
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#E8E8E8",
  },
  blogImage: {
    width: "100%",
    height: "100%",
  },
  imageDarkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.15)",
  },
  categoryBadge: {
    position: "absolute",
    top: 16,
    left: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryText: {
    color: COLORS.white,
    ...FONTS.body5,
    fontWeight: "700",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  contentContainer: {
    padding: SIZES.padding * 1.5,
  },
  blogTitle: {
    ...FONTS.h4,
    color: COLORS.secondary,
    fontWeight: "700",
    lineHeight: 26,
    marginBottom: SIZES.margin * 1.2,
  },
  blogFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dateContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  dateIcon: {
    fontSize: 15,
    marginRight: 6,
  },
  dateText: {
    ...FONTS.body4,
    color: COLORS.gray,
    fontSize: 13,
  },
  readMoreContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  readMoreText: {
    ...FONTS.body4,
    color: COLORS.primary,
    fontWeight: "600",
    fontSize: 13,
    marginRight: 4,
  },
  arrowIcon: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: "700",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SIZES.padding * 4,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    marginHorizontal: SIZES.margin,
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
