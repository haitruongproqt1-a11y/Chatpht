import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");

describe("chat keyboard and P2P reliability contracts", () => {
  it("keeps Android composer focusable without list tap dismissal", () => {
    const chat = read("app/chat/[roomId].tsx");
    expect(chat).toContain('keyboardShouldPersistTaps="always"');
    expect(chat).toContain('keyboardDismissMode="none"');
    expect(chat).toContain('enabled={Platform.OS === "ios"}');
    expect(chat).not.toContain("onPressIn={focusInput}");
    expect(chat).toContain('submitBehavior="submit"');
    expect(chat).toContain("const InputBar = memo");
    expect(chat).toContain("const draftRef = useRef");
    expect(chat).toContain("Promise<boolean>");
    expect(chat).toContain("if (!sent) return");
    expect(chat).toContain("requestAnimationFrame(() => inputRef.current?.focus())");
    expect(chat).toContain("onSubmitEditing={() => { void send(); }}");
  });

  it("ships both secure and explicit test-only Firestore rule files", () => {
    const activeRules = read("firestore.rules");
    const productionRules = read("firestore.production.rules");
    const testRules = read("firestore.test.rules");
    expect(productionRules).toContain("request.auth != null");
    expect(productionRules).toContain("p2p_calls");
    expect(activeRules).toContain("TEST MODE ONLY");
    expect(activeRules).toContain("allow read, write: if true");
    expect(testRules).toContain("Temporary test-only fallback");
    expect(testRules).toContain("allow read, write: if true");
  });

  it("uses anonymous Firebase identity, ICE fallback and redacted candidate telemetry", () => {
    const firebase = read("lib/firebase.ts");
    const provider = read("components/call-overlay.native.tsx");
    expect(firebase).toContain("signInAnonymously");
    expect(provider).toContain("ensureFirebaseIdentity()");
    expect(provider).toContain("iceCandidatePoolSize: 10");
    expect(provider).toContain("bundlePolicy: \"max-bundle\"");
    expect(provider).toContain("turn:openrelay.metered.ca:443");
    expect(provider).not.toContain("a.relay.metered.ca");
    expect(provider).toContain("const supplied = event.streams?.[0]");
    expect(provider).toContain("const refreshed = new MediaStream([...audioTracks, ...videoTracks])");
    expect(provider).toContain("remoteRef.current = refreshed");
    expect(provider).toContain("event.track.onunmute = () => refreshRemoteStream(event)");
    expect(provider).toContain("local candidate type=${candidateType(event.candidate)}");
    expect(provider).not.toContain("console.info(event.candidate.candidate)");
    expect(provider).toContain("renegotiatedAt: serverTimestamp()");
    expect(provider).toContain("await sender.replaceTrack(next)");
    expect(provider).toContain("isSharing: wantsShare");
    expect(provider).toContain("isSharing: isSharingNow");
    expect(provider).toContain("setSharing(Boolean(data.isSharing))");
    expect(provider).toContain("screenTrack.onended = () => { void restoreCameraAfterShare(); }");
    expect(provider).toContain("next.onended = () => { void restoreCameraAfterShare(); }");
    expect(provider).toContain("await renegotiateShare(false)");
    expect(provider).toContain("networkQuality");
    expect(provider).toContain('peer.iceConnectionState === "disconnected"');
    expect(read("app/call/[sessionId].native.tsx")).toContain("NetworkQualityBadge");
    expect(read("app/call/[sessionId].native.tsx")).toContain("Mạng mạnh");
    expect(read("app/call/[sessionId].native.tsx")).toContain("isLocalSharing={shareEnabled && call.isSharing");
    expect(read("app/call/[sessionId].native.tsx")).toContain('objectFit={isViewingSharedScreen ? "contain" : "cover"}');
  });

  it("ships caller identity and restricts new calls plus room creation to direct chat", () => {
    const router = read("server/routers.ts");
    const incoming = read("components/incoming-call-overlay.tsx");
    const inbox = read("app/(tabs)/index.tsx");
    expect(router).toContain("callerName: ctx.user.name");
    expect(router).toContain("callerAvatar: ctx.user.avatarUrl");
    expect(router).toContain("P2P chỉ hỗ trợ cuộc trò chuyện 1:1.");
    expect(router).toContain("Tạo nhóm đang được ẩn");
    expect(incoming).toContain("callerName");
    expect(inbox).toContain('room.kind === "direct"');
  });
});
