from fastapi import FastAPI , HTTPException, Depends 
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from backend.rag import troubleshoot_alarm, _build_vector_store , _get_llm, _get_reranker
from datetime import datetime
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import Ticket , TicketEvent, User
from backend.auth import router as auth_router
from backend.security import get_current_user
import logging

app=FastAPI()

logger = logging.getLogger(__name__)

app.add_middleware(
    CORSMiddleware,

    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5500",
        "http://127.0.0.1:5500"
    ],

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"]
)

app.include_router(
    auth_router
)

class PriorityUpdate(BaseModel):
    priority: str

class ReopenUpdate(BaseModel):
    priority: str
    reason: str

@app.get("/")
def home():

    return{
        "message": "Alarm Automation API is running"
    }

@app.get("/tickets")
def get_tickets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    tickets = (
        db.query(Ticket)
        .all()
    )

    return [
        {
            "ticketNumber": ticket.ticket_number,

            "node": ticket.node,

            "alarmType": ticket.alarm_type,

            "occurrenceCount": ticket.occurrence_count,

            "usersImpacted": ticket.users_impacted,

            "severity": ticket.severity,

            "thresholdBreached": ticket.threshold_breached,

            "impactLevel": ticket.impact_level,

            "priority": ticket.priority,

            "assignedTeam": (
                ticket.team.name
                if ticket.team
                else None
            ),

            "status": ticket.status,

            "reason": ticket.reason,

            "createdAt": (
                ticket.created_at.isoformat(
                    sep=" "
                )
                if ticket.created_at
                else None
            ),

            "updatedAt": (
                ticket.updated_at.isoformat(
                    sep=" "
                )
                if ticket.updated_at
                else None
            ),

            "closedAt": (
                ticket.closed_at.isoformat()
                if ticket.closed_at
                else None
            ),

            "reopenedAt": (
                ticket.reopened_at.isoformat()
                if ticket.reopened_at
                else None
            )
        }

        for ticket in tickets
    ]

