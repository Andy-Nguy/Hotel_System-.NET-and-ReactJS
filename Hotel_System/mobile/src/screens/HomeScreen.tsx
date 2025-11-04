import React from "react";
import { ScrollView, StyleSheet } from "react-native";
import HeroSection from "../components/HeroSection";
import AboutUs from "../components/AboutUs";
import Services from "../components/Services";
import HomeRoom from "../components/HomeRoom";
import Testimonial from "../components/Testimonial";
import BlogSection from "../components/BlogSection";

const HomeScreen: React.FC = () => {
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <HeroSection />
      <AboutUs />
      <Services />
      <HomeRoom />
      <Testimonial />
      <BlogSection />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
});

export default HomeScreen;
