# Alarm Automation --- Code Flow

## 1. Document Purpose

This document describes the current code execution and data flow of the
Alarm Automation project based on the implementation available for
inspection.

The focus is on:

-   Java ticket/notification generation
-   JSON file creation
-   JSON-to-PostgreSQL migration
-   FastAPI startup and API execution
-   React application startup
-   Frontend API calls
-   Ticket lifecycle operations
-   Notification generation and acknowledgement
-   Authentication flow
-   RAG troubleshooting flow

Where a source file was not available for inspection, the flow is not
expanded beyond what the available code proves.

------------------------------------------------------------------------

# 2. Overall Code Flow

The main data path is:

``` text
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

        |
        v
migrate_json_to_db.py
        |
        v
SQLAlchemy
        |
        v
PostgreSQL
        |
        v
main.py / FastAPI
        |
        v
api.js
        |
        v
React App.jsx
        |
        +----> Dashboard
        +----> Notifications
        +----> Settings
        +----> Ticket Modals
```

------------------------------------------------------------------------

# 3. Java → JSON Flow

## 3.1 Ticket JSON Flow

The ticket JSON flow starts when the Java application passes a list of
`ticket` objects to:

``` text
ticketJsonWriter.writeTickets(...)
```

The method receives:

``` text
List<ticket> tickets
String filePath
```

The execution is:

``` text
List<ticket>
     |
     v
writeTickets()
     |
     v
Create File object
     |
     v
Create parent directory if required
     |
     v
Create FileWriter
     |
     v
Gson.toJson(tickets, writer)
     |
     v
tickets JSON file
```

The writer uses Gson with pretty printing.

It does not manually concatenate JSON strings.

## 3.2 Notification JSON Flow

Notification generation follows a different step before serialization.

The execution is:

``` text
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
Add notification fields
     |
     v
List<Map<String,Object>>
     |
     v
Gson.toJson(...)
     |
     v
notifications JSON file
```

For each ticket, the notification writer creates fields including:

``` text
ticketNumber
assignedTeam
message
status
eventType
timestamp
priority
alarmType
node
```

The initial notification status is:

``` text
PENDING
```

and the initial event type is:

``` text
TICKET_CREATED
```

------------------------------------------------------------------------

# 4. JSON → PostgreSQL Migration Flow

The migration is implemented in:

``` text
migrate_json_to_db.py
```

The script uses:

``` text
SessionLocal
```

from the backend database layer and the SQLAlchemy models:

``` text
Team
Ticket
TicketEvent
```

## 4.1 Migration Entry Point

When executed directly:

``` python
if __name__ == "__main__":
    migrate()
```

the `migrate()` function is called.

The first operations are:

``` text
Load tickets.json
Load notifications.json
Create database session
```

The configured paths are:

``` text
output/tickets.json
output/notifications.json
```

------------------------------------------------------------------------

# 5. Team Migration Flow

The migration first determines the unique teams appearing in the ticket
data.

``` text
tickets_data
     |
     v
Extract assignedTeam values
     |
     v
Unique team names
     |
     v
For each team
     |
     +---- Existing team? ---- Yes ---> Reuse
     |
     +---- No -----------------------> Create Team
```

Each resulting team is stored in an in-memory mapping:

``` text
team name -> Team object
```

This mapping is later used when creating tickets.

------------------------------------------------------------------------

# 6. Ticket Migration Flow

For every ticket in `tickets.json`, the migration checks the database
using:

``` text
ticketNumber
```

The flow is:

``` text
JSON ticket
     |
     v
Find Ticket by ticket_number
     |
     +---- Found ----> Reuse existing Ticket
     |
     +---- Not found -> Create Ticket
```

For a new ticket, fields are mapped from JSON into the SQLAlchemy
`Ticket` model.

The mapping includes:

``` text
ticketNumber
node
alarmType
occurrenceCount
usersImpacted
severity
thresholdBreached
impactLevel
priority
assignedTeam
status
reason
createdAt
closedAt
reopenedAt
```

After creating or finding the ticket, the migration stores it in:

