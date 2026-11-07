import { esc, avatar, skillChips, timeAgo, formatDate, progressBar, emptyState, formArea, formField, statusBadge, parseList } from '../views.js';
import { render, redirectOk, redirectErr, param, clampInt, parseCsv } from './util.js';
import {
  projectById,
  rolesOf,
  membersOf,
  tasksOf,
  projectStats,
  memberStats,
  isCreator,
  isMember,
  profileOf,
  notify,
  trustProfile
} from '../data.js';
import { suggestionsByRole } from '../match.js';
import { tx, nowIso } from '../db.js';

export function agreementOf(db, projectId) {
  const agreement = db.prepare('SELECT * FROM agreements WHERE project_id = ?').get(projectId);
  if (!agreement) return null;
  const parts = db
    .prepare(
      `SELECT ap.*, u.full_name, u.avatar_hue FROM agreement_parts ap
       JOIN users u ON u.id = ap.user_id WHERE ap.agreement_id = ? ORDER BY ap.percent DESC`
    )
    .all(agreement.id);
  return { ...agreement, parts };
}

const DEFAULT_TERMS =
  'Sản phẩm, mã nguồn và quyền khai thác thuộc về các thành viên theo tỷ lệ dưới đây. Mọi thành viên được quyền đưa sản phẩm vào portfolio cá nhân. Nếu dự án được bán hoặc chuyển giao, số tiền được chia theo tỷ lệ này sau khi trừ chi phí vận hành. Thay đổi tỷ lệ chỉ có hiệu lực khi tất cả thành viên xác nhận lại.';

function ensureAgreement(db, projectId) {
  let agreement = db.prepare('SELECT * FROM agreements WHERE project_id = ?').get(projectId);
  if (agreement) return agreement;
  const info = db
    .prepare('INSERT INTO agreements (project_id, terms, created_at, updated_at) VALUES (?, ?, ?, ?)')
    .run(projectId, DEFAULT_TERMS, nowIso(), nowIso());
  agreement = db.prepare('SELECT * FROM agreements WHERE id = ?').get(Number(info.lastInsertRowid));
  return agreement;
}

function splitEvenly(db, agreement, memberIds) {
  const parts = db.prepare('SELECT * FROM agreement_parts WHERE agreement_id = ?').all(agreement.id);
  const anyAccepted = parts.some((part) => part.accepted_at);
  const known = new Set(parts.map((part) => Number(part.user_id)));
  const missing = memberIds.filter((id) => !known.has(Number(id)));
  const all = [...new Set([...memberIds, ...parts.map((p) => Number(p.user_id))])];
  const shouldReset = !anyAccepted;
  const percent = all.length === 0 ? 0 : Math.floor(100 / all.length);
  const remainder = 100 - percent * all.length;

  if (shouldReset) {
    db.prepare('DELETE FROM agreement_parts WHERE agreement_id = ?').run(agreement.id);
    all.forEach((userId, index) => {
      const value = percent + (index < remainder ? 1 : 0);
      db.prepare('INSERT INTO agreement_parts (agreement_id, user_id, percent, accepted_at) VALUES (?, ?, ?, NULL)').run(
        agreement.id,
        userId,
        value
      );
    });
    return;
  }
  for (const userId of missing) {
    db.prepare('INSERT INTO agreement_parts (agreement_id, user_id, percent, accepted_at) VALUES (?, ?, 0, NULL)').run(
      agreement.id,
      userId
    );
  }
  db.prepare('UPDATE agreements SET updated_at = ? WHERE id = ?').run(nowIso(), agreement.id);
}

function memberIdsOf(db, projectId) {
  return membersOf(db, projectId).map((member) => Number(member.user_id));
}

function activateIfFull(db, project) {
  const roles = rolesOf(db, project.id);
  if (project.status === 'recruiting' && roles.length > 0 && roles.every((role) => role.filled >= role.seats)) {
    db.prepare("UPDATE projects SET status = 'active' WHERE id = ?").run(project.id);
  }
}

function requireCreator(ctx) {
  const project = projectById(ctx.db, ctx.params.id);
  if (!project) throw new Error('not-found');
  if (!isCreator(project, ctx.user?.id)) {
    const error = new Error('forbidden');
    error.status = 403;
    throw error;
  }
  return project;
}

