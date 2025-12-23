import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import authApi from "../api/authApi";
import { COLORS, SIZES, FONTS, SHADOWS } from "../constants/theme";
import { API_CONFIG } from "../config/apiConfig";
import HeaderScreen from "../components/HeaderScreen";
import AppIcon from "../components/AppIcon";

const EditProfileScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [hoTen, setHoTen] = useState("");
  const [soDienThoai, setSoDienThoai] = useState("");
  const [email, setEmail] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await authApi.getProfile();
      setProfile(data);
      setHoTen(data?.hoTen || data?.HoTen || "");
      setSoDienThoai(data?.soDienThoai || data?.SoDienThoai || "");
      setEmail(data?.email || data?.Email || "");
      setAvatar(data?.avatar || data?.Avatar || null);
    } catch (e) {
      console.log("Load profile error:", e);
      Alert.alert("Lỗi", "Không thể tải thông tin cá nhân");
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSaveAll = async () => {
    if (!hoTen.trim()) {
      Alert.alert("Lỗi", "Họ tên không được để trống");
      return;
    }
    if (!soDienThoai.trim()) {
      Alert.alert("Lỗi", "Số điện thoại không được để trống");
      return;
    }
    if (!email.trim()) {
      Alert.alert("Lỗi", "Email không được để trống");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert("Lỗi", "Email không hợp lệ");
      return;
    }

    setLoading(true);
    try {
      await authApi.updateProfile({
        hoTen: hoTen.trim(),
        soDienThoai: soDienThoai.trim(),
        email: email.trim(),
      });
      Alert.alert("Thành công", "Đã cập nhật thông tin cá nhân");
      navigation.goBack();
    } catch (error: any) {
      Alert.alert("Lỗi", error.message || "Không thể cập nhật thông tin");
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert(
        "Cần quyền truy cập",
        "Cần quyền truy cập thư viện ảnh để chọn avatar"
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadAvatar(result.assets[0].uri);
    }
  };

  const uploadAvatar = async (imageUri: string) => {
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      const filename = imageUri.split("/").pop() || "avatar.jpg";
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : "image/jpeg";

      formData.append("file", {
        uri: imageUri,
        name: filename,
        type,
      } as any);

      const token = await authApi.getToken();
      const response = await fetch(
        `${API_CONFIG.CURRENT}/api/Auth/upload-avatar`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            // Don't set Content-Type - let fetch set it with boundary
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Không thể upload avatar");
      }

      const result = await response.json();
      setAvatar(result.avatar);
      Alert.alert("Thành công", "Đã cập nhật avatar");
      navigation.goBack();
    } catch (error: any) {
      Alert.alert("Lỗi", error.message || "Không thể upload avatar");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const getAvatarUrl = () => {
    if (!avatar) return null;
    if (avatar.startsWith("http")) return avatar;
    return `${API_CONFIG.CURRENT}${avatar}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <HeaderScreen
        title="Chỉnh sửa hồ sơ"
        onClose={() => navigation.goBack()}
        leftIcon={
          <AppIcon
            name="arrow-back"
            size={24}
            color={COLORS.secondary}
            library="Ionicons"
          />
        }
      />

      {initialLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Đang tải thông tin...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <TouchableOpacity
              onPress={pickImage}
              disabled={uploadingAvatar}
              style={styles.avatarContainer}
            >
              {uploadingAvatar ? (
                <View style={styles.avatarLoading}>
                  <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
              ) : (
                <>
                  {getAvatarUrl() ? (
                    <Image
                      source={{ uri: getAvatarUrl()! }}
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <AppIcon
                        name="person"
                        size={48}
                        color={COLORS.gray}
                        library="Ionicons"
                      />
                    </View>
                  )}
                  <View style={styles.avatarEditBadge}>
                    <AppIcon
                      name="camera"
                      size={20}
                      color={COLORS.white}
                      library="Ionicons"
                    />
                  </View>
                </>
              )}
            </TouchableOpacity>
            <Text style={styles.avatarHint}>Chạm để thay đổi ảnh đại diện</Text>
          </View>

          {/* Form Section */}
          <View style={styles.formSection}>
            <View style={styles.formCard}>
              <Text style={styles.sectionTitle}>Thông tin cá nhân</Text>

              {/* HoTen Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Họ và tên</Text>
                <View style={styles.inputContainer}>
                  <AppIcon
                    name="person"
                    size={20}
                    color={COLORS.primary}
                    library="Ionicons"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    value={hoTen}
                    onChangeText={setHoTen}
                    placeholder="Nhập họ và tên đầy đủ"
                    placeholderTextColor={COLORS.gray}
                  />
                </View>
              </View>

              {/* SoDienThoai Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Số điện thoại</Text>
                <View style={styles.inputContainer}>
                  <AppIcon
                    name="call"
                    size={20}
                    color={COLORS.primary}
                    library="Ionicons"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    value={soDienThoai}
                    onChangeText={setSoDienThoai}
                    placeholder="Nhập số điện thoại"
                    placeholderTextColor={COLORS.gray}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              {/* Email Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email</Text>
                <View style={styles.inputContainer}>
                  <AppIcon
                    name="mail"
                    size={20}
                    color={COLORS.primary}
                    library="Ionicons"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Nhập địa chỉ email"
                    placeholderTextColor={COLORS.gray}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={[styles.saveButton, loading && styles.saveButtonDisabled]}
              onPress={handleSaveAll}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <AppIcon
                    name="save"
                    size={20}
                    color={COLORS.white}
                    library="Ionicons"
                  />
                  <Text style={styles.saveButtonText}>Lưu thay đổi</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    ...FONTS.body2,
    color: COLORS.gray,
    marginTop: 16,
  },
  scrollContent: {
    flex: 1,
  },
  avatarSection: {
    alignItems: "center",
    paddingVertical: 40,
    backgroundColor: COLORS.white,
    marginHorizontal: SIZES.padding,
    marginTop: SIZES.padding,
    borderRadius: 20,
    ...SHADOWS.light,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 16,
  },
  avatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: COLORS.lightGray,
    borderWidth: 4,
    borderColor: COLORS.primary,
  },
  avatarPlaceholder: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "#F1F3F5",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: COLORS.primary,
  },
  avatarLoading: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "#F1F3F5",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: COLORS.primary,
  },
  avatarEditBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: COLORS.white,
    ...SHADOWS.medium,
  },
  avatarHint: {
    ...FONTS.body3,
    color: COLORS.gray,
    textAlign: "center",
  },
  formSection: {
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.padding,
  },
  formCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 24,
    ...SHADOWS.light,
    marginBottom: 24,
  },
  sectionTitle: {
    ...FONTS.h3,
    color: COLORS.secondary,
    fontWeight: "700",
    marginBottom: 24,
    textAlign: "center",
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    ...FONTS.body2,
    color: COLORS.secondary,
    fontWeight: "600",
    marginBottom: 8,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E9ECEF",
    paddingHorizontal: 16,
    paddingVertical: 4,
    overflow: "hidden",
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    ...FONTS.body2,
    color: COLORS.secondary,
    paddingVertical: 12,
    paddingRight: 8,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: SIZES.padding,
    ...SHADOWS.medium,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonDisabled: {
    opacity: 0.7,
    shadowOpacity: 0.1,
  },
  saveButtonText: {
    ...FONTS.body2,
    color: COLORS.white,
    fontWeight: "700",
  },
});

export default EditProfileScreen;
