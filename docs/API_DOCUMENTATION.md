# Alarm Automation — API Documentation

## Table of Contents

1. [Document Purpose](#1-document-purpose)
2. [API Architecture](#2-api-architecture)
3. [Base URL and CORS](#3-base-url-and-cors)
4. [Authentication Model](#4-authentication-model)
5. [Role-Based Access Control](#5-role-based-access-control)
6. [Endpoint Summary](#6-endpoint-summary)
7. [Root Endpoint](#7-root-endpoint)
8. [Ticket Endpoints](#8-ticket-endpoints)
9. [Notification Endpoints](#9-notification-endpoints)
10. [AI Troubleshooting Endpoint](#10-ai-troubleshooting-endpoint)
11. [Root Cause Analysis Endpoint](#11-root-cause-analysis-endpoint)
12. [Authentication Endpoints](#12-authentication-endpoints)
13. [Admin User Management Endpoints](#13-admin-user-management-endpoints)
14. [RAG Evaluation Endpoints](#14-rag-evaluation-endpoints)
15. [Frontend API Wrapper](#15-frontend-api-wrapper)
16. [API-to-Frontend Mapping](#16-api-to-frontend-mapping)
17. [API State Changes](#17-api-state-changes)
18. [Error Handling](#18-error-handling)
19. [Changelog](#19-changelog)

---

## 1. Document Purpose

This document describes the HTTP API currently implemented by the Alarm Automation backend and the frontend API wrapper used to call it.

- **Backend framework:** FastAPI
- **Backend entry point:** `backend/main.py`
- **Authentication module:** `backend/auth.py`
- **ORM models:** `backend/models.py`
- **Frontend API layer:** `frontend/src/api/api.js`

This version supersedes the earlier session-cookie-only documentation and reflects the migration to JWT access/refresh tokens, role-based access control, resolution capture on ticket closure, Root Cause Analysis (RCA), and RAG evaluation endpoints.

---

## 2. API Architecture

### 2.1 Standard Request Path

```text
React Component
       |
       v
api.js (authenticatedFetch wrapper)
       |
       v
HTTP Request (Access Token cookie attached)
       |
       v
FastAPI Router
       |
       v
Auth Dependency (get_current_user / require_Admin)
       |
       v
Business Logic
       |
       v
SQLAlchemy ORM
       |
       v
PostgreSQL
```

### 2.2 AI Troubleshooting Request Path

```text
React (TroubleshootModal)
       |
       v
api.js -> troubleshootTicket()
       |
       v
GET /troubleshoot/{ticket_number}
       |
       v
FastAPI -> PostgreSQL ticket lookup
       |
       v
troubleshoot_alarm()
       |
       v
PostgreSQL knowledge retrieval -> FAISS -> MMR -> Reranker -> Groq LLM
       |
       v
JSON Response
```

### 2.3 Automatic Token Refresh Path

```text
Protected Request
       |
       v
401 Unauthorized
       |
       v
POST /auth/refresh (Refresh Token cookie)
       |
       v
New Access Token cookie set
       |
       v
Original request retried once
```

---

## 3. Base URL and CORS

### 3.1 Frontend Base

The frontend defines:

```javascript
const API_BASE = "";
```

The frontend therefore calls **relative paths** such as:

```text
/tickets
/notifications
/auth/login
/troubleshoot/AL-10001
```

The Vite development server proxies API routes to the FastAPI backend at `http://localhost:8001`.

### 3.2 Proxied Routes

```text
/auth
/tickets
/notifications
/troubleshoot
/rca
/api
```

### 3.3 CORS Configuration

The FastAPI CORS middleware explicitly allows the following origins:

```text
http://localhost:5173
http://127.0.0.1:5173
http://localhost:5500
http://127.0.0.1:5500
```

Credentials are enabled (`allow_credentials=True`), which is required for cookie-based token transport.

---

## 4. Authentication Model

The application uses a **JWT-based Access + Refresh token flow**, with both tokens stored in **HTTP-only cookies**.

| Token | Purpose | Lifetime | Transport |
|---|---|---|---|
| Access Token | Authenticates standard API requests | Short-lived | HTTP-only cookie |
| Refresh Token | Issues a new Access Token when the current one expires | Long-lived | HTTP-only cookie |

### 4.1 Key Characteristics

- Access tokens are validated on every protected request via the `get_current_user` dependency.
- Refresh tokens are **hashed before storage** in the `refresh_tokens` table.
- Refresh tokens can be **revoked** (logout, rotation, or expiry).
- No authentication tokens are stored in browser `localStorage`.
- The frontend sends `credentials: "include"` on all protected requests.

### 4.2 FastAPI Dependencies

| Dependency | Applied To | Behavior |
|---|---|---|
| `get_current_user` | All operator-facing endpoints | Validates Access Token, loads user, returns `401` if invalid/expired |
| `require_Admin` | Admin-only endpoints | Runs `get_current_user`, then verifies `role == "admin"`, returns `403` otherwise |

### 4.3 Cookie Security Flags

```text
HttpOnly   : true
SameSite   : Lax
Secure     : configurable via AUTH_COOKIE_SECURE
```

For local HTTP development:

```env
AUTH_COOKIE_SECURE=false
```

For HTTPS deployments, set this to `true`.

---

## 5. Role-Based Access Control

The `User` model includes a `role` column:

```python
role = Column(String(20), nullable=False, default="user", server_default="user")
```

| Role | Capabilities |
|---|---|
| `user` | View tickets, manage ticket lifecycle, acknowledge notifications, run troubleshooting and RCA |
| `admin` | All `user` capabilities **plus** user management, role assignment, and RAG evaluation execution/history |

**Safety rule:** The role-update endpoint contains logic preventing the demotion of the **last active admin**, ensuring the system cannot be left without an administrator.

---

## 6. Endpoint Summary

| Method | Endpoint | Purpose | Auth |
|---|---|---|---|
| `GET` | `/` | API health/home response | None |
| `GET` | `/tickets` | Retrieve all tickets | `get_current_user` |
| `PUT` | `/tickets/{ticket_number}/priority` | Change ticket priority | `get_current_user` |
| `PUT` | `/tickets/{ticket_number}/close` | Close ticket (optional resolution data) | `get_current_user` |
| `PUT` | `/tickets/{ticket_number}/reopen` | Reopen a closed ticket | `get_current_user` |
| `PUT` | `/tickets/{ticket_number}/acknowledge` | Acknowledge latest ticket event | `get_current_user` |
| `GET` | `/notifications` | Retrieve event-derived notifications | `get_current_user` |
| `GET` | `/troubleshoot/{ticket_number}` | Generate RAG troubleshooting guidance | `get_current_user` |
| `GET` | `/rca/{ticket_number}` | Generate Root Cause Analysis | `get_current_user` |
| `POST` | `/auth/register` | Register a new user | None |
| `POST` | `/auth/login` | Authenticate and issue tokens | None |
| `POST` | `/auth/refresh` | Refresh the Access Token | Refresh cookie |
| `POST` | `/auth/logout` | Revoke refresh token, clear cookies | Refresh cookie |
| `GET` | `/auth/me` | Return current user and role | `get_current_user` |
| `POST` | `/auth/forgot-password` | Initiate password recovery | None |
| `POST` | `/auth/reset-password` | Complete password reset | Reset token |
| `GET` | `/auth/users` | List all users | `require_Admin` |
| `PATCH` | `/auth/users/{user_id}/role` | Update a user's role | `require_Admin` |
| `POST` | `/api/evaluate/run` | Trigger RAG evaluation | `require_Admin` |
| `GET` | `/api/evaluate/history` | Retrieve RAG evaluation history | `require_Admin` |

---

## 7. Root Endpoint

### `GET /`

**Purpose:** Basic API health/home response.  
**Authentication:** None.

**Response `200 OK`**

```json
{
  "message": "Alarm Automation API is running"
}
```

The frontend uses this endpoint to derive the `backendOnline` indicator displayed in the sidebar.

---

## 8. Ticket Endpoints

### 8.1 `GET /tickets`

**Purpose:** Retrieve all tickets from PostgreSQL.  
**Authentication:** `get_current_user`

**Response `200 OK`**

```json
[
  {
    "ticketNumber": "AL-10001",
    "node": "NODE-101",
    "alarmType": "HIGH_CPU",
    "occurrenceCount": 3,
    "usersImpacted": 250,
    "severity": "Major",
    "thresholdBreached": true,
    "impactLevel": "HIGH",
    "priority": "P4",
    "assignedTeam": "Platform",
    "status": "OPEN",
    "reason": null,
    "createdAt": "2026-10-06 10:00:00",
    "updatedAt": "2026-10-06 10:00:00",
    "closedAt": null,
    "reopenedAt": null
  }
]
```

**Returned Fields**

| Field | Type | Description |
|---|---|---|
| `ticketNumber` | string | Persistent ticket identifier (`AL-xxxxx`) |
| `node` | string | Network node identifier |
| `alarmType` | string | Alarm classification |
| `occurrenceCount` | integer | Number of grouped alarm occurrences |
| `usersImpacted` | integer | Estimated affected users |
| `severity` | string | Highest severity in the alarm group |
| `thresholdBreached` | boolean | Whether a threshold was exceeded |
| `impactLevel` | string | `HIGH` / `MEDIUM` / `LOW` |
| `priority` | string | `P1` / `P2` / `P3` / `P4` |
| `assignedTeam` | string | Operational team responsible |
| `status` | string | `OPEN` / `CLOSED` |
| `reason` | string \| null | Reopen or action reason |
| `createdAt` | string | Creation timestamp |
| `updatedAt` | string | Last modification timestamp |
| `closedAt` | string \| null | Closure timestamp |
| `reopenedAt` | string \| null | Reopen timestamp |

**Errors**

| Code | Condition |
|---|---|
| `401` | Missing, invalid, or expired Access Token |

---

### 8.2 `PUT /tickets/{ticket_number}/priority`

**Purpose:** Change a ticket's priority (upgrade or downgrade).  
**Authentication:** `get_current_user`

**Request Body**

```json
{
  "priority": "P1"
}
```

Allowed values: `P1`, `P2`, `P3`, `P4`.

**Backend Processing**

1. Locate the ticket by `ticket_number`.
2. Validate the priority value.
3. Reject if the ticket is `CLOSED`.
4. Reject if the new priority equals the current priority.
5. Determine direction:
   - `P4 → P3` = `PRIORITY_UPGRADE`
   - `P2 → P3` = `PRIORITY_DOWNGRADE`
6. Update `Ticket.priority` and `updated_at`.
7. Create a `TicketEvent` recording previous and new priority.

**Response `200 OK`**

```json
{
  "message": "Ticket priority updated",
  "ticketNumber": "AL-10001",
  "priority": "P1"
}
```

**Errors**

| Code | Condition |
|---|---|
| `400` | Invalid priority value or priority unchanged |
| `401` | Not authenticated |
| `404` | Ticket not found |
| `409` | Ticket is closed |

---

### 8.3 `PUT /tickets/{ticket_number}/close`

**Purpose:** Close an open ticket and optionally capture structured resolution details that feed back into the RAG knowledge base.  
**Authentication:** `get_current_user`

> **Updated in this version.** The endpoint now accepts an **optional** resolution questionnaire body.

#### Request Body — Without Questionnaire

No body is required. The ticket closes normally and no historical incident is created.

#### Request Body — With Questionnaire

```json
{
  "observedSymptoms": "CPU sustained above 95% on NODE-101 for 12 minutes.",
  "rootCause": "Runaway logging process consumed CPU after log rotation failure.",
  "actionsTaken": "Restarted logging service and corrected rotation configuration.",
  "shellCommandsUsed": "top -b -n 1\nsystemctl status rsyslog",
  "shellScriptUsed": "",
  "resolution": "Log rotation policy corrected; service restarted.",
  "verificationResults": "CPU returned to 22% and remained stable for 30 minutes.",
  "escalation": "None",
  "additionalNotes": "Rotation config added to node provisioning template."
}
```

**All fields are optional.**

| Field | Maps To (`HistoricalIncident`) |
|---|---|
| `observedSymptoms` | `observed_symptoms` |
| `rootCause` | `root_cause` |
| `actionsTaken` | `actions_taken` |
| `shellCommandsUsed` | `shell_commands_used` |
| `shellScriptUsed` | `shell_script_used` |
| `resolution` | `resolution` |
| `verificationResults` | `verification_results` |
| `escalation` | `escalation` |
| `additionalNotes` | `additional_notes` |

**Backend Processing**

1. Locate the ticket; reject if already `CLOSED`.
2. If resolution data is supplied, create a `HistoricalIncident` linked to the ticket with `source = "questionnaire"`.
3. Set `Ticket.status = "CLOSED"` and record `closed_at`.
4. Create a `TICKET_CLOSED` `TicketEvent` (event status `RESOLVED`).
5. Commit the transaction.
6. Call `refresh_vector_store()` so any new incident becomes immediately retrievable by the RAG pipeline. The refresh runs on every close; when resolution data was supplied, a refresh failure is caught and logged without failing the request.

> If any step before the commit fails, the transaction is rolled back and the endpoint returns `500` with no changes saved.

**Response `200 OK`**

```json
{
  "message": "Ticket closed successfully",
  "ticketNumber": "AL-10001",
  "status": "CLOSED",
  "closedAt": "2026-11-03T10:30:00",
  "resolutionSaved": true
}
```

`resolutionSaved` is `false` when no questionnaire body was submitted.

**Errors**

| Code | Condition |
|---|---|
| `401` | Not authenticated |
| `404` | Ticket not found |
| `409` | Ticket already closed |
| `500` | Transaction failed; no changes saved |

**Closed-Loop Learning Effect**

```text
Operator closes ticket
        |
        v
Resolution questionnaire submitted
        |
        v
HistoricalIncident row (source = "questionnaire")
        |
        v
refresh_vector_store()
        |
        v
FAISS index updated
        |
        v
Available to future /troubleshoot and /rca requests
```

---

### 8.4 `PUT /tickets/{ticket_number}/reopen`

**Purpose:** Reopen a previously closed ticket.  
**Authentication:** `get_current_user`

**Request Body**

```json
{
  "priority": "P2",
  "reason": "Alarm condition has returned on the same node."
}
```

Both fields are required. `reason` must be non-empty.

**Backend Processing**

1. Validate the priority value.
2. Validate that `reason` is not empty.
3. Require current status to be `CLOSED`.
4. Set `status = "OPEN"`, update `priority`, record `reopened_at`.
5. Create a `TICKET_REOPENED` `TicketEvent` including the reason.

**Response `200 OK`**

```json
{
  "message": "Ticket reopened successfully",
  "ticketNumber": "AL-10001",
  "status": "OPEN",
  "priority": "P2",
  "reason": "Alarm condition has returned on the same node.",
  "reopenedAt": "2026-11-03T10:30:00"
}
```

**Errors**

| Code | Condition |
|---|---|
| `400` | Invalid priority or empty reason |
| `401` | Not authenticated |
| `404` | Ticket not found |
| `409` | Ticket is not closed |

---

### 8.5 `PUT /tickets/{ticket_number}/acknowledge`

**Purpose:** Acknowledge the latest event/notification associated with a ticket.  
**Authentication:** `get_current_user`

**Backend Processing**

1. Locate the most recent `TicketEvent` for the ticket.
2. If its status is not already `ACKNOWLEDGED` or `RESOLVED`, set it to `ACKNOWLEDGED`.
3. Commit.

**Response `200 OK`**

```json
{
  "message": "Latest notification acknowledged",
  "ticketNumber": "AL-10001",
  "acknowledged": true
}
```

**Errors**

| Code | Condition |
|---|---|
| `401` | Not authenticated |
| `404` | Ticket or event not found |

---

## 9. Notification Endpoints

### `GET /notifications`

**Purpose:** Retrieve notification history derived from `TicketEvent` records.  
**Authentication:** `get_current_user`

Notifications are **not** stored as an independent table state; they are projected from the ticket event log.

**Response `200 OK`**

```json
[
  {
    "ticketNumber": "AL-10001",
    "assignedTeam": "Platform",
    "message": "Priority upgraded from P4 to P1 for HIGH_CPU on NODE-101",
    "status": "PENDING",
    "eventType": "PRIORITY_UPGRADE",
    "previousPriority": "P4",
    "newPriority": "P1",
    "priority": "P1",
    "reason": null,
    "timestamp": "2026-11-03T10:00:00",
    "alarmType": "HIGH_CPU",
    "node": "NODE-101"
  }
]
```

**Returned Fields**

| Field | Description |
|---|---|
| `ticketNumber` | Associated ticket |
| `assignedTeam` | Responsible team |
| `message` | Human-readable notification text |
| `status` | `PENDING` / `ACKNOWLEDGED` / `RESOLVED` |
| `eventType` | One of the event types below |
| `previousPriority` | Priority before the change (if applicable) |
| `newPriority` | Priority after the change (if applicable) |
| `priority` | Current ticket priority |
| `reason` | Operator-supplied reason (if applicable) |
| `timestamp` | Event timestamp |
| `alarmType` | Alarm classification |
| `node` | Network node |

**Supported Event Types**

```text
TICKET_CREATED
PRIORITY_UPGRADE
PRIORITY_DOWNGRADE
TICKET_CLOSED
TICKET_REOPENED
```

**Delivery Model:** The frontend refreshes notifications via **periodic polling** (default 20 seconds, configurable in Settings). WebSockets/SSE are not currently implemented.

---

## 10. AI Troubleshooting Endpoint

### `GET /troubleshoot/{ticket_number}`

**Purpose:** Generate a retrieval-grounded troubleshooting recommendation for a ticket.  
**Authentication:** `get_current_user`

**Backend Processing**

1. Load the ticket from PostgreSQL.
2. Extract ticket context:
   ```text
   alarmType, node, occurrenceCount, usersImpacted,
   severity, thresholdBreached, impactLevel, priority, assignedTeam
   ```
3. Call `troubleshoot_alarm(...)`.
4. The RAG layer performs filtered retrieval from PostgreSQL-backed knowledge, MMR selection, reranking, parent resolution, and Groq LLM generation.
5. Return the recommendation and supporting historical incidents.

**Response `200 OK`**

```json
{
  "alarmType": "HIGH_CPU",
  "recommendation": "1. Verify current CPU utilization...\n2. ...",
  "historicalIncidents": [
    {
      "id": 12,
      "alarmType": "HIGH_CPU",
      "node": "NODE-088",
      "rootCause": "...",
      "resolution": "...",
      "source": "questionnaire"
    }
  ]
}
```

> The internal `retrieved_context` produced by the RAG function is **not** exposed in the HTTP response.

**Safety Constraints**

The assistant is prompt-constrained to:
- Use only retrieved commands.
- Never invent or modify shell commands.
- Never execute commands automatically.
- Treat historical incidents as supporting evidence, not guaranteed fixes.
- Explicitly report insufficient knowledge when retrieval is inadequate.

**Errors**

| Code | Condition |
|---|---|
| `401` | Not authenticated |
| `404` | Ticket not found |
| `500` | RAG/LLM backend failure |

---

## 11. Root Cause Analysis Endpoint

### `GET /rca/{ticket_number}`

> **New in this version.**

**Purpose:** Generate a structured Root Cause Analysis for a significant closed incident.  
**Authentication:** `get_current_user`

**Eligibility Rules**

| Rule | Requirement | Failure Code |
|---|---|---|
| Ticket status | Must be `CLOSED` | `409` |
| Ticket priority | Must be `P1` or `P2` | `409` |

This restriction intentionally limits RCA generation to high-severity, completed incidents.

**Backend Processing**

1. Load the ticket.
2. Validate status is `CLOSED`.
3. Validate priority is `P1` or `P2`.
4. Call `analyze_root_cause(...)` with ticket attributes and associated resolution/history data.
5. Return the generated analysis.

**Response `200 OK`**

```json
{
  "ticketNumber": "AL-10001",
  "alarmType": "HIGH_CPU",
  "analysis": "..."
}
```

**Errors**

| Code | Condition |
|---|---|
| `401` | Not authenticated |
| `404` | Ticket not found |
| `409` | Ticket not closed, or priority is not P1/P2 |

**Frontend Integration:** Exposed via `analyzeTicketRca(ticketNumber)` and surfaced in the ticket details / RCA modal for eligible tickets.

---

## 12. Authentication Endpoints

### 12.1 `POST /auth/register`

**Purpose:** Register a new application user.  
**Authentication:** None (rate-limited).

**Request Body**

```json
{
  "full_name": "Example Operator",
  "username": "operator",
  "email": "operator@example.com",
  "password": "StrongPassword123!"
}
```

**Backend Processing**

- Enforces registration rate limiting.
- Validates username/email uniqueness.
- Hashes the password using `pwdlib` (Argon2-compatible).
- Assigns `role = "user"` by default.

**Response `201 Created`**

```json
{
  "message": "User registered successfully",
  "user": {
    "id": 1,
    "fullName": "Example Operator",
    "username": "operator",
    "email": "operator@example.com",
    "role": "user"
  }
}
```

**Errors**

| Code | Condition |
|---|---|
| `400` | Missing full name, username under 3 characters, or password under 10 characters |
| `409` | Username or email already exists |
| `429` | Registration rate limit exceeded |

---

### 12.2 `POST /auth/login`

**Purpose:** Authenticate a user and issue JWT tokens.  
**Authentication:** None (rate-limited).

**Request Body**

```json
{
  "identifier": "operator",
  "password": "StrongPassword123!"
}
```

`identifier` accepts either a **username** or an **email address**.

**Backend Processing**

1. Enforce login rate limiting.
2. Resolve the user by username or email.
3. Verify the password hash.
4. Generate an Access Token and a Refresh Token.
5. Store the **hashed** Refresh Token in `refresh_tokens`.
6. Set both tokens as HTTP-only cookies.

**Response `200 OK`**

```json
{
  "message": "Login successful",
  "user": {
    "id": 1,
    "fullName": "Example Operator",
    "username": "operator",
    "email": "operator@example.com",
    "role": "user"
  }
}
```

**Cookies Set**

```text
<ACCESS_TOKEN_COOKIE_NAME>=<jwt>; HttpOnly; SameSite=Lax
<REFRESH_TOKEN_COOKIE_NAME>=<jwt>; HttpOnly; SameSite=Lax
```

**Errors**

| Code | Condition |
|---|---|
| `401` | Invalid credentials |
| `409` | Rate limit exceeded (login attempts throttled) |

---

### 12.3 `POST /auth/refresh`

> **New in this version.**

**Purpose:** Issue a new Access Token using the Refresh Token cookie.  
**Authentication:** Refresh Token cookie (no request body).

**Backend Processing**

1. Read the refresh cookie.
2. Validate the token signature and expiry.
3. Verify the hashed token exists and is not revoked in `refresh_tokens`.
4. Issue a new Access Token and set the cookie.

**Response `200 OK`**

```json
{
  "message": "Access token refreshed"
}
```

**Errors**

| Code | Condition |
|---|---|
| `401` | Missing, invalid, expired, or revoked refresh token |

**Frontend Behavior:** Called automatically by `authenticatedFetch()` on a `401` response; the original request is then retried once.

---

### 12.4 `GET /auth/me`

**Purpose:** Return the currently authenticated user, including role.  
**Authentication:** `get_current_user`

**Response `200 OK`**

```json
{
  "id": 1,
  "fullName": "Example Operator",
  "username": "operator",
  "email": "operator@example.com",
  "role": "admin"
}
```

Used by the frontend on load to restore session state and to conditionally render admin-only UI (User Management, RAG Evaluation).

---

### 12.5 `POST /auth/logout`

**Purpose:** Terminate the current session.  
**Authentication:** Refresh Token cookie.

**Backend Processing**

1. Read the refresh cookie.
2. Revoke the corresponding token record in the database.
3. Delete both Access and Refresh cookies from the response.

**Response `200 OK`**

```json
{
  "message": "Logout successful"
}
```

---

### 12.6 `POST /auth/forgot-password`

**Purpose:** Initiate password recovery.  
**Authentication:** None (rate-limited).

**Request Body**

```json
{
  "email": "operator@example.com"
}
```

**Backend Processing**

- Enforces password-reset rate limiting.
- Generates a reset token and stores its **hash** with an expiry in `password_reset_tokens`.
- Always returns the same generic message regardless of whether the account exists (to avoid account enumeration).
- **Development behavior:** the reset URL is printed to the backend console **and** returned in the response body as `reset_url`. No external email service is integrated yet; `reset_url` should be removed before production.

**Response `200 OK`**

```json
{
  "message": "If an account exists for this email, a reset link has been generated.",
  "reset_url": "http://localhost:5173/#/reset-password?token=<reset-token>"
}
```

> `reset_url` is only present when the account exists and is active. For a non-existent or inactive account, only the `message` field is returned.

**Errors**

| Code | Condition |
|---|---|
| `429` | Password-reset rate limit exceeded |

---

### 12.7 `POST /auth/reset-password`

**Purpose:** Complete a password reset using a valid token.  
**Authentication:** Reset token.

**Request Body**

```json
{
  "token": "<reset-token>",
  "new_password": "NewStrongPassword456!"
}
```

**Backend Processing**

1. Hash and look up the token.
2. Verify it is unused and unexpired.
3. Update the password hash.
4. Invalidate the token.

**Response `200 OK`**

```json
{
  "message": "Password reset successful"
}
```

**Errors**

| Code | Condition |
|---|---|
| `400` | Invalid, expired, or already-used token |

---

## 13. Admin User Management Endpoints

> **New in this version.** Both endpoints require an authenticated **admin** user. They use the `get_current_user` dependency plus an inline `role == "admin"` check (returning `403` otherwise), which is behaviorally equivalent to `require_Admin`.

### 13.1 `GET /auth/users`

**Purpose:** Retrieve all registered users (ordered by ascending `id`).  
**Authentication:** Admin (via `get_current_user` + inline role check)

**Response `200 OK`**

```json
{
  "users": [
    {
      "id": 1,
      "fullName": "Example Operator",
      "username": "operator",
      "email": "operator@example.com",
      "role": "admin",
      "isActive": true
    },
    {
      "id": 2,
      "fullName": "Operator Two",
      "username": "operator2",
      "email": "op2@example.com",
      "role": "user",
      "isActive": true
    }
  ]
}
```

**Errors**

| Code | Condition |
|---|---|
| `401` | Not authenticated |
| `403` | Authenticated but not an admin |

---

### 13.2 `PATCH /auth/users/{user_id}/role`

**Purpose:** Update a user's role.  
**Authentication:** Admin (via `get_current_user` + inline role check)

**Request Body**

```json
{
  "role": "admin"
}
```

Allowed values: `"admin"`, `"user"`.

**Backend Processing**

1. Validate the role value.
2. Locate the target user.
3. Apply the **last-admin protection** rule — a demotion that would leave zero active admins is rejected.
4. Update `User.role` and commit.

**Response `200 OK`**

```json
{
  "message": "User role updated successfully",
  "user": {
    "id": 2,
    "username": "operator2",
    "role": "admin"
  }
}
```

**Errors**

| Code | Condition |
|---|---|
| `400` | Invalid role, or demotion would remove the last active admin |
| `401` | Not authenticated |
| `403` | Not an admin |
| `404` | Target user not found |

---

## 14. RAG Evaluation Endpoints

> **New in this version.** Both endpoints require `require_Admin`.  
> Results are persisted in the `rag_evaluations` table via the `RAGEvaluation` model.

### 14.1 `POST /api/evaluate/run`

**Purpose:** Trigger the RAG evaluation pipeline and persist the result.  
**Authentication:** `require_Admin`

**Backend Processing**

1. Execute the evaluation routine against the configured test-case set.
2. Compute retrieval and generation quality metrics.
3. Persist a `RAGEvaluation` record with timestamp, scores, test-case count, model name, and per-case details.

**Response `200 OK`**

```json
{
  "success": true,
  "result": {
    "timestamp": "2026-11-03T10:00:00",
    "scores": {
      "context_precision": 0.85,
      "faithfulness": 0.90,
      "answer_relevancy": 0.88,
      "ground_truth_match": 0.82,
      "overall_score": 0.86
    },
    "num_test_cases": 20,
    "model_used": "openai/gpt-oss-20b"
  }
}
```

> **Note:** This is a long-running operation. The frontend should display a loading state and avoid duplicate submissions while a run is in progress.

---

### 14.2 `GET /api/evaluate/history`

**Purpose:** Retrieve historical RAG evaluation runs.  
**Authentication:** `require_Admin`

**Response `200 OK`**

```json
{
  "success": true,
  "history": [
    {
      "timestamp": "2026-11-03T10:00:00",
      "scores": {
        "context_precision": 0.85,
        "faithfulness": 0.90,
        "answer_relevancy": 0.88,
        "ground_truth_match": 0.82,
        "overall_score": 0.86
      },
      "num_test_cases": 20,
      "model_used": "openai/gpt-oss-20b",
      "details": []
    }
  ]
}
```

**Ordering:** Most recent first (the `timestamp` column is indexed).

**Metric Definitions**

| Metric | Meaning |
|---|---|
| `context_precision` | Proportion of retrieved context that is relevant |
| `faithfulness` | Degree to which the answer is grounded in retrieved context |
| `answer_relevancy` | How well the answer addresses the query |
| `ground_truth_match` | Agreement with the expected reference answer |
| `overall_score` | Aggregate quality score |

---

## 15. Frontend API Wrapper

All HTTP calls are centralized in `frontend/src/api/api.js`.

### 15.1 `authenticatedFetch()`

A shared wrapper that:

1. Issues the request with `credentials: "include"`.
2. If the response is `401`, calls `refreshAccessToken()` → `POST /auth/refresh`.
3. On successful refresh, **retries the original request once**.
4. On failed refresh, propagates the unauthorized state so `App.jsx` can return to the login screen.

```javascript
const response = await authenticatedFetch(`${API_BASE}/tickets`);

if (response.status === 401) {
  throw new Error("UNAUTHORIZED");
}
if (!response.ok) {
  throw new Error("Failed to fetch tickets.");
}
return await response.json();
```

The sentinel error string `"UNAUTHORIZED"` is used by the application layer to trigger session teardown.

### 15.2 Exported Functions

| Function | Notes |
|---|---|
| `loginRequest()` | Accepts identifier + password |
| `checkAuth()` | Returns user including `role` |
| `logoutRequest()` | Revokes refresh token, clears cookies |
| `registerRequest()` | Defaults new users to `role: "user"` |
| `forgotPasswordRequest()` | — |
| `resetPasswordRequest()` | — |
| `fetchTickets()` | Uses `authenticatedFetch` |
| `fetchNotifications()` | Uses `authenticatedFetch` |
| `acknowledgeTicket()` | — |
| `closeTicket(ticketNumber, resolutionData = null)` | **Updated** — optional resolution object |
| `reopenTicket()` | Requires priority + reason |
| `upgradeTicket()` | Handles both upgrade and downgrade |
| `troubleshootTicket()` | — |
| `analyzeTicketRca(ticketNumber)` | **New** |

### 15.3 `closeTicket()` Signature

```javascript
export async function closeTicket(ticketNumber, resolutionData = null) {
  const options = {
    method: "PUT"
  };

  if (resolutionData) {
    options.headers = { "Content-Type": "application/json" };
    options.body = JSON.stringify(resolutionData);
  }

  // authenticatedFetch adds credentials: "include" and handles 401 refresh/retry.
  // authenticatedFetch(`${API_BASE}/tickets/${encodeURIComponent(ticketNumber)}/close`, options)
}
```

This preserves backward compatibility: existing callers that pass only a ticket number continue to work unchanged.

---

## 16. API-to-Frontend Mapping

| Frontend Function | HTTP Endpoint |
|---|---|
| `loginRequest()` | `POST /auth/login` |
| `checkAuth()` | `GET /auth/me` |
| `logoutRequest()` | `POST /auth/logout` |
| `registerRequest()` | `POST /auth/register` |
| `forgotPasswordRequest()` | `POST /auth/forgot-password` |
| `resetPasswordRequest()` | `POST /auth/reset-password` |
| *(internal)* `refreshAccessToken()` | `POST /auth/refresh` |
| `fetchTickets()` | `GET /tickets` |
| `fetchNotifications()` | `GET /notifications` |
| `acknowledgeTicket()` | `PUT /tickets/{ticket_number}/acknowledge` |
| `closeTicket()` | `PUT /tickets/{ticket_number}/close` |
| `reopenTicket()` | `PUT /tickets/{ticket_number}/reopen` |
| `upgradeTicket()` | `PUT /tickets/{ticket_number}/priority` |
| `troubleshootTicket()` | `GET /troubleshoot/{ticket_number}` |
| `analyzeTicketRca()` | `GET /rca/{ticket_number}` |
| *(admin UI)* | `GET /auth/users` |
| *(admin UI)* | `PATCH /auth/users/{user_id}/role` |
| *(admin UI)* | `POST /api/evaluate/run` |
| *(admin UI)* | `GET /api/evaluate/history` |

---

## 17. API State Changes

### 17.1 Write Operations

| Endpoint | Database Effect |
|---|---|
| `POST /auth/register` | Creates `User` with `role = "user"` |
| `POST /auth/login` | Creates `RefreshToken` record; sets cookies |
| `POST /auth/refresh` | Issues new Access Token; may rotate refresh record |
| `POST /auth/logout` | Revokes `RefreshToken`; clears cookies |
| `POST /auth/forgot-password` | Creates `PasswordResetToken` |
| `POST /auth/reset-password` | Updates `User.password_hash`; consumes token |
| `PATCH /auth/users/{id}/role` | Updates `User.role` |
| `PUT /tickets/{n}/priority` | Updates `Ticket.priority`; creates `TicketEvent` |
| `PUT /tickets/{n}/close` | Updates status/`closed_at`; creates `TICKET_CLOSED` event; **optionally creates `HistoricalIncident` and refreshes the FAISS index** |
| `PUT /tickets/{n}/reopen` | Updates status/priority/`reopened_at`; creates `TICKET_REOPENED` event |
| `PUT /tickets/{n}/acknowledge` | Updates latest `TicketEvent.status` |
| `POST /api/evaluate/run` | Creates `RAGEvaluation` record |

### 17.2 Read-Only Operations

```text
GET /
GET /tickets
GET /notifications
GET /troubleshoot/{ticket_number}
GET /rca/{ticket_number}
GET /auth/me
GET /auth/users
GET /api/evaluate/history
```

> `GET /troubleshoot` and `GET /rca` perform LLM inference but do not mutate ticket state.

---

## 18. Error Handling

### 18.1 Standard Error Shape

FastAPI returns:

```json
{
  "detail": "Error description"
}
```

### 18.2 Status Code Reference

| Code | Meaning | Typical Cause |
|---|---|---|
| `200` | Success | Request completed |
| `400` | Bad Request | Invalid priority, empty reason, unchanged priority, invalid role |
| `401` | Unauthorized | Missing/expired Access Token, invalid credentials |
| `403` | Forbidden | Authenticated user lacks the admin role |
| `404` | Not Found | Ticket or user does not exist |
| `409` | Conflict | Invalid lifecycle transition (close an already-closed ticket, reopen an open ticket, RCA on ineligible ticket) |
| `429` | Too Many Requests | Auth rate limit exceeded |
| `500` | Server Error | Database, RAG, or LLM failure |

### 18.3 Frontend Error Strategy

```text
401 -> attempt refresh -> retry once -> if still 401, force logout
403 -> show permission-denied toast
404 -> show not-found toast
409 -> show validation/conflict toast with backend detail
429 -> show rate-limit toast
5xx -> show generic failure toast
```

---

## 19. Changelog

### Version 2.0 — November 03, 2026

**Added**
- JWT Access + Refresh token authentication (`POST /auth/refresh`).
- Role-based access control via `User.role` and the `require_Admin` dependency.
- Admin user management: `GET /auth/users`, `PATCH /auth/users/{user_id}/role`.
- Root Cause Analysis: `GET /rca/{ticket_number}` (closed `P1`/`P2` tickets only).
- RAG evaluation: `POST /api/evaluate/run`, `GET /api/evaluate/history`.
- Optional resolution questionnaire on `PUT /tickets/{n}/close`, persisted as a `HistoricalIncident` with `source = "questionnaire"`.
- Automatic FAISS index refresh after resolution capture (closed-loop learning).
- `resolutionSaved` flag in the close-ticket response.
- `role` field in register/login/me responses.

**Changed**
- Authentication moved from opaque server-side session cookies to JWT cookies.
- `closeTicket()` frontend signature now accepts an optional `resolutionData` argument.
- RAG knowledge source is PostgreSQL-backed rather than plain text files.
- Vite proxy extended to cover `/rca` and `/api`.

**Removed / Deprecated**
- `UserSession`-based opaque session validation as the primary auth mechanism.
- Text-file knowledge ingestion as the runtime RAG source (retained only as legacy migration input).

---

## Disclaimer

This API belongs to a personal/educational prototype. Alarm data, thresholds, team mappings, runbooks, diagnostic commands, ticketing workflow, and notification behavior are simulated for demonstration purposes. They must not be interpreted as Ericsson production architecture, Ericsson internal procedures, or approved network operational instructions.