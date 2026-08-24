import "@/global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Redirect, Stack, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import type { EdgeInsets, Metrics, Rect } from "react-native-safe-area-context";
import { trpc, createTRPCClient } from "@/lib/trpc";
import { initManusRuntime, subscribeSafeAreaInsets } from "@/lib/_core/manus-runtime";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { AppLockGate } from "@/components/app-lock-gate";
import { PresenceProvider } from "@/lib/presence";
import { ThemeProvider } from "@/lib/theme-provider";
import { persistentUploadQueue } from "@/lib/persistent-upload-queue";
import { CallOverlayProvider } from "@/components/call-overlay";
import { IncomingCallOverlay } from "@/components/incoming-call-overlay";
import { ensureFirebaseIdentity } from "@/lib/firebase";
import "@/lib/_core/nativewind-pressable";

const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const DEFAULT_WEB_FRAME: Rect = { x: 0, y: 0, width: 0, height: 0 };

export const unstable_settings = { anchor: "(tabs)" };

function AuthNavigation() {
  const { loading, isAuthenticated } = useAuth();
  const segments = useSegments();
  const isLoginRoute = segments[0] === "login";

  if (loading) {
    return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F7F8FC" }}><ActivityIndicator color="#4F46E5" /></View>;
  }
  if (!isAuthenticated && !isLoginRoute) return <Redirect href="/login" />;
  if (isAuthenticated && isLoginRoute) return <Redirect href="/(tabs)" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="login" options={{ presentation: "fullScreenModal", gestureEnabled: false }} />
      <Stack.Screen name="app-lock" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="chat/[roomId]" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="room/[roomId]" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="friends" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="call/[sessionId]" options={{ animation: "fade", gestureEnabled: false }} />
      <Stack.Screen name="oauth/callback" />
    </Stack>
  );
}

export default function RootLayout() {
  const initialInsets = initialWindowMetrics?.insets ?? DEFAULT_WEB_INSETS;
  const initialFrame = initialWindowMetrics?.frame ?? DEFAULT_WEB_FRAME;
  const [insets, setInsets] = useState<EdgeInsets>(initialInsets);
  const [frame, setFrame] = useState<Rect>(initialFrame);
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } } }));
  const [trpcClient] = useState(() => createTRPCClient());

  useEffect(() => { initManusRuntime(); void persistentUploadQueue.start(); void ensureFirebaseIdentity(); }, []);
  const handleSafeAreaUpdate = useCallback((metrics: Metrics) => { setInsets(metrics.insets); setFrame(metrics.frame); }, []);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    return subscribeSafeAreaInsets(handleSafeAreaUpdate);
  }, [handleSafeAreaUpdate]);

  const providerInitialMetrics = useMemo(() => {
    const metrics = initialWindowMetrics ?? { insets: initialInsets, frame: initialFrame };
    return { ...metrics, insets: { ...metrics.insets, top: Math.max(metrics.insets.top, 16), bottom: Math.max(metrics.insets.bottom, 16) } };
  }, [initialInsets, initialFrame]);

  const content = (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider><CallOverlayProvider><AppLockGate><IncomingCallOverlay><PresenceProvider><AuthNavigation /></PresenceProvider></IncomingCallOverlay></AppLockGate></CallOverlayProvider></AuthProvider>
          <StatusBar style="auto" />
        </QueryClientProvider>
      </trpc.Provider>
    </GestureHandlerRootView>
  );

  return (
    <ThemeProvider>
      <SafeAreaProvider initialMetrics={providerInitialMetrics}>
        {Platform.OS === "web" ? <SafeAreaFrameContext.Provider value={frame}><SafeAreaInsetsContext.Provider value={insets}>{content}</SafeAreaInsetsContext.Provider></SafeAreaFrameContext.Provider> : content}
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
