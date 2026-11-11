-- SkillVerse — PostgreSQL schema (MVP)
-- Nguyên tắc: level chỉ thay đổi khi một bằng chứng được duyệt đạt.
-- XP và uy tín là sổ cái chỉ ghi thêm; các cột tổng trong users chỉ là cache.
-- Tiêu chí có phiên bản; bằng chứng gắn với phiên bản lúc nộp.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============ ENUMS ============
CREATE TYPE user_status        AS ENUM ('active', 'restricted', 'banned');
CREATE TYPE skill_status       AS ENUM ('proposed', 'active', 'archived');
CREATE TYPE risk_level         AS ENUM ('none', 'low', 'high');
CREATE TYPE criterion_kind     AS ENUM ('checklist', 'time_limit', 'count');
CREATE TYPE proof_status       AS ENUM ('pending', 'in_review', 'passed', 'failed', 'disputed', 'removed');
CREATE TYPE assignment_state   AS ENUM ('assigned', 'done', 'expired', 'recused');
CREATE TYPE review_verdict     AS ENUM ('pass', 'fail');
CREATE TYPE appeal_status      AS ENUM ('open', 'upheld', 'overturned');
CREATE TYPE report_target      AS ENUM ('proof', 'user', 'review', 'post', 'skill');
CREATE TYPE report_reason      AS ENUM ('reused_video', 'not_self', 'edited', 'collusion', 'unsafe', 'harassment', 'other');
CREATE TYPE report_status      AS ENUM ('open', 'investigating', 'confirmed', 'dismissed');
CREATE TYPE sanction_kind      AS ENUM ('warning', 'review_ban', 'post_ban', 'suspension', 'level_revoked');
CREATE TYPE proposal_kind      AS ENUM ('new_skill', 'edit_criteria', 'add_level', 'merge_skills');
CREATE TYPE proposal_status    AS ENUM ('gathering', 'voting', 'editor_review', 'accepted', 'rejected', 'expired');
CREATE TYPE vote_value         AS ENUM ('support', 'agree', 'disagree');
CREATE TYPE xp_reason          AS ENUM ('proof_passed', 'review_done', 'proposal_accepted', 'challenge_won', 'quest_done', 'penalty', 'revoked');
CREATE TYPE post_kind          AS ENUM ('proof', 'level_up', 'text');
CREATE TYPE swap_mode          AS ENUM ('in_person', 'video');
CREATE TYPE swap_status        AS ENUM ('proposed', 'accepted', 'done', 'cancelled');

-- ============ NGƯỜI DÙNG ============
CREATE TABLE users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handle         text UNIQUE NOT NULL,
  display_name   text NOT NULL,
  email          text UNIQUE NOT NULL,
  avatar_url     text,
  home_cell      text,                       -- ô lưới ~1 km, chỉ khi người dùng bật chia sẻ vị trí
  share_location boolean NOT NULL DEFAULT false,
  total_xp       integer NOT NULL DEFAULT 0,  -- cache từ xp_ledger
  account_level  integer NOT NULL DEFAULT 1,  -- cache
  reputation     integer NOT NULL DEFAULT 50 CHECK (reputation BETWEEN 0 AND 100), -- cache từ reputation_events
  is_editor      boolean NOT NULL DEFAULT false,
  status         user_status NOT NULL DEFAULT 'active',
  created_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz
);

-- ============ KỸ NĂNG ============
CREATE TABLE categories (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug      text UNIQUE NOT NULL,
  name      text NOT NULL,
  parent_id uuid REFERENCES categories(id)
);

