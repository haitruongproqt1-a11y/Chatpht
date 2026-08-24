import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, PanResponder, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { RTCView } from "react-native-webrtc";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/use-auth";
import { useCallOverlay, type CallMode } from "@/components/call-overlay";
import { toP2PFailure, type P2PFailure } from "@/lib/p2p-error";

type Session = { id: number; roomId: number; createdBy: number; mode: CallMode };

export default function CallScreen() {
  const { sessionId: rawSessionId } = useLocalSearchParams<{ sessionId: string }>();
  const sessionId = Number(rawSessionId);
  const call = useCallOverlay();
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const answer = trpc.calls.answer.useMutation({
    onSuccess: (data) => {
      const next = data.session as Session;
      setSession(next);
      if (call.connection?.sessionId !== next.id) call.activate({ sessionId: next.id, roomId: next.roomId, creatorId: next.createdBy, mode: next.mode });
    },
    onError: (cause) => setError(cause.message),
  });

  useEffect(() => {
    if (Number.isInteger(sessionId) && sessionId > 0 && !session && !answer.isPending) answer.mutate({ sessionId });
  }, [answer, session, sessionId]);

  const failure = call.error ?? (error ? toP2PFailure(error) : null);
  if (failure) return <CallBlocked failure={failure} onRetry={call.error ? call.retry : () => { setError(null); answer.mutate({ sessionId }); }} />;
  if (!session || !call.connection) return <ScreenContainer containerClassName="bg-[#101321]" className="items-center justify-center"><ActivityIndicator color="#FFFFFF" /><Text style={styles.connecting}>Đang thiết lập kết nối P2P...</Text></ScreenContainer>;
  return <ActiveCall session={session} />;
}

function ActiveCall({ session }: { session: Session }) {
  const { user } = useAuth();
  const call = useCallOverlay();
  const [elapsed, setElapsed] = useState(0);
  const previewPosition = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const previewStart = useRef({ x: 0, y: 0 });
  const panResponder = useMemo(() => PanResponder.create({ onStartShouldSetPanResponder: () => true, onPanResponderGrant: () => previewPosition.stopAnimation((value) => { previewStart.current = value; }), onPanResponderMove: (_, gesture) => previewPosition.setValue({ x: previewStart.current.x + gesture.dx, y: previewStart.current.y + gesture.dy }) }), [previewPosition]);
  const leave = trpc.calls.leave.useMutation({ onSettled: () => { call.clear(); router.replace(`/chat/${session.roomId}` as any); } });
  const endCall = trpc.calls.end.useMutation({ onSettled: () => { call.clear(); router.replace(`/chat/${session.roomId}` as any); } });
  useEffect(() => { const timer = setInterval(() => setElapsed((value) => value + 1), 1000); return () => clearInterval(timer); }, []);
  const leaveCall = () => { (user?.id === session.createdBy ? endCall : leave).mutate({ sessionId: session.id }); };
  const title = session.mode === "voice" ? "Cuộc gọi thoại" : session.mode === "share" ? "Chia sẻ màn hình" : "Cuộc gọi video";
  const videoEnabled = session.mode === "video";
  const shareEnabled = session.mode === "share";
  return <ScreenContainer edges={["top", "bottom", "left", "right"]} containerClassName="bg-[#080B14]" className="bg-[#080B14]">
    <View style={styles.header}><TouchableOpacity style={styles.roundButton} onPress={() => { call.minimize(); router.replace(`/chat/${session.roomId}` as any); }}><MaterialIcons name="keyboard-arrow-down" size={27} color="#FFFFFF" /></TouchableOpacity><View style={styles.identity}><Text style={styles.title}>{title}</Text><View style={styles.subtitleRow}><Text style={styles.subtitle}>{formatDuration(elapsed)} · {call.remoteStream ? "2" : "Đang kết nối"} người tham gia</Text><NetworkQualityBadge quality={call.networkQuality} /></View></View>{videoEnabled ? <TouchableOpacity style={styles.roundButton} onPress={() => call.switchCamera().catch((cause) => Alert.alert("Không thể chuyển camera", cause.message))}><MaterialIcons name="flip-camera-ios" size={22} color="#FFFFFF" /></TouchableOpacity> : <View style={styles.roundButton} />}</View>
    {session.mode === "voice" ? <VoiceStage /> : <VideoStage localUrl={call.localStream?.toURL() ?? null} remoteUrl={call.remoteStream?.toURL() ?? null} isLocalSharing={shareEnabled && call.isSharing && user?.id === session.createdBy} isRemoteSharing={shareEnabled && call.isSharing && user?.id !== session.createdBy} previewPosition={previewPosition} panHandlers={panResponder.panHandlers} />}
    <View style={styles.controls}>
      <Control icon={call.isMicrophoneEnabled ? "mic" : "mic-off"} label={call.isMicrophoneEnabled ? "Micro" : "Tắt mic"} onPress={call.toggleMicrophone} />
      <Control icon={call.speakerEnabled ? "volume-up" : "hearing"} label={call.speakerEnabled ? "Loa ngoài" : "Loa trong"} onPress={call.toggleSpeaker} active={call.speakerEnabled} />
      {videoEnabled ? <Control icon={call.isCameraEnabled ? "videocam" : "videocam-off"} label={call.isCameraEnabled ? "Camera" : "Bật cam"} onPress={() => call.toggleCamera().catch((cause) => Alert.alert("Không thể đổi camera", cause.message))} /> : null}
      {shareEnabled && user?.id === session.createdBy ? <Control icon="screen-share" label={call.isSharing ? "Dừng chia sẻ" : "Chia sẻ"} onPress={() => call.toggleScreenShare().catch((cause) => Alert.alert("Chưa thể chia sẻ", cause.message))} active={call.isSharing} /> : null}
      <Control icon="call-end" label={user?.id === session.createdBy ? "Kết thúc" : "Rời gọi"} onPress={leaveCall} danger />
    </View>
  </ScreenContainer>;
}

