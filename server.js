import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { openDb } from './src/db.js';
import { seed } from './src/seed.js';
import {
  createRouter,
  parseBody,
  parseCookies,
  sendHtml,
  sendRedirect,
  serveStatic,
  sameOrigin
} from './src/http.js';
import { userFromSession, SESSION_COOKIE } from './src/auth.js';
import { errorPage } from './src/views.js';
import { registerAuthRoutes } from './src/routes/auth.js';
import { registerProjectRoutes } from './src/routes/projects.js';
import { registerManageRoutes } from './src/routes/manage.js';
import { registerWorkspaceRoutes } from './src/routes/workspace.js';
import { registerMeRoutes } from './src/routes/me.js';
import { registerAppRoutes } from './src/routes/app.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT, 'public');

const MESSAGES = {
  400: 'Yêu cầu chưa hợp lệ.',
  403: 'Bạn không có quyền truy cập trang này.',
  404: 'Không tìm thấy trang bạn tìm.',
  405: 'Phương thức không được hỗ trợ.',
  413: 'Nội dung gửi lên quá lớn.'
};

function cookieHeader(value, { maxAge = 0, httpOnly = true, secure = false } = {}) {
  const parts = [`${SESSION_COOKIE}=${encodeURIComponent(value)}`, 'Path=/', 'SameSite=Lax'];
  if (httpOnly) parts.push('HttpOnly');
  if (secure) parts.push('Secure');
  if (maxAge > 0) parts.push(`Max-Age=${maxAge}`);
  if (maxAge === 0) parts.push('Max-Age=0');
  return parts.join('; ');
}

/** Cookie Secure: bật khi HTTPS trực tiếp, hoặc sau reverse proxy có TRUST_PROXY=1. */
function isSecureRequest(req) {
  const config = (process.env.COOKIE_SECURE || 'auto').toLowerCase();
  if (config === 'true') return true;
  if (config === 'false') return false;
  if (req.socket?.encrypted) return true;
  if (process.env.TRUST_PROXY === '1') {
    const proto = String(req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim();
    if (proto === 'https') return true;
  }
  return false;
}

/** Đọc .env đơn giản, không cần dependency; biến môi trường có sẵn được ưu tiên. */
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export function createApp({ db, publicDir = PUBLIC_DIR, log = true }) {
  const router = createRouter();
  registerAuthRoutes(router);
  registerProjectRoutes(router);
  registerManageRoutes(router);
  registerWorkspaceRoutes(router);
  registerMeRoutes(router);
  registerAppRoutes(router);

  const server = http.createServer(async (req, res) => {
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('x-frame-options', 'DENY');
    res.setHeader('referrer-policy', 'same-origin');
    res.setHeader(
      'content-security-policy',
      "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; form-action 'self'; frame-ancestors 'none'"
    );
    const started = Date.now();
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const cookies = parseCookies(req.headers.cookie);
    let user = userFromSession(db, cookies[SESSION_COOKIE]);

    const ctx = {
      req,
      res,
      db,
      path: url.pathname,
      query: url.searchParams,
      cookies,
      user,
      body: {},
      params: {},
      html: '',
      setCookie(name, value, options = {}) {
        res.appendHeader('set-cookie', cookieHeader(value, { ...options, secure: isSecureRequest(req) }));
      },
      clearCookie() {
        res.appendHeader('set-cookie', cookieHeader('', { maxAge: 0, secure: isSecureRequest(req) }));
      },
      redirect(location, status = 303) {
        sendRedirect(res, location, status);
      }
    };

    const finish = (status, html) => {
      if (res.headersSent) return;
      sendHtml(res, status, html);
    };

    try {
      if (req.method === 'GET' && url.pathname === '/manifest.webmanifest') {
        const body = fs.readFileSync(path.join(publicDir, 'manifest.webmanifest'));
        res.writeHead(200, {
          'content-type': 'application/manifest+json; charset=utf-8',
          'content-length': body.length,
          'cache-control': 'public, max-age=3600'
        });
        res.end(body);
        return;
      }

      if (req.method === 'GET' && url.pathname === '/sw.js') {
        const body = fs.readFileSync(path.join(publicDir, 'sw.js'));
        res.writeHead(200, {
          'content-type': 'text/javascript; charset=utf-8',
          'content-length': body.length,
          'service-worker-allowed': '/',
          'cache-control': 'no-cache'
        });
        res.end(body);
        return;
      }

      if (req.method === 'GET' && (url.pathname.startsWith('/static/') || url.pathname === '/favicon.ico')) {
        if (url.pathname === '/favicon.ico') {
          serveStatic(res, publicDir, '/static/icons/favicon-32.png');
          return;
        }
        if (serveStatic(res, publicDir, url.pathname)) return;
        finish(404, errorPage(404, MESSAGES[404]));
        return;
      }

      const matched = router.match(req.method, url.pathname);
      if (!matched) {
        finish(404, errorPage(404, MESSAGES[404]));
        return;
      }

      if (req.method === 'POST' && !sameOrigin(req)) {
        finish(403, errorPage(403, 'Yêu cầu bị chặn vì khác nguồn gốc.'));
        return;
      }

      if (req.method === 'POST') {
        ctx.body = await parseBody(req);
      }
      if (!user && cookies[SESSION_COOKIE]) {
        res.appendHeader('set-cookie', cookieHeader('', { maxAge: 0 }));
        user = null;
      }
      ctx.user = user;
      ctx.params = matched.params;

      await matched.route.handler(ctx);

      if (!res.headersSent) {
        if (ctx.html) finish(200, ctx.html);
        else {
          res.writeHead(204);
          res.end();
        }
      }
    } catch (error) {
      const notFound = error?.message === 'not-found' || error instanceof Error && error.status === 404;
      const status = notFound ? 404 : Number(error?.status) || 500;
      if (status >= 500) {
        console.error('[cunglam] lỗi xử lý', req.method, url.pathname, error);
      }
      if (!res.headersSent) {
        finish(status, errorPage(status, MESSAGES[status] ?? 'Đã có lỗi xảy ra. Vui lòng thử lại.'));
      } else {
        res.end();
      }
    } finally {
      if (log) {
        console.log(`${req.method} ${url.pathname} ${res.statusCode} ${Date.now() - started}ms`);
      }
    }
  });

  return server;
}

/** Mở trình duyệt không được phép làm chết server. */
function openBrowser(url) {
  try {
    const child = spawn('cmd', ['/c', 'start', '', url], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });
    child.on('error', () => {
      /* để người dùng tự mở URL đã in ra */
    });
    child.unref();
  } catch {
    /* bỏ qua */
  }
}

