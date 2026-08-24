import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, type User } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseReady = Boolean(config.apiKey && config.projectId && config.appId);
export const firebaseApp = firebaseReady ? (getApps().length ? getApp() : initializeApp(config)) : null;
export const firestore = firebaseApp ? getFirestore(firebaseApp) : null;
export const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null;

let anonymousSignIn: Promise<User | null> | null = null;

/**
 * Uses Firebase Anonymous Auth when the provider is enabled. A failure is non-fatal
 * while the project deliberately runs Firestore's temporary test rules; production
 * rules must require this identity and store Firebase UIDs in call documents.
 */
export function ensureFirebaseIdentity() {
  if (!firebaseAuth) return Promise.resolve(null);
  if (firebaseAuth.currentUser) return Promise.resolve(firebaseAuth.currentUser);
  if (!anonymousSignIn) {
    anonymousSignIn = signInAnonymously(firebaseAuth)
      .then((credential) => credential.user)
      .catch((error) => {
        const code = typeof error === "object" && error && "code" in error ? String((error as { code: unknown }).code) : "unknown";
        console.warn("[P2P] Firebase Anonymous Auth chưa sẵn sàng; dùng rules test tạm thời.", code);
        return null;
      });
  }
  return anonymousSignIn;
}
