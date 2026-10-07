# Alarm Automation --- API Documentation

## 1. Document Purpose

This document describes the HTTP API currently implemented by the Alarm
Automation backend and the frontend API wrapper used to call it.

The backend is implemented with FastAPI.

The frontend API functions are implemented in:

``` text
frontend/src/api/api.js
```

The API base is currently:

``` javascript
const API_BASE = "";
```

The frontend therefore uses relative API paths. The source comments
state that the project uses a Vite development proxy so requests go
through the frontend origin.

------------------------------------------------------------------------

# 2. API Architecture

The request path is:

``` text
React Component
      |
      v
api.js
      |
      v
HTTP Request
      |
      v
FastAPI
      |
      v
Authentication / Business Logic
      |
      v
SQLAlchemy
      |
      v
PostgreSQL
```

For troubleshooting, the path additionally includes the RAG layer:

``` text
React
  |
  v
api.js
  |
  v
FastAPI
  |
  v
PostgreSQL ticket lookup
  |
  v
troubleshoot_alarm()
  |
  v
RAG / retrieval / reranking / LLM
  |
  v
Response
```

------------------------------------------------------------------------

# 3. Base URL

The frontend defines:

``` javascript
const API_BASE = "";
```

Therefore the frontend calls relative paths such as:

``` text
/tickets
/notifications
/auth/login
```

The current source comments state that Vite proxy configuration is used
during development.

The FastAPI CORS configuration explicitly allows:

``` text
http://localhost:5173
http://127.0.0.1:5173
http://localhost:5500
http://127.0.0.1:5500
```

and enables credentials.

------------------------------------------------------------------------

# 4. Authentication Model

The protected application endpoints use the FastAPI dependency:

``` text
get_current_user
```

The frontend sends credentials with protected requests using:

``` javascript
credentials: "include"
```

The frontend API comments identify the session cookie as:

``` text
alarmops_session
```

The authentication router is included in FastAPI through:

``` python
app.include_router(auth_router)
```

The detailed implementation of the authentication router is not
contained in the inspected `main.py`; therefore this document records
the authentication endpoints exposed by the frontend API wrapper without
inventing additional backend implementation details.

------------------------------------------------------------------------

# 5. Endpoint Summary

The application currently calls the following endpoints:

  -------------------------------------------------------------------------------------------------
  Method            Endpoint                                 Purpose              Authentication in
                                                                                  frontend
  ----------------- ---------------------------------------- -------------------- -----------------
  GET               `/`                                      API health/home      No explicit
                                                             response             dependency

  GET               `/tickets`                               Retrieve tickets     Credentials
                                                                                  included

  PUT               `/tickets/{ticket_number}/priority`      Change ticket        Credentials
                                                             priority             included

  PUT               `/tickets/{ticket_number}/close`         Close ticket         Credentials
                                                                                  included

  PUT               `/tickets/{ticket_number}/reopen`        Reopen ticket        Credentials
                                                                                  included

  PUT               `/tickets/{ticket_number}/acknowledge`   Acknowledge latest   Credentials
                                                             ticket event         included

  GET               `/notifications`                         Retrieve             Credentials
                                                             notification/event   included
                                                             history              

  GET               `/troubleshoot/{ticket_number}`          Generate             Credentials
                                                             troubleshooting      included
                                                             result               

  POST              `/auth/login`                            Authenticate user    Credentials
                                                                                  included

  GET               `/auth/me`                               Check current        Credentials
                                                             authentication       included

  POST              `/auth/logout`                           Log out              Credentials
                                                                                  included

  POST              `/auth/register`                         Register user        Not explicitly
                                                                                  included

  POST              `/auth/forgot-password`                  Start password       Not explicitly
                                                             recovery             included

  POST              `/auth/reset-password`                   Reset password       Not explicitly
                                                                                  included
  -------------------------------------------------------------------------------------------------

------------------------------------------------------------------------

# 6. GET `/`

## Purpose

Basic API home/health response.

## Authentication

No `get_current_user` dependency is attached to this endpoint in
`main.py`.

## Request

``` http
GET /
```

## Response

``` json
{
  "message": "Alarm Automation API is running"
}
```

------------------------------------------------------------------------

# 7. GET `/tickets`

## Purpose

Retrieve all tickets from the database.

## Backend

Implemented by:

``` text
main.py -> get_tickets()
```

The endpoint queries:

``` text
Ticket
```

using the SQLAlchemy database session.

## Authentication

