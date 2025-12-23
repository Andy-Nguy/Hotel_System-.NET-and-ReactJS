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
import { useNavigation, useRoute } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import authApi from "../api/authApi";
import { COLORS, SIZES, FONTS, SHADOWS } from "../constants/theme";
import { API_CONFIG } from "../config/apiConfig";

const EditProfileScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(false);
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
    }
  };

  const handleUpdateHoTen = async () => {
    if (!hoTen.trim()) {
      Alert.alert("Lỗi", "Họ tên không được để trống");
      return;
    }

    setLoading(true);
    try {
      const result = await authApi.updateProfile({ hoTen: hoTen.trim() });
      Alert.alert("Thành công", "Đã cập nhật họ tên");
      navigation.goBack();
    } catch (error: any) {
      Alert.alert("Lỗi", error.message || "Không thể cập nhật họ tên");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSoDienThoai = async () => {
    if (!soDienThoai.trim()) {
      Alert.alert("Lỗi", "Số điện thoại không được để trống");
      return;
    }

    setLoading(true);
    try {
      const result = await authApi.updateProfile({ soDienThoai: soDienThoai.trim() });
      Alert.alert("Thành công", "Đã cập nhật số điện thoại");
      navigation.goBack();
    } catch (error: any) {
      Alert.alert("Lỗi", error.message || "Không thể cập nhật số điện thoại");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEmail = async () => {
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
      const result = await authApi.updateProfile({ email: email.trim() });
      Alert.alert("Thành công", "Đã cập nhật email");
      navigation.goBack();
    } catch (error: any) {
      Alert.alert("Lỗi", error.message || "Không thể cập nhật email");
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert("Cần quyền truy cập", "Cần quyền truy cập thư viện ảnh để chọn avatar");
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
      const response = await fetch(`${API_CONFIG.CURRENT}/api/Auth/upload-avatar`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          // Don't set Content-Type - let fetch set it with boundary
        },
        body: formData,
      });

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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chỉnh sửa thông tin</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            onPress={pickImage}
            disabled={uploadingAvatar}
            style={styles.avatarContainer}
          >
            {uploadingAvatar ? (
              <ActivityIndicator size="large" color={COLORS.primary} />
            ) : (
              <>
                {getAvatarUrl() ? (
                  <Image source={{ uri: getAvatarUrl()! }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="person" size={40} color={COLORS.gray} />
                  </View>
                )}
                <View style={styles.avatarEditBadge}>
                  <Ionicons name="camera" size={20} color={COLORS.white} />
                </View>
              </>
            )}
          </TouchableOpacity>
          <Text style={styles.avatarHint}>Chạm để thay đổi avatar</Text>
        </View>

        {/* HoTen Section */}
        <View style={styles.section}>
          <Text style={styles.label}>Họ và tên</Text>
          <TextInput
            style={styles.input}
            value={hoTen}
            onChangeText={setHoTen}
            placeholder="Nhập họ tên"
            placeholderTextColor={COLORS.gray}
          />
          <TouchableOpacity
            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            onPress={handleUpdateHoTen}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.saveButtonText}>Lưu họ tên</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* SoDienThoai Section */}
        <View style={styles.section}>
          <Text style={styles.label}>Số điện thoại</Text>
          <TextInput
            style={styles.input}
            value={soDienThoai}
            onChangeText={setSoDienThoai}
            placeholder="Nhập số điện thoại"
            placeholderTextColor={COLORS.gray}
            keyboardType="phone-pad"
          />
          <TouchableOpacity
            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            onPress={handleUpdateSoDienThoai}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.saveButtonText}>Lưu số điện thoại</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Email Section */}
        <View style={styles.section}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Nhập email"
            placeholderTextColor={COLORS.gray}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            onPress={handleUpdateEmail}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.saveButtonText}>Lưu email</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SIZES.padding,
    paddingVertical: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    ...FONTS.h3,
    color: COLORS.secondary,
    fontWeight: "700",
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: SIZES.padding,
  },
  avatarSection: {
    alignItems: "center",
    paddingVertical: 32,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 12,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.lightGray,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.lightGray,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarEditBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: COLORS.white,
  },
  avatarHint: {
    ...FONTS.body3,
    color: COLORS.gray,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    ...FONTS.body2,
    color: COLORS.secondary,
    fontWeight: "600",
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...FONTS.body2,
    color: COLORS.secondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radius,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.medium,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    ...FONTS.body2,
    color: COLORS.white,
    fontWeight: "600",
  },
});

export default EditProfileScreen;