``` text
ticket_map[ticketNumber]
```

This lets notification records locate the corresponding database ticket.

------------------------------------------------------------------------

# 7. Ticket Event Migration Flow

After tickets are processed, the migration processes
`notifications.json`.

Before inserting events, it loads existing event identifiers:

``` text
(ticket_id, event_type, timestamp)
```

The execution is:

``` text
Notification
     |
     v
Find ticket by ticketNumber
     |
     +---- Ticket not found ---> Skip event
     |
     v
Parse timestamp
     |
     v
Build event key
     |
     v
Already exists?
     |
     +---- Yes ---> Skip
     |
     +---- No ----> Create TicketEvent
```

The event receives fields such as:

``` text
ticket_id
event_type
previous_priority
new_priority
priority
reason
timestamp
```

After processing all events:

``` text
db.commit()
```

If an exception occurs:

``` text
db.rollback()
```

The database session is then closed.

------------------------------------------------------------------------

# 8. FastAPI Startup Flow

The backend entry point is:

``` text
main.py
```

The application creates a FastAPI instance:

``` python
app = FastAPI()
```

CORS middleware is configured.

The authentication router is included:

``` python
app.include_router(auth_router)
```

The backend also registers a startup handler:

``` python
@app.on_event("startup")
def load_rag_models():
```

The startup handler loads:

``` text
_build_vector_store()
_get_reranker()
_get_llm()
```

Therefore:

``` text
FastAPI startup
      |
      v
Load/build vector store
      |
      v
Load reranker
      |
      v
Load LLM
      |
      v
Backend ready
```

------------------------------------------------------------------------

# 9. React Application Startup Flow

The main React entry component is:

``` text
App.jsx
```

The component initializes state for:

``` text
authentication
current user
tickets
notifications
loading
backend status
search
filters
theme
sidebar
refresh configuration
active page
modals
troubleshooting data
reopen data
toasts
```

## 9.1 Authentication Check

When the application starts, an effect runs:

``` text
checkAuthentication()
```

which calls:

``` text
checkAuth()
```

from `api.js`.

The API request is:

``` text
GET /auth/me
```

The flow is:

``` text
App.jsx
   |
   v
checkAuthentication()
   |
   v
checkAuth()
   |
   v
GET /auth/me
   |
   v
FastAPI authentication layer
   |
   +---- User exists ---> authenticated application
   |
   +---- No user -------> login screen
```

------------------------------------------------------------------------

# 10. Ticket Fetch Flow

Once the authenticated application is displayed, ticket data is
retrieved through the frontend API wrapper.

The flow is:

``` text
App.jsx
   |
   v
fetchTickets()
   |
   v
getTickets()
   |
   v
GET /tickets
   |
   v
FastAPI
   |
   v
get_db()
   |
   v
Query Ticket records
   |
   v
Convert database records to API objects
   |
   v
JSON response
   |
   v
setTickets(data)
```

The backend's `/tickets` endpoint requires the current authenticated
user.

The response includes the ticket's current state and associated team
name.

------------------------------------------------------------------------

# 11. Notification Fetch Flow

The frontend calls:

``` text
fetchNotifications()
```

which maps to:

``` text
GET /notifications
```

The backend queries:

``` text
TicketEvent
```

ordered by timestamp descending.

For each event, it obtains the associated ticket and constructs a
notification response.

The flow is:

``` text
React
   |
   v
getNotifications()
   |
   v
GET /notifications
   |
   v
FastAPI
   |
   v
Query TicketEvent
   |
   v
For each event:
   |
   +---- Find Ticket
   |
   +---- Determine message from event_type
   |
   +---- Build notification object
   |
   v
Return notification list
   |
   v
React notifications state
```

------------------------------------------------------------------------

# 12. Notification Message Construction

The backend constructs notification messages according to the event
type.

## TICKET_CREATED

The message describes a new ticket using the event priority, alarm type
and node.

## PRIORITY_UPGRADE

The message describes:

``` text
previous priority -> new priority
```

