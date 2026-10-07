# Alarm Automation --- System Architecture

## 1. Document Purpose

This document describes the **current implemented architecture** of the
Alarm Automation project.

It documents the system as it currently operates rather than describing
a proposed or future architecture.

The main application flow is:

``` text
Alarm / Ticket Generation
        |
        v
      Java
        |
        v
  JSON Output Files
   |             |
   |             |
   v             v
tickets.json  notifications.json
        \       /
         \     /
          v   v
   Python Migration Script
          |
          v
      PostgreSQL
          |
          v
       FastAPI
          |
          v
    React Frontend
```

The system therefore uses a **file-based handoff between the Java
processing layer and the Python database layer**, while PostgreSQL is
the persistent datastore used by the backend API.

------------------------------------------------------------------------

## 2. High-Level Architecture

The application is divided into four major runtime/application layers:

1.  **Java processing and ticket generation layer**
2.  **JSON file / migration layer**
3.  **Python FastAPI backend and PostgreSQL persistence layer**
4.  **React frontend layer**

There is also an authentication layer and an AI/RAG troubleshooting path
inside the Python backend.

### High-Level Component View

``` text
+-------------------------------------------------------------+
|                     ALARM AUTOMATION                        |
+-------------------------------------------------------------+

   Java Processing Layer
   ---------------------
   Ticket generation
   Notification generation
            |
            v
   output/tickets.json
   output/notifications.json
            |
            v
   Python Migration Layer
   ----------------------
   migrate_json_to_db.py
            |
            v
   +-------------------+
   |    PostgreSQL     |
   |-------------------|
   | Team              |
   | Ticket            |
   | TicketEvent       |
   | User              |
   +-------------------+
            |
            v
   FastAPI Backend
   ----------------
   REST API
   Authentication
   Ticket operations
   Notifications
   Troubleshooting
            |
            v
   React Frontend
   ----------------
   Dashboard
   Notifications
   Settings
   Authentication UI
   Ticket modals
```

------------------------------------------------------------------------

# 3. Java Processing Layer

The Java layer is responsible for producing ticket and notification
data.

The Java application does **not directly persist the generated ticket
data into PostgreSQL** in the current implementation.

Instead, it serializes the generated objects into JSON files.

## 3.1 Ticket JSON Generation

The `ticketJsonWriter` class receives a list of `ticket` objects and
writes them to the configured JSON path.

The implementation uses Gson:

``` java
private final Gson gson =
    new GsonBuilder()
        .setPrettyPrinting()
        .create();
```

The `writeTickets()` method:

1.  Receives the list of tickets.
2.  Receives the target file path.
3.  Creates the parent directory if required.
4.  Opens a `FileWriter`.
5.  Serializes the ticket list using Gson.
6.  Writes the resulting JSON to the file.

The current migration process expects the ticket file at:

``` text
output/tickets.json
```

## 3.2 Notification JSON Generation

The `notificationJsonWriter` class creates notification records from the
generated tickets.

For each ticket, it creates a notification map containing fields such
as:

-   `ticketNumber`
-   `assignedTeam`
-   `message`
-   `status`
-   `eventType`
-   `timestamp`
-   `priority`
-   `alarmType`
-   `node`

For newly generated ticket notifications, the initial status is:

``` text
PENDING
```

and the event type is:

``` text
TICKET_CREATED
```

The notification list is then serialized using Gson.

The migration process expects the resulting file at:

``` text
output/notifications.json
```

------------------------------------------------------------------------

# 4. JSON File Handoff

The JSON files form the boundary between the Java processing layer and
the Python database layer.

``` text
Java
 |
 +----> output/tickets.json
 |
 +----> output/notifications.json
             |
             v
     migrate_json_to_db.py
```

This is an important architectural characteristic of the current
implementation.

The JSON files are **not the final runtime database**. They are an
intermediate persistence/handoff format used before the data is loaded
into PostgreSQL.

------------------------------------------------------------------------

# 5. Python JSON-to-PostgreSQL Migration Layer

The migration is implemented in:

``` text
migrate_json_to_db.py
```

The script reads:

``` text
output/tickets.json
output/notifications.json
```

and uses the application's SQLAlchemy database session to insert the
corresponding data into PostgreSQL.

