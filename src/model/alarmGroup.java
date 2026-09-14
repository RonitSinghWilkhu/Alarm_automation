package model;

import java.util.ArrayList;
import java.util.List;

public class alarmGroup {
    private String node;
    private String alarmType;
    private List<alarm> alarms;

    public alarmGroup(String node , String alarmType){
        this.node = node;
        this.alarmType = alarmType;
        this.alarms = new ArrayList<>();
    }

    public void addAlarm(alarm a){
        alarms.add(a);
    }

    public String getNode(){
        return node;
    }

    public String getAlarmType(){
        return alarmType;
    }

    public List<alarm> getAlarms(){
        return alarms;
    }

    public int getOccurrenceCount(){
        return alarms.size();
    }

    @Override
    public String toString(){

        return "alarmGroup{" +
                "node='" + node + '\'' +
                ", alarmType='" + alarmType + '\'' +
                ", occurrenceCount=" + alarms.size() +
                '}';
    }

}


