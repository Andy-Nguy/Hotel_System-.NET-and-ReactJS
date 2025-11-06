import React from "react";
import { View, Text, StyleSheet, FlatList, Dimensions } from "react-native";
import { COLORS, SIZES, FONTS, SHADOWS } from "../constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const testimonialsData = [
  {
    id: 1,
    text: "After a construction project took longer than expected, my husband, my daughter and I needed a place to stay for a few nights. As a Chicago resident, we know a lot about our city, neighborhood and the types of housing options available and absolutely love our vacation at Robins Villa.",
    author: "Alexander Vasquez",
    role: "Business Traveler",
    rating: 5,
  },
  {
    id: 2,
    text: "Robins Villa exceeded all our expectations! The service was impeccable, rooms were luxurious, and the location was perfect. We will definitely be returning for our next vacation. Highly recommended!",
    author: "Sarah Mitchell",
    role: "Vacation Guest",
    rating: 5,
  },
];

const Testimonial: React.FC = () => {
  const renderTestimonial = ({
    item,
  }: {
    item: (typeof testimonialsData)[0];
  }) => (
    <View style={styles.testimonialCard}>
      <View style={styles.quoteIcon}>
        <Text style={styles.quoteText}>"</Text>
      </View>
      <Text style={styles.quote}>{item.text}</Text>
      <View style={styles.rating}>
        {[...Array(item.rating)].map((_, i) => (
          <Text key={i} style={styles.star}>
            ⭐
          </Text>
        ))}
      </View>
      <View style={styles.authorContainer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.author[0]}</Text>
        </View>
        <View style={styles.authorInfo}>
          <Text style={styles.authorName}>{item.author}</Text>
          <Text style={styles.authorRole}>{item.role}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.section}>
      <View style={styles.sectionTitle}>
        <Text style={styles.span}>Testimonials</Text>
        <Text style={styles.h2}>What Customers Say?</Text>
      </View>

      <FlatList
        data={testimonialsData}
        renderItem={renderTestimonial}
        keyExtractor={(item) => item.id.toString()}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
        snapToInterval={SCREEN_WIDTH - SIZES.padding * 3}
        decelerationRate="fast"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    paddingVertical: SIZES.padding * 3,
    backgroundColor: COLORS.background,
  },
  sectionTitle: {
    marginBottom: SIZES.margin * 2,
    alignItems: "center",
    paddingHorizontal: SIZES.padding,
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
    paddingHorizontal: SIZES.padding,
  },
  testimonialCard: {
    backgroundColor: COLORS.white,
    padding: SIZES.padding * 2,
    borderRadius: SIZES.radiusLarge,
    marginRight: SIZES.margin,
    width: SCREEN_WIDTH - SIZES.padding * 4,
    ...SHADOWS.medium,
  },
  quoteIcon: {
    marginBottom: SIZES.margin,
  },
  quoteText: {
    fontSize: 48,
    color: COLORS.primary,
    opacity: 0.3,
    lineHeight: 48,
  },
  quote: {
    ...FONTS.body2,
    color: COLORS.gray,
    lineHeight: 26,
    fontStyle: "italic",
    marginBottom: SIZES.margin * 1.5,
  },
  rating: {
    flexDirection: "row",
    marginBottom: SIZES.margin * 1.5,
  },
  star: {
    fontSize: 16,
    marginRight: 4,
  },
  authorContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: SIZES.margin,
  },
  avatarText: {
    ...FONTS.h4,
    color: COLORS.white,
    fontWeight: "700",
  },
  authorInfo: {
    flex: 1,
  },
  authorName: {
    ...FONTS.body2,
    color: COLORS.secondary,
    fontWeight: "700",
    marginBottom: 4,
  },
  authorRole: {
    ...FONTS.body3,
    color: COLORS.primary,
  },
});

export default Testimonial;