## 5.1 Migration Process

The migration performs the following operations:

``` text
tickets.json
     |
     v
Load ticket records
     |
     v
Create/find Teams
     |
     v
Create/find Tickets
     |
     v
Build ticket-number -> Ticket mapping
     |
     v
Process notifications.json
     |
     v
Create TicketEvent records
     |
     v
Deduplicate existing events
     |
     v
Commit transaction
```

## 5.2 Team Creation

The migration first extracts unique `assignedTeam` values from the
ticket JSON.

For each team:

-   The database is queried for an existing team with the same name.
-   If it does not exist, a new `Team` record is created.
-   The resulting team objects are stored in a Python mapping.

This allows ticket records to reference the corresponding team.

## 5.3 Ticket Creation

The migration checks whether each ticket number already exists.

If the ticket already exists:

``` text
Existing Ticket -> Reuse
```

Otherwise:

``` text
JSON Ticket -> New Ticket database record
```

The ticket data mapped into the database includes values such as:

-   ticket number
-   node
-   alarm type
-   occurrence count
-   users impacted
-   severity
-   threshold breached
-   impact level
-   priority
-   assigned team
-   status
-   reason
-   created timestamp
-   closed timestamp
-   reopened timestamp

A mapping is maintained between:

``` text
ticketNumber -> Ticket database object
```

This mapping is then used while creating ticket events.

## 5.4 Ticket Event Creation

Notification records are converted into `TicketEvent` records.

The migration maps notification fields such as:

-   event type
-   previous priority
-   new priority
-   priority
-   reason
-   timestamp

to the corresponding database event fields.

Before inserting an event, the migration creates an event key using:

``` text
(ticket_id, event_type, timestamp)
```

Existing keys are collected and duplicate events are skipped.

This prevents the migration from repeatedly inserting the same event
when the JSON files contain an already-migrated notification.

## 5.5 Transaction Handling

The migration commits all changes after processing.

If an exception occurs:

``` text
rollback()
```

is performed and the exception is raised.

The database session is closed in the `finally` block.

------------------------------------------------------------------------

# 6. PostgreSQL Persistence Layer

PostgreSQL is the persistent datastore used by the FastAPI backend.

The backend uses SQLAlchemy models and sessions to access the database.

The currently observed application entities include:

``` text
User
Team
Ticket
TicketEvent
```

The exact column definitions and relationships are documented separately
in the Database Documentation.

## 6.1 Ticket

A `Ticket` represents the current state of an alarm-related service
ticket.

The API exposes ticket information including:

-   ticket number
-   node
-   alarm type
-   occurrence count
-   users impacted
-   severity
-   threshold breach
-   impact level
-   priority
-   assigned team
-   status
-   reason
-   created time
-   updated time
-   closed time
-   reopened time

## 6.2 Team

A `Team` represents the team assigned to tickets.

Tickets reference their assigned team through the database relationship.

## 6.3 TicketEvent

`TicketEvent` stores ticket history and notification-related state.

Examples of event types currently handled by the backend include:

``` text
TICKET_CREATED
PRIORITY_UPGRADE
PRIORITY_DOWNGRADE
TICKET_CLOSED
TICKET_REOPENED
```

The notification API builds its response from these events.

## 6.4 User

`User` is used by the authentication and authorization layer.

Protected API endpoints obtain the current authenticated user through
the backend security dependency.

------------------------------------------------------------------------

# 7. FastAPI Backend

The FastAPI application is implemented in:

``` text
main.py
```

The backend acts as the central application/API layer between the React
frontend and PostgreSQL.

Its responsibilities include:

-   authentication integration
-   ticket retrieval
-   ticket priority updates
-   ticket closing
-   ticket reopening
-   notification retrieval
-   notification acknowledgement
-   troubleshooting requests
-   database access
-   RAG resource initialization

The application also enables CORS for the configured frontend
development origins.

------------------------------------------------------------------------

# 8. REST API Layer

The React frontend communicates with the FastAPI backend through HTTP
requests.

The frontend API wrapper is implemented in:

``` text
frontend/src/api/api.js
```

The current API wrapper uses relative URLs:

``` text
API_BASE = ""
```

Therefore frontend requests are sent through the frontend origin /
configured development proxy.

