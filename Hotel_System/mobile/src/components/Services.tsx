import React from "react";
import { View, Text, StyleSheet } from "react-native";

const servicesData = [
  {
    id: 1,
    icon: "✈️",
    title: "Travel Plan",
    description:
      "We provide expert travel planning services to help you explore the best destinations worldwide.",
  },
  {
    id: 2,
    icon: "🍽️",
    title: "Catering Service",
    description:
      "Enjoy delicious meals prepared by our professional chefs with a variety of cuisines.",
  },
  {
    id: 3,
    icon: "👶",
    title: "Babysitting",
    description:
      "Professional babysitting services available to ensure your children are well cared for.",
  },
  {
    id: 4,
    icon: "🧺",
    title: "Laundry",
    description:
      "Convenient laundry services to keep your clothes fresh and clean during your stay.",
  },
  {
    id: 5,
    icon: "🚗",
    title: "Hire Driver",
    description:
      "Professional drivers available for hire to take you anywhere you need to go.",
  },
  {
    id: 6,
    icon: "🍹",
    title: "Bar & Drink",
    description:
      "Relax at our bar with a wide selection of premium drinks and cocktails.",
  },
];

const Services: React.FC = () => {
  return (
    <View style={styles.section}>
      <View style={styles.container}>
        <View style={styles.sectionTitle}>
          <Text style={styles.span}>What We Do</Text>
          <Text style={styles.h2}>Discover Our Services</Text>
        </View>
        <View style={styles.servicesGrid}>
          {servicesData.map((service) => (
            <View key={service.id} style={styles.serviceItem}>
              <Text style={styles.icon}>{service.icon}</Text>
              <Text style={styles.title}>{service.title}</Text>
              <Text style={styles.description}>{service.description}</Text>
            </View>
          ))}
        </View>
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
    textAlign: "center",
  },
  servicesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  serviceItem: {
    width: "48%",
    backgroundColor: "#fff",
    padding: 20,
    marginBottom: 20,
    borderRadius: 4,
    alignItems: "center",
  },
  icon: {
    fontSize: 40,
    marginBottom: 15,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#19191a",
    marginBottom: 10,
    textAlign: "center",
  },
  description: {
    fontSize: 14,
    color: "#707079",
    lineHeight: 22,
    textAlign: "center",
  },
});

export default Services;