## PRIORITY_DOWNGRADE

The message describes:

``` text
previous priority -> new priority
```

## TICKET_CLOSED

The message is:

``` text
Ticket closed
```

## TICKET_REOPENED

The message includes:

``` text
Ticket reopened
Current priority
Reason
Time
```

This means the frontend does not need to recreate the notification
message from raw ticket data; the backend provides the display message.

------------------------------------------------------------------------

# 13. Dashboard Rendering Flow

`App.jsx` determines the active page.

When:

``` text
activePage === "dashboard"
```

the application renders:

``` text
SummaryCards
TicketTable
```

The ticket data flows into frontend filtering and sorting before being
passed to the ticket table.

The filtering considers values such as:

``` text
node
alarmType
severity
impactLevel
priority
assignedTeam
status
```

A search term can also match ticket properties such as:

``` text
ticketNumber
node
alarmType
assignedTeam
severity
priority
impactLevel
status
```

The filtered list is sorted using ticket activity information from:

``` text
getTicketActivityTime(ticket, notifications)
```

------------------------------------------------------------------------

# 14. Ticket Priority Update Flow

The frontend opens the upgrade flow using the selected ticket.

The final operation calls:

``` text
upgradeTicketAPI(
    ticketNumber,
    newPriority
)
```

The API wrapper sends:

``` text
PUT /tickets/{ticket_number}/priority
```

with:

``` json
{
  "priority": "P1"
}
```

The backend execution is:

``` text
Receive ticket number + priority
        |
        v
Validate priority
        |
        v
Find Ticket
        |
        v
Reject if ticket is CLOSED
        |
        v
Compare previous/new priority
        |
        v
Determine:
PRIORITY_UPGRADE
or
PRIORITY_DOWNGRADE
        |
        v
Update Ticket.priority
        |
        v
Create TicketEvent
        |
        v
Commit
        |
        v
Return response
```

The frontend then updates the ticket priority locally and refreshes
notifications.

------------------------------------------------------------------------

# 15. Ticket Close Flow

The frontend calls:

``` text
closeTicketAPI(ticketNumber)
```

which sends:

``` text
PUT /tickets/{ticket_number}/close
```

The backend execution is:

``` text
Receive ticket number
        |
        v
Find Ticket
        |
        v
Already CLOSED?
        |
        +---- Yes ---> 409 error
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
Set event status = RESOLVED
        |
        v
Commit
        |
        v
Return response
```

The frontend then:

``` text
Update local ticket status
       |
       v
Refresh notifications
       |
       v
Show success toast
```

------------------------------------------------------------------------

# 16. Ticket Reopen Flow

The frontend calls:

``` text
reopenTicketAPI(
    ticketNumber,
    priority,
    reason
)
```

The API request is:

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

The backend execution is:

``` text
Receive ticket number
        |
        v
Validate priority
        |
        v
Validate reason
        |
        v
Find Ticket
        |
        v
Check status == CLOSED
        |
        v
Set status = OPEN
        |
        v
Set priority
        |
        v
Set reopened_at
        |
        v
Create TICKET_REOPENED event
        |
        v
Commit
        |
        v
Return response
```

The frontend then updates:

``` text
status
priority
reopenedAt
```

and fetches notifications again.

------------------------------------------------------------------------

# 17. Notification Acknowledgement Flow

The frontend notification component receives:

``` text
onAcknowledge
```

from `App.jsx`.

The application handler calls:

``` text
acknowledgeTicketAPI(ticketNumber)
```

The API wrapper sends:

``` text
PUT /tickets/{ticket_number}/acknowledge
```

The backend:

``` text
Find all TicketEvents for ticket
        |
        v
Sort newest first
        |
        v
Select latest event
        |
        v
Is status ACKNOWLEDGED or RESOLVED?
        |
        +---- Yes ---> No database update
        |
        +---- No ----> Set status = ACKNOWLEDGED
                         |
                         v
                       Commit
```

After the request completes, React calls:

``` text
fetchNotifications()
```

so the UI receives the updated event status from the backend.

