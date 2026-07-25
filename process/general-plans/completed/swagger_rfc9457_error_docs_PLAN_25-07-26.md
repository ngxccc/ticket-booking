# OpenAPI/Swagger RFC 9457 Error Documentation & Postman Collection Update - Plan

**Date**: 25-07-26  
**Complexity**: Simple  
**Status**: ✅ COMPLETED  

---

## Overview

Triển khai tài liệu OpenAPI/Swagger (Swagger UI) và Postman Collection cho các phản hồi lỗi tuân thủ chuẩn **RFC 9457 (Problem Details for HTTP APIs)** cho dự án NestJS. Kế hoạch này giúp Swagger UI và Postman hiển thị đầy đủ schema và ví dụ minh họa về các phản hồi lỗi 400 Bad Request, 401 Unauthorized, 409 Conflict, 500 Internal Server Error.

Kế hoạch dựa trên tài liệu đặc tả:
- `process/context/all-context.md` (Kiến trúc dự án & Quy định đặt tên)
- `process/context/tests/all-tests.md` (Quy trình kiểm thử & Quality Gate)

---

## Touchpoints

- **`src/common/dto/rfc9457-error-response.dto.ts`**: (Tạo mới) DTO định nghĩa `InvalidParamDto` và `Rfc9457ErrorResponseDto` kèm `@ApiProperty()`.
- **`src/common/decorators/api-rfc9457-response.decorator.ts`**: (Tạo mới) Custom Swagger Decorators hỗ trợ `@ApiRfc9457Response()`, `@ApiBadRequestResponseRfc9457()`, `@ApiUnauthorizedResponseRfc9457()`, `@ApiConflictResponseRfc9457()`, `@ApiInternalServerErrorResponseRfc9457()`.
- **`src/common/decorators/index.ts`**: Re-export các Decorator mới qua barrel file.
- **`src/modules/auth/auth.controller.ts`**: Gắn các decorator tài liệu phản hồi lỗi RFC 9457 trên các API routes.
- **`postman_collection.json`**: Cập nhật các ví dụ phản hồi lỗi RFC 9457 cho từng endpoint.

---

## Public Contracts

- `Rfc9457ErrorResponseDto`: Schema phản hồi lỗi chuẩn RFC 9457 cho Swagger OpenAPI specification.
- `@ApiRfc9457Response(status, options)`: Decorator Swagger công khai dùng để mô tả lỗi HTTP RFC 9457.

---

## Blast Radius

- Thay đổi phạm vi hiển thị tài liệu API (Swagger UI tại `/docs` / OpenAPI JSON tại `/api-json`) và ví dụ mẫu trong Postman Collection.
- Không thay đổi bất kỳ logic xử lý HTTP request/response runtime nào của ứng dụng.

---

## Proposed Changes

### Phase 1: Create RFC 9457 DTO & Custom Decorators
- Tạo `src/common/dto/rfc9457-error-response.dto.ts` định nghĩa schema Swagger với các thuộc tính `type`, `title`, `status`, `detail`, `instance`, `invalidParams`, `timestamp`.
- Tạo `src/common/decorators/api-rfc9457-response.decorator.ts` cung cấp helper decorators tạo tài liệu RFC 9457 Swagger động.
- Re-export trong `src/common/decorators/index.ts`.

### Phase 2: Annotate Auth Controller & Update Postman Collection
- Gắn các decorator `@ApiBadRequestResponseRfc9457()`, `@ApiUnauthorizedResponseRfc9457()`, `@ApiConflictResponseRfc9457()`, `@ApiInternalServerErrorResponseRfc9457()` vào `src/modules/auth/auth.controller.ts`.
- Cập nhật `postman_collection.json` chứa ví dụ phản hồi mẫu RFC 9457 (HTTP 400, 401, 409, 500).

---

## Implementation Checklist

- [x] Tạo `src/common/dto/rfc9457-error-response.dto.ts` với `@ApiProperty()` annotations
- [x] Tạo `src/common/decorators/api-rfc9457-response.decorator.ts` và export tại `src/common/decorators/index.ts`
- [x] Gắn Swagger RFC 9457 decorators lên `src/modules/auth/auth.controller.ts`
- [x] Cập nhật `postman_collection.json` với ví dụ phản hồi lỗi RFC 9457
- [x] Chạy bộ kiểm thử Quality Gate (`bun test src/`, `bun run check-types`, `bun run lint`)

---

## Verification Plan

### Automated Verification
1. **Unit Test Suite**: `bun test src/` $\rightarrow$ Đảm bảo tất cả 114 unit tests pass 100%.
2. **Static Type Check**: `bun run check-types` $\rightarrow$ Đảm bảo 0 lỗi TypeScript.
3. **Linter Check**: `bun run lint` $\rightarrow$ Đảm bảo 0 lỗi ESLint.

---

## Verification Evidence

- `bun test src/`: 114 pass, 0 fail.
- `bun run check-types`: 0 errors.
- `bun run lint`: 0 errors.

---

## Acceptance Criteria

1. Swagger UI tại `/docs` (hoặc `/api-json`) hiển thị đầy đủ schema và ví dụ phản hồi RFC 9457 cho các HTTP error response codes (400, 401, 409, 500).
2. `postman_collection.json` có chứa ví dụ phản hồi lỗi RFC 9457 chuẩn cho các request.
3. Tất cả mã nguồn mới tuân thủ Zero Semantic Noise policy, 0 lỗi `check-types`, 0 lỗi `lint`.

---

## Phase Completion Rules

- Mỗi bước hoàn thành phải được kiểm chứng qua `check-types` và `lint`.
- Cập nhật checklist trong kế hoạch ngay sau khi hoàn thành từng giai đoạn.

---

## Resume and Execution Handoff

Khi tiếp tục thực hiện kế hoạch này, chạy lệnh:
`node .claude/skills/ag-generate-plan/scripts/validate-plan-artifact.mjs process/general-plans/active/swagger_rfc9457_error_docs_PLAN_25-07-26.md`

**Next Step:** Begin EXECUTE phase with Step 1: Create RFC 9457 DTO for Swagger.
