// Single source of truth for reading priority-upgrade history out of the
// existing /notifications data.

// Resolution thresholds. P4 has no timer at all.
export const PRIORITY_THRESHOLD_MS = {
    P1: 2 * 60 * 60 * 1000,
    P2: 4 * 60 * 60 * 1000,
    P3: 12 * 60 * 60 * 1000,
};

export function getPriorityUpgrades(notifications, ticketNumber) {
    return (notifications || [])
        .filter(n =>
            n.ticketNumber === ticketNumber &&
            (n.eventType === "PRIORITY_UPGRADE" || n.eventType === "PRIORITY_DOWNGRADE") &&
            n.previousPriority !== n.newPriority
        )
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

export function getLatestPriorityUpgrade(notifications, ticketNumber) {
    const upgrades = getPriorityUpgrades(notifications, ticketNumber);
    return upgrades.length ? upgrades[upgrades.length - 1] : null;
}

// NEW: Shared SLA calculator. 
// It completely IGNORES the backend's 'thresholdBreached' field (which is for alarm triggers)
// and calculates SLA strictly based on time thresholds.
export function getTicketSlaStatus(ticket, notifications) {
    if (!ticket) return "WITHIN_SLA";
    
    // P4 has no SLA timer, so it is ALWAYS within SLA
    if (ticket.priority === "P4") return "WITHIN_SLA";

    const latestUpgrade = getLatestPriorityUpgrade(notifications, ticket.ticketNumber);
    
    // If no upgrade events exist yet, we assume it's within SLA (timer hasn't started or just created)
    if (!latestUpgrade) return "WITHIN_SLA";

    const startTime = new Date(latestUpgrade.timestamp).getTime();
    const thresholdMs = PRIORITY_THRESHOLD_MS[ticket.priority];

    if (ticket.status === "CLOSED") {
        if (!ticket.closedAt) return "WITHIN_SLA";
        const resolutionMs = new Date(ticket.closedAt).getTime() - startTime;
        return resolutionMs > thresholdMs ? "BREACHED" : "WITHIN_SLA";
    } else {
        const remaining = thresholdMs - (Date.now() - startTime);
        return remaining <= 0 ? "BREACHED" : "WITHIN_SLA";
    }
}