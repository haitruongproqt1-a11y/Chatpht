import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router, useLocalSearchParams } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, FlatList, Image, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import type { Socket } from "socket.io-client";
import { io } from "socket.io-client";
import { AttachmentSheet } from "@/components/attachment-sheet";
import { StickerSheet } from "@/components/sticker-sheet";
import { ScreenContainer } from "@/components/screen-container";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getApiBaseUrl } from "@/constants/oauth";
import { useAuth } from "@/hooks/use-auth";
import { getSessionToken } from "@/lib/_core/auth";
import { trpc } from "@/lib/trpc";
import type { UploadCandidate } from "@/lib/upload";
import { persistentUploadQueue, type PersistentUploadItem } from "@/lib/persistent-upload-queue";

type ChatMessage = { id: number; senderId: number; body: string; kind: "text" | "image" | "video" | "file" | "sticker" | "system"; attachmentUrl: string | null; attachmentName: string | null; attachmentMimeType: string | null; attachmentSize: number | null; createdAt: Date | string; receipt?: { deliveredCount: number; readCount: number } };
type CallMode = "voice" | "video" | "share";

export default function ChatScreen() {
  const params = useLocalSearchParams<{ roomId: string }>();
  const roomId = Number(params.roomId);
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const roomQuery = trpc.chat.room.useQuery({ roomId }, { enabled: Number.isInteger(roomId) && roomId > 0 });
  const messagesQuery = trpc.chat.messages.useQuery({ roomId, limit: 50 }, { enabled: Number.isInteger(roomId) && roomId > 0 });
  const markDelivered = trpc.chat.markDelivered.useMutation();
  const markRead = trpc.chat.markRead.useMutation();
  const sendMessage = trpc.chat.sendMessage.useMutation({ onSuccess: () => { utils.chat.messages.invalidate({ roomId, limit: 50 }); utils.chat.rooms.invalidate(); } });
  const sendSticker = trpc.chat.sendSticker.useMutation({ onSuccess: () => { utils.chat.messages.invalidate({ roomId, limit: 50 }); utils.chat.rooms.invalidate(); } });
  const createCall = trpc.calls.create.useMutation({ onSuccess: (call) => router.push(`/call/${call.id}` as any), onError: (error) => Alert.alert("Chưa thể bắt đầu cuộc gọi", error.message) });
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [remoteTyping, setRemoteTyping] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<PersistentUploadItem[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendingRef = useRef(false);
  const pendingTextIdRef = useRef<string | null>(null);
  const pendingStickerIdRef = useRef<string | null>(null);
  const acknowledgedMessageIdsRef = useRef(new Set<number>());
  const orderedMessages = useMemo(() => {
    const unique = new Map<number, ChatMessage>();
    for (const item of messagesQuery.data ?? []) unique.set(item.id, item as ChatMessage);
    return [...unique.values()].reverse();
  }, [messagesQuery.data]);

  useEffect(() => {
    if (!roomId || !user) return;
    let mounted = true;
    const connect = async () => {
      const token = await getSessionToken();
      if (!mounted) return;
      const socket = io(getApiBaseUrl(), {
        path: "/api/socket.io",
        withCredentials: true,
        transports: ["websocket", "polling"],
        extraHeaders: token && Platform.OS !== "web" ? { Authorization: `Bearer ${token}` } : undefined,
      });
      socketRef.current = socket;
      socket.on("connect", () => socket.emit("room:join", { roomId }));
      socket.on("message:new", (message: ChatMessage) => {
        utils.chat.messages.invalidate({ roomId, limit: 50 });
        utils.chat.rooms.invalidate();
        if (message.senderId !== user.id) {
          acknowledgedMessageIdsRef.current.add(message.id);
          markDelivered.mutate({ roomId, messageIds: [message.id] });
          markRead.mutate({ roomId, messageIds: [message.id] });
        }
      });
      socket.on("message:receipt", () => { utils.chat.messages.invalidate({ roomId, limit: 50 }); });
      socket.on("call:created", () => { utils.chat.messages.invalidate({ roomId, limit: 50 }); utils.chat.rooms.invalidate(); });
      socket.on("call:ended", () => { utils.chat.messages.invalidate({ roomId, limit: 50 }); });
      socket.on("typing", (payload: { roomId: number; userId: number; isTyping: boolean }) => {
        if (payload.roomId === roomId && payload.userId !== user.id) setRemoteTyping(payload.isTyping);
      });
    };
    connect();
    return () => { mounted = false; socketRef.current?.emit("room:leave", { roomId }); socketRef.current?.disconnect(); socketRef.current = null; };
  }, [roomId, user, utils, markDelivered, markRead]);

  useEffect(() => {
    const incomingMessageIds = orderedMessages.filter((message) => message.senderId !== user?.id && !acknowledgedMessageIdsRef.current.has(message.id)).map((message) => message.id);
    if (!incomingMessageIds.length) return;
    incomingMessageIds.forEach((messageId) => acknowledgedMessageIdsRef.current.add(messageId));
    markDelivered.mutate({ roomId, messageIds: incomingMessageIds });
    markRead.mutate({ roomId, messageIds: incomingMessageIds });
  }, [orderedMessages, roomId, user?.id, markDelivered, markRead]);

  useEffect(() => persistentUploadQueue.subscribe((items, event) => {
    setUploadQueue(items.filter((item) => item.roomId === roomId));
    if (event.type === "uploaded" && event.roomId === roomId) {
      utils.chat.messages.invalidate({ roomId, limit: 50 });
      utils.chat.rooms.invalidate();
    }
  }), [roomId, utils]);

  const emitTyping = useCallback((value: string) => {
    if (value.trim()) pendingTextIdRef.current = null;
    socketRef.current?.emit("typing", { roomId, isTyping: Boolean(value.trim()) });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => socketRef.current?.emit("typing", { roomId, isTyping: false }), 1200);
  }, [roomId]);

  const submit = useCallback(async (rawMessage: string): Promise<boolean> => {
    const message = rawMessage.trim();
    if (!message || sendMessage.isPending || sendingRef.current) return false;
    sendingRef.current = true;
    const clientMessageId = pendingTextIdRef.current ?? createClientMessageId();
    pendingTextIdRef.current = clientMessageId;
    socketRef.current?.emit("typing", { roomId, isTyping: false });
    try { await sendMessage.mutateAsync({ roomId, body: message, clientMessageId }); pendingTextIdRef.current = null; return true; } catch (error) { Alert.alert("Chưa gửi được tin", error instanceof Error ? error.message : "Vui lòng thử lại."); return false; } finally { sendingRef.current = false; }
  }, [roomId, sendMessage]);

  const onAttachment = (assets: UploadCandidate[]) => {
    persistentUploadQueue.enqueue(roomId, assets).catch((error) => Alert.alert("Chưa chuẩn bị được tệp", error instanceof Error ? error.message : "Vui lòng chọn lại tệp."));
  };
  const cancelUpload = (id: string) => { void persistentUploadQueue.cancel(id); };

  const onSticker = async (sticker: string) => {
    if (sendSticker.isPending) return;
    const clientMessageId = pendingStickerIdRef.current ?? createClientMessageId();
    pendingStickerIdRef.current = clientMessageId;
    try { await sendSticker.mutateAsync({ roomId, sticker, clientMessageId }); pendingStickerIdRef.current = null; } catch (error) { Alert.alert("Chưa gửi được sticker", error instanceof Error ? error.message : "Vui lòng thử lại."); }
  };
  const startCall = (mode: CallMode) => createCall.mutate({ roomId, mode });
  const openSticker = useCallback(() => setStickerOpen(true), []);
  const openAttachments = useCallback(() => setAttachmentOpen(true), []);

  const title = roomQuery.data?.name ?? "Cuộc trò chuyện";
  const insets = useSafeAreaInsets();
  return (
    <ScreenContainer edges={["top", "left", "right"]} containerClassName="bg-background">
      <KeyboardAvoidingView style={styles.flex} behavior="padding" keyboardVerticalOffset={0} enabled={Platform.OS === "ios"}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}><MaterialIcons name="arrow-back" size={23} color="#172033" /></TouchableOpacity>
          <TouchableOpacity style={styles.headerInfo} onPress={() => router.push(`/room/${roomId}` as any)}><View style={styles.smallAvatar}><Text style={styles.smallAvatarText}>{title.slice(0, 1).toUpperCase()}</Text></View><View style={styles.headerText}><Text style={styles.headerTitle} numberOfLines={1}>{title}</Text><Text style={styles.headerSubtitle}>{remoteTyping ? "Đang soạn tin..." : roomQuery.data?.kind === "group" ? "Nhóm trò chuyện" : "Đang hoạt động"}</Text></View></TouchableOpacity>
          <View style={styles.headerActions}><TouchableOpacity accessibilityLabel="Gọi thoại" style={styles.headerButton} onPress={() => startCall("voice")} hitSlop={4}><MaterialIcons name="phone" size={21} color="#FFFFFF" /></TouchableOpacity><TouchableOpacity accessibilityLabel="Gọi video" style={styles.headerButton} onPress={() => startCall("video")} hitSlop={4}><MaterialIcons name="videocam" size={22} color="#FFFFFF" /></TouchableOpacity><TouchableOpacity accessibilityLabel="Chia sẻ màn hình" style={styles.headerButton} onPress={() => startCall("share")} hitSlop={4}><MaterialIcons name="screen-share" size={20} color="#FFFFFF" /></TouchableOpacity></View>
        </View>
        <FlatList
          data={orderedMessages}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={orderedMessages.length ? styles.messages : styles.emptyMessages}
          onRefresh={() => messagesQuery.refetch()}
          refreshing={messagesQuery.isRefetching}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
          ListEmptyComponent={<View style={styles.emptyState}><View style={styles.emptyIcon}><MaterialIcons name="chat" size={28} color="#4F46E5" /></View><Text style={styles.emptyTitle}>Bắt đầu cuộc trò chuyện</Text><Text style={styles.emptyCopy}>Tin nhắn trong phòng sẽ xuất hiện tại đây.</Text></View>}
          renderItem={({ item, index }) => <MessageBubble item={item} own={item.senderId === user?.id} showRead={index === orderedMessages.length - 1 && item.senderId === user?.id} callerName={title} />}
        />
        {remoteTyping && <View style={styles.typing}><Text style={styles.typingText}>Một thành viên đang soạn tin...</Text></View>}
        {uploadQueue.length ? <View style={styles.uploadQueue}>{uploadQueue.map((item) => <View key={item.id} style={styles.uploadRow}><View style={styles.uploadMeta}><Text style={styles.uploadName} numberOfLines={1}>{item.asset.name}</Text><Text style={styles.uploadStatus}>{item.status === "uploading" ? `Đang gửi · ${item.progress}%` : item.status === "queued" ? "Đang chờ gửi" : item.error ?? "Đang chờ tiếp tục khi ứng dụng hoạt động"}</Text><View style={styles.progressTrack}><View style={[styles.progressValue, { width: `${item.progress}%` }]} /></View></View><TouchableOpacity style={styles.cancelUpload} onPress={() => cancelUpload(item.id)}><MaterialIcons name="cancel" size={19} color="#DC2626" /></TouchableOpacity></View>)}</View> : null}
        <InputBar bottomInset={Math.max(insets.bottom, 16)} sending={sendMessage.isPending} onTyping={emitTyping} onSend={submit} onOpenSticker={openSticker} onOpenAttachments={openAttachments} />
      </KeyboardAvoidingView>
      <AttachmentSheet visible={attachmentOpen} onClose={() => setAttachmentOpen(false)} onSelect={onAttachment} />
      <StickerSheet visible={stickerOpen} onClose={() => setStickerOpen(false)} onSelect={onSticker} />
    </ScreenContainer>
  );
}

