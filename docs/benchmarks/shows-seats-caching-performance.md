# Baseline Performance Report: Showtime Seating Chart Matrix (`GET /api/v1/shows/:id/seats`)

**Status**: Baseline Completed (Pure PostgreSQL / No Cache)  
**Target**: GET /api/v1/shows/:id/seats (Issue #128)  
**Date**: 2026-10-01  
**Author**: Engineering Team

---

## 1. Executive Summary

- **Gate Decision**: `FAIL` (Severe SLA breach under concurrent load).
- **Core Findings**: The public endpoint `GET /api/v1/shows/:id/seats` suffers from catastrophic connection pool starvation under concurrent load exceeding 50 Virtual Users (VUs). In-process single-query latency averages $168\text{ ms} - 230\text{ ms}$ due to a 6-table Single-JOIN query with dynamic virtual status computation (`CASE WHEN status = 'reserved' AND locked_until < NOW() ...`). Under the tri-modal load test (50–200 VUs), **$86.6\%$ of requests failed with HTTP 5xx errors (722/834 timeouts)**, and median response latency collapsed from $168\text{ ms}$ to **$7,199\text{ ms}$** ($7.2\text{ s}$) for Standard halls and **$10,809\text{ ms}$** ($10.8\text{ s}$) for IMAX halls, with peak tail latency reaching **$37.1\text{ s}$**.
- **Architectural Imperative**: Direct PostgreSQL reads cannot support flash-crowd ticket sales. Implementing **Redis Short-TTL Caching (1s - 3s) with deterministic Pub/Sub invalidation** per [Issue #128](https://github.com/ngxccc/ticket-booking/issues/128) is a **P1 Critical requirement** before public release.

---

## 2. System Under Test & Test Architecture

### 2.1 Hardware & Runtime Environment

- **Host**: Linux 7.2.4-arch1-2 x86_64, 16-core CPU, 32GB RAM.
- **Runtime**: Bun v1.4.2 + NestJS v12.1.0 (Fastify/Express engine).
- **Database**: PostgreSQL 16 on local loopback (zero external network latency).
- **Connection Pool**: `pg.Pool` with `max: 20` connections and `connectionTimeoutMillis: 5000` (5.0s timeout).

### 2.2 Enterprise Load Test Orchestrator

To avoid `package.json` script bloat, the testing harness uses a unified orchestrator (`test/load/runner.ts`):

- **Bundle Phase**: Compiles TypeScript k6 scenarios to standalone browser bundles inside isolated `test/load/.dist/`.
- **Seed Phase**: Seeds realistic showtime datasets in PostgreSQL (80% Available, 10% Reserved with active timers, 10% Booked) across Standard (200 seats) and IMAX (500 seats) halls.
- **Execution Phase**: Drives k6 runtime across ramping, burst, and steady-state arrival profiles.
- **Teardown Phase**: Automatically cascades database cleanup and drops temporary fixtures even upon failure.
- **Artifact Isolation**: Machine-readable JSON summaries are stored in `test-results/load/`, completely decoupled from production application build output in `dist/`.

---

## 3. Workload Profile & Execution Scenarios

The k6 test suite (`test/load/suites/shows-seats/scenario.k6.ts`) executes a tri-modal workload profile designed to uncover distinct system failure modes:

1. **Scenario 1: Ramping Stress Test (0s - 30s)**:
   - Profile: 5 $\rightarrow$ 25 $\rightarrow$ 100 $\rightarrow$ 200 looping VUs over 4 stages.
   - Objective: Pinpoint the **Saturation Knee Point** where queuing delays overtake database execution time.
2. **Scenario 2: Flash Crowd Burst (32s - 42s)**:
   - Profile: 100 VUs fire requests simultaneously with zero ramp-up time at $t = 32\text{s}$.
   - Objective: Measure shock resistance during high-demand blockbuster ticket on-sale surges.
3. **Scenario 3: Constant Throughput Test (44s - 59s)**:
   - Profile: Constant arrival rate of 50 RPS for 15 seconds (allocated 30–100 VUs).
   - Objective: Measure steady-state latency distribution ($p50, p95, p99$) under sustained traffic.

---

## 4. Key Performance Indicators

### 4.1 Micro-benchmark (Database & Service Layer)

Measured via `test/benchmarks/shows-seats.bench.ts` on `ShowsService.getShowSeats(showId)` directly in-process:

| Hall Scale         | Seats | Iterations | Min (ms) | Mean (ms) | Median / p50 (ms) | p95 (ms) | p99 (ms) | Internal Throughput |
| :----------------- | :---- | :--------- | :------- | :-------- | :---------------- | :------- | :------- | :------------------ |
| **Standard Hall**  | 200   | 50         | 126.26   | 191.98    | **168.84**        | 290.85   | 617.38   | **5.2 ops/sec**     |
| **IMAX Mega Hall** | 500   | 50         | 180.33   | 243.72    | **229.71**        | 354.80   | 512.76   | **4.1 ops/sec**     |

_Analysis: A single query monopolizes a PostgreSQL connection for ~170ms to ~230ms to join 6 tables (`shows`, `movies`, `halls`, `cinemas`, `show_seats`, `seats`, `seat_types`) and compute `CASE WHEN` dynamic lock expirations._

### 4.2 End-to-End HTTP Load Test (k6 Layer)

Executed against the running NestJS HTTP server:

| Metric                                 | Measured Baseline (No Cache) | Production SLA Target | Compliance            |
| :------------------------------------- | :--------------------------- | :-------------------- | :-------------------- |
| **Total HTTP Requests**                | 834 requests                 | —                     | —                     |
| **Successful Responses (HTTP 200)**    | 112 requests (**13.4%**)     | $> 99.9\%$            | ❌ **CRITICAL FAIL**  |
| **Failed Requests (HTTP 5xx)**         | 722 requests (**86.6%**)     | $0.0\%$               | ❌ **CRITICAL FAIL**  |
| **Standard Hall Median Latency (p50)** | **7,199 ms**                 | $< 100\text{ ms}$     | ❌ **72x SLA Breach** |
| **Standard Hall Tail Latency (p95)**   | **14,233 ms**                | $< 300\text{ ms}$     | ❌ **47x SLA Breach** |
| **Standard Hall Tail Latency (p99)**   | **21,853 ms**                | $< 500\text{ ms}$     | ❌ **43x SLA Breach** |
| **IMAX Hall Median Latency (p50)**     | **10,809 ms**                | $< 150\text{ ms}$     | ❌ **72x SLA Breach** |
| **IMAX Hall Tail Latency (p95)**       | **20,408 ms**                | $< 400\text{ ms}$     | ❌ **51x SLA Breach** |
| **IMAX Hall Tail Latency (p99)**       | **30,338 ms**                | $< 800\text{ ms}$     | ❌ **37x SLA Breach** |
| **Maximum Response Time**              | **37,142 ms** (~37.1s)       | $< 1,000\text{ ms}$   | ❌ Complete Timeout   |

---

## 5. Bottleneck & Saturation Analysis

### 5.1 USE Method Analysis (Infrastructure Layer)

- **Utilization**: Database connection pool utilization reached $100\%$ ($20/20$ connections active) almost immediately after concurrency crossed 25 VUs.
- **Saturation**: The client request queue backlog behind the connection pool exceeded 80 queued requests during burst windows.
- **Errors**: 722 connection timeout rejections occurred. Because `connectionTimeoutMillis` is set to $5,000\text{ ms}$, requests waiting longer than 5 seconds in the queue were aborted by the `pg` driver with:

  ```text
  Error: timeout exceeded when trying to connect
  ```

### 5.2 RED Method Analysis (Application Layer)

- **Rate**: Inbound throughput reached peak capacity at ~9.8 requests/second, constrained by connection queue depth.
- **Errors**: Error rate rose to $86.6\%$. Under constant 50 RPS arrival rate, k6 generated the following warning:

  ```text
  level=warning msg="Insufficient VUs, reached 100 active VUs and cannot initialize more"
  ```

  Because individual requests took > 5 seconds, sustaining 50 RPS mathematically required $> 250$ active concurrent connections, exhausting client and server resources.

- **Duration**: Cascading queuing delays transformed baseline query durations ($168\text{ ms}$) into 5–10 second client wait times.

### 5.3 Theoretical Capacity vs Observed Saturation

Given a 20-connection pool and a mean query duration $T_{query} \approx 200\text{ ms}$:
$$\text{Max Theoretical Throughput} = \frac{\text{Pool Size}}{T_{query}} = \frac{20}{0.20\text{ s}} = 100\text{ req/sec}$$
In reality, serialization overhead, lock contention, and event loop context switching degraded sustainable throughput to $< 25\text{ req/sec}$ before connection pool exhaustion triggered cascade failures.

---

## 6. Recommendations & Comparison Matrix

Implementing **Redis Short-TTL Caching (1s - 3s)** with event-driven WebSocket/Pub-Sub cache invalidation ([Issue #128](https://github.com/ngxccc/ticket-booking/issues/128) and Issue #37) bypasses PostgreSQL entirely for $> 98\%$ of read requests:

| Key Performance Indicator     | Baseline (Pure PostgreSQL) | Target (Redis Short-TTL Cache)     | Improvement Factor ($\Delta$) | Status    |
| :---------------------------- | :------------------------- | :--------------------------------- | :---------------------------- | :-------- |
| **Query Path**                | 6-table Single-JOIN SQL    | In-memory Redis `GET` / Buffer     | Complete SQL bypass           | 🎯 Target |
| **Peak Throughput**           | $9.8\text{ req/sec}$       | $\ge 500\text{ req/sec}$           | $\mathbf{> 50\times}$         | 🎯 Target |
| **Median Latency ($p50$)**    | $7,199\text{ ms}$          | $\le 5\text{ ms}$                  | $\mathbf{> 1,400\times}$      | 🎯 Target |
| **Tail Latency ($p95$)**      | $14,233\text{ ms}$         | $\le 15\text{ ms}$                 | $\mathbf{> 900\times}$        | 🎯 Target |
| **Tail Latency ($p99$)**      | $21,853\text{ ms}$         | $\le 30\text{ ms}$                 | $\mathbf{> 700\times}$        | 🎯 Target |
| **Error Rate (5xx Timeouts)** | $86.6\%$                   | $0.00\%$                           | **Zero Error Guarantee**      | 🎯 Target |
| **PostgreSQL Load Share**     | $100\%$ of read traffic    | $\le 2\%$ (cache miss / cold boot) | **$-98\%$ Database Load**     | 🎯 Target |
