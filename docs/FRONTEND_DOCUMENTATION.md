# FRONTEND DOCUMENTATION

## 1. Purpose

The frontend is a React application that provides the operator dashboard
for the Alarm Automation system.

The main coordinator is:

``` text
frontend/src/App.jsx
```

The frontend is responsible for:

-   Authentication UI.
-   Dashboard navigation.
-   Ticket display and filtering.
-   Ticket actions.
-   Team notifications.
-   Troubleshooting UI.
-   Settings.
-   Modals.
-   Toast messages.
-   Periodic data refresh.
-   Communication with the FastAPI backend.

The frontend does not directly access PostgreSQL. It communicates with
FastAPI through the functions defined in:

``` text
frontend/src/api/api.js
```

------------------------------------------------------------------------

## 2. Frontend Architecture

The current frontend flow is:

``` text
React App
   |
   v
App.jsx
   |
   +------------------+
   |                  |
   v                  v
Components          Modals
   |                  |
   +--------+---------+
            |
            v
         api.js
            |
            v
        FastAPI
            |
            v
       PostgreSQL
```

The main state and event coordination happens in `App.jsx`.

Child components receive data and callbacks through React props.

------------------------------------------------------------------------

## 3. Main Frontend Files

The current frontend structure includes the following major
responsibilities:

  File / Component           Responsibility
  -------------------------- -------------------------------------------------
  `App.jsx`                  Main application coordinator and state owner
  `api.js`                   FastAPI request functions
  `Login.jsx`                Login interface
  `Sidebar.jsx`              Main navigation and backend/notification status
  `Topbar.jsx`               Search, theme, refresh and logout controls
  `SummaryCards.jsx`         Dashboard ticket summary cards
  `TicketTable.jsx`          Ticket list, filters and ticket actions
  `Notifications.jsx`        Team notification page
  `Settings.jsx`             Theme, refresh and sidebar settings
  `TicketDetailsModal.jsx`   Ticket detail display
  `UpgradeModal.jsx`         Priority upgrade UI
  `CloseTicketModal.jsx`     Ticket close confirmation
  `ReopenTicketModal.jsx`    Reopen-ticket input UI
  `ConfirmReopenModal.jsx`   Reopen confirmation
  `TroubleshootModal.jsx`    AI troubleshooting recommendation display
  `MessageModal.jsx`         Generic message/error modal
  `LogoutConfirmModal.jsx`   Logout confirmation
  `ToastHost.jsx`            Toast notification display
  `priorityHistory.js`       Ticket activity/SLA helper logic

------------------------------------------------------------------------

## 4. App.jsx

`App.jsx` is the central React component.

It imports:

``` text
Sidebar
Topbar
Login
SummaryCards
TicketTable
Notifications
Settings
TicketDetailsModal
UpgradeModal
LogoutConfirmModal
CloseTicketModal
TroubleshootModal
MessageModal
ToastHost
ReopenTicketModal
ConfirmReopenModal
```

It also imports API functions from `api.js` and helper functions from:

``` text
utils/priorityHistory
```

------------------------------------------------------------------------

## 5. Application State

`App.jsx` maintains the main application state using React `useState`.

### Authentication state

``` text
isAuthenticated
authLoading
```

`isAuthenticated` controls whether the dashboard or login screen is
rendered.

`authLoading` prevents the application from rendering the
login/dashboard decision before the initial authentication check
completes.

### Ticket state

``` text
tickets
```

Stores the ticket list returned by:

``` text
GET /tickets
```

### Notification state

``` text
notifications
```

Stores the notification/event list returned by:

``` text
GET /notifications
```

### Loading and backend state

``` text
loading
backendOnline
lastDataUpdate
```

These are used to represent data-loading and backend connectivity
status.

### Search and filters

``` text
searchTerm
columnFilters
```

The default column filters are:

``` text
node: ALL
alarmType: ALL
severity: ALL
impactLevel: ALL
priority: ALL
assignedTeam: ALL
status: ALL
```

### UI settings

