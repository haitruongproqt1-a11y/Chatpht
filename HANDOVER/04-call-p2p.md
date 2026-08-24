# 04 — Gọi thoại, video, P2P/TURN, screen share và PiP

| Chức năng | Source chính | Ghi chú |
|---|---|---|
| P2P native engine | `components/call-overlay.native.tsx` | RTCPeerConnection, ICE, camera/mic/loa, offer/answer, replaceTrack |
| P2P web engine | `components/call-overlay.tsx` | Biến thể browser |
| Call screen native | `app/call/[sessionId].native.tsx` | RTCView, preview local kéo được, controls, network badge |
| Call screen web | `app/call/[sessionId].tsx` | Giao diện browser |
| Incoming invite | `components/incoming-call-overlay.tsx` | Avatar/tên caller, nhận/từ chối, local notification |
| Server call API | `server/routers.ts`, `server/db.ts` | Chỉ direct room, session P2P, global invite |
| Firebase signaling | `lib/firebase.ts`, `firestore.rules` | `p2p_calls`, offer/answer, ICE candidates |

P2P gọi 1:1 là kiến trúc hiện tại. Không thêm group call/share. TURN/Firestore config được tách bằng env; xem thêm `P2P_TURN_REFERENCE.md`.

Screen share dùng MediaProjection/getDisplayMedia rồi `sender.replaceTrack(screenTrack)`. Khi dừng phát hoặc hệ thống kết thúc projection, app thay lại camera track và renegotiate; audio sender được giữ nguyên.

PiP hiện là **cửa sổ nổi trong ứng dụng**, không phải Android system PiP độc lập bên ngoài app. Native production build là bắt buộc cho WebRTC/MediaProjection.