Requires:

``` text
get_current_user
```

## Request

``` http
GET /tickets
```

The frontend sends:

``` javascript
credentials: "include"
```

## Response

The endpoint returns an array of ticket objects.

Example structure:

``` json
[
  {
    "ticketNumber": "TICKET-001",
    "node": "NODE-01",
    "alarmType": "Example Alarm",
    "occurrenceCount": 3,
    "usersImpacted": 100,
    "severity": "HIGH",
    "thresholdBreached": true,
    "impactLevel": "HIGH",
    "priority": "P1",
    "assignedTeam": "Example Team",
    "status": "OPEN",
    "reason": null,
    "createdAt": "2026-10-06 10:00:00",
    "updatedAt": "2026-10-06 10:00:00",
    "closedAt": null,
    "reopenedAt": null
  }
]
```

The exact values depend on the database.

## Returned Fields

The backend constructs these fields:

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
updatedAt
closedAt
reopenedAt
```

------------------------------------------------------------------------

# 8. PUT `/tickets/{ticket_number}/priority`

## Purpose

Change a ticket's priority.

## Backend

Implemented by:

``` text
main.py -> update_priority()
```

## Authentication

Requires:

``` text
get_current_user
```

## Path Parameter

``` text
ticket_number
```

Identifies the ticket to update.

## Request Body

The backend uses:

``` python
class PriorityUpdate(BaseModel):
    priority: str
```

Request:

``` json
{
  "priority": "P1"
}
```

Allowed priority values:

``` text
P1
P2
P3
P4
```

## Backend Processing

The endpoint:

1.  Validates the priority.
2.  Finds the ticket.
3.  Rejects a missing ticket.
4.  Rejects changes to a closed ticket.
5.  Rejects a request if the priority is unchanged.
6.  Compares old and new priority.
7.  Determines upgrade or downgrade.
8.  Updates the ticket.
9.  Creates a `TicketEvent`.
10. Commits the transaction.

Priority ordering is:

``` text
P1 = 1
P2 = 2
P3 = 3
P4 = 4
```

A lower numeric value represents a higher priority.

## Event Types

If the new priority is higher:

``` text
PRIORITY_UPGRADE
```

Otherwise:

``` text
PRIORITY_DOWNGRADE
```

## Success Response

``` json
{
  "message": "Ticket priority updated",
  "ticketNumber": "TICKET-001",
  "priority": "P1"
}
```

## Error Responses

### Invalid priority

``` text
400
```

``` json
{
  "detail": "Invalid priority raised"
}
```

### Ticket not found

``` text
404
```

``` json
{
  "detail": "Ticket not found"
}
```

### Closed ticket

``` text
409
```

``` json
{
  "detail": "cannot upgrade a closed ticket"
}
```

### Same priority

``` text
400
```

``` json
{
  "detail": "Ticket is already at this priority"
}
```

------------------------------------------------------------------------

# 9. PUT `/tickets/{ticket_number}/close`

## Purpose

Close an open ticket.

## Authentication

Requires:

``` text
get_current_user
```

## Path Parameter

``` text
ticket_number
```

## Request Body

No request body is required by the implemented endpoint.

## Backend Processing

The endpoint:

1.  Finds the ticket.

2.  Checks whether it exists.

3.  Rejects an already closed ticket.

4.  Sets:

    ``` text
    status = CLOSED
    ```

5.  Sets `closed_at`.

6.  Creates a `TicketEvent`.

7.  Uses:

    ``` text
    event_type = TICKET_CLOSED
    ```

8.  Sets the event status to:

    ``` text
    RESOLVED
    ```

9.  Commits the transaction.

## Success Response

``` json
{
  "message": "Ticket closed successfully",
  "ticketNumber": "TICKET-001",
  "status": "CLOSED",
  "closedAt": "2026-10-06T10:30:00"
}
```

## Error Responses

### Ticket not found

``` text
404
```

``` json
{
  "detail": "Ticket not found"
}
```

### Already closed

``` text
409
```

``` json
{
  "detail": "Ticket is already closed"
}
```

------------------------------------------------------------------------

# 10. PUT `/tickets/{ticket_number}/reopen`

## Purpose

Reopen a closed ticket.

## Authentication

Requires:

``` text
get_current_user
```

## Path Parameter

``` text
ticket_number
```

## Request Body

The backend model is:

``` python
class ReopenUpdate(BaseModel):
    priority: str
    reason: str
