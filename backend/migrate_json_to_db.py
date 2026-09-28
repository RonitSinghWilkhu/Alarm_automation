import json

from datetime import datetime

from pathlib import Path

from backend.database import SessionLocal

from backend.models import (
    Team,
    Ticket,
    TicketEvent
)


TICKETS_FILE = Path(
    "output/tickets.json"
)

NOTIFICATIONS_FILE = Path(
    "output/notifications.json"
)


def parse_datetime(value):

    if not value:
        return None

    return datetime.fromisoformat(
        value
    )


def load_json(path):

    with open(
        path,
        "r",
        encoding="utf-8"
    ) as file:

        return json.load(file)


def migrate():

    tickets_data = load_json(
        TICKETS_FILE
    )

    notifications_data = load_json(
        NOTIFICATIONS_FILE
    )

    db = SessionLocal()

    try:

        # -------------------------------------------------
        # 1. Create teams
        # -------------------------------------------------

        team_names = {
            ticket["assignedTeam"]
            for ticket in tickets_data
            if ticket.get("assignedTeam")
        }

        teams = {}

        for team_name in team_names:

            team = (
                db.query(Team)
                .filter(
                    Team.name == team_name
                )
                .first()
            )

            if not team:

                team = Team(
                    name=team_name
                )

                db.add(team)

                db.flush()

            teams[team_name] = team


        # -------------------------------------------------
        # 2. Create tickets
        # -------------------------------------------------

        ticket_map = {}

        for data in tickets_data:

            existing_ticket = (
                db.query(Ticket)
                .filter(
                    Ticket.ticket_number
                    == data["ticketNumber"]
                )
                .first()
            )

            if existing_ticket:

                ticket = existing_ticket

            else:

                ticket = Ticket(

                    ticket_number=data[
                        "ticketNumber"
                    ],

                    node=data[
                        "node"
                    ],

                    alarm_type=data[
                        "alarmType"
                    ],

                    occurrence_count=data.get(
                        "occurrenceCount"
                    ),

                    users_impacted=data.get(
                        "usersImpacted"
                    ),

                    severity=data.get(
                        "severity"
                    ),

                    threshold_breached=data.get(
                        "thresholdBreached",
                        False
                    ),

                    impact_level=data.get(
                        "impactLevel"
                    ),

                    priority=data.get(
                        "priority"
                    ),

                    assigned_team_id=teams[
                        data["assignedTeam"]
                    ].id,

                    status=data.get(
                        "status",
                        "OPEN"
                    ),

                    reason=data.get(
                        "reason"
                    ),

                    created_at=parse_datetime(
                        data.get("createdAt")
                    ),

                    closed_at=parse_datetime(
                        data.get("closedAt")
                    ),

                    reopened_at=parse_datetime(
                        data.get("reopenedAt")
                    )
                )

                db.add(ticket)

                db.flush()

            ticket_map[
                data["ticketNumber"]
            ] = ticket


        # -------------------------------------------------
        # 3. Create ticket events
        # -------------------------------------------------

        existing_event_keys = {
            (
                event.ticket_id,
                event.event_type,
                event.timestamp
            )
            for event in db.query(
                TicketEvent
            ).all()
        }


        for notification in notifications_data:

            ticket_number = notification.get(
                "ticketNumber"
            )

            ticket = ticket_map.get(
                ticket_number
            )

            if not ticket:

                print(
                    f"Skipping event for unknown "
                    f"ticket: {ticket_number}"
                )

                continue


            timestamp = parse_datetime(
                notification.get(
                    "timestamp"
                )
            )

            event_type = notification.get(
                "eventType"
            )


            event_key = (
                ticket.id,
                event_type,
                timestamp
            )


            if event_key in existing_event_keys:

                continue


            event = TicketEvent(

                ticket_id=ticket.id,

                event_type=event_type,

                previous_priority=notification.get(
                    "previousPriority"
                ),

                new_priority=notification.get(
                    "newPriority"
                ),

                priority=notification.get(
                    "priority"
                ),

                reason=notification.get(
                    "reason"
                ),

                timestamp=timestamp

            )

            db.add(event)

            existing_event_keys.add(
                event_key
            )


        # -------------------------------------------------
        # 4. Save everything
        # -------------------------------------------------

        db.commit()


        print(
            "Migration completed successfully."
        )


        print(
            f"Tickets migrated: "
            f"{len(ticket_map)}"
        )


        print(
            f"Teams migrated: "
            f"{len(team_names)}"
        )


        print(
            f"Notification events processed: "
            f"{len(notifications_data)}"
        )


    except Exception:

        db.rollback()

        raise


    finally:

        db.close()


if __name__ == "__main__":

    migrate()