``` text
darkMode
sidebarCollapsed
refreshInterval
refreshEnabled
```

### Navigation

``` text
activePage
```

Supported pages are:

``` text
dashboard
notifications
settings
```

### Toast state

``` text
toasts
```

Stores currently visible toast messages.

### Modal state

``` text
activeModal
selectedTicket
logoutModalOpen
troubleshootData
messageData
reopenData
```

`activeModal` determines which modal is currently displayed.

------------------------------------------------------------------------

## 6. Authentication Flow

When the React application starts, `App.jsx` calls:

``` javascript
checkAuth()
```

through an effect.

The API call is:

``` text
GET /auth/me
```

The result controls:

``` text
isAuthenticated
```

If authentication succeeds:

``` text
Dashboard application
```

is rendered.

If authentication fails:

``` text
Login
```

is rendered.

The frontend also keeps:

``` text
authLoading
```

true until the initial authentication check finishes.

------------------------------------------------------------------------

## 7. Login Flow

The `Login` component receives:

``` javascript
onLogin={handleLogin}
```

After the login operation succeeds, `handleLogin()` calls:

``` javascript
checkAuth()
```

again.

If the session is authenticated:

``` text
activePage = dashboard
isAuthenticated = true
```

and the browser hash is set to:

``` text
#/dashboard
```

The login UI therefore hands control back to `App.jsx`, which renders
the main dashboard.

------------------------------------------------------------------------

## 8. API Layer

The frontend API abstraction is:

``` text
src/api/api.js
```

The current implementation sets:

``` javascript
const API_BASE = "";
```

The comments in the current implementation state that the project uses a
Vite development proxy, so requests are relative to the frontend origin.

The API layer therefore calls endpoints such as:

``` text
/auth/login
/tickets
/notifications
```

instead of hardcoding the backend URL in every request.

------------------------------------------------------------------------

## 9. Authentication API Functions

### `loginRequest()`

``` text
POST /auth/login
```

Request body:

``` json
{
    "identifier": "...",
    "password": "..."
}
```

The request uses:

``` text
credentials: include
```

so the authentication cookie can be maintained.

### `checkAuth()`

``` text
GET /auth/me
```

Returns:

``` text
response.ok
```

### `logoutRequest()`

``` text
POST /auth/logout
```

Uses credentials.

### `registerRequest()`

``` text
POST /auth/register
```

Request fields:

``` text
full_name
username
email
password
```

### `forgotPasswordRequest()`

``` text
POST /auth/forgot-password
```

Request:

``` json
{
    "email": "..."
}
```

### `resetPasswordRequest()`

``` text
POST /auth/reset-password
```

Request:

``` json
{
    "token": "...",
    "new_password": "..."
}
```

------------------------------------------------------------------------

## 10. Ticket API Functions

### Fetch tickets

``` text
GET /tickets
```

Implemented by:

``` javascript
fetchTickets()
```

The current API function treats HTTP 401 as:

``` text
UNAUTHORIZED
```

and throws that error so `App.jsx` can move the application back to the
unauthenticated state.

### Close ticket

``` text
PUT /tickets/{ticketNumber}/close
```

Implemented by:

``` javascript
closeTicket(ticketNumber)
```

### Reopen ticket

``` text
PUT /tickets/{ticketNumber}/reopen
```

Request body:

``` json
{
    "priority": "...",
    "reason": "..."
}
```

### Upgrade ticket

``` text
PUT /tickets/{ticketNumber}/priority
```

Request body:

``` json
{
    "priority": "P3"
}
```

### Acknowledge ticket

``` text
PUT /tickets/{ticketNumber}/acknowledge
```

Implemented by:

``` javascript
acknowledgeTicket(ticketNumber)
```

------------------------------------------------------------------------

## 11. Troubleshooting API

The frontend calls:

``` text
GET /troubleshoot/{ticketNumber}
```

through:

``` javascript
troubleshootTicket(ticketNumber)
```

The returned data contains:

``` text
recommendation
historicalIncidents
```

