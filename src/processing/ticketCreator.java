package processing;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.io.File;
import java.io.FileReader;
import java.io.Reader;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import model.ticket;
import model.ticketDraft;

public class ticketCreator {

    // Same file Main writes to. It is read here BEFORE it gets overwritten.
    private static final String EXISTING_TICKETS_FILE = "output/tickets.json";

    private int nextTicketNumber = 10001;

    // "node|alarmType" -> ticket number already issued for that group
    private final Map<String, String> knownTicketNumbers = new HashMap<>();

    public ticketCreator() {
        loadExistingTicketNumbers();
    }

    private void loadExistingTicketNumbers() {

        File file = new File(EXISTING_TICKETS_FILE);

        if (!file.exists()) {
            return;
        }

        try (Reader reader = new FileReader(file)) {

            JsonElement root = JsonParser.parseReader(reader);

            if (root == null || !root.isJsonArray()) {
                return;
            }

            for (JsonElement element : root.getAsJsonArray()) {

                JsonObject obj = element.getAsJsonObject();

                if (!obj.has("ticketNumber")
                        || !obj.has("node")
                        || !obj.has("alarmType")) {
                    continue;
                }

                String number = obj.get("ticketNumber").getAsString();

                knownTicketNumbers.put(
                        obj.get("node").getAsString()
                                + "|"
                                + obj.get("alarmType").getAsString(),
                        number
                );

                // keep the counter ahead of every number already issued
                if (number.startsWith("AL-")) {
                    try {
                        int n = Integer.parseInt(number.substring(3));
                        nextTicketNumber = Math.max(nextTicketNumber, n + 1);
                    } catch (NumberFormatException ignored) {
                        // non-numeric suffix, ignore
                    }
                }
            }

        } catch (Exception e) {
            System.out.println(
                    "Could not read existing tickets, numbering from scratch: "
                    + e.getMessage()
            );
        }
    }

    public List<ticket> createTickets(
            List<ticketDraft> drafts) {

        List<ticket> tickets = new ArrayList<>();

        for (ticketDraft draft : drafts) {

            String key =
                    draft.getNode() + "|" + draft.getAlarmType();

            String ticketNumber = knownTicketNumbers.get(key);

            if (ticketNumber == null) {
                ticketNumber = "AL-" + nextTicketNumber;
                nextTicketNumber++;
                knownTicketNumbers.put(key, ticketNumber);
            }

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