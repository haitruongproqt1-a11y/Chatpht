import { getApiBaseUrl } from "@/constants/oauth";
import { getSessionToken } from "@/lib/_core/auth";

export type UploadCandidate = { uri: string; name: string; mimeType: string };
export type AttachmentUpload = { promise: Promise<{ message: unknown }>; cancel: () => void };

export function createAttachmentUpload(
  roomId: number,
  asset: UploadCandidate,
  clientMessageId: string,
  options: { onProgress?: (percent: number) => void } = {},
): AttachmentUpload {
  const xhr = new XMLHttpRequest();
  const promise = (async () => {
    const form = new FormData();
    form.append("roomId", String(roomId));
    form.append("clientMessageId", clientMessageId);
    form.append("file", { uri: asset.uri, name: asset.name, type: asset.mimeType } as any);
    const sessionToken = await getSessionToken();

    return new Promise<{ message: unknown }>((resolve, reject) => {
      xhr.open("POST", `${getApiBaseUrl()}/api/uploads`);
      xhr.withCredentials = true;
      if (sessionToken) xhr.setRequestHeader("Authorization", `Bearer ${sessionToken}`);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) options.onProgress?.(Math.max(1, Math.min(99, Math.round((event.loaded / event.total) * 100))));
      };
      xhr.onerror = () => reject(new Error("Kết nối tải tệp đã bị gián đoạn"));
      xhr.onabort = () => reject(new Error("Đã hủy gửi tệp"));
      xhr.onload = () => {
        let payload: { message?: unknown; error?: string } | null = null;
        try { payload = xhr.responseText ? JSON.parse(xhr.responseText) : null; } catch { /* response fallback below */ }
        if (xhr.status >= 200 && xhr.status < 300) resolve({ message: payload?.message });
        else reject(new Error(payload?.error ?? "Không thể gửi tệp"));
      };
      xhr.send(form);
    });
  })();
  return { promise, cancel: () => xhr.abort() };
}
