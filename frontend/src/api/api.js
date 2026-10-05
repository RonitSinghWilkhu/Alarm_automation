// Set this to your backend URL. Leave as "" if using a Vite proxy or same-origin.
// This project uses the Vite dev proxy (see vite.config.js), so ALL requests
// are relative and go through the single frontend origin (localhost:5173).
// This keeps the alarmops_session cookie on one origin.
const API_BASE = "";

// --- Authentication ---

export async function loginRequest(identifier, password) {
    const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ identifier, password })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            data.detail || "Invalid username/email or password."
        );
    }

    return data;
}

export async function checkAuth() {
    const response = await fetch(`${API_BASE}/auth/me`, {
        credentials: "include"
    });
    if(!response.ok){
        return null;
    }

    return await response.json();
}

export async function logoutRequest() {
    const response = await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        credentials: "include"
    });
    return response.ok;
}

export async function registerRequest(
    fullName,
    username,
    email,
    password
) {
    
    const response = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify({
            full_name: fullName,
            username,
            email,
            password
        })
    });

    const data = await response.json().catch(() => ({}) );

    if(!response.ok){
        throw new Error(
            data.detail || "Could not create the account."
        );
    }

    return data;
}

export async function forgotPasswordRequest(email) {
    const response = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify({
            email
        })
    });

    const data = await response.json().catch(() => ({}));

    if(!response.ok){
        throw new Error(
            data.detail || "Could not process the password reset request."
        );
    }

    return data;
}

export async function resetPasswordRequest(
    token,
    newPassword
) {

    const response = await fetch(`${API_BASE}/auth/reset-password`, {
        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify({
            token,
            new_password: newPassword
        })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            data.detail || "Could not reset the password."
        );
    }

    return data;
}

export const acknowledgeTicket = async (ticketNumber) => {
    const response = await fetch(`${API_BASE}/tickets/${ticketNumber}/acknowledge`, {
        method: "PUT",
        credentials: "include",
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
    const response = await fetch(`${API_BASE}/tickets` , {
        credentials: "include"
    });

    if (response.status === 401) {
        throw new Error("UNAUTHORIZED");
    }

    if (!response.ok) {
        throw new Error("Failed to fetch tickets.")
    }

    return await response.json();
}

export async function fetchNotifications() {
    const response = await fetch(`${API_BASE}/notifications` , {
        credentials: "include"
    });

    if(response.status === 401) {
        throw new Error("UNAUTHORIZED");
    }

    if (!response.ok) {
        throw new Error("Failed to fetch notifications");
    }

    return await response.json();
}

export async function closeTicket(ticketNumber) {
    const response = await fetch(`${API_BASE}/tickets/${ticketNumber}/close`, {
        method: "PUT",
        credentials: "include"
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

            credentials: "include",

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
        credentials: "include",
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
    const response = await fetch(`${API_BASE}/troubleshoot/${ticketNumber}` , {
        credentials: "include"
    });


    if (!response.ok) {
        throw new Error("Failed to troubleshoot ticket");
    }

    return await response.json();
}