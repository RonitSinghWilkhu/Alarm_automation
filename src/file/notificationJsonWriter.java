package file;

import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.util.List;
import model.ticket;
import processing.notificationGenerator;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Map;

public class notificationJsonWriter {

    private final Gson gson = new GsonBuilder().setPrettyPrinting().create();

    public void writeNotifications(
            List<ticket> tickets,
            String filePath) {

        File file = new File(filePath);

        File parentDirectory =
                file.getParentFile();

        if (parentDirectory != null) {
            parentDirectory.mkdirs();
        }

        notificationGenerator generator = new notificationGenerator();

        List<Map<String , Object>> notifications = new ArrayList<>();

        for(ticket ticket : tickets) {
            String message = generator.buildMessage(ticket);

            Map<String, Object> notification = new LinkedHashMap<>();

            notification.put("ticketNumber", ticket.getTicketNumber());

            notification.put("assignedTeam", ticket.getAssignedTeam());

            notification.put("message", message);
            notification.put("status", "PENDING");
            notification.put("eventType", "TICKET_CREATED");
            String createdAt = ticket.getCreatedAt();
            String timestamp =
                    (createdAt != null)
                            ? createdAt.replace(" ", "T")
                            : null;
            notification.put("timestamp", timestamp);
            notification.put("priority", ticket.getPriority());
            notification.put("alarmType", ticket.getAlarmType());
            notification.put("node", ticket.getNode());

            notifications.add(notification);
        }

        try(FileWriter writer = new FileWriter(filePath)){

            gson.toJson(notifications,writer);

            System.out.println("\nNotifications written to: " + filePath);
        } catch (IOException e) {
            System.out.println("Error writing notification: " + e.getMessage());
        }
    }
}