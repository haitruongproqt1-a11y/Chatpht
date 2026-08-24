# 05 — Thông báo local và điều hướng

| Tính năng | Source | Chi tiết |
|---|---|---|
| Khởi tạo channel/quyền | `lib/local-notifications.ts` | Kênh Android cho tin nhắn và call, xin quyền POST_NOTIFICATIONS |
| Lời mời gọi | `components/incoming-call-overlay.tsx` | Modal full-screen trong app + notification local tên caller |
| Tin nhắn chưa đọc | `server/routers.ts`, `components/incoming-call-overlay.tsx` | Server gửi `message:notify` theo user; app không thông báo nếu đang ở đúng room |
| Mở đúng nơi | `components/incoming-call-overlay.tsx` | Chạm notification deep-link tới `/chat/[roomId]` hoặc `/call/[sessionId]` |
| Native build config | `app.config.ts` | Plugin `expo-notifications` và default channel |

Phạm vi hiện tại là **local notification khi app mở/chạy nền**. Không có Expo/FCM/APNs push khi app bị hệ điều hành đóng hẳn, vì phạm vi đó đã được bỏ theo yêu cầu.

Khi muốn bổ sung push về sau, cần Expo/EAS Project ID và cấu hình FCM/APNs trong dịch vụ build; không hard-code token hoặc secret vào client.
