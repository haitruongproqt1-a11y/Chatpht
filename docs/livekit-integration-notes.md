# Ghi chú tích hợp LiveKit

## Các ràng buộc đã xác minh

Ứng dụng Expo cần dùng **development build** thay vì Expo Go khi dùng LiveKit React Native, vì SDK phụ thuộc mã native. Client phải đăng ký globals, khởi tạo audio session trước khi kết nối, và dùng adaptive stream theo mật độ điểm ảnh để giảm tải video theo điều kiện hiển thị.

Token LiveKit là JWT do backend ký bằng API secret. Token phải định danh bằng mã không chứa thông tin cá nhân, giới hạn vào đúng tên phòng và chỉ cấp các quyền cần thiết: tham gia phòng, xuất bản audio/video/data, đăng ký track và cập nhật metadata khi phù hợp. Backend chatpht sẽ luôn kiểm tra người yêu cầu còn là thành viên phòng trước khi tạo token, cấp thời hạn ngắn và không bao giờ trả API secret xuống client.

Tính năng chia sẻ màn hình cần cấu hình native bổ sung. Trong iOS, một Broadcast Extension là yêu cầu để tiếp tục chia sẻ khi ứng dụng chạy nền; do đó tính năng này phải được xác nhận trên development/production build thay vì Expo Go.

## Nguồn kỹ thuật

- [Expo quickstart của LiveKit](https://docs.livekit.io/transport/sdk-platforms/expo/)
- [Access tokens & grants của LiveKit](https://docs.livekit.io/frontends/reference/tokens-grants/)
