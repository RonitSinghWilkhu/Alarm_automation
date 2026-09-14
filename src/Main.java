import file.alarmFileReader;
import file.notificationJsonWriter;
import file.ticketJsonWriter;
import java.util.List;
import model.alarm;
import model.alarmGroup;
import model.impactResult;
import model.priorityResult;
import model.ticket;
import model.ticketDraft;
import processing.alarmGrouper;
import processing.impactAnalyzer;
import processing.notificationGenerator;
import processing.priorityCalculator;
import processing.ticketCreator;
import processing.ticketDraftGenerator;

public class Main {
    public static void main(String[] args) {

        //reading the csv
        alarmFileReader reader = new alarmFileReader();

        List<alarm> alarms = 
                reader.readAlarms("data/alarm.csv");

        System.out.println("total alarms read: "+alarms.size());

        // for(alarm a : alarms){
        //     System.out.println(a);
        // }

        //group related alarms
        alarmGrouper grouper = new alarmGrouper();

        List<alarmGroup> groups = grouper.groupAlarms(alarms);

        System.out.println("total alarm groups: "+groups.size());

        // //display groups
        // for(alarmGroup group : groups){
        //     System.out.println(group);
        // }

        //analyze impact

        impactAnalyzer analyzer = new impactAnalyzer();
        List<impactResult> impactResults = analyzer.analyze(groups);

        System.out.println("\n--- IMPACT ANALYSIS ---");

        for (impactResult result : impactResults){
            System.out.println(result);
        }

        //calculate priority
        priorityCalculator calculator = new priorityCalculator();

        List<priorityResult> priorityResults = calculator.calculate(impactResults);

        System.out.println("\n--- PRIORITY RESULTS ---");

        for(priorityResult result : priorityResults){
            System.out.println(result);
        }

        //generate ticket drafts

        ticketDraftGenerator draftGenerator = new ticketDraftGenerator();
        List<ticketDraft> drafts = draftGenerator.generate(impactResults, priorityResults);

        System.out.println("\n--- TICKET DRAFTS ---");

        for(ticketDraft draft : drafts){
            System.out.println(draft);
        }

        // //write ticket drafts in json
        //ticketJsonWriter jsonWriter = new ticketJsonWriter();

        //jsonWriter.writeTickets(drafts, "output/ticket_drafts.json" );

        //create p4 ticket
        ticketCreator creator = new ticketCreator();
        List<ticket> tickets = creator.createTickets(drafts);

        notificationGenerator notifier = new notificationGenerator();
        for(ticket ticket : tickets){
            notifier.generateNotification(ticket);
        }

        notificationJsonWriter notificationwriter = new notificationJsonWriter();
        notificationwriter.writeNotifications(tickets, "output/notifications.json");

        System.out.println("\n--- CREATED TICKETS ---");

        for(ticket t : tickets){
            System.out.println(t);
        }

        ticketJsonWriter ticketWriter = new ticketJsonWriter();
        ticketWriter.writeTickets(tickets, "output/tickets.json");
    }
}
