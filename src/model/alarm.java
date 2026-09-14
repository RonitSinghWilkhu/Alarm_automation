package model;

public class alarm {

    private String alarmId;
    private String node;
    private String alarmType;
    private String description;
    private String severity;
    private double threshold;
    private double actualValue;
    private int usersImpacted;
    private String timestamp;

    public alarm(
        String alarmId,
        String node,
        String alarmType,
        String description,
        String severity,
        double threshold,
        double actualValue,
        int usersImpacted,
        String timestamp
    ) {
        this.alarmId = alarmId;
        this.node = node;
        this.alarmType = alarmType;
        this.description = description;
        this.severity = severity;
        this.threshold = threshold;
        this.actualValue = actualValue;
        this.usersImpacted = usersImpacted;
        this.timestamp = timestamp;
    }

    public String getAlarmId(){
        return alarmId;
    }

    public String getNode(){
        return node;
    }

    public String getAlarmType(){
        return alarmType;
    }

    public String getDescription(){
        return description;
    }

    public String getSeverity(){
        return severity;
    }

    public double getThreshold(){
        return threshold;
    }

    public double getActualValue(){
        return actualValue;
    }

    public int getUsersImpacted(){
        return usersImpacted;
    }

    public String getTimestamp(){
        return timestamp;
    }

    @Override
    public String toString(){
        return "Alarm{" +
               "alarmId='" + alarmId + '\'' +
               ", node='" + node + '\'' +
               ", alarmType='" + alarmType + '\'' +
               ", severity='" + severity + '\'' +
               ", usersImpacted=" + usersImpacted +
               ", timestamp='" + timestamp + '\'' +
               '}';
    }
}
