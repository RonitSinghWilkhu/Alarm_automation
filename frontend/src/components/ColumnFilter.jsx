import { useState, useEffect, useRef } from "react";
import { ChevronDown, Check, Ticket } from "lucide-react";

function ColumnFilter({ label, field, values, value, onChange }) {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef(null);
    const buttonRef = useRef(null);

    // Close menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (
                menuRef.current && 
                !menuRef.current.contains(event.target) &&
                buttonRef.current &&
                !buttonRef.current.contains(event.target)
            ) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Get unique sorted values for this field
    const uniqueValues = field === "status"
        ? ["OPEN", "REOPENED", "CLOSED"]
        : [
            ...new Set(
                values
                    .map(ticket => ticket[field])
                    .filter(
                        v =>
                            v !== null &&
                            v !== undefined &&
                            String(v).trim() !== ""
                    ) .map(v => String(v))
            )
        ].sort(
            (a,b) =>
                a.localeCompare(b,undefined,{
                    numeric: true,
                    sensitivity: "base"
                })
        );

    return (
        <div className="column-filter-wrapper">
            <button
                ref={buttonRef}
                className={`column-filter ${value !== "ALL" ? "active" : ""} ${isOpen ? "open" : ""}`}
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                data-filter-key={field}
            >
                <span>{label}</span>
                <ChevronDown size={12} className="filter-arrow" />
            </button>
            
            {isOpen && (
                <div ref={menuRef} className="filter-menu open">
                    <button
                        type="button"
                        className={`filter-option ${value === "ALL" ? "selected" : ""}`}
                        onClick={() => { onChange(field, "ALL"); setIsOpen(false); }}
                    >
                        <span>ALL</span>
                        {value === "ALL" && <Check size={13} className="filter-option-check" />}
                    </button>
                    
                    {uniqueValues.map(val => (
                        <button
                            key={val}
                            type="button"
                            className={`filter-option ${value === val ? "selected" : ""}`}
                            onClick={() => { onChange(field, val); setIsOpen(false); }}
                        >
                            <span>{val}</span>
                            {value === val && <Check size={13} className="filter-option-check" />}
                        </button>
                    ))}
                    
                    {uniqueValues.length === 0 && (
                        <div className="filter-empty">No values found</div>
                    )}
                </div>
            )}
        </div>
    );
}

export default ColumnFilter;