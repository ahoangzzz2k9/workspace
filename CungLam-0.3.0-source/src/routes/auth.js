import { createSession, destroySession, hashPassword, verifyPassword, SESSION_COOKIE, requireUser } from '../auth.js';
import { render, redirectOk, redirectErr, parseSkills, skillsToText, parseCsv, isEmail, param, clampInt, safeNext } from './util.js';
import { formField, formArea, formSelect, LEVELS, esc } from '../views.js';
import { profileOf, notify } from '../data.js';

const AUTH_STYLE = `<section class="auth-layout">
  <div class="auth-card">`;

function authShell(inner) {
  return `${AUTH_STYLE}${inner}</div>
  <aside class="auth-side">
    <h2>Ý tưởng cần người.<br>Kinh nghiệm cần dự án.</h2>
    <ul class="checklist">
      <li>Tạo dự án và khai báo đúng vai trò còn thiếu.</li>
      <li>Được gợi ý người phù hợp thay vì tự đi tìm.</li>
      <li>Làm việc trong workspace chung, tiến độ rõ ràng.</li>
      <li>Hoàn thành dự án là có bằng chứng đóng góp thật.</li>
    </ul>
    <p class="muted small">Bản MVP dùng dữ liệu demo, không có giao dịch tiền thật.</p>
  </aside>
</section>`;
}

function loginPage({ values = {}, error = '', next = '/projects' }) {
  return authShell(`
    <h1>Đăng nhập</h1>
    <p class="muted">Tiếp tục với hồ sơ năng lực của bạn.</p>
    ${error ? `<div class="banner banner-err">${esc(error)}</div>` : ''}
    <form method="post" action="/login" class="stack">
      <input type="hidden" name="next" value="${esc(next)}">
      ${formField({ label: 'Email', name: 'email', type: 'email', value: values.email ?? '', required: true, autocomplete: 'email', placeholder: 'ban@truong.edu.vn' })}
      ${formField({ label: 'Mật khẩu', name: 'password', type: 'password', required: true, autocomplete: 'current-password' })}
      <button class="btn btn-primary btn-block" type="submit">Đăng nhập</button>
    </form>
    <p class="auth-switch">Chưa có tài khoản? <a href="/register">Tạo tài khoản</a></p>
    <div class="demo-box">
      <p class="demo-title">Tài khoản demo</p>
      <p><code>an@cunglam.vn</code> · mật khẩu <code>demo1234</code></p>
      <p class="muted small">Tài khoản này đang có dự án, ứng viên chờ duyệt và thông báo để bạn thử toàn bộ luồng.</p>
      <p class="muted small">Các tài khoản khác: huy@, vy@, long@, linh@, tran@, quang@, mai@ (cùng mật khẩu).</p>
    </div>
  `);
}

function registerPage({ values = {}, error = '', roles = ['creator', 'participant'] }) {
  return authShell(`
    <h1>Tạo tài khoản</h1>
    <p class="muted">Một tài khoản có thể vừa tạo dự án, vừa tham gia dự án.</p>
    ${error ? `<div class="banner banner-err">${esc(error)}</div>` : ''}
    <form method="post" action="/register" class="stack">
      ${formField({ label: 'Họ và tên', name: 'full_name', value: values.full_name ?? '', required: true, autocomplete: 'name', placeholder: 'Nguyễn Minh Anh' })}
      ${formField({ label: 'Email', name: 'email', type: 'email', value: values.email ?? '', required: true, autocomplete: 'email', placeholder: 'ban@truong.edu.vn' })}
      ${formField({ label: 'Mật khẩu', name: 'password', type: 'password', required: true, autocomplete: 'new-password', hint: 'Tối thiểu 8 ký tự.' })}
      <fieldset class="field">
        <legend class="field-label">Bạn muốn bắt đầu với vai trò nào?</legend>
        <label class="check"><input type="checkbox" name="role_creator" value="1" ${roles.includes('creator') ? 'checked' : ''}> <span><strong>Creator</strong> — tạo và quản lý dự án</span></label>
        <label class="check"><input type="checkbox" name="role_participant" value="1" ${roles.includes('participant') ? 'checked' : ''}> <span><strong>Participant</strong> — tìm và tham gia dự án</span></label>
        <span class="field-hint">Có thể bật lại vai trò còn thiếu trong phần hồ sơ.</span>
      </fieldset>
      <button class="btn btn-primary btn-block" type="submit">Tạo tài khoản</button>
    </form>
    <p class="auth-switch">Đã có tài khoản? <a href="/login">Đăng nhập</a></p>
  `);
}

