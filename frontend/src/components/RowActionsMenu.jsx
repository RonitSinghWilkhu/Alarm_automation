import { useState, useRef, useEffect } from "react";
import { MoreVertical, Eye, ArrowUp, Brain, CheckCircle } from "lucide-react";

// Reusable kebab (three-dot) actions menu for a ticket row.
// It does NOT contain any action/backend logic of its own; it simply
// invokes the exact existing handlers passed down as props.
function RowActionsMenu({ ticket, isClosed, onDetails, onUpgrade, onTroubleshoot, onClose, onReopen }) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    // Click-outside + Escape-key close handling (only while open).
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen]);

    // Run the existing handler, then close the menu.
    const runAction = (handler) => {
        setIsOpen(false);
        handler(ticket);
    };

    return (
        <div className="row-actions-menu" ref={containerRef}>
            <button
                type="button"
                className="kebab-btn"
                aria-label="Ticket actions"
                aria-haspopup="menu"
                aria-expanded={isOpen}
                onClick={() => setIsOpen(prev => !prev)}
            >
                <MoreVertical size={16} />
            </button>

            {isOpen && (
                <div className="row-menu" role="menu">
                    <button
                        type="button"
                        className="row-menu-item"
                        role="menuitem"
                        onClick={() => runAction(onDetails)}
                    >
                        <Eye size={14} />
                        <span>Details</span>
                    </button>

                    {isClosed ? (
                        
                        <>

                            <button
                                type="button"
                                className="row-menu-item"
                                role="menuitem"
                                onClick={() => runAction(onReopen)}
                            >
                                <CheckCircle size={14} />
                                <span>Reopen</span>
                            </button>
                        </>

                    ) : (

                        <>
                            <button
                                type="button"
                                className="row-menu-item"
                                role="menuitem"
                                onClick={() => runAction(onUpgrade)}
                            >
                                <ArrowUp size={14} />
                                <span>Upgrade</span>
                            </button>

                            <button
                                type="button"
                                className="row-menu-item"
                                role="menuitem"
                                onClick={() => runAction(onTroubleshoot)}
                            >
                                <Brain size={14} />
                                <span>AI</span>
                            </button>

                            <div className="row-menu-divider" role="separator"></div>

                            <button
                                type="button"
                                className="row-menu-item danger"
                                role="menuitem"
                                onClick={() => runAction(onClose)}
                            >
                                <CheckCircle size={14} />
                                <span>Close</span>
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

export default RowActionsMenu;
