import re
from pathlib import Path

from backend.database import SessionLocal
from backend.models import KnowledgeDocument, HistoricalIncident

BASE_DIR = Path(__file__).resolve().parent
KNOWLEDGE_DIR = BASE_DIR / "knowledge"
DELIMITER = "--------------------------------------------------"

def split_records(file_path):
    content = file_path.read_text(encoding="utf-8")
    return [
        block.strip()
        for block in content.split(DELIMITER)
        if block.strip()
    ]

def extract_alarm_type(content):
    patterns = [
        r"ALARM_TYPE:\s*([A-Z0-9_]+)",
        r"ALARM_TYPE:\s*([A-Z0-9_]+)",
        r"^(?:RUNBOOK|COMMAND REFERENCE):\s*([A-Z0-9_]+)",
    ]

    for pattern in patterns:
        match = re.search(pattern , content, re.IGNORECASE | re.MULTILINE)
        if match:
            return match.group(1).upper()

        return "GENERAL"

def extract_field(content, field_name):
    pattern = (
        rf"(?ms)^{re.escape(field_name)}:[ \t]*\n?"
        rf"(.*?)(?=^[A-Z][A-Z_ ]*:[ \t]*$|\Z)"
    )
    match = re.search(pattern, content)
    return match.group(1).strip() if match else None

def migrate_knowledge_documents(db, file_path, source_type):
    records = split_records(file_path)
    inserted = 0

    for content in records:
        title = content.splitlines()[0].strip()
        alarm_type = extract_alarm_type(content)

        existing = (
            db.query(KnowledgeDocument)
            .filter(
                KnowledgeDocument.source_type==source_type,
                KnowledgeDocument.title == title,
            )
            .first()
        )

        if existing:
            existing.alarm_type = alarm_type
            existing.observed_symptoms = extract_field(
                content, "OBSERVED_SYMPTOMS"
            )
            existing.actions_taken = extract_field(
                content, "ACTIONS_TAKEN"
            )
            existing.shell_commands_used = extract_field(
                content, "SHELL_COMMANDS_USED"
            )
            existing.shell_script_used = extract_field(
                content, "SHELL_SCRIPT_USED"
            )
            existing.resolution = extract_field(
                content, "RESOLUTION"
            )
            existing.escalation = extract_field(
                content, "ESCALATION"
            )
            continue

        db.add(
            KnowledgeDocument(
                source_type=source_type,
                title=title,
                alarm_type=alarm_type,
                content=content
            )
        )
        inserted += 1

    print(f"{file_path.name}: {inserted} new records processed.")


def migrate_historical_incidents(db, file_path):
    records = split_records(file_path)
    inserted = 0

    for content in records:
        match = re.search(
            r"HISTORICAL INCIDENT:\s*(\d+)",
            content,
            re.IGNORECASE,
        )

        if not match:
            print("Skipping an incident without an incident number.")
            continue

        incident_number = match.group(1)
        alarm_type = extract_alarm_type(content)

        existing = (
            db.query(HistoricalIncident)
            .filter(
                HistoricalIncident.source == "migration",
                HistoricalIncident.additional_notes
                == f"Legacy ID: {incident_number}",
            )
            .first()
        )

        if existing:
            continue

        db.add(
            HistoricalIncident(
                alarm_type=alarm_type,
                observed_symptoms=extract_field(
                    content, "OBSERVED_SYMPTOMS"
                ),
                actions_taken=extract_field(
                    content, "ACTIONS_TAKEN"
                ),
                shell_commands_used=extract_field(
                    content, "SHELL_COMMANDS_USED"
                ),
                shell_script_used=extract_field(
                    content, "SHELL_SCRIPT_USED"
                ),
                resolution=extract_field(content, "RESOLUTION"),
                escalation=extract_field(content, "ESCALATION"),
                additional_notes=f"Legacy ID: {incident_number}",
                source="migration",
            )
        )
        inserted += 1

    print(f"{file_path.name}: {inserted} new records processed.")


def main():
    runbook_file = KNOWLEDGE_DIR / "telecom_runbooks.txt"
    commands_file = KNOWLEDGE_DIR / "shell_commands.txt"
    incidents_file = KNOWLEDGE_DIR / "historical_incidents.txt"

    for file_path in (runbook_file, commands_file, incidents_file):
        if not file_path.is_file():
            raise FileNotFoundError(
                f"Knowledge file not found: {file_path}"
            )

    db = SessionLocal()

    try:
        migrate_knowledge_documents(
            db, runbook_file, "runbook"
        )
        migrate_knowledge_documents(
            db, commands_file, "commands"
        )
        migrate_historical_incidents(db, incidents_file)

        db.commit()
        print("Knowledge migration completed successfully.")

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    main()