# Alarm Automation — Code Flow Documentation

---

## Table of Contents

1. [Purpose and Scope](#1-purpose-and-scope)
2. [System Architecture at a Glance](#2-system-architecture-at-a-glance)
3. [Java Ticket-to-JSON Flow](#3-java-ticket-to-json-flow)
4. [Java Notification-to-JSON Flow](#4-java-notification-to-json-flow)
5. [JSON-to-PostgreSQL Migration](#5-json-to-postgresql-migration)
6. [Knowledge Migration](#6-knowledge-migration)
7. [FastAPI Application Startup](#7-fastapi-application-startup)
8. [React Application Startup](#8-react-application-startup)
9. [Authentication and Login](#9-authentication-and-login)
10. [Automatic Access-Token Refresh](#10-automatic-access-token-refresh)
11. [Ticket Retrieval](#11-ticket-retrieval)
12. [Notification Retrieval](#12-notification-retrieval)
13. [Notification Message Construction](#13-notification-message-construction)
14. [Dashboard Rendering](#14-dashboard-rendering)
15. [Ticket Priority Update](#15-ticket-priority-update)
16. [Ticket Closure and Resolution Capture](#16-ticket-closure-and-resolution-capture)
17. [Ticket Reopening](#17-ticket-reopening)
18. [Notification Acknowledgement](#18-notification-acknowledgement)
19. [AI Troubleshooting and RAG](#19-ai-troubleshooting-and-rag)
20. [Root Cause Analysis](#20-root-cause-analysis)
21. [RAG Evaluation](#21-rag-evaluation)
22. [Admin User Management](#22-admin-user-management)
23. [Password Reset](#23-password-reset)
24. [Frontend API Error Handling](#24-frontend-api-error-handling)
25. [Sidebar and Page Navigation](#25-sidebar-and-page-navigation)
26. [Frontend State and Backend State](#26-frontend-state-and-backend-state)
27. [Ticket Lifecycle](#27-ticket-lifecycle)
28. [End-to-End API Request Example](#28-end-to-end-api-request-example)
29. [File Responsibility Map](#29-file-responsibility-map)
30. [Important Runtime Characteristics](#30-important-runtime-characteristics)
31. [Items Requiring Source-Code Verification](#31-items-requiring-source-code-verification)
32. [Changelog](#32-changelog)

---

## 1. Purpose and Scope

This document explains how the Alarm Automation application is structured and how its main data and request flows move through the system.

It covers:

- Java ticket and notification generation.
- JSON serialization.
- Initial JSON-to-PostgreSQL migration.
- Migration of legacy knowledge content into PostgreSQL.
- FastAPI startup and API request handling.
- React application startup and API integration.
- JWT authentication using access and refresh tokens.
- Role-based access control (RBAC).
- Ticket retrieval and lifecycle operations.
- Event-derived notification retrieval and acknowledgement.
- RAG-based troubleshooting.
- Root Cause Analysis (RCA).
- RAG evaluation.
- Admin user management.
- Password reset.
- Frontend state updates and error handling.

### 1.1 High-level separation

The application has two different data paths:

**Initial data preparation**

```text
Java application
      |
      v
JSON files
      |
      v
Migration scripts
      |
      v
PostgreSQL
```

**Normal application runtime**

```text
React frontend
      |
      v
Frontend API layer
      |
      v
FastAPI backend
      |
      v
PostgreSQL and AI/RAG services
```

The JSON files are an intermediate input to the migration process. The documented runtime API reads application data from PostgreSQL rather than directly querying the original JSON files.

---

## 2. System Architecture at a Glance

### 2.1 Data preparation and migration

```text
Java ticket processing
      |
      v
ticketJsonWriter.java
      |
      v
output/tickets.json

Java notification processing
      |
      v
notificationJsonWriter.java
      |
      v
output/notifications.json

Legacy knowledge files
      |
      v
migrate_knowledge.py

tickets.json + notifications.json
      |
      v
migrate_json_to_db.py
      |
      v
SQLAlchemy
      |
      v
PostgreSQL
```

The ticket/notification migration and knowledge migration are separate processes. They should not be represented as one script or one migration operation.

### 2.2 Application runtime

```text
Browser
   |
   v
React application
   |
   v
frontend/src/api/api.js
   |
   v
HTTP request
   |
   v
FastAPI
   |
   +---- Authentication / authorization
   |
   +---- Ticket and notification logic
   |
   +---- Troubleshooting / RAG
   |
   +---- RCA
   |
   +---- RAG evaluation
   |
   v
PostgreSQL and initialized AI resources
```

### 2.3 Main technology responsibilities

| Technology | Responsibility |
|---|---|
| Java | Generates ticket and notification JSON data |
| Gson | Serializes Java objects into JSON |
| Python migration scripts | Import JSON and legacy knowledge into PostgreSQL |
| FastAPI | Exposes backend HTTP endpoints |
| SQLAlchemy | Maps Python objects to relational database records |
| PostgreSQL | Stores application records and knowledge data |
| FAISS | Supports vector similarity retrieval in the documented RAG pipeline |
| Reranker | Reorders retrieved candidates by relevance |
| Groq-hosted LLM | Generates AI responses in the documented troubleshooting flow |
| React | Renders the user interface and manages UI state |
| `api.js` | Centralizes frontend HTTP calls and authentication refresh handling |

---

## 3. Java Ticket-to-JSON Flow

The ticket JSON writer is documented as:

`ticketJsonWriter.java`

### 3.1 Input

The writer receives:

- A list of Java `ticket` objects.
- A destination file path.

The documented method is:

```java
writeTickets(...)
```

### 3.2 Execution flow

```text
List<ticket>
      |
      v
writeTickets(...)
      |
      v
Create destination File
      |
      v
Create parent directory if required
      |
      v
Open FileWriter
      |
      v
Serialize ticket list using Gson
      |
      v
Write JSON file
```

The supplied project documentation states that Gson is used for serialization with pretty printing. The writer therefore uses a JSON library rather than manually constructing JSON strings.

### 3.3 Output

The documented output file is:

```text
output/tickets.json
```

The JSON contains the serialized ticket records. The exact property names and values depend on the Java `ticket` class and the Gson configuration.

---

## 4. Java Notification-to-JSON Flow

The notification JSON writer is documented as:

`notificationJsonWriter.java`

Notification generation has an additional message-construction step before serialization.

### 4.1 Execution flow

```text
List<ticket>
      |
      v
notificationJsonWriter
      |
      v
notificationGenerator.buildMessage(ticket)
      |
      v
Create notification Map
      |
      v
Add notification properties
      |
      v
Collect notification maps
      |
      v
Serialize collection using Gson
      |
      v
Write notifications JSON file
```

### 4.2 Documented notification properties

The uploaded code-flow document identifies these properties:

- `ticketNumber`
- `assignedTeam`
- `message`
- `status`
- `eventType`
- `timestamp`
- `priority`
- `alarmType`
- `node`

The documented initial values are:

| Property | Initial value |
|---|---|
| `status` | `PENDING` |
| `eventType` | `TICKET_CREATED` |

These describe the initial JSON notification records. They should not be confused with the later status of a database `TicketEvent`.

### 4.3 Output

```text
output/notifications.json
```

This file is an input to the initial ticket/event migration process. It is not the documented runtime notification store.

---

## 5. JSON-to-PostgreSQL Migration

The ticket and notification migration is documented in:

`migrate_json_to_db.py`

The script uses the SQLAlchemy database layer and the `Team`, `Ticket`, and `TicketEvent` models.

### 5.1 Entry point

The uploaded document shows the script being run directly:

```python
if __name__ == "__main__":
    migrate()
```

The migration function is therefore invoked when the script is executed as the main program.

### 5.2 Input files

The documented input paths are:

```text
output/tickets.json
output/notifications.json
```

The exact path resolution behavior (working-directory-relative or script-relative) must be confirmed in the migration script.

### 5.3 Migration sequence

The uploaded document describes this order:

1. Load ticket JSON.
2. Load notification JSON.
3. Create a database session.
4. Resolve or create teams.
5. Resolve or create tickets.
6. Process notification records as ticket events.
7. Commit the database session.
8. Roll back on an exception and close the session.

The exact exception-handling scope and whether all operations are enclosed in one transaction must be checked in the script.

### 5.4 Team migration

The migration extracts the unique `assignedTeam` values from ticket data.

```text
Ticket JSON records
      |
      v
Extract assignedTeam values
      |
      v
Determine unique team names
      |
      v
For each team name
      |
      +---- Team exists? ---- Yes ----> Reuse existing Team
      |
      +---- Team exists? ---- No -----> Create Team
      |
      v
Keep team-name-to-Team mapping
```

The resulting mapping is used when assigning a team to a migrated ticket.

### 5.5 Ticket migration

For each ticket JSON record, the migration looks up the database ticket using its ticket number.

```text
Ticket JSON record
      |
      v
Find Ticket by ticket_number
      |
      +---- Found ----> Reuse existing Ticket
      |
      +---- Not found -> Create Ticket
      |
      v
Keep ticketNumber-to-Ticket mapping
```

The supplied document describes the lookup-and-create behavior. It does not establish that every field of an already-existing ticket is updated from JSON. Do not assume that the migration is a full synchronization operation without checking the implementation.

### 5.6 Ticket field mapping

The documented mapping for a newly created ticket is:

| JSON property | SQLAlchemy field |
|---|---|
| `ticketNumber` | `ticket_number` |
| `node` | `node` |
| `alarmType` | `alarm_type` |
| `occurrenceCount` | `occurrence_count` |
| `usersImpacted` | `users_impacted` |
| `severity` | `severity` |
| `thresholdBreached` | `threshold_breached` |
| `impactLevel` | `impact_level` |
| `priority` | `priority` |
| `assignedTeam` | `assigned_team_id`, resolved through `Team` |
| `status` | `status` |
| `reason` | `reason` |
| `createdAt` | `created_at` |
| `closedAt` | `closed_at` |
| `reopenedAt` | `reopened_at` |

The original document does not list an `updatedAt` mapping in this migration section. Whether that field is imported or left to a database/model default must be checked in the migration code.

### 5.7 Notification-to-event migration

The migration processes the notification JSON after processing tickets.

The documented flow is:

```text
Notification JSON record
      |
      v
Resolve ticket using ticketNumber
      |
      +---- Ticket not found ----> Skip event
      |
      v
Parse timestamp
      |
      v
Build event identity
(ticket_id, event_type, timestamp)
      |
      v
Does matching event already exist?
      |
      +---- Yes ----> Skip duplicate
      |
      +---- No -----> Create TicketEvent
      |
      v
Continue processing
```

The uploaded document states that existing event identities are loaded using:

`(ticket_id, event_type, timestamp)`

This is the documented duplicate-check key. It does not, by itself, prove that a database-level unique constraint exists for the same fields.

### 5.8 TicketEvent fields

The document identifies these event fields:

- `ticket_id`
- `event_type`
- `previous_priority`
- `new_priority`
- `priority`
- `reason`
- `timestamp`

The exact mapping from every notification JSON property to a `TicketEvent` field should be checked in `migrate_json_to_db.py`.

### 5.9 Transaction handling

The uploaded document states that the migration commits after processing and rolls back when an exception occurs, then closes the database session.

Conceptually:

```text
Migration operations
      |
      v
Commit
      |
      +---- Success ----> Close session
      |
      +---- Exception --> Roll back --> Close session
```

Whether the script commits once for the entire migration or at intermediate points must be confirmed from the actual code.

---

## 6. Knowledge Migration

The legacy knowledge migration is documented in:

`migrate_knowledge.py`

This is separate from `migrate_json_to_db.py`.

### 6.1 Documented input files

```text
knowledge/telecom_runbooks.txt
knowledge/shell_commands.txt
knowledge/historical_incidents.txt
```

These files contain legacy knowledge content used to populate the PostgreSQL knowledge tables.

### 6.2 Documented processing flow

```text
Legacy knowledge text files
      |
      v
Read and parse content
      |
      +---- Runbook / command-reference content
      |              |
      |              v
      |      KnowledgeDocument records
      |
      +---- Historical incident content
                     |
                     v
             HistoricalIncident records
      |
      v
PostgreSQL
```

### 6.3 Documented database records

The uploaded document identifies:

**`KnowledgeDocument`**
- `source_type`
- `title`
- `alarm_type`
- `content`

**`HistoricalIncident`**
- Stores historical incident details.

The exact parser rules, field mapping, duplicate handling, and transaction behavior are not fully described in the uploaded code-flow document. Those details should be taken from `migrate_knowledge.py` and the SQLAlchemy models rather than inferred.

### 6.4 Migration counts

The previous document listed six runbooks, six command references, and six historical incidents as imported.

Those are dataset-specific counts, not guaranteed behavior of the migration script. They are intentionally not presented as fixed migration output in this version.

---

## 7. FastAPI Application Startup

The backend entry point is documented as:

`backend/main.py`

### 7.1 Application setup

The uploaded document describes the creation of a FastAPI application and configuration of CORS middleware.

The listed allowed origins are:

```text
http://localhost:5173
http://127.0.0.1:5173
http://localhost:5500
http://127.0.0.1:5500
```

The authentication router is registered with the application.

### 7.2 Startup initialization

The previous document describes a startup handler that initializes:

- The vector store using `_build_vector_store()`.
- The reranker using `_get_reranker()`.
- The LLM using `_get_llm()`.

Conceptual flow:

```text
FastAPI application startup
      |
      v
Initialize/build vector store
      |
      v
Initialize reranker
      |
      v
Initialize LLM client/resource
      |
      v
Application serves requests
```

The exact startup mechanism (lifespan handler or startup event) and whether each resource is loaded eagerly, lazily, or cached must be confirmed in the current `main.py` and `rag.py`.

### 7.3 Request handling

Once the application is running, an incoming request is routed to its endpoint. Protected endpoints invoke authentication dependencies before executing their business logic.

```text
HTTP request
      |
      v
FastAPI route matching
      |
      v
Authentication / authorization dependency
      |
      v
Endpoint logic
      |
      v
SQLAlchemy and/or AI service
      |
      v
HTTP response
```

---

## 8. React Application Startup

The main React application component is documented as:

`frontend/src/App.jsx`

### 8.1 Application-level state

The uploaded document identifies state categories for:

- Authentication and current user.
- Tickets and notifications.
- Loading and backend status.
- Search and filters.
- Theme.
- Sidebar and active page.
- Refresh configuration.
- Modal state.
- Troubleshooting data.
- Reopen data.
- Toasts.

These are categories of application state, not a complete list of verified React state variable names.

### 8.2 Authentication check on startup

The uploaded document describes an initial authentication check through:

```text
checkAuthentication()
      |
      v
checkAuth()
      |
      v
GET /auth/me
```

The API request is sent through the frontend API layer. If the request succeeds, the application receives the current user's public information, including the role.

Conceptually:

```text
App.jsx mounts
      |
      v
Check current authentication
      |
      v
GET /auth/me
      |
      v
Backend validates access token
      |
      +---- Valid user ----> Set authenticated user state
      |
      +---- Invalid session -> Show login state
```

If the access token has expired, the frontend's automatic refresh behavior may run before the application treats the session as unauthenticated.

### 8.3 Initial application data

After authentication is established, the frontend retrieves application data through its API functions, including ticket and notification data.

The exact effect dependencies, call ordering, polling intervals, and loading-state transitions should be confirmed in `App.jsx`.

---

## 9. Authentication and Login

The application uses JWT access and refresh tokens transported through HTTP-only cookies.

### 9.1 Login request

The frontend calls:

```text
loginRequest(identifier, password)
```

The backend endpoint is:

```text
POST /auth/login
```

The documented request body is:

```json
{
  "identifier": "operator",
  "password": "StrongPassword123!"
}
```

The identifier can be a username or email address according to the authentication documentation.

### 9.2 Backend login flow

```text
Login form
      |
      v
loginRequest(identifier, password)
      |
      v
POST /auth/login
      |
      v
Apply login rate limit
      |
      v
Find user and verify password
      |
      +---- Invalid credentials ---> Reject login
      |
      v
Create access JWT
      |
      v
Create refresh JWT
      |
      v
Hash and store refresh-token record
      |
      v
Set HTTP-only token cookies
      |
      v
Return public user information
      |
      v
Frontend updates authenticated state
```

The exact order of rate-limit checks, attempt recording, and counter reset must be confirmed in `auth.py` and `security.py`.

### 9.3 Registration flow

The frontend calls:

```text
registerRequest(...)
```

The backend endpoint is:

```text
POST /auth/register
```

The documented processing is:

1. Apply registration rate limiting.
2. Validate the registration fields.
3. Check username and email uniqueness.
4. Hash the password.
5. Create the user with the default `user` role.
6. Return the new user's public information.

Conceptually:

```text
Registration form
      |
      v
registerRequest(...)
      |
      v
POST /auth/register
      |
      v
Rate-limit and input validation
      |
      v
Check username/email uniqueness
      |
      v
Hash password
      |
      v
Create User(role="user")
      |
      v
Return user information
```

Registration should not be described as automatically logging the user in unless the backend also issues authentication cookies in the registration handler. The supplied documentation does not establish that behavior.

### 9.4 Logout flow

The frontend calls:

```text
logoutRequest()
```

The backend endpoint is:

```text
POST /auth/logout
```

The documented flow is:

```text
User selects logout
      |
      v
logoutRequest()
      |
      v
POST /auth/logout
      |
      v
Backend reads refresh-token cookie
      |
      v
Hash token and locate stored record
      |
      v
Revoke matching refresh-token record
      |
      v
Clear access and refresh cookies
      |
      v
Frontend clears authenticated state
```

Cookie deletion and refresh-token revocation are separate actions. Clearing browser cookies alone does not revoke a token record in the database.

---

## 10. Automatic Access-Token Refresh

The frontend API layer implements automatic refresh when a request returns `401`.

### 10.1 Frontend flow

```text
Protected API call
      |
      v
authenticatedFetch(url, options)
      |
      v
Send request with credentials included
      |
      v
Inspect HTTP status
      |
      +---- Not 401 ----> Return response
      |
      +---- 401 --------> Attempt token refresh
                              |
                              v
                       POST /auth/refresh
                              |
                              v
                       Refresh successful?
                         /         \
                       Yes          No
                        |            |
                        v            v
                 Retry original   Treat session
                 request once     as unauthorized
```

### 10.2 Backend refresh flow

The documented endpoint is:

```text
POST /auth/refresh
```

The backend:

1. Reads the refresh-token cookie.
2. Validates the JWT signature and expiry.
3. Checks that the token type is `refresh`.
4. Hashes the token and finds its database record.
5. Checks that the record exists and is not revoked.
6. Checks the stored expiry.
7. Loads the associated user and checks that the account is active.
8. Creates a new access token.
9. Sets the access-token cookie.
10. Returns a response.

The separate API documentation records this response:

```json
{
  "message": "Token refreshed"
}
```

The supplied documents do not establish that the refresh token itself is rotated on every refresh. This flow therefore describes issuance of a new access token, not guaranteed refresh-token rotation.

### 10.3 Retry behavior

The original protected request is retried once after successful refresh. A failed refresh must not cause an infinite retry loop.

---

## 11. Ticket Retrieval

The frontend API function is:

```text
fetchTickets()
```

The backend endpoint is:

```text
GET /tickets
```

### 11.1 Request flow

```text
App.jsx
   |
   v
fetchTickets()
   |
   v
authenticatedFetch(GET /tickets)
   |
   v
FastAPI route
   |
   v
get_current_user()
   |
   v
Database session
   |
   v
Query Ticket records
   |
   v
Convert records to response objects
   |
   v
Return JSON
   |
   v
Frontend parses response
   |
   v
Update tickets state
```

### 11.2 Response data

The documented ticket response uses frontend-facing property names such as:

- `ticketNumber`
- `node`
- `alarmType`
- `occurrenceCount`
- `usersImpacted`
- `severity`
- `thresholdBreached`
- `impactLevel`
- `priority`
- `assignedTeam`
- `status`
- `reason`
- `createdAt`
- `updatedAt`
- `closedAt`
- `reopenedAt`

The backend maps database fields into the API response representation. The frontend consumes that representation rather than querying PostgreSQL directly.

---

## 12. Notification Retrieval

The frontend API function is:

```text
fetchNotifications()
```

The backend endpoint is:

```text
GET /notifications
```

The supplied API documentation describes notifications as projections of `TicketEvent` records rather than records stored in a separate notification table.

### 12.1 Request flow

```text
React application
      |
      v
fetchNotifications()
      |
      v
authenticatedFetch(GET /notifications)
      |
      v
FastAPI
      |
      v
get_current_user()
      |
      v
Query TicketEvent records
      |
      v
Resolve associated Ticket data
      |
      v
Construct notification response objects
      |
      v
Return JSON list
      |
      v
Update React notifications state
```

### 12.2 Important distinction

There are two different representations:

| Representation | Purpose |
|---|---|
| Initial `notifications.json` records | Input to the migration process |
| Runtime notification response | Constructed by the backend from database ticket events |

The runtime notification list should therefore be understood as an event-derived API response, not as a direct read of `output/notifications.json`.

---

## 13. Notification Message Construction

The backend constructs a human-readable message based on the event type.

The supplied document records these message formats:

| Event type | Documented message |
|---|---|
| `TICKET_CREATED` | `New {priority} ticket created for {alarm_type} on {node}` |
| `PRIORITY_UPGRADE` | `Ticket upgraded from {previous_priority} to {new_priority}` |
| `PRIORITY_DOWNGRADE` | `Ticket downgraded from {previous_priority} to {new_priority}` |
| `TICKET_CLOSED` | `Ticket closed` |
| `TICKET_REOPENED` | `Ticket reopened` with current priority, reason, and timestamp information |

The message is returned by the backend. The frontend displays the returned message rather than needing to reconstruct it from the raw event fields.

The exact punctuation, newline formatting, fallback behavior, and handling of missing event fields should be checked in the notification endpoint implementation.

---

## 14. Dashboard Rendering

The main application component selects which page to render based on the active-page state.

When the dashboard page is active, the uploaded document identifies these components:

- `SummaryCards`
- `TicketTable`

### 14.1 Data flow

```text
Ticket API response
      |
      v
React tickets state
      |
      v
Search / filtering / sorting
      |
      v
Summary and table components
      |
      v
Dashboard display
```

### 14.2 Documented filter fields

The previous document identifies these ticket properties as filter criteria:

- `node`
- `alarmType`
- `severity`
- `impactLevel`
- `priority`
- `assignedTeam`
- `status`

It also identifies these searchable properties:

- `ticketNumber`
- `node`
- `alarmType`
- `assignedTeam`
- `severity`
- `priority`
- `impactLevel`
- `status`

### 14.3 Sorting

The previous document identifies:

```text
getTicketActivityTime(ticket, notifications)
```

as the activity-time helper.

The exact sorting direction, tie-breaking behavior, and fallback timestamp should be verified in the frontend source.

---

## 15. Ticket Priority Update

The frontend API function is documented as:

```text
upgradeTicket(ticketNumber, newPriority)
```

The backend endpoint is:

```text
PUT /tickets/{ticket_number}/priority
```

### 15.1 Request body

```json
{
  "priority": "P1"
}
```

### 15.2 Backend flow

```text
Frontend priority action
      |
      v
upgradeTicket(ticketNumber, newPriority)
      |
      v
PUT /tickets/{ticket_number}/priority
      |
      v
get_current_user()
      |
      v
Validate requested priority
      |
      v
Find ticket
      |
      v
Check ticket lifecycle state
      |
      v
Compare old and new priority
      |
      v
Determine upgrade or downgrade event
      |
      v
Update Ticket.priority
      |
      v
Create TicketEvent
      |
      v
Commit database changes
      |
      v
Return response
```

### 15.3 Documented validations

The separate API documentation records these conditions:

- The priority must be one of `P1`, `P2`, `P3`, or `P4`.
- The ticket must exist.
- A closed ticket cannot have its priority changed through this endpoint.
- The new priority must differ from the existing priority.

### 15.4 Frontend update

After a successful response, the frontend updates or reloads the affected ticket data and refreshes notification data as implemented by the application.

Do not assume that every mutation uses the same local-update strategy; check the corresponding React handler.

---

## 16. Ticket Closure and Resolution Capture

The close endpoint is:

```text
PUT /tickets/{ticket_number}/close
```

The frontend API function is documented as:

```javascript
closeTicket(ticketNumber, resolutionData = null)
```

The endpoint supports a normal closure request and an optional resolution questionnaire.

### 16.1 Path A: Close without resolution details

The frontend calls:

```javascript
closeTicket(ticketNumber)
```

No questionnaire body is sent.

Conceptual flow:

```text
Operator selects Close
      |
      v
closeTicket(ticketNumber)
      |
      v
PUT /tickets/{ticket_number}/close
(no questionnaire body)
      |
      v
get_current_user()
      |
      v
Find ticket
      |
      v
Check that ticket is not already CLOSED
      |
      v
Set status = CLOSED
      |
      v
Set closed_at
      |
      v
Create TICKET_CLOSED event
      |
      v
Persist database changes
      |
      v
Return resolutionSaved = false
```

The separate API documentation states that no historical incident is created when no questionnaire is submitted.

### 16.2 Path B: Close with resolution details

The frontend calls:

```javascript
closeTicket(ticketNumber, resolutionData)
```

The documented questionnaire properties are:

```json
{
  "observedSymptoms": "...",
  "rootCause": "...",
  "actionsTaken": "...",
  "shellCommandsUsed": "...",
  "shellScriptUsed": "...",
  "resolution": "...",
  "verificationResults": "...",
  "escalation": "...",
  "additionalNotes": "..."
}
```

The backend flow described by the supplied API documentation is:

```text
Operator submits resolution questionnaire
      |
      v
closeTicket(ticketNumber, resolutionData)
      |
      v
PUT /tickets/{ticket_number}/close
      |
      v
get_current_user()
      |
      v
Find ticket and validate lifecycle state
      |
      v
Create HistoricalIncident linked to ticket
      |
      v
Set ticket status = CLOSED
      |
      v
Set closed_at
      |
      v
Create TICKET_CLOSED event
      |
      v
Persist changes
      |
      v
Refresh RAG vector-store data
      |
      v
Return resolutionSaved = true
```

The precise order of database commit and vector-store refresh is not stated consistently across the supplied documentation. It must be checked in the actual close endpoint. This document intentionally does not claim a definitive ordering.

### 16.3 Resolution field mapping

| Request property | HistoricalIncident field |
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

### 16.4 Closed-loop learning

The intended data relationship is:

```text
Ticket closed with resolution data
      |
      v
HistoricalIncident stored in PostgreSQL
      |
      v
RAG knowledge/vector data refreshed
      |
      v
Incident becomes available to later retrieval
      |
      +----> Troubleshooting
      |
      +----> Root Cause Analysis
```

The historical incident is the persisted resolution record. The vector store is the retrieval representation used by the RAG pipeline. They are not the same thing.

### 16.5 Response

The separate API documentation records a response containing:

- `message`
- `ticketNumber`
- `status`
- `closedAt`
- `resolutionSaved`

`resolutionSaved` indicates whether resolution data was saved according to the documented API behavior.

---

## 17. Ticket Reopening

The frontend API function is documented as:

```text
reopenTicket(ticketNumber, priority, reason)
```

The backend endpoint is:

```text
PUT /tickets/{ticket_number}/reopen
```

### 17.1 Request body

```json
{
  "priority": "P1",
  "reason": "Alarm condition has returned on the same node."
}
```

### 17.2 Backend flow

```text
Operator selects Reopen
      |
      v
reopenTicket(ticketNumber, priority, reason)
      |
      v
PUT /tickets/{ticket_number}/reopen
      |
      v
get_current_user()
      |
      v
Validate priority and reason
      |
      v
Find ticket
      |
      v
Check that current status is CLOSED
      |
      v
Set status = OPEN
      |
      v
Update priority
      |
      v
Set reopened_at
      |
      v
Create TICKET_REOPENED event
      |
      v
Commit database changes
      |
      v
Return response
```

### 17.3 Documented validations

- The ticket must exist.
- The ticket must currently be closed.
- The priority must be valid.
- The reason must not be empty.

After a successful response, the frontend updates or reloads the ticket and notification state.

---

## 18. Notification Acknowledgement

The frontend API function is:

```text
acknowledgeTicket(ticketNumber)
```

The endpoint is:

```text
PUT /tickets/{ticket_number}/acknowledge
```

### 18.1 Backend flow

The supplied API documentation describes acknowledgement of the latest ticket event.

```text
User acknowledges notification
      |
      v
acknowledgeTicket(ticketNumber)
      |
      v
PUT /tickets/{ticket_number}/acknowledge
      |
      v
get_current_user()
      |
      v
Find ticket and its latest event
      |
      v
Check event status
      |
      +---- Already ACKNOWLEDGED or RESOLVED
      |          |
      |          v
      |     Do not change status
      |
      +---- Other status
                 |
                 v
          Set status = ACKNOWLEDGED
                 |
                 v
          Commit database change
      |
      v
Return acknowledgement response
```

### 18.2 Important distinction

Acknowledgement updates the status of the latest `TicketEvent` associated with the ticket. It does not mean that the ticket itself has been closed or resolved.

The frontend can then fetch notifications again to display the updated event status.

---

## 19. AI Troubleshooting and RAG

Troubleshooting is initiated from the ticket interface.

The frontend API function is:

```text
troubleshootTicket(ticketNumber)
```

The backend endpoint is:

```text
GET /troubleshoot/{ticket_number}
```

### 19.1 Request flow

```text
User opens Troubleshooting for a ticket
      |
      v
troubleshootTicket(ticketNumber)
      |
      v
GET /troubleshoot/{ticket_number}
      |
      v
get_current_user()
      |
      v
Find ticket in PostgreSQL
      |
      +---- Not found ----> Return 404
      |
      v
Extract ticket attributes
      |
      v
Call troubleshoot_alarm(...)
      |
      v
RAG retrieval and generation
      |
      v
Construct API response
      |
      v
Return recommendation and historical incidents
      |
      v
Display result in troubleshooting UI
```

### 19.2 Ticket context

The separate API documentation identifies these ticket attributes as troubleshooting context:

- `alarmType`
- `node`
- `occurrenceCount`
- `usersImpacted`
- `severity`
- `thresholdBreached`
- `impactLevel`
- `priority`
- `assignedTeam`

### 19.3 Documented RAG stages

The supplied documentation describes the troubleshooting RAG process using these stages:

1. Retrieve knowledge from PostgreSQL-backed knowledge data.
2. Apply vector retrieval using FAISS.
3. Use Maximum Marginal Relevance (MMR) to select relevant and diverse candidates.
4. Rerank retrieved candidates.
5. Resolve parent-level context where applicable.
6. Pass the selected context to the LLM.
7. Generate the troubleshooting recommendation.

Conceptual flow:

```text
Ticket context
      |
      v
Knowledge retrieval
      |
      v
FAISS similarity search
      |
      v
MMR selection
      |
      v
Reranking
      |
      v
Parent/context resolution
      |
      v
Groq LLM
      |
      v
Troubleshooting recommendation
```

The exact retrieval filters, chunking strategy, top-k values, MMR parameters, reranker model, and prompt construction must be documented from `rag.py` and its supporting modules. They are not specified in enough detail in the uploaded code-flow document.

### 19.4 Response shape

The separate API documentation records these response properties:

```json
{
  "alarmType": "HIGH_CPU",
  "recommendation": "Troubleshooting recommendation...",
  "historicalIncidents": []
}
```

The internal retrieved context is not exposed as a response field according to the API documentation.

### 19.5 Error behavior

The API documentation records `404` for a missing ticket and `500` for a RAG/LLM backend failure. The exact exception logging and client-facing error message should be checked in the endpoint implementation.

---

## 20. Root Cause Analysis

The RCA endpoint is:

```text
GET /rca/{ticket_number}
```

The frontend API function is:

```text
analyzeTicketRca(ticketNumber)
```

### 20.1 Eligibility

The separate API documentation records two eligibility conditions:

| Condition | Requirement |
|---|---|
| Ticket status | `CLOSED` |
| Ticket priority | `P1` or `P2` |

An ineligible ticket receives a conflict response (`409`) according to the API documentation.

### 20.2 Backend flow

```text
User requests RCA
      |
      v
analyzeTicketRca(ticketNumber)
      |
      v
GET /rca/{ticket_number}
      |
      v
get_current_user()
      |
      v
Find ticket
      |
      +---- Not found ----> 404
      |
      v
Check status == CLOSED
      |
      +---- No -----------> 409
      |
      v
Check priority is P1 or P2
      |
      +---- No -----------> 409
      |
      v
Call analyze_root_cause(...)
      |
      v
Use ticket and associated resolution/history context
      |
      v
Generate RCA analysis
      |
      v
Return response
```

### 20.3 Response

The separate API documentation records this response shape:

```json
{
  "ticketNumber": "AL-10001",
  "alarmType": "HIGH_CPU",
  "analysis": "Generated root cause analysis..."
}
```

### 20.4 State behavior

RCA generation is an analysis operation. The API documentation states that it does not mutate ticket state.

Whether the implementation writes separate audit or diagnostic records must be checked in `rca.py` and the endpoint.

---

## 21. RAG Evaluation

The evaluation endpoints are documented as admin-only operations.

The implementation file is:

`evaluate.py`

### 21.1 Trigger evaluation

Endpoint:

```text
POST /api/evaluate/run
```

Documented flow:

```text
Admin opens RAG Evaluation page
      |
      v
POST /api/evaluate/run
      |
      v
require_Admin()
      |
      v
Run evaluation routine
      |
      v
Evaluate configured test cases
      |
      v
Calculate metrics
      |
      v
Create RAGEvaluation database record
      |
      v
Return evaluation result
```

### 21.2 Documented metrics

- `context_precision`
- `faithfulness`
- `answer_relevancy`
- `ground_truth_match`
- `overall_score`

The exact formulas, evaluation framework, test-case loading method, model configuration, and metric aggregation must be confirmed in `evaluate.py`.

### 21.3 Evaluation history

Endpoint:

```text
GET /api/evaluate/history
```

Documented flow:

```text
Admin opens evaluation history
      |
      v
GET /api/evaluate/history
      |
      v
require_Admin()
      |
      v
Query RAGEvaluation records
      |
      v
Order by timestamp descending
      |
      v
Return history
```

### 21.4 Persistence

The separate API documentation identifies `RAGEvaluation` as the model used to persist evaluation runs. The history endpoint reads the saved records rather than rerunning the evaluation.

---

## 22. Admin User Management

The admin user-management endpoints require the admin authorization dependency.

### 22.1 List users

Endpoint:

```text
GET /auth/users
```

Documented flow:

```text
Admin UI
      |
      v
GET /auth/users
      |
      v
require_Admin()
      |
      v
Query User records
      |
      v
Return public user information
```

The separate API documentation identifies fields including:

- `id`
- `fullName`
- `username`
- `email`
- `role`
- `isActive`

### 22.2 Update a user's role

Endpoint:

```text
PATCH /auth/users/{user_id}/role
```

Request body:

```json
{
  "role": "admin"
}
```

Documented flow:

```text
Admin selects a new role
      |
      v
PATCH /auth/users/{user_id}/role
      |
      v
require_Admin()
      |
      v
Validate requested role
      |
      v
Find target user
      |
      +---- Not found ----> 404
      |
      v
Check last-active-admin protection
      |
      +---- Would remove last admin ---> Reject
      |
      v
Update User.role
      |
      v
Commit
      |
      v
Return updated role
```

Supported roles are documented as `admin` and `user`.

The last-admin protection prevents a role change that would leave the application without an active administrator, according to the supplied API documentation.

---

## 23. Password Reset

Password reset uses two endpoints.

### 23.1 Forgot password

Endpoint:

```text
POST /auth/forgot-password
```

Request body:

```json
{
  "email": "operator@example.com"
}
```

Documented flow:

```text
Forgot-password UI
      |
      v
forgotPasswordRequest(email)
      |
      v
POST /auth/forgot-password
      |
      v
Apply password-reset rate limit
      |
      v
Look up account
      |
      +---- Account not found
      |          |
      |          v
      |     Return generic response
      |
      +---- Account found
                 |
                 v
          Generate reset token
                 |
                 v
          Hash token
                 |
                 v
          Store token hash and expiry
                 |
                 v
          Generate reset URL
                 |
                 v
          Development delivery: print URL to backend console
                 |
                 v
          Return generic response
```

The supplied authentication documentation states that an external email service is not integrated and that the reset URL is printed to the backend console in development.

### 23.2 Reset password

Endpoint:

```text
POST /auth/reset-password
```

Request body:

```json
{
  "token": "<reset-token>",
  "new_password": "NewStrongPassword456!"
}
```

Documented flow:

```text
Reset-password UI
      |
      v
resetPasswordRequest(token, newPassword)
      |
      v
POST /auth/reset-password
      |
      v
Validate new password
      |
      v
Hash submitted reset token
      |
      v
Find matching PasswordResetToken
      |
      v
Check token validity, use status, and expiry
      |
      v
Update User.password_hash
      |
      v
Mark reset token as used
      |
      v
Invalidate refresh-token sessions if implemented
      |
      v
Commit changes
      |
      v
Return success response
```

The earlier authentication document states that all active refresh tokens are revoked after a password reset. This must be checked in the current handler before treating it as a verified behavior.

---

## 24. Frontend API Error Handling

Frontend API requests are centralized in:

`frontend/src/api/api.js`

### 24.1 Authentication failure and refresh

The documented behavior is:

```text
Protected request
      |
      v
authenticatedFetch()
      |
      v
Receive response
      |
      +---- Not 401 ----> Return response to API function
      |
      +---- 401 --------> Attempt POST /auth/refresh
                              |
                              +---- Refresh succeeds
                              |          |
                              |          v
                              |     Retry original request once
                              |
                              +---- Refresh fails
                                         |
                                         v
                                  Unauthorized session
```

### 24.2 Application-level handling

The previous documentation identifies `UNAUTHORIZED` as an error sentinel used by the frontend to signal that the session is no longer authenticated.

The intended application behavior is to clear or invalidate the frontend authentication state and return the user to the login experience.

The exact conversion from an HTTP `401` response to the `UNAUTHORIZED` error must be checked in `api.js`. It should not be assumed that every API function throws this sentinel in the same way.

### 24.3 Other errors

The separate API documentation identifies common status codes:

| Status | Meaning in the application |
|---|---|
| `400` | Invalid input or request |
| `401` | Authentication required or invalid |
| `403` | Authenticated user lacks permission |
| `404` | Requested ticket or user not found |
| `409` | Invalid lifecycle transition or RCA eligibility conflict |
| `429` | Rate limit exceeded |
| `500` | Backend, database, RAG, or LLM failure |

The frontend may display backend error details or a fallback message depending on the API function and UI handler.

---

## 25. Sidebar and Page Navigation

The main application maintains the active-page state and passes navigation behavior to the sidebar.

The uploaded document identifies these navigation targets:

- `dashboard`
- `notifications`
- `settings`
- `user-management` (admin-only)
- `rag-evaluation` (admin-only)

### 25.1 Conceptual navigation flow

```text
User selects sidebar item
      |
      v
Sidebar navigation callback
      |
      v
Parent application updates active page
      |
      v
React renders selected page
```

### 25.2 Admin navigation

Admin-only navigation items should be displayed conditionally based on the authenticated user's role.

This frontend visibility is a user-interface behavior. It does not replace backend authorization: the corresponding backend endpoints must still enforce `require_Admin`.

### 25.3 Sidebar collapse behavior

The earlier code-flow document stated that the sidebar collapsed state was persisted using local storage and that navigation only updated the active page.

Those are implementation-specific claims and are not retained as confirmed behavior here. The current `App.jsx` and `Sidebar.jsx` must be checked to establish:

- Whether collapse state is persisted.
- Whether navigation automatically closes the sidebar.
- Whether the behavior differs between desktop and mobile layouts.

---

## 26. Frontend State and Backend State

The application has two broad categories of state.

### 26.1 Backend-persisted state

The supplied documentation identifies these examples:

- Ticket status.
- Ticket priority.
- Ticket timestamps.
- Ticket events.
- User accounts and roles.
- Refresh-token records.
- Password-reset records.
- Historical incidents.
- Knowledge documents.
- RAG evaluation records.

These records are managed through FastAPI and PostgreSQL.

### 26.2 Frontend UI state

Examples include:

- Active page.
- Selected ticket.
- Active modal.
- Search term.
- Column filters.
- Theme.
- Sidebar state.
- Toast state.
- Loading state.
- Current form values.

These are managed by React. Some UI preferences may also be persisted by the frontend, but the exact persistence mechanism must be verified in the relevant component.

### 26.3 General mutation flow

```text
User action
      |
      v
React event handler
      |
      v
Frontend API function
      |
      v
authenticatedFetch()
      |
      v
FastAPI authentication / authorization
      |
      v
Endpoint business logic
      |
      v
PostgreSQL update
      |
      v
HTTP response
      |
      v
React updates or reloads state
      |
      v
UI re-renders
```

Not every operation follows a database mutation path. For example, troubleshooting and RCA primarily perform retrieval and generation rather than changing ticket lifecycle state.

---

## 27. Ticket Lifecycle

The documented ticket lifecycle includes creation/import, priority changes, closure, reopening, and event acknowledgement.

### 27.1 Initial ticket availability

```text
Java creates ticket data
      |
      v
tickets.json
      |
      v
migrate_json_to_db.py
      |
      v
PostgreSQL Ticket
      |
      v
GET /tickets
      |
      v
React dashboard
```

### 27.2 Priority change

```text
Ticket is OPEN
      |
      v
Priority update request
      |
      v
Ticket.priority updated
      |
      v
Priority event created
      |
      v
Event appears in notification response
```

### 27.3 Closure

```text
Ticket is OPEN
      |
      v
Close request
      |
      +---- Without resolution data
      |          |
      |          v
      |     Ticket closed and close event created
      |
      +---- With resolution data
                 |
                 v
          HistoricalIncident created
                 |
                 v
          RAG knowledge/vector data refreshed
```

### 27.4 Reopening

```text
Ticket is CLOSED
      |
      v
Reopen request with priority and reason
      |
      v
Ticket status becomes OPEN
      |
      v
Reopen timestamp and event recorded
```

### 27.5 Acknowledgement

```text
TicketEvent exists
      |
      v
Acknowledge request
      |
      v
Latest eligible event status becomes ACKNOWLEDGED
```

Acknowledgement changes the event/notification status. It does not itself change the ticket from `OPEN` to `CLOSED`.

---

## 28. End-to-End API Request Example

A dashboard ticket request illustrates the normal runtime request path.

```text
Browser
   |
   | GET /tickets
   v
frontend/src/api/api.js
   |
   v
authenticatedFetch()
   |
   v
Browser sends cookies
   |
   v
FastAPI route: GET /tickets
   |
   v
get_current_user()
   |
   v
SQLAlchemy database session
   |
   v
PostgreSQL query
   |
   v
Ticket records
   |
   v
FastAPI response serialization
   |
   v
JSON response
   |
   v
Frontend API function parses response
   |
   v
App.jsx updates tickets state
   |
   v
Filtering / sorting
   |
   v
TicketTable renders rows
```

If the access token is expired, the API wrapper may first call `/auth/refresh` and retry the original request once.

This request path is different from the initial JSON migration path. A normal `GET /tickets` request does not need to read `tickets.json`.

---

## 29. File Responsibility Map

The following map consolidates the file responsibilities described in the uploaded document. Exact function ownership should be checked against the current repository.

| File | Documented responsibility |
|---|---|
| `ticketJsonWriter.java` | Serializes Java ticket objects into JSON |
| `notificationJsonWriter.java` | Builds and serializes notification records |
| `notificationGenerator.java` | Constructs notification messages |
| `migrate_json_to_db.py` | Imports ticket and notification JSON into PostgreSQL |
| `migrate_knowledge.py` | Imports legacy knowledge content into PostgreSQL |
| `backend/main.py` | FastAPI application, API routes, and application setup |
| `backend/auth.py` | Authentication routes and admin user-management routes |
| `backend/security.py` | JWT, password hashing, rate limiting, and authentication dependencies |
| `backend/models.py` | SQLAlchemy database models |
| `backend/database.py` | Database engine/session configuration |
| `backend/rag.py` | Troubleshooting retrieval and generation logic |
| `backend/rca.py` | Root Cause Analysis logic |
| `backend/evaluate.py` | RAG evaluation logic |
| `frontend/src/api/api.js` | Frontend API functions and automatic token-refresh handling |
| `frontend/src/App.jsx` | Main React application state and page orchestration |
| `Notifications.jsx` | Notification display and acknowledgement UI, as identified by the previous document |
| `Sidebar.jsx` | Sidebar navigation UI |
| `MessageModal.jsx` | Generic message/error modal, as identified by the previous document |

---

## 30. Important Runtime Characteristics

### 30.1 JSON is an intermediate migration format

The documented data preparation path is:

```text
Java -> JSON -> migration script -> PostgreSQL
```

The documented runtime data path is:

```text
PostgreSQL -> FastAPI -> React
```

FastAPI does not use the original JSON files as its normal ticket query source according to the supplied architecture.

### 30.2 Notifications are derived from ticket events

The runtime `/notifications` endpoint is documented as reading `TicketEvent` records and constructing notification response objects.

The initial notification JSON file is used during migration; it is not the same as the runtime notification response.

### 30.3 Ticket operations create event history

Priority changes, closure, and reopening are documented as creating ticket events. Those events provide the history from which notifications are constructed.

### 30.4 Resolution capture feeds future knowledge retrieval

When resolution details are captured during ticket closure, the documented design creates a `HistoricalIncident`. The RAG knowledge/vector representation is then refreshed so the incident can be considered in later retrieval.

### 30.5 Troubleshooting and RCA are different operations

| Operation | Purpose | Ticket eligibility |
|---|---|---|
| Troubleshooting | Generate operational troubleshooting guidance using RAG | Ticket must exist; no closed P1/P2 restriction is documented |
| RCA | Generate root cause analysis for a significant completed incident | Closed ticket with priority P1 or P2 |

### 30.6 RAG evaluation is separate from troubleshooting

Troubleshooting generates a recommendation for a ticket. RAG evaluation runs a configured evaluation process and persists evaluation results. The evaluation endpoints are documented as admin-only.

### 30.7 Authentication and authorization are separate

`get_current_user` establishes the authenticated user. `require_Admin` adds an admin-role check for restricted endpoints.

Hiding an admin page in React is not a substitute for backend authorization.

### 30.8 Access-token refresh does not imply refresh-token rotation

The documented refresh endpoint issues a new access token after validating the refresh token. Refresh-token rotation should only be included in the architecture if the current backend actually replaces the refresh token.

### 30.9 AI generation is not a ticket lifecycle mutation

Troubleshooting and RCA return generated analysis. The separate API documentation states that these operations do not mutate ticket state.

---

## 31. Items Requiring Source-Code Verification

The uploaded code-flow document claims synchronization with multiple source files, but those source files were not included with the current upload. The following details therefore should not be represented as independently verified from this review.

| Area | Verify in | What to confirm |
|---|---|---|
| Java ticket serialization | `ticketJsonWriter.java` | Exact method signature, Gson configuration, output path, exception handling |
| Java notification construction | `notificationJsonWriter.java`, `notificationGenerator.java` | Exact fields, message formats, default status/event type |
| JSON migration paths | `migrate_json_to_db.py` | Working-directory behavior and missing-file handling |
| Team migration | `migrate_json_to_db.py` | Team lookup/create behavior and normalization |
| Ticket migration | `migrate_json_to_db.py` | Existing-ticket behavior, field updates, timestamp handling |
| Event deduplication | `migrate_json_to_db.py`, `models.py` | Duplicate key and database-level uniqueness |
| Migration transaction | `migrate_json_to_db.py` | Commit/rollback boundaries and partial-import behavior |
| Knowledge parsing | `migrate_knowledge.py` | Exact parsing rules, counts, duplicate handling, field mapping |
| FastAPI startup | `main.py` | Lifespan/startup mechanism and resource initialization |
| RAG resource loading | `rag.py`, `main.py` | Eager/lazy loading, caching, vector-store construction |
| React startup | `App.jsx` | Effects, call ordering, loading state, polling |
| Authentication | `auth.py`, `security.py` | Exact login, registration, logout, and refresh behavior |
| Token refresh | `api.js`, `auth.py` | Retry behavior, response message, refresh-token rotation |
| Ticket retrieval | `main.py`, `models.py` | Exact response serialization and team lookup |
| Notification construction | `main.py`, `models.py` | Event ordering, message text, event status mapping |
| Priority updates | `main.py` | Validation, event classification, transaction behavior |
| Ticket closure | `main.py`, `rag.py`, `models.py` | Questionnaire handling and exact commit/vector-refresh order |
| Ticket reopening | `main.py` | Required fields, lifecycle checks, event creation |
| Acknowledgement | `main.py` | Latest-event selection and status transitions |
| Troubleshooting | `main.py`, `rag.py` | Retrieval filters, MMR, reranker, prompt, output fields |
| RCA | `main.py`, `rca.py` | Eligibility checks, historical context, persistence behavior |
| Evaluation | `main.py`, `evaluate.py` | Test-case source, metric implementation, persistence |
| Admin management | `auth.py`, `main.py` | Role validation and last-admin protection |
| Password reset | `auth.py`, `security.py`, `models.py` | Token expiry, reuse prevention, refresh-session invalidation |
| Sidebar behavior | `App.jsx`, `Sidebar.jsx` | Collapse persistence and automatic close-on-navigation behavior |
| Frontend error handling | `api.js`, `App.jsx` | Exact `UNAUTHORIZED` propagation and user-facing error behavior |

This checklist is intentional. It separates the architecture documented by the supplied material from implementation details that require the actual source code.

---

## 32. Changelog

### Version 2.1 — November 03, 2026

**Corrected**
- Separated initial JSON migration from normal runtime API requests.
- Clarified the distinction between `notifications.json`, `TicketEvent`, and runtime notification responses.
- Separated ticket/notification migration from legacy knowledge migration.
- Clarified that the migration's existing-ticket behavior does not prove full record synchronization.
- Removed fixed knowledge-import counts as guaranteed script behavior.
- Clarified the distinction between `HistoricalIncident` records and their RAG/vector representation.
- Removed the unsupported assertion that refresh-token rotation occurs.
- Corrected the refresh response to the value recorded in the separate API documentation, while identifying source verification as necessary.
- Removed an unverified fixed sidebar persistence/close behavior.
- Distinguished ticket acknowledgement from ticket closure.
- Distinguished troubleshooting from RCA and RAG evaluation.
- Avoided asserting a definitive transaction/vector-refresh ordering where the supplied documents conflict.
- Added a source-code verification checklist.

**Retained**
- Java-to-JSON data preparation.
- Gson-based serialization as documented.
- JSON-to-PostgreSQL migration architecture.
- PostgreSQL-backed runtime API architecture.
- FastAPI and React responsibilities.
- JWT access/refresh authentication model.
- Ticket lifecycle, event, and notification concepts.
- Resolution capture and historical incident feedback into RAG.
- Troubleshooting, RCA, evaluation, and admin workflows.

---

## Disclaimer

This document describes the Alarm Automation prototype as represented by the supplied project documentation. Alarm data, thresholds, team mappings, runbooks, diagnostic commands, ticket workflows, and notification behavior are simulated for demonstration purposes. They must not be interpreted as Ericsson production architecture, Ericsson internal procedures, or approved network operational instructions.
