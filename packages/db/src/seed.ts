/**
 * Seed dữ liệu demo: cụm "Sinh tồn & bushcraft" + một ít kỹ năng dị.
 *
 * Ghi chú quy tắc: seed là dữ liệu khởi tạo, nên được phép đặt user_skills.level trực tiếp
 * (xem docs/DECISIONS.md). XP vẫn đi qua xp_ledger (ref_type = 'seed') và users.total_xp
 * được tính lại từ sổ cái. Code ứng dụng KHÔNG được làm như vậy — chỉ finalizeProof().
 *
 * Chạy: pnpm db:seed   (SEED_RESET=1 để xóa sạch dữ liệu rồi seed lại — chỉ dùng ở local)
 */
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { createPrismaClient, type Prisma } from "./index";

loadEnv({ path: path.resolve(import.meta.dirname, "../../../.env") });

const prisma = createPrismaClient(process.env.DIRECT_URL ?? process.env.DATABASE_URL);

type SkillSeed = {
  slug: string;
  name: string;
  category: string;
  description: string;
  risk?: "none" | "low" | "high";
  holderCount?: number;
  levels?: string[][]; // tiêu chí cho từng cấp (5 cấp)
};

const CATEGORIES = [
  { slug: "sinh-ton", name: "Sinh tồn" },
  { slug: "ky-nang-di", name: "Kỹ năng dị" },
  { slug: "thu-cong", name: "Thủ công" },
  { slug: "the-chat", name: "Thể chất" },
];

const LEVEL_TITLES = ["Mới bắt đầu", "Tập sự", "Thành thạo", "Chuyên gia", "Bậc thầy"];

