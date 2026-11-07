import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.js';
import { seed } from '../src/seed.js';
import { createApp } from '../server.js';

let server;
let base;
let db;

class Client {
  constructor() {
    this.cookies = new Map();
  }

  async request(method, path, form) {
    const headers = {};
    if (this.cookies.size > 0) {
      headers.cookie = [...this.cookies.entries()].map(([key, value]) => `${key}=${value}`).join('; ');
    }
    let body;
    if (form) {
      headers['content-type'] = 'application/x-www-form-urlencoded';
      body = new URLSearchParams(form).toString();
    }
    const response = await fetch(base + path, { method, headers, body, redirect: 'manual' });
    if (typeof response.headers.getSetCookie === 'function') {
      for (const cookie of response.headers.getSetCookie()) {
        const [pair] = cookie.split(';');
        const index = pair.indexOf('=');
        const name = pair.slice(0, index).trim();
        const value = decodeURIComponent(pair.slice(index + 1).trim());
        if (/max-age=0/i.test(cookie) || value === '') this.cookies.delete(name);
        else this.cookies.set(name, value);
      }
    }
    return {
      status: response.status,
      location: response.headers.get('location') ?? '',
      text: response.status === 303 || response.status === 302 ? '' : await response.text()
    };
  }

  get(path) {
    return this.request('GET', path);
  }

  post(path, form = {}) {
    return this.request('POST', path, form);
  }

  async register({ name, email, password = 'secret123', roles = ['creator', 'participant'] }) {
    return this.post('/register', {
      full_name: name,
      email,
      password,
      ...(roles.includes('creator') ? { role_creator: '1' } : {}),
      ...(roles.includes('participant') ? { role_participant: '1' } : {})
    });
  }

  async onboard({ skills = 'React: 4\nSQL: 3', hours = 10 } = {}) {
    return this.post('/onboarding', {
      skills_text: skills,
      weekly_hours: String(hours),
      experience_level: 'intermediate',
      desired_roles: 'Frontend Developer',
      interests: 'Giáo dục',
      experience: 'Đồ án môn học',
      goal: 'Có portfolio thật'
    });
  }

  async login(email, password = 'demo1234') {
    return this.post('/login', { email, password, next: '/projects' });
  }
}

test.before(async () => {
  db = openDb(':memory:');
  seed(db);
  server = createApp({ db, log: false });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  db.close();
});

test('trang chủ và danh sách dự án render được', async () => {
  const client = new Client();
  const home = await client.get('/');
  assert.equal(home.status, 200);
  assert.match(home.text, /Ý tưởng cần người/);
  assert.match(home.text, /Dự án đang tìm người/);
  assert.match(home.text, /Số liệu tính trực tiếp từ dữ liệu/);

  const projects = await client.get('/projects');
  assert.equal(projects.status, 200);
  assert.match(projects.text, /đang tuyển/i);
});

test('đăng nhập sai bị từ chối, đúng thì vào được trang cá nhân', async () => {
  const client = new Client();
  const bad = await client.post('/login', { email: 'an@cunglam.vn', password: 'sai-mat-khau' });
  assert.equal(bad.status, 200);
  assert.match(bad.text, /Email hoặc mật khẩu không đúng/);

  const ok = await client.login('an@cunglam.vn');
  assert.equal(ok.status, 303);
  assert.equal(ok.location, '/projects');

  const me = await client.get('/me');
  assert.equal(me.status, 200);
  assert.match(me.text, /Nguyễn Minh Anh/);
  assert.match(me.text, /điểm uy tín/);
});

test('khách không xem được thông tin nội bộ, thành viên thì xem được', async () => {
  const guest = new Client();
  const detail = await guest.get('/projects/1');
  assert.equal(detail.status, 200);
  assert.match(detail.text, /Thông tin nội bộ/);
  assert.match(detail.text, /Đang khoá/);

  const member = new Client();
  await member.login('long@cunglam.vn');
  const memberView = await member.get('/projects/1');
  assert.match(memberView.text, /Thuật toán xếp lịch/);
  assert.doesNotMatch(memberView.text, /Đang khoá/);
});

test('người ngoài không vào được workspace và trang quản lý', async () => {
  const outsider = new Client();
  await outsider.login('mai@cunglam.vn');
  assert.equal((await outsider.get('/projects/1/workspace')).status, 403);
  assert.equal((await outsider.get('/projects/1/manage')).status, 403);
});

