import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  FlatList,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONTS, SIZES } from "../constants/theme";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { TabParamList } from "../components/BottomTabNavigator";
import servicesApi, { Service } from "../api/servicesApi";

const { width } = Dimensions.get("window");

const GALLERY_SECTIONS = [
  {
    id: "hotel",
    title: "Không gian Khách sạn",
    description: "Khám phá vẻ đẹp kiến trúc và không gian sang trọng đẳng cấp.",
    images: [
      require("../assets/img/gallery/Hotel/2.jpg"),
      require("../assets/img/gallery/Hotel/3.png"),
      require("../assets/img/gallery/Hotel/4.png"),
      require("../assets/img/gallery/Hotel/5.png"),
    ],
  },
  {
    id: "amenities",
    title: "Tiện nghi & Giải trí",
    description: "Tận hưởng những tiện ích 5 sao: Hồ bơi, Gym, Spa và hơn thế nữa.",
    images: [
      require("../assets/img/gallery/Amenties/1.jpg"),
      require("../assets/img/gallery/Amenties/2.jpg"),
      require("../assets/img/gallery/Amenties/3.avif"),
      require("../assets/img/gallery/Amenties/4.jpg"),
      require("../assets/img/gallery/Amenties/5.jpg"),
      require("../assets/img/gallery/Amenties/6.avif"),
      require("../assets/img/gallery/Amenties/7.jpg"),
    ],
  },
  {
    id: "dining",
    title: "Ẩm thực & Nhà hàng",
    description: "Trải nghiệm ẩm thực tinh tế từ các đầu bếp hàng đầu thế giới.",
    images: [
      require("../assets/img/gallery/restaurants/1.jpg"),
      require("../assets/img/gallery/restaurants/2.png"),
      require("../assets/img/gallery/restaurants/3.jpg"),
      require("../assets/img/gallery/restaurants/4.jpg"),
      require("../assets/img/gallery/restaurants/5.jpg"),
      require("../assets/img/gallery/restaurants/6.jpg"),
      require("../assets/img/gallery/restaurants/7.jpg"),
      require("../assets/img/gallery/restaurants/8.jpg"),
    ],
  },
];

const TESTIMONIALS = [
  {
    id: "1",
    name: "Nguyễn Văn A",
    comment: "Một trải nghiệm tuyệt vời! Dịch vụ xuất sắc và phòng ốc sang trọng.",
    rating: 5,
  },
  {
    id: "2",
    name: "Trần Thị B",
    comment: "Không gian yên tĩnh, hồ bơi đẹp. Chắc chắn sẽ quay lại.",
    rating: 5,
  },
];

const HotelIntroductionScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<TabParamList>>();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const data = await servicesApi.getServices();
        setServices(data);
      } catch (error) {
        console.error("Failed to fetch services:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, []);

  const renderServiceCard = ({ item }: { item: Service }) => (
    <View style={styles.amenityCard}>
      <Image
        source={{
          uri:
            item.hinhDichVu ||
            "https://images.unsplash.com/photo-1566073771259-6a8506099945?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
        }}
        style={styles.amenityImage}
      />
      <View style={styles.amenityOverlay} />
      <View style={styles.amenityContent}>
        <Text style={styles.amenityName}>{item.tenDichVu}</Text>
        <Text style={styles.amenityDesc} numberOfLines={2}>
          {item.thongTinDv}
        </Text>
      </View>
    </View>
  );

  const renderHotelGallery = (images: any[]) => (
    <View style={styles.hotelGrid}>
      <Image source={images[0]} style={styles.hotelMainImg} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hotelSubGridScroll}>
        {images.slice(1).map((img, index) => (
          <Image key={index} source={img} style={styles.hotelSubImg} />
        ))}
      </ScrollView>
    </View>
  );

  const renderAmenitiesGallery = (images: any[]) => {
    // Group into chunks of 3 for the mosaic pattern (1 Large + 2 Small)
    const chunks = [];
    for (let i = 0; i < images.length; i += 3) {
      chunks.push(images.slice(i, i + 3));
    }

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.amenityScroll}>
        {chunks.map((chunk, chunkIndex) => (
          <View key={chunkIndex} style={styles.amenityMosaicChunk}>
            {/* Large Image */}
            {chunk[0] && <Image source={chunk[0]} style={styles.amenityMosaicLarge} />}
            
            {/* Column of 2 Small Images */}
            {(chunk[1] || chunk[2]) && (
              <View style={styles.amenityMosaicColumn}>
                {chunk[1] && <Image source={chunk[1]} style={styles.amenityMosaicSmall} />}
                {chunk[2] && <Image source={chunk[2]} style={styles.amenityMosaicSmall} />}
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderDiningGallery = (images: any[]) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.diningScroll}>
      {images.map((img, index) => (
        <Image key={index} source={img} style={styles.diningImg} />
      ))}
    </ScrollView>
  );

  const renderGallerySection = (section: typeof GALLERY_SECTIONS[0]) => {
    switch (section.id) {
      case "hotel":
        return renderHotelGallery(section.images);
      case "amenities":
        return renderAmenitiesGallery(section.images);
      case "dining":
        return renderDiningGallery(section.images);
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }} // Increased padding to clear bottom tab bar
      >
        {/* Hero Section */}
        <View style={styles.heroContainer}>
          <Image
            source={require("../assets/img/gallery/Hotel/1.png")}
            style={styles.heroImage}
          />
          <View style={styles.heroOverlay}>
            <View style={styles.heroContent}>
              <Text style={styles.heroSubtitle}>CHÀO MỪNG ĐẾN VỚI</Text>
              <Text style={styles.heroTitle}>ROBIN'S VILLA</Text>
              <View style={styles.ratingContainer}>
                <Ionicons name="star" size={16} color="#FFD700" />
                <Ionicons name="star" size={16} color="#FFD700" />
                <Ionicons name="star" size={16} color="#FFD700" />
                <Ionicons name="star" size={16} color="#FFD700" />
                <Ionicons name="star" size={16} color="#FFD700" />
                <Text style={styles.ratingText}>5.0 Khách sạn hạng sang</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Story Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Câu chuyện của chúng tôi</Text>
          <Text style={styles.storyText}>
            Tọa lạc tại vị trí đắc địa giữa lòng thành phố, Robin's Villa là
            biểu tượng của sự sang trọng và tinh tế. Được thành lập với sứ mệnh
            mang đến một không gian nghỉ dưỡng đẳng cấp, nơi vẻ đẹp hiện đại hòa
            quyện cùng thiên nhiên trong lành.
          </Text>
          <Text style={[styles.storyText, { marginTop: 10 }]}>
            Mỗi góc nhỏ tại Robin's Villa đều được chăm chút tỉ mỉ, từ nội thất
            thủ công tinh xảo đến các dịch vụ cá nhân hóa. Chúng tôi cam kết
            mang đến cho quý khách những trải nghiệm khó quên, đánh thức mọi giác
            quan và tái tạo năng lượng sống.
          </Text>
        </View>

        {/* Services Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Dịch vụ đẳng cấp</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>Xem tất cả</Text>
            </TouchableOpacity>
          </View>
          {loading ? (
            <ActivityIndicator size="large" color={COLORS.primary} />
          ) : (
            <FlatList
              data={services}
              renderItem={renderServiceCard}
              keyExtractor={(item) => item.iddichVu}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.amenitiesList}
            />
          )}
        </View>

        {/* Gallery Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Thư viện ảnh</Text>
          {GALLERY_SECTIONS.map((section) => (
            <View key={section.id} style={styles.gallerySection}>
              <Text style={styles.gallerySectionTitle}>{section.title}</Text>
              <Text style={styles.gallerySectionDesc}>{section.description}</Text>
              {renderGallerySection(section)}
            </View>
          ))}
        </View>

        {/* Location Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Vị trí & Liên hệ</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="location" size={24} color={COLORS.primary} />
              <Text style={styles.infoText}>
                123 Đường ABC, Quận 1, TP. Hồ Chí Minh
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="call" size={24} color={COLORS.primary} />
              <Text style={styles.infoText}>+84 123 456 789</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="mail" size={24} color={COLORS.primary} />
              <Text style={styles.infoText}>contact@robinsvilla.com</Text>
            </View>
          </View>
        </View>

        {/* Testimonials Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Đánh giá từ khách hàng</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {TESTIMONIALS.map((item) => (
              <View key={item.id} style={styles.testimonialCard}>
                <View style={styles.testimonialHeader}>
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>
                      {item.name.charAt(0)}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.testimonialName}>{item.name}</Text>
                    <View style={{ flexDirection: "row" }}>
                      {[...Array(item.rating)].map((_, i) => (
                        <Ionicons
                          key={i}
                          name="star"
                          size={14}
                          color="#FFD700"
                        />
                      ))}
                    </View>
                  </View>
                </View>
                <Text style={styles.testimonialComment}>{item.comment}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>


    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  heroContainer: {
    height: 400,
    width: "100%",
    position: "relative",
  },
  heroImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "flex-end",
    padding: SIZES.padding * 1.5,
  },
  heroContent: {
    marginBottom: 20,
  },
  heroSubtitle: {
    ...FONTS.body3,
    color: COLORS.white,
    letterSpacing: 2,
    marginBottom: 8,
    opacity: 0.9,
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: "700",
    color: COLORS.white,
    marginBottom: 12,
    letterSpacing: 1,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  ratingText: {
    ...FONTS.body4,
    color: COLORS.white,
    marginLeft: 8,
    fontWeight: "600",
  },
  sectionContainer: {
    padding: SIZES.padding,
    marginTop: SIZES.padding,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    ...FONTS.h2,
    color: COLORS.secondary,
    marginBottom: 12,
  },
  seeAllText: {
    ...FONTS.body4,
    color: COLORS.primary,
    fontWeight: "600",
  },
  storyText: {
    ...FONTS.body3,
    color: COLORS.gray,
    lineHeight: 24,
  },
  amenitiesList: {
    paddingRight: SIZES.padding,
  },
  amenityCard: {
    width: 200,
    height: 250,
    marginRight: 16,
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
    backgroundColor: COLORS.white,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  amenityImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  amenityOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  amenityContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  amenityName: {
    ...FONTS.h3,
    color: COLORS.white,
    marginBottom: 4,
  },
  amenityDesc: {
    ...FONTS.body4,
    color: COLORS.white,
    opacity: 0.9,
  },
  gallerySection: {
    marginBottom: 24,
  },
  gallerySectionTitle: {
    ...FONTS.h3,
    color: COLORS.secondary,
    marginBottom: 4,
  },
  gallerySectionDesc: {
    ...FONTS.body4,
    color: COLORS.gray,
    marginBottom: 12,
  },
  // Hotel Layout
  hotelGrid: {
    gap: 10,
  },
  hotelMainImg: {
    width: "100%",
    height: 220,
    borderRadius: 12,
  },
  hotelSubGridScroll: {
    flexDirection: "row",
    gap: 10,
  },
  hotelSubImg: {
    width: 120, // Fixed width for scroll items
    height: 100,
    borderRadius: 8,
    marginRight: 10,
  },

  // Amenities Layout (Mosaic)
  amenityScroll: {
    marginHorizontal: -SIZES.padding,
    paddingHorizontal: SIZES.padding,
  },
  amenityMosaicChunk: {
    flexDirection: "row",
    gap: 10,
    marginRight: 16,
    height: 220, // Fixed height for the mosaic
  },
  amenityMosaicLarge: {
    width: 160,
    height: "100%",
    borderRadius: 12,
  },
  amenityMosaicColumn: {
    flexDirection: "column",
    gap: 10,
    justifyContent: "space-between",
    height: "100%",
  },
  amenityMosaicSmall: {
    width: 120,
    height: 105, // (220 - 10 gap) / 2
    borderRadius: 12,
  },

  // Dining Layout
  diningScroll: {
    marginHorizontal: -SIZES.padding, // Bleed to edges
    paddingHorizontal: SIZES.padding,
  },
  diningImg: {
    width: width * 0.7,
    height: 180,
    borderRadius: 12,
    marginRight: 16,
  },
  infoCard: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  infoText: {
    ...FONTS.body3,
    color: COLORS.gray,
    flex: 1,
  },
  testimonialCard: {
    width: 280,
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 12,
    marginRight: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  testimonialHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    ...FONTS.h3,
    color: COLORS.white,
  },
  testimonialName: {
    ...FONTS.h4,
    color: COLORS.secondary,
  },
  testimonialComment: {
    ...FONTS.body4,
    color: COLORS.gray,
    fontStyle: "italic",
  },

});

export default HotelIntroductionScreen;
