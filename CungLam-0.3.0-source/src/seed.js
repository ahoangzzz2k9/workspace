import { openDb, tx, nowIso } from './db.js';
import { hashPassword } from './auth.js';

const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString();
const daysAhead = (n) => new Date(Date.now() + n * 864e5).toISOString();
const dateOnly = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

export const DEMO_PASSWORD = 'demo1234';

/** Tài khoản demo: an@cunglam.vn / demo1234 */
const USERS = [
  {
    email: 'an@cunglam.vn',
    name: 'Nguyễn Minh Anh',
    headline: 'Sinh viên năm cuối CNTT · đang xây sản phẩm giáo dục',
    bio: 'Mình thích biến những việc lặt vặt của sinh viên thành sản phẩm tử tế. Đang tìm team để hoàn thiện ý tưởng lịch học thông minh.',
    location: 'Hà Nội',
    hue: 212,
    roles: ['creator', 'participant'],
    level: 'intermediate',
    skills: [['Sản phẩm', 4], ['UX Research', 3], ['React', 2], ['SQL', 2]],
    desired: ['Product Owner', 'Business Analyst'],
    interests: ['Giáo dục', 'Năng suất'],
    hours: 12,
    goal: 'Biến ý tưởng lịch học thành sản phẩm có người dùng thật trong 3 tháng.',
    experience: 'Từng làm landing page cho 2 câu lạc bộ, quản lý dự án nhóm 5 người ở trường.'
  },
  {
    email: 'huy@cunglam.vn',
    name: 'Trần Gia Huy',
    headline: 'Backend engineer · Node.js, PostgreSQL',
    bio: 'Đi làm 3 năm, rảnh buổi tối. Muốn dùng kinh nghiệm thật để giúp các bạn sinh viên làm sản phẩm tử tế.',
    location: 'TP. Hồ Chí Minh',
    hue: 158,
    roles: ['creator', 'participant'],
    level: 'advanced',
    skills: [['Node.js', 5], ['SQL', 5], ['Docker', 4], ['System Design', 4]],
    desired: ['Backend Developer', 'Tech Lead'],
    interests: ['Giáo dục', 'Công nghệ'],
    hours: 15,
    goal: 'Mentor 1–2 dự án sinh viên mỗi quý.',
    experience: 'Tech lead cho 2 sản phẩm nội bộ, từng nhận giải hackathon sinh viên.'
  },
  {
    email: 'vy@cunglam.vn',
    name: 'Lê Thảo Vy',
    headline: 'Product designer · Figma, design system',
    bio: 'Mình tin một sản phẩm tốt bắt đầu từ việc hiểu người dùng. Thích làm việc với team nhỏ, nhịp nhanh.',
    location: 'Đà Nẵng',
    hue: 328,
    roles: ['participant'],
    level: 'advanced',
    skills: [['UI/UX', 5], ['Figma', 5], ['Design System', 4], ['User Research', 3]],
    desired: ['UI/UX Designer', 'Product Designer'],
    interests: ['Giáo dục', 'Sức khoẻ'],
    hours: 10,
    goal: 'Có 3 case study thật trong portfolio năm nay.',
    experience: 'Freelance redesign cho 4 ứng dụng nhỏ, 1 dự án thiện nguyện.'
  },
  {
    email: 'long@cunglam.vn',
    name: 'Phạm Đức Long',
    headline: 'Frontend developer · React, TypeScript',
    bio: 'Thích animation và những giao diện gọn gàng. Đang tìm dự án để học cách làm việc với designer.',
    location: 'Hà Nội',
    hue: 32,
    roles: ['participant'],
    level: 'intermediate',
    skills: [['React', 4], ['TypeScript', 4], ['CSS', 5], ['Testing', 2]],
    desired: ['Frontend Developer'],
    interests: ['Giáo dục', 'Tài chính'],
    hours: 12,
    goal: 'Hoàn thành 2 dự án thật để có portfolio trước khi tốt nghiệp.',
    experience: 'Làm 3 landing page, 1 dashboard nội bộ cho câu lạc bộ.'
  },
  {
    email: 'linh@cunglam.vn',
    name: 'Hoàng Khánh Linh',
    headline: 'Content & growth · SEO, cộng đồng',
    bio: 'Mình viết và xây cộng đồng. Tin rằng sản phẩm tốt cần được kể đúng cách.',
    location: 'Hà Nội',
    hue: 268,
    roles: ['creator'],
    level: 'intermediate',
    skills: [['Content', 4], ['SEO', 3], ['Social Media', 4], ['Research', 3]],
    desired: ['Content Marketing', 'Growth'],
    interests: ['Ẩm thực', 'Lifestyle'],
    hours: 8,
    goal: 'Tìm team kỹ thuật cho ý tưởng app nấu ăn.',
    experience: 'Quản lý fanpage 20k follow cho một quán ăn, viết blog ẩm thực.'
  },
  {
    email: 'tran@cunglam.vn',
    name: 'Vũ Bảo Trân',
    headline: 'Data analyst · Python, SQL, dashboard',
    bio: 'Mình thích dữ liệu và những sản phẩm giúp việc học dễ hơn. Ưu tiên dự án có thể đo lường được.',
    location: 'TP. Hồ Chí Minh',
    hue: 190,
    roles: ['creator', 'participant'],
    level: 'intermediate',
    skills: [['Python', 4], ['SQL', 4], ['Data Visualization', 3], ['Statistics', 3]],
    desired: ['Data Analyst', 'Product Analyst'],
    interests: ['Giáo dục', 'Tài chính'],
    hours: 10,
    goal: 'Làm một sản phẩm học tập có dữ liệu chứng minh hiệu quả.',
    experience: 'Phân tích dữ liệu cho 1 dự án nghiên cứu khoa học cấp trường.'
  },
  {
    email: 'quang@cunglam.vn',
    name: 'Đỗ Quang Huy',
    headline: 'Sinh viên CNTT · Flutter, Firebase',
    bio: 'Mình mới học năm 3, muốn làm dự án thật để hiểu quy trình sản phẩm, không chỉ làm bài tập.',
    location: 'Cần Thơ',
    hue: 90,
    roles: ['creator', 'participant'],
    level: 'beginner',
    skills: [['Flutter', 3], ['Dart', 3], ['Firebase', 2], ['UI/UX', 2]],
    desired: ['Mobile Developer'],
    interests: ['Dịch vụ', 'Giáo dục'],
    hours: 20,
    goal: 'Có 1 app trên CH Play trước khi ra trường.',
    experience: '2 app nhỏ cho lớp, 1 app điểm danh cho câu lạc bộ.'
  },
  {
    email: 'mai@cunglam.vn',
    name: 'Ngọc Mai',
    headline: 'QA · manual testing, Playwright',
    bio: 'Mình thích tìm lỗi và làm sản phẩm chắc chắn hơn. Rảnh cuối tuần.',
    location: 'Hà Nội',
    hue: 8,
    roles: ['participant'],
    level: 'intermediate',
    skills: [['Manual QA', 4], ['Playwright', 3], ['Testing', 4], ['Communication', 4]],
    desired: ['QA Engineer'],
    interests: ['Tài chính', 'Giáo dục'],
    hours: 6,
    goal: 'Tích lũy kinh nghiệm kiểm thử cho sản phẩm thật.',
    experience: 'Kiểm thử cho 2 đồ án sinh viên và 1 dự án freelance.'
  }
];

