import { X, Brain, Ticket, Server, AlertTriangle } from "lucide-react";
import { useModalA11y } from "../hooks/useModalA11y";

function renderInline(text, keyPrefix) {
    // Renders inline `code` spans as <code>, leaving other text as-is.
    const parts = text.split(/(`[^`]+`)/g);

    return parts.map((part, i) => {
        if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
            return (
                <code key={`${keyPrefix}-code-${i}`} className="recommendation-code">
                    {part.slice(1, -1)}
                </code>
            );
        }
        return part;
    });
}

function formatRecommendation(text) {
    if (!text) return null;

    const normalized = text.replace(/\r\n/g, "\n");

    // Split off fenced code blocks (```...```) first so their contents are
    // rendered verbatim and not treated as headings/bullets.
    const blocks = normalized.split(/(```[\s\S]*?```)/g);

    return blocks.flatMap((block, blockIndex) => {
        const fenceMatch = block.match(/^```[^\n]*\n?([\s\S]*?)```$/);

        if (fenceMatch) {
            return (
                <pre key={`fence-${blockIndex}`} className="recommendation-code-block">
                    <code>{fenceMatch[1].replace(/\n$/, "")}</code>
                </pre>
            );
        }

        if (block.trim() === "") {
            return [];
        }

        // Split a text block into sections at numbered headings like "**1. Title**"
        // or "1. Title". Leading whitespace is tolerated.
        const sections = block.split(/(?=^\s*(?:\*\*)?\d+\.\s)/m);

        return sections.map((section, index) => {
            const key = `${blockIndex}-${index}`;

            // Flexible heading match: optional "**", a number, ". ", a title,
            // and an optional closing "**".
            const headingMatch = section.match(
                /^\s*(?:\*\*)?(\d+)\.\s*(.*?)(?:\*\*)?\s*(?:\n|$)/
            );

            if (!headingMatch || headingMatch[2].trim() === "") {
                const trimmed = section.trim();
                if (trimmed === "") return null;
                return (
                    <p key={key}>
                        {renderInline(trimmed, key)}
                    </p>
                );
            }

            const number = headingMatch[1];
            const title = headingMatch[2].replace(/\*\*/g, "").trim();

            const content = section
                .substring(headingMatch[0].length)
                .trim();

            const lines = content
                .split("\n")
                .map(line => line.trim())
                .filter(Boolean);

            return (
                <div
                    key={key}
                    className="recommendation-section"
                >
                    <h3 className="recommendation-heading">
                        {number}. {title}
                    </h3>

                    {lines.map((line, lineIndex) => {
                        const lineKey = `${key}-${lineIndex}`;

                        if (line.startsWith("- ")) {
                            return (
                                <div
                                    key={lineKey}
                                    className="recommendation-bullet"
                                >
                                    <span>•</span>

                                    <span>
                                        {renderInline(line.substring(2), lineKey)}
                                    </span>
                                </div>
                            );
                        }

                        const stepMatch = line.match(
                            /^\*\*(\d+)\.\*\*\s*(.*)$/
                        );

                        if (stepMatch) {
                            return (
                                <div
                                    key={lineKey}
                                    className="recommendation-step"
                                >
                                    <span className="step-number">
                                        {stepMatch[1]}.
                                    </span>

                                    <span>
                                        {renderInline(stepMatch[2], lineKey)}
                                    </span>
                                </div>
                            );
                        }

                        return (
                            <p
                                key={lineKey}
                                className="recommendation-text"
                            >
                                {renderInline(line, lineKey)}
                            </p>
                        );
                    })}
                </div>
            );
        });
    });
}

function TroubleshootModal({ ticket, recommendation, historicalIncidents, onClose }) {
    const modalRef = useModalA11y(onClose);

    if (!ticket) return null;

    return (
        <div className="modal-overlay">
            <div className="modal" id="troubleshootModal" role="dialog" aria-modal="true" tabIndex={-1} ref={modalRef}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Brain size={18} style={{ color: '#a855f7' }} />
                        <h2>AI Troubleshooting Assistant</h2>
                    </div>
                    <button className="modal-close" type="button" onClick={onClose} aria-label="Close modal">
                        <X size={18} />
                    </button>
                </div>
                
                <div className="modal-body">
                    <div className="ts-meta">
                        <div className="ts-meta-item">
                            <span>Ticket</span>
                            <strong>{ticket.ticketNumber}</strong>
                        </div>
                        <div className="ts-meta-item">
                            <span>Node</span>
                            <strong>{ticket.node}</strong>
                        </div>
                        <div className="ts-meta-item">
                            <span>Alarm Type</span>
                            <strong>{ticket.alarmType}</strong>
                        </div>
                    </div>
                    
                    <div id="troubleshootContent">
                        {recommendation ? (
                            <div className="troubleshoot-result">
                                {formatRecommendation(recommendation)}
                            </div>
                        ) : (
                            <p>Loading troubleshooting recommendation.....</p>
                        )}
                    </div>

                    {historicalIncidents && historicalIncidents.length > 0 && (
                        <div className="historical-section">
                            <h3 className="historical-title">Historical Incidents</h3>
                            {historicalIncidents.map((incident, i) => (
                                <div key={i} className="historical-card">
                                    <div className="historical-card-header">
                                        <span className="historical-badge">Historical Incident {i + 1}</span>
                                        <span className="historical-alarm">{incident.alarmType}</span>
                                    </div>
                                    <pre className="historical-content">{incident.content}</pre>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                
                <div className="modal-actions">
                    <button className="secondary-button" type="button" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
}

export default TroubleshootModal;