CREATE TABLE skills (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text UNIQUE NOT NULL,
  name         text NOT NULL,
  category_id  uuid NOT NULL REFERENCES categories(id),
  description  text,
  risk_level   risk_level NOT NULL DEFAULT 'none',
  status       skill_status NOT NULL DEFAULT 'proposed',
  max_level    integer NOT NULL DEFAULT 5,
  holder_count integer NOT NULL DEFAULT 0,   -- số người đạt cấp cao nhất, dùng tính độ hiếm
  created_by   uuid REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE skill_edges (                   -- cạnh của cây kỹ năng
  parent_skill_id uuid NOT NULL REFERENCES skills(id),
  child_skill_id  uuid NOT NULL REFERENCES skills(id),
  required_level  integer NOT NULL DEFAULT 1,
  PRIMARY KEY (parent_skill_id, child_skill_id),
  CHECK (parent_skill_id <> child_skill_id)
);

CREATE TABLE skill_levels (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id           uuid NOT NULL REFERENCES skills(id),
  level              integer NOT NULL CHECK (level >= 1),
  title              text,
  xp_reward          integer NOT NULL DEFAULT 100,
  min_reviewers      integer NOT NULL DEFAULT 3,
  min_reviewer_level integer NOT NULL DEFAULT 1,   -- người duyệt phải đạt ít nhất cấp này của kỹ năng
  current_version_id uuid,                         -- FK thêm sau khi tạo criteria_versions
  UNIQUE (skill_id, level)
);

CREATE TABLE criteria_versions (              -- bất biến sau khi tạo
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_level_id     uuid NOT NULL REFERENCES skill_levels(id),
  version            integer NOT NULL,
  source_proposal_id uuid,                         -- FK thêm sau khi tạo proposals
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (skill_level_id, version)
);
ALTER TABLE skill_levels ADD CONSTRAINT fk_current_version
  FOREIGN KEY (current_version_id) REFERENCES criteria_versions(id);

CREATE TABLE criteria (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  criteria_version_id uuid NOT NULL REFERENCES criteria_versions(id),
  position            integer NOT NULL,
  text                text NOT NULL,
  kind                criterion_kind NOT NULL DEFAULT 'checklist',
  threshold           numeric,                     -- vd. 300 (giây) cho time_limit
  UNIQUE (criteria_version_id, position)
);

CREATE TABLE user_skills (
  user_id        uuid NOT NULL REFERENCES users(id),
  skill_id       uuid NOT NULL REFERENCES skills(id),
  level          integer NOT NULL DEFAULT 0,      -- CHỈ cập nhật trong luồng chốt kết quả duyệt
  xp             integer NOT NULL DEFAULT 0,
  current_streak integer NOT NULL DEFAULT 0,
  last_proof_id  uuid,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, skill_id)
);

CREATE TABLE badges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text UNIQUE NOT NULL,
  name        text NOT NULL,
  description text
);

-- ============ XÁC THỰC ============
CREATE TABLE proofs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES users(id),
  skill_id            uuid NOT NULL REFERENCES skills(id),
  target_level        integer NOT NULL,
  criteria_version_id uuid NOT NULL REFERENCES criteria_versions(id),
  media_url           text NOT NULL,
  media_hash          text NOT NULL,             -- perceptual hash để phát hiện video dùng lại
  duration_s          integer,
  captured_at         timestamptz,
  caption             text,
  safety_ack          boolean NOT NULL DEFAULT false,
  ai_precheck         jsonb,                     -- chỉ để tham khảo, không tự quyết định
  status              proof_status NOT NULL DEFAULT 'pending',
  decided_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);
CREATE INDEX proofs_media_hash_idx ON proofs (media_hash);
CREATE INDEX proofs_status_idx ON proofs (status);
ALTER TABLE user_skills ADD CONSTRAINT fk_last_proof FOREIGN KEY (last_proof_id) REFERENCES proofs(id);

CREATE TABLE review_assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proof_id    uuid NOT NULL REFERENCES proofs(id),
  reviewer_id uuid NOT NULL REFERENCES users(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  due_at      timestamptz NOT NULL,
  state       assignment_state NOT NULL DEFAULT 'assigned',
  UNIQUE (proof_id, reviewer_id)
);

CREATE TABLE reviews (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL UNIQUE REFERENCES review_assignments(id),
  proof_id      uuid NOT NULL REFERENCES proofs(id),
  reviewer_id   uuid NOT NULL REFERENCES users(id),
  verdict       review_verdict NOT NULL,
  comment       text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proof_id, reviewer_id)
);

CREATE TABLE review_marks (
  review_id    uuid NOT NULL REFERENCES reviews(id),
  criterion_id uuid NOT NULL REFERENCES criteria(id),
  met          boolean NOT NULL,
  PRIMARY KEY (review_id, criterion_id)
);

CREATE TABLE appeals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proof_id    uuid NOT NULL UNIQUE REFERENCES proofs(id),   -- mỗi bằng chứng kháng nghị 1 lần
  user_id     uuid NOT NULL REFERENCES users(id),
  reason      text NOT NULL,
  status      appeal_status NOT NULL DEFAULT 'open',
  resolved_by uuid REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_badges (
  user_id   uuid NOT NULL REFERENCES users(id),
  badge_id  uuid NOT NULL REFERENCES badges(id),
  proof_id  uuid REFERENCES proofs(id),
  earned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, badge_id)
);

