# Alarm Automation --- Database Documentation

## 1. Document Purpose

This document describes the current database architecture and data model
implemented by the Alarm Automation backend.

The database layer uses:

``` text
PostgreSQL
    |
    v
SQLAlchemy
    |
    v
Python ORM models
```

The database connection/session setup is implemented in:

``` text
backend/database.py
```

The ORM models are implemented in:

``` text
backend/models.py
```

The JSON-to-database migration is implemented in:

``` text
migrate_json_to_db.py
```

------------------------------------------------------------------------

# 2. Database Architecture

The current persistence flow is:

``` text
Java
  |
  v
output/tickets.json
output/notifications.json
  |
  v
migrate_json_to_db.py
  |
  v
SQLAlchemy Session
  |
  v
PostgreSQL
```

At runtime, FastAPI reads and modifies PostgreSQL through SQLAlchemy.

``` text
React
  |
  v
FastAPI
  |
  v
SQLAlchemy
  |
  v
PostgreSQL
```

The JSON files are therefore an intermediate migration/input layer
rather than the runtime datastore used by the API.

------------------------------------------------------------------------

# 3. Database Connection Layer

The database connection is implemented in:

``` text
backend/database.py
```

The module loads environment variables using:

``` python
load_dotenv()
```

The database URL is read from:

``` text
DATABASE_URL
```

The SQLAlchemy engine is created with:

``` python
engine = create_engine(DATABASE_URL)
```

A session factory is created using:

``` python
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)
```

The declarative base is:

``` python
Base = declarative_base()
```

------------------------------------------------------------------------

# 4. Database Session Lifecycle

FastAPI endpoints receive database sessions through:

``` text
get_db()
```

The function creates a session:

``` text
SessionLocal()
```

and yields it to the endpoint.

After the endpoint finishes, the session is closed in the `finally`
block.

The flow is:

``` text
API request
    |
    v
get_db()
    |
    v
Create SQLAlchemy Session
    |
    v
Endpoint uses session
    |
    v
Request completes
    |
    v
db.close()
```

The same `SessionLocal` factory is also used by the JSON migration
script.

------------------------------------------------------------------------

# 5. Database Tables

The inspected SQLAlchemy models define the following database tables:

``` text
teams
tickets
ticket_events
users
user_sessions
password_reset_tokens
```

High-level relationship structure:

``` text
                     +-------------+
                     |    users    |
                     +------+------+
                            |
                 +----------+----------+
                 |                     |
                 v                     v
        +----------------+    +----------------------+
        | user_sessions  |    | password_reset_tokens|
        +----------------+    +----------------------+


+-------------+       +-------------+
|    teams    |       |   tickets   |
+------+------+       +------+------+
       |                     |
       | 1                   | 1
       |                     |
       | *                   | *
       +---------------------+
                             |
                             v
                    +----------------+
                    | ticket_events  |
                    +----------------+
```

------------------------------------------------------------------------

# 6. `teams` Table

The `Team` model maps to:

``` text
teams
```

## Columns

  Column   SQLAlchemy Type   Constraints / Defaults
  -------- ----------------- ------------------------
  `id`     Integer           Primary key, indexed
  `name`   String(100)       Unique, not nullable

## Relationships

A team has:

``` text
tickets
```

through the relationship:

``` python
tickets = relationship(
    "Ticket",
    back_populates="team"
)
```

Therefore:

``` text
Team
  |
  | one-to-many
  v
Ticket
```

A team can be associated with multiple tickets.

------------------------------------------------------------------------

# 7. `tickets` Table

The `Ticket` model maps to:

``` text
tickets
```

