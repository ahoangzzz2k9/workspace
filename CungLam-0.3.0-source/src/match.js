import { parseList } from './views.js';
import { rolesOf, isMember } from './data.js';

const LEVEL_FIT = { beginner: 0.45, intermediate: 0.75, advanced: 1 };

const ALIASES = new Map([
  ['reactjs', 'react'],
  ['react.js', 'react'],
  ['node', 'node.js'],
  ['nodejs', 'node.js'],
  ['ts', 'typescript'],
  ['js', 'javascript'],
  ['postgres', 'postgresql'],
  ['ux', 'ui/ux'],
  ['ui', 'ui/ux'],
  ['qa', 'manual qa'],
  ['testing', 'manual qa']
]);

function normalise(name) {
  const value = String(name ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  return ALIASES.get(value) ?? value;
}

function skillLevel(profileSkills, required) {
  const target = normalise(required);
  for (const skill of profileSkills) {
    const name = typeof skill === 'string' ? skill : skill?.name;
    if (normalise(name) === target) {
      const level = typeof skill === 'string' ? 3 : Number(skill?.level) || 3;
      return { found: true, level };
    }
  }
  return { found: false, level: 0 };
}

/**
 * Điểm phù hợp 0–100. Công khai để người dùng hiểu vì sao được gợi ý:
 * 58% kỹ năng · 22% thời gian · 12% lĩnh vực quan tâm · 8% trình độ.
 */
export function scoreMatch({ profile, role, project, interests = [] }) {
  const required = (role.skills ?? []).map((s) => (typeof s === 'string' ? s : s.name)).filter(Boolean);
  const matched = [];
  const missing = [];
  let skillScore = 0;
  for (const skill of required) {
    const result = skillLevel(profile.skills ?? [], skill);
    if (result.found) {
      matched.push({ name: skill, level: result.level });
      skillScore += result.level / 5;
    } else {
      missing.push(skill);
    }
  }
  skillScore = required.length === 0 ? 0.5 : skillScore / required.length;

  const hours = Number(profile.weekly_hours) || 0;
  const needed = Number(project.commitment_hours) || 5;
  const availability = hours <= 0 ? 0.3 : Math.min(1, hours / needed);

  const interestNames = interests.map((i) => String(i).toLowerCase());
  const interestFit = interestNames.includes(String(project.field ?? '').toLowerCase()) ? 1 : 0;
  const levelFit = LEVEL_FIT[profile.experience_level] ?? 0.5;

  const score = Math.round(100 * (0.58 * skillScore + 0.22 * availability + 0.12 * interestFit + 0.08 * levelFit));

  const reasons = [];
  if (required.length > 0) {
    reasons.push(`Khớp ${matched.length}/${required.length} kỹ năng yêu cầu`);
  }
  if (availability >= 0.8) reasons.push(`Có ${hours} giờ/tuần, đủ nhịp dự án ${needed} giờ/tuần`);
  if (interestFit > 0) reasons.push(`Quan tâm lĩnh vực ${project.field}`);
  if (levelFit >= 1) reasons.push('Trình độ thành thạo');

  return { score, matched, missing, reasons, breakdown: { skillScore, availability, interestFit, levelFit } };
}

export function candidatePool(db, project) {
  const rows = db
    .prepare(
      `SELECT u.*, p.skills, p.experience_level, p.interests, p.weekly_hours, p.desired_roles, p.onboarded_at
       FROM users u
       JOIN profiles p ON p.user_id = u.id
       JOIN user_roles r ON r.user_id = u.id AND r.role = 'participant'
       WHERE p.onboarded_at IS NOT NULL AND u.id != ?`
    )
    .all(project.creator_id);

  return rows.map((row) => ({
    ...row,
    skills: parseList(row.skills),
    interests: parseList(row.interests),
    desired_roles: parseList(row.desired_roles)
  }));
}

/** Gợi ý ứng viên cho một vai trò, kèm trạng thái quan hệ hiện có. */
export function suggestForRole(db, project, roleId, limit = 5) {
  const role = rolesOf(db, project.id).find((item) => Number(item.id) === Number(roleId));
  if (!role) return [];
  const pool = candidatePool(db, project);

  const suggestions = pool
    .filter((candidate) => !isMember(db, project.id, candidate.id))
    .map((candidate) => {
      const result = scoreMatch({ profile: candidate, role, project, interests: candidate.interests });
      const application = db
        .prepare('SELECT status FROM applications WHERE project_id = ? AND role_id = ? AND user_id = ?')
        .get(project.id, role.id, candidate.id);
      const invite = db
        .prepare('SELECT status FROM invites WHERE project_id = ? AND role_id = ? AND invitee_id = ?')
        .get(project.id, role.id, candidate.id);
      return {
        ...result,
        user: candidate,
        profile: candidate,
        applicationStatus: application?.status ?? null,
        inviteStatus: invite?.status ?? null
      };
    })
    .filter((entry) => entry.applicationStatus === null && entry.inviteStatus === null)
    .sort((a, b) => b.score - a.score);

  return suggestions.slice(0, limit);
}

export function suggestionsByRole(db, project, limitPerRole = 3) {
  return rolesOf(db, project.id)
    .filter((role) => role.filled < role.seats)
    .map((role) => ({ role, candidates: suggestForRole(db, project, role.id, limitPerRole) }));
}
