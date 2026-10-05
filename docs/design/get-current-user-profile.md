---
title: "Get Current User Profile Workflow Spec"
docType: "feature-workflow"
status: "implemented"
date: 2026-07-17
author: "Team / Core Architecture"
version: "1.0.0"
---

# Get Current User Profile Workflow Spec

---

## Overview & Context

This document describes the operational flow for retrieving the current authenticated user's profile (`GET /api/users/me`). The system verifies the Bearer JWT token using `JwtAuthGuard`, checks account status (`status !== 'suspended'`), and returns a `UserResponseDto` with HTTP 200 OK.

---

## Architecture

- **User Profile Service**: Retrieves sanitized account metadata via `JwtAuthGuard` session context.
- **Strict Column Projection**: Excludes password hashes and sensitive credential fields at the query layer.

---

## Operational Flow

```mermaid
sequenceDiagram
    autonumber
    actor Client as Client / Mobile App
    participant Guard as JwtAuthGuard
    participant Controller as UsersController
    participant Service as UsersService
    participant DB as PostgreSQL (Drizzle)

    Client->>Guard: GET /api/users/me (Header: Authorization Bearer JWT)
    alt Invalid/Expired Token
        Guard-->>Client: HTTP 401 Unauthorized
    else Valid Token
        Guard->>Controller: req.user (payload)
    end

    Controller->>Service: findById(req.user.id)
    Service->>DB: Query SELECT id, email, fullName, status, role FROM users WHERE id = req.user.id
    DB-->>Service: User Record
    alt Account Suspended/Inactive
        Service-->>Controller: throw ForbiddenException (403)
        Controller-->>Client: HTTP 403 Forbidden
    else Active Account
        Service->>Service: Derive isVerified (status !== 'pending_verification')
        Service-->>Controller: Return UserResponseDto
        Controller-->>Client: HTTP 200 OK ({ success: true, data: UserResponseDto })
    end
```

---

## Technical Decisions & Implementation Details

- **Strict Column Selection**: The Drizzle ORM query explicitly selects profile fields, excluding sensitive password hash data.
- **Derived Virtual Property**: `isVerified` is derived at runtime from `status !== 'pending_verification'`.

---

## Security & Defense-in-Depth

- **JWT Bearer Authentication**: Protects the endpoint using `JwtAuthGuard`.
- **Status Authorization**: Rejects suspended or inactive accounts with HTTP 403 Forbidden.
- **Data Protection**: Excludes password hash and internal security fields from the response DTO.

---

## Verification & Operational Checklist

- [x] Request without JWT token returns HTTP 401 Unauthorized.
- [x] Suspended account returns HTTP 403 Forbidden.
- [x] Response payload excludes password hash field.
