import { useState, useEffect } from "react";
import { X, ArrowRight, CheckCircle2, Info, Activity, Gauge } from "lucide-react";
import { getPriorityUpgrades, PRIORITY_THRESHOLD_MS } from "../utils/priorityHistory";

function formatTimestamp(ts) {
    if (!ts) return "-";
    return new Date(ts).toLocaleString("en-US", {
        day: "numeric", month: "short", year: "numeric",
        hour: "numeric", minute: "2-digit", hour12: true
    });
}

function formatDuration(ms) {
    const totalMinutes = Math.max(0, Math.round(ms / 60000));
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Splits the ticket's upgrade history into per-priority stages so each
// timeline entry can show how long the ticket actually spent there.
// The final stage runs to closedAt (closed) or "now" (still open).
function getStageSegments(upgrades, ticket, now) {
    return upgrades.map((event, i) => {
        const start = new Date(event.timestamp).getTime();
        const next = upgrades[i + 1];
        const isLast = !next;
        const end = next
            ? new Date(next.timestamp).getTime()
            : (ticket.status === "CLOSED" && ticket.closedAt
                ? new Date(ticket.closedAt).getTime()
                : now);
        return {
            durationMs: Math.max(0, end - start),
            isOngoing: isLast && ticket.status !== "CLOSED"
        };
    });
}

function getSlaStatus(isClosed, remainingMs) {
    if (isClosed) return remainingMs >= 0 ? "Resolved Within SLA" : "Resolved After SLA";
    return remainingMs >= 0 ? "Within SLA" : "Breached";
}

function TicketDetailsModal({ ticket, notifications, onClose }) {
    const [now, setNow] = useState(() => Date.now());
    const isClosed = ticket?.status === "CLOSED";
    const hasTimerPriority = !!ticket && ticket.priority !== "P4";

    // Live-updates Elapsed/Remaining/stage duration while the modal is open
    // on an unresolved, non-P4 ticket. Independent of TicketRow's own timer.
    useEffect(() => {
        if (!ticket || isClosed || !hasTimerPriority) return;
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, [ticket, isClosed, hasTimerPriority]);

    if (!ticket) return null;

    const thresholdBreached = 
        ticket.thresholdBreached ??
        ticket.threshold_breached ??
        ticket.threshold ??
        ticket.thresholdBreachedValue;

    const fields = [
        ["Ticket Number", ticket.ticketNumber],
        ["Node", ticket.node],
        ["Alarm Type", ticket.alarmType],
        ["Occurrence Count", ticket.occurrenceCount],
        ["Users Impacted", ticket.usersImpacted],
        ["Severity", ticket.severity],
        ["Threshold Breached", thresholdBreached],
        ["Impact Level", ticket.impactLevel],
        [isClosed ? "Final Priority" : "Current Priority", ticket.priority],
        ["Assignment Team", ticket.assignedTeam],
        ["Status", ticket.status],
        ["Reason", ticket.reason]
    ];

    const ticketNotifications = (notifications || []).filter(notification => notification.ticketNumber === ticket.ticketNumber);
    const upgrades = getPriorityUpgrades(ticketNotifications,ticket.ticketNumber);
    const lastUpgrade = upgrades[upgrades.length-1];
    const reopenEvents = ticketNotifications.filter(notification => notification.eventType === "TICKET_REOPENED").sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime() );
    const lifecycleEvents = ticketNotifications
        .filter(
            notification =>
                [
                    "TICKET_CREATED",
                    "PRIORITY_UPGRADE",
                    "PRIORITY_DOWNGRADE",
                    "TICKET_CLOSED",
                    "TICKET_REOPENED"
                ].includes(notification.eventType)
        ).sort(
            (a,b) =>
                new Date(a.timestamp).getTime() -
                new Date(b.timestamp).getTime()
        );

    const resolutionMsStartTime = ticket.reopenedAt
        ? new Date(ticket.reopenedAt).getTime()
        : lastUpgrade
            ? new Date(lastUpgrade.timestamp).getTime()
            : null;

    const resolutionMs = isClosed && resolutionMsStartTime && ticket.closedAt
        ? new Date(ticket.closedAt).getTime() - resolutionMsStartTime
        : null;

    const segments = getStageSegments(upgrades, ticket, now);

    // Resolution Summary (Change 4B) - reuses the same lastUpgrade/thresholds,
    // never a separate timing source.
    let elapsedOrResolutionMs = null;
    let remainingMs = null;
    let isBreached = false;
    let slaStatus = null;

    if (hasTimerPriority && resolutionMsStartTime) {
        const thresholdMs = PRIORITY_THRESHOLD_MS[ticket.priority];

        elapsedOrResolutionMs = isClosed
            ? resolutionMs
            : now - resolutionMsStartTime;

        remainingMs = thresholdMs - elapsedOrResolutionMs;

        isBreached = remainingMs<0;

        slaStatus = getSlaStatus(isClosed,remainingMs);
    }

    return (
        <div className="modal-overlay">
            <div className="modal">
                <div className="modal-header">
                    <div>
                        <h2>Ticket Details</h2>
                        <p className="modal-subtitle">{ticket.ticketNumber}</p>
                    </div>
                    <button className="modal-close" type="button" onClick={onClose} aria-label="Close modal">
                        <X size={18} />
                    </button>
                </div>
                <div className="modal-body">
                    <div className="modal-section">
                        <h3><Info size={14} /> Incident Information</h3>
                        <div className="details-grid">
                            {fields.map(([label, value]) => (
                                <div className="detail-item" key={label}>
                                    <strong>{label}</strong>
                                    <span>
                                        {typeof value === "boolean"
                                            ? value ? "Yes" : "No"
                                            : value ?? "-"}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="modal-section priority-history">
                        {lifecycleEvents.length === 0 ? (

                            <p className="priority-history-empty">
                                No lifecycle history recorded yet.
                            </p>

                        ) : (

                            <ul className="priority-history-list">

                                {lifecycleEvents.map((event, index) => (

                                    <li
                                        className={
                                            event.eventType === "TICKET_CLOSED"
                                                ? "ph-item ph-item-closed"
                                                : "ph-item"
                                        }
                                        key={`${event.eventType}-${event.timestamp}-${index}`}
                                    >

                                        <span
                                            className={
                                                event.eventType === "TICKET_CLOSED"
                                                    ? "ph-dot ph-dot-closed"
                                                    : "ph-dot"
                                            }
                                        >

                                            {event.eventType === "TICKET_CLOSED"
                                                ? <CheckCircle2 size={11} />
                                                : null}

                                        </span>

                                        <div className="ph-content">

                                            {event.eventType === "TICKET_CREATED" && (

                                                <>
                                                    <span className="ph-transition">
                                                        Ticket created
                                                    </span>

                                                    <span className="ph-time">
                                                        {formatTimestamp(event.timestamp)}
                                                    </span>

                                                    <span className="ph-duration">
                                                        Priority: {event.priority}
                                                    </span>
                                                </>

                                            )}

                                            {(event.eventType === "PRIORITY_UPGRADE" ||
                                            event.eventType === "PRIORITY_DOWNGRADE") && (

                                                <>
                                                    <span className="ph-transition">

                                                        {event.previousPriority}

                                                        <ArrowRight size={12} />

                                                        {event.newPriority}

                                                    </span>

                                                    <span className="ph-time">
                                                        {formatTimestamp(event.timestamp)}
                                                    </span>

                                                    <span className="ph-duration">
                                                        {event.eventType === "PRIORITY_UPGRADE"
                                                            ? "Priority upgraded"
                                                            : "Priority downgraded"}
                                                    </span>
                                                </>

                                            )}

                                            {event.eventType === "TICKET_CLOSED" && (

                                                <>
                                                    <span className="ph-transition">
                                                        Ticket closed
                                                    </span>

                                                    <span className="ph-time">
                                                        {formatTimestamp(event.timestamp)}
                                                    </span>

                                                    <span className="ph-duration">
                                                        Priority: {event.priority}
                                                    </span>
                                                </>

                                            )}

                                            {event.eventType === "TICKET_REOPENED" && (

                                                <>
                                                    <span className="ph-transition">
                                                        Ticket reopened
                                                    </span>

                                                    <span className="ph-time">
                                                        {formatTimestamp(event.timestamp)}
                                                    </span>

                                                    <span className="ph-duration">
                                                        Priority: {event.priority}
                                                    </span>

                                                    <span className="ph-duration">
                                                        Reason: {event.reason}
                                                    </span>
                                                </>

                                            )}

                                        </div>

                                    </li>

                                ))}

                            </ul>

                        )}
                        {resolutionMs !== null && (
                            <div className="priority-history-resolution">
                                <span>Resolution Time</span>
                                <strong>{formatDuration(resolutionMs)}</strong>
                            </div>
                        )}
                    </div>

                    <div className="modal-section resolution-summary">
                        <h3><Gauge size={14} /> Resolution Summary</h3>
                        {!hasTimerPriority ? (
                            <p className="resolution-summary-empty">No resolution timer for P4 tickets.</p>
                        ) : !resolutionMsStartTime ? (
                            <p className="resolution-summary-empty">No SLA timer start recorded yet.</p>
                        ) : (
                            <div className="resolution-summary-grid">
                                <div className="rs-item">
                                    <strong>{isClosed ? "Final Priority" : "Current Priority"}</strong>
                                    <span>{ticket.priority}</span>
                                </div>
                                <div className="rs-item">
                                    <strong>{isClosed ? "Resolution Time" : "Elapsed"}</strong>
                                    <span>{formatDuration(elapsedOrResolutionMs)}</span>
                                </div>
                                {!isClosed && (
                                    <div className="rs-item">
                                        <strong>Remaining</strong>
                                        <span className={isBreached ? "rs-negative" : ""}>
                                            {isBreached ? `+${formatDuration(-remainingMs)}` : formatDuration(remainingMs)}
                                        </span>
                                    </div>
                                )}
                                <div className="rs-item">
                                    <strong>SLA Status</strong>
                                    <span className={`sla-pill ${isBreached ? "sla-breached" : "sla-ok"}`}>
                                        {slaStatus}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default TicketDetailsModal;