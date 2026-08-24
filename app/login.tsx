import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

export default function LoginScreen() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { completeSignIn } = useAuth();

  const finishAuthentication = async (result: { token: string; user: any }) => {
    await completeSignIn(result.token, result.user);
    router.replace("/(tabs)" as any);
  };
  const login = trpc.auth.login.useMutation();
  const register = trpc.auth.register.useMutation();
  const pending = submitting;
  const canSubmit = username.trim().length >= 3 && password.length >= 8 && !pending;

  const submit = async () => {
    if (!canSubmit) return;
    setFormError(null);
    setSubmitting(true);
    const payload = { username: username.trim(), password };
    try {
      const result = await Promise.race([
        mode === "login" ? login.mutateAsync(payload) : register.mutateAsync(payload),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Không nhận được phản hồi từ máy chủ. Hãy kiểm tra mạng rồi thử lại.")), 15_000)),
      ]);
      await finishAuthentication(result);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Không thể xác thực tài khoản.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer className="px-6" edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.brand}><MaterialIcons name="forum" size={39} color="#FFFFFF" /></View>
          <Text style={styles.title}>{mode === "login" ? "Chào mừng trở lại" : "Tạo tài khoản mới"}</Text>
          <Text style={styles.copy}>{mode === "login" ? "Đăng nhập để tiếp tục trò chuyện, gọi video và kết nối với bạn bè." : "Chỉ cần tên tài khoản và mật khẩu để bắt đầu dùng chatpht."}</Text>

          <View style={styles.switcher}>
            <TouchableOpacity accessibilityRole="tab" accessibilityState={{ selected: mode === "login" }} style={[styles.switchItem, mode === "login" && styles.switchActive]} onPress={() => { setMode("login"); setFormError(null); }}>
              <Text style={[styles.switchText, mode === "login" && styles.switchTextActive]}>Đăng nhập</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="tab" accessibilityState={{ selected: mode === "register" }} style={[styles.switchItem, mode === "register" && styles.switchActive]} onPress={() => { setMode("register"); setFormError(null); }}>
              <Text style={[styles.switchText, mode === "register" && styles.switchTextActive]}>Đăng ký</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <Text style={styles.fieldLabel}>Tên tài khoản</Text>
            <TextInput value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} autoComplete="username" placeholder="Ví dụ: minhnguyen" placeholderTextColor="#94A3B8" style={styles.input} maxLength={24} returnKeyType="next" editable={!pending} />
            <Text style={styles.fieldLabel}>Mật khẩu</Text>
            <TextInput value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="Từ 8 ký tự" placeholderTextColor="#94A3B8" style={styles.input} maxLength={128} returnKeyType="done" onSubmitEditing={submit} editable={!pending} />
            {formError ? <Text accessibilityRole="alert" style={styles.error}>{formError}</Text> : null}
            <TouchableOpacity disabled={!canSubmit} style={[styles.button, !canSubmit && styles.disabledButton]} onPress={submit} accessibilityRole="button">
              {pending ? <ActivityIndicator color="#FFFFFF" /> : <><Text style={styles.buttonText}>{mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}</Text><MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" /></>}
            </TouchableOpacity>
          </View>
          <Text style={styles.note}>Các chức năng nhắn tin, gọi và cài đặt chỉ hiển thị sau khi bạn xác thực thành công.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: "center", paddingVertical: 28 },
  brand: { width: 82, height: 82, borderRadius: 29, backgroundColor: "#4F46E5", justifyContent: "center", alignItems: "center", marginBottom: 24 },
  title: { fontSize: 31, lineHeight: 38, fontWeight: "800", letterSpacing: -0.7, color: "#172033" },
  copy: { marginTop: 14, fontSize: 16, lineHeight: 24, color: "#64748B" },
  switcher: { marginTop: 22, padding: 4, borderRadius: 15, backgroundColor: "#E2E8F0", flexDirection: "row" },
  switchItem: { flex: 1, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  switchActive: { backgroundColor: "#FFFFFF" },
  switchText: { color: "#64748B", fontWeight: "800", fontSize: 14 },
  switchTextActive: { color: "#3730A3" },
  form: { marginTop: 18 },
  fieldLabel: { color: "#334155", fontSize: 13, fontWeight: "800", marginBottom: 7, marginTop: 10 },
  input: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0", paddingHorizontal: 13, color: "#172033", fontSize: 16, backgroundColor: "#FFFFFF" },
  error: { color: "#B91C1C", backgroundColor: "#FEF2F2", borderRadius: 10, fontSize: 13, fontWeight: "700", lineHeight: 18, marginTop: 12, paddingHorizontal: 11, paddingVertical: 9 },
  button: { marginTop: 22, minHeight: 54, borderRadius: 17, backgroundColor: "#4F46E5", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 9 },
  disabledButton: { backgroundColor: "#A5B4FC" },
  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  note: { marginTop: 18, fontSize: 12, color: "#94A3B8", lineHeight: 18, textAlign: "center" },
});
