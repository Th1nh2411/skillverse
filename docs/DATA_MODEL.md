# SkillVerse — Mô hình dữ liệu và quy tắc nghiệp vụ

Chi tiết từng bảng và cột: `db/schema.sql`. Tài liệu này giải thích **vì sao** và **quy tắc** mà code phải tuân theo.

## 1. Nguyên tắc bất biến

1. **Level chỉ thay đổi khi một bằng chứng được duyệt đạt.** `user_skills.level` chỉ được cập nhật trong hàm chốt kết quả duyệt (`finalizeProof`). Không API, không trang admin nào được sửa trực tiếp.
2. **Tiêu chí có phiên bản.** Mỗi bằng chứng lưu `criteria_version_id` lúc nộp. Sửa tiêu chí = tạo `criteria_versions` mới, không sửa đè.
3. **XP và uy tín là sổ cái chỉ ghi thêm** (`xp_ledger`, `reputation_events`). `users.total_xp` và `users.reputation` chỉ là cache, luôn tính lại được từ sổ cái.
4. **Mọi hành động cộng đồng là một bản ghi** (phiếu duyệt, báo cáo, phiếu góp ý) có người làm và thời điểm.
5. **Xóa mềm** (`deleted_at`) cho nội dung người dùng tạo.

## 2. Sơ đồ nhóm bảng

```
 Người dùng ──nộp──▶  XÁC THỰC  ◀──tiêu chí── Kỹ năng
 (users,          ◀──level───  (proofs,              (skills, skill_levels,
  user_skills,                   review_assignments,   criteria_versions,
  xp_ledger,                     reviews,              criteria, skill_edges)
  reputation_events)             review_marks,               ▲
      ▲                          appeals)                    │ tiêu chí mới
      │ xử phạt                     │ bài lên cấp            │
 Chống gian lận               Mạng xã hội             Cộng đồng góp ý
 (reports, sanctions,         (posts, follows,        (proposals,
  fraud_signals,               challenges, duels,      proposal_votes,
  device_fingerprints)         skill_swaps, messages)  proposal_comments)
```

## 3. Vòng đời một bằng chứng

1. **Nộp:** kiểm tra `user_skills.level == target_level - 1` và mọi kỹ năng cha trong `skill_edges` đã đạt `required_level`. Lưu `criteria_version_id = skill_levels.current_version_id`, tính `media_hash` (perceptual hash), chạy kiểm tra AI sơ bộ vào `ai_precheck` (chỉ tham khảo).
2. **Phát hiện trùng:** nếu `media_hash` trùng hoặc gần trùng bằng chứng khác → ghi `fraud_signals` (`duplicate_hash`) và chuyển sang hàng đợi biên tập viên.
3. **Phân công:** chọn `min_reviewers` người theo quy tắc ở mục 4, hạn `review_due_hours` (48h). Quá hạn → `state = expired`, gán người khác (tác vụ nền).
4. **Chốt kết quả (một transaction duy nhất)** khi đủ phiếu: đạt nếu tỉ lệ phiếu đạt ≥ `review_pass_ratio` (2/3). Hòa hoặc thiếu người → thêm một người duyệt uy tín cao.
5. **Nếu đạt:** `user_skills.level = target_level`, ghi `xp_ledger` (`skill_levels.xp_reward`), cập nhật `skills.holder_count` khi đạt cấp cao nhất, cấp huy hiệu, tạo `posts` kind `level_up`, gửi `notifications`.
6. **Nếu trượt:** gửi nhận xét theo từng dòng tiêu chí (`review_marks`). Người dùng được kháng nghị một lần (`appeals`).
7. **Sau mọi lần chốt:** cập nhật uy tín người duyệt (mục 5).

## 4. Chống gian lận

**Ba lớp:** lúc phân công (không duyệt người quen), lúc nộp (video trùng, thiết bị lạ), sau khi đạt (báo cáo, thu hồi level).

**Điều kiện để được phân công duyệt:**
- Đạt `skill_levels.min_reviewer_level` của kỹ năng đó.
- Không có `sanctions` loại `review_ban` còn hiệu lực.
- `reputation >= reviewer_min_reputation` (40).

**Loại trừ:**
- Người theo dõi người nộp hoặc được người nộp theo dõi.
- Người từng `skill_swaps` với người nộp.
- Người có `device_fingerprints.fingerprint_hash` trùng người nộp.
- Cặp người duyệt–người nộp đã gặp nhau trong 30 ngày gần nhất.

Trong số còn lại: chọn ngẫu nhiên, ưu tiên uy tín cao cho cấp cao. Người nộp được hiển thị ẩn danh với người duyệt.

**Báo cáo được xác nhận** (`reports.status = confirmed`) về một bằng chứng đã đạt:
- Thêm `sanctions` kind `level_revoked` (gắn `proof_id`), hạ `user_skills.level`.
- Ghi dòng âm trong `xp_ledger` (reason `revoked`).
- Trừ uy tín những người đã duyệt đạt (`approved_fraud`, −15).
- Không xóa bản ghi nào.

**Tín hiệu tự động** (`fraud_signals`): trùng hash video, nhiều tài khoản trên một thiết bị, cặp người luôn duyệt đạt cho nhau.

## 5. Uy tín người duyệt

| Sự kiện | Thay đổi |
| --- | --- |
| Phiếu khớp kết quả cuối cùng | +1 |
| Phiếu lệch kết quả cuối cùng | −3 |
| Đã duyệt đạt cho bằng chứng sau đó bị xác nhận gian lận | −15 |
| Mỗi tuần không vi phạm (khi đang dưới 40) | +1 |

Uy tín dưới 40 → không được phân công duyệt. Mọi giá trị nằm trong `app_config.reputation_deltas`.

## 6. Cộng đồng góp ý

- **Kỹ năng mới** (`proposals.kind = new_skill`): 50 phiếu `support` trong 14 ngày → `editor_review` → biên tập viên duyệt → tạo `skills` (`status = active`), `skill_levels`, `criteria_versions` v1. Kỹ năng `risk_level = high` luôn cần biên tập viên.
- **Sửa tiêu chí** (`edit_criteria`): thông qua khi tỉ lệ `agree` ≥ 70% trên tổng trọng số, tối thiểu 30 phiếu, chỉ tính phiếu của người đạt cấp ≥ 5 kỹ năng đó (người khác có `weight = 0`). Khi thông qua: tạo `criteria_versions` mới với `source_proposal_id`, trỏ `skill_levels.current_version_id` sang, cộng XP cho tác giả.
- Tác giả đề xuất được thông qua nhận `xp_rewards.proposal_accepted` (150).

## 7. Độ hiếm

Tính theo `skills.holder_count` (số người đạt cấp cao nhất): dưới 50 → **Huyền thoại**, dưới 500 → **Hiếm**, còn lại không gắn nhãn. Ngưỡng trong `app_config.rarity_thresholds`.

## 8. Quyền riêng tư

- Vị trí chỉ lưu dạng ô lưới khoảng 1 km (`users.home_cell`) và chỉ khi `share_location = true`.
- `device_fingerprints` chỉ lưu hash.
- Video bằng chứng lưu ở kho object storage, truy cập qua URL ký có thời hạn.
