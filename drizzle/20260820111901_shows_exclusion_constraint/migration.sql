-- 1. Kích hoạt btree_gist để hỗ trợ so sánh '=' trên UUID trong GiST index
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint

-- 2. Tạo hàm IMMUTABLE tính toán dải thời gian chiếm dụng (bao gồm 15m buffer)
CREATE OR REPLACE FUNCTION show_occupied_range(start_t timestamptz, end_t timestamptz)
RETURNS tstzrange AS $$
  SELECT tstzrange(start_t, end_t + interval '15 minutes', '[)');
$$ LANGUAGE sql IMMUTABLE;--> statement-breakpoint

-- 3. Xóa constraint cũ nếu có
ALTER TABLE "shows" DROP CONSTRAINT IF EXISTS "no_hall_schedule_overlap";--> statement-breakpoint

-- 4. Tạo Exclusion Constraint dựa trên hàm IMMUTABLE
ALTER TABLE "shows" ADD CONSTRAINT "no_hall_schedule_overlap"
EXCLUDE USING gist (
  hall_id WITH =,
  show_occupied_range(start_time, end_time) WITH &&
);
