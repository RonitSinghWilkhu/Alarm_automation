import React from "react";
import {
    ShieldCheck,
    UserRound,
    CheckCircle2,
    X,
    ArrowRight,
    ShieldAlert
} from "lucide-react";

const RoleChangeModal = ({
    isOpen,
    username,
    currentRole,
    newRole,
    onConfirm,
    onCancel,
    isLoading = false,
    isSuccess = false,
    onDone
}) => {
    if (!isOpen) {
        return null;
    }

    const formattedRole = (role) =>
        role === "admin" ? "Admin" : "User";

    return (
        <div
            className="role-modal-overlay"
            onClick={
                isLoading || isSuccess
                    ? undefined
                    : onCancel
            }
        >
            <div
                className="role-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="role-modal-title"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="role-modal-header">
                    <div
                        className={`role-modal-icon ${
                            isSuccess
                                ? "role-modal-icon-success"
                                : "role-modal-icon-warning"
                        }`}
                    >
                        {isSuccess ? (
                            <CheckCircle2 size={26} />
                        ) : (
                            <ShieldAlert size={26} />
                        )}
                    </div>

                    <button
                        type="button"
                        className="role-modal-close"
                        onClick={onCancel}
                        disabled={isLoading || isSuccess}
                        aria-label="Close modal"
                    >
                        <X size={20} />
                    </button>

                    <h2 id="role-modal-title">
                        {isSuccess
                            ? "Role Updated Successfully"
                            : "Confirm Role Change"}
                    </h2>

                    <p className="role-modal-subtitle">
                        {isSuccess
                            ? "The user's access role has been updated."
                            : "Review the role change before confirming."}
                    </p>
                </div>

                {isSuccess ? (
                    <>
                        <div className="role-modal-body">
                            <div className="role-modal-success-banner">
                                <CheckCircle2 size={22} />

                                <div>
                                    <strong>Changes saved</strong>
                                    <p>
                                        {username}'s role is now{" "}
                                        <strong>
                                            {formattedRole(newRole)}
                                        </strong>.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="role-modal-actions">
                            <button
                                type="button"
                                className="role-modal-confirm"
                                onClick={onDone}
                            >
                                <CheckCircle2 size={17} />
                                Done
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="role-modal-body">
                            <div className="role-modal-user">
                                <div className="role-modal-user-icon">
                                    <UserRound size={22} />
                                </div>

                                <div className="role-modal-user-info">
                                    <span>Changing role for</span>
                                    <strong>{username}</strong>
                                </div>
                            </div>

                            <div className="role-modal-details">
                                <div className="role-modal-role-card">
                                    <span>Current role</span>

                                    <div className="role-modal-role-value">
                                        <UserRound size={17} />
                                        <strong>
                                            {formattedRole(currentRole)}
                                        </strong>
                                    </div>
                                </div>

                                <div className="role-modal-arrow">
                                    <ArrowRight size={20} />
                                </div>

                                <div className="role-modal-role-card role-modal-role-new">
                                    <span>New role</span>

                                    <div className="role-modal-role-value">
                                        <ShieldCheck size={17} />
                                        <strong>
                                            {formattedRole(newRole)}
                                        </strong>
                                    </div>
                                </div>
                            </div>

                            <div className="role-modal-notice">
                                <ShieldCheck size={17} />
                                <p>
                                    Changing a user's role may change the
                                    permissions available to their account.
                                </p>
                            </div>
                        </div>

                        <div className="role-modal-actions">
                            <button
                                type="button"
                                className="role-modal-cancel"
                                onClick={onCancel}
                                disabled={isLoading}
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                className="role-modal-confirm"
                                onClick={onConfirm}
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <span className="role-modal-spinner" />
                                        Updating...
                                    </>
                                ) : (
                                    <>
                                        <ShieldCheck size={17} />
                                        Confirm Change
                                    </>
                                )}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default RoleChangeModal;