const InputBar = memo(function InputBar({ bottomInset, sending, onTyping, onSend, onOpenSticker, onOpenAttachments }: { bottomInset: number; sending: boolean; onTyping: (value: string) => void; onSend: (message: string) => Promise<boolean>; onOpenSticker: () => void; onOpenAttachments: () => void }) {
  const inputRef = useRef<TextInput>(null);
  const draftRef = useRef("");
  const [focused, setFocused] = useState(false);
  const send = async () => {
    const message = draftRef.current;
    if (!message.trim() || sending) return;
    const sent = await onSend(message);
    if (!sent) return;
    draftRef.current = "";
    inputRef.current?.clear();
    requestAnimationFrame(() => inputRef.current?.focus());
  };
  return <View style={[styles.composer, { paddingBottom: bottomInset }]}><View style={[styles.composerCard, focused && styles.composerCardFocused]}><TouchableOpacity style={styles.attachButton} onPress={onOpenSticker} hitSlop={6}><MaterialIcons name="sentiment-satisfied-alt" size={24} color="#0B74E5" /></TouchableOpacity><TouchableOpacity style={styles.attachButtonSmall} onPress={onOpenAttachments} hitSlop={6}><MaterialIcons name="add-circle-outline" size={25} color="#0B74E5" /></TouchableOpacity><TextInput ref={inputRef} defaultValue="" onChangeText={(value) => { draftRef.current = value; onTyping(value); }} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} placeholder="Nhập tin nhắn…" placeholderTextColor="#8391A5" style={styles.composerInput} multiline maxLength={4000} blurOnSubmit={false} showSoftInputOnFocus textAlignVertical="top" returnKeyType="send" submitBehavior="submit" onSubmitEditing={() => { void send(); }} /><TouchableOpacity accessibilityLabel="Gửi tin nhắn" style={[styles.sendButton, sending && styles.sendDisabled]} onPress={() => { void send(); }} hitSlop={4}><Text style={styles.sendText}>{sending ? "..." : "Gửi"}</Text></TouchableOpacity></View></View>;
});

