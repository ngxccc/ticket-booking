# OpenAPI/Swagger RFC 9457 Error Documentation & Postman Collection Update - Report

**Date**: 25-07-26  
**Status**: ✅ COMPLETED  

---

## Executive Summary

Đã hoàn thành việc chuẩn hóa và bổ sung tài liệu OpenAPI/Swagger (OpenAPI 3.1) cùng Postman Collection cho các phản hồi lỗi tuân thủ chuẩn **RFC 9457 (Problem Details for HTTP APIs)** trong toàn bộ dự án NestJS.

---

## Key Artifacts Created & Modified

1. **DTO**: `src/common/dto/rfc9457-error-response.dto.ts`
   - Khai báo DTO `Rfc9457ErrorResponseDto` và `InvalidParamDto` với đầy đủ `@ApiProperty()` bằng Tiếng Anh chuẩn.
2. **Swagger Decorators**: `src/common/decorators/api-rfc9457-response.decorator.ts`
   - Cung cấp các custom decorator `@ApiBadRequestResponseRfc9457()`, `@ApiUnauthorizedResponseRfc9457()`, `@ApiConflictResponseRfc9457()`, `@ApiInternalServerErrorResponseRfc9457()`.
   - Export qua barrel file `src/common/decorators/index.ts`.
3. **Controller Annotations**: `src/modules/auth/auth.controller.ts`
   - Annotate 100% routes trong AuthController với các RFC 9457 error decorators.
4. **Postman Collection**: `postman_collection.json`
   - Cập nhật các mẫu response body lỗi (400, 401, 409) về chuẩn Header `application/problem+json` và body RFC 9457 hoàn toàn bằng Tiếng Anh.

---

## Quality Gate Verification Evidence

- **Unit Tests**: `bun test src/` $\rightarrow$ 114 pass, 0 fail.
- **Type Check**: `bun run check-types` $\rightarrow$ 0 errors.
- **Linter Check**: `bun run lint` $\rightarrow$ 0 errors.
- **Plan Validation**: `validate-plan-artifact.mjs` $\rightarrow$ 0 failures, 0 warnings.
