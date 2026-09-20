import { X } from "lucide-react";

function CloseTicketModal({ ticket, onClose, onConfirm }) {
    if (!ticket) return null;

    return (
        <div className="modal-overlay">
            <div className="modal small-modal">
                <div className="modal-header">
                    <h2>Close Ticket</h2>
                    <button className="modal-close" type="button" onClick={onClose} aria-label="Close modal">
                        <X size={18} />
                    </button>
                </div>
                <div className="modal-body">
                    <p>
                        Are you sure you want to close <strong>{ticket.ticketNumber}</strong>?
                        This action marks the ticket as resolved.
                    </p>
                </div>
                <div className="modal-actions">
                    <button className="secondary-button" type="button" onClick={onClose}>Cancel</button>
                    <button className="danger-button" type="button" onClick={onConfirm}>Close Ticket</button>
                </div>
            </div>
        </div>
    );
}

export default CloseTicketModal;