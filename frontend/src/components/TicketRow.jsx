import { useState, useEffect } from "react";
import { Ticket, Eye, ArrowUp, Brain, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { getLatestPriorityUpgrade, PRIORITY_THRESHOLD_MS } from "../utils/priorityHistory";

function severityClass(severity) {
    const value = String(severity || "").toUpperCase();
    if (value === "CRITICAL") return "sev-critical";
    if (value === "MAJOR") return "sev-major";
    if (value === "MINOR") return "sev-minor";
    if (value === "WARNING") return "sev-warning";
    return "sev-default";
}

function impactClass(impact) {
    const value = String(impact || "").toUpperCase();
    if (value === "HIGH") return "impact-high";
    if (value === "MEDIUM") return "impact-medium";
    return "impact-low";
}

function formatCountdown(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function formatResolutionTime(ms) {
    const totalMinutes = Math.max(0, Math.round(ms / 60000));
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// P4 tickets never have a timer. For P1-P3, the timer always restarts from
// the latest priority-upgrade timestamp (never from ticket creation time).
function ResolutionTimer({ ticket, notifications }) {
    const [now, setNow] = useState(() => Date.now());
    const isClosed = ticket.status === "CLOSED";
    const hasTimerPriority = ticket.priority !== "P4";

    useEffect(() => {
        if (isClosed || !hasTimerPriority) return;
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, [isClosed, hasTimerPriority]);

    if (!hasTimerPriority) {
        return <span className="res-timer-none">No timer</span>;
    }

    const latestUpgrade = getLatestPriorityUpgrade(notifications, ticket.ticketNumber);
    if (!latestUpgrade) {
        return <span className="res-timer-none">No timer</span>;
    }

    const startTime = new Date(latestUpgrade.timestamp).getTime();
    const thresholdMs = PRIORITY_THRESHOLD_MS[ticket.priority];

    if (isClosed) {
        if (!ticket.closedAt) return <span className="res-timer-none">—</span>;
        const resolutionMs = new Date(ticket.closedAt).getTime() - startTime;
        return (
            <div className="res-timer res-timer-resolved" title="Resolved">
                <CheckCircle size={12} />
                <span className="res-timer-tag">Resolved in</span>
                <span className="res-timer-value">{formatResolutionTime(resolutionMs)}</span>
            </div>
        );
    }

    const remaining = thresholdMs - (now - startTime);

    if (remaining <= 0) {
        return (
            <div className="res-timer res-timer-breached" title="Resolution threshold breached">
                <AlertTriangle size={12} />
                <span className="res-timer-tag">Breached</span>
                <span className="res-timer-value">+{formatCountdown(-remaining)}</span>
            </div>
        );
    }

    const isNearBreach = remaining <= thresholdMs * 0.15;

    return (
        <div className={`res-timer${isNearBreach ? " res-timer-warning" : ""}`} title="Time remaining to resolve">
            <Clock size={12} />
            <span className="res-timer-value">{formatCountdown(remaining)}</span>
        </div>
    );
}

function TicketRow({ ticket, notifications, onDetails, onUpgrade, onTroubleshoot, onClose }) {
    const isClosed = ticket.status === "CLOSED";
    const priorityClass = `p-${String(ticket.priority || "").toLowerCase()}`;
    const statusClass = isClosed ? "status-closed" : "status-open";

    return (
        <tr>
            <td>
                <div className="cell-ticket">
                    <span className="tk-icon"><Ticket size={14} /></span>
                    <strong>{ticket.ticketNumber}</strong>
                </div>
            </td>
            <td><span className="cell-node">{ticket.node}</span></td>
            <td>{ticket.alarmType}</td>
            <td>
                <span className={`sev ${severityClass(ticket.severity)}`}>
                    <span className="sev-dot"></span>
                    {ticket.severity}
                </span>
            </td>
            <td>
                <span className={`badge ${impactClass(ticket.impactLevel)}`}>
                    <span className="badge-dot"></span>
                    {ticket.impactLevel}
                </span>
            </td>
            <td>
                <div className="cell-priority">
                    <span className={`badge priority ${priorityClass}`}>
                        <span className="badge-dot"></span>
                        {ticket.priority}
                    </span>
                    <ResolutionTimer ticket={ticket} notifications={notifications} />
                </div>
            </td>
            <td>{ticket.assignedTeam}</td>
            <td>
                <span className={`badge ${statusClass}`}>
                    <span className="badge-dot"></span>
                    {ticket.status}
                </span>
            </td>
            <td>
                <div className="row-actions">
                    <button
                        className="act-btn act-details"
                        type="button"
                        onClick={() => onDetails(ticket)}
                        title="View details"
                    >
                        <Eye size={14} />
                        <span>Details</span>
                    </button>
                    <button
                        className="act-btn act-upgrade"
                        type="button"
                        onClick={() => onUpgrade(ticket)}
                        disabled={isClosed}
                        title="Upgrade priority"
                    >
                        <ArrowUp size={14} />
                    </button>
                    <button
                        className="act-btn act-ai"
                        type="button"
                        onClick={() => onTroubleshoot(ticket)}
                        title="AI troubleshoot"
                    >
                        <Brain size={14} />
                    </button>
                    <button
                        className="act-btn act-close"
                        type="button"
                        onClick={() => onClose(ticket)}
                        disabled={isClosed}
                        title="Close ticket"
                    >
                        <CheckCircle size={14} />
                    </button>
                </div>
            </td>
        </tr>
    );
}

export default TicketRow;