const SKILLS: SkillSeed[] = [
  { slug: "sinh-ton-co-ban", name: "Sinh tồn cơ bản", category: "sinh-ton", description: "Nền tảng sinh tồn ngoài trời: an toàn, định hướng, chuẩn bị.", holderCount: 820 },
  { slug: "nhom-lua", name: "Nhóm lửa", category: "sinh-ton", description: "Nhóm và giữ lửa bằng nhiều phương pháp.", risk: "low", holderCount: 640 },
  { slug: "tim-nguon-nuoc", name: "Tìm nguồn nước", category: "sinh-ton", description: "Tìm và đánh giá nguồn nước tự nhiên.", holderCount: 530 },
  { slug: "dung-trai", name: "Dựng trại", category: "sinh-ton", description: "Dựng nơi trú ẩn tạm từ vật liệu tại chỗ.", holderCount: 700 },
  {
    slug: "lua-bang-que",
    name: "Lửa bằng que",
    category: "sinh-ton",
    description: "Tạo lửa bằng ma sát que (bow drill / hand drill).",
    risk: "high",
    holderCount: 214,
    levels: [
      ["Tạo khói bằng que trong 10 phút", "Video quay liên tục, không cắt ghép"],
      ["Tạo than hồng, chuyển vào bùi nhùi", "Video quay liên tục, không cắt ghép"],
      ["Lửa cháy thành ngọn trong 8 phút", "Video quay liên tục, không cắt ghép"],
      ["Lửa thành ngọn dưới 5 phút, video liên tục", "Có nước dập lửa trong khung hình"],
      ["Tự làm bộ dụng cụ từ cây tại chỗ", "Lửa thành ngọn dưới 5 phút", "Video quay liên tục, không cắt ghép"],
    ],
  },
  { slug: "loc-nuoc", name: "Lọc nước", category: "sinh-ton", description: "Lọc và khử khuẩn nước bằng dụng cụ tự chế.", risk: "low", holderCount: 410 },
  { slug: "bay-don-gian", name: "Bẫy đơn giản", category: "sinh-ton", description: "Dựng bẫy đơn giản, đúng quy định địa phương.", risk: "low", holderCount: 300 },
  { slug: "song-sot-72-gio", name: "Sống sót 72 giờ", category: "sinh-ton", description: "Tự lập ngoài trời 72 giờ với bộ đồ tối thiểu.", risk: "high", holderCount: 18 },
  {
    slug: "that-nut-day",
    name: "Thắt nút dây",
    category: "sinh-ton",
    description: "Các nút dây thông dụng: Bowline, Clove hitch, Figure-8...",
    holderCount: 960,
    levels: [
      ["Thắt nút Bowline trong 30 giây", "Nút chịu lực khi kéo căng"],
      ["Thắt 3 nút cơ bản (Bowline, Clove hitch, Figure-8) trong 2 phút"],
      ["Thắt Bowline bằng một tay trong 20 giây"],
      ["Thắt 8 nút khác nhau liên tục trong 5 phút"],
      ["Thắt Bowline bịt mắt dưới 10 giây"],
    ],
  },
  { slug: "so-cuu", name: "Sơ cứu", category: "sinh-ton", description: "Sơ cứu vết thương, băng bó, xử lý tình huống cơ bản.", risk: "low", holderCount: 1200 },
  { slug: "huyt-sao-bang-la", name: "Huýt sáo bằng lá", category: "ky-nang-di", description: "Tạo âm thanh, giai điệu bằng một chiếc lá.", holderCount: 41 },
  { slug: "viet-chu-nguoc-guong", name: "Viết chữ ngược gương", category: "ky-nang-di", description: "Viết chữ ngược như phản chiếu trong gương.", holderCount: 27 },
  { slug: "tung-hung", name: "Tung hứng", category: "ky-nang-di", description: "Tung hứng bóng từ 3 đến 5 quả.", holderCount: 350 },
  { slug: "giai-rubik-bit-mat", name: "Giải rubik bịt mắt", category: "ky-nang-di", description: "Ghi nhớ và giải khối rubik khi bịt mắt.", holderCount: 64 },
  { slug: "mo-khoa-the-thao", name: "Mở khóa thể thao", category: "ky-nang-di", description: "Mở khóa thể thao trên ổ khóa của chính mình.", holderCount: 38 },
  { slug: "thoi-thuy-tinh", name: "Thổi thủy tinh", category: "thu-cong", description: "Tạo hình thủy tinh nóng chảy.", risk: "high", holderCount: 12 },
  { slug: "ben-day-paracord", name: "Bện dây paracord", category: "thu-cong", description: "Bện vòng tay, dây đeo từ paracord.", holderCount: 520 },
  { slug: "dan-len", name: "Đan len", category: "thu-cong", description: "Đan khăn, mũ và họa tiết len.", holderCount: 900 },
  { slug: "leo-nui", name: "Leo núi", category: "the-chat", description: "Leo vách tự nhiên và nhân tạo an toàn.", risk: "high", holderCount: 150 },
];

const EDGES: Array<[string, string, number]> = [
  ["sinh-ton-co-ban", "nhom-lua", 1],
  ["sinh-ton-co-ban", "tim-nguon-nuoc", 1],
  ["sinh-ton-co-ban", "dung-trai", 1],
  ["nhom-lua", "lua-bang-que", 2],
  ["tim-nguon-nuoc", "loc-nuoc", 2],
  ["dung-trai", "bay-don-gian", 2],
  ["lua-bang-que", "song-sot-72-gio", 3],
  ["loc-nuoc", "song-sot-72-gio", 3],
  ["bay-don-gian", "song-sot-72-gio", 3],
];