function MessageBubble({ item, own, callerName }: { item: ChatMessage; own: boolean; showRead: boolean; callerName: string }) {
  const callEvent = parseCallEvent(item.body);
  if (item.kind === "system" && callEvent) return <CallEventBubble event={callEvent} own={own} createdAt={item.createdAt} callerName={callerName} />;
  const status = item.receipt?.readCount ? "Đã xem" : item.receipt?.deliveredCount ? "Đã nhận" : "Đã gửi";
  return <View style={[styles.messageWrap, own ? styles.ownWrap : styles.otherWrap]}><View style={[styles.bubble, item.kind === "sticker" && styles.stickerBubble, own ? styles.ownBubble : styles.otherBubble]}>{item.kind === "image" && item.attachmentUrl ? <Image source={{ uri: item.attachmentUrl }} style={styles.media} resizeMode="cover" /> : null}{item.kind === "video" ? <View style={[styles.videoCard, own && styles.ownVideoCard]}><MaterialIcons name="video-library" size={28} color={own ? "#FFFFFF" : "#4F46E5"} /><Text style={[styles.videoName, own && styles.ownText]} numberOfLines={1}>{item.attachmentName ?? "Video"}</Text><Text style={[styles.videoHint, own && styles.ownCaption]}>Đã gửi video · chạm để mở</Text></View> : null}{item.kind === "file" ? <View style={[styles.fileCard, own ? styles.ownFile : styles.otherFile]}><MaterialIcons name="insert-drive-file" size={23} color={own ? "#FFFFFF" : "#4F46E5"} /><Text style={[styles.fileName, own && styles.ownText]} numberOfLines={1}>{item.attachmentName ?? item.body}</Text></View> : null}{item.kind === "sticker" ? <Text style={styles.sentSticker}>{item.body}</Text> : null}{item.kind === "text" || item.kind === "system" ? <Text style={[styles.messageText, own && styles.ownText]}>{item.body}</Text> : null}{(item.kind === "image" || item.kind === "video") && item.body !== item.attachmentName ? <Text style={[styles.caption, own && styles.ownCaption]}>{item.body}</Text> : null}</View><Text style={styles.messageTime}>{formatMessageTime(item.createdAt)}{own ? ` · ${status}` : ""}</Text></View>;
}