export function registerManageRoutes(router) {
  router.get('/projects/:id/manage', (ctx) => {
    const project = requireCreator(ctx);
    const roles = rolesOf(ctx.db, project.id);
    const members = membersOf(ctx.db, project.id);
    const tasks = tasksOf(ctx.db, project.id);
    const stats = projectStats(tasks);
    const agreement = agreementOf(ctx.db, project.id);
    const applications = ctx.db
      .prepare(
        `SELECT a.*, u.full_name, u.headline, u.avatar_hue, u.id AS uid, p.skills, p.weekly_hours, p.experience_level
         FROM applications a JOIN users u ON u.id = a.user_id JOIN profiles p ON p.user_id = a.user_id
         WHERE a.project_id = ? AND a.status = 'pending' ORDER BY a.created_at`
      )
      .all(project.id)
      .map((row) => ({ ...row, skills: parseList(row.skills) }));
    const invites = ctx.db
      .prepare(
        `SELECT i.*, u.full_name, u.avatar_hue, r.title AS role_title, r.seats, r.filled
         FROM invites i JOIN users u ON u.id = i.invitee_id JOIN project_roles r ON r.id = i.role_id
         WHERE i.project_id = ? ORDER BY i.created_at DESC`
      )
      .all(project.id);
    const suggestions = suggestionsByRole(ctx.db, project, 3);
    const creator = ctx.db.prepare('SELECT * FROM users WHERE id = ?').get(project.creator_id);

    const appCards = applications
      .map((app) => {
        const role = roles.find((r) => Number(r.id) === Number(app.role_id));
        return `<article class="card applicant">
          <div class="applicant-head">
            <a class="person" href="/people/${app.uid}">${avatar(app, 'md')}<span><strong>${esc(app.full_name)}</strong><br><span class="muted small">${esc(app.headline || '')}</span></span></a>
            <div class="applicant-meta"><span class="chip chip-sm">${esc(role?.title ?? 'Vai trò')}</span><span class="muted small">${timeAgo(app.created_at)}</span></div>
          </div>
          <div class="chip-row">${skillChips(app.skills, { limit: 6, small: true })}</div>
          <p class="quote">“${esc(app.message)}”</p>
          <div class="applicant-actions">
            <form method="post" action="/applications/${app.id}/accept">
              <button class="btn btn-primary btn-sm" type="submit">Nhận vào team</button>
            </form>
            <form method="post" action="/applications/${app.id}/reject" onsubmit="return confirm('Từ chối ứng viên này?')">
              <button class="btn btn-ghost btn-sm" type="submit">Từ chối</button>
            </form>
            <a class="link-more" href="/people/${app.uid}">Xem hồ sơ →</a>
          </div>
        </article>`;
      })
      .join('');

    const roleBlocks = suggestions
      .map(({ role, candidates }) => {
        const list =
          candidates.length === 0
            ? `<p class="muted small">Chưa có ứng viên phù hợp chưa được mời. Hãy chia sẻ dự án hoặc nới lỏng kỹ năng.</p>`
            : candidates
                .map(
                  (candidate) => `<div class="suggest-row">
                    <a class="person" href="/people/${candidate.user.id}">${avatar(candidate.user, 'sm')}
                      <span><strong>${esc(candidate.user.full_name)}</strong><br><span class="muted small">${esc(candidate.user.headline || '')}</span></span>
                    </a>
                    <div class="score" title="Điểm phù hợp">${candidate.score}<span>%</span></div>
                    <p class="reasons">${candidate.reasons.map((reason) => `<span>${esc(reason)}</span>`).join('')}</p>
                    <form method="post" action="/projects/${project.id}/invite" class="invite-form">
                      <input type="hidden" name="role_id" value="${role.id}">
                      <input type="hidden" name="invitee_id" value="${candidate.user.id}">
                      <input type="hidden" name="message" value="Mình thấy kỹ năng của bạn phù hợp với vai trò ${esc(role.title)}. Bạn có muốn tham gia không?">
                      <button class="btn btn-sm" type="submit">Mời</button>
                    </form>
                  </div>`
                )
                .join('');
        return `<div class="role-block">
          <div class="role-head">
            <h3>${esc(role.title)}</h3>
            <span class="badge ${role.filled >= role.seats ? 'badge-done' : 'badge-recruiting'}">${role.filled}/${role.seats} người</span>
            <span class="muted small">${role.skills
              .map((skill) => esc(typeof skill === 'string' ? skill : skill.name))
              .join(' · ')}</span>
            ${
              Number(role.filled) === 0 && roles.length > 1
                ? `<form method="post" action="/roles/${role.id}/delete" class="role-delete" onsubmit="return confirm('Xoá vai trò này?')">
                     <button class="linklike danger-text small" type="submit">Xoá</button>
                   </form>`
                : ''
            }
          </div>
          ${list}
        </div>`;
      })
      .join('');

    const teamList = members
      .map((member) => {
        const stat = memberStats(tasks, member.user_id);
        return `<li class="team-row">
          <a class="person" href="/people/${member.user_id}">${avatar(member, 'sm')}<span><strong>${esc(member.full_name)}</strong><br><span class="muted small">${esc(member.role_title)}</span></span></a>
          <span class="muted small">${stat.done}/${stat.assigned} task</span>
          ${
            Number(member.user_id) !== Number(project.creator_id)
              ? `<form method="post" action="/projects/${project.id}/members/${member.user_id}/remove" onsubmit="return confirm('Xoá ${esc(
                  member.full_name
                )} khỏi dự án? Quyền truy cập workspace sẽ bị thu hồi.')">
                   <button class="linklike danger-text small" type="submit">Xoá</button>
                 </form>`
              : ''
          }
        </li>`;
      })
      .join('');

    const agreementBlock = agreement
      ? `<form method="post" action="/projects/${project.id}/agreement" class="stack">
          ${formArea({ label: 'Điều khoản thoả thuận', name: 'terms', value: agreement.terms, rows: 4 })}
          <div class="split-table">
            ${agreement.parts
              .map(
                (part) => `<div class="split-row">
                  <span class="person">${avatar(part, 'xs')} ${esc(part.full_name)}</span>
                  <label class="split-input"><input type="number" name="percent_${part.user_id}" value="${part.percent}" min="0" max="100" aria-label="Tỷ lệ của ${esc(part.full_name)}"> %</label>
                  <span class="badge ${part.accepted_at ? 'badge-active' : 'badge-pending'}">${part.accepted_at ? 'Đã xác nhận' : 'Chờ xác nhận'}</span>
                </div>`
              )
              .join('')}
          </div>
          <p class="muted small">Tổng tỷ lệ phải bằng 100%. Thay đổi tỷ lệ sẽ yêu cầu các thành viên xác nhận lại.</p>
          <button class="btn btn-sm" type="submit">Lưu thoả thuận</button>
        </form>`
      : `<p class="muted">Thoả thuận sẽ được tạo tự động khi bạn nhận thành viên đầu tiên.</p>`;

    const body = `
    <nav class="breadcrumb"><a href="/projects">Dự án</a><span>/</span><a href="/projects/${project.id}">${esc(project.title)}</a><span>/</span><span>Quản lý</span></nav>
    <section class="page-head split-head">
      <div>
        <div class="hero-badges">${statusBadge(project.status)}<span class="chip">${esc(project.field)}</span></div>
        <h1>${esc(project.title)}</h1>
        <p class="muted">${stats.done}/${stats.total} task hoàn thành · ${members.length} thành viên</p>
      </div>
      <div class="head-actions">
        <a class="btn btn-ghost" href="/projects/${project.id}">Trang công khai</a>
        <a class="btn btn-ghost" href="/projects/${project.id}/edit">Sửa thông tin</a>
        <a class="btn" href="/projects/${project.id}/workspace">Workspace</a>
      </div>
    </section>

    <div class="manage-grid">
      <div class="manage-main">
        <section class="card">
          <div class="section-head tight"><h2>Ứng viên chờ duyệt</h2><span class="badge">${applications.length}</span></div>
          ${applications.length ? `<div class="applicant-list">${appCards}</div>` : emptyState('Chưa có ứng viên nào đang chờ.', 'Ứng viên sẽ xuất hiện ở đây sau khi ứng tuyển.')}
        </section>

        <section class="card">
          <div class="section-head tight"><h2>Gợi ý theo vai trò</h2><span class="muted small">Điểm phù hợp do hệ thống tính, bạn quyết định cuối cùng</span></div>
          <div class="role-blocks">${roleBlocks || '<p class="muted">Dự án đã đủ người.</p>'}</div>
        </section>

        <section class="card">
          <h2>Lời mời đã gửi</h2>
          ${invites.length ? `<ul class="invite-list">${invites
            .map(
              (invite) => `<li class="team-row"><span class="person">${avatar(invite, 'xs')} ${esc(invite.full_name)}</span>
                <span class="muted small">${esc(invite.role_title)}</span>
                <span class="badge badge-${esc(invite.status)}">${invite.status === 'pending' ? 'Chờ phản hồi' : invite.status === 'accepted' ? 'Đã nhận' : 'Đã từ chối'}</span>
                <span class="muted small">${timeAgo(invite.created_at)}</span></li>`
            )
            .join('')}</ul>` : '<p class="muted">Chưa gửi lời mời nào.</p>'}
        </section>

        <section class="card">
          <h2>Thoả thuận dự án</h2>
          <p class="muted small">Chốt quyền sở hữu và tỷ lệ lợi ích trước khi làm — đây là điểm khác biệt so với một group chat.</p>
          ${agreementBlock}
        </section>
      </div>

      <aside class="manage-side">
        <section class="card">
          <h2>Team hiện tại</h2>
          <ul class="team-list">${teamList}</ul>
          <p class="muted small">Người tạo dự án luôn được tính là thành viên.</p>
        </section>
        <section class="card">
          <h2>Tiến độ</h2>
          ${progressBar(stats.percent)}
          <p class="muted small">${stats.overdue ? `${stats.overdue} task quá hạn` : 'Không có task quá hạn'}${stats.blocked ? ` · ${stats.blocked} task vướng` : ''}</p>
        </section>
        <section class="card">
          <h2>Thêm vai trò</h2>
          <form method="post" action="/projects/${project.id}/roles" class="stack tight">
            ${formField({ label: 'Tên vai trò', name: 'title', required: true, placeholder: 'Ví dụ: Content Writer' })}
            <div class="grid-2">
              ${formField({ label: 'Số người', name: 'seats', type: 'number', value: 1, min: 1, max: 5 })}
              ${formField({ label: 'Kỹ năng', name: 'skills', required: true, placeholder: 'Content, SEO' })}
            </div>
            <button class="btn btn-sm" type="submit">Thêm vai trò</button>
          </form>
        </section>
        ${
          project.status !== 'completed'
            ? `<section class="card danger">
                <h2>Kết thúc dự án</h2>
                <p class="muted small">Khi hoàn thành, hệ thống ghi nhận đóng góp của từng thành viên, cộng điểm uy tín và đưa dự án vào showcase.</p>
                <form method="post" action="/projects/${project.id}/complete" onsubmit="return confirm('Hoàn thành dự án và ghi nhận đóng góp cho tất cả thành viên?')">
                  <button class="btn btn-primary btn-sm" type="submit">Hoàn thành dự án</button>
                </form>
              </section>`
            : `<section class="card"><h2>Đã hoàn thành</h2><p class="muted small">Hoàn thành ${formatDate(project.completed_at)}. Đóng góp đã được ghi nhận.</p></section>`
        }
      </aside>
    </div>`;
    render(ctx, { title: `Quản lý · ${project.title}`, active: '/projects', body });
  });

  router.post('/projects/:id/roles', (ctx) => {
    const project = requireCreator(ctx);
    const title = param(ctx, 'title');
    const skills = parseCsv(ctx.body.skills, 8);
    if (!title || skills.length === 0) {
      redirectErr(ctx, `/projects/${project.id}/manage`, 'Vai trò cần tên và ít nhất một kỹ năng.');
      return;
    }
    ctx.db
      .prepare('INSERT INTO project_roles (project_id, title, skills, seats, description, position) VALUES (?, ?, ?, ?, ?, ?)')
      .run(project.id, title.slice(0, 80), JSON.stringify(skills), clampInt(ctx.body.seats, 1, 5, 1), param(ctx, 'description').slice(0, 400), 99);
    redirectOk(ctx, `/projects/${project.id}/manage`, 'Đã thêm vai trò mới.');
  });

  router.post('/roles/:id/delete', (ctx) => {
    const role = ctx.db.prepare('SELECT * FROM project_roles WHERE id = ?').get(ctx.params.id);
    if (!role) throw new Error('not-found');
    const project = projectById(ctx.db, role.project_id);
    if (!isCreator(project, ctx.user?.id)) {
      const error = new Error('forbidden');
      error.status = 403;
      throw error;
    }
    if (Number(role.filled) > 0) {
      redirectErr(ctx, `/projects/${project.id}/manage`, 'Không thể xoá vai trò đã có người.');
      return;
    }
    ctx.db.prepare('DELETE FROM project_roles WHERE id = ?').run(role.id);
    redirectOk(ctx, `/projects/${project.id}/manage`, 'Đã xoá vai trò.');
  });

  router.post('/applications/:id/accept', (ctx) => {
    const application = ctx.db.prepare('SELECT * FROM applications WHERE id = ?').get(ctx.params.id);
    if (!application) throw new Error('not-found');
    const project = projectById(ctx.db, application.project_id);
    if (!isCreator(project, ctx.user?.id)) {
      const error = new Error('forbidden');
      error.status = 403;
      throw error;
    }
    if (application.status !== 'pending') {
      redirectErr(ctx, `/projects/${project.id}/manage`, 'Ứng viên này đã được xử lý.');
      return;
    }
    const role = ctx.db.prepare('SELECT * FROM project_roles WHERE id = ?').get(application.role_id);
    if (!role || Number(role.filled) >= Number(role.seats)) {
      redirectErr(ctx, `/projects/${project.id}/manage`, 'Vai trò đã đủ người, không thể nhận thêm.');
      return;
    }
    const applicant = ctx.db.prepare('SELECT * FROM users WHERE id = ?').get(application.user_id);

    tx(ctx.db, () => {
      ctx.db
        .prepare("UPDATE applications SET status = 'accepted', decided_at = ? WHERE id = ?")
        .run(nowIso(), application.id);
      const membership = ctx.db
        .prepare('SELECT * FROM memberships WHERE project_id = ? AND user_id = ?')
        .get(project.id, applicant.id);
      if (membership) {
        ctx.db
          .prepare("UPDATE memberships SET status = 'active', role_id = ?, role_title = ?, joined_at = ? WHERE id = ?")
          .run(role.id, role.title, nowIso(), membership.id);
      } else {
        ctx.db
          .prepare(
            "INSERT INTO memberships (project_id, role_id, user_id, role_title, status, joined_at) VALUES (?, ?, ?, ?, 'active', ?)"
          )
          .run(project.id, role.id, applicant.id, role.title, nowIso());
      }
      ctx.db.prepare('UPDATE project_roles SET filled = filled + 1 WHERE id = ?').run(role.id);
      const agreement = ensureAgreement(ctx.db, project.id);
      splitEvenly(ctx.db, agreement, memberIdsOf(ctx.db, project.id));
      activateIfFull(ctx.db, project);
      notify(ctx.db, applicant.id, {
        type: 'accepted',
        title: `Bạn đã được nhận vào ${project.title}`,
        body: `Vai trò: ${role.title}. Vào workspace để xem task và thoả thuận dự án.`,
        link: `/projects/${project.id}/workspace`
      });
    });

    redirectOk(ctx, `/projects/${project.id}/manage`, `Đã nhận ${applicant.full_name} vào vai trò ${role.title}.`);
  });

  router.post('/applications/:id/reject', (ctx) => {
    const application = ctx.db.prepare('SELECT * FROM applications WHERE id = ?').get(ctx.params.id);
    if (!application) throw new Error('not-found');
    const project = projectById(ctx.db, application.project_id);
    if (!isCreator(project, ctx.user?.id)) {
      const error = new Error('forbidden');
      error.status = 403;
      throw error;
    }
    ctx.db.prepare("UPDATE applications SET status = 'rejected', decided_at = ? WHERE id = ?").run(nowIso(), application.id);
    notify(ctx.db, application.user_id, {
      type: 'rejected',
      title: `Đơn ứng tuyển ${project.title} chưa phù hợp`,
      body: 'Cảm ơn bạn đã quan tâm. Hãy thử các dự án khác đang tuyển.',
      link: '/projects'
    });
    redirectOk(ctx, `/projects/${project.id}/manage`, 'Đã từ chối ứng viên.');
  });

  router.post('/projects/:id/invite', (ctx) => {
    const project = requireCreator(ctx);
    const role = rolesOf(ctx.db, project.id).find((r) => Number(r.id) === Number(ctx.body.role_id));
    const inviteeId = Number(ctx.body.invitee_id);
    const invitee = ctx.db.prepare('SELECT * FROM users WHERE id = ?').get(inviteeId);
    if (!role || !invitee) {
      redirectErr(ctx, `/projects/${project.id}/manage`, 'Lời mời không hợp lệ.');
      return;
    }
    if (isMember(ctx.db, project.id, inviteeId)) {
      redirectErr(ctx, `/projects/${project.id}/manage`, 'Người này đã ở trong team.');
      return;
    }
    if (role.filled >= role.seats) {
      redirectErr(ctx, `/projects/${project.id}/manage`, 'Vai trò đã đủ người.');
      return;
    }
    const existing = ctx.db
      .prepare('SELECT * FROM invites WHERE project_id = ? AND role_id = ? AND invitee_id = ?')
      .get(project.id, role.id, inviteeId);
    if (existing && existing.status === 'pending') {
      redirectErr(ctx, `/projects/${project.id}/manage`, 'Bạn đã mời người này cho vai trò đó.');
      return;
    }
    if (existing) {
      ctx.db.prepare("UPDATE invites SET status = 'pending', created_at = ?, message = ? WHERE id = ?").run(
        nowIso(),
        param(ctx, 'message').slice(0, 600),
        existing.id
      );
    } else {
      ctx.db
        .prepare(
          `INSERT INTO invites (project_id, role_id, inviter_id, invitee_id, message, status, created_at)
           VALUES (?, ?, ?, ?, ?, 'pending', ?)`
        )
        .run(project.id, role.id, ctx.user.id, inviteeId, param(ctx, 'message').slice(0, 600), nowIso());
    }
    notify(ctx.db, inviteeId, {
      type: 'invite',
      title: `${ctx.user.full_name} mời bạn vào ${project.title}`,
      body: `Vai trò: ${role.title}. Xem lời mời và phản hồi.`,
      link: '/invites'
    });
    redirectOk(ctx, `/projects/${project.id}/manage`, `Đã gửi lời mời tới ${invitee.full_name}.`);
  });

  router.post('/projects/:id/agreement', (ctx) => {
    const project = requireCreator(ctx);
    const agreement = agreementOf(ctx.db, project.id);
    if (!agreement) {
      redirectErr(ctx, `/projects/${project.id}/manage`, 'Chưa có thoả thuận để cập nhật.');
      return;
    }
    const members = membersOf(ctx.db, project.id);
    const percents = members.map((member) => ({
      member,
      percent: clampInt(ctx.body[`percent_${member.user_id}`], 0, 100, 0)
    }));
    const sum = percents.reduce((total, item) => total + item.percent, 0);
    if (sum !== 100) {
      redirectErr(ctx, `/projects/${project.id}/manage`, `Tổng tỷ lệ hiện là ${sum}% — cần đúng 100% trước khi lưu.`);
      return;
    }
    tx(ctx.db, () => {
      ctx.db
        .prepare('UPDATE agreements SET terms = ?, updated_at = ? WHERE id = ?')
        .run(param(ctx, 'terms').slice(0, 3000) || DEFAULT_TERMS, nowIso(), agreement.id);
      for (const item of percents) {
        const existing = agreement.parts.find((part) => Number(part.user_id) === Number(item.member.user_id));
        if (existing) {
          const changed = Number(existing.percent) !== item.percent;
          ctx.db
            .prepare('UPDATE agreement_parts SET percent = ?, accepted_at = ? WHERE id = ?')
            .run(item.percent, changed ? null : existing.accepted_at, existing.id);
        } else {
          ctx.db
            .prepare('INSERT INTO agreement_parts (agreement_id, user_id, percent, accepted_at) VALUES (?, ?, ?, NULL)')
            .run(agreement.id, item.member.user_id, item.percent);
        }
      }
      // Thành viên đã rời không còn trong bảng chia
      const activeIds = new Set(members.map((m) => Number(m.user_id)));
      for (const part of agreement.parts) {
        if (!activeIds.has(Number(part.user_id))) {
          ctx.db.prepare('DELETE FROM agreement_parts WHERE id = ?').run(part.id);
        }
      }
    });
    redirectOk(ctx, `/projects/${project.id}/manage`, 'Đã cập nhật thoả thuận. Thành viên sẽ cần xác nhận lại nếu tỷ lệ thay đổi.');
  });

  router.post('/projects/:id/agreement/accept', (ctx) => {
    const project = projectById(ctx.db, ctx.params.id);
    if (!project) throw new Error('not-found');
    if (!isMember(ctx.db, project.id, ctx.user?.id)) {
      const error = new Error('forbidden');
      error.status = 403;
      throw error;
    }
    const agreement = agreementOf(ctx.db, project.id);
    if (!agreement) {
      redirectErr(ctx, `/projects/${project.id}/workspace`, 'Dự án chưa có thoả thuận.');
      return;
    }
    const part = agreement.parts.find((p) => Number(p.user_id) === Number(ctx.user.id));
    if (!part) {
      redirectErr(ctx, `/projects/${project.id}/workspace`, 'Bạn chưa có phần trong thoả thuận này.');
      return;
    }
    ctx.db.prepare('UPDATE agreement_parts SET accepted_at = ? WHERE id = ?').run(nowIso(), part.id);
    notify(ctx.db, project.creator_id, {
      type: 'agreement',
      title: `${ctx.user.full_name} đã xác nhận thoả thuận`,
      body: `${project.title} — tỷ lệ ${part.percent}%.`,
      link: `/projects/${project.id}/manage`
    });
    redirectOk(ctx, `/projects/${project.id}/workspace`, 'Bạn đã xác nhận thoả thuận dự án.');
  });

  router.post('/projects/:id/complete', (ctx) => {
    const project = requireCreator(ctx);
    if (project.status === 'completed') {
      redirectErr(ctx, `/projects/${project.id}/manage`, 'Dự án đã hoàn thành.');
      return;
    }
    const members = membersOf(ctx.db, project.id);
    const tasks = tasksOf(ctx.db, project.id);
    const done = tasks.filter((task) => task.status === 'done');
    if (done.length === 0) {
      redirectErr(ctx, `/projects/${project.id}/manage`, 'Cần ít nhất một task hoàn thành trước khi kết thúc dự án.');
      return;
    }
    tx(ctx.db, () => {
      const completedAt = nowIso();
      for (const member of members) {
        const mine = done.filter((task) => Number(task.assignee_id) === Number(member.user_id));
        const role = member.role_title || 'Thành viên';
        const summary =
          mine.length > 0
            ? `Hoàn thành ${mine.length} task trong vai trò ${role}.`
            : `Tham gia với vai trò ${role}.`;
        ctx.db
          .prepare(
            'INSERT INTO contributions (project_id, user_id, role_title, tasks_done, summary, created_at) VALUES (?, ?, ?, ?, ?, ?)'
          )
          .run(project.id, member.user_id, role, mine.length, summary, completedAt);
        if (mine.length > 0) {
          ctx.db
            .prepare('INSERT INTO reputation_events (user_id, project_id, points, reason, created_at) VALUES (?, ?, ?, ?, ?)')
            .run(member.user_id, project.id, mine.length, `Hoàn thành ${mine.length} task trong dự án ${project.title}`, completedAt);
        }
        ctx.db
          .prepare('INSERT INTO reputation_events (user_id, project_id, points, reason, created_at) VALUES (?, ?, ?, ?, ?)')
          .run(member.user_id, project.id, 6, `Hoàn thành dự án ${project.title}`, completedAt);
        if (Number(member.user_id) !== Number(project.creator_id)) {
          notify(ctx.db, member.user_id, {
            type: 'completed',
            title: `Dự án ${project.title} đã hoàn thành`,
            body: `Đóng góp của bạn: ${mine.length} task. Xem lại trên hồ sơ uy tín.`,
            link: `/projects/${project.id}`
          });
        }
      }
      ctx.db
        .prepare('INSERT INTO reputation_events (user_id, project_id, points, reason, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(project.creator_id, project.id, 4, `Điều phối và hoàn thành dự án ${project.title}`, completedAt);
      ctx.db.prepare("UPDATE projects SET status = 'completed', completed_at = ? WHERE id = ?").run(completedAt, project.id);
    });
    redirectOk(ctx, `/projects/${project.id}`, 'Dự án đã hoàn thành. Đóng góp của từng thành viên đã được ghi nhận.');
  });

  router.post('/projects/:id/members/:userId/remove', (ctx) => {
    const project = requireCreator(ctx);
    const userId = Number(ctx.params.userId);
    if (userId === Number(project.creator_id)) {
      redirectErr(ctx, `/projects/${project.id}/manage`, 'Không thể xoá người tạo dự án.');
      return;
    }
    const membership = ctx.db
      .prepare("SELECT * FROM memberships WHERE project_id = ? AND user_id = ? AND status = 'active'")
      .get(project.id, userId);
    if (!membership) {
      redirectErr(ctx, `/projects/${project.id}/manage`, 'Người này không còn trong team.');
      return;
    }
    const member = ctx.db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    tx(ctx.db, () => {
      ctx.db.prepare("UPDATE memberships SET status = 'removed', left_at = ? WHERE id = ?").run(nowIso(), membership.id);
      if (membership.role_id) {
        ctx.db.prepare('UPDATE project_roles SET filled = MAX(0, filled - 1) WHERE id = ?').run(membership.role_id);
      }
      const agreement = agreementOf(ctx.db, project.id);
      if (agreement) {
        ctx.db.prepare('DELETE FROM agreement_parts WHERE agreement_id = ? AND user_id = ?').run(agreement.id, userId);
      }
      if (project.status === 'active') {
        ctx.db.prepare("UPDATE projects SET status = 'recruiting' WHERE id = ?").run(project.id);
      }
      notify(ctx.db, userId, {
        type: 'removed',
        title: `Bạn đã được đưa ra khỏi ${project.title}`,
        body: 'Quyền truy cập workspace đã bị thu hồi. Đóng góp đã ghi nhận trước đó vẫn được giữ.',
        link: '/projects'
      });
    });
    redirectOk(ctx, `/projects/${project.id}/manage`, `Đã xoá ${member.full_name} khỏi team.`);
  });

  router.post('/projects/:id/leave', (ctx) => {
    const project = projectById(ctx.db, ctx.params.id);
    if (!project) throw new Error('not-found');
    if (isCreator(project, ctx.user?.id)) {
      redirectErr(ctx, `/projects/${project.id}/workspace`, 'Người tạo dự án không thể rời dự án.');
      return;
    }
    if (!isMember(ctx.db, project.id, ctx.user?.id)) {
      redirectErr(ctx, `/projects/${project.id}`, 'Bạn không phải thành viên dự án này.');
      return;
    }
    const membership = ctx.db
      .prepare("SELECT * FROM memberships WHERE project_id = ? AND user_id = ? AND status = 'active'")
      .get(project.id, ctx.user.id);
    tx(ctx.db, () => {
      ctx.db.prepare("UPDATE memberships SET status = 'left', left_at = ? WHERE id = ?").run(nowIso(), membership.id);
      if (membership.role_id) {
        ctx.db.prepare('UPDATE project_roles SET filled = MAX(0, filled - 1) WHERE id = ?').run(membership.role_id);
      }
      if (project.status === 'active') {
        ctx.db.prepare("UPDATE projects SET status = 'recruiting' WHERE id = ?").run(project.id);
      }
      notify(ctx.db, project.creator_id, {
        type: 'left',
        title: `${ctx.user.full_name} đã rời dự án`,
        body: `${project.title} — vai trò ${membership.role_title} đang trống. Hệ thống sẽ gợi ý người thay thế.`,
        link: `/projects/${project.id}/manage`
      });
    });
    redirectOk(ctx, '/projects', 'Bạn đã rời dự án. Quyền truy cập workspace đã được thu hồi.');
  });
}
