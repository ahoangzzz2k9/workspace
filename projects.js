import {
  esc,
  statusBadge,
  stageLabel,
  skillChips,
  progressBar,
  timeAgo,
  formatDate,
  emptyState,
  avatar,
  formField,
  formArea,
  formSelect,
  STAGES,
  PROJECT_STATUS
} from '../views.js';
import { render, redirectOk, redirectErr, param, clampInt, parseSkills, parseCsv } from './util.js';
import {
  projectById,
  rolesOf,
  membersOf,
  tasksOf,
  projectStats,
  browseProjects,
  fields,
  allSkills,
  isMember,
  isCreator,
  profileOf,
  notify,
  trustProfile,
  siteStats,
  latestReputation,
  topTrustedUser
} from '../data.js';

export function projectCard(project) {
  const openRoles = (project.roles ?? []).filter((role) => role.filled < role.seats);
  const roleChips = (project.roles ?? [])
    .slice(0, 3)
    .map((role) => `<span class="chip chip-sm">${esc(role.title)}</span>`)
    .join('');
  return `<a class="project-card" href="/projects/${project.id}">
    <div class="project-card-top">
      <span class="chip chip-field">${esc(project.field || 'Khác')}</span>
      ${statusBadge(project.status)}
    </div>
    <h3>${esc(project.title)}</h3>
    <p class="clamp-2">${esc(project.summary || project.problem)}</p>
    <div class="card-chips">${roleChips}</div>
    <div class="project-card-foot">
      <span class="person">${avatar({ full_name: project.creator_name, avatar_hue: project.creator_hue }, 'xs')} ${esc(
    project.creator_name
  )}</span>
      <span class="muted small">${openRoles.length} vai trò đang mở · ${stageLabel(project.stage)}</span>
    </div>
  </a>`;
}

function filterForm(ctx) {
  const q = ctx.query.get('q') ?? '';
  const field = ctx.query.get('field') ?? '';
  const skill = ctx.query.get('skill') ?? '';
  const status = ctx.query.get('status') ?? '';
  const fieldOptions = [{ value: '', label: 'Mọi lĩnh vực' }, ...fields(ctx.db).map((f) => ({ value: f, label: f }))];
  const statusOptions = [
    { value: '', label: 'Mọi trạng thái' },
    { value: 'recruiting', label: 'Đang tuyển' },
    { value: 'active', label: 'Đang chạy' },
    { value: 'completed', label: 'Đã hoàn thành' }
  ];
  return `<form class="filters" method="get" action="/projects">
    <input class="input" type="search" name="q" value="${esc(q)}" placeholder="Tìm theo tên, vấn đề, mô tả…" aria-label="Tìm dự án">
    <select name="field" aria-label="Lĩnh vực">${fieldOptions
      .map((o) => `<option value="${esc(o.value)}"${o.value === field ? ' selected' : ''}>${esc(o.label)}</option>`)
      .join('')}</select>
    <select name="status" aria-label="Trạng thái">${statusOptions
      .map((o) => `<option value="${esc(o.value)}"${o.value === status ? ' selected' : ''}>${esc(o.label)}</option>`)
      .join('')}</select>
    <input class="input" type="text" name="skill" value="${esc(skill)}" placeholder="Kỹ năng (vd: React)" aria-label="Kỹ năng">
    <button class="btn" type="submit">Lọc</button>
  </form>`;
}

