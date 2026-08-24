import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Notifications from "expo-notifications";
import { router, usePathname } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Image, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { io } from "socket.io-client";
import { getApiBaseUrl } from "@/constants/oauth";
import { useAuth } from "@/hooks/use-auth";
import { getSessionToken } from "@/lib/_core/auth";
import { trpc } from "@/lib/trpc";
import { useCallOverlay } from "@/components/call-overlay";
import { initializeLocalNotifications, showCallNotification, showMessageNotification } from "@/lib/local-notifications";
import { supportsNativeNotifications } from "@/lib/notification-platform";

type CallMode = "voice" | "video" | "share";
type CallInvite = { id: number; roomId: number; createdBy: number; mode: CallMode; status: "ringing" | "active" | "ended"; callerName?: string; callerAvatar?: string | null };
type MessageNotification = { id: number; roomId: number; senderId: number; senderName?: string | null; body: string; kind: "text" | "image" | "video" | "file" | "sticker" | "system" };

export function IncomingCallOverlay({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const callOverlay = useCallOverlay();
  const decline = trpc.calls.decline.useMutation();
  const [invite, setInvite] = useState<CallInvite | null>(null);
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);

  useEffect(() => {
    if (!supportsNativeNotifications(Platform.OS)) return;
    void initializeLocalNotifications();
    const last = Notifications.getLastNotificationResponse();
    const redirect = (response: Notifications.NotificationResponse | null) => {
      const route = response?.notification.request.content.data?.route;
      if (typeof route === "string" && route.startsWith("/")) router.push(route as any);
    };
    redirect(last);
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => redirect(response));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user) { setInvite(null); return; }
    let mounted = true;
    let socket: ReturnType<typeof io> | null = null;
    const connect = async () => {
      const token = await getSessionToken();
      if (!mounted) return;
      socket = io(getApiBaseUrl(), {
        path: "/api/socket.io",
        withCredentials: true,
        transports: ["websocket", "polling"],
        extraHeaders: token && Platform.OS !== "web" ? { Authorization: `Bearer ${token}` } : undefined,
      });
      socket.on("call:invite", (next: CallInvite) => {
        if (next.createdBy !== user.id && next.status !== "ended") {
          setInvite(next);
          if (supportsNativeNotifications(Platform.OS)) void showCallNotification({ callerName: next.callerName ?? "Người dùng", roomId: next.roomId, sessionId: next.id, mode: next.mode });
        }
      });
      socket.on("message:notify", (message: MessageNotification) => {
        if (message.senderId === user.id || pathnameRef.current === `/chat/${message.roomId}`) return;
        if (supportsNativeNotifications(Platform.OS)) void showMessageNotification({ senderName: message.senderName ?? "Người dùng", roomId: message.roomId, body: message.body, kind: message.kind });
      });
      socket.on("call:ended", (payload: { sessionId: number }) => {
        setInvite((current) => current?.id === payload.sessionId ? null : current);
        if (callOverlay.connection?.sessionId === payload.sessionId) {
          const roomId = callOverlay.connection.roomId;
          callOverlay.clear();
          router.replace(`/chat/${roomId}` as any);
        }
      });
      socket.on("call:declined", (payload: { sessionId: number }) => {
        setInvite((current) => current?.id === payload.sessionId ? null : current);
      });
    };
    void connect();
    return () => { mounted = false; socket?.disconnect(); };
  }, [callOverlay, isAuthenticated, user?.id]);

  const accept = () => {
    if (!invite) return;
    const sessionId = invite.id;
    setInvite(null);
    router.push(`/call/${sessionId}` as any);
  };
  const reject = () => {
    if (!invite || decline.isPending) return;
    const sessionId = invite.id;
    setInvite(null);
    decline.mutate({ sessionId });
  };
  const isShare = invite?.mode === "share";
  const isVoice = invite?.mode === "voice";
  const title = isVoice ? "Cuộc gọi thoại đến" : isShare ? "Lời mời xem chia sẻ màn hình" : "Cuộc gọi video đến";
  const callerName = invite?.callerName ?? "Người dùng";
  const copy = isShare ? `${callerName} mời bạn xem màn hình điện thoại đang chia sẻ.` : `${callerName} đang gọi. Bạn có thể nhận hoặc từ chối ngay mà không cần thoát ứng dụng.`;

  return <>{children}<Modal transparent visible={Boolean(invite)} animationType="fade" statusBarTranslucent onRequestClose={reject}><View style={styles.backdrop}><View style={styles.card}>{invite?.callerAvatar ? <Image source={{ uri: invite.callerAvatar }} style={styles.avatar} /> : <View style={styles.avatarFallback}><Text style={styles.avatarInitial}>{callerName.slice(0, 1).toUpperCase()}</Text></View>}<View style={styles.icon}><MaterialIcons name={isVoice ? "phone-in-talk" : isShare ? "screen-share" : "videocam"} size={29} color="#FFFFFF" /></View><Text style={styles.title}>{title}</Text><Text style={styles.caller}>{callerName} đang gọi</Text><Text style={styles.copy}>{copy}</Text><View style={styles.actions}><TouchableOpacity accessibilityLabel="Từ chối cuộc gọi" style={styles.reject} onPress={reject}><MaterialIcons name="call-end" size={20} color="#FFFFFF" /><Text style={styles.rejectText}>Từ chối</Text></TouchableOpacity><TouchableOpacity accessibilityLabel="Nhận cuộc gọi" style={styles.accept} onPress={accept}><MaterialIcons name={isShare ? "visibility" : "call"} size={20} color="#FFFFFF" /><Text style={styles.acceptText}>{isShare ? "Xem" : isVoice ? "Nghe" : "Tham gia"}</Text></TouchableOpacity></View></View></View></Modal></>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "rgba(2,6,23,0.78)" },
  card: { width: "100%", maxWidth: 360, alignItems: "center", borderRadius: 30, backgroundColor: "#FFFFFF", padding: 26, elevation: 18, shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 30, shadowOffset: { width: 0, height: 15 } },
  avatar: { width: 84, height: 84, borderRadius: 30, backgroundColor: "#E5F0FF" }, avatarFallback: { width: 84, height: 84, borderRadius: 30, alignItems: "center", justifyContent: "center", backgroundColor: "#E5F0FF" }, avatarInitial: { color: "#0B74E5", fontSize: 31, fontWeight: "800" }, icon: { width: 48, height: 48, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "#0B74E5", marginTop: -18, borderWidth: 3, borderColor: "#FFFFFF" },
  title: { marginTop: 19, color: "#172033", fontSize: 21, fontWeight: "800", textAlign: "center" },
  caller: { marginTop: 12, color: "#172033", fontSize: 16, fontWeight: "800", textAlign: "center" }, copy: { marginTop: 8, color: "#64748B", fontSize: 14, lineHeight: 20, textAlign: "center" },
  actions: { width: "100%", flexDirection: "row", gap: 12, marginTop: 26 },
  reject: { flex: 1, minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 16, backgroundColor: "#E95056" },
  accept: { flex: 1, minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 16, backgroundColor: "#16A34A" },
  rejectText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  acceptText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
});
