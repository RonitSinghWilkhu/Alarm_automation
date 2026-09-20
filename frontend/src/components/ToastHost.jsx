import { CheckCircle, AlertCircle, Info, X } from "lucide-react";

function ToastHost({ toasts, onDismiss }) {
    const getIcon = (type) => {
        if (type === "success") return <CheckCircle size={16} />;
        if (type === "error") return <AlertCircle size={16} />;
        return <Info size={16} />;
    };

    return (
        <div className="toast-host" id="toastHost">
            {toasts.map(toast => (
                <div key={toast.id} className={`toast ${toast.type}`}>
                    <div className="toast-icon">
                        {getIcon(toast.type)}
                    </div>
                    <div className="toast-body">
                        <div className="toast-title">{toast.title}</div>
                        <div className="toast-msg">{toast.message}</div>
                        <div
                            className="toast-progress"
                            style={{ animationDuration: `${toast.duration || 3800}ms` }}
                        ></div>
                    </div>
                    <button
                        className="toast-close"
                        type="button"
                        onClick={() => onDismiss(toast.id)}
                        aria-label="Dismiss notification"
                    >
                        <X size={14} />
                    </button>
                </div>
            ))}
        </div>
    );
}

export default ToastHost;