function onboardingPage({ user, profile, values = {}, error = '' }) {
  const skillsText = values.skills_text ?? skillsToText(profile?.skills ?? []);
  const desired = values.desired_roles ?? (profile?.desired_roles ?? []).join(', ');
  const interests = values.interests ?? (profile?.interests ?? []).join(', ');
  return `
  <section class="page-head">
    <p class="eyebrow">Phỏng vấn năng lực</p>
    <h1>Hồ sơ của bạn bắt đầu từ đây</h1>
    <p class="lead">Thay vì một CV tự khai, Cùng Làm hỏi bạn vài câu giống một buổi phỏng vấn ngắn. Thông tin này dùng để gợi ý dự án và vai trò phù hợp — bạn có thể sửa bất cứ lúc nào.</p>
    <p class="muted small">Bước 2/2 · Tài khoản: ${esc(user.email)}</p>
  </section>
  ${error ? `<div class="banner banner-err">${esc(error)}</div>` : ''}
  <form method="post" action="/onboarding" class="card form-card stack">
    ${formArea({
      label: 'Bạn có những kỹ năng nào?',
      name: 'skills_text',
      value: skillsText,
      rows: 5,
      required: true,
      placeholder: 'React: 4\\nSQL: 3\\nUI/UX: 2',
      hint: 'Mỗi dòng một kỹ năng, kèm mức độ 1–5. Ví dụ "React: 4". Mức 1 là mới biết, 5 là thành thạo.'
    })}
    <div class="grid-2">
      ${formSelect({
        label: 'Trình độ chung',
        name: 'experience_level',
        value: values.experience_level ?? profile?.experience_level ?? 'beginner',
        options: Object.entries(LEVELS).map(([value, label]) => ({ value, label }))
      })}
      ${formField({
        label: 'Số giờ mỗi tuần có thể dành cho dự án',
        name: 'weekly_hours',
        type: 'number',
        value: values.weekly_hours ?? profile?.weekly_hours ?? 8,
        required: true,
        min: 1,
        max: 60
      })}
    </div>
    ${formField({
      label: 'Vai trò bạn muốn đảm nhận',
      name: 'desired_roles',
      value: desired,
      placeholder: 'Frontend Developer, UI/UX Designer',
      hint: 'Cách nhau bằng dấu phẩy.'
    })}
    ${formField({
      label: 'Lĩnh vực bạn quan tâm',
      name: 'interests',
      value: interests,
      placeholder: 'Giáo dục, Tài chính',
      hint: 'Dùng để ưu tiên dự án cùng lĩnh vực.'
    })}
    ${formArea({
      label: 'Kinh nghiệm thực tế bạn đã có',
      name: 'experience',
      value: values.experience ?? profile?.experience ?? '',
      rows: 3,
      placeholder: 'Đồ án, dự án freelance, câu lạc bộ, cuộc thi…'
    })}
    ${formArea({
      label: 'Mục tiêu của bạn khi tham gia Cùng Làm',
      name: 'goal',
      value: values.goal ?? profile?.goal ?? '',
      rows: 3,
      placeholder: 'Ví dụ: có 2 dự án thật trong portfolio trước khi tốt nghiệp.'
    })}
    <div class="form-actions">
      <button class="btn btn-primary" type="submit">Lưu hồ sơ và bắt đầu</button>
      <span class="muted small">Có thể cập nhật sau trong mục Hồ sơ.</span>
    </div>
  </form>`;
}

