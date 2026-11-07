import { esc, avatar, skillChips, timeAgo, formatDate, progressBar, emptyState, formField, formArea, formSelect, LEVELS, PROJECT_STATUS } from '../views.js';
import { render, redirectOk, redirectErr, param, clampInt, parseSkills, skillsToText, parseCsv, isEmail } from './util.js';
import {
  userById,
  profileOf,
  trustProfile,
  membersOf,
  projectById,
  tasksOf,
  isCreator,
  isMember,
  notify,
  siteStats
} from '../data.js';
import { projectCard } from './projects.js';
import { agreementOf } from './manage.js';
import { tx, nowIso } from '../db.js';

const ROLE_LABEL = { creator: 'Creator', participant: 'Participant' };

function profileForm(ctx, user, profile, { error = '', values = {} } = {}) {
  const v = (key, fallback = '') => values[key] ?? fallback;
  const roles = ctx.db.prepare('SELECT role FROM user_roles WHERE user_id = ?').all(user.id).map((r) => r.role);
  return `${error ? `<div class="banner banner-err">${esc(error)}</div>` : ''}
  <form method="post" action="/me" class="card stack">
    <h2>Thông tin cơ bản</h2>
    <div class="grid-2">
      ${formField({ label: 'Họ và tên', name: 'full_name', value: v('full_name', user.full_name), required: true })}
      ${formField({ label: 'Email', name: 'email', value: user.email, type: 'email', hint: 'Email dùng để đăng nhập.' })}
    </div>
    ${formField({ label: 'Tiêu đề ngắn', name: 'headline', value: v('headline', user.headline), placeholder: 'Sinh viên CNTT · thích sản phẩm giáo dục' })}
    <div class="grid-2">
      ${formField({ label: 'Nơi ở', name: 'location', value: v('location', user.location), placeholder: 'Hà Nội' })}
      ${formField({ label: 'Giờ mỗi tuần cho dự án', name: 'weekly_hours', type: 'number', value: v('weekly_hours', profile?.weekly_hours ?? 8), min: 1, max: 60 })}
    </div>
    ${formArea({ label: 'Giới thiệu bản thân', name: 'bio', value: v('bio', user.bio), rows: 3, placeholder: 'Bạn đang học/làm gì, muốn làm dự án gì?' })}
    <h2>Năng lực</h2>
    ${formArea({
      label: 'Kỹ năng (mỗi dòng: Tên: mức 1–5)',
      name: 'skills_text',
      value: v('skills_text', skillsToText(profile?.skills ?? [])),
      rows: 5,
      hint: 'Ví dụ: React: 4. Mức 1 là mới biết, 5 là thành thạo.'
    })}
    <div class="grid-2">
      ${formSelect({
        label: 'Trình độ chung',
        name: 'experience_level',
        value: v('experience_level', profile?.experience_level ?? 'beginner'),
        options: Object.entries(LEVELS).map(([value, label]) => ({ value, label }))
      })}
      ${formField({ label: 'Vai trò mong muốn', name: 'desired_roles', value: v('desired_roles', (profile?.desired_roles ?? []).join(', ')), placeholder: 'Frontend Developer, UI/UX Designer' })}
    </div>
    ${formField({ label: 'Lĩnh vực quan tâm', name: 'interests', value: v('interests', (profile?.interests ?? []).join(', ')), placeholder: 'Giáo dục, Tài chính' })}
    ${formArea({ label: 'Kinh nghiệm đã có', name: 'experience', value: v('experience', profile?.experience ?? ''), rows: 3 })}
    ${formArea({ label: 'Mục tiêu khi tham gia Cùng Làm', name: 'goal', value: v('goal', profile?.goal ?? ''), rows: 2 })}
    <fieldset class="field">
      <legend class="field-label">Vai trò trên nền tảng</legend>
      <label class="check"><input type="checkbox" name="role_creator" value="1" ${roles.includes('creator') ? 'checked' : ''}> <span><strong>Creator</strong> — tạo và quản lý dự án</span></label>
      <label class="check"><input type="checkbox" name="role_participant" value="1" ${roles.includes('participant') ? 'checked' : ''}> <span><strong>Participant</strong> — tìm và tham gia dự án</span></label>
      <span class="field-hint">Cần ít nhất một vai trò.</span>
    </fieldset>
    <div class="form-actions">
      <button class="btn btn-primary" type="submit">Lưu hồ sơ</button>
      <a class="btn btn-ghost" href="/me/notifications">Thông báo</a>
    </div>
  </form>`;
}

