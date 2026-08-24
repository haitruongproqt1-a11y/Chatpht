# 01 — Xác thực, hồ sơ và khóa ứng dụng

| Chức năng | Mục đích | Tệp liên quan |
|---|---|---|
| Đăng ký/đăng nhập local | Tài khoản bằng username + password | `app/login.tsx`, `hooks/use-auth.ts`, `server/routers.ts`, `server/local-auth.ts` |
| Session | Lưu/tái sử dụng token cục bộ | `lib/_core/auth.ts`, `lib/trpc.ts` |
| Chống treo login | Timeout form và DB pool fail-fast | `app/login.tsx`, `server/db.ts` |
| PIN ứng dụng | Khóa khi mở lại app, không khóa khi app nền | `app/app-lock.tsx`, `components/app-lock-gate.tsx`, `lib/app-lock.ts` |
| Hồ sơ/avatar | Cập nhật avatar xác thực qua server | `lib/profile.ts`, `server/routers.ts`, `server/uploads.ts` |

Luồng local auth tạo user trong `users`, dữ liệu username/password hash trong `local_credentials`, rồi phát session token. Không đưa password/hash sang client.

Khi tái sử dụng, giữ nguyên `AuthProvider` trong `app/_layout.tsx`; tất cả route cần đăng nhập dựa vào `AuthNavigation`.