export function registerProjectRoutes(router) {
  router.get('/', (ctx) => {
    const stats = siteStats(ctx.db);
    const featured = browseProjects(ctx.db, { status: 'recruiting' });
    const completed = browseProjects(ctx.db, { status: 'completed' }).slice(0, 3);

    const spotlight = featured[0] ?? null;
    const spotlightOpen = spotlight ? spotlight.roles.filter((role) => role.filled < role.seats) : [];
    const spotlightRole = spotlightOpen[0] ?? null;

    const withTasks = [...browseProjects(ctx.db, { status: 'active' }), ...featured];
    let progressProject = null;
    let progressTasks = [];
    for (const candidate of withTasks) {
      const tasks = tasksOf(ctx.db, candidate.id);
      if (tasks.length > 0) {
        progressProject = candidate;
        progressTasks = tasks;
        break;
      }
    }
    const progress = projectStats(progressTasks);

    const latestRep = latestReputation(ctx.db);
    const top = topTrustedUser(ctx.db);
    const topTrust = top ? trustProfile(ctx.db, top.id) : null;

    const artA = spotlight
      ? `<a class="art-card art-a" href="/projects/${spotlight.id}">
          <span class="chip chip-field">${esc(spotlight.field || 'Khác')}</span>
          <h4>${esc(spotlight.title)}</h4>
          <p>${
            spotlightRole
              ? `Cần ${Math.max(0, spotlightRole.seats - spotlightRole.filled)} ${esc(spotlightRole.title)}`
              : 'Đang tìm người'
          }</p>
          <div class="art-people">${avatar(
            { full_name: spotlight.creator_name, avatar_hue: spotlight.creator_hue },
            'xs'
          )}<span class="art-plus">+${spotlightOpen.length} vai trò</span></div>
        </a>`
      : `<div class="art-card art-a"><p class="art-label">Dự án</p><h4>Chưa có dự án đang tuyển</h4></div>`;

    const artB = progressProject
      ? `<a class="art-card art-b" href="/projects/${progressProject.id}">
          <p class="art-label">Tiến độ dự án</p>
          <p class="art-title">${esc(progressProject.title)}</p>
          <div class="progress"><span class="progress-fill tone-brand" style="width:${progress.percent}%"></span></div>
          <p class="muted small">${progress.done}/${progress.total} task hoàn thành</p>
        </a>`
      : `<div class="art-card art-b"><p class="art-label">Tiến độ dự án</p><p class="muted small">Chưa có task nào.</p></div>`;

    const artC = latestRep
      ? `<div class="art-card art-c">
          <p class="art-label">Đóng góp</p>
          <p><strong>+${latestRep.points} điểm uy tín</strong></p>
          <p class="art-title muted">${esc(latestRep.project_title || latestRep.reason)}</p>
        </div>`
      : `<div class="art-card art-c"><p class="art-label">Đóng góp</p><p class="muted small">Chưa có đóng góp nào.</p></div>`;

    const trustMini = top
      ? `<a class="person" href="/people/${top.id}">${avatar(top, 'md')}<div><strong>${esc(top.full_name)}</strong><p class="muted small">${esc(
          top.headline || 'Thành viên'
        )}</p></div></a>
        <div class="mini-stats">
          <div><strong>${topTrust.completedProjects}</strong><span>dự án</span></div>
          <div><strong>${topTrust.tasksDone}</strong><span>task</span></div>
          <div><strong>${topTrust.onTimeRate === null ? '—' : `${topTrust.onTimeRate}%`}</strong><span>đúng hạn</span></div>
        </div>`
      : '<p class="muted">Chưa có dữ liệu uy tín.</p>';

    const body = `
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Mạng xã hội lấy dự án làm trung tâm</p>
        <h1>Ý tưởng cần người.<br>Kinh nghiệm cần dự án.</h1>
        <p class="lead">Cùng Làm nối người có ý tưởng nhưng thiếu team với người có kỹ năng nhưng thiếu kinh nghiệm thực chiến — qua những dự án làm thật, có tiến độ, có thoả thuận, có bằng chứng đóng góp.</p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="${ctx.user ? '/projects/new' : '/register'}">Tạo dự án</a>
          <a class="btn btn-ghost" href="/projects">Tìm dự án để tham gia</a>
        </div>
        <ul class="hero-stats">
          <li><strong>${stats.recruiting}</strong><span>dự án đang tuyển</span></li>
          <li><strong>${stats.users}</strong><span>người dùng</span></li>
          <li><strong>${stats.completed}</strong><span>dự án hoàn thành</span></li>
          <li><strong>${stats.contributions}</strong><span>đóng góp được ghi nhận</span></li>
        </ul>
        <p class="hero-footnote muted small">Tổng ${stats.projects} dự án · ${stats.users} người dùng · ${stats.openRoles} vai trò đang mở. Số liệu tính trực tiếp từ dữ liệu, cập nhật mỗi lần tải trang.</p>
      </div>
      <div class="hero-art" aria-hidden="true">
        ${artA}
        ${artB}
        ${artC}
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <h2>Cách Cùng Làm hoạt động</h2>
        <p class="muted">Một vòng đời khép kín, không dừng ở việc “tìm người”.</p>
      </div>
      <ol class="steps">
        <li><span class="step-num">1</span><h3>Khai báo năng lực</h3><p>Trả lời phỏng vấn ngắn để có hồ sơ kỹ năng, thời gian và mục tiêu.</p></li>
        <li><span class="step-num">2</span><h3>Tạo hoặc tìm dự án</h3><p>Creator mô tả vấn đề và vai trò còn thiếu. Hệ thống gợi ý người phù hợp.</p></li>
        <li><span class="step-num">3</span><h3>Làm việc trong workspace</h3><p>Task, deadline, trạng thái và vướng mắc được nhìn thấy bởi cả team.</p></li>
        <li><span class="step-num">4</span><h3>Hoàn thành &amp; ghi nhận</h3><p>Đóng góp được xác nhận, uy tín tích luỹ, sản phẩm vào showcase.</p></li>
      </ol>
    </section>

    <section class="section">
      <div class="section-head">
        <h2>Dự án đang tìm người</h2>
        <a class="link-more" href="/projects">Xem tất cả →</a>
      </div>
      <div class="cards-grid">${featured
        .slice(0, 3)
        .map(projectCard)
        .join('') || emptyState('Chưa có dự án nào đang tuyển.')}</div>
    </section>

    <section class="section trust-section">
      <div class="trust-copy">
        <h2>Uy tín đến từ bằng chứng, không phải tự khai</h2>
        <p>Mỗi dự án hoàn thành để lại một bản ghi đóng góp: vai trò, số task đã hoàn thành, tỷ lệ đúng hạn. Đó là thứ người tuyển dụng xem được — thay vì một con số sao.</p>
        <a class="btn btn-ghost" href="/showcase">Xem showcase dự án đã hoàn thành</a>
      </div>
      <div class="trust-art">
        <div class="profile-mini card">${trustMini}</div>
      </div>
    </section>

    ${completed.length ? `<section class="section"><div class="section-head"><h2>Vừa hoàn thành</h2><a class="link-more" href="/showcase">Showcase →</a></div><div class="cards-grid">${completed
      .map(projectCard)
      .join('')}</div></section>` : ''}
    `;

    render(ctx, { title: 'Cùng Làm · Ý tưởng cần người, kinh nghiệm cần dự án', active: '/', body });
  });

  router.get('/projects', (ctx) => {
    const filters = {
      q: ctx.query.get('q') ?? '',
      field: ctx.query.get('field') ?? '',
      skill: ctx.query.get('skill') ?? '',
      status: ctx.query.get('status') ?? ''
    };
    const list = browseProjects(ctx.db, filters).filter((p) => p.visibility === 'public' || isCreator(p, ctx.user?.id));
    const stats = siteStats(ctx.db);
    const profile = ctx.user ? profileOf(ctx.db, ctx.user.id) : null;
    const note =
      ctx.user && !profile?.onboarded_at
        ? `<div class="banner banner-warn">Hồ sơ năng lực của bạn chưa hoàn tất — bạn vẫn xem được dự án, nhưng cần <a href="/onboarding">hoàn tất hồ sơ</a> trước khi ứng tuyển.</div>`
        : '';

    const body = `
    <section class="page-head split-head">
      <div>
        <h1>Dự án</h1>
        <p class="lead">Tìm dự án phù hợp với kỹ năng và quỹ thời gian của bạn — hoặc đăng dự án của riêng mình.</p>
        <p class="muted small">${stats.projects} dự án · ${stats.users} người dùng · ${stats.recruiting} đang tuyển · ${stats.openRoles} vai trò còn mở</p>
      </div>
      <a class="btn btn-primary" href="${ctx.user ? '/projects/new' : '/login?next=/projects/new'}">+ Đăng dự án</a>
    </section>
    ${note}
    ${filterForm(ctx)}
    <p class="muted small result-count">${list.length} dự án${filters.q ? ` cho “${filters.q}”` : ''}</p>
    <div class="cards-grid">${list.map(projectCard).join('') || emptyState('Không tìm thấy dự án phù hợp.', 'Thử bỏ bớt bộ lọc hoặc đăng dự án đầu tiên của bạn.')}</div>
    <section class="section">
      <div class="section-head"><h2>Kỹ năng đang được tìm</h2></div>
      <div class="chip-cloud">${allSkills(ctx.db)
        .slice(0, 24)
        .map((skill) => `<a class="chip" href="/projects?skill=${encodeURIComponent(skill)}">${esc(skill)}</a>`)
        .join('')}</div>
    </section>`;
    render(ctx, { title: 'Dự án · Cùng Làm', active: '/projects', body });
  });

  router.get('/projects/new', (ctx) => {
    if (!ctx.user) {
      ctx.redirect('/login?next=/projects/new');
      return;
    }
    const body = projectFormPage(ctx, {});
    render(ctx, { title: 'Đăng dự án · Cùng Làm', active: '/projects', body });
  });

  router.post('/projects', (ctx) => {
    if (!ctx.user) {
      ctx.redirect('/login?next=/projects/new');
      return;
    }
    const values = ctx.body;
    const title = param(ctx, 'title');
    const summary = param(ctx, 'summary');
    const problem = param(ctx, 'problem');
    const goal = param(ctx, 'goal');
    const roleTitle = param(ctx, 'role_title');
    const roleSkills = parseCsv(ctx.body.role_skills, 8);
    const fail = (message) =>
      render(ctx, { title: 'Đăng dự án · Cùng Làm', active: '/projects', body: projectFormPage(ctx, { values, error: message }) });

    if (title.length < 8) return fail('Tên dự án cần ít nhất 8 ký tự để người khác hiểu bạn đang làm gì.');
    if (summary.length < 20) return fail('Mô tả ngắn cần ít nhất 20 ký tự.');
    if (problem.length < 20) return fail('Hãy mô tả vấn đề dự án giải quyết (ít nhất 20 ký tự).');
    if (goal.length < 10) return fail('Hãy nêu mục tiêu cần đạt (ít nhất 10 ký tự).');
    if (!roleTitle || roleSkills.length === 0) return fail('Cần ít nhất một vai trò kèm kỹ năng cần thiết.');

    const now = new Date().toISOString();
    const info = ctx.db
      .prepare(
        `INSERT INTO projects (creator_id, title, field, problem, goal, stage, commitment_hours, duration_weeks,
         visibility, sensitive_note, status, created_at, summary)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'recruiting', ?, ?)`
      )
      .run(
        ctx.user.id,
        title,
        param(ctx, 'field').slice(0, 40) || 'Khác',
        problem.slice(0, 2000),
        goal.slice(0, 1000),
        STAGES[ctx.body.stage] ? ctx.body.stage : 'y-tuong',
        clampInt(ctx.body.commitment_hours, 1, 40, 5),
        clampInt(ctx.body.duration_weeks, 1, 52, 4),
        ctx.body.visibility === 'unlisted' ? 'unlisted' : 'public',
        param(ctx, 'sensitive_note').slice(0, 1000),
        now,
        summary.slice(0, 300)
      );
    const projectId = Number(info.lastInsertRowid);

    const roleRows = [
      { title: roleTitle, skills: roleSkills, seats: ctx.body.role_seats, description: ctx.body.role_description },
      { title: param(ctx, 'role2_title'), skills: parseCsv(ctx.body.role2_skills, 8), seats: ctx.body.role2_seats, description: ctx.body.role2_description },
      { title: param(ctx, 'role3_title'), skills: parseCsv(ctx.body.role3_skills, 8), seats: ctx.body.role3_seats, description: ctx.body.role3_description }
    ];
    roleRows.forEach((role, index) => {
      if (!role.title || role.skills.length === 0) return;
      ctx.db
        .prepare(
          'INSERT INTO project_roles (project_id, title, skills, seats, description, position) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .run(projectId, role.title.slice(0, 80), JSON.stringify(role.skills), clampInt(role.seats, 1, 5, 1), String(role.description ?? '').slice(0, 400), index);
    });

    ctx.db.prepare("INSERT INTO memberships (project_id, role_id, user_id, role_title, status, joined_at) VALUES (?, NULL, ?, 'Người tạo dự án', 'active', ?)").run(
      projectId,
      ctx.user.id,
      now
    );
    // Đánh dấu đã có mode Creator
    ctx.db.prepare("INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, 'creator')").run(ctx.user.id);

    redirectOk(ctx, `/projects/${projectId}`, 'Dự án đã được đăng. Hệ thống sẽ gợi ý người phù hợp cho từng vai trò.');
  });

  router.get('/projects/:id/edit', (ctx) => {
    const project = projectById(ctx.db, ctx.params.id);
    if (!project) throw new Error('not-found');
    if (!ctx.user) {
      ctx.redirect(`/login?next=/projects/${project.id}/edit`);
      return;
    }
    if (!isCreator(project, ctx.user.id)) {
      const error = new Error('forbidden');
      error.status = 403;
      throw error;
    }
    render(ctx, {
      title: `Sửa dự án · ${project.title}`,
      active: '/projects',
      body: projectFormPage(ctx, { project })
    });
  });

  router.post('/projects/:id/edit', (ctx) => {
    const project = projectById(ctx.db, ctx.params.id);
    if (!project) throw new Error('not-found');
    if (!isCreator(project, ctx.user?.id)) {
      const error = new Error('forbidden');
      error.status = 403;
      throw error;
    }
    const values = ctx.body;
    const title = param(ctx, 'title');
    const summary = param(ctx, 'summary');
    const problem = param(ctx, 'problem');
    const goal = param(ctx, 'goal');
    const fail = (message) =>
      render(ctx, {
        title: `Sửa dự án · ${project.title}`,
        active: '/projects',
        body: projectFormPage(ctx, { project, values, error: message })
      });

    if (title.length < 8) return fail('Tên dự án cần ít nhất 8 ký tự.');
    if (summary.length < 20) return fail('Mô tả ngắn cần ít nhất 20 ký tự.');
    if (problem.length < 20) return fail('Hãy mô tả vấn đề dự án giải quyết (ít nhất 20 ký tự).');
    if (goal.length < 10) return fail('Hãy nêu mục tiêu cần đạt (ít nhất 10 ký tự).');

    ctx.db
      .prepare(
        `UPDATE projects SET title = ?, field = ?, problem = ?, goal = ?, stage = ?, commitment_hours = ?,
         duration_weeks = ?, visibility = ?, sensitive_note = ?, summary = ? WHERE id = ?`
      )
      .run(
        title.slice(0, 120),
        param(ctx, 'field').slice(0, 40) || 'Khác',
        problem.slice(0, 2000),
        goal.slice(0, 1000),
        STAGES[ctx.body.stage] ? ctx.body.stage : project.stage,
        clampInt(ctx.body.commitment_hours, 1, 40, project.commitment_hours),
        clampInt(ctx.body.duration_weeks, 1, 52, project.duration_weeks),
        ctx.body.visibility === 'unlisted' ? 'unlisted' : 'public',
        param(ctx, 'sensitive_note').slice(0, 1000),
        summary.slice(0, 300),
        project.id
      );
    redirectOk(ctx, `/projects/${project.id}/manage`, 'Đã cập nhật thông tin dự án.');
  });

  router.get('/projects/:id', (ctx) => {
    const project = projectById(ctx.db, ctx.params.id);
    if (!project) throw new Error('not-found');
    if (project.visibility === 'unlisted' && !isCreator(project, ctx.user?.id) && !isMember(ctx.db, project.id, ctx.user?.id)) {
      throw new Error('not-found');
    }
    const roles = rolesOf(ctx.db, project.id);
    const members = membersOf(ctx.db, project.id);
    const tasks = tasksOf(ctx.db, project.id);
    const stats = projectStats(tasks);
    const creator = ctx.db.prepare('SELECT * FROM users WHERE id = ?').get(project.creator_id);
    const relation = isCreator(project, ctx.user?.id)
      ? 'creator'
      : isMember(ctx.db, project.id, ctx.user?.id)
        ? 'member'
        : 'visitor';
    const profile = ctx.user ? profileOf(ctx.db, ctx.user.id) : null;
    const myApplications = ctx.user
      ? ctx.db.prepare('SELECT * FROM applications WHERE project_id = ? AND user_id = ?').all(project.id, ctx.user.id)
      : [];
    const appByRole = new Map(myApplications.map((a) => [Number(a.role_id), a]));
    const trust = trustProfile(ctx.db, creator.id);
    const canApply = relation === 'visitor' && project.status === 'recruiting';

    const roleCards = roles
      .map((role) => {
        const myApp = appByRole.get(Number(role.id));
        const filled = role.filled >= role.seats;
        let action = '';
        if (relation === 'creator') {
          action = filled
            ? '<span class="badge badge-done">Đã đủ người</span>'
            : `<a class="link-more" href="/projects/${project.id}/manage">Quản lý vai trò này →</a>`;
        } else if (relation === 'member') {
          action = `<span class="badge badge-active">Bạn đang trong team</span>`;
        } else if (myApp && myApp.status === 'pending') {
          action = `<span class="badge badge-pending">Đang chờ duyệt</span>`;
        } else if (myApp && myApp.status === 'rejected') {
          action = `<span class="badge badge-rejected">Chưa phù hợp lần này</span>`;
        } else if (filled) {
          action = `<span class="badge badge-done">Đã đủ người</span>`;
        } else if (!ctx.user) {
          action = `<a class="btn btn-sm btn-primary" href="/login?next=/projects/${project.id}">Đăng nhập để ứng tuyển</a>`;
        } else if (!profile?.onboarded_at) {
          action = `<a class="btn btn-sm" href="/onboarding">Hoàn tất hồ sơ để ứng tuyển</a>`;
        } else if (canApply) {
          action = `<details class="apply-box">
            <summary class="btn btn-sm btn-primary">Ứng tuyển vai trò này</summary>
            <form method="post" action="/projects/${project.id}/apply" class="stack">
              <input type="hidden" name="role_id" value="${role.id}">
              ${formArea({
                label: 'Vì sao bạn phù hợp?',
                name: 'message',
                rows: 3,
                required: true,
                placeholder: 'Kinh nghiệm liên quan, thời gian bắt đầu, điều bạn muốn học…'
              })}
              <button class="btn btn-primary btn-sm" type="submit">Gửi ứng tuyển</button>
            </form>
          </details>`;
        } else {
          action = `<span class="muted small">Dự án không ở trạng thái tuyển.</span>`;
        }
        return `<article class="role-card">
          <div class="role-head">
            <h3>${esc(role.title)}</h3>
            <span class="badge ${filled ? 'badge-done' : 'badge-recruiting'}">${role.filled}/${role.seats} người</span>
          </div>
          ${role.description ? `<p class="muted">${esc(role.description)}</p>` : ''}
          <div class="chip-row">${skillChips(role.skills)}</div>
          <div class="role-action">${action}</div>
        </article>`;
      })
      .join('');

    const sensitive =
      relation === 'creator' || relation === 'member'
        ? project.sensitive_note
          ? `<section class="card sensitive-card">
              <div class="sensitive-head"><h2>Thông tin nội bộ</h2><span class="badge badge-active">Bạn có quyền xem</span></div>
              <p>${esc(project.sensitive_note)}</p>
              <p class="muted small">Chỉ thành viên trong team thấy nội dung này.</p>
            </section>`
          : ''
        : `<section class="card sensitive-card locked">
            <div class="sensitive-head"><h2>Thông tin nội bộ</h2><span class="badge">Đang khoá</span></div>
            <p class="muted">Thuật toán, dữ liệu và tài liệu cốt lõi chỉ mở cho thành viên đã được chấp nhận vào team. Đây là cách dự án bảo vệ ý tưởng mà vẫn đủ thông tin để bạn quyết định ứng tuyển.</p>
          </section>`;

    const body = `
    <nav class="breadcrumb"><a href="/projects">Dự án</a><span>/</span><span>${esc(project.field || 'Khác')}</span></nav>
    <section class="card project-hero">
      <div class="project-hero-main">
        <div class="hero-badges">
          ${statusBadge(project.status)}
          <span class="chip">${esc(project.field || 'Khác')}</span>
          ${project.stage && project.stage !== 'done' ? `<span class="chip">${esc(stageLabel(project.stage))}</span>` : ''}
          ${project.visibility === 'unlisted' ? '<span class="chip">Không công khai</span>' : ''}
        </div>
        <h1>${esc(project.title)}</h1>
        <p class="lead">${esc(project.summary)}</p>
        <div class="meta-row">
          <span><strong>${project.commitment_hours}</strong> giờ/tuần</span>
          <span><strong>${project.duration_weeks}</strong> tuần</span>
          <span><strong>${members.length}</strong> thành viên</span>
          <span>Đăng ${timeAgo(project.created_at)}</span>
        </div>
      </div>
      <div class="project-hero-side">
        <div class="creator-box">
          <p class="muted small">Người tạo dự án</p>
          <a class="person" href="/people/${creator.id}">${avatar(creator, 'md')}<span><strong>${esc(creator.full_name)}</strong><br><span class="muted small">${esc(creator.headline)}</span></span></a>
          <div class="mini-stats"><div><strong>${trust.points}</strong><span>điểm uy tín</span></div><div><strong>${trust.createdProjects}</strong><span>dự án đã tạo</span></div></div>
        </div>
        ${
          relation === 'creator'
            ? `<a class="btn btn-primary btn-block" href="/projects/${project.id}/manage">Quản lý dự án</a>
               <a class="btn btn-ghost btn-block" href="/projects/${project.id}/workspace">Vào workspace</a>`
            : relation === 'member'
              ? `<a class="btn btn-primary btn-block" href="/projects/${project.id}/workspace">Vào workspace của team</a>`
              : `<div class="note-note">Dự án có <strong>thoả thuận trước khi làm</strong>: quyền sở hữu và tỷ lệ lợi ích được chốt trước khi bắt đầu.</div>`
        }
      </div>
    </section>

    <div class="detail-grid">
      <div class="detail-main">
        <section class="card"><h2>Vấn đề</h2><p>${esc(project.problem)}</p></section>
        <section class="card"><h2>Mục tiêu</h2><p>${esc(project.goal)}</p></section>
        <section class="card">
          <div class="section-head tight"><h2>Vai trò trong dự án</h2><span class="muted small">${roles.filter((r) => r.filled < r.seats).length} vai trò còn mở</span></div>
          <div class="role-list">${roleCards || emptyState('Dự án đã đủ người cho tất cả vai trò.')}</div>
        </section>
        ${sensitive}
        ${
          project.status === 'completed'
            ? `<section class="card"><h2>Kết quả &amp; đóng góp</h2>${contributionsBlock(ctx, project)}</section>`
            : ''
        }
      </div>
      <aside class="detail-side">
        <section class="card">
          <h2>Tiến độ</h2>
          ${progressBar(stats.percent)}
          <p class="muted small">${stats.done}/${stats.total} task hoàn thành${stats.blocked ? ` · ${stats.blocked} task đang vướng` : ''}</p>
          <div class="mini-stats four">
            <div><strong>${members.length}</strong><span>thành viên</span></div>
            <div><strong>${stats.inProgress}</strong><span>đang làm</span></div>
            <div><strong>${stats.review}</strong><span>chờ review</span></div>
            <div><strong>${stats.blocked}</strong><span>vướng mắc</span></div>
          </div>
        </section>
        <section class="card">
          <h2>Thành viên</h2>
          <ul class="member-list">${members
            .map(
              (m) => `<li class="person">${avatar(m, 'sm')}<span><strong>${esc(m.full_name)}</strong><br><span class="muted small">${esc(
                m.role_title
              )}</span></span></li>`
            )
            .join('')}</ul>
        </section>
      </aside>
    </div>`;
    render(ctx, { title: `${project.title} · Cùng Làm`, active: '/projects', body, description: project.summary });
  });

  router.post('/projects/:id/apply', (ctx) => {
    if (!ctx.user) {
      ctx.redirect(`/login?next=/projects/${ctx.params.id}`);
      return;
    }
    const project = projectById(ctx.db, ctx.params.id);
    if (!project) throw new Error('not-found');
    const profile = profileOf(ctx.db, ctx.user.id);
    if (!profile?.onboarded_at) {
      redirectErr(ctx, `/projects/${project.id}`, 'Hoàn tất hồ sơ năng lực trước khi ứng tuyển.');
      return;
    }
    if (isCreator(project, ctx.user.id) || isMember(ctx.db, project.id, ctx.user.id)) {
      redirectErr(ctx, `/projects/${project.id}`, 'Bạn đã ở trong dự án này.');
      return;
    }
    if (project.status !== 'recruiting') {
      redirectErr(ctx, `/projects/${project.id}`, 'Dự án không còn ở trạng thái tuyển.');
      return;
    }
    const role = rolesOf(ctx.db, project.id).find((r) => Number(r.id) === Number(ctx.body.role_id));
    if (!role) {
      redirectErr(ctx, `/projects/${project.id}`, 'Vai trò không hợp lệ.');
      return;
    }
    if (role.filled >= role.seats) {
      redirectErr(ctx, `/projects/${project.id}`, 'Vai trò này đã đủ người.');
      return;
    }
    const message = param(ctx, 'message');
    if (message.length < 20) {
      redirectErr(ctx, `/projects/${project.id}`, 'Hãy viết ít nhất 20 ký tự để người tạo dự án hiểu vì sao bạn phù hợp.');
      return;
    }
    const existing = ctx.db
      .prepare('SELECT * FROM applications WHERE project_id = ? AND role_id = ? AND user_id = ?')
      .get(project.id, role.id, ctx.user.id);
    if (existing && existing.status === 'pending') {
      redirectErr(ctx, `/projects/${project.id}`, 'Bạn đã ứng tuyển vai trò này rồi.');
      return;
    }
    ctx.db
      .prepare(
        `INSERT INTO applications (project_id, role_id, user_id, message, status, created_at)
         VALUES (?, ?, ?, ?, 'pending', ?)`
      )
      .run(project.id, role.id, ctx.user.id, message.slice(0, 1200), new Date().toISOString());
    notify(ctx.db, project.creator_id, {
      type: 'application',
      title: `${ctx.user.full_name} đã ứng tuyển ${role.title}`,
      body: message.slice(0, 160),
      link: `/projects/${project.id}/manage`
    });
    redirectOk(ctx, `/projects/${project.id}`, 'Đã gửi ứng tuyển. Người tạo dự án sẽ xem hồ sơ của bạn.');
  });
}

export function contributionsBlock(ctx, project) {
  const rows = ctx.db
    .prepare(
      `SELECT c.*, u.full_name, u.avatar_hue FROM contributions c JOIN users u ON u.id = c.user_id
       WHERE c.project_id = ? ORDER BY c.created_at`
    )
    .all(project.id);
  if (rows.length === 0) return '<p class="muted">Chưa có bản ghi đóng góp.</p>';
  return `<ul class="contrib-list">${rows
    .map(
      (row) => `<li>
        ${avatar(row, 'sm')}
        <div><strong>${esc(row.full_name)}</strong> <span class="muted">· ${esc(row.role_title)}</span>
        <p class="muted small">${esc(row.summary)} · ${row.tasks_done} task hoàn thành</p></div>
      </li>`
    )
    .join('')}</ul>`;
}

function projectFormPage(ctx, { values = {}, error = '', project = null }) {
  const v = (key, fallback = '') => values[key] ?? (project ? project[key] ?? fallback : fallback);
  const editing = Boolean(project);
  const action = editing ? `/projects/${project.id}/edit` : '/projects';
  const cancelHref = editing ? `/projects/${project.id}/manage` : '/projects';
  const fieldOptions = [
    'Giáo dục',
    'Tài chính',
    'Ẩm thực',
    'Sức khoẻ',
    'Dịch vụ',
    'Công nghệ',
    'Môi trường',
    'Khác'
  ].map((field) => ({ value: field, label: field }));
  return `
  <section class="page-head">
    <p class="eyebrow">Dành cho Creator</p>
    <h1>${editing ? 'Sửa dự án' : 'Đăng dự án'}</h1>
    <p class="lead">${
      editing
        ? 'Cập nhật thông tin công khai và phần nội bộ. Vai trò được quản lý riêng ở trang quản lý dự án.'
        : 'Mô tả càng rõ vấn đề và vai trò, càng dễ gặp đúng người. Hệ thống dùng thông tin này để gợi ý ứng viên.'
    }</p>
  </section>
  ${error ? `<div class="banner banner-err">${esc(error)}</div>` : ''}
  <form method="post" action="${action}" class="stack form-narrow">
    <section class="card stack">
      <h2>Thông tin cơ bản</h2>
      ${formField({ label: 'Tên dự án', name: 'title', value: v('title'), required: true, placeholder: 'Lịch học thông minh cho sinh viên' })}
      ${formArea({ label: 'Mô tả ngắn', name: 'summary', value: v('summary'), rows: 2, required: true, placeholder: 'Một câu nói rõ sản phẩm làm gì cho ai.' })}
      <div class="grid-2">
        ${formSelect({ label: 'Lĩnh vực', name: 'field', value: v('field', 'Giáo dục'), options: fieldOptions })}
        ${formSelect({
          label: 'Giai đoạn hiện tại',
          name: 'stage',
          value: v('stage', 'y-tuong'),
          options: Object.entries(STAGES).map(([value, label]) => ({ value, label }))
        })}
      </div>
      <div class="grid-2">
        ${formField({ label: 'Thời gian cam kết (giờ/tuần)', name: 'commitment_hours', type: 'number', value: v('commitment_hours', 6), min: 1, max: 40, required: true })}
        ${formField({ label: 'Thời lượng dự kiến (tuần)', name: 'duration_weeks', type: 'number', value: v('duration_weeks', 6), min: 1, max: 52, required: true })}
      </div>
    </section>

    <section class="card stack">
      <h2>Vấn đề &amp; mục tiêu</h2>
      ${formArea({ label: 'Dự án giải quyết vấn đề gì?', name: 'problem', value: v('problem'), rows: 4, required: true, placeholder: 'Ai đang gặp vấn đề gì, hiện họ xử lý ra sao, chỗ nào chưa ổn?' })}
      ${formArea({ label: 'Mục tiêu cần đạt', name: 'goal', value: v('goal'), rows: 3, required: true, placeholder: 'Kết quả cụ thể sau giai đoạn này: người dùng, tính năng, chỉ số…' })}
      ${formArea({ label: 'Thông tin nội bộ (chỉ thành viên thấy)', name: 'sensitive_note', value: v('sensitive_note'), rows: 2, placeholder: 'Thuật toán, dữ liệu, tài liệu cần bảo mật…' })}
    </section>

    ${
      editing
        ? ''
        : `<section class="card stack">
      <h2>Vai trò cần tuyển</h2>
      <p class="muted small">Vai trò đầu tiên là bắt buộc. Hai vai trò sau là tuỳ chọn.</p>
      ${roleFields(1, v, true)}
      ${roleFields(2, v, false)}
      ${roleFields(3, v, false)}
    </section>`
    }

    <section class="card stack">
      <h2>Mức công khai</h2>
      <label class="check"><input type="radio" name="visibility" value="public" ${v('visibility', 'public') === 'public' ? 'checked' : ''}> <span>Hiện trên danh sách dự án — ai cũng có thể tìm thấy</span></label>
      <label class="check"><input type="radio" name="visibility" value="unlisted" ${v('visibility') === 'unlisted' ? 'checked' : ''}> <span>Chỉ người có đường dẫn mới xem được</span></label>
    </section>

    <div class="form-actions">
      <button class="btn btn-primary" type="submit">${editing ? 'Lưu thay đổi' : 'Đăng dự án'}</button>
      <a class="btn btn-ghost" href="${cancelHref}">Huỷ</a>
    </div>
  </form>`;
}

function roleFields(index, v, required) {
  const prefix = index === 1 ? 'role' : `role${index}`;
  const label = index === 1 ? 'Vai trò' : `Vai trò ${index} (tuỳ chọn)`;
  return `<fieldset class="role-fieldset">
    <legend>${label}</legend>
    <div class="grid-2">
      ${formField({ label: 'Tên vai trò', name: `${prefix}_title`, value: v(`${prefix}_title`), required, placeholder: index === 1 ? 'Frontend Developer' : 'UI/UX Designer' })}
      ${formField({ label: 'Số người cần', name: `${prefix}_seats`, type: 'number', value: v(`${prefix}_seats`, 1), min: 1, max: 5 })}
    </div>
    ${formField({ label: 'Kỹ năng cần thiết', name: `${prefix}_skills`, value: v(`${prefix}_skills`), required, placeholder: 'React, TypeScript, CSS', hint: 'Cách nhau bằng dấu phẩy.' })}
    ${formField({ label: 'Mô tả công việc', name: `${prefix}_description`, value: v(`${prefix}_description`), placeholder: 'Người này sẽ làm gì trong 4–6 tuần?' })}
  </fieldset>`;
}
