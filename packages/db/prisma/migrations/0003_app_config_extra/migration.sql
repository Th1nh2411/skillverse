-- Ngưỡng bổ sung cần cho MVP (mọi ngưỡng đọc từ app_config, không hard-code).
INSERT INTO app_config (key, value) VALUES
  ('account_level_curve',      '{"step": 100}'),                       -- XP để từ cấp L lên L+1 = step * L
  ('reviewer_exclusion_days',  '30'),                                  -- không gặp lại cặp duyệt–nộp trong N ngày
  ('media_limits',             '{"max_mb": 60, "max_seconds": 180, "allowed_types": ["video/mp4", "video/webm", "video/quicktime"]}'),
  ('appeal_window_days',       '7'),
  ('criteria_vote_days',       '14'),
  ('editor_min_level_for_high_risk', '1'),
  ('daily_quests',             '[{"key": "practice_10min", "title": "Luyện kỹ năng 10 phút", "target": 1, "xp": 20}, {"key": "review_2", "title": "Duyệt 2 bằng chứng của người khác", "target": 2, "xp": 50}, {"key": "suggest_criteria", "title": "Góp ý 1 tiêu chí kỹ năng", "target": 1, "xp": 30}]')
ON CONFLICT (key) DO NOTHING;
