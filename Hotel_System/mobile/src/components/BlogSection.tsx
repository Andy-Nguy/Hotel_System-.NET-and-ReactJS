import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
} from "react-native";

const blogsData = [
  {
    id: 1,
    tag: "Travel Trip",
    title: "Tremblant In Canada",
    date: "15th April, 2019",
    image: "https://via.placeholder.com/300x200/dfa974/fff?text=Blog+1",
    large: false,
  },
  {
    id: 2,
    tag: "Camping",
    title: "Choosing A Static Caravan",
    date: "15th April, 2019",
    image: "https://via.placeholder.com/300x200/dfa974/fff?text=Blog+2",
    large: false,
  },
  {
    id: 3,
    tag: "Event",
    title: "Trip To Iqaluit In Nunavut",
    date: "08th April, 2019",
    image: "https://via.placeholder.com/600x200/dfa974/fff?text=Blog+Featured",
    large: true,
  },
];

const BlogSection: React.FC = () => {
  return (
    <View style={styles.section}>
      <View style={styles.container}>
        <View style={styles.sectionTitle}>
          <Text style={styles.span}>Hotel News</Text>
          <Text style={styles.h2}>Our Blog & Event</Text>
        </View>
        {blogsData.map((blog) => (
          <TouchableOpacity key={blog.id} activeOpacity={0.8}>
            <ImageBackground
              source={{ uri: blog.image }}
              style={[styles.blogItem, blog.large && styles.blogItemLarge]}
              imageStyle={styles.blogImage}
            >
              <View style={styles.blogOverlay}>
                <View style={styles.blogText}>
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>{blog.tag}</Text>
                  </View>
                  <Text style={styles.blogTitle}>{blog.title}</Text>
                  <View style={styles.blogTime}>
                    <Text style={styles.timeIcon}>🕐</Text>
                    <Text style={styles.timeText}>{blog.date}</Text>
                  </View>
                </View>
              </View>
            </ImageBackground>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    paddingVertical: 50,
    paddingHorizontal: 20,
    backgroundColor: "#fff",
  },
  container: {
    width: "100%",
  },
  sectionTitle: {
    marginBottom: 30,
    alignItems: "center",
  },
  span: {
    fontSize: 12,
    color: "#dfa974",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 8,
  },
  h2: {
    fontSize: 32,
    fontWeight: "700",
    color: "#19191a",
    marginTop: 8,
  },
  blogItem: {
    width: "100%",
    height: 250,
    marginBottom: 20,
    borderRadius: 4,
    overflow: "hidden",
  },
  blogItemLarge: {
    height: 300,
  },
  blogImage: {
    borderRadius: 4,
  },
  blogOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "flex-end",
  },
  blogText: {
    backgroundColor: "rgba(255,255,255,0.95)",
    padding: 20,
  },
  tag: {
    backgroundColor: "#dfa974",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 3,
    alignSelf: "flex-start",
    marginBottom: 10,
  },
  tagText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  blogTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#19191a",
    marginBottom: 10,
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
    fontSize: 13,
    color: "#707079",
  },
});

export default BlogSection;
