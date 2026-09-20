import { LogOut } from "lucide-react";

function LogoutConfirmModal({ onConfirm, onCancel }) {
    return (
        <div className="modal-overlay">
            <div className="logout-modal">
                <div className="logout-modal-icon">
                    <LogOut size={20} />
                </div>

                <h3>Do you want to log out?</h3>

                <p>
                    You will be returned to the AlarmOps login page.
                </p>

                <div className="logout-modal-actions">
                    <button
                        type="button"
                        className="logout-no-btn"
                        onClick={onCancel}
                    >
                        No
                    </button>

                    <button
                        type="button"
                        className="logout-yes-btn"
                        onClick={onConfirm}
                    >
                        Yes
                    </button>
                </div>
            </div>
        </div>
    );
}

export default LogoutConfirmModal;