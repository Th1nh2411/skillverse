-- XP thưởng cho người thắng đấu 1v1 (domain đọc app_config.xp_rewards.duel_won).
UPDATE app_config
SET value = value || '{"duel_won": 200}'::jsonb
WHERE key = 'xp_rewards' AND NOT (value ? 'duel_won');