function VideoStage({ localUrl, remoteUrl, isLocalSharing, isRemoteSharing, previewPosition, panHandlers }: { localUrl: string | null; remoteUrl: string | null; isLocalSharing: boolean; isRemoteSharing: boolean; previewPosition: Animated.ValueXY; panHandlers: ReturnType<typeof PanResponder.create>["panHandlers"] }) {
  const isViewingSharedScreen = isRemoteSharing && Boolean(remoteUrl);
  const stageLabel = isViewingSharedScreen ? "Màn hình người kia chia sẻ" : isLocalSharing ? "Bạn đang phát màn hình" : "Người nhận";
  const waitingLabel = isRemoteSharing ? "Đang kết nối màn hình được chia sẻ" : isLocalSharing ? "Đang phát màn hình cho người nhận" : "Đang chờ video người nhận";
  return <View style={styles.videoStage}>{remoteUrl ? <RTCView key={`remote-stage-${remoteUrl}`} streamURL={remoteUrl} style={styles.video} objectFit={isViewingSharedScreen ? "contain" : "cover"} zOrder={0} /> : <View style={styles.empty}><MaterialIcons name={isLocalSharing || isRemoteSharing ? "screen-share" : "videocam-off"} size={42} color="#94A3B8" /><Text style={styles.emptyTitle}>{waitingLabel}</Text></View>}<View style={styles.mainLabel}><Text style={styles.mainLabelText}>{stageLabel}</Text></View><Animated.View {...panHandlers} style={[styles.preview, { transform: previewPosition.getTranslateTransform() }]}>{localUrl && !isLocalSharing ? <RTCView key={`local-preview-${localUrl}`} streamURL={localUrl} style={styles.previewVideo} objectFit="cover" mirror zOrder={1} /> : <View style={styles.placeholder}><MaterialIcons name={isLocalSharing ? "screen-share" : "videocam"} size={32} color="#DDE7FF" /></View>}<View style={styles.previewLabel}><Text style={styles.previewText}>{isLocalSharing ? "Bạn đang phát" : "Bạn · kéo để di chuyển"}</Text></View></Animated.View></View>;
}

function VoiceStage() { return <View style={styles.voiceStage}><View style={styles.voiceAvatar}><MaterialIcons name="phone-in-talk" size={48} color="#C7D2FE" /></View><Text style={styles.emptyTitle}>Đang kết nối thoại</Text><Text style={styles.emptyCopy}>Bạn có thể bật/tắt Micro và chuyển giữa loa trong/loa ngoài.</Text></View>; }
function NetworkQualityBadge({ quality }: { quality: "connecting" | "good" | "weak" | "offline" }) {
  const content = quality === "good" ? { color: "#86EFAC", icon: "signal-cellular-4-bar" as const, label: "Mạng mạnh" } : quality === "weak" ? { color: "#FDE68A", icon: "signal-cellular-alt-1-bar" as const, label: "Mạng yếu" } : quality === "offline" ? { color: "#FDA4AF", icon: "signal-cellular-off" as const, label: "Mất kết nối" } : { color: "#BFDBFE", icon: "sync" as const, label: "Đang kết nối" };
  return <View accessibilityLabel={`Trạng thái mạng: ${content.label}`} style={styles.networkBadge}><MaterialIcons name={content.icon} size={14} color={content.color} /><Text style={[styles.networkText, { color: content.color }]}>{content.label}</Text></View>;
}
function Control({ icon, label, onPress, active, danger }: { icon: React.ComponentProps<typeof MaterialIcons>["name"]; label: string; onPress: () => void; active?: boolean; danger?: boolean }) { return <TouchableOpacity style={[styles.control, active && styles.active, danger && styles.danger]} onPress={onPress}><MaterialIcons name={icon} size={23} color="#FFFFFF" /><Text style={styles.controlText}>{label}</Text></TouchableOpacity>; }
function CallBlocked({ failure, onRetry }: { failure: P2PFailure; onRetry: () => void }) {
  return <ScreenContainer className="px-6 justify-center">
    <View style={styles.errorCard} accessibilityLiveRegion="assertive">
      <View style={styles.errorIcon}><MaterialIcons name="portable-wifi-off" size={28} color="#FCA5A5" /></View>
      <Text style={styles.blockTitle}>{failure.title}</Text>
      <Text style={styles.blockCopy}>{failure.message}</Text>
      <View style={styles.errorAdvice}><MaterialIcons name="tips-and-updates" size={17} color="#C7D2FE" /><Text style={styles.errorAdviceText}>{failure.advice}</Text></View>
      <Text style={styles.errorCode}>Mã chẩn đoán: {failure.code}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={onRetry}><MaterialIcons name="refresh" size={19} color="#FFFFFF" /><Text style={styles.backText}>Thử lại</Text></TouchableOpacity>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}><Text style={styles.backText}>Quay lại hội thoại</Text></TouchableOpacity>
    </View>
  </ScreenContainer>;
}
function formatDuration(total: number) { return `${Math.floor(total / 60).toString().padStart(2, "0")}:${(total % 60).toString().padStart(2, "0")}`; }

