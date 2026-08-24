import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

export type ChatNotificationData = { route?: string; kind?: "message" | "call"; roomId?: number; sessionId?: number };

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

export async function initializeLocalNotifications() {
  if (Platform.OS === "web") return false;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("chatpht_messages", {
      name: "Tin nhắn ChatPHT",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 180],
      lightColor: "#0B74E5",
    });
    await Notifications.setNotificationChannelAsync("chatpht_calls", {
      name: "Cuộc gọi ChatPHT",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 150, 250],
      lightColor: "#16A34A",
    });
  }
  const current = await Notifications.getPermissionsAsync();
  const permission = current.status === "granted" ? current : await Notifications.requestPermissionsAsync();
  return permission.status === "granted";
}

async function show(content: Notifications.NotificationContentInput, channelId: string) {
  if (Platform.OS === "web") return;
  const granted = await initializeLocalNotifications();
  if (!granted) return;
  await Notifications.scheduleNotificationAsync({ content: { ...content, sound: "default", data: content.data as ChatNotificationData }, trigger: null });
}

export function showMessageNotification(input: { senderName: string; roomId: number; body: string; kind: string }) {
  const preview = input.kind === "image" ? "Đã gửi một ảnh" : input.kind === "video" ? "Đã gửi một video" : input.kind === "file" ? "Đã gửi một tệp" : input.kind === "sticker" ? "Đã gửi một sticker" : input.body;
  return show({ title: input.senderName, body: preview.slice(0, 180), data: { kind: "message", roomId: input.roomId, route: `/chat/${input.roomId}` } }, "chatpht_messages");
}

export function showCallNotification(input: { callerName: string; roomId: number; sessionId: number; mode: "voice" | "video" | "share" }) {
  const label = input.mode === "voice" ? "Cuộc gọi thoại" : input.mode === "share" ? "Mời xem chia sẻ màn hình" : "Cuộc gọi video";
  return show({ title: `${label} đến`, body: `${input.callerName} đang gọi cho bạn`, data: { kind: "call", roomId: input.roomId, sessionId: input.sessionId, route: `/call/${input.sessionId}` } }, "chatpht_calls");
}
