# Enterprise Engineering Security & Threat Mitigation Checklist

This operational checklist defines the mandatory security, integrity, and compliance controls required across the `ticket-booking` platform. It cross-references the industry's highest standards:

- **OWASP ASVS v4.0.3** (Application Security Verification Standard — Level 2/3)
- **PCI-DSS v4.0** (Payment Card Industry Data Security Standard — SAQ A / Scope Reduction)
- **OWASP API Security Top 10** (2023–2026 Edition)

All engineers must audit against these criteria prior to submitting Pull Requests, deploying database migrations, or releasing high-concurrency booking endpoints.

---

## 1. Concurrency, Inventory & Anti-Double-Booking (ASVS V10.2, OWASP API4)

- [ ] **Hard Database Constraints (Zero Application-Only Reliance)**:
  - Seat reservations MUST enforce database-level unique constraints:
    ```sql
    uniqueIndex("seats_hall_id_seat_number_uidx")
    ```
  - Application-level `if (!isReserved) { reserve(); }` checks alone are strictly prohibited.
- [ ] **Distributed Concurrency Control (Redlock / Atomic Lua)**:
  - Concurrent seat reservation requests MUST acquire distributed locks on `lock:show:{showId}:seat:{seatId}` before reading or mutating inventory.
  - Locks MUST have short bounded TTLs (e.g., $2000\text{ ms}$) and MUST be released within `finally` blocks.
- [ ] **Pessimistic Row Locking (`SELECT ... FOR UPDATE`)**:
  - Payment confirmation and checkout transitions MUST lock the target `bookings` row via `.for("update")` to eliminate race conditions between client checkouts and asynchronous payment webhooks.
- [ ] **Virtual Computed Status Invariant**:
  - Real-time seat availability queries MUST evaluate lock expiration dynamically via SQL expressions:
    ```sql
    CASE WHEN status = 'reserved' AND locked_until < NOW() THEN 'available' ELSE status END
    ```
  - Expired reservations MUST become immediately claimable without depending on background cron worker execution.
- [ ] **Denial-of-Inventory / Cart Holding Quotas**:
  - Enforce a maximum hold duration (10 minutes) and quota limits (maximum 8 seats per transaction; maximum 1 active hold session per authenticated user).

---

## 2. Payment Processing & PCI-DSS v4.0 Compliance (PCI-DSS Req 3, 4, 6)

- [ ] **Out-of-Scope Cardholder Data Isolation (SAQ A Compliance)**:
  - The backend server MUST NEVER ingest, transmit, process, or store Primary Account Numbers (PAN), CVV/CVC, or card PIN blocks.
  - Payment collection MUST be strictly offloaded to PCI-certified payment gateways (e.g. PayOS, Stripe) via hosted checkouts or embedded iframes.
- [ ] **Zero-Trust Pricing Architecture (ASVS V10.3)**:
  - Clients MUST NEVER supply `basePrice`, `finalPrice`, or discount amounts in request payloads.
  - All itemized prices MUST be calculated deterministically on the server:
    $$\text{finalPrice} = \text{Math.round}(\text{basePrice} \times \text{priceMultiplier})$$
- [ ] **Idempotent Checkout Operations (ASVS V10.2)**:
  - State-mutating payment and checkout endpoints MUST require the client header `Idempotency-Key: <UUIDv4>`.
  - Duplicate requests within the idempotency TTL window MUST return the identical cached transaction envelope without executing duplicate gateway charges or duplicate ticket generation.
- [ ] **Cryptographic Webhook Signature Verification (ASVS V13.2, OWASP API10)**:
  - Inbound payment webhooks MUST verify cryptographic signatures (`HMAC-SHA256`) against the shared secret using raw unparsed request payload bytes.
  - Constant-time string/buffer comparisons (`crypto.timingSafeEqual`) MUST be utilized to prevent timing side-channel attacks.
- [ ] **Timestamp Skew & Replay Defense**:
  - Inbound webhooks MUST reject payloads whose timestamp deviates by more than $300\text{ seconds}$ ($5\text{ minutes}$) from current server time with `400 Bad Request`.
- [ ] **Zero-Trust Client Redirects**:
  - The backend MUST NEVER mark a ticket as "Confirmed" solely based on frontend redirection from the gateway (`return_url`). Tickets are issued ONLY upon verified server-to-server webhook confirmation.

---

## 3. Authorization, Identity & BOLA Defense (ASVS V2, V4, OWASP API1, API5)

- [ ] **Broken Object-Level Authorization (BOLA / IDOR Defense)**:
  - Any operation mutating or reading booking, profile, or ticket records MUST scope queries to the authenticated user ID extracted from the verified JWT:
    ```sql
    WHERE bookings.id = :bookingId AND bookings.user_id = :currentUserId
    ```
- [ ] **Anti-Enumeration 404 Invariant**:
  - When a requested resource (e.g., booking, order) does not exist OR belongs to another tenant/user, the endpoint MUST return `404 Not Found RFC 9457` rather than `403 Forbidden` to prevent object identifier enumeration attacks.
- [ ] **Broken Function-Level Authorization (BFLA)**:
  - Administrative endpoints (e.g., `POST /shows`, `POST /shows/batch`, catalog administration) MUST be explicitly protected by both authentication and role guards:
    ```ts
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles("admin")
    ```
