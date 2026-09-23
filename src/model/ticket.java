package model;

public class ticket {

    private String ticketNumber;
    private String node;
    private String alarmType;
    private int occurrenceCount;
    private int usersImpacted;
    private String severity;
    private boolean thresholdBreached;
    private String impactLevel;
    private String priority;
    private String assignedTeam;
    private String status;
    private String reason;
    private String createdAt;

    public ticket(
            String ticketNumber,
            String node,
            String alarmType,
            int occurrenceCount,
            int usersImpacted,
            String severity,
            boolean thresholdBreached,
            String impactLevel,
            String priority,
            String assignedTeam,
            String status,
            String reason,
            String createdAt) {

        this.ticketNumber = ticketNumber;
        this.node = node;
        this.alarmType = alarmType;
        this.occurrenceCount = occurrenceCount;
        this.usersImpacted = usersImpacted;
        this.severity = severity;
        this.thresholdBreached = thresholdBreached;
        this.impactLevel = impactLevel;
        this.priority = priority;
        this.assignedTeam = assignedTeam;
        this.status = status;
        this.reason = reason;
        this.createdAt = createdAt;
    }

    public String getTicketNumber() {
        return ticketNumber;
    }

    public String getNode() {
        return node;
    }

    public String getAlarmType() {
        return alarmType;
    }

    public int getOccurrenceCount() {
        return occurrenceCount;
    }

    public int getUsersImpacted() {
        return usersImpacted;
    }

    public String getSeverity() {
        return severity;
    }

    public boolean isThresholdBreached() {
        return thresholdBreached;
    }

    public String getImpactLevel() {
        return impactLevel;
    }

    public String getPriority() {
        return priority;
    }

    public String getAssignedTeam() {
        return assignedTeam;
    }

    public String getStatus() {
        return status;
    }

    public String getReason() {
        return reason;
    }

    public String getCreatedAt(){
        return createdAt;
    }

    @Override
    public String toString() {

        return "ticket{" +
                "ticketNumber='" + ticketNumber + '\'' +
                ", node='" + node + '\'' +
                ", alarmType='" + alarmType + '\'' +
                ", occurrenceCount=" + occurrenceCount +
                ", usersImpacted=" + usersImpacted +
                ", severity='" + severity + '\'' +
                ", thresholdBreached=" + thresholdBreached +
                ", impactLevel='" + impactLevel + '\'' +
                ", priority='" + priority + '\'' +
                ", assignedTeam='" + assignedTeam + '\'' +
                ", status='" + status + '\'' +
                ", reason='" + reason + '\'' +
                '}';
    }
}