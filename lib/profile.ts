import { getApiBaseUrl } from "@/constants/oauth";
import { getSessionToken } from "@/lib/_core/auth";

export async function uploadAvatar(uri: string, name: string, mimeType: string) {
  const form = new FormData();
  form.append("file", { uri, name, type: mimeType || "image/jpeg" } as any);
  const sessionToken = await getSessionToken();
  const response = await fetch(`${getApiBaseUrl()}/api/profile/avatar`, {
    method: "POST",
    body: form,
    credentials: "include",
    headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : undefined,
  });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? "Không thể tải ảnh đại diện");
  return response.json() as Promise<{ user: { avatarUrl: string | null } }>;
}
