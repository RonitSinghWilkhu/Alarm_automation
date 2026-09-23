import { X, RotateCcw } from "lucide-react";


function ConfirmReopenModal({
    ticket,
    priority,
    reason,
    onClose,
    onConfirm
}) {

    if (!ticket) {
        return null;
    }


    return (
        <div className="modal-overlay">

            <div className="modal small-modal">

                <div className="modal-header">

                    <div>

                        <h2>Confirm Reopen</h2>

                        <p className="modal-subtitle">
                            {ticket.ticketNumber}
                        </p>

                    </div>


                    <button
                        className="modal-close"
                        type="button"
                        onClick={onClose}
                        aria-label="Close modal"
                    >
                        <X size={18} />
                    </button>

                </div>


                <div className="modal-body">

                    <div className="reopen-modal-icon">
                        <RotateCcw size={20} />
                    </div>


                    <p className="reopen-description">
                        Please review the reopening details before reopening
                        this ticket.
                    </p>


                    <div className="reopen-confirm-details">

                        <div className="reopen-confirm-row">

                            <span className="reopen-confirm-label">
                                Ticket
                            </span>

                            <strong>
                                {ticket.ticketNumber}
                            </strong>

                        </div>


                        <div className="reopen-confirm-row">

                            <span className="reopen-confirm-label">
                                New Priority
                            </span>

                            <strong>
                                {priority}
                            </strong>

                        </div>


                        <div className="reopen-confirm-row">

                            <span className="reopen-confirm-label">
                                Reason
                            </span>

                            <strong>
                                {reason}
                            </strong>

                        </div>

                    </div>

                </div>


                <div className="modal-actions">

                    <button
                        className="secondary-button"
                        type="button"
                        onClick={onClose}
                    >
                        Back
                    </button>


                    <button
                        className="primary-button"
                        type="button"
                        onClick={onConfirm}
                    >
                        Confirm Reopen
                    </button>

                </div>

            </div>

        </div>
    );
}


export default ConfirmReopenModal;