test('đăng ký mới: chưa onboard thì không ứng tuyển được', async () => {
  const client = new Client();
  const res = await client.register({ name: 'Người Kiểm Thử', email: 'test1@example.com' });
  assert.equal(res.status, 303);
  assert.equal(res.location, '/onboarding');

  const onboarding = await client.get('/onboarding');
  assert.equal(onboarding.status, 200);
  assert.match(onboarding.text, /Phỏng vấn năng lực/);

  const apply = await client.post('/projects/1/apply', { role_id: '2', message: 'Mình rất muốn tham gia dự án này để học hỏi thêm.' });
  assert.equal(apply.status, 303);
  assert.match(decodeURIComponent(apply.location), /Hoàn tất hồ sơ/);

  const onboard = await client.onboard();
  assert.equal(onboard.status, 303);

  const applied = await client.post('/projects/1/apply', {
    role_id: '2',
    message: 'Mình rất muốn tham gia dự án này để học hỏi thêm về thiết kế.'
  });
  assert.equal(applied.status, 303);
  assert.match(decodeURIComponent(applied.location), /Đã gửi ứng tuyển/);
});

test('luồng đầy đủ: tạo dự án → ứng tuyển → nhận → task → tiến độ → hoàn thành', async () => {
  const creator = new Client();
  await creator.login('an@cunglam.vn');

  const created = await creator.post('/projects', {
    title: 'Ứng dụng học từ vựng theo ngữ cảnh',
    summary: 'Học từ vựng qua câu chuyện ngắn và ôn tập cách quãng.',
    problem: 'Người học ghi nhớ từ vựng kém vì học rời rạc, thiếu ngữ cảnh thực tế.',
    goal: 'Ra mắt bản thử nghiệm cho 50 người dùng trong 4 tuần.',
    field: 'Giáo dục',
    stage: 'y-tuong',
    commitment_hours: '6',
    duration_weeks: '4',
    role_title: 'Frontend Developer',
    role_seats: '1',
    role_skills: 'React, CSS',
    role_description: 'Làm màn hình học và ôn tập.',
    visibility: 'public'
  });
  assert.equal(created.status, 303);
  const projectId = Number(created.location.match(/\/projects\/(\d+)/)[1]);
  assert.ok(projectId > 0);

  const role = db.prepare('SELECT * FROM project_roles WHERE project_id = ?').get(projectId);
  assert.ok(role);

  const applicant = new Client();
  await applicant.register({ name: 'Lê Ứng Viên', email: 'test2@example.com' });
  await applicant.onboard({ skills: 'React: 4\nCSS: 4' });

  const applied = await applicant.post(`/projects/${projectId}/apply`, {
    role_id: String(role.id),
    message: 'Mình đã làm 3 giao diện React và muốn có thêm dự án thật trong portfolio.'
  });
  assert.equal(applied.status, 303);
  assert.match(decodeURIComponent(applied.location), /Đã gửi ứng tuyển/);

  const application = db
    .prepare('SELECT * FROM applications WHERE project_id = ? AND user_id = (SELECT id FROM users WHERE email = ?)')
    .get(projectId, 'test2@example.com');
  assert.ok(application);
  assert.equal(application.status, 'pending');

  const manage = await creator.get(`/projects/${projectId}/manage`);
  assert.match(manage.text, /Lê Ứng Viên/);
  assert.match(manage.text, /Nhận vào team/);

  const accepted = await creator.post(`/applications/${application.id}/accept`);
  assert.equal(accepted.status, 303);
  assert.match(decodeURIComponent(accepted.location), /Đã nhận Lê Ứng Viên/);

  const member = db
    .prepare("SELECT * FROM memberships WHERE project_id = ? AND status = 'active' AND role_title = 'Frontend Developer'")
    .get(projectId);
  assert.ok(member, 'thành viên mới phải có membership active');

  const workspace = await applicant.get(`/projects/${projectId}/workspace`);
  assert.equal(workspace.status, 200);
  assert.match(workspace.text, /Bảng công việc/);
  assert.match(workspace.text, /Thoả thuận dự án/);

  const agreement = db.prepare('SELECT * FROM agreements WHERE project_id = ?').get(projectId);
  assert.ok(agreement, 'phải tự tạo thoả thuận khi nhận người đầu tiên');
  const parts = db.prepare('SELECT * FROM agreement_parts WHERE agreement_id = ?').all(agreement.id);
  assert.equal(parts.length, 2);
  assert.equal(parts.reduce((sum, part) => sum + part.percent, 0), 100);

  const task = await applicant.post(`/projects/${projectId}/tasks`, {
    title: 'Làm màn hình ôn tập từ vựng',
    description: 'Dùng dữ liệu mẫu, chưa cần API.',
    assignee_id: String(member.user_id),
    due_date: new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10),
    priority: 'high'
  });
  assert.equal(task.status, 303);

  const taskRow = db.prepare('SELECT * FROM tasks WHERE project_id = ?').get(projectId);
  assert.ok(taskRow);

  const done = await applicant.post(`/tasks/${taskRow.id}/status`, { status: 'done' });
  assert.equal(done.status, 303);
  assert.equal(db.prepare('SELECT status FROM tasks WHERE id = ?').get(taskRow.id).status, 'done');

  const blocked = await applicant.post(`/tasks/${taskRow.id}/blocked`, { reason: 'Chờ dữ liệu từ creator' });
  assert.equal(blocked.status, 303);

  const complete = await creator.post(`/projects/${projectId}/complete`);
  assert.equal(complete.status, 303);

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  assert.equal(project.status, 'completed');

  const contributions = db.prepare('SELECT * FROM contributions WHERE project_id = ?').all(projectId);
  assert.equal(contributions.length, 2);
  const totalTasks = contributions.reduce((sum, row) => sum + row.tasks_done, 0);
  assert.equal(totalTasks, 1);

  const reputation = db.prepare('SELECT COALESCE(SUM(points), 0) AS p FROM reputation_events WHERE project_id = ?').get(projectId);
  assert.ok(reputation.p >= 6 + 1);

  const showcase = await new Client().get('/showcase');
  assert.match(showcase.text, /Ứng dụng học từ vựng theo ngữ cảnh/);

  const profile = await applicant.get(`/people/${member.user_id}`);
  assert.match(profile.text, /Đóng góp được ghi nhận/);
});

