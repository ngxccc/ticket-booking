<div align="center">

# Ticket Booking System

## High-Performance & Concurrency-Safe Ticket Reservation Backend

A modern, high-performance ticket booking and reservation backend built with **NestJS**, **Drizzle ORM**, and **PostgreSQL**, utilizing **BullMQ (Redis)** for concurrency-safe ticket reservations and background job queueing.

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![NestJS](https://img.shields.io/badge/NestJS-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com)
[![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=white)](https://bun.sh)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle-FF6B00?logo=drizzle&logoColor=white)](https://orm.drizzle.team)
[![Redis](https://img.shields.io/badge/Redis-DC382D?logo=redis&logoColor=white)](https://redis.io)
[![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)](https://www.docker.com)

## </div>

## Key Features

- **Concurrency-Safe Reservations**: Pessimistic row locking (`SELECT ... FOR UPDATE`) implemented at the database transaction level to prevent double-booking of seats under high concurrent load.
- **Background Job Processing**: Asynchronous tasks and event processing powered by **BullMQ** and **Redis**.
- **Type-Safe Database Schema**: Modern data access layer using **Drizzle ORM** with automatic SQL migration generation via **Drizzle Kit**.
- **Secure Docker Environment**: Multi-stage production-ready Docker configuration running as a non-root `bun` user (UID/GID 1001) with Alpine-compatible healthcheck.
- **Pre-commit Formatting Hook**: Standardized code formatting and linting on staged files using **Husky** and **lint-staged** running Prettier and ESLint.
- **Clean Architecture & Configuration**: Global config management using NestJS `ConfigService` with full support for single database connection URLs (`DB_URL`) or individual variables.

---

## Tech Stack

The application leverages the following modern technologies:

- **Framework**: NestJS (v11) - Node.js framework for building scalable enterprise-grade applications.
- **Runtime**: Bun (v1.3.14) - Ultra-fast JavaScript and TypeScript runtime.
- **Database ORM**: Drizzle ORM (v1.0.0-rc line) with Drizzle Kit for database access and migration management.
- **Database Driver**: pg (node-postgres) for connecting to PostgreSQL.
- **Background Jobs**: BullMQ (v5.79.1) & ioredis for distributed queues.
- **Linting & Formatting**: ESLint (v10) + Prettier (v3) with unified rules to prevent project warnings.
- **Git Hooks**: Husky & lint-staged for pre-commit quality gates.

---

## Concurrency Control & Database Locking

For a ticket booking application, preventing double-booking under high load is the most critical requirement. The system implements **Pessimistic Row Locking** at the database transaction level.

When a client attempts to book a seat, the transaction locks the specific seat row immediately using `FOR UPDATE`. This blocks any concurrent transactions attempting to read or modify the same seat until the first transaction either commits or rolls back.

```typescript
// Sample booking service logic implementing pessimistic locking
await this.db.transaction(async (tx) => {
  // Lock the seat row using FOR UPDATE
  const [seat] = await tx
    .select()
    .from(seats)
    .where(eq(seats.id, seatId))
    .for("update")
    .limit(1);

  if (!seat) throw new NotFoundException("Seat not found");
  if (seat.isBooked) throw new ConflictException("Seat is already booked");

  // Perform updates and create booking ticket
  await tx.update(seats).set({ isBooked: true }).where(eq(seats.id, seatId));
  await tx.insert(tickets).values({ userId, seatId });
});
```

---

## Getting Started

### Prerequisites

- **Bun**: v1.3.14 or later
- **Docker & Docker Compose**: For running PostgreSQL and Redis containers locally

### Local Development Setup

1. **Clone the repository and install dependencies**:

   ```bash
   bun install
   ```

2. **Spin up local PostgreSQL and Redis services**:

   ```bash
   docker compose up -d
   ```

3. **Database Migrations**:
   Run Drizzle Kit to generate and push schemas to your local database:

   ```bash
   # Generate database migrations based on Drizzle schema
   bun run db:generate

   # Push changes and execute migrations against the database
   bun run db:push
   ```

4. **Start the development server**:

   ```bash
   bun run dev
   ```

5. **Build for production**:

   ```bash
   bun run build
   ```

---

## Available Scripts

The following scripts are defined in the workspace root `package.json`:

- `bun run dev`: Launches the NestJS development server in watch mode (`nest start --watch`).
- `bun run build`: Compiles the NestJS application into production-ready JavaScript in the `dist/` directory.
- `bun run lint`: Runs ESLint with autofix enabled to scan for static code quality and formatting issues.
- `bun run check-types`: Runs TypeScript validation checks (`tsc --noEmit`) to verify there are no compilation or type errors.
- `bun run format`: Runs Prettier to enforce consistent code styling (enforcing double quotes across files).
- `bun test`: Executes the test suites in `src/` using the native Bun Test runner.
- `bun run start:prod`: Starts the compiled application in production mode.
- `bun run db:generate`: Generates database migrations based on schema.
- `bun run db:push`: Applies database schema changes and migrations.
- `bun run db:studio`: Opens Drizzle Studio GUI for database exploration.

> **Note on Upgrading Drizzle Prereleases:** Because the project uses the `1.0.0-rc` line, standard package updates may ignore newer release candidate hashes. To upgrade to the latest RC build manually, run `bun add drizzle-orm@rc4` and `bun add -d drizzle-kit@rc4`.

---

## Deployment & System Optimization Guide

The project includes a production-ready DevOps setup optimized for low-resource environments (such as an Azure B2ats_v2 VM with 2 vCPU, 1GB RAM) using Docker, Docker Compose, Cloudflare Tunnel, and Caddy Server.

### 1. Code Packaging & Transfer

To deploy changes from local to the VM, use a clean tarball packaging method. This prevents copying bulky `node_modules` or `.git` files:

1. **Pack the project using `git archive`** (ensures only tracked files are included):

   ```bash
   git archive -o /tmp/project.tar.gz HEAD
   ```

2. **Transfer the archive to the VM** via SCP:

   ```bash
   scp /tmp/project.tar.gz ticket-booking-vm:/home/azureuser/
   ```

3. **SSH into the VM, extract and redeploy**:

   ```bash
   ssh ticket-booking-vm
   # On the VM:
   cd /home/azureuser
   rm -rf ticket-booking-new && mkdir ticket-booking-new
   tar -xzf project.tar.gz -C ticket-booking-new
   rm -rf ticket-booking && mv ticket-booking-new ticket-booking
   cd ticket-booking
   chmod +x scripts/redeploy.sh
   ./scripts/redeploy.sh
   ```

### 2. Cloudflare Tunnel & HTTPS Setup

To achieve maximum security and avoid rate-limiting issues with SSL certificates:

- **Zero Open Ports**: Do **NOT** open port 22, 80, or 443 on the Azure Network Security Group (NSG) public interface. All traffic is securely routed outbound via the Cloudflare Tunnel daemon (`cloudflared`).
- **SSL Termination at Edge**: Cloudflare handles SSL termination. Caddy runs in **HTTP-only mode** internally (by prefixing domains with `http://` in the Caddyfile) to avoid redirect loops and SSL renewal rate limits.
- **Caddyfile Configuration**: The Caddyfile is automatically generated to listen on HTTP:

  ```caddy
  http://yourdomain.com {
      reverse_proxy ticket-booking-app-blue:3000
  }
  ```

- **SSH Access**: Configured in `~/.ssh/config` using `cloudflared` ProxyCommand to connect securely without public exposure:

  ```ssh
  Host ticket-booking-vm
      HostName ssh.yourdomain.com
      User azureuser
      ProxyCommand cloudflared access ssh --hostname %h
      IdentityFile ~/.ssh/your-key.pem
  ```

### 3. Deploying the Application

The deployment process uses **Zero-Downtime Blue-Green Deployment** to ensure uninterrupted access:

#### Full Deployment Stack (`scripts/redeploy.sh`)

Run this on initial setup or full infrastructure redeployment:

```bash
./scripts/redeploy.sh
```

It automates:

1. Checks and configures 2GB Swap space.
2. Installs Docker & Docker Compose if missing.
3. Runs the system optimization script (`scripts/optimize-system.sh`).
4. Starts PostgreSQL, Redis, and Caddy.
5. Executes `scripts/deploy-app.sh` (Blue-Green pipeline).

#### Deploying Application Updates (`scripts/deploy-app.sh`)

Run this directly if you only want to build and deploy application code updates:

```bash
./scripts/deploy-app.sh
```

---

### 4. Extreme RAM & Resource Limits

To prevent Out-Of-Memory (OOM) crashes on 1GB RAM machines, strict resource limits are applied:

#### Operating System & Daemon Level

- **Docker Daemon Limit**: Limited to **250MB Max** (High threshold at 200MB) via systemd drop-in override (`/etc/systemd/system/docker.service.d/memory.conf`).
- **Swap Space**: **2GB Swap** file configured to absorb peaks.
- **Disabled Services**: Unnecessary background processes (`walinuxagent`, `unattended-upgrades`) are disabled to reclaim ~120MB memory.
- **Journald Limit**: Limited to **50MB max** log storage to prevent disk bloating.

#### Container Level (defined in `docker-compose.yml` / `run` command)

| Container Name                  | CPU Limit | Memory Limit (Hard) | Memory Reservation (Soft) |
| :------------------------------ | :-------- | :------------------ | :------------------------ |
| `ticket-booking-postgres`       | `0.50`    | `512MB`             | `256MB`                   |
| `ticket-booking-redis`          | `0.25`    | `128MB`             | `32MB`                    |
| `ticket-booking-caddy`          | `0.15`    | `128MB`             | `64MB`                    |
| `ticket-booking-app-blue/green` | `0.50`    | `256MB`             | `128MB`                   |

_To adjust these thresholds, edit `/etc/systemd/system/docker.service.d/memory.conf` for Docker, or modify `docker-compose.yml` and `deploy-app.sh` for the containers._
