from fastapi import FastAPI , HTTPException
from fastapi.middleware.cors import CORSMiddleware
import json
import os
from pydantic import BaseModel
from backend.rag import troubleshoot_alarm, _build_vector_store , _get_llm
from datetime import datetime

app=FastAPI()

app.add_middleware(
    CORSMiddleware,

    allow_origins=["*"],

    allow_credentials=False,

    allow_methods=["*"],

    allow_headers=["*"]
)

TICKETS_FILE = "output/tickets.json"
NOTIFICATIONS_FILE = "output/notifications.json"

class PriorityUpdate(BaseModel):
    priority: str

@app.get("/")
def home():

    return{
        "message": "Alarm Automation API is running"
    }

@app.get("/tickets")
def get_tickets():

    if not os.path.exists(TICKETS_FILE):

        return{
            "message": "tickets.json not found",
            "tickets" : []
        }

    with open(
        TICKETS_FILE,
        "r",
    encoding="utf-8"
    ) as file:

        tickets = json.load(file)

    return tickets

@app.put("/tickets/{ticket_number}/priority")
def update_priority(
    ticket_number: str,
    update: PriorityUpdate
):
    allowed_priorities = ["P1", "P2", "P3", "P4"]
    if update.priority not in allowed_priorities:
        raise HTTPException(status_code=400 , detail="Invalid priority")
    
    if not os.path.exists(TICKETS_FILE):
        raise HTTPException(status_code=500 , detail="ticket.json not found")
    
    with open(
        TICKETS_FILE,
        "r",
        encoding="utf-8"
    ) as file:
        tickets = json.load(file)
    
    ticket_found = False
    for ticket in tickets:
        if ticket["ticketNumber"] == ticket_number:
            if ticket["status"] == "CLOSED":
                raise HTTPException(status_code=409 , detail="cannot upgrade a closed ticket")
            
            previous_priority = ticket["priority"]
            if update.priority == previous_priority:
                raise HTTPException(status_code=400 , detail="Ticket is already at this priority")
            
            ticket["priority"] = update.priority
            
            # Determine if this is an upgrade or downgrade
            # P1 is highest (1), P4 is lowest (4)
            priority_order = {"P1": 1, "P2": 2, "P3": 3, "P4": 4}
            previous_num = priority_order[previous_priority]
            new_num = priority_order[update.priority]
            
            # Lower number = higher priority = upgrade
            # Higher number = lower priority = downgrade
            is_upgrade = new_num < previous_num
            event_type = "PRIORITY_UPGRADE" if is_upgrade else "PRIORITY_DOWNGRADE"
            action_word = "upgraded" if is_upgrade else "downgraded"
            
            notifications = []
            if os.path.exists(NOTIFICATIONS_FILE):
                with open(
                    NOTIFICATIONS_FILE,
                    "r",
                    encoding="utf-8"
                ) as file:
                    notifications = json.load(file)
            
            upgrade_time = datetime.now().isoformat(timespec="seconds")
            upgrade_notification = {
                "ticketNumber": ticket_number,
                "assignedTeam": ticket["assignedTeam"],
                "message": 
                    f"Ticket {ticket_number} {action_word} from "
                    f"{previous_priority} to {update.priority} "
                    f"on {upgrade_time} for "
                    f"{ticket['alarmType']} on {ticket['node']}",
                "status": "ACKNOWLEDGED",
                "eventType": event_type,
                "previousPriority": previous_priority,
                "newPriority": update.priority,
                "timestamp": upgrade_time,
                "alarmType": ticket["alarmType"],
                "node": ticket["node"]
            }
            notifications.append(upgrade_notification)
            
            with open(
                NOTIFICATIONS_FILE,
                "w",
                encoding="utf-8",
            ) as file:
                json.dump(
                    notifications,
                    file,
                    indent=4
                )
            
            ticket_found = True
            break
    
    if not ticket_found:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    with open(
        TICKETS_FILE,
        "w",
        encoding="utf-8"
    ) as file:
        json.dump(
            tickets,
            file,
            indent=4
        )
    
    return {
        "message": "Ticket priority updated",
        "ticketNumber": ticket_number,
        "priority": update.priority
    }

