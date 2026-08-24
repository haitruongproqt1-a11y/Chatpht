export type AttachmentKind = "image" | "video" | "file";

export function classifyAttachment(mimeType: string): AttachmentKind {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  return "file";
}

export function limitCallTiles<T>(participants: T[]): T[] {
  return participants.slice(0, 8);
}