`App.jsx` stores those values in:

``` text
troubleshootData
```

and passes them to:

``` text
TroubleshootModal
```

The frontend therefore acts as the presentation layer for the RAG
troubleshooting result.

------------------------------------------------------------------------

## 12. Initial Data Loading

Once the user is authenticated, an effect performs:

``` text
fetchTickets()
fetchNotifications()
```

This is the initial dashboard data load.

The ticket response updates:

``` text
tickets
lastDataUpdate
backendOnline
```

The notification response updates:

``` text
notifications
```

------------------------------------------------------------------------

## 13. Automatic Refresh

The frontend supports automatic refresh.

The default refresh interval is:

``` text
20 seconds
```

It is loaded from:

``` text
localStorage key: alarmops-refresh-rate
```

The enable/disable state is loaded from:

``` text
localStorage key: alarmops-refresh-enabled
```

When automatic refresh is enabled, `App.jsx` creates two intervals:

``` text
Ticket refresh
Notification refresh
```

Both use:

``` text
refreshInterval * 1000
```

milliseconds.

When the effect is cleaned up, both intervals are cleared.

------------------------------------------------------------------------

## 14. Manual Refresh

The `Topbar` receives:

``` javascript
onRefresh={handleRefresh}
```

`handleRefresh()`:

1.  Sets `loading` to true.
2.  Calls `fetchTickets()`.
3.  Calls `fetchNotifications()`.
4.  Waits for both through `Promise.all()`.
5.  Sets loading to false in the final step.

------------------------------------------------------------------------

## 15. Backend Connection Handling

`App.jsx` tracks:

``` text
backendOnline
```

When ticket loading succeeds:

``` text
backendOnline = true
```

If ticket loading fails:

``` text
backendOnline = false
```

If the backend reconnects after being unavailable, the frontend can
display a toast:

``` text
Backend Reconnected
Connection to the backend has been restored.
```

When the frontend detects a connection failure while already connected,
it opens a message modal explaining that the backend API could not be
reached.

------------------------------------------------------------------------

## 16. Dashboard Navigation

The frontend supports three application pages:

``` text
Dashboard
Notifications
Settings
```

`activePage` controls which component is rendered.

### Dashboard

``` text
SummaryCards
TicketTable
```

### Notifications

``` text
Notifications
```

### Settings

``` text
Settings
```

------------------------------------------------------------------------

## 17. Hash-Based Navigation

The application reads the browser hash using:

``` javascript
window.location.hash
```

The supported values are:

``` text
dashboard
notifications
settings
```

If the hash does not match one of these values, the application defaults
to:

``` text
dashboard
```

A `hashchange` event listener updates `activePage` when the URL hash
changes.

------------------------------------------------------------------------

## 18. Sidebar

The `Sidebar` component receives:

``` text
backendOnline
collapsed
notificationCount
activePage
onNavigate
onToggle
```

It therefore displays navigation and status information while `App.jsx`
remains responsible for the actual application state.

The sidebar collapsed state is stored in:

``` text
alarm-sidebar-collapsed
```

in `localStorage`.

The current implementation initializes the sidebar as collapsed when
that setting has never been saved.

------------------------------------------------------------------------

## 19. Topbar

The `Topbar` receives:

``` text
searchTerm
onSearchChange
darkMode
onToggleTheme
onRefresh
onLogout
activePage
```

It provides the top-level controls for:

-   Search.
-   Theme toggle.
-   Manual refresh.
-   Logout.
-   Current page context.

Search input is controlled by `App.jsx` through:

``` text
searchTerm
```

------------------------------------------------------------------------

## 20. Ticket Filtering

The ticket list is filtered in `App.jsx` before being passed to
`TicketTable`.

Two filtering mechanisms are combined.

### Column filters

The frontend checks each configured filter.

If a filter value is:

``` text
ALL
```

the field is ignored.

Otherwise the ticket field is compared against the selected value.

For the status filter, the frontend derives a display status:

``` text
CLOSED
REOPENED
OPEN
```

The `REOPENED` display state is derived when the ticket is not closed
and has a `reopenedAt` value.

### Search filter

The search term is compared against:

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

The values are joined into a searchable string and compared
case-insensitively.

------------------------------------------------------------------------

## 21. Ticket Sorting

After filtering, tickets are sorted by:

``` text
getTicketActivityTime(ticket, notifications)
```

The most recently active tickets appear first.

The activity calculation is therefore based on the ticket and its
notification/event information rather than simply the original ticket
creation order.

------------------------------------------------------------------------

## 22. Summary Cards

`SummaryCards` receives:

``` text
tickets
loading
```

It provides the dashboard's high-level ticket summary.

The component is intentionally kept separate from `App.jsx`; `App.jsx`
supplies the source ticket data.

------------------------------------------------------------------------

## 23. Ticket Table

`TicketTable` receives:

``` text
tickets
allTickets
notifications
loading
columnFilters
onColumnFilterChange
onDetails
onUpgrade
onTroubleshoot
onClose
onReopen
```

This makes `TicketTable` responsible for displaying ticket information
and exposing ticket actions, while `App.jsx` performs the API
operations.

The action flow is:

``` text
TicketTable
    |
    +--> Details
    |
    +--> Upgrade
    |
    +--> Troubleshoot
    |
    +--> Close
    |
    +--> Reopen
    |
    v
App.jsx handler
    |
    v
api.js
    |
    v
FastAPI
```

------------------------------------------------------------------------

## 24. Ticket Details

Selecting ticket details calls:

``` javascript
openDetails(ticket)
```

which sets:

``` text
selectedTicket = ticket
activeModal = details
```

`App.jsx` then renders:

``` text
TicketDetailsModal
```

with the selected ticket and notifications.

Closing the modal calls:

``` text
closeAllModals()
```

which clears the modal and selected-ticket state.

------------------------------------------------------------------------

## 25. Priority Upgrade Flow

The user selects the upgrade action in `TicketTable`.

`App.jsx` executes:

``` text
openUpgrade(ticket)
```

which stores the ticket and opens:

``` text
UpgradeModal
```

After the user chooses a new priority:

``` text
confirmUpgrade(newPriority)
```

calls:

``` text
upgradeTicketAPI(
    selectedTicket.ticketNumber,
    newPriority
)
```

The backend updates the ticket.

The frontend then performs an optimistic local update:

``` text
tickets
    |
    v
selected ticket priority changed locally
```

The modal closes, notifications are refreshed, and a success toast is
displayed.

------------------------------------------------------------------------

## 26. Close Ticket Flow

The close action follows:

``` text
TicketTable
    |
    v
openClose(ticket)
    |
    v
CloseTicketModal
    |
    v
confirmClose()
    |
    v
PUT /tickets/{ticketNumber}/close
```

After a successful response, the frontend updates the selected ticket
locally:

``` text
status = CLOSED
```

It then:

-   Closes the modal.
-   Refreshes notifications.
-   Shows a success toast.

------------------------------------------------------------------------

## 27. Reopen Ticket Flow

The reopen workflow uses two modals.

### Step 1 --- Reopen modal

``` text
ReopenTicketModal
```

collects:

``` text
priority
reason
```

### Step 2 --- Confirmation modal

The entered data is stored in:

``` text
reopenData
```

and the frontend opens:

``` text
ConfirmReopenModal
```

### Step 3 --- API request

Confirmation calls:

``` text
PUT /tickets/{ticketNumber}/reopen
```

with:

``` json
{
    "priority": "...",
    "reason": "..."
}
```

After success, the local ticket is updated to:

``` text
status = OPEN
priority = returned priority
reopenedAt = returned reopenedAt
```

Notifications are refreshed and a success toast is displayed.

------------------------------------------------------------------------

## 28. Acknowledge Notification Flow

`Notifications` receives:

``` text
onAcknowledge
```

from `App.jsx`.

The callback calls:

