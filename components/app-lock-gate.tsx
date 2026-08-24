import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { setAppLockPin, getAppLockPin } from "@/lib/app-lock";
import { trpc } from "@/lib/trpc";

export function AppLockGate({ children }: { children: ReactNode }) {
  const { loading, isAuthenticated, user } = useAuth();
  const initialSessionRef = useRef(true);
  const [checking, setChecking] = useState(true);
  const [expectedPin, setExpectedPin] = useState<string | null>(null);
  const [enteredPin, setEnteredPin] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);

  const verifyAccount = trpc.auth.login.useMutation({
    onSuccess: async () => {
      try {
        await setAppLockPin(newPin);
        setExpectedPin(null);
        setEnteredPin("");
        setForgotOpen(false);
        setPassword("");
        setNewPin("");
        setConfirmPin("");
        setResetError(null);
      } catch (cause) {
        setResetError(cause instanceof Error ? cause.message : "Không thể đặt lại mã PIN.");
      }
    },
    onError: () => setResetError("Mật khẩu tài khoản chưa đúng. Vui lòng thử lại."),
  });

  useEffect(() => {
    if (loading) return;
    let active = true;
    const prepare = async () => {
      try {
        if (initialSessionRef.current) {
          initialSessionRef.current = false;
          if (isAuthenticated) {
            const pin = await getAppLockPin();
            if (!active) return;
            setExpectedPin(pin);
          }
        }
        if (!isAuthenticated) setExpectedPin(null);
      } catch (cause) {
        // Không giữ app ở splash/loading nếu Android SecureStore tạm thời không đọc được.
        console.warn("[AppLock] Không thể đọc khóa ứng dụng khi khởi động.", cause);
        if (active) setExpectedPin(null);
      } finally {
        if (active) setChecking(false);
      }
    };
    void prepare();
    return () => { active = false; };
  }, [loading, isAuthenticated]);

  const unlock = () => {
    if (enteredPin === expectedPin) {
      setExpectedPin(null);
      setEnteredPin("");
      setMessage(null);
      return;
    }
    setEnteredPin("");
    setMessage("Khóa ứng dụng chưa đúng. Vui lòng thử lại.");
  };

  const resetPin = () => {
    if (!user?.name) return setResetError("Không xác định được tài khoản để xác minh.");
    if (newPin.length < 4 || newPin.length > 8) return setResetError("Mã PIN mới cần gồm 4 đến 8 chữ số.");
    if (newPin !== confirmPin) return setResetError("Hai lần nhập mã PIN mới chưa khớp.");
    setResetError(null);
    verifyAccount.mutate({ username: user.name, password });
  };

  const closeForgotPin = () => {
    if (verifyAccount.isPending) return;
    setForgotOpen(false);
    setPassword("");
    setNewPin("");
    setConfirmPin("");
    setResetError(null);
  };

  if (checking) return <View style={styles.loading}><ActivityIndicator color="#4F46E5" /></View>;
  if (!expectedPin) return <>{children}</>;

  if (forgotOpen) {
    return (
      <View style={styles.locked}>
        <View style={styles.icon}><MaterialIcons name="vpn-key" size={32} color="#FFFFFF" /></View>
        <Text style={styles.title}>Đặt lại mã PIN</Text>
        <Text style={styles.copy}>Xác minh mật khẩu của tài khoản @{user?.name ?? "chatpht"} trước khi đặt mã PIN mới.</Text>
        <Text style={styles.label}>Mật khẩu tài khoản</Text>
        <TextInput value={password} onChangeText={(value) => { setPassword(value); setResetError(null); }} secureTextEntry autoComplete="current-password" style={styles.resetInput} placeholder="Nhập mật khẩu" placeholderTextColor="#94A3B8" editable={!verifyAccount.isPending} />
        <Text style={styles.label}>Mã PIN mới</Text>
        <TextInput value={newPin} onChangeText={(value) => { setNewPin(value.replace(/\D/g, "")); setResetError(null); }} secureTextEntry keyboardType="number-pad" maxLength={8} style={styles.resetInput} placeholder="4 đến 8 chữ số" placeholderTextColor="#94A3B8" editable={!verifyAccount.isPending} />
        <Text style={styles.label}>Nhập lại mã PIN mới</Text>
        <TextInput value={confirmPin} onChangeText={(value) => { setConfirmPin(value.replace(/\D/g, "")); setResetError(null); }} secureTextEntry keyboardType="number-pad" maxLength={8} style={styles.resetInput} placeholder="Nhập lại mã PIN" placeholderTextColor="#94A3B8" onSubmitEditing={resetPin} editable={!verifyAccount.isPending} />
        {resetError ? <Text accessibilityRole="alert" style={styles.error}>{resetError}</Text> : null}
        <TouchableOpacity onPress={resetPin} disabled={!password || newPin.length < 4 || confirmPin.length < 4 || verifyAccount.isPending} style={[styles.button, (!password || newPin.length < 4 || confirmPin.length < 4 || verifyAccount.isPending) && styles.disabled]}>{verifyAccount.isPending ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Xác minh và đặt lại</Text>}</TouchableOpacity>
        <TouchableOpacity onPress={closeForgotPin} disabled={verifyAccount.isPending} style={styles.secondaryButton}><Text style={styles.secondaryText}>Quay lại nhập mã PIN</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.locked}>
      <View style={styles.icon}><MaterialIcons name="lock" size={32} color="#FFFFFF" /></View>
      <Text style={styles.title}>Ứng dụng đã khóa</Text>
      <Text style={styles.copy}>Nhập khóa ứng dụng để tiếp tục vào chatpht.</Text>
      <TextInput value={enteredPin} onChangeText={(value) => { setEnteredPin(value.replace(/\D/g, "")); setMessage(null); }} secureTextEntry keyboardType="number-pad" maxLength={8} autoFocus style={styles.input} placeholder="Nhập khóa" placeholderTextColor="#94A3B8" onSubmitEditing={unlock} />
      {message ? <Text style={styles.error}>{message}</Text> : null}
      <TouchableOpacity onPress={unlock} disabled={enteredPin.length < 4} style={[styles.button, enteredPin.length < 4 && styles.disabled]}><Text style={styles.buttonText}>Mở khóa</Text></TouchableOpacity>
      <TouchableOpacity onPress={() => { setForgotOpen(true); setMessage(null); }} style={styles.forgotButton}><Text style={styles.forgotText}>Quên mã PIN?</Text></TouchableOpacity>
      <Text style={styles.note}>Khóa chỉ được hỏi khi bạn đóng hẳn rồi mở lại ứng dụng. Thu nhỏ, chạy nền, chat, gọi và chia sẻ màn hình không làm khóa phiên hiện tại.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: "#F7F8FC", alignItems: "center", justifyContent: "center" },
  locked: { flex: 1, backgroundColor: "#F7F8FC", paddingHorizontal: 28, alignItems: "stretch", justifyContent: "center" },
  icon: { alignSelf: "center", width: 76, height: 76, borderRadius: 27, backgroundColor: "#4F46E5", alignItems: "center", justifyContent: "center", marginBottom: 23 },
  title: { color: "#172033", fontSize: 29, fontWeight: "800", textAlign: "center" },
  copy: { color: "#64748B", fontSize: 16, lineHeight: 24, marginTop: 10, textAlign: "center" },
  label: { color: "#334155", fontSize: 13, fontWeight: "800", marginTop: 14 },
  input: { marginTop: 27, backgroundColor: "#FFFFFF", borderColor: "#E2E8F0", borderRadius: 16, borderWidth: 1, color: "#172033", fontSize: 22, fontWeight: "800", letterSpacing: 7, minHeight: 58, paddingHorizontal: 18, textAlign: "center" },
  resetInput: { backgroundColor: "#FFFFFF", borderColor: "#E2E8F0", borderRadius: 14, borderWidth: 1, color: "#172033", fontSize: 16, marginTop: 7, minHeight: 51, paddingHorizontal: 14 },
  error: { color: "#B91C1C", fontSize: 13, fontWeight: "700", marginTop: 10, textAlign: "center" },
  button: { alignItems: "center", backgroundColor: "#4F46E5", borderRadius: 16, justifyContent: "center", marginTop: 17, minHeight: 54 },
  disabled: { backgroundColor: "#A5B4FC" },
  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  forgotButton: { alignItems: "center", justifyContent: "center", marginTop: 8, minHeight: 40 },
  forgotText: { color: "#4F46E5", fontSize: 14, fontWeight: "800" },
  secondaryButton: { alignItems: "center", justifyContent: "center", marginTop: 5, minHeight: 40 },
  secondaryText: { color: "#64748B", fontSize: 14, fontWeight: "800" },
  note: { color: "#94A3B8", fontSize: 12, lineHeight: 18, marginTop: 18, textAlign: "center" },
});
