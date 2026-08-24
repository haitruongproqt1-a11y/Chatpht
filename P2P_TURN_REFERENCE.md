# ChatPHT — P2P, TURN và Chia sẻ Màn hình

Tệp này tổng hợp các phần đang vận hành cho **gọi thoại, gọi video, chia sẻ màn hình và signaling P2P** trong ChatPHT. Tất cả username, credential TURN và khóa Firebase được đọc từ biến môi trường; **giá trị thực không được ghi trong tài liệu hoặc source**.

## 1. Kiến trúc hiện tại

| Thành phần | Vai trò | Tệp nguồn chính |
|---|---|---|
| WebRTC native | Tạo peer connection, media stream, ICE, mic/camera/loa | `components/call-overlay.native.tsx` |
| WebRTC web | Biến thể trình duyệt của engine P2P | `components/call-overlay.tsx` |
| Call UI native | `RTCView`, preview local, điều khiển cuộc gọi/chia sẻ | `app/call/[sessionId].native.tsx` |
| Call UI web | Biến thể web của màn hình cuộc gọi | `app/call/[sessionId].tsx` |
| Firestore | Offer/answer và ICE candidates | `lib/firebase.ts`, `firestore.rules` |
| Server | Xác thực thành viên, tạo phiên, global call invite | `server/routers.ts` |
| Expo native config | Quyền micro/camera/media projection, WebRTC plugin, TURN runtime extra | `app.config.ts` |

> **Mô hình:** server xác thực và phát lời mời. Caller/callee trao đổi SDP offer/answer cùng ICE candidates trong Firestore. Media đi trực tiếp WebRTC, dùng TURN khi đường P2P trực tiếp không kết nối được.

## 2. Luồng gọi 1:1

1. Người gọi tạo `call_sessions` qua `calls.create`; server chỉ chấp nhận `room.kind === "direct"`.
2. Server phát `call:invite` theo user socket, gồm `callerName`, `callerAvatar`, `mode` và session ID.
3. Native engine tạo `RTCPeerConnection`, lấy camera/micro bằng `getUserMedia` cho mode video; mode voice chỉ giữ audio.
4. Caller tạo offer, ghi vào `p2p_calls/{sessionId}` và thêm candidates vào `callerCandidates`.
5. Callee nhận offer, tạo answer và ghi candidates vào `calleeCandidates`.
6. Khi `ontrack` nhận track remote, ứng dụng dựng `MediaStream` mới để `RTCView` luôn dùng đúng track mới nhất.

## 3. Cấu hình ICE/TURN

Tệp engine lấy TURN primary từ Expo runtime extra, vốn do biến môi trường cấp khi build:

```ts
const p2pExtra = {
  turnUrl: process.env.TURN_URL ?? "",
  turnUsername: process.env.TURN_USERNAME ?? "",
  turnCredential: process.env.TURN_CREDENTIAL ?? "",
};
```

Các cấu hình peer được duy trì cho P2P 1:1:

```ts
{
  iceTransportPolicy: "all",
  iceCandidatePoolSize: 10,
  bundlePolicy: "max-bundle"
}
```

Danh sách ICE chỉ dùng Google STUN và OpenRelay TURN đã chọn. Không dùng fallback TURN đã hết hạn. Engine ghi telemetry loại candidate và thời gian kết nối nhưng không ghi candidate raw hay credential.

## 4. Firebase và Firestore signaling

`lib/firebase.ts` khởi tạo Firebase từ các biến public build-time sau:

```ts
EXPO_PUBLIC_FIREBASE_API_KEY
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
EXPO_PUBLIC_FIREBASE_PROJECT_ID
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
EXPO_PUBLIC_FIREBASE_APP_ID
```

Ứng dụng gọi `ensureFirebaseIdentity()` khi khởi động. Hàm này thử `signInAnonymously()` nhưng không chặn app nếu Anonymous Auth chưa bật, vì Rules hiện tại đang ở **test mode** để debug P2P.

### Rules đang dùng để kiểm thử

```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /p2p_calls/{callId} {
      allow read, write: if true;
      match /{document=**} {
        allow read, write: if true;
      }
    }
    match /p2p_signals/{docId} {
      allow read, write: if true;
    }
  }
}
```

> `firestore.production.rules` là bản nháp bảo mật. Chỉ chuyển sang bản đó sau khi call document có mapping Firebase UID của caller/callee và Anonymous Auth hoạt động thật.

## 5. Gọi video và preview camera

- Màn hình lớn hiển thị `remoteStream`.
- Ô preview nhỏ dùng `localStream.toURL()`, `mirror`, `objectFit="cover"`, lớp native nổi và `key` theo URL stream để remount khi camera stream thay đổi.
- Người dùng có thể đổi camera trước/sau; UI thay local track trong sender để người xem nhận video mới.
- Tính năng thu nhỏ trong app (PiP) giữ video remote và local inset khi quay lại chat.

## 6. Chia sẻ màn hình

1. Người chia sẻ lấy `screenStream` qua native `getDisplayMedia()`/MediaProjection.
2. Engine lấy `screenTrack` và gọi `sender.replaceTrack(screenTrack)` thay vì thêm luồng video không đồng bộ.
3. Engine tạo offer mới, cập nhật Firestore để hai phía renegotiate.
4. Phía người xem dựng lại remote `MediaStream` theo remote video track hiện hành để `RTCView` không giữ camera cũ hoặc màn hình đen.
5. Khi người dùng dừng share, hoặc MediaProjection kết thúc từ hệ thống, engine thay lại `cameraTrack`, renegotiate một lần nữa và giữ audio sender không bị gián đoạn.

Trên chính thiết bị phát, UI chỉ hiện nhãn **“Bạn đang phát”** thay vì render lại màn hình của chính mình, nhằm tránh hiệu ứng lặp vô hạn.

## 7. Quyền native và yêu cầu build lại

`app.config.ts` đã khai báo các quyền/cấu hình sau:

```ts
permissions: [
  "POST_NOTIFICATIONS",
  "CAMERA",
  "RECORD_AUDIO",
  "FOREGROUND_SERVICE",
  "FOREGROUND_SERVICE_MEDIA_PROJECTION"
]
```

Các plugin liên quan gồm `@config-plugins/react-native-webrtc` và Expo native plugins. Sau mọi thay đổi WebRTC/permission/plugin, cần **Publish và cài APK native mới**; Expo Go không chạy được `react-native-webrtc` native.

## 8. Giới hạn cần biết

| Nội dung | Trạng thái |
|---|---|
| Chat/call/share source và regression | Đã kiểm tra typecheck, contract tests |
| Gọi thoại/video P2P | Cần thử hai thiết bị native thực tế |
| Share màn hình qua Wi‑Fi/4G | Cần thử hai thiết bị native thực tế |
| Kết nối relay, độ trễ và độ mượt | Phụ thuộc mạng/NAT/OpenRelay, không thể cam kết cố định |
| Rules Firestore test mode | Chỉ dùng tạm thời để debug, không phải cấu hình production |

## 9. Tệp nguồn đầy đủ

Đọc code triển khai đầy đủ tại các tệp sau trong project:

```text
components/call-overlay.native.tsx
components/call-overlay.tsx
app/call/[sessionId].native.tsx
app/call/[sessionId].tsx
components/incoming-call-overlay.tsx
lib/firebase.ts
app.config.ts
firestore.rules
firestore.production.rules
server/routers.ts
```
