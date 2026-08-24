# Phát hiện chuyển LiveKit sang P2P Firestore

Tài liệu WebRTC chính thức xác nhận Cloud Firestore chỉ giữ signaling cho phòng 1:1: offer của caller, answer của callee và hai collection ICE candidates. Hai máy vẫn thiết lập `RTCPeerConnection` trực tiếp và cần listener cho candidate mới để `addIceCandidate`.

Tài liệu `react-native-webrtc` xác nhận API native gồm `RTCPeerConnection`, `RTCIceCandidate`, `RTCSessionDescription`, `MediaStream` và `navigator.mediaDevices.getDisplayMedia`. Dự án cần thay native WebRTC dependency của LiveKit bằng thư viện này và build development/production mới.

Kiểm kê ngày 2026-08-23: source có nhiều dependency/file LiveKit; package hiện chưa có Firebase SDK hoặc `react-native-webrtc` thuần. Connector config không có Firebase. Không được gỡ LiveKit cho đến khi có Firebase project/config, Firestore rules và TURN strategy được cung cấp/kiểm tra.

Nguồn: https://webrtc.org/getting-started/firebase-rtc-codelab và https://github.com/react-native-webrtc/react-native-webrtc/blob/master/Documentation/BasicUsage.md
