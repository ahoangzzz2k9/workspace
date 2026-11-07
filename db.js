import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Schema được thiết kế theo đúng vòng đời sản phẩm trong bản đề xuất v0.1:
 * hồ sơ năng lực → dự án → matching → ứng tuyển/lời mời → team → task → hoàn thành
 * → ghi nhận đóng góp & uy tín.
 */
export const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  headline      TEXT NOT NULL DEFAULT '',
  bio           TEXT NOT NULL DEFAULT '',
  location      TEXT NOT NULL DEFAULT '',
  avatar_hue    INTEGER NOT NULL DEFAULT 210,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role    TEXT NOT NULL CHECK (role IN ('creator', 'participant')),
  PRIMARY KEY (user_id, role)
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id          INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  skills           TEXT NOT NULL DEFAULT '[]',
  experience_level TEXT NOT NULL DEFAULT 'beginner',
  experience       TEXT NOT NULL DEFAULT '',
  desired_roles    TEXT NOT NULL DEFAULT '[]',
  interests        TEXT NOT NULL DEFAULT '[]',
  weekly_hours     INTEGER NOT NULL DEFAULT 0,
  goal             TEXT NOT NULL DEFAULT '',
  onboarded_at     TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  creator_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  field            TEXT NOT NULL DEFAULT '',
  problem          TEXT NOT NULL DEFAULT '',
  goal             TEXT NOT NULL DEFAULT '',
  stage            TEXT NOT NULL DEFAULT 'y-tuong',
  commitment_hours INTEGER NOT NULL DEFAULT 5,
  duration_weeks   INTEGER NOT NULL DEFAULT 4,
  visibility       TEXT NOT NULL DEFAULT 'public',
  sensitive_note   TEXT NOT NULL DEFAULT '',
  status           TEXT NOT NULL DEFAULT 'recruiting'
                   CHECK (status IN ('recruiting', 'active', 'completed', 'archived')),
  created_at       TEXT NOT NULL,
  completed_at     TEXT,
  summary          TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS project_roles (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  skills      TEXT NOT NULL DEFAULT '[]',
  seats       INTEGER NOT NULL DEFAULT 1,
  description TEXT NOT NULL DEFAULT '',
  filled      INTEGER NOT NULL DEFAULT 0,
  position    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS applications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role_id    INTEGER NOT NULL REFERENCES project_roles(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message    TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'pending'
             CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
  created_at TEXT NOT NULL,
  decided_at TEXT,
  UNIQUE (project_id, role_id, user_id)
);

CREATE TABLE IF NOT EXISTS invites (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role_id    INTEGER NOT NULL REFERENCES project_roles(id) ON DELETE CASCADE,
  inviter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message    TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'pending'
             CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  created_at TEXT NOT NULL,
  decided_at TEXT,
  UNIQUE (project_id, role_id, invitee_id)
);

CREATE TABLE IF NOT EXISTS memberships (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role_id    INTEGER REFERENCES project_roles(id) ON DELETE SET NULL,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_title TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'left', 'removed')),
  joined_at  TEXT NOT NULL,
  left_at    TEXT,
  UNIQUE (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  assignee_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status        TEXT NOT NULL DEFAULT 'todo'
                CHECK (status IN ('todo', 'in_progress', 'review', 'done')),
  blocked_reason TEXT NOT NULL DEFAULT '',
  due_date      TEXT,
  priority      TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  completed_at  TEXT
);

CREATE TABLE IF NOT EXISTS agreements (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  terms      TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agreement_parts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  agreement_id INTEGER NOT NULL REFERENCES agreements(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  percent      INTEGER NOT NULL DEFAULT 0,
  accepted_at  TEXT,
  UNIQUE (agreement_id, user_id)
);

CREATE TABLE IF NOT EXISTS contributions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_title  TEXT NOT NULL DEFAULT '',
  tasks_done  INTEGER NOT NULL DEFAULT 0,
  summary     TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reputation_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  points     INTEGER NOT NULL,
  reason     TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL DEFAULT 'info',
  title      TEXT NOT NULL,
  body       TEXT NOT NULL DEFAULT '',
  link       TEXT NOT NULL DEFAULT '',
  read_at    TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_roles_project ON project_roles(project_id);
CREATE INDEX IF NOT EXISTS idx_app_project ON applications(project_id, status);
CREATE INDEX IF NOT EXISTS idx_app_user ON applications(user_id, status);
CREATE INDEX IF NOT EXISTS idx_invite_invitee ON invites(invitee_id, status);
CREATE INDEX IF NOT EXISTS idx_member_project ON memberships(project_id, status);
CREATE INDEX IF NOT EXISTS idx_member_user ON memberships(user_id, status);
CREATE INDEX IF NOT EXISTS idx_task_project ON tasks(project_id, status);
CREATE INDEX IF NOT EXISTS idx_task_assignee ON tasks(assignee_id, status);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_rep_user ON reputation_events(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
`;

export function openDb(file = 'data/cunglam.db') {
  if (file !== ':memory:') {
    fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  }
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON;');
  if (file !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
  }
  db.exec(SCHEMA);
  return db;
}

/** Chạy một hàm trong transaction; rollback nếu throw. */
export function tx(db, fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw error;
  }
}

export const nowIso = () => new Date().toISOString();
