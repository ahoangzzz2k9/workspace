# Changelog

Mọi thay đổi đáng chú ý của Cùng Làm. Định dạng tham khảo [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/), phiên bản theo [SemVer](https://semver.org/lang/vi/).

## [0.3.0] — 2026-11-08

### Added
- Số liệu trên trang chủ, trang dự án và trang người dùng lấy trực tiếp từ cơ sở dữ liệu: số dự án, người dùng, vai trò mở, đóng góp.
- Khối minh hoạ ở trang chủ dùng dự án/task/đóng góp thật thay vì số hardcode.
- Cấu hình deploy: `Dockerfile`, `docker-compose.yml`, `.env.example`, `docs/DEPLOY.md`.
- CI GitHub Actions chạy kiểm tra cú pháp và 13 test end-to-end.
- `LICENSE` (MIT), `CONTRIBUTING.md`, `CHANGELOG.md`.
- Biến môi trường `HOST`, `CUNGLAM_SEED`, `COOKIE_SECURE`, `TRUST_PROXY`; server tự đọc `.env`.

### Changed
- README có hướng dẫn đưa lên GitHub, cấu hình môi trường và triển khai máy chủ.
- Cookie tự thêm `Secure` khi chạy sau HTTPS.

## [0.2.2] — 2026-11-08

### Fixed
- Trình duyệt không tự mở: tách sang `MO-TRINH-DUYET.ps1` do `.bat` gọi, không phụ thuộc khả năng spawn của Node.
- Ghi URL thật vào `app/data/url.txt` để mở đúng cổng khi 4321 bận.

## [0.2.1] — 2026-11-08

### Fixed
- Server thoát ngay sau khi khởi động khi mở trình duyệt bị chặn (`spawn EPERM`).
- Tự chuyển cổng 4322…4330 khi 4321 bận.

### Added
- Endpoint `/health`.

## [0.2.0] — 2026-11-08

### Added
- PWA: manifest, icon 192/512/maskable, service worker, trang offline, thanh tab mobile, badge, shortcut.

## [0.1.0] — 2026-11-08

### Added
- MVP: đăng ký/đăng nhập, hồ sơ năng lực, tạo/tìm dự án, matching, ứng tuyển/lời mời, workspace task, thoả thuận sở hữu, hoàn thành dự án, uy tín, thông báo, showcase.
