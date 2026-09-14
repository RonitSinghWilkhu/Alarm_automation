import sys
import subprocess

watcher = subprocess.Popen(
    [
        sys.executable,
        "backend/csv_watcher.py"
    ]
)

backend = subprocess.Popen(
    [
        sys.executable,
        "-m",
        "uvicorn",
        "backend.main:app",
        "--port",
        "8001"
    ]
)

frontend = subprocess.Popen(
    [
        sys.executable,
        "-m",
        "http.server",
        "5500",
        "--directory",
        "frontend"
    ]
)

try:

    watcher.wait()
    backend.wait()
    frontend.wait()

except KeyboardInterrupt:

    print("\nStopping dashboard...")

    watcher.terminate()
    backend.terminate()
    frontend.terminate()