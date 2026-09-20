import { useState } from "react";
import { X } from "lucide-react";

function UpgradeModal({ ticket, onClose, onUpgrade }) {
    const [priority, setPriority] = useState("P3");

    if (!ticket) return null;

    return (
        <div className="modal-overlay">
            <div className="modal">
                <div className="modal-header">
                    <h2>Upgrade Priority</h2>
                    <button className="modal-close" type="button" onClick={onClose} aria-label="Close modal">
                        <X size={18} />
                    </button>
                </div>
                <div className="modal-body">
                    <p>Ticket: <strong>{ticket.ticketNumber}</strong></p>
                    <p>Current Priority: <strong>{ticket.priority}</strong></p>
                    <label htmlFor="newPriority">New Priority</label>
                    <select
                        id="newPriority"
                        className="priority-select"
                        value={priority}
                        onChange={event => setPriority(event.target.value)}
                    >
                        <option value="P3">P3 — Low</option>
                        <option value="P2">P2 — Medium</option>
                        <option value="P1">P1 — High</option>
                    </select>
                </div>
                <div className="modal-actions">
                    <button className="secondary-button" type="button" onClick={onClose}>Cancel</button>
                    <button className="primary-button" type="button" onClick={() => onUpgrade(priority)}>Upgrade Ticket</button>
                </div>
            </div>
        </div>
    );
}

export default UpgradeModal;