``` text
PUT /tickets/{ticketNumber}/acknowledge
```

After the backend responds successfully:

1.  Notifications are fetched again.
2.  The updated notification state is stored.
3.  A success toast is displayed.

This keeps acknowledgement state synchronized with the backend.

------------------------------------------------------------------------

## 29. Troubleshooting Flow

When the operator selects Troubleshoot:

``` text
TicketTable
    |
    v
openTroubleshoot(ticket)
    |
    v
TroubleshootModal opens
    |
    v
Loading...
    |
    v
GET /troubleshoot/{ticketNumber}
    |
    v
FastAPI
    |
    v
RAG
    |
    v
Recommendation
    |
    v
App.jsx updates troubleshootData
    |
    v
TroubleshootModal displays result
```

The modal is opened immediately with:

``` text
recommendation = "Loading..."
```

The API response then replaces the loading text with the actual
recommendation.

------------------------------------------------------------------------

## 30. Notifications Page

`Notifications.jsx` manages its own presentation state:

``` text
statusFilter
slaFilter
searchTerm
currentPage
modalTicketNumber
```

The current notification page displays up to:

``` text
10 notification groups per page
```

------------------------------------------------------------------------

## 31. Notification Grouping

Notifications are grouped by:

``` text
ticketNumber
```

This means multiple events belonging to one ticket are displayed as one
ticket-level notification group.

Within each group, notifications are sorted newest-first using their
timestamps.

The group stores:

``` text
ticketNumber
ticket
notifications
latestNotif
activityTime
```

------------------------------------------------------------------------

## 32. Notification Filters

The notification page supports:

``` text
Status filter
SLA filter
Search
Pagination
```

The status filter compares the ticket's current status.

The SLA filter uses:

``` text
getTicketSlaStatus(ticket, notifications)
```

Search can match against:

``` text
ticket number
assigned team
node
alarm type
priority
notification messages
priority transition text
```

Whenever search or filter state changes, the current page is reset to
page 1.

------------------------------------------------------------------------

## 33. Notification Pagination

The page size is:

``` text
10 groups
```

The frontend calculates:

``` text
totalPages
startIndex
endIndex
paginatedGroups
```

Only the selected page's groups are rendered.

------------------------------------------------------------------------

## 34. Sidebar Notification Count

`App.jsx` calculates a notification count for the sidebar.

The current condition requires:

``` text
ticket status = OPEN
ticket has notifications
SLA status = WITHIN_SLA
```

The count is based on tickets satisfying those conditions.

------------------------------------------------------------------------

## 35. Settings

`Settings.jsx` receives configuration state from `App.jsx`.

Current settings include:

``` text
Dark mode
Automatic refresh
Refresh interval
Backend status
Sidebar collapsed state
Last data update
```

The parent component persists refresh and sidebar settings using
`localStorage`.

------------------------------------------------------------------------

## 36. Theme Handling

The frontend maintains:

``` text
darkMode
```

When it changes, an effect updates:

``` html
data-theme="dark"
```

or:

``` html
data-theme="light"
```

on the document root.

The selected theme is also stored under:

``` text
alarmops-theme
```

in `localStorage`.

------------------------------------------------------------------------

## 37. Refresh Settings

The refresh interval is stored under:

``` text
alarmops-refresh-rate
```

The automatic-refresh toggle is stored under:

``` text
alarmops-refresh-enabled
```

The default refresh interval is:

``` text
20 seconds
```

and automatic refresh defaults to enabled when no previous setting
exists.

------------------------------------------------------------------------

## 38. Toast System

`App.jsx` provides:

``` javascript
addToast(type, title, message)
```

A toast is given:

``` text
id
type
title
message
duration
```

The current duration is:

``` text
3800 ms
```

After the duration expires, the toast is removed automatically.

`ToastHost` renders the active toast list.

The system also provides:

``` javascript
removeToast(id)
```

for explicit dismissal.

------------------------------------------------------------------------

## 39. Generic Message Modal

`MessageModal` is used for frontend-level messages such as backend
connection failures.

