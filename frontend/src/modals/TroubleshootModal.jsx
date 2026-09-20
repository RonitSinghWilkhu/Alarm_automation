import { X, Brain, Ticket, Server, AlertTriangle } from "lucide-react";

function formatRecommendation(text) {
    if (!text) return null;

    const sections = text
        .replace(/\r\n/g, "\n")
        .split(/(?=\*\*\d+\.\s)/);

    return sections.map((section, index) => {
        const headingMatch = section.match(
            /^\*\*(\d+)\.\s*(.*?)\*\*/
        );

        if (!headingMatch) {
            return (
                <p key={index}>
                    {section.trim()}
                </p>
            );
        }

        const number = headingMatch[1];
        const title = headingMatch[2];

        const content = section
            .substring(headingMatch[0].length)
            .trim();

        const lines = content
            .split("\n")
            .map(line => line.trim())
            .filter(Boolean);

        return (
            <div
                key={index}
                className="recommendation-section"
            >
                <h3 className="recommendation-heading">
                    {number}. {title}
                </h3>

                {lines.map((line, lineIndex) => {
                    if (line.startsWith("- ")) {
                        return (
                            <div
                                key={lineIndex}
                                className="recommendation-bullet"
                            >
                                <span>•</span>

                                <span>
                                    {line.substring(2)}
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
                                key={lineIndex}
                                className="recommendation-step"
                            >
                                <span className="step-number">
                                    {stepMatch[1]}.
                                </span>

                                <span>
                                    {stepMatch[2]}
                                </span>
                            </div>
                        );
                    }

                    return (
                        <p
                            key={lineIndex}
                            className="recommendation-text"
                        >
                            {line}
                        </p>
                    );
                })}
            </div>
        );
    });
}

function TroubleshootModal({ ticket, recommendation, historicalIncidents, onClose }) {
    if (!ticket) return null;

    return (
        <div className="modal-overlay">
            <div className="modal" id="troubleshootModal">
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