# 07 — Database, cấu hình và runtime

| Phần | Source | Cách dùng |
|---|---|---|
| Schema Drizzle | `drizzle/schema.ts` | Bảng users, credentials, room, message, receipts, calls |
| Migrations | `drizzle/*.sql`, `drizzle/meta/` | Lịch sử cấu trúc DB; không chạy lại migration đã apply mù quáng |
| DB access | `server/db.ts` | Pool và truy vấn nghiệp vụ |
| Router/server | `server/routers.ts`, `server/_core/` | tRPC, Socket.IO, session, health |
| Expo config | `app.config.ts` | Bundle ID, quyền native, WebRTC, notifications, TURN extra |
| Firebase Rules | `firestore.rules`, `firestore.production.rules` | Test rules đang active và draft production |
| Theme/navigation | `theme.config.js`, `app/_layout.tsx`, `app/(tabs)/_layout.tsx` | Màu và điều hướng |

### Biến môi trường cần cấu hình lại

```text
DATABASE_URL
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
TURN_URL
TURN_USERNAME
TURN_CREDENTIAL
EXPO_PUBLIC_FIREBASE_API_KEY
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
EXPO_PUBLIC_FIREBASE_PROJECT_ID
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
EXPO_PUBLIC_FIREBASE_APP_ID
```

Không đưa giá trị của các biến này vào Git, archive công khai hoặc file client không cần thiết.