export function registerAuthRoutes(router) {
  router.get('/login', (ctx) => {
    if (ctx.user) {
      ctx.redirect('/projects');
      return;
    }
    render(ctx, {
      title: 'Đăng nhập · Cùng Làm',
      body: loginPage({ next: safeNext(ctx.query.get('next')) })
    });
  });

  router.post('/login', (ctx) => {
    const email = param(ctx, 'email').toLowerCase();
    const password = ctx.body.password ?? '';
    const next = safeNext(param(ctx, 'next', '/projects'));
    const user = ctx.db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(email);
    if (!user || !verifyPassword(password, user.password_hash)) {
      render(ctx, {
        title: 'Đăng nhập · Cùng Làm',
        body: loginPage({ values: { email }, error: 'Email hoặc mật khẩu không đúng.', next })
      });
      return;
    }
    const token = createSession(ctx.db, user.id);
    ctx.setCookie(SESSION_COOKIE, token, { maxAge: 30 * 86400 });
    ctx.redirect(next);
  });

  router.get('/register', (ctx) => {
    if (ctx.user) {
      ctx.redirect('/projects');
      return;
    }
    render(ctx, { title: 'Tạo tài khoản · Cùng Làm', body: registerPage({}) });
  });

  router.post('/register', (ctx) => {
    const fullName = param(ctx, 'full_name');
    const email = param(ctx, 'email').toLowerCase();
    const password = ctx.body.password ?? '';
    const roles = [];
    if (ctx.body.role_creator === '1') roles.push('creator');
    if (ctx.body.role_participant === '1') roles.push('participant');

    const values = { full_name: fullName, email };
    const fail = (message) =>
      render(ctx, {
        title: 'Tạo tài khoản · Cùng Làm',
        body: registerPage({ values, error: message, roles: roles.length ? roles : ['creator', 'participant'] })
      });

    if (fullName.length < 2) return fail('Vui lòng nhập họ tên đầy đủ.');
    if (!isEmail(email)) return fail('Email chưa đúng định dạng.');
    if (password.length < 8) return fail('Mật khẩu cần ít nhất 8 ký tự.');
    if (roles.length === 0) return fail('Chọn ít nhất một vai trò để bắt đầu.');
    if (ctx.db.prepare('SELECT 1 FROM users WHERE LOWER(email) = ?').get(email)) {
      return fail('Email này đã có tài khoản. Hãy đăng nhập.');
    }

    const now = new Date().toISOString();
    const info = ctx.db
      .prepare(
        `INSERT INTO users (email, password_hash, full_name, headline, bio, location, avatar_hue, created_at)
         VALUES (?, ?, ?, '', '', '', ?, ?)`
      )
      .run(email, hashPassword(password), fullName, Math.floor(Math.random() * 360), now);
    const userId = Number(info.lastInsertRowid);
    for (const role of roles) {
      ctx.db.prepare('INSERT INTO user_roles (user_id, role) VALUES (?, ?)').run(userId, role);
    }
    ctx.db.prepare('INSERT INTO profiles (user_id) VALUES (?)').run(userId);
    notify(ctx.db, userId, {
      type: 'welcome',
      title: 'Chào mừng bạn đến với Cùng Làm',
      body: 'Hoàn tất hồ sơ năng lực để bắt đầu được gợi ý dự án phù hợp.',
      link: '/onboarding'
    });

    const token = createSession(ctx.db, userId);
    ctx.setCookie(SESSION_COOKIE, token, { maxAge: 30 * 86400 });
    ctx.redirect('/onboarding');
  });

  router.post('/logout', (ctx) => {
    destroySession(ctx.db, ctx.cookies[SESSION_COOKIE]);
    ctx.clearCookie(SESSION_COOKIE);
    ctx.redirect('/');
  });

  router.get('/onboarding', (ctx) => {
    const user = requireUser(ctx);
    if (!user) return;
    render(ctx, {
      title: 'Hồ sơ năng lực · Cùng Làm',
      active: '/me',
      body: onboardingPage({ user, profile: profileOf(ctx.db, user.id) })
    });
  });

  router.post('/onboarding', (ctx) => {
    const user = requireUser(ctx);
    if (!user) return;
    const skills = parseSkills(ctx.body.skills_text);
    const hours = clampInt(ctx.body.weekly_hours, 1, 60, 0);
    if (skills.length === 0) {
      render(ctx, {
        title: 'Hồ sơ năng lực · Cùng Làm',
        active: '/me',
        body: onboardingPage({
          user,
          profile: profileOf(ctx.db, user.id),
          values: ctx.body,
          error: 'Khai báo ít nhất một kỹ năng, mỗi dòng theo dạng "Tên kỹ năng: mức độ".'
        })
      });
      return;
    }
    if (hours === 0) {
      render(ctx, {
        title: 'Hồ sơ năng lực · Cùng Làm',
        active: '/me',
        body: onboardingPage({
          user,
          profile: profileOf(ctx.db, user.id),
          values: ctx.body,
          error: 'Số giờ mỗi tuần cần nằm trong khoảng 1–60.'
        })
      });
      return;
    }
    const level = ['beginner', 'intermediate', 'advanced'].includes(ctx.body.experience_level)
      ? ctx.body.experience_level
      : 'beginner';
    ctx.db
      .prepare(
        `UPDATE profiles SET skills = ?, experience_level = ?, experience = ?, desired_roles = ?, interests = ?,
         weekly_hours = ?, goal = ?, onboarded_at = ? WHERE user_id = ?`
      )
      .run(
        JSON.stringify(skills),
        level,
        param(ctx, 'experience').slice(0, 1500),
        JSON.stringify(parseCsv(ctx.body.desired_roles, 6)),
        JSON.stringify(parseCsv(ctx.body.interests, 6)),
        hours,
        param(ctx, 'goal').slice(0, 500),
        new Date().toISOString(),
        user.id
      );
    redirectOk(ctx, '/projects', 'Hồ sơ năng lực đã sẵn sàng. Bắt đầu tìm dự án phù hợp nhé!');
  });
}
