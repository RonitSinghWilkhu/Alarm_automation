/* =========================================================
   ALARMOPS — NOC AUTOMATION DASHBOARD
   Frontend logic (backend contracts preserved)
   ========================================================= */

const API_BASE = "http://127.0.0.1:8001";

let tickets = [];
let selectedTicketIndex = null;

const filterState = {
    node: "ALL",
    alarmType: "ALL",
    severity: "ALL",
    impactLevel: "ALL",
    priority: "ALL",
    assignedTeam: "ALL",
    status: "ALL"
};

let activeFilterMenu = null;

/* =========================================================
   SVG ICON HELPERS
   ========================================================= */
const ICONS = {
    ticket: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v6a2 2 0 0 0 0 4v6H4v-6a2 2 0 0 0 0-4z"/></svg>`,
    details: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
    upgrade: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`,
    ai: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v2"/><path d="M12 20v2"/><path d="M5 5l1.5 1.5"/><path d="M17.5 17.5 19 19"/><circle cx="12" cy="12" r="4"/><path d="M2 12h2"/><path d="M20 12h2"/></svg>`,
    close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    bell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
    success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
};

/* small HTML escaper to avoid breaking markup with unexpected values */
function esc(value) {
    if (value === null || value === undefined) return "";
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/* =========================================================
   CONNECTION STATUS
   ========================================================= */
let backendUnreachableNotified = false;

function setConnection(online) {
    const status = document.getElementById("connStatus");
    const label = document.getElementById("connLabel");
    if (!status || !label) return;
    status.classList.toggle("online", online);
    status.classList.toggle("offline", !online);
    label.textContent = online ? "Backend connected" : "Backend offline";
}

/* =========================================================
   LOADING SKELETON
   ========================================================= */
function showTableSkeleton() {
    const tableBody = document.getElementById("ticketTableBody");
    const empty = document.getElementById("tableEmpty");
    if (empty) empty.classList.add("hidden");
    if (!tableBody) return;

    let rows = "";
    for (let i = 0; i < 6; i++) {
        rows += `<tr>${'<td><div class="skeleton" style="width:80%"></div></td>'.repeat(9)}</tr>`;
    }
    tableBody.innerHTML = rows;
}

/* =========================================================
   LOAD TICKETS
   ========================================================= */
async function loadTickets() {
    showTableSkeleton();
    try {
        const response = await fetch(`${API_BASE}/tickets`);
        if (!response.ok) {
            throw new Error("Could not load tickets");
        }
        tickets = await response.json();
        setConnection(true);

        if (backendUnreachableNotified) {
            closeMessageModal();
            backendUnreachableNotified = false;
            toast("success", "Backend Reconnected", "Connection to the backend has been restored.");
        }

        displayTickets();
    } catch (error) {
        console.error("Error loading tickets:", error);
        setConnection(false);
        const tableBody = document.getElementById("ticketTableBody");
        if (tableBody) tableBody.innerHTML = "";
        showEmptyState(true);

        if (!backendUnreachableNotified) {
            backendUnreachableNotified = true;
            showMessage("Connection Error", "Could not connect to the backend API. Please ensure the service is running on port 8001.");
        }
    }
}

/* =========================================================
   LOAD NOTIFICATIONS
   ========================================================= */
async function loadNotifications() {
    try {
        const response = await fetch(`${API_BASE}/notifications`);
        if (!response.ok) {
            throw new Error("Could not load notifications");
        }
        const notifications = await response.json();
        displayNotifications(notifications);
    } catch (error) {
        console.error("Error loading notifications:", error);
    }
}

const FILTER_FIELDS = {
    node:"node",
    alarmType: "alarmType",
    severity: "severity",
    impactLevel: "impactLevel",
    priority: "priority",
    assignedTeam: "assignedTeam",
    status: "status"
};

function getFilterValues(key) {

    const field = FILTER_FIELDS[key];

    if(!field) {
        return[];
    }

    return [
        ...new Set(
            tickets
                .map(ticket => ticket[field])
                .filter(value => 
                    value !== null &&
                    value !== undefined &&
                    String(value).trim() !== ""
                )
                .map(value => String(value))
        )
    ].sort((a,b) =>
        a.localeCompare(b,undefined, {
            numeric: true,
            sensitivity: "base"
        })
    );
}

function openFilterMenu(button, key) {

    closeFilterMenu();

    const values = getFilterValues(key);

    const menu = document.createElement("div");

    menu.className = "filter-menu";

    menu.dataset.filterKey = key;


    const allOption = document.createElement("button");

    allOption.type = "button";

    allOption.className =
        "filter-option" +
        (
            filterState[key] === "ALL"
                ? " selected"
                : ""
        );

    allOption.innerHTML = `
        <span>ALL</span>
        ${
            filterState[key] === "ALL"
                ? '<span class="filter-option-check">✓</span>'
                : ""
        }
    `;


    allOption.addEventListener("click", () => {

        setColumnFilter(key, "ALL");

        closeFilterMenu();

    });


    menu.appendChild(allOption);


    values.forEach(value => {

        const option = document.createElement("button");

        option.type = "button";

        option.className =
            "filter-option" +
            (
                String(filterState[key]) === String(value)
                    ? " selected"
                    : ""
            );


        option.innerHTML = `
            <span>${esc(value)}</span>
            ${
                String(filterState[key]) === String(value)
                    ? '<span class="filter-option-check">✓</span>'
                    : ""
            }
        `;


        option.addEventListener("click", () => {

            setColumnFilter(key, value);

            closeFilterMenu();

        });


        menu.appendChild(option);

    });


    document.body.appendChild(menu);


    const rect = button.getBoundingClientRect();

    let left = rect.left;

    let top = rect.bottom + 6;


    const menuWidth = menu.offsetWidth;

    const menuHeight = menu.offsetHeight;


    if (left + menuWidth > window.innerWidth - 10) {

        left = window.innerWidth - menuWidth - 10;

    }


    if (top + menuHeight > window.innerHeight - 10) {

        top = rect.top - menuHeight - 6;

    }


    menu.style.left =
        `${Math.max(10, left)}px`;

    menu.style.top =
        `${Math.max(10, top)}px`;


    menu.classList.add("open");

    button.classList.add("open");


    activeFilterMenu = {
        menu,
        button
    };

}

function closeFilterMenu() {

    if (!activeFilterMenu) {
        return;
    }

    activeFilterMenu.menu.remove();

    activeFilterMenu.button.classList.remove("open");

    activeFilterMenu = null;
}

function setColumnFilter(key, value) {

    filterState[key] = value;

    updateColumnFilterState();

    filterTickets();
}

function updateColumnFilterState() {

    document
        .querySelectorAll(".column-filter")
        .forEach(button => {

            const key = button.dataset.filterKey;

            button.classList.toggle(
                "active",
                Boolean(key) && filterState[key] !== "ALL"
            );
        });
}

function displayNotifications(notifications) {
    const list = document.getElementById("notificationList");
    const count = document.getElementById("notificationCount");
    const navBadge = document.getElementById("navNotifBadge");

    if (!list) return;
    list.innerHTML = "";

    const total = notifications.length;
    if (count) count.textContent = total;
    if (navBadge) navBadge.textContent = total;

    if (total === 0) {
        list.innerHTML = `<div class="no-notifications">No notifications available.</div>`;
        return;
    }

    notifications.forEach((n) => {
        const item = document.createElement("div");
        item.className = "notification-item";
        item.innerHTML = `
            <div class="notif-icon">${ICONS.bell}</div>
            <div class="notification-ticket">${esc(n.ticketNumber)}</div>
            <div class="notification-team">${esc(n.assignedTeam)}</div>
            <div class="notification-message">${esc(n.message)}</div>
            <div class="notification-status">${esc(n.status)}</div>
        `;
        list.appendChild(item);
    });
}

/* =========================================================
   DISPLAY TICKETS
   ========================================================= */
function severityClass(severity) {
    const s = (severity || "").toString().toUpperCase();
    if (s === "CRITICAL") return "sev-critical";
    if (s === "MAJOR") return "sev-major";
    if (s === "MINOR") return "sev-minor";
    if (s === "WARNING") return "sev-warning";
    return "sev-default";
}

function displayTickets() {
    const tableBody = document.getElementById("ticketTableBody");
    if (!tableBody) return;
    tableBody.innerHTML = "";

    let openTickets = 0;
    let highImpact = 0;
    let closedTickets = 0;

    tickets.forEach((ticket, index) => {
        if (ticket.status === "OPEN") openTickets++;
        if (ticket.status === "CLOSED") closedTickets++;
        if (ticket.impactLevel === "HIGH") highImpact++;

        let impactClass = "impact-low";
        if (ticket.impactLevel === "HIGH") impactClass = "impact-high";
        else if (ticket.impactLevel === "MEDIUM") impactClass = "impact-medium";

        const statusClass = ticket.status === "CLOSED" ? "status-closed" : "status-open";
        const priorityClass = "p-" + (ticket.priority || "").toString().toLowerCase();
        const isClosed = ticket.status === "CLOSED";

        const row = document.createElement("tr");
        row.innerHTML = `
            <td>
                <div class="cell-ticket">
                    <span class="tk-icon">${ICONS.ticket}</span>
                    <strong>${esc(ticket.ticketNumber)}</strong>
                </div>
            </td>
            <td><span class="cell-node">${esc(ticket.node)}</span></td>
            <td>${esc(ticket.alarmType)}</td>
            <td>
                <span class="sev ${severityClass(ticket.severity)}">
                    <span class="sev-dot"></span>${esc(ticket.severity)}
                </span>
            </td>
            <td><span class="badge ${impactClass}">${esc(ticket.impactLevel)}</span></td>
            <td><span class="badge priority ${priorityClass}">${esc(ticket.priority)}</span></td>
            <td>${esc(ticket.assignedTeam)}</td>
            <td><span class="badge ${statusClass}">${esc(ticket.status)}</span></td>
            <td>
                <div class="row-actions">
                    <button class="act-btn act-details" onclick="showTicketDetails(${index})" title="View details">
                        ${ICONS.details}<span>Details</span>
                    </button>
                    <button class="act-btn act-upgrade" onclick="openUpgradeModal(${index})" ${isClosed ? "disabled" : ""} title="Upgrade priority">
                        ${ICONS.upgrade}
                    </button>
                    <button class="act-btn act-ai" onclick="openTroubleshootModal(${index})" title="AI troubleshoot">
                        ${ICONS.ai}
                    </button>
                    <button class="act-btn act-close" onclick="openCloseModal(${index})" ${isClosed ? "disabled" : ""} title="Close ticket">
                        ${ICONS.close}
                    </button>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });

    setText("totalTickets", tickets.length);
    setText("openTickets", openTickets);
    setText("highImpact", highImpact);
    setText("closedTickets", closedTickets);

    updateColumnFilterState();

    filterTickets();
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function showEmptyState(show) {
    const empty = document.getElementById("tableEmpty");
    if (empty) empty.classList.toggle("hidden", !show);
}

/* =========================================================
   FILTER + SEARCH
   ========================================================= */
function setStatusFilter(value, btn) {

    filterState.status = value;

    const select = document.getElementById("statusFilter");

    if (select) {
        select.value = value;
    }

    document
        .querySelectorAll(".segmented .seg")
        .forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.filter === value
            );
        });

    updateColumnFilterState();

    filterTickets();
}

function filterTickets() {

    const searchEl = document.getElementById("searchInput");

    const term = searchEl
        ? searchEl.value.trim().toLowerCase()
        : "";


    const rows =
        document.querySelectorAll("#ticketTableBody tr");

    let visible = 0;


    rows.forEach((row, index) => {

        const ticket = tickets[index];

        if (!ticket) {
            return;
        }


        const matchesColumnFilters =
            Object.entries(filterState).every(
                ([key, selectedValue]) => {

                    if (selectedValue === "ALL") {
                        return true;
                    }

                    const ticketValue = ticket[key];

                    return (
                        ticketValue !== null &&
                        ticketValue !== undefined &&
                        String(ticketValue) ===
                            String(selectedValue)
                    );
                }
            );


        const haystack = [
            ticket.ticketNumber,
            ticket.node,
            ticket.alarmType,
            ticket.assignedTeam,
            ticket.severity,
            ticket.priority,
            ticket.impactLevel,
            ticket.status
        ]
            .join(" ")
            .toLowerCase();


        const matchesSearch =
            term === "" ||
            haystack.includes(term);


        const show =
            matchesColumnFilters &&
            matchesSearch;


        row.style.display =
            show ? "" : "none";


        if (show) {
            visible++;
        }
    });


    showEmptyState(visible === 0);
}

/* =========================================================
   DETAILS MODAL
   ========================================================= */
function showTicketDetails(index) {
    const ticket = tickets[index];
    const content = document.getElementById("detailsContent");
    if (!content) return;

    const fields = [
        ["Ticket Number", ticket.ticketNumber],
        ["Node", ticket.node],
        ["Alarm Type", ticket.alarmType],
        ["Occurrence Count", ticket.occurrenceCount],
        ["Users Impacted", ticket.usersImpacted],
        ["Severity", ticket.severity],
        ["Threshold Breached", ticket.thresholdBreached],
        ["Impact Level", ticket.impactLevel],
        ["Priority", ticket.priority],
        ["Assignment Team", ticket.assignedTeam],
        ["Status", ticket.status],
        ["Reason", ticket.reason]
    ];

    content.innerHTML = `
        <div class="details-grid">
            ${fields.map(([label, value]) => `
                <div class="detail-item">
                    <strong>${esc(label)}</strong>
                    ${esc(value)}
                </div>
            `).join("")}
        </div>
    `;

    openModal("detailsModal");
}

function closeDetails() { closeModal("detailsModal"); }

/* =========================================================
   UPGRADE MODAL
   ========================================================= */
function openUpgradeModal(index) {
    const ticket = tickets[index];

    if (ticket.status === "CLOSED") {
        showMessage("Ticket Closed", "A closed ticket cannot be upgraded.");
        return;
    }

    selectedTicketIndex = index;
    setText("upgradeTicketNumber", ticket.ticketNumber);
    setText("currentPriority", ticket.priority);
    const newPriority = document.getElementById("newPriority");
    if (newPriority) newPriority.value = "P3";

    openModal("upgradeModal");
}

function closeUpgradeModal() {
    closeModal("upgradeModal");
    selectedTicketIndex = null;
}

async function confirmUpgrade() {
    if (selectedTicketIndex === null) return;

    const ticket = tickets[selectedTicketIndex];
    const priority = document.getElementById("newPriority").value;

    try {
        const response = await fetch(
            `${API_BASE}/tickets/${ticket.ticketNumber}/priority`,
            {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ priority: priority })
            }
        );

        const result = await response.json();

        if (!response.ok) {
            showMessage("Upgrade Failed", result.message);
            return;
        }

        ticket.priority = priority;
        closeUpgradeModal();
        displayTickets();
        loadNotifications();

        toast("success", "Ticket Upgraded", `${ticket.ticketNumber} upgraded to ${priority}.`);
    } catch (error) {
        console.error(error);
        showMessage("Connection Error", "Could not connect to backend API. Please ensure the backend is running.");
    }
}

/* =========================================================
   CLOSE MODAL
   ========================================================= */
function openCloseModal(index) {
    const ticket = tickets[index];
    if (ticket.status === "CLOSED") return;

    selectedTicketIndex = index;
    setText("closeTicketNumber", ticket.ticketNumber);
    openModal("closeModal");
}

function closeCloseModal() {
    closeModal("closeModal");
    selectedTicketIndex = null;
}

async function confirmClose() {
    if (selectedTicketIndex === null) return;

    const ticket = tickets[selectedTicketIndex];

    try {
        const response = await fetch(
            `${API_BASE}/tickets/${ticket.ticketNumber}/close`,
            { method: "PUT" }
        );

        const result = await response.json();

        if (!response.ok) {
            showMessage("Close Failed", result.message);
            return;
        }

        ticket.status = "CLOSED";
        closeCloseModal();
        displayTickets();
        loadNotifications();

        toast("success", "Ticket Closed", `${ticket.ticketNumber} has been closed successfully.`);
    } catch (error) {
        console.error(error);
        showMessage("Connection Error", "Could not connect to the backend API.");
    }
}

/* =========================================================
   TROUBLESHOOT MODAL
   ========================================================= */
async function openTroubleshootModal(index) {
    const ticket = tickets[index];

    setText("troubleshootTicketNumber", ticket.ticketNumber);
    setText("troubleshootNode", ticket.node);
    setText("troubleshootAlarmType", ticket.alarmType);

    const content = document.getElementById("troubleshootContent");
    if (content) content.textContent = "Loading troubleshooting recommendation…";

    openModal("troubleshootModal");

    try {
        const response = await fetch(`${API_BASE}/troubleshoot/${ticket.ticketNumber}`);
        if (!response.ok) {
            throw new Error("Could not get troubleshooting recommendation");
        }
        const result = await response.json();

        let html = formatTroubleshootingResult(result.recommendation);

        if (result.historicalIncidents && result.historicalIncidents.length > 0) {
            html += '<div class="historical-section">';
            html += '<h3 class="historical-title">Historical Incidents</h3>';

            result.historicalIncidents.forEach((incident, i) => {
                html += '<div class="historical-card">';
                html += '<div class="historical-card-header">';
                html += '<span class="historical-badge">Historical Incident ' + (i + 1) + '</span>';
                html += '<span class="historical-alarm">' + esc(incident.alarmType) + '</span>';
                html += '</div>';
                html += '<pre class="historical-content">' + esc(incident.content) + '</pre>';
                html += '</div>';
            });

            html += '</div>';
        }

        if (content) content.innerHTML = html;
    } catch (error) {
        console.error("Troubleshooting error:", error);
        if (content) content.textContent = "Could not load troubleshooting recommendation.";
    }
}

function formatTroubleshootingResult(text) {
    let formatted = text;
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    formatted = formatted.replace(/`([^`]+)`/g, "<code>$1</code>");
    formatted = formatted.replace(/^---$/gm, "<hr>");
    formatted = formatted.replace(/^-\s+(.*)$/gm, "<li>$1</li>");
    formatted = formatted.replace(/(<li>.*?<\/li>(?:\s*<li>.*?<\/li>)*)/gs, "<ul>$1</ul>");
    formatted = formatted.replace(/^(\d+)\.\s+(.*)$/gm, '<div class="troubleshoot-step"><strong>$1.</strong> $2</div>');
    formatted = formatted.replace(/\n/g, "<br>");
    return formatted;
}

function closeTroubleshootModal() { closeModal("troubleshootModal"); }

/* =========================================================
   MESSAGE MODAL
   ========================================================= */
function showMessage(title, message) {
    setText("messageTitle", title);
    setText("messageContent", message);
    openModal("messageModal");
}

function closeMessageModal() { closeModal("messageModal"); }

/* =========================================================
   TOASTS
   ========================================================= */
function toast(type, title, message) {
    const host = document.getElementById("toastHost");
    if (!host) return;

    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.innerHTML = `
        <div class="toast-icon">${ICONS[type] || ICONS.info}</div>
        <div class="toast-body">
            <div class="toast-title">${esc(title)}</div>
            <div class="toast-msg">${esc(message)}</div>
        </div>
    `;
    host.appendChild(el);

    setTimeout(() => {
        el.classList.add("leaving");
        el.addEventListener("animationend", () => el.remove(), { once: true });
    }, 3800);
}

/* =========================================================
   MODAL HELPERS
   ========================================================= */
function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove("hidden");
}
function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add("hidden");
}

function closeAllModals() {
    ["detailsModal", "upgradeModal", "closeModal", "troubleshootModal", "messageModal"]
        .forEach(closeModal);
    selectedTicketIndex = null;
}

/* =========================================================
   THEME (persisted)
   ========================================================= */
function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
}

function initTheme() {
    const saved = localStorage.getItem("alarmops-theme");
    const prefersDark = window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(saved || (prefersDark ? "dark" : "light"));
}

function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    applyTheme(next);
    localStorage.setItem("alarmops-theme", next);
}

