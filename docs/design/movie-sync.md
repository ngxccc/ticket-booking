---
title: "Movie Data Integration & TMDB Sync Service Workflow"
docType: "feature-workflow"
status: "approved"
date: 2026-07-04
author: "Team / Core Architecture"
version: "1.0.0"
---

# Movie Data Integration & TMDB Sync Service Workflow

---

## Overview & Context

This process describes how the Admin Dashboard interacts with TheMovieDB (TMDB) API to autofill movie information and store it directly into the local PostgreSQL database via the NestJS Backend, reducing manual entry while ensuring data integrity.

---

## Architecture

- **Catalog Synchronization Service**: Administrative pipeline consuming TMDB API movie details and mapping bilingual metadata.
- **Local Persistence & Asset Caching**: Stores movie metadata in PostgreSQL to isolate frontend clients from external rate limits.

---

## Operational Flow

Movie data is persisted locally in the PostgreSQL database instead of proxying API calls to TMDB during customer browsing to maximize response performance and system reliability.

```mermaid
sequenceDiagram
    autonumber
    actor Admin
    participant Dash as Admin Dashboard
    participant TMDB as TheMovieDB API
    participant API as Backend (NestJS)
    participant DB as Local Database (PostgreSQL)

    Admin->>Dash: Input movie title or TMDB_ID
    Dash->>TMDB: Search/Get Movie Details
    TMDB-->>Dash: Return JSON (Title, Description, Poster, Duration, etc.)
    Dash-->>Admin: Autofill Form Fields
    Admin->>Dash: Review & Edit Details (Translation, Poster Override)
    Admin->>Dash: Click "Save Movie"
    Dash->>API: POST /movies (Submit edited payload)
    API->>DB: Save to "movies" table
    DB-->>Admin: Movie ready for showtime scheduling (Shows)
```

---

## Technical Decisions & Implementation Details

- **Local Storage Strategy**: Caches external TMDB movie data inside local PostgreSQL tables to eliminate runtime external API dependencies and external rate limits.
- **Admin Review Pipeline**: Allows administrators to inspect and edit autofilled details before final persistence.

---

## Security & Defense-in-Depth

- **Admin Auth Guard**: Protects endpoint `POST /api/movies` using `JwtAuthGuard` + `RolesGuard(['admin'])`.
- **Payload Validation**: Validates all incoming movie attributes using `CreateMovieDto` and `class-validator` prior to database writes.
- **Sanitize Input**: Text attributes (title, description) are sanitized to prevent XSS and script injection attacks.

---

## Verification & Operational Checklist

- [x] Unauthorized users cannot access `POST /api/movies`.
- [x] Invalid TMDB payload fields trigger HTTP 400 Bad Request.
- [x] Movie records persist correctly in PostgreSQL.
