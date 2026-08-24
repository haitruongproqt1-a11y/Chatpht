# 06 — Bạn bè, presence và quản trị

| Nhóm | Source chính | Chức năng |
|---|---|---|
| Tìm/kết bạn | `app/friends.tsx`, `server/routers.ts` | Tìm theo username/ID, gửi/chấp nhận lời mời |
| Online/offline | `lib/presence.tsx`, `server/realtime.ts` | Presence dựa trên socket user |
| Admin dashboard | `app/(tabs)/admin.tsx`, `server/routers.ts` | Hiển thị số liệu, quản lý người dùng theo role |
| Suspend/delete | `server/db.ts`, `server/routers.ts` | Chặn có thời hạn và xóa mềm; enforcement ở auth |

Tab Admin chỉ xuất hiện với role `admin`. Đừng chỉ ẩn UI khi tái sử dụng; giữ kiểm tra `adminProcedure` phía server.
