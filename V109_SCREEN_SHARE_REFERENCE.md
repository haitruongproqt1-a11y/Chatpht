# ChatPHT 1.0.9 — Chia sẻ màn hình (bản lịch sử LiveKit)

## Revision nguồn

Gói này được trích xuất từ checkpoint **`cec80928`**, là revision LiveKit ngay trước đợt chuyển sang P2P thuần. Đây là bản được đối chiếu với mô tả "1.0.9 LiveKit chạy được" trong lịch sử yêu cầu.

> Đây là **source tham khảo lịch sử**, không thay thế engine P2P đang chạy ở bản hiện tại và không được áp trực tiếp lên project mới mà chưa đối chiếu dependency/biến môi trường.

## Nội dung archive

| Tệp | Vai trò trong 1.0.9 |
|---|---|
| `components/call-overlay.native.tsx` | Provider LiveKit native, publish camera/audio/screen share, speaker và incoming invite |
| `components/call-overlay.tsx` | Biến thể call provider cho web |
| `app/call/[sessionId].native.tsx` | UI cuộc gọi native, RTC/video view, nút chia sẻ và preview |
| `app/call/[sessionId].tsx` | UI cuộc gọi web |
| `components/incoming-call-overlay.tsx` | Modal nhận/từ chối call toàn ứng dụng |
| `server/routers.ts` | API tạo/nhận/kết thúc call và quyền room |
| `server/db.ts` | Lưu call session/participant |
| `drizzle/schema.ts` | Schema call session ở revision đó |
| `drizzle/0010_perpetual_fixer.sql` | Migration mode call/share của 1.0.9 |
| `app.config.ts` | Permission camera/micro/media projection và plugin native |
| `package.json` | Dependency LiveKit/WebRTC của revision lịch sử |
| `tests/*call*`, `tests/screen-share-contract.test.ts` | Regression contract liên quan call/share |

## Luồng chia sẻ màn hình 1.0.9

1. Người dùng tạo phiên mode `share` từ hội thoại direct.
2. App native xin quyền MediaProjection và lấy display track.
3. Provider LiveKit publish screen-share track vào room, giữ audio route và state phiên gọi.
4. Người nhận tham gia cùng room, subscribe track và render video chia sẻ.
5. Khi dừng chia sẻ, track bị unpublish/dừng; session vẫn được quản lý qua server/Socket.IO.

## Bảo mật và cấu hình

Archive không có `.env`, private key, API secret, TURN credential hoặc token LiveKit thực. Khi dùng source này làm tài liệu/tham khảo, cấu hình lại biến môi trường theo hạ tầng mới. Bản hiện tại đã **gỡ LiveKit** và dùng P2P WebRTC + Firestore signaling, do đó không trộn trực tiếp hai kiến trúc.
