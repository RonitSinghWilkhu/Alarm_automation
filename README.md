Alarm Automation & AI Troubleshooting Assistant

A beginner-friendly telecom operations automation prototype that reduces
repeated alarm noise, automatically creates and manages incident
tickets, assigns responsible teams, generates team notifications, and
provides RAG-based AI troubleshooting guidance.

1. Project Overview

In a telecom operations environment, a large number of alarms can be
generated from network nodes. Repeated alarms can create unnecessary
operational noise and make it harder for teams to identify issues that
require attention.

This project demonstrates a simple automation workflow:

Read alarm data from a CSV file using Java.

Group repeated alarms by node and alarm type.

Analyze operational impact using occurrence count, affected users,
severity, and threshold breach.

Automatically create an initial P4 ticket.

Assign the ticket to a responsible operational team.

Store tickets and notifications as JSON.

Expose ticket operations through a FastAPI backend.

Display tickets and notifications in a web dashboard.

Allow an operator to upgrade or close tickets.

Use RAG + FAISS + Groq to provide alarm-specific troubleshooting
recommendations.

The design intentionally keeps the human operator in the loop: automatic
processing creates an initial P4 ticket, while escalation or closure
remains an operator action.

2. Architecture

                    SIMULATED ALARM DATA
                           |
                           v
                    data/alarm.csv
                           |
                           v
                    +--------------+
                    | Java Reader  |
                    +--------------+
                           |
                           v
                    Alarm Grouper
                           |
                           v
                    Impact Analyzer
                           |
                           v
                   Priority Calculator
                           |
                           v
                  Ticket Draft Generator
                           |
                           v
                     Ticket Creator
                           |
             +-------------+-------------+
             |                           |
             v                           v
       tickets.json               notifications.json
             |                           |
             +-------------+-------------+
                           |
                           v
                     FastAPI Backend
                           |
              +------------+------------+
              |                         |
              v                         v
       Ticket Management          RAG Endpoint
              |                         |
      +-------+-------+                 v
      |               |           FAISS Retrieval
      v               v                 |
   Upgrade          Close              v
                                    Runbooks
                                       +
                                    Commands
                                       |
                                       v
                                    Groq LLM
                                       |
                                       v
                              AI Recommendation
                                       |
                                       v
                              JavaScript Dashboard

3. Technology Stack

Java

Java file handling

CSV reading

Object-oriented models

Alarm grouping

Rule-based impact analysis

Priority calculation

Ticket creation

JSON file generation

Team assignment

Notification generation

Python

FastAPI

LangChain

FAISS

Hugging Face sentence-transformer embeddings

Groq LLM

python-dotenv

Frontend

HTML

CSS

JavaScript

Fetch API

Modal-based ticket interactions

Dark mode

Ticket filtering

Notification display

AI / RAG

sentence-transformers/all-MiniLM-L6-v2

FAISS vector store

Groq-hosted LLM

Telecom runbook knowledge

Diagnostic command knowledge

4. Project Structure

AlarmAutomation/
│
├── .env
│
├── data/
│   └── alarm.csv
│
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── script.js
│
├── backend/
│   ├── main.py
│   └── rag.py
│
├── knowledge/
│   ├── telecom_runbooks.txt
│   └── shell_commands.txt
│
├── output/
│   ├── tickets.json
│   ├── notifications.json
│   └── ticket_drafts.json
│
└── src/
    ├── Main.java
    │
    ├── file/
    │   ├── alarmFileReader.java
    │   ├── ticketJsonWriter.java
    │   └── notificationJsonWriter.java
    │
    ├── model/
    │   ├── alarm.java
    │   ├── alarmGroup.java
    │   ├── impactResult.java
    │   ├── priorityResult.java
    │   ├── ticketDraft.java
    │   └── ticket.java
    │
    └── processing/
        ├── alarmGrouper.java
        ├── impactAnalyzer.java
        ├── priorityCalculator.java
        ├── ticketDraftGenerator.java
        ├── ticketCreator.java
        └── notificationGenerator.java

5. Alarm Processing Workflow

5.1 Read alarms

Java reads the simulated CSV file and converts each row into an alarm
object.

Example alarm information includes:

Alarm ID

Node

Alarm type

Description

Severity

Threshold

Actual value

Users impacted

Timestamp

5.2 Group repeated alarms

Alarms are grouped using:

node + alarm type

For example:

NODE-101 + HIGH_CPU

Repeated alarms for the same node and alarm type become one alarm group.

This reduces repeated alarm noise before ticket creation.

5.3 Analyze impact

The prototype evaluates:

Occurrence count

Maximum users impacted

Highest severity in the group

Threshold breach

The current prototype rules are:

Users impacted >= 1000
    -> HIGH

Users impacted >= 100 AND occurrences >= 2
    -> HIGH

Users impacted >= 100
    -> MEDIUM

Occurrences >= 3
    -> MEDIUM

Threshold breached
    -> LOW

Otherwise
    -> LOW

These are prototype rules and are not Ericsson production severity
standards.

5.4 Calculate priority

Automatically generated tickets start at:

P4

The reason is to keep automatic escalation human-in-the-loop.

An operator can later upgrade the ticket to:

P3
P2
P1

through the dashboard.

5.5 Assign a team

The prototype maps alarm types to teams:

Alarm Type         Team

S1_LINK_DOWN       Transport
POWER_FAILURE      Power
HIGH_CPU           Platform
VSWR_HIGH          Radio
CELL_UNAVAILABLE   Radio
HIGH_TEMPERATURE   Hardware

Unknown alarm types are assigned to:

Network Operations

6. Ticket Management

Tickets are stored in:

output/tickets.json

Each ticket contains information such as:

Ticket number

Node

Alarm type

Occurrence count

Users impacted

Severity

Threshold breach

Impact level

Priority

Assigned team

Status

Reason

New automatically created tickets start as:

P4 + OPEN

Operator actions

The dashboard supports:

View ticket details

Upgrade priority

Close ticket

Filter open/closed tickets

View team notifications

Request AI troubleshooting guidance

7. Notification System

When a ticket is created, a notification is generated for the assigned
team.

Example:

New P4 ticket created for POWER_FAILURE on NODE-205

Notifications are stored in:

output/notifications.json

The notification lifecycle is:

PENDING
   |
   | ticket upgraded
   v
ACKNOWLEDGED
   |
   | ticket closed
   v
RESOLVED

These are simulated dashboard notifications rather than real email or
messaging integrations.

8. RAG Troubleshooting System

The AI component is designed as a troubleshooting assistant rather than
a ticket-priority decision maker.

Knowledge sources

The RAG system uses:

knowledge/telecom_runbooks.txt
knowledge/shell_commands.txt

The knowledge base contains simulated educational information for alarms
such as:

HIGH_CPU

POWER_FAILURE

HIGH_TEMPERATURE

S1_LINK_DOWN

VSWR_HIGH

CELL_UNAVAILABLE

RAG pipeline

Alarm / Ticket
      |
      v
Similarity Search
      |
      v
Alarm-specific runbook
+
Alarm-specific diagnostic commands
      |
      v
Groq LLM
      |
      v
Troubleshooting recommendation

Embeddings

The project uses:

sentence-transformers/all-MiniLM-L6-v2

The generated embedding size is:

384

Vector database

FAISS is used for similarity search.

Metadata is attached to chunks so that retrieval can be restricted by
alarm type.

For example:

alarm_type = HIGH_CPU

allows the retriever to prioritize HIGH_CPU knowledge.

9. Ticket-Aware Troubleshooting

The RAG assistant can receive ticket context such as:

Alarm Type
Node
Occurrence Count
Users Impacted
Severity
Threshold Breached
Impact Level
Priority
Assigned Team

This allows the recommendation to be more specific to the ticket rather
than simply answering a generic alarm question.

10. AI Safety Design

The AI layer is intentionally limited.

The LLM does not:

Decide the automatic ticket priority.

Automatically close tickets.

Automatically upgrade tickets.

Automatically execute shell commands.

Invent diagnostic commands for execution.

The LLM does:

Retrieve relevant knowledge.

Explain the alarm.

Recommend troubleshooting steps.

Display relevant diagnostic commands.

Provide escalation guidance.

Diagnostic commands are intended for operator review in this prototype.

11. FastAPI Endpoints

The backend exposes endpoints for the dashboard.

Health check

GET /

Get tickets

GET /tickets

Update ticket priority

PUT /tickets/{ticket_number}/priority

Example request:

{
    "priority": "P3"
}

Close ticket

PUT /tickets/{ticket_number}/close

Get notifications

GET /notifications

Get troubleshooting recommendation

GET /troubleshoot/{ticket_number}

The troubleshooting endpoint finds the ticket, extracts its context,
runs the RAG pipeline, and returns the generated recommendation.

12. Frontend Features

The dashboard provides:

Total ticket count

Open ticket count

High-impact ticket count

Closed ticket count

Ticket status filtering

Ticket details modal

Priority upgrade modal

Close-ticket confirmation modal

Team notifications

AI Troubleshooting Assistant

Dark mode

Scrollable troubleshooting recommendations

The Troubleshoot action follows:

Ticket
  ↓
Troubleshoot button
  ↓
FastAPI
  ↓
RAG
  ↓
Groq
  ↓
