import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
  Image,
  StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONTS, SIZES } from "../constants/theme";

const { width, height } = Dimensions.get("window");

interface OnboardingSlide {
  id: string;
  image: any;
  title: string;
  subtitle: string;
  gradient: readonly [string, string, ...string[]];
}

const slides: OnboardingSlide[] = [
  {
    id: "1",
    image: {
      uri: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=80",
    },
    title: "Tìm Kiếm & Đặt Phòng\nKhách Sạn Lý Tưởng!",
    subtitle:
      "Khám phá các khách sạn hàng đầu,\nđặt phòng nhanh chóng và tận hưởng kỳ nghỉ tuyệt vời!",
    gradient: ["rgba(0,0,0,0.1)", "rgba(0,0,0,0.8)"] as const,
  },
  {
    id: "2",
    image: {
      uri: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&q=80",
    },
    title: "Trải Nghiệm Sang Trọng\nTại Đầu Ngón Tay",
    subtitle:
      "Dịch vụ đẳng cấp thế giới và\nsự hiếu khách khó quên đang chờ bạn",
    gradient: ["rgba(0,0,0,0.1)", "rgba(0,0,0,0.8)"] as const,
  },
  {
    id: "3",
    image: {
      uri: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80",
    },
    title: "Kỳ Nghỉ Trong Mơ\nBắt Đầu Từ Đây",
    subtitle:
      "Khám phá ưu đãi độc quyền và\ntạo nên những kỷ niệm đáng nhớ mãi mãi",
    gradient: ["rgba(0,0,0,0.1)", "rgba(0,0,0,0.8)"] as const,
  },
];

interface WelcomeScreenProps {
  onComplete: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index || 0);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const renderItem = ({ item }: { item: OnboardingSlide }) => (
    <View style={styles.slide}>
      <Image source={item.image} style={styles.image} resizeMode="cover" />
      <LinearGradient
        colors={item.gradient}
        style={styles.gradient}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      >
        <SafeAreaView style={styles.contentContainer}>
          {/* Skip Button */}
          <View style={styles.topBar}>
            <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
              <Text style={styles.skipText}>Bỏ qua</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.textContainer}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>{item.subtitle}</Text>
          </View>

          {/* Bottom Section */}
          <View style={styles.bottomContainer}>
            {/* Pagination Dots */}
            <View style={styles.pagination}>
              {slides.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    index === currentIndex && styles.activeDot,
                  ]}
                />
              ))}
            </View>

            {/* Get Started Button */}
            <TouchableOpacity
              style={styles.button}
              onPress={handleNext}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={["#4A4A4A", "#2A2A2A"]}
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.buttonText}>
                  {currentIndex === slides.length - 1 ? "Bắt Đầu" : "Tiếp Theo"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        bounces={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  slide: {
    width: width,
    height: height,
  },
  image: {
    width: width,
    height: height,
    position: "absolute",
  },
  gradient: {
    flex: 1,
    justifyContent: "space-between",
  },
  contentContainer: {
    flex: 1,
    justifyContent: "space-between",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    opacity: 0.9,
  },
  textContainer: {
    paddingHorizontal: 30,
    paddingBottom: 40,
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 16,
    lineHeight: 42,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: "#FFFFFF",
    opacity: 0.85,
    lineHeight: 24,
    fontWeight: "400",
  },
  bottomContainer: {
    paddingHorizontal: 30,
    paddingBottom: 40,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 30,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    marginHorizontal: 4,
  },
  activeDot: {
    width: 24,
    backgroundColor: "#FFFFFF",
  },
  button: {
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonGradient: {
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
});

export default WelcomeScreen;
