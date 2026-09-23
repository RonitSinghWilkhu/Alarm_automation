import { useState, useEffect } from "react";
import { Ticket, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { getLatestPriorityUpgrade, PRIORITY_THRESHOLD_MS } from "../utils/priorityHistory";
import RowActionsMenu from "./RowActionsMenu";

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

function formatAlarmType(alarmType) {
    if (!alarmType) {
        return "-";
    }

    return String(alarmType)
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/\b\w/g, char => char.toUpperCase());
}

function getLatestReopenEvent(notifications, ticketNumber) {
    return notifications
        .filter(
            notification => 
                    notification.ticketNumber === ticketNumber &&
                    notification.eventType === "TICKET_REOPENED"
        )
        .sort(
            (a,b) =>
                new Date(b.timestamp).getTime() -
                new Date(a.timestamp).getTime()
        )[0] || null;
}

// P4 tickets never have a timer.
// For P1-P3, the timer starts from the latest reopen event.
// If the ticket has never been reopened, it falls back to the latest
// priority-upgrade timestamp.
function ResolutionTimer({ ticket, notifications }) {
    const [now, setNow] = useState(() => Date.now());
    const isClosed = ticket.status === "CLOSED";
    const hasTimerPriority = ticket.priority !== "P4";

    useEffect(() => {
        if(!hasTimerPriority){
            return;
        }

        const interval = setInterval(
            () => setNow(Date.now()),
            1000
        );

        return () => clearInterval(interval);
    }, [hasTimerPriority]);

    if (!hasTimerPriority) {
        return <span className="res-timer-none">No timer</span>;
    }

    const latestUpgrade = getLatestPriorityUpgrade(notifications, ticket.ticketNumber);

    let startTime;

    if(ticket.reopenedAt){
        startTime = new Date(ticket.reopenedAt).getTime();
    }else if (latestUpgrade){
        startTime= new Date(
            latestUpgrade.timestamp
        ).getTime();
    } else{
        return(
            <span className="res-timer-none">No timer</span>
        );
    }


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


function TicketRow({ ticket, notifications, onDetails, onUpgrade, onTroubleshoot, onClose, onReopen }) {
    const isClosed = ticket.status === "CLOSED";
    const isReopened = Boolean(ticket.reopenedAt);

    const priorityClass = `p-${String(ticket.priority || "").toLowerCase()}`;
    const statusClass = isClosed ? "status-closed" : isReopened ? "status-reopened" : "status-open";

    return (
        <tr>
            <td>
                <div className="cell-ticket">
                    <span className="tk-icon"><Ticket size={14} /></span>
                    <strong>{ticket.ticketNumber}</strong>
                </div>
            </td>
            <td><span className="cell-node">{ticket.node}</span></td>
            <td className="alarm-type-cell">{formatAlarmType(ticket.alarmType)}</td>
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
                <div className="cell-priority priority-with-timer">
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
                    {ticket.reopenedAt ? "REOPENED" : ticket.status}
                </span>
            </td>
            <td>
                <RowActionsMenu
                    ticket={ticket}
                    isClosed={isClosed}
                    onDetails={onDetails}
                    onUpgrade={onUpgrade}
                    onTroubleshoot={onTroubleshoot}
                    onClose={onClose}
                    onReopen={onReopen}
                />
            </td>
        </tr>
    );
}

export default TicketRow;