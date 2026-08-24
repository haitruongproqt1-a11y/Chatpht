export type P2PFailureCode =
  | "P2P_SIGNALING"
  | "P2P_NETWORK"
  | "P2P_ICE"
  | "P2P_TURN"
  | "P2P_MEDIA_PERMISSION"
  | "P2P_SCREEN_CAPTURE"
  | "P2P_SETUP";

export type P2PFailure = {
  code: P2PFailureCode;
  title: string;
  message: string;
  advice: string;
};

const failures: Record<P2PFailureCode, Omit<P2PFailure, "code">> = {
  P2P_SIGNALING: {
    title: "Không thể đồng bộ cuộc gọi",
    message: "Hai thiết bị chưa trao đổi được thông tin kết nối qua signaling.",
    advice: "Kiểm tra mạng, chờ vài giây rồi nhấn Thử lại. Nếu vẫn lặp lại, người gọi hãy tạo cuộc gọi mới.",
  },
  P2P_NETWORK: {
    title: "Mạng không sẵn sàng",
    message: "Ứng dụng không thể liên lạc với dịch vụ cần thiết để thiết lập cuộc gọi.",
    advice: "Bật lại Wi‑Fi hoặc dữ liệu di động, tắt VPN nếu có, rồi nhấn Thử lại.",
  },
  P2P_ICE: {
    title: "Không tạo được đường kết nối P2P",
    message: "ICE không tìm được đường truyền giữa hai thiết bị.",
    advice: "Đổi giữa Wi‑Fi và 4G/5G rồi thử lại. Nếu hai máy ở hai mạng khác nhau, TURN cần hoạt động ổn định.",
  },
  P2P_TURN: {
    title: "Máy chủ chuyển tiếp không phản hồi",
    message: "Kết nối trực tiếp không thành công và TURN không thể hỗ trợ chuyển tiếp dữ liệu.",
    advice: "Kiểm tra cấu hình TURN của bản build hoặc thử lại bằng một mạng khác.",
  },
  P2P_MEDIA_PERMISSION: {
    title: "Chưa được cấp quyền micro hoặc camera",
    message: "Thiết bị đã chặn quyền cần thiết để bắt đầu cuộc gọi.",
    advice: "Vào Cài đặt Android > Ứng dụng > ChatPHT > Quyền, bật Micro và Camera rồi nhấn Thử lại.",
  },
  P2P_SCREEN_CAPTURE: {
    title: "Không thể bắt đầu chia sẻ màn hình",
    message: "Hệ thống không cấp được luồng nội dung màn hình cho cuộc gọi.",
    advice: "Cho phép hộp thoại chia sẻ màn hình của Android và thử lại. Camera vẫn có thể dùng cho cuộc gọi video.",
  },
  P2P_SETUP: {
    title: "Không thể thiết lập cuộc gọi P2P",
    message: "Cuộc gọi dừng trong lúc khởi tạo kết nối.",
    advice: "Nhấn Thử lại. Nếu vẫn lỗi, kết thúc cuộc gọi và tạo một cuộc gọi mới sau khi kiểm tra mạng.",
  },
};

export function p2pFailure(code: P2PFailureCode): P2PFailure {
  return { code, ...failures[code] };
}

export function toP2PFailure(cause: unknown): P2PFailure {
  const message = cause instanceof Error ? cause.message : String(cause ?? "");
  const value = message.toLowerCase();
  if (value.includes("permission") || value.includes("notallowed") || value.includes("camera") || value.includes("micro")) return p2pFailure("P2P_MEDIA_PERMISSION");
  if (value.includes("display") || value.includes("screen") || value.includes("màn hình")) return p2pFailure("P2P_SCREEN_CAPTURE");
  if (value.includes("turn")) return p2pFailure("P2P_TURN");
  if (value.includes("ice")) return p2pFailure("P2P_ICE");
  if (value.includes("network") || value.includes("offline") || value.includes("fetch")) return p2pFailure("P2P_NETWORK");
  if (value.includes("firebase") || value.includes("firestore") || value.includes("signaling") || value.includes("offer") || value.includes("answer") || value.includes("lời mời")) return p2pFailure("P2P_SIGNALING");
  return p2pFailure("P2P_SETUP");
}