```

Example:

``` json
{
  "priority": "P2",
  "reason": "Alarm condition has returned and requires investigation."
}
```

## Validation

Allowed priorities:

``` text
P1
P2
P3
P4
```

The reason is stripped and must not be empty.

## Backend Processing

The endpoint:

1.  Validates priority.

2.  Validates reopen reason.

3.  Finds the ticket.

4.  Requires the current status to be `CLOSED`.

5.  Sets:

    ``` text
    status = OPEN
    ```

6.  Sets the new priority.

7.  Sets `reopened_at`.

8.  Creates a `TICKET_REOPENED` event.

9.  Stores the reason.

10. Commits the transaction.

## Success Response

``` json
{
  "message": "Ticket reopened successfully",
  "ticketNumber": "TICKET-001",
  "status": "OPEN",
  "priority": "P2",
  "reason": "Alarm condition has returned and requires investigation.",
  "reopenedAt": "2026-10-06T10:45:00"
}
```

## Error Responses

### Invalid priority

``` text
400
```

``` json
{
  "detail": "Invalid priority"
}
```

### Empty reason

``` text
400
```

``` json
{
  "detail": "Reopen reason is required"
}
```

### Ticket not found

``` text
404
```

``` json
{
  "detail": "Ticket not found"
}
```

### Ticket already open

``` text
409
```

``` json
{
  "detail": "Ticket is already open"
}
```

------------------------------------------------------------------------

# 11. PUT `/tickets/{ticket_number}/acknowledge`

## Purpose

Acknowledge the latest event/notification associated with a ticket.

## Authentication

Requires:

``` text
get_current_user
```

## Path Parameter

``` text
ticket_number
```

## Request Body

No request body is required.

## Backend Processing

The backend:

1.  Queries all `TicketEvent` records for the ticket.

2.  Joins with `Ticket`.

3.  Orders events by:

    ``` text
    timestamp DESC
    id DESC
    ```

4.  Selects the first event as the latest event.

5.  Checks its status.

6.  If the status is neither:

    ``` text
    ACKNOWLEDGED
    ```

    nor:

    ``` text
    RESOLVED
    ```

    it changes the status to:

    ``` text
    ACKNOWLEDGED
    ```

7.  Commits only when an update occurred.

## Success Response

``` json
{
  "message": "Latest notification acknowledged",
  "ticketNumber": "TICKET-001",
  "acknowledged": true
}
```

If the latest event was already acknowledged/resolved:

``` json
{
  "message": "Latest notification acknowledged",
  "ticketNumber": "TICKET-001",
  "acknowledged": false
}
```

## Error Response

If no events exist:

``` text
404
```

``` json
{
  "detail": "no events for ticket"
}
```

------------------------------------------------------------------------

# 12. GET `/notifications`

## Purpose

Retrieve notification history derived from `TicketEvent` records.

## Authentication

Requires:

``` text
get_current_user
```

## Request

``` http
GET /notifications
```

## Backend Processing

The backend:

1.  Queries all `TicketEvent` records.
2.  Orders them by timestamp descending.
3.  Retrieves the associated ticket.
4.  Determines the notification message based on `event_type`.
5.  Builds a notification response object.

The API does not query the original `notifications.json` file.

The runtime notification response is derived from PostgreSQL
`TicketEvent` records.

## Response

``` json
[
  {
    "ticketNumber": "TICKET-001",
    "assignedTeam": "Example Team",
    "message": "New P1 ticket created for Example Alarm on NODE-01",
    "status": "PENDING",
    "eventType": "TICKET_CREATED",
    "previousPriority": null,
    "newPriority": null,
    "priority": "P1",
    "reason": null,
    "timestamp": "2026-10-06T10:00:00",
    "alarmType": "Example Alarm",
    "node": "NODE-01"
  }
]
```

## Returned Fields

``` text
ticketNumber
assignedTeam
message
status
eventType
previousPriority
newPriority
priority
reason
timestamp
alarmType
node
```

## Supported Event Messages

### `TICKET_CREATED`

Generated message format:

``` text
New {priority} ticket created for {alarm_type} on {node}
```

### `PRIORITY_UPGRADE`

Generated message describes:

``` text
previous priority -> new priority
```

### `PRIORITY_DOWNGRADE`

Generated message describes:

``` text
previous priority -> new priority
```

### `TICKET_CLOSED`

Message:

``` text
Ticket closed
```

### `TICKET_REOPENED`

Message contains:

``` text
Ticket reopened
Current priority
Reason
Time
```

For an unknown event type, the current backend returns an empty message
string.

------------------------------------------------------------------------

# 13. GET `/troubleshoot/{ticket_number}`

## Purpose

Generate an AI/RAG-based troubleshooting recommendation for a ticket.

## Authentication

Requires:

``` text
get_current_user
```

## Path Parameter

``` text
ticket_number
```

## Backend Processing

The backend first finds the ticket.

If the ticket exists, it passes the following ticket information to:

``` text
troubleshoot_alarm()
```

Arguments include:

``` text
alarm_type
node
occurrence_count
users_impacted
severity
threshold_breached
impact_level
priority
assigned_team
```

The result is expected to contain:

``` text
recommendation
historicalIncidents
```

## Success Response

``` json
{
  "alarmType": "Example Alarm",
  "recommendation": "...",
  "historicalIncidents": []
}
```

## Error Responses

### Ticket not found

``` text
404
```

``` json
{
  "detail": "Ticket not found"
}
```

### Troubleshooting failure

The backend logs the exception and returns:

``` text
500
```

``` json
{
  "detail": "Troubleshooting failed. Please try again later."
}
```

The actual internal exception is not returned in the response.

------------------------------------------------------------------------

# 14. Authentication Endpoints

The authentication endpoints are supplied through the included
authentication router:

``` text
auth_router
```

The frontend API wrapper currently calls the following endpoints.

------------------------------------------------------------------------

## 14.1 POST `/auth/login`

### Purpose

Authenticate a user.

### Request Body

``` json
{
  "identifier": "username-or-email",
  "password": "password"
}
```

### Frontend Behavior

The frontend sends:

``` text
Content-Type: application/json
credentials: include
```

### Error Handling

If the response is not successful, the frontend uses:

``` text
data.detail
```

when available, otherwise:

``` text
Invalid username/email or password.
```

The exact success response is not defined in the inspected `main.py`,
because the endpoint is implemented in the separate authentication
router.

------------------------------------------------------------------------

# 15. GET `/auth/me`

## Purpose

Check the currently authenticated user.

## Frontend Request

``` http
GET /auth/me
```

with:

``` text
credentials: include
```

## Frontend Behavior

If the response is not successful:

``` text
null
```

is returned by `checkAuth()`.

If successful, the JSON response is returned.

`App.jsx` uses this request during application startup to determine
whether the user should see the authenticated application or the login
screen.

------------------------------------------------------------------------

# 16. POST `/auth/logout`

## Purpose

Log out the current user.

## Request

``` http
POST /auth/logout
```

with:

``` text
credentials: include
```

## Frontend Return

The API wrapper returns:

``` text
response.ok
```

The exact backend response body is not defined in the inspected
`main.py`.

------------------------------------------------------------------------

# 17. POST `/auth/register`

## Purpose

Create a user account.

## Request Body

The frontend sends:

``` json
{
  "full_name": "...",
  "username": "...",
  "email": "...",
  "password": "..."
}
```

## Frontend Error Handling

The frontend uses:

``` text
data.detail
```

when available.

Fallback:

``` text
Could not create the account.
```

The exact backend response schema is defined in the authentication
router, which is not included in the inspected `main.py`.

------------------------------------------------------------------------

# 18. POST `/auth/forgot-password`

## Purpose

Start password recovery.

## Request Body

``` json
{
  "email": "user@example.com"
}
```

## Frontend Error Handling

Fallback error:

``` text
Could not process the password reset request.
```

The exact backend response is not defined in the inspected `main.py`.

------------------------------------------------------------------------

# 19. POST `/auth/reset-password`

## Purpose

Reset a user's password.

## Request Body

``` json
{
  "token": "...",
  "new_password": "..."
}
```

## Frontend Error Handling

Fallback:

``` text
Could not reset the password.
```

The exact backend response schema is not defined in the inspected
`main.py`.

------------------------------------------------------------------------

# 20. Frontend API Wrapper

The API functions are centralized in:

``` text
api.js
```

The currently implemented functions are:

``` text
loginRequest()
checkAuth()
logoutRequest()
registerRequest()
forgotPasswordRequest()
resetPasswordRequest()
acknowledgeTicket()
fetchTickets()
fetchNotifications()
closeTicket()
reopenTicket()
upgradeTicket()
troubleshootTicket()
```

This provides a single frontend layer between React components and the
backend HTTP API.

------------------------------------------------------------------------

# 21. Frontend HTTP Error Handling

The frontend API wrapper generally follows this pattern:

``` text
fetch()
   |
   v
