-- D75: video nhẹ hơn cho demo (R2 10 GB ≈ 1000+ clip): 60 giây, 20 MB; giữ allowed_types; thêm cấu hình máy quay 480p ~1.5 Mbps.
UPDATE app_config
SET value = value || '{"max_mb": 20, "max_seconds": 60, "recorder": {"height": 480, "video_bits_per_second": 1500000}}'::jsonb
WHERE key = 'media_limits';
