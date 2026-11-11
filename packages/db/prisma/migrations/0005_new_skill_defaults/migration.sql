-- Giá trị mặc định khi biên tập viên duyệt một kỹ năng mới (khớp seed):
-- xp_reward = xp_per_level * level; min_reviewer_level = max(1, level - reviewer_level_offset).
-- editor_fallback_reviewers: khi không đủ người duyệt hợp lệ (vd. kỹ năng mới chưa ai đạt cấp),
-- bổ sung biên tập viên (vẫn áp dụng mọi điều kiện loại trừ, trừ yêu cầu cấp kỹ năng).
INSERT INTO app_config (key, value) VALUES
  ('new_skill_defaults', '{"xp_per_level": 100, "min_reviewers": 3, "reviewer_level_offset": 1}'),
  ('editor_fallback_reviewers', 'true')
ON CONFLICT (key) DO NOTHING;
