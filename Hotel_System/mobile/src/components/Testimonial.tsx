import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";

const testimonialsData = [
  {
    id: 1,
    text: "After a construction project took longer than expected, my husband, my daughter and I needed a place to stay for a few nights. As a Chicago resident, we know a lot about our city, neighborhood and the types of housing options available and absolutely love our vacation at Robins Villa.",
    author: "Alexander Vasquez",
    rating: 4.5,
  },
  {
    id: 2,
    text: "Robins Villa exceeded all our expectations! The service was impeccable, rooms were luxurious, and the location was perfect. We will definitely be returning for our next vacation. Highly recommended!",
    author: "Sarah Mitchell",
    rating: 5,
  },
];

const Testimonial: React.FC = () => {
  return (
    <View style={styles.section}>
      <View style={styles.container}>
        <View style={styles.sectionTitle}>
          <Text style={styles.span}>Testimonials</Text>
          <Text style={styles.h2}>What Customers Say?</Text>
        </View>
        {testimonialsData.map((testimonial) => (
          <View key={testimonial.id} style={styles.testimonialCard}>
            <Text style={styles.quote}>{testimonial.text}</Text>
            <View style={styles.author}>
              <View style={styles.rating}>
                {[...Array(5)].map((_, i) => (
                  <Text key={i} style={styles.star}>
                    {i < Math.floor(testimonial.rating)
                      ? "⭐"
                      : testimonial.rating > i
                      ? "⭐"
                      : "☆"}
                  </Text>
                ))}
              </View>
              <Text style={styles.authorName}>- {testimonial.author}</Text>
            </View>
            <Image
              source={{
                uri: "https://via.placeholder.com/100x50/dfa974/fff?text=Logo",
              }}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    paddingVertical: 50,
    paddingHorizontal: 20,
    backgroundColor: "#f5f5f5",
  },
  container: {
    width: "100%",
  },
  sectionTitle: {
    marginBottom: 40,
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
  testimonialCard: {
    backgroundColor: "#fff",
    padding: 30,
    marginBottom: 20,
    borderRadius: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  quote: {
    fontSize: 15,
    color: "#707079",
    lineHeight: 26,
    fontStyle: "italic",
    marginBottom: 20,
  },
  author: {
    alignItems: "center",
    marginBottom: 15,
  },
  rating: {
    flexDirection: "row",
    marginBottom: 8,
  },
  star: {
    fontSize: 14,
    marginHorizontal: 2,
  },
  authorName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#19191a",
  },
  logo: {
    width: 100,
    height: 40,
    alignSelf: "center",
  },
});

export default Testimonial;
