package file;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import model.ticket;

import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.util.List;

public class ticketJsonWriter {

    private final Gson gson = new GsonBuilder().setPrettyPrinting().create();

    public void writeTickets(
            List<ticket> tickets,
            String filePath) {

        try {

            File file = new File(filePath);

            File parentDirectory =
                    file.getParentFile();

            if (parentDirectory != null) {
                parentDirectory.mkdirs();
            }

            try (FileWriter writer = new FileWriter(filePath)) {
                gson.toJson(tickets, writer);
            }

            System.out.println(
                    "\nCreated tickets written to: " +
                    filePath
            );

        } catch (IOException e) {

            System.out.println(
                    "Error writing ticket JSON: " +
                    e.getMessage()
            );
        }
    }
}