- [ ] **Stateless Token Hardening & Revocation (ASVS V3.5)**:
  - Access Token: Short-lived (15 minutes), stateless JWT stored in client memory.
  - Refresh Token: Long-lived (7 days), stored in PostgreSQL as SHA-256 hash.
  - Calling `/auth/logout` or `/auth/logout-all` MUST physically purge active refresh token hashes from PostgreSQL to prevent replay from compromised client storage.

---

## 4. Anti-Counterfeiting & Digital Ticket Integrity

- [ ] **Cryptographic Ticket Signatures**:
  - QR codes issued to customers MUST NOT expose raw database identifiers (`bookingId`).
  - QR code payloads MUST contain an HMAC or asymmetrically signed token (e.g. Ed25519) binding `ticketId`, `showId`, `seatId`, and `issuedAt` to prevent ticket replication or screenshot forgery.
- [ ] **Single-Scan Gate Admission Invariant**:
  - Validating a ticket barcode at the cinema turnstile MUST execute an atomic state transition:
    $$\text{ISSUED} \xrightarrow[\text{atomic UPDATE ... WHERE status = 'ISSUED'}]{\text{Check-in}} \text{ADMITTED}$$
  - Duplicate scans MUST return `409 Conflict (Ticket Already Admitted)` with the exact previous check-in timestamp.

---

## 5. Input Validation, Sanitization & SSRF Defense (ASVS V5, OWASP API3, API7)

- [ ] **Strict DTO Validation (BOPLA Defense)**:
  - All request parameters, bodies, and queries MUST be validated with `nestjs-zod` schemas configured with `.strict()` to reject mass-assignment payloads and unexpected fields.
- [ ] **HTML & Script Sanitization**:
  - Text fields accepted from users MUST be sanitized with `zSanitizedString()` to strip harmful HTML, script tags, and zero-width evasion characters.
- [ ] **Server-Side Request Forgery (SSRF) Hardening (OWASP API7)**:
  - If the application fetches external assets (e.g. TMDB movie posters, external trailers, partner webhooks), the egress client MUST block requests to private IP spaces (RFC 1918: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), loopback (`127.0.0.1`), and cloud metadata IP (`169.254.169.254`).
- [ ] **RFC 9457 Problem Details Error Envelope**:
  - API errors MUST conform to RFC 9457 envelopes (`status`, `title`, `detail`, `code`, `invalidParams`, `timestamp`). Internal stack traces and database error codes MUST NEVER leak to public consumers.

---

## 6. Audit Logging, Data Scrubbing & Monitoring (PCI-DSS Req 10, ASVS V8)

- [ ] **Log Scrubbing / Data Masking**:
  - Under no circumstances log passwords, JWT secrets, refresh tokens, or webhook signature keys in plaintext.
  - Logging interceptors and APM handlers (e.g. Sentry) MUST maintain an automated redactor list:
    ```ts
    const REDACTED_FIELDS = [
      "password",
      "token",
      "refreshToken",
      "checksumKey",
      "signature",
    ];
    ```
- [ ] **Immutable Security Audit Trails**:
  - All critical business events (account registration, password reset, role escalation, ticket hold, ticket release, payment webhook receipt, refund execution) MUST be written to append-only audit tables.

---

## 7. Transport Security & Network Hardening (PCI-DSS Req 4, ASVS V9)

- [ ] **Strict Transport Encryption (TLS 1.3 / 1.2)**:
  - Production deployments MUST enforce TLS 1.3 (or TLS 1.2 with secure AEAD cipher suites).
  - Production reverse proxies (Caddy/Nginx) MUST emit `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`.
- [ ] **Secure HTTP Security Headers**:
  - APIs and static referrers MUST emit standard security headers:
    - `X-Content-Type-Options: nosniff`
    - `X-Frame-Options: DENY`
    - `Referrer-Policy: strict-origin-when-cross-origin`
    - `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`

---

## 8. Verification & Standard Mapping Matrix

| Domain Category              | Standard Benchmark        | Automated Verification Test                                                             |
| :--------------------------- | :------------------------ | :-------------------------------------------------------------------------------------- |
| **Inventory Concurrency**    | OWASP API4, ASVS V10.2    | `test/load/suites/booking-concurrency/scenario.k6.ts`, `test/integration/shows.spec.ts` |
| **BOLA / IDOR Defense**      | OWASP API1, ASVS V4.1     | `src/modules/booking/booking.service.spec.ts` (INV-5)                                   |
| **Webhook HMAC Validation**  | ASVS V13.2, PCI-DSS Req 6 | `src/common/utils/payos-crypto.util.spec.ts`                                            |
| **Virtual Seat Status**      | ASVS V10.2                | `test/integration/shows.spec.ts` (INV-3)                                                |
| **DTO Mass Assignment**      | OWASP API3, ASVS V5.1     | `src/common/dto/create-zod-dto.util.ts` (`.strict()`)                                   |
| **Timing Attack Defense**    | ASVS V6.2                 | `src/common/utils/crypto.util.ts` (`timingSafeEqual`)                                   |
| **Type & Lint Static Proof** | ASVS V14.2                | `bun run check-types` && `bun run lint`                                                 |
