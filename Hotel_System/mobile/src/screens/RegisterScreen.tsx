import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Image,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../App";
import authApi from "../api/authApi";
import { useAuth } from "../context/AuthContext";
import { COLORS, SIZES, FONTS, SHADOWS } from "../constants/theme";

type Props = NativeStackScreenProps<RootStackParamList, "Register">;

const RegisterScreen: React.FC<Props> = ({ navigation }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otp, setOtp] = useState("");
  const [pendingId, setPendingId] = useState<number | null>(null);
  const { login } = useAuth();

  const submit = async () => {
    if (!name || !email || !password) {
      Alert.alert("Lỗi", "Vui lòng nhập đầy đủ thông tin bắt buộc");
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.register({
        Hoten: name,
        Email: email,
        Password: password,
        Sodienthoai: phone || undefined,
      });

      if (res?.pendingId) {
        setPendingId(res.pendingId);
        setShowOtpModal(true);
        Alert.alert(
          "Thành công",
          res?.message || "Vui lòng kiểm tra email để lấy mã OTP"
        );
      } else {
        Alert.alert("Thông báo", res?.message || "Đăng ký thành công", [
          {
            text: "OK",
            onPress: () => navigation.navigate("Login"),
          },
        ]);
      }
    } catch (e: any) {
      Alert.alert("Lỗi", e?.message || "Không thể đăng ký");
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async () => {
    if (!otp || !pendingId) {
      Alert.alert("Lỗi", "Vui lòng nhập mã OTP");
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.verifyOtp({
        PendingId: pendingId,
        Otp: otp,
      });

      const token = res?.token;
      if (token) {
        await login(token);
        setShowOtpModal(false);
        Alert.alert("Thành công", "Xác thực thành công!", [
          {
            text: "OK",
            onPress: () => navigation.replace("MainApp"),
          },
        ]);
      } else {
        Alert.alert("Lỗi", "Không nhận được token từ server");
      }
    } catch (e: any) {
      Alert.alert("Lỗi", e?.message || "Mã OTP không hợp lệ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.formContainer}>
          <View style={styles.logoContainer}>
            <Image
              source={require("../assets/robins-villa-logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <View style={styles.header}>
            <Text style={styles.subtitle}>Tạo tài khoản mới</Text>
            <Text style={styles.title}>Đăng ký</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Họ tên <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Nhập họ tên của bạn"
                placeholderTextColor={COLORS.gray}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Email <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Địa chỉ email của bạn"
                placeholderTextColor={COLORS.gray}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Số điện thoại</Text>
              <TextInput
                style={styles.input}
                placeholder="Số điện thoại (tùy chọn)"
                placeholderTextColor={COLORS.gray}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Mật khẩu <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Mật khẩu"
                placeholderTextColor={COLORS.gray}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.disabledBtn]}
              onPress={submit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.submitBtnText}>Đăng ký</Text>
              )}
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Đã có tài khoản? </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate("Login")}
                disabled={loading}
              >
                <Text style={styles.linkText}>Đăng nhập</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* OTP Modal */}
      <Modal visible={showOtpModal} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Xác thực OTP</Text>
            <Text style={styles.modalText}>
              Vui lòng nhập mã OTP đã được gửi đến email của bạn
            </Text>

            <TextInput
              style={styles.otpInput}
              placeholder="Nhập mã OTP"
              placeholderTextColor={COLORS.gray}
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              maxLength={6}
              editable={!loading}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => {
                  setShowOtpModal(false);
                  setOtp("");
                }}
                disabled={loading}
              >
                <Text style={styles.cancelBtnText}>Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  styles.verifyBtn,
                  loading && styles.disabledBtn,
                ]}
                onPress={verifyOTP}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.white} size="small" />
                ) : (
                  <Text style={styles.verifyBtnText}>Xác thực</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    padding: SIZES.padding * 2,
  },
  formContainer: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radiusLarge,
    padding: SIZES.padding * 2,
    ...SHADOWS.medium,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: SIZES.margin * 2,
  },
  logo: {
    width: 100,
    height: 100,
  },
  header: {
    marginBottom: SIZES.margin * 2,
    alignItems: "center",
  },
  subtitle: {
    ...FONTS.body4,
    color: COLORS.primary,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 8,
  },
  title: {
    ...FONTS.h2,
    color: COLORS.secondary,
    textAlign: "center",
  },
  form: {
    width: "100%",
  },
  inputGroup: {
    marginBottom: SIZES.margin * 1.5,
  },
  label: {
    ...FONTS.body3,
    color: COLORS.secondary,
    fontWeight: "600",
    marginBottom: 8,
  },
  required: {
    color: COLORS.error,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.padding,
    paddingVertical: 14,
    ...FONTS.body3,
    color: COLORS.secondary,
    backgroundColor: COLORS.background,
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: SIZES.radius,
    alignItems: "center",
    marginTop: SIZES.margin,
    ...SHADOWS.light,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: COLORS.white,
    ...FONTS.body3,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: SIZES.margin * 2,
  },
  footerText: {
    ...FONTS.body3,
    color: COLORS.gray,
  },
  linkText: {
    ...FONTS.body3,
    color: COLORS.primary,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: "center",
    alignItems: "center",
    padding: SIZES.padding * 2,
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radiusLarge,
    padding: SIZES.padding * 2,
    width: "100%",
    maxWidth: 400,
    ...SHADOWS.dark,
  },
  modalTitle: {
    ...FONTS.h3,
    color: COLORS.secondary,
    marginBottom: SIZES.margin,
    textAlign: "center",
  },
  modalText: {
    ...FONTS.body3,
    color: COLORS.gray,
    marginBottom: SIZES.margin * 1.5,
    textAlign: "center",
    lineHeight: 22,
  },
  otpInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.padding,
    paddingVertical: 14,
    ...FONTS.h4,
    color: COLORS.secondary,
    backgroundColor: COLORS.background,
    textAlign: "center",
    letterSpacing: 8,
    marginBottom: SIZES.margin * 1.5,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: SIZES.margin,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: SIZES.radius,
    alignItems: "center",
  },
  cancelBtn: {
    backgroundColor: COLORS.lightGray,
  },
  cancelBtnText: {
    color: COLORS.secondary,
    ...FONTS.body3,
    fontWeight: "700",
  },
  verifyBtn: {
    backgroundColor: COLORS.primary,
  },
  verifyBtnText: {
    color: COLORS.white,
    ...FONTS.body3,
    fontWeight: "700",
  },
});

export default RegisterScreen;
