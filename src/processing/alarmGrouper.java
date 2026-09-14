package processing;

import model.alarm;
import model.alarmGroup;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class alarmGrouper {

    public List<alarmGroup> groupAlarms(List<alarm> alarms) {

        Map<String, alarmGroup> groupedAlarms = new HashMap<>();

        for (alarm a : alarms) {

            String key = a.getNode() + "_" + a.getAlarmType();

            if (!groupedAlarms.containsKey(key)) {

                alarmGroup newGroup =
                        new alarmGroup(
                                a.getNode(),
                                a.getAlarmType()
                        );

                groupedAlarms.put(key, newGroup);
            }

            groupedAlarms.get(key).addAlarm(a);
        }

        return new ArrayList<>(groupedAlarms.values());
    }
}