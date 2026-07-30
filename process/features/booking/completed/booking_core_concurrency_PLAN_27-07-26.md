# Core Booking & Concurrency Control Plan

Date: 27-07-26
Complexity: Complex
Status: ✅ COMPLETED
**Formal Spec:** `process/features/booking/active/Booking_Core_Concurrency_Formal_Spec.md`
**Feature Folder:** `process/features/booking/`
**Context Router:** `process/context/all-context.md`
**Testing Guide:** `process/context/tests/all-tests.md`

---

## Overview

Kế hoạch này chi tiết hóa việc xây dựng hệ thống **Đặt Vé & Khóa Đồng Thời (Core Booking & Concurrency Control)** cho ứng dụng Đặt vé Rạp phim Độc lập. Hệ thống giải quyết triệt để bài toán Flash Sale / Tải cao khi hàng nghìn người dùng cùng thao tác chọn ghế tại một suất chiếu (`showtime`), đảm bảo **100% không xảy ra overselling hoặc double-booking** thông qua cơ chế phòng ngự 2 lớp (Redis Redlock trên RAM + PostgreSQL `SELECT ... FOR UPDATE` trong DB Transaction) và tự động giải phóng ghế sau 10 phút qua BullMQ Delayed Queue & Backup Cron Job.

---

## Status Strip

| Phase / Component                  | Status       | Target Path                                 | Verified Evidence                  |
| :--------------------------------- | :----------- | :------------------------------------------ | :--------------------------------- |
| **Phase 1: Redlock & DTO Layer**   | ✅ COMPLETED | `src/common/services/redlock.service.ts`    | Unit tests for RedlockService      |
| **Phase 2: Booking Core Service**  | ✅ COMPLETED | `src/modules/booking/booking.service.ts`    | Integration tests with FOR UPDATE  |
| **Phase 3: Queues & Worker Layer** | ✅ COMPLETED | `src/modules/booking/processors/`           | Worker cancellation E2E            |
| **Phase 4: API Gateway & Module**  | ✅ COMPLETED | `src/modules/booking/booking.controller.ts` | Header Idempotency & E2E API tests |

---

## Design Specification

Hệ thống tuân thủ 5 nguyên tắc bất biến (**System Invariants**):

1. **`INV-1`**: Giữ chỗ mặc định **10 phút** (`locked_until`). Tối đa **6 ghế / 1 lượt đặt vé**.
2. **`INV-2`**: **All-or-Nothing Rollback 100%** nếu có 1 ghế lỗi. Header yêu cầu **`Idempotency-Key` (UUIDv4)** cached 60 giây trong Redis.
3. **`INV-3`**: **Phòng ngự 2 lớp (Double Locking)** — Redis Redlock (RAM TTL 2000ms) + PostgreSQL Pessimistic Lock (`SELECT id, show_id, seat_id, status, locked_until FROM show_seats WHERE id IN (...) FOR UPDATE`).
4. **`INV-4`**: Mobile App chạy đếm ngược 10:00. Khi đếm về 00:00, App tự hủy giao dịch. Server trả lỗi `409 Conflict` nếu tranh chấp ghế thất bại.
5. **`INV-5`**: Trạng thái ghế: `available` $\rightarrow$ `reserved` $\rightarrow$ `booked`. Hủy/Quá hạn: `reserved` $\rightarrow$ `available`.

---

## Phase Completion Rules

A phase is NOT complete until:

1. **Integration Test** - Works with other system pieces end-to-end
2. **Manual Test** - User/Developer can perform the action
3. **Data Verification** - Database/state changes confirmed via queries
4. **Error Handling** - Failure cases handled gracefully (RFC 9457 Problem Details)
5. **User Confirmation** - User confirms it works as expected

---

## Acceptance Criteria

- [x] `RedlockService` lấy và nhả Distributed Lock an toàn cho mảng tài nguyên `lock:show_seat:<id>`.
- [x] API `POST /bookings/reserve` trả về `201 Created` kèm `lockedUntil` (ISO8601) khi đặt vé thành công.
- [x] Trả về `409 Conflict` lập tức khi có ghế đã bị giữ hoặc bị Redlock khóa.
- [x] Bắt buộc có Header `Idempotency-Key` để chống spam request.
- [x] BullMQ Worker tự động hủy đơn `pending_payment` và trả ghế về `available` sau 10 phút.
- [x] Backup Cron Job 5 phút quét dọn dẹp các ghế mồ côi bị trôi do đứt tiến trình.
- [x] Pass 100% unit & integration tests, 0 type errors với `bun run check-types`.

---

## Implementation Checklist

### Phase 1: Redlock & DTO Layer (`RedlockService` & Zod Validation)

- [x] **Step 1:** Create `src/common/services/redlock.service.ts` wrapping Redlock & ioredis.
- [x] **Step 2:** Create `src/common/services/redlock.service.spec.ts` unit tests.
- [x] **Step 3:** Create `src/modules/booking/dto/reserve-seats.dto.ts` with min 1, max 6 seat constraints and UUIDv7.
- [x] **Step 4:** Run `bun test src/common/services/redlock.service.spec.ts` and `bun run check-types`.

### Phase 2: Booking Core Service (`SELECT ... FOR UPDATE` & Transaction)

- [x] **Step 1:** Create `src/modules/booking/booking.service.ts` implementing `reserveSeats`.
- [x] **Step 2:** Implement Redis Idempotency Key 60s cache lookup.
- [x] **Step 3:** Execute DB Transaction with `SELECT id, show_id, seat_id, status, locked_until FROM show_seats WHERE id IN (...) FOR UPDATE`.
- [x] **Step 4:** Add BullMQ delayed job `cancel-booking` with delay 600,000ms (10 minutes).
- [x] **Step 5:** Create `src/modules/booking/booking.service.spec.ts` integration tests.