export function registerMeRoutes(router) {
  router.get('/me', (ctx) => {
    if (!ctx.user) {
      ctx.redirect('/login?next=/me');
      return;
    }
    const profile = profileOf(ctx.db, ctx.user.id);
    const trust = trustProfile(ctx.db, ctx.user.id);
    const roles = ctx.db.prepare('SELECT role FROM user_roles WHERE user_id = ?').all(ctx.user.id).map((r) => r.role);
    const completed = trust.contributions.length;
    const body = `
    <section class="page-head split-head">
      <div class="profile-head">
        ${avatar(ctx.user, 'lg')}
        <div>
          <h1>${esc(ctx.user.full_name)}</h1>
          <p class="muted">${esc(ctx.user.headline || 'Chưa có tiêu đề')}${ctx.user.location ? ` · ${esc(ctx.user.location)}` : ''}</p>
          <div class="chip-row">${roles.map((role) => `<span class="chip chip-sm">${ROLE_LABEL[role]}</span>`).join('')}
            ${profile?.onboarded_at ? '' : '<span class="badge badge-pending">Hồ sơ chưa hoàn tất</span>'}</div>
        </div>
      </div>
      <div class="head-actions">
        <a class="btn btn-ghost" href="/people/${ctx.user.id}">Xem hồ sơ công khai</a>
        <a class="btn" href="/me/projects">Dự án của tôi</a>
      </div>
    </section>

    <div class="profile-grid">
      <div class="profile-main">
        ${
          profile?.onboarded_at
            ? ''
            : `<div class="banner banner-warn">Hồ sơ năng lực chưa hoàn tất — bạn cần <a href="/onboarding">làm phỏng vấn năng lực</a> trước khi ứng tuyển dự án.</div>`
        }
        <section class="card">
          <h2>Hồ sơ uy tín</h2>
          <div class="trust-grid">
            <div class="trust-stat"><strong>${trust.points}</strong><span>điểm uy tín</span></div>
            <div class="trust-stat"><strong>${trust.completedProjects}</strong><span>dự án hoàn thành</span></div>
            <div class="trust-stat"><strong>${trust.tasksDone}</strong><span>task đã xong</span></div>
            <div class="trust-stat"><strong>${trust.onTimeRate === null ? '—' : `${trust.onTimeRate}%`}</strong><span>đúng hạn</span></div>
          </div>
          <p class="muted small">Điểm uy tín đến từ bằng chứng: task hoàn thành, dự án hoàn thành và xác nhận của team — không phải tự khai.</p>
        </section>
        <section class="card">
          <h2>Đóng góp đã được ghi nhận</h2>
          ${
            trust.contributions.length
              ? `<ul class="contrib-list">${trust.contributions
                  .map(
                    (item) => `<li>
                      <div><strong>${esc(item.project_title)}</strong> <span class="muted">· ${esc(item.role_title)}</span>
                      <p class="muted small">${esc(item.summary)} · ${item.tasks_done} task · ${formatDate(item.created_at)}</p></div>
                    </li>`
                  )
                  .join('')}</ul>`
              : emptyState('Chưa có đóng góp nào.', 'Hoàn thành dự án đầu tiên để bắt đầu xây hồ sơ uy tín.')
          }
        </section>
        <details class="card edit-toggle" ${profile?.onboarded_at ? '' : 'open'}>
          <summary><span class="edit-title">Sửa hồ sơ và năng lực</span></summary>
          ${profileForm(ctx, ctx.user, profile)}
        </details>
      </div>
      <aside class="profile-side">
        <section class="card">
          <h2>Kỹ năng</h2>
          <div class="chip-row">${skillChips(profile?.skills ?? [])}</div>
        </section>
        <section class="card">
          <h2>Mục tiêu</h2>
          <p>${esc(profile?.goal || 'Chưa khai báo.')}</p>
          <p class="muted small">${profile?.weekly_hours ? `${profile.weekly_hours} giờ/tuần` : ''} ${profile?.experience_level ? `· ${LEVELS[profile.experience_level]}` : ''}</p>
        </section>
        <section class="card">
          <h2>Lĩnh vực quan tâm</h2>
          <div class="chip-row">${(profile?.interests ?? []).map((i) => `<span class="chip chip-sm">${esc(i)}</span>`).join('') || '<span class="muted small">Chưa có</span>'}</div>
        </section>
      </aside>
    </div>`;
    render(ctx, { title: 'Hồ sơ của tôi · Cùng Làm', active: '/me', body });
  });

  router.post('/me', (ctx) => {
    if (!ctx.user) {
      ctx.redirect('/login?next=/me');
      return;
    }
    const profile = profileOf(ctx.db, ctx.user.id);
    const fail = (message) =>
      render(ctx, {
        title: 'Hồ sơ của tôi · Cùng Làm',
        active: '/me',
        body: `<section class="page-head"><h1>Sửa hồ sơ</h1></section>${profileForm(ctx, ctx.user, profile, { error: message, values: ctx.body })}`
      });

    const fullName = param(ctx, 'full_name');
    if (fullName.length < 2) return fail('Họ tên cần ít nhất 2 ký tự.');
    const skills = parseSkills(ctx.body.skills_text);
    if (skills.length === 0) return fail('Cần ít nhất một kỹ năng, mỗi dòng theo dạng "Tên: mức 1–5".');
    const roles = [];
    if (ctx.body.role_creator === '1') roles.push('creator');
    if (ctx.body.role_participant === '1') roles.push('participant');
    if (roles.length === 0) return fail('Chọn ít nhất một vai trò.');

    const level = ['beginner', 'intermediate', 'advanced'].includes(ctx.body.experience_level)
      ? ctx.body.experience_level
      : 'beginner';
    const hours = clampInt(ctx.body.weekly_hours, 1, 60, profile?.weekly_hours || 8);

    tx(ctx.db, () => {
      ctx.db
        .prepare('UPDATE users SET full_name = ?, headline = ?, location = ?, bio = ? WHERE id = ?')
        .run(
          fullName.slice(0, 80),
          param(ctx, 'headline').slice(0, 140),
          param(ctx, 'location').slice(0, 60),
          param(ctx, 'bio').slice(0, 1000),
          ctx.user.id
        );
      ctx.db
        .prepare(
          `UPDATE profiles SET skills = ?, experience_level = ?, experience = ?, desired_roles = ?, interests = ?,
           weekly_hours = ?, goal = ?, onboarded_at = COALESCE(onboarded_at, ?) WHERE user_id = ?`
        )
        .run(
          JSON.stringify(skills),
          level,
          param(ctx, 'experience').slice(0, 1500),
          JSON.stringify(parseCsv(ctx.body.desired_roles, 6)),
          JSON.stringify(parseCsv(ctx.body.interests, 6)),
          hours,
          param(ctx, 'goal').slice(0, 500),
          nowIso(),
          ctx.user.id
        );
      ctx.db.prepare('DELETE FROM user_roles WHERE user_id = ?').run(ctx.user.id);
      for (const role of roles) {
        ctx.db.prepare('INSERT INTO user_roles (user_id, role) VALUES (?, ?)').run(ctx.user.id, role);
      }
    });
    redirectOk(ctx, '/me', 'Đã cập nhật hồ sơ.');
  });

  router.get('/me/projects', (ctx) => {
    if (!ctx.user) {
      ctx.redirect('/login?next=/me/projects');
      return;
    }
    const created = ctx.db
      .prepare('SELECT * FROM projects WHERE creator_id = ? AND status != \'archived\' ORDER BY created_at DESC')
      .all(ctx.user.id);
    const joined = ctx.db
      .prepare(
        `SELECT p.*, m.role_title FROM memberships m JOIN projects p ON p.id = m.project_id
         WHERE m.user_id = ? AND m.status = 'active' AND p.creator_id != ? ORDER BY m.joined_at DESC`
      )
      .all(ctx.user.id, ctx.user.id);
    const row = (project, note) => `<a class="row-card" href="/projects/${project.id}">
      <div><strong>${esc(project.title)}</strong><p class="muted small">${esc(note)} · ${esc(PROJECT_STATUS[project.status] ?? project.status)}</p></div>
      <span class="muted small">${formatDate(project.created_at)}</span>
    </a>`;
    const body = `
    <section class="page-head"><h1>Dự án của tôi</h1><p class="lead">Dự án bạn tạo và dự án bạn đang tham gia.</p></section>
    <section class="card"><h2>Tôi tạo (${created.length})</h2>
      ${created.map((p) => row(p, 'Creator')).join('') || emptyState('Bạn chưa tạo dự án nào.', '', '<a class="btn btn-primary btn-sm" href="/projects/new">Đăng dự án đầu tiên</a>')}
    </section>
    <section class="card"><h2>Tôi tham gia (${joined.length})</h2>
      ${joined.map((p) => row(p, p.role_title)).join('') || emptyState('Bạn chưa tham gia dự án nào.', 'Tìm dự án phù hợp và ứng tuyển.')}
    </section>`;
    render(ctx, { title: 'Dự án của tôi · Cùng Làm', active: '/me', body });
  });

  router.get('/me/notifications', (ctx) => {
    if (!ctx.user) {
      ctx.redirect('/login?next=/me/notifications');
      return;
    }
    const items = ctx.db
      .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 60')
      .all(ctx.user.id);
    const unread = items.filter((item) => !item.read_at).length;
    const body = `
    <section class="page-head split-head">
      <div><h1>Thông báo</h1><p class="lead">${unread} thông báo chưa đọc trong ${items.length} thông báo gần nhất.</p></div>
      ${
        unread
          ? `<form method="post" action="/notifications/read-all"><button class="btn btn-ghost btn-sm" type="submit">Đánh dấu tất cả đã đọc</button></form>`
          : ''
      }
    </section>
    <div class="notif-list">
      ${
        items.length
          ? items
              .map(
                (item) => `<article class="notif ${item.read_at ? '' : 'unread'}">
                  <div class="notif-main">
                    <p class="notif-title">${esc(item.title)}</p>
                    <p class="muted small">${esc(item.body)}</p>
                  </div>
                  <div class="notif-side">
                    <span class="muted small">${timeAgo(item.created_at)}</span>
                    ${
                      item.link
                        ? `<form method="post" action="/notifications/${item.id}/read"><input type="hidden" name="next" value="${esc(item.link)}"><button class="link-more" type="submit">Mở →</button></form>`
                        : item.read_at
                          ? ''
                          : `<form method="post" action="/notifications/${item.id}/read"><button class="link-more" type="submit">Đã đọc</button></form>`
                    }
                  </div>
                </article>`
              )
              .join('')
          : emptyState('Chưa có thông báo nào.')
      }
    </div>`;
    render(ctx, { title: 'Thông báo · Cùng Làm', active: '/me/notifications', body });
  });

  router.post('/notifications/:id/read', (ctx) => {
    if (!ctx.user) {
      ctx.redirect('/login');
      return;
    }
    const notif = ctx.db.prepare('SELECT * FROM notifications WHERE id = ? AND user_id = ?').get(ctx.params.id, ctx.user.id);
    if (!notif) throw new Error('not-found');
    ctx.db.prepare('UPDATE notifications SET read_at = COALESCE(read_at, ?) WHERE id = ?').run(nowIso(), notif.id);
    const next = String(ctx.body.next ?? '');
    if (next.startsWith('/') && !next.startsWith('//')) {
      ctx.redirect(next);
      return;
    }
    redirectOk(ctx, '/me/notifications', 'Đã đánh dấu đã đọc.');
  });

  router.post('/notifications/read-all', (ctx) => {
    if (!ctx.user) {
      ctx.redirect('/login');
      return;
    }
    ctx.db.prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL').run(nowIso(), ctx.user.id);
    redirectOk(ctx, '/me/notifications', 'Đã đánh dấu tất cả là đã đọc.');
  });

  router.get('/invites', (ctx) => {
    if (!ctx.user) {
      ctx.redirect('/login?next=/invites');
      return;
    }
    const invites = ctx.db
      .prepare(
        `SELECT i.*, p.title AS project_title, p.id AS pid, r.title AS role_title, u.full_name AS inviter_name, u.avatar_hue
         FROM invites i JOIN projects p ON p.id = i.project_id JOIN project_roles r ON r.id = i.role_id
         JOIN users u ON u.id = i.inviter_id
         WHERE i.invitee_id = ? AND i.status = 'pending' ORDER BY i.created_at DESC`
      )
      .all(ctx.user.id);
    const body = `
    <section class="page-head"><h1>Lời mời tham gia</h1><p class="lead">Người tạo dự án có thể mời trực tiếp dựa trên hồ sơ của bạn.</p></section>
    ${invites
      .map(
        (invite) => `<article class="card invite-card">
          <div class="applicant-head">
            <div>
              <a href="/projects/${invite.pid}"><h3>${esc(invite.project_title)}</h3></a>
              <p class="muted small">Vai trò: <strong>${esc(invite.role_title)}</strong> · ${esc(invite.inviter_name)} mời ${timeAgo(invite.created_at)}</p>
            </div>
            <span class="badge badge-pending">Chờ phản hồi</span>
          </div>
          ${invite.message ? `<p class="quote">“${esc(invite.message)}”</p>` : ''}
          <div class="applicant-actions">
            <form method="post" action="/invites/${invite.id}/accept"><button class="btn btn-primary btn-sm" type="submit">Chấp nhận</button></form>
            <form method="post" action="/invites/${invite.id}/decline"><button class="btn btn-ghost btn-sm" type="submit">Từ chối</button></form>
            <a class="link-more" href="/projects/${invite.pid}">Xem dự án →</a>
          </div>
        </article>`
      )
      .join('') || emptyState('Bạn chưa có lời mời nào.', 'Hoàn thiện hồ sơ để tăng cơ hội được mời vào dự án.')}`;
    render(ctx, { title: 'Lời mời · Cùng Làm', active: '/me', body });
  });

  router.post('/invites/:id/accept', (ctx) => {
    if (!ctx.user) {
      ctx.redirect('/login');
      return;
    }
    const invite = ctx.db.prepare('SELECT * FROM invites WHERE id = ? AND invitee_id = ?').get(ctx.params.id, ctx.user.id);
    if (!invite || invite.status !== 'pending') {
      redirectErr(ctx, '/invites', 'Lời mời không còn hiệu lực.');
      return;
    }
    const project = projectById(ctx.db, invite.project_id);
    const role = project && ctx.db.prepare('SELECT * FROM project_roles WHERE id = ?').get(invite.role_id);
    if (!project || !role) {
      redirectErr(ctx, '/invites', 'Dự án hoặc vai trò không còn tồn tại.');
      return;
    }
    if (Number(role.filled) >= Number(role.seats)) {
      redirectErr(ctx, '/invites', 'Vai trò này đã đủ người.');
      return;
    }
    tx(ctx.db, () => {
      ctx.db.prepare("UPDATE invites SET status = 'accepted', decided_at = ? WHERE id = ?").run(nowIso(), invite.id);
      const membership = ctx.db
        .prepare('SELECT * FROM memberships WHERE project_id = ? AND user_id = ?')
        .get(project.id, ctx.user.id);
      if (membership) {
        ctx.db
          .prepare("UPDATE memberships SET status = 'active', role_id = ?, role_title = ?, joined_at = ? WHERE id = ?")
          .run(role.id, role.title, nowIso(), membership.id);
      } else {
        ctx.db
          .prepare(
            "INSERT INTO memberships (project_id, role_id, user_id, role_title, status, joined_at) VALUES (?, ?, ?, ?, 'active', ?)"
          )
          .run(project.id, role.id, ctx.user.id, role.title, nowIso());
      }
      ctx.db.prepare('UPDATE project_roles SET filled = filled + 1 WHERE id = ?').run(role.id);
      notify(ctx.db, project.creator_id, {
        type: 'invite',
        title: `${ctx.user.full_name} đã nhận lời mời vào ${project.title}`,
        body: `Vai trò ${role.title}. Thoả thuận dự án cần được cập nhật tỷ lệ cho thành viên mới.`,
        link: `/projects/${project.id}/manage`
      });
    });
    redirectOk(ctx, `/projects/${project.id}/workspace`, 'Bạn đã tham gia dự án. Hãy xem task và thoả thuận.');
  });

  router.post('/invites/:id/decline', (ctx) => {
    if (!ctx.user) {
      ctx.redirect('/login');
      return;
    }
    const invite = ctx.db.prepare('SELECT * FROM invites WHERE id = ? AND invitee_id = ?').get(ctx.params.id, ctx.user.id);
    if (!invite) throw new Error('not-found');
    ctx.db.prepare("UPDATE invites SET status = 'declined', decided_at = ? WHERE id = ?").run(nowIso(), invite.id);
    const project = projectById(ctx.db, invite.project_id);
    if (project) {
      notify(ctx.db, project.creator_id, {
        type: 'invite',
        title: `${ctx.user.full_name} đã từ chối lời mời`,
        body: project.title,
        link: `/projects/${project.id}/manage`
      });
    }
    redirectOk(ctx, '/invites', 'Đã từ chối lời mời.');
  });

  router.get('/people', (ctx) => {
    const q = (ctx.query.get('q') ?? '').trim();
    const skill = (ctx.query.get('skill') ?? '').trim();
    let sql = `SELECT u.*, p.skills, p.experience_level, p.weekly_hours, p.interests,
                      (SELECT COALESCE(SUM(points), 0) FROM reputation_events e WHERE e.user_id = u.id) AS points
               FROM users u JOIN profiles p ON p.user_id = u.id WHERE p.onboarded_at IS NOT NULL`;
    const params = [];
    if (q) {
      sql += ' AND (LOWER(u.full_name) LIKE ? OR LOWER(u.headline) LIKE ?)';
      params.push(`%${q.toLowerCase()}%`, `%${q.toLowerCase()}%`);
    }
    if (skill) {
      sql += ' AND LOWER(p.skills) LIKE ?';
      params.push(`%${skill.toLowerCase()}%`);
    }
    sql += ' ORDER BY points DESC, u.created_at LIMIT 48';
    const rows = ctx.db.prepare(sql).all(...params).map((row) => ({ ...row, skills: JSON.parse(row.skills || '[]') }));

    const body = `
    <section class="page-head split-head">
      <div><h1>Mọi người</h1><p class="lead">Những người đang tìm dự án để học và làm thật.</p>
        <p class="muted small">${siteStats(ctx.db).users} người dùng · ${rows.length} người khớp bộ lọc</p></div>
    </section>
    <form class="filters filters-3" method="get" action="/people">
      <input class="input" type="search" name="q" value="${esc(q)}" placeholder="Tìm theo tên hoặc tiêu đề…" aria-label="Tìm người">
      <input class="input" type="text" name="skill" value="${esc(skill)}" placeholder="Kỹ năng (vd: Figma)" aria-label="Kỹ năng">
      <button class="btn" type="submit">Tìm</button>
    </form>
    <div class="people-grid">
      ${
        rows
          .map(
            (person) => `<a class="person-card card" href="/people/${person.id}">
              <div class="person-card-head">${avatar(person, 'md')}
                <div><strong>${esc(person.full_name)}</strong><p class="muted small">${esc(person.headline || '')}</p></div>
              </div>
              <div class="chip-row">${skillChips(person.skills, { limit: 4, small: true })}</div>
              <div class="person-card-foot"><span class="muted small">${person.weekly_hours} giờ/tuần</span><span class="trust-pill">${person.points} điểm uy tín</span></div>
            </a>`
          )
          .join('') || emptyState('Không tìm thấy ai phù hợp.')
      }
    </div>`;
    render(ctx, { title: 'Mọi người · Cùng Làm', active: '/people', body });
  });

  router.get('/people/:id', (ctx) => {
    const person = userById(ctx.db, ctx.params.id);
    if (!person) throw new Error('not-found');
    const profile = profileOf(ctx.db, person.id);
    const trust = trustProfile(ctx.db, person.id);
    const projects = ctx.db
      .prepare(
        `SELECT p.*, m.role_title FROM memberships m JOIN projects p ON p.id = m.project_id
         WHERE m.user_id = ? AND m.status = 'active' ORDER BY p.created_at DESC`
      )
      .all(person.id);
    const roles = ctx.db.prepare('SELECT role FROM user_roles WHERE user_id = ?').all(person.id).map((r) => r.role);
    const body = `
    <section class="card profile-hero">
      <div class="profile-head">
        ${avatar(person, 'lg')}
        <div>
          <h1>${esc(person.full_name)}</h1>
          <p class="muted">${esc(person.headline || '')}${person.location ? ` · ${esc(person.location)}` : ''}</p>
          <div class="chip-row">${roles.map((role) => `<span class="chip chip-sm">${ROLE_LABEL[role]}</span>`).join('')}</div>
        </div>
      </div>
      ${profile?.bio ? `<p class="profile-bio">${esc(profile.bio)}</p>` : ''}
      <div class="trust-grid">
        <div class="trust-stat"><strong>${trust.points}</strong><span>điểm uy tín</span></div>
        <div class="trust-stat"><strong>${trust.completedProjects}</strong><span>dự án hoàn thành</span></div>
        <div class="trust-stat"><strong>${trust.tasksDone}</strong><span>task đã xong</span></div>
        <div class="trust-stat"><strong>${trust.onTimeRate === null ? '—' : `${trust.onTimeRate}%`}</strong><span>đúng hạn</span></div>
      </div>
    </section>
    <div class="profile-grid">
      <div class="profile-main">
        <section class="card"><h2>Kỹ năng</h2><div class="chip-row">${skillChips(profile?.skills ?? [])}</div></section>
        ${
          profile?.experience
            ? `<section class="card"><h2>Kinh nghiệm</h2><p>${esc(profile.experience)}</p></section>`
            : ''
        }
        <section class="card">
          <h2>Đóng góp được ghi nhận</h2>
          ${
            trust.contributions.length
              ? `<ul class="contrib-list">${trust.contributions
                  .map(
                    (item) => `<li><div><strong>${esc(item.project_title)}</strong> <span class="muted">· ${esc(
                      item.role_title
                    )}</span><p class="muted small">${esc(item.summary)} · ${item.tasks_done} task · ${formatDate(item.created_at)}</p></div></li>`
                  )
                  .join('')}</ul>`
              : '<p class="muted">Chưa có đóng góp nào được ghi nhận.</p>'
          }
        </section>
        <section class="card">
          <h2>Dự án đang tham gia</h2>
          ${projects.length ? projects.map((p) => `<a class="row-card" href="/projects/${p.id}"><div><strong>${esc(p.title)}</strong><p class="muted small">${esc(p.role_title)} · ${esc(PROJECT_STATUS[p.status] ?? p.status)}</p></div><span class="muted small">${esc(p.field)}</span></a>`).join('') : '<p class="muted">Chưa tham gia dự án nào.</p>'}
        </section>
      </div>
      <aside class="profile-side">
        <section class="card">
          <h2>Mục tiêu</h2>
          <p>${esc(profile?.goal || 'Chưa khai báo.')}</p>
        </section>
        <section class="card">
          <h2>Lĩnh vực quan tâm</h2>
          <div class="chip-row">${(profile?.interests ?? []).map((i) => `<span class="chip chip-sm">${esc(i)}</span>`).join('') || '<span class="muted small">Chưa có</span>'}</div>
        </section>
        <section class="card">
          <h2>Thời gian</h2>
          <p>${profile?.weekly_hours ?? '—'} giờ/tuần · ${LEVELS[profile?.experience_level] ?? ''}</p>
        </section>
      </aside>
    </div>`;
    render(ctx, { title: `${person.full_name} · Cùng Làm`, active: '/people', body });
  });

  router.get('/showcase', (ctx) => {
    const projects = ctx.db
      .prepare(
        `SELECT p.*, u.full_name AS creator_name, u.avatar_hue AS creator_hue,
                (SELECT COUNT(*) FROM contributions c WHERE c.project_id = p.id) AS contrib_count
         FROM projects p JOIN users u ON u.id = p.creator_id
         WHERE p.status = 'completed' ORDER BY p.completed_at DESC LIMIT 30`
      )
      .all();
    const body = `
    <section class="page-head">
      <p class="eyebrow">Showcase</p>
      <h1>Dự án đã hoàn thành</h1>
      <p class="lead">Đây là bằng chứng thật: sản phẩm, vai trò và đóng góp của từng người — thứ mà một CV tự khai không có.</p>
    </section>
    <div class="cards-grid">
      ${
        projects
          .map(
            (project) => `<a class="project-card" href="/projects/${project.id}">
              <div class="project-card-top"><span class="chip chip-field">${esc(project.field)}</span><span class="badge badge-completed">Đã hoàn thành</span></div>
              <h3>${esc(project.title)}</h3>
              <p class="clamp-2">${esc(project.summary)}</p>
              <div class="project-card-foot">
                <span class="person">${avatar({ full_name: project.creator_name, avatar_hue: project.creator_hue }, 'xs')} ${esc(project.creator_name)}</span>
                <span class="muted small">${project.contrib_count} người được ghi nhận · ${formatDate(project.completed_at)}</span>
              </div>
            </a>`
          )
          .join('') || emptyState('Chưa có dự án nào hoàn thành.')
      }
    </div>`;
    render(ctx, { title: 'Showcase · Cùng Làm', active: '/showcase', body });
  });
}