function CallEventBubble({ event, own, createdAt, callerName }: { event: { sessionId: number; mode: CallMode; state: "ringing" | "ended" }; own: boolean; createdAt: Date | string; callerName: string }) {
  const isRinging = event.state === "ringing";
  const modeLabel = event.mode === "voice" ? "Thoại" : event.mode === "share" ? "Chia sẻ màn hình" : "Video";
  return <View style={[styles.messageWrap, own ? styles.ownWrap : styles.otherWrap]}><View style={[styles.callEventCard, own && styles.ownCallEvent]}><MaterialIcons name={event.mode === "voice" ? "phone-in-talk" : event.mode === "share" ? "screen-share" : "videocam"} size={24} color={own ? "#FFFFFF" : "#0B74E5"} /><View style={styles.callEventInfo}><Text style={[styles.callEventTitle, own && styles.ownText]}>{isRinging ? `${own ? "Bạn đang mở" : `${callerName} đang gọi`} · ${modeLabel}` : "Cuộc gọi nhỡ hoặc đã kết thúc"}</Text><Text style={[styles.callEventCopy, own && styles.ownCaption]}>{isRinging ? "Chạm để vào phiên trong chat" : "Bạn có thể tạo phiên mới từ thanh trên cùng"}</Text></View>{isRinging ? <TouchableOpacity style={[styles.callEventJoin, own && styles.ownCallJoin]} onPress={() => router.push(`/call/${event.sessionId}` as any)}><Text style={[styles.callEventJoinText, own && styles.ownCallJoinText]}>{event.mode === "share" ? "Xem" : "Nghe"}</Text></TouchableOpacity> : null}</View><Text style={styles.messageTime}>{formatMessageTime(createdAt)}</Text></View>;
}

