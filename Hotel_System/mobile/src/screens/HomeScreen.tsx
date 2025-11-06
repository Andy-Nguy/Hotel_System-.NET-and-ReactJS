import React from "react";
import { ScrollView, StyleSheet } from "react-native";
import HeroSection from "../components/HeroSection";
import AboutUs from "../components/AboutUs";
import Services from "../components/Services";
import HomeRoom from "../components/HomeRoom";
import Testimonial from "../components/Testimonial";
import BlogSection from "../components/BlogSection";
import Footer from "../components/Footer";
import { COLORS } from "../constants/theme";

const HomeScreen: React.FC = () => {
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <HeroSection />
      <AboutUs />
      <Services />
      <HomeRoom />
      <Testimonial />
      <BlogSection />
      <Footer />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
});

export default HomeScreen;
