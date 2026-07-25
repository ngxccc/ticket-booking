# Global Exception Filter Standardization (RFC 9457) - Plan

**Date**: 25-07-26  
**Complexity**: Simple  
**Status**: ✅ COMPLETED  

---

## Overview

Triển khai `GlobalExceptionFilter` toàn cục cho ứng dụng NestJS tuân thủ chuẩn **RFC 9457 (Problem Details for HTTP APIs)** và cấu hình `ValidationPipe.exceptionFactory` để làm phẳng các lỗi DTO. Kế hoạch này tham chiếu trực tiếp đến `process/context/all-context.md` cho kiến trúc dự án và `process/context/tests/all-tests.md` cho quy trình kiểm thử.

Kế hoạch dựa trên tài liệu đặc tả:
- `second-brain/Docs/NestJS/Global_Exception_Filter_Workflow.md`
- `second-brain/Docs/NestJS/RFC_9457_Problem_Details_Deep_Dive.md`
- `second-brain/Docs/Workflow_Documentation_Standard.md`

---

## Design Specification

### 1. Architectural Goal & Context
Hiện tại, dự án NestJS có sự không đồng nhất về cấu trúc Response lỗi giữa hai tầng:
- **Tầng DTO Validation (`ValidationPipe`)**: Trả về mảng `constraints` lồng nhau dưới key `message`.
- **Tầng Service / Domain Exception (`HttpException`)**: Trả về chuỗi `message` phẳng.

Để giải quyết triệt để sự bất nhất này, hệ thống sẽ chuẩn hóa **100% Error Responses theo tiêu chuẩn RFC 9457 (Problem Details for HTTP APIs)** thông qua sự phối hợp giữa `ValidationPipe.exceptionFactory` và `GlobalExceptionFilter`.

### 2. Selected Approach & RFC 9457 Field Mapping
Hệ thống phản hồi chuẩn `application/problem+json` gồm:

| Trường RFC 9457 | Kiểu Dữ Liệu | Nguồn Trích Xuất Trong NestJS | Ví Dụ Response |
| :--- | :--- | :--- | :--- |
| **`type`** | `URI` | `${hostUrl}/errors/${title.toLowerCase()}` | `https://api.ticketbooking.com/errors/bad-request` |
| **`title`** | `String` | `HttpException.name` (loại bỏ từ `Exception`) | `"Bad Request"`, `"Unauthorized"` |
| **`status`** | `Number` | `HttpException.getStatus()` | `400`, `401`, `500` |
| **`detail`** | `String` | `exception.getResponse().detail` hoặc `message` | `"Mật khẩu hiện tại không chính xác"` |
| **`instance`** | `URI` | `request.url` | `/api/auth/change-password` |
| **`invalidParams`** | `Array<{name, reason}>` | `ValidationError.constraints` làm phẳng | `[{ name: "confirmPassword", reason: "Mật khẩu xác nhận không trùng khớp" }]` |
| **`timestamp`** | `String (ISO)` | `new Date().toISOString()` | `2026-07-25T01:10:00.000Z` |

---
**In-Scope:**
- Tạo `GlobalExceptionFilter` tại `src/common/filters/global-exception.filter.ts`.
- Cấu hình `ValidationPipe.exceptionFactory` tại `src/main.ts`.
- Đăng ký `GlobalExceptionFilter` toàn cục tại `src/main.ts`.
- Bổ sung Unit Tests tại `src/common/filters/global-exception.filter.spec.ts`.
- Bổ sung E2E Integration Tests tại `test/global-exception.e2e-spec.ts` (kiểm tra real HTTP pipeline, Header `Content-Type: application/problem+json`, DTO validation parity & auth exception parity).
- Thay đổi cấu trúc response thành công (`apiSuccess`).
- Thay đổi giao thức WebSocket / microservices error handler.

---

## Functional Requirements

1. Tất cả HTTP Exception (400, 401, 403, 404, 429) trả về Header `Content-Type: application/problem+json`.
2. Lỗi DTO Validation trả về `invalidParams` dạng mảng các object `{ name, reason }`.
3. Lỗi Unhandled System Error (500) được ẩn Stack Trace và query SQL trên Production, trả về câu thông báo chung.

---

## Non-Functional Requirements

