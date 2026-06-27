---
tags: [type/guide, status/permanent]
date: 2026-06-27
aliases: [Lộ trình thiết lập và Checklist, Setup Roadmap and Checklist]
---

# 🗺️ Lộ Trình & Checklist Thiết Lập Chi Tiết (Ticket Booking Backend)

Tài liệu này là cẩm nang tích hợp đầy đủ lộ trình triển khai, danh sách kiểm tra kỹ thuật (Checklist) và bảng Kanban ngoại tuyến của dự án **Hệ thống Đặt Vé / Flash Sale (Ticket Booking)** sử dụng **NestJS, Bun, PostgreSQL (Drizzle ORM) và BullMQ**.

---

## 📋 Bảng Kanban Ngoại Tuyến (Solo Kanban)

### 📥 Backlog

- [ ] Triển khai ứng dụng (Render / Koyeb) sử dụng biến môi trường bảo mật

### 📋 To Do

- [ ] Viết mã transaction trong `BookingService` sử dụng Khóa bi quan (`SELECT ... FOR UPDATE`) để chặn race condition đặt trùng ghế.
- [ ] Cấu hình hàng đợi BullMQ để tự động hủy giữ chỗ sau 10 phút nếu chưa thanh toán.
- [ ] Xây dựng API Controller đặt vé và kiểm tra đầu vào bằng Zod.
- [ ] Viết E2E stress test mô phỏng tải cao bằng Bun Test hoặc k6.

### 🔄 In Progress

_Không có_

### ✅ Done

- [x] Thiết kế database schema (Seats, Shows, Bookings) bằng Drizzle ORM.
- [x] Cấu hình Docker multi-stage chạy bằng non-root user `bun` bảo mật.
- [x] Thiết lập quy chuẩn code format tự động bằng Husky & lint-staged.
- [x] Vá lỗ hổng bảo mật Multer (CVE-2026-5079 / CVE-2026-5038) qua resolutions.
- [x] Đồng bộ phiên bản Drizzle ORM & Kit lên `@rc4` ổn định.
- [x] Thêm script `check-types` và tích hợp vào quy trình CI (GitHub Actions).
- [x] Thiết lập quy tắc bảo vệ nhánh chính (GitHub Rulesets & Projects).

---

## 📅 Lộ Trình Triển Khai & Checklist Chi Tiết

### Phase 1: Init & Project Foundation (Môi Trường, Cơ Sở Dữ Liệu & CI/CD) - ĐÃ HOÀN THÀNH

- [x] **Khởi tạo mã nguồn NestJS & Bun**: Cấu hình ESLint/Prettier đồng bộ, bật chế độ `strict: true` trong `tsconfig.json`.
- [x] **Thiết lập Docker Môi Trường**: Tạo tệp `docker-compose.yml` (Postgres & Redis) và `Dockerfile` tối ưu hóa caching, chạy dưới quyền non-root `USER bun` để đảm bảo an toàn.
- [x] **Cấu hình Drizzle ORM & Kit**: Tạo schema cho các bảng `seats`, `shows`, `bookings`, `tickets` và thiết lập kết nối động hỗ trợ cả môi trường cục bộ lẫn Neon Postgres SSL.
- [x] **Vá lỗi bảo mật Multer**: Khắc phục lỗi DoS (CVE-2026-5079 và CVE-2026-5038) bằng việc ép phiên bản `multer@2.2.0` qua khối `resolutions` trong `package.json`.
- [x] **Đồng bộ phiên bản Drizzle**: Cập nhật Drizzle ORM và Drizzle Kit lên phiên bản `@rc4` ổn định (`1.0.0-rc.4-5d5b77c`) tránh xung đột sinh migration.
- [x] **Tự động hóa kiểm tra kiểu dữ liệu (CI)**: Thêm script `check-types` (`tsc --noEmit`) và tích hợp vào GitHub Actions CI workflow trước bước build.
- [x] **Cài đặt chất lượng Git & Nhánh**: Thiết lập Husky + lint-staged cho pre-commit và xây dựng quy tắc bảo vệ nhánh chính (GitHub Rulesets - cấm force push/delete và bắt buộc pass CI).

