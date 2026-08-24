# Gói bàn giao ChatPHT

Thư mục `HANDOVER/` là **bản đồ theo tính năng**. Source đầy đủ được đặt trong thư mục `source/` của archive bàn giao, giữ nguyên cây thư mục để có thể dùng lại cho ứng dụng mới.

| Tài liệu | Nhóm chức năng | Source chính |
|---|---|---|
| `01-auth-profile.md` | Đăng ký, đăng nhập, PIN, hồ sơ | `app/login.tsx`, `hooks/use-auth.ts`, `server/local-auth.ts` |
| `02-chat-realtime.md` | Chat 1:1, keyboard, sticker, đọc/đã gửi | `app/chat/[roomId].tsx`, `server/routers.ts` |
| `03-media-upload.md` | Ảnh, video, camera, hàng đợi upload | `components/attachment-sheet.tsx`, `lib/persistent-upload-queue.ts` |
| `04-call-p2p.md` | Thoại, video, P2P/TURN, share, PiP | `components/call-overlay.native.tsx`, `app/call/` |
| `05-notifications.md` | Notification local, call invite, tin chưa đọc | `lib/local-notifications.ts`, `components/incoming-call-overlay.tsx` |
| `06-social-admin.md` | Bạn bè, online, admin | `app/friends.tsx`, `app/(tabs)/admin.tsx` |
| `07-data-config.md` | Schema, migration, Firebase Rules, Expo config | `drizzle/`, `firestore*.rules`, `app.config.ts` |
| `08-tests-runbook.md` | Regression và hướng dẫn build/test | `tests/`, `package.json` |

> **Không sao chép file `.env`, access token, TURN credential hoặc khóa Cloudinary/Firebase bí mật.** Bản source chỉ giữ tên biến môi trường để bạn cấu hình lại an toàn cho app mới.

## Cách sử dụng archive

1. Giải nén archive.
2. Đọc các file `HANDOVER/*.md` trước để biết từng mô-đun.
3. Dùng `source/` làm nguyên mẫu; giữ nguyên đường dẫn import trước khi đổi tên/di chuyển tệp.
4. Tạo `.env` riêng và điền cấu hình hạ tầng của app mới.
5. Chạy `pnpm install`, `pnpm check`, `pnpm test`; chỉ sau đó mới build APK native.

## Giới hạn đã biết

WebRTC, MediaProjection, notification native và background behavior phải thử bằng APK trên thiết bị thật. Không thể đánh giá kết nối 4G/4G, relay hoặc chia sẻ màn hình bằng Expo Go hay sandbox.
