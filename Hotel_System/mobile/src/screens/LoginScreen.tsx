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
  Image,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../App";
import authApi from "../api/authApi";
import { useAuth } from "../context/AuthContext";
import { COLORS, SIZES, FONTS, SHADOWS } from "../constants/theme";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const submit = async () => {
    if (!email || !password) {
      Alert.alert("Lỗi", "Vui lòng nhập đầy đủ thông tin");
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.login({ Email: email, Password: password });
      const token = res?.token;
      if (token) {
        await login(token);
        Alert.alert("Thành công", "Đăng nhập thành công!", [
          {
            text: "OK",
            onPress: () => navigation.replace("Home"),
          },
        ]);
      } else {
        Alert.alert("Lỗi", "Không nhận được token từ server");
      }
    } catch (e: any) {
      Alert.alert("Lỗi", e?.message || "Không thể đăng nhập");
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
        keyboardShouldPersistTaps="always"
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
            <Text style={styles.subtitle}>Chào mừng trở lại</Text>
            <Text style={styles.title}>Đăng nhập tài khoản</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
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
              <Text style={styles.label}>Mật khẩu</Text>
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
                <Text style={styles.submitBtnText}>Đăng nhập</Text>
              )}
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Chưa có tài khoản? </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate("Register")}
                disabled={loading}
              >
                <Text style={styles.linkText}>Đăng ký ngay</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
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
});

export default LoginScreen;