-- ============ SỔ CÁI ============
CREATE TABLE xp_ledger (                      -- chỉ INSERT, không UPDATE/DELETE
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id),
  skill_id   uuid REFERENCES skills(id),
  amount     integer NOT NULL,                  -- âm khi phạt hoặc thu hồi
  reason     xp_reason NOT NULL,
  ref_type   text,
  ref_id     uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX xp_ledger_user_idx ON xp_ledger (user_id);

CREATE TABLE reputation_events (              -- chỉ INSERT
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id),
  delta      integer NOT NULL,
  reason     text NOT NULL,                     -- vote_matched, vote_mismatched, approved_fraud, weekly_recovery
  ref_id     uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ CHỐNG GIAN LẬN ============
CREATE TABLE reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id  uuid NOT NULL REFERENCES users(id),
  target_type  report_target NOT NULL,
  target_id    uuid NOT NULL,
  reason       report_reason NOT NULL,
  details      text,
  evidence_url text,
  status       report_status NOT NULL DEFAULT 'open',
  handled_by   uuid REFERENCES users(id),
  outcome      text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sanctions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id),
  kind       sanction_kind NOT NULL,
  reason     text NOT NULL,
  report_id  uuid REFERENCES reports(id),
  proof_id   uuid REFERENCES proofs(id),        -- với level_revoked
  starts_at  timestamptz NOT NULL DEFAULT now(),
  ends_at    timestamptz,
  created_by uuid REFERENCES users(id)
);

CREATE TABLE fraud_signals (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id),
  proof_id   uuid REFERENCES proofs(id),
  signal     text NOT NULL,                     -- duplicate_hash, shared_device, mutual_approvals
  score      numeric NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE device_fingerprints (            -- chỉ lưu hash
  user_id          uuid NOT NULL REFERENCES users(id),
  fingerprint_hash text NOT NULL,
  first_seen       timestamptz NOT NULL DEFAULT now(),
  last_seen        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, fingerprint_hash)
);
CREATE INDEX device_fp_hash_idx ON device_fingerprints (fingerprint_hash);

-- ============ CỘNG ĐỒNG GÓP Ý ============
CREATE TABLE proposals (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind           proposal_kind NOT NULL,
  author_id      uuid NOT NULL REFERENCES users(id),
  skill_id       uuid REFERENCES skills(id),
  skill_level_id uuid REFERENCES skill_levels(id),
  payload        jsonb NOT NULL,                -- tên, mô tả, tiêu chí đề xuất...
  rationale      text,
  status         proposal_status NOT NULL DEFAULT 'gathering',
  support_count  integer NOT NULL DEFAULT 0,
  voting_ends_at timestamptz,
  decided_by     uuid REFERENCES users(id),
  decided_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE criteria_versions ADD CONSTRAINT fk_source_proposal
  FOREIGN KEY (source_proposal_id) REFERENCES proposals(id);

CREATE TABLE proposal_votes (
  proposal_id uuid NOT NULL REFERENCES proposals(id),
  user_id     uuid NOT NULL REFERENCES users(id),
  vote        vote_value NOT NULL,
  weight      integer NOT NULL DEFAULT 1,       -- 0 nếu người bỏ phiếu chưa đủ cấp
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (proposal_id, user_id)
);

CREATE TABLE proposal_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES proposals(id),
  user_id     uuid NOT NULL REFERENCES users(id),
  body        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============ MẠNG XÃ HỘI ============
CREATE TABLE follows (
  follower_id uuid NOT NULL REFERENCES users(id),
  followee_id uuid NOT NULL REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);

CREATE TABLE skill_follows (
  user_id    uuid NOT NULL REFERENCES users(id),
  skill_id   uuid NOT NULL REFERENCES skills(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, skill_id)
);

CREATE TABLE posts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id     uuid NOT NULL REFERENCES users(id),
  kind          post_kind NOT NULL,
  proof_id      uuid REFERENCES proofs(id),
  skill_id      uuid REFERENCES skills(id),
  body          text,
  media_url     text,
  like_count    integer NOT NULL DEFAULT 0,
  comment_count integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);
