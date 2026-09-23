import TicketRow from "./TicketRow";
import ColumnFilter from "./ColumnFilter";
import { Inbox } from "lucide-react";

function TicketTable({ 
    tickets, 
    allTickets, 
    notifications,
    loading, 
    columnFilters, 
    onColumnFilterChange, 
    onDetails, 
    onUpgrade, 
    onTroubleshoot, 
    onClose,
    onReopen
}) {

    const statusFilterTickets = allTickets.map(ticket => ({
        ...ticket,
        status: ticket.reopenedAt
            ? "REQUIRED"
            : ticket.status
    }));

    return (
        <div className="panel">
            <div className="panel-header">
                <div className="panel-title">
                    <h2>Active Tickets</h2>
                    <p>Manage, prioritize and resolve network alarms</p>
                </div>
                <div className="segmented">
                    <button 
                        className={`seg ${columnFilters.status === "ALL" ? "active" : ""}`} 
                        onClick={() => onColumnFilterChange("status", "ALL")}
                    >
                        All Tickets
                    </button>
                    <button 
                        className={`seg ${columnFilters.status === "OPEN" ? "active" : ""}`} 
                        onClick={() => onColumnFilterChange("status", "OPEN")}
                    >
                        Open
                    </button>
                    <button 
                        className={`seg ${columnFilters.status === "CLOSED" ? "active" : ""}`} 
                        onClick={() => onColumnFilterChange("status", "CLOSED")}
                    >
                        Closed
                    </button>
                </div>
            </div>
            
            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Ticket</th>
                            <th>
                                <ColumnFilter label="Node" field="node" values={allTickets} value={columnFilters.node} onChange={onColumnFilterChange} />
                            </th>
                            <th>
                                <ColumnFilter label="Alarm Type" field="alarmType" values={allTickets} value={columnFilters.alarmType} onChange={onColumnFilterChange} />
                            </th>
                            <th>
                                <ColumnFilter label="Severity" field="severity" values={allTickets} value={columnFilters.severity} onChange={onColumnFilterChange} />
                            </th>
                            <th>
                                <ColumnFilter label="Impact" field="impactLevel" values={allTickets} value={columnFilters.impactLevel} onChange={onColumnFilterChange} />
                            </th>
                            <th>
                                <ColumnFilter label="Priority" field="priority" values={allTickets} value={columnFilters.priority} onChange={onColumnFilterChange} />
                            </th>
                            <th>
                                <ColumnFilter label="Team" field="assignedTeam" values={allTickets} value={columnFilters.assignedTeam} onChange={onColumnFilterChange} />
                            </th>
                            <th>
                                <ColumnFilter label="Status" field="status" values={statusFilterTickets} value={columnFilters.status} onChange={onColumnFilterChange} />
                            </th>
                            <th className="col-actions">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            Array.from({ length: 6 }).map((_, i) => (
                                <tr className="skeleton-row" key={`skeleton-${i}`}>
                                    <td><div className="skeleton short"></div></td>
                                    <td><div className="skeleton"></div></td>
                                    <td><div className="skeleton"></div></td>
                                    <td><div className="skeleton pill"></div></td>
                                    <td><div className="skeleton pill"></div></td>
                                    <td><div className="skeleton pill"></div></td>
                                    <td><div className="skeleton"></div></td>
                                    <td><div className="skeleton pill"></div></td>
                                    <td><div className="skeleton short"></div></td>
                                </tr>
                            ))
                        ) : tickets.length === 0 ? (
                            <tr>
                                <td colSpan="9">
                                    <div className="empty-state">
                                        <Inbox size={46} />
                                        <h3>No tickets found</h3>
                                        <p>There are no tickets matching your current filter or search.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            tickets.map(ticket => (
                                <TicketRow
                                    key={ticket.ticketNumber}
                                    ticket={ticket}
                                    notifications={notifications}
                                    onDetails={onDetails}
                                    onUpgrade={onUpgrade}
                                    onTroubleshoot={onTroubleshoot}
                                    onClose={onClose}
                                    onReopen={onReopen}
                                />
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default TicketTable;