### Phase 3: Worker Layer (BullMQ Cancellation & Backup Cron Job)

- [x] **Step 1:** Create `src/modules/booking/processors/booking-cancellation.processor.ts`.
- [x] **Step 2:** Implement BullMQ `process` logic to revert expired `show_seats` to `available`.
- [x] **Step 3:** Create `src/modules/booking/booking-cron.service.ts` running `@Cron(EVERY_5_MINUTES)`.
- [x] **Step 4:** Verify automated cleanup logic with test script.

### Phase 4: API Gateway & Module Integration

- [x] **Step 1:** Create `src/modules/booking/booking.controller.ts` with `JwtAuthGuard`, `CustomThrottlerGuard`, and Header `Idempotency-Key` validation.
- [x] **Step 2:** Create `src/modules/booking/booking.module.ts` registering BullModule and providers.
- [x] **Step 3:** Register `BookingModule` in `src/app.module.ts`.
- [x] **Step 4:** Run `bun run check-types` and `bun run lint`.

---

## Touchpoints

- Create: `src/common/services/redlock.service.ts`
- Create: `src/common/services/redlock.service.spec.ts`
- Create: `src/modules/booking/booking.routes.ts`
- Create: `src/modules/booking/dto/reserve-seats.dto.ts`
- Create: `src/modules/booking/dto/reserve-seats-response.dto.ts`
- Create: `src/modules/booking/dto/confirm-booking.dto.ts`
- Create: `src/modules/booking/booking.service.ts`
- Create: `src/modules/booking/booking.service.spec.ts`
- Create: `src/modules/booking/processors/booking-cancellation.processor.ts`
- Create: `src/modules/booking/booking-cron.service.ts`
- Create: `src/modules/booking/booking.controller.ts`
- Create: `src/modules/booking/booking.module.ts`
- Create: `scripts/generate-openapi-types.ts`
- Create: `test/generated/api-schema.d.ts`
- Modify: `src/app.module.ts`
- Modify: `src/env.ts`
- Modify: `src/common/guards/throttler.guard.ts`
- Modify: `eslint.config.ts`
- Modify: `test/integration/booking.spec.ts`

---

## Public Contracts

- REST Endpoint: `POST /api/v1/bookings/reserve`
  - Headers: `Authorization: Bearer <jwt>`, `Idempotency-Key: <uuidv4>`
  - Body: `{ "showId": "string", "seatIds": ["string"], "voucherCode": "string" }`
  - Status Codes: `201 Created`, `400 Bad Request`, `409 Conflict`.

---

## Blast Radius

- **Database Tables Affected:** `show_seats`, `bookings`, `tickets`.
- **System Boundaries:** Independent isolation within `BookingModule`. Does not break existing Auth or User modules.

---

## Verification Evidence

- 100% Unit/Integration tests pass with `bun test`.
- 0 TypeScript compilation errors with `bun run check-types`.
- Manual DB state verification confirming `show_seats.status` transitions from `available` to `reserved` and back to `available` upon expiration.

---

## Execution Deviations & Discovered Fixes

Trong quá trình triển khai, kiểm thử nghịch bản (Adversarial Validation) và kiểm thử Hộp Đen (Contract Testing), các điều chỉnh & sửa lỗi sau đã được áp dụng vào codebase thực tế:

1. **`BUG-1` (CRITICAL - `BookingCancellationProcessor`)**: Loại bỏ lệnh update điều kiện thứ 2 không cần thiết trong processor để tránh ghi đè trạng thái do tranh chấp thời gian (TOCTOU status overwrite).
2. **`BUG-3` (CRITICAL - `BookingCronService`)**: Cập nhật tiến trình Cron dọn dẹp chạy trong DB Transaction, đồng thời chuyển trạng thái đơn đặt vé `pending_payment` tương ứng sang `expired`.
3. **`EDGE-D1-D` (CRITICAL - `BookingService`)**: Xử lý trường hợp biên ghế có trạng thái `reserved` nhưng `lockedUntil` là `NULL` — được đối xử như không khả dụng để chống trôi ghế và lặp giữ chỗ.
4. **Black-Box OpenAPI Schema Generation**: Thêm script `scripts/generate-openapi-types.ts` tự động sinh `test/generated/api-schema.d.ts` từ Swagger spec. Refactor `test/integration/booking.spec.ts` dùng trực tiếp type từ OpenAPI schema thay cho các interface thủ công.
5. **Config & Rate-Limiting Enablement**: Thêm cờ `ENABLE_RATE_LIMIT` vào `src/env.ts` và bổ sung điều kiện trong `CustomThrottlerGuard` (`if (env.NODE_ENV !== "production" && !env.ENABLE_RATE_LIMIT) return true;`) để kiểm thử HTTP 429 trong E2E integration test.
6. **ESLint Global Ignores**: Cập nhật `eslint.config.ts` bổ sung `"test/generated/**"` vào `globalIgnores`.

## Resume and Execution Handoff

When transitioning to **EXECUTE** mode:

1. Refer to context router `process/context/all-context.md` and testing guide `process/context/tests/all-tests.md`.
2. Follow RIPER-5 execution workflow: execute Phase 1 -> verify -> Phase 2 -> verify -> Phase 3 -> verify -> Phase 4 -> verify.
3. Run `bun run check-types` and `bun test` after each phase before yielding.
