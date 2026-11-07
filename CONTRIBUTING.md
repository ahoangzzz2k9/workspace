# Đóng góp cho Cùng Làm

Cảm ơn bạn muốn đóng góp. Dự án cố ý **không dùng dependency ngoài**: Node.js ≥ 22.5 là đủ, nhờ vậy clone về là chạy và dễ kiểm toán.

## Chạy thử

```bash
node server.js          # http://127.0.0.1:4321
node test/run.js        # 13 test end-to-end
```

Muốn tạo lại dữ liệu demo: xoá `data/` rồi chạy lại.

## Quy ước code

- ES modules, không thêm package vào `dependencies` nếu có thể viết bằng API có sẵn của Node.
- Mọi nội dung do người dùng nhập phải đi qua `esc()` trước khi chèn vào HTML.
- Mọi thay đổi nhiều bước (nhận ứng viên, hoàn thành dự án, xoá thành viên…) dùng transaction (`tx()` trong `src/db.js`).
- Truy vấn SQL đặt trong `src/data.js` hoặc file route tương ứng; không ghép chuỗi SQL từ input.
- Giao diện dùng tiếng Việt, giữ cấu trúc component trong `src/views.js`.

## Gửi thay đổi

1. Tạo nhánh: `git checkout -b feat/ten-ngan`
2. Commit theo dạng: `feat: thêm ...`, `fix: sửa ...`, `docs: ...`
3. Chạy `node test/run.js` trước khi mở PR.
4. Mô tả PR: vấn đề, cách giải, ảnh chụp nếu có thay đổi giao diện.

## Báo lỗi bảo mật

Không mở issue công khai cho lỗ hổng bảo mật. Gửi email cho maintainer (điền trước khi publish) kèm bước tái hiện.

## Giấy phép

Khi đóng góp, bạn đồng ý mã nguồn được phát hành theo giấy phép MIT của dự án.