- **Type Safety**: Giữ 100% typecheck passing (`bun run check-types`).
- **Security**: Không rò rỉ thông tin nhạy cảm trên môi trường Production.
- **Code Quality**: Đạt 0 lỗi linting (`bun run lint`).

---

## Phase Completion Rules

- Mỗi phase hoàn thành phải thông qua kiểm thử unit test tương ứng.
- Không được làm vỡ các unit tests và E2E tests hiện có trong dự án.

---

## Acceptance Criteria

1. ✅ Header `Content-Type` của response lỗi luôn là `application/problem+json`.
2. ✅ Body response lỗi chứa đủ 7 trường RFC 9457: `type`, `title`, `status`, `detail`, `instance`, `invalidParams`, `timestamp`.
3. ✅ DTO Validation error trả về `invalidParams` phẳng dạng `[{ name, reason }]`.
4. ✅ Unit test suite `bun test src/common/filters/global-exception.filter.spec.ts` pass 100%.
5. ✅ `bun run check-types` đạt 0 error.
6. ✅ `bun run lint` đạt 0 error.

---

## Implementation Checklist

1. **Phase 1: Implement `GlobalExceptionFilter` Class**
   - Tạo file `src/common/filters/global-exception.filter.ts`.
   - Bắt ngoại lệ `@Catch()` và phân loại `HttpException` vs `Error`.
   - Format response payload RFC 9457 và set header `application/problem+json`.

2. **Phase 2: Configure `ValidationPipe.exceptionFactory`**
   - Cập nhật `src/main.ts` với `exceptionFactory` làm phẳng `ValidationError[]` thành `invalidParams`.

3. **Phase 3: Register Filter Globally**
   - Đăng ký `app.useGlobalFilters(new GlobalExceptionFilter())` trong `src/main.ts`.

4. **Phase 4: Write Unit Tests & Verify**
   - Tạo `src/common/filters/global-exception.filter.spec.ts`.
   - Kiểm thử 400 DTO Error, 401 Unauthorized, và 500 Internal Error.
   - Chạy `bun test src/`, `bun run check-types`, `bun run lint`.

---

## Touchpoints

| File Path | Operation | Description |
| :--- | :--- | :--- |
| `src/common/filters/global-exception.filter.ts` | **Create** | Triển khai `GlobalExceptionFilter` tuân thủ RFC 9457 |
| `src/common/filters/global-exception.filter.spec.ts` | **Create** | Viết Unit Test cho `GlobalExceptionFilter` |
| `test/global-exception.e2e-spec.ts` | **Create** | Viết E2E Integration Test kiểm chứng real HTTP pipeline & RFC 9457 headers |
| `test/helpers/app.helper.ts` | **Modify** | Cập nhật `createTestApp()` đăng ký `GlobalExceptionFilter` & `ValidationPipe` đồng bộ với `main.ts` |
| `src/main.ts` | **Modify** | Đăng ký `ValidationPipe` `exceptionFactory` & `GlobalExceptionFilter` toàn cục |

## Public Contracts

```json
{
  "type": "string (URI)",
  "title": "string",
  "status": "number",
  "detail": "string",
  "instance": "string",
  "invalidParams": [
    {
      "name": "string",
      "reason": "string"
    }
  ],
  "timestamp": "string (ISO-8601)"
}
```

---

## Blast Radius

- **Mọi HTTP Endpoint**: Toàn bộ lỗi từ Controller sẽ đi qua GlobalExceptionFilter mới.
- **Postman Collection & Client Integration**: Khuyến nghị cập nhật script assertion kiểm tra `detail` và `invalidParams`.

---

## Verification Evidence
```bash
# 1. Unit test filter mới
bun test src/common/filters/global-exception.filter.spec.ts

# 2. E2E test pipeline thực tế
bun test test/global-exception.e2e-spec.ts

# 3. Test suite toàn bộ dự án
bun test src/

# 4. Static Analysis
bun run check-types
bun run lint
```
---

## Resume and Execution Handoff

Khi nhận lệnh "ENTER EXECUTE MODE":
1. Thực hiện các bước trong Implementation Checklist.
2. Kiểm chứng theo Acceptance Criteria.
3. Báo cáo kết quả Verification Evidence.

**Next Step:** Begin EXECUTE phase with Step 1: Implement `GlobalExceptionFilter` Class.
