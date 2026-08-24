import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { addDoc, collection, doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, PanResponder, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import InCallManager from "react-native-incall-manager";
import { MediaStream, mediaDevices, RTCPeerConnection, RTCIceCandidate, RTCSessionDescription, RTCView, type MediaStream as MediaStreamType } from "react-native-webrtc";
import { ensureFirebaseIdentity, firestore, firebaseReady } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";

export type CallMode = "voice" | "video" | "share";
export type ActiveCallConnection = { sessionId: number; roomId: number; mode: CallMode; creatorId: number };
export type NetworkQuality = "connecting" | "good" | "weak" | "offline";
type SignalingDescription = { type: "offer" | "answer"; sdp: string };
type CallOverlayState = {
  connection: ActiveCallConnection | null;
  minimized: boolean;
  localStream: MediaStreamType | null;
  remoteStream: MediaStreamType | null;
  isMicrophoneEnabled: boolean;
  isCameraEnabled: boolean;
  isSharing: boolean;
  speakerEnabled: boolean;
  networkQuality: NetworkQuality;
  error: string | null;
  activate: (connection: ActiveCallConnection) => void;
  minimize: () => void;
  restore: () => void;
  clear: () => void;
  toggleMicrophone: () => void;
  toggleCamera: () => Promise<void>;
  switchCamera: () => Promise<void>;
  toggleSpeaker: () => void;
  toggleScreenShare: () => Promise<void>;
};
const CallOverlayContext = createContext<CallOverlayState | null>(null);

export function useCallOverlay() {
  const value = useContext(CallOverlayContext);
  if (!value) throw new Error("useCallOverlay must be used inside CallOverlayProvider");
  return value;
}

function iceServers() {
  const extra = (require("expo-constants").default.expoConfig?.extra ?? {}) as { turnUrl?: string; turnUsername?: string; turnCredential?: string };
  const primaryUrl = extra.turnUrl || "turn:openrelay.metered.ca:80";
  const primary = extra.turnUsername && extra.turnCredential ? [
    { urls: primaryUrl, username: extra.turnUsername, credential: extra.turnCredential },
    { urls: "turn:openrelay.metered.ca:443", username: extra.turnUsername, credential: extra.turnCredential },
    { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: extra.turnUsername, credential: extra.turnCredential },
  ] : [];
  return [
    { urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }, { urls: "stun:stun.relay.metered.ca:80" },
    ...primary,
  ];
}

function candidateType(candidate: { candidate?: string } | null) {
  return / typ ([a-z]+)/.exec(candidate?.candidate ?? "")?.[1] ?? "unknown";
}

export function CallOverlayProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [connection, setConnection] = useState<ActiveCallConnection | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStreamType | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStreamType | null>(null);
  const [isMicrophoneEnabled, setMicrophoneEnabled] = useState(true);
  const [isCameraEnabled, setCameraEnabled] = useState(false);
  const [isSharing, setSharing] = useState(false);
  const [speakerEnabled, setSpeakerEnabled] = useState(true);
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality>("connecting");
  const [error, setError] = useState<string | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localRef = useRef<MediaStreamType | null>(null);
  const remoteRef = useRef<MediaStreamType | null>(null);
  const cameraFacingRef = useRef<"user" | "environment">("user");
  const cleanupsRef = useRef<Array<() => void>>([]);
  const restoringShareRef = useRef(false);

  const stopPeer = useCallback(() => {
    cleanupsRef.current.forEach((cleanup) => cleanup());
    cleanupsRef.current = [];
    peerRef.current?.close();
    peerRef.current = null;
    localRef.current?.getTracks().forEach((track) => track.stop());
    localRef.current = null;
    remoteRef.current = null;
    InCallManager.stop();
    setLocalStream(null);
    setRemoteStream(null);
    setSharing(false);
    setCameraEnabled(false);
    setNetworkQuality("connecting");
  }, []);

  const clear = useCallback(() => { stopPeer(); setMinimized(false); setConnection(null); setError(null); }, [stopPeer]);

  const renegotiateShare = useCallback(async (isSharingNow: boolean) => {
    const peer = peerRef.current;
    if (!peer || connection?.creatorId !== user?.id || !firestore || !connection?.sessionId) return;
    const callRef = doc(firestore, "p2p_calls", String(connection.sessionId));
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    await updateDoc(callRef, { offer: { type: offer.type, sdp: offer.sdp }, isSharing: isSharingNow, renegotiatedAt: serverTimestamp() });
  }, [connection?.creatorId, connection?.sessionId, user?.id]);

  const restoreCameraAfterShare = useCallback(async () => {
    if (restoringShareRef.current) return;
    const peer = peerRef.current;
    const stream = localRef.current;
    if (!peer || !stream) return;
    restoringShareRef.current = true;
    try {
      const camera = await mediaDevices.getUserMedia({ video: { facingMode: cameraFacingRef.current }, audio: false });
      const next = camera.getVideoTracks()[0];
      if (!next) throw new Error("Không nhận được camera để tiếp tục cuộc gọi.");
      const sender = peer.getSenders().find((candidate) => candidate.track?.kind === "video");
      if (sender) await sender.replaceTrack(next); else peer.addTrack(next, stream);
      stream.getVideoTracks().forEach((track) => { if (track.id !== next.id) { stream.removeTrack(track); track.stop(); } });
      stream.addTrack(next);
      setLocalStream(new MediaStream(stream.getTracks()));
      setCameraEnabled(true);
      setSharing(false);
      await renegotiateShare(false);
    } finally {
      restoringShareRef.current = false;
    }
  }, [renegotiateShare]);

  useEffect(() => {
    if (!connection || !user) return;
    const db = firestore;
    if (!firebaseReady || !db) { setError("Thiếu cấu hình Firebase cho signaling P2P."); return; }
    let cancelled = false;
    const setup = async () => {
      try {
        await ensureFirebaseIdentity();
        const isCaller = connection.creatorId === user.id;
        const wantsVideo = connection.mode === "video";
        const wantsShare = connection.mode === "share";
        InCallManager.start({ media: wantsVideo || wantsShare ? "video" : "audio", auto: true, forceSpeakerphone: true });
        InCallManager.setForceSpeakerphoneOn(true);
        const baseStream = await mediaDevices.getUserMedia({ audio: true, video: wantsVideo ? { facingMode: cameraFacingRef.current } : false });
        if (cancelled) { baseStream.getTracks().forEach((track) => track.stop()); return; }
        const startedAt = Date.now();
        const peer = new RTCPeerConnection({ iceServers: iceServers(), iceTransportPolicy: "all", iceCandidatePoolSize: 10, bundlePolicy: "max-bundle" });
        peerRef.current = peer;
        setNetworkQuality("connecting");
        localRef.current = baseStream;
        setLocalStream(baseStream);
        setMicrophoneEnabled(true);
        setCameraEnabled(wantsVideo);
        if (wantsShare && isCaller) {
          const display = await mediaDevices.getDisplayMedia({ android: { createConfigForDefaultDisplay: true } });
          const screenTrack = display.getVideoTracks()[0];
          if (!screenTrack) throw new Error("Không nhận được màn hình để chia sẻ.");
          screenTrack.onended = () => { void restoreCameraAfterShare(); };
          baseStream.addTrack(screenTrack);
          setLocalStream(new MediaStream(baseStream.getTracks()));
          setSharing(true);
        }
        baseStream.getTracks().forEach((track) => peer.addTrack(track, baseStream));
        const callRef = doc(db, "p2p_calls", String(connection.sessionId));
        const ownCandidates = collection(callRef, isCaller ? "callerCandidates" : "calleeCandidates");
        const remoteCandidates = collection(callRef, isCaller ? "calleeCandidates" : "callerCandidates");
        peer.onicecandidate = (event: any) => { if (event.candidate) { console.info(`[P2P ICE] local candidate type=${candidateType(event.candidate)}`); void addDoc(ownCandidates, event.candidate.toJSON()); } };
        const refreshRemoteStream = (event: any) => {
          const supplied = event.streams?.[0] as MediaStreamType | undefined;
          const prior = supplied ?? remoteRef.current;
          const audioTracks = prior?.getAudioTracks().filter((track) => track.readyState === "live") ?? [];
          const videoTracks = event.track.kind === "video"
            ? [event.track]
            : (prior?.getVideoTracks().filter((track) => track.readyState === "live") ?? []);
          const refreshed = new MediaStream([...audioTracks, ...videoTracks]);
          remoteRef.current = refreshed;
          setRemoteStream(refreshed);
          console.info(`[P2P media] remote ${event.track.kind} track attached for active call stream.`);
        };
        peer.ontrack = (event: any) => {
          refreshRemoteStream(event);
          event.track.onunmute = () => refreshRemoteStream(event);
        };
        peer.onconnectionstatechange = () => {
          if (peer.connectionState === "connected") {
            setNetworkQuality("good");
            console.info(`[P2P ICE] connected after ${Date.now() - startedAt}ms; inspect candidate types above for relay availability.`);
          }
          if (peer.connectionState === "disconnected") setNetworkQuality("weak");
          if (peer.connectionState === "failed" || peer.connectionState === "closed") {
            setNetworkQuality("offline");
            if (peer.connectionState === "failed") setError("Kết nối P2P thất bại. Hãy kiểm tra mạng hoặc TURN server.");
          }
        };
        peer.oniceconnectionstatechange = () => {
          if (peer.iceConnectionState === "checking") setNetworkQuality("connecting");
          if (peer.iceConnectionState === "connected" || peer.iceConnectionState === "completed") setNetworkQuality("good");
          if (peer.iceConnectionState === "disconnected") setNetworkQuality("weak");
          if (peer.iceConnectionState === "failed" || peer.iceConnectionState === "closed") setNetworkQuality("offline");
        };
        let appliedOfferSdp = "";
        let appliedAnswerSdp = "";
        const unsubscribeCandidates = onSnapshot(remoteCandidates, (snapshot) => snapshot.docChanges().forEach((change) => { if (change.type === "added") void peer.addIceCandidate(new RTCIceCandidate(change.doc.data())); }));
        const unsubscribeCall = onSnapshot(callRef, async (snapshot) => {
          const data = snapshot.data() as { offer?: SignalingDescription; answer?: SignalingDescription; status?: string; isSharing?: boolean } | undefined;
          if (!data || data.status === "ended") { if (data?.status === "ended") clear(); return; }
          if (connection.mode === "share") setSharing(Boolean(data.isSharing));
          if (isCaller && data.answer?.sdp && data.answer.sdp !== appliedAnswerSdp) {
            await peer.setRemoteDescription(new RTCSessionDescription(data.answer));
            appliedAnswerSdp = data.answer.sdp;
          }
          if (!isCaller && data.offer?.sdp && data.offer.sdp !== appliedOfferSdp) {
            await peer.setRemoteDescription(new RTCSessionDescription(data.offer));
            appliedOfferSdp = data.offer.sdp;
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            await updateDoc(callRef, { answer: { type: answer.type, sdp: answer.sdp }, status: "active", answeredAt: serverTimestamp() });
          }
        });
        cleanupsRef.current = [unsubscribeCandidates, unsubscribeCall];
        if (isCaller) {
          await setDoc(callRef, { roomId: connection.roomId, createdBy: connection.creatorId, callerName: user.name ?? "Người dùng", callerAvatar: user.avatarUrl ?? null, mode: connection.mode, status: "ringing", isSharing: wantsShare, createdAt: serverTimestamp() }, { merge: true });
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          appliedOfferSdp = offer.sdp ?? "";
          await updateDoc(callRef, { offer: { type: offer.type, sdp: offer.sdp } });
        } else {
          const existing = await getDoc(callRef);
          if (!existing.exists()) throw new Error("Lời mời P2P chưa sẵn sàng. Hãy thử nhận lại sau vài giây.");
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Không thể khởi tạo cuộc gọi P2P.");
      }
    };
    void setup();
    return () => { cancelled = true; };
  }, [clear, connection, restoreCameraAfterShare, user]);

  const toggleMicrophone = useCallback(() => {
    const next = !isMicrophoneEnabled;
    localRef.current?.getAudioTracks().forEach((track) => { track.enabled = next; });
    setMicrophoneEnabled(next);
  }, [isMicrophoneEnabled]);
  const toggleCamera = useCallback(async () => {
    const current = localRef.current;
    if (!current) return;
    const tracks = current.getVideoTracks().filter((track) => track.readyState === "live");
    if (tracks.length) { const next = !isCameraEnabled; tracks.forEach((track) => { track.enabled = next; }); setCameraEnabled(next); return; }
    const camera = await mediaDevices.getUserMedia({ video: { facingMode: cameraFacingRef.current }, audio: false });
    const track = camera.getVideoTracks()[0];
    if (track) { current.addTrack(track); peerRef.current?.addTrack(track, current); setCameraEnabled(true); }
  }, [isCameraEnabled]);
  const switchCamera = useCallback(async () => {
    const track = localRef.current?.getVideoTracks().find((candidate) => candidate.readyState === "live");
    if (!track) { await toggleCamera(); return; }
    const anyTrack = track as unknown as { _switchCamera?: () => void };
    if (anyTrack._switchCamera) { anyTrack._switchCamera(); cameraFacingRef.current = cameraFacingRef.current === "user" ? "environment" : "user"; return; }
    throw new Error("Camera hiện tại không hỗ trợ chuyển trước/sau trên thiết bị này.");
  }, [toggleCamera]);
  const toggleSpeaker = useCallback(() => { const next = !speakerEnabled; InCallManager.setForceSpeakerphoneOn(next); setSpeakerEnabled(next); }, [speakerEnabled]);
  const toggleScreenShare = useCallback(async () => {
    const peer = peerRef.current;
    const stream = localRef.current;
    if (!peer || !stream) return;
    if (!isSharing) {
      const display = await mediaDevices.getDisplayMedia({ android: { createConfigForDefaultDisplay: true } });
      const next = display.getVideoTracks()[0];
      if (!next) throw new Error("Không nhận được track chia sẻ màn hình.");
      next.onended = () => { void restoreCameraAfterShare(); };
      const sender = peer.getSenders().find((candidate) => candidate.track?.kind === "video");
      if (sender) await sender.replaceTrack(next); else peer.addTrack(next, display);
      stream.getVideoTracks().forEach((track) => { stream.removeTrack(track); track.stop(); });
      stream.addTrack(next);
      setLocalStream(new MediaStream(stream.getTracks()));
      setSharing(true);
      await renegotiateShare(true);
    } else {
      await restoreCameraAfterShare();
    }
  }, [isSharing, renegotiateShare, restoreCameraAfterShare]);

  const value = useMemo<CallOverlayState>(() => ({ connection, minimized, localStream, remoteStream, isMicrophoneEnabled, isCameraEnabled, isSharing, speakerEnabled, networkQuality, error, activate: (next) => { setError(null); setNetworkQuality("connecting"); setConnection(next); setMinimized(false); }, minimize: () => setMinimized(true), restore: () => setMinimized(false), clear, toggleMicrophone, toggleCamera, switchCamera, toggleSpeaker, toggleScreenShare }), [clear, connection, error, isCameraEnabled, isMicrophoneEnabled, isSharing, localStream, minimized, networkQuality, remoteStream, speakerEnabled, switchCamera, toggleCamera, toggleMicrophone, toggleScreenShare, toggleSpeaker]);
  return <CallOverlayContext.Provider value={value}>{children}<CallBubble /></CallOverlayContext.Provider>;
}

function CallBubble() {
  const { connection, minimized, restore, localStream, remoteStream } = useCallOverlay();
  const position = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const start = useRef({ x: 0, y: 0 });
  const panResponder = useMemo(() => PanResponder.create({ onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4, onPanResponderGrant: () => position.stopAnimation((value) => { start.current = value; }), onPanResponderMove: (_, gesture) => position.setValue({ x: start.current.x + gesture.dx, y: start.current.y + gesture.dy }) }), [position]);
  if (!connection || !minimized) return null;
  const modeLabel = connection.mode === "voice" ? "Cuộc gọi thoại" : connection.mode === "share" ? "Đang chia sẻ" : "Cuộc gọi video";
  return <Animated.View {...panResponder.panHandlers} style={[styles.bubble, { transform: position.getTranslateTransform() }]}><TouchableOpacity accessibilityLabel="Cửa sổ nổi cuộc gọi, chạm để mở lại" activeOpacity={0.9} style={styles.bubblePress} onPress={() => { restore(); router.push(`/call/${connection.sessionId}` as any); }}>{remoteStream && connection.mode !== "voice" ? <RTCView key={`pip-remote-${remoteStream.toURL()}`} streamURL={remoteStream.toURL()} style={styles.video} objectFit="cover" zOrder={1} /> : <View style={styles.fallback}><MaterialIcons name={connection.mode === "voice" ? "phone-in-talk" : "videocam"} size={30} color="#FFFFFF" /></View>}{localStream && connection.mode === "video" ? <View style={styles.pipLocalInset}><RTCView key={`pip-local-${localStream.toURL()}`} streamURL={localStream.toURL()} style={styles.video} objectFit="cover" mirror zOrder={2} /></View> : null}<View style={styles.badge}><View style={styles.liveDot} /><Text style={styles.badgeText}>{modeLabel}</Text></View></TouchableOpacity></Animated.View>;
}

const styles = StyleSheet.create({ bubble: { position: "absolute", right: 14, top: 76, width: 132, height: 180, borderRadius: 20, overflow: "hidden", zIndex: 9999, elevation: 18, backgroundColor: "#312E81", borderWidth: 2, borderColor: "#FFFFFF", shadowColor: "#000", shadowOpacity: 0.28, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }, bubblePress: { flex: 1 }, video: { flex: 1 }, fallback: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#312E81" }, pipLocalInset: { position: "absolute", top: 8, right: 8, width: 42, height: 60, borderRadius: 10, overflow: "hidden", borderWidth: 1.5, borderColor: "#FFFFFF", backgroundColor: "#172554" }, badge: { position: "absolute", left: 6, right: 6, bottom: 6, borderRadius: 8, backgroundColor: "rgba(15,23,42,0.72)", paddingHorizontal: 7, paddingVertical: 4, flexDirection: "row", alignItems: "center", gap: 4 }, liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#4ADE80" }, badgeText: { color: "#FFFFFF", fontSize: 9, fontWeight: "800", flexShrink: 1 } });
