package processing;

import java.util.ArrayList;
import java.util.List;
import model.ticket;
import model.ticketDraft;

public class ticketCreator {

    private int nextTicketNumber = 10001;

    public List<ticket> createTickets(
            List<ticketDraft> drafts) {

        List<ticket> tickets = new ArrayList<>();

        for (ticketDraft draft : drafts) {

            String ticketNumber =
                    "AL-" + nextTicketNumber;

            nextTicketNumber++;

            ticket newTicket =
                    new ticket(
                            ticketNumber,
                            draft.getNode(),
                            draft.getAlarmType(),
                            draft.getOccurrenceCount(),
                            draft.getUsersImpacted(),
                            draft.getSeverity(),
                            draft.isThresholdBreached(),
                            draft.getImpactLevel(),
                            draft.getPriority(),
                            draft.getAssignedTeam(),
                            "OPEN",
                            draft.getReason(),
                            draft.getCreatedAt()
                    );

            tickets.add(newTicket);
        }

        return tickets;
    }
}