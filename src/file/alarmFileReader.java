package file;

import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import model.alarm;

public class alarmFileReader {

    public List<alarm> readAlarms(String filePath) {

        List<alarm> alarms = new ArrayList<>();

        try (BufferedReader reader =
                     new BufferedReader(new FileReader(filePath))) {

            // Read and ignore the header
            reader.readLine();

            String line;

            while ((line = reader.readLine()) != null) {

                try {

                    String[] data = line.split(",");

                    String alarmId = data[0];
                    String node = data[1];
                    String alarmType = data[2];
                    String description = data[3];
                    String severity = data[4];

                    double threshold =
                            Double.parseDouble(data[5]);

                    double actualValue =
                            Double.parseDouble(data[6]);

                    int usersImpacted =
                            Integer.parseInt(data[7]);

                    String timestamp = data[8];

                    alarm alarm = new alarm(
                            alarmId,
                            node,
                            alarmType,
                            description,
                            severity,
                            threshold,
                            actualValue,
                            usersImpacted,
                            timestamp
                    );

                    alarms.add(alarm);

                } catch (NumberFormatException | ArrayIndexOutOfBoundsException e) {

                    System.out.println(
                            "Skipping malformed row: " + line +
                            " (" + e.getMessage() + ")"
                    );
                }
            }

        } catch (IOException e) {
            System.out.println(
                    "Error reading alarm file: " + e.getMessage()
            );
        }

        return alarms;
    }
}