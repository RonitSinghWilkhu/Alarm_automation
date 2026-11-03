# 🚨 Alarm Automation & AI Troubleshooting Assistant

<div align="center">

**A telecom operations automation prototype with alarm-to-ticket processing, AI-assisted troubleshooting, Root Cause Analysis (RCA), and historical incident retrieval**

[![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791.svg)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-Educational-orange.svg)]()

[Features](#-key-features) • [Architecture](#-system-architecture) • [Installation](#-installation) • [Usage](#-usage) • [AI Features](#-ai--rag-features)

</div>

---

## 📋 Overview

Alarm Automation is a telecom operations prototype that processes network alarm data into tickets, exposes ticket operations through a backend API, and provides a React-based operator interface.

It also provides AI-assisted troubleshooting and Root Cause Analysis (RCA). The RAG subsystem retrieves runbooks, command references, and historical incidents from a PostgreSQL-backed knowledge base and a persistent FAISS vector index. Operators can record resolution information so that incident knowledge can be made available to later retrieval.

The application is a demonstration system. It does not connect to or control a live telecom network.

### What It Does

```text
Network Alarm CSV
       |
       v
Java Alarm Processing
       |
       v
Ticket and Notification JSON
       |
       v
Python Migration Script
       |
       v
PostgreSQL
       |
       v
FastAPI Backend
       |
       v
React Operator Interface
       |
       +-------------------------+
       |                         |
       v                         v
RAG Troubleshooting             RCA
       |                         |
       +------------+------------+
                    |
                    v
             Operator Review
                    |
                    v
          Resolution Information
                    |
                    v
        Historical Incident Records
                    |
                    v
          Future Knowledge Retrieval
```

The Java-to-database handoff is file-based: Java generates JSON, and a Python migration script imports the JSON data into PostgreSQL. Java should not be described as writing directly to PostgreSQL.

### Project Goals

- Automate the initial processing of alarm records and ticket generation.
- Provide operators with AI-assisted troubleshooting recommendations.
- Make historical incident information retrievable for similar alarms.
- Support evidence-based RCA with explicit uncertainty and evidence gaps.
- Evaluate RAG responses using an LLM-as-a-judge process.
- Keep operational decisions under human control.

---

## ✨ Key Features

### 🎫 Ticket Management

- **Automated Ticket Generation:** Java processes alarm input and generates ticket data.
- **Priority Management:** The application supports ticket priority operations.
- **Lifecycle Tracking:** Ticket events record supported ticket actions.
- **SLA Information:** The frontend includes ticket/SLA-related information where configured.
- **Team Assignment:** Ticket data includes assigned-team information.

Exact priority rules, SLA calculations, and assignment mappings are implementation-specific. Check the current Java and backend source before relying on particular thresholds or mappings.

### 🔐 Authentication & Authorization

- JWT access and refresh tokens.
- HTTP-only authentication cookies.
- User and admin roles.
- Backend authorization for protected administrative operations.
- Refresh-token persistence and revocation.
- Password-reset functionality.
- Authentication rate-limiting support.

**Important:** The authentication system is not entirely stateless. Access tokens are validated as JWTs, while refresh-token records are stored server-side to support persistence and revocation. HTTP-only cookies alone do not provide complete CSRF protection.

### 🤖 AI-Powered Features

- **RAG Troubleshooting:** Retrieves relevant runbooks, command references, and historical incidents before generating a recommendation.
- **Root Cause Analysis:** Analyzes historical evidence, recorded resolution details, and potentially related tickets.
- **Historical Incident Retrieval:** Makes prior incident records available to retrieval.
- **Evidence Gap Reporting:** Identifies missing fields in recorded resolution information.
- **Temporal Correlation:** Identifies different alarm types on the same node within the RCA correlation window.
- **RAG Evaluation:** Uses a separate LLM judge to score troubleshooting results.

RAG and RCA are assistive features. Their outputs require operator review and do not establish a verified root cause automatically.

### 📊 Admin Features

- User administration.
- Role management, including last-admin protection where enforced by the backend.
- RAG evaluation execution and history.
- Grafana navigation link, if configured.

### 🎨 Frontend Experience

The React frontend provides the operator interface for dashboard, ticket, notification, settings, and administrative workflows. It includes the documented resolution questionnaire and authenticated API request handling.

Specific refresh intervals, filtering behavior, page routes, and component names should be checked against the current frontend source rather than assumed from this overview.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    A[Alarm CSV] --> B[Java Processing]
    B --> C[tickets.json and notifications.json]
    C --> D[Python JSON Migration]
    D --> E[(PostgreSQL)]

    F[Legacy Knowledge Files] --> G[Knowledge Migration]
    G --> E

    E --> H[FastAPI Backend]
    H --> I[Authentication and Authorization]
    H --> J[Ticket and Notification APIs]
    H --> K[RAG Troubleshooting]
    H --> L[RCA Pipeline]
    H --> M[RAG Evaluation]

    K --> N[Persistent FAISS Index]
    L --> N
    N --> O[HuggingFace Embeddings]
    N --> P[BGE Cross-Encoder Reranker]
    K --> Q[Groq LLM]
    L --> Q
    M --> R[Groq LLM Judge]

    H <--> S[React Frontend]
    S --> T[Operator Resolution Capture]
    T --> E
```

The diagram shows logical relationships. It does not mean all components run in one process or that every API request invokes the RAG, RCA, or evaluation subsystem.

### Architecture Highlights

1. **Java Processing:** Produces ticket and notification JSON from alarm input.
2. **JSON Handoff:** Separates Java processing from Python database ingestion.
3. **PostgreSQL:** Stores relational application data, knowledge records, and evaluation history.
4. **FastAPI:** Exposes application functionality and enforces backend authentication/authorization.
5. **RAG:** Uses FAISS retrieval, MMR, reranking, parent-document resolution, and LLM generation.
6. **RCA:** Combines historical incidents, current recorded resolution, and related-ticket correlation.
7. **Evaluation:** Uses an LLM judge to score troubleshooting results.
8. **Frontend:** Provides the operator and admin interface.

PostgreSQL is the primary relational persistence layer. FAISS is a derived vector-search structure; it is not a replacement for PostgreSQL.

---

## 🛠️ Technology Stack

### Backend

| Technology | Role |
|---|---|
| Python | Backend and AI workflow implementation |
| FastAPI | REST API framework |
| SQLAlchemy | ORM/database access |
| PostgreSQL | Relational persistence |
| PyJWT | JWT handling |
| `pwdlib[argon2]` | Password hashing support |
| LangChain | Document processing and retrieval orchestration |
| FAISS | Vector similarity search |
| HuggingFace embeddings | Text embeddings |
| FlagEmbedding | Cross-encoder reranking |
| Groq integration | LLM inference |

### Frontend

| Technology | Role |
|---|---|
| React | User interface |
| Vite | Development server and build tooling |
| Lucide React | Icons |
| CSS | Application styling |

### Data Processing

| Technology | Role |
|---|---|
| Java | Alarm processing and ticket/notification generation |
| Gson | JSON serialization, as documented for the Java layer |
| Python migration scripts | Import JSON and legacy knowledge into PostgreSQL |

### AI Model Configuration

The supplied backend implementation documents these model identifiers:

| Purpose | Model |
|---|---|
| Troubleshooting generation | `openai/gpt-oss-20b` |
| RAG evaluation judge | `openai/gpt-oss-120b` |
| Cross-encoder reranker | `BAAI/bge-reranker-v2-m3` |

The embedding model identifier and exact configuration should be checked against the current `backend/rag.py` constants. Do not infer it from the reranker name: embeddings and reranking are separate model roles.

---

## 📦 Installation

The following is a local-development setup outline. Confirm that paths, environment variable names, and commands match the current repository before using them in another environment.

### Prerequisites

- Java JDK compatible with the project's Java source.
- Python 3.10 or later.
- Node.js and npm compatible with the frontend dependencies.
- PostgreSQL.
- A Groq API key for LLM-backed features.

### Step 1: Clone the Repository

```bash
git clone https://github.com/RonitSinghWilkhu/Alarm_automation.git
cd Alarm_automation
```

### Step 2: Create the PostgreSQL Database

For example:

```bash
createdb alarm_automation
```

Or use `psql`:

```sql
CREATE DATABASE alarm_automation;
```

Use the database name and credentials configured by your environment.

### Step 3: Configure Environment Variables

Create the environment file expected by the backend configuration. The following names are examples from the documented setup; verify the current code for the exact names and defaults.

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/alarm_automation

# JWT authentication
JWT_SECRET_KEY=replace-with-a-long-random-secret
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7
JWT_ISSUER=alarmops-api
JWT_AUDIENCE=alarmops-client

# Groq
GROQ_API_KEY=your_groq_api_key

# Cookie security
AUTH_COOKIE_SECURE=false
```

For HTTPS production deployments, cookie security settings must be configured appropriately. Do not use the example secret in a real deployment.

Never commit `.env` files or credentials to version control. Ensure they are covered by `.gitignore`.

### Step 4: Install Python Dependencies

```bash
pip install -r requirements.txt
```

The documented dependency set includes packages for:

```text
fastapi
uvicorn
sqlalchemy
psycopg2-binary
PyJWT
pwdlib[argon2]
langchain
langchain-groq
faiss-cpu
sentence-transformers
FlagEmbedding
python-dotenv
```

The repository's current `requirements.txt` is authoritative. Install from that file rather than manually pinning versions based only on this list.

### Step 5: Install Frontend Dependencies

```bash
cd frontend
npm install
cd ..
```

### Step 6: Create Database Tables

The documented command is:

```bash
python -m backend.create_tables
```

The documented schema contains these ten tables:

- `teams`
- `tickets`
- `ticket_events`
- `users`
- `refresh_tokens`
- `password_reset_tokens`
- `auth_rate_limits`
- `knowledge_documents`
- `historical_incidents`
- `rag_evaluations`

Confirm the current `backend/models.py` and table-creation implementation if the schema has changed.

### Step 7: Import Legacy Knowledge

The documented knowledge migration command is:

```bash
python migrate_knowledge.py
```

This migration imports the legacy runbook, command-reference, and historical-incident data into PostgreSQL.

Run it according to the migration script's current behavior. Check its duplicate handling before rerunning it against an already populated database.

### Step 8: Import Generated Ticket Data

After Java has generated the JSON files, run the documented migration command:

```bash
python -m backend.migrate_json_to_db
```

This imports ticket and notification data into PostgreSQL. The exact input paths and deduplication behavior are defined by the migration script.

---

## 🚀 Usage

### Running the Application

The documented local workflow uses separate processes. Java processing and JSON migration are data-generation/import steps; the backend and frontend are the application services.

#### Terminal 1: Java Processing (Optional)

Run this when you need to generate ticket and notification JSON from the alarm input.

The original project instructions document this Windows-oriented compilation example:

```powershell
javac -d out -cp "lib\*" .\src\model\*.java .\src\processing\*.java .\src\file\*.java .\src\Main.java
java -cp "out;lib\*" Main
```

This command assumes the source folders and dependency JARs match the current project structure. Adjust it if the Java project layout has changed.

The documented input is:

```text
data/alarm.csv
```

The documented outputs are:

```text
output/tickets.json
output/notifications.json
```

#### Terminal 2: Migrate JSON to PostgreSQL

After the JSON files have been generated:

```bash
python -m backend.migrate_json_to_db
```

#### Terminal 3: FastAPI Backend

```bash
uvicorn backend.main:app --port 8001 --reload
```

The documented local backend address is:

```text
http://127.0.0.1:8001
```

The documented API documentation address is:

```text
http://127.0.0.1:8001/docs
```

These addresses assume the documented local port and default host binding.

#### Terminal 4: React Frontend

```bash
cd frontend
npm run dev
```

The documented Vite development address is:

```text
http://localhost:5173
```

The actual address is printed by Vite and may differ if the configured port is unavailable or changed.

### First-Time Setup

1. Start PostgreSQL.
2. Configure the backend environment variables.
3. Create the database tables.
4. Import the legacy knowledge data.
5. Generate and migrate ticket data if you want sample tickets.
6. Start the FastAPI backend.
7. Start the React frontend.
8. Open the frontend URL printed by Vite.
9. Register or sign in using the authentication flow configured by the application.

Do not assume that the first registered user automatically becomes an administrator unless the current registration implementation explicitly grants that role.

### Administrator Setup

The previous project instructions described promoting a user through a direct SQL update:

```sql
UPDATE users
SET role = 'admin'
WHERE username = 'your_username';
```

Use this only if the current schema uses the `users` table and `username` column, and only when you have authorized database-administrator access. Prefer the application's admin workflow once an administrator account exists.

---

## 📡 API Endpoints

The following endpoint paths were documented for the project. Verify them against the current FastAPI route definitions before treating this table as a definitive API contract.

### Authentication

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/auth/register` | Register a user |
| `POST` | `/auth/login` | Authenticate and set token cookies |
| `POST` | `/auth/refresh` | Refresh access authentication |
| `POST` | `/auth/logout` | Log out and revoke refresh-token state |
| `GET` | `/auth/me` | Retrieve the current user |
| `POST` | `/auth/forgot-password` | Start password-reset workflow |
| `POST` | `/auth/reset-password` | Reset password using reset credentials |

### Tickets

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/tickets` | Retrieve tickets |
| `PUT` | `/tickets/{id}/priority` | Change ticket priority |
| `PUT` | `/tickets/{id}/close` | Close a ticket, optionally with resolution data |
| `PUT` | `/tickets/{id}/reopen` | Reopen a ticket |
| `PUT` | `/tickets/{id}/acknowledge` | Acknowledge a notification or ticket event, as implemented |

### Notifications and AI

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/notifications` | Retrieve notifications |
| `GET` | `/troubleshoot/{id}` | Request AI troubleshooting |
| `GET` | `/rca/{id}` | Request RCA |

### Administration and Evaluation

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/auth/users` | List users |
| `PATCH` | `/auth/users/{id}/role` | Update a user's role |
| `POST` | `/api/evaluate/run` | Run RAG evaluation |
| `GET` | `/api/evaluate/history` | Retrieve evaluation history |

The exact authentication dependencies and role restrictions are defined by the backend. A frontend page being hidden does not replace server-side authorization.

---

## 🤖 AI & RAG Features

### 1. RAG Troubleshooting

When a user requests troubleshooting, the backend retrieves relevant knowledge and uses it as context for an LLM-generated recommendation.

```text
Ticket / Alarm Context
        |
        v
Build Retrieval Query
        |
        v
Metadata-Filtered FAISS MMR Search
        |
        v
Retrieve Child Chunks
        |
        v
Cross-Encoder Reranking
        |
        v
Resolve Parent Documents
        |
        v
Assemble Runbook + Commands + Historical Context
        |
        v
Groq LLM (openai/gpt-oss-20b, temperature 0)
        |
        v
Troubleshooting Recommendation
```

#### Retrieval Design

The supplied `backend/rag.py` implementation documents:

- A SHA-256 fingerprint over selected database knowledge fields.
- Persistent FAISS index and parent-document storage.
- Parent blocks separated by a 50-hyphen delimiter.
- Child chunks created with chunk size `400` and overlap `50`.
- MMR retrieval followed by BGE cross-encoder reranking.
- Parent-document resolution using `parent_id`.
- Alarm-type filtering for historical retrieval.

The retrieval helper's default `fetch_k` is `20`. The documented parent-result limits are:

| Retrieval category | Parent limit |
|---|---:|
| Runbooks | 2 |
| Command references | 2 |
| Historical troubleshooting | 3 |
| Historical RCA | 5 |

#### Important Safety Qualification

Retrieval grounding does not guarantee that every generated statement is correct.

The system should not be described as guaranteeing that the LLM "uses only retrieved commands" or "cannot hallucinate." The model generates text from the prompt and supplied context; it is not a deterministic command validator.

Treat generated diagnostic guidance as advisory. Operators must verify commands and procedures against approved operational documentation before use.

The application does not need to execute commands automatically to provide a recommendation. Do not execute generated commands without an explicit, separately implemented and authorized execution workflow.

### 2. Root Cause Analysis (RCA)

The RCA pipeline is separate from ordinary troubleshooting. It uses historical incident retrieval, the current ticket, any linked resolution record, and related-ticket correlation.

The supplied `backend/rca.py` implementation documents these stages:

1. Retrieve up to five relevant historical parent documents for the alarm type.
2. Load the current ticket.
3. Load the latest linked historical incident, if one exists.
4. Collect recorded resolution fields.
5. Identify potentially related tickets on the same node.
6. Build temporal correlation findings.
7. Detect missing resolution evidence.
8. Ask the LLM for a structured RCA response.
9. Parse and perform the implemented validation checks.
10. Return the RCA result or an insufficient-evidence fallback.

#### Temporal Correlation

The implementation searches for other tickets:

- On the same node.
- Within 30 minutes before or after the current ticket's creation time.
- With a different alarm type.
- Excluding the current ticket.

This identifies potentially related events. It does not prove causation.

The correlation finding explicitly records:

```text
evidenceType = temporal_and_node_correlation
causationEstablished = false
```

#### RCA Output

The model is instructed to return these top-level fields:

```json
{
  "status": "probable_cause_identified",
  "probableRootCause": "...",
  "confidence": "low",
  "supportingEvidence": [],
  "alternativeHypotheses": [],
  "evidenceGaps": [],
  "recommendedValidation": [],
  "summary": "..."
}
```

Allowed status values:

- `probable_cause_identified`
- `insufficient_evidence`

Allowed confidence values:

- `low`
- `medium`
- `high`

The successful outer RCA response also includes ticket information, recorded resolution, historical incidents, related tickets, and correlation findings.

#### Validation Limitations

The RCA implementation does not perform full JSON Schema validation. It:

- Parses the response with `json.loads`.
- Requires a dictionary.
- Checks that required top-level keys exist.
- Checks the status and confidence values.
- Requires `probableRootCause` to be null when status is `insufficient_evidence`.

It does not validate all nested item types, reject extra top-level keys, prove evidence grounding, or require a non-null root cause for `probable_cause_identified`.

If evidence is insufficient or the model output is invalid, the implementation can return an insufficient-evidence response with a null probable root cause and low confidence.

#### Eligibility

The RCA module itself should not be described as enforcing a closed-ticket or P1/P2 eligibility rule. Such restrictions, if present, must be confirmed in the API route that calls the RCA function.

### 3. Historical Incident Feedback

The knowledge model supports historical incident records containing information such as:

- Alarm type.
- Observed symptoms.
- Root cause.
- Actions taken.
- Shell commands and scripts used.
- Resolution.
- Verification results.
- Escalation.
- Additional notes.
- Source.

When operator resolution information is stored as a historical incident, it can become available to later retrieval after the vector index is rebuilt or refreshed.

This is retrieval-knowledge enrichment, not model fine-tuning. The LLM's weights are not updated when a ticket is closed.

The exact ticket-close-to-index-refresh call sequence must be checked in the current backend endpoint implementation.

### 4. RAG Evaluation

The evaluation subsystem is implemented in `backend/evaluate.py`.

It uses a separate judge model to score troubleshooting responses.

#### Dataset

The expected dataset path is:

```text
backend/evaluation_dataset.json
```

Each test case contains:

- `scenario`
- `question`
- `ground_truth`

The `scenario` is passed to `troubleshoot_alarm()` and must include its required keyword arguments.

#### Judge Model

```text
openai/gpt-oss-120b
```

The troubleshooting generator and evaluation judge are different models:

| Role | Model |
|---|---|
| Troubleshooting generation | `openai/gpt-oss-20b` |
| Evaluation judge | `openai/gpt-oss-120b` |

#### Metrics

| Metric | Meaning |
|---|---|
| `context_precision` | Relevance of retrieved context |
| `faithfulness` | Whether the response is supported by retrieved context |
| `answer_relevancy` | Alignment with the question |
| `ground_truth_match` | Agreement with expected answer |

The judge assigns scores on a 1–5 scale.

#### Evaluation Caveats

The implementation has important limitations:

- The scores are LLM judgments, not deterministic measurements.
- The judge receives at most the first 1,500 characters of retrieved context.
- Failed or skipped cases are not removed from the total-case denominator.
- Missing metric values default to zero.
- Score types and 1–5 ranges are not strictly validated.
- An empty dataset can cause division by zero.
- The evaluation record's `model_used` identifies the judge model.

Evaluation scores are useful for monitoring and comparison, but they should not be presented as a formal guarantee of correctness.

---

## 🗄️ Database Overview

The documented database contains ten tables grouped by responsibility.

### Operational Tables

| Table | Purpose |
|---|---|
| `teams` | Team information |
| `tickets` | Current ticket records |
| `ticket_events` | Ticket-related event history |

### Authentication Tables

| Table | Purpose |
|---|---|
| `users` | User accounts and roles |
| `refresh_tokens` | Persisted refresh-token state |
| `password_reset_tokens` | Password-reset state |
| `auth_rate_limits` | Authentication rate-limiting state |

### Knowledge and Evaluation Tables

| Table | Purpose |
|---|---|
| `knowledge_documents` | Runbook and command-reference documents |
| `historical_incidents` | Historical incident and resolution information |
| `rag_evaluations` | Evaluation metrics and detailed results |

The current SQLAlchemy models and actual database schema are authoritative if they differ from this overview.

### Important Relationships

The documented logical relationships include:

```text
Team 1 -------- * Ticket
Ticket 1 ------ * TicketEvent
Ticket 1 ------ * HistoricalIncident (optional link)

User 1 -------- * RefreshToken
User 1 -------- * PasswordResetToken
```

Actual foreign-key constraints and cascade behavior must be checked in `backend/models.py`.

---

## 📁 Project Structure

The following is a high-level structure based on the documented repository layout. Confirm filenames and folders against the current checkout.

```text
Alarm_automation/
│
├── backend/
│   ├── main.py
│   ├── auth.py
│   ├── security.py
│   ├── database.py
│   ├── models.py
│   ├── rag.py
│   ├── rca.py
│   ├── evaluate.py
│   ├── migrate_json_to_db.py
│   └── create_tables.py
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api/
│   │   │   └── api.js
│   │   ├── components/
│   │   └── modals/
│   └── package.json
│
├── src/                         # Java processing
│   ├── Main.java
│   ├── model/
│   ├── processing/
│   └── file/
│
├── data/
│   ├── alarm.csv
│   └── faiss_index/             # Persistent vector-store files
│
├── knowledge/                   # Legacy migration inputs
│   ├── telecom_runbooks.txt
│   ├── shell_commands.txt
│   └── historical_incidents.txt
│
├── output/                      # Intermediate Java output
│   ├── tickets.json
│   └── notifications.json
│
├── migrate_knowledge.py
├── requirements.txt
└── README.md
```

### FAISS Persistence

The RAG implementation uses a persistent index directory. The previously documented directory is:

```text
data/faiss_index/
```

The documented files are:

```text
data/faiss_index/
├── index.faiss
├── index.pkl
├── parent_store.pkl
└── fingerprint.json
```

Confirm the actual path against `FAISS_INDEX_DIR` in the current `backend/rag.py`. The index is derived data and should be recoverable from the underlying knowledge records.

---

## 🔒 Security Notes

The documented security design includes:

- JWT access and refresh tokens.
- HTTP-only cookies.
- Argon2 password hashing.
- Refresh-token persistence and revocation.
- Authentication rate-limiting support.
- Dummy password-hash verification for unknown users.
- Last-admin protection for role changes.
- CORS origin configuration.

Security qualifications:

- JWT access tokens do not make the entire authentication system stateless when refresh-token state is stored in PostgreSQL.
- HTTP-only cookies reduce JavaScript access to cookie values but do not, by themselves, prevent every CSRF scenario.
- CORS is not a substitute for authentication or authorization.
- Frontend role-based navigation is not a substitute for backend access control.
- Production deployments require secure secret handling, HTTPS, and appropriate cookie settings.

---

## 🧪 Testing and Verification

The following are practical manual test areas. They are test suggestions, not a claim that automated tests currently cover every case.

### 1. Authentication

- Register a user.
- Log in and inspect cookie behavior.
- Call a protected endpoint.
- Test access-token expiry and refresh behavior.
- Log out and verify refresh-token revocation.
- Test password-reset behavior.
- Verify that non-admin users cannot call admin-only endpoints.

### 2. Ticket Lifecycle

- Import generated ticket data.
- Retrieve tickets through the API.
- Change ticket priority.
- Close a ticket with and without resolution details, where supported.
- Reopen a ticket.
- Verify the corresponding event records.
- Verify notification behavior.

### 3. RAG Troubleshooting

- Test multiple alarm types.
- Confirm that alarm-specific retrieval filters are applied.
- Confirm runbook and command fallback behavior.
- Inspect retrieved parent documents.
- Verify the recommendation against the actual retrieved context.
- Test the no-knowledge-found path.
- Confirm that no generated command is executed automatically.

### 4. RCA

- Test a ticket with a linked historical incident.
- Test a ticket without a linked historical incident.
- Test missing ticket timestamp behavior.
- Inspect same-node, different-alarm correlation results.
- Test insufficient historical evidence.
- Test malformed or invalid LLM JSON.
- Confirm that correlation is not represented as proven causation.

### 5. RAG Evaluation

- Confirm `backend/evaluation_dataset.json` exists.
- Run evaluation with valid cases.
- Test malformed judge output.
- Inspect skipped-case behavior and aggregate denominator.
- Verify that evaluation records are persisted.
- Retrieve evaluation history.

### 6. Admin Features

- Access admin pages as an admin.
- Attempt admin API calls as a regular user.
- Change user roles.
- Verify last-admin protection.
- Run evaluation and inspect saved results.

---

## 🚧 Current Limitations

The following limitations are documented or follow directly from the described architecture. Confirm each one against the current checkout before treating it as an exhaustive list.

1. **File-based Java handoff:** Java generates JSON, and Python migration imports it; there is no direct Java-to-PostgreSQL integration in this documented flow.
2. **RAG generation is probabilistic:** Retrieved context does not guarantee that every generated statement is correct.
3. **RCA correlation is narrow:** The documented correlation logic is limited to the same node and a fixed 30-minute window.
4. **Correlation is not causation:** Temporal proximity alone cannot prove a causal relationship.
5. **RCA validation is partial:** The implementation does not enforce a complete nested JSON schema or programmatic evidence grounding.
6. **Evaluation is judge-dependent:** LLM scores are not deterministic.
7. **Evaluation denominator behavior:** Failed/skipped cases still affect the total-case denominator.
8. **Evaluation score validation:** Metric types and ranges are not strictly validated.
9. **Index consistency depends on refresh/rebuild:** A database update and a vector-index update are separate operations.
10. **Environment-specific configuration:** Local ports, paths, and external URLs must be configured for each deployment.
11. **Operational data is simulated:** This prototype is not connected to a production telecom network.

---

## 🔮 Possible Future Improvements

These are suggestions, not currently implemented features:

- [ ] Direct Java-to-database integration, if the file handoff becomes a bottleneck.
- [ ] WebSocket or Server-Sent Events for push-based updates.
- [ ] Email delivery for password-reset links.
- [ ] External notification integrations.
- [ ] Configurable RCA correlation windows.
- [ ] Cross-node correlation where supported by reliable topology data.
- [ ] Stronger RCA output validation using a formal schema.
- [ ] Evidence provenance checks for model-generated RCA claims.
- [ ] Evaluation handling that separates successful cases from failed cases.
- [ ] Strict evaluation score type and range validation.
- [ ] Repeated evaluation runs and confidence/variance reporting.
- [ ] Automated tests for migration idempotency and index refresh.
- [ ] Production deployment guide using containers and a reverse proxy.
- [ ] Centralized logs, metrics, and database/index backup procedures.

---

## 📚 Documentation

The repository's documentation directory may contain detailed references such as:

- **API Documentation** — API routes, request and response formats.
- **Authentication Documentation** — JWT flow, refresh tokens, and RBAC.
- **Database Documentation** — schema and relationships.
- **System Architecture** — high-level component architecture.
- **RAG Documentation** — retrieval, embeddings, reranking, and generation.
- **Frontend Documentation** — React structure and UI behavior.
- **Code Flow** — execution and data-flow diagrams.

---

## ⚠️ Disclaimer

This project is a **personal/educational prototype**. Alarm data, thresholds, team mappings, runbooks, diagnostic commands, ticketing workflows, and notification behavior are simulated for demonstration purposes.

---

## 📧 Contact

Project maintainer and contact details should be maintained by the repository owner. Avoid publishing personal contact information unless it is intentionally provided for public use.

---

## 🙏 Acknowledgments

The project uses and builds upon tools and libraries including:

- FastAPI.
- SQLAlchemy.
- PostgreSQL.
- LangChain.
- Hugging Face.
- FAISS.
- Groq.
- React.
- Vite.
- Gson.

