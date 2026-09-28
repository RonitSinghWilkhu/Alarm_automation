from datetime import datetime

from backend.database import SessionLocal

from backend.models import Ticket


db = SessionLocal()


try:

    ticket = Ticket(

        ticket_number="DB-TEST-001",

        node="TEST-NODE",

        alarm_type="TEST_ALARM",

        occurrence_count=1,

        users_impacted=10,

        severity="Minor",

        threshold_breached=True,

        impact_level="LOW",

        priority="P4",

        status="OPEN",

        reason="Database connection test",

        created_at=datetime.now()

    )


    db.add(ticket)

    db.commit()

    db.refresh(ticket)


    print(
        f"Ticket inserted successfully: "
        f"{ticket.ticket_number}"
    )


finally:

    db.close()