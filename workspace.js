import { esc, avatar, timeAgo, formatDate, progressBar, emptyState, formSelect, formField, formArea, statusBadge, TASK_STATUS } from '../views.js';
import { render, redirectOk, redirectErr, param, clampInt } from './util.js';
import { projectById, rolesOf, membersOf, tasksOf, projectStats, memberStats, isCreator, isMember, notify } from '../data.js';
import { agreementOf } from './manage.js';
import { nowIso } from '../db.js';

const COLUMNS = ['todo', 'in_progress', 'review', 'done'];

function isOverdue(task) {
  return task.due_date && task.status !== 'done' && task.due_date < new Date().toISOString().slice(0, 10);
}

function taskCard(ctx, project, task, members, canEdit) {
  const overdue = isOverdue(task);
  const assignee = task.assignee_id
    ? `<span class="person">${avatar({ full_name: task.assignee_name, avatar_hue: task.assignee_hue }, 'xs')}<span class="small">${esc(
        task.assignee_name
      )}</span></span>`
    : '<span class="muted small">Chưa giao việc</span>';
  const options = members
    .map(
      (member) =>
        `<option value="${member.user_id}"${Number(member.user_id) === Number(task.assignee_id) ? ' selected' : ''}>${esc(
          member.full_name
        )}</option>`
    )
    .join('');
  return `<article class="task-card${overdue ? ' overdue' : ''}${task.blocked_reason ? ' blocked' : ''}">
    <div class="task-top">
      <span class="prio prio-${esc(task.priority)}" title="Ưu tiên ${esc(task.priority)}"></span>
      <h4>${esc(task.title)}</h4>
    </div>
    ${task.description ? `<p class="muted small">${esc(task.description)}</p>` : ''}
    ${task.blocked_reason ? `<p class="blocked-note">Vướng: ${esc(task.blocked_reason)}</p>` : ''}
    <div class="task-meta">
      ${assignee}
      ${task.due_date ? `<span class="due${overdue ? ' late' : ''}">${esc(formatDate(task.due_date))}</span>` : ''}
    </div>
    <div class="task-actions">
      <form method="post" action="/tasks/${task.id}/status" class="inline-form">
        <select name="status" data-autosubmit aria-label="Trạng thái task">
          ${COLUMNS.map(
            (status) => `<option value="${status}"${task.status === status ? ' selected' : ''}>${esc(TASK_STATUS[status])}</option>`
          ).join('')}
        </select>
        <noscript><button class="btn btn-sm" type="submit">Cập nhật</button></noscript>
      </form>
      ${
        canEdit
          ? `<details class="task-menu">
              <summary aria-label="Thêm thao tác">⋯</summary>
              <div class="task-menu-panel">
                <form method="post" action="/tasks/${task.id}/assign" class="stack tight">
                  <label class="field"><span class="field-label">Giao cho</span>
                    <select name="assignee_id" data-autosubmit>
                      <option value="">— Chưa giao —</option>${options}
                    </select>
                  </label>
                  <noscript><button class="btn btn-sm" type="submit">Lưu</button></noscript>
                </form>
                <form method="post" action="/tasks/${task.id}/blocked" class="stack tight">
                  <label class="field"><span class="field-label">Báo vướng mắc</span>
                    <textarea name="reason" rows="2" placeholder="Đang chờ gì, ai cần hỗ trợ?">${esc(task.blocked_reason)}</textarea>
                  </label>
                  <button class="btn btn-sm" type="submit">Lưu vướng mắc</button>
                </form>
                ${
                  canEdit === 'creator'
                    ? `<form method="post" action="/tasks/${task.id}/delete" onsubmit="return confirm('Xoá task này?')">
                         <button class="linklike danger-text" type="submit">Xoá task</button>
                       </form>`
                    : ''
                }
              </div>
            </details>`
          : ''
      }
    </div>
  </article>`;
}

