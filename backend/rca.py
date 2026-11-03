from backend.rag import (
    _build_vector_store,
    _get_llm,
    _get_relevant_historical_incidents,
)

from datetime import timedelta, datetime
from backend.database import SessionLocal
from backend.models import Ticket, HistoricalIncident

def get_related_tickets(
        ticket_number:str,
        node:str,
        current_alarm_type: str,
        window_minutes: int = 30,
):
    """
    Retrieve other tickets from the same nodde created within the
    configured time window of the current ticket.

    This identifies potentially related alarms; it does not establish
    a casual relationship.
    """

    db = SessionLocal()

    try:
        current_ticket = (
            db.query(Ticket)
            .filter(Ticket.ticket_number == ticket_number)
            .first()
        )

        if not current_ticket or not current_ticket.created_at:
            return []

        window_start = current_ticket.created_at - timedelta(
            minutes=window_minutes
        )
        window_end = current_ticket.created_at + timedelta(
            minutes=window_minutes
        )

        related_tickets = (
            db.query(Ticket)
            .filter(
                Ticket.node == node,
                Ticket.ticket_number != ticket_number,
                Ticket.created_at >= window_start,
                Ticket.created_at <= window_end,
                Ticket.alarm_type != current_alarm_type,
            )
            .order_by(Ticket.created_at.asc())
            .all()
        )

        return [
            {
               "ticketNumber": ticket.ticket_number,
                "node": ticket.node,
                "alarmType": ticket.alarm_type,
                "severity": ticket.severity,
                "status": ticket.status,
                "createdAt": (
                    ticket.created_at.isoformat()
                    if ticket.created_at
                    else None
                ),
                "occurrenceCount": ticket.occurrence_count,
                "usersImpacted": ticket.users_impacted,
                "priority": ticket.priority,   
            }
            for ticket in related_tickets
        ]
    finally:
        db.close()

def build_correlation_findings(
        ticket_number: str,
        current_alarm_type: str,
        current_node: str,
        current_created_at: datetime,
        related_tickets: list,
        window_minutes: int =30,
):
    """
    Build structures findings from the current tickets and related tickets.

    Findings describe observed node and timestamp relationships.
    they do not restablish causation.
    """

    if current_created_at is None:
        return []

    current_timestamp = (
        datetime.fromisoformat(current_created_at)
        if isinstance(current_created_at, str)
        else current_created_at
    )

    timestamps = [current_timestamp]

    for ticket in related_tickets:
        created_at = ticket.get("createdAt")

        if created_at:
            timestamps.append(
                datetime.fromisoformat(created_at)
                if isinstance(created_at, str)
                else created_at
            )

    all_ticket_numbers = [ticket_number] + [
        ticket["ticketNumber"]
        for ticket in related_tickets
    ]

    observed_alarm_types = sorted(
        {
            current_alarm_type,
            *(
                ticket["alarmType"]
                for ticket in related_tickets
                if ticket.get("alarmType")
            ),
        }
    )

    observed_nodes = sorted(
        {
            current_node,
            *(
                ticket["node"]
                for ticket in related_tickets
                if ticket.get("node")
            ),
        }
    )

    time_span_minutes = round(
        (max(timestamps) - min(timestamps)).total_seconds() / 60,
        2,
    )

    return [
        {
            "finding":(
                f"{', '.join(observed_alarm_types)} were recorded "
                f"across {len(observed_nodes)} node(s), including "
                f"{current_node}, within the configured "
                f"{window_minutes}-minute correlation window."
            ),
            "relatedTickets": all_ticket_numbers,
            "observedAlarmTypes": observed_alarm_types,
            "observedNodes": observed_nodes,
            "timeSpanMinutes": time_span_minutes,
            "correlationWindowMinutes": window_minutes,
            "evidenceType": "temporal_and_node_correlation",
            "causationEstablished": False,
        }
    ]