### Phase 2: Booking Core & Concurrency Control (Nghiệp Vụ Lõi & Khóa Bi Quan) - KẾ HOẠCH

- [ ] **Tạo dữ liệu thử nghiệm (Seed Scripts)**: Viết script seed database tự động tạo danh sách ghế, lịch chiếu phim/show diễn để phục vụ việc kiểm thử.
- [ ] **Viết Transaction Đặt Ghế với Khóa Bi Quan**:
  - [ ] Thực hiện truy vấn đọc trạng thái ghế kèm khóa dòng `SELECT ... FOR UPDATE` (sử dụng `.for('update')` trong Drizzle).
  - [ ] Kiểm tra nếu ghế đã bị giữ/đặt thì rollback transaction lập tức.
  - [ ] Cập nhật trạng thái ghế thành đã đặt/giữ và tạo bản ghi hóa đơn đặt vé trong cùng một transaction nguyên tố.
- [ ] **Xác thực dữ liệu bằng Zod**: Sử dụng Zod để kiểm tra tính hợp lệ của dữ liệu đầu vào (độ dài ID, định dạng, các trường bắt buộc) trước khi chuyển vào Service xử lý.

### Phase 3: Asynchronous Queues & Lifecycle (Hàng Đợi BullMQ & Redis) - KẾ HOẠCH

- [ ] **Tích hợp NestJS BullMQ**: Cấu hình module `@nestjs/bullmq` kết nối với dịch vụ Redis chạy trong Docker.
- [ ] **Hàng đợi Hủy Đặt Vé Tự Động (Timeout Queue)**:
  - [ ] Khi một người dùng giữ ghế thành công, đẩy một job trì hoãn (delayed job) 10 phút vào hàng đợi BullMQ.
  - [ ] Lập trình Worker tiêu thụ job: Sau 10 phút, nếu đơn đặt vé đó chưa được thanh toán thành công, tiến hành khôi phục trạng thái ghế về `available` và hủy đơn đặt chỗ.

### Phase 4: API Endpoints & Stress Testing (API & Kiểm Thử CCU) - KẾ HOẠCH

- [ ] **BookingController**: Thiết lập các route HTTP (`POST /bookings/reserve`, `POST /bookings/confirm`).
- [ ] **Stress Test Giả Lập Tải Cao**:
  - [ ] Viết kịch bản kiểm thử chịu tải bằng k6 hoặc Bun Test giả lập 500-1,000 CCU đặt cùng một số ghế trống tại cùng một thời điểm.
  - [ ] Đo lường độ trễ (Latency) dưới 150ms và tỷ lệ lỗi (Error Rate) phải bằng 0%.
  - [ ] Xác minh tính nhất quán: số ghế bị đặt thành công phải trùng khớp 100% với số vé được ghi nhận, không có hiện tượng bán vượt (overselling).

---

## 🧠 Technical Challenges & CV Bullets

Dự án này giúp làm nổi bật các kỹ năng kỹ thuật sâu sắc cho vị trí Backend Developer trên CV:

- **Concurrency & Race Condition:** Giải quyết bài toán tranh chấp tài nguyên (đặt trùng ghế) bằng việc khóa dòng bi quan (`SELECT ... FOR UPDATE`) kết hợp hàng đợi xử lý bất đồng bộ.
  - _CV Bullet:_ _"Xây dựng cơ chế giao dịch an toàn (Transaction) tích hợp khóa bi quan (Pessimistic Locking) bằng Drizzle ORM, giải quyết triệt để lỗi đặt trùng ghế (double-booking) khi hệ thống chịu tải cao."_
- **Asynchronous Timeout Workers:** Quản lý vòng đời giữ chỗ tự động qua Redis & BullMQ.
  - _CV Bullet:_ _"Triển khai hàng đợi trì hoãn (Delayed Job Queue) bằng BullMQ & Redis để tự động hóa vòng đời đặt vé, giải phóng ghế giữ chỗ chưa thanh toán sau 10 phút với độ trễ xử lý dưới 50ms."_
