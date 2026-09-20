import { Ticket, Inbox, AlertTriangle, CheckCircle } from "lucide-react";

function SummaryCards({ tickets, loading }) {
    const openTickets = tickets.filter(ticket => ticket.status === "OPEN").length;
    const highImpact = tickets.filter(ticket => ticket.impactLevel === "HIGH").length;
    const closedTickets = tickets.filter(ticket => ticket.status === "CLOSED").length;
    const skeletonClass = loading ? " skeleton-card" : "";

    return (
        <section className="summary" id="dashboard">
            <div className={`summary-card accent-blue${skeletonClass}`}>
                <div className="card-top">
                    <span className="card-title">Total Tickets</span>
                    <div className="card-icon"><Ticket size={18} /></div>
                </div>
                <p className="card-value">{tickets.length}</p>
                <span className="card-foot">All time</span>
            </div>
            
            <div className={`summary-card accent-green${skeletonClass}`}>
                <div className="card-top">
                    <span className="card-title">Open Tickets</span>
                    <div className="card-icon"><Inbox size={18} /></div>
                </div>
                <p className="card-value">{openTickets}</p>
                <span className="card-foot">Requires attention</span>
            </div>
            
            <div className={`summary-card accent-red${skeletonClass}`}>
                <div className="card-top">
                    <span className="card-title">High Impact</span>
                    <div className="card-icon"><AlertTriangle size={18} /></div>
                </div>
                <p className="card-value">{highImpact}</p>
                <span className="card-foot">Critical severity</span>
            </div>
            
            <div className={`summary-card accent-slate${skeletonClass}`}>
                <div className="card-top">
                    <span className="card-title">Closed Tickets</span>
                    <div className="card-icon"><CheckCircle size={18} /></div>
                </div>
                <p className="card-value">{closedTickets}</p>
                <span className="card-foot">Resolved</span>
            </div>
        </section>
    );
}

export default SummaryCards;