CREATE INDEX posts_author_created_idx ON posts (author_id, created_at DESC);

CREATE TABLE reactions (
  post_id    uuid NOT NULL REFERENCES posts(id),
  user_id    uuid NOT NULL REFERENCES users(id),
  kind       text NOT NULL DEFAULT 'like',     -- like, cheer
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id, kind)
);

CREATE TABLE comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid NOT NULL REFERENCES posts(id),
  user_id    uuid NOT NULL REFERENCES users(id),
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE challenges (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL,
  skill_id   uuid NOT NULL REFERENCES skills(id),
  criteria   jsonb NOT NULL,
  starts_at  timestamptz NOT NULL,
  ends_at    timestamptz NOT NULL,
  xp_reward  integer NOT NULL DEFAULT 200,
  sponsor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE challenge_entries (
  challenge_id uuid NOT NULL REFERENCES challenges(id),
  user_id      uuid NOT NULL REFERENCES users(id),
  proof_id     uuid NOT NULL REFERENCES proofs(id),
  rank         integer,
  PRIMARY KEY (challenge_id, user_id)
);

CREATE TABLE duels (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id     uuid NOT NULL REFERENCES skills(id),
  metric       text NOT NULL,                  -- vd. "thời gian thắt nút Bowline (giây)"
  user_a       uuid NOT NULL REFERENCES users(id),
  user_b       uuid NOT NULL REFERENCES users(id),
  proof_a      uuid REFERENCES proofs(id),
  proof_b      uuid REFERENCES proofs(id),
  vote_ends_at timestamptz NOT NULL,
  winner_id    uuid REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE duel_votes (
  duel_id    uuid NOT NULL REFERENCES duels(id),
  user_id    uuid NOT NULL REFERENCES users(id),
  choice     uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (duel_id, user_id)
);

CREATE TABLE skill_swaps (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposer_id    uuid NOT NULL REFERENCES users(id),
  receiver_id    uuid NOT NULL REFERENCES users(id),
  teach_skill_id uuid NOT NULL REFERENCES skills(id),
  learn_skill_id uuid NOT NULL REFERENCES skills(id),
  mode           swap_mode NOT NULL,
  status         swap_status NOT NULL DEFAULT 'proposed',
  scheduled_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE swap_ratings (
  swap_id    uuid NOT NULL REFERENCES skill_swaps(id),
  rater_id   uuid NOT NULL REFERENCES users(id),
  stars      integer NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment    text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (swap_id, rater_id)
);

CREATE TABLE message_threads (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a     uuid NOT NULL REFERENCES users(id),
  user_b     uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id  uuid NOT NULL REFERENCES message_threads(id),
  sender_id  uuid NOT NULL REFERENCES users(id),
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id),
  kind       text NOT NULL,                   -- level_up, review_assigned, report_result, swap_request...
  ref_type   text,
  ref_id     uuid,
  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_unread_idx ON notifications (user_id) WHERE read_at IS NULL;

CREATE TABLE daily_quests (
  user_id   uuid NOT NULL REFERENCES users(id),
  date      date NOT NULL,
  quest_key text NOT NULL,                     -- practice_10min, review_2, suggest_criteria
  progress  integer NOT NULL DEFAULT 0,
  done_at   timestamptz,
  PRIMARY KEY (user_id, date, quest_key)
);

-- ============ CẤU HÌNH ============
CREATE TABLE app_config (                       -- ngưỡng chỉnh được mà không cần sửa code
  key   text PRIMARY KEY,
  value jsonb NOT NULL
);
INSERT INTO app_config (key, value) VALUES
  ('rarity_thresholds',        '{"legendary": 50, "rare": 500}'),
  ('review_pass_ratio',        '0.667'),
  ('review_due_hours',         '48'),
  ('reviewer_min_reputation',  '40'),
  ('reputation_deltas',        '{"vote_matched": 1, "vote_mismatched": -3, "approved_fraud": -15, "weekly_recovery": 1}'),
  ('new_skill_support_needed', '{"supporters": 50, "days": 14}'),
  ('criteria_change_rule',     '{"agree_ratio": 0.7, "min_votes": 30, "voter_min_level": 5}'),
  ('xp_rewards',               '{"review_done": 25, "proposal_accepted": 150, "quest_min": 20, "quest_max": 50}');
