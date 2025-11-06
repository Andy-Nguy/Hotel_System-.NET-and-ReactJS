import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
  FlatList,
} from "react-native";
import { COLORS, SIZES, FONTS, SHADOWS } from "../constants/theme";

const blogsData = [
  {
    id: 1,
    tag: "Travel Trip",
    title: "Tremblant In Canada",
    date: "15th April, 2019",
    image: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800",
  },
  {
    id: 2,
    tag: "Camping",
    title: "Choosing A Static Caravan",
    date: "15th April, 2019",
    image: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800",
  },
  {
    id: 3,
    tag: "Event",
    title: "Trip To Iqaluit In Nunavut",
    date: "08th April, 2019",
    image: "https://images.unsplash.com/photo-1530789253388-582c481c54b0?w=800",
  },
];

const BlogSection: React.FC = () => {
  const renderBlog = ({ item }: { item: (typeof blogsData)[0] }) => (
    <TouchableOpacity activeOpacity={0.8} style={styles.blogContainer}>
      <ImageBackground
        source={{ uri: item.image }}
        style={styles.blogItem}
        imageStyle={styles.blogImage}
      >
        <View style={styles.blogOverlay}>
          <View style={styles.blogText}>
            <View style={styles.tag}>
              <Text style={styles.tagText}>{item.tag}</Text>
            </View>
            <Text style={styles.blogTitle}>{item.title}</Text>
            <View style={styles.blogTime}>
              <Text style={styles.timeIcon}>�</Text>
              <Text style={styles.timeText}>{item.date}</Text>
            </View>
          </View>
        </View>
      </ImageBackground>
    </TouchableOpacity>
  );

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
  },
  blogItem: {
    width: "100%",
    height: 280,
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
    backgroundColor: COLORS.primary,
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
  },
});

export default BlogSection;
