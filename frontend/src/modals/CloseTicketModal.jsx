import { useState } from "react";
import { X } from "lucide-react";
import { useModalA11y } from "../hooks/useModalA11y";

const INITIAL_RESOLUTION = {
    observedSymptoms: "",
    rootCause: "",
    actionsTaken: "",
    shellCommandsUsed: "",
    shellScriptUsed: "",
    resolution: "",
    verificationResults: "",
    escalation: "",
    additionalNotes: "",
};

function CloseTicketModal({ ticket, onClose, onConfirm }) {
    const modalRef = useModalA11y(onClose);
    const [showQuestionnaire, setShowQuestionnaire] = useState(false);
    const [resolutionData, setResolutionData] = useState(INITIAL_RESOLUTION);

    if (!ticket) return null;

    const handleFieldChange = (event) => {
        const { name, value } = event.target;

        setResolutionData((previous) => ({
            ...previous,
            [name]: value,
        }));
    };

    const handleConfirm = () => {
        if (showQuestionnaire) {
            onConfirm(resolutionData);
        } else {
            onConfirm();
        }
    };

    const fields = [
        {
            name: "observedSymptoms",
            label: "Observed Symptoms",
            placeholder: "What symptoms were observed?",
        },
        {
            name: "rootCause",
            label: "Root Cause",
            placeholder: "What caused the issue?",
        },
        {
            name: "actionsTaken",
            label: "Actions Taken",
            placeholder: "What troubleshooting or recovery actions were performed?",
        },
        {
            name: "shellCommandsUsed",
            label: "Shell Commands Used",
            placeholder: "List commands used, if any.",
        },
        {
            name: "shellScriptUsed",
            label: "Shell Script Used",
            placeholder: "Describe or paste the script used, if any.",
        },
        {
            name: "resolution",
            label: "Resolution",
            placeholder: "How was the ticket resolved?",
        },
        {
            name: "verificationResults",
            label: "Verification Results",
            placeholder: "How was the resolution verified?",
        },
        {
            name: "escalation",
            label: "Escalation Details",
            placeholder: "Was the issue escalated? To whom and why?",
        },
        {
            name: "additionalNotes",
            label: "Additional Notes",
            placeholder: "Any other relevant details.",
        },
    ];

    return (
        <div className="modal-overlay">
            <div
                className="modal small-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="close-ticket-title"
                tabIndex={-1}
                ref={modalRef}
            >
                <div className="modal-header">
                    <h2 id="close-ticket-title">Close Ticket</h2>
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
                    <p>
                        Are you sure you want to close{" "}
                        <strong>{ticket.ticketNumber}</strong>?
                        This action marks the ticket as resolved.
                    </p>

                    {!showQuestionnaire ? (
                        <div className="modal-actions">
                            <button
                                className="secondary-button"
                                type="button"
                                onClick={onClose}
                            >
                                Cancel
                            </button>
                            <button
                                className="secondary-button"
                                type="button"
                                onClick={() => setShowQuestionnaire(true)}
                            >
                                Add Resolution Details
                            </button>
                            <button
                                className="danger-button"
                                type="button"
                                onClick={handleConfirm}
                            >
                                Skip & Close Ticket
                            </button>
                        </div>
                    ) : (
                        <>
                            <p>
                                Record the resolution details for future
                                troubleshooting. All fields are optional.
                            </p>

                            <div className="resolution-questionnaire">
                                {fields.map((field) => (
                                    <div
                                        className="form-group"
                                        key={field.name}
                                    >
                                        <label htmlFor={field.name}>
                                            {field.label}
                                        </label>
                                        <textarea
                                            id={field.name}
                                            name={field.name}
                                            value={resolutionData[field.name]}
                                            onChange={handleFieldChange}
                                            placeholder={field.placeholder}
                                            rows={3}
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className="modal-actions">
                                <button
                                    className="secondary-button"
                                    type="button"
                                    onClick={() => setShowQuestionnaire(false)}
                                >
                                    Back
                                </button>
                                <button
                                    className="danger-button"
                                    type="button"
                                    onClick={handleConfirm}
                                >
                                    Save Details & Close Ticket
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default CloseTicketModal;