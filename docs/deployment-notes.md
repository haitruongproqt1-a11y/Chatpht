# Triển khai chatpht: giới hạn và cấu hình vận hành

## Phạm vi gói triển khai

`Dockerfile` đóng gói API Node/Express, Socket.IO, upload Cloudinary và cấp token LiveKit trên cổng `10000`. `render.yaml` đặt `/health` làm health check, đồng thời bắt buộc khai báo bí mật qua dashboard thay vì ghi vào mã nguồn. Ứng dụng Expo vẫn được phân phối qua build native; Dockerfile không thay thế development/production build của iOS hoặc Android.

| Yêu cầu | Trạng thái trong mã | Ghi chú vận hành |
|---|---|---|
| `GET /health` trả `{ "status": "ok" }` | Đã có | Trả HTTP 200 từ Express. |
| Cổng sản xuất `10000` | Đã có | Docker đặt `PORT=10000`; môi trường quản lý có thể ghi đè qua biến môi trường. |
| Cloudinary | Đã có | Tệp được upload lên Cloudinary; metadata nằm trong database. |
| LiveKit | Đã có | Token TTL 10 phút chỉ cấp sau kiểm tra thành viên phòng. |
| Socket.IO | Đã có | Cần môi trường hỗ trợ WebSocket; tác vụ realtime dùng persistent instance thì ổn định hơn instance autoscale. |
| Coturn tự quản | Không nằm trong Docker một dịch vụ | Coturn đòi hỏi UDP/TCP ports và tiến trình riêng; dùng TURN của LiveKit Cloud hoặc triển khai tách biệt. |

## Điều kiện uptime cần biết

> Render ghi rõ Free web service sẽ spin down sau 15 phút không có HTTP hoặc WebSocket inbound; lần truy cập sau có thể mất khoảng một phút để khởi động. [1]

Do đó, không thể cam kết một **link miễn phí, vĩnh viễn, không cold start** chỉ bằng Render Free hoặc một môi trường phát triển miễn phí. Một health-check mỗi 5 phút có thể tạo traffic định kỳ, nhưng không xóa giới hạn quota, chính sách nhà cung cấp hay sự cố ngoài kiểm soát. Render cũng nêu rõ filesystem của dịch vụ Free là ephemeral, vì vậy chatpht không lưu tệp local mà dùng Cloudinary và database. [1]

## Thiết lập health-check 5 phút sau khi có URL triển khai

Trên cron-job.org, tạo HTTP job `GET` tới `https://<ten-mien-cua-ban>/health`, chọn lịch cron `*/5 * * * *`, giữ timeout ngắn và bật thông báo lỗi. cron-job.org hỗ trợ chạy URL theo lịch; tài liệu FAQ nêu rằng một job có thể chạy tối đa 60 lần mỗi giờ, nên chu kỳ 5 phút nằm trong giới hạn này. [2]

Việc tạo job thực tế cần tài khoản của bạn và URL public sau xuất bản, nên không được tự động cấu hình trong lúc phát triển.

## Kiểm tra sau triển khai

Xác nhận `GET /health` trả `200` và JSON đúng cấu trúc. Sau đó, kiểm tra upload một ảnh, phát hành token LiveKit với hai tài khoản thành viên, và gọi thử trong native development build thay vì Expo Go. LiveKit yêu cầu development build do SDK có mã native; token được ký từ API secret và không nên xuất hiện ở client. [3] [4]

## Tài liệu tham khảo

[1] [Render — Deploy for Free](https://render.com/docs/free)

[2] [cron-job.org — FAQ](https://cron-job.org/en/faq/)

[3] [LiveKit — Expo quickstart](https://docs.livekit.io/transport/sdk-platforms/expo/)

[4] [LiveKit — Access tokens & grants](https://docs.livekit.io/frontends/reference/tokens-grants/)
