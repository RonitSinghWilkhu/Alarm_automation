import { Bell, Search, X, Ticket } from "lucide-react";
import { useState, useEffect } from "react";
import { getTicketSlaStatus } from "../utils/priorityHistory";

function Notifications({ notifications, tickets, onAcknowledge }) {
    const [statusFilter, setStatusFilter] = useState("OPEN");
    const [slaFilter, setSlaFilter] = useState("ALL");
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [modalTicketNumber, setModalTicketNumber] = useState(null);

    const notificationsPerPage = 10;

    // 1. Group notifications by ticketNumber
    const groups = notifications.reduce((acc, notif) => {
        const tNum = notif.ticketNumber;
        if (!acc[tNum]) acc[tNum] = [];
        acc[tNum].push(notif);
        return acc;
    }, {});

    // 2. Build group objects (Sort notifications newest-first for the modal)
    const groupedList = Object.keys(groups).map(tNum => {
        const notifs = groups[tNum];
        const ticket = tickets.find(t => t.ticketNumber === tNum);
        const sortedNotifs = [...notifs].sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
        return {
            ticketNumber: tNum,
            ticket,
            notifications: sortedNotifs,
            latestNotif: sortedNotifs[0]
        };
    });

    // 3. Apply Filters to the groups
    const filteredGroups = groupedList.filter(group => {
        const ticketStatus = group.ticket?.status?.toUpperCase() || "";
        const matchesStatus = statusFilter === "ALL" || ticketStatus === statusFilter;

        // USE THE HELPER FUNCTION HERE (Ignores alarm trigger threshold, uses time-based SLA)
        const ticketSlaStatus = group.ticket ? getTicketSlaStatus(group.ticket, notifications) : "WITHIN_SLA";
        const matchesSla = slaFilter === "ALL" || ticketSlaStatus === slaFilter;

        const search = searchTerm.trim().toLowerCase();
        if (search === "") return matchesStatus && matchesSla;

        const searchableText = [
            group.ticketNumber,
            group.ticket?.assignedTeam,
            group.ticket?.node,
            group.ticket?.alarmType,
            group.ticket?.priority,
            ...group.notifications.map(n => n.message || `${n.previousPriority} to ${n.newPriority}`)
        ].filter(Boolean).join(" ").toLowerCase();

        return matchesStatus && matchesSla && searchableText.includes(search);
    });

    // 4. Pagination
    const totalPages = Math.ceil(filteredGroups.length / notificationsPerPage);
    const startIndex = (currentPage - 1) * notificationsPerPage;
    const endIndex = startIndex + notificationsPerPage;
    const paginatedGroups = filteredGroups.slice(startIndex, endIndex);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter, slaFilter]);

    const activeGroup = groupedList.find(g => g.ticketNumber === modalTicketNumber);

    return (
        <div className="panel notification-page" id="notifications">
            <div className="section-header">
                <div className="panel-title">
                    <h2>Team Notifications</h2>
                    <p>Alerts dispatched to assigned response teams</p>
                </div>
                <div className="notification-count" id="notificationCount">
                    {filteredGroups.length}
                </div>
            </div>
            
            <div className="notification-toolbar">
                <div className="notification-filter">
                    <label htmlFor="notificationStatusFilter">Status</label>
                    <select id="notificationStatusFilter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                        <option value="ALL">All</option>
                        <option value="OPEN">Open</option>
                        <option value="CLOSED">Closed</option>
                    </select>

                    <div className="notification-search">
                        <Search size={16} />
                        <input type="text" placeholder="Search notifications..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>

                    <label htmlFor="notificationSlaFilter">SLA Status</label>
                    <select id="notificationSlaFilter" value={slaFilter} onChange={(e) => setSlaFilter(e.target.value)}>
                        <option value="ALL">All</option>
                        <option value="WITHIN_SLA">Within SLA</option>
                        <option value="BREACHED">Breached</option>
                    </select>
                </div>
            </div>

            <div id="notificationList">
                {filteredGroups.length === 0 ? (
                    <div className="no-notifications">No notifications available.</div>
                ) : (
                    paginatedGroups.map((group) => {
                        // USE THE HELPER FUNCTION HERE FOR THE BADGE
                        const ticketSlaStatus = group.ticket ? getTicketSlaStatus(group.ticket, notifications) : "WITHIN_SLA";
                        const isBreached = ticketSlaStatus === "BREACHED";
                        const eventCount = group.notifications.length;
                        const latest = group.latestNotif;
                        
                        return (
                            <div 
                                className="notification-item" 
                                key={group.ticketNumber}
                                onClick={() => setModalTicketNumber(group.ticketNumber)}
                                style={{ cursor: 'pointer', transition: 'background 0.2s' }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                <div className="notif-icon"><Ticket size={16} /></div>
                                <div className="notification-ticket" style={{ fontWeight: 'bold', color: '#2563eb' }}>{group.ticketNumber}</div>
                                <div className="notification-team">{group.ticket?.assignedTeam || 'Unknown'}</div>
                                <div className="notification-message">
                                    <div style={{ fontWeight: 500 }}>{eventCount} event{eventCount > 1 ? 's' : ''} for {group.ticket?.alarmType || 'Alarm'} on {group.ticket?.node || 'Node'}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>Latest: {latest.message || `Priority changed to ${latest.newPriority}`}</div>
                                </div>
                                <div className="notification-status" style={{ marginRight: '10px' }}>{group.ticket?.status || 'UNKNOWN'}</div>
                                
                                <span style={{
                                    fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', fontWeight: 600,
                                    color: isBreached ? '#991b1b' : '#166534',
                                    backgroundColor: isBreached ? '#fecaca' : '#bbf7d0',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {isBreached ? 'Breached' : 'Within SLA'}
                                </span>
                            </div>
                        );
                    })
                )}
            </div>

            {totalPages > 1 && (
                <div className="notification-pagination">
                    <button type="button" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => page - 1)}>Previous</button>
                    <span>Page {currentPage} of {totalPages}</span>
                    <button type="button" disabled={currentPage === totalPages} onClick={() => setCurrentPage((page) => page + 1)}>Next</button>
                </div>
            )}

            {modalTicketNumber && activeGroup && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={() => setModalTicketNumber(null)}>
                    <div style={{ backgroundColor: 'white', borderRadius: '8px', width: '100%', maxWidth: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Notification History: {activeGroup.ticketNumber}</h3>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={() => { onAcknowledge(activeGroup.ticketNumber); setModalTicketNumber(null); }} style={{ background: '#2563eb', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}>Acknowledge</button>
                                <button onClick={() => setModalTicketNumber(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
                            </div>
                        </div>
                        
                        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
                            {activeGroup.notifications.map((n, idx) => (
                                <div key={idx} style={{ display: 'flex', gap: '12px', marginBottom: idx < activeGroup.notifications.length - 1 ? '20px' : 0, position: 'relative' }}>
                                    {idx < activeGroup.notifications.length - 1 && <div style={{ position: 'absolute', left: '15px', top: '30px', bottom: '-20px', width: '2px', backgroundColor: '#e2e8f0' }}></div>}
                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1 }}>
                                        <Bell size={14} color="#475569" />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '4px' }}>{n.timestamp ? new Date(n.timestamp).toLocaleString() : ''}</div>
                                        <div style={{ fontWeight: 500, marginBottom: '4px' }}>
                                            {n.eventType === "PRIORITY_UPGRADE" ? <>Ticket upgraded from <strong>{n.previousPriority}</strong> to <strong>{n.newPriority}</strong></>
                                            : n.eventType === "PRIORITY_DOWNGRADE" ? <>Ticket downgraded from <strong>{n.previousPriority}</strong> to <strong>{n.newPriority}</strong></>
                                            : n.message}
                                        </div>
                                        {n.alarmType && n.node && <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{n.alarmType} on {n.node}</div>}
                                        <div style={{ marginTop: '6px' }}>
                                            <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: n.status === 'ACKNOWLEDGED' ? '#fef3c7' : '#e0f2fe', color: n.status === 'ACKNOWLEDGED' ? '#92400e' : '#0369a1' }}>{n.status}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Notifications;