# Alarm Automation — Database Documentation

---

## Table of Contents

1. [Purpose and Scope](#1-purpose-and-scope)
2. [Database Architecture](#2-database-architecture)
3. [Database Connection Layer](#3-database-connection-layer)
4. [Database Session Lifecycle](#4-database-session-lifecycle)
5. [Database Tables Overview](#5-database-tables-overview)
6. [Table Definitions](#6-table-definitions)
7. [Entity Relationships](#7-entity-relationships)
8. [JSON-to-Database Migration](#8-json-to-database-migration)
9. [Knowledge Migration](#9-knowledge-migration)
10. [Runtime Database Operations](#10-runtime-database-operations)
11. [End-to-End Data Flow](#11-end-to-end-data-flow)
12. [Data Integrity, Transactions, and Operational Considerations](#12-data-integrity-transactions-and-operational-considerations)
13. [Items Requiring Source-Code Verification](#13-items-requiring-source-code-verification)
14. [Changelog](#14-changelog)

---

## 1. Purpose and Scope

This document describes the database design and persistence flow of the Alarm Automation application, based on the supplied database documentation.

The documented persistence stack is:

```text
PostgreSQL
    |
    v
SQLAlchemy
    |
    v
Python ORM models
    |
    v
FastAPI application and migration scripts
```

The supplied documentation identifies these implementation files:

| File | Responsibility described |
|---|---|
| `backend/database.py` | Loads environment configuration and creates the SQLAlchemy engine, session factory, and declarative base. |
| `backend/models.py` | Defines the SQLAlchemy ORM models. |
| `backend/migrate_json_to_db.py` | Imports ticket and notification data from JSON into PostgreSQL. |
| `migrate_knowledge.py` | Imports legacy knowledge text files into PostgreSQL. |

The document covers the ten ORM tables listed in the supplied material, their documented columns and relationships, the two migration paths, and the runtime database operations described there.

**Important scope limitation:** This is a documentation review, not a source-code audit. The uploaded material contains descriptions of the implementation but not the actual Python source files or a live database schema. Therefore, it is not possible to certify that every column type, constraint, default, foreign-key action, endpoint side effect, or migration behavior exactly matches the running application. Section 13 lists the details that need source-code verification.

---

## 2. Database Architecture

The supplied documentation describes three distinct data paths.

### 2.1 Initial ticket and notification import

```text
Java processing
      |
      v
output/tickets.json
output/notifications.json
      |
      v
backend/migrate_json_to_db.py
      |
      v
PostgreSQL
  - teams
  - tickets
  - ticket_events
```

The JSON files are migration inputs in this flow. They should not be described as the runtime database unless the application has a separate code path that continues reading or writing them.

### 2.2 Initial knowledge import

```text
knowledge/
  - telecom_runbooks.txt
  - shell_commands.txt
  - historical_incidents.txt
      |
      v
migrate_knowledge.py
      |
      v
PostgreSQL
  - knowledge_documents
  - historical_incidents
```

This is a separate migration from the ticket/notification import. It imports legacy knowledge records and historical incident information.

### 2.3 Runtime application access

```text
React frontend
      |
      v
FastAPI backend
      |
      v
SQLAlchemy sessions / ORM
      |
      v
PostgreSQL
```

The runtime API is documented as reading and modifying PostgreSQL through SQLAlchemy. The legacy JSON and text files are described as migration sources, not as the primary runtime persistence layer.

---

## 3. Database Connection Layer

The database setup is documented as being implemented in `backend/database.py`.

The supplied material describes the module as loading environment variables with `load_dotenv()` and reading the database connection string from `DATABASE_URL`.

The documented setup is structurally equivalent to:

```python
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()
```

### 3.1 Responsibilities

- `load_dotenv()` loads values from the configured environment file, if present.
- `DATABASE_URL` supplies the connection details used by SQLAlchemy.
- `engine` manages the database connectivity and connection pooling.
- `SessionLocal` is a factory for creating SQLAlchemy sessions.
- `Base` is the declarative base used by ORM model classes.

### 3.2 Configuration and security

The database URL should be supplied through environment configuration rather than hard-coded into application source.

Do not put real database passwords or other credentials in this documentation, source control, logs, or screenshots.

**Not established by the supplied material:** the exact PostgreSQL driver, connection-pool settings, SSL configuration, connection timeout, retry behavior, or startup failure behavior. Those details should only be added after checking `backend/database.py` and the deployment configuration.

---

## 4. Database Session Lifecycle

The supplied documentation identifies `get_db()` as the FastAPI dependency used to provide database sessions to endpoints.

The described lifecycle is:

```text
Incoming API request
      |
      v
FastAPI resolves get_db()
      |
      v
Create session using SessionLocal
      |
      v
Endpoint uses the session
      |
      v
Dependency cleanup
      |
      v
Close the session
```

The documented pattern is that `get_db()` creates a session, yields it to the endpoint, and closes it in a `finally` block.

A session is a unit of interaction with the database. It is not itself a permanent database connection or a replacement for PostgreSQL transaction management.

### 4.1 Migration scripts

The supplied documentation states that the migration scripts also use `SessionLocal`. This means the scripts can use the same configured SQLAlchemy session factory as the API, while running as separate processes.

**Not established by the supplied material:** whether every endpoint commits, rolls back, or closes transactions in exactly the same way; whether the dependency performs rollback on exceptions; and whether migration scripts use one session for the whole import or multiple sessions. These are source-code details and should not be assumed.

---

## 5. Database Tables Overview

The supplied documentation lists ten ORM tables.

| Area | Table | Documented purpose |
|---|---|---|
| Ticket operations | `teams` | Stores operational team names. |
| Ticket operations | `tickets` | Stores the current state of alarm-related tickets. |
| Ticket operations | `ticket_events` | Stores ticket lifecycle events and notification-related state. |
| Authentication | `users` | Stores user account details, password hashes, and roles. |
| Authentication | `refresh_tokens` | Stores hashes and lifecycle state for refresh tokens. |
| Authentication | `password_reset_tokens` | Stores hashes and lifecycle state for password-reset tokens. |
| Authentication | `auth_rate_limits` | Tracks authentication rate-limit state. |
| Knowledge / RAG | `knowledge_documents` | Stores runbook and command knowledge records. |
| Knowledge / RAG | `historical_incidents` | Stores historical incident and resolution information. |
| RAG evaluation | `rag_evaluations` | Stores RAG evaluation metrics and details. |

The table count above is the count in the supplied ORM-model documentation. It should not be interpreted as proof that the live PostgreSQL database contains exactly these ten tables: the database may also contain migration metadata, manually created tables, or tables from other components.

---

## 6. Table Definitions

The following definitions preserve the columns and constraints described in the supplied material. Where the source document did not provide a constraint or where the actual model declaration is unavailable, the table does not invent one.

### 6.1 `teams`

Stores the operational teams that can be assigned to tickets.

| Column | Documented SQLAlchemy type | Documented constraints / defaults |
|---|---|---|
| `id` | `Integer` | Primary key; indexed according to the supplied documentation. |
| `name` | `String(100)` | Unique; not nullable. |

**Documented relationship:**
- One `Team` can be associated with multiple `Ticket` records.
- Each ticket references its assigned team through `tickets.assigned_team_id`.

### 6.2 `tickets`

Stores the current state of an alarm-related service ticket.

| Column | Documented SQLAlchemy type | Documented constraints / defaults |
|---|---|---|
| `id` | `Integer` | Primary key; indexed according to the supplied documentation. |
| `ticket_number` | `String(50)` | Unique; not nullable; indexed. |
| `node` | `String(100)` | Not nullable. |
| `alarm_type` | `String(100)` | Not nullable. |
| `occurrence_count` | `Integer` | Default `0`. |
| `users_impacted` | `Integer` | Default `0`. |
| `severity` | `String(50)` | Nullable. |
| `threshold_breached` | `Boolean` | Default `False`. |
| `impact_level` | `String(50)` | Nullable. |
| `priority` | `String(10)` | Not nullable. |
| `assigned_team_id` | `Integer` | Foreign key to `teams.id`. |
| `status` | `String(30)` | Not nullable; default `"OPEN"`. |
| `reason` | `Text` | Nullable. |
| `created_at` | `DateTime` | Nullable. |
| `updated_at` | `DateTime` | Default `datetime.now`; updated using `onupdate=datetime.now`, according to the supplied documentation. |
| `closed_at` | `DateTime` | Nullable. |
| `reopened_at` | `DateTime` | Nullable. |

**Documented relationships:**
- Many tickets can reference one team.
- One ticket can have multiple `TicketEvent` records.
- The supplied documentation describes ticket deletion as cascading to its ticket events.
- A `HistoricalIncident` can optionally reference a ticket.

**Important distinction:** `tickets` represents the ticket's current state. Historical changes are represented separately in `ticket_events`.

### 6.3 `ticket_events`

Stores ticket lifecycle events and the state used by the notification API.

| Column | Documented SQLAlchemy type | Documented constraints / defaults |
|---|---|---|
| `id` | `Integer` | Primary key; indexed according to the supplied documentation. |
| `ticket_id` | `Integer` | Foreign key to `tickets.id`; not nullable; indexed. |
| `event_type` | `String(50)` | Not nullable. |
| `previous_priority` | `String(10)` | Nullable. |
| `new_priority` | `String(10)` | Nullable. |
| `priority` | `String(10)` | Nullable. |
| `reason` | `Text` | Nullable. |
| `status` | `String(30)` | Nullable; examples in the supplied documentation include `PENDING`, `ACKNOWLEDGED`, and `RESOLVED`. |
| `timestamp` | `DateTime` | Not nullable; default `datetime.now`, according to the supplied documentation. |

**Documented relationship:**
- Many events can belong to one ticket.

The supplied documentation describes this table as serving both ticket history and notification-related state. It does not establish that every event type is exposed as a notification or that every notification state is stored in a separate table. No separate `notifications` ORM table is included in the ten-table list.

### 6.4 `users`

Stores application user account information.

| Column | Documented SQLAlchemy type | Documented constraints / defaults |
|---|---|---|
| `id` | `Integer` | Primary key; indexed according to the supplied documentation. |
| `full_name` | `String(120)` | Not nullable. |
| `username` | `String(50)` | Unique; not nullable; indexed. |
| `email` | `String(255)` | Unique; not nullable; indexed. |
| `password_hash` | `String(255)` | Not nullable; described as an Argon2 hash. |
| `is_active` | `Boolean` | Not nullable; default `True`. |
| `role` | `String(20)` | Not nullable; default `"user"`; server default `"user"` according to the supplied documentation. |
| `created_at` | `DateTime` | Not nullable; default `datetime.now`. |
| `updated_at` | `DateTime` | Not nullable; default `datetime.now`; updated using `onupdate`, according to the supplied documentation. |

**Documented relationships:**
- One user can have multiple refresh-token records.
- One user can have multiple password-reset-token records.
- The supplied documentation describes cascading deletion from a user to these token records.

The role column stores the user's role. Authorization enforcement occurs in application logic; a database column by itself does not enforce role-based access control.

### 6.5 `refresh_tokens`

Stores hashes of refresh tokens and their revocation/expiry state. The supplied documentation says this table replaced a legacy `user_sessions` table.

| Column | Documented SQLAlchemy type | Documented constraints / defaults |
|---|---|---|
| `id` | `Integer` | Primary key; indexed according to the supplied documentation. |
| `user_id` | `Integer` | Foreign key to `users.id`; not nullable; indexed; documented `CASCADE` delete behavior. |
| `token_hash` | `String(64)` | Unique; not nullable; indexed; described as a SHA-256 hash. |
| `created_at` | `DateTime` | Not nullable; default `datetime.now`. |
| `expires_at` | `DateTime` | Not nullable; indexed. |
| `revoked` | `Boolean` | Not nullable; default `False`. |

**Documented relationship:**
- Many refresh-token records can belong to one user.

The table stores a token hash rather than the raw refresh-token value, according to the supplied documentation. The exact token format, hashing implementation, cookie configuration, and refresh-token rotation behavior must be verified in the authentication source code.

### 6.6 `password_reset_tokens`

Stores hashed password-reset tokens and their usage/expiry state.

| Column | Documented SQLAlchemy type | Documented constraints / defaults |
|---|---|---|
| `id` | `Integer` | Primary key; indexed according to the supplied documentation. |
| `user_id` | `Integer` | Foreign key to `users.id`; not nullable; indexed; documented `CASCADE` delete behavior. |
| `token_hash` | `String(64)` | Unique; not nullable; indexed; described as a SHA-256 hash. |
| `created_at` | `DateTime` | Not nullable; default `datetime.now`. |
| `expires_at` | `DateTime` | Not nullable; indexed. |
| `used` | `Boolean` | Not nullable; default `False`. |

**Documented relationship:**
- Many password-reset-token records can belong to one user.

The supplied material does not specify the token lifetime, whether expired/used rows are periodically deleted, or whether all outstanding reset tokens are invalidated after a password change.

### 6.7 `auth_rate_limits`

Stores rate-limit counters and lockout state for authentication-related actions.

| Column | Documented SQLAlchemy type | Documented constraints / defaults |
|---|---|---|
| `id` | `Integer` | Primary key; indexed according to the supplied documentation. |
| `rate_limit_key` | `String(255)` | Not nullable; indexed; described as an IP- or email-based key. |
| `action` | `String(30)` | Not nullable; indexed; examples include `LOGIN` and `REGISTER`. |
| `attempt_count` | `Integer` | Not nullable; default `0`. |
| `window_started_at` | `DateTime` | Not nullable; default `datetime.now`. |
| `locked_until` | `DateTime` | Nullable. |

The table is described as supporting brute-force protection. The supplied material does not define the attempt threshold, time-window length, lockout duration, key-combination uniqueness, or cleanup policy. Those values must be taken from the authentication implementation rather than inferred from the table structure.

### 6.8 `knowledge_documents`

Stores structured knowledge records used by the RAG pipeline.

| Column | Documented SQLAlchemy type | Documented constraints / defaults |
|---|---|---|
| `id` | `Integer` | Primary key; indexed according to the supplied documentation. |
| `source_type` | `String(30)` | Not nullable; indexed; documented examples are `runbook` and `commands`. |
| `title` | `String(255)` | Not nullable. |
| `alarm_type` | `String(100)` | Not nullable; indexed. |
| `content` | `Text` | Not nullable. |
| `created_at` | `DateTime` | Not nullable; default `datetime.now`. |
| `updated_at` | `DateTime` | Not nullable; default `datetime.now`; updated using `onupdate`, according to the supplied documentation. |

This table stores the document content described in the migration documentation. The supplied material does not show a vector column, embedding column, or vector index in this table. Do not describe this table as the vector store unless the actual model/schema confirms that.

### 6.9 `historical_incidents`

Stores historical incident information, including records imported from legacy incident text and resolution information captured from ticket workflows.

| Column | Documented SQLAlchemy type | Documented constraints / defaults |
|---|---|---|
| `id` | `Integer` | Primary key; indexed according to the supplied documentation. |
| `ticket_id` | `Integer` | Nullable foreign key to `tickets.id`; documented `SET NULL` delete behavior; indexed. |
| `alarm_type` | `String(100)` | Not nullable; indexed. |
| `observed_symptoms` | `Text` | Nullable. |
| `root_cause` | `Text` | Nullable. |
| `actions_taken` | `Text` | Nullable. |
| `shell_commands_used` | `Text` | Nullable. |
| `shell_script_used` | `Text` | Nullable. |
| `resolution` | `Text` | Nullable. |
| `verification_results` | `Text` | Nullable. |
| `escalation` | `Text` | Nullable. |
| `additional_notes` | `Text` | Nullable. |
| `source` | `String(30)` | Not nullable; default `"migration"`; supplied examples include `"migration"` and `"questionnaire"`. |
| `created_at` | `DateTime` | Not nullable; default `datetime.now`. |
| `updated_at` | `DateTime` | Not nullable; default `datetime.now`; updated using `onupdate`, according to the supplied documentation. |

**Documented relationship:**
- A ticket can be associated with multiple historical incident records.
- The ticket reference is nullable and is described as using `ON DELETE SET NULL`.

The supplied documentation says that resolution questionnaire data can create a historical incident linked to a ticket. It does not prove that every ticket closure creates such a record; the creation is described as conditional on resolution data being provided.

The table is a relational store for incident details. Whether and when these records are converted into embeddings or added to a vector index is a separate RAG implementation concern and must not be inferred from this table definition alone.

### 6.10 `rag_evaluations`

Stores historical RAG evaluation results.

| Column | Documented SQLAlchemy type | Documented constraints / defaults |
|---|---|---|
| `id` | `Integer` | Primary key; indexed according to the supplied documentation. |
| `timestamp` | `DateTime` | Not nullable; default `datetime.now`; indexed. |
| `context_precision` | `Float` | Not nullable. |
| `faithfulness` | `Float` | Not nullable. |
| `answer_relevancy` | `Float` | Not nullable. |
| `ground_truth_match` | `Float` | Not nullable. |
| `overall_score` | `Float` | Not nullable. |
| `num_test_cases` | `Integer` | Not nullable. |
| `model_used` | `String(100)` | Not nullable. |
| `details` | `JSON` | Not nullable; documented default is `list`. |

The table stores evaluation metrics and a JSON details value. The exact JSON structure, score range, calculation of `overall_score`, and evaluation methodology are not defined by the supplied database document.

---

## 7. Entity Relationships

The relationships documented in the supplied material can be summarized as follows:

```text
USERS
  |
  | 1
  +----------------------< REFRESH_TOKENS
  |
  | 1
  +----------------------< PASSWORD_RESET_TOKENS


TEAMS
  |
  | 1
  +----------------------< TICKETS
                              |
                              | 1
                              +----< TICKET_EVENTS
                              |
                              | 1
                              +----< HISTORICAL_INCIDENTS
                                    (ticket_id is nullable)


KNOWLEDGE_DOCUMENTS       AUTH_RATE_LIMITS       RAG_EVALUATIONS
(no relationship          (no relationship        (no relationship
 documented)               documented)             documented)
```

### Relationship notes

- `tickets.assigned_team_id` references `teams.id`.
- `ticket_events.ticket_id` references `tickets.id`.
- `historical_incidents.ticket_id` optionally references `tickets.id`.
- `refresh_tokens.user_id` references `users.id`.
- `password_reset_tokens.user_id` references `users.id`.
- The supplied documentation does not identify foreign-key relationships for `auth_rate_limits`, `knowledge_documents`, or `rag_evaluations`.

The diagram represents only relationships documented in the supplied material. It does not imply additional constraints, indexes, or database-level cascade rules beyond those listed in Section 6.

---

## 8. JSON-to-Database Migration

The supplied documentation places the ticket and notification migration script at:

```text
backend/migrate_json_to_db.py
```

It reads:

```text
output/tickets.json
output/notifications.json
```

### 8.1 Documented migration flow

1. **Load JSON files**  
   The script reads the ticket and notification JSON inputs.

2. **Create or find teams**  
   It extracts unique `assignedTeam` values and creates missing `Team` records.

3. **Create or find tickets**  
   It checks tickets using `ticket_number`. Existing tickets are reused; missing tickets are created. The `assignedTeam` value is mapped to `assigned_team_id`.

4. **Create ticket events from notification data**  
   Notification JSON records are mapped to `TicketEvent` records.

5. **Deduplicate events within the migration run**  
   The supplied documentation says an in-memory set of `(ticket_id, event_type, timestamp)` values is used for deduplication.

6. **Commit**  
   The supplied documentation describes the imported records as being committed to the database.

### 8.2 Important limitation of the documented deduplication

An in-memory set only remembers entries during the current process execution. By itself, it does not guarantee that a repeated migration run will avoid inserting the same event again.

To claim cross-run idempotency, the implementation would need an additional mechanism, such as:
- querying existing events using a stable identity before insertion;
- a suitable database uniqueness constraint; or
- another persistent migration checkpoint.

The supplied document does not establish that such a mechanism exists. Therefore, this document does **not** claim that notification/event migration is fully idempotent.

### 8.3 Migration boundary

This script imports ticket and notification JSON into the operational tables. It is separate from `migrate_knowledge.py`, which imports knowledge text files.

A successful import should be validated by checking record counts, ticket-to-team references, event-to-ticket references, and representative field values in PostgreSQL.

---

## 9. Knowledge Migration

The supplied documentation places the knowledge migration script in the project root:

```text
migrate_knowledge.py
```

It reads legacy text files from:

```text
knowledge/
  telecom_runbooks.txt
  shell_commands.txt
  historical_incidents.txt
```

### 9.1 Documented migration flow

1. **Split source records**  
   The script splits the text files using a delimiter consisting of 50 hyphens:

   ```text
   --------------------------------------------------
   ```

2. **Migrate runbooks and commands**  
   The script parses the runbook and command records, extracts fields such as `title` and `alarm_type`, and inserts records into `knowledge_documents`.

3. **Deduplicate knowledge documents**  
   The supplied documentation describes deduplication using `source_type` and `title`.

4. **Migrate historical incidents**  
   The script parses historical incident records and extracts structured information such as alarm type, symptoms, actions, resolution, and other incident fields.

5. **Deduplicate historical incidents**  
   The supplied documentation describes using `source="migration"` and an `additional_notes` value containing a legacy incident identifier.

6. **Commit**  
   The supplied documentation describes the imported records as being committed to PostgreSQL.

### 9.2 Migration limitations

The supplied material does not establish:
- whether malformed records are skipped, logged, or treated as fatal errors;
- whether empty fields are stored as `NULL` or empty strings;
- whether duplicate matching is case-sensitive;
- whether the deduplication keys have database uniqueness constraints;
- whether the script updates existing rows when source text changes;
- whether rerunning the script is safe in every failure/restart scenario.

Do not describe the migration as fully idempotent or as an ongoing file synchronization process without verifying those behaviors in the script.

---

## 10. Runtime Database Operations

The supplied documentation describes the following runtime database effects.

| Operation | Endpoint documented | Database effect described |
|---|---|---|
| Priority change | `PUT /tickets/{n}/priority` | Updates `tickets.priority` and creates a `ticket_events` record for a priority upgrade or downgrade. |
| Ticket closure | `PUT /tickets/{n}/close` | Updates ticket status and closure time; creates a `TICKET_CLOSED` event. If resolution data is supplied, creates a linked `historical_incidents` record. |
| Ticket reopening | `PUT /tickets/{n}/reopen` | Updates ticket status, priority, and reopening time; creates a `TICKET_REOPENED` event. |
| Notification acknowledgement | `PUT /tickets/{n}/acknowledge` | Updates the status of the relevant/latest `ticket_events` record to `ACKNOWLEDGED`, as described in the supplied material. |
| RAG evaluation | `POST /api/evaluate/run` | Stores an evaluation result in `rag_evaluations`. |
| Password reset | `POST /auth/reset-password` | Updates `users.password_hash` and revokes active refresh-token records for the user. |

### 10.1 Current ticket state and event history

The supplied design separates:
- `tickets`: current ticket state;
- `ticket_events`: event/history records associated with a ticket.

For example, a priority change updates the current priority in `tickets` and records the transition in `ticket_events`.

This separation allows the current ticket state to be read without reconstructing it from the full event history. The event table provides the historical record described by the application documentation.

### 10.2 Notification persistence

The supplied documentation does not list a separate `notifications` ORM table. Instead, it describes notification-related state as being represented through `ticket_events` and the notification API.

Therefore, this document does not describe a separate runtime notification table. If the source code contains one, the table overview and schema must be updated from the actual model.

### 10.3 Resolution capture and historical incidents

Ticket closure and historical incident capture are related but distinct operations:
- closing a ticket changes the operational ticket state;
- supplying resolution information may additionally create a `historical_incidents` record.

The supplied material does not establish the exact field-by-field mapping from the resolution request into `historical_incidents`. That mapping should be documented from the close endpoint and model code.

### 10.4 Knowledge writes

The supplied document describes a knowledge migration into `knowledge_documents` and `historical_incidents`, but it does not identify a normal runtime endpoint that creates or updates `knowledge_documents`.

Consequently, this document does not claim that the runtime application continuously writes knowledge documents or automatically synchronizes the original text files with PostgreSQL.

---

## 11. End-to-End Data Flow

The database-related flows described in the supplied material are:

```text
                    INITIAL DATA IMPORT
                             |
             +---------------+----------------+
             |                                |
             v                                v
      Ticket JSON files                Knowledge text files
             |                                |
             v                                v
  backend/migrate_json_to_db.py       migrate_knowledge.py
             |                                |
             +---------------+----------------+
                             |
                             v
                         PostgreSQL
                             |
                             v
                       SQLAlchemy ORM
                             |
                             v
                         FastAPI
                             |
                             v
                       React frontend
```

Authentication-related data is also stored in PostgreSQL through the ORM models:

```text
FastAPI authentication flow
          |
          +---- users
          |
          +---- refresh_tokens
          |
          +---- password_reset_tokens
          |
          +---- auth_rate_limits
```

RAG-related relational data is documented as:

```text
knowledge_documents
historical_incidents
rag_evaluations
```

This relational data model should not be confused with the RAG vector index. The supplied database document does not define the vector index's storage engine, schema, persistence location, or synchronization lifecycle.

---

## 12. Data Integrity, Transactions, and Operational Considerations

### 12.1 Foreign-key integrity

The documented foreign-key relationships connect:
- tickets to teams;
- ticket events to tickets;
- historical incidents optionally to tickets;
- refresh tokens to users;
- password-reset tokens to users.

These references are important for preventing orphaned relational records, subject to the actual database constraints being present and enabled.

### 12.2 Deletion behavior

The supplied documentation describes these deletion behaviors:

| Parent record | Related record | Documented behavior |
|---|---|---|
| `users` | `refresh_tokens` | Cascade delete. |
| `users` | `password_reset_tokens` | Cascade delete. |
| `tickets` | `ticket_events` | Cascade delete. |
| `tickets` | `historical_incidents` | Set `historical_incidents.ticket_id` to `NULL`. |

These are documented behaviors, not independently verified DDL. SQLAlchemy relationship cascade settings and database-level `ON DELETE` constraints are not interchangeable; inspect both the model declarations and generated database schema before relying on a deletion policy.

### 12.3 Unique values

The supplied documentation identifies these unique fields:
- `teams.name`;
- `tickets.ticket_number`;
- `users.username`;
- `users.email`;
- `refresh_tokens.token_hash`;
- `password_reset_tokens.token_hash`.

The supplied material does not identify unique constraints for migration deduplication keys or for the `auth_rate_limits` key/action pair.

### 12.4 Timestamps and time zones

The supplied documentation describes timestamp defaults using `datetime.now`. It does not state whether the ORM columns are timezone-aware or whether timestamps are normalized to UTC.

Do not label the stored timestamps as UTC or timezone-aware without checking:
- the SQLAlchemy column definitions;
- the Python datetime values passed to them;
- the PostgreSQL column types; and
- the application's serialization/display behavior.

For production systems, a consistent timezone policy should be documented and enforced.

### 12.5 Transactions and failure handling

The supplied material says the migration scripts commit their imported data. It does not show the precise transaction boundaries, rollback behavior, partial-import behavior, or error handling.

Before running a migration against production data:
1. back up the database;
2. verify the input files;
3. run the migration in a controlled environment;
4. inspect the script's transaction and rollback behavior;
5. validate inserted and updated records;
6. confirm whether rerunning the script can create duplicates.

### 12.6 Schema creation and schema evolution

The supplied document does not explain how tables are initially created or how schema changes are applied. It does not identify an Alembic migration history or establish that `Base.metadata.create_all()` is used.

Do not assume that defining an ORM model automatically creates or updates the corresponding PostgreSQL table. Document the actual schema-management mechanism after inspecting the project.

---

## 13. Items Requiring Source-Code Verification

The original document described itself as synchronized with the current backend source files. Those source files were not included in the material available for this review. The following points therefore remain unverified and must be checked before calling this documentation source-certified.

| Area | Verify in | What must be checked |
|---|---|---|
| Database URL and engine | `backend/database.py` | Exact environment variable, driver, engine options, and error behavior when configuration is missing. |
| Session dependency | `backend/database.py` and API modules | Session creation, close, commit, rollback, and exception handling. |
| Exact ORM schema | `backend/models.py` | Every column type, length, nullable flag, primary key, index, unique constraint, default, and server default. |
| Foreign-key actions | `backend/models.py` and live PostgreSQL schema | Whether `CASCADE` and `SET NULL` are database constraints, ORM relationship settings, or both. |
| JSON import mapping | `backend/migrate_json_to_db.py` | Exact ticket and notification field mapping, handling of missing fields, and duplicate checks. |
| JSON import idempotency | `backend/migrate_json_to_db.py` and database constraints | Whether repeated runs can duplicate `TicketEvent` rows. An in-memory set alone is not persistent deduplication. |
| Knowledge parsing | `migrate_knowledge.py` | Exact delimiter parsing, record validation, field mapping, and malformed-record behavior. |
| Knowledge deduplication | `migrate_knowledge.py` and `backend/models.py` | Whether deduplication is enforced only in script logic or also by database constraints. |
| Ticket priority update | Ticket API/router implementation | Exact event types and transaction behavior. |
| Ticket closure | Ticket API/router implementation | Exact closure fields, event creation, and conditional historical-incident mapping. |
| Ticket reopening | Ticket API/router implementation | Exact status/priority updates and event fields. |
| Acknowledgement | Notification/ticket API implementation | Which event is selected and updated; whether acknowledgement is scoped to a user. |
| RAG evaluation | Evaluation API and model | Exact metrics, score calculation, JSON details format, and commit behavior. |
| Password reset | Authentication API and models | Token validation, password hashing, refresh-token revocation, and transaction boundaries. |
| Runtime knowledge writes | RAG/knowledge API modules | Whether any runtime route creates or updates `knowledge_documents` or `historical_incidents`. |
| Vector storage | RAG implementation and configuration | Vector-store technology, persistence location, embedding metadata, and how relational incident records reach the vector index. |
| Schema management | Project startup/deployment scripts | Whether Alembic, `create_all()`, SQL scripts, or another mechanism creates and evolves tables. |

### Source files needed for final verification

To certify the document against implementation, inspect at least:
- `backend/database.py`
- `backend/models.py`
- `backend/migrate_json_to_db.py`
- `migrate_knowledge.py`
- the ticket API/router module
- the authentication API/router module
- the notification API/router module
- the RAG/knowledge implementation
- any schema migration or database initialization scripts

Until those files are checked, treat the table definitions and runtime effects in this document as the details recorded by the supplied documentation, not as a verified live-schema dump.

---

## 14. Changelog

### Version 2.1 — November 03, 2026

**Corrected**
- Clarified that the ten-table count refers to the ORM models described in the source document, not necessarily every table in the live PostgreSQL database.
- Separated initial ticket/notification migration from initial knowledge migration.
- Distinguished relational knowledge records from the RAG vector index.
- Clarified that `tickets` stores current state while `ticket_events` stores event history.
- Clarified that resolution capture is conditional on resolution data being supplied.
- Removed the unsupported claim that historical incidents automatically feed directly into the vector store.
- Removed the unsupported implication that the runtime system continuously writes or synchronizes knowledge documents.
- Clarified that an in-memory event-deduplication set does not, by itself, guarantee idempotency across migration runs.
- Distinguished documented deletion behavior from independently verified database-level foreign-key actions.
- Added explicit limitations around transaction handling, timezone behavior, schema creation, and migration restart safety.

**Added**
- Detailed data-model and relationship descriptions.
- Runtime operation summary.
- Data-integrity and operational considerations.
- A source-code verification checklist identifying the files and implementation details needed for final certification.

**Verification note**
- This revision is internally reviewed against the supplied database documentation. It has not been certified against the actual backend source files or a live PostgreSQL schema.