const USERS = [
  { handle: "minhhoang", displayName: "Minh Hoàng", email: "minhhoang@demo.skillverse.local", reputation: 82, isEditor: false },
  { handle: "quocbao", displayName: "Quốc Bảo", email: "quocbao@demo.skillverse.local", reputation: 74 },
  { handle: "thuha", displayName: "Thu Hà", email: "thuha@demo.skillverse.local", reputation: 68 },
  { handle: "lanphuong", displayName: "Lan Phương", email: "lanphuong@demo.skillverse.local", reputation: 60 },
  { handle: "bientap", displayName: "Biên tập viên", email: "editor@demo.skillverse.local", reputation: 95, isEditor: true },
  { handle: "ducanh", displayName: "Đức Anh", email: "ducanh@demo.skillverse.local", reputation: 70 },
  { handle: "maianh", displayName: "Mai Anh", email: "maianh@demo.skillverse.local", reputation: 66 },
  { handle: "tuankiet", displayName: "Tuấn Kiệt", email: "tuankiet@demo.skillverse.local", reputation: 58 },
  { handle: "ngoclan", displayName: "Ngọc Lan", email: "ngoclan@demo.skillverse.local", reputation: 55 },
  { handle: "hoangnam", displayName: "Hoàng Nam", email: "hoangnam@demo.skillverse.local", reputation: 35 },
  // Người dùng mới (chưa onboarding) — dùng cho e2e
  { handle: "nguoimoi", displayName: "Người Mới", email: "nguoimoi@demo.skillverse.local", reputation: 50, fresh: true },
] as Array<{ handle: string; displayName: string; email: string; reputation: number; isEditor?: boolean; fresh?: boolean }>;

// [handle, skillSlug, level]
const USER_SKILLS: Array<[string, string, number]> = [
  ["minhhoang", "sinh-ton-co-ban", 5], ["minhhoang", "nhom-lua", 4], ["minhhoang", "lua-bang-que", 3],
  ["minhhoang", "tim-nguon-nuoc", 2], ["minhhoang", "loc-nuoc", 1], ["minhhoang", "mo-khoa-the-thao", 3],
  ["minhhoang", "tung-hung", 4], ["minhhoang", "that-nut-day", 3],
  ["quocbao", "ben-day-paracord", 4], ["quocbao", "that-nut-day", 5], ["quocbao", "sinh-ton-co-ban", 3], ["quocbao", "lua-bang-que", 5],
  ["thuha", "viet-chu-nguoc-guong", 5], ["thuha", "that-nut-day", 4], ["thuha", "huyt-sao-bang-la", 2], ["thuha", "lua-bang-que", 5],
  ["lanphuong", "tung-hung", 3], ["lanphuong", "dan-len", 4],
  ["bientap", "sinh-ton-co-ban", 5], ["bientap", "so-cuu", 5], ["bientap", "that-nut-day", 5], ["bientap", "lua-bang-que", 5],
  ["ducanh", "that-nut-day", 4], ["ducanh", "tung-hung", 5], ["ducanh", "lua-bang-que", 5], ["ducanh", "nhom-lua", 3],
  ["maianh", "that-nut-day", 3], ["maianh", "tung-hung", 4], ["maianh", "lua-bang-que", 5], ["maianh", "dan-len", 2],
  ["tuankiet", "that-nut-day", 2], ["tuankiet", "tung-hung", 5], ["tuankiet", "lua-bang-que", 4], ["tuankiet", "leo-nui", 3],
  ["ngoclan", "that-nut-day", 2], ["ngoclan", "so-cuu", 3], ["ngoclan", "tung-hung", 3],
  ["hoangnam", "that-nut-day", 3], ["hoangnam", "tung-hung", 2],
];

const BADGES = [
  { slug: "first-proof", name: "Bằng chứng đầu tiên", description: "Có bằng chứng đầu tiên được cộng đồng xác thực." },
  { slug: "max-level", name: "Đỉnh cao", description: "Đạt cấp cao nhất của một kỹ năng." },
  { slug: "rare-holder", name: "Người hiếm có", description: "Đạt cấp cao nhất của một kỹ năng Hiếm." },
  { slug: "legendary-holder", name: "Huyền thoại", description: "Đạt cấp cao nhất của một kỹ năng Huyền thoại." },
  { slug: "reviewer-10", name: "Người duyệt tận tâm", description: "Hoàn thành 10 lượt duyệt." },
  { slug: "proposal-accepted", name: "Người góp ý", description: "Có đề xuất được cộng đồng thông qua." },
];

