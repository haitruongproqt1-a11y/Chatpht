import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { SESSION_TOKEN_KEY, USER_INFO_KEY } from "@/constants/oauth";

export type User = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  loginMethod: string | null;
  role: "user" | "admin";
  lastSignedIn: Date | string;
};

function getWebStorage() {
  return typeof window === "undefined" ? null : window.localStorage;
}

export async function getSessionToken(): Promise<string | null> {
  try {
    if (Platform.OS === "web") return getWebStorage()?.getItem(SESSION_TOKEN_KEY) ?? null;
    return await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setSessionToken(token: string): Promise<void> {
  if (Platform.OS === "web") {
    getWebStorage()?.setItem(SESSION_TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
}

export async function removeSessionToken(): Promise<void> {
  try {
    if (Platform.OS === "web") {
      getWebStorage()?.removeItem(SESSION_TOKEN_KEY);
      return;
    }
    await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
  } catch {
    // Clearing local state remains best-effort so a failed cleanup never blocks logout.
  }
}

export async function getUserInfo(): Promise<User | null> {
  try {
    const serialized = Platform.OS === "web"
      ? getWebStorage()?.getItem(USER_INFO_KEY) ?? null
      : await SecureStore.getItemAsync(USER_INFO_KEY);
    return serialized ? (JSON.parse(serialized) as User) : null;
  } catch {
    return null;
  }
}

export async function setUserInfo(user: User): Promise<void> {
  const serialized = JSON.stringify(user);
  if (Platform.OS === "web") {
    getWebStorage()?.setItem(USER_INFO_KEY, serialized);
    return;
  }
  await SecureStore.setItemAsync(USER_INFO_KEY, serialized);
}

export async function clearUserInfo(): Promise<void> {
  try {
    if (Platform.OS === "web") {
      getWebStorage()?.removeItem(USER_INFO_KEY);
      return;
    }
    await SecureStore.deleteItemAsync(USER_INFO_KEY);
  } catch {
    // Clearing local state remains best-effort so a failed cleanup never blocks logout.
  }
}