test('lời mời: creator mời, người được mời chấp nhận thì thành thành viên', async () => {
  const creator = new Client();
  await creator.login('an@cunglam.vn');

  const project = db.prepare("SELECT * FROM projects WHERE status = 'recruiting' AND creator_id = (SELECT id FROM users WHERE email = 'an@cunglam.vn')").get();
  assert.ok(project);
  const role = db
    .prepare(
      `SELECT r.* FROM project_roles r WHERE r.project_id = ? AND r.filled < r.seats
       AND NOT EXISTS (SELECT 1 FROM memberships m WHERE m.project_id = r.project_id AND m.user_id = m.user_id)`
    )
    .get(project.id) ?? db.prepare('SELECT * FROM project_roles WHERE project_id = ? AND filled < seats LIMIT 1').get(project.id);
  assert.ok(role);

  const invitee = new Client();
  await invitee.register({ name: 'Người Được Mời', email: 'test3@example.com' });
  await invitee.onboard({ skills: 'React: 3\nTypeScript: 3' });
  const inviteeId = db.prepare('SELECT id FROM users WHERE email = ?').get('test3@example.com').id;

  const invited = await creator.post(`/projects/${project.id}/invite`, {
    role_id: String(role.id),
    invitee_id: String(inviteeId),
    message: 'Mời bạn tham gia dự án.'
  });
  assert.equal(invited.status, 303);

  const invite = db.prepare('SELECT * FROM invites WHERE invitee_id = ?').get(inviteeId);
  assert.ok(invite);
  assert.equal(invite.status, 'pending');

  const page = await invitee.get('/invites');
  assert.match(page.text, /Lời mời tham gia/);

  const accepted = await invitee.post(`/invites/${invite.id}/accept`);
  assert.equal(accepted.status, 303);

  const membership = db
    .prepare("SELECT * FROM memberships WHERE project_id = ? AND user_id = ? AND status = 'active'")
    .get(project.id, inviteeId);
  assert.ok(membership);

  const workspace = await invitee.get(`/projects/${project.id}/workspace`);
  assert.equal(workspace.status, 200);
});

test('thông báo: có thể đánh dấu đã đọc', async () => {
  const client = new Client();
  await client.login('an@cunglam.vn');
  const before = db.prepare('SELECT COUNT(*) AS c FROM notifications WHERE read_at IS NULL').get().c;
  const page = await client.get('/me/notifications');
  assert.equal(page.status, 200);
  const res = await client.post('/notifications/read-all');
  assert.equal(res.status, 303);
  const after = db.prepare('SELECT COUNT(*) AS c FROM notifications WHERE read_at IS NULL').get().c;
  assert.ok(after < before);
});

test('tìm kiếm và lọc dự án theo kỹ năng', async () => {
  const client = new Client();
  const result = await client.get('/projects?skill=Figma');
  assert.equal(result.status, 200);
  assert.match(result.text, /Lịch học thông minh/);

  const people = await client.get('/people?q=Minh');
  assert.equal(people.status, 200);
  assert.match(people.text, /Nguyễn Minh Anh/);
});

