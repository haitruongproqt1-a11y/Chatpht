import { addDoc, collection, doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { firestore, firebaseReady } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import Constants from "expo-constants";

type Mode = "voice" | "video" | "share";
type Session = { id: number; roomId: number; createdBy: number; mode: Mode };
const extra = (Constants.expoConfig?.extra ?? {}) as { turnUrl?: string; turnUsername?: string; turnCredential?: string };
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }, { urls: "stun:stun.relay.metered.ca:80" },
  ...(extra.turnUsername && extra.turnCredential ? [
    { urls: extra.turnUrl || "turn:openrelay.metered.ca:80", username: extra.turnUsername, credential: extra.turnCredential },
    { urls: "turn:openrelay.metered.ca:443", username: extra.turnUsername, credential: extra.turnCredential },
    { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: extra.turnUsername, credential: extra.turnCredential },
  ] : []),
];

export default function WebP2PCallScreen() {
  const { sessionId: raw } = useLocalSearchParams<{ sessionId: string }>();
  const sessionId = Number(raw);
  const { user } = useAuth();
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const localVideo = useRef<HTMLVideoElement | null>(null);
  const remoteVideo = useRef<HTMLVideoElement | null>(null);
  const answer = trpc.calls.answer.useMutation({ onSuccess: (data) => setSession(data.session as Session), onError: (cause) => setError(cause.message) });
  useEffect(() => { if (Number.isInteger(sessionId) && sessionId > 0 && !session && !answer.isPending) answer.mutate({ sessionId }); }, [answer, session, sessionId]);
  useEffect(() => {
    const db = firestore;
    if (!session || !user || !firebaseReady || !db) return;
    let stopped = false;
    let peer: RTCPeerConnection | null = null;
    const cleanups: Array<() => void> = [];
    const start = async () => {
      try {
        const caller = session.createdBy === user.id;
        const camera = await navigator.mediaDevices.getUserMedia({ audio: true, video: session.mode === "video" });
        const stream = session.mode === "share" && caller ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }) : camera;
        if (session.mode === "share") camera.getAudioTracks().forEach((track) => stream.addTrack(track));
        if (localVideo.current && session.mode !== "voice") localVideo.current.srcObject = stream;
        peer = new RTCPeerConnection({ iceServers: ICE_SERVERS, iceTransportPolicy: "all", iceCandidatePoolSize: 10, bundlePolicy: "max-bundle" });
        stream.getTracks().forEach((track) => peer?.addTrack(track, stream));
        const callRef = doc(db, "p2p_calls", String(session.id));
        const own = collection(callRef, caller ? "callerCandidates" : "calleeCandidates");
        const remote = collection(callRef, caller ? "calleeCandidates" : "callerCandidates");
        peer.onicecandidate = (event) => { if (event.candidate) { const type = / typ ([a-z]+)/.exec(event.candidate.candidate)?.[1] ?? "unknown"; console.info(`[P2P ICE] local candidate type=${type}`); void addDoc(own, event.candidate.toJSON()); } };
        peer.ontrack = (event) => { const stream = event.streams?.[0]; if (remoteVideo.current && stream) remoteVideo.current.srcObject = stream; };
        let remoteSet = false;
        cleanups.push(onSnapshot(remote, (snapshot) => snapshot.docChanges().forEach((change) => { if (change.type === "added") void peer?.addIceCandidate(change.doc.data()); })));
        cleanups.push(onSnapshot(callRef, async (snapshot) => {
          const data = snapshot.data() as { offer?: RTCSessionDescriptionInit; answer?: RTCSessionDescriptionInit; status?: string } | undefined;
          if (!data || stopped || data.status === "ended") return;
          if (caller && data.answer && !remoteSet) { await peer?.setRemoteDescription(data.answer); remoteSet = true; }
          if (!caller && data.offer && !remoteSet) { await peer?.setRemoteDescription(data.offer); remoteSet = true; const next = await peer?.createAnswer(); if (next) { await peer?.setLocalDescription(next); await updateDoc(callRef, { answer: { type: next.type, sdp: next.sdp }, status: "active", answeredAt: serverTimestamp() }); } }
        }));
        if (caller) { await setDoc(callRef, { roomId: session.roomId, createdBy: session.createdBy, mode: session.mode, status: "ringing", createdAt: serverTimestamp() }, { merge: true }); const offer = await peer.createOffer(); await peer.setLocalDescription(offer); await updateDoc(callRef, { offer: { type: offer.type, sdp: offer.sdp } }); }
        else if (!(await getDoc(callRef)).exists()) throw new Error("Lời mời P2P chưa sẵn sàng.");
      } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể kết nối P2P."); }
    };
    void start();
    return () => { stopped = true; cleanups.forEach((cleanup) => cleanup()); peer?.close(); };
  }, [session, user]);
  if (error) return <Status title="Không thể vào cuộc gọi" copy={error} />;
  if (!session) return <Status title="Đang kết nối..." copy="Đang chuẩn bị phiên P2P." />;
  return <div style={{ background: "#080B14", color: "white", height: "100vh", padding: 16, textAlign: "center" }}><h2>{session.mode === "voice" ? "Cuộc gọi thoại" : session.mode === "share" ? "Chia sẻ màn hình" : "Cuộc gọi video P2P"}</h2>{session.mode === "voice" ? <p>Đang thiết lập micro P2P…</p> : <div style={{ height: "calc(100vh - 145px)", position: "relative" }}><video ref={remoteVideo} autoPlay playsInline style={{ background: "#111827", height: "100%", objectFit: "cover", width: "100%" }} /><video ref={localVideo} autoPlay muted playsInline style={{ border: "2px solid white", borderRadius: 12, height: 180, objectFit: "cover", position: "absolute", right: 12, top: 12, width: 128 }} /></div>}<button type="button" onClick={() => router.replace(`/chat/${session.roomId}` as any)} style={{ background: "#E95056", border: 0, borderRadius: 14, color: "white", fontWeight: 800, marginTop: 12, padding: "12px 20px" }}>Rời gọi</button></div>;
}

function Status({ title, copy }: { title: string; copy: string }) { return <div style={{ alignItems: "center", background: "#F7F8FC", display: "flex", flexDirection: "column", height: "100vh", justifyContent: "center", padding: 24, textAlign: "center" }}><h1>{title}</h1><p>{copy}</p><button type="button" onClick={() => router.back()}>Quay lại</button></div>; }
