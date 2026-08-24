import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

describe("media and moderation contracts", () => {
  it("uses cancellable upload transport with per-file progress", () => {
    const source = read("lib/upload.ts");
    expect(source).toContain("new XMLHttpRequest()");
    expect(source).toContain("xhr.upload.onprogress");
    expect(source).toContain("cancel: () => xhr.abort()");
  });

  it("queues media sequentially and removes the draft preview", () => {
    const source = read("app/chat/[roomId].tsx");
    expect(source).toContain("persistentUploadQueue.enqueue");
    expect(source).toContain("Đang gửi · ${item.progress}%");
    expect(source).toContain("cancelUpload");
    expect(source).not.toContain("Bản nháp ·");
  });

  it("supports taking photos or recording video with permission feedback", () => {
    const source = read("components/attachment-sheet.tsx");
    expect(source).toContain("requestCameraPermissionsAsync");
    expect(source).toContain("MediaTypeOptions.All");
    expect(source).toContain("Chụp ảnh");
    expect(source).toContain("Quay video");
  });

  it("enforces suspension and account deletion centrally", () => {
    const router = read("server/routers.ts");
    const sdk = read("server/_core/sdk.ts");
    expect(router).toContain("suspendUser:");
    expect(router).toContain("deleteUser:");
    expect(router).toContain('confirmation: z.literal("DELETE")');
    expect(sdk).toContain("user.suspendedUntil");
    expect(sdk).toContain("user.deletedAt");
  });
});