test('không thể ứng tuyển dự án của chính mình và không tự nhận mình', async () => {
  const creator = new Client();
  await creator.login('an@cunglam.vn');
  const project = db.prepare("SELECT * FROM projects WHERE creator_id = (SELECT id FROM users WHERE email = 'an@cunglam.vn')").get();
  const role = db.prepare('SELECT * FROM project_roles WHERE project_id = ?').get(project.id);
  const res = await creator.post(`/projects/${project.id}/apply`, {
    role_id: String(role.id),
    message: 'Tôi tự ứng tuyển vào dự án của chính mình để kiểm tra.'
  });
  assert.equal(res.status, 303);
  assert.match(decodeURIComponent(res.location), /đã ở trong dự án/i);
});

test('creator sửa thông tin dự án và xoá thành viên khỏi team', async () => {
  const project = db.prepare("SELECT * FROM projects WHERE title = 'Ứng dụng học từ vựng theo ngữ cảnh'").get();
  assert.ok(project);

  const creator = new Client();
  await creator.login('an@cunglam.vn');

  const edited = await creator.post(`/projects/${project.id}/edit`, {
    title: 'Ứng dụng học từ vựng theo ngữ cảnh (v2)',
    summary: 'Học từ vựng qua truyện ngắn, có ôn tập cách quãng và báo cáo tiến bộ.',
    problem: 'Người học ghi nhớ từ vựng kém vì học rời rạc, thiếu ngữ cảnh thực tế.',
    goal: 'Ra mắt bản thử nghiệm cho 100 người dùng trong 6 tuần.',
    field: 'Giáo dục',
    stage: 'prototype',
    commitment_hours: '8',
    duration_weeks: '6',
    sensitive_note: 'Bộ dữ liệu câu chuyện mẫu.',
    visibility: 'public'
  });
  assert.equal(edited.status, 303);
  assert.equal(db.prepare('SELECT title FROM projects WHERE id = ?').get(project.id).title, 'Ứng dụng học từ vựng theo ngữ cảnh (v2)');

  const outsider = new Client();
  await outsider.login('mai@cunglam.vn');
  assert.equal((await outsider.get(`/projects/${project.id}/edit`)).status, 403);

  const member = db
    .prepare("SELECT * FROM memberships WHERE project_id = ? AND user_id = (SELECT id FROM users WHERE email = 'test2@example.com')")
    .get(project.id);
  assert.ok(member);
  const removed = await creator.post(`/projects/${project.id}/members/${member.user_id}/remove`);
  assert.equal(removed.status, 303);
  assert.equal(db.prepare('SELECT status FROM memberships WHERE id = ?').get(member.id).status, 'removed');

  const removedUser = new Client();
  await removedUser.login('test2@example.com', 'secret123');
  assert.equal((await removedUser.get(`/projects/${project.id}/workspace`)).status, 403);
});

test('PWA: manifest, service worker, offline page và icon', async () => {
  const client = new Client();

  const manifestResponse = await fetch(`${base}/manifest.webmanifest`);
  assert.equal(manifestResponse.status, 200);
  assert.match(manifestResponse.headers.get('content-type'), /application\/manifest\+json/);
  const manifest = await manifestResponse.json();
  assert.equal(manifest.short_name, 'Cùng Làm');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, '/?source=pwa');
  assert.ok(manifest.icons.some((icon) => icon.purpose === 'maskable'));
  assert.ok(manifest.icons.some((icon) => icon.sizes === '192x192'));

  const swResponse = await fetch(`${base}/sw.js`);
  assert.equal(swResponse.status, 200);
  assert.equal(swResponse.headers.get('service-worker-allowed'), '/');
  assert.match(swResponse.headers.get('cache-control'), /no-cache/);

  const offline = await client.get('/offline');
  assert.equal(offline.status, 200);
  assert.match(offline.text, /Bạn đang ngoại tuyến/);

  const appPage = await client.get('/app');
  assert.equal(appPage.status, 200);
  assert.match(appPage.text, /Cài Cùng Làm thành app/);

  const health = await fetch(`${base}/health`);
  assert.equal(health.status, 200);
  const healthBody = await health.json();
  assert.equal(healthBody.status, 'ok');

  const home = await client.get('/');
  assert.match(home.text, /rel="manifest" href="\/manifest.webmanifest"/);
  assert.match(home.text, /name="theme-color" content="#0f766e"/);
  assert.match(home.text, /class="tabbar"/);
  assert.match(home.text, /apple-touch-icon/);

  const icon = await fetch(`${base}/static/icons/icon-192.png`);
  assert.equal(icon.status, 200);
  assert.equal(icon.headers.get('content-type'), 'image/png');
});

test('trang 404 trả đúng mã lỗi', async () => {
  const client = new Client();
  const res = await client.get('/khong-ton-tai');
  assert.equal(res.status, 404);
  assert.match(res.text, /Không tìm thấy trang/);
});
