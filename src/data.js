import { parseList } from './views.js';

export function projectById(db, id) {
  return db.prepare('SELECT * FROM projects WHERE id = ?').get(id) ?? null;
}

export function userById(db, id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) ?? null;
}

export function profileOf(db, userId) {
  const row = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId);
  if (!row) return null;
  return {
    ...row,
    skills: parseList(row.skills),
    desired_roles: parseList(row.desired_roles),
    interests: parseList(row.interests)
  };
}

export function rolesOf(db, projectId) {
  return db
    .prepare('SELECT * FROM project_roles WHERE project_id = ? ORDER BY position, id')
    .all(projectId)
    .map((role) => ({ ...role, skills: parseList(role.skills) }));
}

export function membersOf(db, projectId, status = 'active') {
  return db
    .prepare(
      `SELECT m.*, u.full_name, u.headline, u.avatar_hue, u.email
       FROM memberships m JOIN users u ON u.id = m.user_id
       WHERE m.project_id = ? AND m.status = ?
       ORDER BY m.joined_at`
    )
    .all(projectId, status);
}

export function tasksOf(db, projectId) {
  return db
    .prepare(
      `SELECT t.*, u.full_name AS assignee_name, u.avatar_hue AS assignee_hue
       FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id
       WHERE t.project_id = ?
       ORDER BY t.priority = 'high' DESC, t.due_date IS NULL, t.due_date, t.id`
    )
    .all(projectId);
}

export function isMember(db, projectId, userId) {
  if (!userId) return false;
  return Boolean(
    db
      .prepare("SELECT 1 FROM memberships WHERE project_id = ? AND user_id = ? AND status = 'active'")
      .get(projectId, userId)
  );
}

export function isCreator(project, userId) {
  return Boolean(userId) && Number(project.creator_id) === Number(userId);
}

export function unreadCount(db, userId) {
  if (!userId) return 0;
  return Number(
    db.prepare('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read_at IS NULL').get(userId).c
  );
}

const today = () => new Date().toISOString().slice(0, 10);

export function isOverdue(task) {
  return Boolean(task.due_date) && task.status !== 'done' && task.due_date < today();
}

export function projectStats(tasks) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'done').length;
  const review = tasks.filter((t) => t.status === 'review').length;
  const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
  const blocked = tasks.filter((t) => t.blocked_reason && t.status !== 'done').length;
  const overdue = tasks.filter(isOverdue).length;
  return {
    total,
    done,
    review,
    inProgress,
    todo: tasks.filter((t) => t.status === 'todo').length,
    blocked,
    overdue,
    percent: total === 0 ? 0 : Math.round((done / total) * 100)
  };
}

export function memberStats(tasks, userId) {
  const mine = tasks.filter((t) => Number(t.assignee_id) === Number(userId));
  const done = mine.filter((t) => t.status === 'done').length;
  return {
    assigned: mine.length,
    done,
    open: mine.filter((t) => t.status !== 'done').length,
    blocked: mine.filter((t) => t.blocked_reason && t.status !== 'done').length,
    overdue: mine.filter(isOverdue).length,
    percent: mine.length === 0 ? 0 : Math.round((done / mine.length) * 100)
  };
}