function accountLevelForXp(totalXp: number, step: number): number {
  // XP để từ cấp L lên L+1 = step * L  (app_config.account_level_curve)
  let level = 1;
  let remaining = totalXp;
  while (remaining >= step * level) {
    remaining -= step * level;
    level += 1;
  }
  return level;
}

function criteriaFor(skill: SkillSeed, level: number): string[] {
  const custom = skill.levels?.[level - 1];
  if (custom) return custom;
  return [
    `${skill.name}: hoàn thành bài kiểm tra cấp ${level} (${LEVEL_TITLES[level - 1]})`,
    "Video quay liên tục, không cắt ghép",
    "Thấy rõ tay hoặc mặt người thực hiện",
  ];
}

async function reset() {
  // Thứ tự xóa theo khóa ngoại. Chỉ dùng ở local.
  const tables = [
    "auth_sessions", "auth_accounts", "auth_verification_tokens",
    "duel_votes", "duels", "challenge_entries", "challenges", "swap_ratings", "skill_swaps",
    "messages", "message_threads", "notifications", "daily_quests", "reactions", "comments", "posts",
    "proposal_votes", "proposal_comments", "sanctions", "reports", "fraud_signals", "device_fingerprints",
    "review_marks", "reviews", "review_assignments", "appeals", "user_badges", "xp_ledger", "reputation_events",
    "skill_follows", "follows",
  ];
  for (const t of tables) await prisma.$executeRawUnsafe(`DELETE FROM ${t}`);
  await prisma.$executeRawUnsafe(`UPDATE user_skills SET last_proof_id = NULL`);
  await prisma.$executeRawUnsafe(`DELETE FROM proofs`);
  await prisma.$executeRawUnsafe(`DELETE FROM user_skills`);
  await prisma.$executeRawUnsafe(`UPDATE skill_levels SET current_version_id = NULL`);
  await prisma.$executeRawUnsafe(`UPDATE criteria_versions SET source_proposal_id = NULL`);
  await prisma.$executeRawUnsafe(`DELETE FROM proposals`);
  await prisma.$executeRawUnsafe(`DELETE FROM criteria`);
  await prisma.$executeRawUnsafe(`DELETE FROM criteria_versions`);
  await prisma.$executeRawUnsafe(`DELETE FROM skill_levels`);
  await prisma.$executeRawUnsafe(`DELETE FROM skill_edges`);
  await prisma.$executeRawUnsafe(`DELETE FROM skills`);
  await prisma.$executeRawUnsafe(`DELETE FROM categories`);
  await prisma.$executeRawUnsafe(`DELETE FROM badges`);
  await prisma.$executeRawUnsafe(`DELETE FROM users`);
}

