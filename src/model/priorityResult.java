package model;

public class priorityResult {

    private String node;
    private String alarmType;
    private String impactLevel;
    private String priority;
    private String reason;

    public priorityResult(
            String node,
            String alarmType,
            String impactLevel,
            String priority,
            String reason) {

        this.node = node;
        this.alarmType = alarmType;
        this.impactLevel = impactLevel;
        this.priority = priority;
        this.reason = reason;
    }

    public String getNode() {
        return node;
    }

    public String getAlarmType() {
        return alarmType;
    }

    public String getImpactLevel() {
        return impactLevel;
    }

    public String getPriority() {
        return priority;
    }

    public String getReason() {
        return reason;
    }

    @Override
    public String toString() {

        return "priorityResult{" +
                "node='" + node + '\'' +
                ", alarmType='" + alarmType + '\'' +
                ", impactLevel='" + impactLevel + '\'' +
                ", priority='" + priority + '\'' +
                ", reason='" + reason + '\'' +
                '}';
    }
}