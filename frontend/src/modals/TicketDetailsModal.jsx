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

    const upgrades = getPriorityUpgrades(notifications || [], ticket.ticketNumber);
    const lastUpgrade = upgrades[upgrades.length - 1];
    const resolutionMs = isClosed && lastUpgrade && ticket.closedAt
        ? new Date(ticket.closedAt).getTime() - new Date(lastUpgrade.timestamp).getTime()
        : null;

    const segments = getStageSegments(upgrades, ticket, now);

    // Resolution Summary (Change 4B) - reuses the same lastUpgrade/thresholds,
    // never a separate timing source.
    let elapsedOrResolutionMs = null;
    let remainingMs = null;
    let isBreached = false;
    let slaStatus = null;

    if (hasTimerPriority && lastUpgrade) {
        const thresholdMs = PRIORITY_THRESHOLD_MS[ticket.priority];
        const startTime = new Date(lastUpgrade.timestamp).getTime();

        elapsedOrResolutionMs = isClosed
            ? resolutionMs
            : now - startTime;

        remainingMs = thresholdMs - elapsedOrResolutionMs;
        isBreached = remainingMs < 0;
        slaStatus = getSlaStatus(isClosed, remainingMs);
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
                        <h3><Activity size={14} /> Priority History</h3>
                        {upgrades.length === 0 ? (
                            <p className="priority-history-empty">No priority upgrades recorded yet.</p>
                        ) : (
                            <ul className="priority-history-list">
                                {upgrades.map((event, i) => (
                                    <li className="ph-item" key={`${event.timestamp}-${i}`}>
                                        <span className="ph-dot"></span>
                                        <div className="ph-content">
                                            <span className="ph-transition">
                                                {event.previousPriority} <ArrowRight size={12} /> {event.newPriority}
                                            </span>
                                            <span className="ph-time">{formatTimestamp(event.timestamp)}</span>
                                            {segments[i] && (
                                                <span className="ph-duration">
                                                    {event.newPriority} stage: {formatDuration(segments[i].durationMs)}
                                                    {segments[i].isOngoing ? " (ongoing)" : ""}
                                                </span>
                                            )}
                                        </div>
                                    </li>
                                ))}
                                {isClosed && lastUpgrade && (
                                    <li className="ph-item ph-item-closed">
                                        <span className="ph-dot ph-dot-closed"><CheckCircle2 size={11} /></span>
                                        <div className="ph-content">
                                            <span className="ph-transition">
                                                {lastUpgrade.newPriority} <ArrowRight size={12} /> CLOSED
                                            </span>
                                            <span className="ph-time">{formatTimestamp(ticket.closedAt)}</span>
                                        </div>
                                    </li>
                                )}
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
                        ) : !lastUpgrade ? (
                            <p className="resolution-summary-empty">No priority upgrade recorded yet.</p>
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