/* =========================================================
   EVENT WIRING
   ========================================================= */
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAllModals();
});

document.addEventListener("click", (event) => {
    if (event.target.classList && event.target.classList.contains("modal-overlay")) {
        event.target.classList.add("hidden");
        selectedTicketIndex = null;
    }
});

document.addEventListener("DOMContentLoaded", () => {
    // theme toggle
    const themeBtn = document.getElementById("darkModeToggle");
    if (themeBtn) themeBtn.addEventListener("click", toggleTheme);

    // refresh
    const refreshBtn = document.getElementById("refreshBtn");
    if (refreshBtn) {
        refreshBtn.addEventListener("click", () => {
            refreshBtn.classList.add("spin");
            Promise.all([loadTickets(), loadNotifications()]).finally(() => {
                setTimeout(() => refreshBtn.classList.remove("spin"), 500);
            });
        });
    }

    // mobile sidebar
    const menuToggle = document.getElementById("menutoggle");
    const sidebarReopen = document.getElementById("sidebarReopen");
    const sidebar = document.getElementById("sidebar");
    const main = document.querySelector(".main");

    function toggleSidebar(){
        if(!sidebar || !main) return;

        const isCollapsed = sidebar.classList.toggle("collapsed");
        main.classList.toggle("sidebar-collapsed", isCollapsed);
    }

    //button inside sidebar
    if(menuToggle){
        menuToggle.addEventListener("click", toggleSidebar);
    }

    //button visible when sidebar is collapsed
    if(sidebarReopen){
        sidebarReopen.addEventListener("click", toggleSidebar);
    }

    //column filters
    document
        .querySelectorAll(".column-filter")
        .forEach(button => {

            button.addEventListener("click", event => {

                event.stopPropagation();

                const key = button.dataset.filterKey;

                if(!key) {
                    return;
                }

                if(activeFilterMenu && activeFilterMenu.button === button){
                    closeFilterMenu();
                    return;
                }

                openFilterMenu(button,key);
            });
        });

    document.addEventListener("click", event => {

        if(
            activeFilterMenu &&
            !activeFilterMenu.menu.contains(event.target) &&
            !activeFilterMenu.button.contains(event.target)
        ){
            closeFilterMenu();
        }
    });

    window.addEventListener("resize", closeFilterMenu);

    window.addEventListener("scroll" , closeFilterMenu , true);


    const userMenuBtn = document.getElementById("userMenuBtn");
    const userDropdown = document.getElementById("userDropdown");
    const userMenu = document.querySelector(".user-menu");

    if(userMenuBtn && userDropdown && userMenu) {

        userMenuBtn.addEventListener("click",(event) => {
            event.stopPropagation();

            const isOpen = userMenu.classList.toggle("open");
            userDropdown.classList.toggle("hidden",!isOpen);

            userMenuBtn.setAttribute("aria-expanded" , isOpen);
        });

        document.addEventListener("click",(event) => {
            if(!userMenu.contains(event.target)){
                userMenu.classList.remove("open");
                userDropdown.classList.add("hidden");
                userMenuBtn.setAttribute("aria-expanded" , "false");
            }
        });
    }
});

/* =========================================================
   BOOTSTRAP
   ========================================================= */
initTheme();
loadTickets();
loadNotifications();

setInterval(() => {
    loadTickets();
}, 20000);

setInterval(() => {
    loadNotifications();
}, 20000);