import sys
import subprocess

processes = []

try:
    print("Starting CSV watcher....")
    watcher = subprocess.Popen(
        [sys.executable, "backend/csv_watcher.py"]
    )
    processes.append(watcher)
    print("CSV watcher startup completed.")

    print("Starting FASTAPI backend...")
    backend = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "backend.main:app",
            "--port",
            "8001",
            "--reload"
        ]
    )
    processes.append(backend)
    print("FASTApi startup completed.")

    print("Starting frontend...")
    frontend = subprocess.Popen(
        ["npm","run","dev"],
        cwd="frontend",
        shell=(sys.platform == "win32"),
    )
    processes.append(frontend)
    print("Frontend startup completed")

    print("\nAlarmops is starting...")
    print("Frontend: http://localhost:5173")
    print("Backend: http://localhost:8001")
    print("Press Ctrl+C to stop all services.\n")

    while True:
        for name, process in [
            ("CSV watcher", watcher),
            ("FastApi backend", backend),
            ("React Frontend", frontend)
        ]:
            if process.poll() is not None:
                raise RuntimeError(
                    f"{name} stopped unexpectedly "
                    f"(exit code {process.returncode})."
                )

        import time
        time.sleep(1)

except (KeyboardInterrupt, RuntimeError) as error:
    if isinstance(error, RuntimeError):
        print(f"\nError: {error}")

finally:
    print("\nStopping AlarmOps services...")

    for process in reversed(processes):
        if process.poll() is None:
            process.terminate()

    for process in reversed(processes):
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()

    print("All services stopped.")