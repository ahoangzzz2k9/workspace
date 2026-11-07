/**
 * Chụp ảnh mobile thật (390x844, DPR 2) qua Chrome DevTools Protocol
 * và kiểm tra điều kiện cài đặt PWA.
 *
 * Chạy: node tools/mobile_shots.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CHROME =
  process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:4321';
const PORT = 9337;
const profile = path.resolve('.tmp-chrome');
const outDir = path.resolve('docs', 'screenshots');
fs.mkdirSync(outDir, { recursive: true });
fs.rmSync(profile, { recursive: true, force: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    'about:blank'
  ],
  { stdio: 'ignore' }
);

async function waitForDevtools() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (response.ok) return response.json();
    } catch {
      /* chờ Chrome khởi động */
    }
    await sleep(250);
  }
  throw new Error('Chrome DevTools không khởi động được');
}

const version = await waitForDevtools();
const targetResponse = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' });
const target = await targetResponse.json();

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let messageId = 0;
const pending = new Map();
const events = new Map();

socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error)));
    else resolve(message.result);
    return;
  }
  if (message.method) {
    const waiters = events.get(message.method);
    if (waiters) {
      events.delete(message.method);
      waiters.forEach((resolve) => resolve(message.params));
    }
  }
});

function send(method, params = {}) {
  messageId += 1;
  const id = messageId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

function once(method, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Hết thời gian chờ ${method}`)), timeoutMs);
    const handler = (params) => {
      clearTimeout(timer);
      resolve(params);
    };
    events.set(method, [...(events.get(method) ?? []), handler]);
  });
}

await send('Page.enable');
await send('Network.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 844,
  deviceScaleFactor: 2,
  mobile: true,
  screenWidth: 390,
  screenHeight: 844
});
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await send('Emulation.setUserAgentOverride', {
  userAgent:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  platform: 'Linux armv8l'
});

// Đăng nhập qua API để có cookie phiên, rồi gắn cookie vào trình duyệt.
const loginResponse = await fetch(`${BASE}/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ email: 'an@cunglam.vn', password: 'demo1234' }),
  redirect: 'manual'
});
const cookies = loginResponse.headers.getSetCookie();
const sessionCookie = cookies.find((cookie) => cookie.startsWith('cl_sid='));
const sessionValue = sessionCookie.split(';')[0].split('=')[1];
await send('Network.setCookie', {
  name: 'cl_sid',
  value: sessionValue,
  domain: '127.0.0.1',
  path: '/',
  httpOnly: true
});

async function capture(url, name) {
  const loaded = once('Page.loadEventFired');
  await send('Page.navigate', { url });
  await loaded;
  await sleep(1400);
  const { data } = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(path.join(outDir, `${name}.png`), Buffer.from(data, 'base64'));
  console.log(`đã chụp ${name}.png (${url})`);
}

await capture(`${BASE}/`, 'mobile-home');
await capture(`${BASE}/projects`, 'mobile-projects');
await capture(`${BASE}/projects/1/workspace`, 'mobile-workspace');
await capture(`${BASE}/projects/1/manage`, 'mobile-manage');

// Kiểm tra điều kiện cài đặt
await send('Page.navigate', { url: `${BASE}/` });
await once('Page.loadEventFired');
await sleep(2500);

const manifest = await send('Page.getAppManifest');
console.log('manifest url:', manifest.url);
console.log('manifest lỗi:', JSON.stringify(manifest.errors));

const installability = await send('Page.getInstallabilityErrors').catch((error) => ({
  installabilityErrors: [{ errorId: 'unsupported', errorArguments: [{ name: String(error) }] }]
}));
console.log('installability:', JSON.stringify(installability));

const swState = await send('Runtime.evaluate', {
  expression:
    "navigator.serviceWorker.getRegistrations().then(r => JSON.stringify({count: r.length, scope: r[0]?.scope, active: !!r[0]?.active}))",
  awaitPromise: true,
  returnByValue: true
});
console.log('service worker:', swState.result.value);

socket.close();
chrome.kill();
await sleep(600);
try {
  fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
} catch {
  /* Windows đôi khi còn giữ file của Chrome; không ảnh hưởng kết quả */
}
console.log('xong');
