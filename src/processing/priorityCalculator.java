package processing;

import model.impactResult;
import model.priorityResult;

import java.util.ArrayList;
import java.util.List;

public class priorityCalculator {

    public List<priorityResult> calculate(
            List<impactResult> impactResults) {

        List<priorityResult> results = new ArrayList<>();

        for (impactResult result : impactResults) {

            String priority = "P4";

            String reason;

            if (result.getImpactLevel().equals("HIGH")) {

                reason =
                        "High operational impact detected. " +
                        "P4 ticket created for human review and escalation.";

            } else if (result.getImpactLevel().equals("MEDIUM")) {

                reason =
                        "Moderate operational impact detected. " +
                        "P4 ticket created for human review.";

            } else {

                reason =
                        "Low operational impact detected. " +
                        "P4 ticket created for verification or closure.";
            }

            priorityResult priorityResult =
                    new priorityResult(
                            result.getNode(),
                            result.getAlarmType(),
                            result.getImpactLevel(),
                            priority,
                            reason
                    );

            results.add(priorityResult);
        }

        return results;
    }
}