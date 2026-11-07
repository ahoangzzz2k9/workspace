// Progressive enhancement: mọi luồng chính vẫn chạy khi JavaScript bị tắt.
(() => {
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (standalone) document.documentElement.classList.add('standalone');

  // ---------- Service worker ----------
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* offline không bắt buộc để dùng app */
      });
    });
  }

  // ---------- Badge trên icon app ----------
  const unread = Number(document.body.dataset.unread || 0);
  if ('setAppBadge' in navigator) {
    if (unread > 0) navigator.setAppBadge(unread).catch(() => {});
    else if ('clearAppBadge' in navigator) navigator.clearAppBadge().catch(() => {});
  }

  // ---------- Cài đặt ứng dụng ----------
  const banner = document.getElementById('install-banner');
  const hint = document.getElementById('install-hint');
  const DISMISS_KEY = 'cl-install-dismissed-at';
  const DISMISS_MS = 14 * 864e5;
  let deferredPrompt = null;

  const recentlyDismissed = () => {
    const at = Number(window.localStorage.getItem(DISMISS_KEY) || 0);
    return at > 0 && Date.now() - at < DISMISS_MS;
  };
  const showBanner = () => {
    if (!banner || standalone || recentlyDismissed()) return;
    const path = window.location.pathname;
    const quietPage = path.startsWith('/projects/') || path.startsWith('/me/') || path === '/invites';
    if (quietPage) return;
    banner.hidden = false;
  };
  const hideBanner = () => {
    if (banner) banner.hidden = true;
  };

  const ua = navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua);

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    window.setTimeout(showBanner, 3000);
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hideBanner();
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
  });

  document.addEventListener('click', async (event) => {
    const installTrigger = event.target.closest('[data-install]');
    if (installTrigger) {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        try {
          await deferredPrompt.userChoice;
        } catch {
          /* bỏ qua */
        }
        deferredPrompt = null;
        hideBanner();
        return;
      }
      if (isIos) {
        if (hint) {
          hint.textContent =
            'Trên iPhone/iPad: nhấn nút Chia sẻ trên Safari → “Thêm vào MH chính”. Ứng dụng sẽ mở toàn màn hình.';
        }
        showBanner();
        return;
      }
      if (window.location.pathname !== '/app') {
        window.location.href = '/app';
      } else if (hint) {
        hint.textContent =
          'Trình duyệt này chưa cung cấp nút cài trực tiếp. Hãy dùng menu trình duyệt → “Cài đặt ứng dụng”, hoặc mở bằng Chrome/Edge.';
      }
      return;
    }

    if (event.target.closest('[data-install-dismiss]')) {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
      hideBanner();
      return;
    }

    if (event.target.closest('[data-retry]')) {
      window.location.reload();
    }
  });

  if (isIos && !standalone) {
    window.setTimeout(showBanner, 2500);
  }

  // ---------- Trạng thái mạng ----------
  const offlineBar = document.createElement('div');
  offlineBar.className = 'offline-bar';
  offlineBar.setAttribute('role', 'status');
  offlineBar.textContent = 'Bạn đang ngoại tuyến — nội dung có thể chưa được cập nhật.';
  const syncOnlineState = () => {
    const offline = !navigator.onLine;
    document.documentElement.classList.toggle('is-offline', offline);
    offlineBar.hidden = !offline;
    if (offline && !offlineBar.isConnected) document.body.prepend(offlineBar);
  };
  window.addEventListener('online', syncOnlineState);
  window.addEventListener('offline', syncOnlineState);
  if ('onLine' in navigator) {
    document.body.prepend(offlineBar);
    syncOnlineState();
  }

  // ---------- Tương tác nhỏ ----------
  document.addEventListener('change', (event) => {
    const control = event.target;
    if (!(control instanceof HTMLSelectElement)) return;
    if (!control.hasAttribute('data-autosubmit')) return;
    const form = control.form;
    if (!form) return;
    if (control.name === 'status' && form.getAttribute('action')?.includes('/status')) {
      form.submit();
      return;
    }
    if (control.name === 'assignee_id') form.submit();
  });

  document.addEventListener('click', (event) => {
    document.querySelectorAll('details[open]').forEach((details) => {
      if (details.contains(event.target)) return;
      if (details.classList.contains('task-menu') || details.classList.contains('usermenu')) {
        details.open = false;
      }
    });
  });

  const flash = document.querySelector('.banner-ok');
  if (flash) {
    window.setTimeout(() => {
      flash.style.transition = 'opacity 400ms ease';
      flash.style.opacity = '0';
      window.setTimeout(() => flash.remove(), 450);
    }, 6000);
  }
})();
