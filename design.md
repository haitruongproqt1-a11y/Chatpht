# Thiết kế giao diện chatpht

## Định hướng trải nghiệm

chatpht là ứng dụng nhắn tin và gọi video theo định hướng **tối giản, riêng tư và thao tác một tay**. Mọi màn hình được thiết kế cho khung dọc 9:16, vùng chạm tối thiểu 44 pt và quy ước điều hướng iOS: thanh tiêu đề rõ ràng, danh sách phân nhóm, sheet cho hành động phụ và thanh tab cố định cho điểm đến chính.

## Màu sắc và nhận diện

| Mục đích | Màu | Ghi chú |
|---|---|---|
| Thương hiệu chính | `#4F46E5` | Chàm điện, dùng cho CTA và trạng thái đang hoạt động. |
| Nền sáng | `#F7F8FC` | Nền trung tính, giảm chói khi đọc hội thoại lâu. |
| Bề mặt | `#FFFFFF` | Thẻ, sheet và bong bóng chat đến. |
| Mực chính | `#172033` | Tương phản cao cho nội dung chính. |
| Tín hiệu thành công | `#16A34A` | Hiện diện trực tuyến, cuộc gọi kết nối. |
| Cảnh báo | `#F59E0B` | Thông báo quyền quản trị hoặc tệp đang tải. |
| Lỗi | `#DC2626` | Thông báo lỗi và thao tác nguy hiểm. |

## Danh sách màn hình

| Màn hình | Nội dung chính | Chức năng trọng tâm |
|---|---|---|
| Chào mừng và đăng nhập | Lời hứa giá trị, đăng nhập tài khoản, trạng thái phiên | Đăng nhập, khôi phục phiên, chuyển đến hộp thư. |
| Hộp thư | Danh sách cuộc trò chuyện 1:1 và phòng, avatar, tin cuối, badge chưa đọc | Mở hội thoại, tạo phòng, tìm kiếm. |
| Hội thoại | Tin nhắn thời gian thực, trạng thái đang soạn, đã xem, composer và thanh hành động | Gửi text, chọn tệp, mở chi tiết phòng, bắt đầu gọi. |
| Tạo và chi tiết phòng | Tên phòng, thành viên, vai trò, thông tin tệp và thống kê | Thêm/xóa thành viên, phân quyền admin, rời phòng. |
| Cuộc gọi | Lưới video tối đa tám ô, trạng thái mic/camera, chỉ báo mạng | Tạo/trả lời/tham gia/rời phiên, bật tắt mic/camera, đổi camera, chia sẻ màn hình. |
| Danh sách phiên có thể tham gia | Phiên đang diễn ra thuộc các phòng người dùng là thành viên | Tham gia nhanh hoặc xem người đang tham gia. |
| Tệp đính kèm | Danh sách media và file theo phòng, thumbnail, kích thước, ngày gửi | Xem trước, mở hoặc chia sẻ liên kết tệp. |
| Quản trị | Số người dùng, phòng, phiên gọi, dung lượng tệp và quyền LiveKit | Xem thống kê, kiểm tra provider, quản lý vai trò. |
| Cài đặt | Hồ sơ, giao diện, quyền máy ảnh/micro, đăng xuất | Quản lý tùy chọn cục bộ và đăng xuất an toàn. |

## Luồng sử dụng chính

Người dùng mở ứng dụng, đăng nhập và đến **Hộp thư**. Từ đây họ chạm vào một cuộc trò chuyện để đọc, nhập tin nhắn, đính kèm tệp hoặc bắt đầu cuộc gọi. Khi tạo phòng, người tạo trở thành admin phòng; màn hình chi tiết phòng cho phép mời thành viên và phân quyền. Khi một phiên gọi đang hoạt động, thành viên hợp lệ thấy phiên đó trong danh sách có thể tham gia; sau khi được máy chủ cấp token ngắn hạn, họ vào lưới gọi. Các nút kết thúc, mic và camera luôn nằm trong vùng với tới bằng ngón cái ở đáy màn hình.

## Quy tắc bố cục

Hộp thư sử dụng `FlatList` với vùng tìm kiếm thu gọn phía trên và nút tạo nổi ở góc phải dưới. Màn hình hội thoại neo composer phía đáy, giữ nội dung trong vùng an toàn và chỉ hiển thị sheet cho tệp, người tham gia hay quyền quản trị. Màn hình gọi ưu tiên hình ảnh video: hai người dùng bố cục lớn/cửa sổ nhỏ, từ ba đến tám người dùng dùng lưới thích ứng; thanh điều khiển tương phản cao được đặt cuối màn hình và không che video quan trọng.
