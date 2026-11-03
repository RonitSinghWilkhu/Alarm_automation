import { useMemo, useState } from "react";
import { Search, BrainCircuit, FileSearch } from "lucide-react";

function AIRca({
    tickets,
    rcaResult,
    rcaLoading,
    rcaError,
    onAnalyse
}) {
    const [ticketSearch, setTicketSearch] = useState("");
    const [selectedAlarmType, setSelectedAlarmType] = useState("ALL");
    const [selectedTicketNumber, setSelectedTicketNumber] = useState("");

    const eligibleTickets = useMemo(() => {
        return tickets.filter((ticket) => {
            const status = String(ticket.status || "").toUpperCase();
            const priority = String(ticket.priority || "").toUpperCase();

            return status === "CLOSED" &&
                    ["P1" , "P2"].includes(priority);
        });
    }, [tickets]);

    return (
        <section className="ai-rca-page">
            <div className="ai-rca-header">
                <div>
                    <h2>AI Root Cause Analysis</h2>
                    <p>
                        Investigate network alarms and generate a structured
                        root cause analysis report.
                    </p>
                </div>
            </div>

            <div className="ai-rca-search-panel">
                <div className="ai-rca-field">
                    <label htmlFor="rca-ticket-search">
                        Search Ticket Number
                    </label>

                    <div className="ai-rca-input-wrapper">
                        <Search size={18} />

                        <input
                            id="rca-ticket-search"
                            type="text"
                            placeholder="Enter ticket number..."
                            value={ticketSearch}
                            onChange={(event) => {
                                setTicketSearch(event.target.value);
                                setSelectedTicketNumber("");
                            }}
                        />
                    </div>
                </div>

                <div className="ai-rca-field">
                    <label htmlFor="rca-alarm-type">
                        Alarm Type
                    </label>

                    <select
                        id="rca-alarm-type"
                        value={selectedAlarmType}
                        onChange={(event) => {
                            setSelectedAlarmType(event.target.value);
                            setSelectedTicketNumber("");
                            setTicketSearch("");
                        }}
                    >
                        <option value="ALL">All Alarm Types</option>

                        {[...new Set(
                            tickets
                                .map((ticket) => ticket.alarmType)
                                .filter(Boolean)
                        )]
                            .sort()
                            .map((alarmType) => (
                                <option key={alarmType} value={alarmType}>
                                    {alarmType}
                                </option>
                            ))}
                    </select>
                </div>

                <div className="ai-rca-field">
                    <label htmlFor="rca-ticket-select">
                        Select Existing Ticket
                    </label>

                    <select
                        id="rca-ticket-select"
                        value={selectedTicketNumber}
                        onChange={(event) => {
                            const ticketNumber = event.target.value;

                            setSelectedTicketNumber(ticketNumber);
                            setTicketSearch(ticketNumber);
                        }}
                    >
                        <option value="">Select a ticket...</option>

                        {eligibleTickets
                            .filter((ticket) => {
                                const matchesAlarmType =
                                    selectedAlarmType === "ALL" ||
                                    ticket.alarmType === selectedAlarmType;

                                const matchesSearch =
                                    !ticketSearch ||
                                    String(ticket.ticketNumber || "")
                                        .toLowerCase()
                                        .includes(ticketSearch.toLowerCase());

                                return matchesAlarmType && matchesSearch;
                            })
                            .map((ticket) => (
                                <option
                                    key={ticket.ticketNumber}
                                    value={ticket.ticketNumber}
                                >
                                    {ticket.ticketNumber}
                                    {" — "}
                                    {ticket.alarmType || "Unknown Alarm"}
                                </option>
                            ))}
                    </select>
                </div>

                <button
                    type="button"
                    className="ai-rca-analyze-button"
                    disabled={
                        rcaLoading ||
                        !eligibleTickets.some(
                            (ticket) =>
                                String(ticket.ticketNumber || "").toLowerCase() ===
                                (selectedTicketNumber || ticketSearch.trim()).toLowerCase()

                        )
                    }
                    onClick={() => {
                        const ticketNumber =
                            selectedTicketNumber || ticketSearch.trim();

                        const ticket = eligibleTickets.find(
                            (item) =>
                                String(item.ticketNumber || "").toLowerCase() ===
                                ticketNumber.toLowerCase()
                        );

                        if (ticket) {
                            onAnalyse(ticket.ticketNumber);
                        }
                    }}
                >
                    <BrainCircuit size={18} />

                    {rcaLoading
                        ? "Analyzing..."
                        : "Analyze Root Cause"}
                </button>

            </div>

            {rcaError && (
                <div className="ai-rca-error">
                    {rcaError}
                </div>
            )}

            {rcaResult && (
                <div className="ai-rca-report">
                    <div className="ai-rca-report-header">
                        <div>
                            <h2>Root Cause Analysis Report</h2>
                            <p>
                                Ticket: {rcaResult.ticketNumber || "N/A"}
                                {" | "}
                                Alarm: {rcaResult.alarmType || "N/A"}
                            </p>
                        </div>

                        <span
                            className={`ai-rca-status ${
                                rcaResult.status === "probable_cause_identified"
                                    ? "identified"
                                    : "insufficient"
                            }`}
                        >
                            {(rcaResult.status || "unknown")
                                .replaceAll("_", " ")}
                        </span>
                    </div>

                    <section className="ai-rca-report-section">
                        <h3>RCA Summary</h3>
                        <p>
                            {rcaResult.summary ||
                                rcaResult.message ||
                                "No summary was provided."}
                        </p>
                    </section>

                    <section className="ai-rca-report-section">
                        <h3>Recorded Resolution Details</h3>

                        {rcaResult.recordedResolution ? (
                            <>
                                <p>
                                    <strong>Recorded Root Cause:</strong>{" "}
                                    {rcaResult.recordedResolution.rootCause ||
                                        "Not documented"}
                                </p>

                                <p>
                                    <strong>Actions Taken:</strong>{" "}
                                    {rcaResult.recordedResolution.actionsTaken ||
                                        "Not documented"}
                                </p>

                                <p>
                                    <strong>Resolution:</strong>{" "}
                                    {rcaResult.recordedResolution.resolution ||
                                        "Not documented"}
                                </p>

                                <p>
                                    <strong>Verification Results:</strong>{" "}
                                    {rcaResult.recordedResolution.verificationResults ||
                                        "Not documented"}
                                </p>

                                <p>
                                    <strong>Shell Commands Used:</strong>
                                </p>
                                {rcaResult.recordedResolution.shellCommandsUsed ? (
                                    <pre style={{ whiteSpace: "pre-wrap" }}>
                                        {rcaResult.recordedResolution.shellCommandsUsed}
                                    </pre>
                                ) : (
                                    <p>Not documented</p>
                                )}

                                <p>
                                    <strong>Shell Script Used:</strong>
                                </p>
                                {rcaResult.recordedResolution.shellScriptUsed ? (
                                    <pre style={{ whiteSpace: "pre-wrap" }}>
                                        {rcaResult.recordedResolution.shellScriptUsed}
                                    </pre>
                                ) : (
                                    <p>Not documented</p>
                                )}

                                <p>
                                    <strong>Escalation:</strong>{" "}
                                    {rcaResult.recordedResolution.escalation ||
                                        "Not documented"}
                                </p>

                                <p>
                                    <strong>Additional Notes:</strong>{" "}
                                    {rcaResult.recordedResolution.additionalNotes ||
                                        "Not documented"}
                                </p>
                            </>
                        ) : (
                            <p>No recorded resolution details are available.</p>
                        )}
                    </section>

                    <section className="ai-rca-report-section">
                        <h3>Probable Root Cause</h3>
                        <p>
                            {rcaResult.probableRootCause ||
                                "A probable root cause could not be established from the available evidence."}
                        </p>

                        <p>
                            <strong>Confidence:</strong>{" "}
                            {rcaResult.confidence || "N/A"}
                        </p>
                    </section>

                    <section className="ai-rca-report-section">
                        <h3>Supporting Evidence</h3>

                        {rcaResult.supportingEvidence?.length > 0 ? (
                            <ul>
                                {rcaResult.supportingEvidence.map(
                                    (item, index) => (
                                        <li key={index}>
                                            <strong>Source:</strong>{" "}
                                            {item.source || "N/A"}
                                            <br />

                                            <strong>Evidence:</strong>{" "}
                                            {item.evidence || "N/A"}
                                            <br />

                                            <strong>Relevance:</strong>{" "}
                                            {item.relevance || "N/A"}
                                        </li>
                                    )
                                )}
                            </ul>
                        ) : (
                            <p>No supporting evidence was returned.</p>
                        )}
                    </section>

                    <section className="ai-rca-report-section">
                        <h3>Alternative Hypotheses</h3>

                        {rcaResult.alternativeHypotheses?.length > 0 ? (
                            <ul>
                                {rcaResult.alternativeHypotheses.map(
                                    (item, index) => (
                                        <li key={index}>
                                            <strong>
                                                {item.hypothesis || "Hypothesis"}
                                            </strong>
                                            <p>{item.evidence || "No evidence provided."}</p>
                                        </li>
                                    )
                                )}
                            </ul>
                        ) : (
                            <p>No alternative hypotheses were returned.</p>
                        )}
                    </section>

                    <section className="ai-rca-report-section">
                        <h3>Evidence Gaps</h3>

                        {rcaResult.evidenceGaps?.length > 0 ? (
                            <ul>
                                {rcaResult.evidenceGaps.map((gap, index) => (
                                    <li key={index}>{gap}</li>
                                ))}
                            </ul>
                        ) : (
                            <p>No evidence gaps were reported.</p>
                        )}
                    </section>

                    <section className="ai-rca-report-section">
                        <h3>Recommended Validation</h3>

                        {rcaResult.recommendedValidation?.length > 0 ? (
                            <ul>
                                {rcaResult.recommendedValidation.map(
                                    (item, index) => (
                                        <li key={index}>
                                            <strong>{item.check || "Validation check"}</strong>
                                            <p>{item.purpose || "Purpose not provided."}</p>
                                        </li>
                                    )
                                )}
                            </ul>
                        ) : (
                            <p>No evidence-supported validation checks were returned.</p>
                        )}
                    </section>

                    <section className="ai-rca-report-section">
                        <h3>Historical Incidents</h3>

                        {rcaResult.historicalIncidents?.length > 0 ? (
                            <ul>
                                {rcaResult.historicalIncidents.map(
                                    (incident, index) => (
                                        <li key={index}>
                                            <strong>Incident ID:</strong>{" "}
                                            {incident.id || "N/A"}
                                            <br />

                                            <strong>Alarm Type:</strong>{" "}
                                            {incident.alarmType || "N/A"}
                                            <pre style={{whiteSpace: "pre-wrap"}}>{incident.content || "No incident details available."}</pre>
                                        </li>
                                    )
                                )}
                            </ul>
                        ) : (
                            <p>No historical incidents were returned.</p>
                        )}
                    </section>

                    <section className="ai-rca-report-section">
                        <h3>Related Tickets</h3>

                        {rcaResult.relatedTickets?.length > 0 ? (
                            <div className="ai-rca-table-wrapper">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Ticket</th>
                                            <th>Node</th>
                                            <th>Alarm Type</th>
                                            <th>Severity</th>
                                            <th>Status</th>
                                            <th>Priority</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {rcaResult.relatedTickets.map(
                                            (ticket, index) => (
                                                <tr key={ticket.ticketNumber || index}>
                                                    <td>{ticket.ticketNumber || "N/A"}</td>
                                                    <td>{ticket.node || "N/A"}</td>
                                                    <td>{ticket.alarmType || "N/A"}</td>
                                                    <td>{ticket.severity || "N/A"}</td>
                                                    <td>{ticket.status || "N/A"}</td>
                                                    <td>{ticket.priority || "N/A"}</td>
                                                </tr>
                                            )
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p>No related tickets were found.</p>
                        )}
                    </section>

                    <section className="ai-rca-report-section">
                        <h3>Correlation Findings</h3>

                        <p className="ai-rca-correlation-note">
                            Correlation indicates an observed relationship in
                            timing or node information. It does not establish
                            that one alarm caused another.
                        </p>

                        {rcaResult.correlationFindings?.length > 0 ? (
                            <ul>
                                {rcaResult.correlationFindings.map(
                                    (finding, index) => (
                                        <li key={index}>
                                            <p>{finding.finding || "No finding description provided."}</p>

                                            <p>
                                                <strong>Observed alarm types:</strong>{" "}
                                                {finding.observedAlarmTypes?.join(", ") || "N/A"}
                                            </p>

                                            <p>
                                                <strong>Observed nodes:</strong>{" "}
                                                {finding.observedNodes?.join(", ") || "N/A"}
                                            </p>

                                            <p>
                                                <strong>Time span:</strong>{" "}
                                                {finding.timeSpanMinutes ?? "N/A"} minutes
                                            </p>

                                            <p>
                                                <strong>Correlation window:</strong>{" "}
                                                {finding.correlationWindowMinutes ?? "N/A"} minutes
                                            </p>

                                            <p>
                                                <strong>Causation established:</strong>{" "}
                                                {finding.causationEstablished === true
                                                    ? "Yes"
                                                    : "No"}
                                            </p>
                                        </li>
                                    )
                                )}
                            </ul>
                        ) : (
                            <p>No correlation findings were returned.</p>
                        )}
                    </section>
                </div>
            )}
        </section>
    );
}

export default AIRca;