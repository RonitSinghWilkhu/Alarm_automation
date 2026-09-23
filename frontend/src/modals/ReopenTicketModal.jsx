import { useState } from "react";
import { X, RotateCcw } from "lucide-react";


function ReopenTicketModal({ ticket, onClose, onContinue }) {

    const [priority, setPriority] = useState(ticket?.priority || "P3");

    const [reason, setReason] = useState("");

    const [customReason, setCustomReason] = useState("");


    if (!ticket) return null;


    const isOtherReason = reason === "Other";

    const finalReason = isOtherReason
        ? customReason.trim()
        : reason;


    const canContinue =
        priority !== "" &&
        reason !== "" &&
        (!isOtherReason || customReason.trim() !== "");


    const handleContinue = () => {

        if (!canContinue) {
            return;
        }

        onContinue({
            priority,
            reason: finalReason
        });
    };


    return (
        <div className="modal-overlay">

            <div className="modal small-modal">

                <div className="modal-header">

                    <div>

                        <h2>Reopen Ticket</h2>

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
                        Reopen this ticket by selecting the new priority
                        and providing a reason.
                    </p>


                    <div className="reopen-form">

                        <div className="reopen-field">

                            <label htmlFor="reopen-priority">
                                Priority
                            </label>

                            <select
                                id="reopen-priority"
                                value={priority}
                                onChange={(event) =>
                                    setPriority(event.target.value)
                                }
                            >
                                <option value="P1">P1</option>
                                <option value="P2">P2</option>
                                <option value="P3">P3</option>
                                <option value="P4">P4</option>
                            </select>

                        </div>


                        <div className="reopen-field">

                            <label htmlFor="reopen-reason">
                                Reopen Reason
                            </label>

                            <select
                                id="reopen-reason"
                                value={reason}
                                onChange={(event) => {
                                    setReason(event.target.value);

                                    if (event.target.value !== "Other") {
                                        setCustomReason("");
                                    }
                                }}
                            >

                                <option value="">
                                    Select a reason
                                </option>

                                <option value="Customer still impacted">
                                    Customer still impacted
                                </option>

                                <option value="Issue not fully resolved">
                                    Issue not fully resolved
                                </option>

                                <option value="Issue reoccurred">
                                    Issue reoccurred
                                </option>

                                <option value="Additional investigation required">
                                    Additional investigation required
                                </option>

                                <option value="Incorrectly closed">
                                    Incorrectly closed
                                </option>

                                <option value="Other">
                                    Other
                                </option>

                            </select>

                        </div>


                        {isOtherReason && (

                            <div className="reopen-field">

                                <label htmlFor="reopen-custom-reason">
                                    Custom Reason
                                </label>

                                <textarea
                                    id="reopen-custom-reason"
                                    value={customReason}
                                    onChange={(event) =>
                                        setCustomReason(event.target.value)
                                    }
                                    placeholder="Enter the reason for reopening..."
                                    rows={3}
                                />

                                {customReason.trim() === "" && (
                                    <span className="reopen-field-error">
                                        Please enter a reason.
                                    </span>
                                )}

                            </div>

                        )}

                    </div>

                </div>


                <div className="modal-actions">

                    <button
                        className="secondary-button"
                        type="button"
                        onClick={onClose}
                    >
                        Cancel
                    </button>


                    <button
                        className="primary-button"
                        type="button"
                        disabled={!canContinue}
                        onClick={handleContinue}
                    >
                        Continue
                    </button>

                </div>

            </div>

        </div>
    );
}


export default ReopenTicketModal;