export function trustProfile(db, userId) {
  const points = Number(
    db.prepare('SELECT COALESCE(SUM(points), 0) AS p FROM reputation_events WHERE user_id = ?').get(userId).p
  );
  const completedProjects = Number(
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM memberships m
         JOIN projects p ON p.id = m.project_id
         WHERE m.user_id = ? AND p.status = 'completed'`
      )
      .get(userId).c
  );
  const doneTasks = db
    .prepare(
      `SELECT t.* FROM tasks t
       JOIN projects p ON p.id = t.project_id
       WHERE t.assignee_id = ? AND t.status = 'done' AND p.status = 'completed'`
    )
    .all(userId);
  const withDue = doneTasks.filter((t) => t.due_date && t.completed_at);
  const onTime = withDue.filter((t) => String(t.completed_at).slice(0, 10) <= t.due_date).length;
  const contributions = db
    .prepare(
      `SELECT c.*, p.title AS project_title, p.id AS project_id
       FROM contributions c JOIN projects p ON p.id = c.project_id
       WHERE c.user_id = ? ORDER BY c.created_at DESC`
    )
    .all(userId);
  const createdProjects = Number(
    db.prepare('SELECT COUNT(*) AS c FROM projects WHERE creator_id = ?').get(userId).c
  );
  return {
    points,
    completedProjects,
    createdProjects,
    tasksDone: doneTasks.length,
    onTimeRate: withDue.length === 0 ? null : Math.round((onTime / withDue.length) * 100),
    contributions
  };
}

export function browseProjects(db, filters = {}) {
  const clauses = ["p.status != 'archived'"];
  const params = [];
  if (filters.q) {
    clauses.push('(LOWER(p.title) LIKE ? OR LOWER(p.summary) LIKE ? OR LOWER(p.problem) LIKE ?)');
    const like = `%${filters.q.toLowerCase()}%`;
    params.push(like, like, like);
  }
  if (filters.field) {
    clauses.push('p.field = ?');
    params.push(filters.field);
  }
  if (filters.status) {
    clauses.push('p.status = ?');
    params.push(filters.status);
  }
  if (filters.skill) {
    clauses.push('EXISTS (SELECT 1 FROM project_roles r WHERE r.project_id = p.id AND LOWER(r.skills) LIKE ?)');
    params.push(`%${filters.skill.toLowerCase()}%`);
  }
  const rows = db
    .prepare(
      `SELECT p.*, u.full_name AS creator_name, u.avatar_hue AS creator_hue,
              (SELECT COUNT(*) FROM memberships m WHERE m.project_id = p.id AND m.status = 'active') AS member_count
       FROM projects p JOIN users u ON u.id = p.creator_id
       WHERE ${clauses.join(' AND ')}
       ORDER BY CASE p.status WHEN 'recruiting' THEN 0 WHEN 'active' THEN 1 ELSE 2 END, p.created_at DESC
       LIMIT 60`
    )
    .all(...params);
  return rows.map((row) => ({ ...row, roles: rolesOf(db, row.id) }));
}

export function fields(db) {
  return db
    .prepare("SELECT field, COUNT(*) AS c FROM projects WHERE status != 'archived' GROUP BY field ORDER BY c DESC")
    .all()
    .map((row) => row.field)
    .filter(Boolean);
}

export function allSkills(db) {
  const names = new Map();
  for (const row of db.prepare('SELECT skills FROM project_roles').all()) {
    for (const skill of parseList(row.skills)) {
      const name = typeof skill === 'string' ? skill : skill?.name;
      if (name) names.set(name.toLowerCase(), name);
    }
  }
  return [...names.values()].sort((a, b) => a.localeCompare(b, 'vi'));
}

export function notify(db, userId, { type = 'info', title, body = '', link = '' }) {
  db.prepare(
    'INSERT INTO notifications (user_id, type, title, body, link, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(userId, type, title, body, link, new Date().toISOString());
}

export function titleOf(project) {
  return project?.title ?? 'dự án';
}

/** Số liệu tổng hợp — mọi con số hiển thị trên giao diện đều lấy từ đây. */
export function siteStats(db) {
  const count = (sql) => Number(db.prepare(sql).get().c);
  return {
    users: count('SELECT COUNT(*) AS c FROM users'),
    onboarded: count('SELECT COUNT(*) AS c FROM profiles WHERE onboarded_at IS NOT NULL'),
    projects: count("SELECT COUNT(*) AS c FROM projects WHERE status != 'archived'"),
    recruiting: count("SELECT COUNT(*) AS c FROM projects WHERE status = 'recruiting'"),
    active: count("SELECT COUNT(*) AS c FROM projects WHERE status = 'active'"),
    completed: count("SELECT COUNT(*) AS c FROM projects WHERE status = 'completed'"),
    openRoles: count(
      `SELECT COUNT(*) AS c FROM project_roles r JOIN projects p ON p.id = r.project_id
       WHERE r.filled < r.seats AND p.status = 'recruiting'`
    ),
    memberships: count("SELECT COUNT(*) AS c FROM memberships WHERE status = 'active'"),
    tasksDone: count("SELECT COUNT(*) AS c FROM tasks WHERE status = 'done'"),
    contributions: count('SELECT COUNT(*) AS c FROM contributions')
  };
}

/** Sự kiện uy tín gần nhất để hiển thị ví dụ thật trên trang chủ. */
export function latestReputation(db) {
  return (
    db
      .prepare(
        `SELECT e.points, e.reason, e.created_at, u.full_name, u.avatar_hue,
                p.title AS project_title, p.id AS project_id
         FROM reputation_events e
         JOIN users u ON u.id = e.user_id
         LEFT JOIN projects p ON p.id = e.project_id
         ORDER BY e.created_at DESC LIMIT 1`
      )
      .get() ?? null
  );
}

/** Người có điểm uy tín cao nhất, dùng cho khối "bằng chứng" ở trang chủ. */
export function topTrustedUser(db) {
  return (
    db
      .prepare(
        `SELECT u.*, COALESCE(SUM(e.points), 0) AS points
         FROM users u LEFT JOIN reputation_events e ON e.user_id = u.id
         GROUP BY u.id
         ORDER BY points DESC, u.id ASC
         LIMIT 1`
      )
      .get() ?? null
  );
}
