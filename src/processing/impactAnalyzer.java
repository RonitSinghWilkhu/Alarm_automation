package processing;

import model.alarm;
import model.alarmGroup;
import model.impactResult;

import java.util.ArrayList;
import java.util.List;

public class impactAnalyzer {

    public List<impactResult> analyze(List<alarmGroup> groups) {

        List<impactResult> results = new ArrayList<>();

        for (alarmGroup group : groups) {

            int occurrenceCount = group.getOccurrenceCount();

            int usersImpacted = 0;

            String severity = "Minor";

            boolean thresholdBreached = false;

            for (alarm a : group.getAlarms()) {

                usersImpacted = Math.max(
                        usersImpacted,
                        a.getUsersImpacted()
                );

                severity = getHigherSeverity(
                        severity,
                        a.getSeverity()
                );

                if (a.getActualValue() > a.getThreshold()) {
                    thresholdBreached = true;
                }
            }

            String impactLevel = determineImpact(
                    occurrenceCount,
                    usersImpacted,
                    severity,
                    thresholdBreached
            );

            impactResult result = new impactResult(
                    group.getNode(),
                    group.getAlarmType(),
                    occurrenceCount,
                    usersImpacted,
                    severity,
                    thresholdBreached,
                    impactLevel
            );

            results.add(result);
        }

        return results;
    }

    private String determineImpact(
            int occurrenceCount,
            int usersImpacted,
            String severity,
            boolean thresholdBreached) {

        if (usersImpacted >= 1000) {
            return "HIGH";
        }

        if (usersImpacted >= 100 && occurrenceCount >=2) {
            return "HIGH";
        }

        if (usersImpacted >= 100) {
            return "MEDIUM";
        }

        if(occurrenceCount >=3){
            return "MEDIUM";
        }

        if (thresholdBreached) {
            return "LOW";
        }

        return "LOW";
    }

    private String getHigherSeverity(
            String current,
            String newSeverity) {

        int currentLevel = severityValue(current);

        int newLevel = severityValue(newSeverity);

        if (newLevel > currentLevel) {
            return newSeverity;
        }

        return current;
    }

    private int severityValue(String severity) {

        switch (severity) {

            case "Critical":
                return 3;

            case "Major":
                return 2;

            case "Minor":
                return 1;

            default:
                return 0;
        }
    }
}