## Columns

  -----------------------------------------------------------------------
  Column                  SQLAlchemy Type         Constraints / Default
  ----------------------- ----------------------- -----------------------
  `id`                    Integer                 Primary key, indexed

  `ticket_number`         String(50)              Unique, not nullable,
                                                  indexed

  `node`                  String(100)             Not nullable

  `alarm_type`            String(100)             Not nullable

  `occurrence_count`      Integer                 Default `0`

  `users_impacted`        Integer                 Default `0`

  `severity`              String(50)              Nullable

  `threshold_breached`    Boolean                 Default `False`

  `impact_level`          String(50)              Nullable

  `priority`              String(10)              Not nullable

  `assigned_team_id`      Integer                 Foreign key to
                                                  `teams.id`

  `status`                String(30)              Not nullable, default
                                                  `OPEN`

  `reason`                Text                    Nullable

  `created_at`            DateTime                Nullable

  `updated_at`            DateTime                Default `datetime.now`,
                                                  updated on modification

  `closed_at`             DateTime                Nullable

  `reopened_at`           DateTime                Nullable
  -----------------------------------------------------------------------

## Relationships

The ticket has a relationship to its team:

``` python
team = relationship(
    "Team",
    back_populates="tickets"
)
```

It also has a relationship to its events:

``` python
events = relationship(
    "TicketEvent",
    back_populates="ticket",
    cascade="all, delete-orphan"
)
```

Therefore:

``` text
Team 1 -------- * Ticket
Ticket 1 ------ * TicketEvent
```

------------------------------------------------------------------------

# 8. `ticket_events` Table

The `TicketEvent` model maps to:

``` text
ticket_events
```

This table stores ticket event/history information used by the
notification API and ticket lifecycle operations.

## Columns

  -----------------------------------------------------------------------
  Column                  SQLAlchemy Type         Constraints / Default
  ----------------------- ----------------------- -----------------------
  `id`                    Integer                 Primary key, indexed

  `ticket_id`             Integer                 Foreign key to
                                                  `tickets.id`, not
                                                  nullable, indexed

  `event_type`            String(50)              Not nullable

  `previous_priority`     String(10)              Nullable

  `new_priority`          String(10)              Nullable

  `priority`              String(10)              Nullable

  `reason`                Text                    Nullable

  `status`                String(30)              Nullable

  `timestamp`             DateTime                Not nullable, default
                                                  `datetime.now`
  -----------------------------------------------------------------------

## Relationship

Each event belongs to a ticket:

``` python
ticket = relationship(
    "Ticket",
    back_populates="events"
)
```

The database relationship is:

``` text
Ticket
  |
  | 1-to-many
  v
TicketEvent
```

------------------------------------------------------------------------

# 9. Ticket Event Types

The current backend creates/handles these event types:

``` text
TICKET_CREATED
PRIORITY_UPGRADE
PRIORITY_DOWNGRADE
TICKET_CLOSED
TICKET_REOPENED
```

Their role is:

  Event Type             Meaning
  ---------------------- --------------------------------------------
  `TICKET_CREATED`       Initial ticket creation event
  `PRIORITY_UPGRADE`     Ticket priority moved to a higher priority
  `PRIORITY_DOWNGRADE`   Ticket priority moved to a lower priority
  `TICKET_CLOSED`        Ticket was closed
  `TICKET_REOPENED`      Previously closed ticket was reopened

The `/notifications` endpoint converts these events into notification
objects.

------------------------------------------------------------------------

# 10. Ticket State vs Ticket Event History

The database separates the current ticket state from its historical
events.

## Current state

Stored in:

``` text
tickets
```

Examples:

``` text
priority
status
closed_at
reopened_at
```

## Historical/event information

Stored in:

``` text
ticket_events
```

Examples:

``` text
event_type
previous_priority
new_priority
priority
reason
status
timestamp
```

Conceptually:

``` text
tickets
    |
    | current state
    v
Current ticket condition

ticket_events
    |
    | historical events
    v
Ticket activity history
```

This separation is important because notification history is generated
from `TicketEvent` records rather than from the current `Ticket` row
alone.

------------------------------------------------------------------------

# 11. `users` Table

The `User` model maps to:

``` text
users
```

## Columns

  -----------------------------------------------------------------------
  Column                  SQLAlchemy Type         Constraints / Default
  ----------------------- ----------------------- -----------------------
  `id`                    Integer                 Primary key, indexed

  `full_name`             String(120)             Not nullable

  `username`              String(50)              Unique, not nullable,
                                                  indexed

  `email`                 String(255)             Unique, not nullable,
                                                  indexed

  `password_hash`         String(255)             Not nullable

  `is_active`             Boolean                 Not nullable, default
                                                  `True`

  `created_at`            DateTime                Not nullable, default
                                                  `datetime.now`

  `updated_at`            DateTime                Not nullable, default
                                                  `datetime.now`, updated
                                                  on modification
  -----------------------------------------------------------------------

