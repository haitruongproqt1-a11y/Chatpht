# 02 — Chat 1:1, realtime và trải nghiệm composer

| Thành phần | Source | Ghi chú thay thế |
|---|---|---|
| Danh sách hội thoại | `app/(tabs)/index.tsx` | Lọc room direct, tên hiển thị theo thành viên đối diện |
| Màn hình chat | `app/chat/[roomId].tsx` | FlatList, composer memo, sticker/đính kèm, receipts |
| Tạo room direct | `app/room/new.tsx`, `server/routers.ts` | Chỉ tạo 1:1, không xóa group cũ |
| Router chat | `server/routers.ts` | `sendMessage`, `sendSticker`, receipts và bảo vệ membership |
| Socket realtime | `server/realtime.ts`, `server/_core/index.ts` | `message:new`, receipt, event riêng người dùng |
| Kiểu/util | `shared/chat-utils.ts`, `shared/types.ts` | Phân loại attachment và type dùng chung |

Composer giữ `draftRef` riêng với UI state; draft chỉ bị xóa khi mutation gửi thành công. Keyboard native không bị dismiss khi chạm danh sách hoặc sau callback sticker/đính kèm.

Khi tái sử dụng, giữ `clientMessageId` để server chống gửi trùng bằng unique key trong bảng `messages`.
