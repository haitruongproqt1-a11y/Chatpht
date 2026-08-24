# Đánh giá quota và xóa FIFO

## Sự kiện cần xác nhận

Ứng dụng hiện lưu media trên Cloudinary. Quota hiển thị 200 GB chỉ có thể là quota thực khi tài khoản lưu trữ đã được cấp dung lượng vật lý tương ứng. Theo trang giá chính thức của Cloudinary, gói miễn phí có 25 credit/tháng và 1 credit tương đương 1 GB managed storage; credit này còn được dùng chung với băng thông và xử lý media. Vì vậy, gói miễn phí không thể bảo đảm 200 GB storage thực.

Cloudinary hỗ trợ xóa asset có chữ ký từ máy chủ. Việc xóa là vĩnh viễn trong cloud storage; các bản CDN đã cache có thể tồn tại ngắn hạn nếu chưa được invalidate. FIFO phải lưu public ID, loại resource, dung lượng byte và ngày tạo chính xác cho mỗi upload để chỉ xóa asset ứng dụng sở hữu.

## Phương án đang chờ người dùng xác nhận

| Phương án | Dung lượng thực | Tác động |
| --- | --- | --- |
| Giữ Cloudinary hiện tại | Theo quota Cloudinary thực tế, không bảo đảm 200 GB | Có thể xây toàn bộ accounting/FIFO nhưng không được công bố 200 GB vật lý. |
| Dùng gói Cloudinary hoặc object storage có tối thiểu 200 GB | 200 GB trở lên | Có thể áp dụng quota 200 GB, FIFO 90%/80%, video 1 GB bằng upload phân mảnh. |

## Quyết định kỹ thuật đã xác nhận

Người dùng đã chọn lưu media thực tối thiểu 200 GB và đồng ý FIFO xóa vĩnh viễn khi mức dùng đạt 90%. Kiến trúc ưu tiên sẽ dùng object storage tương thích S3, với Cloudflare R2 là lựa chọn đầu tiên và lớp adapter để có thể đổi sang S3/Supabase mà không làm thay đổi luồng chat hiện hữu.

Cloudflare R2 hỗ trợ S3-compatible multipart upload; mỗi part có thể từ 5 MiB đến 5 GiB và SDK có thể tự chia part. Điều này phù hợp để triển khai upload video 1 GB theo cơ chế chịu lỗi/resume thay vì đẩy toàn bộ file qua máy chủ ứng dụng. R2 mặc định hủy multipart upload chưa hoàn tất sau 7 ngày, phù hợp với chính sách dọn tệp tạm.

Supabase Storage chỉ cho đặt giới hạn file tối đa 50 MB ở gói Free, trong khi Pro trở lên cho đặt tới 500 GB. Vì mục tiêu có video 1 GB, Supabase Free không đáp ứng; chỉ dùng Supabase khi dự án sở hữu gói có giới hạn bucket phù hợp.

## Nguồn

1. [Cloudinary Pricing](https://cloudinary.com/pricing)
2. [Cloudinary Delete assets](https://cloudinary.com/documentation/delete_assets)
3. [Cloudinary Upload Widget Reference](https://cloudinary.com/documentation/upload_widget_reference)
4. [Cloudflare R2 Upload objects](https://developers.cloudflare.com/r2/objects/upload-objects/)
5. [Supabase Storage file limits](https://supabase.com/docs/guides/storage/uploads/file-limits)