## Relationships

A user has relationships to:

``` text
UserSession
PasswordResetToken
```

with cascading delete behavior:

``` text
User
  |
  +---- UserSession
  |
  +---- PasswordResetToken
```

------------------------------------------------------------------------

# 12. `user_sessions` Table

The `UserSession` model maps to:

``` text
user_sessions
```

## Columns

  -----------------------------------------------------------------------
  Column                  SQLAlchemy Type         Constraints / Default
  ----------------------- ----------------------- -----------------------
  `id`                    Integer                 Primary key, indexed

  `user_id`               Integer                 Foreign key to
                                                  `users.id`, not
                                                  nullable, indexed,
                                                  cascade delete

  `session_token_hash`    String(64)              Unique, not nullable,
                                                  indexed

  `created_at`            DateTime                Not nullable, default
                                                  `datetime.now`

  `expires_at`            DateTime                Not nullable, indexed

  `last_activity`         DateTime                Not nullable, default
                                                  `datetime.now`

  `revoked`               Boolean                 Not nullable, default
                                                  `False`
  -----------------------------------------------------------------------

## Relationship

``` text
User 1 -------- * UserSession
```

The foreign key uses:

``` text
ondelete="CASCADE"
```

so sessions are associated with the lifecycle of their user.

------------------------------------------------------------------------

# 13. `password_reset_tokens` Table

The `PasswordResetToken` model maps to:

``` text
password_reset_tokens
```

## Columns

  -----------------------------------------------------------------------
  Column                  SQLAlchemy Type         Constraints / Default
  ----------------------- ----------------------- -----------------------
  `id`                    Integer                 Primary key, indexed

  `user_id`               Integer                 Foreign key to
                                                  `users.id`, not
                                                  nullable, indexed,
                                                  cascade delete

  `token_hash`            String(64)              Unique, not nullable,
                                                  indexed

  `created_at`            DateTime                Not nullable, default
                                                  `datetime.now`

  `expires_at`            DateTime                Not nullable, indexed

  `used`                  Boolean                 Not nullable, default
                                                  `False`
  -----------------------------------------------------------------------

## Relationship

``` text
User 1 -------- * PasswordResetToken
```

The foreign key uses:

``` text
ondelete="CASCADE"
```

------------------------------------------------------------------------

# 14. Entity Relationship Diagram

The current SQLAlchemy relationships can be represented as:

``` text
                         USERS
                    +-------------+
                    | id          |
                    | full_name   |
                    | username    |
                    | email       |
                    | password... |
                    | is_active   |
                    +------+------+
                           |
             +-------------+-------------+
             |                           |
             | 1                         | 1
             |                           |
             | *                         | *
             v                           v
    +----------------+       +----------------------+
    | user_sessions  |       | password_reset_tokens|
    +----------------+       +----------------------+


                      TEAMS
                  +-----------+
                  | id        |
                  | name      |
                  +-----+-----+
                        |
                        | 1
                        |
                        | *
                        v
                  +-----------+
                  |  TICKETS  |
                  +-----+-----+
                        |
                        | 1
                        |
                        | *
                        v
                +---------------+
                | TICKET_EVENTS |
                +---------------+
```

------------------------------------------------------------------------

# 15. JSON-to-Database Migration

The migration script is:

``` text
migrate_json_to_db.py
```

It reads:

``` text
output/tickets.json
output/notifications.json
```

and creates/locates the corresponding database records.

The complete migration flow is:

``` text
tickets.json
     |
     v
Load JSON
     |
     v
Create/find Teams
     |
     v
Create/find Tickets
     |
     v
Build ticket_map
     |
     v
notifications.json
     |
     v
Create TicketEvents
     |
     v
Deduplicate events
     |
     v
Commit
```