Recommendation
  ↓
Troubleshooting modal

13. Setup

13.1 Create and activate a virtual environment

Windows PowerShell:

python -m venv venv

Activate it:

.\venv\Scripts\Activate.ps1

13.2 Install Python dependencies

Install the packages used by the backend and RAG system.

Example:

pip install fastapi uvicorn langchain langchain-community langchain-text-splitters langchain-huggingface langchain-groq faiss-cpu sentence-transformers python-dotenv

The exact package versions can be pinned later in a requirements.txt
file.

13.3 Configure the Groq API key

Create:

.env

in the project root.

Add:

GROQ_API_KEY.......

Do not commit the real API key to Git.

14. Running the Project

Step 1 --- Run the Java automation

Compile the Java source files according to your local Java setup and
run:

To compile: javac -d out src/Main.java src/model/*.java src/processing/*.java src/file/*.java

To run: java -cp out Main

Main

This processes the alarm CSV and generates the ticket and notification
JSON files.

Expected output includes information such as:

Total alarms read: 15
Total alarm groups: 9

The exact ordering of groups can vary because Java grouping uses a
HashMap.

Step 2 --- Start FastAPI

From the project root:

uvicorn backend.main:app --port 8001

The API will be available at:

http://127.0.0.1:8001

Step 3 --- Start the frontend

Serve the frontend directory using a local web server.

For example:

python -m http.server 8000

Then open:

http://localhost:8000/frontend/

Keep the FastAPI server running on port 8001.

15. Example End-to-End Scenario

Suppose the alarm data contains multiple:

HIGH_CPU
NODE-101

alarms.

The Java processing pipeline:

15 raw alarms
      ↓
9 alarm groups
      ↓
Impact analysis
      ↓
P4 ticket
      ↓
Platform team
      ↓
Ticket JSON
      ↓
FastAPI
      ↓
Dashboard

An operator can then click:

Troubleshoot

and the application sends the ticket number to FastAPI.

FastAPI retrieves the ticket and passes its context to the RAG function.

The RAG system retrieves:

HIGH_CPU runbook
+
HIGH_CPU diagnostic commands

and sends the retrieved context to Groq.

The dashboard then displays a troubleshooting recommendation.

16. Design Decisions

Why group alarms?

To reduce repeated alarm noise and create a more meaningful operational
unit before ticket generation.

Why start every automatic ticket at P4?

To avoid uncontrolled automatic escalation and preserve human review.

Why use deterministic Java rules?

Priority and impact are operational decisions in this prototype. Keeping
them deterministic makes the behavior explainable and predictable.

Why use RAG?

The troubleshooting assistant should use the project's operational
knowledge instead of relying only on the LLM's general knowledge.

Why use FAISS?

FAISS provides a simple local vector similarity search mechanism
suitable for this prototype.

Why use an LLM after retrieval?

The retrieved runbook and command information can be converted into a
concise, operator-friendly recommendation.

17. Current Limitations

This is a prototype, so several production capabilities are
intentionally simplified.

Data persistence

Tickets and notifications are stored in JSON files rather than a
database.

Alarm source

Alarm data comes from a simulated CSV rather than a live network
management or monitoring system.

Ticketing integration

Tickets are simulated locally rather than being created in a production
incident-management platform.

Notifications

Notifications are simulated in JSON and displayed on the dashboard.

Knowledge base

The runbooks and commands are simulated educational content and should
not be treated as Ericsson internal operational documentation.

Security

The prototype does not implement production authentication,
authorization, audit logging, or secrets management beyond the local
.env configuration.

RAG indexing

The current prototype builds the vector store during the RAG
initialization process. A production version would normally persist and
reload the vector index.

Rules

Impact thresholds are prototype rules and should be replaced with
approved operational policies before production use.

18. Future Improvements

Possible next improvements include:

Persist the FAISS index to disk and reload it.

Add a database instead of JSON persistence.

Add authentication and role-based access.

Add audit logging for ticket changes.

Add configurable impact and priority rules.

Integrate a real monitoring/alarm source.

Add real notification integrations.

Add better structured output from the RAG pipeline.

Add automated tests.

Add Docker support.

Add metrics for alarm reduction and ticket automation.

Add historical ticket data for retrieval.

Add operator feedback on AI recommendations.

19. Skills Demonstrated

This project demonstrates practical experience with:

Java

Java file handling

Object-oriented programming

CSV processing

Collections and HashMap

Rule-based automation

JSON generation

Python

FastAPI

REST APIs

HTML

CSS

JavaScript

Fetch API

Frontend/backend integration

LangChain

RAG

Embeddings

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
network operational instructions.#   A l a r m _ a u t o m a t i o n  
 