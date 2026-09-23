package processing;

import model.impactResult;
import model.priorityResult;
import model.ticketDraft;

import java.util.ArrayList;
import java.util.List;

public class ticketDraftGenerator {

    public List<ticketDraft> generate(
            List<impactResult> impactResults,
            List<priorityResult> priorityResults) {

        List<ticketDraft> drafts = new ArrayList<>();

        for (int i = 0; i < impactResults.size(); i++) {

            impactResult impact =
                    impactResults.get(i);

            priorityResult priority =
                    priorityResults.get(i);

            String ticketId =
                    String.format("AUTO-%03d", i + 1);

            String assignedTeam =
                    assignTeam(impact.getAlarmType());

            ticketDraft draft =
                    new ticketDraft(
                            ticketId,
                            impact.getNode(),
                            impact.getAlarmType(),
                            impact.getOccurrenceCount(),
                            impact.getUsersImpacted(),
                            impact.getSeverity(),
                            impact.isThresholdBreached(),
                            impact.getImpactLevel(),
                            priority.getPriority(),
                            assignedTeam,
                            "DRAFT",
                            priority.getReason(),
                            impact.getCreatedAt()
                    );

            drafts.add(draft);
        }

        return drafts;
    }

    private String assignTeam(String alarmType) {

        switch (alarmType) {

            case "S1_LINK_DOWN":
                return "Transport";

            case "POWER_FAILURE":
                return "Power";

            case "HIGH_CPU":
                return "Platform";

            case "VSWR_HIGH":
                return "Radio";

            case "CELL_UNAVAILABLE":
                return "Radio";

            case "HIGH_TEMPERATURE":
                return "Hardware";

            default:
                return "Network Operations";
        }
    }
}