-- D73: tự đánh dấu mốc (tiến độ cá nhân, KHÔNG phải level đã xác thực; user_skills.level vẫn chỉ đổi trong finalizeProof).
CREATE TABLE milestone_checks (
  user_id        uuid NOT NULL REFERENCES users(id),
  skill_level_id uuid NOT NULL REFERENCES skill_levels(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, skill_level_id)
);
CREATE INDEX idx_milestone_checks_skill_level ON milestone_checks (skill_level_id);

-- D74: lưu bài viết / kỹ năng / bằng chứng (target_id đa hình, không FK).
CREATE TABLE saves (
  user_id     uuid NOT NULL REFERENCES users(id),
  target_type text NOT NULL CHECK (target_type IN ('post', 'skill', 'proof')),
  target_id   uuid NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, target_type, target_id)
);
CREATE INDEX idx_saves_user_created ON saves (user_id, created_at DESC);