------------------------------------------------------------------------

# 16. Ticket JSON Mapping

The migration maps ticket JSON fields to the `Ticket` model.

  JSON Field            Database Field
  --------------------- -----------------------------------
  `ticketNumber`        `ticket_number`
  `node`                `node`
  `alarmType`           `alarm_type`
  `occurrenceCount`     `occurrence_count`
  `usersImpacted`       `users_impacted`
  `severity`            `severity`
  `thresholdBreached`   `threshold_breached`
  `impactLevel`         `impact_level`
  `priority`            `priority`
  `assignedTeam`        `assigned_team_id` through `Team`
  `status`              `status`
  `reason`              `reason`
  `createdAt`           `created_at`
  `closedAt`            `closed_at`
  `reopenedAt`          `reopened_at`

------------------------------------------------------------------------

# 17. Notification JSON → TicketEvent Mapping

The notification migration maps:

  JSON Field           Database Field
  -------------------- --------------------------
  `ticketNumber`       Used to find `Ticket.id`
  `eventType`          `event_type`
  `previousPriority`   `previous_priority`
  `newPriority`        `new_priority`
  `priority`           `priority`
  `reason`             `reason`
  `timestamp`          `timestamp`

The notification's:

``` text
ticketNumber
```

is not stored directly in `TicketEvent`.

Instead, it is used to resolve:

``` text
ticketNumber -> Ticket -> ticket.id
```

and `ticket_id` is stored as the foreign key.

------------------------------------------------------------------------

# 18. Team Migration

The migration extracts unique team names from the ticket JSON:

``` text
assignedTeam
```

For every team:

``` text
Does team exist?
       |
       +---- Yes ---> Use existing team
       |
       +---- No ----> Create team
```

The migration stores the result in an in-memory dictionary:

``` text
teams[team_name] = team
```

When creating a ticket, the corresponding team's database ID is assigned
to:

``` text
assigned_team_id
```

------------------------------------------------------------------------

# 19. Ticket Deduplication During Migration

The migration does not blindly insert every ticket.

For each JSON ticket, it checks:

``` text
Ticket.ticket_number == data["ticketNumber"]
```

If a matching ticket already exists:

``` text
existing_ticket -> reuse
```

Otherwise:

``` text
create Ticket
```

This prevents the same ticket number from being inserted as a new ticket
on every migration execution.

------------------------------------------------------------------------

# 20. Ticket Event Deduplication

The migration builds an in-memory set of existing event keys:

``` text
(ticket_id, event_type, timestamp)
```

For every notification:

``` text
event_key =
(
    ticket.id,
    event_type,
    timestamp
)
```

If the key already exists:

``` text
skip
```

Otherwise:

``` text
create TicketEvent
```

The newly created event key is then added to the set.

This means the current migration uses application-level event
deduplication based on:

``` text
ticket + event type + timestamp
```

The inspected model does not define a database-level unique constraint
on this combination.

------------------------------------------------------------------------

# 21. Date/Time Handling During Migration

The migration defines:

``` python
def parse_datetime(value):
    if not value:
        return None
    return datetime.fromisoformat(value)
```

Therefore JSON datetime strings are converted to Python `datetime`
objects before being assigned to SQLAlchemy `DateTime` columns.

For example:

``` text
JSON string
    |
    v
datetime.fromisoformat()
    |
    v
Python datetime
    |
    v
SQLAlchemy DateTime
```

------------------------------------------------------------------------

# 22. Database Transaction Handling During Migration

The migration creates one database session and performs its work inside
a `try` block.

On successful completion:

``` text
db.commit()
```

On exception:

``` text
db.rollback()
```

The session is always closed:

``` text
db.close()
```

Therefore the migration follows:

``` text
Start session
    |
    v
Process teams
    |
    v
Process tickets
    |
    v
Process events
    |
    v
Commit
    |
    +---- Success ---> completed
    |
    +---- Exception -> rollback
    |
    v
Close session
```

------------------------------------------------------------------------

# 23. Runtime Ticket Writes

After migration, ticket state is modified directly through
FastAPI/SQLAlchemy.

## Priority Change

