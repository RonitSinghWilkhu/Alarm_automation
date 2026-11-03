# Alarm Automation — Frontend Documentation

---

## Table of Contents

1. [Purpose and Scope](#1-purpose-and-scope)
2. [Frontend Architecture](#2-frontend-architecture)
3. [Main Frontend Files](#3-main-frontend-files)
4. [Application State and Responsibilities](#4-application-state-and-responsibilities)
5. [Authentication and User State](#5-authentication-and-user-state)
6. [Navigation and Role-Based UI Access](#6-navigation-and-role-based-ui-access)
7. [Ticket Operations](#7-ticket-operations)
8. [Ticket Closure and Resolution Questionnaire](#8-ticket-closure-and-resolution-questionnaire)
9. [Ticket Details, Lifecycle History, and SLA Display](#9-ticket-details-lifecycle-history-and-sla-display)
10. [Administrative Features](#10-administrative-features)
11. [AI Root Cause Analysis](#11-ai-root-cause-analysis)
12. [API Layer and Token Refresh](#12-api-layer-and-token-refresh)
13. [Dashboard Search, Filtering, and Sorting](#13-dashboard-search-filtering-and-sorting)
14. [Notifications Page](#14-notifications-page)
15. [Settings and Browser Storage](#15-settings-and-browser-storage)
16. [Toasts and Message Modals](#16-toasts-and-message-modals)
17. [Runtime Data Flow](#17-runtime-data-flow)
18. [Limitations and Source-Code Verification](#18-limitations-and-source-code-verification)
19. [Changelog](#19-changelog)

---

## 1. Purpose and Scope

The Alarm Automation frontend is a React application that provides the operator-facing interface for the Alarm Automation system.

The supplied documentation describes these responsibilities:

- User login, authentication-state initialization, and logout.
- Role-aware navigation and page rendering.
- Ticket dashboard display, search, filtering, and sorting.
- Ticket lifecycle actions, including priority changes, closure, and reopening.
- Resolution information capture during ticket closure.
- Notification display and acknowledgement.
- AI troubleshooting and Root Cause Analysis (RCA) interfaces.
- Admin interfaces for user management and RAG evaluation.
- Access to the external Grafana monitoring dashboard.
- UI preferences, periodic data refresh, and backend connectivity feedback.

The frontend communicates with the FastAPI backend through HTTP requests. It does not directly connect to PostgreSQL. Database access is performed by the backend.

The primary API wrapper identified by the supplied documentation is:

```text
frontend/src/api/api.js
```

---

## 2. Frontend Architecture

The documented high-level architecture is:

```text
                 React Application
                      App.jsx
                         |
          +--------------+--------------+
          |              |              |
          v              v              v
      Components       Modals          Pages
   Sidebar, Topbar,  CloseTicket,   UserManagement,
   TicketTable,     TicketDetails, RAGEvaluation,
   Notifications    Reopen, etc.    AIRca, etc.
          |              |              |
          +--------------+--------------+
                         |
                         v
                frontend/src/api/api.js
                  API request wrapper
                         |
                         v
                    FastAPI API
                         |
                         v
                     PostgreSQL
```

### 2.1 `App.jsx`

The supplied documentation describes `App.jsx` as the main application coordinator. It owns or coordinates major application state, selects the active page, invokes API functions, and passes data and callbacks to child components.

### 2.2 Child components

Components are responsible for focused UI concerns such as:
- rendering the sidebar and top bar;
- displaying tickets and notifications;
- collecting ticket closure or reopening input;
- displaying ticket details and lifecycle history;
- rendering administration and AI feature pages.

### 2.3 API boundary

The API layer centralizes much of the frontend's communication with FastAPI. Components should use the API functions exposed by that layer where implemented.

The supplied document identifies at least one exception: `UserManagement.jsx` reportedly uses a direct `fetch` call to a localhost backend URL. This is discussed in Section 10 and should be checked against the current source before being treated as current behavior.

---

## 3. Main Frontend Files

The following file responsibilities are recorded in the supplied documentation.

| File / component | Documented responsibility |
|---|---|
| `App.jsx` | Main application coordinator, state owner, page selection, and API orchestration. |
| `frontend/src/api/api.js` | Backend request functions and automatic access-token refresh behavior. |
| `Sidebar.jsx` | Main navigation and role-aware navigation item rendering. |
| `Topbar.jsx` | Search, theme control, manual refresh, and logout controls. |
| `TicketTable.jsx` | Ticket list, column filters, and ticket action controls. |
| `CloseTicketModal.jsx` | Ticket closure confirmation and optional resolution questionnaire. |
| `TicketDetailsModal.jsx` | Ticket details, lifecycle history, and SLA/resolution display. |
| `UserManagement.jsx` | Admin interface for viewing users and changing roles. |
| `RAGEvaluation.jsx` | Admin interface for running and viewing RAG evaluation metrics. |
| `AIRca.jsx` | Interface for requesting and displaying AI Root Cause Analysis. |
| `Notifications.jsx` | Notification grouping, filtering, pagination, and acknowledgement UI. |
| `Settings.jsx` | UI preferences such as theme, refresh interval, and sidebar settings. |
| `ToastHost.jsx` | Displays toast notifications managed by the application. |
| `MessageModal.jsx` | Displays general messages and alerts. |

The supplied document also refers to `ReopenTicketModal`, `ConfirmReopenModal`, and `RoleChangeModal`. Their exact file paths were not provided.

---

## 4. Application State and Responsibilities

The supplied documentation says that `App.jsx` uses React state to coordinate application behavior. The state categories below are based on the names and responsibilities described in that document; exact declarations and ownership should be checked in the source.

### 4.1 Authentication and user state

| State name | Documented purpose |
|---|---|
| `isAuthenticated` | Determines whether the authenticated application or login UI is shown. |
| `authLoading` | Represents the initial authentication-check state and helps avoid rendering the wrong screen before the check completes. |
| `currentUser` | Holds the authenticated user's information, including the role field. |

### 4.2 Application data and connectivity

| State name | Documented purpose |
|---|---|
| `tickets` | Ticket records displayed by the application. |
| `notifications` | Notification/event records displayed by the application. |
| `loading` | Loading state for data operations. |
| `backendOnline` | UI state representing backend connectivity. |
| `lastDataUpdate` | Time of the most recent data update, as represented by the UI. |

### 4.3 Navigation and UI preferences

| State name | Documented purpose |
|---|---|
| `activePage` | Currently selected page. |
| `searchTerm` | Dashboard search input. |
| `columnFilters` | Dashboard column-filter selections. |
| `darkMode` | Current theme state. |
| `sidebarCollapsed` | Sidebar expanded/collapsed state. |
| `refreshInterval` | Configured data refresh interval. |
| `refreshEnabled` | Whether periodic refresh is enabled. |

The supplied document lists these page identifiers:

```text
dashboard
notifications
settings
users
evaluation
grafana
ai-rca
```

### 4.4 Modal and feature state

| State name | Documented purpose |
|---|---|
| `activeModal` | Identifies the currently active modal. |
| `selectedTicket` | Ticket selected for a modal or ticket action. |
| `troubleshootData` | Holds troubleshooting recommendations and historical incident data. |
| `rcaResult` | Holds the RCA result displayed in the UI. |
| `rcaLoading` | Indicates that an RCA request is in progress. |
| `rcaError` | Holds an RCA-related error state. |
| `toasts` | Holds toast messages to be displayed. |

Do not assume every state variable listed above is still declared in `App.jsx`; verify names and current ownership in the actual source.

---

## 5. Authentication and User State

The supplied documentation describes a JWT-based authentication design using access and refresh tokens delivered through HTTP-only cookies.

### 5.1 Initial authentication check

On application startup, the documented flow is:

1. `App.jsx` enters an authentication-loading state.
2. It invokes `checkAuth()`.
3. `checkAuth()` sends `GET /auth/me`.
4. If the request succeeds, the frontend stores the returned user information in `currentUser` and marks the user as authenticated.
5. If the request does not establish a valid authenticated user, the frontend displays the login interface.

The exact handling of network errors versus authentication failures should be checked in `App.jsx` and `api.js`. A network outage should not automatically be described as equivalent to a confirmed invalid credential unless the implementation treats it that way.

### 5.2 Login

The supplied documentation says that a successful login causes the backend to set two HTTP-only cookies:

- `alarmops_access_token`
- `alarmops_refresh_token`

The access token is described as short-lived and the refresh token as longer-lived. The original document gave example lifetimes of 30 minutes and 7 days; these are examples, not guaranteed configuration values. The actual expiry must be read from the backend authentication configuration.

Because the cookies are HTTP-only, frontend JavaScript cannot read their values directly. The browser sends eligible cookies with requests when the request uses the appropriate credentials setting and cookie policy.

The frontend's authentication state is therefore represented through the result of authenticated API calls, such as `/auth/me`, rather than by reading the cookie values.

### 5.3 Logout

The documented logout flow is:

1. The frontend calls `POST /auth/logout`.
2. The backend handles refresh-token revocation and cookie clearing, as implemented by the server.
3. The frontend clears its local authenticated-user state and returns to the login UI.

The exact behavior when the logout request fails, and whether the frontend still clears local state, must be verified in the implementation.

### 5.4 Browser storage

The supplied documentation states that authentication tokens are not stored in `localStorage`. This is consistent with the documented HTTP-only-cookie design. UI preferences may still be stored in `localStorage`; see Section 15.

---

## 6. Navigation and Role-Based UI Access

The supplied documentation describes hash-based navigation, with page identifiers represented in the URL hash.

Examples:

```text
#/dashboard
#/notifications
#/settings
#/users
#/evaluation
#/grafana
#/ai-rca
```

### 6.1 Role-aware navigation

The `Sidebar` receives the user's role from the application and conditionally displays admin navigation items.

The supplied document identifies these as admin-only navigation items:
- User Management (`users`)
- RAG Evaluation (`evaluation`)

It also lists Grafana as an admin-only page in its page-access summary. The actual conditional rendering for Grafana should be verified in `Sidebar.jsx` and the page-selection logic.

### 6.2 Frontend route checks

The supplied document says that `App.jsx` listens for `hashchange` and redirects non-admin users away from the `users` and `evaluation` pages.

This is a frontend navigation guard. It improves the UI experience but is not a security boundary.

**Backend authorization is mandatory.** Admin API endpoints must independently validate the user's role. Hiding a link or redirecting a browser does not prevent a user from calling an API directly.

### 6.3 Documented page access

The original document lists:

| Page | Documented access |
|---|---|
| Dashboard | All users |
| Notifications | All users |
| AI RCA | All users |
| Settings | All users |
| User Management | Admin only |
| RAG Evaluation | Admin only |
| Grafana | Admin only |

This table records the access policy stated in the supplied frontend document. Confirm the Grafana rule in the actual source because the original example of the route guard explicitly mentions only `users` and `evaluation`.

### 6.4 Sidebar behavior

The supplied document identifies `sidebarCollapsed` as UI state and lists a local-storage key for the collapsed setting. It does not provide enough detail to establish precisely when the sidebar opens or closes during page navigation.

Therefore, no claim is made here that the sidebar automatically closes after selecting a page, remains open, or persists its state in every navigation scenario. Those behaviors must be documented from the current `Sidebar.jsx` and `App.jsx`.

---

## 7. Ticket Operations

The supplied documentation describes ticket actions as being initiated from `TicketTable.jsx`, handled by `App.jsx`, and sent to the backend through API functions.

### 7.1 Priority change

The documented flow is:

1. The operator initiates a priority action from the ticket UI.
2. `App.jsx` invokes `upgradeTicketAPI()` for the described priority-upgrade path.
3. The frontend updates the displayed ticket state optimistically, according to the supplied document.
4. The frontend refreshes notification data.

The original document specifically describes priority upgrade. It does not provide enough detail to document the complete downgrade flow, all modal behavior, rollback behavior after an API failure, or the exact API endpoint. Those details should be verified in `App.jsx`, `TicketTable.jsx`, and `api.js`.

### 7.2 Reopen ticket

The supplied documentation describes a two-stage confirmation flow:

1. `ReopenTicketModal` collects the new priority and a reason.
2. `ConfirmReopenModal` asks the operator to confirm the action.
3. The frontend calls `reopenTicketAPI()`.
4. On success, the ticket's displayed status is updated to `OPEN`.

The exact behavior on API failure and the precise state-refresh strategy are not specified in the supplied material.

### 7.3 Close ticket

Ticket closure is handled through `CloseTicketModal.jsx`. The operator can either close the ticket without entering resolution details or open the resolution questionnaire before submitting the closure. The detailed flow is in Section 8.

---

## 8. Ticket Closure and Resolution Questionnaire

The supplied documentation describes `CloseTicketModal.jsx` as supporting optional resolution capture during ticket closure.

### 8.1 Initial modal view

The operator is shown the ticket number and three actions:

- **Cancel** — dismisses the closure flow without closing the ticket.
- **Add Resolution Details** — opens the questionnaire.
- **Skip & Close Ticket** — requests ticket closure without submitting questionnaire data.

### 8.2 Resolution questionnaire

The supplied document lists nine optional text fields:

1. Observed Symptoms
2. Root Cause
3. Actions Taken
4. Shell Commands Used
5. Shell Script Used
6. Resolution
7. Verification Results
8. Escalation Details
9. Additional Notes

These are the fields described by the frontend documentation. The exact request property names and validation rules must be taken from `CloseTicketModal.jsx` and the API/backend schema.

### 8.3 Frontend request flow

The documented behavior is:

- If the operator skips the questionnaire, `App.jsx` calls `closeTicketAPI(ticketNumber)`.
- If the operator submits resolution details, `App.jsx` calls `closeTicketAPI(ticketNumber, resolutionData)`.

### 8.4 Backend responsibility

The frontend collects and submits the resolution information. The backend is responsible for validating the request and persisting the data.

The supplied documentation says that, when resolution data is provided, the backend creates a `HistoricalIncident` linked to the ticket. It also claims that the RAG vector store is refreshed. That second claim cannot be established from the frontend document alone and should only be stated as implementation behavior after checking the backend RAG code.

The frontend itself does not directly write to PostgreSQL or update a vector index.

---

## 9. Ticket Details, Lifecycle History, and SLA Display

The supplied documentation identifies `TicketDetailsModal.jsx` as the component that presents ticket information and history.

### 9.1 Ticket information

The modal is described as displaying ticket fields such as:
- Node
- Alarm Type
- Severity
- Impact
- Priority
- Assigned Team
- Other available ticket details

The exact set of fields depends on the ticket object returned by the backend and rendered by the component.

### 9.2 Lifecycle history

The supplied documentation says that the modal renders a vertical timeline of `TicketEvent` records, using the `notifications` array passed from `App.jsx`.

The original document gives examples such as:
- Created
- Upgraded
- Downgraded
- Closed
- Reopened

These are event descriptions, not a guaranteed exhaustive list of event types. The actual mapping from backend event values to timeline labels should be checked in `TicketDetailsModal.jsx`.

### 9.3 SLA and resolution display

The supplied documentation says that the modal displays SLA-related information for non-P4 tickets, including:
- elapsed time for unresolved tickets;
- resolution time for closed tickets;
- remaining time before an SLA threshold;
- an SLA status label, with examples such as `Within SLA`, `Breached`, `Resolved Within SLA`, and `Resolved After SLA`.

It also describes a live timer that updates every second while the modal is open for an unresolved ticket.

The supplied material does not define the SLA thresholds, the exact priority-to-SLA mapping, the calculation formula, or the handling of reopened tickets. These must be verified in the component implementation and any shared SLA utility.

Do not infer that the displayed timer is an authoritative backend SLA clock. It is a frontend display calculation unless the implementation explicitly obtains the value from the backend.

---

## 10. Administrative Features

### 10.1 User Management — `UserManagement.jsx`

The supplied documentation describes the following functionality:

- Fetches users using `GET /auth/users`.
- Supports searching by name, username, and email.
- Supports role and account-status filtering.
- Displays a paginated table with 10 users per page.
- Allows an administrator to request a role change.
- Uses a `RoleChangeModal` for confirmation.
- Sends the role update through `PATCH /auth/users/{id}/role`.

The original document states that this component uses a direct `fetch` call to `http://localhost:8001` rather than the shared `api.js` wrapper. This is a potential deployment and maintainability issue:
- a hard-coded localhost URL will not work for users whose browser is not running on the backend host;
- direct fetch may bypass centralized token-refresh and error-handling behavior;
- it can create inconsistent API configuration between pages.

This should be treated as a documented implementation exception only if it remains present in the current `UserManagement.jsx`. Prefer a shared API function and configured backend base URL if the source is being refactored.

### 10.2 RAG Evaluation — `RAGEvaluation.jsx`

The supplied documentation describes this admin page as supporting:
- `POST /api/evaluate/run` to start an evaluation;
- `GET /api/evaluate/history` to retrieve previous evaluation results;
- display of metrics such as Context Precision, Faithfulness, Relevancy, and Overall Score.

The database persistence of evaluation records is a backend responsibility. The frontend triggers the operation and renders the response.

### 10.3 Grafana Monitoring

The supplied documentation describes a page that provides a link to an external Grafana dashboard.

It does not specify:
- the Grafana URL;
- whether the page embeds Grafana or opens it separately;
- how Grafana authentication is handled;
- whether the destination is environment-configurable.

Those details should be added only after inspecting the current component and configuration.

---

## 11. AI Root Cause Analysis

The supplied documentation identifies `AIRca.jsx` as the frontend page for requesting and displaying Root Cause Analysis.

### 11.1 Eligibility described by the document

The original documentation says that only closed tickets with priority `P1` or `P2` can be analyzed.

Treat this as a UI eligibility rule until verified. The backend must independently validate any eligibility or authorization requirements; client-side filtering is not sufficient enforcement.

### 11.2 Request flow

The documented flow is:

1. The operator selects a ticket in the RCA page.
2. `AIRca.jsx` invokes the callback provided by `App.jsx`.
3. `App.jsx` calls `analyzeTicketRca(ticketNumber)`.
4. The application updates `rcaLoading`, `rcaError`, and `rcaResult`.
5. The RCA page renders the result or an error/loading state.

The supplied material does not identify the exact RCA endpoint, request schema, response schema, or model/provider used. These details should be documented from `api.js` and the backend RCA route.

### 11.3 RCA versus troubleshooting

The application documentation identifies both troubleshooting recommendations and RCA results. They should not be treated as the same operation:
- troubleshooting presents recommended actions or relevant knowledge for an alarm;
- RCA generates an analysis for a selected ticket according to the described RCA workflow.

The exact implementation relationship between these features is not established by the supplied frontend document.

---

## 12. API Layer and Token Refresh

The supplied documentation identifies `frontend/src/api/api.js` as the central API layer and describes an `authenticatedFetch` wrapper.

### 12.1 Responsibilities

The API layer is described as handling:
- requests to the FastAPI backend;
- cookie credentials for authenticated requests;
- access-token refresh after an unauthorized response;
- retrying the original request after a successful refresh;
- returning an unauthorized response when refresh cannot restore authentication.

### 12.2 Documented request sequence

```text
Frontend sends protected API request
              |
              v
      authenticatedFetch()
              |
              v
      fetch(..., credentials: "include")
              |
              v
        Response status
              |
       +------+------+
       |             |
    Not 401         401
       |             |
       v             v
 Return response  Call POST /auth/refresh
                     |
                +----+----+
                |         |
             Success    Failure
                |         |
                v         v
       Retry original   Return unauthorized
          request       response to caller
                |
                v
          Return response
```

### 12.3 Cookies and credentials

The supplied document says that authenticated requests use:

```javascript
credentials: "include"
```

This allows the browser to include cookies according to browser cookie rules, CORS configuration, and cookie attributes. It does not override `SameSite`, `Secure`, domain, path, or other cookie restrictions.

### 12.4 Retry behavior and important caveats

The original document provides a simplified wrapper example. It should not be treated as the exact source implementation.

A robust implementation must consider:
- preventing multiple simultaneous `401` responses from starting competing refresh requests;
- preventing an infinite refresh/retry loop;
- excluding the refresh endpoint itself from recursive refresh handling;
- deciding what to do if the retried request also returns `401`;
- preserving the original request body when retrying;
- handling network errors separately from authentication failures;
- ensuring non-idempotent requests are not accidentally duplicated in unsafe ways.

The supplied material does not confirm how these cases are handled. Verify the actual `api.js` implementation before documenting them as implemented features.

### 12.5 Unauthorized handling

The supplied documentation says that when refresh fails, the API wrapper returns an unauthorized response and `App.jsx` handles an `"UNAUTHORIZED"` error state by setting `isAuthenticated` to `false`.

This is a description of the intended frontend flow. Confirm the exact error representation and caller behavior in `api.js` and `App.jsx`; a raw HTTP `Response` object and a thrown string error are different interfaces.

---

## 13. Dashboard Search, Filtering, and Sorting

The supplied documentation describes filtering and sorting logic coordinated by `App.jsx`.

### 13.1 Column filters

The listed filter fields are:
- `node`
- `alarmType`
- `severity`
- `impactLevel`
- `priority`
- `assignedTeam`
- `status`

The original document says the displayed status filter derives a value such as `OPEN`, `REOPENED`, or `CLOSED` from `ticket.status` and `ticket.reopenedAt`.

This is a frontend display/filtering rule as described by the source document. Verify the exact precedence and conditions in the current filter implementation.

### 13.2 Search

The supplied document says the search input matches against:
- `ticketNumber`
- `node`
- `alarmType`
- `assignedTeam`
- `severity`
- `priority`
- `impactLevel`
- `status`

The exact case-sensitivity, partial-match behavior, null handling, and normalization are not specified.

### 13.3 Sorting

The supplied document says tickets are sorted by most recent activity using:

```javascript
getTicketActivityTime(ticket, notifications)
```

This implies the sort calculation considers ticket activity and the notification/event data supplied to it. The exact event-selection logic, fallback timestamp, and sort direction should be verified in the source.

---

## 14. Notifications Page

The supplied documentation identifies `Notifications.jsx` as the page for viewing and acknowledging notification/event records.

### 14.1 Grouping

Notifications are described as being grouped by `ticketNumber`. Multiple events associated with one ticket are displayed in a single expandable group.

### 14.2 Filters and pagination

The supplied document lists:
- status filter;
- SLA status filter;
- search;
- pagination with 10 groups per page.

The exact filter values and whether pagination happens before or after filtering should be checked in the component.

### 14.3 Acknowledgement

The supplied documentation describes the acknowledgement flow as:
1. The operator clicks the acknowledgement control.
2. The frontend sends `PUT /tickets/{id}/acknowledge`.
3. The backend updates the relevant event state.
4. The frontend refreshes notification data.

The endpoint placeholder `{id}` is ambiguous in the original document: it may represent a ticket identifier or another identifier. Do not assume whether it is a database ticket ID or a ticket number until the API function and backend route confirm it.

Acknowledging a notification should not be described as closing the ticket. These are separate lifecycle operations.

---

## 15. Settings and Browser Storage

The supplied documentation says that `Settings.jsx` exposes UI preferences and that the following keys are used in `localStorage`.

| Key | Documented purpose |
|---|---|
| `alarmops-theme` | Stores the selected theme, described as `"dark"` or `"light"`. |
| `alarm-sidebar-collapsed` | Stores the sidebar collapsed state, described as `"true"` or `"false"`. |
| `alarmops-refresh-enabled` | Stores whether automatic refresh is enabled. |
| `alarmops-refresh-rate` | Stores the refresh interval in seconds; the supplied document lists `20` as the default. |

These keys and values are taken from the supplied document and should be checked against the actual settings implementation.

### 15.1 Authentication data versus preferences

The supplied documentation distinguishes authentication from UI preferences:
- authentication tokens are managed by HTTP-only cookies;
- UI preferences may be stored in `localStorage`.

Do not store access or refresh token values in `localStorage` if the intended architecture is HTTP-only-cookie authentication.

### 15.2 Refresh behavior

The document identifies a configurable refresh interval and an enable/disable setting. It does not specify:
- which API requests are refreshed periodically;
- whether polling pauses when the browser tab is hidden;
- whether overlapping refresh requests are prevented;
- how failures affect the backend-online indicator.

Those details require source verification.

---

## 16. Toasts and Message Modals

### 16.1 Toast notifications

The supplied document describes:
- a `toasts` state array managed by `App.jsx`;
- an `addToast(type, title, message)` helper;
- automatic dismissal after 3,800 milliseconds;
- rendering through `ToastHost.jsx`.

The exact supported toast types, dismissal behavior, and timer cleanup should be checked in the component implementation.

### 16.2 Message modal

`MessageModal.jsx` is described as a reusable modal for general messages, including backend connection failures and API errors.

The supplied material does not define its exact props, severity variants, or dismissal rules.

---

## 17. Runtime Data Flow

The main frontend-to-backend request flow described by the supplied document is:

```text
Operator interaction
        |
        v
React component
        |
        v
App.jsx handler / page handler
        |
        v
API function in api.js
        |
        v
authenticatedFetch (where used)
        |
        v
FastAPI endpoint
        |
        v
Backend business logic
        |
        v
PostgreSQL / RAG services as required
        |
        v
API response
        |
        v
React state update
        |
        v
UI re-render
```

### 17.1 Ticket update example

```text
Operator selects a ticket action
        |
        v
TicketTable / modal
        |
        v
App.jsx action handler
        |
        v
Ticket API function
        |
        v
FastAPI ticket endpoint
        |
        v
Backend updates ticket and/or creates event
        |
        v
Response returned to frontend
        |
        v
App.jsx updates or reloads ticket/notification state
        |
        v
Dashboard re-renders
```

The exact state update strategy differs by operation. The supplied document mentions an optimistic update for priority upgrade, but does not establish that all ticket actions use optimistic updates.

### 17.2 Frontend/backend responsibility boundary

| Frontend responsibility | Backend responsibility |
|---|---|
| Collect user input. | Validate request data. |
| Render tickets, events, and API results. | Read and persist ticket/event records. |
| Provide UI navigation and role-aware page visibility. | Enforce authentication and authorization. |
| Send resolution questionnaire data. | Persist historical incident data when applicable. |
| Request RAG evaluation or RCA. | Execute the evaluation or analysis workflow. |
| Display errors and loading states. | Return API responses and error statuses. |
| Store non-sensitive UI preferences. | Manage authentication cookies and token validity. |

The frontend is not the authority for database state, token validity, or permission enforcement.

---

## 18. Limitations and Source-Code Verification

The uploaded document described itself as synchronized with current frontend files, but those source files were not included in the material available for this review. The corrections here therefore focus on internal consistency, accurate separation of frontend and backend responsibilities, and avoiding claims that the supplied document does not establish.

The following details require checking against the actual implementation.

| Area | Source file(s) to inspect | What to verify |
|---|---|---|
| App state | `App.jsx` | Exact state declarations, initialization, and ownership. |
| Startup authentication | `App.jsx`, `api.js` | Exact `/auth/me` behavior and handling of network errors versus unauthorized responses. |
| Login/logout | `App.jsx`, login component, `api.js` | Exact request functions and frontend cleanup behavior. |
| Cookie names and expiry | Backend auth code and deployment config | Exact cookie names, lifetimes, `SameSite`, `Secure`, domain, and path attributes. |
| Navigation | `App.jsx`, `Sidebar.jsx` | Exact hash parsing, route changes, redirect behavior, and page access rules. |
| Sidebar persistence | `App.jsx`, `Sidebar.jsx`, `Settings.jsx` | Whether collapse state is persisted and when it changes during navigation. |
| Ticket priority | `App.jsx`, `TicketTable.jsx`, `api.js` | Exact endpoints, upgrade/downgrade behavior, optimistic updates, and failure rollback. |
| Ticket reopening | Reopen modal components, `App.jsx`, `api.js` | Exact two-step flow, payload, and post-success state update. |
| Ticket closure | `CloseTicketModal.jsx`, `App.jsx`, `api.js` | Exact questionnaire field names, optionality, payload, and error behavior. |
| SLA display | `TicketDetailsModal.jsx` and shared utilities | Thresholds, calculation, P4 behavior, reopened-ticket handling, and timer cleanup. |
| User management | `UserManagement.jsx`, `api.js` | Whether it still uses hard-coded `http://localhost:8001` and whether it uses the shared API wrapper. |
| RAG evaluation | `RAGEvaluation.jsx`, `api.js` | Exact endpoints, response shape, and metric names. |
| Grafana page | Grafana page component and config | Destination URL, embedding/open behavior, and access restrictions. |
| RCA | `AIRca.jsx`, `App.jsx`, `api.js` | Exact eligibility checks, endpoint, payload, and response structure. |
| Refresh handling | `api.js` | Concurrency control, retry count, refresh endpoint exclusion, and error semantics. |
| Dashboard filters | `App.jsx`, `TicketTable.jsx` | Exact filter options and derived status logic. |
| Activity sorting | `App.jsx` and activity-time helper | Timestamp selection, fallback, and sort order. |
| Notifications | `Notifications.jsx`, `api.js` | Grouping, pagination, filters, acknowledgement identifier, and refresh behavior. |
| Browser storage | `Settings.jsx`, `App.jsx`, `Sidebar.jsx` | Exact local-storage keys, defaults, and read/write lifecycle. |
| Toasts and message modal | `ToastHost.jsx`, `MessageModal.jsx`, `App.jsx` | Props, supported types, timer behavior, and cleanup. |

### Files needed for a source-verified revision

At minimum, inspect:
- `App.jsx`
- `frontend/src/api/api.js`
- `Sidebar.jsx`
- `Settings.jsx`
- `TicketTable.jsx`
- `CloseTicketModal.jsx`
- `TicketDetailsModal.jsx`
- `Notifications.jsx`
- `UserManagement.jsx`
- `RAGEvaluation.jsx`
- `AIRca.jsx`
- `Topbar.jsx`
- `ToastHost.jsx`
- `MessageModal.jsx`
- the reopen and confirmation modal components

Also inspect the backend authentication, ticket, notification, evaluation, and RCA routes when documenting cross-layer behavior.

---

## 19. Changelog

### Version 2.1 — November 03, 2026

**Corrected**
- Clarified that frontend route gating is not backend authorization.
- Distinguished frontend authentication state from the HTTP-only cookie values.
- Treated example token lifetimes as examples rather than guaranteed configuration.
- Removed the unsupported claim that the frontend itself refreshes the RAG vector store after ticket closure.
- Clarified that the frontend submits resolution data while the backend owns persistence.
- Avoided claiming that every ticket action uses optimistic updates.
- Clarified that notification acknowledgement is separate from ticket closure.
- Removed unsupported assumptions about exact sidebar behavior during navigation.
- Flagged the hard-coded localhost URL in `UserManagement.jsx` as a documented exception and a deployment concern, not as a recommended design.
- Clarified that frontend page visibility and eligibility checks do not replace backend security checks.
- Replaced the simplified token-refresh code as a definitive implementation description with a flow summary and verification requirements.

**Added**
- Expanded component and state responsibility descriptions.
- Added frontend/backend responsibility boundaries.
- Added details about request retry caveats, cookie credential behavior, and error handling.
- Added source-code verification checklist for implementation-specific behavior.

**Verification note**
- This revision is internally reviewed against the supplied frontend documentation. It has not been certified against the actual React source files or backend API implementation.
