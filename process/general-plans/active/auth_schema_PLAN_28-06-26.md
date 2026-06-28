# Implementation Plan: Auth Schema Integration

**Date:** 2026-06-28
**Selected Design Spec:** `process/general-plans/references/2026-06-28-auth-schema-design.md`

## Phase 1: Package installation

- [x] Chạy lệnh cài đặt thư viện uuid và kiểu dữ liệu:

  ```bash
  bun add uuid@^10.0.0 && bun add -d @types/uuid@^10.0.0
  ```

## Phase 2: Schema Creation (Modular files)

- [x] Tạo thư mục `src/database/schemas/`.
- [x] Tạo tệp `src/database/schemas/helpers.schema.ts` (baseEntity + uuidv7 from uuid library).
- [x] Tạo tệp `src/database/schemas/auth.schema.ts` (users table + oauth + passwordHash + refreshTokenHash).
- [x] Tạo tệp `src/database/schemas/relations.ts` (để trống logic).
- [x] Tạo tệp `src/database/schemas/index.ts` (barrel exports).

## Phase 3: Integration & Config Updates

- [x] Cập nhật `drizzle.config.ts`: Sửa đường dẫn `schema` thành `"./src/database/schemas/index.ts"`.
- [x] Cập nhật `src/database/database.module.ts`: Sửa dòng import `import * as schema from "./schema";` thành `import * as schema from "./schemas";`.
- [x] Xóa bỏ tệp `src/database/schema.ts` cũ (bằng công cụ hoặc bash lệnh Git).

## Phase 4: Migration & Validation

- [x] Chạy lệnh build để kiểm tra kiểu dữ liệu TypeScript:

  ```bash
  bun run check-types
  ```

- [x] Chạy lệnh Drizzle Kit để generate file sql migration:

  ```bash
  bun run db:generate (hoặc lệnh kit tương đương của dự án)
  ```
