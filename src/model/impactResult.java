package model;

public class impactResult {
    private String node;
    private String alarmType;
    private int occurrenceCount;
    private int usersImpacted;
    private String severity;
    private boolean thresholdBreached;
    private String impactLevel;
    private String createdAt;

    public impactResult(
        String node,
        String alarmType,
        int occurrenceCount,
        int usersImpacted,
        String severity,
        boolean thresholdBreached,
        String impactLevel,
        String createdAt
    ){
        this.node = node;
        this.alarmType = alarmType;
        this.occurrenceCount = occurrenceCount;
        this.usersImpacted = usersImpacted;
        this.severity = severity;
        this.thresholdBreached = thresholdBreached;
        this.impactLevel = impactLevel;
        this.createdAt = createdAt;
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

    public String getCreatedAt(){
        return createdAt;
    }

    @Override
    public String toString(){
        return "impactResult{" +
                "node='" + node + '\'' +
                ", alarmType='" + alarmType + '\'' +
                ", occurrenceCount=" + occurrenceCount +
                ", usersImpacted=" + usersImpacted +
                ", severity='" + severity + '\'' +
                ", thresholdBreached=" + thresholdBreached +
                ", impactLevel='" + impactLevel + '\'' +
                '}';
    }
}
