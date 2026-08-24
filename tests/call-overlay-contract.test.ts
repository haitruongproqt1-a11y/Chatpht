import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

describe("P2P call overlay contracts", () => {
  it("hosts native P2P call state at the application overlay level", () => {
    const overlay = read("components/call-overlay.native.tsx");
    const rootLayout = read("app/_layout.tsx");
    const incoming = read("components/incoming-call-overlay.tsx");
    expect(overlay).toContain("RTCPeerConnection");
    expect(overlay).toContain("CallBubble");
    expect(overlay).toContain("PanResponder");
    expect(overlay).toContain("onMoveShouldSetPanResponder");
    expect(overlay).toContain("pip-remote-");
    expect(overlay).toContain("pip-local-");
    expect(overlay).toContain("pipLocalInset");
    expect(rootLayout).toContain("CallOverlayProvider");
    expect(incoming).toContain('socket.on("message:notify"');
    expect(incoming).toContain("showMessageNotification");
    expect(incoming).toContain("showCallNotification");
  });

  it("minimizes the active call into chat and restores it from the bubble", () => {
    const call = read("app/call/[sessionId].native.tsx");
    const overlay = read("components/call-overlay.native.tsx");
    const incoming = read("components/incoming-call-overlay.tsx");
    expect(call).toContain("call.minimize()");
    expect(call).toContain("router.replace(`/chat/${session.roomId}`");
    expect(overlay).toContain("router.push(`/call/${connection.sessionId}`");
    expect(overlay).toContain("Cửa sổ nổi cuộc gọi, chạm để mở lại");
    expect(incoming).toContain("addNotificationResponseReceivedListener");
  });
});