@app.put("/tickets/{ticket_number}/close")
def close_ticket(ticket_number: str):

    if not os.path.exists(TICKETS_FILE):
        raise HTTPException(status_code= 500 , detail="tickets.json not found")

    with open(
        TICKETS_FILE,
        "r",
        encoding="utf-8"
    ) as file:

        tickets = json.load(file)

    ticket_found = False

    for ticket in tickets:

        if ticket["ticketNumber"] == ticket_number:

            if ticket["status"] == "CLOSED":
                raise HTTPException(status_code= 409 , detail="Ticket is already closed")
            ticket["status"] = "CLOSED"

            ticket["closedAt"] = datetime.now().isoformat(timespec="seconds")

            if os.path.exists(NOTIFICATIONS_FILE):

                with open(
                    NOTIFICATIONS_FILE,
                    "r",
                    encoding="utf-8"
                ) as file:

                    notifications = json.load(file)

                for notification in notifications:
                    if notification["ticketNumber"] == ticket_number:
                        notification["status"] = "RESOLVED"

                with open(
                    NOTIFICATIONS_FILE,
                    "w",
                    encoding="utf-8"
                ) as file:

                    json.dump(
                        notifications,
                        file,
                        indent=4
                    )

            ticket_found = True

            break

    if not ticket_found:
        raise HTTPException(status_code=404 , detail="Ticket not found")
    with open(
        TICKETS_FILE,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            tickets,
            file,
            indent=4
        )

    return {
        "message": "Ticket closed successfully",
        "ticketNumber": ticket_number,
        "status": "CLOSED",
        "closedAt": ticket["closedAt"]
    }

@app.put("/tickets/{ticket_number}/acknowledge")
def acknowledge_ticket(ticket_number: str):
    if not os.path.exists(NOTIFICATIONS_FILE):
        raise HTTPException(status_code=500, detail="notifications.json not found")

    with open(NOTIFICATIONS_FILE, "r", encoding="utf-8") as file:
        notifications = json.load(file)

    updated = False
    for notification in notifications:
        if notification["ticketNumber"] == ticket_number:
            # Only update if it's not already acknowledged or resolved
            if notification["status"] != "ACKNOWLEDGED" and notification["status"] != "RESOLVED":
                notification["status"] = "ACKNOWLEDGED"
                updated = True

    with open(NOTIFICATIONS_FILE, "w", encoding="utf-8") as file:
        json.dump(notifications, file, indent=4)

    return {
        "message": "Ticket notifications acknowledged",
        "ticketNumber": ticket_number
    }

@app.get("/notifications")
def get_notifications():

    if not os.path.exists(NOTIFICATIONS_FILE):
        return []

    with open(NOTIFICATIONS_FILE, "r", encoding="utf-8") as file:
        notifications = json.load(file)

    return notifications

@app.get("/troubleshoot/{ticket_number}")
def troubleshoot(ticket_number: str):

    if not os.path.exists(TICKETS_FILE):
        return {
            "alarmType": "UNKNOWN",
            "recommendation": "Tickets file not found."
        }

    with open(TICKETS_FILE, "r", encoding="utf-8") as file:
        tickets = json.load(file)

    ticket = None

    for t in tickets:
        if t["ticketNumber"] == ticket_number:
            ticket = t
            break

    if not ticket:
        return {
            "alarmType": "UNKNOWN",
            "recommendation": "Ticket not found."
        }

    try:
        result = troubleshoot_alarm(
            ticket["alarmType"],
            ticket["node"],
            ticket["occurrenceCount"],
            ticket["usersImpacted"],
            ticket["severity"],
            ticket["thresholdBreached"],
            ticket["impactLevel"],
            ticket["priority"],
            ticket["assignedTeam"]
        )
    except Exception as e:
        print(f"Troubleshoot error: {e}")
        return {
            "alarmType": ticket["alarmType"],
            "recommendation": f"Troubleshooting unavailable: {str(e)}"
        }

    return {
        "alarmType": ticket["alarmType"],
        "recommendation": result["recommendation"],
        "historicalIncidents": result["historicalIncidents"]
    }

@app.on_event("startup")
def load_rag_models():
    print("Loading RAG resources....")
    _build_vector_store()
    _get_llm()
    print("RAG resources loaded.")