export function registerWorkspaceRoutes(router) {
  router.get('/projects/:id/workspace', (ctx) => {
    const project = projectById(ctx.db, ctx.params.id);
    if (!project) throw new Error('not-found');
    const member = isMember(ctx.db, project.id, ctx.user?.id);
    const creator = isCreator(project, ctx.user?.id);
    if (!member && !creator) {
      const error = new Error('forbidden');
      error.status = 403;
      throw error;
    }
    const roles = rolesOf(ctx.db, project.id);
    const members = membersOf(ctx.db, project.id);
    const tasks = tasksOf(ctx.db, project.id);
    const stats = projectStats(tasks);
    const agreement = agreementOf(ctx.db, project.id);
    const myPart = agreement?.parts.find((part) => Number(part.user_id) === Number(ctx.user.id));
    const pendingParts = agreement ? agreement.parts.filter((part) => !part.accepted_at) : [];
    const roleTitle = members.find((m) => Number(m.user_id) === Number(ctx.user.id))?.role_title ?? 'Người tạo dự án';

    const board = COLUMNS.map((status) => {
      const columnTasks = tasks.filter((task) => task.status === status);
      return `<section class="kanban-col" data-status="${status}">
        <header class="kanban-head"><h3>${esc(TASK_STATUS[status])}</h3><span class="count">${columnTasks.length}</span></header>
        <div class="kanban-body">
          ${columnTasks.map((task) => taskCard(ctx, project, task, members, creator ? 'creator' : 'member')).join('') ||
          '<p class="muted small empty-col">Không có task.</p>'}
        </div>
      </section>`;
    }).join('');

    const memberRows = members
      .map((m) => {
        const stat = memberStats(tasks, m.user_id);
        return `<li class="member-progress">
          <div class="person">${avatar(m, 'sm')}<span><strong>${esc(m.full_name)}</strong><br><span class="muted small">${esc(
          m.role_title
        )}</span></span></div>
          <div class="member-bar">${progressBar(stat.percent)}</div>
          <span class="muted small">${stat.done}/${stat.assigned}${stat.blocked ? ` · ${stat.blocked} vướng` : ''}${
          stat.overdue ? ` · ${stat.overdue} trễ` : ''
        }</span>
        </li>`;
      })
      .join('');

    const agreementPanel = agreement
      ? `<section class="card">
          <div class="section-head tight">
            <h2>Thoả thuận dự án</h2>
            <span class="badge ${pendingParts.length ? 'badge-pending' : 'badge-active'}">${
              pendingParts.length ? `${pendingParts.length} người chưa xác nhận` : 'Đã đủ xác nhận'
            }</span>
          </div>
          <p class="terms-preview">${esc(agreement.terms)}</p>
          <ul class="split-list">${agreement.parts
            .map(
              (part) => `<li class="split-row">
                <span class="person">${avatar(part, 'xs')} ${esc(part.full_name)}</span>
                <strong>${part.percent}%</strong>
                <span class="badge ${part.accepted_at ? 'badge-active' : 'badge-pending'}">${
                  part.accepted_at ? 'Đã xác nhận' : 'Chờ xác nhận'
                }</span>
              </li>`
            )
            .join('')}</ul>
          ${
            myPart && !myPart.accepted_at
              ? `<form method="post" action="/projects/${project.id}/agreement/accept">
                   <button class="btn btn-primary btn-sm" type="submit">Tôi đã đọc và xác nhận thoả thuận</button>
                 </form>`
              : ''
          }
        </section>`
      : '';

    const body = `
    <nav class="breadcrumb"><a href="/projects">Dự án</a><span>/</span><a href="/projects/${project.id}">${esc(project.title)}</a><span>/</span><span>Workspace</span></nav>
    <section class="page-head split-head">
      <div>
        <div class="hero-badges">${statusBadge(project.status)}<span class="chip">${esc(roleTitle)}</span></div>
        <h1>${esc(project.title)}</h1>
        <div class="meta-row">
          <span>${members.length} thành viên</span>
          <span>${stats.done}/${stats.total} task hoàn thành</span>
          ${stats.overdue ? `<span class="danger-text">${stats.overdue} task quá hạn</span>` : ''}
        </div>
      </div>
      <div class="head-actions">
        <a class="btn btn-ghost" href="/projects/${project.id}">Trang dự án</a>
        ${creator ? `<a class="btn" href="/projects/${project.id}/manage">Quản lý</a>` : ''}
      </div>
    </section>

    <section class="card progress-overview">
      ${progressBar(stats.percent, { label: 'Tiến độ dự án' })}
      <div class="mini-stats four">
        <div><strong>${stats.todo}</strong><span>cần làm</span></div>
        <div><strong>${stats.inProgress}</strong><span>đang làm</span></div>
        <div><strong>${stats.review}</strong><span>chờ review</span></div>
        <div><strong>${stats.blocked}</strong><span>vướng mắc</span></div>
      </div>
    </section>

    ${
      pendingParts.length
        ? `<div class="banner banner-warn">Thoả thuận dự án chưa được tất cả thành viên xác nhận. ${
            myPart && !myPart.accepted_at ? 'Hãy xác nhận phần của bạn ở khung bên dưới.' : 'Cần nhắc thành viên còn lại.'
          }</div>`
        : ''
    }

    <section class="card">
      <div class="section-head tight"><h2>Bảng công việc</h2><span class="muted small">Kéo thả chưa hỗ trợ — đổi trạng thái bằng menu</span></div>
      <div class="kanban">${board}</div>
    </section>

    <div class="workspace-grid">
      <div>
        <section class="card">
          <h2>Thêm task</h2>
          <form method="post" action="/projects/${project.id}/tasks" class="stack">
            ${formField({ label: 'Tên task', name: 'title', required: true, placeholder: 'Ví dụ: Thiết kế màn hình nhập liệu' })}
            <div class="grid-3">
              ${formSelect({ label: 'Giao cho', name: 'assignee_id', value: '', options: [{ value: '', label: '— Chưa giao —' }, ...members.map((m) => ({ value: String(m.user_id), label: m.full_name }))] })}
              ${formField({ label: 'Hạn chót', name: 'due_date', type: 'date', value: '' })}
              ${formSelect({ label: 'Ưu tiên', name: 'priority', value: 'normal', options: [{ value: 'low', label: 'Thấp' }, { value: 'normal', label: 'Bình thường' }, { value: 'high', label: 'Cao' }] })}
            </div>
            ${formArea({ label: 'Mô tả (tuỳ chọn)', name: 'description', rows: 2 })}
            <button class="btn btn-primary btn-sm" type="submit">Tạo task</button>
          </form>
        </section>
        ${agreementPanel}
      </div>
      <aside>
        <section class="card">
          <h2>Tiến độ từng người</h2>
          <ul class="member-progress-list">${memberRows}</ul>
        </section>
        <section class="card">
          <h2>Thành viên</h2>
          <ul class="member-chips">${members
            .map(
              (m) => `<li><a class="person" href="/people/${m.user_id}">${avatar(m, 'sm')}<span><strong>${esc(
                m.full_name.split(' ').slice(-1)[0]
              )}</strong><br><span class="muted small">${esc(m.role_title)}</span></span></a></li>`
            )
            .join('')}</ul>
        </section>
        ${
          creator
            ? `<section class="card danger">
                <h2>Kết thúc</h2>
                <p class="muted small">Hoàn thành dự án để ghi nhận đóng góp và cộng điểm uy tín.</p>
                <a class="btn btn-sm" href="/projects/${project.id}/manage">Sang trang quản lý</a>
              </section>`
            : `<section class="card">
                <h2>Rời dự án</h2>
                <p class="muted small">Quyền truy cập workspace sẽ bị thu hồi. Đóng góp đã ghi nhận trước đó vẫn được giữ.</p>
                <form method="post" action="/projects/${project.id}/leave" onsubmit="return confirm('Rời dự án này? Mọi quyền truy cập nội bộ sẽ bị thu hồi.')">
                  <button class="btn btn-ghost btn-sm" type="submit">Rời dự án</button>
                </form>
              </section>`
        }
      </aside>
    </div>`;
    render(ctx, { title: `Workspace · ${project.title}`, active: '/projects', body });
  });

  router.post('/projects/:id/tasks', (ctx) => {
    const project = projectById(ctx.db, ctx.params.id);
    if (!project) throw new Error('not-found');
    if (!isMember(ctx.db, project.id, ctx.user?.id)) {
      const error = new Error('forbidden');
      error.status = 403;
      throw error;
    }
    const title = param(ctx, 'title');
    if (title.length < 3) {
      redirectErr(ctx, `/projects/${project.id}/workspace`, 'Tên task cần ít nhất 3 ký tự.');
      return;
    }
    const members = membersOf(ctx.db, project.id);
    const assignee = members.find((m) => Number(m.user_id) === Number(ctx.body.assignee_id));
    const due = /^\d{4}-\d{2}-\d{2}$/.test(ctx.body.due_date ?? '') ? ctx.body.due_date : null;
    const priority = ['low', 'normal', 'high'].includes(ctx.body.priority) ? ctx.body.priority : 'normal';
    ctx.db
      .prepare(
        `INSERT INTO tasks (project_id, title, description, assignee_id, status, due_date, priority, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'todo', ?, ?, ?, ?)`
      )
      .run(
        project.id,
        title.slice(0, 160),
        param(ctx, 'description').slice(0, 1000),
        assignee?.user_id ?? null,
        due,
        priority,
        nowIso(),
        nowIso()
      );
    if (assignee) {
      notify(ctx.db, assignee.user_id, {
        type: 'task',
        title: `Bạn được giao task mới trong ${project.title}`,
        body: title,
        link: `/projects/${project.id}/workspace`
      });
    }
    redirectOk(ctx, `/projects/${project.id}/workspace`, 'Đã thêm task.');
  });

  function loadTask(ctx) {
    const task = ctx.db.prepare('SELECT * FROM tasks WHERE id = ?').get(ctx.params.id);
    if (!task) throw new Error('not-found');
    const project = projectById(ctx.db, task.project_id);
    if (!isMember(ctx.db, project.id, ctx.user?.id)) {
      const error = new Error('forbidden');
      error.status = 403;
      throw error;
    }
    return { task, project };
  }

  router.post('/tasks/:id/status', (ctx) => {
    const { task, project } = loadTask(ctx);
    const status = ctx.body.status;
    if (!COLUMNS.includes(status)) {
      redirectErr(ctx, `/projects/${project.id}/workspace`, 'Trạng thái không hợp lệ.');
      return;
    }
    const completedAt = status === 'done' ? nowIso() : null;
    ctx.db
      .prepare('UPDATE tasks SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?')
      .run(status, completedAt, nowIso(), task.id);
    if (status === 'review' && Number(task.assignee_id) !== Number(project.creator_id)) {
      notify(ctx.db, project.creator_id, {
        type: 'task',
        title: `Task "${task.title}" đang chờ review`,
        body: `${ctx.user.full_name} đã chuyển sang chờ review.`,
        link: `/projects/${project.id}/workspace`
      });
    }
    if (status === 'done' && Number(task.assignee_id) === Number(ctx.user.id)) {
      notify(ctx.db, project.creator_id, {
        type: 'task',
        title: `Task "${task.title}" đã hoàn thành`,
        body: `${ctx.user.full_name} đã đánh dấu hoàn thành.`,
        link: `/projects/${project.id}/workspace`
      });
    }
    redirectOk(ctx, `/projects/${project.id}/workspace`, `Đã chuyển task sang “${TASK_STATUS[status]}”.`);
  });

  router.post('/tasks/:id/assign', (ctx) => {
    const { task, project } = loadTask(ctx);
    const members = membersOf(ctx.db, project.id);
    const assignee = members.find((m) => Number(m.user_id) === Number(ctx.body.assignee_id));
    ctx.db
      .prepare('UPDATE tasks SET assignee_id = ?, updated_at = ? WHERE id = ?')
      .run(assignee?.user_id ?? null, nowIso(), task.id);
    if (assignee && Number(assignee.user_id) !== Number(ctx.user.id)) {
      notify(ctx.db, assignee.user_id, {
        type: 'task',
        title: `Bạn được giao task trong ${project.title}`,
        body: task.title,
        link: `/projects/${project.id}/workspace`
      });
    }
    redirectOk(ctx, `/projects/${project.id}/workspace`, assignee ? `Đã giao task cho ${assignee.full_name}.` : 'Đã bỏ giao task.');
  });

  router.post('/tasks/:id/blocked', (ctx) => {
    const { task, project } = loadTask(ctx);
    const reason = param(ctx, 'reason').slice(0, 300);
    ctx.db.prepare('UPDATE tasks SET blocked_reason = ?, updated_at = ? WHERE id = ?').run(reason, nowIso(), task.id);
    if (reason) {
      notify(ctx.db, project.creator_id, {
        type: 'blocked',
        title: `Task "${task.title}" đang vướng`,
        body: reason,
        link: `/projects/${project.id}/workspace`
      });
    }
    redirectOk(ctx, `/projects/${project.id}/workspace`, reason ? 'Đã ghi nhận vướng mắc để team hỗ trợ.' : 'Đã xoá ghi chú vướng mắc.');
  });

  router.post('/tasks/:id/delete', (ctx) => {
    const task = ctx.db.prepare('SELECT * FROM tasks WHERE id = ?').get(ctx.params.id);
    if (!task) throw new Error('not-found');
    const project = projectById(ctx.db, task.project_id);
    if (!isCreator(project, ctx.user?.id)) {
      const error = new Error('forbidden');
      error.status = 403;
      throw error;
    }
    ctx.db.prepare('DELETE FROM tasks WHERE id = ?').run(task.id);
    redirectOk(ctx, `/projects/${project.id}/workspace`, 'Đã xoá task.');
  });
}
