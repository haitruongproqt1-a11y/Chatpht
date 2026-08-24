# 03 — Ảnh, video, camera và upload bền vững

| Tính năng | Source chính | Tác dụng |
|---|---|---|
| Chọn/chụp media | `components/attachment-sheet.tsx` | Chọn ảnh/video/tệp, chụp ảnh và quay video giới hạn |
| Upload queue | `lib/persistent-upload-queue.ts` | Lưu queue, tiếp tục khi app active/mở lại, hủy từng tệp |
| Upload client | `lib/upload.ts` | Tiến độ, ưu tiên ảnh trước video |
| Upload server | `server/uploads.ts`, `server/storage.ts` | Xác minh file và gửi Cloudinary/storage |
| Avatar | `lib/profile.ts`, `server/routers.ts` | Cập nhật ảnh đại diện đã xác thực |

Thiết kế dùng hàng đợi **A**: metadata/URI được lưu để tiếp tục upload khi ứng dụng mở lại. Hệ điều hành có thể dừng network khi app bị force-close; đây không phải background upload native chuyên dụng.

Đặt lại biến môi trường Cloudinary trong app mới, không sao chép secret từ bản cũ.
