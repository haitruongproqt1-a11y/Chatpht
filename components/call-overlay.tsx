import type { ReactNode } from "react";

export type CallMode = "voice" | "video" | "share";
export type ActiveCallConnection = { sessionId: number; roomId: number; mode: CallMode; creatorId: number };
export function CallOverlayProvider({ children }: { children: ReactNode }) { return children; }
export function useCallOverlay() { return { connection: null as ActiveCallConnection | null, minimized: false, localStream: null as { toURL: () => string } | null, remoteStream: null as { toURL: () => string } | null, isMicrophoneEnabled: true, isCameraEnabled: false, isSharing: false, speakerEnabled: true, networkQuality: "connecting" as const, error: null as string | null, activate: (_connection: ActiveCallConnection) => undefined, minimize: () => undefined, restore: () => undefined, clear: () => undefined, toggleMicrophone: () => undefined, toggleCamera: async () => undefined, switchCamera: async () => undefined, toggleSpeaker: () => undefined, toggleScreenShare: async () => undefined }; }