------------------------------------------------------------------------

# 18. Troubleshooting Flow

Troubleshooting starts from the ticket UI.

The frontend opens the troubleshooting modal and calls:

``` text
troubleshootTicketAPI(ticket.ticketNumber)
```

The API wrapper sends:

``` text
GET /troubleshoot/{ticket_number}
```

The backend:

``` text
Receive ticket number
        |
        v
Find Ticket
        |
        +---- Not found ---> 404
        |
        v
Pass ticket attributes to troubleshoot_alarm()
        |
        v
RAG processing
        |
        v
Recommendation
+
Historical incidents
        |
        v
Return API response
```

The frontend receives:

``` json
{
  "alarmType": "...",
  "recommendation": "...",
  "historicalIncidents": []
}
```

and displays the results in the troubleshooting modal.

If the troubleshooting operation raises an exception, the backend logs
the exception and returns a generic HTTP 500 message instead of exposing
the internal exception.

------------------------------------------------------------------------

# 19. Authentication Flow

The frontend authentication API functions are centralized in `api.js`.

## 19.1 Login

The login flow is:

``` text
Login component
      |
      v
loginRequest(identifier, password)
      |
      v
POST /auth/login
      |
      v
FastAPI authentication router
      |
      v
Authentication result
      |
      v
React authenticated state
```

The request includes:

``` json
{
  "identifier": "...",
  "password": "..."
}
```

and sends credentials using:

``` text
credentials: "include"
```

## 19.2 Register

Registration calls:

``` text
POST /auth/register
```

with:

``` text
full_name
username
email
password
```

## 19.3 Forgot Password

The frontend calls:

``` text
POST /auth/forgot-password
```

with the email address.

## 19.4 Reset Password

The frontend calls:

``` text
POST /auth/reset-password
```

with:

``` text
token
new_password
```

## 19.5 Logout

The frontend calls:

``` text
POST /auth/logout
```

and then changes the frontend authentication state.

------------------------------------------------------------------------

# 20. Frontend API Error Flow

The frontend API wrapper checks HTTP response status.

For ticket and notification retrieval, a `401` response is converted
into:

``` text
UNAUTHORIZED
```

The application can then return to the unauthenticated state.

For other failed requests, the API functions throw an error containing
either the backend error detail or a fallback message.

The main application catches these errors and can display a message
modal or toast depending on the operation.

------------------------------------------------------------------------

# 21. Sidebar and Page Navigation Flow

`App.jsx` maintains:

``` text
activePage
sidebarCollapsed
```

The sidebar receives:

``` text
activePage
onNavigate
```

The available navigation targets are:

``` text
dashboard
notifications
settings
```

The sidebar calls `onNavigate()` when a navigation item is selected.

The current `App.jsx` wiring passes:

``` text
onNavigate={setActivePage}
```

so page selection updates the active page in the parent component.

The sidebar's collapsed state is also maintained by `App.jsx` and
persisted using local storage.

------------------------------------------------------------------------

# 22. React State and Backend State

The application uses two different types of state.

## Backend-persisted state

Examples:

``` text
Ticket status
Ticket priority
Ticket timestamps
Ticket events
User authentication
```

These are stored/retrieved through FastAPI and PostgreSQL.

## Frontend UI state

Examples:

``` text
activePage
selectedTicket
activeModal
searchTerm
columnFilters
darkMode
sidebarCollapsed
toast state
loading state
```

These are maintained by React.

The general rule is:

``` text
User action
   |
   v
React handler
   |
   v
API function
   |
   v
FastAPI
   |
   v
Database
   |
   v
API response
   |
   v
React state refresh/update
```

------------------------------------------------------------------------

# 23. Complete Ticket Lifecycle Flow

The current ticket lifecycle can be represented as:

