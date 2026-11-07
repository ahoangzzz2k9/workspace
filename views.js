const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

export const STAGES = {
  'y-tuong': 'Ý tưởng',
  'prototype': 'Prototype',
  'mvp': 'MVP',
  'done': 'Đã hoàn thành'
};

export const LEVELS = {
  beginner: 'Mới bắt đầu',
  intermediate: 'Đã có kinh nghiệm',
  advanced: 'Thành thạo'
};

export const TASK_STATUS = {
  todo: 'Cần làm',
  in_progress: 'Đang làm',
  review: 'Chờ review',
  done: 'Hoàn thành'
};

export const PROJECT_STATUS = {
  recruiting: 'Đang tuyển',
  active: 'Đang chạy',
  completed: 'Đã hoàn thành',
  archived: 'Đã lưu trữ'
};

export function initials(name) {
  const parts = String(name ?? '').trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function avatar(user, size = 'md') {
  if (!user) return '';
  const hue = user.avatar_hue ?? 210;
  return `<span class="avatar avatar-${size}" style="--hue:${Number(hue) % 360}" aria-hidden="true">${esc(initials(user.full_name))}</span>`;
}

export function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} ngày trước`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} tháng trước`;
  return `${Math.round(months / 12)} năm trước`;
}

export function formatDate(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return esc(iso);
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function statusBadge(status) {
  const label = PROJECT_STATUS[status] ?? status;
  return `<span class="badge badge-${esc(status)}">${esc(label)}</span>`;
}

export function stageLabel(stage) {
  return STAGES[stage] ?? stage ?? '';
}

export function parseList(json, fallback = []) {
  try {
    const parsed = JSON.parse(json ?? '[]');
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

/** skills: [{name, level}] hoặc ['React', ...] */
export function skillChips(skills, { limit = 8, small = false } = {}) {
  const list = (skills ?? []).slice(0, limit);
  if (list.length === 0) return '<span class="muted small">Chưa khai báo kỹ năng</span>';
  return list
    .map((skill) => {
      const name = typeof skill === 'string' ? skill : skill.name;
      const level = typeof skill === 'string' ? null : Number(skill.level) || 0;
      const dots =
        level > 0
          ? `<span class="dots" title="Mức ${level}/5">${'<i class="on"></i>'.repeat(level)}${'<i></i>'.repeat(Math.max(0, 5 - level))}</span>`
          : '';
      return `<span class="chip${small ? ' chip-sm' : ''}">${esc(name)}${dots}</span>`;
    })
    .join('');
}

export function progressBar(percent, { label = null, tone = 'brand' } = {}) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  return `<div class="progress-row">
    ${label ? `<span class="progress-label">${esc(label)}</span>` : ''}
    <div class="progress" role="progressbar" aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="100">
      <span class="progress-fill tone-${esc(tone)}" style="width:${value}%"></span>
    </div>
    <span class="progress-value">${value}%</span>
  </div>`;
}

export function emptyState(title, body = '', action = '') {
  return `<div class="empty">
    <p class="empty-title">${esc(title)}</p>
    ${body ? `<p class="muted">${esc(body)}</p>` : ''}
    ${action}
  </div>`;
}

export function formField({
  label,
  name,
  value = '',
  type = 'text',
  required = false,
  placeholder = '',
  hint = '',
  autocomplete = '',
  min = null,
  max = null
}) {
  return `<label class="field">
    <span class="field-label">${esc(label)}${required ? ' <em>*</em>' : ''}</span>
    <input type="${esc(type)}" name="${esc(name)}" value="${esc(value)}"${required ? ' required' : ''}${
      placeholder ? ` placeholder="${esc(placeholder)}"` : ''
    }${autocomplete ? ` autocomplete="${esc(autocomplete)}"` : ''}${min !== null ? ` min="${min}"` : ''}${
      max !== null ? ` max="${max}"` : ''
    }>
    ${hint ? `<span class="field-hint">${esc(hint)}</span>` : ''}
  </label>`;
}

export function formArea({ label, name, value = '', rows = 4, placeholder = '', hint = '', required = false }) {
  return `<label class="field">
    <span class="field-label">${esc(label)}${required ? ' <em>*</em>' : ''}</span>
    <textarea name="${esc(name)}" rows="${rows}"${required ? ' required' : ''}${
      placeholder ? ` placeholder="${esc(placeholder)}"` : ''
    }>${esc(value)}</textarea>
    ${hint ? `<span class="field-hint">${esc(hint)}</span>` : ''}
  </label>`;
}

export function formSelect({ label, name, value = '', options = [], hint = '' }) {
  const opts = options
    .map(
      (option) =>
        `<option value="${esc(option.value)}"${String(option.value) === String(value) ? ' selected' : ''}>${esc(
          option.label
        )}</option>`
    )
    .join('');
  return `<label class="field">
    <span class="field-label">${esc(label)}</span>
    <select name="${esc(name)}">${opts}</select>
    ${hint ? `<span class="field-hint">${esc(hint)}</span>` : ''}
  </label>`;
}

export function flashFrom(query) {
  const ok = query.get('ok');
  const err = query.get('err');
  if (ok) return `<div class="banner banner-ok" role="status">${esc(ok)}</div>`;
  if (err) return `<div class="banner banner-err" role="alert">${esc(err)}</div>`;
  return '';
}

const NAV = [
  { href: '/projects', label: 'Dự án' },
  { href: '/people', label: 'Mọi người' },
  { href: '/showcase', label: 'Showcase' }
];

const TAB_ICONS = {
  home: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/></svg>`,
  projects: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/></svg>`,
  bell: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 15.5H6l1.4-2V10a4.6 4.6 0 0 1 9.2 0v3.5z"/><path d="M10 18.5a2 2 0 0 0 4 0"/></svg>`,
  user: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="3.4"/><path d="M5.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/></svg>`
};

export function layout({
  title = 'Cùng Làm',
  user = null,
  unread = 0,
  active = '',
  body = '',
  flash = '',
  description = 'Nền tảng kết nối người có ý tưởng với người muốn tích lũy kinh nghiệm thực chiến qua dự án thật.'
}) {
  const navLinks = NAV.map((item) => {
    const cls = active === item.href ? 'nav-link active' : 'nav-link';
    return `<a class="${cls}" href="${item.href}">${esc(item.label)}</a>`;
  }).join('');

  const userArea = user
    ? `<a class="nav-link nav-bell" href="/me/notifications" title="Thông báo"><span class="bell-label">Thông báo</span>${
        unread > 0 ? `<span class="dot-count">${unread}</span>` : ''
      }</a>
       <details class="usermenu">
         <summary>${avatar(user, 'sm')}<span class="usermenu-name">${esc(user.full_name.split(' ')[0])}</span></summary>
         <div class="usermenu-panel">
           <a href="/me">Hồ sơ của tôi</a>
           <a href="/me/projects">Dự án của tôi</a>
           <a href="/invites">Lời mời</a>
           <a href="/app">Cài ứng dụng</a>
           <form method="post" action="/logout"><button class="linklike" type="submit">Đăng xuất</button></form>
         </div>
       </details>`
    : `<a class="nav-link" href="/login">Đăng nhập</a>
       <a class="btn btn-primary btn-sm" href="/register">Tham gia</a>`;

  const tabs = [
    { href: '/', label: 'Trang chủ', icon: 'home', on: active === '/' },
    { href: '/projects', label: 'Dự án', icon: 'projects', on: active.startsWith('/projects') },
    {
      href: '/me/notifications',
      label: 'Thông báo',
      icon: 'bell',
      on: active.startsWith('/me/notifications'),
      badge: unread
    },
    user
      ? {
          href: '/me',
          label: 'Tôi',
          icon: 'user',
          on: (active.startsWith('/me') && !active.startsWith('/me/notifications')) || active === '/invites'
        }
      : { href: '/login', label: 'Đăng nhập', icon: 'user', on: active === '/login' }
  ];

  const tabHtml = tabs
    .map(
      (tab) => `<a class="tab${tab.on ? ' active' : ''}" href="${tab.href}"${tab.on ? ' aria-current="page"' : ''}>
        ${TAB_ICONS[tab.icon]}
        <span class="tab-label">${esc(tab.label)}</span>
        ${tab.badge > 0 ? `<span class="tab-badge">${tab.badge > 9 ? '9+' : tab.badge}</span>` : ''}
      </a>`
    )
    .join('');

  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="theme-color" content="#0f766e">
  <meta name="color-scheme" content="light">
  <link rel="manifest" href="/manifest.webmanifest">
  <link rel="icon" href="/static/icons/favicon-32.png" sizes="32x32">
  <link rel="icon" href="/static/icons/icon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/static/icons/apple-touch-icon-180.png">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <meta name="apple-mobile-web-app-title" content="Cùng Làm">
  <meta name="application-name" content="Cùng Làm">
  <meta name="format-detection" content="telephone=no">
  <link rel="stylesheet" href="/static/style.css">
  <script src="/static/app.js" defer></script>
</head>
<body data-unread="${Number(unread) || 0}">
  <a class="skip" href="#main">Bỏ qua điều hướng</a>
  <header class="topbar">
    <div class="wrap topbar-inner">
      <a class="brand" href="/" aria-label="Cùng Làm — trang chủ">
        <span class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" width="30" height="30" fill="none">
            <rect x="2.5" y="2.5" width="27" height="27" rx="9" fill="currentColor" opacity=".12"/>
            <path d="M10 21V13.5C10 11.6 11.6 10 13.5 10S17 11.6 17 13.5V21" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
            <path d="M17 17.5c0-1.9 1.6-3.5 3.5-3.5S24 15.6 24 17.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
          </svg>
        </span>
        <span class="brand-text">Cùng<strong>Làm</strong></span>
      </a>
      <nav class="mainnav" aria-label="Điều hướng chính">${navLinks}</nav>
      <div class="navright">${userArea}</div>
    </div>
  </header>
  <main id="main" class="wrap main">
    ${flash}
    ${body}
  </main>
  <nav class="tabbar" aria-label="Điều hướng ứng dụng">${tabHtml}</nav>
  <div class="install-banner" id="install-banner" hidden>
    <div class="install-copy">
      <strong>Cài Cùng Làm thành app</strong>
      <span id="install-hint">Mở nhanh từ màn hình chính, chạy toàn màn hình, có trang dự phòng khi mất mạng.</span>
    </div>
    <div class="install-actions">
      <button class="btn btn-primary btn-sm" type="button" data-install>Cài đặt</button>
      <button class="btn btn-ghost btn-sm" type="button" data-install-dismiss aria-label="Để sau">Để sau</button>
    </div>
  </div>
  <footer class="footer">
    <div class="wrap footer-inner">
      <p><strong>Cùng Làm</strong> — nơi ý tưởng gặp người thực thi. Bản MVP 0.1.</p>
      <p class="muted small">Dự án học tập có dữ liệu demo. Không có giao dịch tiền thật.</p>
    </div>
  </footer>
</body>
</html>`;
}

export function errorPage(status, message) {
  return layout({
    title: `${status} · Cùng Làm`,
    body: `<section class="error-page">
      <p class="error-code">${status}</p>
      <h1>${esc(message)}</h1>
      <p class="muted">Bạn có thể quay lại <a href="/projects">danh sách dự án</a> hoặc <a href="/">trang chủ</a>.</p>
    </section>`
  });
}