Check response.ok
   |
   +---- Success ---> return JSON
   |
   +---- Failure ---> throw Error
```

For ticket and notification retrieval specifically:

``` text
HTTP 401
   |
   v
throw Error("UNAUTHORIZED")
```

This allows `App.jsx` to detect an expired/invalid authentication state.

For other failures, the wrapper generally throws a descriptive error,
sometimes using:

``` text
data.detail
```

or:

``` text
data.message
```

when provided by the backend.

------------------------------------------------------------------------

# 22. API State Changes

Several API operations modify persistent database state.

  --------------------------------------------------------------------------------
  Endpoint                                     Database Effect
  -------------------------------------------- -----------------------------------
  `PUT /tickets/{ticket_number}/priority`      Updates `Ticket.priority` and
                                               creates `TicketEvent`

  `PUT /tickets/{ticket_number}/close`         Updates ticket status/timestamp and
                                               creates `TICKET_CLOSED` event

  `PUT /tickets/{ticket_number}/reopen`        Updates ticket
                                               status/priority/timestamp and
                                               creates `TICKET_REOPENED` event

  `PUT /tickets/{ticket_number}/acknowledge`   Updates latest `TicketEvent.status`
                                               when necessary
  --------------------------------------------------------------------------------

Read-only application endpoints include:

``` text
GET /tickets
GET /notifications
GET /troubleshoot/{ticket_number}
```

The troubleshooting endpoint performs AI/RAG processing but does not
show a database write in the inspected implementation.

------------------------------------------------------------------------

# 23. API Authentication Summary

The following application endpoints explicitly depend on
`get_current_user` in `main.py`:

``` text
GET  /tickets
PUT  /tickets/{ticket_number}/priority
PUT  /tickets/{ticket_number}/close
PUT  /tickets/{ticket_number}/reopen
PUT  /tickets/{ticket_number}/acknowledge
GET  /notifications
GET  /troubleshoot/{ticket_number}
```

The authentication endpoints are provided by the separate authentication
router.

------------------------------------------------------------------------

# 24. API-to-Frontend Mapping

  React/API Function          HTTP Endpoint
  --------------------------- --------------------------------------------
  `loginRequest()`            `POST /auth/login`
  `checkAuth()`               `GET /auth/me`
  `logoutRequest()`           `POST /auth/logout`
  `registerRequest()`         `POST /auth/register`
  `forgotPasswordRequest()`   `POST /auth/forgot-password`
  `resetPasswordRequest()`    `POST /auth/reset-password`
  `acknowledgeTicket()`       `PUT /tickets/{ticket_number}/acknowledge`
  `fetchTickets()`            `GET /tickets`
  `fetchNotifications()`      `GET /notifications`
  `closeTicket()`             `PUT /tickets/{ticket_number}/close`
  `reopenTicket()`            `PUT /tickets/{ticket_number}/reopen`
  `upgradeTicket()`           `PUT /tickets/{ticket_number}/priority`
  `troubleshootTicket()`      `GET /troubleshoot/{ticket_number}`

------------------------------------------------------------------------

# 25. Typical Ticket API Sequence

A typical ticket lifecycle through the API is:

``` text
GET /tickets
      |
      v
Display ticket
      |
      +--------------------+
      |                    |
      v                    v
PUT /priority        PUT /close
      |                    |
      v                    v
TicketEvent          TicketEvent
      |                    |
      +---------+----------+
                |
                v
       GET /notifications
                |
                v
      Notification displayed
                |
                v
 PUT /acknowledge
                |
                v
 Latest TicketEvent = ACKNOWLEDGED
```

For a closed ticket:

``` text
PUT /close
   |
   v
status = CLOSED
   |
   v
PUT /reopen
   |
   v
status = OPEN
```

------------------------------------------------------------------------

# 26. Current API Architecture Summary

The API layer follows this structure:

``` text
                  React
                    |
                    v
                  api.js
                    |
                    v
              HTTP / JSON
                    |
                    v
                 FastAPI
                    |
        +-----------+-----------+
        |           |           |
        v           v           v
    Tickets    Notifications   Auth
        |           |           |
        +-----------+-----------+
                    |
                    v
                PostgreSQL

                    +
                    |
                    v
             Troubleshooting
                    |
                    v
              RAG / AI Layer
```

The API therefore acts as the boundary between the React UI and the
backend's persistent/application logic.
