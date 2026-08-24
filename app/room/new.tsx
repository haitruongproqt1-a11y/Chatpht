import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";

export default function NewRoomScreen() {
  const [memberId, setMemberId] = useState("");
  const createDirect = trpc.chat.createDirect.useMutation({
    onSuccess: (room) => router.replace(`/chat/${room.id}` as any),
    onError: (error) => Alert.alert("Chưa tạo được cuộc trò chuyện", error.message),
  });
  const start = () => createDirect.mutate({ userId: Number(memberId) });
  return <ScreenContainer className="px-5"><View style={styles.header}><TouchableOpacity style={styles.back} onPress={() => router.back()}><MaterialIcons name="arrow-back" size={23} color="#172033" /></TouchableOpacity><Text style={styles.headerTitle}>Bắt đầu trò chuyện</Text><View style={styles.back} /></View><View style={styles.card}><View style={styles.icon}><MaterialIcons name="person" size={30} color="#0B74E5" /></View><Text style={styles.title}>Trò chuyện riêng tư 1:1</Text><Text style={styles.copy}>Nhập mã thành viên của người bạn muốn nhắn tin, gọi thoại, gọi video hoặc chia sẻ màn hình.</Text><Text style={styles.label}>Mã thành viên</Text><TextInput value={memberId} onChangeText={setMemberId} placeholder="Ví dụ: 42" placeholderTextColor="#94A3B8" style={styles.input} keyboardType="number-pad" returnKeyType="done" onSubmitEditing={start} /><TouchableOpacity disabled={!Number(memberId) || createDirect.isPending} style={[styles.create, (!Number(memberId) || createDirect.isPending) && styles.createDisabled]} onPress={start}><Text style={styles.createText}>{createDirect.isPending ? "Đang mở..." : "Bắt đầu trò chuyện"}</Text></TouchableOpacity></View></ScreenContainer>;
}

const styles = StyleSheet.create({ header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12 }, back: { width: 44, height: 44, borderRadius: 15, justifyContent: "center", alignItems: "center", backgroundColor: "#FFFFFF" }, headerTitle: { fontSize: 17, fontWeight: "800", color: "#172033" }, card: { marginTop: 38, backgroundColor: "#FFFFFF", borderRadius: 25, padding: 24, borderWidth: 1, borderColor: "#E2E8F0" }, icon: { width: 66, height: 66, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: "#E5F0FF" }, title: { marginTop: 18, fontSize: 24, fontWeight: "800", color: "#172033" }, copy: { marginTop: 8, color: "#64748B", lineHeight: 21, fontSize: 14 }, label: { marginTop: 24, marginBottom: 8, color: "#334155", fontWeight: "800", fontSize: 14 }, input: { backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#DCE6F2", borderRadius: 15, minHeight: 54, paddingHorizontal: 14, fontSize: 16, color: "#172033" }, create: { minHeight: 54, backgroundColor: "#0B74E5", borderRadius: 17, alignItems: "center", justifyContent: "center", marginTop: 18 }, createDisabled: { backgroundColor: "#A5C7EB" }, createText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" } });
