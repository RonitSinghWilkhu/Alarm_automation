# Alarm Automation — System Architecture

---

## Table of Contents

1. [Document Purpose](#1-document-purpose)
2. [Architecture Overview](#2-architecture-overview)
3. [System Layers and Responsibilities](#3-system-layers-and-responsibilities)
4. [Java Processing Layer](#4-java-processing-layer)
5. [JSON Handoff Layer](#5-json-handoff-layer)
6. [Database Migration and Knowledge Ingestion](#6-database-migration-and-knowledge-ingestion)
7. [PostgreSQL and Persistence](#7-postgresql-and-persistence)
8. [FastAPI Backend](#8-fastapi-backend)
9. [Authentication and Authorization](#9-authentication-and-authorization)
10. [Knowledge Management and RAG Architecture](#10-knowledge-management-and-rag-architecture)
11. [Root Cause Analysis Architecture](#11-root-cause-analysis-architecture)
12. [RAG Evaluation Architecture](#12-rag-evaluation-architecture)
13. [React Frontend Architecture](#13-react-frontend-architecture)
14. [Ticket Resolution and Knowledge Feedback](#14-ticket-resolution-and-knowledge-feedback)
15. [External Integrations](#15-external-integrations)
16. [End-to-End Data Flows](#16-end-to-end-data-flows)
17. [Runtime Dependencies and Deployment](#17-runtime-dependencies-and-deployment)
18. [Architectural Characteristics and Limitations](#18-architectural-characteristics-and-limitations)
19. [Source Verification Notes](#19-source-verification-notes)
20. [Changelog](#20-changelog)

---

## 1. Document Purpose

This document describes the architecture of the Alarm Automation application.

The application demonstrates an alarm-management workflow in which alarm data is processed into tickets, persisted in a relational database, exposed through a backend API, and presented through a React frontend.

It also includes AI-assisted capabilities:

- Retrieval-Augmented Generation (RAG) for alarm troubleshooting.
- Historical incident retrieval.
- Root Cause Analysis (RCA) using historical and ticket-related evidence.
- RAG evaluation using an LLM-as-a-judge approach.
- Collection of operator-provided resolution information for historical knowledge.

The architecture contains multiple processing and persistence components. These components should not be treated as one continuous runtime process: Java processing, file-based migration, database-backed API operations, vector retrieval, and evaluation are separate responsibilities.

### 1.1 Architectural Overview

```text
                    ALARM INPUT
                         |
                         v
              +----------------------+
              |  Java Processing     |
              |                      |
              | Alarm processing     |
              | Ticket generation    |
              | Notification output  |
              +----------+-----------+
                         |
                         v
              +----------------------+
              | JSON Output Files    |
              |                      |
              | tickets.json         |
              | notifications.json   |
              +----------+-----------+
                         |
                         v
              +----------------------+
              | Python Migration     |
              |                      |
              | JSON ingestion       |
              | Database insertion  |
              +----------+-----------+
                         |
                         v
              +----------------------+
              | PostgreSQL           |
              |                      |
              | Tickets              |
              | Ticket events        |
              | Users                |
              | Knowledge documents  |
              | Historical incidents |
              | Evaluation records   |
              +----------+-----------+
                         |
                         v
              +----------------------+
              | FastAPI Backend      |
              |                      |
              | REST APIs            |
              | Authentication       |
              | Authorization        |
              | Ticket lifecycle     |
              | RAG                  |
              | RCA                  |
              | Evaluation           |
              +----------+-----------+
                         |
                         | HTTP requests
                         v
              +----------------------+
              | React Frontend       |
              |                      |
              | Dashboard            |
              | Tickets              |
              | Notifications        |
              | AI RCA               |
              | Settings             |
              | Admin features       |
              +----------------------+
```

The FAISS vector index is a separate retrieval structure built from database-backed knowledge. It is not a replacement for PostgreSQL.

---

## 2. Architecture Overview

The application can be understood through the following major components.

| Component | Main responsibility |
|---|---|
| Java processing | Processes alarm input and generates ticket and notification data |
| JSON handoff | Transfers generated data from Java to Python |
| Migration scripts | Import file-based data into PostgreSQL |
| PostgreSQL | Stores persistent application and knowledge data |
| FastAPI | Exposes application functionality through REST APIs |
| Authentication | Verifies users and manages token-based access |
| Authorization | Restricts protected operations according to user permissions |
| RAG subsystem | Retrieves relevant knowledge and generates troubleshooting recommendations |
| RCA subsystem | Analyzes historical and related-ticket evidence |
| Evaluation subsystem | Evaluates troubleshooting output using an LLM judge |
| FAISS | Provides vector similarity retrieval over indexed knowledge |
| React frontend | Provides the user interface |
| Grafana | Provides an external monitoring interface, if configured |

### 2.1 Main Data Categories

The system handles four broad categories of data:

1. **Operational data:** tickets, teams, and ticket events.
2. **Authentication data:** users and token-related records.
3. **Knowledge data:** runbooks, command references, and historical incidents.
4. **Evaluation data:** historical RAG evaluation results.

These categories have different purposes and lifecycles. For example, a ticket represents current operational state, while a ticket event records an action or change associated with that ticket.

---

## 3. System Layers and Responsibilities

```text
+---------------------------------------------------------+
|                    PRESENTATION                         |
|                    React Frontend                       |
|                                                         |
| Dashboard | Tickets | Notifications | Admin | RCA       |
+----------------------------+----------------------------+
                             |
                             | HTTP
                             v
+---------------------------------------------------------+
|                    APPLICATION API                      |
|                    FastAPI Backend                      |
|                                                         |
| Authentication | Authorization | Ticket APIs           |
| Troubleshooting | RCA | Evaluation                      |
+----------------------------+----------------------------+
                             |
               +-------------+-------------+
               |             |             |
               v             v             v
        +-------------+ +-----------+ +-------------+
        | Ticket      | | RAG       | | RCA         |
        | Operations  | | Retrieval | | Analysis    |
        +------+------+ +-----+-----+ +------+------+
               |              |              |
               +--------------+--------------+
                              |
                              v
+---------------------------------------------------------+
|                    PERSISTENCE                          |
|                    PostgreSQL                           |
|                                                         |
| Tickets | Events | Users | Knowledge | Incidents        |
| Evaluation Records                                      |
+----------------------------+----------------------------+
                             |
                             v
+---------------------------------------------------------+
|                VECTOR RETRIEVAL STORAGE                  |
|                                                         |
| FAISS Index | Child Chunks | Parent Document Store       |
+---------------------------------------------------------+

                  DATA INGESTION

+---------------------------------------------------------+
| Java Processing                                         |
|        |                                                |
|        v                                                |
| JSON Output Files                                       |
|        |                                                |
|        v                                                |
| Python Migration Scripts                               |
|        |                                                |
|        v                                                |
| PostgreSQL                                              |
+---------------------------------------------------------+
```

The diagram represents logical responsibilities. It does not imply that every component runs in the same process or that every request passes through every layer.

---

## 4. Java Processing Layer

The Java component is responsible for the initial alarm-processing and ticket-generation workflow.

The documented data flow is:

```text
Alarm Input
    |
    v
Java Processing
    |
    +--------------------------+
    |                          |
    v                          v
Ticket Generation       Notification Generation
    |                          |
    v                          v
tickets.json             notifications.json
```

### 4.1 Documented Responsibilities

| Component | Documented responsibility |
|---|---|
| `alarmFileReader` | Reads alarm input |
| `alarmGrouper` | Groups related alarm records |
| `impactAnalyzer` | Calculates alarm impact information |
| `priorityCalculator` | Determines initial ticket priority |
| `ticketDraftGenerator` | Prepares ticket information |
| `ticketCreator` | Creates ticket records and ticket identifiers |
| `notificationGenerator` | Generates notification data |

These responsibilities describe the documented processing design. Exact method names, grouping keys, thresholds, priority rules, and class interactions must be verified against the current Java source.

### 4.2 Processing Characteristics

The Java layer is separate from the Python API backend.

Its output is transferred through JSON files rather than being assumed to write directly into PostgreSQL.

The Java processing stage and the database migration stage should therefore be treated as separate operations.

### 4.3 Output

The documented output files are:

```text
output/
├── tickets.json
└── notifications.json
```

The serialization library and exact JSON structure should be confirmed from the current Java writer classes.

---

## 5. JSON Handoff Layer

JSON files provide an intermediate data-transfer boundary between Java processing and Python database ingestion.

```text
Java Processing
      |
      +----------------------+
      |                      |
      v                      v
tickets.json          notifications.json
      |                      |
      +----------+-----------+
                 |
                 v
        Python Migration
                 |
                 v
             PostgreSQL
```

### 5.1 Purpose

The JSON handoff separates:

- Alarm and ticket generation.
- Database ingestion and persistence.

This allows the Java processing component to generate structured output without requiring it to communicate directly with the Python backend.

### 5.2 Important Distinction

The JSON files are not the primary runtime database.

After the data is imported, application API operations use the database-backed application layer rather than treating the JSON files as the live ticket store.

The files may remain on disk and may be processed again if the migration process is executed again. Whether repeated execution is safe depends on the migration script's deduplication and transaction logic.

---

## 6. Database Migration and Knowledge Ingestion

The documented architecture has two separate ingestion paths.

### 6.1 Ticket and Notification Migration

The documented migration script is:

```text
backend/migrate_json_to_db.py
```

Its input files are:

```text
output/tickets.json
output/notifications.json
```

The intended data flow is:

```text
tickets.json
     |
     +---------------------+
                           |
                           v
                  migrate_json_to_db.py
                           ^
                           |
     +---------------------+
     |
notifications.json
     |
     v
PostgreSQL
```

The documented migration responsibilities include:

1. Reading ticket and notification JSON data.
2. Preparing or reusing team records.
3. Creating or reusing ticket records.
4. Creating ticket-event records from notification information.
5. Persisting the imported data.

The exact deduplication keys, transaction boundaries, and conflict-handling behavior must be verified against `migrate_json_to_db.py`.

### 6.2 Knowledge Migration

The documented knowledge migration script is:

```text
migrate_knowledge.py
```

The documented text inputs are:

```text
knowledge/
├── telecom_runbooks.txt
├── shell_commands.txt
└── historical_incidents.txt
```

The intended data flow is:

```text
Knowledge Text Files
        |
        v
migrate_knowledge.py
        |
        v
PostgreSQL
        |
        +---------------------------+
        |                           |
        v                           v
knowledge_documents       historical_incidents
```

The knowledge ingestion process is responsible for transferring legacy knowledge into database-backed records.

The exact parsing rules, duplicate handling, record counts, and field mappings should be taken from the current migration script rather than inferred from the text files.

### 6.3 Migration Versus Runtime Retrieval

Migration and retrieval are different operations.

- Migration transfers source data into PostgreSQL.
- RAG retrieves information from the database-backed knowledge representation and its vector index.
- RCA retrieves historical evidence for root-cause analysis.

The application should not be described as reading the original knowledge text files on every troubleshooting request unless the current runtime code explicitly does so.

---

## 7. PostgreSQL and Persistence

PostgreSQL is the primary relational persistence layer for the application.

It stores operational records, authentication-related records, knowledge records, and evaluation history.

### 7.1 Logical Table Groups

The documented table groups are:

```text
PostgreSQL
    |
    +-- Operational Data
    |      |
    |      +-- teams
    |      +-- tickets
    |      +-- ticket_events
    |
    +-- Authentication Data
    |      |
    |      +-- users
    |      +-- refresh_tokens
    |      +-- password_reset_tokens
    |      +-- auth_rate_limits
    |
    +-- Knowledge Data
    |      |
    |      +-- knowledge_documents
    |      +-- historical_incidents
    |
    +-- Evaluation Data
           |
           +-- rag_evaluations
```

The names above reflect the documented architecture. The current SQLAlchemy models and actual database schema are authoritative if they differ.

### 7.2 Operational Data

| Data entity | Purpose |
|---|---|
| `Team` | Represents an assigned team |
| `Ticket` | Stores the current ticket information and state |
| `TicketEvent` | Records events associated with a ticket |

The ticket and event records have different responsibilities:

- A ticket represents the current operational state.
- Ticket events represent recorded actions or changes.

### 7.3 Authentication Data

| Data entity | Purpose |
|---|---|
| `User` | Stores user account information |
| `RefreshToken` | Supports refresh-token persistence and revocation |
| `PasswordResetToken` | Supports password-reset workflows |
| `AuthRateLimit` | Supports authentication rate-limiting state |

### 7.4 Knowledge Data

| Data entity | Purpose |
|---|---|
| `KnowledgeDocument` | Stores knowledge documents such as runbooks and command references |
| `HistoricalIncident` | Stores historical incident and resolution information |

Historical incidents can provide evidence for both troubleshooting and RCA.

### 7.5 Evaluation Data

| Data entity | Purpose |
|---|---|
| `RAGEvaluation` | Stores evaluation metrics, aggregate score, model information, and detailed results |

### 7.6 PostgreSQL and FAISS Are Not the Same Store

PostgreSQL and FAISS have separate responsibilities.

| PostgreSQL | FAISS |
|---|---|
| Stores persistent relational records | Stores vector-search structures |
| Stores knowledge document content | Supports similarity retrieval |
| Stores historical incidents | Supports retrieval of indexed chunks |
| Stores evaluation history | Does not replace evaluation records |
| Supports application CRUD operations | Supports vector-based retrieval |

The FAISS index is a derived retrieval representation. PostgreSQL remains the persistent source for the underlying relational knowledge records.

---

## 8. FastAPI Backend

The Python backend uses FastAPI as the application API layer.

It connects the frontend to the database and the AI-related processing components.

### 8.1 Main Responsibilities

| Responsibility | Description |
|---|---|
| REST APIs | Exposes application functionality |
| Authentication | Verifies user credentials and tokens |
| Authorization | Restricts protected operations |
| Ticket lifecycle | Handles supported ticket operations |
| Notifications | Provides notification information |
| Troubleshooting | Runs the RAG troubleshooting pipeline |
| RCA | Runs the root-cause analysis pipeline |
| Evaluation | Runs and retrieves RAG evaluation results |
| Database access | Reads and writes persistent application records |

### 8.2 Logical API Groups

The documented API groups include:

| API group | Purpose |
|---|---|
| Health | Basic backend availability |
| Tickets | Ticket retrieval and lifecycle operations |
| Notifications | Notification retrieval |
| Troubleshooting | AI-assisted troubleshooting |
| RCA | Root-cause analysis |
| Authentication | Login, registration, refresh, logout, and account-related operations |
| User administration | Administrative user operations |
| RAG evaluation | Evaluation execution and history |

Exact endpoint paths, HTTP methods, authorization dependencies, and request/response schemas must be checked against the current `backend/main.py` and related router files.

### 8.3 Request Processing

The logical request path is:

```text
Frontend
   |
   v
HTTP Request
   |
   v
FastAPI Endpoint
   |
   v
Authentication / Authorization
   |
   v
Application Logic
   |
   +--------------------------+
   |             |            |
   v             v            v
PostgreSQL      RAG           RCA
   |             |            |
   +-------------+------------+
                 |
                 v
          HTTP Response
                 |
                 v
              Frontend
```

Not every endpoint uses every component. For example, a ticket-list request does not need to invoke the RAG or RCA pipeline.

---

## 9. Authentication and Authorization

The documented authentication design uses JWT access and refresh tokens.

The refresh-token mechanism includes server-side persistence. Therefore, the authentication architecture should not be described as entirely stateless.

### 9.1 Token Responsibilities

| Token | Purpose |
|---|---|
| Access token | Authenticates protected API requests |
| Refresh token | Supports issuing a new access token after access-token expiry |

The documented cookie names are:

```text
alarmops_access_token
alarmops_refresh_token
```

The actual cookie settings and lifetimes should be verified against the current authentication implementation and configuration.

### 9.2 Login Flow

```text
User
 |
 v
POST /auth/login
 |
 v
Backend verifies credentials
 |
 v
Access token created
 |
 +-----------------------------+
 |                             |
 v                             v
Access token cookie       Refresh token cookie
                               |
                               v
                       Refresh token persisted
                       using a stored hash
```

The documented implementation uses Argon2 password verification and SHA-256 hashing for stored refresh-token values. These details should be checked against the current security and authentication modules when those files change.

### 9.3 Protected Request Flow

```text
Frontend
   |
   v
Protected API Request
   |
   v
FastAPI validates access token
   |
   +--------------------------+
   |                          |
   v                          v
Valid                    Invalid / Expired
   |                          |
   v                          v
Execute endpoint         HTTP 401 response
                              |
                              v
                       Frontend refresh flow
                              |
                              v
                       POST /auth/refresh
                              |
                              v
                       New access token
                              |
                              v
                       Retry original request
```

The frontend's automatic refresh behavior is implemented through its API request wrapper, according to the documented frontend design.

### 9.4 Role-Based Access Control

The documented role model contains:

- `user`
- `admin`

The intended access distinction is:

| Capability | User | Admin |
|---|---:|---:|
| Dashboard | Yes | Yes |
| Tickets | Yes | Yes |
| Notifications | Yes | Yes |
| Troubleshooting | Yes | Yes |
| RCA | Yes | Yes |
| Settings | Yes | Yes |
| User administration | No | Yes |
| RAG evaluation administration | No | Yes |

The frontend may hide administrative navigation from non-admin users. However, frontend visibility is not a security boundary.

Protected backend endpoints must enforce authorization independently.

### 9.5 Authentication and Security Considerations

The documented implementation includes the following security mechanisms:

- Access and refresh tokens.
- HTTP-only token cookies.
- Refresh-token persistence and revocation.
- Password hashing.
- Password-reset token handling.
- Authentication rate-limiting support.
- Protection against removal of the last active administrator.
- Dummy password-hash verification for unknown users, to reduce login timing differences.

The actual security guarantees depend on the implementation and configuration. In particular, HTTP-only cookies do not, by themselves, establish complete CSRF protection.

---

## 10. Knowledge Management and RAG Architecture

The RAG subsystem provides AI-assisted troubleshooting using knowledge stored in PostgreSQL and indexed for vector retrieval.

The implementation uses:

- PostgreSQL-backed knowledge records.
- LangChain document and text-splitting components.
- HuggingFace embeddings.
- FAISS vector storage.
- Maximum Marginal Relevance (MMR) retrieval.
- A BGE cross-encoder reranker.
- A Groq-hosted language model for recommendation generation.

### 10.1 Knowledge Sources

The documented knowledge sources are:

```text
PostgreSQL
    |
    +-- knowledge_documents
    |       |
    |       +-- runbook
    |       +-- commands
    |
    +-- historical_incidents
            |
            +-- Migrated historical records
            +-- Operator-recorded incident information
```

The exact values of `source_type` and other metadata fields are important because retrieval uses metadata filters.

### 10.2 Index Construction

The vector-store construction process is implemented in `backend/rag.py`.

Its logical flow is:

```text
_build_vector_store()
       |
       v
Read knowledge records from PostgreSQL
       |
       v
Compute SHA-256 fingerprint
       |
       v
Check persisted index fingerprint
       |
       +------------------------------+
       |                              |
       v                              v
Fingerprint matches             Fingerprint differs
       |                              |
       v                              v
Load persisted index             Rebuild index
and parent store                       |
                                       v
                               Construct documents
                                       |
                                       v
                               Split into parent blocks
                                       |
                                       v
                               Split parents into children
                                       |
                                       v
                               Generate embeddings
                                       |
                                       v
                               Build FAISS index
                                       |
                                       v
                               Persist index and
                               parent document store
```

### 10.3 Fingerprint Mechanism

The implementation computes a SHA-256 fingerprint over selected database content.

The fingerprint includes:

- A version marker: `historical_alarm_type_filter_v2`.
- Knowledge document IDs, source types, and content.
- Historical incident IDs, ticket IDs, alarm types, and selected incident fields.

The historical incident fields included in the fingerprint are:

- `observed_symptoms`
- `root_cause`
- `actions_taken`
- `shell_commands_used`
- `shell_script_used`
- `resolution`
- `verification_results`
- `escalation`
- `additional_notes`
- `source`

The records are ordered by ID before their values are incorporated into the hash.

The fingerprint does not use `updated_at` as its change-detection mechanism.

Consequently, changes to included fields affect the fingerprint, while changes to fields not included in the fingerprint do not directly affect it.

### 10.4 Parent and Child Document Structure

The implementation separates documents into parent blocks and child chunks.

The parent-block delimiter is exactly 50 hyphens:

```text
--------------------------------------------------
```

The parent splitting process:

1. Splits the source content using the delimiter.
2. Removes leading and trailing whitespace.
3. Discards empty blocks.
4. Copies the relevant metadata.
5. Assigns a UUID4 `parent_id` to each parent block.

There is no fixed parent-block character limit. The delimiter determines the parent boundaries.

Child chunks are created using:

| Parameter | Value |
|---|---:|
| Chunk size | 400 |
| Chunk overlap | 50 |

Each child chunk receives metadata that includes its `parent_id`, `source_type`, and `alarm_type`.

The parent-child relationship allows the system to retrieve smaller searchable chunks and then return their corresponding parent content for context.

### 10.5 Embeddings and Vector Store

The documented implementation uses a HuggingFace embedding model and FAISS.

The vector index stores searchable child chunks, while a separate parent store maintains the parent documents.

This separation supports:

- Vector search over smaller chunks.
- Retrieval of larger parent-level context.
- Metadata-based filtering.
- Persistence of the index between application runs.

The exact embedding model identifier and storage configuration should be read from the current `rag.py` constants.

### 10.6 Retrieval Pipeline

The retrieval process is:

```text
Troubleshooting Query
        |
        v
Metadata-filtered FAISS MMR search
        |
        v
Retrieve child chunks
        |
        v
Cross-encoder reranking
        |
        v
Sort by reranker score
        |
        v
Resolve child chunks to parent IDs
        |
        v
Fetch unique parent documents
        |
        v
Assemble retrieval context
        |
        v
Send context and query to LLM
        |
        v
Generate troubleshooting recommendation
```

### 10.7 MMR and Reranking

The retrieval helper uses MMR to select candidate child chunks.

Its documented default `fetch_k` value is 20.

The MMR search requests:

- `k = fetch_k`, meaning 20 selected child chunks.
- An MMR candidate pool of `fetch_k * 2`, meaning 40 candidates.

The selected child chunks are reranked using:

```text
BAAI/bge-reranker-v2-m3
```

The reranker uses normalized scores. The results are sorted in descending score order before parent resolution.

The system then resolves unique parent IDs, skips invalid or missing parent references, and returns parent documents up to the requested per-call limit.

### 10.8 Retrieval Limits

The documented retrieval configuration is:

| Retrieval category | Parent limit (`k`) | `fetch_k` |
|---|---:|---:|
| Alarm-specific runbooks | 2 | 20 (default) |
| Runbook fallback | 2 | 20 (default) |
| Alarm-specific commands | 2 | 20 (default) |
| Command fallback | 2 | 20 (default) |
| Historical troubleshooting | 3 | 20 |
| Historical RCA | 5 | 20 |

The runbook and command retrieval calls use the helper's default `fetch_k` value rather than passing a different value explicitly.

### 10.9 Metadata Filtering

The retrieval metadata includes:

| Metadata field | Purpose |
|---|---|
| `source_type` | Distinguishes runbooks, commands, and historical data |
| `alarm_type` | Associates content with an alarm type |
| `parent_id` | Connects child chunks to parent documents |
| `incident_id` | Identifies historical incident provenance where applicable |

For runbooks and command references, retrieval first attempts an alarm-specific search. If no parent documents are returned, it retries using the source-type filter without the alarm-specific restriction.

Historical retrieval applies alarm-type filtering at the child retrieval stage and checks the parent metadata again after parent resolution.

This second check reduces the risk of returning a parent document that does not match the requested alarm type.

### 10.10 Troubleshooting Context and Generation

The troubleshooting context combines retrieved material from:

1. Runbooks.
2. Command references.
3. Historical incidents.

The documented generation model is:

```text
openai/gpt-oss-20b
```

It is accessed through the Groq integration and configured with temperature `0`.

The generated recommendation is based on the retrieved context and the current alarm/ticket information.

The RAG pipeline also returns information about retrieved historical incidents and retrieved context.

### 10.11 Troubleshooting Output

The documented result includes:

| Field | Purpose |
|---|---|
| `recommendation` | Generated troubleshooting recommendation |
| `historicalIncidents` | Retrieved historical incident information |
| `retrieved_context` | Context assembled from retrieved material |

The historical incident entries include fields such as:

- `id`
- `content`
- `alarmType`

The exact outer API response may include additional fields depending on the calling endpoint.

---

## 11. Root Cause Analysis Architecture

RCA is a separate analysis pipeline from ordinary RAG troubleshooting.

It is implemented in:

```text
backend/rca.py
```

Its purpose is to analyze the current ticket using historical incidents, recorded resolution information, and related tickets.

### 11.1 RCA Processing Flow

```text
RCA Request
    |
    v
Load vector store and LLM resources
    |
    v
Retrieve historical incidents
    |
    v
Load current ticket
    |
    v
Load latest linked HistoricalIncident
    |
    v
Collect recorded resolution evidence
    |
    v
Identify related tickets
    |
    v
Build temporal correlation findings
    |
    v
Check evidence availability
    |
    +-------------------------------+
    |                               |
    v                               v
Insufficient evidence         Evidence available
    |                               |
    v                               v
Safe fallback response        Build RCA prompt
                                    |
                                    v
                                Groq LLM
                                    |
                                    v
                              Parse JSON output
                                    |
                                    v
                              Validate response
                                    |
                    +---------------+---------------+
                    |                               |
                    v                               v
               Invalid output                 Valid output
                    |                               |
                    v                               v
             Safe fallback                  Merge evidence gaps
                                                    |
                                                    v
                                              RCA response
```

### 11.2 Historical Retrieval

RCA retrieves up to five relevant historical parent documents.

The retrieval is scoped to historical incident data and the current ticket's alarm type.

The historical evidence is used as supporting context for the RCA model.

### 11.3 Current Ticket and Recorded Resolution

The RCA implementation retrieves:

- The current ticket by ticket number.
- The latest linked historical incident for that ticket, ordered by creation time.

The recorded resolution context includes:

| Field | Purpose |
|---|---|
| `root_cause` | Recorded root cause |
| `actions_taken` | Actions performed |
| `resolution` | Resolution description |
| `verification_results` | Verification information |
| `shell_commands_used` | Commands used |
| `shell_script_used` | Script information |
| `escalation` | Escalation information |
| `additional_notes` | Additional operator notes |

If there is no linked historical incident, the recorded resolution values are returned as null in the successful outer response.

### 11.4 Evidence Gap Detection

The implementation detects missing resolution evidence.

If there is no linked historical incident, it records:

```text
No recorded resolution is linked to the current ticket.
```

If an incident is linked, it checks these four fields for blank or whitespace-only values:

- `root_cause`
- `actions_taken`
- `resolution`
- `verification_results`

The implementation does not add evidence gaps solely because shell commands, shell scripts, escalation information, or additional notes are empty.

This distinction matters: the evidence-gap list is based on explicit checks, not on every field in the recorded-resolution structure.

### 11.5 Related Ticket Correlation

The RCA pipeline looks for other tickets:

- On the same node.
- Within 30 minutes before or after the current ticket's creation time.
- Excluding the current ticket.
- Excluding tickets with the same alarm type.

The related-ticket information includes:

- `ticketNumber`
- `node`
- `alarmType`
- `severity`
- `status`
- `createdAt`
- `occurrenceCount`
- `usersImpacted`
- `priority`

The correlation result includes:

- `relatedTickets`
- `observedAlarmTypes`
- `observedNodes`
- `timeSpanMinutes`
- `correlationWindowMinutes`
- `evidenceType`
- `causationEstablished`

The evidence type is:

```text
temporal_and_node_correlation
```

The implementation sets:

```text
causationEstablished = false
```

This is important: tickets occurring on the same node within a time window are potentially related, but temporal correlation does not establish causation.

### 11.6 RCA Prompt Output Contract

The model is instructed to return JSON with these eight top-level keys:

```json
{
  "status": "...",
  "probableRootCause": null,
  "confidence": "low",
  "supportingEvidence": [],
  "alternativeHypotheses": [],
  "evidenceGaps": [],
  "recommendedValidation": [],
  "summary": "..."
}
```

The allowed status values are:

```text
probable_cause_identified
insufficient_evidence
```

The allowed confidence values are:

```text
low
medium
high
```

The expected nested structures are:

| Field | Expected structure |
|---|---|
| `supportingEvidence` | Items containing `source`, `evidence`, `relevance` |
| `alternativeHypotheses` | Items containing `hypothesis`, `evidence` |
| `recommendedValidation` | Items containing `check`, `purpose` |
| `evidenceGaps` | Evidence-gap information |
| `summary` | Text summary |

### 11.7 Actual RCA Validation

The implementation does not perform a complete JSON Schema validation.

It performs the following checks:

1. Parses the model response using `json.loads`.
2. Requires the parsed value to be a dictionary.
3. Checks that all required top-level keys are present.
4. Checks that `status` is one of the allowed values.
5. Checks that `confidence` is one of the allowed values.
6. If status is `insufficient_evidence`, requires `probableRootCause` to be null.

The validator does **not** enforce:

- That there are exactly eight keys.
- That extra top-level keys are rejected.
- That all values have the expected Python types.
- That nested evidence objects contain every expected field.
- That `probableRootCause` is non-null when status is `probable_cause_identified`.
- That the evidence is factually grounded in the retrieved documents.
- That recommended validation steps are supported by the evidence.

The prompt requests grounded analysis, but that is not the same as programmatic evidence validation.

### 11.8 Fallback Behavior

The implementation has guarded fallback behavior.

If the current ticket timestamp is missing, the RCA pipeline returns an insufficient-evidence result.

If there is no historical context and no linked current resolution, it also returns an insufficient-evidence result.

If the model returns invalid JSON or fails the implemented validation checks, the pipeline returns a safe fallback response rather than asserting a root cause.

The fallback uses:

```text
status = insufficient_evidence
probableRootCause = null
confidence = low
```

The fallback also includes empty evidence/recommendation collections and an explanatory evidence gap.

### 11.9 RCA Response Structure

The successful outer response includes:

```text
ticketNumber
alarmType
status
probableRootCause
confidence
supportingEvidence
alternativeHypotheses
evidenceGaps
recommendedValidation
summary
recordedResolution
historicalIncidents
relatedTickets
correlationFindings
```

The `recordedResolution` object includes:

```text
rootCause
actionsTaken
resolution
verificationResults
shellCommandsUsed
shellScriptUsed
escalation
additionalNotes
```

Not every early-return path has the same outer response shape. In particular, early insufficient-evidence and invalid-output responses may omit `recordedResolution`.

Consumers of the RCA API should therefore not assume that every return path contains an identical set of fields unless the API layer normalizes the response.

### 11.10 RCA Eligibility

Ticket eligibility rules such as requiring a closed ticket or a particular priority are API-level behavior, not established by the RCA module alone.

The `rca.py` implementation should not be credited with enforcing a `CLOSED` status or `P1`/`P2` restriction unless the relevant API route explicitly performs those checks.

---

## 12. RAG Evaluation Architecture

The evaluation subsystem measures RAG output quality using an LLM-as-a-judge approach.

It is implemented in:

```text
backend/evaluate.py
```

### 12.1 Evaluation Flow

```text
Evaluation Request
       |
       v
Load evaluation_dataset.json
       |
       v
For each test case
       |
       v
Run troubleshoot_alarm()
       |
       v
Collect recommendation and retrieved context
       |
       v
Truncate context for judge input
       |
       v
Send query, context, answer, and ground truth
to judge LLM
       |
       v
Parse metric scores
       |
       v
Calculate average metrics
       |
       v
Calculate overall score
       |
       v
Save RAGEvaluation record
       |
       v
Commit PostgreSQL transaction
```

### 12.2 Dataset Location

The dataset path is constructed relative to the evaluation script:

```python
DATASET_PATH = os.path.join(
    os.path.dirname(__file__),
    "evaluation_dataset.json"
)
```

Therefore, the expected file location is:

```text
backend/evaluation_dataset.json
```

If the file is missing, `load_dataset()` raises `FileNotFoundError`.

The existence of the dataset in the repository or deployment must be checked separately.

### 12.3 Dataset Structure

Each test case contains:

| Field | Purpose |
|---|---|
| `scenario` | Input arguments used to run troubleshooting |
| `question` | Query given to the judge |
| `ground_truth` | Expected troubleshooting answer or actions |

The scenario is passed to `troubleshoot_alarm()` using keyword argument expansion.

It must therefore provide the required arguments expected by that function:

- `alarm_type`
- `node`
- `occurrence_count`
- `users_impacted`
- `severity`
- `threshold_breached`
- `impact_level`
- `priority`
- `assigned_team`

### 12.4 Generator and Judge Models

The evaluation subsystem uses a different model from the troubleshooting generator.

| Purpose | Model |
|---|---|
| Troubleshooting recommendation generation | `openai/gpt-oss-20b` |
| Evaluation judge | `openai/gpt-oss-120b` |

The judge is accessed through `ChatGroq` and configured with temperature `0`.

The distinction is important: the model recorded as `model_used` in an evaluation record is the judge model, not the troubleshooting generation model.

### 12.5 Evaluation Input

For each test case, the evaluation code:

1. Runs the real `troubleshoot_alarm()` function.
2. Extracts the generated `recommendation`.
3. Extracts the `retrieved_context`.
4. Truncates the context to the first 1,500 characters for the judge.
5. Sends the question, context, generated answer, and ground truth to the judge.

### 12.6 Evaluation Metrics

The judge scores four metrics on a scale of 1 to 5.

| Metric | Meaning |
|---|---|
| `context_precision` | Relevance of retrieved context |
| `faithfulness` | Whether the answer is supported by the retrieved context |
| `answer_relevancy` | Relevance of the answer to the question |
| `ground_truth_match` | Agreement with the expected answer |

The overall score is calculated from the average metric scores.

These are LLM-generated judgments, not deterministic measurements.

### 12.7 Score Parsing and Failure Handling

The judge is instructed to return JSON containing the metric values.

The implementation removes the expected leading JSON code-fence marker and trailing code fence before parsing.

If JSON parsing fails, the case is skipped.

Other per-case exceptions are also caught and logged, allowing evaluation processing to continue.

The implementation does not strictly validate every score's type or enforce that each score is within the 1–5 range. Missing metric values are read using a default of zero.

### 12.8 Aggregate Score Calculation

The denominator used for average metric calculations is the total number of dataset cases:

```text
num_cases = len(dataset)
```

It is not the number of successfully scored cases.

Therefore, skipped or failed cases effectively contribute zero to the aggregate average.

The implementation does not maintain a separate successful-case denominator for the aggregate score.

An empty dataset can also result in division by zero.

### 12.9 Evaluation Persistence

The evaluation result is stored in a `RAGEvaluation` record.

The documented fields include:

- Timestamp.
- Metric values.
- Overall score.
- Number of dataset cases.
- Model used.
- Detailed per-case results.

The record is committed to PostgreSQL. If the database operation fails, the transaction is rolled back and the exception is re-raised.

### 12.10 Evaluation Limitations

The current evaluation design has several limitations:

- Scores depend on an LLM judge.
- Failed cases are not excluded from the aggregate denominator.
- Metric values are not strictly range-validated.
- An empty dataset is not safely handled by the average calculation.
- No confidence intervals are calculated.
- No repeated-run variance is calculated.
- No inter-judge agreement measurement is implemented.
- The evaluation is only as reliable as the quality of its dataset and ground-truth answers.

The evaluation subsystem should therefore be treated as a practical quality-monitoring mechanism, not as a formal proof of RAG correctness.

---

## 13. React Frontend Architecture

The frontend is a React application that provides the user interface for the Alarm Automation system.

Its documented responsibilities include:

- Displaying dashboard and ticket information.
- Displaying notifications.
- Allowing supported ticket operations.
- Triggering AI troubleshooting and RCA functionality.
- Providing settings and account-related interfaces.
- Providing administrative interfaces.
- Collecting operator resolution information where the ticket-close workflow supports it.

### 13.1 Logical Frontend Structure

```text
React Application
       |
       v
App.jsx
       |
       +-----------------------------+
       |              |              |
       v              v              v
  Dashboard       Notifications    Settings
       |
       +-----------------------------+
       |              |              |
       v              v              v
    Tickets         AI RCA       Admin Pages
                                    |
                         +----------+----------+
                         |                     |
                         v                     v
                  User Management        RAG Evaluation
```

The actual page and component structure should be verified against the current frontend source.

### 13.2 API Communication

The documented frontend API layer includes:

```text
frontend/src/api/api.js
```

This layer centralizes API communication and includes the documented authenticated request wrapper.

Its responsibilities include:

- Sending HTTP requests to the backend.
- Including credentials where required for cookie-based authentication.
- Handling authentication-related request failures.
- Attempting token refresh when the access token is rejected.
- Retrying the original request after a successful refresh.

### 13.3 Navigation and Role-Based UI

The sidebar provides navigation to the application's pages.

The documented navigation includes user-facing pages and administrative pages.

Administrative navigation may be conditionally displayed based on the current user's role.

This is a presentation-layer restriction. The backend must still enforce authorization for administrative API operations.

### 13.4 Resolution Questionnaire

The documented ticket-close workflow includes an option to submit resolution information.

The intended flow is:

```text
Operator selects Close Ticket
          |
          v
Close-ticket interface
          |
          +----------------------------+
          |                            |
          v                            v
Skip resolution details        Submit resolution details
          |                            |
          v                            v
Close ticket request           Close ticket request
without details                 with resolution data
          |                            |
          +-------------+--------------+
                        |
                        v
                  FastAPI Backend
                        |
                        v
                Ticket / Incident Update
```

The exact form fields, validation, request payload, and database side effects must be verified against the current frontend and backend ticket-close implementation.

### 13.5 Frontend Persistence

React state is used for the user interface.

The frontend is not the authoritative persistence layer for tickets, users, historical incidents, or evaluation records. Those records are maintained by the backend and its persistence layer.

---

## 14. Ticket Resolution and Knowledge Feedback

The architecture includes a feedback path in which operator-recorded resolution information can become historical incident data.

This provides a way to make resolved incidents available to future retrieval.

### 14.1 Logical Feedback Flow

```text
Ticket Created
      |
      v
Operator Reviews Ticket
      |
      v
Troubleshooting
      |
      v
Operator Performs Resolution
      |
      v
Resolution Information Captured
      |
      v
Historical Incident Record
      |
      v
PostgreSQL
      |
      v
RAG Index Refresh / Rebuild
      |
      v
Future Troubleshooting Requests
      |
      v
Historical Resolution May Be Retrieved
```

### 14.2 Historical Incident Information

The historical incident model contains fields used to describe the incident and its resolution, including:

- Alarm type.
- Observed symptoms.
- Root cause.
- Actions taken.
- Commands used.
- Scripts used.
- Resolution.
- Verification results.
- Escalation information.
- Additional notes.
- Source information.

These records can contribute to future troubleshooting and RCA retrieval.

### 14.3 Important Qualification

The database-backed historical incident structure and the RAG fingerprint/index-building behavior are documented in the supplied backend implementation.

However, the exact event sequence that creates a historical incident during ticket closure, and the exact point at which the vector store is refreshed, must be verified against the current ticket-close API implementation.

A successful database insert does not automatically prove that the vector index was refreshed successfully.

### 14.4 What the Feedback Loop Actually Means

The feedback loop allows recorded incident information to become part of the knowledge available to future retrieval.

It does not mean that the language model is being fine-tuned or that its model weights are updated after each ticket closure.

The system improves the information available to retrieval; it does not perform automatic model training.

---

## 15. External Integrations

### 15.1 Groq

The backend uses the Groq integration for language-model calls.

The documented model responsibilities are:

| Use case | Model |
|---|---|
| Troubleshooting generation | `openai/gpt-oss-20b` |
| RCA generation | Uses the backend RCA LLM configuration |
| RAG evaluation judge | `openai/gpt-oss-120b` |

The exact model configuration for RCA should be checked against the current `rca.py` implementation rather than assumed to be identical to the troubleshooting configuration.

### 15.2 HuggingFace

The RAG implementation uses HuggingFace embeddings for vector representations.

The embedding model is used when building or rebuilding the FAISS index.

### 15.3 BGE Reranker

The retrieval pipeline uses:

```text
BAAI/bge-reranker-v2-m3
```

The reranker scores retrieved query-document pairs and helps order the candidate chunks before parent-document retrieval.

### 15.4 FAISS

FAISS provides vector similarity search for the indexed knowledge chunks.

It is a retrieval component, not the relational application database.

### 15.5 Grafana

The frontend documentation describes a Grafana navigation entry.

Grafana is an external monitoring application rather than an internal ticket-processing component.

The previously documented dashboard URL was:

```text
http://localhost:3000/d/adkpk4d/alarm-automation-operations
```

This URL is environment-specific. It should not be treated as a production endpoint without checking the current frontend configuration and deployment environment.

The actual monitoring data sources and dashboards are outside the scope of the application architecture unless their configuration is separately documented.

---

## 16. End-to-End Data Flows

### 16.1 Ticket Generation and Persistence

```text
Alarm Input
    |
    v
Java Alarm Processing
    |
    v
Ticket and Notification Generation
    |
    v
JSON Output
    |
    +---------------------------+
    |                           |
    v                           v
tickets.json              notifications.json
    |                           |
    +-------------+-------------+
                  |
                  v
          Python Migration
                  |
                  v
              PostgreSQL
                  |
                  v
            FastAPI Backend
                  |
                  v
           React Frontend
                  |
                  v
           Operator Actions
                  |
                  v
            FastAPI Backend
                  |
                  v
              PostgreSQL
```

### 16.2 Troubleshooting Flow

```text
Operator Opens Ticket
        |
        v
Frontend Sends Troubleshooting Request
        |
        v
FastAPI
        |
        v
troubleshoot_alarm()
        |
        v
Read / Use Persistent Vector Store
        |
        v
MMR Retrieval
        |
        v
Cross-Encoder Reranking
        |
        v
Parent Document Retrieval
        |
        v
Build Troubleshooting Context
        |
        v
Groq LLM
        |
        v
Recommendation
        |
        v
Frontend Displays Result
```

### 16.3 RCA Flow

```text
Operator Requests RCA
        |
        v
FastAPI RCA Endpoint
        |
        v
RCA Pipeline
        |
        +-----------------------------+
        |             |               |
        v             v               v
Current Ticket   Historical       Related Tickets
                 Incidents
        |             |               |
        +-------------+---------------+
                      |
                      v
              Evidence Preparation
                      |
                      v
              Evidence Gap Detection
                      |
                      v
                 RCA LLM
                      |
                      v
              JSON Validation
                      |
            +---------+---------+
            |                   |
            v                   v
       Valid Output        Safe Fallback
            |                   |
            +---------+---------+
                      |
                      v
                RCA Response
                      |
                      v
                 Frontend
```

### 16.4 RAG Evaluation Flow

```text
Admin Starts Evaluation
        |
        v
Evaluation Dataset
        |
        v
Run Troubleshooting for Each Case
        |
        v
Collect Recommendation and Context
        |
        v
LLM Judge
        |
        v
Metric Scores
        |
        v
Aggregate Score
        |
        v
PostgreSQL
        |
        v
Evaluation History
        |
        v
Frontend
```

### 16.5 Knowledge Ingestion and Retrieval

```text
Legacy Knowledge Files
        |
        v
Knowledge Migration
        |
        v
PostgreSQL Knowledge Records
        |
        v
Fingerprint Calculation
        |
        v
FAISS Index Construction / Loading
        |
        v
Vector Retrieval
        |
        v
Reranking
        |
        v
Parent Context Retrieval
        |
        v
Troubleshooting / RCA
```

---

## 17. Runtime Dependencies and Deployment

The application consists of several components with different runtime dependencies.

### 17.1 Logical Runtime Components

| Component | Runtime responsibility |
|---|---|
| Java application | Alarm processing and JSON generation |
| Python migration scripts | File ingestion into PostgreSQL |
| FastAPI | Backend API and AI workflows |
| PostgreSQL | Persistent relational storage |
| FAISS | Vector retrieval storage |
| React/Vite | Frontend development and build tooling |
| Groq API | Language-model inference |
| HuggingFace model dependencies | Embedding generation |
| BGE reranker dependencies | Retrieval reranking |
| Grafana | External monitoring interface, if configured |

### 17.2 Local Development Topology

The previously documented development configuration uses these ports:

| Component | Previously documented port |
|---|---:|
| React/Vite | 5173 |
| FastAPI | 8001 |
| PostgreSQL | 5432 |
| Grafana | 3000 |

These are documented development values, not guaranteed deployment values.

Actual ports depend on the current configuration, environment variables, and runtime commands.

### 17.3 Persistent Storage

The RAG implementation uses a local FAISS persistence directory.

The previously documented path is:

```text
data/faiss_index/
```

The documented persisted files are:

```text
data/faiss_index/
├── index.faiss
├── index.pkl
├── parent_store.pkl
└── fingerprint.json
```

The exact path must match the current `FAISS_INDEX_DIR` configuration in `backend/rag.py`.

The index directory must remain available across application restarts if the application is expected to reuse its persisted vector index.

### 17.4 Production Considerations

The following are deployment considerations, not claims that the current system already implements them:

- Reverse proxy in front of the frontend and backend.
- HTTPS for browser-to-backend communication.
- Secure cookie configuration for HTTPS deployments.
- Persistent storage for the FAISS index.
- PostgreSQL backup and recovery.
- Centralized logging.
- Monitoring and alerting.
- Environment-based configuration for service URLs.
- Secret management for database credentials and API keys.
- A defined process for rebuilding or recovering the vector index.

---

## 18. Architectural Characteristics and Limitations

### 18.1 Separation Between Java and Python

Java generates ticket and notification data.

Python migration scripts import that data into PostgreSQL.

The architecture therefore uses file-based integration rather than assuming direct Java-to-PostgreSQL communication.

### 18.2 PostgreSQL Is the Relational Persistence Layer

PostgreSQL stores application records, knowledge records, and evaluation history.

FAISS is a derived vector-search structure and should not be treated as a replacement for the relational database.

### 18.3 Ticket State and Event History Are Different

Ticket records represent current ticket information.

Ticket events represent recorded actions or changes.

This separation allows the application to retain event history independently of the current ticket state.

### 18.4 RAG Uses Retrieval, Not Model Fine-Tuning

The troubleshooting pipeline retrieves relevant knowledge and provides it to an LLM.

The historical incident feedback path adds information to the retrieval knowledge base. It does not update the underlying LLM's model weights.

### 18.5 Parent-Child Retrieval

The vector store indexes child chunks while retaining parent documents.

This allows the retrieval system to search smaller text segments and return larger parent-level context.

### 18.6 Persistent Index and Fingerprint

The RAG implementation uses a fingerprint to determine whether the stored knowledge representation has changed.

When the fingerprint matches, the implementation can load the persisted index and parent store.

When it differs, the vector store is rebuilt from the database-backed knowledge records.

The fingerprint only reflects the fields explicitly included in its calculation.

### 18.7 RAG and RCA Are Separate Pipelines

RAG troubleshooting generates recommendations based on retrieved knowledge.

RCA combines historical evidence, recorded resolution information, and related-ticket correlation to analyze a probable root cause.

They share knowledge and retrieval infrastructure but have different objectives and response structures.

### 18.8 Temporal Correlation Is Not Causation

The RCA pipeline identifies related tickets using node and time-window conditions.

This can provide useful evidence of potentially related events, but it does not prove that one alarm caused another.

### 18.9 RCA Validation Is Limited

The RCA pipeline checks basic response structure and selected enum/null conditions.

It does not perform full nested schema validation or independently prove that every model-generated claim is supported by retrieved evidence.

### 18.10 Evaluation Is LLM-Based

The evaluation subsystem uses an LLM judge to score RAG output.

Its results are useful for comparative monitoring but are not deterministic ground-truth measurements.

The current denominator behavior also means skipped cases affect aggregate scores.

### 18.11 Authentication Uses Both JWTs and Server-Side State

Access-token validation is based on JWT verification.

Refresh-token persistence and revocation introduce server-side state.

Therefore, describing the complete authentication system as purely stateless is inaccurate.

### 18.12 Frontend Authorization Is Not Sufficient

Hiding admin pages in React improves the user interface but does not protect backend resources.

Authorization must be enforced by backend dependencies or equivalent server-side checks.

### 18.13 Local Paths and URLs Are Environment-Specific

Paths such as `data/faiss_index/` and URLs such as `http://localhost:3000` are configuration details.

They should not be treated as universal production values.

---

## 19. Source Verification Notes

This document distinguishes between implementation details that are supported by the available source code and details that still require confirmation.

### 19.1 Verified Implementation Areas

The following behavior has been checked against the supplied backend implementation:

| Area | Verified details |
|---|---|
| RAG fingerprint | SHA-256 inputs, version marker, included fields, and ordering |
| Parent splitting | 50-hyphen delimiter and parent-block behavior |
| Child chunking | Chunk size 400 and overlap 50 |
| Retrieval | MMR, reranking, parent resolution, and retrieval limits |
| Reranker | `BAAI/bge-reranker-v2-m3` |
| Troubleshooting model | `openai/gpt-oss-20b` |
| RCA retrieval | Historical retrieval limit and alarm-type filtering |
| RCA correlation | Same-node, different-alarm tickets within the 30-minute window |
| RCA evidence gaps | Exact fields checked for missing resolution evidence |
| RCA output | Required model keys and successful outer response fields |
| RCA validation | Actual JSON parsing, required-key, enum, and null checks |
| Evaluation dataset | Relative path and expected case structure |
| Evaluation judge | `openai/gpt-oss-120b` |
| Evaluation metrics | Four metrics and their aggregation behavior |
| Evaluation persistence | `RAGEvaluation` record creation and database commit |

### 19.2 Details Requiring Confirmation Against Other Source Files

The following items should be checked before treating this document as a complete source-code audit:

| Area | Source file(s) to inspect | What to confirm |
|---|---|---|
| Java alarm processing | Java reader, grouper, analyzer, and generator classes | Actual processing order, grouping conditions, thresholds, and priority rules |
| JSON serialization | Java JSON writer classes | Exact output fields and serialization behavior |
| Ticket migration | `backend/migrate_json_to_db.py` | Exact deduplication rules, transaction behavior, and conflict handling |
| Knowledge migration | `migrate_knowledge.py` | Exact parsing and deduplication rules |
| Database schema | `backend/models.py` | Actual columns, relationships, constraints, and cascade behavior |
| API routes | `backend/main.py` and router modules | Exact endpoints, methods, request/response schemas, and authorization |
| Startup lifecycle | FastAPI application startup code | When RAG resources are initialized |
| Ticket closure | Ticket-close endpoint and related service code | Whether and when historical incidents are created |
| Index refresh | Ticket-close code and RAG refresh function | Whether refresh is invoked after resolution capture |
| Authentication | `backend/auth.py` and `backend/security.py` | Exact token lifetimes, cookie settings, reset behavior, and security controls |
| Frontend routing | `frontend/src/App.jsx` | Actual routes and page access behavior |
| Frontend API layer | `frontend/src/api/api.js` | Exact token refresh and retry behavior |
| Sidebar | `frontend/src/components/Sidebar.jsx` | Actual navigation and role-based visibility |
| Grafana integration | Frontend Grafana component and configuration | Current URL and deployment target |
| Deployment | Environment files and deployment configuration | Actual ports, paths, services, and runtime topology |

### 19.3 Configuration Values That Must Not Be Assumed

The following values are environment-dependent or require checking against the current source:

- Grafana dashboard URL.
- FastAPI port.
- React/Vite port.
- PostgreSQL port.
- FAISS index directory.
- Database connection string.
- Groq API configuration.
- Authentication cookie security settings.
- Evaluation dataset availability.

### 19.4 Documentation Rule

When implementation behavior changes, update this document from the source code.

Do not treat a previous documentation statement as proof that the implementation still behaves that way.

---

## 20. Changelog

### Version 3.0 — November 03, 2026

**Corrected**

- Separated verified implementation behavior from details requiring source verification.
- Clarified the relationship between PostgreSQL and FAISS.
- Corrected the description of authentication as JWT-based with server-side refresh-token persistence.
- Corrected the description of RCA validation.
- Documented the actual RCA evidence-gap checks.
- Documented the actual temporal correlation conditions.
- Clarified that temporal correlation does not establish causation.
- Documented the RCA response structure and early-return differences.
- Documented the RAG fingerprint inputs and parent-child retrieval design.
- Documented the retrieval limits and reranking process.
- Documented the actual evaluation dataset path, judge model, metrics, and aggregate denominator behavior.
- Clarified that RAG evaluation uses an LLM judge and is not deterministic.

**Removed or qualified**

- Removed unsupported claims of complete source synchronization.
- Qualified Java processing details that require Java source verification.
- Qualified migration behavior that requires migration-script verification.
- Qualified API-level RCA eligibility restrictions.
- Qualified ticket-close and vector-store refresh behavior.
- Qualified exact deployment ports and local service URLs.
- Qualified Grafana URL and FAISS directory as configuration-dependent values.
- Removed the claim that the LLM itself learns or is retrained after every ticket resolution.

**Retained**

- The overall Java → JSON → Python migration → PostgreSQL data flow.
- The FastAPI and React application architecture.
- The PostgreSQL-backed knowledge architecture.
- The RAG, RCA, and evaluation subsystem descriptions.
- The external Grafana integration concept.

---

## Disclaimer

This project is a personal/educational prototype.

Alarm data, thresholds, team mappings, runbooks, diagnostic commands, ticketing workflows, and notification behavior should be treated as demonstration functionality unless independently validated.

This architecture is not a representation of Ericsson production architecture, Ericsson internal procedures, or approved network operational instructions.