``` text
PUT /tickets/{ticket_number}/priority
```

updates:

``` text
tickets.priority
```

and creates:

``` text
ticket_events
```

with:

``` text
PRIORITY_UPGRADE
```

or:

``` text
PRIORITY_DOWNGRADE
```

## Close

``` text
PUT /tickets/{ticket_number}/close
```

updates:

``` text
tickets.status
tickets.closed_at
```

and creates:

``` text
TICKET_CLOSED
```

## Reopen

``` text
PUT /tickets/{ticket_number}/reopen
```

updates:

``` text
tickets.status
tickets.priority
tickets.reopened_at
```

and creates:

``` text
TICKET_REOPENED
```

## Acknowledge

``` text
PUT /tickets/{ticket_number}/acknowledge
```

updates the latest applicable:

``` text
ticket_events.status
```

to:

``` text
ACKNOWLEDGED
```

------------------------------------------------------------------------

# 24. Notification Data Source

At runtime, the notification endpoint does not read:

``` text
output/notifications.json
```

Instead:

``` text
PostgreSQL
    |
    v
ticket_events
    |
    v
GET /notifications
    |
    v
FastAPI constructs notification objects
```

The JSON notification file is used during the migration stage to
initially populate event data.

------------------------------------------------------------------------

# 25. Database Data Flow

The complete database lifecycle is:

``` text
               INITIAL LOAD
                    |
                    v
            tickets.json
            notifications.json
                    |
                    v
          migrate_json_to_db.py
                    |
                    v
               PostgreSQL
                    |
        +-----------+-----------+
        |                       |
        v                       v
     tickets               ticket_events
        |                       |
        +-----------+-----------+
                    |
                    v
                 FastAPI
                    |
                    v
                 React


               RUNTIME UPDATE
                    |
                    v
                FastAPI
                    |
                    v
              SQLAlchemy
                    |
                    v
               PostgreSQL
```

------------------------------------------------------------------------

# 26. Important Database Characteristics

## 26.1 PostgreSQL Is the Persistent Store

The FastAPI application queries and modifies PostgreSQL through
SQLAlchemy.

The JSON files are not the live API datastore.

## 26.2 SQLAlchemy Is the ORM Layer

The application uses SQLAlchemy models rather than raw SQL for the
inspected ticket/team/event database operations.

## 26.3 Ticket Events Provide History

`TicketEvent` stores historical changes and notification-related state.

## 26.4 Users Are Separate From Ticket Ownership

The inspected models do not show a direct foreign-key relationship from
`Ticket` to `User`.

The ticket currently references:

``` text
Team
```

through:

``` text
assigned_team_id
```

Authentication/session information is modeled separately through the
user tables.

## 26.5 Authentication Persistence Is Database-Backed

The model layer contains:

``` text
users
user_sessions
password_reset_tokens
```

which support persistent authentication/session and password-reset data.

------------------------------------------------------------------------

# 27. Current Database Model Summary

``` text
                         +----------------+
                         |     users      |
                         +-------+--------+
                                 |
                  +--------------+--------------+
                  |                             |
                  v                             v
          +---------------+             +----------------------+
          | user_sessions |             | password_reset_tokens|
          +---------------+             +----------------------+


+----------------+
|     teams      |
+-------+--------+
        |
        | 1
        |
        | *
        v
+----------------+
|    tickets     |
+-------+--------+
        |
        | 1
        |
        | *
        v
+----------------+
| ticket_events  |
+----------------+
```

The main operational relationship is:

``` text
Team
  |
  v
Ticket
  |
  v
TicketEvent
```

while authentication uses:

``` text
User
  |
  +---- UserSession
  |
  +---- PasswordResetToken
```

------------------------------------------------------------------------

# 28. Source Files Used

The database documentation is based on the inspected implementations of:

``` text
backend/database.py
backend/models.py
migrate_json_to_db.py
main.py
```

The model definitions document the database schema represented by
SQLAlchemy. The actual PostgreSQL server configuration, generated
migration history, indexes beyond those explicitly declared in the
models, and live row contents are not described here because they were
not directly inspected.