const PROJECTS = [
  {
    key: 'lich-hoc',
    creator: 'an@cunglam.vn',
    title: 'Lịch học thông minh cho sinh viên',
    field: 'Giáo dục',
    summary: 'Tự động xếp thời khoá biểu tối ưu theo lịch rảnh, khoảng cách giữa các lớp và thời gian tự học.',
    problem:
      'Sinh viên thường tự xếp thời khoá biểu bằng tay, dẫn tới trùng lịch, di chuyển xa hoặc dồn quá nhiều lớp trong một ngày.',
    goal: 'Có một bản prototype cho phép nhập môn học và nhận về thời khoá biểu gợi ý trong dưới 30 giây.',
    stage: 'prototype',
    hours: 8,
    weeks: 6,
    status: 'recruiting',
    risky: 'Thuật toán xếp lịch và bộ dữ liệu thời khoá biểu mẫu của trường.',
    createdDaysAgo: 21,
    roles: [
      { title: 'Frontend Developer', skills: ['React', 'TypeScript', 'CSS'], seats: 1, description: 'Làm màn hình nhập môn và xem thời khoá biểu dạng tuần.' },
      { title: 'UI/UX Designer', skills: ['UI/UX', 'Figma'], seats: 1, description: 'Thiết kế luồng nhập liệu và màn hình kết quả.' }
    ]
  },
  {
    key: 'nau-an',
    creator: 'linh@cunglam.vn',
    title: 'Gợi ý món ăn từ nguyên liệu còn trong bếp',
    field: 'Ẩm thực',
    summary: 'Nhập nguyên liệu đang có, nhận gợi ý món ăn kèm công thức ngắn và danh sách đi chợ còn thiếu.',
    problem: 'Sinh viên ở trọ thường mua nguyên liệu rồi bỏ dở, hoặc không biết nấu gì với những gì còn lại.',
    goal: 'Ra mắt bản thử nghiệm cho 200 người dùng đầu tiên, đo tỷ lệ quay lại sau 7 ngày.',
    stage: 'y-tuong',
    hours: 6,
    weeks: 8,
    status: 'recruiting',
    risky: 'Bộ dữ liệu công thức và khẩu phần.',
    createdDaysAgo: 9,
    roles: [
      { title: 'Backend Developer', skills: ['Node.js', 'SQL'], seats: 1, description: 'API nguyên liệu, công thức và gợi ý.' },
      { title: 'Mobile Developer', skills: ['Flutter', 'Dart'], seats: 1, description: 'App Android/iOS bản MVP.' }
    ]
  },
  {
    key: 'flashcard',
    creator: 'tran@cunglam.vn',
    title: 'Flashcard ôn thi THPT có đo tiến bộ',
    field: 'Giáo dục',
    summary: 'Bộ thẻ ghi nhớ thích ứng theo mức độ nhớ, kèm báo cáo tiến bộ theo tuần cho học sinh.',
    problem: 'Học sinh ôn thi bằng cách đọc lại, khó biết phần nào đã thực sự nhớ và phần nào còn hổng.',
    goal: 'Chứng minh hiệu quả bằng một thử nghiệm nhỏ với 50 học sinh trong 4 tuần.',
    stage: 'mvp',
    hours: 10,
    weeks: 5,
    status: 'recruiting',
    risky: 'Nội dung câu hỏi và quyền sử dụng đề thi tham khảo.',
    createdDaysAgo: 16,
    roles: [
      { title: 'Data Analyst', skills: ['Python', 'SQL', 'Statistics'], seats: 1, description: 'Thiết kế chỉ số đo tiến bộ và phân tích kết quả thử nghiệm.' },
      { title: 'Frontend Developer', skills: ['React', 'CSS'], seats: 1, description: 'Màn hình học thẻ và báo cáo tiến bộ.' }
    ]
  },
  {
    key: 'sua-xe',
    creator: 'quang@cunglam.vn',
    title: 'Đặt lịch sửa xe máy tại nhà',
    field: 'Dịch vụ',
    summary: 'Kết nối sinh viên có xe máy với thợ sửa gần nhất, minh bạch giá và thời gian chờ.',
    problem: 'Sinh viên thường không biết thợ nào uy tín, giá cả trôi nổi, phải chờ đợi lâu.',
    goal: 'Khảo sát 100 sinh viên và thử mô hình đặt lịch với 5 thợ trong 1 quận.',
    stage: 'y-tuong',
    hours: 8,
    weeks: 6,
    status: 'recruiting',
    risky: 'Mạng lưới thợ và chính sách bảo hành.',
    createdDaysAgo: 4,
    roles: [
      { title: 'Mobile Developer', skills: ['Flutter', 'Firebase'], seats: 1, description: 'App đặt lịch bản thử nghiệm.' },
      { title: 'Growth / Marketing', skills: ['Content', 'Social Media'], seats: 1, description: 'Tìm 5 thợ đầu tiên và 100 người dùng thử.' }
    ]
  },
  {
    key: 'clb-website',
    creator: 'huy@cunglam.vn',
    title: 'Website CLB sinh viên CNTT',
    field: 'Giáo dục',
    summary: 'Website giới thiệu hoạt động, tuyển thành viên và lưu tài liệu học tập cho câu lạc bộ 300 thành viên.',
    problem: 'Thông tin câu lạc bộ nằm rải rác trên Facebook, tài liệu học tập thất lạc mỗi năm.',
    goal: 'Một website chạy thật, bàn giao cho ban chủ nhiệm và dùng ổn định trong học kỳ.',
    stage: 'done',
    hours: 6,
    weeks: 4,
    status: 'completed',
    risky: '',
    createdDaysAgo: 60,
    completedDaysAgo: 12,
    roles: [
      { title: 'UI/UX Designer', skills: ['UI/UX', 'Figma'], seats: 1, description: 'Thiết kế trang chủ và trang tài liệu.' },
      { title: 'Frontend Developer', skills: ['React', 'CSS'], seats: 1, description: 'Dựng giao diện và tích hợp nội dung.' }
    ]
  },
  {
    key: 'chi-tieu',
    creator: 'vy@cunglam.vn',
    title: 'Theo dõi chi tiêu nhóm cho sinh viên',
    field: 'Tài chính',
    summary: 'Chia tiền phòng trọ, tiền ăn và chi phí chung minh bạch, có nhắc nợ nhẹ nhàng.',
    problem: 'Nhóm bạn ở chung hay quên ai đã trả gì, dễ phát sinh hiểu lầm tiền bạc.',
    goal: 'Bản chạy được cho 5 nhóm dùng thử, giảm thời gian đối soát cuối tháng xuống dưới 10 phút.',
    stage: 'prototype',
    hours: 8,
    weeks: 6,
    status: 'active',
    risky: 'Tính năng ghi nợ và chia tiền.',
    createdDaysAgo: 34,
    roles: [
      { title: 'Data Analyst', skills: ['SQL', 'Python'], seats: 1, description: 'Báo cáo chi tiêu theo tháng.' },
      { title: 'Frontend Developer', skills: ['React', 'TypeScript'], seats: 1, description: 'Màn hình nhập chi tiêu và bảng công nợ.' },
      { title: 'QA Engineer', skills: ['Manual QA', 'Testing'], seats: 1, description: 'Kiểm thử luồng chia tiền và đối soát.' }
    ]
  },
  {
    key: 'ban-do',
    creator: 'quang@cunglam.vn',
    title: 'Bản đồ tiện ích trong trường đại học',
    field: 'Giáo dục',
    summary: 'Bản đồ các địa điểm trong trường: thư viện, phòng thí nghiệm, căng tin, kèm giờ mở cửa.',
    problem: 'Sinh viên năm nhất thường mất thời gian tìm phòng học, phòng dịch vụ trong trường.',
    goal: 'Có bản đồ số cho 1 trường, dùng thử trong 1 tháng.',
    stage: 'y-tuong',
    hours: 5,
    weeks: 4,
    status: 'recruiting',
    risky: '',
    createdDaysAgo: 2,
    roles: [
      { title: 'Frontend Developer', skills: ['React', 'CSS'], seats: 1, description: 'Bản đồ tương tác, tìm kiếm địa điểm.' },
      { title: 'Data Collector', skills: ['Research', 'Content'], seats: 1, description: 'Thu thập dữ liệu địa điểm và giờ mở cửa.' }
    ]
  },
  {
    key: 'khoa-hoc',
    creator: 'an@cunglam.vn',
    title: 'Trang giới thiệu khoá học tiếng Anh',
    field: 'Giáo dục',
    summary: 'Landing page giới thiệu khoá học, đăng ký tư vấn và đo hiệu quả từng nguồn traffic.',
    problem: 'Trung tâm nhỏ không có trang giới thiệu tử tế, học viên khó tin và khó đăng ký.',
    goal: 'Một landing page chạy thật, có form đăng ký và theo dõi chuyển đổi cơ bản.',
    stage: 'done',
    hours: 5,
    weeks: 3,
    status: 'completed',
    risky: '',
    createdDaysAgo: 45,
    completedDaysAgo: 30,
    roles: [
      { title: 'Frontend Developer', skills: ['React', 'CSS'], seats: 1, description: 'Dựng landing page và form đăng ký.' }
    ]
  }
];

