import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { AppState, Platform } from "react-native";
import { createAttachmentUpload, type UploadCandidate } from "@/lib/upload";

const STORAGE_KEY = "chatpht:persistent-upload-queue:v1";

export type PersistentUploadItem = {
  id: string;
  roomId: number;
  asset: UploadCandidate;
  progress: number;
  status: "queued" | "uploading" | "failed";
  error?: string;
  createdAt: number;
};

type QueueEvent = { type: "update" | "uploaded"; roomId?: number };
type Subscriber = (items: PersistentUploadItem[], event: QueueEvent) => void;

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `upload-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function extensionOf(asset: UploadCandidate) {
  const fromName = asset.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "");
  if (fromName) return `.${fromName.toLowerCase()}`;
  return asset.mimeType.startsWith("video/") ? ".mp4" : asset.mimeType.startsWith("image/") ? ".jpg" : "";
}

class PersistentUploadQueue {
  private items: PersistentUploadItem[] = [];
  private subscribers = new Set<Subscriber>();
  private initialized = false;
  private active = new Map<string, () => void>();
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

  async start() {
    if (this.initialized) return;
    this.initialized = true;
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    this.items = raw ? (JSON.parse(raw) as PersistentUploadItem[]) : [];
    this.items = this.items.map((item) => item.status === "uploading" ? { ...item, status: "queued" as const, progress: Math.min(item.progress, 99), error: "Đang tiếp tục sau khi mở lại ứng dụng" } : item);
    await this.persist();
    this.emit({ type: "update" });
    this.appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void this.resume();
    });
    void this.process();
  }

  subscribe(subscriber: Subscriber) {
    this.subscribers.add(subscriber);
    subscriber(this.items, { type: "update" });
    return () => { this.subscribers.delete(subscriber); };
  }

  async enqueue(roomId: number, assets: UploadCandidate[]) {
    await this.start();
    const prepared = await Promise.all(assets.map((asset) => this.prepareAsset(roomId, asset)));
    this.items.push(...prepared);
    await this.persist();
    this.emit({ type: "update" });
    void this.process();
  }

  async cancel(id: string) {
    const item = this.items.find((entry) => entry.id === id);
    if (!item) return;
    this.active.get(id)?.();
    this.items = this.items.filter((entry) => entry.id !== id);
    await this.deleteLocalCopy(item.asset.uri);
    await this.persist();
    this.emit({ type: "update" });
    void this.process();
  }

  async resume() {
    await this.start();
    this.items = this.items.map((item) => item.status === "failed" ? { ...item, status: "queued" as const, error: undefined } : item);
    await this.persist();
    this.emit({ type: "update" });
    void this.process();
  }

  private async prepareAsset(roomId: number, asset: UploadCandidate): Promise<PersistentUploadItem> {
    const id = createId();
    let stableAsset = asset;
    if (Platform.OS !== "web" && FileSystem.documentDirectory) {
      const directory = `${FileSystem.documentDirectory}chatpht-uploads/`;
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
      const uri = `${directory}${id}${extensionOf(asset)}`;
      await FileSystem.copyAsync({ from: asset.uri, to: uri });
      stableAsset = { ...asset, uri };
    }
    return { id, roomId, asset: stableAsset, progress: 0, status: "queued", createdAt: Date.now() };
  }

  private async process() {
    while (this.active.size < 3) {
      const next = this.nextQueuedItem();
      if (!next) return;
      this.active.set(next.id, () => undefined);
      void this.run(next);
    }
  }

  private nextQueuedItem() {
    return this.items
      .filter((item) => item.status === "queued")
      .sort((left, right) => this.priority(left) - this.priority(right) || left.createdAt - right.createdAt)[0];
  }

  private priority(item: PersistentUploadItem) {
    if (item.asset.mimeType.startsWith("image/")) return 0;
    if (item.asset.mimeType.startsWith("video/")) return 1;
    return 2;
  }

  private async run(next: PersistentUploadItem) {
    next.status = "uploading";
    next.progress = Math.max(1, next.progress);
    await this.persist();
    this.emit({ type: "update" });
    if (!this.items.some((item) => item.id === next.id)) {
      this.active.delete(next.id);
      void this.process();
      return;
    }
    const request = createAttachmentUpload(next.roomId, next.asset, next.id, { onProgress: (progress) => {
      next.progress = Math.max(next.progress, progress);
      this.schedulePersist();
      this.emit({ type: "update" });
    } });
    this.active.set(next.id, request.cancel);
    try {
      await request.promise;
      this.items = this.items.filter((item) => item.id !== next.id);
      await this.deleteLocalCopy(next.asset.uri);
      await this.persist();
      this.emit({ type: "uploaded", roomId: next.roomId });
    } catch (error) {
      const current = this.items.find((item) => item.id === next.id);
      if (current) {
        current.status = "failed";
        current.error = error instanceof Error ? error.message : "Kết nối gián đoạn; sẽ thử lại khi ứng dụng hoạt động.";
        await this.persist();
        this.emit({ type: "update" });
      }
    } finally {
      this.active.delete(next.id);
      void this.process();
    }
  }

  private async persist() { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.items)); }
  private schedulePersist() {
    if (this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      void this.persist();
    }, 450);
  }
  private emit(event: QueueEvent) { const snapshot = [...this.items]; this.subscribers.forEach((subscriber) => subscriber(snapshot, event)); }
  private async deleteLocalCopy(uri: string) { if (Platform.OS !== "web" && uri.startsWith("file://")) await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined); }
}

export const persistentUploadQueue = new PersistentUploadQueue();
