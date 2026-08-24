import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useMemo, useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

export default function InboxScreen() {
  const { isAuthenticated, loading, user } = useAuth();
  const roomsQuery = trpc.chat.rooms.useQuery(undefined, { enabled: isAuthenticated });
  const [query, setQuery] = useState("");
  const rooms = useMemo(
    () => (roomsQuery.data ?? []).filter((room) => room.kind === "direct" && room.name.toLowerCase().includes(query.toLowerCase())),
    [roomsQuery.data, query],
  );

  if (loading) return <ScreenContainer className="items-center justify-center"><ActivityIndicator color="#4F46E5" /></ScreenContainer>;
  if (!isAuthenticated) return <WelcomeCard />;

  return (
    <ScreenContainer containerClassName="bg-background">
      <View style={styles.header}>
        <View style={styles.topRow}><Text style={styles.title}>Tin nhắn</Text><View style={styles.headerActions}><TouchableOpacity style={styles.headerAction} onPress={() => router.push("/friends" as any)}><MaterialIcons name="person-add-alt-1" size={21} color="#FFFFFF" /></TouchableOpacity><View style={styles.avatar}><Text style={styles.avatarText}>{user?.name?.slice(0, 1).toUpperCase() ?? "U"}</Text></View></View></View>
        <View style={styles.search}>
          <MaterialIcons name="search" size={20} color="#6B7A90" />
          <TextInput value={query} onChangeText={setQuery} placeholder="Tìm kiếm cuộc trò chuyện" placeholderTextColor="#8391A5" style={styles.searchInput} returnKeyType="done" />
          {query ? <TouchableOpacity onPress={() => setQuery("")}><MaterialIcons name="close" size={19} color="#8391A5" /></TouchableOpacity> : null}
        </View>
      </View>
      <FlatList
        data={rooms}
        keyExtractor={(room) => String(room.id)}
        contentContainerStyle={rooms.length ? styles.list : styles.emptyList}
        refreshing={roomsQuery.isRefetching}
        onRefresh={() => roomsQuery.refetch()}
        ListEmptyComponent={<EmptyInbox loading={roomsQuery.isLoading} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.roomRow} activeOpacity={0.72} onPress={() => router.push(`/chat/${item.id}` as any)}>
            <View style={styles.roomAvatar}><Text style={styles.roomInitial}>{item.name.slice(0, 1).toUpperCase()}</Text></View>
            <View style={styles.roomInfo}>
              <View style={styles.roomTop}><Text style={styles.roomName} numberOfLines={1}>{item.name}</Text><Text style={styles.time}>{formatTime(item.lastMessageAt)}</Text></View>
              <Text style={styles.roomPreview} numberOfLines={1}>Chạm để tiếp tục trò chuyện</Text>
            </View>
            <View style={styles.unreadDot} />
          </TouchableOpacity>
        )}
      />
      <TouchableOpacity style={styles.fab} onPress={() => router.push("/room/new" as any)}><MaterialIcons name="edit" size={23} color="#FFFFFF" /></TouchableOpacity>
    </ScreenContainer>
  );
}

function WelcomeCard() {
  return (
    <ScreenContainer className="justify-center px-6">
      <View style={styles.welcomeMark}><MaterialIcons name="forum" size={38} color="#FFFFFF" /></View>
      <Text style={styles.welcomeTitle}>Trao đổi rõ ràng. Kết nối an tâm.</Text>
      <Text style={styles.welcomeCopy}>chatpht gom chat nhóm, tệp đính kèm và cuộc gọi video vào một không gian riêng tư.</Text>
      <TouchableOpacity style={styles.primaryButton} onPress={() => router.push("/login" as any)}><Text style={styles.primaryButtonText}>Đăng nhập để tiếp tục</Text><MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" /></TouchableOpacity>
    </ScreenContainer>
  );
}

function EmptyInbox({ loading }: { loading: boolean }) {
  if (loading) return <View style={styles.empty}><ActivityIndicator color="#4F46E5" /></View>;
  return <View style={styles.empty}><View style={styles.emptyIcon}><MaterialIcons name="mark-unread-chat-alt" size={31} color="#4F46E5" /></View><Text style={styles.emptyTitle}>Chưa có cuộc trò chuyện</Text><Text style={styles.emptyCopy}>Tạo cuộc trò chuyện riêng 1:1 để bắt đầu trao đổi.</Text></View>;
}

function formatTime(value: Date | string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }); }

const styles = StyleSheet.create({
  header: { paddingTop: 8, paddingHorizontal: 16, paddingBottom: 14, backgroundColor: "#0B74E5" }, topRow: { minHeight: 48, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, title: { color: "#FFFFFF", fontSize: 24, lineHeight: 30, fontWeight: "800", letterSpacing: -0.4 }, headerActions: { flexDirection: "row", alignItems: "center", gap: 10 }, headerAction: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.16)" }, avatar: { width: 36, height: 36, backgroundColor: "#DDEEFF", borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.7)" }, avatarText: { color: "#0B5DB5", fontWeight: "800", fontSize: 15 },
  search: { minHeight: 42, borderRadius: 11, backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 8, marginTop: 7 }, searchInput: { flex: 1, fontSize: 15, color: "#172033", paddingVertical: 8 },
  list: { paddingTop: 3, paddingBottom: 104, backgroundColor: "#FFFFFF" }, emptyList: { flexGrow: 1, backgroundColor: "#FFFFFF" }, roomRow: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#EDF1F6" }, roomAvatar: { width: 52, height: 52, borderRadius: 18, backgroundColor: "#E5F0FF", alignItems: "center", justifyContent: "center" }, roomInitial: { color: "#0B74E5", fontWeight: "800", fontSize: 18 }, roomInfo: { flex: 1, minWidth: 0 }, roomTop: { flexDirection: "row", justifyContent: "space-between", gap: 8, alignItems: "center" }, roomName: { flex: 1, color: "#172033", fontWeight: "700", fontSize: 16 }, time: { color: "#7C8CA0", fontSize: 12 }, roomPreview: { color: "#718096", fontSize: 13, marginTop: 4 }, unreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#0B74E5", opacity: 0 },
  fab: { position: "absolute", right: 20, bottom: 18, width: 54, height: 54, borderRadius: 27, backgroundColor: "#0B74E5", alignItems: "center", justifyContent: "center", shadowColor: "#0759AC", shadowOpacity: 0.24, shadowOffset: { width: 0, height: 5 }, shadowRadius: 10, elevation: 6 },
  welcomeMark: { width: 78, height: 78, borderRadius: 27, backgroundColor: "#4F46E5", justifyContent: "center", alignItems: "center", marginBottom: 24 }, welcomeTitle: { color: "#172033", fontSize: 32, lineHeight: 39, fontWeight: "800", letterSpacing: -0.8 }, welcomeCopy: { color: "#64748B", fontSize: 16, lineHeight: 24, marginTop: 14, marginBottom: 30 }, primaryButton: { minHeight: 54, borderRadius: 17, backgroundColor: "#4F46E5", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10 }, primaryButtonText: { color: "#FFFFFF", fontWeight: "800", fontSize: 16 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 38, paddingBottom: 90 }, emptyIcon: { width: 68, height: 68, borderRadius: 24, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center", marginBottom: 16 }, emptyTitle: { color: "#172033", fontSize: 18, fontWeight: "800" }, emptyCopy: { color: "#64748B", textAlign: "center", lineHeight: 20, marginTop: 7 },
});
