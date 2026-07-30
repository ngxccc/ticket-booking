---
title: <Feature> <Topic> Formal Specification Template
tags:
  - type/template
  - topic/formal-spec
docType: formal-spec-template
version: 1.0.0
date: YYYY-MM-DD
---

# Formal Specification: <Feature> <Topic>

**Status**: ⏳ Draft / ✅ Approved / 🚀 Verified  
**Feature Scope**: `process/features/<feature-name>/`  
**Target Module**: `src/modules/<module-name>`  
**Risk Classification**: Auth | Billing | DB Migration | API Contract | Secrets | Gateway

---

## 1. Mục Tiêu Hệ Thống (Objectives & Architectural Goals)

- **Mục tiêu cốt lõi (Core Objective)**: [Mô tả ngắn gọn 1-2 câu về mục tiêu nghiệp vụ và kiến trúc]
- **Kết quả mong đợi (Expected Outcome)**: [Định nghĩa cụ thể trạng thái thành công của hệ thống]
- **Ranh giới cô lập (Module Isolation Boundary)**:
  - Kiểu dữ liệu đầu ra mong đợi: `Strictly Typed Return Values`
  - Thư viện / Module được phép phụ thuộc: `[List of allowed dependencies]`
  - Hành vi bị cấm (Prohibited Side-effects): `[Không gọi network trực tiếp, không mutate state toàn cục]`

---

## 2. Dữ Liệu Đầu Vào (Input Data & Strict Types)

Dữ liệu đầu vào phải được định nghĩa bằng **Zod Schemas** hoặc **TypeScript Discriminated Unions** tuyệt đối:

```typescript
// Zod Schema Validation Contract
import { z } from "zod";

export const InputDataSchema = z.object({
  requestId: z.string().uuid(),
  amount: z.number().positive("Amount must be greater than zero"),
  senderId: z.string().min(1),
  receiverId: z.string().min(1),
}).refine(data => data.senderId !== data.receiverId, {
  message: "Sender and Receiver cannot be identical",
  path: ["receiverId"],
});

export type InputData = z.infer<typeof InputDataSchema>;
```

---

## 3. Các Ràng Buộc Bất Biến (Constraints & System Invariants)

*Những điều kiện toán học/logic MUST ALWAYS HOLD TRUE trong mọi thời điểm (Pre, During, Post execution):*

- `INV-1 (Data Consistency)`: [Ví dụ: Balance_after = Balance_before - Amount — Xem ADR chi tiết tại `second-brain/Docs/ADRs/0003-wallet-outbox-pattern.md`]
- `INV-2 (Security Boundary)`: [Ví dụ: UserRole == 'ADMIN' mới được phép thực hiện hành động — Xem ADR chi tiết tại `second-brain/Docs/ADRs/0004-rbac-policy.md`]
- `INV-3 (State Machine Transition)`: [Ví dụ: PENDING -> PROCESSING -> COMPLETED/FAILED, tuyệt đối không được nhảy cóc]
### Contract Details (Hợp Đồng Hàm):
- **Pre-conditions (Điều kiện tiên quyết)**:
  - `payload.amount > 0`
  - `payload.senderId != payload.receiverId`
- **Post-conditions (Điều kiện sau thực thi)**:
  - Trả về `transactionId` duy nhất.
  - Giao dịch cơ sở dữ liệu mang tính Atomic (Rollback 100% nếu có lỗi xảy ra).
- **Error Boundaries (Xử lý lỗi chính thức)**:
  - Timeout > 30s -> Throw `TransactionTimeoutException` (Fail-safe, giữ nguyên trạng thái cũ).

---

## 4. Trường Hợp Ngoại Lệ & Kịch Bản Tấn Công (Edge Cases & Adversarial Matrix)

### A. Ma Trận Trường Hợp Ngoại Lệ (Edge Cases Matrix)

| ID | Trường Hợp Ngoại Lệ / Edge Case | Hành Vi Xử Lý Mong Đổi (Fail-Safe) |
| :--- | :--- | :--- |
| `EDGE-1` | Truyền `amount = 0` hoặc số âm (`-500`) | Rejection ngay tại DTO Boundary với `BAD_REQUEST (400)` |
| `EDGE-2` | Số dư tài khoản không đủ (`balance < amount`) | Throw `InsufficientBalanceException`, không trừ tiền |
| `EDGE-3` | Mạng đứt kết nối giữa chừng khi đang ghi DB | Rollback 100% DB Transaction, trả về `500 Internal Error` an toàn |

### B. Kịch Bản Kiểm Định Cấp 2 (Level 2 Verifier - Property-Based & Adversarial)

```typescript
// Property-Based Test Spec (fast-check)
// Generates 1,000 random inputs including negative numbers, extreme floats, empty strings
fc.assert(
  fc.property(fc.float(), fc.string(), (amount, senderId) => {
    // Assert System Invariants hold true under all random inputs
  })
);
```

| ID | Adversarial / Race Condition Scenario | Expected Proof Outcome |
| :--- | :--- | :--- |
| `ADV-1` | Gửi 2 request rút tiền cùng 1ms với `balance = 100` | 1 request thành công, 1 request rejected (Anti-Double Spending) |
| `ADV-2` | Cố tình truyền SQL Injection / Malicious Payload | Sanitize & Block ngay tại validation pipe |
