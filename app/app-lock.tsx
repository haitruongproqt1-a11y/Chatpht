import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { clearAppLockPin, getAppLockPin, setAppLockPin } from "@/lib/app-lock";

export default function AppLockSettingsScreen() {
  const [existingPin, setExistingPin] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  useEffect(() => { void getAppLockPin().then((pin) => { setExistingPin(pin); setChecking(false); }); }, []);

  const save = async () => {
    if (existingPin && currentPin !== existingPin) return Alert.alert("Khóa hiện tại chưa đúng", "Vui lòng nhập lại khóa hiện tại.");
    if (!/^\d{4,8}$/.test(newPin)) return Alert.alert("Khóa chưa hợp lệ", "Dùng 4 đến 8 chữ số cho khóa ứng dụng.");
    if (newPin !== confirmPin) return Alert.alert("Khóa chưa khớp", "Hai lần nhập khóa cần giống nhau.");
    await setAppLockPin(newPin);
    setExistingPin(newPin);
    setCurrentPin(""); setNewPin(""); setConfirmPin("");
    Alert.alert("Đã lưu khóa ứng dụng", "Khóa sẽ được yêu cầu ở lần mở ứng dụng mới tiếp theo.");
  };
  const remove = async () => {
    if (currentPin !== existingPin) return Alert.alert("Khóa hiện tại chưa đúng", "Vui lòng nhập khóa hiện tại để gỡ.");
    await clearAppLockPin();
    setExistingPin(null); setCurrentPin("");
    Alert.alert("Đã gỡ khóa ứng dụng", "Ứng dụng sẽ không yêu cầu khóa ở lần mở mới.");
  };

  if (checking) return <ScreenContainer className="items-center justify-center"><ActivityIndicator color="#4F46E5" /></ScreenContainer>;
  const hasLock = Boolean(existingPin);
  return (
    <ScreenContainer className="px-5" edges={["top", "bottom", "left", "right"]}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()}><MaterialIcons name="arrow-back" size={23} color="#334155" /></TouchableOpacity>
      <View style={styles.hero}><View style={styles.icon}><MaterialIcons name="lock" size={28} color="#FFFFFF" /></View><Text style={styles.title}>{hasLock ? "Khóa ứng dụng" : "Đặt khóa ứng dụng"}</Text><Text style={styles.copy}>Khóa chỉ xuất hiện sau khi bạn đóng hẳn và mở lại app. Chạy nền, thu nhỏ, chat, gọi hoặc chia sẻ màn hình vẫn giữ nguyên phiên hiện tại.</Text></View>
      <View style={styles.card}>
        {hasLock ? <><Text style={styles.label}>Khóa hiện tại</Text><TextInput value={currentPin} onChangeText={(value) => setCurrentPin(value.replace(/\D/g, ""))} keyboardType="number-pad" secureTextEntry maxLength={8} style={styles.input} placeholder="Nhập khóa hiện tại" placeholderTextColor="#94A3B8" /></> : null}
        <Text style={styles.label}>{hasLock ? "Khóa mới" : "Khóa ứng dụng"}</Text><TextInput value={newPin} onChangeText={(value) => setNewPin(value.replace(/\D/g, ""))} keyboardType="number-pad" secureTextEntry maxLength={8} style={styles.input} placeholder="4 đến 8 chữ số" placeholderTextColor="#94A3B8" />
        <Text style={styles.label}>Nhập lại khóa</Text><TextInput value={confirmPin} onChangeText={(value) => setConfirmPin(value.replace(/\D/g, ""))} keyboardType="number-pad" secureTextEntry maxLength={8} style={styles.input} placeholder="Nhập lại khóa" placeholderTextColor="#94A3B8" />
        <TouchableOpacity style={styles.primary} onPress={save}><Text style={styles.primaryText}>{hasLock ? "Lưu khóa mới" : "Bật khóa ứng dụng"}</Text></TouchableOpacity>
        {hasLock ? <TouchableOpacity style={styles.remove} onPress={remove}><Text style={styles.removeText}>Gỡ khóa ứng dụng</Text></TouchableOpacity> : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  back: { alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 20, height: 40, justifyContent: "center", marginTop: 4, width: 40 },
  hero: { marginTop: 22 }, icon: { alignItems: "center", backgroundColor: "#4F46E5", borderRadius: 20, height: 58, justifyContent: "center", width: 58 }, title: { color: "#172033", fontSize: 29, fontWeight: "800", marginTop: 16 }, copy: { color: "#64748B", fontSize: 14, lineHeight: 21, marginTop: 8 },
  card: { backgroundColor: "#FFFFFF", borderColor: "#E2E8F0", borderRadius: 22, borderWidth: 1, marginTop: 24, padding: 16 }, label: { color: "#334155", fontSize: 13, fontWeight: "800", marginTop: 8 }, input: { borderColor: "#E2E8F0", borderRadius: 13, borderWidth: 1, color: "#172033", fontSize: 16, marginTop: 7, minHeight: 50, paddingHorizontal: 13 }, primary: { alignItems: "center", backgroundColor: "#4F46E5", borderRadius: 15, justifyContent: "center", marginTop: 20, minHeight: 52 }, primaryText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" }, remove: { alignItems: "center", justifyContent: "center", marginTop: 7, minHeight: 44 }, removeText: { color: "#DC2626", fontSize: 14, fontWeight: "800" },
});
