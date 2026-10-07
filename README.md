# Alarm Automation & AI Troubleshooting Assistant

An end-to-end telecom operations automation platform that processes network alarms, groups related events, analyzes operational impact, calculates ticket priority, generates tickets and notifications, persists operational data in PostgreSQL, and provides an AI-assisted troubleshooting interface for network operators.

The project combines a **Java-based deterministic alarm-processing pipeline**, a **FastAPI backend**, **PostgreSQL database**, **React/Vite dashboard**, and a **Retrieval-Augmented Generation (RAG) troubleshooting system**.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [System Architecture](#system-architecture)
- [End-to-End Workflow](#end-to-end-workflow)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Java Alarm Processing Pipeline](#java-alarm-processing-pipeline)
- [JSON Output and PostgreSQL Migration](#json-output-and-postgresql-migration)
- [Backend](#backend)
- [Database Design](#database-design)
- [Authentication and Security](#authentication-and-security)
- [Ticket Lifecycle](#ticket-lifecycle)
- [Notification System](#notification-system)
- [AI Troubleshooting and RAG](#ai-troubleshooting-and-rag)
- [Frontend](#frontend)
- [API Endpoints](#api-endpoints)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Project](#running-the-project)
- [Running the Java Pipeline](#running-the-java-pipeline)
- [Running the Backend](#running-the-backend)
- [Running the Frontend](#running-the-frontend)
- [Automatic CSV Monitoring](#automatic-csv-monitoring)
- [Database Migration](#database-migration)
- [Example Workflow](#example-workflow)
- [Human-in-the-Loop Design](#human-in-the-loop-design)
- [Current Limitations](#current-limitations)
- [Future Improvements](#future-improvements)
- [Disclaimer](#disclaimer)

---

# Overview

Telecom networks continuously generate alarms related to connectivity, power, radio conditions, hardware, CPU utilization, temperature, and other operational conditions.

Manually analyzing every alarm can result in:

- duplicated investigations
- delayed ticket creation
- inconsistent prioritization
- increased operator workload
- difficulty identifying historical incidents
- slower troubleshooting

This project automates the initial alarm-analysis workflow while keeping important operational decisions under human control.

The system currently performs the following workflow:

```text
Network Alarm CSV
       │
       ▼
Java Alarm Processing
       │
       ├── Read alarms
       ├── Group related alarms
       ├── Analyze impact
       ├── Calculate priority
       ├── Generate ticket drafts
       ├── Create P4 tickets
       └── Generate notifications
       │
       ▼
JSON Files
       │
       ├── output/tickets.json
       └── output/notifications.json
       │
       ▼
JSON → PostgreSQL Migration
       │
       ▼
PostgreSQL
       │
       ▼
FastAPI Backend
       │
       ├── Authentication
       ├── Ticket management
       ├── Ticket lifecycle
       ├── Notifications
       └── AI troubleshooting
       │
       ▼
React + Vite Dashboard
```

The Java pipeline and FastAPI backend are therefore separate stages in the current implementation. The Java application currently writes operational data to JSON, while `migrate_json_to_db.py` imports that data into PostgreSQL.

---

# Key Features

## Alarm Processing

- Reads telecom alarms from CSV input
- Groups alarms by network node and alarm type
- Calculates occurrence counts
- Determines users impacted
- Evaluates severity
- Detects threshold breaches
- Calculates operational impact
- Assigns initial ticket priority
- Assigns operational teams based on alarm type

## Ticket Automation

- Generates ticket drafts
- Creates P4 tickets for human review
- Generates persistent ticket numbers
- Preserves existing ticket numbers when the same node/alarm combination already exists
- Writes tickets to JSON
- Imports tickets into PostgreSQL

## Ticket Lifecycle Management

Operators can:

- view tickets
- filter tickets
- inspect ticket details
- acknowledge notifications
- change ticket priority
- upgrade priority
- downgrade priority
- close tickets
- reopen tickets
- provide a reason when reopening a ticket

## Notification Management

The system generates notification events for ticket activity such as:

- ticket creation
- priority upgrade
- priority downgrade
- ticket closure
- ticket reopening

Notifications are derived from `TicketEvent` records in the backend.

## Authentication

The application supports:

- user registration
- login
- logout
- session validation
- password reset
- password hashing
- session expiration
- session revocation
- login rate limiting
- registration rate limiting
- password-reset rate limiting

## AI Troubleshooting

The application provides an AI-assisted troubleshooting workflow using:

- telecom runbooks
- diagnostic shell-command references
- historical incidents
- vector search
- embeddings
- reranking
- Groq-hosted LLM inference

The AI provides recommendations to the operator but does **not automatically execute shell commands or perform ticket actions**.

---

# System Architecture

```mermaid
flowchart TD

    A[Telecom Alarm CSV] --> B[Java Alarm Processing Pipeline]

    B --> B1[Alarm Reader]
    B1 --> B2[Alarm Grouper]
    B2 --> B3[Impact Analyzer]
    B3 --> B4[Priority Calculator]
    B4 --> B5[Ticket Draft Generator]
    B5 --> B6[Ticket Creator]
    B6 --> B7[Notification Generator]

    B6 --> C[output/tickets.json]
    B7 --> D[output/notifications.json]

    C --> E[JSON to PostgreSQL Migration]
    D --> E

    E --> F[(PostgreSQL)]

    F --> G[FastAPI Backend]

    G --> G1[Authentication]
    G --> G2[Ticket APIs]
    G --> G3[Notification APIs]
    G --> G4[Ticket Lifecycle APIs]
    G --> G5[RAG Troubleshooting API]

    G5 --> H[Knowledge Base]

    H --> H1[Telecom Runbooks]
    H --> H2[Shell Commands]
    H --> H3[Historical Incidents]

    H --> I[FAISS Vector Store]
    I --> J[Hugging Face Embeddings]
    I --> K[FlagReranker]
    K --> L[Groq LLM]

    G --> M[React + Vite Frontend]

    M --> M1[Dashboard]
    M --> M2[Ticket Table]
    M --> M3[Notifications]
    M --> M4[Authentication]
    M --> M5[Ticket Actions]
    M --> M6[AI Troubleshooting]
```

---

# End-to-End Workflow

The current implementation consists of several distinct stages.

## Stage 1 — Alarm Input

Alarm information is stored in:

```text
data/alarm.csv
```

The Java application reads this file and converts each row into an `alarm` object.

---

## Stage 2 — Alarm Grouping

Related alarms are grouped using:

```text
node + alarmType
```

For example:

```text
NODE-101 + HIGH_CPU
NODE-101 + HIGH_CPU
NODE-101 + HIGH_CPU
```

becomes one alarm group.

This allows repeated alarms for the same network condition to be analyzed together.

---

## Stage 3 — Impact Analysis

Each alarm group is analyzed to determine:

- occurrence count
- users impacted
- highest severity
- whether a threshold was breached
- impact level
- earliest alarm timestamp

The current impact rules include:

```text
Users impacted >= 1000
        → HIGH

Users impacted >= 100 AND occurrences >= 2
        → HIGH

Users impacted >= 100
        → MEDIUM

Occurrences >= 3
        → MEDIUM

Threshold breached
        → LOW

Otherwise
        → LOW
```

---

## Stage 4 — Priority Calculation

The current Java priority calculator intentionally creates:

```text
P4
```

tickets for all automatically generated tickets.

The reason depends on the calculated impact:

- HIGH impact → P4 ticket for human review and escalation
- MEDIUM impact → P4 ticket for human review
- LOW impact → P4 ticket for verification or closure

This is intentional in the current implementation.

The system does not automatically create P1/P2/P3 tickets during the Java processing stage.

Operators can later change the priority through the dashboard.

---

## Stage 5 — Ticket Draft Generation

The system creates ticket drafts containing information such as:

- node
- alarm type
- occurrence count
- users impacted
- severity
- threshold status
- impact level
- priority
- assigned team
- status
- reason
- creation timestamp

Teams are assigned according to alarm type.

Current mappings include:

| Alarm Type | Assigned Team |
|---|---|
| `S1_LINK_DOWN` | Transport |
| `POWER_FAILURE` | Power |
| `HIGH_CPU` | Platform |
| `VSWR_HIGH` | Radio |
| `CELL_UNAVAILABLE` | Radio |
| `HIGH_TEMPERATURE` | Hardware |
| Other | Network Operations |

---

## Stage 6 — Ticket Creation

The Java `ticketCreator` creates actual tickets from the drafts.

Ticket numbers use the format:

```text
AL-10001
AL-10002
AL-10003
...
```

Existing tickets are read from:

```text
output/tickets.json
```

The system attempts to preserve an existing ticket number for the same:

```text
node + alarmType
```

combination.

---

## Stage 7 — Notification Generation

For every generated ticket, a notification is created.

A typical notification message is:

```text
New P4 ticket created for HIGH_CPU on NODE-101
```

Notifications are written to:

```text
output/notifications.json
```

---

# JSON Output and PostgreSQL Migration

An important part of the current architecture is that **Java does not directly write to PostgreSQL**.

The current data flow is:

```text
Java
  │
  ├── output/tickets.json
  └── output/notifications.json
           │
           ▼
migrate_json_to_db.py
           │
           ▼
PostgreSQL
```

## Ticket JSON

The Java pipeline writes:

```text
output/tickets.json
```

using Gson.

## Notification JSON

The Java pipeline writes:

```text
output/notifications.json
```

also using Gson.

## Database Migration

The migration script:

```text
backend/migrate_json_to_db.py
```

reads both JSON files and imports the information into PostgreSQL.

During migration it:

1. loads ticket JSON
2. loads notification JSON
3. creates missing teams
4. creates tickets
5. maps ticket numbers to database records
6. converts notification records into `TicketEvent` records
7. prevents duplicate events
8. commits the transaction

Therefore, PostgreSQL becomes the backend application's operational data source after migration.

---

# Backend

The backend is implemented using **FastAPI**.

Its responsibilities include:

- authentication
- session management
- database access
- ticket retrieval
- ticket updates
- priority changes
- closing tickets
- reopening tickets
- acknowledging notifications
- notification generation from ticket events
- AI troubleshooting

The backend uses:

```text
FastAPI
SQLAlchemy
PostgreSQL
Pydantic
pwdlib
```

---

# Database Design

The database is implemented using SQLAlchemy ORM.

The main entities include:

```text
Team
Ticket
TicketEvent
User
UserSession
PasswordResetToken
AuthRateLimit
```

## Team

Stores operational teams.

Example:

```text
Transport
Power
Platform
Radio
Hardware
Network Operations
```

---

## Ticket

Stores operational ticket information including:

- ticket number
- node
- alarm type
- occurrence count
- users impacted
- severity
- threshold status
- impact level
- priority
- assigned team
- status
- reason
- creation time
- update time
- closure time
- reopen time

---

## TicketEvent

Stores ticket lifecycle events.

Examples include:

```text
TICKET_CREATED
PRIORITY_UPGRADE
PRIORITY_DOWNGRADE
TICKET_CLOSED
TICKET_REOPENED
```

Ticket events provide the historical record used to build notification information.

---

## User

Stores application users.

User information includes:

- full name
- username
- email
- password hash
- active status
- creation timestamp
- update timestamp

---

## UserSession

Stores authenticated application sessions.

Session tokens are hashed before being stored.

---

## PasswordResetToken

Stores password reset token information and expiration state.

---

## AuthRateLimit

Stores authentication-related rate-limit information.

This is used to limit repeated:

- login attempts
- registration attempts
- password-reset requests

---

# Authentication and Security

The application uses server-side sessions rather than storing authentication state in browser local storage.

The authentication flow is:

```text
React Login Form
       │
       ▼
POST /auth/login
       │
       ▼
FastAPI
       │
       ├── Verify password
       ├── Check rate limit
       ├── Create session
       └── Set alarmops_session cookie
       │
       ▼
React Application
```

The session cookie is:

```text
alarmops_session
```

The cookie is configured with:

- HttpOnly
- SameSite=Lax
- configurable Secure flag
- 8-hour maximum age

Password hashing uses `pwdlib` with the recommended password hashing configuration.

Session tokens and password-reset tokens are hashed before being stored in the database.

---

# Ticket Lifecycle

The ticket lifecycle is operator-driven.

```text
             ┌─────────────┐
             │    OPEN     │
             └──────┬──────┘
                    │
          ┌─────────┼─────────┐
          │         │         │
          ▼         ▼         ▼
     Priority     Ack       Close
       Change      Event       │
          │                   ▼
          │              ┌─────────┐
          │              │ CLOSED  │
          │              └────┬────┘
          │                   │
          │                 Reopen
          │                   │
          └───────────────────▼
                              OPEN
```

## Priority Changes

The backend supports both:

```text
PRIORITY_UPGRADE
```

and:

```text
PRIORITY_DOWNGRADE
```

For example:

```text
P4 → P3
```

is an upgrade.

While:

```text
P2 → P3
```

is a downgrade.

---

## Closing a Ticket

An operator can close an open ticket.

The backend:

1. changes status to `CLOSED`
2. records `closed_at`
3. creates a `TICKET_CLOSED` event

---

## Reopening a Ticket

A closed ticket can be reopened.

The operator must provide:

- new priority
- reopen reason

The backend:

1. changes status to `OPEN`
2. updates the priority
3. records `reopened_at`
4. creates a `TICKET_REOPENED` event

---

# Notification System

Notifications are event-based.

The database stores ticket events in:

```text
ticket_events
```

The `/notifications` endpoint converts those events into notification objects for the frontend.

For example:

```text
TicketEvent
     │
     ├── event_type
     ├── priority
     ├── previous_priority
     ├── new_priority
     ├── reason
     ├── status
     └── timestamp
             │
             ▼
       Notification API
             │
             ▼
        React Dashboard
```

The frontend periodically refreshes notifications.

This is **periodic polling**, not WebSocket/SSE-based real-time streaming.

---

# AI Troubleshooting and RAG

The project includes an AI-assisted troubleshooting system based on Retrieval-Augmented Generation.

The knowledge base currently contains:

```text
knowledge/
├── telecom_runbooks.txt
├── shell_commands.txt
└── historical_incidents.txt
```

These files provide three different types of operational knowledge.

## Runbooks

Contain troubleshooting procedures for telecom alarms.

## Shell Commands

Contain diagnostic commands that an operator may use.

## Historical Incidents

Contain previous operational incidents and their resolutions.

---

# RAG Pipeline

The current RAG pipeline works approximately as follows:

```text
Knowledge Base
     │
     ▼
Load Documents
     │
     ▼
Split Documents into Parent Blocks
     │
     ▼
Create Child Chunks
     │
     ▼
Generate Embeddings
     │
     ▼
FAISS Vector Store
     │
     ▼
MMR Retrieval
     │
     ▼
FlagEmbedding Reranker
     │
     ▼
Retrieve Relevant Parent Documents
     │
     ▼
Groq LLM
     │
     ▼
Troubleshooting Recommendation
```

---

# Embeddings

The vector store uses:

```text
BAAI/bge-large-en-v1.5
```

through Hugging Face embeddings.

Embeddings are normalized before being stored in FAISS.

---

# Vector Store

The project uses:

```text
FAISS
```

for vector similarity search.

The documents are divided into smaller child chunks using:

```text
RecursiveCharacterTextSplitter
```

with:

```text
chunk_size = 400
chunk_overlap = 50
```

Parent documents are retained so that the system can retrieve a relevant child chunk and then return the complete parent context.

---

# Retrieval

The system uses Maximum Marginal Relevance (MMR) retrieval to obtain a diverse set of candidate chunks.

The retrieved candidates are then reranked using:

```text
BAAI/bge-reranker-v2-m3
```

through `FlagReranker`.

The highest-ranked results are used as context for the LLM.

---

# LLM

The troubleshooting assistant uses:

```text
Groq
```

through `ChatGroq`.

The configured model is:

```text
openai/gpt-oss-20b
```

with:

```text
temperature = 0
```

The model receives:

- ticket information
- retrieved runbook information
- diagnostic commands
- historical incidents

and generates an operational troubleshooting recommendation.

---

# AI Safety Rules

The troubleshooting prompt explicitly instructs the model to:

- use only retrieved commands
- not invent commands
- not modify shell commands
- not automatically execute commands
- use historical incidents as supporting evidence
- avoid assuming historical resolutions are always correct
- explicitly report insufficient knowledge when the knowledge base does not contain enough information

The system therefore provides **operator assistance rather than autonomous command execution**.

---

# Frontend

The frontend is implemented using:

```text
React
Vite
Lucide React
Custom CSS
```

The frontend communicates with the FastAPI backend using the browser `fetch()` API.

The Vite development server proxies backend API routes to:

```text
http://localhost:8001
```

The configured proxy routes are:

```text
/auth
/tickets
/notifications
/troubleshoot
```

This allows the browser to communicate through the frontend origin while the Vite development server forwards API requests to FastAPI.

---

# Frontend Features

The dashboard currently contains:

- login
- registration
- forgot password
- password reset
- dashboard
- ticket table
- ticket filtering
- ticket search
- ticket details
- ticket priority changes
- close ticket
- reopen ticket
- notification panel
- notification acknowledgement
- AI troubleshooting modal
- settings
- dark mode
- sidebar collapse
- automatic refresh configuration
- toast notifications

---

# Automatic Refresh

The frontend periodically refreshes:

```text
Tickets
Notifications
```

The refresh interval is configurable in the application and persisted using browser `localStorage`.

The default refresh interval is:

```text
20 seconds
```

Automatic refresh can also be disabled from the application settings.

---

# API Endpoints

## Authentication

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/auth/register` | Register a new user |
| POST | `/auth/login` | Authenticate a user |
| POST | `/auth/logout` | Logout and revoke the session |
| GET | `/auth/me` | Return the currently authenticated user |
| POST | `/auth/forgot-password` | Generate a password reset request |
| POST | `/auth/reset-password` | Reset a password |

---

## Tickets

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/` | Backend root endpoint |
| GET | `/tickets` | Retrieve tickets |
| PUT | `/tickets/{ticket_number}/priority` | Change ticket priority |
| PUT | `/tickets/{ticket_number}/close` | Close a ticket |
| PUT | `/tickets/{ticket_number}/reopen` | Reopen a ticket |
| PUT | `/tickets/{ticket_number}/acknowledge` | Acknowledge the latest ticket event |

---

## Notifications

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/notifications` | Retrieve ticket-event notifications |

---

## AI Troubleshooting

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/troubleshoot/{ticket_number}` | Generate AI troubleshooting guidance for a ticket |

---

# Project Structure

The repository is organized into the Java processing layer, backend, frontend, knowledge base, database/migration utilities, and generated runtime files.

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
│   ├── migrate_json_to_db.py
│   ├── create_tables.py
│   ├── csv_watcher.py
│   ├── evaluate.py
│   └── test_db.py
│
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   ├── vite.config.js
│   │
│   └── src/
│       ├── App.jsx
│       ├── main.jsx
│       │
│       ├── api/
│       │   └── api.js
│       │
│       ├── components/
│       │   ├── ColumnFilter.jsx
│       │   ├── ForgotPassword.jsx
│       │   ├── Login.jsx
│       │   ├── Notifications.jsx
│       │   ├── Register.jsx
│       │   ├── ResetPassword.jsx
│       │   ├── RowActionsMenu.jsx
│       │   ├── Settings.jsx
│       │   ├── Sidebar.jsx
│       │   ├── SummaryCards.jsx
│       │   ├── TicketRow.jsx
│       │   ├── TicketTable.jsx
│       │   ├── ToastHost.jsx
│       │   └── Topbar.jsx
│       │
│       ├── modals/
│       │   ├── CloseTicketModal.jsx
│       │   ├── ConfirmReopenModal.jsx
│       │   ├── LogoutConfirmModal.jsx
│       │   ├── MessageModal.jsx
│       │   ├── ReopenTicketModal.jsx
│       │   ├── TicketDetailsModal.jsx
│       │   ├── TroubleshootModal.jsx
│       │   └── UpgradeModal.jsx
│       │
│       ├── hooks/
│       │   └── useModalA11y.js
│       │
│       ├── utils/
│       │   └── priorityHistory.js
│       │
│       ├── assets/
│       │   └── ericsson-logo.*
│       │
│       └── styles/
│           └── style.css
│
├── src/
│   ├── Main.java
│   │
│   ├── file/
│   │   ├── alarmFileReader.java
│   │   ├── notificationJsonWriter.java
│   │   └── ticketJsonWriter.java
│   │
│   ├── model/
│   │   ├── alarm.java
│   │   ├── alarmGroup.java
│   │   ├── impactResult.java
│   │   ├── priorityResult.java
│   │   ├── ticket.java
│   │   └── ticketDraft.java
│   │
│   └── processing/
│       ├── alarmGrouper.java
│       ├── impactAnalyzer.java
│       ├── notificationGenerator.java
│       ├── priorityCalculator.java
│       ├── ticketCreator.java
│       └── ticketDraftGenerator.java
│
├── data/
│   └── alarm.csv
│
├── knowledge/
│   ├── historical_incidents.txt
│   ├── shell_commands.txt
│   └── telecom_runbooks.txt
│
├── output/
│   ├── tickets.json
│   ├── notifications.json
│   └── ticket_drafts.json
│
├── lib/
│   └── gson-2.10.1.jar
│
├── out/
│   └── compiled Java classes
│
└── requirements.txt
```

> `node_modules/` and compiled runtime artifacts are shown only to explain the current project layout. They generally should not be committed to source control.

---

# Technology Stack

## Java Processing Layer

- Java
- Gson 2.10.1
- CSV-based input
- Object-oriented alarm processing

## Backend

- Python
- FastAPI
- Uvicorn
- SQLAlchemy
- PostgreSQL
- Pydantic
- python-dotenv
- pwdlib
- Argon2-compatible password hashing

## RAG / AI

- LangChain
- LangChain Community
- LangChain Hugging Face
- LangChain Groq
- Hugging Face embeddings
- FAISS
- FlagEmbedding
- BGE embeddings
- BGE reranker
- Groq

## Frontend

- React
- React DOM
- Vite
- `@vitejs/plugin-react`
- Lucide React
- Custom CSS
- Fetch API

---

# Installation

## Prerequisites

Install the following before running the project:

### Java

Java JDK with `javac` and `java` available in the terminal.

Verify:

```powershell
java -version
javac -version
```

---

### Python

Python 3.10+ is recommended.

Verify:

```powershell
python --version
```

---

### Node.js and npm

Install Node.js and npm.

Verify:

```powershell
node --version
npm --version
```

The current frontend dependency lockfile uses Vite 8 and requires a modern Node.js version.

---

### PostgreSQL

Install PostgreSQL and create a database for the application.

---

# Configuration

Create a `.env` file for the backend.

Example:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/alarm_automation

GROQ_API_KEY=your_groq_api_key

AUTH_COOKIE_SECURE=false
```

Replace the database credentials and API key with your own values.

## Important

Do not commit:

```text
.env
```

to the repository.

Do not expose:

```text
GROQ_API_KEY
DATABASE_URL
database passwords
```

in source control.

---

# Database Setup

After PostgreSQL is running and `DATABASE_URL` is configured, create the application tables:

```powershell
python -m backend.create_tables
```

The database schema is created from the SQLAlchemy models.

The tables include:

```text
teams
tickets
ticket_events
users
user_sessions
password_reset_tokens
auth_rate_limits
```

---

# Java Dependencies

The Java application currently uses:

```text
lib/gson-2.10.1.jar
```

The Gson JAR is already included in the repository.

---

# Running the Project

The project has three primary runtime components:

```text
1. Java alarm processor
2. FastAPI backend
3. React frontend
```

The JSON-to-database migration is a separate step between the Java processing stage and the backend database stage.

A typical development setup uses separate terminals.

---

# Running the Java Pipeline

From the project root, compile the Java source:

```powershell
javac -d out -cp "lib\*" .\src\model\*.java .\src\processing\*.java .\src\file\*.java .\src\Main.java
```

Then run:

```powershell
java -cp "out;lib\*" Main
```

The Java pipeline reads:

```text
data/alarm.csv
```

and generates:

```text
output/tickets.json
output/notifications.json
```

---

# Running the Backend

From the project root:

```powershell
uvicorn backend.main:app --port 8001 --reload
```

The backend will be available at:

```text
http://127.0.0.1:8001
```

FastAPI's interactive API documentation is available at:

```text
http://127.0.0.1:8001/docs
```

---

# Running the Frontend

Move into the frontend directory:

```powershell
cd frontend
```

Install dependencies:

```powershell
npm install
```

Start the Vite development server:

```powershell
npm run dev
```

The frontend normally runs at:

```text
http://localhost:5173
```

The Vite configuration forwards the backend API routes to:

```text
http://localhost:8001
```

---

# Frontend Proxy

The Vite development configuration proxies:

```text
/auth
/tickets
/notifications
/troubleshoot
```

to:

```text
http://localhost:8001
```

The frontend therefore uses relative API URLs such as:

```text
/auth/login
/tickets
/notifications
/troubleshoot/AL-10001
```

instead of hardcoding the backend address in every API request.

---

# Database Migration

After running the Java pipeline, the generated JSON files can be migrated into PostgreSQL.

Run:

```powershell
python -m backend.migrate_json_to_db
```

The migration script reads:

```text
output/tickets.json
output/notifications.json
```

and writes the corresponding records into PostgreSQL.

The migration creates:

- teams
- tickets
- ticket events

It also checks existing records to avoid creating duplicate tickets/events unnecessarily.

---

# Recommended Development Sequence

For the current implementation, the safest startup sequence is:

## 1. Start PostgreSQL

Make sure PostgreSQL is running.

---

## 2. Configure `.env`

Set:

```env
DATABASE_URL=...
GROQ_API_KEY=...
AUTH_COOKIE_SECURE=false
```

for local development.

---

## 3. Create database tables

```powershell
python -m backend.create_tables
```

---

## 4. Run Java processing

```powershell
javac -d out -cp "lib\*" .\src\model\*.java .\src\processing\*.java .\src\file\*.java .\src\Main.java

java -cp "out;lib\*" Main
```

---

## 5. Migrate generated JSON

```powershell
python -m backend.migrate_json_to_db
```

---

## 6. Start FastAPI

```powershell
uvicorn backend.main:app --port 8001 --reload
```

---

## 7. Start React

In another terminal:

```powershell
cd frontend
npm install
npm run dev
```

---

## 8. Open the dashboard

```text
http://localhost:5173
```

---

# Automatic CSV Monitoring

The project also contains:

```text
backend/csv_watcher.py
```

The watcher monitors:

```text
data/alarm.csv
```

for modifications.

When the CSV changes, it runs the compiled Java pipeline:

```text
CSV changed
    │
    ▼
csv_watcher.py
    │
    ▼
java -cp out + Gson Main
    │
    ▼
output/tickets.json
output/notifications.json
```

The watcher does **not** automatically perform the JSON → PostgreSQL migration.

Therefore, after the Java pipeline updates the JSON files, the migration step is still required if the new data needs to appear in PostgreSQL.

---

# Example Workflow

Suppose the CSV contains repeated alarms:

```text
NODE-101,HIGH_CPU,...
NODE-101,HIGH_CPU,...
NODE-101,HIGH_CPU,...
```

The system processes them as follows:

```text
1. Read alarms
       ↓
2. Group by NODE-101 + HIGH_CPU
       ↓
3. Calculate occurrence count
       ↓
4. Analyze impact
       ↓
5. Calculate priority
       ↓
6. Generate P4 ticket draft
       ↓
7. Assign Platform team
       ↓
8. Create AL-xxxxx ticket
       ↓
9. Generate notification
       ↓
10. Write tickets.json
       ↓
11. Write notifications.json
       ↓
12. Run migration
       ↓
13. Store ticket and event in PostgreSQL
       ↓
14. FastAPI exposes ticket to React
       ↓
15. Operator views ticket
       ↓
16. Operator can acknowledge, reprioritize,
    close, reopen, or troubleshoot
```

---

# Human-in-the-Loop Design

The project intentionally does not make the AI or alarm-processing pipeline fully autonomous.

The Java pipeline automatically performs deterministic processing:

```text
Alarm
  ↓
Grouping
  ↓
Impact Analysis
  ↓
Priority Calculation
  ↓
P4 Ticket Creation
```

The initial priority is deliberately P4.

A human operator can then decide whether the ticket should be:

```text
P4 → P3
P4 → P2
P4 → P1
```

or downgraded/closed according to the operational situation.

Similarly, the AI troubleshooting system provides recommendations but does not:

- execute shell commands
- automatically close tickets
- automatically reopen tickets
- automatically change ticket priority

This creates a human-in-the-loop operational model.

---

# Current Limitations

The following limitations reflect the current implementation.

## 1. Java and PostgreSQL are not directly connected

The Java pipeline currently writes:

```text
tickets.json
notifications.json
```

The database is populated separately using:

```text
migrate_json_to_db.py
```

There is currently no direct Java → PostgreSQL persistence layer.

---

## 2. Priority calculation initially creates only P4 tickets

The Java priority calculator currently returns:

```text
P4
```

for all automatically created tickets.

Priority escalation is performed later by the operator through the FastAPI/React application.

---

## 3. CSV monitoring does not automatically migrate data

`csv_watcher.py` triggers the Java pipeline when the CSV changes, but it does not automatically call the database migration script.

---

## 4. Notification delivery is application-based

Notifications are generated and displayed through the dashboard.

The system does not currently implement an external notification delivery service such as:

- email
- SMS
- PagerDuty
- Slack
- Microsoft Teams

---

## 5. Frontend updates use periodic polling

Tickets and notifications are refreshed at configurable intervals.

The current frontend does not use:

```text
WebSockets
Server-Sent Events
```

for live event streaming.

---

## 6. AI troubleshooting depends on the knowledge base

The AI assistant is intentionally constrained by the retrieved knowledge.

If sufficient information cannot be retrieved, it is instructed to report insufficient knowledge rather than invent operational procedures.

---

## 7. Password reset is development-oriented

The current password-reset implementation prints the generated reset URL in the backend console rather than sending it through an external email service.

---

## 8. Local authentication configuration

The authentication cookie has a configurable Secure flag.

For local HTTP development, the environment may need:

```env
AUTH_COOKIE_SECURE=false
```

For HTTPS deployments, the Secure setting should be configured appropriately.

---

# Future Improvements

Potential future improvements include:

## Direct Database Persistence

Replace the current:

```text
Java → JSON → Migration → PostgreSQL
```

workflow with:

```text
Java → PostgreSQL
```

or introduce a dedicated ingestion service.

---

## Automated JSON-to-Database Synchronization

If JSON remains part of the architecture, the CSV watcher could automatically trigger:

```text
Java pipeline
     ↓
JSON generation
     ↓
Database migration
```

instead of requiring the migration command separately.

---

## More Advanced Priority Automation

The priority engine could eventually calculate:

```text
P1
P2
P3
P4
```

directly from operational impact, SLA requirements, customer impact, and network criticality.

---

## Role-Based Access Control

Introduce different permissions for roles such as:

```text
Operator
Supervisor
Administrator
```

---

## Real-Time Notifications

Replace periodic polling with:

```text
WebSockets
```

or:

```text
Server-Sent Events
```

for real-time ticket and notification updates.

---

## External Notification Integrations

Integrate with operational communication systems such as:

```text
Email
Slack
Microsoft Teams
PagerDuty
```

---

## Better Audit History

Expand the existing ticket-event system into a dedicated audit/history interface showing:

- who performed an action
- previous state
- new state
- timestamp
- reason
- ticket history

---

## Production Deployment

A production deployment could include:

```text
Reverse Proxy
     ↓
React Frontend
     ↓
FastAPI
     ↓
PostgreSQL
```

with:

- HTTPS
- secure cookies
- environment-based configuration
- database migrations
- centralized logging
- monitoring
- backup and recovery

---

# Design Decisions

## Deterministic Processing Before AI

The initial alarm processing is implemented using deterministic Java logic rather than an LLM.

This makes:

- grouping predictable
- impact calculation explainable
- initial priority behavior reproducible
- ticket creation deterministic

AI is used primarily for troubleshooting assistance.

---

## Human Review Before Escalation

Automatically generated tickets start at P4 and are intended for human review.

This avoids allowing an automated system to make uncontrolled high-impact operational decisions.

---

## Event-Based Ticket History

Instead of storing notifications as an independent operational state, ticket activity is represented using `TicketEvent` records.

This provides a historical record of actions such as:

```text
Ticket Created
Priority Upgraded
Priority Downgraded
Ticket Closed
Ticket Reopened
```

The notification API derives dashboard notifications from these events.

---

## Retrieval Before Generation

The troubleshooting assistant retrieves relevant operational information before asking the LLM to generate a response.

The RAG pipeline uses:

```text
Runbooks
Commands
Historical Incidents
        ↓
Embeddings
        ↓
FAISS

Hugging Face sentence transformers

Groq LLM integration

Environment variables

Human-in-the-loop automation

Telecom alarm and incident workflow concepts

20. Disclaimer

This project is a personal/educational prototype.

The alarm data, thresholds, team mappings, runbooks, diagnostic
commands, ticketing workflow, and notification behavior are simulated
for demonstration purposes. They should not be interpreted as Ericsson
production architecture, Ericsson internal procedures, or approved
network operational instructions.#   A l a r m _ a u t o m a t i o n 
 
 