/** Thử cổng ưu tiên, nếu bận thì tự chuyển cổng kế tiếp. */
async function listenWithFallback(server, preferred, host) {
  for (let offset = 0; offset < 10; offset += 1) {
    const port = preferred + offset;
    try {
      await new Promise((resolve, reject) => {
        const onError = (error) => {
          server.off('listening', onListening);
          reject(error);
        };
        const onListening = () => {
          server.off('error', onError);
          resolve();
        };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(port, host);
      });
      return port;
    } catch (error) {
      if (error.code === 'EADDRINUSE') continue;
      throw error;
    }
  }
  throw new Error(`Không tìm được cổng trống trong khoảng ${preferred}–${preferred + 9}`);
}

async function bootstrap() {
  loadEnvFile(path.join(ROOT, '.env'));
  const dbFile = process.env.CUNGLAM_DB || path.join(ROOT, 'data', 'cunglam.db');
  let db;
  try {
    db = openDb(dbFile);
  } catch (error) {
    console.error('\n  Không mở được cơ sở dữ liệu:', error.message);
    console.error('  Hãy giải nén ứng dụng ra Desktop hoặc Documents rồi chạy lại.\n');
    process.exitCode = 1;
    return;
  }
  const created = process.env.CUNGLAM_SEED === '0' ? false : seed(db);
  const preferred = Number(process.env.PORT) || 4321;
  const host = process.env.HOST || '127.0.0.1';
  const server = createApp({ db });

  let port;
  try {
    port = await listenWithFallback(server, preferred, host);
  } catch (error) {
    console.error('\n  Không thể khởi động Cùng Làm:', error.message);
    console.error('  Hãy đóng ứng dụng khác đang dùng cổng này rồi chạy lại.\n');
    process.exitCode = 1;
    return;
  }

  const displayHost = host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host;
  const url = `http://${displayHost}:${port}`;
  try {
    fs.writeFileSync(path.join(path.dirname(dbFile), 'url.txt'), url, 'utf8');
  } catch {
    /* không ghi được cũng không ảnh hưởng */
  }

  console.log('');
  console.log('  ============================================================');
  console.log(`   CÙNG LÀM ĐÃ SẴN SÀNG:  ${url}`);
  console.log('   Trình duyệt không tự mở? Nhấp đúp MO-TRINH-DUYET.bat');
  console.log('  ============================================================');
  console.log('');
  if (port !== preferred) {
    console.log(`   (Cổng ${preferred} đang bận nên đã chuyển sang ${port})`);
  }
  console.log(`   Cơ sở dữ liệu: ${dbFile}${created ? ' (đã tạo dữ liệu mẫu)' : ''}`);
  if (process.env.CUNGLAM_SEED !== '0') {
    console.log('   Đăng nhập demo: an@cunglam.vn / demo1234');
  }
  console.log('   Đóng cửa sổ này để tắt ứng dụng.');
  console.log('');

  if (process.env.CUNGLAM_OPEN === '1' && process.platform === 'win32') {
    openBrowser(url);
  }

  const shutdown = () => {
    server.close(() => {
      try {
        db.close();
      } catch {
        /* ignore */
      }
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  bootstrap().catch((error) => {
    console.error('\n  Lỗi khởi động:', error?.message ?? error);
    process.exitCode = 1;
  });
}