@app.put("/tickets/{ticket_number}/priority")
def update_priority(
    ticket_number: str,
    update: PriorityUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    allowed_priorities = ["P1", "P2", "P3", "P4"]

    if update.priority not in allowed_priorities:
        raise HTTPException(
            status_code=400,
            detail="Invalid priority raised"
        )

    ticket=(
        db.query(Ticket)
        .filter(
            Ticket.ticket_number == ticket_number
        ).first()
    )

    if not ticket:
        raise HTTPException(
            status_code=404,
            detail="Ticket not found"
        )

    if ticket.status == "CLOSED":
        raise HTTPException(
            status_code=409,
            detail="cannot upgrade a closed ticket"
        )

    previous_priority = ticket.priority

    if update.priority == previous_priority:
        raise HTTPException(
            status_code=400,
            detail="Ticket is already at this priority"
        )

    priority_order = {
        "P1": 1,
        "P2": 2,
        "P3": 3,
        "P4": 4
    }

    previous_num = priority_order[previous_priority]
    new_num = priority_order[update.priority]

    is_upgrade = new_num< previous_num

    event_type = (
        "PRIORITY_UPGRADE"
        if is_upgrade
        else
        "PRIORITY_DOWNGRADE"
    )

    upgrade_time = datetime.now()
    ticket.priority = update.priority

    event= TicketEvent(
        ticket_id = ticket.id,
        event_type = event_type,
        previous_priority=previous_priority,
        new_priority=update.priority,
        priority=update.priority,
        status="ACKNOWLEDGED",
        timestamp=upgrade_time
    )

    db.add(event)
    db.commit()

    return{
        "message": "Ticket priority updated",
        "ticketNumber": ticket_number,
        "priority": update.priority
    }

@app.put("/tickets/{ticket_number}/close")
def close_ticket(
    ticket_number: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ticket=(
        db.query(Ticket)
        .filter(
            Ticket.ticket_number == ticket_number
        ).first()
    )

    if not ticket:
        raise HTTPException(
            status_code=404,
            detail="Ticket not found"
        )

    if ticket.status == "CLOSED":
        raise HTTPException(
            status_code=409,
            detail="Ticket is already closed"
        )

    closed_at = datetime.now()

    ticket.status="CLOSED"
    ticket.closed_at=closed_at

    event = TicketEvent(
        ticket_id=ticket.id,
        event_type = "TICKET_CLOSED",
        priority=ticket.priority,
        status="RESOLVED",
        timestamp=closed_at
    )

    db.add(event)
    db.commit()

    return{
        "message": "Ticket closed successfully",
        "ticketNumber": ticket_number,
        "status": "CLOSED",
        "closedAt": closed_at.isoformat(timespec="seconds")
    }

@app.put("/tickets/{ticket_number}/reopen")
def reopen_ticket(
    ticket_number: str,
    update: ReopenUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    allowed_priorities = [
        "P1",
        "P2",
        "P3",
        "P4"
    ]

    if update.priority not in allowed_priorities:
        raise HTTPException(
            status_code=400,
            detail="Invalid priority"
        )

    reason = update.reason.strip()

    if not reason:
        raise HTTPException(
            status_code=400,
            detail="Reopen reason is required"
        )

    ticket = (
        db.query(Ticket)
        .filter(
            Ticket.ticket_number == ticket_number
        ).first()
    )

    if not ticket:
        raise HTTPException(
            status_code=404,
            detail="Ticket not found"
        )

    if ticket.status != "CLOSED":
        raise HTTPException(
            status_code=409,
            detail="Ticket is already open"
        )

    reopened_at = datetime.now()

    ticket.status = "OPEN"
    ticket.priority=update.priority
    ticket.reopened_at=reopened_at

    event= TicketEvent(
        ticket_id=ticket.id,
        event_type="TICKET_REOPENED",
        priority=update.priority,
        new_priority=update.priority,
        reason=reason,
        status="ACKNOWLEDGED",
        timestamp=reopened_at
    )

    db.add(event)
    db.commit()

    return{
        "message": "Ticket reopened successfully",
        "ticketNumber": ticket_number,
        "status": "OPEN",
        "priority": update.priority,
        "reason": reason,
        "reopenedAt": reopened_at.isoformat(timespec="seconds")
    }

@app.put("/tickets/{ticket_number}/acknowledge")
def acknowledge_ticket(
    ticket_number: str,
    db: Session=Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    events = (
        db.query(TicketEvent)
        .join(Ticket)
        .filter(
            Ticket.ticket_number == ticket_number
        )
        .order_by(
            TicketEvent.timestamp.desc(),
            TicketEvent.id.desc()
        ).all()
    )

    if not events:
        raise HTTPException(
            status_code=404,
            detail="no events for ticket"
        )

    latest_event = events[0]

    updated = False

    if latest_event.status not in(
        "ACKNOWLEDGED",
        "RESOLVED"
    ):
        latest_event.status = "ACKNOWLEDGED"
        updated = True

    if updated:
        db.commit()

    return{
        "message": "Latest notification acknowledged",
        "ticketNumber": ticket_number,
        "acknowledged": updated
    }

@app.get("/notifications")
def get_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
    ):

    events = (
        db.query(TicketEvent)
        .order_by(TicketEvent.timestamp.desc())
        .all()
    )

    notifications = []

    for event in events:

        ticket = event.ticket

        if not ticket:
            continue

        assigned_team = (
            ticket.team.name
            if ticket.team
            else None
        )

        alarm_type = ticket.alarm_type
        node = ticket.node

        if event.event_type == "TICKET_CREATED":

            message = (
                f"New {event.priority} ticket created "
                f"for {alarm_type} on {node}"
            )

        elif event.event_type == "PRIORITY_UPGRADE":

            message = (
                f"Ticket upgraded from "
                f"{event.previous_priority} "
                f"to "
                f"{event.new_priority}"
            )

        elif event.event_type == "PRIORITY_DOWNGRADE":

            message = (
                f"Ticket downgraded from "
                f"{event.previous_priority} "
                f"to "
                f"{event.new_priority}"
            )

        elif event.event_type == "TICKET_CLOSED":

            message = "Ticket closed"

        elif event.event_type == "TICKET_REOPENED":

            message = (
                "Ticket reopened\n"
                f"Current priority: {event.priority}\n"
                f"Reason: {event.reason}\n"
                f"Time: {event.timestamp.isoformat()}"
            )

        else:

            message = ""

        notifications.append(
            {
                "ticketNumber": ticket.ticket_number,

                "assignedTeam": assigned_team,

                "message": message,

                "status": event.status,

                "eventType": event.event_type,

                "previousPriority": event.previous_priority,

                "newPriority": event.new_priority,

                "priority": event.priority,

                "reason": event.reason,

                "timestamp": event.timestamp.isoformat(),

                "alarmType": alarm_type,

                "node": node
            }
        )

    return notifications

@app.get("/troubleshoot/{ticket_number}")
def troubleshoot(
    ticket_number: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ticket=(
        db.query(Ticket)
        .filter(
            Ticket.ticket_number == ticket_number
        ).first()
    )

    if not ticket:
        raise HTTPException(
            status_code=404,
            detail="Ticket not found"
        )

    try:
        result = troubleshoot_alarm(
            ticket.alarm_type,
            ticket.node,
            ticket.occurrence_count,
            ticket.users_impacted,
            ticket.severity,
            ticket.threshold_breached,
            ticket.impact_level,
            ticket.priority,
            ticket.team.name if ticket.team else None
        )

    except Exception as e:
        logger.exception("Troubleshooting failed")
        raise HTTPException(
            status_code=500,
            detail="Troubleshooting failed. Please try again later."
        )
    
    return{
        "alarmType": ticket.alarm_type,
        "recommendation": result["recommendation"],
        "historicalIncidents": result["historicalIncidents"]
    }

@app.on_event("startup")
def load_rag_models():
    print("Loading RAG resources....")
    _build_vector_store()
    _get_reranker()
    _get_llm()
    print("RAG resources loaded.")