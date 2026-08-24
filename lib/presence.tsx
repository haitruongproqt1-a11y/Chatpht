import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import { io } from "socket.io-client";
import { getApiBaseUrl } from "@/constants/oauth";
import { getSessionToken } from "@/lib/_core/auth";
import { useAuth } from "@/hooks/use-auth";

const PresenceContext = createContext<Set<number>>(new Set());

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [online, setOnline] = useState<Set<number>>(new Set());
  useEffect(() => {
    if (!isAuthenticated || !user) { setOnline(new Set()); return; }
    let mounted = true;
    let socket: ReturnType<typeof io> | null = null;
    const connect = async () => {
      const token = await getSessionToken();
      if (!mounted) return;
      socket = io(getApiBaseUrl(), { path: "/api/socket.io", withCredentials: true, transports: ["websocket", "polling"], extraHeaders: token && Platform.OS !== "web" ? { Authorization: `Bearer ${token}` } : undefined });
      socket.on("presence:snapshot", (userIds: number[]) => setOnline(new Set(userIds)));
      socket.on("presence:online", ({ userId }: { userId: number }) => setOnline((current) => new Set([...current, userId])));
      socket.on("presence:offline", ({ userId }: { userId: number }) => setOnline((current) => { const next = new Set(current); next.delete(userId); return next; }));
    };
    connect();
    return () => { mounted = false; socket?.disconnect(); };
  }, [isAuthenticated, user?.id]);
  const value = useMemo(() => online, [online]);
  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
}

export function usePresence() { return useContext(PresenceContext); }
