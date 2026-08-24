import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const APP_LOCK_PIN_KEY = "chatpht.app-lock.pin";

function webStorage() {
  return typeof window === "undefined" ? null : window.localStorage;
}

export async function getAppLockPin() {
  if (Platform.OS === "web") return webStorage()?.getItem(APP_LOCK_PIN_KEY) ?? null;
  return SecureStore.getItemAsync(APP_LOCK_PIN_KEY);
}

export async function setAppLockPin(pin: string) {
  if (!/^\d{4,8}$/.test(pin)) throw new Error("Khóa ứng dụng cần gồm 4 đến 8 chữ số.");
  if (Platform.OS === "web") {
    webStorage()?.setItem(APP_LOCK_PIN_KEY, pin);
    return;
  }
  await SecureStore.setItemAsync(APP_LOCK_PIN_KEY, pin);
}

export async function clearAppLockPin() {
  if (Platform.OS === "web") {
    webStorage()?.removeItem(APP_LOCK_PIN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(APP_LOCK_PIN_KEY);
}
