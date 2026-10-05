import { X, AlertCircle } from "lucide-react";
import { useModalA11y } from "../hooks/useModalA11y";

function MessageModal({ title, message, onClose }) {
    const modalRef = useModalA11y(onClose);

    if (!title && !message) return null;

    return (
        <div className="modal-overlay">
            <div className="modal small-modal" role="dialog" aria-modal="true" tabIndex={-1} ref={modalRef}>
                <div className="modal-header">
                    <h2>{title || "Message"}</h2>
                    <button className="modal-close" type="button" onClick={onClose} aria-label="Close modal">
                        <X size={18} />
                    </button>
                </div>
                <div className="modal-body" style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                    <div style={{ flexShrink: 0, marginTop: '2px' }}>
                        <AlertCircle size={20} style={{ color: 'var(--warning)' }} />
                    </div>
                    <p style={{ margin: 0, lineHeight: '1.6' }}>{message}</p>
                </div>
                <div className="modal-actions">
                    <button className="primary-button" type="button" onClick={onClose}>OK</button>
                </div>
            </div>
        </div>
    );
}

export default MessageModal;