The API calls include credentials where required so that the
authentication session cookie can be used.

------------------------------------------------------------------------

# 9. Authentication Architecture

Authentication is handled by the FastAPI backend and exposed to the
React frontend through authentication endpoints.

The frontend contains screens/components for:

``` text
Login
Register
Forgot Password
Reset Password
```

The frontend performs an authentication check when the application
starts.

The flow is:

``` text
React App
   |
   v
checkAuth()
   |
   v
FastAPI /auth/me
   |
   v
Authenticated?
   |
   +---- No ----> Login screen
   |
   +---- Yes ---> Main application
```

The backend uses a `get_current_user` dependency for protected
application endpoints.

The frontend sends credentials with relevant API requests.

------------------------------------------------------------------------

# 10. React Frontend Architecture

The frontend is implemented using React.

The main application component is:

``` text
App.jsx
```

`App.jsx` acts as the primary application coordinator.

It maintains application state for:

-   authentication
-   current user
-   tickets
-   notifications
-   loading state
-   backend availability
-   search
-   filters
-   theme
-   sidebar state
-   refresh configuration
-   active page
-   modal state
-   troubleshooting data
-   reopen data
-   toast notifications

## 10.1 Main Frontend Pages

The application currently switches between three primary pages:

``` text
Dashboard
Notifications
Settings
```

The active page is maintained by:

``` text
activePage
```

The application also supports authentication screens before the main
application is displayed.

------------------------------------------------------------------------

# 11. Dashboard Flow

The dashboard uses ticket data retrieved from the backend.

The simplified flow is:

``` text
React App
   |
   v
GET /tickets
   |
   v
FastAPI
   |
   v
PostgreSQL
   |
   v
Ticket records
   |
   v
React state
   |
   +----> SummaryCards
   |
   +----> TicketTable
```

The dashboard applies frontend filtering and search to the retrieved
ticket collection.

Ticket activity is also used when sorting tickets.

------------------------------------------------------------------------

# 12. Ticket Operations

Ticket operations follow the pattern:

``` text
React UI
   |
   v
api.js
   |
   v
FastAPI endpoint
   |
   v
SQLAlchemy / PostgreSQL
   |
   v
Ticket + TicketEvent update
   |
   v
API response
   |
   v
React state refresh/update
```

## 12.1 Priority Update

The frontend calls:

``` text
PUT /tickets/{ticket_number}/priority
```

The backend:

1.  Validates the requested priority.
2.  Finds the ticket.
3.  Rejects changes to a closed ticket.
4.  Determines whether the change is an upgrade or downgrade.
5.  Updates the ticket priority.
6.  Creates a corresponding `TicketEvent`.
7.  Commits the transaction.

The event type is:

``` text
PRIORITY_UPGRADE
```

or:

``` text
PRIORITY_DOWNGRADE
```

## 12.2 Close Ticket

The frontend calls:

``` text
PUT /tickets/{ticket_number}/close
```

The backend:

1.  Finds the ticket.
2.  Verifies it is not already closed.
3.  Sets the ticket status to `CLOSED`.
4.  Sets `closed_at`.
5.  Creates a `TICKET_CLOSED` event.
6.  Stores the event with status `RESOLVED`.
7.  Commits the transaction.

## 12.3 Reopen Ticket

The frontend calls:

``` text
PUT /tickets/{ticket_number}/reopen
```

with:

``` json
{
  "priority": "P1",
  "reason": "..."
}
```

The backend:

1.  Validates the priority.
2.  Requires a non-empty reason.
3.  Finds the ticket.
4.  Requires the current status to be `CLOSED`.
5.  Changes the ticket status to `OPEN`.
6.  Updates its priority.
7.  Stores `reopened_at`.
8.  Creates a `TICKET_REOPENED` event.
9.  Commits the transaction.

------------------------------------------------------------------------

# 13. Notification Architecture

Notifications are not maintained as an independent runtime table in the
observed API implementation.

Instead, the notification API reads `TicketEvent` records from
PostgreSQL and converts those events into notification response objects.

The flow is:

``` text
Ticket operation
      |
      v
TicketEvent
      |
      v
GET /notifications
      |
      v
FastAPI converts events
      |
      v
Notification JSON response
      |
      v
React Notifications component
```

