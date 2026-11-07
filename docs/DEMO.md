# Kịch bản demo 5 phút

Mục tiêu: cho người xem thấy vòng đời đầy đủ của một dự án — không chỉ màn hình "tìm người".

Chuẩn bị: `node server.js`, mở `http://127.0.0.1:4321`. Dùng cửa sổ ẩn danh nếu muốn đăng nhập nhiều tài khoản.

## 0. Nếu muốn demo như app (30 giây)

Trên Chrome/Edge: bấm **Cài đặt** ở banner gợi ý (hoặc menu trình duyệt → *Cài đặt ứng dụng*). App mở trong cửa sổ riêng, có icon trên màn hình chính.

Trên điện thoại: mở `http://<ip-máy-tính>:4321` (cần HTTPS để cài) → **Thêm vào MH chính**. Sau khi cài, thanh tab dưới xuất hiện, không còn thanh địa chỉ.

Mẹo demo offline: mở DevTools → Network → *Offline* rồi tải lại trang — app hiện trang “Bạn đang ngoại tuyến” thay vì màn hình trắng.

## 1. Trang chủ (30 giây)

Mở `/`. Chỉ ra:

- Định vị: "Ý tưởng cần người. Kinh nghiệm cần dự án."
- 4 bước vòng đời: khai báo năng lực → tạo/tìm dự án → workspace → hoàn thành & ghi nhận.
- Khối "Uy tín đến từ bằng chứng" — điểm khác biệt so với một group Facebook.

## 2. Creator nhận người (90 giây)

Đăng nhập `an@cunglam.vn / demo1234`.

1. Vào **Dự án → Lịch học thông minh cho sinh viên → Quản lý**.
2. Chỉ 2 ứng viên đang chờ. Mở một hồ sơ để thấy kỹ năng kèm mức độ.
3. Kéo xuống **Gợi ý theo vai trò**: điểm 49%, 42%… kèm lý do ("Khớp 1/2 kỹ năng", "Có 20 giờ/tuần", "Quan tâm Giáo dục"). Nhấn mạnh: hệ thống đề xuất, creator quyết định.
4. Bấm **Nhận vào team** cho Lê Thảo Vy.
5. Hệ thống tự tạo **thoả thuận dự án** với tỷ lệ chia. Thử sửa tỷ lệ thành 60/40 → lưu; thông báo yêu cầu xác nhận lại.

## 3. Workspace & tiến độ (90 giây)

1. Bấm **Workspace** (hoặc đăng nhập `vy@cunglam.vn` để thấy góc nhìn thành viên).
2. Chỉ bảng 4 cột: Cần làm → Đang làm → Chờ review → Hoàn thành.
3. Đổi trạng thái một task bằng menu (tự gửi form).
4. Mở menu "⋯" trên task: giao việc, báo vướng mắc. Task vướng sẽ hiện cảnh báo cho cả team và thông báo cho creator.
5. Chỉ cột phải: tiến độ từng người và tiến độ dự án, task quá hạn.
6. Nếu tài khoản chưa xác nhận thoả thuận, banner vàng nhắc — bấm **Tôi đã đọc và xác nhận**.

## 4. Hoàn thành & uy tín (60 giây)

1. Về **Quản lý → Hoàn thành dự án**.
2. Mở lại trang dự án: mục **Kết quả & đóng góp** liệt kê từng người, vai trò, số task.
3. Vào **Hồ sơ** hoặc `/people/2`: điểm uy tín tăng, dự án hoàn thành +1, tỷ lệ đúng hạn.
4. Vào **Showcase**: dự án đã hoàn thành trở thành bằng chứng công khai.

## 5. Phía người tham gia (60 giây)

Đăng nhập `quang@cunglam.vn`.

1. Chuông **Thông báo** có lời mời mới → **Lời mời** → **Chấp nhận**.
2. Vào workspace của dự án vừa tham gia: thấy task, thoả thuận, quyền truy cập nội bộ.
3. Thử **Rời dự án**: quyền truy cập bị thu hồi, creator nhận thông báo, vai trò mở lại để tuyển người thay.

## Câu chốt

> Điểm khác biệt không nằm ở chỗ "tìm được người", mà ở chỗ giữ được team làm việc đến cuối và biến đóng góp thành bằng chứng có thể kiểm chứng.

## Nếu bị hỏi

- **"Có phải AI matching không?"** Không. Là thuật toán cho điểm theo trọng số công khai; giải thích được từng gợi ý. Bot/AI là bước sau.
- **"Tiền và quyền sở hữu xử lý thế nào?"** Có agreement và tỷ lệ %, chưa có thanh toán thật. Cố ý không làm escrow khi chưa có tư vấn pháp lý.
- **"Bảo mật ý tưởng?"** Phân tầng: công khai → ứng viên → thành viên. Không hứa điều không làm được: người đã xem thì không thể "quên".
- **"Vì sao không dùng React/Next?"** Môi trường này không có registry npm; sản phẩm chạy zero-dependency, một lệnh. Kiến trúc tách route/DB rõ để nâng cấp sau.
