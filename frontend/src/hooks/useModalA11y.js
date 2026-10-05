import { useEffect, useRef } from "react";

// Shared modal accessibility behavior:
// - Escape key closes the modal (calls onClose)
// - Focus is moved into the modal on open and trapped within it (Tab / Shift+Tab)
// Returns a ref to attach to the modal container element.
const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useModalA11y(onClose) {
    const containerRef = useRef(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // Remember the element focused before the modal opened so we can
        // restore it when the modal closes.
        const previouslyFocused = document.activeElement;

        const getFocusable = () =>
            Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
                (el) => el.offsetParent !== null || el === document.activeElement
            );

        // Move focus into the modal on open.
        const focusable = getFocusable();
        if (focusable.length > 0) {
            focusable[0].focus();
        } else {
            container.focus();
        }

        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                event.preventDefault();
                onClose?.();
                return;
            }

            if (event.key !== "Tab") return;

            const items = getFocusable();
            if (items.length === 0) {
                event.preventDefault();
                container.focus();
                return;
            }

            const first = items[0];
            const last = items[items.length - 1];
            const active = document.activeElement;

            if (event.shiftKey) {
                if (active === first || !container.contains(active)) {
                    event.preventDefault();
                    last.focus();
                }
            } else {
                if (active === last || !container.contains(active)) {
                    event.preventDefault();
                    first.focus();
                }
            }
        };

        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            if (previouslyFocused && typeof previouslyFocused.focus === "function") {
                previouslyFocused.focus();
            }
        };
    }, [onClose]);

    return containerRef;
}

export default useModalA11y;
