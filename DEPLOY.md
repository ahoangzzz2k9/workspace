# Triển khai lên máy chủ

Ứng dụng là **một process Node.js + một file SQLite**. Không cần Redis, không cần build frontend. Cách khuyến nghị: Docker Compose + Caddy làm reverse proxy/HTTPS.

> **GitHub Pages không chạy được app này.** GitHub Pages chỉ phục vụ file tĩnh; Cùng Làm render phía server và cần SQLite ghi được. GitHub dùng để lưu mã nguồn — muốn có địa chỉ web thật cần một host chạy Node (Render/Fly/Railway hoặc VPS).

## 1. Chuẩn bị

- VPS Linux (1 vCPU / 1 GB RAM là đủ cho vài trăm người dùng đầu tiên).
- Tên miền trỏ về IP máy chủ (ví dụ `cunglam.example.com`).
- Docker + Docker Compose plugin.

```bash
git clone https://github.com/<tài-khoản>/cunglam.git
cd cunglam
cp .env.example .env
```

Sửa `.env` khi chạy thật:

```dotenv
HOST=0.0.0.0
PORT=4321
CUNGLAM_DB=/app/data/cunglam.db
CUNGLAM_SEED=0      # không tạo dữ liệu demo
COOKIE_SECURE=true  # bắt buộc khi có HTTPS
TRUST_PROXY=1
```

## 2. Chạy bằng Docker

```bash
docker compose up -d --build
curl http://127.0.0.1:4321/health
```

Compose đã bind cổng vào `127.0.0.1` (chỉ máy chủ truy cập được) và dùng volume `cunglam-data` cho database.

Khi chạy thật, đặt `CUNGLAM_SEED: "0"` trong `docker-compose.yml` **trước lần chạy đầu tiên**, nếu không sẽ có dữ liệu demo.

## 3. HTTPS với Caddy

`/etc/caddy/Caddyfile`:

```caddyfile
cunglam.example.com {
    encode zstd gzip
    reverse_proxy 127.0.0.1:4321
}
```

```bash
sudo systemctl reload caddy
```

Caddy tự xin chứng chỉ TLS. Khi đó `COOKIE_SECURE=true` và `TRUST_PROXY=1` để cookie có cờ `Secure`.

Nếu dùng Nginx:

```nginx
server {
    listen 443 ssl http2;
    server_name cunglam.example.com;
    # ssl_certificate ...
    location / {
        proxy_pass http://127.0.0.1:4321;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 4. Không dùng Docker (systemd)

```ini
# /etc/systemd/system/cunglam.service
[Unit]
Description=Cung Lam
After=network.target

[Service]
WorkingDirectory=/opt/cunglam
EnvironmentFile=/opt/cunglam/.env
ExecStart=/usr/bin/node server.js
Restart=always
User=cunglam

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now cunglam
```

## 5. Sao lưu & khôi phục

SQLite ở chế độ WAL. Cách an toàn nhất là dừng app rồi copy thư mục dữ liệu:

```bash
docker compose stop cunglam
docker run --rm -v cunglam-data:/data -v "$PWD":/backup alpine \
  tar czf /backup/cunglam-$(date +%F).tar.gz -C /data .
docker compose start cunglam
```

Khôi phục: dừng app, giải nén vào volume, chạy lại. Nên đặt cron hằng ngày và giữ 7–14 bản.

## 6. Nâng cấp

```bash
git pull
docker compose up -d --build
```

Database được giữ nguyên trong volume. Nếu có thay đổi schema, thêm migration vào `src/db.js` (hiện dùng `CREATE TABLE IF NOT EXISTS`).

## 7. Checklist trước khi mở công khai

- [ ] `CUNGLAM_SEED=0`, không còn tài khoản demo.
- [ ] HTTPS bật, `COOKIE_SECURE=true`, `TRUST_PROXY=1`.
- [ ] Firewall chỉ mở 80/443; cổng 4321 không lộ ra Internet.
- [ ] Sao lưu tự động + đã thử khôi phục một lần.
- [ ] Theo dõi `/health` (Uptime Kuma, Better Stack…).
- [ ] Đã đọc phần giới hạn bảo mật trong README (chưa có rate limit, quên mật khẩu, xác thực email).

## 8. Quy mô lớn hơn

SQLite phù hợp một máy chủ. Khi cần nhiều instance hoặc ghi đồng thời cao, chuyển sang PostgreSQL: thay lớp `src/db.js`, giữ nguyên phần route/views vì truy vấn tập trung ở `src/data.js` và các route.

## 9. Render — nhanh nhất, có HTTPS sẵn

Repo có `render.yaml` cấu hình sẵn **plan Free**: chạy được ngay, không cần thẻ.

1. Push repo lên GitHub (public).
2. Mở [render.com/deploy?repo=https://github.com/ahoangzzz2k9/workspace](https://render.com/deploy?repo=https://github.com/ahoangzzz2k9/workspace) hoặc Render Dashboard → **New → Blueprint** → chọn repo.
3. Bấm **Apply / Deploy**, đợi 3–5 phút.
4. Mở `https://cunglam-xxxx.onrender.com`, kiểm tra `/health` trả `{"status":"ok"}`.

**Giới hạn plan Free:** ổ đĩa tạm, service ngủ sau ~15 phút không truy cập (lần mở đầu chậm ~30–60 giây), dữ liệu mất khi deploy lại. Đủ để xem và demo.

**Muốn giữ dữ liệu:** đổi `plan: free` → `plan: starter`, bỏ comment khối `disk` trong `render.yaml` (Render Starter mới gắn được ổ đĩa), deploy lại. Sau đó đổi `CUNGLAM_SEED` = `0` và đăng ký tài khoản đầu tiên.

Không dùng Blueprint cũng được: **New → Web Service** → chọn repo → Runtime **Docker** → Plan **Free** → Health check `/health` → thêm các biến `HOST`, `PORT`, `CUNGLAM_DB`, `CUNGLAM_SEED`, `COOKIE_SECURE`, `TRUST_PROXY` như trong file.

Các lựa chọn tương đương có volume: **Fly.io**, **Railway**, hoặc VPS theo mục 1–3.