function parseCallEvent(body: string): { sessionId: number; mode: CallMode; state: "ringing" | "ended" } | null {
  const matched = /^CALL_EVENT:(\d+):(voice|video|share):(ringing|ended)$/.exec(body);
  return matched ? { sessionId: Number(matched[1]), mode: matched[2] as CallMode, state: matched[3] as "ringing" | "ended" } : null;
}

function formatMessageTime(value: Date | string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }); }
function createClientMessageId() { return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `msg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`; }

const styles = StyleSheet.create({
  flex: { flex: 1 }, header: { height: 70, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", backgroundColor: "#0B74E5", borderBottomWidth: 1, borderColor: "#0867C9" }, headerButton: { width: 40, height: 42, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" }, headerInfo: { flex: 1, flexDirection: "row", alignItems: "center", marginLeft: 10, minWidth: 0 }, smallAvatar: { width: 38, height: 38, borderRadius: 14, backgroundColor: "#E6F2FF", alignItems: "center", justifyContent: "center" }, smallAvatarText: { color: "#0B5DB5", fontWeight: "800", fontSize: 15 }, headerText: { marginLeft: 9, minWidth: 0 }, headerTitle: { fontSize: 16, fontWeight: "800", color: "#FFFFFF" }, headerSubtitle: { fontSize: 12, color: "#D9ECFF", marginTop: 2 }, headerActions: { marginLeft: 8, flexDirection: "row" },
  messages: { padding: 16, paddingBottom: 16, backgroundColor: "#EEF4FB" }, emptyMessages: { flexGrow: 1, backgroundColor: "#EEF4FB" }, emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 36 }, emptyIcon: { width: 64, height: 64, borderRadius: 24, backgroundColor: "#E5F0FF", alignItems: "center", justifyContent: "center", marginBottom: 14 }, emptyTitle: { fontWeight: "800", fontSize: 18, color: "#172033" }, emptyCopy: { marginTop: 6, textAlign: "center", color: "#64748B", lineHeight: 20 },
  messageWrap: { marginBottom: 13, maxWidth: "82%" }, ownWrap: { alignSelf: "flex-end", alignItems: "flex-end" }, otherWrap: { alignSelf: "flex-start", alignItems: "flex-start" }, bubble: { borderRadius: 19, overflow: "hidden" }, stickerBubble: { backgroundColor: "transparent", borderWidth: 0 }, ownBubble: { backgroundColor: "#4F46E5", borderBottomRightRadius: 5 }, otherBubble: { backgroundColor: "#FFFFFF", borderBottomLeftRadius: 5, borderWidth: 1, borderColor: "#E2E8F0" }, sentSticker: { fontSize: 52, paddingHorizontal: 4, paddingVertical: 2 }, messageText: { color: "#172033", paddingHorizontal: 13, paddingVertical: 10, fontSize: 15, lineHeight: 21 }, ownText: { color: "#FFFFFF" }, caption: { color: "#172033", paddingHorizontal: 13, paddingBottom: 11, fontSize: 14, lineHeight: 19 }, ownCaption: { color: "#E0E7FF" }, messageTime: { fontSize: 11, color: "#94A3B8", marginTop: 4, marginHorizontal: 4 }, media: { width: 218, height: 160, backgroundColor: "#CBD5E1" }, videoCard: { width: 218, padding: 14, gap: 5, backgroundColor: "#EEF2FF" }, ownVideoCard: { backgroundColor: "#4338CA" }, videoName: { fontSize: 14, color: "#312E81", fontWeight: "800" }, videoHint: { fontSize: 12, color: "#64748B" }, fileCard: { flexDirection: "row", gap: 9, alignItems: "center", paddingHorizontal: 12, paddingVertical: 12, minWidth: 190 }, ownFile: { backgroundColor: "#4338CA" }, otherFile: { backgroundColor: "#F8FAFC" }, fileName: { flex: 1, fontSize: 14, fontWeight: "700", color: "#3730A3" },
  callModalBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "rgba(2,6,23,0.68)" }, callModal: { width: "100%", maxWidth: 360, alignItems: "center", borderRadius: 28, backgroundColor: "#FFFFFF", padding: 24, shadowColor: "#000", shadowOpacity: 0.28, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12 }, callModalIcon: { width: 72, height: 72, borderRadius: 25, alignItems: "center", justifyContent: "center", backgroundColor: "#0B74E5" }, callModalTitle: { marginTop: 18, color: "#172033", fontSize: 20, fontWeight: "800", textAlign: "center" }, callModalCopy: { marginTop: 8, color: "#64748B", fontSize: 14, lineHeight: 20, textAlign: "center" }, callModalActions: { width: "100%", flexDirection: "row", gap: 10, marginTop: 24 }, ignoreButton: { flex: 1, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#EEF2F7" }, ignoreButtonText: { color: "#475569", fontSize: 14, fontWeight: "800" }, answerButton: { flex: 1, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7, backgroundColor: "#16A34A" }, answerButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" }, callEventCard: { minWidth: 232, padding: 12, flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: "#EAF4FF", borderRadius: 16, borderWidth: 1, borderColor: "#CBE4FF" }, ownCallEvent: { backgroundColor: "#4338CA", borderColor: "#4338CA" }, callEventInfo: { flex: 1, minWidth: 0 }, callEventTitle: { color: "#172033", fontSize: 13, fontWeight: "800" }, callEventCopy: { color: "#64748B", fontSize: 11, marginTop: 3 }, callEventJoin: { borderRadius: 10, paddingHorizontal: 9, paddingVertical: 7, backgroundColor: "#FFFFFF" }, ownCallJoin: { backgroundColor: "#EEF2FF" }, callEventJoinText: { color: "#0B74E5", fontSize: 11, fontWeight: "800" }, ownCallJoinText: { color: "#3730A3" }, typing: { paddingHorizontal: 20, paddingBottom: 5 }, typingText: { color: "#64748B", fontSize: 12, fontStyle: "italic" }, uploadQueue: { marginHorizontal: 12, marginBottom: 7, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#DCE6F2", gap: 5 }, uploadRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 }, uploadMeta: { flex: 1, minWidth: 0 }, uploadName: { color: "#172033", fontSize: 13, fontWeight: "800" }, uploadStatus: { color: "#64748B", fontSize: 11, marginTop: 2 }, progressTrack: { height: 4, borderRadius: 4, backgroundColor: "#E2E8F0", marginTop: 5, overflow: "hidden" }, progressValue: { height: "100%", borderRadius: 4, backgroundColor: "#0B74E5" }, cancelUpload: { width: 35, height: 35, borderRadius: 12, backgroundColor: "#FEF2F2", alignItems: "center", justifyContent: "center" }, composer: { paddingHorizontal: 12, paddingTop: 10, backgroundColor: "#FFFFFF", borderTopWidth: StyleSheet.hairlineWidth, borderColor: "#E7EDF5" }, composerCard: { minHeight: 56, borderRadius: 18, backgroundColor: "#F5F8FC", borderWidth: 1, borderColor: "#DCE6F2", paddingLeft: 2, paddingRight: 6, flexDirection: "row", alignItems: "flex-end", gap: 1 }, composerCardFocused: { backgroundColor: "#FFFFFF", borderColor: "#0B74E5", shadowColor: "#0B74E5", shadowOpacity: 0.11, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 }, attachButton: { width: 37, height: 48, alignItems: "center", justifyContent: "center" }, attachButtonSmall: { width: 36, height: 48, alignItems: "center", justifyContent: "center" }, composerInput: { flex: 1, minHeight: 48, maxHeight: 140, paddingTop: 13, paddingBottom: 10, color: "#172033", fontSize: 16, lineHeight: 22 }, sendButton: { minWidth: 48, height: 38, borderRadius: 12, marginBottom: 7, backgroundColor: "#0B74E5", alignItems: "center", justifyContent: "center", paddingHorizontal: 10 }, sendText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" }, sendDisabled: { backgroundColor: "#B8C5D6" },
});
