package processing;

import model.ticket;

public class notificationGenerator {

    public String buildMessage(ticket ticket){

        return "New " + ticket.getPriority() +
                "ticket created for " +
                ticket.getAlarmType() +
                " on " + 
                ticket.getNode();
    }

    public String generateNotification(ticket ticket){
        String message = buildMessage(ticket);

        System.out.println("\n ---- TEAM NOTIFICATION ----");

        System.out.println("Ticket number: " + ticket.getTicketNumber());

        System.out.println("Assigned Team: " + ticket.getAssignedTeam());

        System.out.println("Message: "+ message);

        return message;
    }
}