async function main() {
  if (process.env.SEED_RESET === "1") {
    console.log("SEED_RESET=1 → xóa dữ liệu cũ");
    await reset();
  }
  if ((await prisma.skill.count()) > 0) {
    console.log("Đã có dữ liệu, bỏ qua seed (SEED_RESET=1 để seed lại).");
    return;
  }

  const curve = await prisma.appConfig.findUniqueOrThrow({ where: { key: "account_level_curve" } });
  const step = (curve.value as { step: number }).step;

  const cats = new Map<string, string>();
  for (const c of CATEGORIES) {
    const row = await prisma.category.create({ data: c });
    cats.set(c.slug, row.id);
  }

  const skills = new Map<string, { id: string; levels: Map<number, { levelId: string; criteriaIds: string[]; versionId: string }> }>();
  for (const s of SKILLS) {
    const skill = await prisma.skill.create({
      data: {
        slug: s.slug,
        name: s.name,
        categoryId: cats.get(s.category)!,
        description: s.description,
        riskLevel: s.risk ?? "none",
        status: "active",
        maxLevel: 5,
        holderCount: s.holderCount ?? 0,
      },
    });
    const levels = new Map<number, { levelId: string; criteriaIds: string[]; versionId: string }>();
    for (let lv = 1; lv <= 5; lv++) {
      const sl = await prisma.skillLevel.create({
        data: {
          skillId: skill.id,
          level: lv,
          title: LEVEL_TITLES[lv - 1],
          xpReward: 100 * lv,
          minReviewers: 3,
          minReviewerLevel: Math.max(1, lv - 1),
        },
      });
      const version = await prisma.criteriaVersion.create({
        data: {
          skillLevelId: sl.id,
          version: 1,
          criteria: {
            create: criteriaFor(s, lv).map((text, i) => ({ position: i + 1, text, kind: "checklist" as const })),
          },
        },
        include: { criteria: true },
      });
      await prisma.skillLevel.update({ where: { id: sl.id }, data: { currentVersionId: version.id } });
      levels.set(lv, { levelId: sl.id, versionId: version.id, criteriaIds: version.criteria.map((c) => c.id) });
    }
    skills.set(s.slug, { id: skill.id, levels });
  }

  for (const [p, c, req] of EDGES) {
    await prisma.skillEdge.create({
      data: { parentSkillId: skills.get(p)!.id, childSkillId: skills.get(c)!.id, requiredLevel: req },
    });
  }

  for (const b of BADGES) await prisma.badge.create({ data: b });

  const users = new Map<string, string>();
  const now = Date.now();
  for (const [i, u] of USERS.entries()) {
    const row = await prisma.user.create({
      data: {
        handle: u.handle,
        displayName: u.displayName,
        email: u.email,
        emailVerified: new Date(),
        reputation: u.reputation,
        isEditor: u.isEditor ?? false,
        onboardedAt: u.fresh ? null : new Date(now - (30 - i) * 86400000),
        createdAt: new Date(now - (60 - i) * 86400000),
      },
    });
    users.set(u.handle, row.id);
    if (u.reputation !== 50) {
      await prisma.reputationEvent.create({
        data: { userId: row.id, delta: u.reputation - 50, reason: "seed" },
      });
    }
  }

  // user_skills + xp_ledger (ref_type = 'seed')
  const xpByUser = new Map<string, number>();
  for (const [handle, slug, level] of USER_SKILLS) {
    const userId = users.get(handle)!;
    const skillId = skills.get(slug)!.id;
    let xp = 0;
    for (let lv = 1; lv <= level; lv++) xp += 100 * lv;
    await prisma.userSkill.create({ data: { userId, skillId, level, xp } });
    await prisma.xpLedger.create({
      data: { userId, skillId, amount: xp, reason: "proof_passed", refType: "seed" },
    });
    xpByUser.set(userId, (xpByUser.get(userId) ?? 0) + xp);
  }
  // Thêm XP duyệt cho người dùng chính để cấp tài khoản giống mockup hơn
  const bonus: Array<[string, number]> = [["minhhoang", 22000], ["quocbao", 3000], ["thuha", 12000]];
  for (const [h, amount] of bonus) {
    const userId = users.get(h)!;
    await prisma.xpLedger.create({ data: { userId, amount, reason: "review_done", refType: "seed" } });
    xpByUser.set(userId, (xpByUser.get(userId) ?? 0) + amount);
  }
  for (const [userId, total] of xpByUser) {
    await prisma.user.update({
      where: { id: userId },
      data: { totalXp: total, accountLevel: accountLevelForXp(total, step) },
    });
  }

  // Quan hệ xã hội
  const follow = (a: string, b: string) =>
    prisma.follow.create({ data: { followerId: users.get(a)!, followeeId: users.get(b)! } });
  await follow("minhhoang", "quocbao");
  await follow("minhhoang", "thuha");
  await follow("quocbao", "minhhoang");
  await follow("lanphuong", "thuha");
  for (const slug of ["lua-bang-que", "that-nut-day", "tung-hung"]) {
    await prisma.skillFollow.create({ data: { userId: users.get("minhhoang")!, skillId: skills.get(slug)!.id } });
  }

  // Bằng chứng đã đạt (để có bài lên cấp trên feed) — media là placeholder.
  const passedProof = async (handle: string, slug: string, level: number, caption: string, hoursAgo: number) => {
    const s = skills.get(slug)!;
    const lv = s.levels.get(level)!;
    const proof = await prisma.proof.create({
      data: {
        userId: users.get(handle)!,
        skillId: s.id,
        targetLevel: level,
        criteriaVersionId: lv.versionId,
        mediaUrl: `seed/${slug}-${level}.mp4`,
        mediaHash: `seed-${handle}-${slug}-${level}`,
        durationS: 64,
        caption,
        safetyAck: true,
        status: "passed",
        decidedAt: new Date(now - hoursAgo * 3600000),
        createdAt: new Date(now - (hoursAgo + 20) * 3600000),
      },
    });
    await prisma.post.create({
      data: {
        authorId: users.get(handle)!,
        kind: "level_up",
        proofId: proof.id,
        skillId: s.id,
        body: `Lên cấp ${level} · ${SKILLS.find((x) => x.slug === slug)!.name}`,
        likeCount: 12 + level * 7,
        commentCount: level,
        createdAt: new Date(now - hoursAgo * 3600000),
      },
    });
    return proof;
  };
  await passedProof("quocbao", "ben-day-paracord", 4, "Bện xong vòng cobra trong 6 phút.", 0.25);
  await passedProof("thuha", "viet-chu-nguoc-guong", 5, "Chép nguyên bài thơ lục bát bằng tay trái, ngược gương.", 1);
  await prisma.post.create({
    data: {
      authorId: users.get("thuha")!,
      kind: "text",
      skillId: skills.get("viet-chu-nguoc-guong")!.id,
      body: "Chép nguyên bài thơ lục bát bằng tay trái, ngược gương. Mất 3 tháng luyện mới viết đều được như vậy.",
      likeCount: 248,
      commentCount: 36,
      createdAt: new Date(now - 3600000),
    },
  });

  // Bằng chứng đang chờ duyệt (Lan Phương, tung hứng cấp 4) — chưa phân công; domain/cron sẽ gán.
  const th = skills.get("tung-hung")!;
  await prisma.proof.create({
    data: {
      userId: users.get("lanphuong")!,
      skillId: th.id,
      targetLevel: 4,
      criteriaVersionId: th.levels.get(4)!.versionId,
      mediaUrl: "seed/tung-hung-4.mp4",
      mediaHash: "seed-lanphuong-tung-hung-4",
      durationS: 64,
      caption: "Tung hứng 5 bóng liên tục 60 giây",
      safetyAck: true,
      status: "pending",
      createdAt: new Date(now - 2 * 3600000),
    },
  });

  // Thử thách tuần
  await prisma.challenge.create({
    data: {
      title: "Nhóm lửa trong mưa",
      skillId: skills.get("nhom-lua")!.id,
      criteria: {
        description: "Giữ ngọn lửa cháy 3 phút trong điều kiện ẩm ướt. Không dùng bật lửa.",
        items: ["Lửa cháy liên tục 3 phút", "Điều kiện ẩm ướt thấy rõ trong video", "Không dùng bật lửa, diêm"],
      },
      startsAt: new Date(now - 4 * 86400000),
      endsAt: new Date(now + 3 * 86400000),
      xpReward: 600,
    },
  });

  // Đấu 1v1
  const tn = skills.get("that-nut-day")!;
  const duelProof = async (handle: string, seconds: number) =>
    prisma.proof.create({
      data: {
        userId: users.get(handle)!,
        skillId: tn.id,
        targetLevel: 5,
        criteriaVersionId: tn.levels.get(5)!.versionId,
        mediaUrl: `seed/duel-${handle}.mp4`,
        mediaHash: `seed-duel-${handle}`,
        durationS: Math.ceil(seconds),
        caption: `Bowline ${seconds.toString().replace(".", ",")}s`,
        safetyAck: true,
        status: "passed",
        decidedAt: new Date(now - 86400000),
        createdAt: new Date(now - 2 * 86400000),
      },
    });
  const pa = await duelProof("quocbao", 7.4);
  const pb = await duelProof("thuha", 8.1);
  const endOfDay = new Date();
  endOfDay.setHours(20, 0, 0, 0);
  if (endOfDay.getTime() < now) endOfDay.setDate(endOfDay.getDate() + 1);
  await prisma.duel.create({
    data: {
      skillId: tn.id,
      metric: "Thời gian thắt nút Bowline (giây)",
      userA: users.get("quocbao")!,
      userB: users.get("thuha")!,
      proofA: pa.id,
      proofB: pb.id,
      voteEndsAt: endOfDay,
    },
  });

  // Đề xuất sửa tiêu chí (Lửa bằng que cấp 4)
  const lbq = skills.get("lua-bang-que")!;
  const proposal = await prisma.proposal.create({
    data: {
      kind: "edit_criteria",
      authorId: users.get("quocbao")!,
      skillId: lbq.id,
      skillLevelId: lbq.levels.get(4)!.levelId,
      payload: {
        criteria: [
          { text: "Lửa thành ngọn dưới 5 phút, video liên tục", kind: "checklist" },
          { text: "Có nước dập lửa trong khung hình", kind: "checklist" },
          { text: "Gỗ phải tự kiếm tại chỗ, không dùng gỗ mua sẵn", kind: "checklist" },
        ],
        summary: "Cấp 4: yêu cầu gỗ phải tự kiếm tại chỗ, không dùng gỗ mua sẵn",
      } satisfies Prisma.InputJsonValue,
      rationale: "Gỗ mua sẵn đã được sấy khô, làm bài kiểm tra dễ hơn nhiều so với thực tế.",
      status: "voting",
      votingEndsAt: new Date(now + 10 * 86400000),
    },
  });
  const voters: Array<[string, "agree" | "disagree"]> = [
    ["thuha", "agree"], ["bientap", "agree"], ["ducanh", "agree"], ["maianh", "disagree"], ["lanphuong", "agree"],
  ];
  for (const [h, vote] of voters) {
    const us = USER_SKILLS.find(([uh, sl]) => uh === h && sl === "lua-bang-que");
    await prisma.proposalVote.create({
      data: { proposalId: proposal.id, userId: users.get(h)!, vote, weight: us && us[2] >= 5 ? 1 : 0 },
    });
  }

  // Đề xuất kỹ năng mới đang thu thập ủng hộ
  await prisma.proposal.create({
    data: {
      kind: "new_skill",
      authorId: users.get("thuha")!,
      payload: {
        name: "Gấp giấy origami 1 tờ",
        categorySlug: "thu-cong",
        description: "Gấp mô hình phức tạp từ một tờ giấy, không cắt, không dán.",
        riskLevel: "none",
        levels: [1, 2, 3, 4, 5].map((lv) => ({ level: lv, criteria: [`Gấp mô hình độ khó ${lv}`] })),
      } satisfies Prisma.InputJsonValue,
      rationale: "Kỹ năng phổ biến, dễ xác thực bằng video.",
      status: "gathering",
      supportCount: 1,
      votingEndsAt: new Date(now + 14 * 86400000),
    },
  });

  console.log(
    `Seed xong: ${SKILLS.length} kỹ năng, ${USERS.length} người dùng. Đăng nhập dev bằng handle, vd. "minhhoang", "bientap", "nguoimoi".`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
