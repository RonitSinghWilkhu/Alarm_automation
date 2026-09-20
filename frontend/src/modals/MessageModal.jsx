import { X, AlertCircle } from "lucide-react";

function MessageModal({ title, message, onClose }) {
    if (!title && !message) return null;

    return (
        <div className="modal-overlay">
            <div className="modal small-modal">
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