def analyze_root_cause(
    ticket_number,
    alarm_type,
    node,
    occurrence_count,
    users_impacted,
    severity,
    threshold_breached,
    impact_level,
    priority,
    assigned_team,
):
    """
    Analyze the probable root cause of a ticket using existing
    ticket information and relevant historical incidents.

    This function generates an evidence-based RCA.
    It does not execute diagnostic commands or change network state.
    """

    # ---------------------------------------------------------
    # 1. Load the existing RAG resources
    # ---------------------------------------------------------
    _build_vector_store()
    llm = _get_llm()

    # ---------------------------------------------------------
    # 2. Retrieve historical incidents for the same alarm type
    # ---------------------------------------------------------
    historical_query = (
        f"Current ticket: {ticket_number}. "
        f"Alarm type: {alarm_type}. "
        "Identify historical incidents with technically relevant "
        "symptoms and documented root causes. "
        "Consider documented actions, resolutions, and verification "
        "results as supporting evidence. "
        "Do not treat similarity alone as proof of a shared root cause."
    )

    historical_results = _get_relevant_historical_incidents(
        query=historical_query,
        alarm_type=alarm_type,
        k=5,
    )

    db = SessionLocal()

    try:
        current_ticket = (
            db.query(Ticket)
            .filter(Ticket.ticket_number == ticket_number)
            .first()
        )

        current_ticket_created_at = (
            current_ticket.created_at
            if current_ticket
            else None
        )

        current_incident = None

        if current_ticket:
            current_incident = (
                db.query(HistoricalIncident)
                .filter(
                    HistoricalIncident.ticket_id == current_ticket.id
                )
                .order_by(HistoricalIncident.created_at.desc())
                .first()
            )

    finally:
        db.close()

    if current_ticket_created_at is None:
        return {
            "ticketNumber": ticket_number,
            "alarmType": alarm_type,
            "status": "insufficient_evidence",
            "probableRootCause": None,
            "confidence": "low",
            "supportingEvidence": [],
            "alternativeHypotheses": [],
            "evidenceGaps": [
                "The current ticket or its creation timestamp was not found."
            ],
            "recommendedValidation": [],
            "historicalIncidents": [],
            "relatedTickets": [],
            "correlationFindings": [],
            "message": (
                "Correlation analysis could not proceed because "
                "the current ticket timestamp is unavailable."
            ),
        }

    #-------------------------------------------------
    #Retrieve potentially related current tickets
    #-------------------------------------------------
    related_tickets = get_related_tickets(
        ticket_number=ticket_number,
        node=node,
        current_alarm_type=alarm_type,
        window_minutes=30,
    )

    correlation_findings = build_correlation_findings(
        ticket_number=ticket_number,
        current_alarm_type=alarm_type,
        current_node=node,
        current_created_at=current_ticket_created_at,
        related_tickets=related_tickets,
        window_minutes=30,
    )

    related_tickets_context = "\n".join(
        (
            f"Ticket: {ticket['ticketNumber']}, "
            f"Node: {ticket['node']}, "
            f"Alarm Type: {ticket['alarmType']}, "
            f"Severity: {ticket['severity']}, "
            f"Status: {ticket['status']}, "
            f"Created At: {ticket['createdAt']}, "
            f"Occurrence Count: {ticket['occurrenceCount']}, "
            f"Users Impacted: {ticket['usersImpacted']}, "
            f"Priority: {ticket['priority']}"
        )
        for ticket in related_tickets
    )

    # ---------------------------------------------------------
    # 3. Format the retrieved historical evidence
    # ---------------------------------------------------------
    historical_context = "\n\n".join(
        result.page_content for result in historical_results
    )

    #Format the current ticket's recorded resolution evidence
    if current_incident:
        current_resolution_content = f"""
CURRENT TICKET'S RECORDED RESOLUTION

Recorded Root Cause:
{current_incident.root_cause or "Not documented"}

Actions Taken:
{current_incident.actions_taken or "Not documented"}

Resolution:
{current_incident.resolution or "Not documented"}

Verification Results:
{current_incident.verification_results or "Not documented"}

Shell Commands Used:
{current_incident.shell_commands_used or "Not documented"}

Shell Script Used:
{current_incident.shell_script_used or "Not documented"}

Escalation:
{current_incident.escalation or "Not documented"}

Additional Notes:
{current_incident.additional_notes or "Not documented"}
"""
    else:
        current_resolution_content = """
CURRENT TICKET'S RECORDED RESOLUTION

No HistoricalIncident record is linked to this ticket.
The actual root cause, actions taken, resolution and verification
results are not available from a linked resolution record.
Do not invent these details.
"""

    #Identify missing resolution evidence from the current ticket.
    resolution_evidence_gaps = []

    if not current_incident:
        resolution_evidence_gaps.append(
            "No recorded resolution is linked to the current ticket."
        )
    else:
        resolution_fields = {
            "Root cause": (current_incident.root_cause, "is"),
            "Actions taken": (current_incident.actions_taken, "are"),
            "Resolution": (current_incident.resolution, "is"),
            "Verification results": (
                current_incident.verification_results,
                "are",
            ),
        }

        for field_name, (field_value, verb) in resolution_fields.items():
            if not field_value or not field_value.strip():
                resolution_evidence_gaps.append(
                    f"{field_name} {verb} not documented in the "
                    "current ticket's resolution record."
                )

    historical_incidents = [
        {
            "id": result.metadata.get(
                "incident_id",
                result.metadata.get("parent_id", "unknown"),
            ),
            "alarmType": result.metadata.get("alarm_type"),
            "content": result.page_content,
        }
        for result in historical_results
    ]

    # ---------------------------------------------------------
    # 4. Handle the case where no historical evidence is found
    # ---------------------------------------------------------
    if not historical_context.strip() and not current_incident:
        return {
            "ticketNumber": ticket_number,
            "alarmType": alarm_type,
            "status": "insufficient_evidence",
            "probableRootCause": None,
            "confidence": "low",
            "supportingEvidence": [],
            "alternativeHypotheses": [],
            "evidenceGaps": list(
                dict.fromkeys(
                    [
                        "No relevant historical incidents were retrieved.",
                        "Current diagnostic evidence is not yet available.",
                    ]
                    + resolution_evidence_gaps
                )
            ),
            "recommendedValidation": [],
            "historicalIncidents": [],
            "relatedTickets": related_tickets,
            "correlationFindings": correlation_findings,
            "message": (
                "Insufficient data in the knowledge base to determine "
                "the root cause."
            ),
        }

    # ---------------------------------------------------------
    # 5. Build the RCA prompt
    # ---------------------------------------------------------
    prompt = f"""
You are a telecom Root Cause Analysis (RCA) assistant.

Your task is to investigate the likely root cause of the current
ticket using only the ticket information and retrieved historical
incident evidence provided below.

CURRENT TICKET
Ticket Number: {ticket_number}
Alarm Type: {alarm_type}
Node: {node}
Occurrence Count: {occurrence_count}
Users Impacted: {users_impacted}
Severity: {severity}
Threshold Breached: {threshold_breached}
Impact Level: {impact_level}
Priority: {priority}
Assigned Team: {assigned_team}

CURRENT TICKET'S RECORDED RESOLUTION
{current_resolution_content}

RETRIEVED HISTORICAL INCIDENTS
{historical_context}

RELATED CURRENT TICKETS
{related_tickets_context if related_tickets_context else "No related tickets were found within the configured time window."}

INVESTIGATION RULES
1. Distinguish the current ticket facts from historical evidence.
2. A matching alarm type does not prove that the root cause is the same.
3. Use a historical root cause as supporting evidence only when it is
   actually documented in the retrieved incident.
4. Do not invent a root cause, diagnostic result, network condition,
   resolution, or verification result.
5. Missing historical root causes must remain unknown.
6. Do not claim that an action resolved an incident unless the
   historical evidence explicitly confirms that outcome.
7. Do not infer a current root cause solely from historical actions.
8. Do not invent shell commands or recommend undocumented recovery actions.
9. If there is insufficient evidence to identify a root cause, return
   null for probableRootCause and set confidence to "low".
10. Confidence must reflect the available evidence, not the model's
    subjective certainty.
11. Do not claim that live network checks have been performed.
12. Do not treat the absence of evidence as proof that a cause is absent.
13. Alternative hypotheses must be supported by documented evidence.
    If none can be supported, return an empty list.
14. Recommended validation must use checks documented in the retrieved
    historical incidents. If no supported checks are available, return
    an empty list.
15. Treate the related tickets as observations, not proff of a shared root cause.
16. Tickets on the same node with nearby timestamps may be corelated,
    but temporal proximity alone does not estanlish causation.
17. Use related tickets as supporting evidence only when their documented
    details support the hypothesis. Alarm type, severity, and timing alone
    are insufficient to confirm a root cause.
18. If related tickets suggest a possible relationship but no documented
    evidence establishes the cause, explain the relationship as a hypotheses
    and keep probableRootCause null.
19. Treat the current ticket's recorded resolution as direct evidence about this incident, but do not assume that every recorded statement is independently verified.
20. If a root cause is documented in the current ticket's recorded resolution, use it as the primary source when describing the documented root cause. Distinguish a recorded cause from an independently confirmed cause.
21. Use the recorded actions, resolution, and verification results to describe what was done and what was documented as the outcome. Do not claim successful verification if the verification results are missing or inconclusive.
22. If the current ticket's recorded resolution is missing or incomplete, explicitly identify the missing information in evidenceGaps. Do not fill gaps using assumptions or details from similar historical incidents.
23. Keep the documented root cause, probable root cause, actions taken, resolution, and verification results conceptually separate. Evidence that a recovery action was performed does not, by itself, prove the underlying root cause.
24. Historical incidents and related tickets may provide context, but they must not override contradictory evidence recorded for the current ticket without explicitly explaining the conflict.
25. Do not describe a probable root cause as confirmed unless the available evidence supports that level of certainty.

OUTPUT REQUIREMENTS
Return only a valid JSON object with exactly these keys:

{{
  "status": "probable_cause_identified" or "insufficient_evidence",
  "probableRootCause": "documented, evidence-supported explanation or null",
  "confidence": "low", "medium", or "high",
  "supportingEvidence": [
    {{
      "source": "historical incident ID or ticket information",
      "evidence": "specific documented evidence",
      "relevance": "why the evidence supports or limits the hypothesis"
    }}
  ],
  "alternativeHypotheses": [
    {{
      "hypothesis": "possible cause",
      "evidence": "documented evidence supporting it"
    }}
  ],
  "evidenceGaps": [
    "specific missing information that prevents confirmation"
  ],
  "recommendedValidation": [
    {{
      "check": "documented diagnostic check",
      "purpose": "purpose only if supported by the retrieved evidence"
    }}
  ],
  "summary": "concise RCA conclusion"
}}

Return "insufficient_evidence" and a null probableRootCause when the
retrieved evidence does not support a defensible root-cause hypothesis.

Do not include Markdown fences or text outside the JSON object.
"""

    # ---------------------------------------------------------
    # 6. Generate the RCA
    # ---------------------------------------------------------
    response = llm.invoke(prompt)

    # ---------------------------------------------------------
    # 7. Parse and validate the model's JSON output
    # ---------------------------------------------------------
    import json

    try:
        rca_result = json.loads(response.content)

        required_keys = {
            "status",
            "probableRootCause",
            "confidence",
            "supportingEvidence",
            "alternativeHypotheses",
            "evidenceGaps",
            "recommendedValidation",
            "summary",
        }

        if not isinstance(rca_result, dict):
            raise ValueError("RCA response must be a JSON object.")

        if not required_keys.issubset(rca_result.keys()):
            raise ValueError("RCA response is missing required fields.")

        if rca_result["status"] not in {
            "probable_cause_identified",
            "insufficient_evidence",
        }:
            raise ValueError("RCA response contains an invalid status.")

        if rca_result["confidence"] not in {"low", "medium", "high"}:
            raise ValueError("RCA response contains invalid confidence.")

        if (
            rca_result["status"] == "insufficient_evidence"
            and rca_result["probableRootCause"] is not None
        ):
            raise ValueError(
                "An insufficient-evidence result cannot assert a root cause."
            )

    except (json.JSONDecodeError, ValueError, TypeError):
        return {
            "ticketNumber": ticket_number,
            "alarmType": alarm_type,
            "status": "insufficient_evidence",
            "probableRootCause": None,
            "confidence": "low",
            "supportingEvidence": [],
            "alternativeHypotheses": [],
            "evidenceGaps": [
                "The RCA model returned an invalid or incomplete response."
            ],
            "recommendedValidation": [],
            "historicalIncidents": historical_incidents,
            "relatedTickets": related_tickets,
            "correlationFindings": correlation_findings,
            "message": (
                "The RCA result could not be validated. "
                "No root cause has been asserted."
            ),
        }

    #merge missing resolution evidence into RCA evidence gaps,
    existing_evidence_gaps = rca_result.get("evidenceGaps", [])

    if not isinstance(existing_evidence_gaps, list):
        existing_evidence_gaps = []

    rca_result["evidenceGaps"] = list(
        dict.fromkeys(
            existing_evidence_gaps + resolution_evidence_gaps
        )
    )

    # ---------------------------------------------------------
    # 8. Return the structured RCA result
    # ---------------------------------------------------------
    return {
        "ticketNumber": ticket_number,
        "alarmType": alarm_type,
        **rca_result,

        "recordedResolution": {
            "rootCause": (
                current_incident.root_cause
                if current_incident
                else None
            ),
            "actionsTaken": (
                current_incident.actions_taken
                if current_incident
                else None
            ),
            "resolution": (
                current_incident.resolution
                if current_incident
                else None
            ),
            "verificationResults": (
                current_incident.verification_results
                if current_incident
                else None
            ),
            "shellCommandsUsed": (
                current_incident.shell_commands_used
                if current_incident
                else None
            ),
            "shellScriptUsed": (
            current_incident.shell_script_used
            if current_incident
            else None
            ),
            "escalation": (
                current_incident.escalation
                if current_incident
                else None
            ),
            "additionalNotes": (
                current_incident.additional_notes
                if current_incident
                else None
            ),
        },
        "historicalIncidents": historical_incidents,
        "relatedTickets": related_tickets,
        "correlationFindings": correlation_findings,
    }