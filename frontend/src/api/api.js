// Set this to your backend URL. Leave as "" if using a Vite proxy or same-origin.
// Example: "http://127.0.0.1:8000" or "http://127.0.0.1:8001"
const API_BASE = ""; 

export const acknowledgeTicket = async (ticketNumber) => {
    const response = await fetch(`${API_BASE}/tickets/${ticketNumber}/acknowledge`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        }
    });
    if (!response.ok) {
        throw new Error("Failed to acknowledge ticket");
    }
    return response.json();
};

export async function fetchTickets() {
    const response = await fetch(`${API_BASE}/tickets`);

    if (!response.ok) {
        throw new Error("Failed to fetch tickets");
    }

    return await response.json();
}

export async function fetchNotifications() {
    const response = await fetch(`${API_BASE}/notifications`);

    if (!response.ok) {
        throw new Error("Failed to fetch notifications");
    }

    return await response.json();
}

export async function closeTicket(ticketNumber) {
    const response = await fetch(`${API_BASE}/tickets/${ticketNumber}/close`, {
        method: "PUT"
    });

    if (!response.ok) {
        throw new Error("Failed to close ticket");
    }

    return await response.json();
}

export async function reopenTicket(
    ticketNumber,
    priority,
    reason
) {

    const response = await fetch(
        `${API_BASE}/tickets/${ticketNumber}/reopen`,
        {
            method: "PUT",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                priority,
                reason
            })
        }
    );


    const data = await response.json();


    if (!response.ok) {

        throw new Error(
            data.detail ||
            data.message ||
            "Failed to reopen ticket"
        );

    }


    return data;
}

export async function upgradeTicket(ticketNumber, newPriority) {
    const response = await fetch(`${API_BASE}/tickets/${ticketNumber}/priority`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            priority: newPriority
        })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.detail ||
            data.message ||
            "Failed to upgrade ticket"
        );
    }

    return data;
}

export async function troubleshootTicket(ticketNumber) {
    const response = await fetch(`${API_BASE}/troubleshoot/${ticketNumber}`);

    if (!response.ok) {
        throw new Error("Failed to troubleshoot ticket");
    }

    return await response.json();
}