function insertUser(db, u) {
  const info = db
    .prepare(
      `INSERT INTO users (email, password_hash, full_name, headline, bio, location, avatar_hue, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(u.email, hashPassword(DEMO_PASSWORD), u.name, u.headline, u.bio, u.location, u.hue, daysAgo(70));
  const id = Number(info.lastInsertRowid);
  for (const role of u.roles) {
    db.prepare('INSERT INTO user_roles (user_id, role) VALUES (?, ?)').run(id, role);
  }
  db.prepare(
    `INSERT INTO profiles (user_id, skills, experience_level, experience, desired_roles, interests, weekly_hours, goal, onboarded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    JSON.stringify(u.skills.map(([name, level]) => ({ name, level }))),
    u.level,
    u.experience,
    JSON.stringify(u.desired),
    JSON.stringify(u.interests),
    u.hours,
    u.goal,
    daysAgo(69)
  );
  return id;
}

function insertProject(db, p, userIds) {
  const creatorId = userIds[p.creator];
  const created = p.createdDaysAgo ? daysAgo(p.createdDaysAgo) : nowIso();
  const info = db
    .prepare(
      `INSERT INTO projects (creator_id, title, field, problem, goal, stage, commitment_hours, duration_weeks,
                             visibility, sensitive_note, status, created_at, completed_at, summary)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'public', ?, ?, ?, ?, ?)`
    )
    .run(
      creatorId,
      p.title,
      p.field,
      p.problem,
      p.goal,
      p.stage,
      p.hours,
      p.weeks,
      p.risky ?? '',
      p.status,
      created,
      p.completedDaysAgo ? daysAgo(p.completedDaysAgo) : null,
      p.summary
    );
  const projectId = Number(info.lastInsertRowid);
  db.prepare(
    "INSERT INTO memberships (project_id, role_id, user_id, role_title, status, joined_at) VALUES (?, NULL, ?, 'Người tạo dự án', 'active', ?)"
  ).run(projectId, creatorId, created);
  const roleIds = [];
  p.roles.forEach((r, index) => {
    const roleInfo = db
      .prepare(
        'INSERT INTO project_roles (project_id, title, skills, seats, description, filled, position) VALUES (?, ?, ?, ?, ?, 0, ?)'
      )
      .run(projectId, r.title, JSON.stringify(r.skills), r.seats, r.description, index);
    roleIds.push(Number(roleInfo.lastInsertRowid));
  });
  return { projectId, roleIds };
}

function addMember(db, projectId, roleId, userId, roleTitle, joinedDaysAgo, status = 'active') {
  db.prepare(
    `INSERT INTO memberships (project_id, role_id, user_id, role_title, status, joined_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(projectId, roleId, userId, roleTitle, status, daysAgo(joinedDaysAgo));
  if (roleId) db.prepare('UPDATE project_roles SET filled = filled + 1 WHERE id = ?').run(roleId);
}

function addTask(db, projectId, assigneeId, title, status, dueOffsetDays, extra = {}) {
  const created = daysAgo(extra.createdDaysAgo ?? 10);
  const updated = status === 'done' ? daysAgo(extra.doneDaysAgo ?? 3) : daysAgo(1);
  db.prepare(
    `INSERT INTO tasks (project_id, title, description, assignee_id, status, blocked_reason, due_date, priority,
                        created_at, updated_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    projectId,
    title,
    extra.description ?? '',
    assigneeId,
    status,
    extra.blocked_reason ?? '',
    dateOnly(dueOffsetDays),
    extra.priority ?? 'normal',
    created,
    updated,
    status === 'done' ? updated : null
  );
}

export function seed(db) {
  const existing = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (Number(existing) > 0) return false;

  tx(db, () => {
    const ids = {};
    for (const u of USERS) ids[u.email] = insertUser(db, u);

    const projects = {};
    for (const p of PROJECTS) {
      projects[p.key] = insertProject(db, p, ids);
    }

    // ---- Dự án 1: Lịch học thông minh (đang tuyển, có ứng viên chờ duyệt) ----
    addMember(db, projects['lich-hoc'].projectId, projects['lich-hoc'].roleIds[0], ids['long@cunglam.vn'], 'Frontend Developer', 14);
    const p1 = projects['lich-hoc'];
    addTask(db, p1.projectId, ids['an@cunglam.vn'], 'Khảo sát 30 sinh viên về cách xếp lịch', 'done', -10, { doneDaysAgo: 9 });
    addTask(db, p1.projectId, ids['long@cunglam.vn'], 'Setup repo, CI và môi trường dev', 'done', -7, { doneDaysAgo: 6 });
    addTask(db, p1.projectId, ids['an@cunglam.vn'], 'Chuẩn hoá dữ liệu môn học mẫu', 'review', 1, { description: 'Cần 1 bộ 30 môn của học kỳ 1 để test thuật toán.' });
    addTask(db, p1.projectId, ids['long@cunglam.vn'], 'Thiết kế luồng nhập thời khoá biểu', 'in_progress', 2, { priority: 'high' });
    addTask(db, p1.projectId, null, 'Wireframe màn hình xem lịch dạng tuần', 'todo', 5);

    db.prepare(
      `INSERT INTO applications (project_id, role_id, user_id, message, status, created_at)
       VALUES (?, ?, ?, ?, 'pending', ?)`
    ).run(
      p1.projectId,
      p1.roleIds[1],
      ids['vy@cunglam.vn'],
      'Mình đã xem phần mô tả và có ý tưởng cho luồng nhập môn học. Portfolio: 4 dự án app giáo dục. Có thể bắt đầu từ tuần sau.',
      daysAgo(3)
    );
    db.prepare(
      `INSERT INTO applications (project_id, role_id, user_id, message, status, created_at)
       VALUES (?, ?, ?, ?, 'pending', ?)`
    ).run(
      p1.projectId,
      p1.roleIds[1],
      ids['tran@cunglam.vn'],
      'Mình mạnh về dữ liệu hơn thiết kế, nhưng muốn thử vai trò research cho luồng nhập liệu. Có thể khảo sát người dùng giúp team.',
      daysAgo(2)
    );

    const ag1 = db
      .prepare('INSERT INTO agreements (project_id, terms, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run(
        p1.projectId,
        'Khi dự án hoàn thành, sản phẩm thuộc về các thành viên theo tỷ lệ đóng góp dưới đây. Mọi thành viên được quyền đưa sản phẩm vào portfolio cá nhân. Nếu dự án được bán hoặc chuyển giao, số tiền được chia theo tỷ lệ này sau khi trừ chi phí vận hành.',
        daysAgo(14),
        daysAgo(14)
      );
    const ag1id = Number(ag1.lastInsertRowid);
    db.prepare('INSERT INTO agreement_parts (agreement_id, user_id, percent, accepted_at) VALUES (?, ?, ?, ?)').run(
      ag1id, ids['an@cunglam.vn'], 70, daysAgo(14)
    );
    db.prepare('INSERT INTO agreement_parts (agreement_id, user_id, percent, accepted_at) VALUES (?, ?, ?, ?)').run(
      ag1id, ids['long@cunglam.vn'], 30, null
    );

    // ---- Dự án 6: Theo dõi chi tiêu nhóm (team đủ, đang chạy) ----
    const p6 = projects['chi-tieu'];
    addMember(db, p6.projectId, p6.roleIds[0], ids['tran@cunglam.vn'], 'Data Analyst', 27);
    addMember(db, p6.projectId, p6.roleIds[1], ids['long@cunglam.vn'], 'Frontend Developer', 27);
    addMember(db, p6.projectId, p6.roleIds[2], ids['mai@cunglam.vn'], 'QA Engineer', 24);
    addTask(db, p6.projectId, ids['vy@cunglam.vn'], 'Chốt luồng chia tiền và công nợ', 'done', -18, { doneDaysAgo: 16 });
    addTask(db, p6.projectId, ids['long@cunglam.vn'], 'Màn hình nhập chi tiêu', 'done', -12, { doneDaysAgo: 10 });
    addTask(db, p6.projectId, ids['tran@cunglam.vn'], 'Báo cáo chi tiêu theo tháng', 'in_progress', 3, { priority: 'high' });
    addTask(db, p6.projectId, ids['long@cunglam.vn'], 'Bảng công nợ giữa các thành viên', 'review', 2);
    addTask(db, p6.projectId, ids['mai@cunglam.vn'], 'Kiểm thử luồng chia tiền 3 người', 'in_progress', 4);
    addTask(db, p6.projectId, ids['tran@cunglam.vn'], 'Kết nối API ngân hàng sandbox', 'todo', 9, {
      blocked_reason: 'Chưa có tài khoản sandbox của đối tác, đang chờ phản hồi.',
      priority: 'low'
    });

    const ag6 = db
      .prepare('INSERT INTO agreements (project_id, terms, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run(
        p6.projectId,
        'Sản phẩm và mã nguồn thuộc về nhóm. Tỷ lệ quyền lợi được chốt tại đây và chỉ thay đổi khi tất cả thành viên đồng ý. Thành viên rời dự án trước khi hoàn thành vẫn giữ quyền với phần đã đóng góp theo thoả thuận.',
        daysAgo(27),
        daysAgo(27)
      );
    const ag6id = Number(ag6.lastInsertRowid);
    const split = [
      [ids['vy@cunglam.vn'], 40],
      [ids['tran@cunglam.vn'], 20],
      [ids['long@cunglam.vn'], 20],
      [ids['mai@cunglam.vn'], 20]
    ];
    for (const [uid, pct] of split) {
      db.prepare('INSERT INTO agreement_parts (agreement_id, user_id, percent, accepted_at) VALUES (?, ?, ?, ?)').run(
        ag6id, uid, pct, daysAgo(26)
      );
    }

    // ---- Dự án 5: Website CLB (đã hoàn thành → showcase + trust profile) ----
    const p5 = projects['clb-website'];
    addMember(db, p5.projectId, p5.roleIds[0], ids['vy@cunglam.vn'], 'UI/UX Designer', 55);
    addMember(db, p5.projectId, p5.roleIds[1], ids['long@cunglam.vn'], 'Frontend Developer', 55);
    const completedTasks = [
      [ids['huy@cunglam.vn'], 'Khảo sát yêu cầu ban chủ nhiệm'],
      [ids['vy@cunglam.vn'], 'Thiết kế trang chủ và trang tài liệu'],
      [ids['long@cunglam.vn'], 'Dựng giao diện responsive'],
      [ids['long@cunglam.vn'], 'Tích hợp nội dung và SEO cơ bản'],
      [ids['huy@cunglam.vn'], 'Deploy và bàn giao tài khoản quản trị'],
      [ids['vy@cunglam.vn'], 'Kiểm tra hiển thị trên mobile']
    ];
    completedTasks.forEach(([uid, title], i) => {
      addTask(db, p5.projectId, uid, title, 'done', -40 + i * 2, { doneDaysAgo: 45 - i * 2, createdDaysAgo: 55 });
    });

    const contribs = [
      [ids['huy@cunglam.vn'], 'Tech Lead', 2, 'Điều phối dự án, deploy và bàn giao website cho câu lạc bộ.'],
      [ids['vy@cunglam.vn'], 'UI/UX Designer', 2, 'Thiết kế toàn bộ giao diện và bộ component dùng lại được.'],
      [ids['long@cunglam.vn'], 'Frontend Developer', 2, 'Dựng giao diện responsive và tích hợp nội dung.']
    ];
    for (const [uid, roleTitle, tasksDone, summary] of contribs) {
      db.prepare(
        'INSERT INTO contributions (project_id, user_id, role_title, tasks_done, summary, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(p5.projectId, uid, roleTitle, tasksDone, summary, daysAgo(12));
    }

    const repEvents = [
      [ids['huy@cunglam.vn'], 2, 'Hoàn thành task trong dự án Website CLB sinh viên CNTT'],
      [ids['huy@cunglam.vn'], 6, 'Hoàn thành dự án Website CLB sinh viên CNTT với vai trò Tech Lead'],
      [ids['vy@cunglam.vn'], 2, 'Hoàn thành task trong dự án Website CLB sinh viên CNTT'],
      [ids['vy@cunglam.vn'], 6, 'Hoàn thành dự án Website CLB sinh viên CNTT với vai trò UI/UX Designer'],
      [ids['long@cunglam.vn'], 2, 'Hoàn thành task trong dự án Website CLB sinh viên CNTT'],
      [ids['long@cunglam.vn'], 6, 'Hoàn thành dự án Website CLB sinh viên CNTT với vai trò Frontend Developer']
    ];
    for (const [uid, points, reason] of repEvents) {
      db.prepare(
        'INSERT INTO reputation_events (user_id, project_id, points, reason, created_at) VALUES (?, ?, ?, ?, ?)'
      ).run(uid, p5.projectId, points, reason, daysAgo(12));
    }

    // ---- Dự án 8: Landing page khoá học (đã hoàn thành, tạo uy tín cho tài khoản demo) ----
    const p8 = projects['khoa-hoc'];
    addMember(db, p8.projectId, p8.roleIds[0], ids['long@cunglam.vn'], 'Frontend Developer', 44);
    const landingTasks = [
      [ids['an@cunglam.vn'], 'Phỏng vấn 5 học viên về nội dung trang'],
      [ids['an@cunglam.vn'], 'Viết nội dung và cấu trúc trang'],
      [ids['long@cunglam.vn'], 'Dựng landing page responsive'],
      [ids['long@cunglam.vn'], 'Gắn form đăng ký và theo dõi chuyển đổi']
    ];
    landingTasks.forEach(([uid, title], index) => {
      addTask(db, p8.projectId, uid, title, 'done', -31 + index * 2, {
        doneDaysAgo: 36 - index * 3,
        createdDaysAgo: 45
      });
    });
    for (const [uid, roleTitle, tasksDone, summary] of [
      [ids['an@cunglam.vn'], 'Creator', 2, 'Khảo sát học viên, viết nội dung và điều phối dự án.'],
      [ids['long@cunglam.vn'], 'Frontend Developer', 2, 'Dựng landing page responsive và gắn form đăng ký.']
    ]) {
      db.prepare(
        'INSERT INTO contributions (project_id, user_id, role_title, tasks_done, summary, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(p8.projectId, uid, roleTitle, tasksDone, summary, daysAgo(30));
    }
    for (const [uid, points, reason] of [
      [ids['an@cunglam.vn'], 2, 'Hoàn thành task trong dự án Trang giới thiệu khoá học tiếng Anh'],
      [ids['an@cunglam.vn'], 6, 'Hoàn thành dự án Trang giới thiệu khoá học tiếng Anh'],
      [ids['an@cunglam.vn'], 4, 'Điều phối và hoàn thành dự án Trang giới thiệu khoá học tiếng Anh'],
      [ids['long@cunglam.vn'], 2, 'Hoàn thành task trong dự án Trang giới thiệu khoá học tiếng Anh'],
      [ids['long@cunglam.vn'], 6, 'Hoàn thành dự án Trang giới thiệu khoá học tiếng Anh']
    ]) {
      db.prepare(
        'INSERT INTO reputation_events (user_id, project_id, points, reason, created_at) VALUES (?, ?, ?, ?, ?)'
      ).run(uid, p8.projectId, points, reason, daysAgo(30));
    }

    // ---- Lời mời ----
    db.prepare(
      `INSERT INTO invites (project_id, role_id, inviter_id, invitee_id, message, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`
    ).run(
      projects['nau-an'].projectId,
      projects['nau-an'].roleIds[1],
      ids['linh@cunglam.vn'],
      ids['quang@cunglam.vn'],
      'Mình thấy bạn có kinh nghiệm Flutter và đang làm app điểm danh. Bạn có muốn thử làm MVP app nấu ăn cùng mình không?',
      daysAgo(1)
    );

    // ---- Thông báo cho tài khoản demo ----
    const notifs = [
      ['application', 'Lê Thảo Vy đã ứng tuyển UI/UX Designer', 'Xem hồ sơ và quyết định nhận bạn ấy vào team.', '/projects/' + p1.projectId, 3],
      ['application', 'Vũ Bảo Trân đã ứng tuyển UI/UX Designer', 'Bạn ấy mạnh về dữ liệu, muốn thử vai trò research.', '/projects/' + p1.projectId, 2],
      ['agreement', 'Phạm Đức Long chưa xác nhận thoả thuận dự án', 'Thoả thuận 70/30 đang chờ Long xác nhận.', '/projects/' + p1.projectId + '/workspace', 14],
      ['task', 'Task "Chuẩn hoá dữ liệu môn học mẫu" đang chờ review', 'Long đã gửi kết quả, cần bạn duyệt.', '/projects/' + p1.projectId + '/workspace', 1]
    ];
    for (const [type, title, body, link, days] of notifs) {
      db.prepare(
        'INSERT INTO notifications (user_id, type, title, body, link, read_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(ids['an@cunglam.vn'], type, title, body, link, days > 2 ? daysAgo(1) : null, daysAgo(days));
    }
    db.prepare(
      'INSERT INTO notifications (user_id, type, title, body, link, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(
      ids['quang@cunglam.vn'],
      'invite',
      'Hoàng Khánh Linh mời bạn tham gia dự án',
      'Gợi ý món ăn từ nguyên liệu còn trong bếp — vai trò Mobile Developer.',
      '/invites',
      daysAgo(1)
    );
  });

  return true;
}

import { pathToFileURL } from 'node:url';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2] || 'data/cunglam.db';
  const db = openDb(file);
  const created = seed(db);
  console.log(created ? `Đã tạo dữ liệu mẫu trong ${file}` : `Dữ liệu đã tồn tại trong ${file}, không ghi đè.`);
}
