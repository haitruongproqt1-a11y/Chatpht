# 08 — Regression, build và checklist kiểm thử

| Lệnh | Mục đích |
|---|---|
| `pnpm install` | Cài dependency đúng lockfile |
| `pnpm check` | TypeScript typecheck |
| `pnpm test` | Regression contracts và logic server/client |
| `pnpm run dev` | Khởi động Metro + backend local |

Thư mục `tests/` bao phủ auth local, admin, chat, composer/keyboard, P2P ICE/TURN, call overlay, screen share, media và credentials contract. Các tests contract không thay thế kiểm thử native trên hai máy.

## Checklist native bắt buộc

1. Cài APK build mới, không dùng Expo Go cho WebRTC native.
2. Thử đăng nhập, chat và gửi nhiều tin liên tiếp; chạm composer nhiều lần.
3. Thử gọi voice/video hai tài khoản và đổi camera trước/sau.
4. Thử share qua Wi-Fi rồi 4G; stop từ nút app và từ system projection.
5. Thử PiP trong app và notification local khi app chạy nền.

Nếu đổi bất kỳ plugin/quyền native nào trong `app.config.ts`, phải Publish/build lại APK trước khi đánh giá.
