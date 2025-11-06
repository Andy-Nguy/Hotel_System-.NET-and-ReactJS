import React from "react";
import { View, Text, StyleSheet, FlatList } from "react-native";
import { COLORS, SIZES, FONTS, SHADOWS } from "../constants/theme";

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
  const renderService = ({ item }: { item: (typeof servicesData)[0] }) => (
    <View style={styles.serviceItem}>
      <Text style={styles.icon}>{item.icon}</Text>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.description}>{item.description}</Text>
    </View>
  );

  return (
    <View style={styles.section}>
      <View style={styles.sectionTitle}>
        <Text style={styles.span}>What We Do</Text>
        <Text style={styles.h2}>Discover Our Services</Text>
      </View>

      <FlatList
        data={servicesData}
        renderItem={renderService}
        keyExtractor={(item) => item.id.toString()}
        numColumns={2}
        columnWrapperStyle={styles.row}
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
    backgroundColor: COLORS.background,
  },
  sectionTitle: {
    marginBottom: SIZES.margin * 2.5,
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
  row: {
    justifyContent: "space-between",
  },
  serviceItem: {
    width: "48%",
    backgroundColor: COLORS.white,
    padding: SIZES.padding * 1.5,
    marginBottom: SIZES.margin * 1.5,
    borderRadius: SIZES.radiusLarge,
    alignItems: "center",
    ...SHADOWS.light,
  },
  icon: {
    fontSize: 48,
    marginBottom: SIZES.margin,
  },
  title: {
    ...FONTS.h4,
    color: COLORS.secondary,
    marginBottom: SIZES.margin,
    textAlign: "center",
  },
  description: {
    ...FONTS.body3,
    color: COLORS.gray,
    lineHeight: 22,
    textAlign: "center",
  },
});

export default Services;
