import { esc } from '../views.js';
import { render } from './util.js';

const OFFLINE_HTML = `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Ngoại tuyến · Cùng Làm</title>
  <meta name="theme-color" content="#0f766e">
  <link rel="manifest" href="/manifest.webmanifest">
  <link rel="icon" href="/static/icons/favicon-32.png" sizes="32x32">
  <link rel="apple-touch-icon" href="/static/icons/apple-touch-icon-180.png">
  <link rel="stylesheet" href="/static/style.css">
  <script src="/static/app.js" defer></script>
</head>
<body class="offline-body">
  <main class="offline-wrap">
    <div class="offline-card">
      <span class="brand-mark offline-mark" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="44" height="44" fill="none">
          <rect x="2.5" y="2.5" width="27" height="27" rx="9" fill="currentColor" opacity=".12"/>
          <path d="M10 21V13.5C10 11.6 11.6 10 13.5 10S17 11.6 17 13.5V21" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
          <path d="M17 17.5c0-1.9 1.6-3.5 3.5-3.5S24 15.6 24 17.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
        </svg>
      </span>
      <h1>Bạn đang ngoại tuyến</h1>
      <p class="lead">Cùng Làm cần kết nối mạng để tải dự án, task và thông báo mới. Khi có mạng trở lại, mọi thứ sẽ hoạt động bình thường.</p>
      <div class="offline-actions">
        <button class="btn btn-primary" type="button" data-retry>Thử lại</button>
        <a class="btn btn-ghost" href="/">Về trang chủ</a>
      </div>
      <p class="muted small">Trang này được lưu sẵn trong ứng dụng để bạn không gặp màn hình trắng khi mất mạng.</p>
    </div>
  </main>
</body>
</html>`;

export function registerAppRoutes(router) {
  router.get('/health', (ctx) => {
    const body = JSON.stringify({
      status: 'ok',
      app: 'cunglam',
      uptimeSeconds: Math.round(process.uptime())
    });
    ctx.res.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    });
    ctx.res.end(body);
  });

  router.get('/offline', (ctx) => {
    ctx.html = OFFLINE_HTML;
  });

  router.get('/app', (ctx) => {
    const body = `
    <section class="page-head">
      <p class="eyebrow">Ứng dụng</p>
      <h1>Cài Cùng Làm thành app</h1>
      <p class="lead">Chạy toàn màn hình, mở nhanh từ màn hình chính, có icon riêng và trang dự phòng khi mất mạng.</p>
    </section>
    <div class="app-grid">
      <section class="card">
        <h2>Android / Chrome / Edge</h2>
        <p class="muted">Mở menu trình duyệt → <strong>Cài đặt ứng dụng</strong> (hoặc nút “Cài đặt” hiện ở cuối màn hình).</p>
        <button class="btn btn-primary" type="button" data-install>${esc('Cài đặt ngay')}</button>
      </section>
      <section class="card">
        <h2>iPhone / iPad (Safari)</h2>
        <p class="muted">Nhấn nút <strong>Chia sẻ</strong> → <strong>Thêm vào MH chính</strong>. Ứng dụng sẽ mở toàn màn hình như app thật.</p>
      </section>
      <section class="card">
        <h2>Máy tính</h2>
        <p class="muted">Trên Chrome/Edge, biểu tượng cài đặt nằm ở thanh địa chỉ. Ứng dụng mở trong cửa sổ riêng.</p>
      </section>
      <section class="card">
        <h2>Điều kiện</h2>
        <p class="muted small">Cần HTTPS (hoặc localhost). Bản này chạy ở <code>127.0.0.1</code> nên cài được ngay trên máy. Khi đưa lên mạng LAN/điện thoại, hãy dùng HTTPS.</p>
      </section>
    </div>`;
    render(ctx, { title: 'Cài ứng dụng · Cùng Làm', body });
  });
}