The state is:

``` text
messageData.title
messageData.message
```

The modal is activated by:

``` text
activeModal = message
```

This provides a common UI path for errors that are not handled by the
ticket-specific modals.

------------------------------------------------------------------------

## 40. Logout Flow

The logout button in `Topbar` does not immediately log the user out.

It first opens:

``` text
LogoutConfirmModal
```

If confirmed:

``` text
logoutRequest()
```

calls:

``` text
POST /auth/logout
```

The frontend then:

``` text
closes logout modal
sets active page to dashboard
sets isAuthenticated to false
```

The login interface is subsequently rendered.

If the user cancels, the logout modal is closed without performing the
logout request.

------------------------------------------------------------------------

## 41. Authentication Error Handling

The API layer identifies HTTP 401 responses for protected
ticket/notification requests.

For ticket and notification retrieval:

``` text
401
  |
  v
Error("UNAUTHORIZED")
  |
  v
App.jsx
  |
  v
isAuthenticated = false
```

This causes the frontend to return to the login screen.

------------------------------------------------------------------------

## 42. Backend and Frontend Responsibilities

The frontend is responsible for:

``` text
Presentation
User interaction
Local UI state
Filtering
Pagination
Modal state
Toast state
Refresh scheduling
API request initiation
```

The backend is responsible for:

``` text
Authentication
Ticket persistence
Ticket state changes
Priority validation
Close/reopen validation
Notification/event persistence
RAG execution
Database operations
```

The frontend does not implement the ticket business rules itself.

------------------------------------------------------------------------

## 43. End-to-End Ticket Interaction

A typical ticket interaction looks like:

``` text
PostgreSQL
    |
    v
FastAPI GET /tickets
    |
    v
api.js fetchTickets()
    |
    v
App.jsx tickets state
    |
    v
Filtering + sorting
    |
    v
TicketTable
    |
    v
Operator action
    |
    v
Modal
    |
    v
api.js
    |
    v
FastAPI PUT endpoint
    |
    v
PostgreSQL
    |
    v
App.jsx state refresh/update
    |
    v
Updated UI
```

------------------------------------------------------------------------

## 44. End-to-End Notification Interaction

``` text
TicketEvent in PostgreSQL
        |
        v
GET /notifications
        |
        v
api.js
        |
        v
App.jsx notifications
        |
        v
Notifications.jsx
        |
        v
Group by ticket
        |
        v
Filter / search / pagination
        |
        v
Notification history modal
```

Acknowledgement follows:

``` text
Notification
    |
    v
Acknowledge
    |
    v
api.js
    |
    v
PUT /tickets/{ticketNumber}/acknowledge
    |
    v
FastAPI
    |
    v
TicketEvent update
    |
    v
Refresh notifications
```

------------------------------------------------------------------------

## 45. End-to-End Troubleshooting Interaction

``` text
TicketTable
    |
    v
Troubleshoot button
    |
    v
App.jsx
    |
    v
api.js
    |
    v
GET /troubleshoot/{ticketNumber}
    |
    v
FastAPI
    |
    v
PostgreSQL ticket context
    |
    v
RAG
    |
    v
Recommendation
    |
    v
FastAPI response
    |
    v
App.jsx troubleshootData
    |
    v
TroubleshootModal
```

------------------------------------------------------------------------

## 46. Current Frontend Data Model

The frontend does not create a separate database model.

It consumes the JSON structures returned by FastAPI.

Ticket objects contain fields such as:

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

Notification objects contain fields such as:

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

------------------------------------------------------------------------

## 47. Local Storage Usage

The current frontend uses browser `localStorage` for UI preferences.

Keys used include:

  Key                          Purpose
  ---------------------------- ------------------------------------
  `alarmops-refresh-rate`      Automatic refresh interval
  `alarmops-refresh-enabled`   Automatic refresh enabled/disabled
  `alarm-sidebar-collapsed`    Sidebar collapsed state
  `alarmops-theme`             Selected theme

