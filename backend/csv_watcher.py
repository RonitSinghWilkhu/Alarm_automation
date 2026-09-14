import subprocess
import time
from pathlib import Path
import os

CSV_FILE = Path("data/alarm.csv")

def run_java_pipeline():

    print("\n CSV changed. Running Java pipeline...")

    try:

        subprocess.run(
            [
                "java",
                "-cp",
                "out" + os.pathsep + "lib/gson-2.10.1.jar",
                "Main"
            ],
            check=True
        )

        print("Java pipeline completed")

    except subprocess.CalledProcessError as e:

        print(
            f"Java pipeline with exit code: {e.returncode}"
        )

def watch_csv():

    print(f"Watching: {CSV_FILE}")

    last_modified = CSV_FILE.stat().st_mtime

    while True:

        time.sleep(1)

        current_modified = CSV_FILE.stat().st_mtime

        if current_modified != last_modified:

            last_modified = current_modified

            run_java_pipeline()

if __name__ == "__main__":

    watch_csv()