The backend generates human-readable notification messages based on the
event type.

Examples include:

``` text
TICKET_CREATED
PRIORITY_UPGRADE
PRIORITY_DOWNGRADE
TICKET_CLOSED
TICKET_REOPENED
```

------------------------------------------------------------------------

# 14. Notification Acknowledgement

Acknowledgement is persisted against the latest ticket event.

The frontend calls:

``` text
PUT /tickets/{ticket_number}/acknowledge
```

The backend:

1.  Retrieves the ticket's events.
2.  Sorts them by timestamp descending.
3.  Selects the latest event.
4.  If the event is not already `ACKNOWLEDGED` or `RESOLVED`, changes
    its status to `ACKNOWLEDGED`.
5.  Commits the change when necessary.

After acknowledgement, the frontend fetches notifications again.

Therefore acknowledgement persistence is handled by PostgreSQL through
the `TicketEvent` record rather than only by React UI state.

------------------------------------------------------------------------

# 15. Troubleshooting / RAG Architecture

The backend includes an AI/RAG troubleshooting path.

The relevant backend imports include:

``` text
troubleshoot_alarm
_build_vector_store
_get_llm
_get_reranker
```

The troubleshooting API is:

``` text
GET /troubleshoot/{ticket_number}
```

The flow is:

``` text
React Ticket UI
      |
      v
GET /troubleshoot/{ticket_number}
      |
      v
FastAPI
      |
      v
Retrieve ticket from PostgreSQL
      |
      v
troubleshoot_alarm(...)
      |
      v
RAG / retrieval / reranking / LLM processing
      |
      v
Recommendation + historical incidents
      |
      v
React Troubleshoot Modal
```

The backend passes ticket attributes into the troubleshooting function,
including:

-   alarm type
-   node
-   occurrence count
-   users impacted
-   severity
-   threshold breach
-   impact level
-   priority
-   assigned team

The backend returns:

``` json
{
  "alarmType": "...",
  "recommendation": "...",
  "historicalIncidents": []
}
```

Detailed RAG internals are intentionally documented separately in
`RAG_DOCUMENTATION.md`.

------------------------------------------------------------------------

# 16. RAG Resource Initialization

At FastAPI startup, the backend loads the RAG resources.

The startup sequence calls:

``` text
_build_vector_store()
_get_reranker()
_get_llm()
```

The intended runtime sequence is therefore:

``` text
FastAPI Startup
      |
      +----> Build/load vector store
      |
      +----> Load reranker
      |
      +----> Load LLM
      |
      v
API ready
```

This means RAG resources are initialized as part of backend startup
rather than being initialized only when a troubleshooting request is
received.

------------------------------------------------------------------------

# 17. Frontend-to-Backend Communication

The frontend API abstraction is centralized in:

``` text
api.js
```

Examples of frontend/backend interactions include:

  ----------------------------------------------------------------------------------------
  Frontend Operation      HTTP Method             Backend Endpoint
  ----------------------- ----------------------- ----------------------------------------
  Load tickets            GET                     `/tickets`

  Load notifications      GET                     `/notifications`

  Acknowledge             PUT                     `/tickets/{ticket_number}/acknowledge`
  notification                                    

  Change priority         PUT                     `/tickets/{ticket_number}/priority`

  Close ticket            PUT                     `/tickets/{ticket_number}/close`

  Reopen ticket           PUT                     `/tickets/{ticket_number}/reopen`

  Troubleshoot ticket     GET                     `/troubleshoot/{ticket_number}`

  Login                   POST                    `/auth/login`

  Check authentication    GET                     `/auth/me`

  Logout                  POST                    `/auth/logout`

  Register                POST                    `/auth/register`

  Forgot password         POST                    `/auth/forgot-password`

  Reset password          POST                    `/auth/reset-password`
  ----------------------------------------------------------------------------------------

------------------------------------------------------------------------

# 18. End-to-End Data Flow

The complete current data flow can be represented as follows:

``` text
                 +----------------------+
                 | Java Processing      |
                 |----------------------|
                 | Ticket generation    |
                 | Notification creation|
                 +----------+-----------+
                            |
                            v
                 +----------------------+
                 | JSON Files            |
                 |----------------------|
                 | tickets.json          |
                 | notifications.json    |
                 +----------+-----------+
                            |
                            v
                 +----------------------+
                 | Python Migration      |
                 | migrate_json_to_db.py |
                 +----------+-----------+
                            |
                            v
                 +----------------------+
                 | PostgreSQL            |
                 |----------------------|
                 | User                  |
                 | Team                  |
                 | Ticket                |
                 | TicketEvent           |
                 +----------+-----------+
                            |
                            v
                 +----------------------+
                 | FastAPI               |
                 |----------------------|
                 | Auth                  |
                 | Tickets               |
                 | Notifications         |
                 | Troubleshooting       |
                 +----------+-----------+
                            |
                            v
                 +----------------------+
                 | React Frontend        |
                 |----------------------|
                 | Dashboard             |
                 | Notifications         |
                 | Settings              |
                 | Ticket Modals         |
                 | Auth Screens          |
                 +----------------------+
```

------------------------------------------------------------------------

# 19. Runtime Responsibilities

  -----------------------------------------------------------------------
  Layer                               Main Responsibility
  ----------------------------------- -----------------------------------
  Java                                Generate/process ticket data and
                                      notification JSON

  JSON files                          Intermediate data handoff

  Migration script                    Convert JSON data into relational
                                      database records

  PostgreSQL                          Persistent application data

  SQLAlchemy                          Database access/mapping from Python

  FastAPI                             REST API, business operations,
                                      authentication integration and
                                      troubleshooting API

  RAG components                      Generate troubleshooting
                                      recommendations and historical
                                      incident results

  React                               User interface and frontend state
                                      management

  `api.js`                            Central frontend HTTP/API wrapper
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 20. Important Architectural Characteristics

## 20.1 Java Does Not Directly Write to PostgreSQL

The current implementation uses:

``` text
Java -> JSON -> Python migration -> PostgreSQL
```

rather than:

``` text
Java -> PostgreSQL
```

This is an architectural characteristic of the current implementation
and should not be described as a direct Java database integration.

## 20.2 PostgreSQL Is the Runtime Backend Data Source

FastAPI retrieves tickets and ticket events from PostgreSQL.

The JSON files are used by the migration process and are not the source
queried by the ticket and notification API endpoints.

## 20.3 Notifications Are Event-Based

The notification API derives notification responses from `TicketEvent`
records.

Consequently, ticket actions such as priority changes, closure and
reopening can produce corresponding event/notification records.

## 20.4 Ticket State and Ticket History Are Separate Concepts

The `Ticket` record represents current ticket state.

`TicketEvent` records represent historical/event information associated
with the ticket.

This allows the backend to expose both current ticket status and
event/notification history.

## 20.5 Frontend State Is Not the Primary Persistence Layer

React maintains UI state for tickets, notifications, modal state and
other presentation concerns.

Persistent ticket/event state is stored in PostgreSQL and updated
through FastAPI.

------------------------------------------------------------------------

# 21. Current Architecture Summary

The current Alarm Automation architecture can be summarized as:

``` text
Java
  |
  | generates
  v
JSON
  |
  | migration
  v
PostgreSQL
  |
  | REST API
  v
FastAPI
  |
  | HTTP
  v
React
```

With the troubleshooting path:

``` text
React
  |
  v
FastAPI
  |
  v
Ticket data from PostgreSQL
  |
  v
RAG retrieval / reranking / LLM
  |
  v
Troubleshooting recommendation
  |
  v
React UI
```

The architecture therefore combines:

-   Java-based ticket/data generation
-   JSON-based integration
-   Python-based database migration
-   PostgreSQL persistence
-   FastAPI REST APIs
-   React frontend
-   Authentication
-   Event-based notification handling
-   RAG/LLM-assisted troubleshooting

------------------------------------------------------------------------

# 22. Source Files Used for This Architecture Description

The current architecture description was derived from the project source
files available for inspection:

``` text
ticketJsonWriter.java
notificationJsonWriter.java
migrate_json_to_db.py
main.py
api.js
App.jsx
Notifications.jsx
Sidebar.jsx
```

The architecture description intentionally focuses on behavior supported
by the implementation. Detailed database schema, complete API contracts,
complete code flow, and detailed RAG internals are covered by their
respective documentation files.