Authentication itself is checked through the backend session using
`/auth/me`; the current `App.jsx` version performs the backend
authentication check rather than relying only on a local authentication
flag.

------------------------------------------------------------------------

## 48. Component Communication Pattern

The application uses a parent-to-child data flow.

Example:

``` text
App.jsx
   |
   +--> tickets
   +--> notifications
   +--> loading
   +--> callbacks
           |
           v
     TicketTable
```

The child components notify the parent of user actions through
callbacks:

``` text
onDetails
onUpgrade
onClose
onReopen
onTroubleshoot
onAcknowledge
```

The parent then performs the API operation.

This keeps backend mutations centralized in `App.jsx`.

------------------------------------------------------------------------

## 49. Current Frontend Characteristics

The current implementation has these characteristics:

  Area                            Implementation
  ------------------------------- ------------------------------
  Framework                       React
  Main state owner                `App.jsx`
  API communication               Fetch API
  API base                        Relative URLs
  Backend                         FastAPI
  Authentication                  Backend session + `/auth/me`
  Ticket state                    React state
  Notification state              React state
  Navigation                      Browser hash + React state
  Persistence of UI preferences   `localStorage`
  Automatic refresh               `setInterval`
  Filtering                       Client-side
  Notification grouping           Client-side
  Notification pagination         Client-side
  Ticket actions                  FastAPI API calls
  Troubleshooting                 FastAPI → RAG
  Toasts                          Local React state
  Modals                          Local React state

------------------------------------------------------------------------

## 50. Current Implementation Notes

### API URL is not hardcoded in `api.js`

The current implementation uses:

``` javascript
const API_BASE = "";
```

and relies on relative API requests.

Therefore the API layer does not currently hardcode:

``` text
http://127.0.0.1:8001
```

as its active base URL.

### Backend port text can still exist in UI/error text

Although the API base is relative, some frontend error messaging refers
to the backend service running on port `8001`.

This is UI/error text rather than the request base URL.

### State updates are a mixture of local updates and refetches

For some mutations, the frontend updates tickets immediately:

``` text
priority upgrade
ticket close
ticket reopen
```

and refreshes notifications afterward.

This is different from always refetching the complete ticket list after
every mutation.

------------------------------------------------------------------------

## 51. Overall Frontend Architecture

The current frontend can be summarized as:

``` text
                         App.jsx
                            |
        +-------------------+-------------------+
        |                   |                   |
        v                   v                   v
    Navigation          Dashboard          Notifications
        |                   |                   |
    Sidebar              Summary            Grouping
    Topbar               TicketTable        Filtering
                         Filters             Pagination
                         Actions
                            |
                            v
                          Modals
                            |
                            v
                          api.js
                            |
                            v
                         FastAPI
                            |
              +-------------+-------------+
              |             |             |
              v             v             v
           Database      Ticket APIs      RAG
```

------------------------------------------------------------------------

## 52. Summary

The React frontend is the operator-facing layer of the Alarm Automation
application.

`App.jsx` acts as the central coordinator. It manages authentication
state, ticket and notification data, navigation, filters, refresh
scheduling, modal state, settings, and API-driven mutations.

`api.js` provides the boundary between React and FastAPI.

The dashboard is composed from reusable components for:

``` text
Navigation
Topbar
Summary cards
Ticket table
Notifications
Settings
```

Ticket operations are performed through FastAPI rather than directly in
the browser against PostgreSQL.

The frontend also integrates the RAG troubleshooting assistant by
requesting:

``` text
GET /troubleshoot/{ticket_number}
```

and presenting the returned recommendation in `TroubleshootModal`.

The overall frontend flow is:

``` text
Authentication
    ↓
App.jsx
    ↓
Fetch tickets + notifications
    ↓
Dashboard / Notifications / Settings
    ↓
Operator action
    ↓
Modal / component callback
    ↓
api.js
    ↓
FastAPI
    ↓
Database or RAG
    ↓
Response
    ↓
React state update
    ↓
Updated UI
```