const styles = StyleSheet.create({ connecting: { marginTop: 14, color: "#CBD5E1", fontSize: 14 }, header: { height: 78, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 18 }, roundButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" }, identity: { alignItems: "center", flexShrink: 1 }, title: { color: "#FFFFFF", fontSize: 20, fontWeight: "800" }, subtitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 2 }, subtitle: { color: "#86EFAC", fontSize: 13, fontWeight: "700" }, networkBadge: { alignItems: "center", backgroundColor: "rgba(15,23,42,0.68)", borderRadius: 9, flexDirection: "row", gap: 3, paddingHorizontal: 6, paddingVertical: 3 }, networkText: { fontSize: 10, fontWeight: "800" }, videoStage: { flex: 1, marginHorizontal: 10, marginBottom: 8, borderRadius: 24, overflow: "hidden", backgroundColor: "#111827", position: "relative" }, video: { flex: 1 }, empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 35 }, emptyTitle: { color: "#FFFFFF", fontWeight: "800", fontSize: 18, marginTop: 12, textAlign: "center" }, emptyCopy: { color: "#94A3B8", marginTop: 5, textAlign: "center", lineHeight: 20 }, mainLabel: { position: "absolute", bottom: 14, left: 14, backgroundColor: "rgba(0,0,0,0.54)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }, mainLabelText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" }, preview: { position: "absolute", top: 14, right: 14, width: 116, height: 162, borderRadius: 17, overflow: "hidden", backgroundColor: "#312E81", borderWidth: 2, borderColor: "rgba(255,255,255,0.82)", elevation: 9, zIndex: 10 }, previewVideo: { width: "100%", height: "100%" }, placeholder: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#312E81" }, previewLabel: { position: "absolute", bottom: 6, left: 6, right: 6, backgroundColor: "rgba(15,23,42,0.65)", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 }, previewText: { color: "#FFFFFF", fontSize: 9, fontWeight: "700", textAlign: "center" }, voiceStage: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 48 }, voiceAvatar: { width: 112, height: 112, borderRadius: 56, backgroundColor: "#312E81", alignItems: "center", justifyContent: "center", marginBottom: 10 }, controls: { flexDirection: "row", gap: 9, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 16, backgroundColor: "#101521", justifyContent: "center", flexWrap: "wrap" }, control: { minWidth: 72, minHeight: 62, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "#2B3546", paddingHorizontal: 8 }, active: { backgroundColor: "#4F46E5" }, danger: { backgroundColor: "#E95056" }, controlText: { color: "#FFFFFF", fontSize: 9, fontWeight: "700", marginTop: 4, textAlign: "center" }, errorCard: { backgroundColor: "#171D2F", borderColor: "#7F1D1D", borderRadius: 24, borderWidth: 1, padding: 22 }, errorIcon: { width: 54, height: 54, borderRadius: 27, alignItems: "center", backgroundColor: "#3F1D28", justifyContent: "center" }, blockTitle: { color: "#FFFFFF", fontSize: 24, fontWeight: "800", marginTop: 16 }, blockCopy: { color: "#CBD5E1", lineHeight: 22, marginTop: 10 }, errorAdvice: { backgroundColor: "#202A45", borderRadius: 14, flexDirection: "row", gap: 8, marginTop: 18, padding: 12 }, errorAdviceText: { color: "#DBEAFE", flex: 1, fontSize: 13, lineHeight: 19 }, errorCode: { color: "#94A3B8", fontSize: 12, fontWeight: "700", marginTop: 14 }, retryButton: { alignItems: "center", backgroundColor: "#4F46E5", borderRadius: 16, flexDirection: "row", gap: 7, height: 52, justifyContent: "center", marginTop: 22 }, backButton: { marginTop: 10, height: 52, borderRadius: 16, backgroundColor: "#2B3546", alignItems: "center", justifyContent: "center" }, backText: { color: "#FFFFFF", fontWeight: "800", fontSize: 16 } });