``` text
Java generates ticket
        |
        v
tickets.json
        |
        v
Migration
        |
        v
PostgreSQL Ticket
        |
        v
FastAPI GET /tickets
        |
        v
React Dashboard
        |
        +----------------------+
        |                      |
        v                      v
Priority change             Close
        |                      |
        v                      v
TicketEvent              TicketEvent
        |                      |
        +----------+-----------+
                   |
                   v
             Notifications
                   |
                   v
             React UI
                   |
                   v
               Acknowledge
                   |
                   v
             Latest TicketEvent
                   |
                   v
             ACKNOWLEDGED
```

A closed ticket can additionally follow:

``` text
CLOSED
  |
  v
Reopen
  |
  v
OPEN
  |
  v
TICKET_REOPENED event
```

------------------------------------------------------------------------

# 24. Complete Request Flow Example

A typical dashboard request follows this path:

``` text
Browser
  |
  | GET /tickets
  v
Frontend api.js
  |
  v
FastAPI /tickets
  |
  v
get_current_user()
  |
  v
get_db()
  |
  v
SQLAlchemy query
  |
  v
PostgreSQL
  |
  v
Ticket objects
  |
  v
FastAPI response serialization
  |
  v
api.js JSON response
  |
  v
App.jsx setTickets()
  |
  v
Frontend filtering/sorting
  |
  v
TicketTable
```

------------------------------------------------------------------------

# 25. File Responsibility Map

  -------------------------------------------------------------------------
  File                                Responsibility
  ----------------------------------- -------------------------------------
  `ticketJsonWriter.java`             Serializes Java ticket list to JSON

  `notificationJsonWriter.java`       Builds and serializes notification
                                      records

  `migrate_json_to_db.py`             Migrates ticket and notification JSON
                                      into PostgreSQL

  `main.py`                           FastAPI application and
                                      ticket/notification/troubleshooting
                                      endpoints

  `api.js`                            Frontend HTTP/API functions

  `App.jsx`                           Main React application state and
                                      orchestration

  `Notifications.jsx`                 Notification grouping/display and
                                      acknowledgement UI

  `Sidebar.jsx`                       Sidebar navigation UI

  `MessageModal.jsx`                  Generic frontend message/error modal
  -------------------------------------------------------------------------

------------------------------------------------------------------------

# 26. Important Execution Characteristics

## 26.1 JSON Is an Intermediate Stage

The JSON files are not directly queried by FastAPI.

The runtime API flow is:

``` text
PostgreSQL -> FastAPI -> React
```

The JSON stage is:

``` text
Java -> JSON -> migration -> PostgreSQL
```

## 26.2 Ticket Events Drive Notification History

The backend notification endpoint reads `TicketEvent` records.

Therefore changes to a ticket can create event records that later appear
as notifications.

## 26.3 React Refreshes Backend State After Mutations

For operations such as:

-   priority changes
-   ticket closure
-   ticket reopening
-   acknowledgement

the frontend updates some local state and/or fetches notifications
again.

This keeps the displayed state aligned with the backend response.

## 26.4 RAG Resources Are Loaded at Backend Startup

The backend initializes:

``` text
vector store
reranker
LLM
```

during FastAPI startup.

Troubleshooting requests can therefore use the initialized RAG
resources.

------------------------------------------------------------------------

# 27. Current End-to-End Execution Summary

The complete current implementation can be summarized as:

``` text
                 DATA GENERATION
                       |
                       v
              +----------------+
              | Java Processing|
              +-------+--------+
                      |
          +-----------+-----------+
          |                       |
          v                       v
 tickets.json             notifications.json
          |                       |
          +-----------+-----------+
                      |
                      v
               migrate_json_to_db.py
                      |
                      v
                 PostgreSQL
                      |
                      v
                  FastAPI
                      |
          +-----------+-----------+
          |           |           |
          v           v           v
       Tickets   Notifications  RAG
          |           |           |
          +-----------+-----------+
                      |
                      v
                  api.js
                      |
                      v
                  App.jsx
                      |
          +-----------+-----------+
          |           |           |
          v           v           v
      Dashboard  Notifications Settings
                      |
                      v
                 User Actions
                      |
                      v
                 FastAPI API
                      |
                      v
                 PostgreSQL
```

This represents the current code flow supported by the inspected project
files.
